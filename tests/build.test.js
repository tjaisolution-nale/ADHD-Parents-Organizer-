import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildWorkflows } from '../scripts/build-workflows.mjs';
import { findSecrets } from '../scripts/lib/secret-scan.mjs';
import { localParts, addDays } from '../src/time.js';
import { textUpdate } from './helpers/fixtures.js';

const built = await buildWorkflows();

// Kod węzła Code uruchamiany tak jak w n8n 2.x (task runner): bez URL, URLSearchParams, fetch, structuredClone, process,
// z Object.defineProperty zastąpionym przez () => ({}) i zamrożonym Object. Sprawdzone w prawdziwym n8n 2.42.6.
function runInN8nSandbox(jsCode, { httpRequest, env, staticData }) {
  const context = vm.createContext({ setTimeout, clearTimeout, Buffer, btoa, atob, TextEncoder, TextDecoder, console });
  vm.runInContext('Object.defineProperty = () => ({}); Object.freeze(Object);', context);
  const fn = vm.runInContext(`(async function ($env, $getWorkflowStaticData) {\n${jsCode}\n})`, context);
  return fn.call({ helpers: { httpRequest } }, env, () => staticData);
}
const botWorkflow = JSON.parse(built['dom-bot.json']);
const codeOf = (wf) => wf.nodes.find(n => n.type === 'n8n-nodes-base.code').parameters.jsCode;

const FAKE_ENV = {
  TELEGRAM_BOT_TOKEN: 'fake-token', TELEGRAM_CHAT_ID: '-100', TELEGRAM_ID_NIEBIESKI: '1', TELEGRAM_ID_ZIELONY: '2',
  EMAIL_NIEBIESKI: 'b@x', EMAIL_ZIELONY: 'g@x', GEMINI_API_KEY: 'gk', GEMINI_MODEL: 'gemini-test',
  DOM_TEST_CALENDAR_ID: 'dom-test', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs', GOOGLE_REFRESH_TOKEN: 'rt',
  GENERIC_TIMEZONE: 'Europe/London',
};

function fakeHttp({ updates, parsed }) {
  const calls = [];
  const queue = [updates];
  const respond = (body, statusCode = 200) => ({ statusCode, headers: {}, body });
  const http = async (o) => {
    calls.push({ method: o.method, url: o.url, timeout: o.timeout });
    if (o.url === 'https://oauth2.googleapis.com/token') return respond(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
    if (o.url.startsWith('https://api.telegram.org/')) {
      const method = o.url.split('/').pop();
      if (method === 'getUpdates') return respond({ ok: true, result: o.body.limit === 1 ? [] : (queue.shift() || []) });
      return respond({ ok: true, result: { message_id: 1 } });
    }
    if (o.url.includes('generativelanguage.googleapis.com')) {
      assert.equal(o.headers['x-goog-api-key'], 'gk');
      return respond({ candidates: [{ content: { parts: [{ text: JSON.stringify(parsed) }] } }] });
    }
    if (o.url.startsWith('https://www.googleapis.com/calendar/v3/')) {
      assert.equal(o.headers.Authorization, 'Bearer tok');
      if (o.url.endsWith('/freeBusy')) return respond({ calendars: {} });
      if (o.method === 'GET') return respond({ items: [] });
      return respond({ id: 'e1', ...o.body });
    }
    throw new Error(`unexpected ${o.method} ${o.url}`);
  };
  http.calls = calls;
  return http;
}

test('bot workflow is wired', () => {
  assert.deepEqual(botWorkflow.nodes.map(n => [n.name, n.type, n.typeVersion]), [
    ['Co 5 s', 'n8n-nodes-base.scheduleTrigger', 1.2],
    ['Bot', 'n8n-nodes-base.code', 2],
  ]);
  assert.deepEqual(botWorkflow.nodes[0].parameters.rule.interval, [{ field: 'seconds', secondsInterval: 5 }]);
  assert.deepEqual(botWorkflow.connections['Co 5 s'].main[0], [{ node: 'Bot', type: 'main', index: 0 }]);
  assert.equal(botWorkflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(botWorkflow.active, false);
});

test('error workflow notifies 🟦', () => {
  const wf = JSON.parse(built['dom-bledy.json']);
  assert.equal(wf.name, 'Dom – błędy');
  assert.equal(wf.nodes[0].type, 'n8n-nodes-base.errorTrigger');
  const code = codeOf(wf);
  assert.ok(code.includes('$env.TELEGRAM_ID_NIEBIESKI') && code.includes('⚠️ Bot Dom: '));
});

test('bundle runs as an n8n Code node', async () => {
  const day = addDays(localParts(Date.now(), 'Europe/London').date, 2);
  const http = fakeHttp({ updates: [textUpdate(1)], parsed: { tytul: 'Basen', osoba: null, typ: 'zadanie', data: day, godzina: '09:00', czas_min: null, kwota: null, pewnosc: 0.9 } });
  const STATIC = {};
  const out = await runInN8nSandbox(codeOf(botWorkflow), { httpRequest: http, env: FAKE_ENV, staticData: STATIC });
  assert.deepEqual(JSON.parse(JSON.stringify(out)), [{ json: { processed: 1 } }]);
  assert.ok(http.calls.some(c => c.method === 'POST' && c.url.includes('/calendar/v3/calendars/dom-test/events')));
  assert.equal(STATIC.offset, 2);
});

test('review#6: workflows have stable ids and the bot points at the error workflow', () => {
  const errors = JSON.parse(built['dom-bledy.json']);
  assert.equal(botWorkflow.id, 'domBot0000000001');
  assert.equal(errors.id, 'domBledy00000001');
  assert.equal(botWorkflow.settings.errorWorkflow, 'domBledy00000001');
});

test('review#5: a broken configuration tells 🟦 once an hour instead of failing every 5 s', async () => {
  const http = fakeHttp({ updates: [], parsed: {} });
  const STATIC = {};
  const env = { ...FAKE_ENV, DOM_MODE: 'prod' };
  const first = await runInN8nSandbox(codeOf(botWorkflow), { httpRequest: http, env, staticData: STATIC });
  assert.equal(first[0].json.processed, 0);
  assert.match(first[0].json.error, /DOM_CALENDAR_ID/);
  await runInN8nSandbox(codeOf(botWorkflow), { httpRequest: http, env, staticData: STATIC });
  const sent = http.calls.filter(c => c.url.endsWith('/sendMessage'));
  assert.equal(sent.length, 1);
});

test('n8n run: every HTTP call has a timeout, so a request hung after the Mac sleeps cannot block runs for 5 minutes', async () => {
  const day = addDays(localParts(Date.now(), 'Europe/London').date, 2);
  const http = fakeHttp({ updates: [textUpdate(1)], parsed: { tytul: 'Basen', osoba: null, typ: 'zadanie', data: day, godzina: '09:00', czas_min: null, kwota: null, pewnosc: 0.9 } });
  await runInN8nSandbox(codeOf(botWorkflow), { httpRequest: http, env: FAKE_ENV, staticData: {} });
  const broken = fakeHttp({ updates: [], parsed: {} });
  await runInN8nSandbox(codeOf(botWorkflow), { httpRequest: broken, env: { ...FAKE_ENV, DOM_MODE: 'prod' }, staticData: {} });
  const calls = [...http.calls, ...broken.calls];
  assert.ok(calls.some(c => c.url.endsWith('/sendMessage')) && calls.some(c => c.url.includes('/calendar/v3/')));
  for (const c of calls) assert.ok(c.timeout > 0 && c.timeout <= 30000, `${c.method} ${c.url} timeout=${c.timeout}`);
});

test('generated workflows contain no secrets', () => {
  assert.deepEqual(findSecrets(built['dom-bot.json'] + built['dom-bledy.json']), []);
});

test('committed workflows are up to date', () => {
  for (const [name, text] of Object.entries(built)) {
    assert.equal(readFileSync(`n8n/workflows/${name}`, 'utf8'), text, `${name} jest nieaktualny: npm run build:n8n`);
  }
});
