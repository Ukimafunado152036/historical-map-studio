import {KINDS} from './history-model.mjs';
import {junctions,roundedFeature} from './corner-geometry.mjs';
// Colours follow openstreetmap-carto, CC0: github.com/openstreetmap-carto/openstreetmap-carto.
// This browser preview is a MapLibre implementation, not the Mapnik renderer.
export const OSM_REFERENCE='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const NATURAL_SOURCE='https://tiles.openfreemap.org/planet';
const font=['Noto Sans Regular'];
const match=(key,fallback)=>['match',['get','kind'],...Object.entries(KINDS).flatMap(([k,v])=>[k,v[key]??fallback]),fallback];
const width=extra=>['interpolate',['linear'],['zoom'],8,['*',['get','weight'],.08],12,['+',['*',['get','weight'],.24],extra],17,['+',['get','weight'],extra],20,['+',['*',['get','weight'],2.2],extra]];
export function historyStyle(){
 const line=['==',['geometry-type'],'LineString'],poly=['==',['geometry-type'],'Polygon'],point=['==',['geometry-type'],'Point'];
 const road=['in',['get','kind'],['literal',Object.keys(KINDS).filter(k=>KINDS[k].group==='道路')]];
 const notRail=['!=',['get','kind'],'rail'];
 const layers=[
  {id:'history-ground',type:'background',paint:{'background-color':'#f2efe9'}},
  {id:'natural-cover',type:'fill',source:'nature','source-layer':'landcover',filter:['in',['get','class'],['literal',['wood','grass','scrub','sand','ice']]],paint:{'fill-color':['match',['get','class'],'wood','#add19e','grass','#cdebb0','scrub','#c8d7ab','sand','#f5e9c6','ice','#ddecec','#f2efe9']}},
  {id:'natural-water',type:'fill',source:'nature','source-layer':'water',paint:{'fill-color':'#aad3df'}},
  {id:'natural-waterways',type:'line',source:'nature','source-layer':'waterway',paint:{'line-color':'#aad3df','line-width':['interpolate',['linear'],['zoom'],8,.5,14,2,18,6]}},
  {id:'reference-osm',type:'raster',source:'reference',layout:{visibility:'none'},paint:{'raster-opacity':.8,'raster-fade-duration':0}},
  {id:'reference-satellite',type:'raster',source:'satellite',layout:{visibility:'none'},paint:{'raster-opacity':.8,'raster-fade-duration':0}},
  {id:'history-areas',type:'fill',source:'history',filter:poly,layout:{'fill-sort-key':['get','order']},paint:{'fill-color':match('fill','#f2efe9'),'fill-opacity':1}},
  {id:'history-area-outlines',type:'line',source:'history',filter:poly,paint:{'line-color':match('stroke','#b9b9b9'),'line-width':['interpolate',['linear'],['zoom'],12,.1,17,.7,20,1.2]}},
  {id:'history-line-casings',type:'line',source:'history',filter:['all',line,road],layout:{'line-cap':'round','line-join':'round','line-sort-key':['get','order']},paint:{'line-color':match('stroke','#b9b9b9'),'line-width':width(1.5),'line-opacity':['case',['get','tunnel'],.55,1]}},
  {id:'history-lines',type:'line',source:'history',filter:['all',line,notRail],layout:{'line-cap':'round','line-join':'round','line-sort-key':['get','order']},paint:{'line-color':match('fill','#ffffff'),'line-width':width(0),'line-opacity':['case',['get','tunnel'],.55,1]}},
  {id:'history-rail',type:'line',source:'history',filter:['all',line,['==',['get','kind'],'rail']],paint:{'line-color':'#707070','line-width':width(0)}},
  {id:'history-rail-sleepers',type:'line',source:'history',minzoom:13,filter:['all',line,['==',['get','kind'],'rail']],paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],13,.6,17,1.4,20,3],'line-dasharray':[4,4]}},
  {id:'history-bridge-casing',type:'line',source:'history',filter:['all',line,road,['==',['get','bridge'],true]],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':'#333333','line-width':width(3)}},
  {id:'history-bridge-fill',type:'line',source:'history',filter:['all',line,road,['==',['get','bridge'],true]],layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':match('fill','#ffffff'),'line-width':width(0)}},
  {id:'history-line-names',type:'symbol',source:'history',minzoom:12,filter:line,layout:{'symbol-placement':'line','text-field':['get','name'],'text-font':font,'text-size':['interpolate',['linear'],['zoom'],12,11,18,14],'symbol-spacing':250},paint:{'text-color':['case',['in',['get','kind'],['literal',['river','canal','stream']]],'#4d80b3','#333333'],'text-halo-color':'#ffffff','text-halo-width':1.5}},
  {id:'history-area-names',type:'symbol',source:'history',minzoom:13,filter:poly,layout:{'text-field':['get','name'],'text-font':font,'text-size':12,'text-max-width':8},paint:{'text-color':'#555555','text-halo-color':'#ffffff','text-halo-width':1}},
  {id:'history-points',type:'circle',source:'history',filter:point,paint:{'circle-color':match('fill','#333333'),'circle-radius':['case',['==',['get','kind'],'station'],4,2.5],'circle-stroke-color':'#ffffff','circle-stroke-width':1}},
  {id:'history-point-names',type:'symbol',source:'history',filter:point,layout:{'text-field':['get','name'],'text-font':font,'text-size':14,'text-anchor':'top','text-offset':[0,.6]},paint:{'text-color':'#333333','text-halo-color':'#ffffff','text-halo-width':1.8}},
  {id:'history-selected-line',type:'line',source:'selection',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#1463ce','line-width':3,'line-dasharray':[2,2]}},
  {id:'history-selected-point',type:'circle',source:'selection',filter:point,paint:{'circle-color':'#1463ce','circle-radius':9,'circle-opacity':.25}},
  {id:'history-draft-fill',type:'fill',source:'draft',filter:poly,paint:{'fill-color':'#1463ce','fill-opacity':.16}},
  {id:'history-draft-line',type:'line',source:'draft',filter:['!=',['geometry-type'],'Point'],paint:{'line-color':'#1463ce','line-width':2,'line-dasharray':[3,2]}},
  {id:'history-draft-points',type:'circle',source:'draft',filter:point,paint:{'circle-radius':4,'circle-color':'#ffffff','circle-stroke-color':'#1463ce','circle-stroke-width':2}}
 ];
 // The contemporary map can be seen even inside an already painted area.
 const reference=layers.splice(4,2);layers.splice(layers.findIndex(l=>l.id==='history-selected-line'),0,...reference);
 return {version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{
  nature:{type:'vector',url:NATURAL_SOURCE,attribution:'<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'},
  reference:{type:'raster',tiles:[OSM_REFERENCE],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'},
  satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Tiles © Esri, Maxar, Earthstar Geographics'},
  history:{type:'geojson',data:{type:'FeatureCollection',features:[]}},selection:{type:'geojson',data:{type:'FeatureCollection',features:[]}},draft:{type:'geojson',data:{type:'FeatureCollection',features:[]}}
 },layers};
}
export function displayFeatures(project){const fixed=junctions(project.features);return {type:'FeatureCollection',features:project.features.filter(f=>f.properties.visible!==false).map(f=>({...roundedFeature(f,fixed),properties:{...f.properties,fid:f.id,weight:(KINDS[f.properties.kind].width||1)*f.properties.widthScale,order:f.geometry.type==='Polygon'?(f.properties.kind==='land'?0:f.properties.kind==='building'?30:10):f.properties.bridge?30:f.properties.tunnel?-10:0}}))};}
export function setReferenceLayers(map,{reference=false,referenceType='osm',opacity=.8}={}){
 for(const id of ['reference-osm','reference-satellite']){map.setLayoutProperty(id,'visibility',reference&&id==='reference-'+referenceType?'visible':'none');map.setPaintProperty(id,'raster-opacity',opacity);}
}
