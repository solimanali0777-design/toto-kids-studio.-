import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWithRecovery } from '../backend/selfRepairLoop.mjs';
import { planShortForm, scoreMoments } from '../backend/shortFormPlanner.mjs';

test('chaos: transient provider failure falls back without crashing', async () => {
  const result = await executeWithRecovery(
    async () => { throw Object.assign(new Error('provider down'), { code: 'provider_unavailable' }); },
    {
      maxAttempts: 1,
      retryDelayMs: 0,
      riskLevel: 'L1',
      idempotent: true,
      fallbacks: [
        async () => ({ mode: 'local-plan', usable: true }),
      ],
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.route, 'fallback-1');
  assert.equal(result.result.usable, true);
});

test('chaos: policy errors never fall through to automatic repair', async () => {
  let fallbackCalls = 0;

  await assert.rejects(
    executeWithRecovery(
      async () => { throw Object.assign(new Error('bad payload'), { code: 'schema_error' }); },
      {
        maxAttempts: 3,
        retryDelayMs: 0,
        riskLevel: 'L0',
        idempotent: true,
        fallbacks: [async () => { fallbackCalls += 1; return 'should-not-run'; }],
      },
    ),
    error => error?.repair?.reason === 'policy-block',
  );

  assert.equal(fallbackCalls, 0);
});

test('short form planner selects non-overlapping high-value moments', () => {
  const plan = planShortForm({
    sourceDurationMs: 60000,
    targetDurationMs: 22000,
    moments: [
      { id: 'intro', startMs: 0, endMs: 5000, score: .7, hookValue: 1, learningValue: .4, caption: 'مين يعرف دي إيه؟' },
      { id: 'cow', startMs: 7000, endMs: 15000, score: .9, hookValue: .7, learningValue: 1, caption: 'Cow يعني بقرة' },
      { id: 'overlap', startMs: 9000, endMs: 16000, score: 1, hookValue: .8, learningValue: .9, caption: 'متداخل' },
      { id: 'recap', startMs: 30000, endMs: 36000, score: .75, hookValue: .4, learningValue: .95, caption: 'قول Cow!' },
    ],
  });

  assert.equal(plan.executed, true);
  assert.equal(plan.format, '9:16');
  assert.equal(plan.canvas.width, 1080);
  assert.equal(plan.canvas.height, 1920);
  assert.ok(plan.durationMs <= 22000);
  assert.ok(plan.clips.length >= 2);

  for (let i = 0; i < plan.clips.length; i += 1) {
    for (let j = i + 1; j < plan.clips.length; j += 1) {
      const a = plan.clips[i];
      const b = plan.clips[j];
      assert.ok(a.sourceEndMs <= b.sourceStartMs || b.sourceEndMs <= a.sourceStartMs);
    }
  }
});

test('short form scoring rewards learning and hook value', () => {
  const ranked = scoreMoments([
    { id: 'weak', startMs: 0, endMs: 3000, score: .8, learningValue: .1, hookValue: .1 },
    { id: 'strong', startMs: 5000, endMs: 8000, score: .7, learningValue: 1, hookValue: 1 },
  ], 10000);

  assert.equal(ranked[0].id, 'strong');
});
