// api/_lib/agency-sync.mjs — moves one agency item forward: send the link if it
// hasn't gone out yet, otherwise read the link back. Shared by client submit,
// the admin "Send link" button and the verify cron. Never throws.

import { audit } from './db.mjs';
import { agencyLinkStatus, sendAgencyLink } from './agency-links.mjs';

export async function syncAgencyItem(q, item, { clientName = '', actor = 'system' } = {}) {
  const input = item.client_input || {};
  let result;
  try {
    result = item.status === 'requested'
      ? await sendAgencyLink(item.product, input, clientName)
      : await agencyLinkStatus(item.product, input);
  } catch (err) {
    // Missing FTA credential or config: leave the item as-is for a later run.
    await audit(item.request_id, 'agency_sync_skipped', { product: item.product, actor, reason: err.code || err.message });
    return { status: item.status, skipped: err.code || 'error' };
  }

  if (result.status === 'verified') {
    await q`UPDATE connect_items SET status = 'verified', verified_at = now(), detail = null,
              fta_status = 'done', fta_note = 'Link active (auto-verified).', fta_updated_at = now(), updated_at = now()
            WHERE id = ${item.id}`;
  } else if (result.status === 'invite_sent' || (result.status === 'pending' && item.status !== 'invite_sent')) {
    await q`UPDATE connect_items SET status = 'invite_sent', fta_status = 'todo', fta_note = ${result.detail || null},
              fta_updated_at = now(), updated_at = now()
            WHERE id = ${item.id}`;
  } else if (result.status === 'failed') {
    await q`UPDATE connect_items SET status = 'failed', detail = ${result.detail}, fta_status = 'todo',
              fta_note = ${result.detail}, fta_updated_at = now(), updated_at = now()
            WHERE id = ${item.id}`;
  } else {
    await q`UPDATE connect_items SET updated_at = now() WHERE id = ${item.id}`;
  }
  await audit(item.request_id, 'agency_sync', { product: item.product, actor, from: item.status, result: result.status, detail: result.detail });
  return { status: result.status, detail: result.detail };
}
