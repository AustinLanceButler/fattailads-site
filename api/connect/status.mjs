// GET /api/connect/status?request=<uuid> — per-product status for the wizard.

import { db } from '../_lib/db.mjs';
import { allowMethods, isUuid, sendError, sendJson } from '../_lib/http.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const requestId = String((req.query && req.query.request) || '');
  if (!isUuid(requestId)) return sendError(res, 400, 'invalid_request', 'Unknown request.');

  try {
    const q = await db();
    const items = await q`SELECT product, status, asset_name, detail FROM connect_items
                          WHERE request_id = ${requestId} ORDER BY id`;
    if (!items.length) return sendError(res, 404, 'not_found', 'Unknown request.');
    const done = (s) => s === 'verified' || s === 'already_had_access';
    return sendJson(res, {
      items: items.map((i) => ({ product: i.product, status: i.status, assetName: i.asset_name || '', detail: i.detail || '' })),
      complete: items.every((i) => done(i.status)),
    });
  } catch (err) {
    console.error('[connect/status]', err);
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}
