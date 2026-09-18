const BASE=(import.meta.env.VITE_GATEWAY_URL||window.location.origin).replace(/\/$/,'');
async function request(path:string,method:'GET'|'POST',body?:unknown,extraHeaders:Record<string,string>={}){
  const r=await fetch(BASE+path,{method,headers:{'content-type':'application/json',...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error((data as any)?.message||(data as any)?.error||('HTTP '+r.status)),{status:r.status,data});
  return {data};
}
export const api={
  get:(path:string)=>request(path,'GET'),
  post:(path:string,body?:unknown)=>request(path,'POST',body),
  tool:(toolId:string,args:unknown,scopes:string[])=>request('/v1/tools/execute','POST',{toolId,args,estimatedCostUsd:0},{
    'X-Soly-Scopes':scopes.join(','),
    'X-Soly-Confirmed':'false',
    'X-Soly-Max-Cost':'0',
  }),
};
