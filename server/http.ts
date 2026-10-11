// Shared helpers for the bot API: JSON responses, auth, and Malaysia-time dates.

import type { Firestore, FsValue } from './firestore';

export const TZ = 'Asia/Kuala_Lumpur';
const OFFSET = '+08:00'; // Malaysia has no DST, so a fixed offset is exact.
const DAY_MS = 86_400_000;

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  console.error('[bot-api]', err);
  return json({ error: 'Internal error' }, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
}

// Compares SHA-256 digests so the check takes the same time regardless of
// where the strings differ (no timing side channel on the API key).
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ax = new Uint8Array(x), by = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ by[i];
  return diff === 0;
}

// ── Dates (always Malaysia time) ─────────────────────────────────────────────

/** YYYY-MM-DD for the Malaysia calendar day containing `d`. */
export function myDate(d: Date = new Date()): string {
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function dayStart(date: string): Date {
  return new Date(`${date}T00:00:00${OFFSET}`);
}

export function addDays(date: string, n: number): string {
  return myDate(new Date(dayStart(date).getTime() + n * DAY_MS));
}

export function isDateString(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(dayStart(s).getTime());
}

/**
 * Accepts "2026-10-14", "2026-10-14T15:00", "2026-10-14 15:00" (read as Malaysia
 * time) or a full ISO string with an offset/Z.
 */
export function parseDateTime(input: unknown, field: string): Date {
  if (typeof input !== 'string' || !input.trim()) throw new HttpError(400, `${field} is required`);
  let s = input.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) s += OFFSET;
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new HttpError(400, `${field} is not a valid date/time: "${input}"`);
  return d;
}

/** ISO string in Malaysia time, e.g. 2026-10-14T15:00:00+08:00 */
export function isoLocal(d: Date): string {
  return `${new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 19)}${OFFSET}`;
}

export function formatDay(date: string): string {
  return dayStart(date).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

// ── Audit trail ──────────────────────────────────────────────────────────────

export async function audit(
  fs: Firestore,
  action: 'create' | 'update' | 'delete',
  module: string,
  description: string,
  entityId: string,
  after: FsValue = null,
): Promise<void> {
  try {
    await fs.create('auditLogs', {
      userId: 'telegram-bot',
      userEmail: 'telegram-bot',
      action,
      module,
      description: `${description} (via Telegram)`,
      entityId,
      before: null,
      after,
      createdAt: new Date(),
    });
  } catch (err) {
    // Same policy as the web app: audit logging must never break the write.
    console.error('[bot-api] audit log failed', err);
  }
}
