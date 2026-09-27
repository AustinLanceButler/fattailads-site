// GET /api/connect/admin/requests — recent requests with their items, newest first,
// plus the open FTA-side follow-ups (the pending-invitation reminder list).

import { db } from '../../_lib/db.mjs';
import { allowMethods, sendError, sendJson } from '../../_lib/http.mjs';
import { requireAdmin } from '../../_lib/admin-session.mjs';
import { platform } from '../../_lib/platforms.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const admin = requireAdmin(req, res);
  if (!admin) return;
  try {
    const q = await db();
    const requests = await q`SELECT id, created_at, client_name, company, email, is_test, status, ga4_fired_at
                             FROM connect_requests ORDER BY created_at DESC LIMIT 100`;
    const ids = requests.map((r) => r.id);
    const items = ids.length
      ? await q`SELECT id, request_id, product, status, asset_id, asset_name, client_input, detail,
                       fta_status, fta_note, fta_updated_at, verified_at, updated_at
                FROM connect_items WHERE request_id = ANY(${ids}) ORDER BY id`
      : [];
    const byReq = new Map(requests.map((r) => [r.id, { ...r, items: [] }]));
    for (const i of items) {
      const p = platform(i.product);
      byReq.get(i.request_id).items.push({
        ...i,
        label: p ? p.label : i.product,
        mechanism: p ? p.mechanism : 'oauth',
        ftaAction: i.fta_status === 'todo' && p ? p.ftaAction : '',
      });
    }
    const all = [...byReq.values()];
    const todo = all.flatMap((r) => r.items.filter((i) => i.fta_status === 'todo').map((i) => ({
      ...i, client_name: r.client_name, company: r.company, is_test: r.is_test,
    }))).sort((a, b) => new Date(a.fta_updated_at) - new Date(b.fta_updated_at));
    return sendJson(res, { admin, requests: all, todo });
  } catch (err) {
    console.error('[connect/admin/requests]', err);
    return sendError(res, 500, 'server_error', 'Could not load requests.');
  }
}
