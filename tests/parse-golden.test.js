import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify } from '../scripts/eval-parse.mjs';

const golden = JSON.parse(readFileSync('tests/parse-golden.json', 'utf8'));

test('golden set shape', () => {
  assert.equal(golden.length, 30);
  assert.ok(golden.filter(g => g.expect.data === null).length >= 5);
  for (const g of golden) assert.ok(g.text && g.today && g.sender && 'data' in g.expect && 'godzina' in g.expect);
});

test('classify: asking is right only when the case expects a question', () => {
  const dated = { data: '2026-10-10', godzina: '18:00', osoba: null, typ: 'wizyta' };
  const undated = { data: null, godzina: null, osoba: null, typ: 'zadanie' };
  assert.equal(classify(dated, { saved: false }), 'asked');
  assert.equal(classify(undated, { saved: false }), 'correct');
  assert.equal(classify(dated, { saved: true, value: { ...dated, typ: 'zadanie' } }), 'correct');
  assert.equal(classify(dated, { saved: true, value: { ...dated, godzina: '19:00' } }), 'wrong_saved');
  assert.equal(classify(undated, { saved: true, value: { ...undated, data: '2026-10-09', godzina: '12:00' } }), 'wrong_saved');
});
