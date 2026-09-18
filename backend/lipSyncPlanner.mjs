import { generateVisemePlan, validateVisemePlan, visemeTrackFromPlan } from '../src/services/lipSyncTimeline.js';

export async function buildLipSyncPlan({transcript,durationMs,wordTimings=[],language='ar-EG'}={}){
  const plan=generateVisemePlan({transcript,durationMs,wordTimings,language});
  const audit=validateVisemePlan(plan);
  return {adapter:'soly-phoneme-viseme-planner',plan,audit,track:visemeTrackFromPlan(plan),note:audit.passed?'word-timed alignment is production-ready':'estimated alignment is preview-only until timed alignment is supplied'};
}
