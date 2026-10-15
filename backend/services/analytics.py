import os
from statistics import median,pstdev
CHANGE_FRACTION=float(os.getenv('TREND_CHANGE_FRACTION','.12'))
def analyse(records,hand,kind,metric='range_of_motion'):
    selected=sorted([r for r in records if r['hand']==hand and r['assessment_type']==kind],key=lambda r:r['recorded_at'])
    valid=[r for r in selected if r['quality_status']=='VALID']; values=[r[metric] for r in valid]; reference=values[:3]
    baseline=median(reference) if len(reference)==3 else None; category='Insufficient Data'
    if len(values)>=6 and baseline is not None:
        recent=values[-3:]; threshold=max(abs(baseline)*CHANGE_FRACTION,1); changes=[v-baseline for v in recent]
        if all(v < -threshold for v in changes) or all(v > threshold for v in changes): category='Repeated Change Observed'
        elif pstdev(recent)>threshold: category='Variable Measurements'
        else: category='No Clear Sustained Change'
    return {'category':category,'baseline':baseline,'variability':pstdev(reference) if len(reference)==3 else None,'reference_dates':[r['recorded_at'] for r in valid[:3]],'valid_count':len(valid),'excluded_count':len(selected)-len(valid),'delta':values[-1]-baseline if baseline is not None else None,'previous_delta':values[-1]-values[-2] if len(values)>1 else None,'metric':metric,'sessions':selected,'limitation':'App reference from first three valid sessions; prototype thresholds, not medical ranges.'}
def explain(prompt,trend,symptoms):
    safety=any(w in prompt.lower() for w in ['diagnos','dose','dosing','medication','medicine','double','stop taking','flare','cure','prescrib','side effect','missed','inflammation'])
    if safety: observation='I cannot diagnose arthritis, confirm a flare, or give medication or missed-dose instructions. Refer to your prescription instructions or ask your doctor or pharmacist.'
    elif any(w in prompt.lower() for w in ['symptom','pain','stiffness']):
        recent=sorted(symptoms,key=lambda r:r['recorded_at'])[-7:]
        observation=f"Across your latest {len(recent)} symptom entries, self-reported pain ranges from {min(r['pain_level'] for r in recent)} to {max(r['pain_level'] for r in recent)} out of 10. These reports do not establish the cause of symptoms." if recent else 'There are no symptom entries yet. A check-in can help you record your experience.'
    else: observation=f"{trend['category']}. There are {trend['valid_count']} valid sessions for the selected hand and assessment. " + (f"Your app reference is {trend['baseline']:.1f}; the latest difference is {trend['delta']:+.1f}." if trend['baseline'] is not None else 'Three valid sessions are needed for an app reference; six for a repeated-change comparison.')
    return {'observation':observation,'evidence':[{'id':r['id'],'date':r['recorded_at'],'value':r['range_of_motion']} for r in trend['sessions'] if r['quality_status']=='VALID'][-3:],'limitations':f"Camera estimates are not clinically validated. {trend['excluded_count']} uncertain or rejected sessions excluded. Symptoms and movement do not establish causation.",'next_step':'Consider discussing repeated changes or concerns with your healthcare professional. Move only within your comfort.','questions':['What changes in daily activities should I record?','How should I adapt my existing care plan if tasks become difficult?'],'provider':'deterministic-v1'}
