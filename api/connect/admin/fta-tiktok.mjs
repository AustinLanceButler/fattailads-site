// GET /api/connect/admin/fta-tiktok — connect FTA's own TikTok for Business sign-in for
// the ads warehouse (admin only). Without ?auth_code it starts consent; TikTok redirects
// back here with ?auth_code&state. Uses FTA_TIKTOK_APP_ID/SECRET (a TikTok API for
// Business developer app with Ad Account Management + Reporting read permissions). This
// URL must be the app's Advertiser redirect URL. State rides in a sealed cookie, as for
// fta-linkedin.

import { allowMethods, baseUrl, clearCookie, sendError, setCookie } from '../../_lib/http.mjs';
import { randomToken, safeEqual, seal, open } from '../../_lib/crypto.mjs';
import { ADMIN_COOKIE_PATH, requireAdmin } from '../../_lib/admin-session.mjs';
import { TIKTOK_TOKEN_URL, saveCredential } from '../../_lib/fta-credentials.mjs';
import { audit } from '../../_lib/db.mjs';

const COOKIE = 'fta_ftat';
const AAD = 'fta-tiktok-connect';

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
  const appId = process.env.FTA_TIKTOK_APP_ID;
  const secret = process.env.FTA_TIKTOK_APP_SECRET;
  if (!appId || !secret) return sendError(res, 503, 'not_configured', 'Set FTA_TIKTOK_APP_ID and FTA_TIKTOK_APP_SECRET first.');
  const redirectUri = `${baseUrl(req)}/api/connect/admin/fta-tiktok`;
  const qs = req.query || {};
  const code = qs.auth_code || qs.code;

  if (!code && !qs.error) {
    const state = randomToken(32);
    setCookie(res, COOKIE, seal({ s: state, exp: Date.now() + 1800000 }, AAD), { maxAge: 1800, path: ADMIN_COOKIE_PATH });
    const p = new URLSearchParams({ app_id: appId, state, redirect_uri: redirectUri });
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', `https://business-api.tiktok.com/portal/auth?${p}`);
    return res.end();
  }

  const saved = open(req.cookies && req.cookies[COOKIE], AAD);
  clearCookie(res, COOKIE, ADMIN_COOKIE_PATH);
  if (qs.error || !code) return back(res, { fta: 'tiktok_denied' });
  if (!saved || Date.now() > saved.exp || !safeEqual(String(qs.state || ''), saved.s)) return back(res, { fta: 'tiktok_state' });

  try {
    const r = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, secret, auth_code: String(code) }),
    });
    const j = await r.json().catch(() => ({}));
    const d = j.data || {};
    if (!r.ok || j.code !== 0 || !d.access_token) {
      await audit(null, 'fta_tiktok_failed', { admin, status: r.status, code: j.code, message: String(j.message || '').slice(0, 160) });
      return back(res, { fta: 'tiktok_failed' });
    }
    const n = Array.isArray(d.advertiser_ids) ? d.advertiser_ids.length : 0;
    await saveCredential('tiktok', `TikTok for Business · ${n} advertiser${n === 1 ? '' : 's'}`, d.access_token, Array.isArray(d.scope) ? d.scope.join(' ') : null);
    await audit(null, 'fta_tiktok_connected', { admin, advertisers: n, expires_in: d.expires_in ?? null, has_refresh: !!d.refresh_token });
    return back(res, { fta: 'tiktok_ok' });
  } catch (err) {
    console.error('[connect/admin/fta-tiktok]', err.message);
    return back(res, { fta: 'tiktok_failed' });
  }
}
