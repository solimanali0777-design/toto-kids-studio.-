const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));
const bool = value => value === true;

export function yppThresholds(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  const change = new Date('2027-02-01T00:00:00Z');
  if (date >= change) {
    return {
      effectiveFrom: '2027-02-01',
      subscribers: 1000,
      watchHours365: 8000,
      shortsViews90: 20000000,
      sourceNote: 'YouTube announced updated full YPP ad/Premium eligibility from 2027-02-01.',
    };
  }
  return {
    effectiveFrom: 'current-before-2027-02-01',
    subscribers: 1000,
    watchHours365: 4000,
    shortsViews90: 10000000,
    sourceNote: 'Current full YPP eligibility before 2027-02-01.',
  };
}

export function monetizationProgress({
  subscribers = 0,
  watchHours365 = 0,
  shortsViews90 = 0,
  at = new Date(),
} = {}) {
  const threshold = yppThresholds(at);
  const subs = Math.max(0, Number(subscribers) || 0);
  const hours = Math.max(0, Number(watchHours365) || 0);
  const shorts = Math.max(0, Number(shortsViews90) || 0);
  const longFormPath = subs >= threshold.subscribers && hours >= threshold.watchHours365;
  const shortsPath = subs >= threshold.subscribers && shorts >= threshold.shortsViews90;
  return {
    threshold,
    eligibleByMetrics: longFormPath || shortsPath,
    paths: {
      longForm: {
        met: longFormPath,
        subscribersGap: Math.max(0, threshold.subscribers - subs),
        watchHoursGap: Math.max(0, threshold.watchHours365 - hours),
      },
      shorts: {
        met: shortsPath,
        subscribersGap: Math.max(0, threshold.subscribers - subs),
        shortsViewsGap: Math.max(0, threshold.shortsViews90 - shorts),
      },
    },
    note: 'Metric eligibility does not guarantee acceptance; YouTube also reviews policy compliance and channel authenticity.',
  };
}

export function evaluateMonetizationContent(input = {}) {
  const blockers = [];
  const warnings = [];
  const signals = {
    originality: clamp01(input.originalityScore),
    educationalValue: clamp01(input.educationalValueScore),
    storyVariation: clamp01(input.storyVariationScore),
    creatorContribution: clamp01(input.creatorContributionScore),
    templateSimilarity: clamp01(input.templateSimilarityScore),
  };

  if (input.madeForKids !== true) blockers.push('made-for-kids-setting-required');
  if (!bool(input.rightsClear)) blockers.push('rights-not-clear');
  if (bool(input.thirdPartyClips)) blockers.push('third-party-clips-review-required');
  if (!bool(input.metadataTruthful)) blockers.push('metadata-must-be-truthful');
  if (signals.originality < 0.65) blockers.push('originality-too-low');
  if (signals.educationalValue < 0.55) blockers.push('educational-value-too-low');
  if (signals.creatorContribution < 0.55) blockers.push('creator-contribution-too-low');
  if (signals.templateSimilarity > 0.72) blockers.push('template-similarity-too-high');
  if (signals.storyVariation < 0.45) warnings.push('story-variation-low');
  if (!bool(input.originalMusicOrLicensed)) warnings.push('music-rights-should-be-verified');
  if (!bool(input.parentValueClear)) warnings.push('parent-value-summary-recommended');
  if (!bool(input.humanQaCompleted)) warnings.push('human-qa-recommended');

  const positive = [
    signals.originality,
    signals.educationalValue,
    signals.storyVariation,
    signals.creatorContribution,
    1 - signals.templateSimilarity,
    bool(input.rightsClear) ? 1 : 0,
    bool(input.metadataTruthful) ? 1 : 0,
  ];
  const score = Math.round((positive.reduce((a, b) => a + b, 0) / positive.length) * 100);

  return {
    passed: blockers.length === 0,
    score,
    blockers,
    warnings,
    signals,
    policyContext: {
      madeForKidsPersonalizedAds: false,
      contextualAdsPossible: true,
      massProducedTemplateRisk: true,
      originalCreativeUseOfAiCanBeCompatible: true,
    },
    disclaimer: 'This is an internal quality/policy heuristic, not a guarantee of YouTube monetization or revenue.',
  };
}

export const YOUTUBE_MONETIZATION_GATE_VERSION = '1.0.0';
