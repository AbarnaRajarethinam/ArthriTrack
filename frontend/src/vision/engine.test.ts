import { describe, it, expect } from 'vitest'
import { angle, distance, features } from './geometry'
import { AssessmentEngine, RepetitionDetector, quality } from './engine'
describe('landmark geometry',()=>{
 it('calculates right and straight angles',()=>{expect(angle({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0})).toBeCloseTo(90);expect(angle({x:1,y:0,z:0},{x:0,y:0,z:0},{x:-1,y:0,z:0})).toBeCloseTo(180)})
 it('rejects coincident and invalid points',()=>{expect(angle({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0})).toBeNaN();expect(distance({x:NaN,y:0,z:0},{x:1,y:0,z:0})).toBeNaN();expect(features([])).toBeNull()})
})
describe('movement segmentation',()=>{
 it('counts only a full low-high-low cycle with dwell',()=>{const d=new RepetitionDetector(20,60);d.update(10,1000);d.update(10,1200);d.update(80,1600);d.update(80,1800);expect(d.count).toBe(0);d.update(10,2200);d.update(10,2400);expect(d.count).toBe(1)})
 it('ignores threshold noise and interrupted cycles',()=>{const d=new RepetitionDetector(20,60);for(let t=1000;t<3000;t+=50)d.update(t%100?19:21,t);expect(d.count).toBe(0);d.update(10,4000);d.update(10,4200);d.resetCycle();d.update(80,4600);d.update(80,4800);d.update(10,5200);d.update(10,5400);expect(d.count).toBe(0)})
 it('marks incomplete recordings rejected',()=>{const e=new AssessmentEngine('fist',20,60);e.invalidate('Hand lost');const r=e.result('left',20);expect(quality(r)).toBe('RETRY_REQUIRED');expect(r.quality_reasons).toContain('Hand lost')})
 it('excludes excessive interruptions',()=>{expect(quality({usable_frames:90,total_frames:100,repetition_count:4,duration_seconds:20,interruptions:9})).toBe('UNCERTAIN')})
})
