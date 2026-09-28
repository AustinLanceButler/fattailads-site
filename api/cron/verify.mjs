// GET /api/cron/verify — every 15 minutes (vercel.json). Sends queued agency link
// requests and reads back pending ones, flipping accepted links to verified.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is refused.

import { db, audit } from '../_lib/db.mjs';
import { safeEqual } from '../_lib/crypto.mjs';
import { sendError, sendJson } from '../_lib/http.mjs';
import { syncAgencyItem } from '../_lib/agency-sync.mjs';

const BATCH = 25;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.authorization || '', `Bearer ${secret}`)) return sendError(res, 401, 'unauthorized', 'Unauthorized.');
  try {
    const q = await db();
    const items = await q`SELECT i.id, i.request_id, i.product, i.status, i.client_input, r.company
                          FROM connect_items i JOIN connect_requests r ON r.id = i.request_id
                          WHERE i.product IN ('google_ads', 'microsoft_ads') AND i.status IN ('requested', 'invite_sent')
                          ORDER BY i.updated_at ASC LIMIT ${BATCH}`;
    const results = [];
    for (const item of items) {
      const out = await syncAgencyItem(q, item, { clientName: item.company, actor: 'cron' });
      results.push({ id: item.id, product: item.product, from: item.status, to: out.status, skipped: out.skipped || undefined });
    }
    if (items.length) await audit(null, 'cron_verify', { checked: items.length });
    return sendJson(res, { checked: items.length, results });
  } catch (err) {
    console.error('[cron/verify]', err);
    return sendError(res, 500, 'server_error', 'Verify run failed.');
  }
}
