// Kontrakt odpowiedzi Gemini (schemas/zadanie.schema.json) bez zależności.

const KEYS = ['tytul', 'osoba', 'typ', 'data', 'godzina', 'czas_min', 'kwota', 'pewnosc'];
const OSOBY = ['🟦', '🟩', '🟨'];
const TYPY = ['zadanie', 'wizyta', 'rachunek'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function validateParsed(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['nie jest obiektem'] };
  const errors = [];
  for (const k of KEYS) if (!(k in obj)) errors.push(`brak pola ${k}`);
  for (const k of Object.keys(obj)) if (!KEYS.includes(k)) errors.push(`nieznane pole ${k}`);
  const { tytul, osoba, typ, data, godzina, czas_min: czas, kwota, pewnosc } = obj;
  if (typeof tytul !== 'string' || [...tytul].length < 1 || [...tytul].length > 80) errors.push('tytul: 1–80 znaków');
  if (osoba !== null && !OSOBY.includes(osoba)) errors.push('osoba: 🟦, 🟩, 🟨 albo null');
  if (!TYPY.includes(typ)) errors.push('typ: zadanie, wizyta albo rachunek');
  if (data !== null && !(typeof data === 'string' && DATE.test(data))) errors.push('data: YYYY-MM-DD albo null');
  if (godzina !== null && !(typeof godzina === 'string' && TIME.test(godzina))) errors.push('godzina: HH:MM albo null');
  if (czas !== null && !(Number.isInteger(czas) && czas >= 5 && czas <= 480)) errors.push('czas_min: 5–480 albo null');
  if (kwota !== null && !isNum(kwota)) errors.push('kwota: liczba albo null');
  if (!isNum(pewnosc) || pewnosc < 0 || pewnosc > 1) errors.push('pewnosc: 0–1');
  return errors.length ? { ok: false, errors } : { ok: true, value: obj };
}

// Ten sam kontrakt w podzbiorze OpenAPI, którego używa `responseSchema` w Gemini.
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tytul: { type: 'STRING', description: 'Krótki tytuł, bez emoji osoby i typu, maks. 80 znaków' },
    osoba: { type: 'STRING', enum: OSOBY, nullable: true },
    typ: { type: 'STRING', enum: TYPY },
    data: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD' },
    godzina: { type: 'STRING', nullable: true, description: 'HH:MM, zegar 24-godzinny' },
    czas_min: { type: 'INTEGER', nullable: true },
    kwota: { type: 'NUMBER', nullable: true },
    pewnosc: { type: 'NUMBER' },
  },
  required: KEYS,
  propertyOrdering: KEYS,
};
