import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage } from '../src/handlers/message.js';
import { zonedToMs } from '../src/time.js';
import { makeFakeIo, ctxOf } from './helpers/fake-io.js';
import { textMsg, voiceMsg, timed, ok, wrap } from './helpers/fixtures.js';

const TZ = 'Europe/London';
const NOW = zonedToMs('2026-10-09', '08:00', TZ);
const sends = (f) => f.calls.filter(c => c.method === 'sendMessage');
const buttons = (call) => call.params.reply_markup.inline_keyboard.flat().map(b => b.text);

test('full date and time creates the event and confirms', async () => {
  const f = makeFakeIo({ gemini: [ok({ tytul: 'Dentysta', typ: 'wizyta', data: '2026-10-16', godzina: '18:00' })] });
  await handleMessage(ctxOf(f, NOW), textMsg('w piątek 18 dentysta'));
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].summary, '🟦 Dentysta');
  assert.deepEqual(f.events[0].start, { dateTime: '2026-10-16T18:00:00', timeZone: TZ });
  assert.match(f.events[0].description, /utworzone_przez: bot/);
  assert.match(f.events[0].description, /źródło: telegram:\d+/);
  const sent = sends(f)[0];
  assert.equal(sent.params.text, '🟦 Dentysta · pt 16.10, 18:00');
  assert.deepEqual(buttons(sent), ['✅ Zrobione', '⏰ +15 min', 'Jutro', '↩️ Cofnij']);
});

test('late message resolves against send time (Review Focus 1)', async () => {
  const f = makeFakeIo({ gemini: [ok({ data: '2026-10-13', godzina: '09:00' })] });
  await handleMessage(ctxOf(f, zonedToMs('2026-10-13', '07:00', TZ)), textMsg('jutro 9 basen', zonedToMs('2026-10-12', '23:50', TZ)));
  assert.ok(JSON.stringify(f.calls.find(c => c.api === 'gemini').params).includes('2026-10-12'));
  assert.equal(f.events.length, 1);
});

test('time already passed asks for a day (Review Focus 1)', async () => {
  const f = makeFakeIo({ gemini: [ok({ data: '2026-10-13', godzina: '06:00' })] });
  const ctx = ctxOf(f, zonedToMs('2026-10-13', '07:00', TZ));
  await handleMessage(ctx, textMsg('6 rano siłownia'));
  assert.equal(f.events.length, 0);
  const sent = sends(f)[0];
  assert.equal(sent.params.text, '⏳ Ten termin już minął. Kiedy?');
  assert.deepEqual(buttons(sent), ['Dziś', 'Jutro', 'Weekend', 'Przyszły tydzień']);
  assert.equal(Object.keys(ctx.store.pending).length, 1);
});

test('foreign updates are ignored silently (Review Focus 4)', async () => {
  const f = makeFakeIo({});
  const base = textMsg('jutro 9 basen');
  const otherChat = { ...base, chat: { id: -999 } };
  const unknownUser = textMsg('jutro 9 basen', undefined, 77);
  const bot = { ...base, from: { ...base.from, is_bot: true } };
  const { text, ...noText } = base;
  const sticker = { ...noText, sticker: { file_id: 's' } };
  const photo = { ...noText, photo: [{ file_id: 'p' }], caption: 'jutro 9' };
  for (const m of [otherChat, unknownUser, bot, sticker, photo]) await handleMessage(ctxOf(f, NOW), m);
  assert.equal(f.calls.length, 0);
});

test('clash offers the next free slot', async () => {
  const f = makeFakeIo({ events: [timed('🟩 Basen', '2026-10-16', '18:00', 60)], gemini: [ok({ data: '2026-10-16', godzina: '18:00' })] });
  const ctx = ctxOf(f, NOW);
  await handleMessage(ctx, textMsg('pt 18 dentysta'));
  const sent = sends(f)[0];
  assert.equal(sent.params.text, '⚠️ koliduje z 🟩 Basen');
  assert.deepEqual(buttons(sent), ['Wstaw o 19:00', 'Zostaw']);
  assert.equal(f.events.length, 1);
  const [pending] = Object.values(ctx.store.pending);
  assert.deepEqual(pending.alt, { date: '2026-10-16', time: '19:00' });
});

test('limit saves to inbox', async () => {
  const f = makeFakeIo({});
  const ctx = ctxOf(f, NOW);
  ctx.store.gem = { date: '2026-10-09', count: 200 };
  await handleMessage(ctx, textMsg('kupić mleko'));
  assert.equal(f.events[0].summary, '🟦 📥 kupić mleko');
  assert.deepEqual(f.events[0].start, { date: '2026-10-09' });
  assert.equal(sends(f)[0].params.text, '📥 Zapisane do posortowania. Rano Claude to uporządkuje.');
});

test('voice goes to Gemini as audio', async () => {
  const f = makeFakeIo({ gemini: [ok({ data: '2026-10-16', godzina: '18:00' })], files: { 'file-1': { mime: 'audio/ogg', base64: 'T2dn' } } });
  await handleMessage(ctxOf(f, NOW), voiceMsg('file-1'));
  assert.ok(f.calls.some(c => c.api === 'tgFile' && c.params.fileId === 'file-1'));
  const req = f.calls.find(c => c.api === 'gemini').params;
  assert.deepEqual(req.contents[0].parts[0].inline_data, { mime_type: 'audio/ogg', data: 'T2dn' });
});

test('missing time asks for time', async () => {
  const f = makeFakeIo({ gemini: [ok({ data: '2026-10-10', godzina: null })] });
  await handleMessage(ctxOf(f, NOW), textMsg('jutro odkurzyć'));
  assert.deepEqual(buttons(sends(f)[0]), ['Rano 9:00', 'Po południu 15:00', 'Wieczór 19:00', 'Cały dzień']);
  assert.equal(f.events.length, 0);
});

test('🟨 from parse lands in the title; second person is 🟩', async () => {
  const f = makeFakeIo({ gemini: [ok({ tytul: 'Basen', osoba: '🟨', data: '2026-10-16', godzina: '18:00' }), ok({ tytul: 'Pranie', data: '2026-10-16', godzina: '20:00' })] });
  await handleMessage(ctxOf(f, NOW), textMsg('pt 18 basen razem'));
  await handleMessage(ctxOf(f, NOW), textMsg('pt 20 pranie', undefined, 2));
  assert.deepEqual(f.events.map(e => e.summary), ['🟨 Basen', '🟩 Pranie']);
});

test('invalid answers twice offers inbox or rewrite', async () => {
  const f = makeFakeIo({ gemini: [wrap('???'), wrap('!!!')] });
  const ctx = ctxOf(f, NOW);
  await handleMessage(ctx, textMsg('blablabla'));
  const sent = sends(f)[0];
  assert.deepEqual(buttons(sent), ['📥 Zapisz do posortowania', '✍️ Napiszę jeszcze raz']);
  assert.match(sent.params.reply_markup.inline_keyboard.flat()[0].callback_data, /^ib:[0-9a-z]{6}:zapisz$/);
  assert.equal(Object.values(ctx.store.pending)[0].text, 'blablabla');
});

test('review#4: a leading person emoji decides the owner', async () => {
  const f = makeFakeIo({ gemini: [ok({ tytul: 'Odebrać paczkę', data: '2026-10-10', godzina: '15:00' })] });
  await handleMessage(ctxOf(f, NOW), textMsg('🟩 odebrać paczkę jutro 15'));
  assert.equal(f.events[0].summary, '🟩 Odebrać paczkę');
});

test('declined#4: a bill added by the bot lands 3 days before its due date', async () => {
  const f = makeFakeIo({ gemini: [ok({ tytul: 'Council tax', typ: 'rachunek', data: '2026-11-01', kwota: 182, pewnosc: 0.95 }), ok({ tytul: 'Woda', typ: 'rachunek', data: '2026-10-10', kwota: 40 })] });
  await handleMessage(ctxOf(f, NOW), textMsg('council tax £182 do 1.11'));
  await handleMessage(ctxOf(f, NOW), textMsg('woda £40 do jutra'));
  assert.equal(f.events[0].summary, '🟦 💸 Council tax – termin 01.11');
  assert.deepEqual(f.events[0].start, { date: '2026-10-29' });
  assert.match(f.events[0].description, /termin: 2026-11-01/);
  assert.match(f.events[0].description, /kwota: £182\.00/);
  assert.deepEqual(f.events[1].start, { date: '2026-10-09' });
});
