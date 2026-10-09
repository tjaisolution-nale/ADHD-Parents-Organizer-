// Przyciski pod wiadomościami bota.
import { getEvent, patchEvent, deleteEvent, movedToDate, shiftedBy, eventStartMs } from '../calendar.js';
import { localParts, addDays, zonedToMs } from '../time.js';
import { parseDescription } from '../titles.js';
import { senderKey, createFromParsed, saveInbox, askTime } from './message.js';

const DAY = 86400000;
const TIMES = { rano: '09:00', popoludnie: '15:00', wieczor: '19:00' };
const EXPIRED = 'Ten przycisk już wygasł';

// Haczyk dla ✅ (Zadanie 11 podmienia go na onDone).
let doneHandler = async () => {};
export function setDoneHandler(fn) { doneHandler = fn; }

const answer = (ctx, cq, text) => ctx.io.tg('answerCallbackQuery', { callback_query_id: cq.id, ...(text ? { text } : {}) });
const editText = (ctx, cq, text) => ctx.io.tg('editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text });
const clearButtons = (ctx, cq) => ctx.io.tg('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });

function pickDate(choice, nowMs, tz) {
  const { date, weekday } = localParts(nowMs, tz);
  if (choice === 'dzis') return date;
  if (choice === 'jutro') return addDays(date, 1);
  if (choice === 'weekend') return weekday >= 6 ? date : addDays(date, 6 - weekday);
  if (choice === 'tydzien') return addDays(date, 8 - weekday);
  return null;
}

async function onEventButton(ctx, cq, action, entry, k) {
  const { domCal, tz } = ctx.config;
  if (action === 'ok') {
    await doneHandler(ctx, { eventId: entry.ev, clicker: senderKey(ctx, cq.from, cq.message.chat.id), chatId: cq.message.chat.id, messageId: cq.message.message_id, callbackId: cq.id });
    return;
  }
  const ev = await getEvent(ctx, domCal, entry.ev);
  if (action === 'sn') {
    if (ev.start.date) return answer(ctx, cq, 'Całodniowe: użyj Jutro');
    await patchEvent(ctx, domCal, ev.id, shiftedBy(ev, 15, tz));
    return answer(ctx, cq, '⏰ +15 min');
  }
  if (action === 'tm') {
    const date = ev.start.date || localParts(eventStartMs(ev, tz), tz).date;
    await patchEvent(ctx, domCal, ev.id, movedToDate(ev, addDays(date, 1), tz));
    return answer(ctx, cq, '📅 Przeniesione na jutro');
  }
  if (action === 'un') {
    const own = parseDescription(ev.description).meta.utworzone_przez === 'bot';
    if (!own || ctx.now - Date.parse(ev.created) >= DAY) return answer(ctx, cq, 'Tego już nie da się cofnąć');
    await deleteEvent(ctx, domCal, ev.id);
    delete ctx.store.cb[k];
    await editText(ctx, cq, '↩️ Cofnięte');
    return answer(ctx, cq);
  }
  return answer(ctx, cq);
}

async function onPendingButton(ctx, cq, action, entry, k, choice) {
  const { tz } = ctx.config;
  const { sender, src } = entry;
  if (action === 'pd') {
    const parsed = { ...entry.parsed, data: pickDate(choice, ctx.now, tz) };
    const pastTime = parsed.godzina && zonedToMs(parsed.data, parsed.godzina, tz) < ctx.now;
    if ((!parsed.godzina && parsed.typ !== 'rachunek') || pastTime) {
      entry.parsed = { ...parsed, godzina: null };
      await clearButtons(ctx, cq);
      await askTime(ctx, k);
      return answer(ctx, cq);
    }
    delete ctx.store.pending[k];
    await clearButtons(ctx, cq);
    await createFromParsed(ctx, { parsed, sender, src });
    return answer(ctx, cq);
  }
  delete ctx.store.pending[k];
  await clearButtons(ctx, cq);
  if (action === 'pt') {
    const allDay = choice === 'caly';
    const parsed = { ...entry.parsed, godzina: allDay ? null : TIMES[choice] };
    await createFromParsed(ctx, { parsed, sender, src, allDay });
  } else if (action === 'cl') {
    const parsed = choice === 'wstaw' && entry.alt ? { ...entry.parsed, data: entry.alt.date, godzina: entry.alt.time } : entry.parsed;
    await createFromParsed(ctx, { parsed, sender, src, allDay: entry.allDay, skipClash: true });
  } else if (action === 'ib') {
    if (choice === 'zapisz') {
      await saveInbox(ctx, { text: entry.text, sender, src });
      await editText(ctx, cq, '📥 Zapisane do posortowania');
    } else {
      await editText(ctx, cq, '✍️ OK, napisz jeszcze raz');
    }
  }
  return answer(ctx, cq);
}

export async function handleCallback(ctx, cq) {
  if (!senderKey(ctx, cq.from, cq.message?.chat?.id)) return answer(ctx, cq);
  const [action, k, choice] = String(cq.data || '').split(':');
  if (['ok', 'sn', 'tm', 'un'].includes(action)) {
    const entry = ctx.store.cb[k];
    if (!entry) return answer(ctx, cq, EXPIRED);
    return onEventButton(ctx, cq, action, entry, k);
  }
  if (['pd', 'pt', 'cl', 'ib'].includes(action)) {
    const entry = ctx.store.pending[k];
    if (!entry) return answer(ctx, cq, EXPIRED);
    return onPendingButton(ctx, cq, action, entry, k, choice);
  }
  return answer(ctx, cq, EXPIRED);
}
