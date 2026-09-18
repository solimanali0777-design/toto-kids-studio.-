import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { getVaultRecord, putVaultRecord, tokenVaultStatus } from './oauthVault.mjs';

function fail(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;throw e;}
function required(name){const v=String(process.env[name]||'').trim();if(!v)fail('oauth_not_configured',`${name} is not configured`,503);return v;}
function publicBase(){return required('SOLY_PUBLIC_BASE_URL').replace(/\/$/,'');}

function stateSecret(){const v=String(process.env.SOLY_TOKEN_VAULT_KEY||'').trim();if(!v)fail('vault_not_configured','SOLY_TOKEN_VAULT_KEY is required before OAuth linking',503);return v;}
function signState(payload){const raw=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=createHmac('sha256',stateSecret()).update(raw).digest('base64url');return `${raw}.${sig}`;}
function verifyState(token){
  const [raw,sig]=String(token||'').split('.');if(!raw||!sig)fail('oauth_state_invalid','OAuth state is invalid',400);
  const expected=createHmac('sha256',stateSecret()).update(raw).digest();let got;try{got=Buffer.from(sig,'base64url')}catch{fail('oauth_state_invalid','OAuth state is invalid',400)}
  if(got.length!==expected.length||!timingSafeEqual(got,expected))fail('oauth_state_invalid','OAuth state signature is invalid',400);
  let payload;try{payload=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'))}catch{fail('oauth_state_invalid','OAuth state payload is invalid',400)}
  if(!payload?.provider||Number(payload.exp||0)<Date.now())fail('oauth_state_invalid','OAuth state is expired',400);return payload;
}

export function oauthProviderConfig(provider){
  if(provider==='google')return {
    provider:'google',clientIdEnv:'GOOGLE_OAUTH_CLIENT_ID',clientSecretEnv:'GOOGLE_OAUTH_CLIENT_SECRET',
    authorizeUrl:'https://accounts.google.com/o/oauth2/v2/auth',tokenUrl:'https://oauth2.googleapis.com/token',
    scopes:['openid','email','profile','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/yt-analytics.readonly','https://www.googleapis.com/auth/yt-analytics-monetary.readonly','https://www.googleapis.com/auth/analytics.readonly'],
  };
  if(provider==='microsoft')return {
    provider:'microsoft',clientIdEnv:'MICROSOFT_CLIENT_ID',clientSecretEnv:'MICROSOFT_CLIENT_SECRET',
    authorizeUrl:`https://login.microsoftonline.com/${encodeURIComponent(process.env.MICROSOFT_TENANT_ID||'common')}/oauth2/v2.0/authorize`,
    tokenUrl:`https://login.microsoftonline.com/${encodeURIComponent(process.env.MICROSOFT_TENANT_ID||'common')}/oauth2/v2.0/token`,
    scopes:['openid','profile','email','offline_access','User.Read','Mail.Read','Files.ReadWrite.All','Sites.Read.All'],
  };
  fail('oauth_provider_unknown',`Unsupported OAuth provider: ${provider}`,404);
}

export async function getStoredRefreshToken(provider){return (await getVaultRecord(`oauth:${provider}`))?.refreshToken||null;}

export async function oauthStatus(){
  const vault=tokenVaultStatus();
  const [google,microsoft]=await Promise.all([getStoredRefreshToken('google'),getStoredRefreshToken('microsoft')]);
  return {vault,providers:{google:{connected:Boolean(google||process.env.GMAIL_OAUTH_REFRESH_TOKEN||process.env.GOOGLE_REFRESH_TOKEN),clientConfigured:Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET)},microsoft:{connected:Boolean(microsoft||process.env.MICROSOFT_REFRESH_TOKEN),clientConfigured:Boolean(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET)}}};
}

export async function startOAuth(provider,{returnTo=''}={}){
  const cfg=oauthProviderConfig(provider);const clientId=required(cfg.clientIdEnv);required(cfg.clientSecretEnv);
  if(!tokenVaultStatus().configured)fail('vault_not_configured','SOLY_TOKEN_VAULT_KEY is required before OAuth linking',503);
  const redirectUri=`${publicBase()}/v1/oauth/${provider}/callback`;const state=signState({provider,redirectUri,returnTo:String(returnTo||''),exp:Date.now()+10*60_000,nonce:randomBytes(16).toString('base64url')});
  const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:cfg.scopes.join(' '),state});
  if(provider==='google'){p.set('access_type','offline');p.set('include_granted_scopes','true');p.set('prompt','consent');}
  if(provider==='microsoft')p.set('response_mode','query');
  return {provider,authorizationUrl:`${cfg.authorizeUrl}?${p}`,expiresInSec:600,redirectUri};
}

async function exchange(provider,code,redirectUri){
  const cfg=oauthProviderConfig(provider);const body=new URLSearchParams({client_id:required(cfg.clientIdEnv),client_secret:required(cfg.clientSecretEnv),code,redirect_uri:redirectUri,grant_type:'authorization_code'});
  if(provider==='microsoft')body.set('scope',cfg.scopes.join(' '));
  const r=await fetch(cfg.tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const data=await r.json().catch(()=>({}));
  if(!r.ok)fail('oauth_exchange_failed',data.error_description||data.error?.message||data.error||`HTTP ${r.status}`,502);
  return data;
}

export async function completeOAuth(provider,params){
  const error=params.get('error');if(error)fail('oauth_denied',params.get('error_description')||error,400);
  const state=params.get('state');const code=params.get('code');if(!state||!code)fail('oauth_callback_invalid','Missing OAuth state or code',400);
  const flow=verifyState(state);if(flow.provider!==provider)fail('oauth_state_invalid','OAuth provider does not match state',400);
  const tokens=await exchange(provider,code,flow.redirectUri);if(!tokens.refresh_token)fail('oauth_refresh_missing','Provider did not return a refresh token; reconnect with consent enabled',409);
  await putVaultRecord(`oauth:${provider}`,{provider,refreshToken:tokens.refresh_token,scope:tokens.scope||null,tokenType:tokens.token_type||null});
  return {provider,connected:true,scope:tokens.scope||null,returnTo:flow.returnTo};
}

export function oauthCallbackHtml({provider,ok,message=''}){
  const origin=String(process.env.SOLY_ALLOWED_ORIGIN||'*');
  const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const payload=JSON.stringify({type:'soly:oauth-complete',provider,ok,message}).replace(/</g,'\\u003c');
  return `<!doctype html><meta charset="utf-8"><title>Soly OAuth</title><body style="font-family:system-ui;background:#07101c;color:white;padding:32px"><h2>${ok?'تم الربط بنجاح':'تعذر الربط'}</h2><p>${esc(message||'يمكنك إغلاق النافذة والعودة إلى Toto Kids Studio.')}</p><script>try{window.opener&&window.opener.postMessage(${payload},${JSON.stringify(origin)});}catch{};setTimeout(()=>window.close(),1200)</script></body>`;
}
