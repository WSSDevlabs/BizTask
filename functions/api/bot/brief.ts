// GET /api/bot/brief?date=2026-10-14   (default: today, Malaysia time)
// Everything a morning briefing needs in one call: the day's schedule, what's
// overdue, and money/renewals coming up in the next 7 days.

import type { PagesFunction } from '../../../server/types';
import { addDays, HttpError, isDateString, json, myDate } from '../../../server/http';
import { firestore } from '../../../server/firestore';
import { loadSources, money, overdue, scheduleByDay } from '../../../server/schedule';

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const date = new URL(request.url).searchParams.get('date') ?? myDate();
  if (!isDateString(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');

  const fs = firestore(env);
  const s = await loadSources(fs, env.BOT_OWNER_UID);
  const [day] = scheduleByDay(s, date, date);
  const nextWeek = scheduleByDay(s, addDays(date, 1), addDays(date, 7)).flatMap((d) =>
    d.items.filter((i) => i.kind === 'bill' || i.kind === 'maintenance' || i.kind === 'invoice').map((i) => ({ date: d.date, ...i })),
  );

  const unpaid = s.invoices.filter((i) => i.data.status === 'Sent' || i.data.status === 'Overdue');
  const pendingLeave = s.leave.filter((l) => l.data.status === 'Pending').length;

  return json({
    date,
    label: day.label,
    schedule: day.items,
    overdue: overdue(s),
    comingUp7Days: nextWeek,
    unpaidInvoices: { count: unpaid.length, total: money(unpaid.reduce((sum, i) => sum + Number(i.data.grandTotal ?? 0), 0)) },
    pendingLeaveRequests: pendingLeave,
  });
};
