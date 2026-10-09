import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTick } from '../src/bot.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf } from './helpers/fake-io.js';
import { textUpdate, ok, cb } from './helpers/fixtures.js';

const TZ = 'Europe/London';
const NOW = zonedToMs('2026-10-09', '08:00', TZ);
const texts = (f) => f.calls.filter(c => c.method === 'sendMessage').map(c => c.params.text);
const fatal = () => Object.assign(new Error('invalid_grant'), { fatal: true });

test('acknowledges the offset before processing', async () => {
  const f = makeFakeIo({ updates: [[textUpdate(10), textUpdate(11)]] });
  const ctx = ctxOf(f, NOW);
  await runTick(ctx);
  const gu = f.calls.filter(c => c.method === 'getUpdates');
  assert.deepEqual(gu[0].params, { offset: 0, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  assert.deepEqual(gu[1].params, { offset: 12, timeout: 0, limit: 1 });
  assert.ok(f.calls.indexOf(gu[1]) < f.calls.findIndex(c => c.api === 'gemini'));
  assert.equal(ctx.store.offset, 12);
});

test('no updates means no further calls', async () => {
  const f = makeFakeIo({});
  assert.deepEqual(await runTick(ctxOf(f, NOW)), { processed: 0 });
  assert.equal(f.calls.length, 1);
});

test('routes commands, messages and buttons', async () => {
  const cmd = textUpdate(1, '/zalegle');
  const btn = { update_id: 3, callback_query: cb('tm:nope00') };
  const f = makeFakeIo({ updates: [[cmd, textUpdate(2, 'jutro 9 basen'), btn]], gemini: [ok({ data: '2026-10-10', godzina: '09:00' })] });
  assert.deepEqual(await runTick(ctxOf(f, NOW)), { processed: 3 });
  assert.deepEqual(texts(f), ['Brak zaległości 🎉', '🟦 X · sob 10.10, 09:00']);
  assert.equal(f.calls.find(c => c.method === 'answerCallbackQuery').params.text, 'Ten przycisk już wygasł');
});

test('non-fatal error replies and continues', async () => {
  const f = makeFakeIo({ updates: [[textUpdate(1), textUpdate(2)]], gemini: [ok({ data: '2026-10-10', godzina: '09:00' }), ok({ data: '2026-10-10', godzina: '10:00' })] });
  const ctx = ctxOf(f, NOW);
  const cal = ctx.io.cal;
  let failed = false;
  ctx.io = { ...ctx.io, cal: async (method, path, opts) => {
    if (method === 'POST' && path.endsWith('/events') && !failed) { failed = true; throw new Error('Calendar 500'); }
    return cal(method, path, opts);
  } };
  assert.deepEqual(await runTick(ctx), { processed: 1 });
  assert.equal(texts(f)[0], '⚠️ Coś poszło nie tak. Spróbuj jeszcze raz.');
  assert.equal(f.events.length, 1);
});

test('fatal error throws once per hour, and every message gets told', async () => {
  const f = makeFakeIo({ updates: [[textUpdate(1)], [textUpdate(2)]], gemini: [ok({ data: '2026-10-10', godzina: '09:00' }), ok({ data: '2026-10-10', godzina: '09:00' })] });
  const ctx = ctxOf(f, NOW);
  ctx.io = { ...ctx.io, cal: async () => { throw fatal(); } };
  await assert.rejects(runTick(ctx), /invalid_grant/);
  assert.equal(ctx.store.fatalAt, NOW);
  assert.deepEqual(await runTick({ ...ctx, now: NOW + 30 * 60000 }), { processed: 0 });
  assert.equal(texts(f).filter(t => t.startsWith('⚠️ Bot nie ma teraz dostępu do kalendarza')).length, 2);
});
