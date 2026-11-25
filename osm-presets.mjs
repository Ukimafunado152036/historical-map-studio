// iD Tagging Schema is loaded from the bundled, attributed snapshot.
let schema={presets:{},fields:{}},loading;
export const geometryName={Point:'point',LineString:'line',Polygon:'area'};
export async function loadPresets(fetcher=globalThis.fetch?.bind(globalThis)){
 if(loading)return loading;
 loading=(async()=>{const r=await fetcher(new URL('./osm-presets.json',import.meta.url));if(!r.ok)throw new Error('OSM 要素预设暂未加载');schema=await r.json();return schema;})();
 try{return await loading;}catch(e){loading=null;throw e;}
}
export const presetCount=()=>Object.keys(schema.presets).length;
export const getPreset=id=>schema.presets[id];
export function searchPresets(query='',geometry,limit=50){
 const q=query.trim().toLowerCase();
 return Object.entries(schema.presets).filter(([,p])=>(!geometry||p.geometry.includes(geometryName[geometry]))&&(!q||(p.name+' '+(p.terms||[]).join(' ')+' '+Object.entries(p.tags).map(([k,v])=>k+'='+v).join(' ')).toLowerCase().includes(q))).slice(0,limit).map(([id,p])=>({id,...p}));
}
export function matchingPreset(tags,geometry){
 let best=null,score=0;
 for(const [id,p] of Object.entries(schema.presets)){
  if(!p.geometry.includes(geometryName[geometry]))continue;
  const pairs=Object.entries(p.tags);if(!pairs.length)continue;
  if(pairs.every(([k,v])=>v==='*'?!!tags[k]:tags[k]===v)){
   const s=pairs.reduce((n,[,v])=>n+(v==='*'?.1:1),0);if(s>score){best={id,...p};score=s;}
  }
 }
 return best;
}
export function presetTags(p){return Object.fromEntries(Object.entries(p.addTags||p.tags).filter(([,v])=>v!=='').map(([k,v])=>[k,v==='*'?'yes':v]));}
export function presetFields(p,geometry){
 const ids=[...new Set([...(p?.fields||[]),...(p?.moreFields||[])])],result=[],used=new Set();
 for(const id of ids){
  const f=schema.fields[id];if(!f||(geometry&&f.geometry&&!f.geometry.includes(geometryName[geometry])))continue;
  const keys=f.key?[f.key]:(f.keys||[]);
  for(const key of keys){
   if(used.has(key)||key==='name'||/date|year|^addr:|^contact:|^was:/.test(key))continue;
   used.add(key);result.push({...f,key,label:f.keys?.length>1?f.label+' · '+key:f.label});
  }
 }
 return result;
}
export function applyPreset(feature,id){
 const next=getPreset(id);if(!next||!next.geometry.includes(geometryName[feature.geometry.type]))throw new Error('此预设不适用于当前几何形状。');
 const tags={...(feature.properties.tags||{})},old=getPreset(feature.properties.presetId);
 if(old)for(const [key,value] of Object.entries(old.tags))if(value==='*'||tags[key]===value)delete tags[key];
 for(const key of ['highway','waterway','natural','landuse','leisure','amenity','shop','tourism','office','railway','public_transport','historic','barrier','boundary','place'])delete tags[key];
 if(!Object.hasOwn(next.tags,'building'))delete tags.building;
 Object.assign(tags,presetTags(next));feature.properties.tags=tags;feature.properties.presetId=id;
 return feature;
}
