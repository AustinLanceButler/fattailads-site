// api/_lib/crypto.mjs
// Small crypto helpers for the connect flow. Files under api/_lib are not
// deployed as functions (Vercel skips underscore-prefixed paths).
//
// CONNECT_ENC_KEY — 32 random bytes, base64. Encrypts the short-lived Google
// access token we hold in an HttpOnly cookie between the OAuth callback and
// the grant call.

import crypto from 'node:crypto';

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Base64Url(input) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function encKey() {
  const raw = process.env.CONNECT_ENC_KEY || '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('CONNECT_ENC_KEY must be 32 bytes, base64-encoded');
  return key;
}

// AES-256-GCM. `aad` binds the ciphertext to its context (e.g. request+product),
// so a cookie minted for one request can't be replayed against another.
export function seal(obj, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
}

export function open(token, aad) {
  try {
    const buf = Buffer.from(String(token || ''), 'base64url');
    if (buf.length < 29) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), buf.subarray(0, 12));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(buf.subarray(12, 28));
    const pt = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(pt.toString('utf8'));
  } catch {
    return null;
  }
}
