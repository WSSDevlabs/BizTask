// Validation + persistence shape for calendarEvents, matching what
// src/pages/CalendarPage.tsx writes (all-day events are stored as Malaysia
// midnight of their first and last day).

import type { FsData } from './firestore';
import { HttpError, dayStart, myDate, parseDateTime } from './http';

export interface EventInput {
  title?: unknown;
  start?: unknown;
  end?: unknown;
  allDay?: unknown;
  location?: unknown;
  notes?: unknown;
  dryRun?: unknown;
}

export interface EventFields {
  title: string;
  allDay: boolean;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
}

function optionalText(v: unknown, field: string, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be text`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters)`);
  return t || undefined;
}

/** Merges `input` over `current` (if editing) and validates the result. */
export function resolveEvent(input: EventInput, current?: EventFields): EventFields {
  const title = input.title !== undefined ? optionalText(input.title, 'title', 200) : current?.title;
  if (!title) throw new HttpError(400, 'title is required');

  if (input.allDay !== undefined && typeof input.allDay !== 'boolean') throw new HttpError(400, 'allDay must be true or false');
  const allDay = (input.allDay as boolean | undefined) ?? current?.allDay ?? false;

  let start = input.start !== undefined ? parseDateTime(input.start, 'start') : current?.start;
  if (!start) throw new HttpError(400, 'start is required');

  let end: Date;
  if (input.end !== undefined) end = parseDateTime(input.end, 'end');
  else if (current && input.start !== undefined) end = new Date(start.getTime() + (current.end.getTime() - current.start.getTime())); // moving keeps the duration
  else if (current) end = current.end;
  else end = new Date(start.getTime() + (allDay ? 0 : 3_600_000)); // new timed events default to 1 hour

  if (allDay) {
    start = dayStart(myDate(start));
    end = dayStart(myDate(end));
  }
  if (end < start) throw new HttpError(400, 'end must be after start');

  const location = input.location !== undefined ? optionalText(input.location, 'location', 300) : current?.location;
  const description = input.notes !== undefined ? optionalText(input.notes, 'notes', 2000) : current?.description;

  return { title, allDay, start, end, ...(location ? { location } : {}), ...(description ? { description } : {}) };
}

export function fieldsFromDoc(data: FsData): EventFields {
  const start = data.start instanceof Date ? data.start : new Date();
  return {
    title: String(data.title ?? ''),
    allDay: data.allDay === true,
    start,
    end: data.end instanceof Date ? data.end : start,
    ...(typeof data.location === 'string' ? { location: data.location } : {}),
    ...(typeof data.description === 'string' ? { description: data.description } : {}),
  };
}

/** Firestore payload. Optional fields that are now empty are returned in `remove`. */
export function toWrite(f: EventFields): { data: FsData; remove: string[] } {
  const data: FsData = { title: f.title, allDay: f.allDay, start: f.start, end: f.end };
  const remove: string[] = [];
  if (f.location) data.location = f.location; else remove.push('location');
  if (f.description) data.description = f.description; else remove.push('description');
  return { data, remove };
}
