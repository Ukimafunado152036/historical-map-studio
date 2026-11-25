import {normalizeHistory} from './history-model.mjs';
import {GITHUB_PROJECT} from './github-config.mjs';

export function projectPath(path){
 if(typeof path!=='string'||!/^[-a-zA-Z0-9_]{1,100}\.history-map\.json$/.test(path))throw new Error('项目文件名请使用字母、数字、横线，末尾为 .history-map.json。');
 return path;
}
const encode=text=>{const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
const decode=text=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const problem=(message,code)=>Object.assign(new Error(message),{code});
// Project data and credentials exist in memory only. No localStorage, IDB or file writes.
export class GitHubProjectStore{
 #token='';
 constructor({config=GITHUB_PROJECT,fetcher=globalThis.fetch?.bind(globalThis),onChange=()=>{},delay=20000,normalize=normalizeHistory}={}){
  this.config={...config,path:projectPath(config.path)};this.fetcher=fetcher;this.onChange=onChange;this.delay=delay;this.normalize=normalize;
  this.mode='github';this.loaded=false;this.dirty=false;this.saving=false;this.error=null;this.conflict=false;this.pending=null;this.pump=null;this.timer=null;this.sha=null;this.uncertain=null;this.writeBlocked=false;this.writeVerified=false;this.rateLimitError=null;
 }
 get name(){return this.config.path;}
 get connected(){return !!this.#token;}
 get needsReconnect(){return !this.loaded||!this.connected||this.conflict||this.writeBlocked;}
 get fileURL(){const c=this.config;return `https://github.com/${c.owner}/${c.repo}/blob/${encodeURIComponent(c.branch)}/${c.path}`;}
 changed(){this.onChange(this);}
 endpoint(path=''){const c=this.config;return `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`;}
 async request(path,{method='GET',body,allowMissing=false,raw=false,object=false}={}){
  if(this.rateLimitError?.retryAt>Date.now())throw this.rateLimitError;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const headers={accept:raw?'application/vnd.github.raw+json':object?'application/vnd.github.object+json':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'};
   if(this.#token)headers.authorization='Bearer '+this.#token;
   if(body)headers['content-type']='application/json';
   const r=await this.fetcher('https://api.github.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
   if(r.status===404&&allowMissing)return null;
   if(!r.ok){
    let data;try{data=await r.json();}catch{}
    let detail=typeof data?.message==='string'?data.message:'';
    if(this.#token)detail=detail.replaceAll(this.#token,'[已隐藏]');
    detail=detail.replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g,'[已隐藏]').slice(0,300);
    const fail=(message,code)=>Object.assign(problem(message,code),{status:r.status,detail,method,requestId:r.headers.get('x-github-request-id')||''});
    if(r.status===401){this.#token='';throw fail('GitHub 令牌无效、已过期或被撤销，请在“GitHub 项目”中重新连接。','AUTH');}
    if(r.status===429||(r.status===403&&(r.headers.get('x-ratelimit-remaining')==='0'||r.headers.get('retry-after')||/rate limit|abuse detection/i.test(detail)))){
     const retry=r.headers.get('retry-after'),reset=Number(r.headers.get('x-ratelimit-reset'))*1000;
     const retryAt=retry?(Number.isFinite(Number(retry))?Date.now()+Number(retry)*1000:Date.parse(retry)):(reset>Date.now()?reset:Date.now()+60000);
     const e=fail('GitHub 请求次数暂时受限，请等待后重试。'+(this.#token?'':'连接 GitHub 授权后可使用账号额度。')+'未提交修改仍留在当前页面。','RATE_LIMIT');
     e.retryAt=Number.isFinite(retryAt)?Math.max(Date.now()+1000,retryAt):Date.now()+60000;this.rateLimitError=e;throw e;
    }
    if(r.status===403){
     if(/protected branch|repository rule|push declined/i.test(detail))throw fail('GitHub 分支规则拒绝了保存，请检查 '+this.config.branch+' 分支的写入规则。未提交修改仍留在当前页面。','RULES');
     throw fail(method==='PUT'?'这枚令牌未能写入地图。请在 GitHub 为它选择 '+this.config.repo+' 仓库，将 Contents 设为 Read and write，再回到“GitHub 项目”更换授权并重试。':'GitHub 拒绝访问。请检查令牌是否获准访问 '+this.config.owner+'/'+this.config.repo+' 仓库。','PERMISSION');
    }
    if(r.status===409)throw fail('GitHub 上的文件已有变化。请重新读取，或将当前内容另存为新项目。','CONFLICT');
    if(r.status===422)throw fail('GitHub 未接受保存的数据或分支设置，请查看请求详情。未提交修改仍留在当前页面。','VALIDATION');
    if(r.status===404)throw fail('GitHub 无法找到或无权访问项目，请检查令牌选择的仓库、分支和文件名。','MISSING');
    throw fail('GitHub 暂时无法完成请求（'+r.status+'），修改仍留在当前页面。','REMOTE');
   }
   return raw?await r.text():await r.json();
  }catch(e){if(e.code)throw e;throw problem('连接 GitHub 失败。修改仍留在当前页面，请保持页面打开后重试。','NETWORK');}
  finally{clearTimeout(timer);}
 }
 async read(path=this.name,allowMissing=false){
  const suffix=this.endpoint('/contents/'+projectPath(path))+'?ref='+encodeURIComponent(this.config.branch);
  const file=await this.request(suffix,{allowMissing,object:true});if(!file)return null;
  if(file.type!=='file'||typeof file.sha!=='string')throw problem('GitHub 返回的项目文件无效。','INVALID');
  if(file.size>30*1024*1024)throw problem('项目超过 30 MB，请按地区拆分。','INVALID');
  const text=file.encoding==='base64'?decode(file.content):await this.request(suffix,{raw:true});
  let project;try{project=this.normalize(JSON.parse(text));}catch(e){throw problem('GitHub 项目读取失败：'+e.message,'INVALID');}
  return {project,text,sha:file.sha};
 }
 async load(path=this.name){
  if(this.dirty)throw problem('当前页面有尚未保存的修改，请先保存或另存。','UNSAVED');
  try{const file=await this.read(path);this.config.path=projectPath(path);this.sha=file.sha;this.loaded=true;this.conflict=false;this.uncertain=null;this.error=null;this.changed();return file.project;}
  catch(e){this.error=e;this.changed();throw e;}
 }
 async connect(token){
  if(!String(token).trim())throw new Error('请填写 GitHub 仓库访问令牌。');
  if(this.saving)throw new Error('请等待当前保存结束，再更换授权。');
  this.#token=String(token).trim();this.rateLimitError=null;this.writeVerified=false;
  try{
   const user=await this.request('/user');if(user.login?.toLowerCase()!==this.config.owner.toLowerCase())throw problem('请使用 '+this.config.owner+' 的仓库授权。','AUTH');
   const repo=await this.request(this.endpoint());if(repo.permissions?.push!==true)throw problem('当前授权无法写入此仓库，请仅为此仓库开启 Contents 读写权限。','PERMISSION');
   // permissions.push describes the account's role, not a fine-grained PAT's
   // Contents permission. Only a successful PUT proves this token can save.
   this.writeBlocked=false;this.error=null;this.changed();return user.login;
  }catch(e){this.#token='';this.error=e;this.changed();throw e;}
 }
 disconnect(){if(this.dirty||this.saving)throw new Error('请先保存当前修改，再断开连接。');clearTimeout(this.timer);this.#token='';this.changed();}
 save(project){
  if(this.needsReconnect)throw new Error('请先连接 GitHub 项目，再编辑地图。');
  const text=JSON.stringify(this.normalize(project),null,2);if(new TextEncoder().encode(text).length>30*1024*1024)throw new Error('项目超过 30 MB，请按地区另存。');
  this.pending=text;this.dirty=true;this.error=null;clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.delay);this.changed();
 }
 async put(path,text,sha){
  const result=await this.request(this.endpoint('/contents/'+projectPath(path)),{method:'PUT',body:{message:'更新历史地图：'+path,branch:this.config.branch,content:encode(text),...(sha?{sha}:{})}});
  if(!result.content?.sha||!result.commit?.sha)throw problem('GitHub 保存结果不完整，请确认远端文件后再继续。','NETWORK');
  this.writeVerified=true;
  return result.content.sha;
 }
 async flush(){
  clearTimeout(this.timer);if(this.pump)return this.pump;if(!this.pending)return;
  if(this.writeBlocked)throw this.error;
  if(this.needsReconnect)throw new Error(this.conflict?'项目存在版本冲突，请先另存或重新读取。':'请先连接 GitHub。');
  this.saving=true;this.changed();
  this.pump=(async()=>{
   while(this.pending){
    const text=this.pending;
    try{
     if(this.uncertain){
      const remote=await this.read();
      if(remote.text===this.uncertain.text){this.sha=remote.sha;if(text===this.uncertain.text){this.pending=null;this.uncertain=null;this.error=null;continue;}}
      else if(remote.sha!==this.uncertain.sha)throw problem('GitHub 文件已被其他页面更新，请将当前修改另存为新项目。','CONFLICT');
      this.uncertain=null;
     }
     const previous=this.sha;this.uncertain={text,sha:previous};this.sha=await this.put(this.name,text,previous);this.uncertain=null;
     if(this.pending===text)this.pending=null;
     this.error=null;
    }catch(e){if(e.code==='CONFLICT')this.conflict=true;if(['PERMISSION','RULES'].includes(e.code))this.writeBlocked=true;if(e.code!=='NETWORK')this.uncertain=null;this.error=e;throw e;}
   }
  })().finally(()=>{this.dirty=!!this.pending;this.saving=false;this.pump=null;this.changed();});
  return this.pump;
 }
 async list(){const files=await this.request(this.endpoint('/contents')+'?ref='+encodeURIComponent(this.config.branch));if(!Array.isArray(files))throw new Error('无法读取 GitHub 项目列表。');return files.filter(f=>f.type==='file'&&/^[-a-zA-Z0-9_]{1,100}\.history-map\.json$/.test(f.name)).map(f=>({name:f.name}));}
 async create(path,project){
  path=projectPath(path);if(!this.connected)throw new Error('请先连接 GitHub。');if(this.writeBlocked)throw this.error;if(this.saving)throw new Error('请等待当前保存结束。');
  clearTimeout(this.timer);this.saving=true;this.changed();
  try{
   if(await this.read(path,true))throw new Error('此项目名称已存在，请使用另一个名称。');
   const normalized=this.normalize(project),text=JSON.stringify(normalized,null,2);if(new TextEncoder().encode(text).length>30*1024*1024)throw new Error('项目超过 30 MB，请按地区拆分。');
   const sha=await this.put(path,text,null);
   const verified=await this.read(path);if(verified.sha!==sha||verified.text!==text)throw new Error('新项目已提交，但读取确认未完成。请先检查 GitHub 文件，勿重复创建。');
   this.config.path=path;this.sha=sha;this.loaded=true;this.pending=null;this.dirty=false;this.conflict=false;this.uncertain=null;this.error=null;return normalized;
  }finally{this.saving=false;this.changed();}
 }
}
