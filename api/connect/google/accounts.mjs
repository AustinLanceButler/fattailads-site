// GET /api/connect/google/accounts?request=<uuid>&product=ga4|gtm
// Lists the GA4 / GTM accounts the signed-in client can see, using the sealed
// token from the callback. Nothing is stored.

import { allowMethods, isUuid, sendError, sendJson } from '../../_lib/http.mjs';
import { PRODUCTS, listAccounts } from '../../_lib/google.mjs';
import { readToken } from '../../_lib/google-session.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const requestId = String((req.query && req.query.request) || '');
  const product = String((req.query && req.query.product) || '');
  if (!isUuid(requestId) || !PRODUCTS[product]) return sendError(res, 400, 'invalid_request', 'Unknown request.');

  const token = readToken(req, requestId, product);
  if (!token) return sendError(res, 401, 'session_expired', 'Your Google sign-in expired. Please sign in again.');

  try {
    const accounts = await listAccounts(product, token);
    return sendJson(res, { accounts });
  } catch (err) {
    console.error('[connect/google/accounts]', err.status, err.message);
    if (err.status === 401) return sendError(res, 401, 'session_expired', 'Your Google sign-in expired. Please sign in again.');
    return sendError(res, 502, 'google_error', `Google returned an error: ${err.message}`);
  }
}
