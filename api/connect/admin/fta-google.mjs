// GET /api/connect/admin/fta-google — connect FTA's own Google identity (admin only).
// Without ?code it starts consent; Google redirects back here with ?code&state.
// Uses the ops-project OAuth client (FTA_GOOGLE_CLIENT_ID/SECRET), offline access,
// and only accepts the receiving identity (austin@fattailads.com). The state and
// PKCE verifier ride in a sealed cookie on the admin path, so no DB row is needed.

import { allowMethods, baseUrl, clearCookie, sendError, setCookie } from '../../_lib/http.mjs';
import { randomToken, safeEqual, seal, open, sha256Base64Url } from '../../_lib/crypto.mjs';
import { ADMIN_COOKIE_PATH, requireAdmin } from '../../_lib/admin-session.mjs';
import { fetchVerifiedEmail, receivingEmail } from '../../_lib/google.mjs';
import { FTA_GOOGLE_SCOPES, saveCredential } from '../../_lib/fta-credentials.mjs';
import { audit } from '../../_lib/db.mjs';

const COOKIE = 'fta_ftag';
const AAD = 'fta-google-connect';

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
  if (!process.env.FTA_GOOGLE_CLIENT_ID || !process.env.FTA_GOOGLE_CLIENT_SECRET) {
    return sendError(res, 503, 'not_configured', 'Set FTA_GOOGLE_CLIENT_ID and FTA_GOOGLE_CLIENT_SECRET first.');
  }
  const redirectUri = `${baseUrl(req)}/api/connect/admin/fta-google`;
  const qs = req.query || {};

  if (!qs.code && !qs.error) {
    const state = randomToken(32);
    const verifier = randomToken(48);
    setCookie(res, COOKIE, seal({ s: state, v: verifier, exp: Date.now() + 600000 }, AAD), { maxAge: 600, path: ADMIN_COOKIE_PATH });
    const p = new URLSearchParams({
      client_id: process.env.FTA_GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: FTA_GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'false',
      login_hint: receivingEmail(),
      state,
      code_challenge: sha256Base64Url(verifier),
      code_challenge_method: 'S256',
    });
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${p}`);
    return res.end();
  }

  const saved = open(req.cookies && req.cookies[COOKIE], AAD);
  clearCookie(res, COOKIE, ADMIN_COOKIE_PATH);
  if (qs.error) return back(res, { fta: 'google_denied' });
  if (!saved || Date.now() > saved.exp || !safeEqual(String(qs.state || ''), saved.s)) return back(res, { fta: 'google_state' });

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(qs.code), client_id: process.env.FTA_GOOGLE_CLIENT_ID, client_secret: process.env.FTA_GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: saved.v,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.refresh_token) {
      await audit(null, 'fta_google_failed', { admin, error: j.error || r.status, hasRefresh: !!j.refresh_token });
      return back(res, { fta: 'google_failed' });
    }
    const email = await fetchVerifiedEmail(j.access_token);
    if (email !== receivingEmail()) {
      await audit(null, 'fta_google_wrong_identity', { admin, email });
      return back(res, { fta: 'google_wrong_identity' });
    }
    const granted = String(j.scope || '').split(' ');
    const missing = FTA_GOOGLE_SCOPES.filter((s) => s.startsWith('https://') && !granted.includes(s));
    await saveCredential('google', email, j.refresh_token, j.scope || '');
    await audit(null, 'fta_google_connected', { admin, email, missing });
    return back(res, { fta: missing.length ? 'google_partial' : 'google_ok' });
  } catch (err) {
    console.error('[connect/admin/fta-google]', err.message);
    return back(res, { fta: 'google_failed' });
  }
}
