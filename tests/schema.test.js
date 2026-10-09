import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateParsed } from '../src/schema.js';

const schema = JSON.parse(readFileSync('schemas/zadanie.schema.json', 'utf8'));
const fixtures = JSON.parse(readFileSync('tests/fixtures/parsed.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true });

test('81-character title fixture really has 81 characters', () => {
  assert.equal([...fixtures[7].value.tytul].length, 81);
});

test('ajv and validateParsed agree on fixtures', () => {
  for (const { value, valid } of fixtures) {
    assert.equal(ajv.validate(schema, value), valid, `ajv: ${JSON.stringify(value)}`);
    assert.equal(validateParsed(value).ok, valid, `validateParsed: ${JSON.stringify(value)}`);
  }
});
