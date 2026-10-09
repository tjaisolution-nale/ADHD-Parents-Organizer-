import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCallback } from '../src/handlers/callback.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf } from './helpers/fake-io.js';
import { cb, timed, allDayEv } from './helpers/fixtures.js';

const TZ = 'Europe/London';
const NOW = zonedToMs('2026-10-09', '08:00', TZ);
const HOUR = 3600000;
const answer = (f) => f.calls.filter(c => c.method === 'answerCallbackQuery').at(-1).params.text;

function ctxWithKey(f, k, eventId, now = NOW) {
  const ctx = ctxOf(f, now);
  ctx.store.cb[k] = { ev: eventId, exp: now + 14 * 24 * HOUR };
  return ctx;
}

function ctxWithPending(f, k, entry, now = NOW) {
  const ctx = ctxOf(f, now);
  ctx.store.pending[k] = { sender: 'b', src: 7, exp: now + 24 * HOUR, ...entry };
  return ctx;
}

const parsed = (o) => ({ tytul: 'Basen', osoba: null, typ: 'zadanie', data: null, godzina: '18:00', czas_min: null, kwota: null, pewnosc: 0.9, ...o });

test('snooze moves 18:00 → 18:15; all-day refuses', async () => {
  const f = makeFakeIo({ events: [timed('🟦 Basen', '2026-10-16', '18:00', 60), allDayEv('🟦 Pranie', '2026-10-16')] });
  const ctx = ctxWithKey(f, 'k1', f.events[0].id);
  ctx.store.cb.k2 = { ev: f.events[1].id, exp: NOW + HOUR };
  await handleCallback(ctx, cb('sn:k1'));
  assert.deepEqual(f.events[0].start, { dateTime: '2026-10-16T18:15:00', timeZone: TZ });
  assert.deepEqual(f.events[0].end, { dateTime: '2026-10-16T19:15:00', timeZone: TZ });
  await handleCallback(ctx, cb('sn:k2'));
  assert.equal(answer(f), 'Całodniowe: użyj Jutro');
  assert.deepEqual(f.events[1].start, { date: '2026-10-16' });
});

test('tomorrow keeps local time across the clock change (Review Focus 2)', async () => {
  const f = makeFakeIo({ events: [timed('🟦 Basen', '2026-10-24', '18:00', 60)] });
  const ctx = ctxWithKey(f, 'k1', f.events[0].id);
  await handleCallback(ctx, cb('tm:k1'));
  assert.deepEqual(f.events[0].start, { dateTime: '2026-10-25T18:00:00', timeZone: TZ });
  assert.deepEqual(f.events[0].end, { dateTime: '2026-10-25T19:00:00', timeZone: TZ });
});

test('undo only own events younger than 24 h', async () => {
  const own = (title, hoursAgo) => ({ ...timed(title, '2026-10-16', '18:00', 30), description: 'utworzone_przez: bot', created: new Date(NOW - hoursAgo * HOUR).toISOString() });
  const f = makeFakeIo({ events: [own('🟦 Świeże', 1), own('🟦 Stare', 25), { ...timed('🟦 Ręczne', '2026-10-16', '18:00', 30), created: new Date(NOW - HOUR).toISOString() }] });
  const [fresh, old, manual] = f.events.map(e => e.id);
  const ctx = ctxWithKey(f, 'a', fresh);
  ctx.store.cb.b = { ev: old, exp: NOW + HOUR };
  ctx.store.cb.c = { ev: manual, exp: NOW + HOUR };
  await handleCallback(ctx, cb('un:a'));
  assert.equal(f.calls.find(c => c.method === 'editMessageText').params.text, '↩️ Cofnięte');
  await handleCallback(ctx, cb('un:b'));
  assert.equal(answer(f), 'Tego już nie da się cofnąć');
  await handleCallback(ctx, cb('un:c'));
  assert.equal(answer(f), 'Tego już nie da się cofnąć');
  assert.deepEqual(f.events.map(e => e.summary), ['🟦 Stare', '🟦 Ręczne']);
});

test('weekend pick', async () => {
  const f = makeFakeIo({});
  await handleCallback(ctxWithPending(f, 'p1', { parsed: parsed({}) }), cb('pd:p1:weekend'));
  assert.deepEqual(f.events[0].start, { dateTime: '2026-10-10T18:00:00', timeZone: TZ });
  const g = makeFakeIo({});
  const sunday = zonedToMs('2026-10-11', '08:00', TZ);
  await handleCallback(ctxWithPending(g, 'p2', { parsed: parsed({}) }, sunday), cb('pd:p2:weekend'));
  assert.deepEqual(g.events[0].start, { dateTime: '2026-10-11T18:00:00', timeZone: TZ });
});

test('day pick without time asks for time; time pick creates; all-day pick creates all-day', async () => {
  const f = makeFakeIo({});
  const ctx = ctxWithPending(f, 'p1', { parsed: parsed({ godzina: null }) });
  await handleCallback(ctx, cb('pd:p1:tydzien'));
  assert.equal(f.calls.filter(c => c.method === 'sendMessage').at(-1).params.text, 'O której?');
  assert.equal(ctx.store.pending.p1.parsed.data, '2026-10-12');
  await handleCallback(ctx, cb('pt:p1:popoludnie'));
  assert.deepEqual(f.events[0].start, { dateTime: '2026-10-12T15:00:00', timeZone: TZ });
  assert.equal(ctx.store.pending.p1, undefined);
  const g = makeFakeIo({});
  await handleCallback(ctxWithPending(g, 'p3', { parsed: parsed({ data: '2026-10-10', godzina: null }) }), cb('pt:p3:caly'));
  assert.deepEqual(g.events[0].start, { date: '2026-10-10' });
});

test('clash choices', async () => {
  const f = makeFakeIo({ events: [timed('🟩 Basen', '2026-10-16', '18:00', 60)] });
  const ctx = ctxWithPending(f, 'c1', { parsed: parsed({ tytul: 'Dentysta', data: '2026-10-16' }), alt: { date: '2026-10-16', time: '19:00' } });
  ctx.store.pending.c2 = { ...ctx.store.pending.c1 };
  await handleCallback(ctx, cb('cl:c1:wstaw'));
  await handleCallback(ctx, cb('cl:c2:zostaw'));
  assert.deepEqual(f.events.slice(1).map(e => e.start.dateTime), ['2026-10-16T19:00:00', '2026-10-16T18:00:00']);
});

test('inbox choices', async () => {
  const f = makeFakeIo({});
  const ctx = ctxWithPending(f, 'i1', { text: 'blablabla' });
  ctx.store.pending.i2 = { ...ctx.store.pending.i1 };
  await handleCallback(ctx, cb('ib:i1:zapisz'));
  assert.equal(f.events[0].summary, '🟦 📥 blablabla');
  await handleCallback(ctx, cb('ib:i2:anuluj'));
  assert.equal(f.calls.filter(c => c.method === 'editMessageText').at(-1).params.text, '✍️ OK, napisz jeszcze raz');
  assert.equal(f.events.length, 1);
});

test('expired key', async () => {
  const f = makeFakeIo({});
  await handleCallback(ctxOf(f, NOW), cb('tm:nope00'));
  assert.equal(answer(f), 'Ten przycisk już wygasł');
});

test('buttons from strangers are only acknowledged', async () => {
  const f = makeFakeIo({ events: [timed('🟦 Basen', '2026-10-16', '18:00', 60)] });
  await handleCallback(ctxWithKey(f, 'k1', f.events[0].id), cb('tm:k1', 77));
  assert.deepEqual(f.calls.map(c => c.method), ['answerCallbackQuery']);
});

test('✅ button runs the done flow', async () => {
  const f = makeFakeIo({ events: [timed('🟦 Basen', '2026-10-09', '18:00', 60)], diceValues: [37] });
  await handleCallback(ctxWithKey(f, 'k1', f.events[0].id, zonedToMs('2026-10-09', '18:30', TZ)), cb('ok:k1'));
  assert.equal(f.events[0].summary, '✅ 🟦 Basen');
});
