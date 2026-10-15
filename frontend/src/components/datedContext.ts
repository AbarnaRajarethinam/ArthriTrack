import type { Row } from '../api'

export type DatedContext={
 dateKey:string
 measurements:{id:number;value:number|null;unit:string;qualityStatus:string}[]
 symptoms:Row[]
}

export type TrendAnnotations={
 gaps:{from:string;to:string;daysWithoutAssessment:number}[]
 excluded:{id:number;dateKey:string;status:string;reasons:string[]}[]
}

function localDateKey(value:string){
 const date=new Date(value)
 const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0')
 return `${year}-${month}-${day}`
}

export function formatLocalDateKey(key:string){
 const [year,month,day]=key.split('-').map(Number)
 return new Date(year,month-1,day).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})
}

export function buildDatedContext(sessions:Row[],symptoms:Row[],metric:string,unit:string,compatible:(row:Row)=>boolean):DatedContext[]{
 const byDate=new Map<string,DatedContext>()
 const group=(dateKey:string)=>{
  let item=byDate.get(dateKey)
  if(!item){item={dateKey,measurements:[],symptoms:[]};byDate.set(dateKey,item)}
  return item
 }
 for(const session of sessions){
  group(localDateKey(session.recorded_at)).measurements.push({
   id:session.id,
   value:compatible(session)?Number(session[metric]):null,
   unit,qualityStatus:session.quality_status,
  })
 }
 for(const symptom of symptoms)group(localDateKey(symptom.recorded_at)).symptoms.push(symptom)
 return [...byDate.values()].sort((a,b)=>b.dateKey.localeCompare(a.dateKey))
}

// This is a display cue for empty calendar time, not a health or capture threshold.
const GAP_CUE_DAYS=7

export function buildTrendAnnotations(sessions:Row[],compatible:(row:Row)=>boolean):TrendAnnotations{
 const byDate=new Map<string,Row[]>()
 for(const session of sessions){
  const key=localDateKey(session.recorded_at)
  byDate.set(key,[...(byDate.get(key)||[]),session])
 }
 const dates=[...byDate.keys()].sort()
 const gaps:{from:string;to:string;daysWithoutAssessment:number}[]=[]
 for(let i=1;i<dates.length;i++){
  const from=dates[i-1],to=dates[i]
  const daysWithoutAssessment=Math.round((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000)-1
  if(daysWithoutAssessment>=GAP_CUE_DAYS)gaps.push({from,to,daysWithoutAssessment})
 }
 const excluded=sessions.filter(session=>!compatible(session)).map(session=>({
  id:session.id,
  dateKey:localDateKey(session.recorded_at),
  status:session.quality_status,
  reasons:Array.isArray(session.quality_reasons)?session.quality_reasons.filter((reason):reason is string=>typeof reason==='string'):[],
 }))
 return {gaps,excluded}
}
