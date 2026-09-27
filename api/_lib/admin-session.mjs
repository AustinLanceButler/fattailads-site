// api/_lib/admin-session.mjs — the /connect/admin session.
// Sign-in is Google (openid email) through the same OAuth client as the wizard;
// the callback checks the verified email against CONNECT_ADMIN_EMAILS and sets
// an AES-GCM sealed, HttpOnly cookie (8 h). Lax (not Strict) because it's set on
// the redirect back from Google; every admin mutation also checks Origin.

import { open, seal } from './crypto.mjs';
import { sendError, setCookie, clearCookie, sameOrigin } from './http.mjs';

export const ADMIN_COOKIE = 'fta_admin';
export const ADMIN_COOKIE_PATH = '/api/connect/admin';
const AAD = 'fta-connect-admin';
const TTL_S = 8 * 3600;

export function adminEmails() {
  return (process.env.CONNECT_ADMIN_EMAILS || 'austin@fattailads.com,austin.lance.butler@gmail.com')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function startAdminSession(res, email) {
  setCookie(res, ADMIN_COOKIE, seal({ e: email, exp: Date.now() + TTL_S * 1000 }, AAD), { maxAge: TTL_S, path: ADMIN_COOKIE_PATH });
}

export function endAdminSession(res) {
  clearCookie(res, ADMIN_COOKIE, ADMIN_COOKIE_PATH);
}

// Returns the admin email, or sends 401/403 and returns ''.
export function requireAdmin(req, res, { mutation = false } = {}) {
  if (mutation && !sameOrigin(req)) { sendError(res, 403, 'forbidden', 'Cross-origin requests are not allowed.'); return ''; }
  const s = open(req.cookies && req.cookies[ADMIN_COOKIE], AAD);
  if (!s || !s.e || Date.now() > s.exp || !adminEmails().includes(s.e)) {
    sendError(res, 401, 'signed_out', 'Sign in to continue.');
    return '';
  }
  return s.e;
}
