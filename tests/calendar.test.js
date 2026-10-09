import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toEventBody, listEvents, busyBetween, eventStartMs } from '../src/calendar.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf } from './helpers/fake-io.js';
import { timed } from './helpers/fixtures.js';

const TZ = 'Europe/London';

test('event body: timed crosses midnight, all-day ends next day', () => {
  const b = toEventBody({ title: '🟦 X', date: '2026-10-24', time: '23:45', durationMin: 30, description: '', tz: TZ });
  assert.deepEqual(b.end, { dateTime: '2026-10-25T00:15:00', timeZone: TZ });
  assert.deepEqual(b.reminders, { useDefault: true });
  assert.deepEqual(toEventBody({ title: 'X', date: '2026-10-24', time: null, durationMin: 30, description: '', tz: TZ }).end, { date: '2026-10-25' });
});

test('eventStartMs handles local, offset and all-day times', () => {
  assert.equal(eventStartMs({ start: { dateTime: '2026-10-24T18:00:00', timeZone: TZ } }, TZ), Date.UTC(2026, 9, 24, 17));
  assert.equal(eventStartMs({ start: { dateTime: '2026-10-24T18:00:00+01:00' } }, TZ), Date.UTC(2026, 9, 24, 17));
  assert.equal(eventStartMs({ start: { date: '2026-10-26' } }, TZ), Date.UTC(2026, 9, 26, 0));
});

test('listEvents asks for single events in an ISO window', async () => {
  const f = makeFakeIo({ events: [timed('🟦 A', '2026-10-16', '18:00', 30), timed('🟦 B', '2026-10-20', '18:00', 30)] });
  const ctx = ctxOf(f, zonedToMs('2026-10-09', '08:00', TZ));
  const items = await listEvents(ctx, 'dom', zonedToMs('2026-10-16', '00:00', TZ), zonedToMs('2026-10-17', '00:00', TZ));
  assert.deepEqual(items.map(e => e.summary), ['🟦 A']);
  const call = f.calls.find(c => c.api === 'cal');
  assert.equal(call.params.path, '/calendars/dom/events');
  assert.equal(call.params.query.singleEvents, true);
  assert.equal(call.params.query.timeMin, '2026-10-15T23:00:00.000Z');
});

test('busyBetween merges Dom, primary and partner free/busy, skipping transparent', async () => {
  const f = makeFakeIo({
    events: [
      timed('🟦 Dentysta', '2026-10-16', '18:00', 30),
      { ...timed('🟦 Luźne', '2026-10-16', '18:00', 30), transparency: 'transparent' },
      { ...timed('Praca', '2026-10-16', '17:00', 60), calId: 'primary' },
    ],
    partnerBusy: [{ start: '2026-10-16T18:30:00Z', end: '2026-10-16T19:00:00Z' }],
  });
  const ctx = ctxOf(f, zonedToMs('2026-10-09', '08:00', TZ));
  const busy = await busyBetween(ctx, zonedToMs('2026-10-16', '12:00', TZ), zonedToMs('2026-10-16', '23:00', TZ));
  assert.deepEqual(busy.map(b => b.title).sort(), ['Praca', 'zajęte w kalendarzu 🟩', '🟦 Dentysta']);
});
