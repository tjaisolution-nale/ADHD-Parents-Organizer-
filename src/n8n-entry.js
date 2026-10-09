// Wejście dla węzła Code w n8n: konfiguracja z $env, stan z danych statycznych, io przez this.helpers.httpRequest.
import REWARDS from '../config/nagrody.json';
import PARSE_PROMPT from '../prompts/gemini-parse.md';
import { readConfig } from './config.js';
import { ensureStore } from './store.js';
import { runTick } from './bot.js';

const TELEGRAM = 'https://api.telegram.org';
const CALENDAR = 'https://www.googleapis.com/calendar/v3';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const HOUR = 3600000;
const asJson = (body) => (typeof body === 'string' && body ? JSON.parse(body) : body);
const fatalError = (message) => Object.assign(new Error(message), { fatal: true });

function toBase64(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function makeIo(httpRequest, config, store) {
  const request = (o) => httpRequest({ returnFullResponse: true, ignoreHttpStatusErrors: true, ...o });

  async function googleToken(force = false) {
    if (!force && store.gtoken && store.gtoken.exp - 60000 > Date.now()) return store.gtoken.value;
    const res = await request({
      method: 'POST', url: TOKEN_URL, json: false,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.google.clientId, client_secret: config.google.clientSecret,
        refresh_token: config.google.refreshToken, grant_type: 'refresh_token',
      }).toString(),
    });
    const body = asJson(res.body) || {};
    if (res.statusCode >= 400 || !body.access_token) {
      throw fatalError(`Google: nie udało się odświeżyć dostępu (${body.error || res.statusCode})`);
    }
    store.gtoken = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
    return store.gtoken.value;
  }

  async function tg(method, params) {
    const res = await request({ method: 'POST', url: `${TELEGRAM}/bot${config.botToken}/${method}`, body: params, json: true });
    const body = asJson(res.body);
    if (!body?.ok) throw new Error(`Telegram ${method}: ${body?.description || res.statusCode}`);
    return body.result;
  }

  return {
    tg,
    async tgFile(fileId) {
      const file = await tg('getFile', { file_id: fileId });
      const res = await request({ method: 'GET', url: `${TELEGRAM}/file/bot${config.botToken}/${file.file_path}`, encoding: 'arraybuffer' });
      if (res.statusCode >= 400) throw new Error(`Telegram plik: ${res.statusCode}`);
      return { mime: 'audio/ogg', base64: toBase64(res.body) };
    },
    async gemini(body) {
      const res = await request({
        method: 'POST', url: `${GEMINI}/${config.geminiModel}:generateContent`, body, json: true,
        headers: { 'x-goog-api-key': config.geminiKey },
      });
      if (res.statusCode >= 400) throw new Error(`Gemini: ${res.statusCode}`);
      return asJson(res.body);
    },
    async cal(method, path, { query, body, headers = {} } = {}) {
      const call = async (token) => request({
        method, url: `${CALENDAR}${path}`, qs: query, body, json: true,
        headers: { ...headers, Authorization: `Bearer ${token}` },
      });
      let res = await call(await googleToken());
      if (res.statusCode === 401) res = await call(await googleToken(true));
      if (res.statusCode === 401) throw fatalError('Google: brak dostępu do kalendarza (401)');
      if (res.statusCode >= 400) {
        const err = new Error(`Calendar ${res.statusCode}: ${asJson(res.body)?.error?.message || ''}`);
        err.status = res.statusCode;
        throw err;
      }
      return asJson(res.body);
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

// Powiadomienie 🟦 bezpośrednio przez Telegram, bez pełnej konfiguracji (może właśnie jej brakować).
async function notifyOwner(httpRequest, env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ID_NIEBIESKI) return;
  await httpRequest({
    method: 'POST', url: `${TELEGRAM}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, json: true,
    returnFullResponse: true, ignoreHttpStatusErrors: true,
    body: { chat_id: Number(env.TELEGRAM_ID_NIEBIESKI), text: `⚠️ Bot Dom: ${message}` },
  });
}

export async function main({ httpRequest, env, staticData, now }) {
  const store = ensureStore(staticData);
  try {
    const config = readConfig(env, { rewards: REWARDS, parsePrompt: PARSE_PROMPT });
    const io = makeIo(httpRequest, config, store);
    return await runTick({ io, store, config, now });
  } catch (err) {
    // Wykonanie kończy się normalnie (dane statyczne zostają zapisane), a 🟦 dostaje najwyżej jedną wiadomość na godzinę.
    if (!store.errorAt || now - store.errorAt > HOUR) {
      store.errorAt = now;
      await notifyOwner(httpRequest, env, err.message).catch(() => {});
    }
    return { processed: 0, error: err.message };
  }
}
