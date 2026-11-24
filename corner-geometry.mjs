// Circular corner fillets in ground metres. Saved coordinates remain editable anchors.
const RAD=Math.PI/180,EARTH=6371008.8;
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const key=c=>c.join(',');
export function junctions(features){
 const owners=new Map(),fixed=new Set();
 for(const f of features){
  if(f.geometry.type!=='LineString')continue;
  for(const c of f.geometry.coordinates){const k=key(c);if(owners.has(k)&&owners.get(k)!==f.id)fixed.add(k);else owners.set(k,f.id);}
 }
 return fixed;
}
export function roundedPath(path,radius,{closed=false,fixed=new Set()}={}){
 if(!(radius>0)||path.length<(closed?4:3))return path;
 const points=closed?path.slice(0,-1):path;
 const result=[],n=points.length,maxSteps=Math.max(2,Math.min(64,Math.floor(20000/n)));
 const push=p=>{if(!result.length||!same(result.at(-1),p))result.push(p);};
 for(let i=0;i<n;i++){
  const at=points[i];
  if((!closed&&(i===0||i===n-1))||fixed.has(key(at))){push(at);continue;}
  const prev=points[(i+n-1)%n],next=points[(i+1)%n];
  const sx=EARTH*RAD*Math.cos(at[1]*RAD),sy=EARTH*RAD;
  const a=[(prev[0]-at[0])*sx,(prev[1]-at[1])*sy],b=[(next[0]-at[0])*sx,(next[1]-at[1])*sy];
  const la=Math.hypot(...a),lb=Math.hypot(...b);
  if(la<1e-5||lb<1e-5){push(at);continue;}
  const u=a.map(v=>v/la),v=b.map(v=>v/lb),theta=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])));
  if(theta<.001||Math.PI-theta<.001){push(at);continue;}
  // Each end consumes less than half an edge, so adjacent arcs cannot overlap.
  const tangent=Math.tan(theta/2),trim=Math.min(radius/tangent,.49*la,.49*lb),r=trim*tangent;
  const bisector=[u[0]+v[0],u[1]+v[1]],length=Math.hypot(...bisector),distance=r/Math.sin(theta/2);
  const center=bisector.map(c=>c/length*distance),entry=u.map(c=>c*trim),exit=v.map(c=>c*trim);
  const start=Math.atan2(entry[1]-center[1],entry[0]-center[0]);
  const turn=u[1]*v[0]-u[0]*v[1],sweep=Math.sign(turn)*(Math.PI-theta);
  const step=2*Math.acos(Math.max(-1,Math.min(1,1-.15/r)));
  const steps=Math.max(2,Math.min(maxSteps,Math.ceil(Math.abs(sweep)/(step||.01))));
  const unproject=p=>[at[0]+p[0]/sx,at[1]+p[1]/sy];
  push(unproject(entry));
  for(let j=1;j<steps;j++){const t=start+sweep*j/steps;push(unproject([center[0]+r*Math.cos(t),center[1]+r*Math.sin(t)]));}
  push(unproject(exit));
 }
 if(closed&&result.length)result.push(result[0].slice());
 return result;
}
export function roundedFeature(feature,fixed=new Set()){
 const g=feature.geometry,r=feature.properties.cornerRadius;
 if(!(r>0)||g.type==='Point')return feature;
 const coordinates=g.type==='LineString'?roundedPath(g.coordinates,r,{fixed}):g.coordinates.map(path=>roundedPath(path,r,{closed:true}));
 return {...feature,geometry:{type:g.type,coordinates}};
}
