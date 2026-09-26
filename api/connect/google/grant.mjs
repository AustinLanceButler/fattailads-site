// POST /api/connect/google/grant  { request, product, accountId }
// Adds the FTA receiving user to the chosen account, reads the permission back
// to confirm it, records the result, then revokes and drops the client's token.
// When every product on the request is done, sends `connect_completed` to GA4
// exactly once (skipped for test requests).

import { db, audit } from '../../_lib/db.mjs';
import { allowMethods, clearCookie, isUuid, readBody, sameOrigin, sendError, sendJson } from '../../_lib/http.mjs';
import { PRODUCTS, grantAndVerify, listAccounts, revokeToken } from '../../_lib/google.mjs';
import { sendConnectCompleted } from '../../_lib/ga4.mjs';
import { COOKIE_PATH, TOKEN_COOKIE, readToken } from '../../_lib/google-session.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return sendError(res, 403, 'forbidden', 'Cross-origin requests are not allowed.');

  const b = readBody(req);
  const requestId = String(b.request || '');
  const product = String(b.product || '');
  const accountId = String(b.accountId || '');
  if (!isUuid(requestId) || !PRODUCTS[product]) return sendError(res, 400, 'invalid_request', 'Unknown request.');

  const token = readToken(req, requestId, product);
  if (!token) return sendError(res, 401, 'session_expired', 'Your Google sign-in expired. Please sign in again.');

  try {
    const q = await db();
    const [item] = await q`SELECT id FROM connect_items WHERE request_id = ${requestId} AND product = ${product}`;
    if (!item) return sendError(res, 404, 'not_found', 'Unknown request.');

    // Only act on an account this Google user can actually see.
    const accounts = await listAccounts(product, token);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return sendError(res, 400, 'invalid_account', 'That account is not available to the Google account you signed in with.');

    const result = await grantAndVerify(product, token, accountId);
    const ok = result.status === 'verified' || result.status === 'already_had_access';
    await q`UPDATE connect_items SET status = ${result.status}, asset_id = ${accountId}, asset_name = ${account.name},
                   detail = ${result.detail || null}, verified_at = ${ok ? new Date().toISOString() : null}, updated_at = now()
            WHERE id = ${item.id}`;
    await audit(requestId, 'grant_attempted', { product, accountId, status: result.status });

    if (ok) {
      await revokeToken(token);
      clearCookie(res, TOKEN_COOKIE, COOKIE_PATH);
      await maybeFireCompleted(q, requestId);
    }
    return sendJson(res, { status: result.status, assetName: account.name, detail: result.detail || '' });
  } catch (err) {
    console.error('[connect/google/grant]', err.status, err.message);
    if (err.status === 401) return sendError(res, 401, 'session_expired', 'Your Google sign-in expired. Please sign in again.');
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}

async function maybeFireCompleted(q, requestId) {
  const pending = await q`SELECT 1 FROM connect_items WHERE request_id = ${requestId}
                          AND status NOT IN ('verified', 'already_had_access') LIMIT 1`;
  if (pending.length) return;
  // Claim the send atomically so concurrent grants can't double-fire.
  const [r] = await q`UPDATE connect_requests SET status = 'complete', ga4_fired_at = now()
                      WHERE id = ${requestId} AND ga4_fired_at IS NULL
                      RETURNING client_name, company, is_test`;
  if (!r) return;
  const [{ n }] = await q`SELECT count(*)::int AS n FROM connect_items WHERE request_id = ${requestId}`;
  if (r.is_test) {
    await audit(requestId, 'completed_test_no_ga4', { assets: n });
    return;
  }
  try {
    const out = await sendConnectCompleted({ clientName: r.client_name, requestName: r.company, accessLevel: 'manage', assetsConnected: n });
    await audit(requestId, 'ga4_connect_completed', out);
  } catch (err) {
    console.error('[connect] GA4 forward failed:', err.message);
    await audit(requestId, 'ga4_connect_completed_failed', { message: err.message });
  }
}
