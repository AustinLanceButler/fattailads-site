// POST /api/connect/admin/item  { id, action, note? }
//   done    — FTA finished its follow-up; the item is verified.
//   sent    — agency link request sent; waiting for the client to accept (still todo).
//   failed  — the grant didn't happen; `note` is shown to the client as the reason.
//   reopen  — put the follow-up back on the list.

import { db, audit } from '../../_lib/db.mjs';
import { allowMethods, readBody, sendError, sendJson } from '../../_lib/http.mjs';
import { requireAdmin } from '../../_lib/admin-session.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const admin = requireAdmin(req, res, { mutation: true });
  if (!admin) return;

  const b = readBody(req);
  const id = String(b.id || '');
  const action = String(b.action || '');
  const note = String(b.note || '').trim().slice(0, 500) || null;
  if (!/^\d+$/.test(id) || !['done', 'sent', 'failed', 'reopen'].includes(action)) {
    return sendError(res, 400, 'invalid_input', 'Unknown item or action.');
  }

  try {
    const q = await db();
    let row;
    if (action === 'done') {
      [row] = await q`UPDATE connect_items SET status = 'verified', verified_at = coalesce(verified_at, now()),
                        fta_status = 'done', fta_note = coalesce(${note}, fta_note), fta_updated_at = now(), updated_at = now()
                      WHERE id = ${id} RETURNING request_id, product, status, fta_status`;
    } else if (action === 'sent') {
      [row] = await q`UPDATE connect_items SET status = 'invite_sent', fta_status = 'todo',
                        fta_note = coalesce(${note}, 'Link request sent — waiting for the client to accept.'),
                        fta_updated_at = now(), updated_at = now()
                      WHERE id = ${id} RETURNING request_id, product, status, fta_status`;
    } else if (action === 'failed') {
      [row] = await q`UPDATE connect_items SET status = 'failed', detail = ${note}, verified_at = null,
                        fta_status = 'done', fta_note = ${note}, fta_updated_at = now(), updated_at = now()
                      WHERE id = ${id} RETURNING request_id, product, status, fta_status`;
    } else {
      [row] = await q`UPDATE connect_items SET fta_status = 'todo', fta_updated_at = now(), updated_at = now()
                      WHERE id = ${id} RETURNING request_id, product, status, fta_status`;
    }
    if (!row) return sendError(res, 404, 'not_found', 'Unknown item.');
    await audit(row.request_id, `admin_item_${action}`, { admin, itemId: id, product: row.product, note });
    return sendJson(res, { ok: true, status: row.status, ftaStatus: row.fta_status });
  } catch (err) {
    console.error('[connect/admin/item]', err);
    return sendError(res, 500, 'server_error', 'Could not update the item.');
  }
}
