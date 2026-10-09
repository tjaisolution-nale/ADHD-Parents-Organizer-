import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onDone, ensureGoals } from '../src/gamify.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf } from './helpers/fake-io.js';
import { timed } from './helpers/fixtures.js';

const TZ = 'Europe/London';
const T0 = zonedToMs('2026-10-09', '18:00', TZ);
const MIN = 60000;
const CHAT = -100;
const texts = (f) => f.calls.filter(c => c.method === 'sendMessage').map(c => c.params.text);
const lastText = (f) => texts(f).at(-1);
const done = (ctx, ev, clicker) => onDone(ctx, { eventId: ev.id, clicker, chatId: CHAT, messageId: 5 });

test('base + slot bonus for clicker, pkt written', async () => {
  const f = makeFakeIo({ events: [timed('🟦 Odkurzyć', '2026-10-09', '18:00', 30)], diceValues: [22] });
  await done(ctxOf(f, T0), f.events[0], 'b');
  assert.equal(f.events[0].summary, '✅ 🟦 Odkurzyć');
  assert.match(f.events[0].description, /pkt: 🟦5/);
  assert.match(f.events[0].description, /zrobione: 2026-10-09T18:00 🟦/);
  assert.ok(texts(f)[0].startsWith('Trójka! +5'));
  assert.ok(f.calls.some(c => c.method === 'editMessageReplyMarkup' && c.params.message_id === 5));
  // 5 punktów przy celu startowym 5 → od razu nagroda za cel tygodnia
  assert.equal(lastText(f), '🏅 🟦 cel tygodnia! Nagroda: 🎮 godzina gry');
});

test('🟨 gives base to both, bonus only to clicker', async () => {
  const f = makeFakeIo({ events: [timed('🟨 Basen', '2026-10-09', '18:00', 30)], diceValues: [2] });
  await done(ctxOf(f, T0), f.events[0], 'g');
  assert.match(f.events[0].description, /pkt: 🟦1 🟩2/);
});

test('second tap is idempotent (Review Focus 3)', async () => {
  const f = makeFakeIo({ events: [timed('🟨 Basen', '2026-10-09', '18:00', 30)], diceValues: [37, 37] });
  const ctx = ctxOf(f, T0);
  await done(ctx, f.events[0], 'b');
  await done(ctx, f.events[0], 'g');
  assert.equal(f.calls.filter(c => c.method === 'sendDice').length, 1);
  assert.equal(f.calls.at(-1).params.text, 'Już zrobione ✅');
  assert.match(f.events[0].description, /pkt: 🟦1 🟩1/);
});

test('combo within 20 min', async () => {
  const f = makeFakeIo({ events: [timed('🟦 A', '2026-10-09', '18:00', 30), timed('🟦 B', '2026-10-09', '18:30', 30)], diceValues: [37, 37] });
  const ctx = ctxOf(f, T0);
  await done(ctx, f.events[0], 'b');
  await done({ ...ctx, now: T0 + 19 * MIN }, f.events[1], 'b');
  assert.ok(lastText(f).includes('🔥 Combo x2! +1'));
  assert.match(f.events[1].description, /combo: x2/);
  assert.doesNotMatch(f.events[0].description, /combo:/);
});

test('high five', async () => {
  const f = makeFakeIo({ events: [timed('🟦 A', '2026-10-09', '18:00', 30), timed('🟩 B', '2026-10-09', '18:30', 30)], diceValues: [37, 37] });
  const ctx = ctxOf(f, T0);
  await done(ctx, f.events[0], 'b');
  await done({ ...ctx, now: T0 + 30 * MIN }, f.events[1], 'g');
  assert.ok(texts(f).includes('🙌 Piątka! +2 dla 🟦 i 🟩'));
  assert.match(f.events[1].description, /pkt: 🟦2 🟩3/);
});

test('goal crossing announces reward', async () => {
  const f = makeFakeIo({ events: [{ ...timed('✅ 🟦 X', '2026-10-06', '10:00', 30), description: 'pkt: 🟦9' }, timed('🟦 Y', '2026-10-09', '18:00', 30)], diceValues: [37] });
  const ctx = ctxOf(f, T0);
  ctx.store.goals = { week: '2026-10-05', b: 10, g: 5 };
  await done(ctx, f.events[1], 'b');
  assert.ok(texts(f).includes('🏅 🟦 cel tygodnia! Nagroda: 🎮 godzina gry'));
  assert.ok(!texts(f).some(t => t.startsWith('🎉')));
});

test('forced 777 in test mode', async () => {
  const f = makeFakeIo({ events: [timed('🟦 A', '2026-10-09', '18:00', 30)], diceValues: [37] });
  const ctx = ctxOf(f, T0);
  ctx.store.forceSlot = 64;
  await done(ctx, f.events[0], 'b');
  assert.ok(texts(f).find(t => t.startsWith('777! JACKPOT +10')));
  assert.equal(ctx.store.forceSlot, null);
});

test('sleep 2000 between dice and result', async () => {
  const f = makeFakeIo({ events: [timed('🟦 A', '2026-10-09', '18:00', 30)], diceValues: [37] });
  await done(ctxOf(f, T0), f.events[0], 'b');
  const idx = (pred) => f.calls.findIndex(pred);
  const dice = idx(c => c.method === 'sendDice');
  const sleep = idx(c => c.method === 'sleep' && c.params.ms === 2000);
  const result = idx(c => c.method === 'sendMessage' && c.params.text.startsWith('Zawsze coś wpada'));
  assert.ok(dice < sleep && sleep < result, `${dice} ${sleep} ${result}`);
});

test('goals cached per week', async () => {
  const now = zonedToMs('2026-10-14', '18:00', TZ);
  const f = makeFakeIo({ events: [
    { ...timed('✅ 🟦 A', '2026-09-30', '10:00', 30), description: 'pkt: 🟦20' },
    { ...timed('✅ 🟦 B', '2026-10-07', '10:00', 30), description: 'pkt: 🟦30' },
  ] });
  const ctx = ctxOf(f, now);
  assert.deepEqual(await ensureGoals(ctx), { b: 23, g: 5 });
  const lists = () => f.calls.filter(c => c.api === 'cal' && c.method === 'GET' && c.params.query).length;
  const before = lists();
  assert.deepEqual(await ensureGoals(ctx), { b: 23, g: 5 });
  assert.equal(lists(), before);
});

test('first weeks without events keep the goal at 5', async () => {
  const f = makeFakeIo({ events: [{ ...timed('✅ 🟦 B', '2026-10-07', '10:00', 30), description: 'pkt: 🟦30' }] });
  assert.deepEqual(await ensureGoals(ctxOf(f, zonedToMs('2026-10-14', '18:00', TZ))), { b: 5, g: 5 });
});
