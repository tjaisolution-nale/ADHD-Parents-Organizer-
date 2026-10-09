// Czas lokalny w strefie z konfiguracji (Europe/London). Nigdy nie używa strefy maszyny.

const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const PL_DAYS = ['pn', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

const formatters = new Map();
function formatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return formatters.get(tz);
}

function fields(ms, tz) {
  const f = {};
  for (const { type, value } of formatter(tz).formatToParts(new Date(ms))) f[type] = value;
  return f;
}

export function localParts(ms, tz) {
  const f = fields(ms, tz);
  return { date: `${f.year}-${f.month}-${f.day}`, time: `${f.hour}:${f.minute}`, weekday: WEEKDAYS[f.weekday] };
}

function offsetAt(ms, tz) {
  const f = fields(ms, tz);
  const asUtc = Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour, +f.minute, +f.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

function wallClockUtc(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
}

export function zonedToMs(date, time, tz) {
  const guess = wallClockUtc(date, time);
  const before = guess - offsetAt(guess - DAY_MS / 2, tz);
  const after = guess - offsetAt(guess + DAY_MS / 2, tz);
  const matches = [before, after].filter((ms) => {
    const p = localParts(ms, tz);
    return p.date === date && p.time === time;
  });
  // Dwuznaczna godzina (jesienią) → pierwsze wystąpienie; nieistniejąca (wiosną) → przesunięcie za skok.
  return matches.length ? Math.min(...matches) : before;
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMinutesLocal(date, time, minutes, tz) {
  const p = localParts(zonedToMs(date, time, tz) + minutes * 60000, tz);
  return { date: p.date, time: p.time };
}

function isoWeekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export function weekStart(date) {
  return addDays(date, 1 - isoWeekday(date));
}

export function formatPl(date, time) {
  const [, m, d] = date.split('-');
  const day = `${PL_DAYS[isoWeekday(date) - 1]} ${d}.${m}`;
  return time ? `${day}, ${time}` : day;
}
