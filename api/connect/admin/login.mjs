// GET /api/connect/admin/login — starts Google sign-in for the admin dashboard.
// Reuses the wizard's OAuth client and redirect URI; the state row has product
// 'admin' and no request, which is how the callback tells the two apart.

import { db, audit } from '../../_lib/db.mjs';
import { allowMethods, baseUrl, sendError, setCookie } from '../../_lib/http.mjs';
import { randomToken, sha256Base64Url } from '../../_lib/crypto.mjs';
import { authUrl } from '../../_lib/google.mjs';
import { COOKIE_PATH, STATE_COOKIE } from '../../_lib/google-session.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  if (!process.env.GOOGLE_CLIENT_ID) return sendError(res, 503, 'not_configured', 'Google sign-in is not configured on this deployment.');
  try {
    const q = await db();
    const state = randomToken(32);
    const codeVerifier = randomToken(48);
    await q`INSERT INTO connect_oauth_states (state_hash, request_id, product, code_verifier)
            VALUES (${sha256Base64Url(state)}, NULL, 'admin', ${codeVerifier})`;
    await audit(null, 'admin_login_started', {});
    setCookie(res, STATE_COOKIE, state, { maxAge: 600, path: COOKIE_PATH });
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', authUrl({
      redirectUri: `${baseUrl(req)}/api/connect/google/callback`,
      product: 'admin',
      state,
      codeChallenge: sha256Base64Url(codeVerifier),
    }));
    return res.end();
  } catch (err) {
    console.error('[connect/admin/login]', err);
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}
