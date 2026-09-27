// POST /api/connect/google/grant  { request, product, accountId }
// Adds the FTA receiving user to the chosen account, reads the permission back
// to confirm it, records the result, then revokes and drops the client's token.
// When every product on the request is done, sends `connect_completed` to GA4
// exactly once (skipped for test requests).

import { db, audit } from '../../_lib/db.mjs';
import { allowMethods, clearCookie, isUuid, readBody, sameOrigin, sendError, sendJson } from '../../_lib/http.mjs';
import { PRODUCTS, grantAndVerify, listAccounts, revokeToken } from '../../_lib/google.mjs';
import { maybeFireCompleted } from '../../_lib/completion.mjs';
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
    const [item] = await q`SELECT i.id, r.is_test FROM connect_items i JOIN connect_requests r ON r.id = i.request_id
                           WHERE i.request_id = ${requestId} AND i.product = ${product}`;
    if (!item) return sendError(res, 404, 'not_found', 'Unknown request.');

    // Only act on an account this Google user can actually see.
    const accounts = await listAccounts(product, token);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return sendError(res, 400, 'invalid_account', 'That account is not available to the Google account you signed in with.');
    if (!account.canGrant) {
      return sendJson(res, { status: 'failed', assetName: account.name, detail: `Your Google account isn't an administrator of ${account.name}, so it can't add users there. An administrator of the account needs to complete this step.` });
    }

    const result = await grantAndVerify(product, token, accountId);
    const ok = result.status === 'verified' || result.status === 'already_had_access' || result.status === 'invited';
    await q`UPDATE connect_items SET status = ${result.status}, asset_id = ${accountId}, asset_name = ${account.name},
                   detail = ${result.detail || null}, verified_at = ${ok ? new Date().toISOString() : null}, updated_at = now()
            WHERE id = ${item.id}`;
    await audit(requestId, 'grant_attempted', { product, accountId, status: result.status, trace: result.trace });

    if (ok) {
      // A GTM invitation still needs FTA to accept it in Tag Manager.
      if (result.status === 'invited') {
        await q`UPDATE connect_items SET fta_status = 'todo', fta_updated_at = now() WHERE id = ${item.id}`;
      }
      await revokeToken(token);
      clearCookie(res, TOKEN_COOKIE, COOKIE_PATH);
      await maybeFireCompleted(q, requestId);
    }
    // Test requests (?test=1) also return the Google call trace (statuses + error text only) for debugging.
    return sendJson(res, { status: result.status, assetName: account.name, detail: result.detail || '', ...(item.is_test ? { trace: result.trace } : {}) });
  } catch (err) {
    console.error('[connect/google/grant]', err.status, err.message);
    if (err.status === 401) return sendError(res, 401, 'session_expired', 'Your Google sign-in expired. Please sign in again.');
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}
