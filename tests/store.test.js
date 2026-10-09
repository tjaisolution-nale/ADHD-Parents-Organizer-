import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureStore, pruneStore, newKey } from '../src/store.js';

test('store defaults, prune and keys', () => {
  const s = ensureStore({ offset: 7 });
  assert.equal(s.offset, 7); assert.deepEqual(s.goals, { week: '', b: 5, g: 5 });
  s.cb.old = { ev: 'e', exp: 10 }; pruneStore(s, 11); assert.equal(s.cb.old, undefined);
  assert.match(newKey(s), /^[0-9a-z]{6}$/);
});

test('ensureStore fills in place and keeps nested state', () => {
  const raw = { combo: { b: { last: 5, level: 2 } } };
  const s = ensureStore(raw);
  assert.equal(s, raw);
  assert.deepEqual(s.combo.b, { last: 5, level: 2 });
  assert.deepEqual(s.combo.g, { last: null, level: 0 });
  assert.equal(s.forceSlot, null);
});
