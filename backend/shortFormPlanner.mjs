const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const text=v=>String(v??'').trim();

function normalizeMoment(moment={},index=0,sourceDurationMs=0){
  const startMs=clamp(moment.startMs,0,Math.max(0,sourceDurationMs-1));
  const endMs=clamp(moment.endMs,startMs+1,sourceDurationMs);
  const score=clamp(moment.score,0,1);
  const learningValue=clamp(moment.learningValue,0,1);
  const hookValue=clamp(moment.hookValue,0,1);
  const emotionValue=clamp(moment.emotionValue,0,1);
  return {
    id:text(moment.id)||`moment-${index+1}`,
    startMs,endMs,
    durationMs:endMs-startMs,
    score,learningValue,hookValue,emotionValue,
    caption:text(moment.caption||moment.hookText),
    kind:text(moment.kind)||'moment',
    rankScore:Number((score*.35+learningValue*.30+hookValue*.25+emotionValue*.10).toFixed(6)),
  };
}

const overlaps=(a,b)=>a.startMs<b.endMs&&b.startMs<a.endMs;

export function planShortForm({
  sourceDurationMs,
  moments=[],
  targetDurationMs=30000,
  minClipMs=1200,
  maxClipMs=12000,
  maxClips=4,
  width=1080,
  height=1920,
}={}){
  const source=Number(sourceDurationMs);
  if(!Number.isFinite(source)||source<=0)return{executed:false,reason:'source-duration-required',clips:[]};
  const target=clamp(targetDurationMs,5000,60000);
  const normalized=(Array.isArray(moments)?moments:[])
    .map((m,i)=>normalizeMoment(m,i,source))
    .filter(m=>m.durationMs>=Math.max(250,Number(minClipMs)||1200))
    .sort((a,b)=>b.rankScore-a.rankScore||a.startMs-b.startMs);

  const selected=[];let used=0;
  for(const moment of normalized){
    if(selected.length>=Math.max(1,Number(maxClips)||4))break;
    if(selected.some(existing=>overlaps(existing,moment)))continue;
    const remaining=target-used;if(remaining<Math.max(250,Number(minClipMs)||1200))break;
    const duration=Math.min(moment.durationMs,Math.max(250,Number(maxClipMs)||12000),remaining);
    selected.push({...moment,endMs:moment.startMs+duration,durationMs:duration});
    used+=duration;
  }
  selected.sort((a,b)=>a.startMs-b.startMs);
  const clips=selected.map((moment,index)=>({
    id:`short-clip-${index+1}`,
    sourceStartMs:moment.startMs,
    sourceEndMs:moment.endMs,
    durationMs:moment.durationMs,
    caption:moment.caption,
    kind:moment.kind,
    score:moment.rankScore,
    timelineStartMs:selected.slice(0,index).reduce((sum,row)=>sum+row.durationMs,0),
  }));
  const hook=clips.slice().sort((a,b)=>b.score-a.score)[0]||null;
  return{
    executed:clips.length>0,
    reason:clips.length?'planned':'no-eligible-moments',
    format:'9:16',
    canvas:{width:Number(width)||1080,height:Number(height)||1920},
    durationMs:clips.reduce((sum,row)=>sum+row.durationMs,0),
    targetDurationMs:target,
    hookClipId:hook?.id||null,
    clips,
    captionGuide:{
      maxLines:2,
      safeBottomPercent:18,
      safeTopPercent:12,
      note:'Keep captions away from platform controls and preserve child-safe readability.',
    },
  };
}

export function scoreMoments(moments=[],sourceDurationMs=60000){
  return (Array.isArray(moments)?moments:[])
    .map((m,i)=>normalizeMoment(m,i,sourceDurationMs))
    .sort((a,b)=>b.rankScore-a.rankScore);
}

export const SHORTFORM_PLANNER_VERSION='1.0.0';
export const __test={normalizeMoment,overlaps};
