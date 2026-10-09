// Prosty odczyt pliku .env (KLUCZ=wartość) dla skryptów uruchamianych lokalnie.
import { readFileSync } from 'node:fs';

export function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}
