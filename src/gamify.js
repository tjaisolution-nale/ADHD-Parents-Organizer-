// ✅ Zrobione: 🎰 Los, 🔥 Combo, 🙌 Piątka, cele tygodnia i nagrody.
import { getEvent, patchEvent, listEvents } from './calendar.js';
import { localParts, zonedToMs, addDays, weekStart } from './time.js';
import { PERSON, parseTitle, markDone, setMeta, formatPkt, personFromEvent } from './titles.js';
import { SLOT_LABEL, decodeSlot, nextCombo, isHighFive, weeklyGoal, percent, renderBars, weekPoints } from './points.js';

const DICE_PAUSE_MS = 2000;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function weekRange(ctx, start) {
  const { tz } = ctx.config;
  return [zonedToMs(start, '00:00', tz), zonedToMs(addDays(start, 7), '00:00', tz)];
}

export async function ensureGoals(ctx) {
  const { store, config } = ctx;
  const week = weekStart(localParts(ctx.now, config.tz).date);
  if (store.goals.week === week) return { b: store.goals.b, g: store.goals.g };
  const history = { b: [], g: [] };
  for (const start of [addDays(week, -14), addDays(week, -7)]) {
    const events = await listEvents(ctx, config.domCal, ...weekRange(ctx, start));
    if (!events.length) continue; // tydzień bez wydarzeń nie liczy się do historii
    const pts = weekPoints(events, config.emails);
    history.b.push(pts.b);
    history.g.push(pts.g);
  }
  store.goals = { week, b: weeklyGoal(history.b), g: weeklyGoal(history.g) };
  return { b: store.goals.b, g: store.goals.g };
}

export async function onDone(ctx, { eventId, clicker, chatId, messageId, callbackId }) {
  const { io, store, config } = ctx;
  const answer = (text) => io.tg('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) });

  const ev = await getEvent(ctx, config.domCal, eventId);
  if (parseTitle(ev.summary).done) return answer('Już zrobione ✅');
  await answer();

  const goals = await ensureGoals(ctx);
  const week = await listEvents(ctx, config.domCal, ...weekRange(ctx, store.goals.week));
  const before = weekPoints(week.filter((e) => e.id !== ev.id), config.emails);

  const delta = { b: 0, g: 0 };
  const other = clicker === 'b' ? 'g' : 'b';
  if (personFromEvent(ev, config.emails) === 'y') { delta.b += 1; delta.g += 1; } else delta[clicker] += 1;

  const dice = await io.tg('sendDice', { chat_id: chatId, emoji: '🎰' });
  const slot = decodeSlot(store.forceSlot ?? dice.dice.value);
  store.forceSlot = null;
  delta[clicker] += slot.bonus;

  const combo = nextCombo(store.combo[clicker], ctx.now);
  store.combo[clicker] = { last: combo.last, level: combo.level };
  delta[clicker] += combo.bonus;

  const highFive = isHighFive(store.last[other], store.lastHighFive, ctx.now);
  store.last[clicker] = ctx.now;
  if (highFive) { delta.b += 2; delta.g += 2; store.lastHighFive = ctx.now; }

  const at = localParts(ctx.now, config.tz);
  const meta = { zrobione: `${at.date}T${at.time} ${PERSON[clicker]}`, pkt: formatPkt(delta), ...(combo.level > 1 ? { combo: `x${combo.level}` } : {}) };
  await patchEvent(ctx, config.domCal, ev.id, { summary: markDone(ev.summary), description: setMeta(ev.description, meta) });
  await io.tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
  await io.sleep(DICE_PAUSE_MS);

  const after = { b: before.b + delta.b, g: before.g + delta.g };
  const lines = [`${SLOT_LABEL[slot.kind]} +${1 + slot.bonus}`];
  if (combo.level > 1) lines.push(`🔥 Combo x${combo.level}! +${combo.bonus}`);
  lines.push(renderBars(after, goals));
  await io.tg('sendMessage', { chat_id: chatId, text: lines.join('\n') });
  if (highFive) await io.tg('sendMessage', { chat_id: chatId, text: `🙌 Piątka! +2 dla ${PERSON.b} i ${PERSON.g}` });

  for (const k of ['b', 'g']) {
    if (percent(before[k], goals[k]) < 100 && percent(after[k], goals[k]) >= 100) {
      await io.tg('sendMessage', { chat_id: chatId, text: `🏅 ${PERSON[k]} cel tygodnia! Nagroda: ${pick(config.rewards[k])}` });
    }
  }
  const team = (p) => percent(p.b + p.g, goals.b + goals.g);
  if (team(before) < 100 && team(after) >= 100) {
    await io.tg('sendMessage', { chat_id: chatId, text: `🎉 Cel drużyny! Nagroda: ${pick(config.rewards.team)}` });
  }
}
