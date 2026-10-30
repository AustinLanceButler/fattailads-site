// GET /api/cron/verify — every 15 minutes (vercel.json). Sends queued agency link
// requests and reads back pending ones, flipping accepted links to verified; then
// auto-verifies guided GA4 / GTM / Search Console grants against FTA's own view.
// Only recent requests are re-checked (14 days; test requests 24 hours) — see
// _lib/verify-queue.mjs.
// Vercel sends `Authorization: Bearer $CRON_SECRET`; anything else is refused.

import { db, audit } from '../_lib/db.mjs';
import { safeEqual } from '../_lib/crypto.mjs';
import { sendError, sendJson } from '../_lib/http.mjs';
import { syncAgencyItem } from '../_lib/agency-sync.mjs';
import { GUIDED_AUTOVERIFY, applyGuidedResult, checkGuidedItem, createFtaView } from '../_lib/guided-verify.mjs';
import { agencyQueue, guidedQueue } from '../_lib/verify-queue.mjs';

const BATCH = 25;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.authorization || '', `Bearer ${secret}`)) return sendError(res, 401, 'unauthorized', 'Unauthorized.');
  try {
    const q = await db();
    const items = await agencyQueue(q, BATCH);
    const results = [];
    for (const item of items) {
      const out = await syncAgencyItem(q, item, { clientName: item.company, actor: 'cron' });
      results.push({ id: item.id, product: item.product, from: item.status, to: out.status, skipped: out.skipped || undefined });
    }

    // Guided grants: one FTA view per run; a product whose API errors is skipped this run.
    const guided = await guidedQueue(q, GUIDED_AUTOVERIFY, BATCH);
    const view = createFtaView();
    const failedProducts = new Set();
    for (const item of guided) {
      if (failedProducts.has(item.product)) continue;
      let r;
      try {
        r = await checkGuidedItem(view, item);
      } catch (err) {
        failedProducts.add(item.product);
        results.push({ id: item.id, product: item.product, error: err.message.slice(0, 200) });
        continue;
      }
      if (r.status !== 'skip') await applyGuidedResult(q, item, r, 'cron');
      results.push({ id: item.id, product: item.product, from: item.status, to: r.status });
    }

    const checked = items.length + guided.length;
    if (checked) await audit(null, 'cron_verify', { checked, failedProducts: [...failedProducts] });
    return sendJson(res, { checked, results });
  } catch (err) {
    console.error('[cron/verify]', err);
    return sendError(res, 500, 'server_error', 'Verify run failed.');
  }
}
