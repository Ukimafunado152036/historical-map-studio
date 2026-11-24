// Single independent workspace. No railway projects or division catalogue.
export function workspaceKeys(id='personal'){
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(id))throw new Error('无效的项目编号');
 return {project:'historical-map.workspace.v1.'+id,meta:'historical-map.file.v1.'+id,preferences:'historical-map.preferences.v1.'+id,handle:id};
}
