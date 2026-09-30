// GET /api/connect/admin/fta-microsoft-oauth — connect FTA's Microsoft Advertising
// identity with a normal redirect sign-in (authorization code + PKCE). Replaces the
// device-code flow, which Microsoft wraps in a phishing warning and which failed to
// complete for personal Microsoft accounts.
//
// FTA_MS_CLIENT_ID is a PUBLIC client (no secret): this redirect URI is registered
// under the "Mobile and desktop applications" platform in Entra, which lets the
// server redeem the code with PKCE alone. The state + verifier ride in a sealed
// cookie on the admin path, like the Google flow.

import { allowMethods, baseUrl, clearCookie, sendError, setCookie } from '../../_lib/http.mjs';
import { open, randomToken, safeEqual, seal, sha256Base64Url } from '../../_lib/crypto.mjs';
import { ADMIN_COOKIE_PATH, requireAdmin } from '../../_lib/admin-session.mjs';
import { FTA_MS_SCOPES, idTokenClaims, msClientId, saveCredential } from '../../_lib/fta-credentials.mjs';
import { audit } from '../../_lib/db.mjs';

const COOKIE = 'fta_ftamo';
const AAD = 'fta-ms-oauth';
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';

function back(res, params) {
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', `/connect/admin/?${new URLSearchParams(params)}`);
  return res.end();
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!msClientId()) return sendError(res, 503, 'not_configured', 'Set FTA_MS_CLIENT_ID first.');
  const redirectUri = `${baseUrl(req)}/api/connect/admin/fta-microsoft-oauth`;
  const qs = req.query || {};

  if (!qs.code && !qs.error) {
    const state = randomToken(32);
    const verifier = randomToken(48);
    setCookie(res, COOKIE, seal({ s: state, v: verifier, exp: Date.now() + 600000 }, AAD), { maxAge: 600, path: ADMIN_COOKIE_PATH });
    const p = new URLSearchParams({
      client_id: msClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: FTA_MS_SCOPES.join(' '),
      prompt: 'select_account',
      state,
      code_challenge: sha256Base64Url(verifier),
      code_challenge_method: 'S256',
    });
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', `${AUTHORITY}/authorize?${p}`);
    return res.end();
  }

  const saved = open(req.cookies && req.cookies[COOKIE], AAD);
  clearCookie(res, COOKIE, ADMIN_COOKIE_PATH);
  if (qs.error) {
    await audit(null, 'fta_microsoft_denied', { admin, error: String(qs.error), description: String(qs.error_description || '').slice(0, 300) });
    return back(res, { fta: 'ms_denied' });
  }
  if (!saved || Date.now() > saved.exp || !safeEqual(String(qs.state || ''), saved.s)) return back(res, { fta: 'ms_state' });

  try {
    const r = await fetch(`${AUTHORITY}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: msClientId(), grant_type: 'authorization_code', code: String(qs.code),
        redirect_uri: redirectUri, code_verifier: saved.v, scope: FTA_MS_SCOPES.join(' '),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.refresh_token) {
      await audit(null, 'fta_microsoft_failed', { admin, error: j.error || r.status, description: String(j.error_description || '').split('\n')[0].slice(0, 300), hasRefresh: !!j.refresh_token });
      return back(res, { fta: 'ms_failed' });
    }
    const claims = idTokenClaims(j.id_token);
    const identity = String(claims.preferred_username || claims.email || 'unknown').toLowerCase();
    await saveCredential('microsoft', identity, j.refresh_token, j.scope || FTA_MS_SCOPES.join(' '));
    await audit(null, 'fta_microsoft_connected', { admin, identity, via: 'redirect' });
    return back(res, { fta: 'ms_ok' });
  } catch (err) {
    console.error('[connect/admin/fta-microsoft-oauth]', err.message);
    return back(res, { fta: 'ms_failed' });
  }
}
