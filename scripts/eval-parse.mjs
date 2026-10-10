// Sprawdzenie parsowania na prawdziwym Gemini: npm run eval:parse (wymaga n8n/.env z kluczem).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWithRetry } from '../src/parse.js';
import { checkParsed } from '../src/guards.js';
import { zonedToMs, localParts } from '../src/time.js';
import { ensureStore } from '../src/store.js';
import { readEnv } from './lib/env.mjs';

// Ile sekund czekać po 429 (darmowy plan ma limit zapytań na minutę): RetryInfo z odpowiedzi + 1 s zapasu.
export function retryDelaySeconds(body) {
  const info = body?.error?.details?.find((d) => String(d['@type']).endsWith('RetryInfo'));
  const secs = parseFloat(info?.retryDelay);
  return Number.isFinite(secs) ? Math.ceil(secs) + 1 : 20;
}

// Wynik bez wywołań, które padły po stronie Google (limit, przeciążenie): to nie są pomyłki w rozumieniu.
export function scoreOf(counts, total) {
  const judged = total - counts.api_error;
  const score = judged ? counts.correct / judged : 0;
  return { judged, score, pass: judged > 0 && score >= 0.9 && counts.wrong_saved === 0 };
}

const shouldAsk = (e) => e.data === null || (e.godzina === null && e.typ !== 'rachunek');

// result: { saved: false } albo { saved: true, value: Parsed }; osoba null oznacza osobę wysyłającą
export function classify(expect, result, sender = '🟦') {
  if (!result.saved) return shouldAsk(expect) ? 'correct' : 'asked';
  const v = result.value;
  const same = v.data === expect.data && v.godzina === expect.godzina && (v.osoba ?? sender) === (expect.osoba ?? sender)
    && (v.typ === 'rachunek') === (expect.typ === 'rachunek');
  return same && !shouldAsk(expect) ? 'correct' : 'wrong_saved';
}

// Jedno próbne wywołanie przed testem: zły klucz albo nazwa modelu dają od razu czytelny powód.
export async function preflight(env) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
  });
  if (res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return `Gemini ${res.status}: ${body.error?.message || res.statusText}`;
}

async function main() {
  const env = readEnv('n8n/.env');
  const problem = await preflight(env);
  if (problem) {
    console.log(`✗ ${problem}\nSprawdź GEMINI_API_KEY i GEMINI_MODEL w n8n/.env (npm run check:env).`);
    process.exit(1);
  }
  const golden = JSON.parse(readFileSync('tests/parse-golden.json', 'utf8'));
  const tz = env.GENERIC_TIMEZONE || 'Europe/London';
  const io = {
    async gemini(body) {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify(body),
        });
        if ((res.status === 429 || res.status >= 500) && attempt < 4) {
          const wait = res.status === 429 ? retryDelaySeconds(await res.json().catch(() => ({}))) : 10;
          console.log(`  … Gemini ${res.status === 429 ? 'limit zapytań na minutę (darmowy plan)' : 'chwilowo przeciążony'}, czekam ${wait} s`);
          await new Promise((resolve) => setTimeout(resolve, wait * 1000));
          continue;
        }
        if (!res.ok) throw new Error(`Gemini ${res.status}`);
        return res.json();
      }
    },
  };
  const counts = { correct: 0, asked: 0, wrong_saved: 0, api_error: 0 };
  for (const g of golden) {
    const now = zonedToMs(g.today, '08:00', tz);
    const ctx = { io, store: ensureStore({}), config: { tz, geminiLimit: 1000, parsePrompt: readFileSync('prompts/gemini-parse.md', 'utf8') }, now };
    const meta = { today: g.today, weekday: localParts(now, tz).weekday, sender: g.sender, tz };
    const res = await parseWithRetry(ctx, { text: g.text }, meta);
    if (!res.ok && res.reason === 'error') {
      counts.api_error++;
      console.log(`${'api_error'.padEnd(11)} | ${g.text.padEnd(48)} | błąd po stronie Gemini, pominięte w wyniku`);
      continue;
    }
    const leading = /^\s*(🟦|🟩|🟨)/u.exec(g.text);
    const value = res.ok && leading ? { ...res.value, osoba: leading[1] } : res.ok ? res.value : null;
    const saved = res.ok && checkParsed(value, { nowMs: now, tz, text: g.text }).ok;
    const outcome = classify(g.expect, saved ? { saved: true, value } : { saved: false }, g.sender);
    counts[outcome]++;
    const got = res.ok ? `${value.data ?? '—'} ${value.godzina ?? '—'} ${value.osoba ?? '·'} ${value.typ}` : res.reason;
    console.log(`${outcome.padEnd(11)} | ${g.text.padEnd(48)} | ${got}`);
  }
  const { judged, score, pass } = scoreOf(counts, golden.length);
  console.log(`\npoprawne: ${counts.correct}/${judged} (${Math.round(score * 100)}%), pytania zamiast zapisu: ${counts.asked}, błędnie zapisane: ${counts.wrong_saved}, błędy Gemini (pominięte): ${counts.api_error}`);
  process.exit(pass ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
