// GET /api/connect/google/start?request=<uuid>&product=ga4|gtm
// Creates a single-use OAuth state (hashed in the DB, raw value in an HttpOnly
// cookie so the callback is bound to this browser) plus a PKCE verifier, then
// redirects to Google's consent screen for just this product's scopes.

import { db, audit } from '../../_lib/db.mjs';
import { allowMethods, baseUrl, isUuid, sendError, setCookie } from '../../_lib/http.mjs';
import { randomToken, sha256Base64Url } from '../../_lib/crypto.mjs';
import { PRODUCTS, authUrl } from '../../_lib/google.mjs';
import { COOKIE_PATH, STATE_COOKIE } from '../../_lib/google-session.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const requestId = String((req.query && req.query.request) || '');
  const product = String((req.query && req.query.product) || '');
  if (!isUuid(requestId) || !PRODUCTS[product]) return sendError(res, 400, 'invalid_request', 'Unknown request.');
  if (!process.env.GOOGLE_CLIENT_ID) return sendError(res, 503, 'not_configured', 'Google sign-in is not configured yet.');

  try {
    const q = await db();
    const [item] = await q`SELECT status FROM connect_items WHERE request_id = ${requestId} AND product = ${product}`;
    if (!item) return sendError(res, 404, 'not_found', 'Unknown request.');

    const state = randomToken(32);
    const codeVerifier = randomToken(48);
    await q`INSERT INTO connect_oauth_states (state_hash, request_id, product, code_verifier)
            VALUES (${sha256Base64Url(state)}, ${requestId}, ${product}, ${codeVerifier})`;
    await audit(requestId, 'oauth_started', { product });

    setCookie(res, STATE_COOKIE, state, { maxAge: 600, path: COOKIE_PATH });
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', authUrl({
      redirectUri: `${baseUrl(req)}/api/connect/google/callback`,
      product,
      state,
      codeChallenge: sha256Base64Url(codeVerifier),
    }));
    return res.end();
  } catch (err) {
    console.error('[connect/google/start]', err);
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}
