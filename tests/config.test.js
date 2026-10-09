import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

const R = { rewards: { b: ['a'], g: ['b'], team: ['c'] }, parsePrompt: 'p' };
const fullEnv = {
  TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: '-100', TELEGRAM_ID_NIEBIESKI: '1', TELEGRAM_ID_ZIELONY: '2',
  EMAIL_NIEBIESKI: 'b@x', EMAIL_ZIELONY: 'g@x', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm',
  DOM_CALENDAR_ID: 'dom-prod', DOM_TEST_CALENDAR_ID: 'dom-test', PARTNER_CALENDAR_ID: 'partner',
  GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs', GOOGLE_REFRESH_TOKEN: 'rt',
};

test('readConfig lists missing variables and picks the test calendar by default', () => {
  assert.throws(() => readConfig({}, R), /TELEGRAM_BOT_TOKEN/);
  assert.equal(readConfig(fullEnv, R).domCal, fullEnv.DOM_TEST_CALENDAR_ID);
  assert.equal(readConfig({ ...fullEnv, DOM_MODE: 'prod' }, R).domCal, fullEnv.DOM_CALENDAR_ID);
});

test('readConfig parses numbers and defaults', () => {
  const c = readConfig(fullEnv, R);
  assert.equal(c.chatId, -100);
  assert.deepEqual(c.ids, { b: 1, g: 2 });
  assert.equal(c.geminiLimit, 200);
  assert.equal(c.tz, 'Europe/London');
  assert.equal(c.mode, 'test');
  assert.equal(c.primaryCal, 'b@x');
  assert.equal(c.parsePrompt, 'p');
});
