import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readWorkspaceAsset, persistWorkspaceAsset, storageCapability } from './workspaceStorage.mjs';
import { buildFrameRenderPlan } from '../src/services/frameRenderer.js';

const run=(bin,args,{timeoutMs=120000}={})=>new Promise((resolveRun,reject)=>{const p=spawn(bin,args,{stdio:['ignore','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{p.kill('SIGKILL');reject(Object.assign(new Error(`${bin}-timeout`),{code:'timeout',status:504}));},timeoutMs);p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Object.assign(new Error(`${bin}-failed:${err.slice(-3000)}`),{code:'render_error',status:502}));resolveRun({out,err});});});
const safeName=name=>{const n=String(name||'episode.mp4').replace(/[^a-zA-Z0-9._-]/g,'_');return n.endsWith('.mp4')?n:`${n}.mp4`;};
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const fmt=n=>Number(n).toFixed(6);
const visualTracks=new Set(['video','image','overlay']);
const audioTracks=new Set(['audio','sfx']);

function endpoints(keyframes=[],prop,def){
  const pts=(keyframes||[]).filter(k=>Number.isFinite(Number(k.atMs))&&Number.isFinite(Number(k.values?.[prop]))).sort((a,b)=>a.atMs-b.atMs);
  if(!pts.length)return {a:def,b:def};return {a:Number(pts[0].values[prop]),b:Number(pts[pts.length-1].values[prop])};
}
function linear(a,b,durationSec){if(Math.abs(a-b)<1e-9)return fmt(a);return `(${fmt(a)}+(${fmt(b-a)})*min(max(t/${fmt(Math.max(.001,durationSec))},0),1))`;}
function visualFilter(c,input,width,height,index){
  const dur=num(c.durationMs)/1000; const start=num(c.startMs)/1000; const keyframes=c.keyframes||[]; const hasMotion=keyframes.some(k=>['x','y','scale'].some(p=>Number.isFinite(Number(k.values?.[p]))));
  const label=`v${index}`; const parts=[`[${input}:v]trim=duration=${fmt(dur)},setpts=PTS-STARTPTS`];
  let x='0',y='0';
  if(hasMotion){
    const sc=endpoints(keyframes,'scale',1), xp=endpoints(keyframes,'x',0), yp=endpoints(keyframes,'y',0);
    parts.push(`scale=w='${width}*${linear(sc.a,sc.b,dur)}':h=-2:eval=frame`,'format=rgba');
    x=`(W-w)/2+(${linear(xp.a,xp.b,dur)})*W/2`; y=`(H-h)/2+(${linear(yp.a,yp.b,dur)})*H/2`;
  }else parts.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease`,`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,'format=rgba');
  if(c.transitionIn?.type==='fade'&&num(c.transitionIn.durationMs)>0)parts.push(`fade=t=in:st=0:d=${fmt(num(c.transitionIn.durationMs)/1000)}:alpha=1`);
  if(c.transitionOut?.type==='fade'&&num(c.transitionOut.durationMs)>0)parts.push(`fade=t=out:st=${fmt(Math.max(0,dur-num(c.transitionOut.durationMs)/1000))}:d=${fmt(num(c.transitionOut.durationMs)/1000)}:alpha=1`);
  parts.push(`setpts=PTS+${fmt(start)}/TB[${label}]`);
  return {filter:parts.join(','),label,x,y,start,end:start+dur};
}

export async function renderTimeline({workspaceId,projectId,timeline,outputName='episode.mp4',fps=30,width=1080,height=1920}={}){
  const tempRoot=resolve(process.env.SOLY_RENDER_TMP||'/tmp/soly-render');const jobDir=join(tempRoot,randomUUID());await mkdir(jobDir,{recursive:true});const assetIndex={};
  try{
    for(const track of timeline?.tracks||[]){
      if(!visualTracks.has(track.type)&&!audioTracks.has(track.type))continue;
      for(const clip of track.clips||[]){if(assetIndex[clip.assetId])continue;const a=await readWorkspaceAsset({workspaceId,projectId,assetId:clip.assetId,versionId:clip.versionId,includeContent:true});const unresolved=new Set(['unknown','unverified','pending','',null,undefined]);if(unresolved.has(a.rights)||unresolved.has(a.provenance))throw Object.assign(new Error(`render-rights-unverified:${clip.assetId}`),{code:'rights_unverified',status:409});if(!['persisted','remote-verified'].includes(String(a.storageStatus||'')))throw Object.assign(new Error(`render-storage-not-durable:${clip.assetId}`),{code:'storage_not_durable',status:409});const ext=String(a.contentType||'').startsWith('image/')?'.img':String(a.contentType||'').startsWith('audio/')?'.audio':'.video';const path=join(jobDir,`${clip.assetId}${ext}`);await writeFile(path,Buffer.from(a.contentBase64,'base64'));assetIndex[clip.assetId]={...a,path};}
    }
    const plan=buildFrameRenderPlan({timeline,assetIndex,fps,width,height});if(!plan.passed)throw Object.assign(new Error(`render-plan-blocked:${plan.blockers.join(',')}`),{code:'render_plan_blocked',status:409,blockers:plan.blockers});
    const args=['-y','-f','lavfi','-i',`color=c=black:s=${width}x${height}:r=${fps}:d=${Math.max(.04,timeline.durationMs/1000)}`];const visual=[];const audio=[];let input=1;
    for(const clip of plan.clips){const a=assetIndex[clip.assetId];const dur=fmt(clip.durationMs/1000);if(clip.trackType==='image'||String(a.contentType).startsWith('image/')){args.push('-loop','1','-t',dur,'-i',a.path);visual.push({...clip,input:input++});}else{args.push('-i',a.path);if(audioTracks.has(clip.trackType)||String(a.contentType).startsWith('audio/'))audio.push({...clip,input:input++});else visual.push({...clip,input:input++});}}
    const filters=[];let current='0:v';visual.forEach((c,i)=>{const vf=visualFilter(c,c.input,width,height,i);filters.push(vf.filter);const next=`mix${i}`;filters.push(`[${current}][${vf.label}]overlay=x='${vf.x}':y='${vf.y}':enable='between(t,${fmt(vf.start)},${fmt(vf.end)})'[${next}]`);current=next;});
    let audioMap=null;if(audio.length){const labels=[];audio.forEach((c,i)=>{const a=`a${i}`;const dur=num(c.durationMs)/1000;const parts=[`[${c.input}:a]atrim=duration=${fmt(dur)}`,'asetpts=PTS-STARTPTS'];if(c.transitionIn?.type==='fade'&&num(c.transitionIn.durationMs)>0)parts.push(`afade=t=in:st=0:d=${fmt(num(c.transitionIn.durationMs)/1000)}`);if(c.transitionOut?.type==='fade'&&num(c.transitionOut.durationMs)>0)parts.push(`afade=t=out:st=${fmt(Math.max(0,dur-num(c.transitionOut.durationMs)/1000))}:d=${fmt(num(c.transitionOut.durationMs)/1000)}`);parts.push(`adelay=${Math.round(c.startMs)}|${Math.round(c.startMs)}[${a}]`);filters.push(parts.join(','));labels.push(`[${a}]`);});audioMap='aout';filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:normalize=0[${audioMap}]`);}
    const output=join(jobDir,safeName(outputName));if(filters.length)args.push('-filter_complex',filters.join(';'));args.push('-map',`[${current}]`);if(audioMap)args.push('-map',`[${audioMap}]`);args.push('-r',String(fps),'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart');if(audioMap)args.push('-c:a','aac','-b:a','192k');args.push('-t',fmt(timeline.durationMs/1000),output);await run(process.env.FFMPEG_PATH||'ffmpeg',args,{timeoutMs:Number(process.env.SOLY_RENDER_TIMEOUT_MS||120000)});
    const probe=await run(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_entries','format=duration:stream=width,height,r_frame_rate,codec_type','-of','json',output],{timeoutMs:30000});const info=JSON.parse(probe.out||'{}');
    const bytes=await readFile(output);const persisted=await persistWorkspaceAsset({workspaceId,projectId,assetId:`render-${Date.now()}`,contentBase64:bytes.toString('base64'),contentType:'video/mp4',classification:'project',metadata:{rights:'verified',provenance:'generated-by-soly-renderer'}});
    return {adapter:'ffmpeg-frame-renderer-v2',plan,probe:info,output:{assetId:persisted.assetId,versionId:persisted.versionId,checksum:persisted.checksum,storageStatus:persisted.storageStatus,contentType:'video/mp4'},storage:storageCapability()};
  }finally{await rm(jobDir,{recursive:true,force:true}).catch(()=>{});}
}
