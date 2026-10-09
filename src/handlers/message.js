// Dodawanie spraw z wiadomości w grupie „Dom”.
import { parseWithRetry } from '../parse.js';
import { checkParsed } from '../guards.js';
import { busyBetween, insertEvent, toEventBody } from '../calendar.js';
import { findClash, nextFreeStart } from '../slots.js';
import { localParts, zonedToMs, formatPl, addDays } from '../time.js';
import { PERSON, buildTitle, setMeta } from '../titles.js';
import { newKey } from '../store.js';

const DAY = 86400000;
const MIN = 60000;
const DEFAULT_MINUTES = 30;
const CLASH_HORIZON = 3 * 60 * MIN;
const BILL_LEAD_DAYS = 3;
const LEADING_PERSON = /^\s*(🟦|🟩|🟨)/u;
const KEY_OF = { '🟦': 'b', '🟩': 'g', '🟨': 'y' };
const INTRO = {
  past: '⏳ Ten termin już minął. Kiedy?',
  weekday_mismatch: '🤔 Data nie zgadza się z dniem tygodnia. Kiedy?',
  low_confidence: '🤔 Nie mam pewności co do terminu. Kiedy?',
  missing_date: 'Kiedy?',
  too_far: 'Kiedy?',
};

const send = (ctx, text, keyboard) => ctx.io.tg('sendMessage', {
  chat_id: ctx.config.chatId, text, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
});
const btn = (text, data) => ({ text, callback_data: data });

export function senderKey(ctx, from, chatId) {
  if (chatId !== ctx.config.chatId || !from || from.is_bot) return null;
  if (from.id === ctx.config.ids.b) return 'b';
  if (from.id === ctx.config.ids.g) return 'g';
  return null;
}

export function taskKeyboard(k) {
  return [[btn('✅ Zrobione', `ok:${k}`), btn('⏰ +15 min', `sn:${k}`)], [btn('Jutro', `tm:${k}`), btn('↩️ Cofnij', `un:${k}`)]];
}

export const confirmText = (title, date, time) => `${title} · ${formatPl(date, time)}`;

function remember(ctx, entry) {
  const k = newKey(ctx.store);
  ctx.store.pending[k] = { ...entry, exp: ctx.now + DAY };
  return k;
}

export function askDay(ctx, k, intro) {
  return send(ctx, intro, [
    [btn('Dziś', `pd:${k}:dzis`), btn('Jutro', `pd:${k}:jutro`)],
    [btn('Weekend', `pd:${k}:weekend`), btn('Przyszły tydzień', `pd:${k}:tydzien`)],
  ]);
}

export function askTime(ctx, k) {
  return send(ctx, 'O której?', [
    [btn('Rano 9:00', `pt:${k}:rano`), btn('Po południu 15:00', `pt:${k}:popoludnie`)],
    [btn('Wieczór 19:00', `pt:${k}:wieczor`), btn('Cały dzień', `pt:${k}:caly`)],
  ]);
}

const sourceMeta = (src) => ({ utworzone_przez: 'bot', 'źródło': `telegram:${src}` });

export async function saveInbox(ctx, { text, sender, src }) {
  const tekst = [...(text || 'Głosówka do odsłuchania')].slice(0, 80).join('');
  const title = buildTitle({ osoba: sender, typ: 'inbox', tekst });
  const date = localParts(ctx.now, ctx.config.tz).date;
  const body = toEventBody({ title, date, time: null, durationMin: DEFAULT_MINUTES, description: setMeta('', sourceMeta(src)), tz: ctx.config.tz });
  return insertEvent(ctx, ctx.config.domCal, body);
}

export async function createFromParsed(ctx, { parsed, sender, src, allDay = false, skipClash = false }) {
  const { tz, domCal } = ctx.config;
  const osoba = parsed.osoba ? KEY_OF[parsed.osoba] : sender;
  const bill = parsed.typ === 'rachunek';
  // Rachunek: przypomnienie 3 dni przed terminem (albo dziś), jak w Routine porannej.
  const today = localParts(ctx.now, tz).date;
  const lead = bill && parsed.data ? addDays(parsed.data, -BILL_LEAD_DAYS) : null;
  const date = lead ? (lead > today ? lead : today) : parsed.data;
  const tekst = bill && parsed.data ? `${parsed.tytul} – termin ${parsed.data.slice(8, 10)}.${parsed.data.slice(5, 7)}` : parsed.tytul;
  const title = buildTitle({ osoba, typ: parsed.typ, tekst });
  const time = allDay || bill ? null : parsed.godzina;
  const minutes = parsed.czas_min ?? DEFAULT_MINUTES;

  if (time && !skipClash) {
    const start = zonedToMs(parsed.data, time, tz);
    const duration = minutes * MIN;
    const busy = await busyBetween(ctx, start, start + CLASH_HORIZON + duration);
    const clash = findClash(busy, start, start + duration);
    if (clash) {
      const free = nextFreeStart(busy, start, duration);
      const alt = free === null ? null : localParts(free, tz);
      const k = remember(ctx, { parsed, sender, src, allDay, alt: alt && { date: alt.date, time: alt.time } });
      const row = [...(alt ? [btn(`Wstaw o ${alt.time}`, `cl:${k}:wstaw`)] : []), btn('Zostaw', `cl:${k}:zostaw`)];
      await send(ctx, `⚠️ koliduje z ${clash.title}`, [row]);
      return;
    }
  }

  const meta = {
    ...sourceMeta(src),
    ...(parsed.kwota != null ? { kwota: `£${parsed.kwota.toFixed(2)}` } : {}),
    ...(bill && parsed.data ? { termin: parsed.data } : {}),
  };
  const body = toEventBody({ title, date, time, durationMin: minutes, description: setMeta('', meta), tz });
  const ev = await insertEvent(ctx, domCal, body);
  const k = newKey(ctx.store);
  ctx.store.cb[k] = { ev: ev.id, exp: ctx.now + 14 * DAY };
  await send(ctx, confirmText(title, date, time), taskKeyboard(k));
}

export async function handleMessage(ctx, msg) {
  const sender = senderKey(ctx, msg.from, msg.chat?.id);
  if (!sender || (!msg.text && !msg.voice)) return;
  const { tz } = ctx.config;
  const sent = localParts(msg.date * 1000, tz);
  const meta = { today: sent.date, weekday: sent.weekday, sender: PERSON[sender], tz };
  const input = msg.voice ? { audio: await ctx.io.tgFile(msg.voice.file_id) } : { text: msg.text };
  const text = msg.text ?? null;
  const src = msg.message_id;

  const res = await parseWithRetry(ctx, input, meta);
  if (!res.ok) {
    if (res.reason === 'invalid') {
      const k = remember(ctx, { text, sender, src });
      await send(ctx, '🤔 Nie udało się tego zrozumieć.', [[btn('📥 Zapisz do posortowania', `ib:${k}:zapisz`), btn('✍️ Napiszę jeszcze raz', `ib:${k}:anuluj`)]]);
      return;
    }
    await saveInbox(ctx, { text, sender, src });
    await send(ctx, '📥 Zapisane do posortowania. Rano Claude to uporządkuje.');
    return;
  }

  // Emoji osoby na początku wiadomości rozstrzyga, czyja to sprawa (silniejsze niż odczyt modelu).
  const leading = LEADING_PERSON.exec(text || '');
  const parsed = leading ? { ...res.value, osoba: leading[1] } : res.value;
  const check = checkParsed(parsed, { nowMs: ctx.now, tz, text });
  if (!check.ok) {
    const k = remember(ctx, { parsed, sender, src, text });
    if (check.reason === 'missing_time') await askTime(ctx, k);
    else await askDay(ctx, k, INTRO[check.reason]);
    return;
  }
  await createFromParsed(ctx, { parsed, sender, src });
}
