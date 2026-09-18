const endpoint=()=>String(process.env.SOLY_DURABLE_ENDPOINT||'').replace(/\/$/,'');
const key=()=>String(process.env.SOLY_DURABLE_KEY||'');
export const durableConfigured=()=>Boolean(endpoint()&&key());
async function call(path,payload){if(!durableConfigured())throw new Error('durable_not_configured');const r=await fetch(endpoint()+path,{method:'POST',headers:{'content-type':'application/json','x-soly-durable-key':key()},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||('durable_http_'+r.status));return d;}
export async function durableGet(namespace,k){const d=await call('/kv/get',{namespace,key:k});return d.found?d.value:null;}
export async function durablePut(namespace,k,value){await call('/kv/put',{namespace,key:k,value});return true;}
export async function durableDelete(namespace,k){await call('/kv/delete',{namespace,key:k});return true;}
export async function durableList(namespace,prefix=''){const d=await call('/kv/list',{namespace,prefix});return d.items||[];}
export async function durableBlobPut(namespace,k,contentBase64,contentType,checksum,metadata){return call('/blob/put',{namespace,key:k,contentBase64,contentType,checksum,metadata});}
export async function durableBlobGet(namespace,k){return call('/blob/get',{namespace,key:k});}

export async function durableMediaPut(k,contentBase64,contentType){return call('/media/put',{key:k,contentBase64,contentType});}
