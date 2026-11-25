import {effectiveTags} from './feature-catalog.mjs';
import {KINDS} from './history-model.mjs';
import {junctions,roundedFeature} from './corner-geometry.mjs';
import {roadWidth,waterWidth,ROAD_KINDS,WATER_KINDS,namesFromZoom,cartoCameraLayer} from './osm-carto-rules.mjs';
// Cartographic rules adapted from openstreetmap-carto (CC0), including zoom tables.
// This browser preview is a MapLibre implementation, not the Mapnik renderer.
export const OSM_REFERENCE='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const NATURAL_SOURCE='https://tiles.openfreemap.org/planet';
const font=['Noto Sans Regular'];
const match=(key,fallback)=>['match',['get','kind'],...Object.entries(KINDS).flatMap(([k,v])=>[k,v[key]??fallback]),fallback];
const width=extra=>['interpolate',['linear'],['zoom'],8,['*',['get','weight'],.08],12,['+',['*',['get','weight'],.24],extra],17,['+',['get','weight'],extra],20,['+',['*',['get','weight'],2.2],extra]];
export function historyStyle(){
 const line=['==',['geometry-type'],'LineString'],poly=['==',['geometry-type'],'Polygon'],point=['==',['geometry-type'],'Point'];
 const road=['in',['get','kind'],['literal',ROAD_KINDS]],water=['in',['get','kind'],['literal',WATER_KINDS]],landuse=['in',['get','kind'],['literal',['housing','industrial','farmland','commercial','retail','cemetery','orchard','meadow','grass','brownfield','construction','quarry','military','education','religious_area']]],building=['==',['get','kind'],'building'];
 const waterAreas=['in',['get','kind'],['literal',['water','lake','pond','reservoir','river_area']]],paths=['in',['get','kind'],['literal',['footway','path','track','cycleway','steps']]],rails=['in',['get','kind'],['literal',['rail','tram','subway','light_rail']]];
 const genericLines=['all',line,['!',road],['!',water],['!',paths],['!',rails]];
 const colors=part=>['step',['zoom'],['match',['get','kind'],...(part==='fill'?['motorway','#e66e89','trunk','#f6967a','primary','#f4c37d','secondary','#e7ed9d']:['motorway','#c24e6b','trunk','#d1684a','primary','#c78d2b','secondary','#a4b329']),part==='fill'?'#ffffff':'#b9b9b9'],12,match(part==='fill'?'fill':'stroke',part==='fill'?'#ffffff':'#b9b9b9')];
 const layers=[
  {id:'history-ground',type:'background',paint:{'background-color':'#f2efe9'}},
  {id:'natural-cover',type:'fill',source:'nature','source-layer':'landcover',filter:['in',['get','class'],['literal',['wood','grass','scrub','sand','ice']]],paint:{'fill-color':['match',['get','class'],'wood','#add19e','grass','#cdebb0','scrub','#c8d7ab','sand','#f5e9c6','ice','#ddecec','#f2efe9']}},
  {id:'natural-water',type:'fill',source:'nature','source-layer':'water',paint:{'fill-color':'#aad3df'}},
  {id:'natural-waterways',type:'line',source:'nature','source-layer':'waterway',minzoom:8,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#aad3df','line-width':waterWidth('class')}},
  {id:'reference-osm',type:'raster',source:'reference',layout:{visibility:'none'},paint:{'raster-opacity':.8,'raster-fade-duration':0}},
  {id:'reference-satellite',type:'raster',source:'satellite',layout:{visibility:'none'},paint:{'raster-opacity':.8,'raster-fade-duration':0}},
  {id:'history-areas',type:'fill',source:'history',filter:['all',poly,['!',building],['!',landuse],['!',waterAreas]],layout:{'fill-sort-key':['get','order']},paint:{'fill-color':match('fill','#f2efe9'),'fill-opacity':1}},
  {id:'history-landuse',type:'fill',source:'history',minzoom:8,filter:['all',poly,landuse],paint:{'fill-color':match('fill','#e0dfdf')}},
  {id:'history-landuse-outlines',type:'line',source:'history',minzoom:16,filter:['all',poly,landuse],paint:{'line-color':match('stroke','#b9b9b9'),'line-width':.5}},
  {id:'history-waterareas',type:'fill',source:'history',filter:['all',poly,waterAreas],paint:{'fill-color':'#aad3df'}},
  {id:'history-buildings',type:'fill',source:'history',minzoom:14,filter:['all',poly,building],paint:{'fill-color':['step',['zoom'],'#d1c6bd',15,'#d9d0c9']}},
  {id:'history-area-outlines',type:'line',source:'history',minzoom:15,filter:['all',poly,building],paint:{'line-color':'#b9a99c','line-width':.75}},
  {id:'history-waterlines',type:'line',source:'history',minzoom:8,filter:['all',line,water],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#aad3df','line-width':waterWidth()}},
  {id:'history-line-casings',type:'line',source:'history',minzoom:6,filter:['all',line,road],layout:{'line-cap':'round','line-join':'round','line-sort-key':['get','order']},paint:{'line-color':colors('stroke'),'line-width':roadWidth('full'),'line-opacity':['case',['get','tunnel'],.55,1]}},
  {id:'history-lines',type:'line',source:'history',minzoom:6,filter:['all',line,road],layout:{'line-cap':'round','line-join':'round','line-sort-key':['get','order']},paint:{'line-color':colors('fill'),'line-width':roadWidth('fill'),'line-opacity':['case',['get','tunnel'],.55,1]}},
  {id:'history-footway-background',type:'line',source:'history',minzoom:14,filter:['all',line,paths],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':['step',['zoom'],2.7,15,3,16,3.3,19,3.6]}},
  {id:'history-footway',type:'line',source:'history',minzoom:14,filter:['all',line,paths],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':match('fill','#fa8072'),'line-width':['step',['zoom'],.7,15,1,16,1.3,19,1.6],'line-dasharray':[1,3]}},
  {id:'history-rail',type:'line',source:'history',minzoom:8,filter:['all',line,rails],paint:{'line-color':'#707070','line-width':width(0)}},
  {id:'history-rail-sleepers',type:'line',source:'history',minzoom:13,filter:['all',line,rails],paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],13,.6,17,1.4,20,3],'line-dasharray':[4,4]}},
  {id:'history-bridge-casing',type:'line',source:'history',minzoom:13,filter:['all',line,road,['==',['get','bridge'],true]],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':'#000000','line-width':roadWidth('full')}},
  {id:'history-bridge-fill',type:'line',source:'history',minzoom:13,filter:['all',line,road,['==',['get','bridge'],true]],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':match('fill','#ffffff'),'line-width':roadWidth('bridge-fill')}},
  {id:'history-other-lines',type:'line',source:'history',minzoom:12,filter:genericLines,layout:{'line-join':'round'},paint:{'line-color':match('fill','#777777'),'line-width':width(0),'line-dasharray':[4,2]}},
  {id:'history-line-names',type:'symbol',source:'history',minzoom:13,filter:['all',line,road],layout:{'symbol-placement':'line','text-field':namesFromZoom({motorway:13,trunk:13,primary:13,secondary:13,tertiary:14,residential:16,service:17,unclassified:16,road:17,living_street:16,pedestrian:16}),'text-font':font,'text-size':['step',['zoom'],8,14,9,15,['case',['in',['get','kind'],['literal',['motorway','trunk','primary','secondary']]],10,9],17,['case',['==',['get','kind'],'service'],9,11],19,['case',['==',['get','kind'],'service'],11,12]],'text-max-angle':30,'symbol-spacing':300},paint:{'text-color':'#000000','text-halo-color':match('fill','#ffffff'),'text-halo-width':.75}},
  {id:'history-water-names',type:'symbol',source:'history',minzoom:13,filter:['all',line,water],layout:{'symbol-placement':'line','text-field':namesFromZoom({river:13,canal:13,stream:15}),'text-font':font,'text-size':['step',['zoom'],10,14,['case',['==',['get','kind'],'stream'],10,12]],'text-max-angle':30,'symbol-spacing':200},paint:{'text-color':'#4d80b3','text-halo-color':'#ffffff','text-halo-width':.75}},
  {id:'history-area-names',type:'symbol',source:'history',minzoom:13,filter:['all',poly,['!',building]],layout:{'text-field':['get','name'],'text-font':font,'text-size':['step',['zoom'],10,15,12],'text-max-width':8,'text-padding':3},paint:{'text-color':['case',waterAreas,'#4d80b3',['in',['get','kind'],['literal',['forest','wood','park']]],'#228b22','#666666'],'text-halo-color':'#ffffff','text-halo-width':.75}},
  {id:'history-building-names',type:'symbol',source:'history',minzoom:17,filter:['all',poly,building],layout:{'text-field':['get','name'],'text-font':font,'text-size':10,'text-max-width':7,'text-padding':3},paint:{'text-color':'#555555','text-halo-color':'#ffffff','text-halo-width':.5}},
  {id:'history-points',type:'circle',source:'history',minzoom:13,filter:['all',point,['!', ['in',['get','kind'],['literal',['place','city','town','village','hamlet','suburb','neighbourhood']]]]],paint:{'circle-color':match('fill','#666666'),'circle-radius':3,'circle-stroke-color':'#ffffff','circle-stroke-width':1}},
  {id:'history-point-names',type:'symbol',source:'history',minzoom:5,filter:point,layout:{'text-field':namesFromZoom(Object.fromEntries(Object.entries(KINDS).filter(([,v])=>v.geometry==='Point').map(([k])=>[k,({city:5,town:10,village:12,hamlet:13,suburb:13,neighbourhood:15,place:11,station:13,bus_stop:16}[k]||16)]))),'text-font':font,'text-size':['step',['zoom'],['case',['==',['get','kind'],'city'],18,['==',['get','kind'],'town'],15,10],13,['case',['==',['get','kind'],'city'],20,['==',['get','kind'],'town'],17,11],15,13,17,14],'text-anchor':['case',['in',['get','kind'],['literal',['place','city','town','village','hamlet','suburb','neighbourhood']]],'center','top'],'text-offset':['case',['in',['get','kind'],['literal',['place','city','town','village','hamlet','suburb','neighbourhood']]],['literal',[0,0]],['literal',[0,.6]]],'text-padding':3,'symbol-sort-key':['match',['get','kind'],'city',0,'town',1,'place',2,'village',3,5]},paint:{'text-color':match('fill','#333333'),'text-halo-color':'#ffffff','text-halo-width':1}},
  {id:'history-selected-line',type:'line',source:'selection',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#1463ce','line-width':3,'line-dasharray':[2,2]}},
  {id:'history-selected-point',type:'circle',source:'selection',filter:point,paint:{'circle-color':'#1463ce','circle-radius':9,'circle-opacity':.25}},
  {id:'history-draft-fill',type:'fill',source:'draft',filter:poly,paint:{'fill-color':'#1463ce','fill-opacity':.16}},
  {id:'history-draft-line',type:'line',source:'draft',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#1463ce','line-width':2,'line-dasharray':[3,2]}},
  {id:'history-draft-points',type:'circle',source:'draft',filter:point,paint:{'circle-radius':4,'circle-color':'#ffffff','circle-stroke-color':'#1463ce','circle-stroke-width':2}}
 ];
 // The contemporary map can be seen even inside an already painted area.
 const reference=layers.filter(l=>l.id==='reference-osm'||l.id==='reference-satellite');for(const l of reference)layers.splice(layers.indexOf(l),1);layers.splice(layers.findIndex(l=>l.id==='history-selected-line'),0,...reference);
 // These layers above are written in upstream Carto zooms. Editing overlays
 // and the existing railway implementation already use MapLibre camera zooms.
 for(let i=0;i<layers.length;i++)if(layers[i].id==='natural-waterways'||(layers[i].id.startsWith('history-')&&!/^history-(rail|selected|draft)/.test(layers[i].id)))layers[i]=cartoCameraLayer(layers[i]);
 return {version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{
  nature:{type:'vector',url:NATURAL_SOURCE,attribution:'<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'},
  reference:{type:'raster',tiles:[OSM_REFERENCE],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'},
  satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Tiles © Esri, Maxar, Earthstar Geographics'},
  history:{type:'geojson',data:{type:'FeatureCollection',features:[]}},selection:{type:'geojson',data:{type:'FeatureCollection',features:[]}},draft:{type:'geojson',data:{type:'FeatureCollection',features:[]}}
 },layers};
}
export function displayFeatures(project){const fixed=junctions(project.features);return {type:'FeatureCollection',features:project.features.filter(f=>f.properties.visible!==false).map(f=>({...roundedFeature(f,fixed),properties:{...f.properties,...(effectiveTags(f).layer?{zLayer:Number(effectiveTags(f).layer)||0}:{zLayer:0}),fid:f.id,weight:(KINDS[f.properties.kind].width||1)*f.properties.widthScale,order:f.geometry.type==='Polygon'?(f.properties.kind==='land'?0:f.properties.kind==='building'?30:10):(Number(effectiveTags(f).layer)||0)*100+(f.properties.bridge?30:f.properties.tunnel?-10:0)}}))};}
export function setReferenceLayers(map,{reference=false,referenceType='osm',opacity=.8}={}){
 for(const id of ['reference-osm','reference-satellite']){map.setLayoutProperty(id,'visibility',reference&&id==='reference-'+referenceType?'visible':'none');map.setPaintProperty(id,'raster-opacity',opacity);}
}
