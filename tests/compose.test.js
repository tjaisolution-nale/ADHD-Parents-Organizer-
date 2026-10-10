import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Bot ma własny n8n, osobno od innych instancji na Macu (np. AI OS na 5678, jego kopia testowa na 5679).
test('bot n8n runs as its own compose project on port 5680', () => {
  const compose = readFileSync('n8n/docker-compose.yml', 'utf8');
  assert.match(compose, /^name: dom$/m);
  assert.match(compose, /"127\.0\.0\.1:5680:5678"/);
  assert.match(compose, /N8N_BLOCK_ENV_ACCESS_IN_NODE=false/);
  assert.match(readFileSync('n8n/.env.example', 'utf8'), /^N8N_VERSION=2\.41\.6$/m);
});

test('setup script and docs point at port 5680', () => {
  for (const file of ['scripts/setup.sh', 'docs/setup.md']) {
    const text = readFileSync(file, 'utf8');
    assert.ok(text.includes('localhost:5680'), file);
    assert.ok(!text.includes(':5678/') && !text.includes('localhost:5678'), file);
  }
});
