"""Private browser identities. Only measurements, never camera frames, reach this API."""
from __future__ import annotations
import hashlib, os, secrets, logging, time
from datetime import datetime, timezone, timedelta, date
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy import create_engine, select, ForeignKey, String, JSON, event, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from services.analytics import analyse, explain
from services.reports import make_pdf
from services.provider import validated_explanation

DATABASE_URL=os.getenv('DATABASE_URL','sqlite:///./arthritrack-v2.db')
engine=create_engine(DATABASE_URL,connect_args={'check_same_thread':False} if DATABASE_URL.startswith('sqlite') else {})
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine,'connect')
    def sqlite_fk(connection,_): connection.execute('PRAGMA foreign_keys=ON')
SessionLocal=sessionmaker(engine)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__='users'
    id: Mapped[int]=mapped_column(primary_key=True)
    token_hash: Mapped[str]=mapped_column(String(64),unique=True)
    profile: Mapped[dict]=mapped_column(JSON,default=dict)
class Record(Base):
    __tablename__='records'
    id: Mapped[int]=mapped_column(primary_key=True)
    user_id: Mapped[int]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True)
    kind: Mapped[str]=mapped_column(String(30),index=True)
    mode: Mapped[str]=mapped_column(String(8),index=True)
    data: Mapped[dict]=mapped_column(JSON)
def now(): return datetime.now(timezone.utc).isoformat()
def db_session():
    with SessionLocal() as db: yield db
def identity(request:Request,db=Depends(db_session)):
    token=request.cookies.get('arthritrack_session','')
    user=db.scalar(select(User).where(User.token_hash==hashlib.sha256(token.encode()).hexdigest())) if token else None
    if not user: raise HTTPException(401,'Session expired. Reload to start a private local profile.')
    return user
def mode(request:Request):
    value=request.headers.get('X-Data-Mode','real')
    if value not in ('real','demo'): raise HTTPException(400,'Invalid data mode')
    return value
def records(db,user,kind,m): return db.scalars(select(Record).where(Record.user_id==user.id,Record.kind==kind,Record.mode==m).order_by(Record.id)).all()
def unpack(row): return {**row.data,'id':row.id}
def rows(db,user,kind,m): return [unpack(r) for r in records(db,user,kind,m)]
def add(db,user,kind,m,data):
    row=Record(user_id=user.id,kind=kind,mode=m,data=data); db.add(row); db.commit(); db.refresh(row); return unpack(row)
def owned(db,user,kind,m,rid):
    row=db.scalar(select(Record).where(Record.id==rid,Record.user_id==user.id,Record.kind==kind,Record.mode==m))
    if not row: raise HTTPException(404,'Record not found')
    return row
def consent(user,m):
    if m=='real' and not user.profile.get('consented'): raise HTTPException(403,'Complete privacy consent first')
class Strict(BaseModel): model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
class Profile(Strict):
    preferred_name:str=Field(default='',max_length=80)
    age_range:str=Field(default='',max_length=30)
    arthritis_type:Literal['OA','RA','Other','Unsure']='Unsure'
    affected_hands:Literal['left','right','both']='both'
    difficulty:str=Field(default='',max_length=100)
    goals:str=Field(default='',max_length=500)
    onboarding_step:int=Field(default=0,ge=0,le=4)
    consented:bool=False
    readable:bool=False
class Assessment(Strict):
    assessment_type:Literal['fist','spread','opposition']
    hand:Literal['left','right']
    recorded_at:datetime=Field(default_factory=lambda:datetime.now(timezone.utc))
    duration_seconds:float=Field(ge=1,le=300)
    repetition_count:int=Field(ge=0,le=200)
    range_of_motion:float=Field(ge=0,le=180)
    movement_speed:float=Field(ge=0,le=10000)
    movement_consistency:float=Field(ge=0,le=100)
    usable_frames:int=Field(ge=0)
    total_frames:int=Field(ge=1,le=100000)
    interruptions:int=Field(ge=0,le=10000)
    quality_reasons:list[str]=Field(default_factory=list,max_length=20)
    algorithm_version:Literal['prototype-2','prototype-3']='prototype-2'
    protocol_version:str|None=Field(default=None,max_length=50)
    model_version:str|None=Field(default=None,max_length=160)
    measurement_unit:Literal['degrees','palm_widths']|None=None
    repetition_target:int|None=Field(default=None,ge=1,le=100)
    accepted_duration_seconds:float|None=Field(default=None,ge=0,le=300)
    calibration_status:Literal['SUFFICIENT','LIMITED','INSUFFICIENT']|None=None
    calibration_span:float|None=Field(default=None,ge=0,le=10000)
    per_finger:dict=Field(default_factory=dict,max_length=8)
    cycle_repeatability:float|None=Field(default=None,ge=0,le=100)
    client_assessment_id:str|None=Field(default=None,min_length=8,max_length=80)
    @model_validator(mode='after')
    def validate_frames(self):
        if self.usable_frames>self.total_frames: raise ValueError('Usable frames exceed total')
        if self.recorded_at.tzinfo is None: raise ValueError('Timezone required')
        if self.algorithm_version=='prototype-3' and (not self.protocol_version or not self.model_version or not self.measurement_unit or not self.repetition_target or not self.client_assessment_id): raise ValueError('Prototype-3 measurement provenance is incomplete')
        return self
class Symptom(Strict):
    recorded_at:datetime=Field(default_factory=lambda:datetime.now(timezone.utc))
    hand:Literal['left','right','both']='both'
    pain_level:int=Field(ge=0,le=10)
    stiffness_level:int=Field(ge=0,le=10)
    morning_stiffness_minutes:int=Field(ge=0,le=1440)
    swelling:Literal['none','yes','unsure']='none'
    daily_difficulty:str=Field(default='',max_length=300)
    notes:str=Field(default='',max_length=3000)
    @model_validator(mode='after')
    def tz(self):
        if self.recorded_at.tzinfo is None: raise ValueError('Timezone required')
        return self
class Routine(Strict):
    item_name:str=Field(min_length=1,max_length=150)
    instructions:str=Field(min_length=1,max_length=2000)
    reminder_time:str=Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    start_date:date
    end_date:date|None=None
    notes:str=Field(default='',max_length=2000)
    active:bool=True
    @model_validator(mode='after')
    def dates(self):
        if self.end_date and self.end_date<self.start_date: raise ValueError('End precedes start')
        return self
class RoutineLog(Strict):
    scheduled_date:date
    status:Literal['Completed','Missed','Skipped','Not Sure']
    reason:str=Field(default='',max_length=500)
class Message(Strict):
    message:str=Field(min_length=1,max_length=2000)
    hand:Literal['left','right']='left'
    assessment_type:Literal['fist','spread','opposition']='fist'
class Report(Strict):
    start:date
    end:date
    identifier:str=Field(default='',max_length=100)
    sections:list[Literal['assessments','symptoms','routines']]=Field(default_factory=lambda:['assessments','symptoms','routines'])
    notes:str=Field(default='',max_length=3000)
    questions:str=Field(default='',max_length=3000)
    @model_validator(mode='after')
    def dates(self):
        if self.end<self.start: raise ValueError('End precedes start')
        return self
class Export(Strict):
    report_id:int
    confirmed:Literal[True]
app=FastAPI(title='ArthriTrack',version='2.0.0')
logger=logging.getLogger('arthritrack.requests')
app.add_middleware(CORSMiddleware,allow_origins=os.getenv('ALLOWED_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(','),allow_credentials=True,allow_methods=['GET','POST','PUT','DELETE'],allow_headers=['Content-Type','X-Data-Mode'])
@app.middleware('http')
async def headers(request,call_next):
    origin=request.headers.get('origin')
    allowed=os.getenv('ALLOWED_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',')
    if request.method in ('POST','PUT','DELETE') and origin and origin not in allowed:
        return Response('{"detail":"Origin not allowed"}',status_code=403,media_type='application/json')
    began=time.monotonic(); response=await call_next(request)
    logger.info('request method=%s status=%s elapsed_ms=%d',request.method,response.status_code,int((time.monotonic()-began)*1000))
    response.headers['Cache-Control']='no-store'; response.headers['X-Content-Type-Options']='nosniff'; return response
@app.get('/api/health')
def health(): return {'status':'ok','provider':'deterministic','identity':'private browser session'}
@app.post('/api/session')
def session(request:Request,response:Response,db=Depends(db_session)):
    token=request.cookies.get('arthritrack_session','')
    user=db.scalar(select(User).where(User.token_hash==hashlib.sha256(token.encode()).hexdigest())) if token else None
    if not user:
        token=secrets.token_urlsafe(48); user=User(token_hash=hashlib.sha256(token.encode()).hexdigest(),profile=Profile().model_dump()); db.add(user); db.commit()
    response.set_cookie('arthritrack_session',token,httponly=True,secure=os.getenv('COOKIE_SECURE','false')=='true',samesite='strict',max_age=31536000)
    return user.profile
@app.get('/api/profile')
def profile(user=Depends(identity)): return user.profile
@app.put('/api/profile')
def put_profile(payload:Profile,user=Depends(identity),db=Depends(db_session)):
    if payload.consented and not user.profile.get('consented'): add(db,user,'consents','real',{'version':'2026-1','accepted_at':now(),'scope':'measurements, symptoms, routines, deterministic explanations'})
    user.profile=payload.model_dump(); db.commit(); return user.profile
@app.get('/api/assessments')
def assessments(user=Depends(identity),db=Depends(db_session),m=Depends(mode),offset:int=Query(0,ge=0),limit:int=Query(200,ge=1,le=500)):
    query=select(Record).where(Record.user_id==user.id,Record.kind=='assessments',Record.mode==m).order_by(Record.id).offset(offset).limit(limit)
    return [unpack(r) for r in db.scalars(query).all()]
@app.get('/api/assessments/summary')
def assessment_summary(user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    query=select(Record).where(Record.user_id==user.id,Record.kind=='assessments',Record.mode==m)
    total=db.scalar(select(func.count()).select_from(query.subquery())) or 0
    valid=[unpack(r) for r in db.scalars(query).all() if r.data.get('quality_status') in ('VALID','SUFFICIENT_CAPTURE')]
    return {'total_count':total,'latest':max(valid,key=lambda r:datetime.fromisoformat(r['recorded_at'].replace('Z','+00:00'))) if valid else None}
@app.post('/api/assessments')
def save_assessment(payload:Assessment,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m)
    if payload.client_assessment_id:
        existing=next((unpack(r) for r in records(db,user,'assessments',m) if r.data.get('client_assessment_id')==payload.client_assessment_id),None)
        if existing:return existing
    data=payload.model_dump(mode='json'); ratio=payload.usable_frames/payload.total_frames; accepted=payload.accepted_duration_seconds if payload.accepted_duration_seconds is not None else payload.duration_seconds
    data['tracking_quality']=round(ratio*100,1)
    data['server_received_at']=now()
    data['quality_status']='SUFFICIENT_CAPTURE' if payload.usable_frames>=30 and accepted>=3 and ratio>=.85 and payload.repetition_count>=3 and payload.duration_seconds>=5 and payload.interruptions<=5 else 'LIMITED_CAPTURE' if payload.usable_frames>=10 and accepted>=1 and ratio>=.65 and payload.repetition_count>=1 else 'RETRY_RECOMMENDED'
    return add(db,user,'assessments',m,data)
@app.get('/api/assessments/{rid}')
def assessment(rid:int,user=Depends(identity),db=Depends(db_session),m=Depends(mode)): return unpack(owned(db,user,'assessments',m,rid))
@app.delete('/api/assessments/{rid}')
def delete_assessment(rid:int,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    db.delete(owned(db,user,'assessments',m,rid))
    affected=0
    for report in records(db,user,'reports',m):
        before=report.data.get('assessments',[]); after=[item for item in before if item.get('id')!=rid]
        if len(after)!=len(before): report.data={**report.data,'assessments':after,'source_deletions':[*(report.data.get('source_deletions') or []),{'kind':'assessment','id':rid,'deleted_at':now()}]};affected+=1
    db.commit(); return {'deleted':True,'report_snapshots_updated':affected}
@app.get('/api/symptoms')
def symptoms(user=Depends(identity),db=Depends(db_session),m=Depends(mode)): return rows(db,user,'symptoms',m)
@app.post('/api/symptoms')
def save_symptom(payload:Symptom,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m); return add(db,user,'symptoms',m,payload.model_dump(mode='json'))
@app.put('/api/symptoms/{rid}')
def edit_symptom(rid:int,payload:Symptom,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m);row=owned(db,user,'symptoms',m,rid); row.data=payload.model_dump(mode='json'); db.commit(); return unpack(row)
@app.delete('/api/symptoms/{rid}')
def delete_symptom(rid:int,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    db.delete(owned(db,user,'symptoms',m,rid)); db.commit(); return {'deleted':True}
@app.get('/api/routines')
def routines(user=Depends(identity),db=Depends(db_session),m=Depends(mode)): return rows(db,user,'routines',m)
@app.post('/api/routines')
def save_routine(payload:Routine,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m); return add(db,user,'routines',m,payload.model_dump(mode='json'))
@app.put('/api/routines/{rid}')
def edit_routine(rid:int,payload:Routine,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m);row=owned(db,user,'routines',m,rid); row.data=payload.model_dump(mode='json'); db.commit(); return unpack(row)
@app.delete('/api/routines/{rid}')
def delete_routine(rid:int,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    db.delete(owned(db,user,'routines',m,rid))
    for row in records(db,user,'logs',m):
        if row.data['routine_id']==rid: db.delete(row)
    db.commit(); return {'deleted':True}
@app.get('/api/logs')
def logs(user=Depends(identity),db=Depends(db_session),m=Depends(mode)): return rows(db,user,'logs',m)
@app.get('/api/routines/{rid}/logs')
def item_logs(rid:int,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    owned(db,user,'routines',m,rid); return [r for r in rows(db,user,'logs',m) if r['routine_id']==rid]
@app.post('/api/routines/{rid}/logs')
def log(rid:int,payload:RoutineLog,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m);owned(db,user,'routines',m,rid); data={**payload.model_dump(mode='json'),'routine_id':rid,'logged_at':now()}
    for row in records(db,user,'logs',m):
        if row.data['routine_id']==rid and row.data['scheduled_date']==str(payload.scheduled_date): row.data=data; db.commit(); return unpack(row)
    return add(db,user,'logs',m,data)
@app.get('/api/mobility/baseline')
@app.get('/api/mobility/trends')
@app.get('/api/mobility/summary')
def trends(hand:Literal['left','right']='left',assessment_type:Literal['fist','spread','opposition']='fist',metric:Literal['range_of_motion','movement_speed','movement_consistency']='range_of_motion',user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    return analyse(rows(db,user,'assessments',m),hand,assessment_type,metric)
@app.post('/api/companion/message')
@app.post('/api/insights/generate')
def message(payload:Message,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m);result=validated_explanation(explain(payload.message,analyse(rows(db,user,'assessments',m),payload.hand,payload.assessment_type),rows(db,user,'symptoms',m))); return add(db,user,'insights',m,{'prompt':payload.message,**result,'created_at':now()})
@app.get('/api/insights')
def insights(user=Depends(identity),db=Depends(db_session),m=Depends(mode)): return rows(db,user,'insights',m)
@app.post('/api/reports/preview')
def preview(payload:Report,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    consent(user,m);content=payload.model_dump(mode='json'); content['mode']=m; content['created_at']=now()
    for kind in payload.sections:
        items=rows(db,user,kind,m)
        content[kind]=[r for r in items if str(payload.start)<=r.get('recorded_at','')[:10]<=str(payload.end)] if kind!='routines' else [r for r in items if r['start_date']<=str(payload.end) and (not r.get('end_date') or r['end_date']>=str(payload.start))]
        if kind=='assessments':
            content[kind]=[{**r,'measurement_unit':r.get('measurement_unit') or ('palm_widths' if r.get('assessment_type')=='opposition' else 'degrees')} for r in content[kind]]
    content['logs']=[r for r in rows(db,user,'logs',m) if str(payload.start)<=r['scheduled_date']<=str(payload.end)] if 'routines' in payload.sections else []
    content['baselines']=[{'hand':h,'type':t,**analyse([r for r in rows(db,user,'assessments',m) if r['recorded_at'][:10]<=str(payload.end)],h,t)} for h in ['left','right'] for t in ['fist','spread','opposition']] if 'assessments' in payload.sections else []
    return add(db,user,'reports',m,content)
@app.post('/api/reports/export')
def export(payload:Export,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    return Response(make_pdf(unpack(owned(db,user,'reports',m,payload.report_id))),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="ArthriTrack-summary.pdf"'})
@app.get('/api/reports')
def reports(user=Depends(identity),db=Depends(db_session),m=Depends(mode)): return rows(db,user,'reports',m)
@app.delete('/api/reports/{rid}')
def delete_report(rid:int,user=Depends(identity),db=Depends(db_session),m=Depends(mode)):
    db.delete(owned(db,user,'reports',m,rid));db.commit();return {'deleted':True}
@app.get('/api/data/export')
def data_export(user=Depends(identity),db=Depends(db_session)): return {'profile':user.profile,'records':[{'kind':r.kind,'mode':r.mode,**unpack(r)} for r in db.scalars(select(Record).where(Record.user_id==user.id)).all()]}
@app.delete('/api/data/account')
def delete_account(response:Response,user=Depends(identity),db=Depends(db_session)):
    db.delete(user); db.commit(); response.delete_cookie('arthritrack_session'); return {'deleted':True}
@app.post('/api/demo/reset')
def demo(user=Depends(identity),db=Depends(db_session)):
    for row in db.scalars(select(Record).where(Record.user_id==user.id,Record.mode=='demo')).all(): db.delete(row)
    db.commit()
    for hand,values in [('left',[68,70,69,70,69,58,57,56]),('right',[65,66,64,81,49,78,50,70])]:
        for i,value in enumerate(values): add(db,user,'assessments','demo',{'assessment_type':'fist','hand':hand,'recorded_at':(datetime.now(timezone.utc)-timedelta(days=(8-i)*3)).isoformat(),'duration_seconds':30,'repetition_count':5,'range_of_motion':value,'movement_speed':12+i*.2,'movement_consistency':87,'usable_frames':285,'total_frames':300,'interruptions':0,'quality_reasons':[],'algorithm_version':'prototype-2','quality_status':'VALID','tracking_quality':95,'synthetic':True})
    for i in range(7): add(db,user,'symptoms','demo',{'recorded_at':(datetime.now(timezone.utc)-timedelta(days=6-i)).isoformat(),'hand':'both','pain_level':3+i%3,'stiffness_level':4+i%2,'morning_stiffness_minutes':20+i*2,'swelling':'unsure','daily_difficulty':'Opening jars','notes':'Synthetic example entry','synthetic':True})
    for i,value in enumerate([12,13,12,12.5,12,13]):
        add(db,user,'assessments','demo',{'assessment_type':'spread','hand':'left','recorded_at':(datetime.now(timezone.utc)-timedelta(days=(6-i)*2)).isoformat(),'duration_seconds':30,'repetition_count':5,'range_of_motion':value,'movement_speed':4,'movement_consistency':85,'usable_frames':285,'total_frames':300,'interruptions':0,'quality_reasons':[],'algorithm_version':'prototype-2','quality_status':'VALID','tracking_quality':95,'synthetic':True})
    add(db,user,'assessments','demo',{'assessment_type':'spread','hand':'left','recorded_at':now(),'duration_seconds':15,'repetition_count':1,'range_of_motion':2,'movement_speed':1,'movement_consistency':20,'usable_frames':40,'total_frames':200,'interruptions':7,'quality_reasons':['Hand outside frame','Incomplete cycles'],'algorithm_version':'prototype-2','quality_status':'RETRY_REQUIRED','tracking_quality':20,'synthetic':True})
    routine=add(db,user,'routines','demo',{'item_name':'Example prescribed care','instructions':'Follow your existing clinician-provided plan. Synthetic example only.','reminder_time':'09:00','start_date':str(date.today()-timedelta(days=7)),'end_date':None,'notes':'Example only','active':True})
    for i,status in enumerate(['Completed','Missed','Not Sure']): add(db,user,'logs','demo',{'routine_id':routine['id'],'scheduled_date':str(date.today()-timedelta(days=i)),'status':status,'reason':'Synthetic example','logged_at':now()})
    return {'reset':True}
