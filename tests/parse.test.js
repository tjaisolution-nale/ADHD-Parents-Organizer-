import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiRequest, readGeminiResponse, parseWithRetry } from '../src/parse.js';
import { GEMINI_RESPONSE_SCHEMA } from '../src/schema.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf, TEST_CONFIG } from './helpers/fake-io.js';
import { wrap } from './helpers/fixtures.js';

const TZ = 'Europe/London';
const NOW = zonedToMs('2026-10-09', '08:00', TZ);
const PROMPT = TEST_CONFIG.parsePrompt;
const META = { today: '2026-10-09', weekday: 5, sender: '🟦', tz: TZ };
const IN = { text: 'jutro 18 dentysta' };
const VALID = { tytul: 'Dentysta', osoba: null, typ: 'wizyta', data: '2026-10-10', godzina: '18:00', czas_min: null, kwota: null, pewnosc: 0.9 };

test('request carries date, weekday and schema', () => {
  const r = buildGeminiRequest({ text: 'jutro 18 dentysta' }, META, PROMPT);
  const sys = JSON.stringify(r.systemInstruction);
  assert.ok(sys.includes('2026-10-09') && sys.includes('piątek'));
  assert.equal(r.contents[0].parts[0].text, 'jutro 18 dentysta');
  assert.equal(r.generationConfig.responseSchema, GEMINI_RESPONSE_SCHEMA);
  assert.equal(r.generationConfig.responseMimeType, 'application/json');
  assert.equal(r.generationConfig.temperature, 0);
});

test('audio goes inline', () => {
  const r = buildGeminiRequest({ audio: { mime: 'audio/ogg', base64: 'AAA' } }, META, PROMPT);
  assert.deepEqual(r.contents[0].parts[0].inline_data, { mime_type: 'audio/ogg', data: 'AAA' });
});

test('odd responses (Review Focus 5)', () => {
  assert.equal(readGeminiResponse(wrap('```json\n' + JSON.stringify(VALID) + '\n```')).ok, true);
  assert.equal(readGeminiResponse(wrap('Oto wynik: brak')).ok, false);
  assert.equal(readGeminiResponse({ candidates: [] }).ok, false);
  assert.equal(readGeminiResponse({ promptFeedback: { blockReason: 'SAFETY' } }).ok, false);
});

test('retry once, then give up; limit stops calls', async () => {
  const a = makeFakeIo({ gemini: [wrap('nie json'), wrap(JSON.stringify(VALID))] });
  assert.equal((await parseWithRetry(ctxOf(a, NOW), IN, META)).ok, true);
  assert.equal(a.calls.filter(c => c.api === 'gemini').length, 2);
  const b = makeFakeIo({ gemini: [wrap('x'), wrap('y')] });
  assert.deepEqual(await parseWithRetry(ctxOf(b, NOW), IN, META), { ok: false, reason: 'invalid' });
  const c = makeFakeIo({});
  const ctx = ctxOf(c, NOW); ctx.store.gem = { date: '2026-10-09', count: 200 };
  assert.deepEqual(await parseWithRetry(ctx, IN, META), { ok: false, reason: 'limit' });
  assert.equal(c.calls.length, 0);
});

test('daily counter increments and resets on a new day; network error is "error"', async () => {
  const f = makeFakeIo({ gemini: [wrap(JSON.stringify(VALID)), new Error('ECONNRESET')] });
  const ctx = ctxOf(f, NOW); ctx.store.gem = { date: '2026-10-08', count: 200 };
  await parseWithRetry(ctx, IN, META);
  assert.deepEqual(ctx.store.gem, { date: '2026-10-09', count: 1 });
  assert.deepEqual(await parseWithRetry(ctx, IN, META), { ok: false, reason: 'error' });
});
