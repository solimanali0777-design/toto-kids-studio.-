import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getToolContract, validateToolArgs } from '../backend/toolContracts.js';

const EXPECTED = [
  'soly.work.session.create',
  'soly.work.session.read',
  'soly.work.checkpoint',
  'soly.model.route',
  'toto.education.review',
  'toto.shortform.plan',
];

test('new internal tools have explicit contracts', () => {
  for (const id of EXPECTED) {
    const contract = getToolContract(id);
    assert.ok(contract, `missing contract: ${id}`);
    assert.equal(contract.allowedTargets.includes('internal'), true);
    assert.equal(contract.requiresConfirmation, false);
  }
});

test('tool contracts reject unknown arguments', () => {
  const contract = getToolContract('soly.model.route');
  assert.equal(validateToolArgs(contract, { budgetUsd: 0, quality: 'balanced' }), true);
  assert.throws(
    () => validateToolArgs(contract, { arbitrarySecret: 'nope' }),
    error => error?.code === 'schema_error',
  );
});

test('gateway source wires every new tool adapter', async () => {
  const source = await readFile(new URL('../backend/solyGatewayServer.mjs', import.meta.url), 'utf8');
  for (const id of EXPECTED) assert.ok(source.includes(`'${id}'`), `gateway missing adapter: ${id}`);
});

test('episode planning enforces a real learning objective', async () => {
  const source = await readFile(new URL('../backend/appdeployCompatApi.mts', import.meta.url), 'utf8');
  assert.ok(source.includes('هدف تعلم واضح ومحدد للحلقة'));
  assert.ok(source.includes('interactive-question'));
  assert.ok(source.includes('Recap'));
});
