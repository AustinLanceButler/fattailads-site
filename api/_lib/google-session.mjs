// api/_lib/google-session.mjs — the two short-lived cookies of the Google flow.
//   fta_gstate — raw OAuth state (10 min); binds the callback to the browser that started it.
//   fta_gtok   — the client's access token, AES-GCM sealed and bound to request+product (≤15 min).
// Both are HttpOnly, Secure, SameSite=Lax, scoped to /api/connect/google.

import { open } from './crypto.mjs';

export const COOKIE_PATH = '/api/connect/google';
export const STATE_COOKIE = 'fta_gstate';
export const TOKEN_COOKIE = 'fta_gtok';

export function tokenAad(requestId, product) {
  return `${requestId}:${product}`;
}

export function readToken(req, requestId, product) {
  const payload = open(req.cookies && req.cookies[TOKEN_COOKIE], tokenAad(requestId, product));
  if (!payload || !payload.t || Date.now() > payload.exp) return null;
  return payload.t;
}
