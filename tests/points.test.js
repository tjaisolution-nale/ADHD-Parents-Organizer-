import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSlot, nextCombo, isHighFive, weeklyGoal, percent, renderBars, eventPoints } from '../src/points.js';

const MIN = 60000;

test('all 64 slot values', () => {
  const kinds = { jackpot: 0, triple: 0, pair: 0, none: 0 };
  for (let v = 1; v <= 64; v++) kinds[decodeSlot(v).kind]++;
  assert.deepEqual(kinds, { jackpot: 1, triple: 3, pair: 36, none: 24 });
  assert.equal(decodeSlot(64).bonus, 9);
  assert.equal(decodeSlot(22).kind, 'triple');
  assert.deepEqual(decodeSlot(1).reels, [0, 0, 0]);
  assert.equal(decodeSlot(37).kind, 'none');
});

test('combo boundaries', () => {
  const t = 1_000_000;
  assert.deepEqual(nextCombo({ last: null, level: 0 }, t), { last: t, level: 1, bonus: 0 });
  assert.equal(nextCombo({ last: t, level: 1 }, t + 19 * MIN).level, 2);
  assert.equal(nextCombo({ last: t, level: 1 }, t + 20 * MIN).bonus, 1);
  assert.equal(nextCombo({ last: t, level: 3 }, t + 21 * MIN).level, 1);
  assert.deepEqual(nextCombo({ last: t, level: 5 }, t + MIN), { last: t + MIN, level: 5, bonus: 4 });
});

test('high five window and cooldown', () => {
  const t = 1_000_000;
  assert.equal(isHighFive(t, null, t + 60 * MIN), true);
  assert.equal(isHighFive(t, null, t + 61 * MIN), false);
  assert.equal(isHighFive(t, t + 10 * MIN, t + 30 * MIN), false);
  assert.equal(isHighFive(null, null, t), false);
});

test('weekly goal', () => {
  assert.equal(weeklyGoal([]), 5);
  assert.equal(weeklyGoal([20]), 5);
  assert.equal(weeklyGoal([20, 30]), 23);
  assert.equal(weeklyGoal([2, 4]), 5);
});

test('bars', () => {
  assert.equal(percent(15, 10), 100);
  assert.equal(renderBars({ b: 8, g: 5 }, { b: 10, g: 9 }), '🟦 ▓▓▓▓░ 80%  🟩 ▓▓▓░░ 56%  🎯 drużyna ▓▓▓░░ 68%');
});

test('event points', () => {
  const emails = { b: 'b@x', g: 'g@x' };
  assert.deepEqual(eventPoints({ summary: '✅ 🟨 Basen' }, emails), { b: 1, g: 1 });
  assert.deepEqual(eventPoints({ summary: '✅ 🟦 X', description: 'pkt: 🟦3' }, emails), { b: 3, g: 0 });
  assert.deepEqual(eventPoints({ summary: '🟦 X' }, emails), { b: 0, g: 0 });
});
