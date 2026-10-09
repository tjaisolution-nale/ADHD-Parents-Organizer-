import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localParts, zonedToMs, addDays, addMinutesLocal, weekStart, formatPl } from '../src/time.js';

const TZ = 'Europe/London';

test('localParts in BST and GMT', () => {
  assert.deepEqual(localParts(Date.UTC(2026, 9, 24, 17, 0), TZ), { date: '2026-10-24', time: '18:00', weekday: 6 });
  assert.deepEqual(localParts(Date.UTC(2026, 9, 26, 18, 0), TZ), { date: '2026-10-26', time: '18:00', weekday: 1 });
});

test('zonedToMs across the October change', () => {
  assert.equal(zonedToMs('2026-10-24', '18:00', TZ), Date.UTC(2026, 9, 24, 17, 0));
  assert.equal(zonedToMs('2026-10-25', '18:00', TZ), Date.UTC(2026, 9, 25, 18, 0));
  assert.equal(zonedToMs('2027-03-28', '01:30', TZ), Date.UTC(2027, 2, 28, 1, 30)); // nieistniejąca godzina → po skoku
});

test('addMinutesLocal through the fall-back hour', () => {
  assert.deepEqual(addMinutesLocal('2026-10-25', '00:30', 120, TZ), { date: '2026-10-25', time: '01:30' });
  assert.deepEqual(addMinutesLocal('2026-10-24', '23:45', 30, TZ), { date: '2026-10-25', time: '00:15' });
});

test('weekStart and formatPl', () => {
  assert.equal(weekStart('2026-10-18'), '2026-10-12');
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(formatPl('2026-10-16', '18:00'), 'pt 16.10, 18:00');
  assert.equal(formatPl('2026-10-24', null), 'sob 24.10');
});
