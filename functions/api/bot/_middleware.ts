// Guards every /api/bot/* route: Botpress must send `Authorization: Bearer <BOT_API_KEY>`.

import type { PagesFunction } from '../../../server/types';
import { errorResponse, json, safeEqual } from '../../../server/http';

export const onRequest: PagesFunction = async ({ request, env, next }) => {
  if (!env.BOT_API_KEY || !env.BOT_OWNER_UID || !env.FIREBASE_SERVICE_ACCOUNT) {
    return json({ error: 'Bot API is not configured' }, 503);
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
