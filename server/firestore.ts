// Firestore REST client for Cloudflare Functions.
//
// Authenticates as the Firebase service account (OAuth2 JWT-bearer flow signed
// with Web Crypto), so these calls bypass firestore.rules — every handler must
// do its own validation and ownership checks.

import type { Env } from './types';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export type FsValue = string | number | boolean | null | Date | FsValue[] | { [k: string]: FsValue };
export type FsData = Record<string, FsValue>;
export interface FsDoc { id: string; data: FsData }

let cachedToken: { token: string; expires: number; email: string } | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function serviceAccount(env: Env): ServiceAccount {
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.expires - 60 > now) return cachedToken.token;

  const der = Uint8Array.from(
    atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expires: now + json.expires_in, email: sa.client_email };
  return json.access_token;
}

// ── Value encoding ───────────────────────────────────────────────────────────

type RestValue = Record<string, unknown>;

function encode(v: FsValue): RestValue {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  switch (typeof v) {
    case 'string': return { stringValue: v };
    case 'boolean': return { booleanValue: v };
    case 'number': return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    default: return { mapValue: { fields: encodeFields(v) } };
  }
}

function encodeFields(data: FsData): Record<string, RestValue> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));
}

function decode(v: RestValue): FsValue {
  if ('stringValue' in v) return v.stringValue as string;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue as number;
  if ('booleanValue' in v) return v.booleanValue as boolean;
  if ('timestampValue' in v) return new Date(v.timestampValue as string);
  if ('arrayValue' in v) return (((v.arrayValue as { values?: RestValue[] }).values) ?? []).map(decode);
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Record<string, RestValue> }).fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, RestValue>): FsData {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

function toDoc(raw: { name: string; fields?: Record<string, RestValue> }): FsDoc {
  return { id: raw.name.split('/').pop()!, data: decodeFields(raw.fields ?? {}) };
}

// ── Client ───────────────────────────────────────────────────────────────────

export interface Firestore {
  list(collection: string, where?: { field: string; equals: string }): Promise<FsDoc[]>;
  get(collection: string, id: string): Promise<FsDoc | null>;
  create(collection: string, data: FsData): Promise<string>;
  /** Updates only `data`'s keys; keys in `remove` are deleted. Fails if the doc doesn't exist. */
  update(collection: string, id: string, data: FsData, remove?: string[]): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

export function firestore(env: Env): Firestore {
  const sa = serviceAccount(env);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;

  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Firestore ${init.method ?? 'GET'} failed (${res.status}): ${await res.text()}`);
    return res;
  }

  return {
    async list(collection, where) {
      const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
      if (where) {
        structuredQuery.where = { fieldFilter: { field: { fieldPath: where.field }, op: 'EQUAL', value: encode(where.equals) } };
      }
      const res = await call(`${base}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
      const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, RestValue> } }[];
      return rows.filter((r) => r.document).map((r) => toDoc(r.document!));
    },

    async get(collection, id) {
      const res = await call(`${base}/${collection}/${encodeURIComponent(id)}`);
      return res.status === 404 ? null : toDoc(await res.json());
    },

    async create(collection, data) {
      const res = await call(`${base}/${collection}`, { method: 'POST', body: JSON.stringify({ fields: encodeFields(data) }) });
      return toDoc(await res.json()).id;
    },

    async update(collection, id, data, remove = []) {
      const mask = [...Object.keys(data), ...remove].map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
      const res = await call(`${base}/${collection}/${encodeURIComponent(id)}?${mask}&currentDocument.exists=true`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: encodeFields(data) }),
      });
      if (res.status === 404) throw new Error('Document not found');
    },

    async remove(collection, id) {
      await call(`${base}/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}
