// Komendy w grupie „Dom”: /zalegle, /test777.
import { listEvents, patchEvent, eventEndMs, movedToDate } from '../calendar.js';
import { localParts, addDays } from '../time.js';
import { parseTitle, personFromEvent } from '../titles.js';
import { senderKey } from './message.js';

const DAY = 86400000;
const send = (ctx, text) => ctx.io.tg('sendMessage', { chat_id: ctx.config.chatId, text });

async function moveOverdue(ctx, sender) {
  const { domCal, tz, emails } = ctx.config;
  const tomorrow = addDays(localParts(ctx.now, tz).date, 1);
  const events = await listEvents(ctx, domCal, ctx.now - 30 * DAY, ctx.now);
  const overdue = events.filter((ev) => {
    if (parseTitle(ev.summary).done || eventEndMs(ev, tz) > ctx.now) return false;
    const who = personFromEvent(ev, emails);
    return who === sender || who === 'y';
  });
  for (const ev of overdue) await patchEvent(ctx, domCal, ev.id, movedToDate(ev, tomorrow, tz));
  await send(ctx, overdue.length ? `📦 Przeniesione na jutro: ${overdue.length}` : 'Brak zaległości 🎉');
}

export async function handleCommand(ctx, msg) {
  const sender = senderKey(ctx, msg.from, msg.chat?.id);
  if (!sender || !msg.text) return;
  const command = msg.text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
  if (command === '/zalegle') return moveOverdue(ctx, sender);
  if (command === '/test777' && ctx.config.mode === 'test') {
    ctx.store.forceSlot = 64;
    await send(ctx, '🧪 Następne ✅ da 777');
  }
}
