// Zamiana wiadomości (tekst lub głosówka) na Parsed przez Gemini, z jedną ponowną próbą i limitem dziennym.
import { validateParsed, GEMINI_RESPONSE_SCHEMA } from './schema.js';
import { localParts } from './time.js';

const WEEKDAY_PL = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export function buildGeminiRequest(input, meta, prompt) {
  const system = prompt
    .replaceAll('{{TODAY}}', meta.today)
    .replaceAll('{{WEEKDAY}}', WEEKDAY_PL[meta.weekday - 1])
    .replaceAll('{{SENDER}}', meta.sender)
    .replaceAll('{{TZ}}', meta.tz);
  const part = input.audio
    ? { inline_data: { mime_type: input.audio.mime, data: input.audio.base64 } }
    : { text: input.text };
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [part] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_RESPONSE_SCHEMA, temperature: 0 },
  };
}

export function readGeminiResponse(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) return { ok: false, errors: ['brak odpowiedzi modelu'] };
  let text = parts.map((p) => p.text || '').join('').trim();
  const fenced = FENCE.exec(text);
  if (fenced) text = fenced[1];
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['odpowiedź nie jest JSON-em'] };
  }
  return validateParsed(obj);
}

export async function parseWithRetry(ctx, input, meta) {
  const { store, config, io } = ctx;
  const today = localParts(ctx.now, config.tz).date;
  if (store.gem.date !== today) store.gem = { date: today, count: 0 };
  const body = buildGeminiRequest(input, meta, config.parsePrompt);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (store.gem.count >= config.geminiLimit) return { ok: false, reason: 'limit' };
    store.gem.count++;
    let json;
    try {
      json = await io.gemini(body);
    } catch {
      return { ok: false, reason: 'error' };
    }
    const res = readGeminiResponse(json);
    if (res.ok) return res;
  }
  return { ok: false, reason: 'invalid' };
}
