export const TIMELINE_EDITOR_VERSION='2.0';
export const TRACK_TYPES=Object.freeze(['video','image','audio','sfx','text','overlay','viseme']);
export const TRANSITION_TYPES=Object.freeze(['cut','fade']);
export const KEYFRAME_PROPS=Object.freeze(['x','y','scale','opacity']);

const finite=n=>Number.isFinite(Number(n));
const uid=(prefix='item')=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
function validAssetId(v){return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(String(v||''));}

export function createTimeline({durationMs=15000,fps=25,width=1080,height=1920}={}){
  return {version:TIMELINE_EDITOR_VERSION,durationMs:Number(durationMs),fps:Number(fps),width:Number(width),height:Number(height),tracks:[],updatedAt:new Date().toISOString()};
}

export function addTrack(timeline={},type='video',id=null){
  if(!TRACK_TYPES.includes(type)) throw new Error('timeline_track_type_invalid');
  const trackId=id||uid(type);
  if((timeline.tracks||[]).some(t=>t.id===trackId)) throw new Error('timeline_track_duplicate');
  return {...timeline,tracks:[...(timeline.tracks||[]),{id:trackId,type,clips:[]}],updatedAt:new Date().toISOString()};
}

export function addClip(timeline={},trackId,clip={}){
  if(!trackId) throw new Error('timeline_track_required');
  const clipId=clip.id||uid('clip');
  if(!clip.assetId && clip.kind!=='text' && clip.kind!=='viseme') throw new Error('timeline_asset_required');
  if(clip.assetId && !validAssetId(clip.assetId)) throw new Error('timeline_asset_id_unsafe');
  const next={
    id:clipId,
    assetId:clip.assetId||null,
    kind:clip.kind||null,
    startMs:Number(clip.startMs||0),
    durationMs:Number(clip.durationMs||1000),
    versionId:clip.versionId||null,
    transitionIn:clip.transitionIn||null,
    transitionOut:clip.transitionOut||null,
    keyframes:Array.isArray(clip.keyframes)?clip.keyframes:[],
    payload:clip.payload||null,
  };
  let found=false;
  const tracks=(timeline.tracks||[]).map(track=>track.id===trackId?(found=true,{...track,clips:[...(track.clips||[]),next]}):track);
  if(!found) throw new Error('timeline_track_not_found');
  return {...timeline,tracks,updatedAt:new Date().toISOString()};
}

export function updateClip(timeline={},trackId,clipId,patch={}){
  if(Object.prototype.hasOwnProperty.call(patch,'assetId')&&patch.assetId&&!validAssetId(patch.assetId)) throw new Error('timeline_asset_id_unsafe');
  let found=false;
  const tracks=(timeline.tracks||[]).map(track=>track.id!==trackId?track:{...track,clips:(track.clips||[]).map(clip=>clip.id!==clipId?clip:(found=true,{...clip,...patch,id:clip.id}) )});
  if(!found) throw new Error('timeline_clip_not_found');
  return {...timeline,tracks,updatedAt:new Date().toISOString()};
}

export function removeClip(timeline={},trackId,clipId){
  return {...timeline,tracks:(timeline.tracks||[]).map(track=>track.id===trackId?{...track,clips:(track.clips||[]).filter(c=>c.id!==clipId)}:track),updatedAt:new Date().toISOString()};
}

export function setClipTransition(timeline={},trackId,clipId,edge='in',transition={type:'fade',durationMs:250}){
  if(!['in','out'].includes(edge)) throw new Error('transition_edge_invalid');
  if(!TRANSITION_TYPES.includes(transition?.type||'cut')) throw new Error('transition_type_invalid');
  const value=transition?.type==='cut'?null:{type:transition.type,durationMs:Number(transition.durationMs||0)};
  return updateClip(timeline,trackId,clipId,{[edge==='in'?'transitionIn':'transitionOut']:value});
}

export function setClipKeyframes(timeline={},trackId,clipId,keyframes=[]){
  return updateClip(timeline,trackId,clipId,{keyframes:Array.isArray(keyframes)?keyframes:[]});
}

export function validateEditTimeline(timeline={}){
  const blockers=[]; const clipIds=new Set();
  if(!finite(timeline.durationMs)||Number(timeline.durationMs)<=0) blockers.push('duration-invalid');
  if(!finite(timeline.fps||25)||Number(timeline.fps||25)<1||Number(timeline.fps||25)>120) blockers.push('fps-invalid');
  for(const track of timeline.tracks||[]){
    if(!TRACK_TYPES.includes(track.type)) blockers.push(`track-type:${track.id||'unknown'}`);
    let previousEnd=-1;
    for(const clip of [...(track.clips||[])].sort((a,b)=>Number(a.startMs)-Number(b.startMs))){
      if(!clip?.id) blockers.push(`clip-id:${track.id||'unknown'}`);
      else if(clipIds.has(clip.id)) blockers.push(`duplicate-clip:${clip.id}`); else clipIds.add(clip.id);
      if(!['text','viseme'].includes(track.type)&&!clip.assetId) blockers.push(`clip-asset:${clip.id||track.id}`);
      if(clip.assetId&&!validAssetId(clip.assetId)) blockers.push(`clip-asset-id-unsafe:${clip.id||track.id}`);
      if(!finite(clip.startMs)||Number(clip.startMs)<0) blockers.push(`clip-start:${clip.id||track.id}`);
      if(!finite(clip.durationMs)||Number(clip.durationMs)<=0) blockers.push(`clip-duration:${clip.id||track.id}`);
      const end=Number(clip.startMs)+Number(clip.durationMs);
      if(finite(timeline.durationMs)&&end>Number(timeline.durationMs)) blockers.push(`clip-out-of-bounds:${clip.id||track.id}`);
      if(Number(clip.startMs)<previousEnd&&!['overlay','text','viseme'].includes(track.type)) blockers.push(`clip-overlap:${track.id}:${clip.id}`);
      previousEnd=Math.max(previousEnd,end);
      for(const [edge,tr] of [['in',clip.transitionIn],['out',clip.transitionOut]]) if(tr){
        if(!TRANSITION_TYPES.includes(tr.type)) blockers.push(`transition-type:${clip.id}:${edge}`);
        if(!finite(tr.durationMs)||Number(tr.durationMs)<0||Number(tr.durationMs)>Number(clip.durationMs)/2) blockers.push(`transition-duration:${clip.id}:${edge}`);
      }
      let lastAt=-1;
      for(const kf of clip.keyframes||[]){
        if(!finite(kf.atMs)||Number(kf.atMs)<0||Number(kf.atMs)>Number(clip.durationMs)) blockers.push(`keyframe-time:${clip.id}`);
        if(Number(kf.atMs)<lastAt) blockers.push(`keyframe-order:${clip.id}`); lastAt=Number(kf.atMs);
        for(const [prop,value] of Object.entries(kf.values||{})){
          if(!KEYFRAME_PROPS.includes(prop)) blockers.push(`keyframe-prop:${clip.id}:${prop}`);
          if(!finite(value)) blockers.push(`keyframe-value:${clip.id}:${prop}`);
          if(prop==='scale'&&(Number(value)<0.1||Number(value)>4)) blockers.push(`keyframe-range:${clip.id}:scale`);
          if(prop==='opacity'&&(Number(value)<0||Number(value)>1)) blockers.push(`keyframe-range:${clip.id}:opacity`);
          if(['x','y'].includes(prop)&&(Number(value)<-2||Number(value)>2)) blockers.push(`keyframe-range:${clip.id}:${prop}`);
        }
      }
    }
  }
  return {passed:blockers.length===0,blockers,version:TIMELINE_EDITOR_VERSION};
}

export function summarizeTimeline(timeline={}){
  const tracks=timeline.tracks||[]; const clips=tracks.flatMap(t=>t.clips||[]);
  return {durationMs:Number(timeline.durationMs||0),fps:Number(timeline.fps||25),tracks:tracks.length,clips:clips.length,keyframes:clips.reduce((n,c)=>n+(c.keyframes?.length||0),0),transitions:clips.reduce((n,c)=>n+(c.transitionIn?1:0)+(c.transitionOut?1:0),0)};
}
