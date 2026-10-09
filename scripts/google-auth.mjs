// Jednorazowe uzyskanie refresh tokenu Google dla bota: node scripts/google-auth.mjs
// Czyta GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET z n8n/.env, nic nie zapisuje na dysku.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readEnv } from './lib/env.mjs';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;

export function buildAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state,
  }).toString();
  return url.toString();
}

async function exchange(code, env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.refresh_token) throw new Error(`Google odrzuciło wymianę kodu: ${body.error_description || body.error || res.status}`);
  return body.refresh_token;
}

function main() {
  const env = readEnv('n8n/.env');
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error('Uzupełnij GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET w n8n/.env (docs/setup.md, krok 3).');
    process.exit(1);
  }
  const state = randomBytes(16).toString('hex');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get('code');
    if (!code || url.searchParams.get('state') !== state) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Nieprawidłowe przekierowanie. Spróbuj jeszcze raz.');
      return;
    }
    try {
      const token = await exchange(code, env);
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Gotowe. Wróć do terminala.');
      console.log('\nWklej tę linię do n8n/.env (zastąp pustą):\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${token}\n`);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Coś poszło nie tak. Szczegóły w terminalu.');
      console.error(err.message);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log('Otwórz ten adres w przeglądarce i zaloguj się kontem Google 🟦:\n');
    console.log(buildAuthUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri: REDIRECT_URI, state }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
