// Sprawdzenie parsowania na prawdziwym Gemini: npm run eval:parse (wymaga n8n/.env z kluczem).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseWithRetry } from '../src/parse.js';
import { checkParsed } from '../src/guards.js';
import { zonedToMs, localParts } from '../src/time.js';
import { ensureStore } from '../src/store.js';
import { readEnv } from './lib/env.mjs';

const shouldAsk = (e) => e.data === null || (e.godzina === null && e.typ !== 'rachunek');

// result: { saved: false } albo { saved: true, value: Parsed }
export function classify(expect, result) {
  if (!result.saved) return shouldAsk(expect) ? 'correct' : 'asked';
  const v = result.value;
  const same = v.data === expect.data && v.godzina === expect.godzina && v.osoba === expect.osoba
    && (v.typ === 'rachunek') === (expect.typ === 'rachunek');
  return same && !shouldAsk(expect) ? 'correct' : 'wrong_saved';
}

async function main() {
  const env = readEnv('n8n/.env');
  const golden = JSON.parse(readFileSync('tests/parse-golden.json', 'utf8'));
  const tz = env.GENERIC_TIMEZONE || 'Europe/London';
  const io = {
    async gemini(body) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}`);
      return res.json();
    },
  };
  const counts = { correct: 0, asked: 0, wrong_saved: 0 };
  for (const g of golden) {
    const now = zonedToMs(g.today, '08:00', tz);
    const ctx = { io, store: ensureStore({}), config: { tz, geminiLimit: 1000, parsePrompt: readFileSync('prompts/gemini-parse.md', 'utf8') }, now };
    const meta = { today: g.today, weekday: localParts(now, tz).weekday, sender: g.sender, tz };
    const res = await parseWithRetry(ctx, { text: g.text }, meta);
    const saved = res.ok && checkParsed(res.value, { nowMs: now, tz, text: g.text }).ok;
    const outcome = classify(g.expect, saved ? { saved: true, value: res.value } : { saved: false });
    counts[outcome]++;
    const got = res.ok ? `${res.value.data ?? '—'} ${res.value.godzina ?? '—'} ${res.value.osoba ?? '·'} ${res.value.typ}` : res.reason;
    console.log(`${outcome.padEnd(11)} | ${g.text.padEnd(48)} | ${got}`);
  }
  const score = counts.correct / golden.length;
  console.log(`\npoprawne: ${counts.correct}/${golden.length} (${Math.round(score * 100)}%), pytania zamiast zapisu: ${counts.asked}, błędnie zapisane: ${counts.wrong_saved}`);
  process.exit(score < 0.9 || counts.wrong_saved > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
