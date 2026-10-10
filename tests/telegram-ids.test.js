import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUpdates } from '../scripts/telegram-ids.mjs';

const person = (id, first_name) => ({ id, is_bot: false, first_name });
const BOT = { id: 999, is_bot: true, first_name: 'Dom' };

test('lists groups, people and who wrote /start privately', () => {
  const s = summarizeUpdates([
    { update_id: 1, my_chat_member: { chat: { id: -42, type: 'group', title: 'Dom' }, from: person(1, 'Ala') } },
    { update_id: 2, message: { chat: { id: -42, type: 'group', title: 'Dom' }, from: person(2, 'Ola'), text: 'cześć' } },
    { update_id: 3, message: { chat: { id: 1, type: 'private' }, from: person(1, 'Ala'), text: '/start' } },
    { update_id: 4, message: { chat: { id: -42, type: 'group', title: 'Dom' }, from: BOT, text: 'x' } },
  ]);
  assert.deepEqual(s.groups, [{ id: -42, title: 'Dom' }]);
  assert.deepEqual(s.people, [{ id: 1, name: 'Ala' }, { id: 2, name: 'Ola' }]);
  assert.deepEqual(s.started, ['Ala']);
});

test('a group upgraded to a supergroup shows only its new id', () => {
  const s = summarizeUpdates([
    { update_id: 1, message: { chat: { id: -42, type: 'group', title: 'Dom' }, from: person(1, 'Ala'), migrate_to_chat_id: -1009 } },
    { update_id: 2, message: { chat: { id: -1009, type: 'supergroup', title: 'Dom' }, from: person(1, 'Ala'), text: 'hej' } },
  ]);
  assert.deepEqual(s.groups, [{ id: -1009, title: 'Dom' }]);
});

test('clearing the queue confirms everything up to the newest update', async () => {
  const { nextOffset } = await import('../scripts/telegram-ids.mjs');
  assert.equal(nextOffset([{ update_id: 5 }, { update_id: 9 }, { update_id: 7 }]), 10);
  assert.equal(nextOffset([]), null);
});
