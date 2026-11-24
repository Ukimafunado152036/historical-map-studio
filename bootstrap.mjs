import {mountHistoryEditor} from './history-editor.mjs';
try{
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='maplibre-gl.js';script.integrity='sha384-81ppUWZZO+pveTPk4qU9cZuScEFULHfuOMHVJHFZ7xVBlWQTG1zsPrVIMGAl1WMb';script.crossOrigin='anonymous';script.onload=resolve;script.onerror=()=>reject(new Error('地图引擎下载失败，请重试。'));document.head.append(script);});
 mountHistoryEditor({id:'personal',name:'我的历史地图',view:{center:[120.1551,30.2741]}});
}catch(error){const loading=document.getElementById('loading');loading.hidden=false;loading.textContent='地图未能启动：'+error.message;console.error(error);}
