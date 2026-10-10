// Odczytuje z Telegrama id grupy „Dom” i id osób, które do niej pisały. Token bierze z n8n/.env i go nie wypisuje.
// Działa, dopóki bot w n8n jeszcze nie odbiera wiadomości (inaczej to on je zabiera).
// Użycie: npm run telegram:ids
import { fileURLToPath } from 'node:url';
import { readEnv } from './lib/env.mjs';

/** @returns {{ groups: Array<{ id, title }>, people: Array<{ id, name }>, started: string[] }} */
export function summarizeUpdates(updates) {
  const groups = new Map();
  const migrated = new Set();
  const people = new Map();
  const started = new Set();
  for (const u of updates) {
    const m = u.message || u.edited_message || u.my_chat_member;
    if (!m?.chat) continue;
    const name = m.from ? [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') : '';
    if (m.from && !m.from.is_bot) people.set(m.from.id, name);
    if (m.chat.type === 'group' || m.chat.type === 'supergroup') groups.set(m.chat.id, m.chat.title || '');
    if (m.migrate_to_chat_id) migrated.add(m.chat.id);
    if (m.chat.type === 'private' && m.from && !m.from.is_bot && /^\/start\b/.test(m.text || '')) started.add(name);
  }
  return {
    groups: [...groups].filter(([id]) => !migrated.has(id)).map(([id, title]) => ({ id, title })),
    people: [...people].map(([id, name]) => ({ id, name })),
    started: [...started],
  };
}

async function main() {
  const token = readEnv('n8n/.env').TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('Brak TELEGRAM_BOT_TOKEN w n8n/.env. Wklej tam token od BotFather i spróbuj ponownie.');
    process.exit(1);
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const body = await res.json();
  if (!body.ok) {
    console.log(`Telegram odmówił: ${body.description}. Sprawdź token w n8n/.env.`);
    process.exit(1);
  }
  const { groups, people, started } = summarizeUpdates(body.result);
  if (!groups.length && !people.length) {
    console.log('Brak wiadomości. Napiszcie oboje coś w grupie „Dom” i uruchom ponownie.');
    return;
  }
  console.log('Grupy (wpisz id grupy „Dom” jako TELEGRAM_CHAT_ID):');
  for (const g of groups) console.log(`  ${g.title || '(bez nazwy)'}  →  TELEGRAM_CHAT_ID=${g.id}`);
  console.log('\nOsoby (🟦 → TELEGRAM_ID_NIEBIESKI, 🟩 → TELEGRAM_ID_ZIELONY):');
  for (const p of people) console.log(`  ${p.name}  →  ${p.id}`);
  console.log(started.length
    ? `\n/start do bota napisał(a): ${started.join(', ')} ✓`
    : '\nNikt jeszcze nie napisał /start do bota prywatnie. 🟦 musi to zrobić, by dostawać powiadomienia o błędach.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
