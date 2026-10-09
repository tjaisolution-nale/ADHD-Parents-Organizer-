// Deterministyczne kontrole po parsowaniu: lepiej zapytać, niż zapisać zły termin.
import { localParts, zonedToMs, addDays } from './time.js';

const WEEKDAY_WORDS = [
  [1, ['poniedziałek', 'poniedzialek', 'pn', 'monday']],
  [2, ['wtorek', 'wt', 'tuesday']],
  [3, ['środa', 'środę', 'sroda', 'srode', 'śr', 'wednesday']],
  [4, ['czwartek', 'czw', 'thursday']],
  [5, ['piątek', 'piatek', 'pt', 'friday']],
  [6, ['sobota', 'sobotę', 'sobote', 'sob', 'saturday']],
  [7, ['niedziela', 'niedzielę', 'niedziele', 'nd', 'sunday']],
];
const WEEKDAY_RES = WEEKDAY_WORDS.map(([n, words]) => [n, new RegExp(`(?<![\\p{L}\\p{N}])(${words.join('|')})(?![\\p{L}\\p{N}])`, 'iu')]);

function mentionedWeekdays(text) {
  return new Set(WEEKDAY_RES.filter(([, re]) => re.test(text || '')).map(([n]) => n));
}

export function checkParsed(p, { nowMs, tz, text, allDay = false }) {
  if (p.pewnosc < 0.7) return { ok: false, reason: 'low_confidence' };
  if (!p.data) return { ok: false, reason: 'missing_date' };
  const today = localParts(nowMs, tz).date;
  const past = p.godzina ? zonedToMs(p.data, p.godzina, tz) < nowMs : p.data < today;
  if (past) return { ok: false, reason: 'past' };
  if (p.data > addDays(today, 365)) return { ok: false, reason: 'too_far' };
  const days = mentionedWeekdays(text);
  if (days.size === 1 && !days.has(localParts(zonedToMs(p.data, '12:00', tz), tz).weekday)) {
    return { ok: false, reason: 'weekday_mismatch' };
  }
  if (!p.godzina && p.typ !== 'rachunek' && !allDay) return { ok: false, reason: 'missing_time' };
  return { ok: true };
}
