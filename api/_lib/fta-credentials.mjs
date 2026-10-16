// api/_lib/fta-credentials.mjs — FTA's own OAuth credentials, used by the verify
// cron and agency-side link requests. Only Austin's identities are stored here;
// client tokens never are.
//
//   google    — austin@fattailads.com, minted through a web OAuth client in the ops
//               Cloud project (FTA_GOOGLE_CLIENT_ID / FTA_GOOGLE_CLIENT_SECRET).
//   google_personal — Austin's personal Google login (FTA_GOOGLE_PERSONAL_EMAIL), same
//               client. For white-label accounts where the FTA identity must not
//               appear; a warehouse account opts in with config.credential.
//   linkedin  — LinkedIn Marketing API (r_ads r_ads_reporting) for the ads warehouse,
//               minted via /api/connect/admin/fta-linkedin on FTA_LINKEDIN_CLIENT_ID /
//               FTA_LINKEDIN_CLIENT_SECRET, which must belong to the warehouse's OWN
//               LinkedIn developer app. LinkedIn keeps one live grant per member+app, so a
//               sign-in here on linkedin-mcp's app (FTA-LI-MCP, 238010228) revokes the MCP's
//               token and vice versa (the 10/14-16 outages). fta-linkedin refuses to start
//               consent on the MCP's client id.
//   tiktok    — TikTok API for Business (Marketing API) for the ads warehouse, minted
//               via /api/connect/admin/fta-tiktok on FTA_TIKTOK_APP_ID / FTA_TIKTOK_APP_SECRET.
//               TikTok issues a long-lived access token and no refresh token, so the
//               sealed value IS the access token; revoked or lapsed → reconnect.
//   microsoft — Microsoft Advertising, via redirect sign-in on a public Entra app
//               (FTA_MS_CLIENT_ID, no secret). Microsoft rotates the refresh token,
//               so the newest one is written back on every refresh. Austin's gmail:
//               it sees the client accounts, so the ads warehouse reads with it.
//   microsoft_agency — same app, signed in as austin@fattailads.com, whose only
//               Microsoft Ads user lives in FTA's manager customer. Agency link
//               requests use it: the gmail login is a separate Ads user per customer
//               and the API acts as the client-side one, which can't link on FTA's behalf.
//               Optional: without it, agency links use the `google` credential
//               (austin@fattailads.com) with Microsoft's IdentityProvider: Google header.

import { db } from './db.mjs';
import { open, seal } from './crypto.mjs';

export const FTA_GOOGLE_SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/content',
  'https://www.googleapis.com/auth/business.manage',
];
export const FTA_LINKEDIN_SCOPES = ['r_ads', 'r_ads_reporting'];
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const TIKTOK_TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';
export const FTA_MS_SCOPES = ['https://ads.microsoft.com/msads.manage', 'offline_access', 'openid', 'profile', 'email'];
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

const aad = (provider) => `fta-cred:${provider}`;

export async function saveCredential(provider, identity, refreshToken, scopes) {
  const q = await db();
  const sealed = seal({ r: refreshToken }, aad(provider));
  await q`INSERT INTO connect_fta_credentials (provider, identity, sealed_refresh, scopes)
          VALUES (${provider}, ${identity}, ${sealed}, ${scopes || null})
          ON CONFLICT (provider) DO UPDATE SET identity = EXCLUDED.identity, sealed_refresh = EXCLUDED.sealed_refresh,
            scopes = EXCLUDED.scopes, updated_at = now(), last_ok_at = now(), last_error = null`;
}

// Status for the admin panel — never includes token material.
export async function credentialStatus() {
  const q = await db();
  return q`SELECT provider, identity, scopes, created_at, updated_at, last_ok_at, last_error
           FROM connect_fta_credentials ORDER BY provider`;
}

// LinkedIn access tokens live ~60 days, so reuse one per warm instance instead of
// refreshing on every call (Google/Microsoft keep the old refresh-each-call path).
const tokenCache = new Map();

// Returns a fresh access token for the provider, or throws.
export async function accessToken(provider) {
  if (provider === 'tiktok') return staticToken(provider);
  const hit = tokenCache.get(provider);
  if (hit && Date.now() < hit.exp) return hit.token;
  const token = await refreshAccessToken(provider);
  if (provider === 'linkedin') tokenCache.set(provider, { token, exp: Date.now() + 50 * 60 * 1000 });
  return token;
}

async function staticToken(provider) {
  const q = await db();
  const [row] = await q`SELECT sealed_refresh FROM connect_fta_credentials WHERE provider = ${provider}`;
  if (!row) throw Object.assign(new Error(`no ${provider} credential`), { code: 'not_connected' });
  const payload = open(row.sealed_refresh, aad(provider));
  if (!payload || !payload.r) throw Object.assign(new Error(`${provider} credential unreadable`), { code: 'unreadable' });
  return payload.r;
}

async function refreshAccessToken(provider) {
  const q = await db();
  const [row] = await q`SELECT sealed_refresh FROM connect_fta_credentials WHERE provider = ${provider}`;
  if (!row) throw Object.assign(new Error(`no ${provider} credential`), { code: 'not_connected' });
  const payload = open(row.sealed_refresh, aad(provider));
  if (!payload || !payload.r) throw Object.assign(new Error(`${provider} credential unreadable`), { code: 'unreadable' });

  const isGoogle = provider === 'google' || provider === 'google_personal';
  const isLinkedIn = provider === 'linkedin';
  const body = isGoogle
    ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: payload.r, client_id: process.env.FTA_GOOGLE_CLIENT_ID || '', client_secret: process.env.FTA_GOOGLE_CLIENT_SECRET || '' })
    : isLinkedIn
      ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: payload.r, client_id: process.env.FTA_LINKEDIN_CLIENT_ID || '', client_secret: process.env.FTA_LINKEDIN_CLIENT_SECRET || '' })
      : new URLSearchParams({ grant_type: 'refresh_token', refresh_token: payload.r, client_id: msClientId(), scope: FTA_MS_SCOPES.join(' ') });
  const url = isGoogle ? 'https://oauth2.googleapis.com/token' : isLinkedIn ? LINKEDIN_TOKEN_URL : MS_TOKEN_URL;
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const msg = `refresh failed: ${j.error || r.status}${j.error_description ? ` — ${String(j.error_description).slice(0, 160)}` : ''}`;
    await q`UPDATE connect_fta_credentials SET last_error = ${msg} WHERE provider = ${provider}`;
    throw Object.assign(new Error(msg), { code: j.error || 'refresh_failed' });
  }
  if (j.refresh_token && j.refresh_token !== payload.r) {
    await q`UPDATE connect_fta_credentials SET sealed_refresh = ${seal({ r: j.refresh_token }, aad(provider))}, updated_at = now() WHERE provider = ${provider}`;
  }
  await q`UPDATE connect_fta_credentials SET last_ok_at = now(), last_error = null WHERE provider = ${provider}`;
  return j.access_token;
}

export const personalGoogleEmail = () => String(process.env.FTA_GOOGLE_PERSONAL_EMAIL || 'austin.lance.butler@gmail.com').toLowerCase();

export function msClientId() {
  return process.env.FTA_MS_CLIENT_ID || '';
}

export async function msDeviceCode() {
  const r = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: msClientId(), scope: FTA_MS_SCOPES.join(' ') }),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

export async function msPollDeviceCode(deviceCode) {
  const r = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: msClientId(), device_code: deviceCode }),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

// Unverified decode of an id_token we just received directly from the token
// endpoint over TLS — used only to label the stored credential.
export function idTokenClaims(idToken) {
  try { return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}
