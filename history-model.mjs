import {EXTRA_KINDS,LEGACY_TAGS,kindFromTags} from './feature-catalog.mjs';
import {junctions,roundedFeature} from './corner-geometry.mjs';
// Geometry is kept in real WGS84 coordinates; no contemporary roads are copied.
export const HISTORY_APP='historical-map-studio';
export const KINDS={
 motorway:{name:'高速公路',group:'道路',geometry:'LineString',fill:'#e892a2',stroke:'#dc2a67',width:9},
 trunk:{name:'干线公路',group:'道路',geometry:'LineString',fill:'#f9b29c',stroke:'#c84e2f',width:9},
 primary:{name:'主要道路',group:'道路',geometry:'LineString',fill:'#fcd6a4',stroke:'#a06b00',width:8},
 secondary:{name:'次要道路',group:'道路',geometry:'LineString',fill:'#f7fabf',stroke:'#707d05',width:7},
 tertiary:{name:'一般道路',group:'道路',geometry:'LineString',fill:'#ffffff',stroke:'#8f8f8f',width:6},
 residential:{name:'街巷',group:'道路',geometry:'LineString',fill:'#ffffff',stroke:'#b9b9b9',width:5},
 service:{name:'小路 / 院内道路',group:'道路',geometry:'LineString',fill:'#ffffff',stroke:'#b9b9b9',width:3},
 footway:{name:'步道',group:'道路',geometry:'LineString',fill:'#fa8072',stroke:'#ffffff',width:2},
 rail:{name:'铁路',group:'交通',geometry:'LineString',fill:'#ffffff',stroke:'#707070',width:3},
 river:{name:'河流',group:'水系',geometry:'LineString',fill:'#aad3df',stroke:'#aad3df',width:10},
 canal:{name:'运河 / 河浜',group:'水系',geometry:'LineString',fill:'#aad3df',stroke:'#aad3df',width:6},
 stream:{name:'溪流 / 水渠',group:'水系',geometry:'LineString',fill:'#aad3df',stroke:'#aad3df',width:3},
 water:{name:'湖泊 / 水面',group:'区域',geometry:'Polygon',fill:'#aad3df',stroke:'#92c6d5'},
 land:{name:'陆地 / 填水区域',group:'区域',geometry:'Polygon',fill:'#f2efe9',stroke:'#f2efe9'},
 housing:{name:'居住用地',group:'区域',geometry:'Polygon',fill:'#e0dfdf',stroke:'#b9b9b9'},
 industrial:{name:'工业用地',group:'区域',geometry:'Polygon',fill:'#ebdbe8',stroke:'#c6b3c3'},
 park:{name:'公园',group:'区域',geometry:'Polygon',fill:'#c8facc',stroke:'#a6d9aa'},
 forest:{name:'林地',group:'区域',geometry:'Polygon',fill:'#add19e',stroke:'#95bc86'},
 farmland:{name:'农田',group:'区域',geometry:'Polygon',fill:'#eef0d5',stroke:'#c7c9ae'},
 building:{name:'建筑',group:'建筑',geometry:'Polygon',fill:'#d9d0c9',stroke:'#b9a99c'},
 place:{name:'地名',group:'标注',geometry:'Point',fill:'#333333',stroke:'#ffffff'},
 station:{name:'车站',group:'标注',geometry:'Point',fill:'#7981b0',stroke:'#ffffff'}
};
Object.assign(KINDS,EXTRA_KINDS);
KINDS.residential.name='居住道路';KINDS.service.name='服务道路';KINDS.canal.name='运河 / 人工水道';KINDS.stream.name='溪流';
export const clone=value=>JSON.parse(JSON.stringify(value));
export const newId=()=>`map-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
export const emptyHistory=title=>({app:HISTORY_APP,version:1,title:title||'我的历史地图',year:'',features:[],updatedAt:new Date().toISOString()});
const text=(v,max=160)=>String(v??'').trim().slice(0,max);
export const coordinateOK=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=85.051129;
export const equal=(a,b)=>a?.[0]===b?.[0]&&a?.[1]===b?.[1];
export function validateGeometry(g){
 if(!g||!['Point','LineString','Polygon'].includes(g.type))throw new Error('仅支持点、线和多边形。');
 const paths=g.type==='Point'?[[g.coordinates]]:g.type==='LineString'?[g.coordinates]:g.coordinates;
 if(!Array.isArray(paths)||!paths.length)throw new Error('地图要素缺少坐标。');
 let count=0;
 for(const path of paths){
  if(!Array.isArray(path)||!path.length||!path.every(coordinateOK))throw new Error('要素包含无效坐标。');
  count+=path.length;
  if(g.type==='LineString'&&(path.length<2||!path.some(p=>!equal(p,path[0]))))throw new Error('线至少需要两个不同的点。');
  if(g.type==='Polygon'){
   if(path.length<4||!equal(path[0],path.at(-1))||new Set(path.slice(0,-1).map(p=>p.join(','))).size<3)throw new Error('区域至少需要三个不同的顶点，并且必须闭合。');
   const area=path.slice(1).reduce((a,c,i)=>a+path[i][0]*c[1]-c[0]*path[i][1],0);if(Math.abs(area)<1e-12)throw new Error('区域顶点不能全部在一条直线上。');
  }
 }
 return count;
}
export function normalizeHistory(input){
 let p=input;const geoJSON=p?.type==='FeatureCollection';
 if(p?.type==='FeatureCollection')p={...emptyHistory(p.name),year:p.year||'',features:p.features};
 if(!p||(!Array.isArray(p.features))||(p.app&&p.app!==HISTORY_APP)||p.version!=null&&p.version!==1)throw new Error('请选择历史地图试绘项目 JSON 或兼容的 GeoJSON。');
 if(p.features.length>10000)throw new Error('最多支持 10,000 个自绘要素，请按地区分开保存。');
 const ids=new Set();let vertices=0;
 const features=p.features.map((feature,i)=>{
  const a=feature.properties||{},hasTags=a.tags!=null||(!a.kind&&geoJSON),tags=hasTags?normalizeTags(a.tags||Object.fromEntries(Object.entries(a).filter(([k,v])=>typeof v==='string'&&!['kind','name','notes','presetId'].includes(k)))):null;
  if(hasTags&&a.tags==null&&a.name&&!tags.name)tags.name=text(a.name);
  const kind=hasTags?kindFromTags(tags,feature.geometry?.type,a.kind==='land'?'land':undefined):a.kind;if(!Object.hasOwn(KINDS,kind))throw new Error(`第 ${i+1} 个要素的类型不受支持。`);
  if(KINDS[kind].geometry!==feature.geometry?.type)throw new Error('要素类型与几何形状不匹配。');
  const radius=a.cornerRadius==null?0:Number(a.cornerRadius);
  if(!Number.isFinite(radius)||radius<0||radius>200000)throw new Error('圆角半径需要在 0 至 200,000 米之间。');
  const geometry=geoJSON&&radius>0&&a.anchorGeometry?a.anchorGeometry:feature.geometry;
  if(geometry.type!==feature.geometry.type)throw new Error('圆角原节点与要素类型不匹配。');
  vertices+=validateGeometry(geometry);if(vertices>150000)throw new Error('节点超过 150,000 个，请按地区分开保存。');
  if(geometry!==feature.geometry)validateGeometry(feature.geometry);
  const id=text(feature.id||newId(),150);if(ids.has(id))throw new Error('项目中存在重复的要素编号。');ids.add(id);
  const preserved=clone(a);delete preserved.anchorGeometry;
  return {type:'Feature',id,properties:{...preserved,kind,...(hasTags?{tags,presetId:text(a.presetId,255)}:{}),name:text(hasTags?tags.name:a.name),notes:text(a.notes,2000),visible:a.visible!==false,bridge:hasTags?!!tags.bridge&&tags.bridge!=='no':a.bridge===true,tunnel:hasTags?!!tags.tunnel&&tags.tunnel!=='no':a.tunnel===true,widthScale:Number.isFinite(+a.widthScale)?Math.max(.25,Math.min(5,+a.widthScale)):1,...(radius>0&&geometry.type!=='Point'?{cornerRadius:radius}:{})},geometry:clone(geometry)};
 });
 return {...clone(p),app:HISTORY_APP,version:1,title:text(p.title||p.name||'我的历史地图',80),year:text(p.year,40),features,updatedAt:typeof p.updatedAt==='string'?p.updatedAt:new Date().toISOString()};
}
export function makeFeature(kind,coordinates,name=''){
 const type=KINDS[kind]?.geometry;if(!type)throw new Error('请选择绘制类型。');
 let c=clone(coordinates);if(type==='Polygon'){if(!equal(c[0],c.at(-1)))c.push(c[0].slice());c=[c];}
 const f={type:'Feature',id:newId(),properties:{kind,name,visible:true,widthScale:1,bridge:false,tunnel:false,notes:''},geometry:{type,coordinates:c}};
 validateGeometry(f.geometry);return f;
}
export function historyGeoJSON(p){const fixed=junctions(p.features);return {type:'FeatureCollection',name:p.title,year:p.year,features:p.features.map(f=>{const rendered=roundedFeature(f,fixed);return clone(rendered===f?f:{...rendered,properties:{...f.properties,anchorGeometry:f.geometry}});})};}
export function editPaths(feature){const g=feature.geometry;return g.type==='Point'?[]:g.type==='LineString'?[g.coordinates]:g.coordinates;}
export function moveVertex(feature,ring,index,at){
 if(!coordinateOK(at))throw new Error('坐标超出有效范围。');
 if(feature.geometry.type==='Point'){feature.geometry.coordinates=at.slice();return;}
 const path=editPaths(feature)[ring];path[index]=at.slice();if(feature.geometry.type==='Polygon'&&index===0)path[path.length-1]=at.slice();
}
export function removeVertex(feature,ring,index){
 const path=editPaths(feature)[ring],polygon=feature.geometry.type==='Polygon';if(path.length<=(polygon?4:2))throw new Error(polygon?'区域至少保留三个顶点。':'线至少保留两个节点。');
 path.splice(index,1);if(polygon)path[path.length-1]=path[0].slice();validateGeometry(feature.geometry);
}

export function normalizeTags(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('标签需要是键值对象。');
 const pairs=Object.entries(input);if(pairs.length>300)throw new Error('单个要素最多支持 300 个标签。');
 return Object.fromEntries(pairs.filter(([,v])=>v!==''&&v!=null).map(([k,v])=>{
  if(!k.trim()||k.length>255||String(v).length>255||typeof v==='object')throw new Error('标签的键和值需为不超过 255 个字符的文字。');
  return [k.trim(),String(v)];
 }));
}
export function moveSharedVertex(project,featureId,ring,index,at){
 const feature=project.features.find(f=>f.id===featureId);if(!feature)throw new Error('未找到要素。');
 const old=(feature.geometry.type==='Point'?feature.geometry.coordinates:editPaths(feature)[ring][index]).slice();
 if(feature.geometry.type==='Point'){moveVertex(feature,ring,index,at);return;}
 for(const f of project.features){if(f.geometry.type==='Point')continue;for(const path of editPaths(f))for(let i=0;i<path.length;i++)if(equal(path[i],old))path[i]=at.slice();}
}
export function splitLine(project,id,index){
 const f=project.features.find(f=>f.id===id),path=f?.geometry.coordinates;
 if(f?.geometry.type!=='LineString'||index<=0||index>=path.length-1)throw new Error('请选择线中间的节点切分。');
 const second=clone(f);second.id=newId();second.geometry.coordinates=path.slice(index).map(c=>c.slice());f.geometry.coordinates=path.slice(0,index+1).map(c=>c.slice());project.features.push(second);return second.id;
}
