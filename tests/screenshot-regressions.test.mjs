import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const apiSource = await readFile(new URL('../backend/appdeployCompatApi.mts', import.meta.url), 'utf8');
const webSource = await readFile(new URL('../web/src/App.tsx', import.meta.url), 'utf8');
const swSource = await readFile(new URL('../web/public/sw.js', import.meta.url), 'utf8');

test('voice route from the production screenshots exists in the release source', () => {
  assert.ok(apiSource.includes("'POST /api/tts'"));
  assert.ok(apiSource.includes("'POST /api/quality-check'"));
});

test('frontend retries transient failures only, not version-mismatch 404', () => {
  assert.ok(webSource.includes('new Set([408, 425, 429, 499, 500, 502, 503, 504])'));
  assert.equal(webSource.includes('new Set([404,'), false);
  assert.ok(webSource.includes('عدم تطابق بين نسخة الواجهة والسيرفر'));
});

test('image rate limit continues recovery instead of immediate 429 return', () => {
  assert.ok(apiSource.includes('429/5xx must continue through alternate image models'));
  assert.equal(
    apiSource.includes("if (statusFromError(caught) === 429) return externalError(caught)"),
    false,
  );
});

test('music has a real local emergency audio route', () => {
  assert.ok(apiSource.includes('function emergencyMusicWavBase64('));
  assert.ok(apiSource.includes("model: 'local-emergency-music-v1'"));
  assert.ok(apiSource.includes("contentType: 'audio/wav'"));
  assert.ok(apiSource.includes('emergencyAudio: true'));
});

test('PWA never service-worker caches API or v1 routes', () => {
  assert.ok(swSource.includes("url.pathname.startsWith('/api/')"));
  assert.ok(swSource.includes("url.pathname.startsWith('/v1/')"));
  assert.ok(swSource.includes("toto-kids-studio-v7-15"));
});

test('voice fallback clearly remains preview-only', () => {
  assert.ok(webSource.includes('browserVoicePreview'));
  assert.ok(webSource.includes('المعاينة مؤقتة وليست ملف التصدير النهائي'));
});
