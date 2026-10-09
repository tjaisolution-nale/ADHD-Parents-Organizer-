import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('CLI exits 1 on a planted token and 0 on clean files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-'));
  writeFileSync(join(dir, 'bad.txt'), '123456789:' + 'A'.repeat(35));
  writeFileSync(join(dir, 'ok.txt'), 'czysto');
  const bad = spawnSync('node', ['scripts/lib/secret-scan.mjs', join(dir, 'bad.txt')], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout + bad.stderr, /bad\.txt: telegram_bot_token/);
  assert.equal(spawnSync('node', ['scripts/lib/secret-scan.mjs', join(dir, 'ok.txt')]).status, 0);
});
