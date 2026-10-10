import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiHint } from '../scripts/check-gemini.mjs';

test('each Gemini failure gets a concrete next step', () => {
  assert.match(geminiHint(429, 'You exceeded your current quota'), /8:00/);
  assert.match(geminiHint(429, 'You exceeded your current quota'), /gemini-flash-lite-latest/);
  assert.match(geminiHint(404, 'models/x is not found'), /GEMINI_MODEL/);
  assert.match(geminiHint(400, 'API key not valid. Please pass a valid API key.'), /GEMINI_API_KEY/);
  assert.match(geminiHint(403, 'Permission denied'), /GEMINI_API_KEY/);
  assert.match(geminiHint(503, 'overloaded'), /za kilka minut/);
});

test('a slow answer is flagged against the bot’s 30 s limit', async () => {
  const { speedNote } = await import('../scripts/check-gemini.mjs');
  assert.equal(speedNote(4.2), '');
  assert.match(speedNote(22), /30 s/);
  assert.match(speedNote(35), /za wolno/);
});
