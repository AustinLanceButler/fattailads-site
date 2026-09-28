// api/_lib/fta-credentials.mjs — FTA's own OAuth credentials, used by the verify
// cron and agency-side link requests. Only Austin's identities are stored here;
// client tokens never are.
//
//   google    — austin@fattailads.com, minted through a web OAuth client in the ops
//               Cloud project (FTA_GOOGLE_CLIENT_ID / FTA_GOOGLE_CLIENT_SECRET).
//   microsoft — Microsoft Advertising, via device-code sign-in on a public Entra app
//               (FTA_MS_CLIENT_ID, no secret). Microsoft rotates the refresh token,
//               so the newest one is written back on every refresh.

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

// Returns a fresh access token for the provider, or throws.
export async function accessToken(provider) {
  const q = await db();
  const [row] = await q`SELECT sealed_refresh FROM connect_fta_credentials WHERE provider = ${provider}`;
  if (!row) throw Object.assign(new Error(`no ${provider} credential`), { code: 'not_connected' });
  const payload = open(row.sealed_refresh, aad(provider));
  if (!payload || !payload.r) throw Object.assign(new Error(`${provider} credential unreadable`), { code: 'unreadable' });

  const body = provider === 'google'
    ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: payload.r, client_id: process.env.FTA_GOOGLE_CLIENT_ID || '', client_secret: process.env.FTA_GOOGLE_CLIENT_SECRET || '' })
    : new URLSearchParams({ grant_type: 'refresh_token', refresh_token: payload.r, client_id: msClientId(), scope: FTA_MS_SCOPES.join(' ') });
  const url = provider === 'google' ? 'https://oauth2.googleapis.com/token' : MS_TOKEN_URL;
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
