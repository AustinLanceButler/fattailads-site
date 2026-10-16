// GET /api/connect/admin/fta-linkedin — connect FTA's own LinkedIn sign-in for the ads
// warehouse (admin only). Without ?code it starts consent; LinkedIn redirects back here
// with ?code&state. Uses FTA_LINKEDIN_CLIENT_ID/SECRET (the warehouse's own app, FTA Ads
// Warehouse), scopes r_ads r_ads_reporting. This redirect URI must be listed under the
// LinkedIn app's Auth → Authorized redirect URLs. State rides in a sealed cookie, as for
// fta-google.
//
// LinkedIn keeps ONE live grant per member+app: signing in here on linkedin-mcp's app
// (FTA-LI-MCP, 238010228) revokes the MCP's token, and its re-auth revokes ours. So this
// refuses to start consent when the client id is the MCP's, matched by sha256 prefix.

import { allowMethods, baseUrl, clearCookie, sendError, setCookie } from '../../_lib/http.mjs';
import { createHash } from 'node:crypto';
import { randomToken, safeEqual, seal, open } from '../../_lib/crypto.mjs';
import { ADMIN_COOKIE_PATH, requireAdmin } from '../../_lib/admin-session.mjs';
import { FTA_LINKEDIN_SCOPES, LINKEDIN_TOKEN_URL, saveCredential } from '../../_lib/fta-credentials.mjs';
import { audit } from '../../_lib/db.mjs';

const COOKIE = 'fta_ftal';
const AAD = 'fta-linkedin-connect';
// sha256(linkedin-mcp's LINKEDIN_CLIENT_ID), first 16 hex chars.
const MCP_CLIENT_ID_SHA256 = '40551dd9caaac146';
export const isMcpClientId = (id) => createHash('sha256').update(String(id)).digest('hex').startsWith(MCP_CLIENT_ID_SHA256);

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
  if (!process.env.FTA_LINKEDIN_CLIENT_ID || !process.env.FTA_LINKEDIN_CLIENT_SECRET) {
    return sendError(res, 503, 'not_configured', 'Set FTA_LINKEDIN_CLIENT_ID and FTA_LINKEDIN_CLIENT_SECRET first.');
  }
  if (isMcpClientId(process.env.FTA_LINKEDIN_CLIENT_ID)) {
    return sendError(res, 409, 'shared_app', "FTA_LINKEDIN_CLIENT_ID is linkedin-mcp's app; signing in would revoke the MCP's token. Use the warehouse's own LinkedIn app.");
  }
  const redirectUri = `${baseUrl(req)}/api/connect/admin/fta-linkedin`;
  const qs = req.query || {};

  if (!qs.code && !qs.error) {
    const state = randomToken(32);
    setCookie(res, COOKIE, seal({ s: state, exp: Date.now() + 1800000 }, AAD), { maxAge: 1800, path: ADMIN_COOKIE_PATH });
    const p = new URLSearchParams({
      response_type: 'code', client_id: process.env.FTA_LINKEDIN_CLIENT_ID, redirect_uri: redirectUri,
      state, scope: FTA_LINKEDIN_SCOPES.join(' '),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 302;
    res.setHeader('Location', `https://www.linkedin.com/oauth/v2/authorization?${p}`);
    return res.end();
  }

  const saved = open(req.cookies && req.cookies[COOKIE], AAD);
  clearCookie(res, COOKIE, ADMIN_COOKIE_PATH);
  if (qs.error) return back(res, { fta: 'linkedin_denied' });
  if (!saved || Date.now() > saved.exp || !safeEqual(String(qs.state || ''), saved.s)) return back(res, { fta: 'linkedin_state' });

  try {
    const r = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code: String(qs.code), redirect_uri: redirectUri,
        client_id: process.env.FTA_LINKEDIN_CLIENT_ID, client_secret: process.env.FTA_LINKEDIN_CLIENT_SECRET,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.refresh_token) {
      await audit(null, 'fta_linkedin_failed', { admin, error: j.error || r.status, hasRefresh: !!j.refresh_token });
      return back(res, { fta: j.refresh_token === undefined && r.ok ? 'linkedin_no_refresh' : 'linkedin_failed' });
    }
    // No OpenID scope on this app, so identify the sign-in by what it can see.
    const a = await fetch('https://api.linkedin.com/rest/adAccounts?q=search&count=100', {
      headers: { authorization: `Bearer ${j.access_token}`, 'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202604', 'X-Restli-Protocol-Version': '2.0.0' },
    });
    const aj = await a.json().catch(() => ({}));
    const n = Array.isArray(aj.elements) ? aj.elements.length : 0;
    const granted = String(j.scope || '').split(/[ ,]+/);
    const missing = FTA_LINKEDIN_SCOPES.filter((s) => !granted.includes(s));
    await saveCredential('linkedin', `LinkedIn member · ${n} ad account${n === 1 ? '' : 's'}`, j.refresh_token, j.scope || FTA_LINKEDIN_SCOPES.join(' '));
    await audit(null, 'fta_linkedin_connected', { admin, accounts: n, missing });
    return back(res, { fta: missing.length ? 'linkedin_partial' : 'linkedin_ok' });
  } catch (err) {
    console.error('[connect/admin/fta-linkedin]', err.message);
    return back(res, { fta: 'linkedin_failed' });
  }
}
