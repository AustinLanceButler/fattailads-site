// api/_lib/cron-auth.mjs — bearer guards for the warehouse endpoints.
//   cron:  Vercel sends `Authorization: Bearer $CRON_SECRET` (same as api/cron/verify.mjs)
//   admin: operator calls with `Authorization: Bearer $INGEST_ADMIN_SECRET`
// Either secret is accepted on cron routes so an operator can trigger a cron by hand.

import { safeEqual } from './crypto.mjs';
import { sendError } from './http.mjs';

function bearerOk(req, secrets) {
  const auth = req.headers.authorization || '';
  return secrets.filter(Boolean).some((s) => safeEqual(auth, `Bearer ${s}`));
}

export function requireCron(req, res) {
  if (bearerOk(req, [process.env.CRON_SECRET, process.env.INGEST_ADMIN_SECRET])) return true;
  sendError(res, 401, 'unauthorized', 'Unauthorized.');
  return false;
}

export function requireAdminSecret(req, res) {
  if (process.env.INGEST_ADMIN_SECRET && bearerOk(req, [process.env.INGEST_ADMIN_SECRET])) return true;
  sendError(res, 401, 'unauthorized', 'Unauthorized.');
  return false;
}

// Uniform cron handler: runs `fn`, returns JSON, logs and 500s on failure.
export function cronHandler(name, fn) {
  return async function handler(req, res) {
    if (!requireCron(req, res)) return;
    const started = Date.now();
    try {
      const out = await fn(req);
      return res.status(200).json({ job: name, ms: Date.now() - started, ...out });
    } catch (err) {
      console.error(`[cron/${name}]`, err);
      return sendError(res, 500, 'server_error', `${name} failed: ${err.message}`.slice(0, 500));
    }
  };
}
