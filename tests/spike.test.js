import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findSecrets } from '../scripts/lib/secret-scan.mjs';

test('spike workflow checks every capability the bot needs', () => {
  const wf = JSON.parse(readFileSync('n8n/workflows/spike.json', 'utf8'));
  assert.deepEqual(wf.nodes.map(n => n.type).sort(), ['n8n-nodes-base.code', 'n8n-nodes-base.scheduleTrigger']);
  const code = wf.nodes.find(n => n.type === 'n8n-nodes-base.code').parameters.jsCode;
  for (const s of ['this.helpers.httpRequest', '$env', '$getWorkflowStaticData', 'setTimeout', "encoding: 'arraybuffer'", 'returnFullResponse', 'ignoreHttpStatusErrors', 'URLSearchParams', 'count']) assert.ok(code.includes(s), s);
  assert.deepEqual(findSecrets(JSON.stringify(wf)), []);
});
