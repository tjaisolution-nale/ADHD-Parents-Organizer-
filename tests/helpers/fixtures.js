// Gotowe obiekty Telegrama, wydarzeń i odpowiedzi Gemini do testów.
import { addDays, addMinutesLocal } from '../../src/time.js';

const TZ = 'Europe/London';
const DEFAULT_SENT = Date.UTC(2026, 9, 9, 7, 0); // pt 2026-10-09 08:00 Europe/London
let messageId = 1000;

export function textMsg(text, sentMs = DEFAULT_SENT, fromId = 1) {
  return { message_id: ++messageId, date: Math.floor(sentMs / 1000), chat: { id: -100, type: 'supergroup' }, from: { id: fromId, is_bot: false, first_name: 'Test' }, text };
}

export function textUpdate(updateId, text = 'jutro 9 basen') {
  return { update_id: updateId, message: textMsg(text) };
}

export function voiceMsg(fileId, sentMs = DEFAULT_SENT, fromId = 1) {
  const { text, ...msg } = textMsg('', sentMs, fromId);
  return { ...msg, voice: { file_id: fileId, mime_type: 'audio/ogg', duration: 3 } };
}

export function cb(data, fromId = 1) {
  return { id: `cbq-${++messageId}`, from: { id: fromId, is_bot: false }, data, message: { message_id: 99, chat: { id: -100 } } };
}

export function timed(title, date, time, minutes) {
  const end = addMinutesLocal(date, time, minutes, TZ);
  return { summary: title, description: '', start: { dateTime: `${date}T${time}:00`, timeZone: TZ }, end: { dateTime: `${end.date}T${end.time}:00`, timeZone: TZ } };
}

export function allDayEv(title, date) {
  return { summary: title, description: '', start: { date }, end: { date: addDays(date, 1) } };
}

export function wrap(text) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

export function ok(partial = {}) {
  return wrap(JSON.stringify({ tytul: 'X', osoba: null, typ: 'zadanie', data: null, godzina: null, czas_min: null, kwota: null, pewnosc: 0.9, ...partial }));
}
