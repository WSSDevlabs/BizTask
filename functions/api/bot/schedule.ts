// GET /api/bot/schedule?date=2026-10-14
// GET /api/bot/schedule?from=2026-10-13&to=2026-10-19
// Defaults to today (Malaysia time). Max 31 days per request.

import type { PagesFunction } from '../../../server/types';
import { addDays, HttpError, isDateString, json, myDate } from '../../../server/http';
import { firestore } from '../../../server/firestore';
import { loadSources, scheduleByDay } from '../../../server/schedule';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const single = url.searchParams.get('date');
  const from = single ?? url.searchParams.get('from') ?? myDate();
  const to = single ?? url.searchParams.get('to') ?? from;

  if (!isDateString(from) || !isDateString(to)) throw new HttpError(400, 'Dates must be YYYY-MM-DD');
  if (to < from) throw new HttpError(400, '"to" must be on or after "from"');
  if (addDays(from, 31) <= to) throw new HttpError(400, 'Range is limited to 31 days');

  const sources = await loadSources(firestore(env), env.BOT_OWNER_UID);
  return json({ today: myDate(), timezone: 'Asia/Kuala_Lumpur', days: scheduleByDay(sources, from, to) });
};
