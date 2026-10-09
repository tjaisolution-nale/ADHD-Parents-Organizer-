// Punkty: 🎰 Los, 🔥 Combo, 🙌 Piątka, cele tygodnia i paski postępu.
import { parseTitle, parseDescription, parsePkt, personFromEvent, PERSON } from './titles.js';
import { eventStartMs } from './calendar.js';
import { localParts } from './time.js';

const MIN = 60000;
const COMBO_WINDOW = 20 * MIN;
const COMBO_MAX = 5;
const HIGH_FIVE_WINDOW = 60 * MIN;
const MIN_GOAL = 5;

export const SLOT_LABEL = { jackpot: '777! JACKPOT', triple: 'Trójka!', pair: 'Para!', none: 'Zawsze coś wpada 😉' };
const SLOT_BONUS = { jackpot: 9, triple: 4, pair: 1, none: 0 };

// Telegram 🎰: value − 1 = b1 + 4·b2 + 16·b3; 64 to 777.
export function decodeSlot(value) {
  const n = value - 1;
  const reels = [n % 4, Math.floor(n / 4) % 4, Math.floor(n / 16) % 4];
  const distinct = new Set(reels).size;
  const kind = value === 64 ? 'jackpot' : distinct === 1 ? 'triple' : distinct === 2 ? 'pair' : 'none';
  return { reels, kind, bonus: SLOT_BONUS[kind] };
}

export function nextCombo(state, nowMs) {
  const inWindow = state.last !== null && nowMs - state.last <= COMBO_WINDOW;
  const level = inWindow ? Math.min(COMBO_MAX, state.level + 1) : 1;
  return { last: nowMs, level, bonus: level - 1 };
}

export function isHighFive(lastOther, lastHighFive, nowMs) {
  if (lastOther === null || nowMs - lastOther > HIGH_FIVE_WINDOW) return false;
  return lastHighFive === null || nowMs - lastHighFive >= HIGH_FIVE_WINDOW;
}

export function weeklyGoal(history) {
  if (history.length < 2) return MIN_GOAL;
  const [a, b] = history.slice(-2);
  return Math.max(MIN_GOAL, Math.ceil(((a + b) * 9) / 20)); // 90% średniej, bez błędów zmiennoprzecinkowych
}

export function percent(points, goal) {
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((points / goal) * 100));
}

function bar(pct) {
  const blocks = Math.round(pct / 20);
  return '▓'.repeat(blocks) + '░'.repeat(5 - blocks);
}

export function renderBars(pts, goals) {
  const b = percent(pts.b, goals.b);
  const g = percent(pts.g, goals.g);
  const t = percent(pts.b + pts.g, goals.b + goals.g);
  return `${PERSON.b} ${bar(b)} ${b}%  ${PERSON.g} ${bar(g)} ${g}%  🎯 drużyna ${bar(t)} ${t}%`;
}

export function eventPoints(event, emails) {
  if (!parseTitle(event.summary).done) return { b: 0, g: 0 };
  const { pkt } = parseDescription(event.description).meta;
  if (pkt !== undefined) return parsePkt(pkt);
  const who = personFromEvent(event, emails);
  return { b: who === 'b' || who === 'y' ? 1 : 0, g: who === 'g' || who === 'y' ? 1 : 0 };
}

// Do którego dnia (a więc tygodnia) należą punkty: dzień kliknięcia ✅, a bez niego dzień wydarzenia.
export function eventWeekDate(event, tz) {
  const done = /^(\d{4}-\d{2}-\d{2})T/.exec(parseDescription(event.description).meta.zrobione || '');
  if (done) return done[1];
  return event.start.date || localParts(eventStartMs(event, tz), tz).date;
}

export function weekPoints(events, emails) {
  return events.reduce((sum, ev) => {
    const p = eventPoints(ev, emails);
    return { b: sum.b + p.b, g: sum.g + p.g };
  }, { b: 0, g: 0 });
}
