// GET /api/connect/google/callback?code=…&state=… (Google redirects here)
// 1. The state must match the browser's cookie AND an unused, <10-minute-old row,
//    which is consumed atomically (single use).
// 2. The code is exchanged with the PKCE verifier. access_type=online → no refresh token.
// 3. The access token is sealed (AES-GCM, bound to request+product) into a
//    15-minute HttpOnly cookie — never written to the database — and the browser
//    returns to the wizard to pick an account.

import { db, audit } from '../../_lib/db.mjs';
import { allowMethods, baseUrl, clearCookie, setCookie } from '../../_lib/http.mjs';
import { safeEqual, seal, sha256Base64Url } from '../../_lib/crypto.mjs';
import { PRODUCTS, exchangeCode } from '../../_lib/google.mjs';
import { COOKIE_PATH, STATE_COOKIE, TOKEN_COOKIE, tokenAad } from '../../_lib/google-session.mjs';

const WIZARD = '/connect/beta/';

function back(res, params) {
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', `${WIZARD}?${new URLSearchParams(params)}`);
  return res.end();
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const qs = req.query || {};
  const state = String(qs.state || '');
  const cookieState = (req.cookies && req.cookies[STATE_COOKIE]) || '';
  clearCookie(res, STATE_COOKIE, COOKIE_PATH);

  if (qs.error) return back(res, { error: qs.error === 'access_denied' ? 'access_denied' : 'oauth_error' });
  if (!state || !cookieState || !safeEqual(state, cookieState)) return back(res, { error: 'state_invalid' });

  try {
    const q = await db();
    const [row] = await q`UPDATE connect_oauth_states SET used_at = now()
                          WHERE state_hash = ${sha256Base64Url(state)} AND used_at IS NULL
                            AND created_at > now() - interval '10 minutes'
                          RETURNING request_id, product, code_verifier`;
    if (!row) return back(res, { error: 'state_invalid' });

    const tok = await exchangeCode({
      code: String(qs.code || ''),
      redirectUri: `${baseUrl(req)}/api/connect/google/callback`,
      codeVerifier: row.code_verifier,
    });

    // Granular consent lets people untick scopes; the user-management scope is the one we need.
    const granted = tok.scope.split(' ');
    if (!granted.includes(PRODUCTS[row.product].scopes[0])) {
      await audit(row.request_id, 'oauth_scope_missing', { product: row.product });
      return back(res, { error: 'scope_missing', request: row.request_id, product: row.product });
    }

    const ttl = Math.min(900, Math.max(60, tok.expiresIn - 60));
    const sealed = seal({ t: tok.accessToken, exp: Date.now() + ttl * 1000 }, tokenAad(row.request_id, row.product));
    setCookie(res, TOKEN_COOKIE, sealed, { maxAge: ttl, path: COOKIE_PATH });
    await audit(row.request_id, 'oauth_completed', { product: row.product });
    return back(res, { step: 'choose', request: row.request_id, product: row.product });
  } catch (err) {
    console.error('[connect/google/callback]', err.code || err.message);
    return back(res, { error: 'oauth_error' });
  }
}
