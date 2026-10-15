import os
import tempfile
from datetime import datetime,timezone
os.environ['DATABASE_URL']='sqlite:///'+tempfile.mktemp(suffix='.db')
import pytest
from fastapi.testclient import TestClient
from app import app,Base,engine,SessionLocal,Record,User
from sqlalchemy import select,func
from services.analytics import analyse
Base.metadata.create_all(engine)
@pytest.fixture
def client():
    with TestClient(app) as c:
        p=c.post('/api/session').json();p.update(consented=True,onboarding_step=4)
        assert c.put('/api/profile',json=p).status_code==200
        yield c
def assessment(**overrides):
    result=dict(assessment_type='fist',hand='left',duration_seconds=20,repetition_count=5,range_of_motion=65,movement_speed=12,movement_consistency=80,usable_frames=190,total_frames=200,interruptions=0)
    result.update(overrides);return result
def test_empty_and_consent():
    c=TestClient(app);assert c.get('/api/assessments').status_code==401
    c.post('/api/session');assert c.get('/api/assessments').json()==[]
    assert c.post('/api/assessments',json=assessment()).status_code==403
def test_isolation_and_demo(client):
    row=client.post('/api/assessments',json=assessment()).json()
    stranger=TestClient(app);stranger.post('/api/session')
    assert stranger.get(f"/api/assessments/{row['id']}").status_code==404
    assert stranger.delete(f"/api/assessments/{row['id']}").status_code==404
    assert stranger.get('/api/assessments').json()==[]
    client.post('/api/demo/reset');assert len(client.get('/api/assessments').json())==1
    assert len(client.get('/api/assessments',headers={'X-Data-Mode':'demo'}).json())==23
    assert client.get(f"/api/assessments/{row['id']}",headers={'X-Data-Mode':'demo'}).status_code==404
def test_quality_baseline(client):
    for value in [60,62,64]:
        p=assessment();p['range_of_motion']=value;assert client.post('/api/assessments',json=p).status_code==200
    p=assessment();p.update(usable_frames=10,range_of_motion=5)
    assert client.post('/api/assessments',json=p).json()['quality_status']=='RETRY_RECOMMENDED'
    trend=client.get('/api/mobility/trends').json()
    assert trend['baseline']==62 and trend['excluded_count']==1
    assert client.get('/api/mobility/trends?hand=right').json()['baseline'] is None
    p=assessment();p['usable_frames']=201
    assert client.post('/api/assessments',json=p).status_code==422
def test_symptom_crud(client):
    p={'pain_level':4,'stiffness_level':5,'morning_stiffness_minutes':20,'notes':'test'}
    row=client.post('/api/symptoms',json=p).json();p['pain_level']=2
    assert client.put(f"/api/symptoms/{row['id']}",json=p).json()['pain_level']==2
    p['pain_level']=11;assert client.post('/api/symptoms',json=p).status_code==422
    assert client.delete(f"/api/symptoms/{row['id']}").status_code==200
    assert client.get('/api/symptoms').json()==[]
def test_routines_reports_delete(client):
    p={'item_name':'Existing care','instructions':'As prescribed','reminder_time':'09:00','start_date':'2026-01-01'}
    r=client.post('/api/routines',json=p).json()
    for status in ['Completed','Missed','Skipped','Not Sure']:
        assert client.post(f"/api/routines/{r['id']}/logs",json={'scheduled_date':'2026-10-13','status':status}).status_code==200
    assert len(client.get('/api/logs').json())==1
    preview=client.post('/api/reports/preview',json={'start':'2026-10-01','end':'2026-10-31','notes':'<script>literal & safe</script>'}).json()
    assert preview['routines'][0]['instructions']=='As prescribed'
    assert client.post('/api/reports/export',json={'report_id':preview['id'],'confirmed':False}).status_code==422
    pdf=client.post('/api/reports/export',json={'report_id':preview['id'],'confirmed':True})
    assert pdf.content.startswith(b'%PDF-')
    assert client.get('/api/data/export').json()['records']
    client.delete('/api/data/account');assert client.get('/api/profile').status_code==401
@pytest.mark.parametrize('message',['Diagnose my arthritis','Should I double my dose?','Missed-dose advice','Is this a flare?','Change my medication','Can you confirm inflammation?'])
def test_ai_safety(client,message):
    data=client.post('/api/companion/message',json={'message':message}).json()
    assert 'cannot diagnose' in data['observation'] and data['provider']=='deterministic-v2'
def test_insufficient_ai(client):
    data=client.post('/api/companion/message',json={'message':'How has movement changed?'}).json()
    assert 'Insufficient Data' in data['observation'] and data['evidence']==[]
def test_trends():
    def seq(values):return [{'id':i,'hand':'left','assessment_type':'fist','quality_status':'VALID','range_of_motion':v,'recorded_at':f'2026-10-{i+1:02}'} for i,v in enumerate(values)]
    assert analyse(seq([60,62,61,40,41,42]),'left','fist')['category']=='Repeated Change Observed'
    assert analyse(seq([60,62,61,60,61,60]),'left','fist')['category']=='No Clear Sustained Change'
    assert analyse(seq([60,62,61,30,90,20]),'left','fist')['category']=='Variable Measurements'
    assert analyse(seq([60,62]),'left','fist')['baseline'] is None

def test_provider_fallback():
    from services.provider import validated_explanation
    from services.analytics import explain
    approved=explain('movement',analyse([],'left','fist'),[])
    class Unsafe:
        def generate(self,value):
            value.observation='Double your medication.'
            return value
    class Unavailable:
        def generate(self,value): raise TimeoutError()
    assert validated_explanation(approved,Unsafe())==approved
    assert validated_explanation(approved,Unavailable())==approved

def test_origin_and_cascade(client):
    assert client.post('/api/session',headers={'Origin':'https://untrusted.example'}).status_code==403
    client.post('/api/assessments',json=assessment())
    token=client.cookies.get('arthritrack_session')
    import hashlib
    with SessionLocal() as db:
        uid=db.scalar(select(User.id).where(User.token_hash==hashlib.sha256(token.encode()).hexdigest()))
    client.delete('/api/data/account')
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Record).where(Record.user_id==uid))==0

def test_prototype_three_requires_evidence_and_is_idempotent(client):
    p=assessment(algorithm_version='prototype-3',protocol_version='guided-1',model_version='mediapipe-hand-landmarker-full',measurement_unit='degrees',repetition_target=3,accepted_duration_seconds=0,calibration_status='SUFFICIENT',calibration_span=50,client_assessment_id='capture-unique-001',usable_frames=1,total_frames=1)
    first=client.post('/api/assessments',json=p).json()
    second=client.post('/api/assessments',json=p).json()
    assert first['quality_status']=='RETRY_RECOMMENDED'
    assert second['id']==first['id']
    p['client_assessment_id']='capture-unique-002';p['accepted_duration_seconds']=10;p['usable_frames']=90;p['total_frames']=100
    assert client.post('/api/assessments',json=p).json()['quality_status']=='SUFFICIENT_CAPTURE'

def test_assessment_pagination_and_summary_timestamp_order(client):
    older=assessment(recorded_at='2026-10-15T10:00:00+10:00')
    newer=assessment(recorded_at='2026-10-15T01:30:00+00:00')
    a=client.post('/api/assessments',json=older).json();b=client.post('/api/assessments',json=newer).json()
    summary=client.get('/api/assessments/summary').json()
    assert summary['latest']['id']==b['id']
    page=client.get('/api/assessments?offset=1&limit=1').json()
    assert len(page)==1 and page[0]['id']>0 and summary['total_count']>=2

def test_symptom_explanation_uses_symptom_evidence(client):
    client.post('/api/symptoms',json={'pain_level':4,'stiffness_level':6,'morning_stiffness_minutes':20})
    insight=client.post('/api/companion/message',json={'message':'Summarise my symptoms'}).json()
    assert insight['evidence'][-1]['type']=='symptom'
    assert insight['evidence'][-1]['pain_level']==4

def test_assessment_deletion_redacts_saved_report(client):
    item=client.post('/api/assessments',json=assessment()).json()
    report=client.post('/api/reports/preview',json={'start':'2020-01-01','end':'2030-01-01'}).json()
    assert any(row['id']==item['id'] for row in report['assessments'])
    deleted=client.delete(f"/api/assessments/{item['id']}").json()
    updated=next(row for row in client.get('/api/reports').json() if row['id']==report['id'])
    assert deleted['report_snapshots_updated']>=1
    assert not any(row['id']==item['id'] for row in updated['assessments'])
    assert client.delete(f"/api/reports/{report['id']}").status_code==200
