import type { Kind, CaptureStatus } from './engine'

export type CalibrationPhase='INSTRUCTIONS'|'FIRST_POSITION'|'SECOND_POSITION'|'RETURN_POSITION'|'VALIDATION'|'COMPLETE'|'LIMITED'|'FAILED'|'PAUSED'
export type CalibrationUpdate={phase:CalibrationPhase;instruction:string;progress:number;status?:CaptureStatus;complete:boolean;failed:boolean}

const instructions:Record<Kind,Record<'first'|'second'|'return',string>>={
 fist:{first:'Hold your hand comfortably open.',second:'Slowly close your fingers into a comfortable fist.',return:'Open your hand comfortably again.'},
 spread:{first:'Hold your fingers comfortably together.',second:'Spread your fingers as far as is comfortable.',return:'Bring your fingers comfortably together again.'},
 opposition:{first:'Hold your thumb away from your index fingertip.',second:'Bring your thumb near your index fingertip without forcing contact.',return:'Move your thumb away again.'},
}

export class CalibrationEngine{
 kind:Kind;maxMs:number
 phase:CalibrationPhase='INSTRUCTIONS'; values:number[]=[]; phaseValues:number[]=[]; began=0; phaseBegan=0; interruptions=0; attempt=0
 constructor(kind:Kind,maxMs=30000){this.kind=kind;this.maxMs=maxMs}
 start(t:number){this.phase='FIRST_POSITION';this.values=[];this.phaseValues=[];this.began=t;this.phaseBegan=t;this.interruptions=0;this.attempt++;return this.snapshot()}
 pause(){if(!['COMPLETE','LIMITED','FAILED'].includes(this.phase)){this.phase='PAUSED'}return this.snapshot()}
 resume(t:number){if(this.phase==='PAUSED'){this.phase='FIRST_POSITION';this.phaseValues=[];this.phaseBegan=t}return this.snapshot()}
 invalidate(){this.interruptions++;return this.snapshot('Tracking paused. Reposition your hand; collected phases are preserved.')}
 update(value:number,t:number){
  if(!Number.isFinite(value)||this.phase==='PAUSED')return this.snapshot()
  if(t-this.began>this.maxMs){this.phase='FAILED';return this.snapshot('Calibration timed out. Retry when you are ready.')}
  if(!['FIRST_POSITION','SECOND_POSITION','RETURN_POSITION'].includes(this.phase))return this.snapshot()
  this.values.push(value);this.phaseValues.push(value)
  const stable=this.phaseValues.length>=8&&t-this.phaseBegan>=700
  if(this.phase==='FIRST_POSITION'&&stable)this.advance('SECOND_POSITION',t)
  else if(this.phase==='SECOND_POSITION'&&stable){const a=this.median(this.values.slice(0,8)),b=this.median(this.phaseValues);const direction=this.kind==='opposition'?-1:1;if(direction*(b-a)>(this.kind==='fist'?8:this.kind==='spread'?2:.08))this.advance('RETURN_POSITION',t)}
  else if(this.phase==='RETURN_POSITION'&&stable){const first=this.median(this.values.slice(0,8)),returned=this.median(this.phaseValues),tolerance=this.kind==='fist'?8:this.kind==='spread'?2:.08;if(Math.abs(returned-first)<=tolerance)this.validate()}
  return this.snapshot()
 }
 private advance(phase:CalibrationPhase,t:number){this.phase=phase;this.phaseValues=[];this.phaseBegan=t}
 private validate(){const sorted=[...this.values].sort((a,b)=>a-b),low=sorted[Math.floor(sorted.length*.1)]||0,high=sorted[Math.floor(sorted.length*.9)]||0,span=high-low;this.phase=span>=(this.kind==='fist'?12:this.kind==='spread'?3:.14)?'COMPLETE':span>=(this.kind==='fist'?5:this.kind==='spread'?1:.06)?'LIMITED':'FAILED'}
 get result(){const sorted=[...this.values].sort((a,b)=>a-b),low=sorted[Math.floor(sorted.length*.1)]||0,high=sorted[Math.floor(sorted.length*.9)]||0,span=Math.max(0,high-low),status:CaptureStatus=this.phase==='COMPLETE'?'SUFFICIENT':this.phase==='LIMITED'?'LIMITED':'INSUFFICIENT';return {low,high,span,status,thresholds:[low+span*.25,low+span*.75] as [number,number]}}
 private median(v:number[]){const x=[...v].sort((a,b)=>a-b);return x[Math.floor(x.length/2)]||0}
 snapshot(override?:string):CalibrationUpdate{const key=this.phase==='FIRST_POSITION'?'first':this.phase==='SECOND_POSITION'?'second':'return';const fallback=this.phase==='COMPLETE'?'Calibration complete.':this.phase==='LIMITED'?'Limited movement detected. We can record it as an experimental estimate.':this.phase==='FAILED'?'We do not have enough movement evidence yet.':this.phase==='PAUSED'?'Calibration paused.':instructions[this.kind][key];return {phase:this.phase,instruction:override||fallback,progress:Math.min(3,['FIRST_POSITION','SECOND_POSITION','RETURN_POSITION'].indexOf(this.phase)+1),status:['COMPLETE','LIMITED','FAILED'].includes(this.phase)?this.result.status:undefined,complete:['COMPLETE','LIMITED'].includes(this.phase),failed:this.phase==='FAILED'}}
}
