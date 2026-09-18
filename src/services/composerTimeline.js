import { validateEditTimeline } from './timelineEditor.js';

export const COMPOSER_VERSION='2.0';

export function validateTimeline(timeline={}){
  const base=validateEditTimeline(timeline||{}); const blockers=[...base.blockers]; const seen=new Set();
  for(const track of timeline?.tracks||[]){
    if(!track?.id){blockers.push('track-id-missing');continue;}
    if(seen.has(track.id)) blockers.push(`duplicate-track:${track.id}`); else seen.add(track.id);
    for(const clip of track.clips||[]){
      if(!['text','viseme'].includes(track.type)&&(!clip.id||!clip.assetId)) blockers.push(`clip-reference:${track.id}`);
    }
  }
  return {passed:blockers.length===0,blockers:[...new Set(blockers)],composerVersion:COMPOSER_VERSION};
}

export function composerExportAudit({timeline,assetIndex={},lipSyncAudit=null,lipSyncBinding=null}={}){
  const validation=validateTimeline(timeline||{}); const blockers=[...validation.blockers];
  for(const track of timeline?.tracks||[]) for(const clip of track.clips||[]){
    if(['text','viseme'].includes(track.type)) continue;
    const asset=assetIndex[clip.assetId];
    if(!asset) blockers.push(`asset-missing:${clip.assetId}`);
    else if(!['persisted','remote-verified'].includes(String(asset.storageStatus||''))) blockers.push(`asset-not-persisted:${clip.assetId}`);
  }
  const hasVisemes=(timeline?.tracks||[]).some(t=>t.type==='viseme'&&(t.clips||[]).length);
  if(hasVisemes&&lipSyncAudit?.passed!==true) blockers.push('lipsync-not-production-ready');
  if(hasVisemes&&lipSyncAudit?.passed===true&&lipSyncBinding?.rendererApplied!==true) blockers.push('lipsync-render-binding-missing');
  return {passed:blockers.length===0,blockers:[...new Set(blockers)],composerVersion:COMPOSER_VERSION};
}
