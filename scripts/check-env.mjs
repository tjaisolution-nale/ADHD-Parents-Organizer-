// Sprawdza format pól w n8n/.env, krok po kroku z docs/setup.md. Nigdy nie wypisuje wartości.
// Użycie: npm run check:env
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { readEnvText } from './lib/env.mjs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GROUP_CAL = /^[^\s@]+@group\.calendar\.google\.com$/;

// [nazwa, krok, wzorzec, podpowiedź, czy może zostać puste]
const FIELDS = [
  ['N8N_VERSION', 'krok 3', /^\d+\.\d+\.\d+$/, 'wersja w postaci 2.41.6'],
  ['GENERIC_TIMEZONE', 'krok 3', /^Europe\/London$/, 'Europe/London'],
  ['TZ', 'krok 3', /^Europe\/London$/, 'Europe/London'],
  ['EMAIL_NIEBIESKI', 'krok 4', EMAIL, 'adres e-mail konta Google 🟦'],
  ['EMAIL_ZIELONY', 'krok 4', EMAIL, 'adres e-mail konta Google 🟩'],
  ['DOM_TEST_CALENDAR_ID', 'krok 4', GROUP_CAL, 'identyfikator kalendarza „Dom-TEST” kończy się na @group.calendar.google.com'],
  ['DOM_CALENDAR_ID', 'krok 4', GROUP_CAL, 'identyfikator kalendarza „Dom” kończy się na @group.calendar.google.com'],
  ['PARTNER_CALENDAR_ID', 'krok 4', /^[^\s@]+@[^\s@]+$/, 'adres e-mail 🟩 (to ID głównego kalendarza 🟩); bez niego bot nie widzi zajętości 🟩', true],
  ['TELEGRAM_BOT_TOKEN', 'krok 5', /^\d{6,12}:[A-Za-z0-9_-]{30,}$/, 'token z BotFather w postaci 123456789:AA…'],
  ['TELEGRAM_CHAT_ID', 'krok 5', /^-\d+$/, 'id grupy „Dom” to liczba ujemna, np. -100…'],
  ['TELEGRAM_ID_NIEBIESKI', 'krok 5', /^\d+$/, 'id osoby to liczba dodatnia'],
  ['TELEGRAM_ID_ZIELONY', 'krok 5', /^\d+$/, 'id osoby to liczba dodatnia'],
  ['GOOGLE_CLIENT_ID', 'krok 6', /^\S+\.apps\.googleusercontent\.com$/, 'ID klienta kończy się na .apps.googleusercontent.com'],
  ['GOOGLE_CLIENT_SECRET', 'krok 6', /^GOCSPX-[0-9A-Za-z_-]{20,}$/, 'sekret klienta zaczyna się od GOCSPX-'],
  ['GOOGLE_REFRESH_TOKEN', 'krok 6', /^1\/\/[0-9A-Za-z_-]{20,}$/, 'refresh token zaczyna się od 1//'],
  ['GEMINI_API_KEY', 'krok 7', /^AIza[0-9A-Za-z_-]{35}$/, 'klucz z AI Studio zaczyna się od AIza'],
  ['GEMINI_MODEL', 'krok 7', /^gemini-[a-z0-9.-]+$/, 'sama nazwa modelu, np. gemini-…-flash, bez przedrostka models/'],
  ['GEMINI_DAILY_LIMIT', 'krok 7', /^[1-9]\d*$/, 'liczba wywołań dziennie, np. 200', true],
  ['DOM_MODE', 'krok 8', /^(test|prod)$/, 'test albo prod', true],
];

export function isValid(name, value) {
  const field = FIELDS.find(([n]) => n === name);
  return field ? field[2].test(value) : true;
}

const FIX = 'napraw automatycznie: npm run fix:env';

/**
 * @param env wartości z n8n/.env
 * @param raw surowa treść pliku (do wykrycia powtórzonych pól)
 * @returns {{ ok: boolean, rows: Array<{ name, step, status: 'ok'|'bad'|'empty'|'optional', hint? }> }}
 */
export function checkEnv(env, raw = '') {
  const prod = env.DOM_MODE === 'prod';
  const rows = FIELDS.map(([name, step, pattern, hint, optional]) => {
    const value = env[name] ?? '';
    const copies = raw.split('\n').filter((l) => l.trim().startsWith(`${name}=`)).length;
    if (copies > 1) return { name, step, status: 'bad', hint: `pole występuje w pliku ${copies} razy; ${FIX}` };
    if (!value) {
      const mayBeEmpty = optional || (name === 'DOM_CALENDAR_ID' && !prod);
      return { name, step, status: mayBeEmpty ? 'optional' : 'empty', hint };
    }
    if (value.includes(`${name}=`)) return { name, step, status: 'bad', hint: `nazwa pola jest w linii dwa razy; ${FIX}` };
    if (/\s/.test(value) || /^["']|["']$/.test(value)) return { name, step, status: 'bad', hint: `usuń spacje i cudzysłowy wokół wartości; ${FIX}` };
    if (/[^\x21-\x7E]/.test(value)) return { name, step, status: 'bad', hint: 'zawiera nietypowe znaki (np. z autokorekty edytora); wklej wartość jeszcze raz' };
    return pattern.test(value) ? { name, step, status: 'ok' } : { name, step, status: 'bad', hint };
  });
  return { ok: rows.every((r) => r.status === 'ok' || r.status === 'optional'), rows };
}

const MARK = { ok: '✓', bad: '✗', empty: '·', optional: '○' };

function main() {
  const path = process.argv[2] || 'n8n/.env';
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch {
    console.log(`Nie ma pliku ${path}. Utwórz go: cp -n n8n/.env.example n8n/.env`);
    process.exit(1);
  }
  const { ok, rows } = checkEnv(readEnvText(raw), raw);
  let step = '';
  for (const r of rows) {
    if (r.step !== step) { step = r.step; console.log(`\n${step}`); }
    const note = r.status === 'empty' ? `jeszcze puste — ${r.hint}`
      : r.status === 'optional' ? `puste, opcjonalne — ${r.hint}`
      : r.hint || '';
    console.log(`  ${MARK[r.status]} ${r.name}${note ? `  (${note})` : ''}`);
  }
  console.log(ok ? '\nWszystko gotowe ✓' : '\n✓ dobrze · jeszcze puste ✗ do poprawy ○ opcjonalne');
  process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
