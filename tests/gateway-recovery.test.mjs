import test from 'node:test';
import assert from 'node:assert/strict';
import { executeToolRequest, GatewayError } from '../backend/solyGatewayCore.js';

test('gateway retries a safe idempotent L0 tool once after timeout', async () => {
  let attempts = 0;
  const result = await executeToolRequest(
    {
      toolId: 'toto.education.review',
      args: { learningObjective: 'تعليم الطفل اسم الحيوان وصوته' },
    },
    {
      scopes: ['project:education:review'],
      confirmed: false,
      estimatedCostUsd: 0,
      maxCostUsd: 0,
      executors: {
        'toto.education.review': async () => {
          attempts += 1;
          if (attempts === 1) throw new GatewayError('timeout', 'temporary timeout', 504);
          return { passed: true };
        },
      },
    },
  );

  assert.equal(attempts, 2);
  assert.equal(result.ok, true);
  assert.equal(result.result.passed, true);
  assert.equal(result.audit.recovered, true);
  assert.equal(result.audit.recoveryRoute, 'primary');
});

test('gateway never auto-retries an external write', async () => {
  let attempts = 0;

  await assert.rejects(
    executeToolRequest(
      {
        toolId: 'workspace.asset.persist',
        args: {
          workspaceId: 'w',
          projectId: 'p',
          assetId: 'a',
          contentType: 'text/plain',
          contentBase64: 'eA==',
          classification: 'project',
        },
      },
      {
        scopes: ['project:workspace:write'],
        confirmed: true,
        estimatedCostUsd: 0,
        maxCostUsd: 0,
        executors: {
          'workspace.asset.persist': async () => {
            attempts += 1;
            throw new GatewayError('timeout', 'temporary timeout', 504);
          },
        },
      },
    ),
    error => error?.code === 'timeout',
  );

  assert.equal(attempts, 1);
});
