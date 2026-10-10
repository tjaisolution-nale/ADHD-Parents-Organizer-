// Naprawia typowe błędy wklejania w n8n/.env: podwójną nazwę pola (KLUCZ=KLUCZ=…), spacje i cudzysłowy
// wokół wartości oraz pole wpisane kilka razy. Nigdy nie wypisuje wartości.
// Użycie: npm run fix:env
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isValid } from './check-env.mjs';

/** @returns {{ text: string, changes: string[] }} */
export function repairEnv(text) {
  const lines = text.split('\n').map((line) => {
    const m = /^\s*([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) return { line };
    const [, key, original] = m;
    const fixed = [];
    let value = original.trim();
    while (value.startsWith(`${key}=`)) {
      value = value.slice(key.length + 1).trim();
      if (!fixed.includes('podwójną nazwę pola')) fixed.push('podwójną nazwę pola');
    }
    const quoted = /^(["'])(.*)\1$/.exec(value);
    if (quoted) { value = quoted[2].trim(); fixed.push('cudzysłowy'); }
    if (value !== original && !fixed.length) fixed.push('spacje');
    return { line, key, value, fixed };
  });

  const groups = new Map();
  for (const l of lines) if (l.key) groups.set(l.key, [...(groups.get(l.key) || []), l]);

  const changes = [];
  const out = [];
  for (const l of lines) {
    if (!l.key) { out.push(l.line); continue; }
    const group = groups.get(l.key);
    if (group[0] !== l) continue;
    if (group.length > 1) {
      const filled = group.filter((g) => g.value);
      const chosen = filled.find((g) => isValid(l.key, g.value)) || filled.at(-1) || l;
      changes.push(`${l.key}: pole było w pliku ${group.length} razy, zostawiono jedną linię`);
      out.push(`${l.key}=${chosen.value}`);
    } else if (l.fixed.length) {
      changes.push(`${l.key}: usunięto ${l.fixed.join(', ')}`);
      out.push(`${l.key}=${l.value}`);
    } else {
      out.push(l.line);
    }
  }
  return { text: out.join('\n'), changes };
}

function main() {
  const path = process.argv[2] || 'n8n/.env';
  const { text, changes } = repairEnv(readFileSync(path, 'utf8'));
  if (!changes.length) {
    console.log('Nic do naprawy w formacie pliku.');
  } else {
    writeFileSync(path, text);
    for (const c of changes) console.log(`✓ ${c}`);
  }
  console.log('Teraz sprawdź: npm run check:env');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
