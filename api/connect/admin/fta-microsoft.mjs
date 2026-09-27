// POST /api/connect/admin/fta-microsoft  { action: 'start' | 'poll' } (admin only)
// Device-code sign-in for FTA's Microsoft Advertising identity: 'start' returns a
// code to enter at microsoft.com/devicelogin; 'poll' checks until Microsoft issues
// the tokens, then stores the refresh token. The device code stays server-side in
// a sealed cookie on the admin path.

import { allowMethods, clearCookie, readBody, sendError, sendJson, setCookie } from '../../_lib/http.mjs';
import { open, seal } from '../../_lib/crypto.mjs';
import { ADMIN_COOKIE_PATH, requireAdmin } from '../../_lib/admin-session.mjs';
import { FTA_MS_SCOPES, idTokenClaims, msClientId, msDeviceCode, msPollDeviceCode, saveCredential } from '../../_lib/fta-credentials.mjs';
import { audit } from '../../_lib/db.mjs';

const COOKIE = 'fta_ftams';
const AAD = 'fta-ms-device';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const admin = requireAdmin(req, res, { mutation: true });
  if (!admin) return;
  if (!msClientId()) return sendError(res, 503, 'not_configured', 'Set FTA_MS_CLIENT_ID first.');
  const action = String(readBody(req).action || '');

  try {
    if (action === 'start') {
      const r = await msDeviceCode();
      if (!r.ok) return sendError(res, 502, 'ms_error', r.body.error_description || r.body.error || 'Microsoft refused the request.');
      const ttl = Math.min(Number(r.body.expires_in) || 900, 900);
      setCookie(res, COOKIE, seal({ d: r.body.device_code, exp: Date.now() + ttl * 1000 }, AAD), { maxAge: ttl, path: ADMIN_COOKIE_PATH });
      return sendJson(res, { userCode: r.body.user_code, verificationUri: r.body.verification_uri, interval: r.body.interval || 5, expiresIn: ttl });
    }
    if (action === 'poll') {
      const saved = open(req.cookies && req.cookies[COOKIE], AAD);
      if (!saved || Date.now() > saved.exp) return sendError(res, 410, 'expired', 'The code expired. Start again.');
      const r = await msPollDeviceCode(saved.d);
      if (!r.ok) {
        const e = r.body.error;
        if (e === 'authorization_pending' || e === 'slow_down') return sendJson(res, { pending: true });
        clearCookie(res, COOKIE, ADMIN_COOKIE_PATH);
        await audit(null, 'fta_microsoft_failed', { admin, error: e });
        return sendError(res, 400, e || 'ms_error', r.body.error_description ? String(r.body.error_description).split('\n')[0] : 'Sign-in failed.');
      }
      if (!r.body.refresh_token) return sendError(res, 400, 'no_refresh', 'Microsoft returned no refresh token.');
      const claims = idTokenClaims(r.body.id_token);
      const identity = String(claims.preferred_username || claims.email || 'unknown').toLowerCase();
      await saveCredential('microsoft', identity, r.body.refresh_token, r.body.scope || FTA_MS_SCOPES.join(' '));
      clearCookie(res, COOKIE, ADMIN_COOKIE_PATH);
      await audit(null, 'fta_microsoft_connected', { admin, identity });
      return sendJson(res, { ok: true, identity });
    }
    return sendError(res, 400, 'invalid_input', 'Unknown action.');
  } catch (err) {
    console.error('[connect/admin/fta-microsoft]', err.message);
    return sendError(res, 500, 'server_error', 'Something went wrong.');
  }
}
