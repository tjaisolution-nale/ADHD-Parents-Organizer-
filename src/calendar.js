// Google Calendar API v3 przez wstrzykiwane io.
//
// Kontrakt io (Io), wspólny dla bota i testów:
//   tg(method, params) -> Promise<any>            wynik `result` z Telegram Bot API
//   tgFile(fileId) -> Promise<{ mime, base64 }>    pobrany plik (głosówka)
//   gemini(body) -> Promise<any>                   surowa odpowiedź generateContent
//   cal(method, path, { query?, body? }) -> Promise<any>   Calendar API; błąd autoryzacji ma err.fatal = true
//   sleep(ms) -> Promise<void>
// Ctx = { io, store, config, now }
import { addDays, addMinutesLocal, zonedToMs, localParts } from './time.js';

const enc = encodeURIComponent;
const iso = (ms) => new Date(ms).toISOString();
const PARTNER_BUSY = 'zajęte w kalendarzu 🟩';

export function toEventBody({ title, date, time, durationMin, description, tz }) {
  const body = { summary: title, description, reminders: { useDefault: true } };
  if (time) {
    const end = addMinutesLocal(date, time, durationMin, tz);
    body.start = { dateTime: `${date}T${time}:00`, timeZone: tz };
    body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone: tz };
  } else {
    body.start = { date };
    body.end = { date: addDays(date, 1) };
  }
  return body;
}

function pointMs(point, tz) {
  if (point.date) return zonedToMs(point.date, '00:00', tz);
  if (/(Z|[+-]\d{2}:\d{2})$/.test(point.dateTime)) return Date.parse(point.dateTime);
  const [date, rest] = point.dateTime.split('T');
  return zonedToMs(date, rest.slice(0, 5), point.timeZone || tz);
}

export const eventStartMs = (ev, tz) => pointMs(ev.start, tz);
export const eventEndMs = (ev, tz) => pointMs(ev.end, tz);

export async function listEvents(ctx, calId, fromMs, toMs) {
  const items = [];
  let pageToken;
  do {
    const query = { timeMin: iso(fromMs), timeMax: iso(toMs), singleEvents: true, orderBy: 'startTime', maxResults: 250 };
    if (pageToken) query.pageToken = pageToken;
    const res = await ctx.io.cal('GET', `/calendars/${enc(calId)}/events`, { query });
    items.push(...(res.items || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return items;
}

export const getEvent = (ctx, calId, id) => ctx.io.cal('GET', `/calendars/${enc(calId)}/events/${enc(id)}`);
export const insertEvent = (ctx, calId, body) => ctx.io.cal('POST', `/calendars/${enc(calId)}/events`, { body });
export const patchEvent = (ctx, calId, id, patch, { ifMatch } = {}) => ctx.io.cal('PATCH', `/calendars/${enc(calId)}/events/${enc(id)}`, {
  body: patch, ...(ifMatch ? { headers: { 'If-Match': ifMatch } } : {}),
});
export const deleteEvent = (ctx, calId, id) => ctx.io.cal('DELETE', `/calendars/${enc(calId)}/events/${enc(id)}`);

export async function busyBetween(ctx, fromMs, toMs) {
  const { domCal, primaryCal, partnerCal, tz } = ctx.config;
  const busy = [];
  for (const calId of [domCal, primaryCal]) {
    for (const ev of await listEvents(ctx, calId, fromMs, toMs)) {
      if (!ev.start?.dateTime || ev.transparency === 'transparent') continue;
      busy.push({ start: eventStartMs(ev, tz), end: eventEndMs(ev, tz), title: ev.summary || '' });
    }
  }
  if (partnerCal) {
    try {
      const res = await ctx.io.cal('POST', '/freeBusy', { body: { timeMin: iso(fromMs), timeMax: iso(toMs), timeZone: tz, items: [{ id: partnerCal }] } });
      for (const b of res.calendars?.[partnerCal]?.busy || []) {
        busy.push({ start: Date.parse(b.start), end: Date.parse(b.end), title: PARTNER_BUSY });
      }
    } catch (err) {
      if (err.fatal) throw err; // brak dostępu do kalendarza 🟩 nie blokuje dodawania
    }
  }
  return busy;
}

// Przeniesienie wydarzenia na inny dzień z zachowaniem lokalnej godziny i czasu trwania.
export function movedToDate(ev, date, tz) {
  if (ev.start.date) {
    const span = Math.round((Date.parse(`${ev.end.date}T00:00:00Z`) - Date.parse(`${ev.start.date}T00:00:00Z`)) / 86400000) || 1;
    return { start: { date }, end: { date: addDays(date, span) } };
  }
  const startMs = eventStartMs(ev, tz);
  const minutes = Math.round((eventEndMs(ev, tz) - startMs) / 60000);
  const { time } = localParts(startMs, tz);
  const end = addMinutesLocal(date, time, minutes, tz);
  return { start: { dateTime: `${date}T${time}:00`, timeZone: tz }, end: { dateTime: `${end.date}T${end.time}:00`, timeZone: tz } };
}

// Przesunięcie wydarzenia z godziną o podaną liczbę minut na osi czasu.
export function shiftedBy(ev, minutes, tz) {
  const point = (ms) => {
    const p = localParts(ms + minutes * 60000, tz);
    return { dateTime: `${p.date}T${p.time}:00`, timeZone: tz };
  };
  return { start: point(eventStartMs(ev, tz)), end: point(eventEndMs(ev, tz)) };
}
