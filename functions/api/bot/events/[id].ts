// PATCH  /api/bot/events/:id  { title?, start?, end?, allDay?, location?, notes?, dryRun? }
//        Moving `start` without `end` keeps the event's duration. Send "" to clear location/notes.
// DELETE /api/bot/events/:id

import type { PagesFunction } from '../../../../server/types';
import type { Firestore, FsDoc } from '../../../../server/firestore';
import type { Env } from '../../../../server/types';
import { audit, HttpError, json, readJson } from '../../../../server/http';
import { firestore } from '../../../../server/firestore';
import { fieldsFromDoc, resolveEvent, toWrite, type EventInput } from '../../../../server/events';
import { findClashes, publicEvent } from '../../../../server/schedule';

// The service account bypasses security rules, so ownership is enforced here.
async function ownEvent(fs: Firestore, env: Env, id: string): Promise<FsDoc> {
  const doc = await fs.get('calendarEvents', id);
  if (!doc || doc.data.ownerId !== env.BOT_OWNER_UID) throw new HttpError(404, 'Event not found');
  return doc;
}

export const onRequestPatch: PagesFunction<'id'> = async ({ request, env, params }) => {
  const input = await readJson<EventInput>(request);
  const fs = firestore(env);
  const doc = await ownEvent(fs, env, params.id);
  const before = publicEvent(doc.id, doc.data);
  const fields = resolveEvent(input, fieldsFromDoc(doc.data));

  const existing = await fs.list('calendarEvents', { field: 'ownerId', equals: env.BOT_OWNER_UID });
  const clashes = findClashes(existing, fields.start, fields.end, fields.allDay, doc.id);
  const { data, remove } = toWrite(fields);

  if (input.dryRun === true) {
    return json({ saved: false, before, event: publicEvent(doc.id, data), clashes });
  }

  await fs.update('calendarEvents', doc.id, data, remove);
  await audit(fs, 'update', 'Calendar', `Updated calendar event ${fields.title}`, doc.id);
  return json({ saved: true, before, event: publicEvent(doc.id, data), clashes });
};

export const onRequestDelete: PagesFunction<'id'> = async ({ env, params }) => {
  const fs = firestore(env);
  const doc = await ownEvent(fs, env, params.id);
  await fs.remove('calendarEvents', doc.id);
  await audit(fs, 'delete', 'Calendar', `Deleted calendar event ${doc.data.title}`, doc.id);
  return json({ deleted: true, event: publicEvent(doc.id, doc.data) });
};
