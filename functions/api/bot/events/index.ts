// POST /api/bot/events
// { title, start, end?, allDay?, location?, notes?, dryRun? }
// With dryRun: true nothing is saved — returns the parsed event + clashes so
// the bot can ask "Save?" first.

import type { PagesFunction } from '../../../../server/types';
import { audit, json, readJson } from '../../../../server/http';
import { firestore } from '../../../../server/firestore';
import { resolveEvent, toWrite, type EventInput } from '../../../../server/events';
import { findClashes, publicEvent } from '../../../../server/schedule';

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const input = await readJson<EventInput>(request);
  const fields = resolveEvent(input);
  const fs = firestore(env);

  const existing = await fs.list('calendarEvents', { field: 'ownerId', equals: env.BOT_OWNER_UID });
  const clashes = findClashes(existing, fields.start, fields.end, fields.allDay);
  const { data } = toWrite(fields);

  if (input.dryRun === true) {
    return json({ saved: false, event: publicEvent('(not saved)', data), clashes });
  }

  const id = await fs.create('calendarEvents', { ...data, ownerId: env.BOT_OWNER_UID, createdAt: new Date() });
  await audit(fs, 'create', 'Calendar', `Added calendar event ${fields.title}`, id);
  return json({ saved: true, event: publicEvent(id, data), clashes }, 201);
};
