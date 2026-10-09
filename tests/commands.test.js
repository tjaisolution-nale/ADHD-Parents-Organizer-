import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCommand } from '../src/handlers/commands.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf } from './helpers/fake-io.js';
import { textMsg, timed, allDayEv } from './helpers/fixtures.js';

const TZ = 'Europe/London';
const NOW = zonedToMs('2026-10-09', '08:00', TZ);
const lastText = (f) => f.calls.filter(c => c.method === 'sendMessage').at(-1)?.params.text;

test('/zalegle moves only sender and 🟨, skips done', async () => {
  const f = makeFakeIo({ events: [
    timed('🟦 A', '2026-10-08', '18:00', 30), timed('🟩 B', '2026-10-08', '18:00', 30),
    allDayEv('🟨 C', '2026-10-08'), timed('✅ 🟦 D', '2026-10-08', '18:00', 30),
  ] });
  await handleCommand(ctxOf(f, NOW), textMsg('/zalegle@DomBot'));
  const byTitle = Object.fromEntries(f.events.map(e => [e.summary, e.start]));
  assert.deepEqual(byTitle['🟦 A'], { dateTime: '2026-10-10T18:00:00', timeZone: TZ });
  assert.deepEqual(byTitle['🟨 C'], { date: '2026-10-10' });
  assert.deepEqual(byTitle['🟩 B'], { dateTime: '2026-10-08T18:00:00', timeZone: TZ });
  assert.deepEqual(byTitle['✅ 🟦 D'], { dateTime: '2026-10-08T18:00:00', timeZone: TZ });
  assert.equal(lastText(f), '📦 Przeniesione na jutro: 2');
});

test('/zalegle with nothing overdue', async () => {
  const f = makeFakeIo({});
  await handleCommand(ctxOf(f, NOW), textMsg('/zalegle'));
  assert.equal(lastText(f), 'Brak zaległości 🎉');
});

test('/test777 only in test mode', async () => {
  const f = makeFakeIo({});
  const ctx = ctxOf(f, NOW);
  await handleCommand(ctx, textMsg('/test777'));
  assert.equal(ctx.store.forceSlot, 64);
  assert.equal(lastText(f), '🧪 Następne ✅ da 777');
  const g = makeFakeIo({});
  const prod = ctxOf(g, NOW, { config: { mode: 'prod' } });
  await handleCommand(prod, textMsg('/test777'));
  assert.equal(prod.store.forceSlot, null);
  assert.equal(g.calls.length, 0);
});
