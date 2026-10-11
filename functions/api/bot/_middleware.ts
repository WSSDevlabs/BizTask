// Guards every /api/bot/* route: Botpress must send `Authorization: Bearer <BOT_API_KEY>`.

import type { PagesFunction } from '../../../server/types';
import { errorResponse, json, safeEqual } from '../../../server/http';

export const onRequest: PagesFunction = async ({ request, env, next }) => {
  const missing = (['BOT_API_KEY', 'BOT_OWNER_UID', 'FIREBASE_SERVICE_ACCOUNT'] as const).filter((k) => !env[k]);
  if (missing.length > 0) {
    // Names only — never values — so a misconfigured secret is easy to spot.
    return json({ error: 'Bot API is not configured', missing }, 503);
  }
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !(await safeEqual(token, env.BOT_API_KEY))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    return await next();
  } catch (err) {
    return errorResponse(err);
  }
};
