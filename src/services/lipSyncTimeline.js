export const LIPSYNC_PLAN_VERSION='1.0';
export const VISEMES=Object.freeze(['REST','MBP','FV','TH','DNTL','KG','CHJSH','SZ','L','R','WQ','A','I','U']);

const AR_MAP=new Map([
  ['ب','MBP'],['م','MBP'],['پ','MBP'],['ف','FV'],['ڤ','FV'],['ث','TH'],['ذ','TH'],['ظ','TH'],
  ['ت','DNTL'],['د','DNTL'],['ط','DNTL'],['ض','DNTL'],['ن','DNTL'],['ك','KG'],['ق','KG'],['خ','KG'],['غ','KG'],
  ['ج','CHJSH'],['ش','CHJSH'],['س','SZ'],['ز','SZ'],['ص','SZ'],['ل','L'],['ر','R'],['و','WQ'],
  ['ا','A'],['أ','A'],['إ','I'],['آ','A'],['ى','A'],['ي','I'],['ة','A'],['ه','A'],['ع','A'],['ح','A']
]);
const LATIN_MAP={b:'MBP',m:'MBP',p:'MBP',f:'FV',v:'FV',t:'DNTL',d:'DNTL',n:'DNTL',k:'KG',g:'KG',c:'KG',j:'CHJSH',s:'SZ',z:'SZ',l:'L',r:'R',w:'WQ',q:'WQ',a:'A',e:'A',i:'I',y:'I',o:'U',u:'U'};
const clean=s=>String(s||'').replace(/[\u064B-\u065F\u0670]/g,'');

export function charToViseme(ch=''){
  const c=clean(ch).toLowerCase();
  if(AR_MAP.has(c)) return AR_MAP.get(c);
  if(LATIN_MAP[c]) return LATIN_MAP[c];
  if(/\s|[.,!?،؛:]/.test(c)) return 'REST';
  return 'A';
}

function coalesce(cues=[]){
  const out=[]; for(const cue of cues){const prev=out[out.length-1];if(prev&&prev.viseme===cue.viseme&&Math.abs(prev.endMs-cue.startMs)<=2)prev.endMs=cue.endMs;else out.push({...cue});}return out;
}
function textUnits(text=''){return Array.from(clean(text)).filter(ch=>!/[\r\n]/.test(ch));}

export function validateWordTimings(wordTimings=[],durationMs=0){
  const blockers=[];let previousEnd=0;let covered=0;
  if(!Array.isArray(wordTimings)||!wordTimings.length)blockers.push('word-timings-missing');
  for(const [i,w] of (wordTimings||[]).entries()){
    const start=Number(w?.startMs),end=Number(w?.endMs);const text=String(w?.word||w?.text||'').trim();
    if(!text)blockers.push(`word-text-missing:${i}`);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)blockers.push(`word-time-invalid:${i}`);
    if(Number.isFinite(start)&&start<0)blockers.push(`word-start-negative:${i}`);
    if(Number.isFinite(end)&&Number.isFinite(Number(durationMs))&&end>Number(durationMs))blockers.push(`word-out-of-bounds:${i}`);
    if(Number.isFinite(start)&&start<previousEnd)blockers.push(`word-overlap:${i}`);
    if(Number.isFinite(end)&&Number.isFinite(start)&&end>start){covered+=end-start;previousEnd=Math.max(previousEnd,end);}
  }
  const coverage=Number(durationMs)>0?Math.min(1,covered/Number(durationMs)):0;
  if((wordTimings||[]).length&&coverage<.25)blockers.push('word-timing-coverage-low');
  return {passed:blockers.length===0,blockers,coverage};
}

export function generateVisemePlan({transcript='',durationMs=0,wordTimings=[],language='ar-EG'}={}){
  const text=String(transcript||'').trim(); const duration=Number(durationMs||0);
  if(!text) return {executed:false,reason:'transcript-required',version:LIPSYNC_PLAN_VERSION,cues:[]};
  if(!Number.isFinite(duration)||duration<=0) return {executed:false,reason:'duration-required',version:LIPSYNC_PLAN_VERSION,cues:[]};
  const cues=[]; let source='estimated'; let confidence=.45;
  const timingAudit=validateWordTimings(wordTimings,duration);
  const validTimed=timingAudit.passed;
  if(validTimed){
    source='word-timed'; confidence=.78;
    for(const word of wordTimings){
      const units=textUnits(word.word||word.text||''); if(!units.length) continue;
      const span=Math.max(1,Number(word.endMs)-Number(word.startMs)); const step=span/units.length;
      units.forEach((ch,i)=>cues.push({viseme:charToViseme(ch),startMs:Math.round(Number(word.startMs)+i*step),endMs:Math.round(Number(word.startMs)+(i+1)*step),sourceWord:String(word.word||word.text||'')}));
    }
  }else{
    const units=textUnits(text); const weights=units.map(ch=>/\s|[.,!?،؛:]/.test(ch)?1.6:1); const total=weights.reduce((a,b)=>a+b,0)||1; let cursor=0;
    units.forEach((ch,i)=>{const span=duration*weights[i]/total;const start=cursor;cursor+=span;cues.push({viseme:charToViseme(ch),startMs:Math.round(start),endMs:Math.round(Math.min(duration,cursor))});});
  }
  const normalized=coalesce(cues.filter(c=>c.endMs>c.startMs));
  if(normalized.length){normalized[0].startMs=0;normalized[normalized.length-1].endMs=duration;}
  return {executed:true,version:LIPSYNC_PLAN_VERSION,language,transcript:text,durationMs:duration,source,confidence,cues:normalized,wordTimingAudit:timingAudit,productionReady:source==='word-timed'&&confidence>=.7&&timingAudit.passed};
}

export function validateVisemePlan(plan={}){
  const blockers=[];
  if(plan.executed!==true) blockers.push('lipsync-not-executed');
  if(!Array.isArray(plan.cues)||!plan.cues.length) blockers.push('viseme-cues-missing');
  if(!Number.isFinite(Number(plan.durationMs))||Number(plan.durationMs)<=0) blockers.push('duration-invalid');
  let prev=0;
  for(const cue of plan.cues||[]){
    if(!VISEMES.includes(cue.viseme)) blockers.push(`viseme-invalid:${cue.viseme}`);
    if(!Number.isFinite(Number(cue.startMs))||!Number.isFinite(Number(cue.endMs))||Number(cue.endMs)<=Number(cue.startMs)) blockers.push('cue-time-invalid');
    if(Number(cue.startMs)<prev) blockers.push('cue-order-invalid'); prev=Number(cue.endMs);
    if(Number(cue.endMs)>Number(plan.durationMs)) blockers.push('cue-out-of-bounds');
  }
  if(plan.source!=='word-timed') blockers.push('alignment-estimated-preview-only');
  if(Number(plan.confidence||0)<.7) blockers.push('alignment-confidence-low');
  return {passed:blockers.length===0,blockers,productionReady:blockers.length===0,source:plan.source||null,confidence:Number(plan.confidence||0)};
}

export function visemeTrackFromPlan(plan={},id='mouth-visemes'){
  return {id,type:'viseme',productionReady:Boolean(plan.productionReady),renderBindingRequired:true,clips:(plan.cues||[]).map((cue,i)=>({id:`viseme-${i}`,kind:'viseme',assetId:null,startMs:cue.startMs,durationMs:cue.endMs-cue.startMs,payload:{viseme:cue.viseme,confidence:plan.confidence,source:plan.source}}))};
}
