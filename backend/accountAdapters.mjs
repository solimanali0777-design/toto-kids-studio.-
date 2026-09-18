import { createSign } from 'node:crypto';
import { getStoredRefreshToken } from './oauthBroker.mjs';

function adapterError(code,message,status=502){const e=new Error(message);e.code=code;e.status=status;return e;}
async function fetchJson(url,options={}){const r=await fetch(url,options);const data=await r.json().catch(()=>({}));if(!r.ok)throw adapterError(data?.error?.message||data?.error||`HTTP_${r.status}`,data?.error_description||data?.error?.message||data?.message||`HTTP ${r.status}`,r.status);return data;}
function required(name,label=name){const v=process.env[name];if(!v)throw adapterError('adapter_unavailable',`${label} is not configured`,503);return v;}
function b64url(input){return Buffer.from(input).toString('base64url');}

let googleTokenCache={token:null,exp:0};
export async function googleAccessToken(){
  if(googleTokenCache.token && googleTokenCache.exp>Date.now()+60_000)return googleTokenCache.token;
  const refresh=process.env.GMAIL_OAUTH_REFRESH_TOKEN||process.env.GOOGLE_REFRESH_TOKEN||await getStoredRefreshToken('google');
  const clientId=required('GOOGLE_OAUTH_CLIENT_ID','Google OAuth client');
  const clientSecret=required('GOOGLE_OAUTH_CLIENT_SECRET','Google OAuth secret');
  if(!refresh)throw adapterError('adapter_unavailable','Google refresh token is not configured',503);
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:'refresh_token'});
  const data=await fetchJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  googleTokenCache={token:data.access_token,exp:Date.now()+Number(data.expires_in||3000)*1000};
  return googleTokenCache.token;
}

let msTokenCache={token:null,exp:0};
export async function microsoftAccessToken(){
  if(msTokenCache.token && msTokenCache.exp>Date.now()+60_000)return msTokenCache.token;
  const tenant=process.env.MICROSOFT_TENANT_ID||'common';
  const clientId=required('MICROSOFT_CLIENT_ID','Microsoft client');
  const clientSecret=required('MICROSOFT_CLIENT_SECRET','Microsoft secret');
  const refresh=process.env.MICROSOFT_REFRESH_TOKEN||await getStoredRefreshToken('microsoft');
  if(!refresh)throw adapterError('adapter_unavailable','Microsoft refresh token is not configured',503);
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:'refresh_token',scope:'openid profile email offline_access User.Read Mail.Read Files.ReadWrite.All Sites.Read.All'});
  const data=await fetchJson(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  msTokenCache={token:data.access_token,exp:Date.now()+Number(data.expires_in||3000)*1000};
  return msTokenCache.token;
}

let playTokenCache={token:null,exp:0};
async function googlePlayAccessToken(){
  if(playTokenCache.token && playTokenCache.exp>Date.now()+60_000)return playTokenCache.token;
  const raw=required('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON','Google Play service account');
  let sa;try{sa=JSON.parse(raw)}catch{throw adapterError('config_error','GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be valid JSON',500)}
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const input=`${header}.${claim}`;
  const signer=createSign('RSA-SHA256');signer.update(input);signer.end();
  const assertion=`${input}.${signer.sign(sa.private_key).toString('base64url')}`;
  const body=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion});
  const data=await fetchJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  playTokenCache={token:data.access_token,exp:Date.now()+Number(data.expires_in||3000)*1000};
  return playTokenCache.token;
}

function browserAllowedHost(url){
  const endpoint=required('SOLY_SITE_BROWSER_ENDPOINT','Browser broker endpoint');
  const target=new URL(url);
  const allowed=String(process.env.SOLY_BROWSER_ALLOWED_DOMAINS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(allowed.length && !allowed.some(d=>target.hostname===d||target.hostname.endsWith(`.${d}`)))throw adapterError('domain_denied',`Browser target ${target.hostname} is not allowlisted`,403);
  return {endpoint,target};
}

export async function probeAccountConnectors(){
  const results={};
  const configuredGoogle=Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET&&(process.env.GMAIL_OAUTH_REFRESH_TOKEN||process.env.GOOGLE_REFRESH_TOKEN||await getStoredRefreshToken('google')));
  if(configuredGoogle){
    try{const token=await googleAccessToken();await fetchJson('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:`Bearer ${token}`}});results.gmail={state:'healthy',checkedAt:new Date().toISOString()};}
    catch(error){results.gmail={state:'degraded',error:String(error?.code||error?.message||error)};}
    try{const token=await googleAccessToken();await fetchJson('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',{headers:{Authorization:`Bearer ${token}`}});results.google_workspace={state:'healthy',checkedAt:new Date().toISOString()};}
    catch(error){results.google_workspace={state:'degraded',error:String(error?.code||error?.message||error)};}
  }else{results.gmail={state:'not-connected'};results.google_workspace={state:'not-connected'};}

  const configuredMicrosoft=Boolean(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET&&(process.env.MICROSOFT_REFRESH_TOKEN||await getStoredRefreshToken('microsoft')));
  if(configuredMicrosoft){
    try{const token=await microsoftAccessToken();await fetchJson('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName',{headers:{Authorization:`Bearer ${token}`}});results.microsoft365={state:'healthy',checkedAt:new Date().toISOString()};}
    catch(error){results.microsoft365={state:'degraded',error:String(error?.code||error?.message||error)};}
  }else results.microsoft365={state:'not-connected'};

  if(process.env.SOLY_SITE_BROWSER_ENDPOINT)results.browser={state:'configured',note:'delegated browser endpoint configured; task-level health checked on use'};
  else results.browser={state:'not-connected'};

  const configuredPlay=Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON&&process.env.GOOGLE_PLAY_PACKAGE_NAME);
  if(configuredPlay){
    try{await googlePlayAccessToken();results.google_play={state:'healthy',checkedAt:new Date().toISOString()};}
    catch(error){results.google_play={state:'degraded',error:String(error?.code||error?.message||error)};}
  }else results.google_play={state:'not-connected'};
  return results;
}

export function createAccountAdapters(){
  return {
    'gmail.task.search':async args=>{
      const token=await googleAccessToken();
      const q=String(args.q||'').trim();if(!q)throw adapterError('schema_error','q is required',400);
      const p=new URLSearchParams({q,maxResults:String(Math.max(1,Math.min(20,Number(args.limit||10))))});
      const list=await fetchJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${p}`,{headers:{Authorization:`Bearer ${token}`}});
      const items=[];
      for(const row of (list.messages||[]).slice(0,20)){
        const m=await fetchJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(row.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,{headers:{Authorization:`Bearer ${token}`}});
        const headers=Object.fromEntries((m.payload?.headers||[]).map(h=>[String(h.name||'').toLowerCase(),h.value]));
        items.push({id:m.id,threadId:m.threadId,from:headers.from||'',to:headers.to||'',subject:headers.subject||'',date:headers.date||'',snippet:m.snippet||''});
      }
      return {adapter:'gmail-api',mode:'metadata-only',items};
    },
    'gmail.verification.locate':async args=>{
      const token=await googleAccessToken();
      const q=String(args.q||'newer_than:1d (verification OR verify OR confirm OR تأكيد OR تحقق)');
      const p=new URLSearchParams({q,maxResults:String(Math.max(1,Math.min(10,Number(args.limit||5))))});
      const list=await fetchJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${p}`,{headers:{Authorization:`Bearer ${token}`}});
      return {adapter:'gmail-api',status:(list.messages||[]).length?'verification-message-found':'none-found',messageIds:(list.messages||[]).map(x=>x.id),secretExtraction:false,otpOwnerControlled:true};
    },
    'google.drive.project.list':async args=>{
      const token=await googleAccessToken();
      const q=String(args.q||"trashed = false");
      const p=new URLSearchParams({q,pageSize:String(Math.max(1,Math.min(100,Number(args.limit||30)))),fields:'files(id,name,mimeType,modifiedTime,size,webViewLink,parents)'});
      return {adapter:'google-drive-api',...(await fetchJson(`https://www.googleapis.com/drive/v3/files?${p}`,{headers:{Authorization:`Bearer ${token}`}}))};
    },
    'm365.mail.search':async args=>{
      const token=await microsoftAccessToken();
      const q=String(args.q||'').trim();if(!q)throw adapterError('schema_error','q is required',400);
      const top=Math.max(1,Math.min(25,Number(args.limit||10)));
      const url=`https://graph.microsoft.com/v1.0/me/messages?$search=${encodeURIComponent(`\"${q}\"`)}&$top=${top}&$select=id,subject,from,receivedDateTime,bodyPreview,webLink`;
      const data=await fetchJson(url,{headers:{Authorization:`Bearer ${token}`,ConsistencyLevel:'eventual'}});
      return {adapter:'microsoft-graph',items:(data.value||[]).map(x=>({id:x.id,subject:x.subject||'',from:x.from?.emailAddress?.address||'',receivedAt:x.receivedDateTime||null,preview:x.bodyPreview||'',webLink:x.webLink||null}))};
    },
    'm365.drive.list':async args=>{
      const token=await microsoftAccessToken();
      const path=String(args.path||'root').replace(/^\/+|\/+$/g,'');
      const endpoint=path==='root'?'https://graph.microsoft.com/v1.0/me/drive/root/children':`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURI(path)}:/children`;
      const data=await fetchJson(endpoint,{headers:{Authorization:`Bearer ${token}`}});
      return {adapter:'microsoft-graph',items:(data.value||[]).map(x=>({id:x.id,name:x.name,folder:Boolean(x.folder),file:Boolean(x.file),size:x.size||0,webUrl:x.webUrl||null,lastModifiedDateTime:x.lastModifiedDateTime||null}))};
    },
    'browser.session.task':async args=>{
      if(args.containsPayment||args.containsCard||args.accessPersonalMedia||args.phoneOrMessaging)throw adapterError('owner_hard_block','Payment cards, personal media, calls and personal messaging are blocked',403);
      const {endpoint,target}=browserAllowedHost(String(args.url||''));
      const payload={taskId:args.taskId||`browser_${Date.now()}`,url:target.toString(),goal:String(args.goal||''),sessionRef:args.sessionRef||null,allowSignup:Boolean(args.allowSignup),allowStandardFreeTerms:Boolean(args.allowStandardFreeTerms),stopAt:['payment','card','banking','production-publish','social-publish','otp','mfa','captcha','account-security-change'],privateMedia:'blocked'};
      return {adapter:'delegated-browser-broker',...(await fetchJson(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}))};
    },
    'googleplay.track.read':async args=>{
      const token=await googlePlayAccessToken();
      const packageName=String(args.packageName||process.env.GOOGLE_PLAY_PACKAGE_NAME||'');if(!packageName)throw adapterError('schema_error','packageName is required',400);
      const track=String(args.track||process.env.GOOGLE_PLAY_TRACK||'qa');
      const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/tracks/${encodeURIComponent(track)}/releases`;
      return {adapter:'android-publisher',packageName,track,...(await fetchJson(url,{headers:{Authorization:`Bearer ${token}`}}))};
    },
    'googleplay.draft.release':async args=>{
      const token=await googlePlayAccessToken();
      const packageName=String(args.packageName||process.env.GOOGLE_PLAY_PACKAGE_NAME||'');if(!packageName)throw adapterError('schema_error','packageName is required',400);
      const track=String(args.track||process.env.GOOGLE_PLAY_TRACK||'qa');
      if(track==='production')throw adapterError('approval_required','Production publishing requires explicit owner approval and a separate publish tool',409);
      const versionCodes=(args.versionCodes||[]).map(String).filter(Boolean);if(!versionCodes.length)throw adapterError('schema_error','versionCodes are required',400);
      const edit=await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
      const release={name:String(args.name||'Soly draft release'),versionCodes,status:'draft',releaseNotes:Array.isArray(args.releaseNotes)?args.releaseNotes:[]};
      const updated=await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(edit.id)}/tracks/${encodeURIComponent(track)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({track,releases:[release]})});
      const committed=await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(edit.id)}:commit`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
      return {adapter:'android-publisher',packageName,track,editId:edit.id,status:'draft-committed',release:updated,commitId:committed.id||edit.id,publicProduction:false};
    },
    'googleplay.production.publish':async args=>{
      if(String(process.env.GOOGLE_PLAY_PRODUCTION_PUBLISH||'false')!=='true')throw adapterError('production_publish_disabled','Production publishing is disabled by owner policy/env switch',403);
      const token=await googlePlayAccessToken();
      const packageName=String(args.packageName||process.env.GOOGLE_PLAY_PACKAGE_NAME||'');if(!packageName)throw adapterError('schema_error','packageName is required',400);
      const track='production';
      const versionCodes=(args.versionCodes||[]).map(String).filter(Boolean);if(!versionCodes.length)throw adapterError('schema_error','versionCodes are required',400);
      const edit=await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
      const release={name:String(args.name||'Soly production release'),versionCodes,status:'completed',releaseNotes:Array.isArray(args.releaseNotes)?args.releaseNotes:[]};
      const updated=await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(edit.id)}/tracks/${encodeURIComponent(track)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({track,releases:[release]})});
      const committed=await fetchJson(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(edit.id)}:commit`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
      return {adapter:'android-publisher',packageName,track,editId:edit.id,status:'production-committed-after-owner-confirmation',release:updated,commitId:committed.id||edit.id,publicProduction:true};
    },
    'opportunity.official.scan':async args=>{
      const key=required('GEMINI_API_KEY','Gemini');
      const model=String(process.env.SOLY_GEMINI_MODEL||'gemini-3.8-flash');
      const query=String(args.query||'official free or education offers for AI, design, cloud, developer and creator tools relevant to a YouTube kids production studio in Egypt');
      const prompt=`Search current official provider sources only. Find legitimate free tiers, educational/teacher/student programs, trials that need NO payment card, grants, credits, or creator/developer offers relevant to Toto Kids Studio. Do not suggest misrepresenting eligibility or duplicate-account abuse. Return concise JSON array with provider,title,official_url,eligibility,cost_usd,requires_payment_method,expires_at,value,why_useful. User context: Egypt. Query: ${query}`;
      const payload={contents:[{parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json'}};
      const data=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
      const chunks=data.candidates?.[0]?.groundingMetadata?.groundingChunks||[];
      const citations=chunks.map(c=>({title:c.web?.title||'',url:c.web?.uri||''})).filter(x=>x.url);
      let items=[];try{items=JSON.parse(text)}catch{items=[{raw:text}]}
      return {adapter:'gemini-google-search-grounding',model,capturedAt:new Date().toISOString(),items:Array.isArray(items)?items:[items],citations,rule:'official-sources-only; verify eligibility before auto-enroll'};
    },
  };
}
