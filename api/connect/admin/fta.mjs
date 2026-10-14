// GET  /api/connect/admin/fta — FTA credential status (no token material).
// POST /api/connect/admin/fta { provider } — refresh the token now to prove it works.

import { allowMethods, readBody, sendError, sendJson } from '../../_lib/http.mjs';
import { requireAdmin } from '../../_lib/admin-session.mjs';
import { accessToken, credentialStatus, msClientId } from '../../_lib/fta-credentials.mjs';
import { probeTikTok } from '../../_lib/ingest/tiktok.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  const admin = requireAdmin(req, res, { mutation: req.method === 'POST' });
  if (!admin) return;
  try {
    if (req.method === 'POST') {
      const provider = String(readBody(req).provider || '');
      if (!['google', 'google_personal', 'microsoft', 'microsoft_agency', 'linkedin', 'tiktok'].includes(provider)) return sendError(res, 400, 'invalid_input', 'Unknown provider.');
      try {
        // TikTok's token never refreshes, so prove it with a real call instead.
        if (provider === 'tiktok') await probeTikTok(); else await accessToken(provider);
      } catch (err) {
        return sendJson(res, { ok: false, error: err.message });
      }
      return sendJson(res, { ok: true });
    }
    return sendJson(res, {
      credentials: await credentialStatus(),
      configured: {
        google: !!(process.env.FTA_GOOGLE_CLIENT_ID && process.env.FTA_GOOGLE_CLIENT_SECRET),
        google_personal: !!(process.env.FTA_GOOGLE_CLIENT_ID && process.env.FTA_GOOGLE_CLIENT_SECRET),
        microsoft: !!msClientId(),
        microsoft_agency: !!msClientId(),
        linkedin: !!(process.env.FTA_LINKEDIN_CLIENT_ID && process.env.FTA_LINKEDIN_CLIENT_SECRET),
        tiktok: !!(process.env.FTA_TIKTOK_APP_ID && process.env.FTA_TIKTOK_APP_SECRET),
      },
    });
  } catch (err) {
    console.error('[connect/admin/fta]', err.message);
    return sendError(res, 500, 'server_error', 'Could not load FTA credentials.');
  }
}
