import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairEnv } from '../scripts/fix-env.mjs';
import { checkEnv } from '../scripts/check-env.mjs';
import { readEnvText } from '../scripts/lib/env.mjs';

const TOKEN = '1//' + 'a'.repeat(30);

test('repairs a doubled key, quotes and spaces without printing values', () => {
  const { text, changes } = repairEnv(`A=1\nGOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN=${TOKEN}\nGEMINI_MODEL= "gemini-flash-latest" \n`);
  assert.equal(text, `A=1\nGOOGLE_REFRESH_TOKEN=${TOKEN}\nGEMINI_MODEL=gemini-flash-latest\n`);
  assert.deepEqual(changes.map(c => c.split(':')[0]), ['GOOGLE_REFRESH_TOKEN', 'GEMINI_MODEL']);
  assert.ok(!changes.join(' ').includes(TOKEN));
});

test('a key present twice keeps the valid value in the first position', () => {
  const { text, changes } = repairEnv(`GOOGLE_REFRESH_TOKEN=${TOKEN}\nB=2\nGOOGLE_REFRESH_TOKEN=\n`);
  assert.equal(text, `GOOGLE_REFRESH_TOKEN=${TOKEN}\nB=2\n`);
  assert.equal(changes.length, 1);
});

test('nothing to repair leaves the text unchanged', () => {
  const ok = `A=1\n# komentarz\nGOOGLE_REFRESH_TOKEN=${TOKEN}\n`;
  assert.deepEqual(repairEnv(ok), { text: ok, changes: [] });
});

test('check:env names the exact problem', () => {
  const doubled = checkEnv(readEnvText(`GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN=${TOKEN}\n`), `GOOGLE_REFRESH_TOKEN=GOOGLE_REFRESH_TOKEN=${TOKEN}\n`);
  assert.match(doubled.rows.find(r => r.name === 'GOOGLE_REFRESH_TOKEN').hint, /dwa razy/);
  const odd = checkEnv({ GOOGLE_REFRESH_TOKEN: '1//aaaaaaaaaaaaaaaaaaaaaa—bbbb' });
  assert.match(odd.rows.find(r => r.name === 'GOOGLE_REFRESH_TOKEN').hint, /nietypowe znaki/);
  const twice = checkEnv(readEnvText(`GOOGLE_REFRESH_TOKEN=${TOKEN}\nGOOGLE_REFRESH_TOKEN=${TOKEN}\n`), `GOOGLE_REFRESH_TOKEN=${TOKEN}\nGOOGLE_REFRESH_TOKEN=${TOKEN}\n`);
  assert.match(twice.rows.find(r => r.name === 'GOOGLE_REFRESH_TOKEN').hint, /2 razy/);
});
