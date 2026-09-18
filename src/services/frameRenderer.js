import { validateTimeline } from './composerTimeline.js';

export const FRAME_RENDERER_VERSION='2.0';
export function frameAt(ms,fps){return Math.max(0,Math.round(Number(ms||0)*Number(fps||30)/1000));}
export function buildFrameRenderPlan({timeline,assetIndex={},fps=30,width=1080,height=1920}={}){
  const base=validateTimeline(timeline||{});const blockers=[...base.blockers];
  if(!Number.isInteger(fps)||fps<1||fps>120)blockers.push('fps-invalid');
  if(!Number.isInteger(width)||width<64||width>7680)blockers.push('width-invalid');
  if(!Number.isInteger(height)||height<64||height>7680)blockers.push('height-invalid');
  const clips=[]; const metadataTracks=[];
  for(const track of timeline?.tracks||[]){
    if(['viseme','text'].includes(track.type)){metadataTracks.push({id:track.id,type:track.type,clips:track.clips||[]});continue;}
    let previousEnd=-1;
    for(const clip of [...(track.clips||[])].sort((a,b)=>a.startMs-b.startMs)){
      const asset=assetIndex[clip.assetId];
      if(!asset)blockers.push(`asset-missing:${clip.assetId}`);else if(!['remote-verified','persisted'].includes(String(asset.storageStatus||'')))blockers.push(`asset-not-renderable:${clip.assetId}`);
      const startFrame=frameAt(clip.startMs,fps);const endFrame=frameAt(clip.startMs+clip.durationMs,fps);
      if(startFrame<previousEnd&&!['overlay'].includes(track.type))blockers.push(`clip-overlap:${track.id}:${clip.id}`);previousEnd=Math.max(previousEnd,endFrame);
      for(const kf of clip.keyframes||[]) if(Object.prototype.hasOwnProperty.call(kf.values||{},'opacity')) blockers.push(`keyframe-opacity-render-unsupported:${clip.id}`);
      clips.push({trackId:track.id,trackType:track.type,clipId:clip.id,assetId:clip.assetId,startMs:clip.startMs,durationMs:clip.durationMs,startFrame,endFrame,frameCount:Math.max(1,endFrame-startFrame),contentType:asset?.contentType||null,versionId:asset?.versionId||null,transitionIn:clip.transitionIn||null,transitionOut:clip.transitionOut||null,keyframes:clip.keyframes||[]});
    }
  }
  return {passed:blockers.length===0,blockers:[...new Set(blockers)],version:FRAME_RENDERER_VERSION,fps,width,height,durationMs:timeline?.durationMs||0,totalFrames:frameAt(timeline?.durationMs||0,fps),clips,metadataTracks};
}
