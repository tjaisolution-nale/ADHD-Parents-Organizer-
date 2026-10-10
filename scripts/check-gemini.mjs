// Jedno wywołanie Gemini takie jak w bocie (prompt + schemat odpowiedzi) z kluczem i modelem z n8n/.env:
// działa (i jak szybko) albo mówi dlaczego nie i co zrobić.
// Użycie: npm run check:gemini
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readEnv } from './lib/env.mjs';
import { buildGeminiRequest, readGeminiResponse } from '../src/parse.js';
import { localParts } from '../src/time.js';

const BOT_TIMEOUT_S = 30; // HTTP_TIMEOUT_MS w src/n8n-entry.js

export function geminiHint(status, message) {
  if (status === 429) {
    return 'Limit darmowego planu jest wyczerpany. Dzienny odnawia się o północy czasu pacyficznego (około 8:00 w UK). '
      + 'Możesz też wpisać GEMINI_MODEL=gemini-flash-lite-latest (wyższe darmowe limity) albo włączyć płatny plan (Set up billing w AI Studio).';
  }
  if (status === 404) return 'Nie ma takiego modelu. Sprawdź GEMINI_MODEL w n8n/.env, np. gemini-flash-lite-latest.';
  if (status === 400 || status === 401 || status === 403) return 'Klucz nie działa. Skopiuj GEMINI_API_KEY jeszcze raz z AI Studio (ikona kopiowania przy kluczu).';
  if (status >= 500) return 'Gemini jest chwilowo przeciążony po stronie Google. Spróbuj za kilka minut.';
  return `Nieoczekiwana odpowiedź: ${message}`;
}

export function speedNote(seconds) {
  if (seconds > BOT_TIMEOUT_S) return `Odpowiedź przyszła za wolno: bot czeka najwyżej ${BOT_TIMEOUT_S} s, więc takie wiadomości trafią do 📥. Spróbuj GEMINI_MODEL=gemini-flash-lite-latest.`;
  if (seconds > 20) return `To blisko limitu ${BOT_TIMEOUT_S} s, który bot daje Gemini. Jeśli wiadomości często trafiają do 📥, spróbuj GEMINI_MODEL=gemini-flash-lite-latest.`;
  return '';
}

async function main() {
  const env = readEnv('n8n/.env');
  const tz = env.GENERIC_TIMEZONE || 'Europe/London';
  const { date: today, weekday } = localParts(Date.now(), tz);
  const body = buildGeminiRequest({ text: 'jutro 18 test' }, { today, weekday, sender: '🟦', tz }, readFileSync('prompts/gemini-parse.md', 'utf8'));
  console.log(`Pytam Gemini (${env.GEMINI_MODEL}) tak jak bot: „jutro 18 test”…`);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
    });
  } catch (err) {
    console.log(`✗ Brak odpowiedzi od Gemini (${err.name === 'TimeoutError' ? 'ponad 120 s' : err.message}).\n\n→ ${speedNote(999)}`);
    process.exitCode = 1;
    return;
  }
  const seconds = (Date.now() - t0) / 1000;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`✗ Gemini ${res.status} po ${seconds.toFixed(1)} s: ${json.error?.message || res.statusText}\n\n→ ${geminiHint(res.status, json.error?.message || '')}`);
    process.exitCode = 1;
    return;
  }
  const parsed = readGeminiResponse(json);
  const what = parsed.ok ? `${parsed.value.data ?? '—'} ${parsed.value.godzina ?? '—'} · ${parsed.value.typ}` : `odpowiedź nieczytelna (${parsed.errors.join(', ')})`;
  console.log(`✓ Gemini odpowiedział w ${seconds.toFixed(1)} s: ${what}`);
  const note = speedNote(seconds);
  if (note) console.log(`\n→ ${note}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
