// Konfiguracja bota ze zmiennych środowiska n8n (n8n/.env).

const REQUIRED = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_ID_NIEBIESKI', 'TELEGRAM_ID_ZIELONY',
  'EMAIL_NIEBIESKI', 'EMAIL_ZIELONY', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'DOM_TEST_CALENDAR_ID',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
];

export function readConfig(env, { rewards, parsePrompt }) {
  const mode = env.DOM_MODE === 'prod' ? 'prod' : 'test';
  const required = mode === 'prod' ? [...REQUIRED, 'DOM_CALENDAR_ID'] : REQUIRED;
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Brak zmiennych w n8n/.env: ${missing.join(', ')}`);
  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: Number(env.TELEGRAM_CHAT_ID),
    ids: { b: Number(env.TELEGRAM_ID_NIEBIESKI), g: Number(env.TELEGRAM_ID_ZIELONY) },
    emails: { b: env.EMAIL_NIEBIESKI, g: env.EMAIL_ZIELONY },
    geminiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    geminiLimit: Number(env.GEMINI_DAILY_LIMIT) || 200,
    mode,
    domCal: mode === 'prod' ? env.DOM_CALENDAR_ID : env.DOM_TEST_CALENDAR_ID,
    primaryCal: env.EMAIL_NIEBIESKI,
    partnerCal: env.PARTNER_CALENDAR_ID || '',
    tz: env.GENERIC_TIMEZONE || 'Europe/London',
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, refreshToken: env.GOOGLE_REFRESH_TOKEN },
    rewards,
    parsePrompt,
  };
}
