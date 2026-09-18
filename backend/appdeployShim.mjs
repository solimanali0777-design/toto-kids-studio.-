import { durableBlobPut, durableBlobGet } from './durableStore.mjs';

export const secrets={
  async readSecret(name){
    const value=String(process.env[name]||'').trim();
    if(!value)throw Object.assign(new Error(`${name} is not configured`),{status:503});
    return value;
  }
};

export const storage={
  async write(entries){
    const results=[];
    for(const entry of entries||[]){
      try{
        const content=String(entry?.content||'');
        await durableBlobPut('generated-media',String(entry.path||''),content,String(entry.contentType||'application/octet-stream'),null,{source:'toto-compat'});
        results.push(true);
      }catch{results.push(false);}
    }
    return results;
  },
  async read(paths){
    const results=[];
    for(const path of paths||[]){
      try{
        const out=await durableBlobGet('generated-media',String(path));
        results.push(out?.found?{content:out.contentBase64,contentType:out.meta?.content_type||'application/octet-stream'}:{content:null});
      }catch{results.push({content:null});}
    }
    return results;
  },
  async url(paths){
    return (paths||[]).map(path=>({url:`/api/media/${encodeURIComponent(String(path))}`}));
  }
};

export const ai={
  async generate(){throw Object.assign(new Error('platform_fallback_unavailable'),{status:503});},
  async imageGen(){throw Object.assign(new Error('platform_image_fallback_unavailable'),{status:503});}
};

export function json(body,status=200){return {status,body};}
export function error(message,status=500){return {status,body:{error:'request_failed',message:String(message)}};}

export function router(routeMap){
  return async function handle({method,path,body}){
    const handlers=routeMap[`${method} ${path}`];
    if(!handlers||!handlers.length)return null;
    return await handlers[0]({body});
  };
}
