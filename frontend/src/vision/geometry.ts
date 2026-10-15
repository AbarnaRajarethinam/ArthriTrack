export type Point={x:number;y:number;z:number}
export function finite(p:Point){return p&&[p.x,p.y,p.z].every(Number.isFinite)}
export function distance(a:Point,b:Point){return finite(a)&&finite(b)?Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z):NaN}
export function angle(a:Point,b:Point,c:Point){
 if(!finite(a)||!finite(b)||!finite(c))return NaN
 const u=[a.x-b.x,a.y-b.y,a.z-b.z],v=[c.x-b.x,c.y-b.y,c.z-b.z],den=Math.hypot(...u)*Math.hypot(...v)
 return den<1e-8?NaN:Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/den)))*180/Math.PI
}
export function features(points:Point[]){
 if(points.length!==21||!points.every(finite))return null
 const width=distance(points[5],points[17]);if(width<1e-6)return null
 const joints=[5,9,13,17].map(i=>angle(points[i],points[i+1],points[i+2]))
 const flexion=joints.reduce((s,v)=>s+180-v,0)/4
 const spread=[8,12,16].map((tip,i)=>angle(points[tip],points[0],points[[12,16,20][i]])).reduce((s,v)=>s+v,0)/3
 const proximity=[8,12,16,20].map(i=>distance(points[4],points[i])/width)
 return [flexion,spread,...proximity].every(Number.isFinite)?{flexion,spread,proximity,joints}:null
}

export const fingerNames=['index','middle','ring','little'] as const
