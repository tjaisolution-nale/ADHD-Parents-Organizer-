// Konwencje kalendarza „Dom”: tytuł `[✅ ]<osoba> [<typ> ]<treść>` i opis z liniami `klucz: wartość`.

export const PERSON = { b: '🟦', g: '🟩', y: '🟨' };
export const TYPE_EMOJI = { rachunek: '💸', krok: '🧩', inbox: '📥' };
const DONE = '✅';
const META_LINE = /^([a-ząćęłńóśźż_]+): (.*)$/;

export function buildTitle({ done = false, osoba, typ, tekst }) {
  const parts = [];
  if (done) parts.push(DONE);
  parts.push(PERSON[osoba]);
  if (TYPE_EMOJI[typ]) parts.push(TYPE_EMOJI[typ]);
  parts.push(tekst);
  return parts.join(' ');
}

function stripPrefix(text, prefixes) {
  for (const [key, emoji] of prefixes) {
    if (text.startsWith(emoji)) return [key, text.slice(emoji.length).trimStart()];
  }
  return [null, text];
}

export function parseTitle(title) {
  let rest = (title || '').trim();
  const done = rest.startsWith(DONE);
  if (done) rest = rest.slice(DONE.length).trimStart();
  const [osoba, afterPerson] = stripPrefix(rest, Object.entries(PERSON));
  const [typ, tekst] = stripPrefix(afterPerson, Object.entries(TYPE_EMOJI));
  return { done, osoba, typ: typ || 'zadanie', tekst };
}

export function markDone(title) {
  const t = (title || '').trim();
  return t.startsWith(DONE) ? t : `${DONE} ${t}`;
}

export function parseDescription(desc) {
  const lines = (desc || '').split('\n');
  const meta = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = META_LINE.exec(lines[i]);
    if (!m) break;
    meta[m[1]] = m[2];
  }
  return { meta, notes: lines.slice(i).join('\n').trim() };
}

export function setMeta(desc, entries) {
  const { meta, notes } = parseDescription(desc);
  const merged = { ...meta, ...entries };
  const metaText = Object.entries(merged).map(([k, v]) => `${k}: ${v}`).join('\n');
  return notes ? `${metaText}\n\n${notes}` : metaText;
}

export function findBySource(events, source) {
  return events.find((ev) => parseDescription(ev.description).meta['źródło'] === source) || null;
}

export function personFromEvent(event, emails) {
  const fromTitle = parseTitle(event.summary).osoba;
  if (fromTitle) return fromTitle;
  const creator = (event.creator?.email || '').toLowerCase();
  if (creator && creator === emails.b.toLowerCase()) return 'b';
  if (creator && creator === emails.g.toLowerCase()) return 'g';
  return null;
}

export function parsePkt(value) {
  const pts = { b: 0, g: 0 };
  for (const [, emoji, n] of (value || '').matchAll(/(🟦|🟩)\s*(\d+)/gu)) {
    pts[emoji === PERSON.b ? 'b' : 'g'] += Number(n);
  }
  return pts;
}

export function formatPkt({ b, g }) {
  const parts = [];
  if (b) parts.push(`${PERSON.b}${b}`);
  if (g) parts.push(`${PERSON.g}${g}`);
  return parts.join(' ');
}
