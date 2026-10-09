import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedToMs } from '../src/time.js';
import { checkParsed } from '../src/guards.js';

const TZ = 'Europe/London';
const now = zonedToMs('2026-10-09', '08:00', TZ);
const p = (o) => ({ tytul: 'X', osoba: null, typ: 'zadanie', data: '2026-10-16', godzina: '18:00', czas_min: null, kwota: null, pewnosc: 0.9, ...o });

test('guard reasons in order', () => {
  assert.equal(checkParsed(p({ pewnosc: 0.69 }), { nowMs: now, tz: TZ, text: '' }).reason, 'low_confidence');
  assert.equal(checkParsed(p({ pewnosc: 0.7 }), { nowMs: now, tz: TZ, text: '' }).ok, true);
  assert.equal(checkParsed(p({ data: null }), { nowMs: now, tz: TZ, text: '' }).reason, 'missing_date');
  assert.equal(checkParsed(p({ data: '2026-10-09', godzina: '07:30' }), { nowMs: now, tz: TZ, text: '' }).reason, 'past');
  assert.equal(checkParsed(p({ data: '2027-10-11' }), { nowMs: now, tz: TZ, text: '' }).reason, 'too_far');
  assert.equal(checkParsed(p({ data: '2026-10-17' }), { nowMs: now, tz: TZ, text: 'w piątek dentysta' }).reason, 'weekday_mismatch');
  assert.equal(checkParsed(p({ data: '2026-10-16' }), { nowMs: now, tz: TZ, text: 'w piątek dentysta' }).ok, true);
  assert.equal(checkParsed(p({ godzina: null }), { nowMs: now, tz: TZ, text: '' }).reason, 'missing_time');
  assert.equal(checkParsed(p({ godzina: null, typ: 'rachunek' }), { nowMs: now, tz: TZ, text: '' }).ok, true);
  assert.equal(checkParsed(p({ godzina: null }), { nowMs: now, tz: TZ, text: '', allDay: true }).ok, true);
});

test('weekday check ignores texts naming two different days and plain words', () => {
  assert.equal(checkParsed(p({ data: '2026-10-17' }), { nowMs: now, tz: TZ, text: 'w piątek albo w sobotę' }).ok, true);
  assert.equal(checkParsed(p({ data: '2026-10-17' }), { nowMs: now, tz: TZ, text: 'Friday dentist' }).reason, 'weekday_mismatch');
  assert.equal(checkParsed(p({ data: '2026-10-17' }), { nowMs: now, tz: TZ, text: 'kupić sobolową czapkę' }).ok, true);
});
