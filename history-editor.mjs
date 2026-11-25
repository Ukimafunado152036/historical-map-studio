import {LEGACY_TAGS,effectiveTags,kindFromTags} from './feature-catalog.mjs';
import {loadPresets,getPreset,presetTags,geometryName,presetCount} from './osm-presets.mjs';
import {featureLabel,fieldsHTML,tagsHTML,viewerInspector,presetPickerHTML,presetResults} from './editor-panels.mjs';
import {GitHubProjectStore} from './github-storage.mjs';
import {GITHUB_PROJECT,GITHUB_SITE} from './github-config.mjs';
import {workspaceKeys} from './workspaces.mjs';
import {KINDS,emptyHistory,normalizeHistory,makeFeature,historyGeoJSON,clone,equal,editPaths,moveVertex,removeVertex,validateGeometry,coordinateOK,moveSharedVertex,splitLine} from './history-model.mjs';
import {historyStyle,displayFeatures,setReferenceLayers} from './history-style.mjs';
import {roundedFeature} from './corner-geometry.mjs';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const collection=features=>({type:'FeatureCollection',features});
const canonical=(lng,lat)=>[lng>=-180&&lng<=180?lng:(((lng+180)%360)+360)%360-180,Math.max(-85.051128,Math.min(85.051128,lat))];
const cities={杭州:[120.1551,30.2741],武汉:[114.3054,30.5931],南通:[120.8647,32.0169],常州:[119.9741,31.8112],嘉兴:[120.7555,30.7465],湖州:[120.087,30.895],南京:[118.7969,32.0603],洛阳:[112.454,34.6197],北京:[116.397,39.9087],台北:[121.504347,25.04224]};
export function parseLocation(value){
 const v=String(value).trim();if(cities[v])return {center:cities[v],zoom:15};
 const hash=v.match(/#(?:map=)?(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
 if(hash){const c=[+hash[3],+hash[2]];if(coordinateOK(c)&&+hash[1]>=1&&+hash[1]<=20)return {center:c,zoom:+hash[1]-(hash[0].startsWith('#map=')?1:0)};}
 const nums=v.split(/[,，\s]+/).map(Number);if(nums.length===2&&coordinateOK(nums))return {center:nums,zoom:16};
 throw new Error('请输入“经度,纬度”、上方城市名，或包含地图位置的 OSM 链接。');
}
export function mountHistoryEditor(workspace,{storeFactory}={}){
 const initialHash=location.hash;
 const viewer=new URL(location.href).searchParams.get('mode')==='view';
 document.body.className='history-editor'+(viewer?' hm-viewer':'');document.getElementById('map').hidden=false;
 const id='history-'+workspace.id,keys=workspaceKeys(id);
 let project=emptyHistory('我的历史地图'),prefs={reference:false,referenceType:'osm',opacity:.8,snap:true,lineRadius:30,areaRadius:0},rawBackup='';
 // Display preferences stay in this tab; project data is read from GitHub.
 prefs.opacity=Math.max(.1,Math.min(1,Number(prefs.opacity)||.8));prefs.referenceType=prefs.referenceType==='satellite'?'satellite':'osm';
 for(const k of ['lineRadius','areaRadius'])if(!Number.isFinite(+prefs[k])||+prefs[k]<0||+prefs[k]>200000)prefs[k]=k==='lineRadius'?30:0;
 let selected=null,editing=false,drawing=null,kind='residential',tab='draw',markers=[],hover=null,snapCache=[],lastMove=0,spaceReference=null,toastTimer,closed=false,readyMap=false;
 const past=[],future=[];let lineNodes=new Set(),drawPreset=null,presetTarget=null,splitMode=false,pendingFit=false,linkedNodes=true;
 let cloudPath=GITHUB_PROJECT.path;try{cloudPath=new URL(location.href).searchParams.get('project')||cloudPath;}catch{}
 const store=storeFactory?storeFactory(storageStatus):new GitHubProjectStore({config:{...GITHUB_PROJECT,path:cloudPath},onChange:storageStatus});
 try{rawBackup=localStorage.getItem(keys.project)||'';}catch{}
 const center=workspace.view?.center||cities.杭州;
 let view={center,zoom:14};
 if(prefs.view&&coordinateOK(prefs.view.center)&&Number.isFinite(prefs.view.zoom))view=prefs.view;
 try{if(location.hash)view=parseLocation(location.hash);}catch{}
 const style=historyStyle(),pickLayers=style.layers.filter(l=>(l.source==='history'&&l.type!=='symbol')||l.id==='history-point-names').map(l=>l.id);
 let map;try{map=new maplibregl.Map({container:'map',style,...view,minZoom:2,maxZoom:20,attributionControl:false,dragRotate:false,pitchWithRotate:false,localIdeographFontFamily:"'Noto Sans CJK SC', 'Microsoft YaHei', 'PingFang SC', sans-serif"});}catch{throw new Error('绘图需要 WebGL。当前浏览器未能启用图形加速，请使用支持 WebGL 的 Edge / Chrome 打开。');}
 window.__historyMap=map;map.touchZoomRotate.disableRotation();map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-right');map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
 document.body.insertAdjacentHTML('beforeend',`
  <header id="hm-header"><button class="hm-home" data-hm="home">打开项目</button><div class="hm-heading"><strong>历史地图绘图台</strong><span>GitHub 云端项目</span></div><div class="hm-header-actions"><button data-hm="locate">定位地点</button><button id="hm-reference" class="hm-reference" data-hm="reference" aria-pressed="false">显示现实地图</button><button data-hm="cloud-save" id="hm-cloud-save">保存到 GitHub</button><button data-hm="share">分享</button><button data-hm="view-mode" id="hm-mode-switch">${viewer?'进入编辑':'浏览模式'}</button><button data-hm="storage">GitHub 项目</button></div></header>
  <aside id="hm-panel" aria-label="历史地图绘图面板"><div class="hm-project"><label>地图名称<input id="hm-title" maxlength="80" value="${escape(project.title)}"></label><label class="hm-year">目标年代<input id="hm-year" maxlength="40" placeholder="如：1980年" value="${escape(project.year)}"></label></div><nav class="hm-tabs"><button data-hm-tab="draw" aria-selected="true">绘制</button><button data-hm-tab="list">我的要素 <span id="hm-count">0</span></button><button data-hm-tab="view">显示</button></nav><div id="hm-content"></div><footer><button id="hm-save" data-hm="cloud-save">正在读取 GitHub…</button><button data-hm="export">导出</button></footer></aside>
  <div id="hm-reference-controls"><strong id="hm-reference-label">现实地图参照</strong><select id="hm-reference-type" aria-label="现实参照类型"><option value="osm">OSM 标准地图</option><option value="satellite">卫星影像</option></select><label>透明度<input id="hm-opacity" type="range" min="10" max="100" value="${prefs.opacity*100}" aria-label="现实参照透明度"></label></div>
  <nav id="hm-tools" aria-label="编辑工具"><button data-hm="select" title="选择和平移 V">选择</button><button data-hm="undo" title="撤销 Ctrl+Z">撤销</button><button data-hm="redo" title="重做 Ctrl+Shift+Z">重做</button><button data-hm="fit">显示全部</button></nav>
  <div id="hm-drawing" hidden></div><div id="hm-status" role="status">正在加载真实水陆…</div><div id="hm-toast" role="status" aria-live="polite"></div><dialog id="hm-dialog" aria-labelledby="hm-dialog-title"></dialog><input id="hm-open-fallback" type="file" accept=".json,.geojson" hidden>
 `);
 const $=s=>document.querySelector(s),panel=$('#hm-content'),dialog=$('#hm-dialog');
 function notify(s){$('#hm-toast').textContent=s;$('#hm-toast').classList.add('shown');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#hm-toast').classList.remove('shown'),4300);}
 function savePrefs(){}
 function storageStatus(){const el=document.getElementById('hm-save');if(!el)return;el.textContent=store.error?'GitHub：'+store.error.message:!store.loaded?'正在读取 GitHub…':store.saving?'正在提交 GitHub…':store.dirty?'修改待提交 · 点击立即保存':store.connected?(store.writeVerified?'已保存到 GitHub · '+store.name:'已连接 GitHub · 首次保存时确认写入权限'):'GitHub 只读 · 连接后编辑';el.classList.toggle('error',!!store.error);const button=document.getElementById('hm-cloud-save');if(button)button.disabled=store.saving;}
 function ensureReady(){if(viewer){notify('当前为浏览模式，请点击“进入编辑”。');return false;}if(store.needsReconnect){showStorage();return false;}return true;}
 function snapshot(){return clone(project);}
 function save(){const c=map.getCenter();project.view={center:[c.lng,c.lat],zoom:map.getZoom()};project.updatedAt=new Date().toISOString();try{store.save(project);}catch(e){notify('保存未完成：'+e.message);}storageStatus();}
 function commit(change,before=snapshot()){
  if(!ensureReady())return false;
  try{change(project);project=normalizeHistory(project);}catch(e){project=before;notify(e.message);render();draw();return false;}
  past.push(before);if(past.length>40)past.shift();future.length=0;save();render();draw();return true;
 }
 function item(){return project.features.find(f=>f.id===selected);}
 function stopDrawing(){drawing=null;hover=null;map.doubleClickZoom.enable();map.getCanvas().style.cursor='';render();draw();}
 function startDrawing(){if(!ensureReady())return;drawing={kind,preset:drawPreset,coordinates:[],cornerRadius:KINDS[kind].geometry==='LineString'?+prefs.lineRadius:+prefs.areaRadius};selected=null;editing=false;clearMarkers();map.doubleClickZoom.disable();map.getCanvas().style.cursor='crosshair';render();draw();}
 function finish(){if(!drawing)return;try{const f=draftFeature(drawing.coordinates);if(drawing.cornerRadius>0)f.properties.cornerRadius=drawing.cornerRadius;if(commit(p=>p.features.push(f))){selected=f.id;stopDrawing();render();draw();}}catch(e){notify(e.message);}}
 function undo(){if(drawing){drawing.coordinates.pop();draw();render();return;}if(!past.length||!ensureReady())return;future.push(snapshot());project=past.pop();selected=null;editing=false;save();render();draw();}
 function redo(){if(drawing||!future.length||!ensureReady())return;past.push(snapshot());project=future.pop();selected=null;editing=false;save();render();draw();}
 function clearMarkers(){markers.forEach(m=>m.remove());markers=[];}
 function snap(at){
  if(!prefs.snap)return at;const p=map.project(at);let best=10,found=at;
  for(const c of [...snapCache,...(drawing?.coordinates||[])]){const q=map.project(c),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<best){best=d;found=c;}}
  return found.slice();
 }
 function cornerControl(value,scope){return `<section class="hm-corners"><div class="hm-corner-heading"><strong>圆角半径</strong><svg viewBox="0 0 70 32" aria-hidden="true"><path d="M3 28H35V4H67" fill="none" stroke="#b6c5d0" stroke-dasharray="3 3"/><path d="M3 28H21Q35 28 35 14Q35 4 49 4H67" fill="none" stroke="#2468a9" stroke-width="2.5"/></svg></div><label class="hm-radius-input"><input type="number" min="0" max="200000" step="1" value="${value}" data-corner-input data-corner-scope="${scope}" aria-label="圆角半径（米）"><span>米</span></label><div class="hm-radius-presets">${[0,10,30,100,300].map(r=>`<button type="button" data-corner-radius="${r}" data-corner-scope="${scope}" aria-pressed="${value===r}">${r===0?'直角':r+' m'}</button>`).join('')}</div><p>逐点画线，拐角自动变圆。半径越大，转弯越舒缓。短边自动缩小圆角，共用连接节点保留原位。</p></section>`;}
 function setCornerRadius(raw,scope){
  const value=Number(raw);if(!Number.isFinite(value)||value<0||value>200000){notify('请输入 0 至 200,000 米之间的圆角半径。');render();return;}
  if(scope==='feature'){const f=item();if(f)commit(()=>{if(value>0)f.properties.cornerRadius=value;else delete f.properties.cornerRadius;});return;}
  const type=KINDS[drawing?.kind||kind].geometry;prefs[type==='LineString'?'lineRadius':'areaRadius']=value;savePrefs();if(drawing)drawing.cornerRadius=value;render();draw();
 }
 function updateFeatures(){lineNodes=new Set(project.features.filter(f=>f.geometry.type==='LineString').flatMap(f=>f.geometry.coordinates.map(c=>c.join(','))));const data=displayFeatures(project);map.getSource('history').setData(data);map.getSource('selection').setData(collection(data.features.filter(f=>f.id===selected)));}
 function render(){
  if(selected&&!item()){selected=null;editing=false;}
  document.title=project.title+' · 历史地图绘图台';document.body.classList.toggle('has-selection',!!item());document.body.classList.toggle('has-load-error',!!store.error&&!store.loaded);document.querySelector('.hm-heading strong').textContent=viewer?project.title:'历史地图绘图台';$('#hm-title').value=project.title;$('#hm-year').value=project.year;$('#hm-count').textContent=project.features.length;
  document.querySelectorAll('[data-hm-tab]').forEach(b=>b.setAttribute('aria-selected',String(tab===b.dataset.hmTab)));
  document.querySelector('[data-hm="undo"]').disabled=drawing?!drawing.coordinates.length:!past.length;document.querySelector('[data-hm="redo"]').disabled=!!drawing||!future.length;
  if(!store.loaded)panel.innerHTML=`<div class="hm-empty"><h2>${store.error?'GitHub 项目暂未打开':'正在读取 GitHub 地图'}</h2><p>${store.error?escape(store.error.message):'项目文件从 GitHub 加载；本页面不自动保存地图到浏览器或磁盘。'}</p><button class="hm-primary" data-hm="reload">重新读取 GitHub</button><button data-hm="storage">连接 / 管理项目</button></div>`;
  else if(drawing)panel.innerHTML=`<div class="hm-draw-summary"><span class="hm-type-swatch" style="--swatch:${KINDS[drawing.kind].fill}"></span><h2>正在绘制${KINDS[drawing.kind].name}</h2><p>已放置 ${drawing.coordinates.length} 个点</p><p>单击逐点绘制，双击或 Enter 完成。<br>Backspace 撤回一点，Esc 取消。${KINDS[drawing.kind].geometry==='Polygon'?'<br>也可点击起点闭合区域。':''}</p>${KINDS[drawing.kind].geometry!=='Point'?cornerControl(drawing.cornerRadius,'drawing'):''}<button class="hm-primary" data-hm="finish">完成绘制</button><button data-hm="cancel">取消本次绘制</button></div>`;
  else if(item())panel.innerHTML=viewer?viewerInspector(item()):inspector(item());
  else if(tab==='draw')panel.innerHTML=`<button class="hm-primary hm-preset-open" data-hm="presets">搜索 OSM 要素类型</button><p class="hm-caption">${drawPreset?escape(drawPreset.name):"常用类型"} · ${presetCount()} 种 iD 预设</p>${KINDS[kind].geometry!=='Point'?cornerControl(KINDS[kind].geometry==='LineString'?+prefs.lineRadius:+prefs.areaRadius,'new'):''}<div class="hm-kind-groups">${[...new Set(Object.values(KINDS).map(v=>v.group))].map(group=>`<section><h3>${group}</h3><div>${Object.entries(KINDS).filter(([,v])=>v.group===group).map(([k,v])=>`<button class="hm-kind" data-kind="${k}" aria-pressed="${kind===k}"><i class="${v.geometry==='Polygon'?'area':v.geometry==='Point'?'point':'line'}" style="--swatch:${v.fill};--stroke:${v.stroke}"></i>${v.name}</button>`).join('')}</div></section>`).join('')}</div><button class="hm-primary hm-start" data-hm="start">绘制${escape(drawPreset?.name||KINDS[kind].name)}</button><p class="hm-help">开启右上角“现实地图”对照着画；关闭后查看自己的地图。建筑和区域会自动闭合。</p>`;
  else if(tab==='list')panel.innerHTML=project.features.length?`<div class="hm-feature-list">${project.features.slice().reverse().map(f=>`<div><button data-feature="${escape(f.id)}"><i style="--swatch:${KINDS[f.properties.kind].fill}"></i><span>${escape(f.properties.name||featureLabel(f))}<small>${featureLabel(f)}</small></span></button><button class="hm-visible" data-visible="${escape(f.id)}" aria-label="${f.properties.visible?'隐藏':'显示'}要素">${f.properties.visible?'显示中':'已隐藏'}</button></div>`).join('')}</div>`:'<div class="hm-empty"><h2>从一条街道开始</h2><p>你画的道路、河流、建筑和地名都会列在这里。</p><button data-hm="draw-tab">开始绘制</button></div>';
  else panel.innerHTML=`<h2>参照与绘图</h2><label class="hm-check"><input id="hm-linked" type="checkbox" ${linkedNodes?'checked':''}>移动时联动共用节点</label><label class="hm-check"><input id="hm-snap" type="checkbox" ${prefs.snap?'checked':''}>吸附到自己画的节点</label><p class="hm-help">邻近节点自动对齐，便于连接街道和共用区域边界。</p><button data-hm="reference">${prefs.reference?'关闭':'显示'}现实地图</button><p class="hm-help">可在顶部调节参照透明度，或按住空格临时查看。参照关闭后，保留真实水陆与自然植被。</p><div class="hm-note"><strong>OSM 式样即时试绘</strong><p>道路宽度、描边、水系与标注按 OpenStreetMap Carto 规则适配。当前仍由浏览器渲染，未接入原版 Mapnik；关闭现实参照查看自绘成图。</p></div><p class="hm-help">自然水陆来自当前地图。需要修改旧时岸线时，可画“水面”补水，或画“陆地 / 填水区域”覆盖现有水面。</p><button data-hm="storage">管理 GitHub 云端项目</button><button data-hm="export">导出项目 / GeoJSON</button>`;
  const bar=$('#hm-drawing');bar.hidden=!drawing;if(drawing)bar.innerHTML=`<strong>${KINDS[drawing.kind].name} · ${drawing.coordinates.length} 个点</strong><span>单击落点 · Enter 完成 · Esc 取消</span><button data-hm="finish">完成</button><button data-hm="cancel">取消</button>`;
  storageStatus();
 }
 function inspector(f){const a=f.properties,type=f.geometry.type;return `<button class="hm-back" data-hm="back">全部要素</button><h2>${escape(a.name||featureLabel(f))}</h2><label class="hm-field">名称<input data-property="name" maxlength="160" value="${escape(a.name)}" placeholder="可留空"></label><label class="hm-field">类型<select data-property="kind">${Object.entries(KINDS).filter(([,v])=>v.geometry===type).map(([k,v])=>`<option value="${k}" ${a.kind===k?'selected':''}>${v.name}</option>`).join('')}</select></label><button class="hm-preset-open" data-hm="presets">更换 OSM 要素预设 · ${escape(featureLabel(f))}</button>${type!=='Point'?cornerControl(a.cornerRadius||0,'feature'):''}${type==='LineString'?`<label class="hm-field">线宽比例<input type="number" data-property="widthScale" min="0.25" max="5" step="0.25" value="${a.widthScale}"></label><label class="hm-check"><input type="checkbox" data-property="bridge" ${a.bridge?'checked':''}>桥梁</label><label class="hm-check"><input type="checkbox" data-property="tunnel" ${a.tunnel?'checked':''}>隧道</label>`:''}${fieldsHTML(f)}${tagsHTML(f)}<label class="hm-field">说明<textarea data-property="notes" maxlength="2000">${escape(a.notes)}</textarea></label>${type==='LineString'?'<button data-hm="split">在线节点处切分</button>':''}<button class="hm-primary" data-hm="nodes">${editing?'完成节点编辑':type==='Point'?'移动位置':'编辑节点'}</button><p class="hm-help">${editing?'拖动蓝色节点调整位置；点击小圆点插入节点，右键顶点删除。':'地图上点击要素即可选中。'}所有修改支持撤销。</p><div class="hm-actions"><button data-hm="duplicate">复制</button><button class="hm-danger" data-hm="delete">删除要素</button></div>`;}
 function draw(draftOnly=false){
  if(!readyMap)return;
  if(!draftOnly){updateFeatures();}
  const features=[];if(drawing){const type=KINDS[drawing.kind].geometry,path=[...drawing.coordinates];if(hover&&type!=='Point')path.push(hover);
   if(type==='Polygon'&&path.length>=3)features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...path,path[0]]]}});
   else if(path.length>=2)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:path}});
   drawing.coordinates.forEach(c=>features.push({type:'Feature',properties:{},geometry:{type:'Point',coordinates:c}}));
  }map.getSource('draft').setData(collection(features.map(f=>roundedFeature({...f,properties:{...f.properties,cornerRadius:drawing?.cornerRadius||0}},lineNodes))));
  if(draftOnly)return;
  snapCache=[];for(const f of project.features){if(f.properties.visible===false)continue;const paths=f.geometry.type==='Point'?[[f.geometry.coordinates]]:editPaths(f);for(const path of paths)snapCache.push(...path);}if(snapCache.length>10000)snapCache=snapCache.filter(c=>map.getBounds().contains(c));
  renderMarkers();
 }
 function renderMarkers(){
  clearMarkers();const f=item();if(!editing||!f||f.properties.visible===false)return;
  const paths=f.geometry.type==='Point'?[[f.geometry.coordinates]]:editPaths(f);if(paths.reduce((n,p)=>n+p.length,0)>600){notify('此要素节点超过 600 个，先分段绘制会更流畅。');editing=false;render();return;}
  for(const [ring,path] of paths.entries())for(let i=0;i<path.length-(f.geometry.type==='Polygon'?1:0);i++){
   const el=document.createElement('button');el.className='hm-vertex';el.setAttribute('aria-label','移动顶点 '+(i+1));el.title='拖动移动 · 右键删除';el.addEventListener('click',e=>{e.stopPropagation();if(splitMode){if(commit(()=>splitLine(project,f.id,i))){splitMode=false;editing=false;render();draw();notify('已切分为两个独立线段。');}}});
   el.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();if(f.geometry.type==='Point')return;commit(()=>removeVertex(f,ring,i));});
   let before;const marker=new maplibregl.Marker({element:el,draggable:true}).setLngLat(path[i]).addTo(map);markers.push(marker);
   marker.on('dragstart',()=>{before=snapshot();});marker.on('drag',()=>{const c=marker.getLngLat();(linkedNodes?moveSharedVertex(project,f.id,ring,i,canonical(c.lng,c.lat)):moveVertex(f,ring,i,canonical(c.lng,c.lat)));updateFeatures();});marker.on('dragend',()=>commit(()=>{},before));
   if(f.geometry.type!=='Point'&&i<path.length-1){const at=[(path[i][0]+path[i+1][0])/2,(path[i][1]+path[i+1][1])/2],dot=document.createElement('button');dot.className='hm-midpoint';dot.setAttribute('aria-label','插入节点');dot.addEventListener('click',e=>{e.stopPropagation();commit(()=>path.splice(i+1,0,at));});markers.push(new maplibregl.Marker({element:dot}).setLngLat(at).addTo(map));}
  }
 }
 function updateReference(){if(readyMap)setReferenceLayers(map,prefs);$('#hm-reference').setAttribute('aria-pressed',String(!!prefs.reference));$('#hm-reference').textContent=prefs.reference?'现实地图已显示':'显示现实地图';$('#hm-reference-controls').hidden=!prefs.reference;$('#hm-reference-type').value=prefs.referenceType;$('#hm-opacity').value=prefs.opacity*100;savePrefs();}
 function showDialog(title,html){dialog.innerHTML=`<div class="hm-dialog-head"><h2 id="hm-dialog-title">${title}</h2><button data-close aria-label="关闭">关闭</button></div>${html}`;dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.showModal();}
 function locate(){showDialog('定位到真实地点',`<div class="hm-cities">${Object.keys(cities).map(c=>`<button data-city="${c}">${c}</button>`).join('')}</div><form id="hm-locate-form"><label class="hm-field">经度、纬度或 OSM 链接<input name="position" placeholder="121.504347,25.042240" required></label><button class="hm-primary">定位</button><p class="hm-help" id="hm-location-error"></p></form>`);dialog.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{map.jumpTo({center:cities[b.dataset.city],zoom:15});dialog.close();});dialog.querySelector('form').onsubmit=e=>{e.preventDefault();try{map.jumpTo(parseLocation(dialog.querySelector('[name=position]').value));dialog.close();}catch(e){dialog.querySelector('#hm-location-error').textContent=e.message;}};}
 const filename=()=>project.title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'-')+'.history-map.json';
 function download(text,type,name){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function fileError(e){if(e.name!=='AbortError')notify(e.message||'文件操作未完成');storageStatus();}
 async function flush(){await store.flush();if(store.dirty)throw new Error('当前修改尚未保存，请先重试或另存文件。');}
 function adopt(p,{position=true}={}){project=p;selected=null;editing=false;past.length=0;future.length=0;render();draw();if(position){if(readyMap)positionProject();else pendingFit=true;}}
 function setProjectURL(){try{const u=new URL(location.href);u.searchParams.set('project',store.name);history.replaceState(null,'',u.pathname+u.search+u.hash);}catch{}}
 async function openFile(){if(drawing)return notify('请先完成或取消绘制。');showProjects();}
 async function cloudSave(){if(!store.connected||store.writeBlocked)return showStorage();try{await flush();notify('已保存到 GitHub：'+store.name);}catch(e){fileError(e);if(['PERMISSION','AUTH','RULES'].includes(e.code))showStorage();}}
 async function reloadCloud(){if(drawing)return notify('请先完成或取消绘制。');if(store.dirty&&!window.confirm('当前修改尚未提交。重新读取会放弃当前页面的修改，是否继续？'))return;try{if(store.dirty){store.pending=null;store.dirty=false;}adopt(await store.load());setProjectURL();notify('已读取 GitHub 最新版本');}catch(e){fileError(e);render();}}
 async function saveAs(value=project,onSaved=()=>{}){if(value!==project&&store.dirty)return notify('请先保存或另存当前修改，再新建空白项目。');if(drawing)return notify('请先完成绘制。');if(!store.connected)return showStorage();showDialog('另存到 GitHub',`<p class="hm-help">在 map-data 分支创建独立项目，原项目保持原样。</p><form id="hm-cloud-new"><label class="hm-field">文件名<input name="slug" value="map-${Date.now()}" pattern="[-a-zA-Z0-9_]{1,100}" required></label><p class="hm-help">使用字母、数字或横线，系统自动添加 .history-map.json。</p><button class="hm-primary">创建 GitHub 项目</button><p class="hm-error" id="hm-new-error"></p></form>`);dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const slug=e.target.elements?.slug?.value||e.target.querySelector('[name=slug]').value;adopt(await store.create(slug+'.history-map.json',value));onSaved();setProjectURL();dialog.close();notify('已创建并确认 GitHub 项目');}catch(err){dialog.querySelector('#hm-new-error').textContent=err.message;}finally{button.disabled=false;}};}
 async function migrateLegacy(){if(!store.connected)return showStorage();try{const p=normalizeHistory(JSON.parse(rawBackup));await saveAs(p,()=>{try{localStorage.removeItem(keys.project);}catch{}rawBackup='';});}catch(e){fileError(e);}}
 function showStorage(){
  const c=store.config||GITHUB_PROJECT;
  const errorText=e=>e?[e.message,e.status?`HTTP ${e.status} · ${e.method||'请求'}${e.requestId?' · 请求编号 '+e.requestId:''}`:'',e.detail?'GitHub 返回：'+e.detail:'',e.retryAt?'可重试时间：'+new Date(e.retryAt).toLocaleTimeString():''].filter(Boolean).join('\n'):'';
  showDialog('GitHub 云端项目',`<p class="hm-help">仓库：<a href="https://github.com/${c.owner}/${c.repo}" target="_blank" rel="noopener">${c.owner}/${c.repo}</a><br>分支：${c.branch} · 文件：${escape(store.name)}<br>网页公开浏览；只有仓库所有者连接授权后可以保存修改。</p><p class="hm-error" id="hm-cloud-error" style="white-space:pre-line">${escape(errorText(store.error))}</p>${store.connected&&!store.writeBlocked?'<button class="hm-primary" data-cloud="save">立即保存到 GitHub</button>':''}<form id="hm-github-connect"><label class="hm-field">${store.connected?'更换 GitHub 仓库访问令牌':'GitHub 仓库访问令牌'}<input name="token" type="password" autocomplete="off" spellcheck="false" required placeholder="仅在此页面会话中使用"></label><button class="hm-primary">${store.dirty?'更换授权并保存待提交修改':store.connected?'更新编辑授权':'连接 GitHub 编辑'}</button><p class="hm-help">在 <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">GitHub 细粒度令牌设置</a>中，Resource owner 选择 ${c.owner}；Repository access 选择 Only select repositories 并勾选 ${c.repo}；Repository permissions 中的 Contents 设为 Read and write。连接验证账号身份，写入权限在首次保存时确认。更换授权会保留当前修改。令牌只向 GitHub API 发送，不写入项目、浏览器存储或网址。</p></form><div class="hm-cloud-actions"><button data-cloud="reload">重新读取最新版本</button><button data-cloud="new">当前地图另存为新项目</button><button data-cloud="blank">新建空白项目</button><button data-cloud="import">从旧 JSON / GeoJSON 搬入</button>${rawBackup?'<button data-cloud="migrate">搬入此浏览器原有地图</button>':''}${store.connected?'<button data-cloud="disconnect">断开编辑授权</button>':''}</div><label class="hm-field">切换 GitHub 项目<select id="hm-cloud-projects"><option value="">正在读取项目列表…</option></select></label><p class="hm-help">自动提交约延迟 20 秒；关闭页面前可点击“保存到 GitHub”。尚未提交的修改仅在当前页面内存中。<br>GitHub Pages：<a href="${GITHUB_SITE}" target="_blank" rel="noopener">打开公开地圖站</a></p>`);
  const form=dialog.querySelector('#hm-github-connect');form.onsubmit=async e=>{e.preventDefault();const input=form.querySelector('input'),button=form.querySelector('button');let token=input.value;input.value='';button.disabled=true;try{await store.connect(token);token='';if(!store.loaded)adopt(await store.load());const pending=store.dirty;if(pending)await flush();dialog.close();render();draw();notify(pending?'待提交修改已保存到 GitHub':'GitHub 账号已验证；首次保存时确认写入权限');}catch(err){token='';dialog.querySelector('#hm-cloud-error').textContent=errorText(err);}finally{button.disabled=false;}};
  const select=dialog.querySelector('#hm-cloud-projects');store.list().then(files=>{if(!select.isConnected)return;select.innerHTML=files.map(f=>`<option value="${escape(f.name)}" ${f.name===store.name?'selected':''}>${escape(f.name)}</option>`).join('');}).catch(e=>{if(select.isConnected)select.innerHTML='<option>暂时无法读取列表</option>';});
  select.onchange=async()=>{const path=select.value;if(!path||path===store.name)return;if(store.dirty)return notify('请先保存或另存当前修改，再切换项目。');try{adopt(await store.load(path));setProjectURL();dialog.close();}catch(e){fileError(e);}};
  dialog.querySelectorAll('[data-cloud]').forEach(button=>button.onclick=async()=>{const action=button.dataset.cloud;if(action==='save'){await cloudSave();storageStatus();return;}if(action==='reload'){dialog.close();return reloadCloud();}if(action==='new')return saveAs();if(action==='blank')return saveAs(emptyHistory('新历史地图'));if(action==='import'){if(!store.connected)return notify('请先连接 GitHub，再搬入地图。');dialog.close();$('#hm-open-fallback').click();return;}if(action==='migrate')return migrateLegacy();if(action==='disconnect'){try{store.disconnect();showStorage();}catch(e){fileError(e);}}});
 }
 function exportDialog(){if(drawing)return notify('请先完成绘制。');if(!store.loaded)return notify('请先打开地图项目。');showDialog('导出自绘地图',`<p class="hm-help">导出自己的要素。在线现实参照和自然底图不打包进项目。</p><button class="hm-primary" data-export="json">项目 JSON · 可继续编辑</button><button data-export="geojson">GeoJSON · 可供 GIS 软件使用</button>`);dialog.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{const geo=b.dataset.export==='geojson';download(JSON.stringify(geo?historyGeoJSON(project):project,null,2),geo?'application/geo+json':'application/json',geo?filename().replace('.history-map.json','.geojson'):filename());dialog.close();});}
 $('#hm-open-fallback').addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>30*1024*1024)throw new Error('文件超过 30 MB，请按地区分开。');await saveAs(normalizeHistory(JSON.parse(await f.text())));}catch(e){fileError(e);}});
 function fitAll(){const points=project.features.filter(f=>f.properties.visible!==false).flatMap(f=>f.geometry.type==='Point'?[f.geometry.coordinates]:editPaths(f).flat());if(!points.length)return notify('还没有自绘要素。');const bounds=points.reduce((b,c)=>[[Math.min(b[0][0],c[0]),Math.min(b[0][1],c[1])],[Math.max(b[1][0],c[0]),Math.max(b[1][1],c[1])]],[[180,90],[-180,-90]]);map.fitBounds(bounds,{padding:{left:viewer?50:innerWidth>720?360:50,right:70,top:110,bottom:viewer?70:innerWidth>720?70:300},maxZoom:18});}
 const actions={presets:showPresets,share:shareDialog,'view-mode':toggleMode,'add-tag':addTag,split:()=>{if(!ensureReady())return;splitMode=true;editing=true;render();renderMarkers();notify('点击线中间的节点进行切分。');},'cloud-save':cloudSave,reload:reloadCloud,reference:()=>{prefs.reference=!prefs.reference;updateReference();if(tab==='view')render();},locate,storage:showStorage,export:exportDialog,start:startDrawing,finish,cancel:stopDrawing,undo,redo,fit:fitAll,'draw-tab':()=>{tab='draw';selected=null;render();},select:()=>{if(drawing)stopDrawing();editing=false;selected=null;render();draw();},back:()=>{selected=null;editing=false;tab='list';render();draw();},nodes:()=>{if(!ensureReady())return;splitMode=false;editing=!editing;render();renderMarkers();},duplicate:()=>{const f=item();if(!f)return;const copy=makeFeature(f.properties.kind,f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates,f.properties.name+'（副本）');copy.geometry=clone(f.geometry);copy.properties=clone(f.properties);copy.properties.name=(f.properties.name||featureLabel(f))+'（副本）';if(copy.properties.tags)copy.properties.tags.name=copy.properties.name;if(commit(p=>p.features.push(copy))){selected=copy.id;render();draw();}},delete:()=>{if(!item()||!ensureReady())return;const target=selected;commit(p=>p.features=p.features.filter(f=>f.id!==target));},home:openFile};
 document.addEventListener('click',e=>{const radius=e.target.closest('[data-corner-radius]');if(radius){setCornerRadius(radius.dataset.cornerRadius,radius.dataset.cornerScope);return;}const b=e.target.closest('[data-hm]');if(b&&!b.disabled){actions[b.dataset.hm]?.();return;}const k=e.target.closest('[data-kind]');if(k){kind=k.dataset.kind;drawPreset=null;render();return;}const t=e.target.closest('[data-hm-tab]');if(t){if(drawing)return notify('请先完成或取消绘制。');tab=t.dataset.hmTab;selected=null;editing=false;render();draw();return;}const f=e.target.closest('[data-feature]');if(f){selected=f.dataset.feature;editing=false;render();draw();return;}const v=e.target.closest('[data-visible]');if(v){commit(p=>{const f=p.features.find(f=>f.id===v.dataset.visible);f.properties.visible=!f.properties.visible;});}});
 panel.addEventListener('change',e=>{if(e.target.dataset.osmTag){setTag(e.target.dataset.osmTag,e.target.value);return;}if(e.target.hasAttribute('data-corner-input')){setCornerRadius(e.target.value,e.target.dataset.cornerScope);return;}if(e.target.id==='hm-linked'){linkedNodes=e.target.checked;return;}if(e.target.id==='hm-snap'){prefs.snap=e.target.checked;savePrefs();return;}const key=e.target.dataset.property,f=item();if(!key||!f)return;const value=e.target.type==='checkbox'?e.target.checked:key==='widthScale'?Number(e.target.value):e.target.value;commit(()=>{f.properties[key]=value;if(key==='bridge'&&value)f.properties.tunnel=false;if(key==='tunnel'&&value)f.properties.bridge=false;if(key==='kind'&&!f.properties.tags)f.properties.tags={...(LEGACY_TAGS[value]||{}),...(f.properties.name?{name:f.properties.name}:{})};if(f.properties.tags){if(key==='name'){if(value)f.properties.tags.name=value;else delete f.properties.tags.name;}if(key==='bridge'||key==='tunnel'){if(value)f.properties.tags[key]='yes';else delete f.properties.tags[key];if(value)delete f.properties.tags[key==='bridge'?'tunnel':'bridge'];}if(key==='kind'){const old=effectiveTags(f);for(const k of ['highway','waterway','natural','landuse','leisure','amenity','shop','tourism','office','railway','historic','barrier','boundary','place','building'])delete old[k];Object.assign(old,LEGACY_TAGS[value]);f.properties.tags=old;delete f.properties.presetId;}}});});
 $('#hm-title').onchange=e=>commit(p=>p.title=e.target.value||'我的历史地图');$('#hm-year').onchange=e=>commit(p=>p.year=e.target.value);
 $('#hm-reference-type').onchange=e=>{prefs.referenceType=e.target.value;updateReference();};$('#hm-opacity').oninput=e=>{prefs.opacity=Number(e.target.value)/100;updateReference();};
 function initialize(){if(readyMap)return;readyMap=true;document.getElementById('loading').hidden=true;updateReference();draw();if(pendingFit){pendingFit=false;positionProject();}}
 map.on('style.load',initialize);map.on('load',initialize);
 map.on('sourcedata',e=>{if(e.sourceId==='nature'&&e.isSourceLoaded)$('#hm-status').textContent='真实水陆底层 · 自绘内容独立保存';});
 map.on('error',e=>{if(['nature','reference','satellite'].includes(e.sourceId))$('#hm-status').textContent=e.sourceId==='nature'?'自然底层加载失败，可开启现实地图继续对照':'现实参照加载失败，可切换标准地图 / 卫星影像';});
 map.on('click',e=>{
  if(drawing&&!ensureReady())return;
  if(drawing){if(e.originalEvent?.detail>1)return;const at=snap(canonical(e.lngLat.lng,e.lngLat.lat));if(KINDS[drawing.kind].geometry==='Point'){const f=draftFeature(at);if(commit(p=>p.features.push(f))){selected=f.id;stopDrawing();render();draw();}return;}
   if(KINDS[drawing.kind].geometry==='Polygon'&&drawing.coordinates.length>=3){const a=map.project(drawing.coordinates[0]),b=map.project(at);if(Math.hypot(a.x-b.x,a.y-b.y)<10){finish();return;}}
   if(!equal(drawing.coordinates.at(-1),at))drawing.coordinates.push(at);render();draw();return;
  }
  const found=map.queryRenderedFeatures(e.point,{layers:pickLayers});selected=found[0]?.properties?.fid||null;editing=false;render();draw();
 });
 map.on('dblclick',e=>{if(drawing){e.preventDefault?.();finish();}});
 map.on('mousemove',e=>{if(!drawing||Date.now()-lastMove<30)return;lastMove=Date.now();hover=snap(canonical(e.lngLat.lng,e.lngLat.lat));draw(true);});
 map.on('moveend',()=>{const c=map.getCenter();prefs.view={center:[c.lng,c.lat],zoom:map.getZoom()};savePrefs();try{const u=new URL(location.href);u.hash=`${map.getZoom().toFixed(2)}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`;history.replaceState(null,'',u.pathname+u.search+u.hash);}catch{}});
 const inputTarget=e=>!!e.target.closest('input,textarea,select,[contenteditable]');
 document.addEventListener('keydown',e=>{if(dialog.open||inputTarget(e))return;if(e.code==='Space'&&!e.repeat){e.preventDefault();spaceReference=prefs.reference;prefs.reference=true;updateReference();return;}if(e.key==='Escape'){if(drawing)stopDrawing();else{editing=false;selected=null;render();draw();}return;}if(e.key==='Enter'&&drawing){e.preventDefault();finish();return;}if((e.key==='Backspace'||e.key==='Delete')&&drawing){e.preventDefault();undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(ensureReady())flush().then(()=>notify('项目已保存')).catch(fileError);return;}if(e.key.toLowerCase()==='v'&&!e.ctrlKey&&!e.metaKey){actions.select();return;}if(e.key==='Delete'&&selected){e.preventDefault();actions.delete();}});
 function releaseSpace(){if(spaceReference===null)return;prefs.reference=spaceReference;spaceReference=null;updateReference();}
 document.addEventListener('keyup',e=>{if(e.code==='Space')releaseSpace();});window.addEventListener('blur',releaseSpace);
 window.addEventListener('beforeunload',e=>{if(!closed&&(drawing?.coordinates.length||store.dirty||store.saving)){e.preventDefault();e.returnValue='';}});

 function draftFeature(coordinates){
  const f=makeFeature(drawing.kind,coordinates);f.properties.tags=effectiveTags(f);
  if(drawing.preset){f.properties.tags=presetTags(drawing.preset);f.properties.presetId=drawing.preset.id;}
  return f;
 }
 function positionProject(){
  const v=project.view;if(v&&coordinateOK(v.center)&&Number.isFinite(v.zoom)){map.jumpTo(v);return;}
  if(project.features.length)fitAll();
 }
 function toggleMode(){
  if(store.dirty||drawing)return notify('请先保存修改并完成绘制，再切换模式。');
  const u=new URL(location.href);u.searchParams.set('project',store.name);u.searchParams.set('mode',viewer?'edit':'view');location.assign(u.href);
 }
 function shareDialog(){
  const u=new URL(GITHUB_SITE),c=map.getCenter();u.searchParams.set('project',store.name);u.searchParams.set('mode','view');u.hash=map.getZoom().toFixed(2)+'/'+c.lat.toFixed(5)+'/'+c.lng.toFixed(5);
  showDialog('分享地图', '<p class="hm-help">访客无需账号即可浏览最后一次保存的地图。链接包含当前项目和位置。</p>'+(store.dirty?'<p class="hm-error">有修改尚未保存，分享前请先保存。</p>':'')+'<label class="hm-field">公开浏览链接<input id="hm-share-link" readonly value="'+escape(u.href)+'"></label><button id="hm-copy-share" class="hm-primary">复制链接</button><p id="hm-share-status" class="hm-help"></p>');
  dialog.querySelector('#hm-copy-share').onclick=async()=>{try{await navigator.clipboard.writeText(u.href);dialog.querySelector('#hm-share-status').textContent='链接已复制。';}catch{const input=dialog.querySelector('#hm-share-link');input.focus();input.select?.();dialog.querySelector('#hm-share-status').textContent='请复制上方已选中的链接。';}};
 }
 async function showProjects(){
  showDialog('地图项目','<p class="hm-help">每个项目分别保存。选择一个项目开始浏览或编辑。</p><div id="hm-project-list">正在读取项目…</div>'+(viewer?'':'<div class="hm-actions"><button data-project-action="blank">新建地图</button><button data-project-action="copy">当前地图另存</button><button data-project-action="auth">编辑授权</button></div>'));
  dialog.querySelectorAll('[data-project-action]').forEach(b=>b.onclick=()=>{if(b.dataset.projectAction==='auth')return showStorage();if(!store.connected)return showStorage();saveAs(b.dataset.projectAction==='blank'?emptyHistory('新历史地图'):project);});
  try{
   const files=await store.list(),list=dialog.querySelector('#hm-project-list');if(!list)return;
   list.innerHTML=files.map(f=>'<button class="hm-project-card" data-open-project="'+escape(f.name)+'"><strong>'+escape(f.name===store.name?project.title:f.name.replace('.history-map.json',''))+'</strong><small>'+escape(f.name)+(f.name===store.name?' · 当前项目':'')+'</small></button>').join('')||'<p>还没有地图项目。</p>';
   list.querySelectorAll('[data-open-project]').forEach(b=>b.onclick=async()=>{if(store.dirty)return notify('请先保存或另存当前修改，再切换。');try{adopt(await store.load(b.dataset.openProject));setProjectURL();dialog.close();}catch(e){notify(e.message);}});
  }catch(e){const list=dialog.querySelector('#hm-project-list');if(list)list.textContent=e.message;}
 }
 function setTag(key,value){
  const f=item();if(!f)return;
  commit(()=>{f.properties.tags=effectiveTags(f);if(value!=='')f.properties.tags[key]=String(value);else delete f.properties.tags[key];if(key==='name')f.properties.name=value;delete f.properties.presetId;});
 }
 function addTag(){const k=panel.querySelector('#hm-tag-key')?.value.trim(),v=panel.querySelector('#hm-tag-value')?.value;if(!k||!v)return notify('请填写标签的键和值。');setTag(k,v);}
 function showPresets(){
  if(viewer)return; if(drawing)return notify('请先完成当前绘制。');presetTarget=item()?.id||null;
  showDialog(presetTarget?'更换要素预设':'选择 OSM 要素',presetPickerHTML(item()?.geometry.type));
 }
 function usePreset(id,type){
  const p=getPreset(id);if(!p)return;
  if(presetTarget){const f=item();if(!f||f.id!==presetTarget)return;commit(()=>{f.properties.tags=effectiveTags(f);applyChosen(f,p,id);});dialog.close();return;}
  if(!type){
   const types=p.geometry.map(g=>({point:'Point',line:'LineString',area:'Polygon'}[g])).filter(Boolean);
   if(types.length===1)return usePreset(id,types[0]);
   showDialog('绘制'+p.name,'<p class="hm-help">选择这个要素的表达方式。</p>'+types.map(t=>'<button data-preset-geometry="'+t+'" data-preset-id="'+escape(id)+'">'+({Point:'标一个点',LineString:'画一条线',Polygon:'画范围'}[t])+'</button>').join(''));return;
  }
  drawPreset={id,...p};kind=kindFromTags(presetTags(p),type);dialog.close();tab='draw';selected=null;render();notify('已选择'+p.name+'，点击绘制开始。');
 }
 function applyChosen(f,p,id){const tags=f.properties.tags;for(const k of ['highway','waterway','natural','landuse','leisure','amenity','shop','tourism','office','railway','public_transport','historic','barrier','boundary','place','building'])delete tags[k];Object.assign(tags,presetTags(p));f.properties.presetId=id;}
 document.addEventListener('input',e=>{if(e.target.id==='hm-preset-search'){const target=dialog.querySelector('#hm-preset-results');if(target)target.innerHTML=presetResults(e.target.value,target.dataset.geometry||undefined);}});
 document.addEventListener('click',e=>{const p=e.target.closest('[data-preset]');if(p)return usePreset(p.dataset.preset);const g=e.target.closest('[data-preset-geometry]');if(g)return usePreset(g.dataset.presetId,g.dataset.presetGeometry);const remove=e.target.closest('[data-remove-tag]');if(remove)setTag(remove.dataset.removeTag,'');});
 loadPresets().then(()=>{if(!drawing&&!selected&&tab==='draw')render();}).catch(()=>{});

 render();updateReference();store.load().then(p=>{if(p){adopt(p,{position:!initialHash});setProjectURL();}render();storageStatus();}).catch(()=>{render();storageStatus();});
 return {map,get project(){return project;},store};
}
