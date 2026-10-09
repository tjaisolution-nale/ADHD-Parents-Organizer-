import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClash, nextFreeStart } from '../src/slots.js';

const H = 3600000, M = 60000, t = 1_000_000_000;

test('touching is not a clash, overlap returns the title', () => {
  assert.equal(findClash([{ start: t - H, end: t, title: 'A' }], t, t + 30 * M), null);
  assert.deepEqual(findClash([{ start: t, end: t + H, title: '🟩 Basen' }], t, t + 30 * M), { title: '🟩 Basen' });
});

test('next free start', () => {
  assert.equal(nextFreeStart([{ start: t, end: t + H, title: 'B' }], t, 30 * M), t + H);
  assert.equal(nextFreeStart([{ start: t, end: t + 4 * H, title: 'B' }], t, 30 * M), null);
});
