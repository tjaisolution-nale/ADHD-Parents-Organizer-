// Pakuje src/ w jeden skrypt i generuje workflow n8n: npm run build:n8n (lub --check w CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const OUT_DIR = 'n8n/workflows';

async function bundle() {
  const result = await build({
    entryPoints: ['src/n8n-entry.js'], bundle: true, write: false, format: 'iife', globalName: 'DomBot',
    platform: 'neutral', target: 'es2020', loader: { '.md': 'text', '.json': 'json' }, charset: 'utf8', legalComments: 'none',
  });
  return result.outputFiles[0].text;
}

const json = (wf) => `${JSON.stringify(wf, null, 2)}\n`;

function botWorkflow(code) {
  const jsCode = `${code}
const r = await DomBot.main({ httpRequest: (o) => this.helpers.httpRequest(o), env: $env, staticData: $getWorkflowStaticData('global'), now: Date.now() });
return [{ json: r }];
`;
  return {
    name: 'Dom – bot',
    nodes: [
      { id: 'a7d3c1f0-0001-4b2e-8c11-000000000001', name: 'Co 5 s', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: 'seconds', secondsInterval: 5 }] } } },
      { id: 'a7d3c1f0-0002-4b2e-8c11-000000000002', name: 'Bot', type: 'n8n-nodes-base.code', typeVersion: 2, position: [240, 0], parameters: { jsCode } },
    ],
    connections: { 'Co 5 s': { main: [[{ node: 'Bot', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1', saveDataSuccessExecution: 'none', saveManualExecutions: false },
    active: false,
  };
}

function errorWorkflow() {
  const jsCode = `// Powiadamia 🟦, gdy workflow „Dom – bot” zakończy się błędem.
const message = $json.execution?.error?.message || 'nieznany błąd';
await this.helpers.httpRequest({
  method: 'POST',
  url: \`https://api.telegram.org/bot\${$env.TELEGRAM_BOT_TOKEN}/sendMessage\`,
  body: { chat_id: Number($env.TELEGRAM_ID_NIEBIESKI), text: \`⚠️ Bot Dom: \${message}\` },
  json: true,
});
return [{ json: { sent: true } }];
`;
  return {
    name: 'Dom – błędy',
    nodes: [
      { id: 'a7d3c1f0-0003-4b2e-8c11-000000000003', name: 'Błąd bota', type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
      { id: 'a7d3c1f0-0004-4b2e-8c11-000000000004', name: 'Powiadom', type: 'n8n-nodes-base.code', typeVersion: 2, position: [240, 0], parameters: { jsCode } },
    ],
    connections: { 'Błąd bota': { main: [[{ node: 'Powiadom', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' },
    active: false,
  };
}

export async function buildWorkflows() {
  const code = await bundle();
  return { 'dom-bot.json': json(botWorkflow(code)), 'dom-bledy.json': json(errorWorkflow()) };
}

async function main() {
  const files = await buildWorkflows();
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([name, text]) => {
      try { return readFileSync(`${OUT_DIR}/${name}`, 'utf8') !== text; } catch { return true; }
    }).map(([name]) => name);
    if (stale.length) {
      console.error(`Nieaktualne workflow: ${stale.join(', ')}. Uruchom: npm run build:n8n`);
      process.exit(1);
    }
    console.log('Workflow n8n są aktualne.');
    return;
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(`${OUT_DIR}/${name}`, text);
  console.log(`Zapisano: ${Object.keys(files).join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
