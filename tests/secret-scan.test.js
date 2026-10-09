import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findSecrets } from '../scripts/lib/secret-scan.mjs';

test('flags each secret kind', () => {
  assert.deepEqual(findSecrets('123456789:' + 'A'.repeat(35)), ['telegram_bot_token']);
  assert.deepEqual(findSecrets('AIza' + 'b'.repeat(35)), ['google_api_key']);
  assert.deepEqual(findSecrets('GOCSPX-' + 'c'.repeat(28)), ['google_client_secret']);
  assert.deepEqual(findSecrets('1//' + 'd'.repeat(40)), ['google_refresh_token']);
  // header built from parts so this file never trips the repo-wide scan itself
  assert.deepEqual(findSecrets('-----BEGIN ' + 'PRIVATE KEY-----'), ['private_key']);
});

test('env example and plain text are clean', () => {
  assert.deepEqual(findSecrets(readFileSync('n8n/.env.example', 'utf8')), []);
  assert.deepEqual(findSecrets('pt 16.10, 18:00'), []);
});
