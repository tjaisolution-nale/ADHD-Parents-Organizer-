import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildAuthUrl } from '../scripts/google-auth.mjs';
import { findSecrets } from '../scripts/lib/secret-scan.mjs';

test('auth url asks for offline calendar access', () => {
  const u = new URL(buildAuthUrl({ clientId: 'id', redirectUri: 'http://127.0.0.1:53682', state: 's' }));
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('client_id'), 'id');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:53682');
  assert.deepEqual(u.searchParams.get('scope').split(' ').sort(), ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly']);
});

test('setup.sh parses', () => assert.equal(spawnSync('bash', ['-n', 'scripts/setup.sh']).status, 0));

test('docs contain no secrets', () => {
  assert.deepEqual(findSecrets(readFileSync('docs/setup.md', 'utf8') + readFileSync('docs/testy-akceptacyjne.md', 'utf8')), []);
});

test('setup guide covers every step the spec needs', () => {
  const doc = readFileSync('docs/setup.md', 'utf8');
  for (const s of ['Krok 0', 'Dom-TEST', 'domyślne powiadomienia', '/setprivacy', 'In production', 'google-auth.mjs', 'płatny', 'DOM_MODE=prod', 'Dom – błędy', 'Wispr Flow', 'przekazywania']) {
    assert.ok(doc.includes(s), s);
  }
});
