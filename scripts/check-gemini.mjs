// Jedno wywołanie Gemini z kluczem i modelem z n8n/.env: działa albo mówi dlaczego nie i co zrobić.
// Użycie: npm run check:gemini
import { fileURLToPath } from 'node:url';
import { readEnv } from './lib/env.mjs';
import { preflight } from './eval-parse.mjs';

export function geminiHint(status, message) {
  if (status === 429) {
    return 'Limit darmowego planu jest wyczerpany. Dzienny odnawia się o północy czasu pacyficznego (około 8:00 w UK). '
      + 'Możesz też wpisać GEMINI_MODEL=gemini-flash-lite-latest (wyższe darmowe limity) albo włączyć płatny plan (Set up billing w AI Studio).';
  }
  if (status === 404) return 'Nie ma takiego modelu. Sprawdź GEMINI_MODEL w n8n/.env, np. gemini-flash-latest.';
  if (status === 400 || status === 401 || status === 403) return 'Klucz nie działa. Skopiuj GEMINI_API_KEY jeszcze raz z AI Studio (ikona kopiowania przy kluczu).';
  if (status >= 500) return 'Gemini jest chwilowo przeciążony po stronie Google. Spróbuj za kilka minut.';
  return `Nieoczekiwana odpowiedź: ${message}`;
}

async function main() {
  const env = readEnv('n8n/.env');
  const problem = await preflight(env);
  if (!problem) {
    console.log(`✓ Gemini działa (model ${env.GEMINI_MODEL}).`);
    return;
  }
  const status = Number(/Gemini (\d+)/.exec(problem)?.[1]);
  console.log(`✗ ${problem}\n\n→ ${geminiHint(status, problem)}`);
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
