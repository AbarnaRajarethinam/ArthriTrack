import { features, distance, fingerNames, type Point } from './geometry'
export type Kind='fist'|'spread'|'opposition'
export type CaptureStatus='SUFFICIENT'|'LIMITED'|'INSUFFICIENT'
type Sample={t:number;v:number;segment:number;target:number;fingerValues:number[]}
export type AssessmentResult={assessment_type:Kind;hand:string;recorded_at:string;duration_seconds:number;repetition_count:number;range_of_motion:number;movement_speed:number;movement_consistency:number;usable_frames:number;total_frames:number;interruptions:number;quality_reasons:string[];algorithm_version:'prototype-3';protocol_version:'guided-1';model_version:'mediapipe-hand-landmarker-full:sha256:fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';measurement_unit:'degrees'|'palm_widths';repetition_target:number;accepted_duration_seconds:number;calibration_status:CaptureStatus;calibration_span:number;per_finger:Record<string,{amplitude:number;unit:string;sample_count:number}>;cycle_repeatability:number|null}
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
 kind:Kind; detector:RepetitionDetector; total=0; usable=0; interruptions=0; reasons=new Set<string>(); samples:Sample[]=[]; previous:Point[]|null=null; lastGood=0; wasBad=false; target=0; touching=false; touchSince=0; oppositionCount=0; start=0; lastT=0; segment=0; cycleEnds:number[]=[]; repetitionTarget:number; calibrationStatus:CaptureStatus; calibrationSpan:number; oppositionThresholds:{low:number;high:number}[]
 constructor(kind:Kind,low:number,high:number,options:{repetitionTarget?:number;calibrationStatus?:CaptureStatus;calibrationSpan?:number;oppositionThresholds?:{low:number;high:number}[]}={}){this.kind=kind;this.detector=new RepetitionDetector(low,high);this.repetitionTarget=options.repetitionTarget||4;this.calibrationStatus=options.calibrationStatus||'SUFFICIENT';this.calibrationSpan=options.calibrationSpan||Math.max(0,high-low);this.oppositionThresholds=options.oppositionThresholds||Array.from({length:4},()=>({low:.28,high:.5}))}
 get count(){return this.kind==='opposition'?this.oppositionCount:this.detector.count}
 invalidate(reason:string){this.total++;if(!this.wasBad){this.interruptions++;this.segment++}this.wasBad=true;this.reasons.add(reason);this.detector.resetCycle();this.touchSince=0;this.touching=false;this.previous=null}
 process(points:Point[],t:number){
   if(!this.start)this.start=t
   if(this.lastT&&t-this.lastT>400){this.invalidate('Tracking gap');this.lastT=t;return}
   this.lastT=t
   const f=features(points)
   if(!f){this.invalidate('Invalid landmark geometry');return}
   const width=distance(points[5],points[17])
   if(this.previous&&points.some((p,i)=>distance(p,this.previous![i])>width*1.5)){this.invalidate('Implausible landmark jump');return}
   this.total++;this.usable++;this.wasBad=false;this.previous=points;this.lastGood=t
   const sampleTarget=this.target,value=this.kind==='fist'?f.flexion:this.kind==='spread'?f.spread:f.proximity[sampleTarget]
   this.samples.push({t,v:value,segment:this.segment,target:sampleTarget,fingerValues:f.joints.map(v=>180-v)})
   if(this.kind==='opposition'){
     const threshold=this.oppositionThresholds[sampleTarget]
     if(value<threshold.low&&!this.touching){if(!this.touchSince)this.touchSince=t;if(t-this.touchSince>=180){this.touching=true;this.touchSince=0}}
     else if(value>threshold.high&&this.touching){this.oppositionCount++;this.cycleEnds.push(this.samples.length-1);this.target=(this.target+1)%4;this.touching=false;this.segment++}
     else if(value>=threshold.low&&!this.touching)this.touchSince=0
   } else {const before=this.detector.count;this.detector.update(value,t);if(this.detector.count>before)this.cycleEnds.push(this.samples.length-1)}
 }
 result(hand:string,duration:number):AssessmentResult{
   const vals=this.samples.map(s=>s.v);const sorted=[...vals].sort((a,b)=>a-b);const lo=sorted[Math.floor(sorted.length*.05)]||0,hi=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]||0
   const targetRanges=[0,1,2,3].flatMap(target=>{const x=this.samples.filter(s=>s.target===target).map(s=>s.v).sort((a,b)=>a-b);return x.length>=3?[(x[Math.floor(x.length*.95)]||0)-(x[Math.floor(x.length*.05)]||0)]:[]})
   const speeds=this.samples.slice(1).flatMap((s,i)=>{const p=this.samples[i],dt=(s.t-p.t)/1000;return s.segment===p.segment&&s.target===p.target&&dt>0&&dt<.4?[Math.abs(s.v-p.v)/dt]:[]});const mean=speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:0
   const cycleRanges:number[]=[];let begin=0;for(const end of this.cycleEnds){const cycle=this.samples.slice(begin,end+1).map(s=>s.v);if(cycle.length>=3)cycleRanges.push(Math.max(...cycle)-Math.min(...cycle));begin=end+1}const cycleMean=cycleRanges.length?cycleRanges.reduce((a,b)=>a+b,0)/cycleRanges.length:0,cycleSd=cycleRanges.length?Math.sqrt(cycleRanges.reduce((s,v)=>s+(v-cycleMean)**2,0)/cycleRanges.length):0
   const repeatability=cycleRanges.length>=2&&cycleMean>0?Math.max(0,100*(1-cycleSd/cycleMean)):null
   if(this.count<3)this.reasons.add('Fewer than three complete repetitions')
   const perFinger=Object.fromEntries(fingerNames.map((name,index)=>{const f=this.samples.map(s=>s.fingerValues[index]).sort((a,b)=>a-b);return [name,{amplitude:f.length?Math.max(0,(f[Math.floor(f.length*.95)]||0)-(f[Math.floor(f.length*.05)]||0)):0,unit:'degrees',sample_count:f.length}]}))
   const acceptedDuration=this.samples.slice(1).reduce((sum,s,i)=>{const p=this.samples[i],dt=(s.t-p.t)/1000;return sum+(s.segment===p.segment&&dt>0&&dt<.4?dt:0)},0)
   const amplitude=this.kind==='opposition'&&targetRanges.length?targetRanges.reduce((a,b)=>a+b,0)/targetRanges.length:Math.max(0,hi-lo)
   return {assessment_type:this.kind,hand,recorded_at:new Date().toISOString(),duration_seconds:Math.max(1,duration),repetition_count:this.count,range_of_motion:amplitude,movement_speed:mean,movement_consistency:repeatability||0,usable_frames:this.usable,total_frames:Math.max(1,this.total),interruptions:this.interruptions,quality_reasons:[...this.reasons],algorithm_version:'prototype-3',protocol_version:'guided-1',model_version:'mediapipe-hand-landmarker-full:sha256:fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',measurement_unit:this.kind==='opposition'?'palm_widths':'degrees',repetition_target:this.repetitionTarget,accepted_duration_seconds:acceptedDuration,calibration_status:this.calibrationStatus,calibration_span:this.calibrationSpan,per_finger:perFinger,cycle_repeatability:repeatability}
 }
}
export function quality(result:{usable_frames:number;total_frames:number;repetition_count:number;duration_seconds:number;interruptions:number;accepted_duration_seconds?:number}){const ratio=result.usable_frames/result.total_frames,accepted=result.accepted_duration_seconds??result.duration_seconds;return result.usable_frames>=30&&accepted>=3&&ratio>=.85&&result.repetition_count>=3&&result.duration_seconds>=5&&result.interruptions<=5?'SUFFICIENT_CAPTURE':result.usable_frames>=10&&accepted>=1&&ratio>=.65&&result.repetition_count>=1?'LIMITED_CAPTURE':'RETRY_RECOMMENDED'}
