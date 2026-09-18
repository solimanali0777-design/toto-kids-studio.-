import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('work continuity moves to the next task when one path is blocked', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'soly-focus-'));
  process.env.SOLY_WORK_SESSION_PATH = join(dir, 'sessions.json');
  const mod = await import(`../backend/workContinuity.mjs?test=${Date.now()}`);

  await mod.createWorkSession({
    sessionId: 'demo',
    goal: 'finish without stalling',
    tasks: [
      { id: 'a', title: 'first path' },
      { id: 'b', title: 'fallback path' },
    ],
  });

  const result = await mod.checkpointWork({
    sessionId: 'demo',
    taskId: 'a',
    status: 'blocked',
    blocker: 'provider unavailable',
    alternatives: ['continue with b'],
  });

  assert.equal(result.summary.state, 'active');
  assert.equal(result.summary.nextAction.id, 'b');
  assert.equal(result.summary.counts.blocked, 1);
  await rm(dir, { recursive: true, force: true });
});

test('self repair retries only safe transient work', async () => {
  const { executeWithRecovery } = await import('../backend/selfRepairLoop.mjs');
  let attempts = 0;
  const result = await executeWithRecovery(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('temporary'), { code: 'timeout' });
    return 'ok';
  }, { maxAttempts: 2, retryDelayMs: 0, riskLevel: 'L1', idempotent: true });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.result, 'ok');
  assert.equal(attempts, 2);
});

test('self repair does not auto retry an external write', async () => {
  const { executeWithRecovery } = await import('../backend/selfRepairLoop.mjs');
  let attempts = 0;

  await assert.rejects(
    executeWithRecovery(async () => {
      attempts += 1;
      throw Object.assign(new Error('temporary'), { code: 'timeout' });
    }, {
      maxAttempts: 3,
      retryDelayMs: 0,
      riskLevel: 'L2',
      idempotent: true,
      externalWrite: true,
    }),
    error => error?.repair?.reason === 'risk-boundary',
  );

  assert.equal(attempts, 1);
});

test('model router filters by capability and budget before ranking', async () => {
  const { selectModel } = await import('../backend/modelRouter.mjs');
  const result = selectModel({
    catalog: [
      { id: 'cheap-text', provider: 'a', capabilities: ['text'], estimatedCostUsd: 0.01, latencyMs: 900, qualityScore: 0.72, reliabilityScore: 0.95 },
      { id: 'premium-text', provider: 'b', capabilities: ['text'], estimatedCostUsd: 0.50, latencyMs: 700, qualityScore: 0.99, reliabilityScore: 0.99 },
      { id: 'vision-only', provider: 'c', capabilities: ['vision'], estimatedCostUsd: 0, latencyMs: 500, qualityScore: 1, reliabilityScore: 1 },
    ],
    requiredCapabilities: ['text'],
    budgetUsd: 0.05,
    maxLatencyMs: 2000,
    quality: 'balanced',
  });

  assert.equal(result.selected.id, 'cheap-text');
  assert.equal(result.eligible, 1);
});

test('educational policy requires a real learning objective and originality', async () => {
  const { evaluateEducationalPlan } = await import('../backend/educationPolicy.mjs');

  const bad = evaluateEducationalPlan({ ageBand: '4-6' });
  assert.equal(bad.passed, false);
  assert.ok(bad.blockers.includes('learning-objective-required'));

  const good = evaluateEducationalPlan({
    learningObjective: 'يتعرف الطفل على اسم البقرة وصوتها بالإنجليزية والعربية',
    ageBand: '4-6',
    teachingMethod: 'تكرار بصري وصوتي مع سؤال قصير',
    recap: 'اسمها بقرة وصوتها موو',
    interaction: 'قول مع توتو: Cow!',
    originalityNote: 'سيناريو وشخصيات ومشاهد أصلية خاصة بالقناة',
    facts: ['Cow تعني بقرة'],
  });

  assert.equal(good.passed, true);
  assert.equal(good.score, 100);
});
