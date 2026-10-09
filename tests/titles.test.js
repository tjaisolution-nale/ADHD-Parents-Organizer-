import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTitle, parseTitle, markDone, parseDescription, setMeta, findBySource, personFromEvent, parsePkt, formatPkt } from '../src/titles.js';

test('build and parse titles', () => {
  assert.equal(buildTitle({ done: true, osoba: 'y', typ: 'rachunek', tekst: 'Council tax £182' }), '✅ 🟨 💸 Council tax £182');
  assert.deepEqual(parseTitle('✅ 🟨 💸 Council tax £182'), { done: true, osoba: 'y', typ: 'rachunek', tekst: 'Council tax £182' });
  assert.deepEqual(parseTitle('Kupić mleko'), { done: false, osoba: null, typ: 'zadanie', tekst: 'Kupić mleko' });
  assert.equal(markDone(markDone('🟦 Odkurzyć')), '✅ 🟦 Odkurzyć');
});

test('description meta', () => {
  assert.deepEqual(parseDescription('źródło: gmail:abc\nkwota: £182.00\n\nTekst'), { meta: { 'źródło': 'gmail:abc', kwota: '£182.00' }, notes: 'Tekst' });
  assert.equal(setMeta('utworzone_przez: bot\n\nNotatka', { pkt: '🟦3' }), 'utworzone_przez: bot\npkt: 🟦3\n\nNotatka');
  assert.equal(setMeta('pkt: 🟦1', { pkt: '🟦3' }), 'pkt: 🟦3');
});

test('source lookup is exact (duplicate bills)', () => {
  const ev = { description: 'źródło: gmail:42' };
  assert.equal(findBySource([ev], 'gmail:42'), ev);
  assert.equal(findBySource([ev], 'gmail:4'), null);
});

test('person and points', () => {
  assert.equal(personFromEvent({ summary: 'Dentysta', creator: { email: 'b@x' } }, { b: 'b@x', g: 'g@x' }), 'b');
  assert.equal(personFromEvent({ summary: '🟩 Basen', creator: { email: 'b@x' } }, { b: 'b@x', g: 'g@x' }), 'g');
  assert.deepEqual(parsePkt('🟦3 🟩1'), { b: 3, g: 1 });
  assert.deepEqual(parsePkt(undefined), { b: 0, g: 0 });
  assert.equal(formatPkt({ b: 2, g: 2 }), '🟦2 🟩2');
  assert.equal(formatPkt({ b: 0, g: 5 }), '🟩5');
});
