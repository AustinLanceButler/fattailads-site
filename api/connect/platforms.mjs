// GET /api/connect/platforms — the client-facing platform catalogue for the wizard
// (labels, steps, fields). Receiving identities live server-side in one place.

import { allowMethods, sendJson } from '../_lib/http.mjs';
import { identities, publicCatalogue } from '../_lib/platforms.mjs';

export default function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  return sendJson(res, { platforms: publicCatalogue(), receiving: { google: identities().google } });
}
