import { describe, it, expect } from 'vitest'
import { angle, distance, features } from './geometry'
import { AssessmentEngine, RepetitionDetector, quality } from './engine'
import { CalibrationEngine } from './calibration'
describe('landmark geometry',()=>{
 it('calculates right and straight angles',()=>{expect(angle({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0})).toBeCloseTo(90);expect(angle({x:1,y:0,z:0},{x:0,y:0,z:0},{x:-1,y:0,z:0})).toBeCloseTo(180)})
 it('rejects coincident and invalid points',()=>{expect(angle({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0})).toBeNaN();expect(distance({x:NaN,y:0,z:0},{x:1,y:0,z:0})).toBeNaN();expect(features([])).toBeNull()})
})
describe('movement segmentation',()=>{
 it('counts only a full low-high-low cycle with dwell',()=>{const d=new RepetitionDetector(20,60);d.update(10,1000);d.update(10,1200);d.update(80,1600);d.update(80,1800);expect(d.count).toBe(0);d.update(10,2200);d.update(10,2400);expect(d.count).toBe(1)})
 it('ignores threshold noise and interrupted cycles',()=>{const d=new RepetitionDetector(20,60);for(let t=1000;t<3000;t+=50)d.update(t%100?19:21,t);expect(d.count).toBe(0);d.update(10,4000);d.update(10,4200);d.resetCycle();d.update(80,4600);d.update(80,4800);d.update(10,5200);d.update(10,5400);expect(d.count).toBe(0)})
 it('marks incomplete recordings for retry',()=>{const e=new AssessmentEngine('fist',20,60);e.invalidate('Hand lost');const r=e.result('left',20);expect(quality(r)).toBe('RETRY_RECOMMENDED');expect(r.quality_reasons).toContain('Hand lost')})
 it('requires coherent evidence and excludes excessive interruptions',()=>{expect(quality({usable_frames:1,total_frames:1,repetition_count:4,duration_seconds:20,accepted_duration_seconds:0,interruptions:0})).toBe('RETRY_RECOMMENDED');expect(quality({usable_frames:90,total_frames:100,repetition_count:4,duration_seconds:20,accepted_duration_seconds:10,interruptions:9})).toBe('LIMITED_CAPTURE')})
 it('does not calculate speed across invalid segments',()=>{const e=new AssessmentEngine('fist',20,60) as any;e.samples=[{t:1000,v:10,segment:0,target:0,fingerValues:[0,0,0,0]}];e.invalidate('Hand lost');e.samples.push({t:1200,v:50,segment:1,target:0,fingerValues:[0,0,0,0]});expect(e.result('left',5).movement_speed).toBe(0)})
 it('does not mix opposition targets into movement amplitude',()=>{const e=new AssessmentEngine('opposition',0,1) as any;e.samples=[...Array(10)].map((_,i)=>({t:i*100,v:.1+i*.001,segment:0,target:0,fingerValues:[0,0,0,0]})).concat([...Array(10)].map((_,i)=>({t:1000+i*100,v:1.1+i*.001,segment:1,target:1,fingerValues:[0,0,0,0]})));expect(e.result('left',5).range_of_motion).toBeLessThan(.02);expect(e.result('left',5).movement_speed).toBeLessThan(.02)})
})

describe('guided calibration',()=>{
 function feed(c:CalibrationEngine,values:number[],start:number){values.forEach((v,i)=>c.update(v,start+i*100))}
 it('completes only after open, moved and returned phases',()=>{const c=new CalibrationEngine('fist');c.start(100);feed(c,Array(8).fill(10),100);feed(c,Array(8).fill(60),900);feed(c,Array(8).fill(10),1700);expect(c.snapshot().complete).toBe(true);expect(c.result.status).toBe('SUFFICIENT')})
 it('reports limited movement without calling the user a failure',()=>{const c=new CalibrationEngine('fist');c.start(100);feed(c,Array(8).fill(10),100);feed(c,Array(8).fill(19),900);feed(c,Array(8).fill(10),1700);expect(c.snapshot().complete).toBe(true);expect(c.result.status).toBe('LIMITED')})
 it('times out, pauses, resumes, and resets stale attempts',()=>{const c=new CalibrationEngine('spread',1000);c.start(100);expect(c.pause().phase).toBe('PAUSED');expect(c.resume(200).phase).toBe('FIRST_POSITION');c.update(1,1500);expect(c.snapshot().failed).toBe(true);c.start(2000);expect(c.values).toEqual([]);expect(c.snapshot().failed).toBe(false)})
})
