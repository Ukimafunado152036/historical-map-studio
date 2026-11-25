import {KINDS} from './history-model.mjs';
import {effectiveTags} from './feature-catalog.mjs';
import {getPreset,matchingPreset,presetFields,presetCount,searchPresets} from './osm-presets.mjs';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHTML;
export function featurePreset(f){return getPreset(f.properties.presetId)||matchingPreset(effectiveTags(f),f.geometry.type);}
export function featureLabel(f){return featurePreset(f)?.name||KINDS[f.properties.kind].name;}
export function presetResults(query,geometry){
 const items=searchPresets(query,geometry,60);
 return items.length?items.map(p=>'<button class="hm-preset-result" data-preset="'+e(p.id)+'"><strong>'+e(p.name)+'</strong><small>'+e(Object.entries(p.tags).map(([k,v])=>k+'='+v).join(' · '))+'</small></button>').join(''):'<p class="hm-help">没有找到匹配项。可用英文标签搜索，或选择其他要素后自行添加标签。</p>';
}
export function presetPickerHTML(geometry){
 return '<p class="hm-help">来自 iD 的 '+presetCount()+' 种点、线、面预设。按中文名称或 OSM 标签搜索。</p><label class="hm-field">搜索要素<input id="hm-preset-search" placeholder="如：寺庙、学校、沟渠、shop=…" autocomplete="off"></label><div id="hm-preset-results" data-geometry="'+e(geometry||'')+'">'+presetResults('',geometry)+'</div><p class="hm-help">来源：<a href="https://github.com/openstreetmap/id-tagging-schema" target="_blank" rel="noopener">iD Tagging Schema · ISC</a>。关系类型暂不在此列表。</p>';
}
const commonLabels={ref:'编号',surface:'路面',width:'实际宽度（米）',lanes:'车道数',oneway:'单行',bridge:'桥梁',tunnel:'隧道',layer:'上下层级',operator:'运营机构',religion:'宗教',denomination:'教派',building:'建筑类型',water:'水面类型',intermittent:'季节性',access:'通行权限',usage:'用途',admin_level:'行政等级'};
export function fieldsHTML(f){
 const tags=effectiveTags(f),p=featurePreset(f),all=presetFields(p,f.geometry.type);
 const common=f.geometry.type==='LineString'?['ref','surface','width','lanes','oneway','layer']:['operator','religion','building','water','admin_level'];
 for(const key of common)if(!all.some(v=>v.key===key))all.push({key,label:commonLabels[key]});
 const fields=all.filter(v=>!['bridge','tunnel'].includes(v.key)).slice(0,35);
 return '<section class="hm-osm-fields"><h3>要素属性</h3>'+fields.map((v,i)=>{
  const options=Array.isArray(v.options)?v.options:[];
  return '<label class="hm-field">'+e(v.label||commonLabels[v.key]||v.key)+'<small class="hm-tag-key">'+e(v.key)+'</small><input data-osm-tag="'+e(v.key)+'" maxlength="255" value="'+e(tags[v.key]||'')+'"'+(options.length?' list="hm-options-'+i+'"':'')+' placeholder="未知可留空">'+(options.length?'<datalist id="hm-options-'+i+'">'+options.map(o=>'<option value="'+e(o)+'">'+e(v.optionLabels?.[o]||o)+'</option>').join('')+'</datalist>':'')+'</label>';
 }).join('')+'</section>';
}
export function tagsHTML(f,readonly=false){
 const tags=effectiveTags(f),rows=Object.entries(tags);
 if(readonly)return '<dl class="hm-read-tags">'+rows.map(([k,v])=>'<dt>'+e(k)+'</dt><dd>'+e(v)+'</dd>').join('')+'</dl>';
 return '<details class="hm-tags"><summary>全部标签 · '+rows.length+'</summary><p class="hm-help">标签与属性表同步保存。空值会移除；未知标签会保留。</p><div>'+rows.map(([k,v])=>'<div class="hm-tag-row"><label>'+e(k)+'<input data-osm-tag="'+e(k)+'" value="'+e(v)+'" maxlength="255" aria-label="'+e(k)+'"></label><button data-remove-tag="'+e(k)+'" title="移除此标签" aria-label="移除 '+e(k)+'">移除</button></div>').join('')+'</div><div class="hm-tag-add"><input id="hm-tag-key" maxlength="255" placeholder="键，如 name:zh" aria-label="新标签键"><input id="hm-tag-value" maxlength="255" placeholder="值" aria-label="新标签值"><button data-hm="add-tag">添加标签</button></div></details>';
}
export function viewerInspector(f){
 return '<button class="hm-back" data-hm="back">关闭详情</button><h2>'+e(f.properties.name||featureLabel(f))+'</h2><p>'+e(featureLabel(f))+'</p>'+tagsHTML(f,true)+(f.properties.notes?'<p>'+e(f.properties.notes)+'</p>':'');
}
