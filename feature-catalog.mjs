// Display families are separate from OSM's extensible tags and iD presets.
const rows=[
 ['unclassified','普通连接道路','道路','LineString',{highway:'unclassified'},'#ffffff','#b9b9b9',5],
 ['road','未定级道路','道路','LineString',{highway:'road'},'#dddddd','#999999',4],
 ['living_street','生活街道','道路','LineString',{highway:'living_street'},'#ededed','#bbbbbb',5],
 ['pedestrian','步行街','道路','LineString',{highway:'pedestrian'},'#ededed','#999999',5],
 ['track','田间道路','道路','LineString',{highway:'track'},'#b19668','#ffffff',2],
 ['path','小径','道路','LineString',{highway:'path'},'#fa8072','#ffffff',2],
 ['cycleway','自行车道','道路','LineString',{highway:'cycleway'},'#0000ff','#ffffff',2],
 ['steps','台阶','道路','LineString',{highway:'steps'},'#fa8072','#ffffff',2],
 ['tram','有轨电车','交通','LineString',{railway:'tram'},'#ffffff','#777777',2],
 ['subway','地铁','交通','LineString',{railway:'subway'},'#ffffff','#777777',2],
 ['light_rail','轻轨','交通','LineString',{railway:'light_rail'},'#ffffff','#777777',2],
 ['ferry','轮渡航线','交通','LineString',{route:'ferry'},'#70a4ba','#70a4ba',2],
 ['ditch','沟渠','水系','LineString',{waterway:'ditch'},'#aad3df','#aad3df',2],
 ['drain','排水渠','水系','LineString',{waterway:'drain'},'#aad3df','#aad3df',3],
 ['dam','水坝','水系','LineString',{waterway:'dam'},'#adadad','#888888',3],
 ['weir','堰','水系','LineString',{waterway:'weir'},'#adadad','#888888',2],
 ['lake','湖泊','水系','Polygon',{natural:'water',water:'lake'},'#aad3df','#92c6d5'],
 ['pond','池塘','水系','Polygon',{natural:'water',water:'pond'},'#aad3df','#92c6d5'],
 ['reservoir','水库','水系','Polygon',{natural:'water',water:'reservoir'},'#aad3df','#92c6d5'],
 ['river_area','河流水面','水系','Polygon',{natural:'water',water:'river'},'#aad3df','#92c6d5'],
 ['commercial','商业用地','用地','Polygon',{landuse:'commercial'},'#f2dad9','#dec2c1'],
 ['retail','零售用地','用地','Polygon',{landuse:'retail'},'#ffd6d1','#d7aaa5'],
 ['cemetery','墓地','用地','Polygon',{landuse:'cemetery'},'#aacbaf','#7ea484'],
 ['orchard','果园','用地','Polygon',{landuse:'orchard'},'#aedfa3','#9ac58f'],
 ['meadow','草甸','用地','Polygon',{landuse:'meadow'},'#cdebb0','#b1ce98'],
 ['grass','草地','用地','Polygon',{landuse:'grass'},'#cdebb0','#b1ce98'],
 ['brownfield','待开发用地','用地','Polygon',{landuse:'brownfield'},'#c7c7b4','#aaaa99'],
 ['construction','建设用地','用地','Polygon',{landuse:'construction'},'#c7c7b4','#aaaa99'],
 ['quarry','采石场','用地','Polygon',{landuse:'quarry'},'#c5c3c3','#999999'],
 ['military','军事用地','用地','Polygon',{landuse:'military'},'#f5dcdc','#ff5555'],
 ['education','教育用地','用地','Polygon',{landuse:'education'},'#ffffe5','#d6d6b8'],
 ['wood','天然林地','自然','Polygon',{natural:'wood'},'#add19e','#95bc86'],
 ['scrub','灌木','自然','Polygon',{natural:'scrub'},'#c8d7ab','#a6bb8b'],
 ['wetland','湿地','自然','Polygon',{natural:'wetland'},'#cdebb0','#aad3df'],
 ['sand','沙地','自然','Polygon',{natural:'sand'},'#f5e9c6','#e1d3ab'],
 ['beach','海滩','自然','Polygon',{natural:'beach'},'#fff1ba','#e8dca5'],
 ['pitch','运动场','设施','Polygon',{leisure:'pitch'},'#aae0cb','#7bb7a0'],
 ['playground','游乐场','设施','Polygon',{leisure:'playground'},'#dffce2','#a6d9aa'],
 ['school_area','学校范围','设施','Polygon',{amenity:'school'},'#ffffe5','#d6d6b8'],
 ['hospital_area','医院范围','设施','Polygon',{amenity:'hospital'},'#ffffe5','#d6d6b8'],
 ['religious_area','宗教用地','用地','Polygon',{landuse:'religious'},'#d0d0d0','#b3b3b3'],
 ['town','镇','地名','Point',{place:'town'},'#333333','#ffffff'],
 ['city','城市','地名','Point',{place:'city'},'#333333','#ffffff'],
 ['village','村庄','地名','Point',{place:'village'},'#333333','#ffffff'],
 ['hamlet','自然村','地名','Point',{place:'hamlet'},'#555555','#ffffff'],
 ['suburb','城区','地名','Point',{place:'suburb'},'#555555','#ffffff'],
 ['neighbourhood','街区','地名','Point',{place:'neighbourhood'},'#777777','#ffffff'],
 ['city_wall','城墙','历史','LineString',{historic:'citywalls'},'#666666','#444444',3],
 ['wall','围墙','设施','LineString',{barrier:'wall'},'#777777','#777777',1.5],
 ['hedge','树篱','设施','LineString',{barrier:'hedge'},'#add19e','#95bc86',2],
 ['administrative','行政边界','边界','LineString',{boundary:'administrative'},'#aa88aa','#aa88aa',2],
 ['generic_line','其他线要素','其他','LineString',{},'#777777','#777777',2],
 ['generic_area','其他面要素','其他','Polygon',{},'#e8e8e8','#aaaaaa'],
 ['generic_point','其他点要素','其他','Point',{},'#666666','#ffffff']
];
const pois=[
 ['school','学校',{amenity:'school'},'#734a08'],['hospital','医院',{amenity:'hospital'},'#bf0000'],
 ['clinic','诊所',{amenity:'clinic'},'#bf0000'],['pharmacy','药房',{amenity:'pharmacy'},'#bf0000'],
 ['police','警署',{amenity:'police'},'#734a08'],['fire_station','消防站',{amenity:'fire_station'},'#734a08'],
 ['post_office','邮局',{amenity:'post_office'},'#734a08'],['townhall','政府机构',{amenity:'townhall'},'#734a08'],
 ['marketplace','集市',{amenity:'marketplace'},'#ac39ac'],['bank','银行',{amenity:'bank'},'#734a08'],
 ['restaurant','餐馆',{amenity:'restaurant'},'#c77400'],['cafe','咖啡馆',{amenity:'cafe'},'#c77400'],
 ['worship','宗教场所',{amenity:'place_of_worship'},'#000000'],
 ['temple','佛教寺庙',{amenity:'place_of_worship',religion:'buddhist'},'#000000'],
 ['church','基督教堂',{amenity:'place_of_worship',religion:'christian'},'#000000'],
 ['mosque','清真寺',{amenity:'place_of_worship',religion:'muslim'},'#000000'],
 ['museum','博物馆',{tourism:'museum'},'#734a08'],['hotel','旅馆',{tourism:'hotel'},'#0092da'],
 ['bus_stop','公交站',{highway:'bus_stop'},'#0092da'],['ferry_terminal','渡口',{amenity:'ferry_terminal'},'#0092da'],
 ['city_gate','城门',{historic:'city_gate'},'#734a08'],['monument','纪念物',{historic:'monument'},'#734a08'],
 ['shop','商店',{shop:'yes'},'#ac39ac'],['office','办公机构',{office:'yes'},'#4863a0'],
 ['tree','树木',{natural:'tree'},'#228b22'],['peak','山峰',{natural:'peak'},'#666666'],
 ['lock_gate','船闸',{waterway:'lock_gate'},'#666666']
];
for(const [id,name,tags,color] of pois)rows.push([id,name,['city_gate','monument'].includes(id)?'历史':'地点','Point',tags,color,'#ffffff']);
export const EXTRA_KINDS=Object.fromEntries(rows.map(([id,name,group,geometry,tags,fill,stroke,width])=>[id,{name,group,geometry,fill,stroke,width,tags}]));
export const LEGACY_TAGS={motorway:{highway:'motorway'},trunk:{highway:'trunk'},primary:{highway:'primary'},secondary:{highway:'secondary'},tertiary:{highway:'tertiary'},residential:{highway:'residential'},service:{highway:'service'},footway:{highway:'footway'},rail:{railway:'rail'},river:{waterway:'river'},canal:{waterway:'canal'},stream:{waterway:'stream'},water:{natural:'water'},land:{},housing:{landuse:'residential'},industrial:{landuse:'industrial'},park:{leisure:'park'},forest:{landuse:'forest'},farmland:{landuse:'farmland'},building:{building:'yes'},place:{place:'locality'},station:{railway:'station'},...Object.fromEntries(rows.map(r=>[r[0],r[4]]))};
export function effectiveTags(feature){
 const a=feature.properties,tags=a.tags?{...a.tags}:{...LEGACY_TAGS[a.kind]};
 if(!a.tags){if(a.name)tags.name=a.name;if(a.bridge)tags.bridge='yes';if(a.tunnel)tags.tunnel='yes';}
 return tags;
}
export function kindFromTags(tags,type,fallback){
 if(type==='Polygon'&&tags.building&&tags.building!=='no')return 'building';
 const candidates=Object.entries(LEGACY_TAGS).filter(([id,t])=>Object.keys(t).length&&Object.entries(t).every(([k,v])=>tags[k]===v)&&((EXTRA_KINDS[id]?.geometry||(['water','land','housing','industrial','park','forest','farmland','building'].includes(id)?'Polygon':['place','station'].includes(id)?'Point':'LineString'))===type));
 candidates.sort((a,b)=>Object.keys(b[1]).length-Object.keys(a[1]).length);
 if(candidates.length)return candidates[0][0];
 if(type==='Polygon'&&tags.building&&tags.building!=='no')return 'building';
 if(type==='Point'&&tags.place)return 'place';
 if(type==='LineString'&&tags.highway)return ['motorway','trunk','primary','secondary','tertiary'].includes(tags.highway.replace('_link',''))?tags.highway.replace('_link',''):'road';
 return fallback||({Point:'generic_point',LineString:'generic_line',Polygon:'generic_area'}[type]);
}
