// Prosty odczyt pliku .env (KLUCZ=wartość) dla skryptów uruchamianych lokalnie.
import { readFileSync } from 'node:fs';

export function readEnv(path) {
  return readEnvText(readFileSync(path, 'utf8'));
}

export function readEnvText(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

// Ustawia KLUCZ=wartość w treści pliku .env: zastępuje pierwszą linię z tym kluczem (także błędnie
// wklejoną, np. KLUCZ=KLUCZ=…), usuwa jego duplikaty, a brakujący dopisuje na końcu.
export function setEnvValue(text, key, value) {
  const line = `${key}=${value}`;
  let done = false;
  const out = [];
  for (const l of text.split('\n')) {
    if (l.trim().startsWith(`${key}=`)) {
      if (!done) out.push(line);
      done = true;
    } else {
      out.push(l);
    }
  }
  if (!done) {
    if (out.at(-1) === '') out.splice(out.length - 1, 0, line);
    else out.push(line);
  }
  return out.join('\n');
}
