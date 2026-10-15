import os
import re
from statistics import median,pstdev
CHANGE_FRACTION=float(os.getenv('TREND_CHANGE_FRACTION','.12'))

_SAFETY_PATTERNS={
    'urgent':[
        r'\b(emergency|emergency room|urgent|urgently|life[- ]threatening|immediate danger|call (?:an? )?ambulance|emergency services|\ba\s*&\s*e\b)\b',
        r'\b(chest pain|cannot breathe|can\s*not breathe|trouble breathing|difficulty breathing|severe allergic reaction|anaphylaxis|stroke symptoms|sudden weakness|severe bleeding|unconscious|fainting)\b',
        r'\b(severe|sudden|rapidly worsening|getting worse quickly)\b.{0,45}\b(symptoms?|pain|swelling|swollen|weakness|bleeding)\b',
    ],
    'side_effect':[
        r'\bside[- ]effects?\b', r'\badverse reaction\b',
        r'\b(?:reaction|allergic|allergy)\b.{0,35}\b(?:medicine|medication|drug|pill|tablet|dose|prescription)\b',
        r'\b(?:medicine|medication|drug|pill|tablet|dose|prescription)\b.{0,35}\b(?:reaction|allergic|allergy)\b',
    ],
    'medication':[
        r'\b(medication|medicine|medicines|drug|drugs|pill|pills|tablet|tablets|dose|doses|prescription|prescribed|injection)\b',
        r'\b(?:forgot|forget|missed|missing|skipped|skip|did not take|didn.t take|haven.t taken|have not taken)\b.{0,35}\b(?:it|my|a|the|today|dose|medication|medicine|pill|tablet)\b',
        r'\b(?:should|can|may|could|do i|what if)\b.{0,30}\b(?:skip|miss|double|increase|decrease|change|stop|start|hold|take extra|take another)\b',
        r'\b(?:take another|take extra|take more|take less|skip it|miss it|stop taking|start taking|change my dose|change the dose|double up)\b',
    ],
    'diagnosis':[
        r'\b(diagnos(?:e|is|ed)|what condition|what disease|what is wrong with me|tell me what i have)\b',
        r'\b(?:do i have|could i have|could (?:this|it) be|is this|might (?:this|it) be|am i having|does this mean|does this suggest|is this a sign of)\b.{0,55}\b(?:arthritis|rheumatoid|osteoarthritis|\bra\b|\boa\b|flare|inflammation|disease|condition)\b',
        r'\b(?:arthritis|rheumatoid|osteoarthritis|flare|inflammation)\b.{0,40}\b(?:diagnosis|diagnose|do i have|is this|could (?:this|it) be)\b',
    ],
}

def _safety_categories(prompt):
    text=re.sub(r'\s+',' ',prompt.casefold()).strip()
    return {category for category,patterns in _SAFETY_PATTERNS.items() if any(re.search(pattern,text) for pattern in patterns)}

def _safety_reply(categories):
    parts=[]
    if 'medication' in categories:
        parts.append("I can’t advise you to start, stop, skip, change, or make up a medication dose. Check your prescription instructions and contact your doctor or pharmacist.")
    if 'side_effect' in categories:
        parts.append("I can’t assess whether symptoms are medication side effects. Check the medicine information and contact your doctor or pharmacist.")
    if 'diagnosis' in categories:
        parts.append("I can’t diagnose a condition. Discuss your symptoms and questions with a qualified healthcare professional.")
    if 'urgent' in categories:
        parts.append("I can’t assess urgent symptoms here. If you may be in immediate danger or have severe symptoms, contact your local emergency services now.")
    return ' '.join(parts)

def analyse(records,hand,kind,metric='range_of_motion'):
    selected=sorted([r for r in records if r['hand']==hand and r['assessment_type']==kind],key=lambda r:r['recorded_at'])
    compatible_version=next((r.get('algorithm_version','prototype-2') for r in reversed(selected) if r.get('quality_status') in ('VALID','SUFFICIENT_CAPTURE')),None)
    valid=[r for r in selected if r.get('quality_status') in ('VALID','SUFFICIENT_CAPTURE') and r.get('algorithm_version','prototype-2')==compatible_version]; values=[r[metric] for r in valid]; reference=values[:3]
    baseline=median(reference) if len(reference)==3 else None; category='Insufficient Data'
    if len(values)>=6 and baseline is not None:
        recent=values[-3:]; threshold=abs(baseline)*CHANGE_FRACTION; changes=[v-baseline for v in recent]
        if all(v < -threshold for v in changes) or all(v > threshold for v in changes): category='Repeated Change Observed'
        elif pstdev(recent)>threshold: category='Variable Measurements'
        else: category='No Clear Sustained Change'
    return {'category':category,'baseline':baseline,'variability':pstdev(reference) if len(reference)==3 else None,'reference_dates':[r['recorded_at'] for r in valid[:3]],'valid_count':len(valid),'excluded_count':len(selected)-len(valid),'delta':values[-1]-baseline if baseline is not None else None,'previous_delta':values[-1]-values[-2] if len(values)>1 else None,'metric':metric,'algorithm_version':compatible_version,'sessions':selected,'limitation':'Descriptive comparison of compatible captures only; experimental relative threshold, not a medical range or clinically meaningful change.'}
def resolve_context(prompt,hand,kind):
    text=re.sub(r'\s+',' ',prompt.casefold()).strip()
    hand_match=re.search(r'\b(left|right)(?:[- ]hand| hand| side)\b',text)
    if hand_match:
        hand=hand_match.group(1)
    if re.search(r'\b(opposition|thumb to (?:my )?(?:index|middle|ring|little|each)|touch (?:my )?(?:fingertip|fingers))\b',text):
        kind='opposition'
    elif re.search(r'\b(spread|spreading|finger spread|fingers apart)\b',text):
        kind='spread'
    elif re.search(r'\b(fist|open and clos|opening and closing)\b',text):
        kind='fist'
    return hand,kind

def _movement_observation(trend,hand,kind):
    valid=[r for r in trend.get('sessions',[]) if r.get('quality_status') in ('VALID','SUFFICIENT_CAPTURE') and r.get('algorithm_version','prototype-2')==trend.get('algorithm_version')]
    valid=sorted(valid,key=lambda r:r['recorded_at'])
    count=len(valid)
    label=f"{hand} hand {kind} movement"
    metric=trend.get('metric','range_of_motion')
    metric_name={'range_of_motion':'movement amplitude','movement_speed':'movement speed','movement_consistency':'movement consistency'}.get(metric,'movement measure')
    unit=valid[-1].get('measurement_unit','degrees') if valid else 'degrees'
    unit_label='palm widths' if unit=='palm_widths' else 'degrees'
    if not count:
        return f"Insufficient Data. There are 0 valid sessions for the selected {label}. New sufficiently captured sessions can build a personal reference."
    latest=float(valid[-1].get(metric,valid[-1].get('range_of_motion',0)))
    if count==1:
        return f"There is 1 compatible valid session for {label}. Its latest {metric_name} estimate is {latest:.1f} {unit_label}. One session cannot show how movement changed; another comparable assessment will allow an early comparison."
    if trend.get('baseline') is None:
        first=float(valid[0].get(metric,valid[0].get('range_of_motion',0)))
        delta=latest-first
        direction='higher' if delta>0 else 'lower' if delta<0 else 'the same as'
        comparison=f"{abs(delta):.1f} {unit_label} {direction} the first recorded estimate" if delta else f"the same as the first recorded estimate ({first:.1f} {unit_label})"
        return f"Across 2 compatible valid sessions for {label}, the latest {metric_name} estimate is {latest:.1f} {unit_label}, {comparison}. This is an early comparison, not a sustained trend; three sessions establish an app reference and six are used for repeated-change classification."
    baseline=float(trend['baseline'])
    delta=latest-baseline
    if delta>0:
        comparison=f"{abs(delta):.1f} {unit_label} higher than"
    elif delta<0:
        comparison=f"{abs(delta):.1f} {unit_label} lower than"
    else:
        comparison='the same as'
    reference=f"the app reference ({baseline:.1f} {unit_label})"
    if count<6:
        return f"Across {count} compatible valid sessions for {label}, the latest {metric_name} estimate is {latest:.1f} {unit_label}, {comparison} {reference}. This is a descriptive comparison; six compatible sessions are needed before the app classifies a repeated change."
    category=trend.get('category')
    if category=='Repeated Change Observed':
        direction='lower' if delta<0 else 'higher'
        summary=f"Recent compatible estimates show a repeated {direction} pattern compared with {reference}."
    elif category=='Variable Measurements':
        summary=f"Recent compatible estimates vary; there is no steady direction around {reference}."
    else:
        summary=f"No clear sustained change is identified. The latest estimate is {latest:.1f} {unit_label}, {comparison} {reference}."
    return f"Across {count} compatible valid sessions for {label}, {summary} This is an experimental comparison of camera estimates, not a clinical assessment."

def explain(prompt,trend,symptoms,hand='left',kind='fist'):
    hand,kind=resolve_context(prompt,hand,kind)
    safety=_safety_categories(prompt)
    symptom_request=any(w in prompt.lower() for w in ['symptom','pain','stiffness'])
    if safety:
        observation=_safety_reply(safety)
    elif symptom_request:
        recent=sorted(symptoms,key=lambda r:r['recorded_at'])[-7:]
        observation=f"Across your latest {len(recent)} symptom entries, self-reported pain ranges from {min(r['pain_level'] for r in recent)} to {max(r['pain_level'] for r in recent)} out of 10. These reports do not establish the cause of symptoms." if recent else 'There are no symptom entries yet. A check-in can help you record your experience.'
    else:
        observation=_movement_observation(trend,hand,kind)
    evidence=[] if safety else ([{'id':r['id'],'type':'symptom','date':r['recorded_at'],'pain_level':r['pain_level'],'stiffness_level':r['stiffness_level'],'unit':'0-10 self-report'} for r in sorted(symptoms,key=lambda r:r['recorded_at'])[-3:]] if symptom_request else [{'id':r['id'],'type':'assessment','date':r['recorded_at'],'value':r.get(trend.get('metric','range_of_motion'),r['range_of_motion']),'unit':r.get('measurement_unit','degrees')} for r in sorted(trend.get('sessions',[]),key=lambda r:r['recorded_at']) if r.get('quality_status') in ('VALID','SUFFICIENT_CAPTURE') and r.get('algorithm_version','prototype-2')==trend.get('algorithm_version')][-3:])
    return {'observation':observation,'evidence':evidence,'limitations':f"Camera estimates are not clinically validated. {trend['excluded_count']} uncertain or rejected sessions excluded. Symptoms and movement do not establish causation.",'next_step':_safety_reply(safety) if safety else 'Consider discussing repeated changes or concerns with your healthcare professional. Move only within your comfort.','questions':[] if safety else ['What changes in daily activities should I record?','How should I adapt my existing care plan if tasks become difficult?'],'provider':'deterministic-v2'}
