const BASE=(import.meta.env.VITE_GATEWAY_URL||window.location.origin).replace(/\/$/,'');
async function request(path:string,method:'GET'|'POST',body?:unknown){
  const r=await fetch(BASE+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error((data as any)?.message||(data as any)?.error||('HTTP '+r.status)),{status:r.status,data});
  return {data};
}
export const api={get:(path:string)=>request(path,'GET'),post:(path:string,body?:unknown)=>request(path,'POST',body)};
