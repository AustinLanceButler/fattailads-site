// POST /api/connect/request — start a client access request.
// Body: { name, company, email, products: ['ga4'|'gtm'], test? }
// Returns { requestId }. The id is an unguessable UUID and is the only handle
// the browser gets; nothing else about the request is exposed without it.

import { db, audit } from '../_lib/db.mjs';
import { allowMethods, readBody, sameOrigin, sendError, sendJson } from '../_lib/http.mjs';
import { PRODUCTS } from '../_lib/google.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOURLY_CAP = 30; // crude flood guard until the Vercel WAF rule lands

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!sameOrigin(req)) return sendError(res, 403, 'forbidden', 'Cross-origin requests are not allowed.');

  const b = readBody(req);
  const name = String(b.name || '').trim().slice(0, 120);
  const company = String(b.company || '').trim().slice(0, 160);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const products = Array.isArray(b.products) ? [...new Set(b.products.map(String))].filter((p) => PRODUCTS[p]) : [];
  const isTest = b.test === true;

  if (!name || !company) return sendError(res, 400, 'invalid_input', 'Please enter your name and company.');
  if (!EMAIL_RE.test(email)) return sendError(res, 400, 'invalid_input', 'Please enter a valid work email.');
  if (!products.length) return sendError(res, 400, 'invalid_input', 'Choose at least one product to connect.');

  try {
    const q = await db();
    const [{ n }] = await q`SELECT count(*)::int AS n FROM connect_requests WHERE created_at > now() - interval '1 hour'`;
    if (n >= HOURLY_CAP) return sendError(res, 429, 'rate_limited', 'Too many requests right now — please try again in a little while.');

    const [row] = await q`INSERT INTO connect_requests (client_name, company, email, products, is_test)
                          VALUES (${name}, ${company}, ${email}, ${products}, ${isTest}) RETURNING id`;
    for (const p of products) {
      await q`INSERT INTO connect_items (request_id, product, role) VALUES (${row.id}, ${p}, ${PRODUCTS[p].role})`;
    }
    await audit(row.id, 'request_created', { products, isTest });
    return sendJson(res, { requestId: row.id }, 201);
  } catch (err) {
    console.error('[connect/request]', err);
    return sendError(res, 500, 'server_error', 'Something went wrong — please try again.');
  }
}
