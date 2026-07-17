// api/leadsie-webhook.mjs
// Receives Leadsie client-connection webhooks and, on a successful grant,
// forwards a `connect_completed` conversion to GA4 via the Measurement Protocol.
//
// Why a server function: the access grant happens on Leadsie/Google/Meta — not in
// the browser — so there is no gtag/dataLayer to fire. GA4's Measurement Protocol
// lets the server post the event directly.
//
// Auth: Leadsie does not publish a webhook-signing scheme, so we use a shared
// secret we fully control. Register the webhook in Leadsie with the token in the
// URL (…/api/leadsie-webhook?token=SECRET); the handler also accepts the secret in
// an `x-leadsie-token` or `Authorization: Bearer …` header.
//
// Required env vars (set in Vercel → project → Settings → Environment Variables):
//   LEADSIE_WEBHOOK_SECRET  — shared secret; must match the token used in Leadsie.
//   GA4_MEASUREMENT_ID      — the web stream's Measurement ID (G-XXXXXXXXXX).
//   GA4_API_SECRET          — GA4 Admin → Data Streams → Measurement Protocol API secrets.

import crypto from 'node:crypto';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export default async function handler(req, res) {
  // Health check — lets us verify the endpoint is live with no side effects.
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'leadsie-webhook' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // ── Authenticate via shared secret ──
  const expected = process.env.LEADSIE_WEBHOOK_SECRET || '';
  const authHeader = req.headers['authorization'] || '';
  const provided =
    (req.query && req.query.token) ||
    req.headers['x-leadsie-token'] ||
    authHeader.replace(/^Bearer\s+/i, '');
  if (!expected || !provided || !safeEqual(String(provided), String(expected))) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  // ── Parse the Leadsie payload (handles v1 and v2) ──
  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  payload = payload || {};

  const status = String(payload.status || '').toUpperCase();
  const isSuccess = status === 'SUCCESS';
  const assets = Array.isArray(payload.connectionAssets) ? payload.connectionAssets : [];
  const assetsConnected = assets.filter((a) =>
    a && (a.isSuccess === true || String(a.connectionStatus || '').toLowerCase() === 'connected')
  ).length;

  // Leadsie fires on every connection attempt (success or not). Only count a
  // successful grant as the conversion.
  if (!isSuccess) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'status_not_success', status });
  }

  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    // Accept (so Leadsie doesn't retry-storm) but flag loudly for setup.
    console.error('[leadsie-webhook] GA4 not configured: set GA4_MEASUREMENT_ID and GA4_API_SECRET');
    return res.status(200).json({ ok: true, forwarded: false, reason: 'ga4_not_configured' });
  }

  // Deterministic pseudo client_id so repeat events for one client group together.
  const seed = String(payload.clientName || payload.requestName || payload.user || 'leadsie');
  const clientId = ga4ClientId(seed);

  const gaBody = {
    client_id: clientId,
    non_personalized_ads: true,
    events: [{
      name: 'connect_completed',
      params: {
        source: 'leadsie',
        client_name: String(payload.clientName || '').slice(0, 100),
        request_name: String(payload.requestName || '').slice(0, 100),
        access_level: String(payload.accessLevel || '').slice(0, 100),
        assets_connected: assetsConnected,
        engagement_time_msec: 1
      }
    }]
  };

  try {
    const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const gaRes = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(gaBody)
    });
    // GA4 MP returns 204 No Content on accept.
    return res.status(200).json({ ok: true, forwarded: true, ga_status: gaRes.status, assets_connected: assetsConnected });
  } catch (err) {
    console.error('[leadsie-webhook] GA4 forward failed:', err);
    return res.status(200).json({ ok: true, forwarded: false, error: 'ga4_request_failed' });
  }
}

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function ga4ClientId(seed) {
  const h = crypto.createHash('sha256').update(seed).digest('hex');
  const a = parseInt(h.slice(0, 8), 16);
  const b = parseInt(h.slice(8, 16), 16);
  return `${a}.${b}`; // GA4 client_id convention: two dot-separated numbers.
}
