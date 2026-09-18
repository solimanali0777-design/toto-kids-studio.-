import { createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { durableConfigured, durableGet, durablePut, durableList, durableBlobPut, durableBlobGet } from './durableStore.mjs';

const SAFE=/^[a-zA-Z0-9._-]+$/;
const sha256Hex=value=>createHash('sha256').update(value).digest('hex');
const checksum=value=>`sha256:${sha256Hex(value)}`;
const safeId=(value,label)=>{const v=String(value||'');if(!SAFE.test(v))throw Object.assign(new Error(`${label}_invalid`),{code:'schema_error',status:400});return v;};
const maxBytes=()=>Math.max(1024,Number(process.env.SOLY_STORAGE_MAX_BYTES||25*1024*1024));
const rootDir=()=>resolve(process.env.SOLY_STORAGE_ROOT||process.env.SOLY_DATA_DIR||'/tmp/soly-workspace');

function assertInside(path){const root=rootDir();const full=resolve(path);if(full!==root&&!full.startsWith(`${root}/`))throw Object.assign(new Error('storage_path_denied'),{code:'path_denied',status:403});return full;}
function assetBase({workspaceId,projectId,assetId}){return assertInside(join(rootDir(),'workspaces',safeId(workspaceId,'workspaceId'),'projects',safeId(projectId,'projectId'),'assets',safeId(assetId,'assetId')));}
function s3Configured(){return Boolean(process.env.SOLY_S3_ENDPOINT&&process.env.SOLY_S3_BUCKET&&process.env.SOLY_S3_ACCESS_KEY_ID&&process.env.SOLY_S3_SECRET_ACCESS_KEY&&process.env.SOLY_S3_REGION);}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function hmac(key,data,encoding){return createHmac('sha256',key).update(data).digest(encoding);}
function amzDate(date=new Date()){return date.toISOString().replace(/[:-]|\.\d{3}/g,'');}
function dateStamp(amz){return amz.slice(0,8);}
function s3Url(key){const endpoint=String(process.env.SOLY_S3_ENDPOINT).replace(/\/$/,'');const bucket=encodeURIComponent(process.env.SOLY_S3_BUCKET);return `${endpoint}/${bucket}/${encodePath(key)}`;}
function signS3({method,key,body=Buffer.alloc(0),headers={}}){
  const url=new URL(s3Url(key));const now=amzDate();const ds=dateStamp(now);const region=process.env.SOLY_S3_REGION;const service='s3';
  const payloadHash=sha256Hex(body);const baseHeaders={host:url.host,'x-amz-content-sha256':payloadHash,'x-amz-date':now,...Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),String(v).trim()]))};
  const names=Object.keys(baseHeaders).sort();const canonicalHeaders=names.map(k=>`${k}:${baseHeaders[k]}\n`).join('');const canonicalRequest=[method,url.pathname,url.searchParams.toString(),canonicalHeaders,names.join(';'),payloadHash].join('\n');
  const scope=`${ds}/${region}/${service}/aws4_request`;const stringToSign=['AWS4-HMAC-SHA256',now,scope,sha256Hex(canonicalRequest)].join('\n');
  const kDate=hmac(`AWS4${process.env.SOLY_S3_SECRET_ACCESS_KEY}`,ds);const kRegion=hmac(kDate,region);const kService=hmac(kRegion,service);const kSigning=hmac(kService,'aws4_request');const signature=hmac(kSigning,stringToSign,'hex');
  return {url:url.toString(),headers:{...baseHeaders,Authorization:`AWS4-HMAC-SHA256 Credential=${process.env.SOLY_S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`}};
}
async function s3Request(method,key,body=Buffer.alloc(0),headers={}){const signed=signS3({method,key,body,headers});const res=await fetch(signed.url,{method,headers:signed.headers,body:['GET','HEAD'].includes(method)?undefined:body});if(!res.ok)throw Object.assign(new Error(`s3_${method.toLowerCase()}_${res.status}`),{code:'storage_error',status:502});return res;}

export function storageCapability(){
  if(durableConfigured())return {backend:'supabase',durability:'durable',remote:true,configured:true};
  if(s3Configured())return {backend:'s3-compatible',durability:'durable',remote:true,configured:true};
  const durable=String(process.env.SOLY_STORAGE_DURABILITY||'ephemeral')==='durable';
  return {backend:'filesystem',durability:durable?'durable':'ephemeral',remote:false,configured:true,root:rootDir()};
}

export async function persistWorkspaceAsset({workspaceId,projectId,assetId,contentBase64,contentType='application/octet-stream',checksum:expectedChecksum=null,classification='unknown',metadata={}}={}){
  if(classification==='personal')throw Object.assign(new Error('personal-media-hard-block'),{code:'privacy_block',status:403});
  if(classification!=='project')throw Object.assign(new Error('project-classification-required'),{code:'privacy_block',status:403});
  const bytes=Buffer.from(String(contentBase64||''),'base64');if(!bytes.length)throw Object.assign(new Error('asset-bytes-required'),{code:'schema_error',status:400});if(bytes.length>maxBytes())throw Object.assign(new Error('asset-too-large'),{code:'payload_too_large',status:413});
  const actual=checksum(bytes);if(expectedChecksum&&String(expectedChecksum)!==actual)throw Object.assign(new Error('checksum-mismatch'),{code:'checksum_mismatch',status:409});
  const versionId=`v-${Date.now()}-${actual.slice(7,19)}`;const cap=storageCapability();const storageStatus=cap.backend==='s3-compatible'?'remote-verified':cap.durability==='durable'?'persisted':'persisted-ephemeral';const meta={workspaceId:safeId(workspaceId,'workspaceId'),projectId:safeId(projectId,'projectId'),assetId:safeId(assetId,'assetId'),versionId,checksum:actual,byteLength:bytes.length,contentType:String(contentType),classification,rights:metadata.rights||null,provenance:metadata.provenance||null,createdAt:new Date().toISOString(),storageBackend:cap.backend,durability:cap.durability,storageStatus};
  if(cap.backend==='supabase'){const k=`${meta.workspaceId}/${meta.projectId}/${meta.assetId}/${versionId}`;await durableBlobPut('workspace',k,contentBase64,meta.contentType,actual,meta);await durablePut('workspace-meta',`${meta.workspaceId}/${meta.projectId}/${meta.assetId}`,meta);const verify=await durableBlobGet('workspace',k);if(!verify.found||checksum(Buffer.from(verify.contentBase64,'base64'))!==actual)throw Object.assign(new Error('remote-post-write-checksum-mismatch'),{code:'checksum_mismatch',status:500});return {...meta,objectKey:k,remoteVerifiedAt:new Date().toISOString()};}
  if(cap.backend==='s3-compatible'){
    const prefix=`workspaces/${meta.workspaceId}/projects/${meta.projectId}/assets/${meta.assetId}/${versionId}`;
    await s3Request('PUT',`${prefix}/blob`,bytes,{'content-type':meta.contentType,'x-amz-meta-sha256':actual.slice(7)});
    await s3Request('PUT',`${prefix}/meta.json`,Buffer.from(JSON.stringify(meta)),{'content-type':'application/json'});
    const verifyBytes=Buffer.from(await (await s3Request('GET',`${prefix}/blob`)).arrayBuffer());
    if(checksum(verifyBytes)!==actual)throw Object.assign(new Error('remote-post-write-checksum-mismatch'),{code:'checksum_mismatch',status:500});
    return {...meta,objectKey:`${prefix}/blob`,remoteVerifiedAt:new Date().toISOString()};
  }
  const base=assetBase(meta);await mkdir(base,{recursive:true});const blob=assertInside(join(base,`${versionId}.blob`));const metaPath=assertInside(join(base,`${versionId}.json`));await writeFile(blob,bytes);await writeFile(metaPath,JSON.stringify(meta,null,2));const verify=await readFile(blob);if(checksum(verify)!==actual)throw Object.assign(new Error('post-write-checksum-mismatch'),{code:'checksum_mismatch',status:500});return {...meta,path:blob};
}

export async function readWorkspaceAsset({workspaceId,projectId,assetId,versionId,includeContent=false}={}){
  safeId(workspaceId,'workspaceId');safeId(projectId,'projectId');safeId(assetId,'assetId');if(versionId)safeId(versionId,'versionId');const cap=storageCapability();
  if(cap.backend==='supabase'){let meta=versionId?null:await durableGet('workspace-meta',`${workspaceId}/${projectId}/${assetId}`);const vid=versionId||meta?.versionId;if(!vid)throw Object.assign(new Error('asset_not_found'),{code:'not_found',status:404});const out=await durableBlobGet('workspace',`${workspaceId}/${projectId}/${assetId}/${vid}`);if(!out.found)throw Object.assign(new Error('asset_not_found'),{code:'not_found',status:404});meta=meta||out.meta?.metadata||{};if(!includeContent)return meta;const bytes=Buffer.from(out.contentBase64,'base64');if(meta.checksum&&checksum(bytes)!==meta.checksum)throw Object.assign(new Error('remote-read-checksum-mismatch'),{code:'checksum_mismatch',status:502});return {...meta,contentBase64:out.contentBase64,readVerifiedAt:new Date().toISOString()};}
  if(cap.backend==='s3-compatible'){
    if(!versionId)throw Object.assign(new Error('versionId_required_for_remote_read'),{code:'schema_error',status:400});const prefix=`workspaces/${workspaceId}/projects/${projectId}/assets/${assetId}/${versionId}`;const meta=await (await s3Request('GET',`${prefix}/meta.json`)).json();if(!includeContent)return meta;const bytes=Buffer.from(await (await s3Request('GET',`${prefix}/blob`)).arrayBuffer());if(meta.checksum&&checksum(bytes)!==meta.checksum)throw Object.assign(new Error('remote-read-checksum-mismatch'),{code:'checksum_mismatch',status:502});return {...meta,contentBase64:bytes.toString('base64'),readVerifiedAt:new Date().toISOString()};
  }
  const base=assetBase({workspaceId,projectId,assetId});const entries=await readdir(base).catch(()=>[]);const metas=entries.filter(x=>x.endsWith('.json')).sort().reverse();const target=versionId?`${versionId}.json`:metas[0];if(!target)throw Object.assign(new Error('asset_not_found'),{code:'not_found',status:404});const meta=JSON.parse(await readFile(assertInside(join(base,target)),'utf8'));if(!includeContent)return meta;const bytes=await readFile(assertInside(join(base,`${meta.versionId}.blob`)));return {...meta,contentBase64:bytes.toString('base64')};
}

export async function createProjectVersion({workspaceId,projectId,label='snapshot',manifestChecksum=null}={}){
  safeId(workspaceId,'workspaceId');safeId(projectId,'projectId');const versionId=`pv-${Date.now()}`;if(durableConfigured()){const rows=await durableList('workspace-meta',`${workspaceId}/${projectId}/`);const assets=rows.map(x=>x.value);const manifest={versionId,label:String(label),manifestChecksum,workspaceId,projectId,assets:assets.map(x=>({assetId:x.assetId,versionId:x.versionId,checksum:x.checksum,contentType:x.contentType})),createdAt:new Date().toISOString()};await durablePut('project-version',`${workspaceId}/${projectId}/${versionId}`,manifest);return manifest;}const base=assertInside(join(rootDir(),'workspaces',workspaceId,'projects',projectId));const assetsDir=assertInside(join(base,'assets'));const assetIds=await readdir(assetsDir).catch(()=>[]);const assets=[];
  for(const assetId of assetIds){try{assets.push(await readWorkspaceAsset({workspaceId,projectId,assetId}));}catch{}}
  const manifest={versionId,label:String(label),manifestChecksum,workspaceId,projectId,assets:assets.map(x=>({assetId:x.assetId,versionId:x.versionId,checksum:x.checksum,contentType:x.contentType})),createdAt:new Date().toISOString()};const versionsDir=assertInside(join(base,'versions'));await mkdir(versionsDir,{recursive:true});await writeFile(assertInside(join(versionsDir,`${versionId}.json`)),JSON.stringify(manifest,null,2));return manifest;
}

export async function restoreProjectVersion({workspaceId,projectId,versionId}={}){
  safeId(workspaceId,'workspaceId');safeId(projectId,'projectId');safeId(versionId,'versionId');if(durableConfigured()){const manifest=await durableGet('project-version',`${workspaceId}/${projectId}/${versionId}`);if(!manifest)throw Object.assign(new Error('version_not_found'),{code:'not_found',status:404});return {restored:false,planOnly:true,manifest,note:'Restore is intentionally plan-only until an owner-confirmed restore executor is attached.'};}if(storageCapability().backend==='s3-compatible')throw Object.assign(new Error('remote-restore-not-yet-enabled'),{code:'adapter_unavailable',status:503});const file=assertInside(join(rootDir(),'workspaces',workspaceId,'projects',projectId,'versions',`${versionId}.json`));const manifest=JSON.parse(await readFile(file,'utf8'));return {restored:false,planOnly:true,manifest,note:'Restore is intentionally plan-only until an owner-confirmed restore executor is attached.'};
}

export const __test={checksum,signS3};
