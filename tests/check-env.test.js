import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEnv } from '../scripts/check-env.mjs';

const GOOD = {
  N8N_VERSION: '2.41.6', GENERIC_TIMEZONE: 'Europe/London', TZ: 'Europe/London', DOM_MODE: 'test', GEMINI_DAILY_LIMIT: '200',
  EMAIL_NIEBIESKI: 'b@gmail.com', EMAIL_ZIELONY: 'g@gmail.com', PARTNER_CALENDAR_ID: 'g@gmail.com',
  DOM_CALENDAR_ID: 'abc@group.calendar.google.com', DOM_TEST_CALENDAR_ID: 'def@group.calendar.google.com',
  TELEGRAM_BOT_TOKEN: '123456789:' + 'A'.repeat(35), TELEGRAM_CHAT_ID: '-1001234567890', TELEGRAM_ID_NIEBIESKI: '111', TELEGRAM_ID_ZIELONY: '222',
  GOOGLE_CLIENT_ID: '12-abc.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'GOCSPX-' + 'c'.repeat(28), GOOGLE_REFRESH_TOKEN: '1//' + 'd'.repeat(40),
  GEMINI_API_KEY: 'AIza' + 'b'.repeat(35), GEMINI_MODEL: 'gemini-flash-latest',
};
const row = (rows, name) => rows.find(r => r.name === name);

test('a complete, well-formed env passes', () => {
  const { rows, ok } = checkEnv(GOOD);
  assert.equal(ok, true);
  assert.ok(rows.every(r => r.status === 'ok'));
});

test('wrong formats get a hint, empty fields name their step, values never appear', () => {
  const { rows, ok } = checkEnv({ ...GOOD, TELEGRAM_CHAT_ID: '12345', DOM_TEST_CALENDAR_ID: 'moj-kalendarz-xyz', GEMINI_MODEL: 'models/gemini-flash', EMAIL_ZIELONY: ' g@gmail.com', GEMINI_API_KEY: '' });
  assert.equal(ok, false);
  assert.equal(row(rows, 'TELEGRAM_CHAT_ID').status, 'bad');
  assert.match(row(rows, 'TELEGRAM_CHAT_ID').hint, /ujemna/);
  assert.match(row(rows, 'DOM_TEST_CALENDAR_ID').hint, /@group\.calendar\.google\.com/);
  assert.match(row(rows, 'GEMINI_MODEL').hint, /models\//);
  assert.match(row(rows, 'EMAIL_ZIELONY').hint, /spacj/);
  assert.equal(row(rows, 'GEMINI_API_KEY').status, 'empty');
  assert.match(row(rows, 'GEMINI_API_KEY').step, /krok 7/);
  const text = JSON.stringify(rows);
  for (const v of ['12345', 'moj-kalendarz-xyz', 'g@gmail.com']) assert.ok(!text.includes(v), v);
});

test('DOM_CALENDAR_ID may stay empty in test mode', () => {
  assert.equal(row(checkEnv({ ...GOOD, DOM_CALENDAR_ID: '' }).rows, 'DOM_CALENDAR_ID').status, 'optional');
  assert.equal(row(checkEnv({ ...GOOD, DOM_MODE: 'prod', DOM_CALENDAR_ID: '' }).rows, 'DOM_CALENDAR_ID').status, 'empty');
});

test('Gemini keys in newer formats pass; a copied short label does not', () => {
  for (const key of ['AQ.' + 'Ab8RN6x'.repeat(8), 'AIza' + 'b'.repeat(35)]) {
    assert.equal(row(checkEnv({ ...GOOD, GEMINI_API_KEY: key }).rows, 'GEMINI_API_KEY').status, 'ok', key.slice(0, 4));
  }
  assert.equal(row(checkEnv({ ...GOOD, GEMINI_API_KEY: '...3i8g' }).rows, 'GEMINI_API_KEY').status, 'bad');
});
