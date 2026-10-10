import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDelaySeconds } from '../scripts/eval-parse.mjs';

test('reads the wait time from a Gemini 429 response, with a safe default', () => {
  const body = { error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '17s' }] } };
  assert.equal(retryDelaySeconds(body), 18);
  assert.equal(retryDelaySeconds({}), 20);
  assert.equal(retryDelaySeconds({ error: { details: [{ '@type': 'x.RetryInfo', retryDelay: '0.5s' }] } }), 2);
});

test('API errors are left out of the score instead of counting as misses', async () => {
  const { scoreOf } = await import('../scripts/eval-parse.mjs');
  assert.deepEqual(scoreOf({ correct: 27, asked: 1, wrong_saved: 0, api_error: 2 }, 30), { judged: 28, score: 27 / 28, pass: true });
  assert.equal(scoreOf({ correct: 25, asked: 3, wrong_saved: 0, api_error: 2 }, 30).pass, false);
  assert.equal(scoreOf({ correct: 29, asked: 0, wrong_saved: 1, api_error: 0 }, 30).pass, false);
  assert.equal(scoreOf({ correct: 0, asked: 0, wrong_saved: 0, api_error: 30 }, 30).pass, false);
});
