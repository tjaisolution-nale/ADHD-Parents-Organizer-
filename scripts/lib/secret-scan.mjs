// Wykrywa sekrety, które nie mogą trafić do repo ani do wyeksportowanych workflow.
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
