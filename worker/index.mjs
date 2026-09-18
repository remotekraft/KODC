// Import the exact same content validator used by the static site. No database.
import '../dist/content.js';
const {validate}=globalThis.KODC;
const encoder=new TextEncoder();
const COOKIE='__Host-kodc_session';
const MAX_BODY=1024*1024;
const TTL=4*60*60;
const REPOSITORY='https://api.github.com/repos/remotekraft/KODC/contents/dist/content.json';
function json(body,status=200,headers={}) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
}
function fail(status,message){throw Object.assign(new Error(message),{status});}
function ready(env){return typeof env.ADMIN_PASSWORD==='string' && env.ADMIN_PASSWORD.length>=16 && typeof env.SESSION_SECRET==='string' && env.SESSION_SECRET.length>=32 && Boolean(env.GITHUB_TOKEN) && Boolean(env.SITE_ORIGIN) && Boolean(env.AUTH_LIMITER);}
function b64(bytes){let value='';for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value);}
function unb64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
function url64(bytes){return b64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromUrl64(value){const normal=value.replace(/-/g,'+').replace(/_/g,'/');return unb64(normal+'='.repeat((4-normal.length%4)%4));}
async function signingKey(env){return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function passwordMatches(value,expected){
  if(typeof value!=='string' || value.length>256)return false;
  const a=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
  const b=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(expected)));
  let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0;
}
async function session(request,env){
  try {
    const raw=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if(!raw || raw.length>1000)return null;
    const parts=raw.split('.');if(parts.length!==2)return null;
    if(!await crypto.subtle.verify('HMAC',await signingKey(env),fromUrl64(parts[1]),encoder.encode(parts[0])))return null;
    const value=JSON.parse(new TextDecoder().decode(fromUrl64(parts[0])));
    const now=Math.floor(Date.now()/1000);
    return value.v===1 && value.user===(env.ADMIN_USERNAME||'admin') && Number.isInteger(value.exp) && value.exp>now && value.exp<=now+TTL && /^[A-Za-z0-9_-]{32}$/.test(value.csrf) ? value : null;
  }catch{return null;}
}
async function issueSession(env){
  const csrf=url64(crypto.getRandomValues(new Uint8Array(24)));
  const payload=url64(encoder.encode(JSON.stringify({v:1,user:env.ADMIN_USERNAME||'admin',exp:Math.floor(Date.now()/1000)+TTL,csrf})));
  const signature=url64(new Uint8Array(await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(payload))));
  return {csrf,cookie:`${COOKIE}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`};
}
async function readJson(request){
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))fail(415,'JSON content is required.');
  if(Number(request.headers.get('Content-Length'))>MAX_BODY)fail(413,'Content is too large. Maximum: 1 MB.');
  const reader=request.body?.getReader();if(!reader)fail(400,'Missing request body.');
  const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BODY){await reader.cancel();fail(413,'Content is too large. Maximum: 1 MB.');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Invalid JSON.');}
}
async function github(env,method='GET',body){
  const response=await fetch(REPOSITORY+(method==='GET'?'?ref=main':''),{
    method,headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'KODC-publisher','Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)
  });
  if(response.status===409 || response.status===422)fail(409,'Content changed on GitHub, or the commit was rejected. Export a backup, reload the latest content, and reapply your changes.');
  if(!response.ok)fail(502,'GitHub could not complete publishing. Check the token permissions, expiry, repository rules, and Cloudflare deployment settings.');
  return response.json();
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    try {
      if(!['/api/session','/api/login','/api/logout','/api/content','/api/publish'].includes(url.pathname))fail(404,'Unknown API route.');
      const method=url.pathname==='/api/session'||url.pathname==='/api/content'?'GET':'POST';
      if(request.method!==method)return json({error:'Method not allowed.'},405,{Allow:method});
      if(!ready(env))return json({configured:false,authenticated:false,error:'Publishing is not configured. Add the Worker runtime secrets listed in CLOUDFLARE-SETUP.md.'},503);
      if(url.origin!==env.SITE_ORIGIN || url.protocol!=='https:')fail(403,'Use the configured production website to manage content.');
      if(method==='POST' && request.headers.get('Origin')!==env.SITE_ORIGIN)fail(403,'Request origin rejected.');
      const current=await session(request,env);
      if(url.pathname==='/api/session')return json({configured:true,authenticated:Boolean(current),...(current?{csrf:current.csrf}:{})});
      if(url.pathname==='/api/logout')return json({ok:true},200,{'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
      if(url.pathname==='/api/login'){
        const result=await env.AUTH_LIMITER.limit({key:'login:'+(request.headers.get('CF-Connecting-IP')||'unknown')});
        if(!result.success)return json({error:'Too many login attempts. Wait a minute and try again.'},429,{'Retry-After':'60'});
        const body=await readJson(request);
        const correct=await passwordMatches(body?.password,env.ADMIN_PASSWORD);
        if(!correct || body?.username!==(env.ADMIN_USERNAME||'admin'))fail(401,'Username or password is incorrect.');
        const token=await issueSession(env);return json({authenticated:true,csrf:token.csrf},200,{'Set-Cookie':token.cookie});
      }
      if(!current)fail(401,'Your session expired. Log in again; your local draft is kept.');
      if(url.pathname==='/api/content'){
        const file=await github(env);
        if(file.encoding!=='base64' || !file.content || !/^[a-f0-9]{40}$/.test(file.sha))fail(502,'GitHub returned an unsupported content file.');
        let content;try{content=validate(JSON.parse(new TextDecoder().decode(unb64(file.content.replace(/\s/g,'')))));}catch{fail(502,'The repository content is invalid. Check dist/content.json.');}
        return json({content,sha:file.sha});
      }
      if(request.headers.get('X-CSRF-Token')!==current.csrf)fail(403,'Publishing verification failed. Refresh and log in again.');
      const limited=await env.AUTH_LIMITER.limit({key:'publish:'+current.user});if(!limited.success)fail(429,'Too many publish requests. Wait a minute.');
      const body=await readJson(request);
      if(!/^[a-f0-9]{40}$/.test(body?.sha||''))fail(400,'Reload the latest content before publishing.');
      let clean;try{clean=validate(body.content);}catch(error){fail(400,'Content rejected: '+error.message);}
      const result=await github(env,'PUT',{branch:'main',sha:body.sha,message:'Publish KODC showcase from secure admin',content:b64(encoder.encode(JSON.stringify(clean,null,2)+'\n'))});
      return json({ok:true,sha:result.content.sha,commit:result.commit.sha,message:'Saved to GitHub. Cloudflare will now build and deploy the update; visitors see it after deployment completes.'});
    }catch(error){return json({error:error.status?error.message:'The publishing service is temporarily unavailable. Your local draft is safe; try again later.'},error.status||502);}
  }
};
