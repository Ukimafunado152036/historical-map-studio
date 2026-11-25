// OpenStreetMap Carto width rules (CC0), adapted for MapLibre.
// https://github.com/openstreetmap-carto/openstreetmap-carto/blob/master/line-widths.yaml
// See also style/water.mss and style/roads.mss. This is not the Mapnik renderer.
export const ROAD_TABLES={"motorway":{"line_width":{"6":0.4,"7":0.8,"8":1,"9":1.4,"10":1.9,"11":2,"12":3.5,"13":6,"15":10,"17":18,"18":21,"19":27,"20":33},"casing_width":{"12":0.5,"15":0.7,"17":1},"bridge_casing_width":{"12":0.5,"15":0.75,"17":1}},"trunk":{"line_width":{"6":0.4,"7":0.6,"8":1,"9":1.4,"10":1.9,"12":3.5,"13":6,"15":10,"17":18,"18":21,"19":27},"casing_width":{"12":0.5,"15":0.7,"17":1},"bridge_casing_width":{"12":0.5,"15":0.75,"17":1}},"primary":{"line_width":{"8":1,"9":1.4,"10":1.8,"12":3.5,"13":5,"15":10,"17":18,"18":21,"19":27},"casing_width":{"12":0.5,"15":0.7,"17":1},"bridge_casing_width":{"12":0.5,"15":0.75,"17":1}},"secondary":{"line_width":{"9":1,"10":1.1,"12":3.5,"13":5,"15":9,"16":10,"17":18,"18":21,"19":27},"casing_width":{"12":0.3,"13":0.35,"15":0.7,"17":1},"bridge_casing_width":{"12":0.1,"13":0.5,"14":0.6,"15":0.75,"17":1}},"tertiary":{"line_width":{"10":0.7,"12":2.5,"13":4,"14":5,"15":9,"16":10,"17":18,"18":21,"19":27},"casing_width":{"12":0.3,"13":0.5,"14":0.55,"15":0.6,"17":0.8},"bridge_casing_width":{"12":0.1,"13":0.5,"15":0.75,"17":0.8}},"residential":{"line_width":{"12":0.5,"13":2.5,"14":3,"15":5,"16":6,"17":12,"18":13,"19":17},"casing_width":{"12":0.3,"13":0.5,"14":0.55,"15":0.6,"17":0.8},"bridge_casing_width":{"12":0.1,"13":0.5,"15":0.75,"17":0.8}},"service":{"line_width":{"14":2,"16":3.5,"17":7,"18":8.5,"19":11,"20":12},"casing_width":{"14":0.55,"16":0.6,"17":0.8},"bridge_casing_width":{"14":0.5,"16":0.75,"17":0.8}},"footway":{"line_width":{"14":0.7,"15":1,"16":1.3,"19":1.6}}};
for(const [kind,base] of Object.entries({unclassified:'residential',road:'service',living_street:'residential',pedestrian:'residential'}))ROAD_TABLES[kind]=ROAD_TABLES[base];
export function atZoom(table,zoom){let value=0;for(const [z,v] of Object.entries(table||{}))if(zoom>=+z)value=v;return value;}
export function roadPixels(kind,zoom,part='full'){
 const table=ROAD_TABLES[kind];if(!table)return 0;const full=atZoom(table.line_width,zoom);
 const edge=atZoom(part==='bridge-fill'?table.bridge_casing_width:table.casing_width,zoom);
 return part==='full'?full:Math.max(0,full-2*edge);
}
const kindMatch=(values,property='kind')=>['match',['get',property],...Object.entries(values).flatMap(([k,v])=>[k,v]),0];
export function roadWidth(part='full'){
 const result=['step',['zoom'],0];
 for(let z=6;z<=20;z++)result.push(z,['*',['coalesce',['get','widthScale'],1],kindMatch(Object.fromEntries(Object.keys(ROAD_TABLES).filter(k=>k!=='footway').map(k=>[k,roadPixels(k,z,part)])))]);
 return result;
}
export const WATER_TABLES={river:{8:.7,9:1.2,10:1.5,11:1.8,12:2.3,13:3,14:4.5,15:6,16:8,17:10,18:12},stream:{12:.8,13:1.4,14:2,15:2.5,16:3,17:3.5,18:4},canal:{12:1.12,13:1.96,14:2.8,15:3.5,16:4.2,17:4.9,18:5.6}};
Object.assign(WATER_TABLES,{ditch:WATER_TABLES.stream,drain:WATER_TABLES.stream});
export function waterWidth(property='kind'){const result=['step',['zoom'],0];for(let z=8;z<=20;z++)result.push(z,['*',['coalesce',['get','widthScale'],1],kindMatch(Object.fromEntries(Object.entries(WATER_TABLES).map(([k,t])=>[k,atZoom(t,z)])),property)]);return result;}
export const ROAD_KINDS=Object.keys(ROAD_TABLES).filter(k=>k!=='footway');
export const WATER_KINDS=Object.keys(WATER_TABLES);
export function namesFromZoom(thresholds){const expr=['step',['zoom'],''];for(const z of [...new Set(Object.values(thresholds))].sort((a,b)=>a-b))expr.push(z,['case',['in',['get','kind'],['literal',Object.keys(thresholds).filter(k=>thresholds[k]<=z)]],['get','name'],'']);return expr;}
// Carto/OSM uses a 256px world tile; MapLibre's camera uses 512px. At the
// same ground scale OSM z17 is MapLibre z16. Convert thresholds, not pixels.
// https://openmaptiles.org/docs/terminology/zoom-level/
export function cartoCameraLayer(layer){
 const shift=value=>{
  if(!Array.isArray(value))return value;
  const camera=(value[0]==='step'&&value[1]?.[0]==='zoom')||(value[0]==='interpolate'&&value[2]?.[0]==='zoom');
  return value.map((v,i)=>camera&&i>=3&&i%2===1?v-1:shift(v));
 };
 const result={...layer};
 for(const key of ['minzoom','maxzoom'])if(typeof result[key]==='number')result[key]--;
 for(const key of ['layout','paint'])if(result[key])result[key]=Object.fromEntries(Object.entries(result[key]).map(([k,v])=>[k,shift(v)]));
 return result;
}
