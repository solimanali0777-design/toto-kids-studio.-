import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeToolRequest, GatewayError } from './solyGatewayCore.js';
import { createAccountAdapters, probeAccountConnectors, googleAccessToken } from './accountAdapters.mjs';
import { startOAuth, completeOAuth, oauthStatus, oauthCallbackHtml } from './oauthBroker.mjs';
import { persistWorkspaceAsset, readWorkspaceAsset, createProjectVersion, restoreProjectVersion, storageCapability } from './workspaceStorage.mjs';
import { runVisionQa } from './visionQaAdapter.mjs';
import { renderTimeline } from './frameRenderer.mjs';
import { buildLipSyncPlan } from './lipSyncPlanner.mjs';
import { createWorkSession, getWorkSession, checkpointWork, summarizeWorkSession } from './workContinuity.mjs';
import { selectModel } from './modelRouter.mjs';
import { evaluateEducationalPlan } from './educationPolicy.mjs';
import { planShortForm } from './shortFormPlanner.mjs';
import { durableConfigured, durableGet, durablePut, durableBlobGet } from './durableStore.mjs';
import { handler as appdeployCompatHandler } from './appdeployCompatApi.mjs';
import { buildOwnerAuth } from './ownerAuth.mjs';

const PORT=Number(process.env.PORT||8787);
const JOB_FILE=process.env.SOLY_JOB_STORE_PATH||'/tmp/soly-jobs.json';
const ALLOWED_ORIGIN=process.env.SOLY_ALLOWED_ORIGIN||'*';
const VERSION='7.15.0-alpha.1';
const ownerAuth=buildOwnerAuth();
const requestIsSecure=req=>String(req.headers['x-forwarded-proto']||'').toLowerCase()==='https';
const WEB_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../web-dist');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
async function serveWeb(req,res){if(!['GET','HEAD'].includes(req.method||''))return false;const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(u.pathname==='/health'||u.pathname.startsWith('/v1/')||u.pathname.startsWith('/api/'))return false;let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '');if(!rel||!extname(rel))rel='index.html';const full=resolve(WEB_ROOT,rel);if(full!==WEB_ROOT&&!full.startsWith(WEB_ROOT+'/'))return false;try{const bytes=await readFile(full);res.writeHead(200,{'Content-Type':MIME[extname(full).toLowerCase()]||'application/octet-stream','Cache-Control':rel==='index.html'?'no-cache':'public, max-age=31536000, immutable'});if(req.method==='HEAD')return res.end(),true;res.end(bytes);return true;}catch{if(rel!=='index.html'){try{const bytes=await readFile(resolve(WEB_ROOT,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?'':bytes);return true;}catch{}}return false;}}

const SOLY_AI_SYSTEM='اسمك Soly AI داخل Toto Kids Studio. اتكلم بالمصري الطبيعي مع المستخدم، خليك عملي ولطيف وخفيف الدم من غير تهريج. في الدفع والأمان والحقوق والخصوصية والأعطال الحرجة خليك واضح من غير هزار. ممنوع تختلق Analytics أو أرباح أو نسب نجاح، وممنوع تجاوز حدود المالك.';
const json=(res,status,body,extraHeaders={})=>{const headers={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':ALLOWED_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Soly-Scopes, X-Soly-Confirmed, X-Soly-Max-Cost','Access-Control-Allow-Methods':'GET,POST,OPTIONS',...(ALLOWED_ORIGIN==='*'?{}:{'Access-Control-Allow-Credentials':'true'}),...extraHeaders};res.writeHead(status,headers);res.end(status===204?'':JSON.stringify(body));};
const html=(res,status,body)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Access-Control-Allow-Origin':ALLOWED_ORIGIN});res.end(body);};
const body=async req=>{let raw='';for await(const chunk of req)raw+=chunk;if(!raw)return{};return JSON.parse(raw);};
async function readJobs(){if(durableConfigured())return (await durableGet('jobs','all'))||[];try{return JSON.parse(await readFile(JOB_FILE,'utf8'));}catch{return[];}}
async function writeJobs(rows){if(durableConfigured()){await durablePut('jobs','all',rows);return;}await mkdir(dirname(JOB_FILE),{recursive:true});await writeFile(JOB_FILE,JSON.stringify(rows,null,2));}
function scopes(req){return String(req.headers['x-soly-scopes']||'').split(',').map(x=>x.trim()).filter(Boolean);}
function confirmed(req){return String(req.headers['x-soly-confirmed']||'false')==='true';}
function maxCost(req){const n=Number(req.headers['x-soly-max-cost']);return Number.isFinite(n)?n:0;}
const requireEnv=(name,label)=>{if(!process.env[name])throw new GatewayError('adapter_unavailable',`${label} credentials are not configured`,503);return process.env[name];};
async function fetchJson(url,options={}){const r=await fetch(url,options);const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data?.error?.message||data?.message||`HTTP ${r.status}`),{status:r.status,data});return data;}

const githubHeaders=()=>({Authorization:`Bearer ${requireEnv('GITHUB_TOKEN','GitHub')}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
const githubRepo=()=>`${requireEnv('SOLY_REPO_OWNER','GitHub repo owner')}/${requireEnv('SOLY_REPO_NAME','GitHub repo name')}`;
async function githubJson(path,options={}){return fetchJson(`https://api.github.com/repos/${githubRepo()}${path}`,{...options,headers:{...githubHeaders(),...(options.headers||{})}});}

const adapters={
  'soly.work.session.create':async args=>{const session=await createWorkSession(args);return{adapter:'internal-work-continuity',session,summary:summarizeWorkSession(session)};},
  'soly.work.session.read':async args=>{const session=await getWorkSession(args.sessionId||'active');if(!session)throw new GatewayError('not_found','Work session not found',404);return{adapter:'internal-work-continuity',session,summary:summarizeWorkSession(session)};},
  'soly.work.checkpoint':async args=>({adapter:'internal-work-continuity',...await checkpointWork(args)}),
  'soly.model.route':async args=>({adapter:'internal-model-router',...selectModel(args)}),
  'toto.education.review':async args=>({adapter:'internal-education-policy',...evaluateEducationalPlan(args)}),
  'toto.shortform.plan':async args=>({adapter:'internal-shortform-planner',...planShortForm(args)}),
  ...createAccountAdapters(),
  'workspace.asset.read':async args=>readWorkspaceAsset(args),
  'workspace.asset.persist':async args=>persistWorkspaceAsset(args),
  'workspace.project.version.create':async args=>createProjectVersion(args),
  'workspace.project.restore':async args=>restoreProjectVersion(args),
  'vision.qa.execute':async args=>runVisionQa(args),
  'render.composer.execute':async args=>renderTimeline(args),
  'lipsync.plan.generate':async args=>buildLipSyncPlan(args),
  'youtube.public.search':async args=>{
    const key=requireEnv('YOUTUBE_API_KEY','YouTube'); const q=String(args.q||'').trim(); if(!q)throw new GatewayError('schema_error','q is required',400);
    const limit=Math.max(1,Math.min(20,Number(args.limit||8))); const p=new URLSearchParams({part:'snippet',type:'video',q,maxResults:String(limit),regionCode:String(args.country||'EG'),key}); if(args.publishedAfter)p.set('publishedAfter',String(args.publishedAfter));
    const search=await fetchJson(`https://www.googleapis.com/youtube/v3/search?${p}`); const ids=(search.items||[]).map(x=>x.id?.videoId).filter(Boolean);
    let stats={}; if(ids.length){const sp=new URLSearchParams({part:'statistics,snippet',id:ids.join(','),key});const detail=await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${sp}`);stats=Object.fromEntries((detail.items||[]).map(v=>[v.id,v]));}
    return {adapter:'youtube-data-api',capturedAt:new Date().toISOString(),items:(search.items||[]).map(x=>{const v=stats[x.id?.videoId]||{};return{videoId:x.id?.videoId,title:x.snippet?.title||'',channelTitle:x.snippet?.channelTitle||'',publishedAt:x.snippet?.publishedAt||null,url:x.id?.videoId?`https://www.youtube.com/watch?v=${x.id.videoId}`:'',views:Number(v.statistics?.viewCount||0)||null,likes:Number(v.statistics?.likeCount||0)||null,country:String(args.country||'EG')}})};
  },
  'youtube.analytics.read':async args=>{
    const token=process.env.YOUTUBE_OAUTH_TOKEN||await googleAccessToken(); const p=new URLSearchParams({ids:'channel==MINE',startDate:String(args.startDate||new Date(Date.now()-30*864e5).toISOString().slice(0,10)),endDate:String(args.endDate||new Date().toISOString().slice(0,10)),metrics:String(args.metrics||'views,averageViewDuration,averageViewPercentage,engagedViews')}); if(args.dimensions)p.set('dimensions',String(args.dimensions));if(args.filters)p.set('filters',String(args.filters));if(args.sort)p.set('sort',String(args.sort));if(args.maxResults)p.set('maxResults',String(Math.max(1,Math.min(200,Number(args.maxResults||50)))));
    return fetchJson(`https://youtubeanalytics.googleapis.com/v2/reports?${p}`,{headers:{Authorization:`Bearer ${token}`}});
  },
  'youtube.channel.read':async ()=>{
    const token=process.env.YOUTUBE_OAUTH_TOKEN||await googleAccessToken();
    const p=new URLSearchParams({part:'snippet,statistics',mine:'true'});
    const data=await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${p}`,{headers:{Authorization:`Bearer ${token}`}});
    const c=data.items?.[0]||null;
    return {adapter:'youtube-data-api-owner',channel:c?{id:c.id,title:c.snippet?.title||'',country:c.snippet?.country||null,subscriberCount:Number(c.statistics?.subscriberCount||0)||0,viewCount:Number(c.statistics?.viewCount||0)||0,videoCount:Number(c.statistics?.videoCount||0)||0,hiddenSubscriberCount:Boolean(c.statistics?.hiddenSubscriberCount)}:null};
  },
  'google.analytics.read':async args=>{
    const token=await googleAccessToken();
    const propertyId=String(args.propertyId||process.env.GOOGLE_GA4_PROPERTY_ID||'').replace(/^properties\//,'');
    if(!propertyId)throw new GatewayError('adapter_unavailable','GOOGLE_GA4_PROPERTY_ID is not configured',503);
    const metrics=String(args.metrics||'sessions,screenPageViews').split(',').map(name=>({name:name.trim()})).filter(x=>x.name);
    const dimensions=String(args.dimensions||'date').split(',').map(name=>({name:name.trim()})).filter(x=>x.name);
    const payload={dateRanges:[{startDate:String(args.startDate||'28daysAgo'),endDate:String(args.endDate||'today')}],metrics,dimensions,limit:String(Math.max(1,Math.min(1000,Number(args.limit||100))))};
    const data=await fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    return {adapter:'google-analytics-data-api',propertyId,...data};
  },
  'openai.brain.execute':async args=>{
    const key=requireEnv('OPENAI_API_KEY','OpenAI'); const payload={model:String(args.model||process.env.SOLY_OPENAI_MODEL||'gpt-5.6-terra'),input:String(args.input||''),instructions:`${SOLY_AI_SYSTEM}\n${String(args.instructions||'')}`.trim()}; if(args.maxOutputTokens)payload.max_output_tokens=Number(args.maxOutputTokens);
    const data=await fetchJson('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)}); return {adapter:'openai-responses',id:data.id,model:data.model,outputText:data.output_text||'',usage:data.usage||null};
  },
  'google.ai.execute':async args=>{
    const key=requireEnv('GEMINI_API_KEY','Google AI'); const model=encodeURIComponent(String(args.model||process.env.SOLY_GEMINI_MODEL||'gemini-3.8-flash')); const payload={contents:[{parts:[{text:String(args.prompt||'')}]}],systemInstruction:{parts:[{text:`${SOLY_AI_SYSTEM}\n${String(args.systemInstruction||'')}`.trim()}]}}; const data=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return{adapter:'gemini',model:String(args.model||process.env.SOLY_GEMINI_MODEL||'gemini-3.8-flash'),text:data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'',usage:data.usageMetadata||null};
  },
  'canva.design.execute':async args=>{requireEnv('CANVA_ACCESS_TOKEN','Canva');return{adapter:'canva-connect',status:'connected',action:args.action||'unspecified',message:'Canva actions use explicit task-specific endpoints; generic arbitrary calls are intentionally blocked.'};},

  'repo.file.read':async args=>{const ref=String(args.ref||process.env.SOLY_MAIN_BRANCH||'main');const data=await githubJson(`/contents/${String(args.path||'')}?ref=${encodeURIComponent(ref)}`);return{adapter:'github',path:data.path,sha:data.sha,encoding:data.encoding,content:data.content,ref};},
  'repo.branch.create':async args=>{const branch=String(args.branch||'').trim();if(!/^soly\/[a-zA-Z0-9._/-]+$/.test(branch))throw new GatewayError('schema_error','Soly branches must start with soly/',400);const fromRef=String(args.fromRef||process.env.SOLY_MAIN_BRANCH||'main');const base=await githubJson(`/git/ref/heads/${encodeURIComponent(fromRef)}`);const created=await githubJson('/git/refs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:`refs/heads/${branch}`,sha:base.object.sha})});return{adapter:'github',branch,sha:created.object?.sha||base.object.sha};},
  'repo.patch.apply':async args=>{const branch=String(args.branch||'');if(!branch.startsWith('soly/'))throw new GatewayError('branch_denied','Patches may only target soly/* branches',403);const path=String(args.path||'');if(!path||/\.env|secret|credential/i.test(path))throw new GatewayError('path_denied','Sensitive paths are blocked',403);const payload={message:String(args.message||`Soly safe patch: ${path}`),content:Buffer.from(String(args.content||''),'utf8').toString('base64'),branch};if(args.sha)payload.sha=String(args.sha);const out=await githubJson(`/contents/${path}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return{adapter:'github',branch,path,commitSha:out.commit?.sha||null,contentSha:out.content?.sha||null};},
  'repo.rollback':async args=>{const branch=String(args.branch||'');if(!branch.startsWith('soly/'))throw new GatewayError('branch_denied','Rollback may only target soly/* branches',403);const targetSha=String(args.targetSha||'');if(!targetSha)throw new GatewayError('schema_error','targetSha is required',400);const out=await githubJson(`/git/refs/heads/${encodeURIComponent(branch)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:targetSha,force:true})});return{adapter:'github',branch,sha:out.object?.sha||targetSha,rolledBack:true};},
  'toto.export.clean':async args=>({adapter:'internal',status:'ready',request:args}),
};

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS')return json(res,204,{});
  try{
    if(req.method==='GET'&&req.url==='/v1/auth/status')return json(res,200,{ok:true,configured:ownerAuth.configured,disabled:ownerAuth.disabled,authenticated:ownerAuth.authenticated(req.headers)});
    if(req.method==='POST'&&req.url==='/v1/auth/login'){const input=await body(req);ownerAuth.login(input.token);return json(res,200,{ok:true,authenticated:true},{'Set-Cookie':ownerAuth.cookie({secure:requestIsSecure(req)})});}
    if(req.method==='POST'&&req.url==='/v1/auth/logout')return json(res,200,{ok:true,authenticated:false},{'Set-Cookie':ownerAuth.clearCookie({secure:requestIsSecure(req)})});
    if(req.method==='GET'&&req.url==='/health'){const authenticated=ownerAuth.authenticated(req.headers);if(!authenticated)return json(res,200,{ok:true,service:'soly-gateway',version:VERSION,web:true,auth:{configured:ownerAuth.configured,disabled:ownerAuth.disabled,authenticated:false}});const auth=await oauthStatus();return json(res,200,{ok:true,service:'soly-gateway',version:VERSION,oauth:auth,storage:storageCapability(),web:true,auth:{configured:ownerAuth.configured,disabled:ownerAuth.disabled,authenticated:true},adapters:{openai:Boolean(process.env.OPENAI_API_KEY),googleAI:Boolean(process.env.GEMINI_API_KEY),visionQA:Boolean(process.env.GEMINI_API_KEY&&process.env.SOLY_GEMINI_VISION_MODEL),frameRenderer:true,lipSyncPlanner:true,googleOAuth:Boolean(auth.providers.google.connected),googleAnalytics:Boolean(auth.providers.google.connected&&process.env.GOOGLE_GA4_PROPERTY_ID),microsoft365:Boolean(auth.providers.microsoft.connected),browser:Boolean(process.env.SOLY_SITE_BROWSER_ENDPOINT),youtubePublic:Boolean(process.env.YOUTUBE_API_KEY),youtubeAnalytics:Boolean(process.env.YOUTUBE_OAUTH_TOKEN||auth.providers.google.connected),googlePlay:Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON&&process.env.GOOGLE_PLAY_PACKAGE_NAME),canva:Boolean(process.env.CANVA_ACCESS_TOKEN),github:Boolean(process.env.GITHUB_TOKEN&&process.env.SOLY_REPO_OWNER&&process.env.SOLY_REPO_NAME)}});}
    if(req.method==='GET'&&req.url==='/api/_healthcheck')return json(res,200,{message:'Success',service:'soly-gateway',version:VERSION,standalone:true});
    if(req.method==='GET'&&req.url?.startsWith('/api/media/')){
      ownerAuth.assertAuthenticated(req.headers);
      const raw=decodeURIComponent(String(req.url).split('/api/media/')[1].split('?')[0]||'');
      const out=await durableBlobGet('generated-media',raw);
      if(!out?.found)return json(res,404,{error:'media_not_found'});
      const bytes=Buffer.from(out.contentBase64||'','base64');
      const contentType=out.meta?.content_type||out.meta?.metadata?.contentType||'application/octet-stream';
      res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'public, max-age=31536000, immutable'});
      res.end(bytes);return;
    }
    if(req.url?.startsWith('/api/')){
      ownerAuth.assertAuthenticated(req.headers);
      const apiUrl=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
      const apiBody=req.method==='POST'?await body(req):{};
      const result=await appdeployCompatHandler({method:req.method||'GET',path:apiUrl.pathname,body:apiBody});
      if(result)return json(res,Number(result.status||200),result.body??{});
    }
    if(req.method==='GET'&&req.url==='/v1/oauth/status'){ownerAuth.assertAuthenticated(req.headers);return json(res,200,{ok:true,...await oauthStatus()});}
    const oauthStart=req.url?.match(/^\/v1\/oauth\/(google|microsoft)\/start$/);if(req.method==='POST'&&oauthStart){ownerAuth.assertAuthenticated(req.headers);const input=await body(req);return json(res,200,{ok:true,...await startOAuth(oauthStart[1],{returnTo:input.returnTo||''})});}
    const requestUrl=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);const oauthCallback=requestUrl.pathname.match(/^\/v1\/oauth\/(google|microsoft)\/callback$/);if(req.method==='GET'&&oauthCallback){try{const result=await completeOAuth(oauthCallback[1],requestUrl.searchParams);return html(res,200,oauthCallbackHtml({provider:oauthCallback[1],ok:true,message:'تم حفظ الاتصال المشفر ويمكنك الرجوع إلى Soly AI.'}));}catch(error){return html(res,error?.status||400,oauthCallbackHtml({provider:oauthCallback[1],ok:false,message:String(error?.message||error)}));}}
    const setupMatch=req.url?.match(/^\/v1\/connectors\/setup\/([^/?]+)$/);if(req.method==='GET'&&setupMatch){ownerAuth.assertAuthenticated(req.headers);const id=decodeURIComponent(setupMatch[1]);const auth=await oauthStatus();const plans={gmail:{mode:'oauth',provider:'google',sharedWith:['google_workspace','youtube'],connected:auth.providers.google.connected},google_workspace:{mode:'oauth',provider:'google',sharedWith:['gmail','youtube','google_analytics'],connected:auth.providers.google.connected},google_analytics:{mode:'oauth',provider:'google',connected:Boolean(auth.providers.google.connected&&process.env.GOOGLE_GA4_PROPERTY_ID),requiredEnv:['GOOGLE_GA4_PROPERTY_ID'],sharedWith:['gmail','google_workspace','youtube']},youtube:{mode:'oauth+api-key',provider:'google',connected:auth.providers.google.connected,optionalEnv:['YOUTUBE_API_KEY']},microsoft365:{mode:'oauth',provider:'microsoft',connected:auth.providers.microsoft.connected},google_play:{mode:'service-account',connected:Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON&&process.env.GOOGLE_PLAY_PACKAGE_NAME),requiredEnv:['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON','GOOGLE_PLAY_PACKAGE_NAME']},browser:{mode:'delegated-browser',connected:Boolean(process.env.SOLY_SITE_BROWSER_ENDPOINT),requiredEnv:['SOLY_SITE_BROWSER_ENDPOINT'],optionalEnv:['SOLY_BROWSER_ALLOWED_DOMAINS']}};return plans[id]?json(res,200,{ok:true,id,...plans[id]}):json(res,404,{error:'connector_unknown'});}
    if(req.method==='GET'&&req.url==='/v1/connectors/probe'){ownerAuth.assertAuthenticated(req.headers);const base=await probeAccountConnectors();const results={...base};
      const auth=await oauthStatus();if(process.env.YOUTUBE_API_KEY){try{const p=new URLSearchParams({part:'snippet',chart:'mostPopular',regionCode:'EG',maxResults:'1',key:process.env.YOUTUBE_API_KEY});await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${p}`);results.youtube={state:auth.providers.google.connected?'healthy':'configured',checkedAt:new Date().toISOString(),note:auth.providers.google.connected?'public + owner analytics ready':'public research ready; owner analytics needs Google OAuth'};}catch(error){results.youtube={state:'degraded',error:String(error?.message||error)};}}else if(process.env.YOUTUBE_OAUTH_TOKEN||auth.providers.google.connected)results.youtube={state:'configured',note:'owner analytics connected; public search API key optional'};else results.youtube={state:'not-connected'};
      results.google_analytics=(auth.providers.google.connected&&process.env.GOOGLE_GA4_PROPERTY_ID)?{state:'configured',note:'GA4 read-only property configured'}:{state:'not-connected',note:'needs Google OAuth + GOOGLE_GA4_PROPERTY_ID'};
      results.openai=process.env.OPENAI_API_KEY?{state:'configured'}:{state:'not-connected'};results.googleAI=process.env.GEMINI_API_KEY?{state:'configured'}:{state:'not-connected'};results.canva=process.env.CANVA_ACCESS_TOKEN?{state:'configured'}:{state:'not-connected'};results.github=(process.env.GITHUB_TOKEN&&process.env.SOLY_REPO_OWNER&&process.env.SOLY_REPO_NAME)?{state:'configured'}:{state:'not-connected'};return json(res,200,{ok:true,checkedAt:new Date().toISOString(),connectors:results});}
    if(req.method==='POST'&&req.url==='/v1/tools/execute'){ownerAuth.assertAuthenticated(req.headers);const request=await body(req);const result=await executeToolRequest(request,{scopes:scopes(req),confirmed:confirmed(req),estimatedCostUsd:Number(request.estimatedCostUsd||0),maxCostUsd:maxCost(req),executors:adapters});return json(res,200,result);}
    if(req.method==='POST'&&req.url==='/v1/jobs'){ownerAuth.assertAuthenticated(req.headers);const input=await body(req);const jobs=await readJobs();const job={jobId:input.jobId||`job-${Date.now()}`,state:'RECEIVED',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...input};jobs.unshift(job);await writeJobs(jobs.slice(0,500));return json(res,201,job);}
    const jobMatch=req.url?.match(/^\/v1\/jobs\/([^/]+)$/); if(req.method==='GET'&&jobMatch){ownerAuth.assertAuthenticated(req.headers);const jobs=await readJobs();const job=jobs.find(j=>j.jobId===decodeURIComponent(jobMatch[1]));return job?json(res,200,job):json(res,404,{error:'job_not_found'});}
    const approvalMatch=req.url?.match(/^\/v1\/jobs\/([^/]+)\/approve$/); if(req.method==='POST'&&approvalMatch){ownerAuth.assertAuthenticated(req.headers);const patch=await body(req);const jobs=await readJobs();const idx=jobs.findIndex(j=>j.jobId===decodeURIComponent(approvalMatch[1]));if(idx<0)return json(res,404,{error:'job_not_found'});jobs[idx]={...jobs[idx],approvals:[...(jobs[idx].approvals||[]),{...patch,at:new Date().toISOString()}],updatedAt:new Date().toISOString()};await writeJobs(jobs);return json(res,200,jobs[idx]);}
    if(await serveWeb(req,res))return;
    return json(res,404,{error:'not_found'});
  }catch(error){if(error instanceof GatewayError)return json(res,error.status,{error:error.code,message:error.message});if(error?.status&&error?.code)return json(res,error.status,{error:error.code,message:String(error.message||error)});return json(res,500,{error:'gateway_internal_error',message:String(error?.message||error)});}
});
server.listen(PORT,()=>console.log(`Soly AI Gateway ${VERSION} listening on ${PORT}`));
