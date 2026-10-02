// POST /api/connect/admin/send-link { id } — send (or re-check) an agency link request now,
// or re-check a guided GA4 / GTM / Search Console grant against FTA's own view.

import { db } from '../../_lib/db.mjs';
import { allowMethods, readBody, sendError, sendJson } from '../../_lib/http.mjs';
import { requireAdmin } from '../../_lib/admin-session.mjs';
import { syncAgencyItem } from '../../_lib/agency-sync.mjs';
import { GUIDED_AUTOVERIFY, applyGuidedResult, checkGuidedItem, createFtaView } from '../../_lib/guided-verify.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const admin = requireAdmin(req, res, { mutation: true });
  if (!admin) return;
  const id = String(readBody(req).id || '');
  if (!/^\d+$/.test(id)) return sendError(res, 400, 'invalid_input', 'Unknown item.');
  try {
    const q = await db();
    const [item] = await q`SELECT i.id, i.request_id, i.product, i.status, i.asset_id, i.client_input, r.company
                           FROM connect_items i JOIN connect_requests r ON r.id = i.request_id WHERE i.id = ${id}`;
    if (item && GUIDED_AUTOVERIFY.includes(item.product)) {
      let r;
      try {
        r = await checkGuidedItem(createFtaView(), item);
      } catch (err) {
        return sendError(res, 409, 'not_ready', `Check failed: ${err.message.slice(0, 200)}`);
      }
      if (r.status !== 'skip') await applyGuidedResult(q, item, r, admin);
      return sendJson(res, { status: r.status, detail: r.detail });
    }
    if (!item || !['google_ads', 'microsoft_ads'].includes(item.product)) return sendError(res, 404, 'not_found', 'Not an agency or auto-verifiable item.');
    // A failed item is retried as a fresh send.
    if (item.status === 'failed' || item.status === 'pending') item.status = 'requested';
    const out = await syncAgencyItem(q, item, { clientName: item.company, actor: admin });
    if (out.skipped) return sendError(res, 409, 'not_ready', `Can't send yet: ${out.skipped}. Connect FTA credentials first.`);
    return sendJson(res, out);
  } catch (err) {
    console.error('[connect/admin/send-link]', err);
    return sendError(res, 500, 'server_error', 'Could not send the link.');
  }
}
