// Jeden obrót pętli bota: pobierz aktualizacje z Telegrama i obsłuż je po kolei.
import { pruneStore } from './store.js';
import { handleMessage } from './handlers/message.js';
import { handleCallback } from './handlers/callback.js';
import { handleCommand } from './handlers/commands.js';

const HOUR = 3600000;
const SORRY = '⚠️ Coś poszło nie tak. Spróbuj jeszcze raz.';
const NO_CALENDAR = '⚠️ Bot nie ma teraz dostępu do kalendarza. Ta wiadomość nie została zapisana; wyślij ją ponownie, gdy bot znów zadziała.';

async function route(ctx, update) {
  if (update.message) {
    const text = update.message.text || '';
    if (text.startsWith('/')) await handleCommand(ctx, update.message);
    else await handleMessage(ctx, update.message);
  } else if (update.callback_query) {
    await handleCallback(ctx, update.callback_query);
  }
}

async function tell(ctx, text) {
  try {
    await ctx.io.tg('sendMessage', { chat_id: ctx.config.chatId, text });
  } catch {
    // Telegram też nie odpowiada: nic więcej nie da się zrobić w tym obrocie.
  }
}

export async function runTick(ctx) {
  const { io, store } = ctx;
  pruneStore(store, ctx.now);
  const updates = await io.tg('getUpdates', { offset: store.offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
  if (!updates.length) return { processed: 0 };

  // Potwierdzenie przed obsługą: nakładające się uruchomienia (co 5 s) nie dostaną tych samych aktualizacji.
  store.offset = Math.max(...updates.map((u) => u.update_id)) + 1;
  await io.tg('getUpdates', { offset: store.offset, timeout: 0, limit: 1 });

  let processed = 0;
  let fatal = null;
  for (const update of updates) {
    try {
      await route(ctx, update);
      processed++;
    } catch (err) {
      if (err.fatal) {
        fatal = err;
        await tell(ctx, NO_CALENDAR);
      } else {
        await tell(ctx, SORRY);
      }
    }
  }
  if (fatal && (!store.fatalAt || ctx.now - store.fatalAt > HOUR)) {
    store.fatalAt = ctx.now;
    throw fatal; // workflow „Dom – błędy” powiadamia 🟦, najwyżej raz na godzinę
  }
  return { processed };
}
