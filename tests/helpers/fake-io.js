// Atrapa io: Telegram, Gemini i Kalendarz w pamięci. Zapisuje każde wywołanie w `calls`.
import { ensureStore } from '../../src/store.js';
import { eventStartMs, eventEndMs } from '../../src/calendar.js';

const TZ = 'Europe/London';

export const TEST_CONFIG = {
  botToken: 'test-token', chatId: -100, ids: { b: 1, g: 2 }, emails: { b: 'b@x', g: 'g@x' },
  geminiKey: 'k', geminiModel: 'gemini-test', geminiLimit: 200, mode: 'test',
  domCal: 'dom', primaryCal: 'primary', partnerCal: 'partner', tz: TZ,
  google: { clientId: 'cid', clientSecret: 'cs', refreshToken: 'rt' },
  rewards: { b: ['🎮 godzina gry'], g: ['📚 wieczór z książką'], team: ['🍕 pizza w piątek'] },
  parsePrompt: 'Dziś {{TODAY}} ({{WEEKDAY}}), pisze {{SENDER}}, strefa {{TZ}}.',
};

export function makeFakeIo({ gemini = [], updates = [], files = {}, events = [], partnerBusy = [], diceValues = [], answerFails = false } = {}) {
  const calls = [];
  const cals = { dom: [], primary: [] };
  let nextId = 1;
  let etag = 1;
  let messageId = 500;
  const fake = { now: Date.UTC(2026, 9, 9, 7, 0) };

  for (const ev of events) {
    const { calId = 'dom', ...rest } = ev;
    (cals[calId] ||= []).push({ id: rest.id || `ev${nextId++}`, created: '2026-01-01T00:00:00.000Z', etag: `"e${etag++}"`, ...rest });
  }

  const route = (path) => {
    const m = /^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(path);
    if (!m) return null;
    const calId = decodeURIComponent(m[1]);
    return { list: (cals[calId] ||= []), id: m[2] && decodeURIComponent(m[2]) };
  };

  const io = {
    async tg(method, params) {
      calls.push({ api: 'tg', method, params });
      if (method === 'getUpdates') return params.limit === 1 ? [] : (updates.shift() || []);
      if (method === 'sendMessage') return { message_id: ++messageId, ...params };
      if (method === 'sendDice') return { message_id: ++messageId, dice: { emoji: params.emoji, value: diceValues.shift() ?? 1 } };
      if (method === 'answerCallbackQuery' && answerFails) throw new Error('Telegram answerCallbackQuery: query is too old');
      return true;
    },
    async tgFile(fileId) {
      calls.push({ api: 'tgFile', method: 'tgFile', params: { fileId } });
      return files[fileId] || { mime: 'audio/ogg', base64: 'AAAA' };
    },
    async gemini(body) {
      calls.push({ api: 'gemini', method: 'generateContent', params: body });
      const next = gemini.shift();
      if (!next) throw new Error('no gemini response');
      if (next instanceof Error) throw next;
      return next;
    },
    async cal(method, path, opts = {}) {
      calls.push({ api: 'cal', method, params: { path, ...opts } });
      if (path === '/freeBusy') {
        return { calendars: { [opts.body.items[0].id]: { busy: partnerBusy } } };
      }
      const r = route(path);
      if (!r) throw new Error(`fake cal: unknown path ${path}`);
      if (method === 'GET' && !r.id) {
        const from = Date.parse(opts.query.timeMin);
        const to = Date.parse(opts.query.timeMax);
        const items = r.list
          .filter((ev) => eventStartMs(ev, TZ) < to && eventEndMs(ev, TZ) > from)
          .sort((a, b) => eventStartMs(a, TZ) - eventStartMs(b, TZ));
        return { items: structuredClone(items) };
      }
      const idx = r.list.findIndex((ev) => ev.id === r.id);
      if (method === 'POST') {
        const ev = { id: `ev${nextId++}`, created: new Date(fake.now).toISOString(), etag: `"e${etag++}"`, ...structuredClone(opts.body) };
        r.list.push(ev);
        return structuredClone(ev);
      }
      if (idx < 0) { const e = new Error('Not Found'); e.status = 404; throw e; }
      if (method === 'GET') return structuredClone(r.list[idx]);
      if (method === 'PATCH') {
        const ifMatch = opts.headers?.['If-Match'];
        if (ifMatch && ifMatch !== r.list[idx].etag) { const e = new Error('Precondition Failed'); e.status = 412; throw e; }
        Object.assign(r.list[idx], structuredClone(opts.body), { etag: `"e${etag++}"` });
        return structuredClone(r.list[idx]);
      }
      if (method === 'DELETE') { r.list.splice(idx, 1); return ''; }
      throw new Error(`fake cal: unsupported ${method}`);
    },
    async sleep(ms) {
      calls.push({ api: 'sleep', method: 'sleep', params: { ms } });
    },
  };

  return { io, calls, events: cals.dom, cals, fake };
}

export function ctxOf(f, nowMs, { config = {}, store } = {}) {
  f.fake.now = nowMs;
  return { io: f.io, store: store || ensureStore({}), config: { ...TEST_CONFIG, ...config }, now: nowMs };
}
