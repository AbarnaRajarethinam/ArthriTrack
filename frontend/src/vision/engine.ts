import { features, distance, type Point } from './geometry'
export type Kind='fist'|'spread'|'opposition'
export class RepetitionDetector {
 count=0; phase=0; since=0; low:number; high:number; lastTransition=0
 constructor(low:number,high:number){this.low=low;this.high=high}
 update(value:number,t:number){
   if(!Number.isFinite(value))return this.resetCycle()
   const wanted=this.phase===1?value>=this.high:value<=this.low
   if(!wanted){this.since=0;return}
   if(!this.since)this.since=t
   if(t-this.since<180||t-this.lastTransition<350)return
   this.since=0;this.lastTransition=t
   if(this.phase===0)this.phase=1
   else if(this.phase===1)this.phase=2
   else {this.count++;this.phase=1}
 }
 resetCycle(){this.phase=0;this.since=0}
}
export class AssessmentEngine {
 kind:Kind; detector:RepetitionDetector; total=0; usable=0; interruptions=0; reasons=new Set<string>(); samples:{t:number;v:number}[]=[]; previous:Point[]|null=null; lastGood=0; wasBad=false; target=0; touching=false; touchSince=0; oppositionCount=0; start=0; lastT=0
 constructor(kind:Kind,low:number,high:number){this.kind=kind;this.detector=new RepetitionDetector(low,high)}
 get count(){return this.kind==='opposition'?this.oppositionCount:this.detector.count}
 invalidate(reason:string){this.total++;if(!this.wasBad)this.interruptions++;this.wasBad=true;this.reasons.add(reason);this.detector.resetCycle();this.touchSince=0;this.touching=false;this.previous=null}
 process(points:Point[],t:number){
   if(!this.start)this.start=t
   if(this.lastT&&t-this.lastT>400){this.invalidate('Tracking gap');this.lastT=t;return}
   this.lastT=t
   const f=features(points)
   if(!f){this.invalidate('Invalid landmark geometry');return}
   const width=distance(points[5],points[17])
   if(this.previous&&points.some((p,i)=>distance(p,this.previous![i])>width*1.5)){this.invalidate('Implausible landmark jump');return}
   this.total++;this.usable++;this.wasBad=false;this.previous=points;this.lastGood=t
   const value=this.kind==='fist'?f.flexion:this.kind==='spread'?f.spread:f.proximity[this.target]
   this.samples.push({t,v:value})
   if(this.kind==='opposition'){
     if(value<.28&&!this.touching){if(!this.touchSince)this.touchSince=t;if(t-this.touchSince>=180){this.touching=true;this.touchSince=0}}
     else if(value>.5&&this.touching){this.oppositionCount++;this.target=(this.target+1)%4;this.touching=false}
     else if(value>=.28&&!this.touching)this.touchSince=0
   } else this.detector.update(value,t)
 }
 result(hand:string,duration:number){
   const vals=this.samples.map(s=>s.v);const sorted=[...vals].sort((a,b)=>a-b);const lo=sorted[Math.floor(sorted.length*.05)]||0,hi=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]||0
   const speeds=this.samples.slice(1).flatMap((s,i)=>{const dt=(s.t-this.samples[i].t)/1000;return dt>0&&dt<.4?[Math.abs(s.v-this.samples[i].v)/dt]:[]});const mean=speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:0
   const durations:number[]=[]; // Consistency describes sample movement speed variability, not disease severity.
   durations.push(...speeds);const sd=durations.length?Math.sqrt(durations.reduce((s,v)=>s+(v-mean)**2,0)/durations.length):0
   if(this.count<3)this.reasons.add('Fewer than three complete repetitions')
   return {assessment_type:this.kind,hand,recorded_at:new Date().toISOString(),duration_seconds:Math.max(1,duration),repetition_count:this.count,range_of_motion:Math.max(0,hi-lo),movement_speed:mean,movement_consistency:mean?Math.max(0,100*(1-sd/(mean+sd))):0,usable_frames:this.usable,total_frames:Math.max(1,this.total),interruptions:this.interruptions,quality_reasons:[...this.reasons],algorithm_version:'prototype-2'}
 }
}
export function quality(result:{usable_frames:number;total_frames:number;repetition_count:number;duration_seconds:number;interruptions:number}){const ratio=result.usable_frames/result.total_frames;return ratio>=.85&&result.repetition_count>=3&&result.duration_seconds>=5&&result.interruptions<=5?'VALID':ratio>=.65&&result.repetition_count>=1?'UNCERTAIN':'RETRY_REQUIRED'}
