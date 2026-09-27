// POST /api/connect/admin/logout

import { allowMethods, sameOrigin, sendError, sendJson } from '../../_lib/http.mjs';
import { endAdminSession } from '../../_lib/admin-session.mjs';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return sendError(res, 403, 'forbidden', 'Cross-origin requests are not allowed.');
  endAdminSession(res);
  return sendJson(res, { ok: true });
}
