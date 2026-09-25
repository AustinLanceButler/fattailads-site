// api/_lib/ga4.mjs — server-side GA4 Measurement Protocol, same event shape as
// api/leadsie-webhook.mjs so `connect_completed` reporting stays continuous.
// Env: GA4_MEASUREMENT_ID, GA4_API_SECRET.

import crypto from 'node:crypto';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export function ga4ClientId(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest('hex');
  return `${parseInt(h.slice(0, 8), 16)}.${parseInt(h.slice(8, 16), 16)}`;
}

export async function sendConnectCompleted({ clientName, requestName, accessLevel, assetsConnected }) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    console.error('[connect] GA4 not configured: set GA4_MEASUREMENT_ID and GA4_API_SECRET');
    return { forwarded: false, reason: 'ga4_not_configured' };
  }
  const body = {
    client_id: ga4ClientId(clientName || requestName || 'fta_connect'),
    non_personalized_ads: true,
    events: [{
      name: 'connect_completed',
      params: {
        source: 'fta_connect',
        client_name: String(clientName || '').slice(0, 100),
        request_name: String(requestName || '').slice(0, 100),
        access_level: String(accessLevel || '').slice(0, 100),
        assets_connected: assetsConnected,
        engagement_time_msec: 1,
      },
    }],
  };
  const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { forwarded: true, status: r.status };
}
