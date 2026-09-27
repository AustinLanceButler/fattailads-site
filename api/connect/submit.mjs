// POST /api/connect/submit  { request, product, input: { field: value } }
// The client finished their part of an agency or guided platform:
//   agency → status 'requested' (FTA sends the link from its manager account)
//   guided → status 'client_reported' (the client says they added FTA)
// Either way FTA owes a follow-up, so fta_status becomes 'todo' for the admin queue.

import { db, audit } from '../_lib/db.mjs';
import { allowMethods, isUuid, readBody, sameOrigin, sendError, sendJson } from '../_lib/http.mjs';
import { platform, summarizeInput, validateInput } from '../_lib/platforms.mjs';
import { maybeFireCompleted } from '../_lib/completion.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return sendError(res, 403, 'forbidden', 'Cross-origin requests are not allowed.');

  const b = readBody(req);
  const requestId = String(b.request || '');
  const product = String(b.product || '');
  const p = platform(product);
  if (!isUuid(requestId) || !p) return sendError(res, 400, 'invalid_request', 'Unknown request.');

  const v = validateInput(product, b.input);
  if (!v.ok) return sendError(res, 400, 'invalid_input', v.message);
  const status = p.mechanism === 'agency' ? 'requested' : 'client_reported';

  try {
    const q = await db();
    const [item] = await q`UPDATE connect_items
                           SET status = ${status}, client_input = ${JSON.stringify(v.input)},
                               asset_name = ${summarizeInput(product, v.input) || null}, detail = null,
                               fta_status = 'todo', fta_note = null, fta_updated_at = now(), updated_at = now()
                           WHERE request_id = ${requestId} AND product = ${product}
                           RETURNING id`;
    if (!item) return sendError(res, 404, 'not_found', 'Unknown request.');
    await audit(requestId, 'client_submitted', { product, status, input: v.input });
    await maybeFireCompleted(q, requestId);
    return sendJson(res, { status });
  } catch (err) {
    console.error('[connect/submit]', err);
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}
