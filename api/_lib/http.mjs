// api/_lib/http.mjs — response + cookie helpers shared by the connect functions.

export function sendError(res, status, error, message) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ error, message });
}

export function sendJson(res, body, status = 200) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendError(res, 405, 'method_not_allowed', 'Method not allowed.');
  return false;
}

export function readBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}

// Same-origin check for state-changing POSTs (CSRF defense alongside SameSite cookies).
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients; cookies still gate anything sensitive
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function setCookie(res, name, value, { maxAge, path = '/api/connect' } = {}) {
  const parts = [`${name}=${value}`, `Path=${path}`, 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('Set-Cookie', [...list, parts.join('; ')]);
}

export function clearCookie(res, name, path = '/api/connect') {
  setCookie(res, name, '', { maxAge: 0, path });
}

export function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `https://${req.headers.host}`;
}

export function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
