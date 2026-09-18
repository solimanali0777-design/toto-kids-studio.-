import { readWorkspaceAsset } from './workspaceStorage.mjs';

const RULES=['face_consistency','eye_consistency','limb_integrity','object_overlap','text_artifacts','character_identity','safe_crop'];
const cleanJson=text=>{const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(raw);};
function normalize(value){const checks={};for(const rule of RULES)checks[rule]=value?.checks?.[rule]===true||value?.checks?.[rule]==='passed';return {executed:true,source:value?.source||'gemini-vision',model:value?.model||null,checks,notes:Array.isArray(value?.notes)?value.notes.map(String).slice(0,20):[]};}

export async function runVisionQa({workspaceId,projectId,assetId,versionId,characterIds=[]}={}){
  const key=process.env.GEMINI_API_KEY;const model=process.env.SOLY_GEMINI_VISION_MODEL;if(!key||!model)throw Object.assign(new Error('vision-provider-not-configured'),{code:'adapter_unavailable',status:503});
  const asset=await readWorkspaceAsset({workspaceId,projectId,assetId,versionId,includeContent:true});if(asset.classification!=='project')throw Object.assign(new Error('vision-project-assets-only'),{code:'privacy_block',status:403});if(!String(asset.contentType||'').startsWith('image/'))throw Object.assign(new Error('vision-image-required'),{code:'schema_error',status:400});
  const prompt=`You are a strict visual QA evaluator for a children's animation production asset. Return JSON only with {"checks":{"face_consistency":boolean,"eye_consistency":boolean,"limb_integrity":boolean,"object_overlap":boolean,"text_artifacts":boolean,"character_identity":boolean,"safe_crop":boolean},"notes":string[]}. True means the check PASSED. Be conservative. Expected characters: ${characterIds.join(', ')||'not specified'}. Reject malformed anatomy, inconsistent identity, accidental text/logos, unsafe crop, or impossible overlaps.`;
  const payload={contents:[{parts:[{text:prompt},{inlineData:{mimeType:asset.contentType,data:asset.contentBase64}}]}],generationConfig:{responseMimeType:'application/json',temperature:0}};
  const base=String(process.env.SOLY_GEMINI_BASE_URL||'https://generativelanguage.googleapis.com').replace(/\/$/,'');
  const r=await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data?.error?.message||`vision-http-${r.status}`),{code:'adapter_error',status:r.status});const text=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';const parsed=cleanJson(text);return normalize({...parsed,source:'gemini-vision',model});
}

export const __test={cleanJson,normalize};
