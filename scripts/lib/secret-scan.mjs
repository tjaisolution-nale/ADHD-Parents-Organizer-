// Wykrywa sekrety, które nie mogą trafić do repo ani do wyeksportowanych workflow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATTERNS = [
  ['telegram_bot_token', /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/],
  ['google_api_key', /AIza[0-9A-Za-z_-]{35}/],
  ['google_client_secret', /GOCSPX-[0-9A-Za-z_-]{20,}/],
  ['google_refresh_token', /\b1\/\/[0-9A-Za-z_-]{20,}/],
  ['private_key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

export function findSecrets(text) {
  return PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
}

// Tryb CLI: node scripts/lib/secret-scan.mjs <pliki...> (w CI: git ls-files -z | xargs -0 node scripts/lib/secret-scan.mjs)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = [];
  for (const file of process.argv.slice(2)) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const name of findSecrets(text)) findings.push(`${file}: ${name}`);
  }
  if (findings.length) {
    console.error(`Znaleziono możliwe sekrety:\n${findings.join('\n')}`);
    process.exit(1);
  }
}
