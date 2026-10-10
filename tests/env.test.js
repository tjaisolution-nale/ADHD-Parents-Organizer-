import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setEnvValue } from '../scripts/lib/env.mjs';

const BASE = '# Klient OAuth\nGOOGLE_CLIENT_ID=abc\nGOOGLE_REFRESH_TOKEN=\nGEMINI_MODEL=\n';

test('fills an empty line and keeps everything else', () => {
  assert.equal(setEnvValue(BASE, 'GOOGLE_REFRESH_TOKEN', '1//new'), '# Klient OAuth\nGOOGLE_CLIENT_ID=abc\nGOOGLE_REFRESH_TOKEN=1//new\nGEMINI_MODEL=\n');
});

test('repairs a line pasted twice and drops duplicate keys', () => {
  const broken = 'GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN=1//old\nX=1\nGOOGLE_REFRESH_TOKEN=1//older\n';
  assert.equal(setEnvValue(broken, 'GOOGLE_REFRESH_TOKEN', '1//new'), 'GOOGLE_REFRESH_TOKEN=1//new\nX=1\n');
});

test('appends a missing key before the final newline', () => {
  assert.equal(setEnvValue('A=1\n', 'B', '2'), 'A=1\nB=2\n');
  assert.equal(setEnvValue('A=1', 'B', '2'), 'A=1\nB=2');
});
