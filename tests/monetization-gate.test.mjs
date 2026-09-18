import test from 'node:test';
import assert from 'node:assert/strict';
import {
  yppThresholds,
  monetizationProgress,
  evaluateMonetizationContent,
} from '../backend/youtubeMonetizationGate.mjs';

test('uses current YPP thresholds before 2027 change', () => {
  const current = yppThresholds(new Date('2026-09-18T12:00:00Z'));
  assert.equal(current.subscribers, 1000);
  assert.equal(current.watchHours365, 4000);
  assert.equal(current.shortsViews90, 10000000);
});

test('switches to announced 2027 thresholds on effective date', () => {
  const future = yppThresholds(new Date('2027-02-01T00:00:00Z'));
  assert.equal(future.subscribers, 1000);
  assert.equal(future.watchHours365, 8000);
  assert.equal(future.shortsViews90, 20000000);
});

test('progress reports both long-form and Shorts gaps', () => {
  const progress = monetizationProgress({
    subscribers: 700,
    watchHours365: 2500,
    shortsViews90: 4000000,
    at: new Date('2026-09-18T12:00:00Z'),
  });
  assert.equal(progress.eligibleByMetrics, false);
  assert.equal(progress.paths.longForm.subscribersGap, 300);
  assert.equal(progress.paths.longForm.watchHoursGap, 1500);
  assert.equal(progress.paths.shorts.shortsViewsGap, 6000000);
});

test('blocks templated low-value content even when rights are clear', () => {
  const review = evaluateMonetizationContent({
    madeForKids: true,
    rightsClear: true,
    thirdPartyClips: false,
    metadataTruthful: true,
    originalityScore: .42,
    educationalValueScore: .45,
    storyVariationScore: .3,
    creatorContributionScore: .4,
    templateSimilarityScore: .9,
    originalMusicOrLicensed: true,
    parentValueClear: true,
    humanQaCompleted: true,
  });
  assert.equal(review.passed, false);
  assert.ok(review.blockers.includes('originality-too-low'));
  assert.ok(review.blockers.includes('template-similarity-too-high'));
});

test('allows strong original educational content through internal gate', () => {
  const review = evaluateMonetizationContent({
    madeForKids: true,
    rightsClear: true,
    thirdPartyClips: false,
    metadataTruthful: true,
    originalityScore: .9,
    educationalValueScore: .92,
    storyVariationScore: .8,
    creatorContributionScore: .9,
    templateSimilarityScore: .2,
    originalMusicOrLicensed: true,
    parentValueClear: true,
    humanQaCompleted: true,
  });
  assert.equal(review.passed, true);
  assert.ok(review.score >= 80);
});
