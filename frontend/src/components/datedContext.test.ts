import { describe,expect,it } from 'vitest'
import { buildDatedContext, buildTrendAnnotations } from './datedContext'

const assessment=(id:number,recorded_at:string,quality_status='SUFFICIENT_CAPTURE')=>({id,recorded_at,quality_status,algorithm_version:'prototype-3',range_of_motion:42})
const symptom=(id:number,recorded_at:string)=>({id,recorded_at,hand:'both',pain_level:4,stiffness_level:5,morning_stiffness_minutes:20,swelling:'unsure'})

describe('dated self-care context',()=>{
 it('groups entries by date while keeping camera and self-reported values separate',()=>{
  const rows=buildDatedContext(
   [assessment(1,'2026-10-14T10:00:00Z')],
   [symptom(2,'2026-10-14T12:00:00Z')],
   'range_of_motion','degrees',()=>true,
  )
  expect(rows).toHaveLength(1)
  expect(rows[0].measurements[0]).toMatchObject({value:42,unit:'degrees'})
  expect(rows[0].symptoms[0]).toMatchObject({pain_level:4,stiffness_level:5})
 })

 it('keeps symptom-only dates and hides estimates from excluded captures',()=>{
  const rows=buildDatedContext(
   [assessment(1,'2026-10-13T10:00:00Z','RETRY_RECOMMENDED')],
   [symptom(2,'2026-10-14T12:00:00Z')],
   'range_of_motion','degrees',()=>false,
  )
  expect(rows.map(row=>row.dateKey)).toEqual(['2026-10-14','2026-10-13'])
  expect(rows[0].measurements).toHaveLength(0)
  expect(rows[0].symptoms).toHaveLength(1)
  expect(rows[1].measurements[0].value).toBeNull()
 })

 it('flags long calendar gaps without treating missing dates as measurements',()=>{
  const rows=[assessment(1,'2026-10-01T10:00:00Z'),assessment(2,'2026-10-10T10:00:00Z')]
  const annotations=buildTrendAnnotations(rows,()=>true)
  expect(annotations.gaps).toEqual([{from:'2026-10-01',to:'2026-10-10',daysWithoutAssessment:8}])
  expect(buildDatedContext(rows,[],'range_of_motion','degrees',()=>true).map(row=>row.dateKey)).toEqual(['2026-10-10','2026-10-01'])
 })

 it('reports excluded capture reasons and incompatible builds without assigning values',()=>{
  const rejected={...assessment(1,'2026-10-01T10:00:00Z','RETRY_RECOMMENDED'),quality_reasons:['low_frame_coverage']}
  const incompatible=assessment(2,'2026-10-02T10:00:00Z','SUFFICIENT_CAPTURE')
  const annotations=buildTrendAnnotations([rejected,incompatible],row=>row.id===2?false:false)
  expect(annotations.excluded).toEqual([
   {id:1,dateKey:'2026-10-01',status:'RETRY_RECOMMENDED',reasons:['low_frame_coverage']},
   {id:2,dateKey:'2026-10-02',status:'SUFFICIENT_CAPTURE',reasons:[]},
  ])
  const dated=buildDatedContext([rejected,incompatible],[],'range_of_motion','degrees',()=>false)
  expect(dated.flatMap(row=>row.measurements).every(item=>item.value===null)).toBe(true)
 })
})
