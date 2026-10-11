// Minimal Cloudflare Pages Functions types — just what the bot API uses, so we
// don't need @cloudflare/workers-types for a handful of handlers.

export interface Env {
  /** Full service-account JSON (Firebase → Project settings → Service accounts). */
  FIREBASE_SERVICE_ACCOUNT: string;
  /** Shared secret Botpress sends as `Authorization: Bearer <key>`. */
  BOT_API_KEY: string;
  /** Firebase Auth UID of the account whose calendar the bot manages. */
  BOT_OWNER_UID: string;
}

export interface FunctionContext<P extends string = never> {
  request: Request;
  env: Env;
  params: Record<P, string>;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}

export type PagesFunction<P extends string = never> = (ctx: FunctionContext<P>) => Response | Promise<Response>;
