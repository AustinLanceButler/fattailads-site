// api/_lib/completion.mjs — fires `connect_completed` to GA4 once per request,
// the first time every item reaches a client-done state (same rule as Leadsie's
// SUCCESS webhook: the client has finished their part). Test requests are
// marked complete but never sent to GA4.

import { audit } from './db.mjs';
import { sendConnectCompleted } from './ga4.mjs';
import { CLIENT_DONE } from './platforms.mjs';

export async function maybeFireCompleted(q, requestId) {
  const pending = await q`SELECT 1 FROM connect_items WHERE request_id = ${requestId}
                          AND NOT (status = ANY(${CLIENT_DONE})) LIMIT 1`;
  if (pending.length) return;
  // Claim the send atomically so concurrent updates can't double-fire.
  const [r] = await q`UPDATE connect_requests SET status = 'complete', ga4_fired_at = now()
                      WHERE id = ${requestId} AND ga4_fired_at IS NULL
                      RETURNING client_name, company, is_test`;
  if (!r) return;
  const [{ n }] = await q`SELECT count(*)::int AS n FROM connect_items WHERE request_id = ${requestId}`;
  if (r.is_test) {
    await audit(requestId, 'completed_test_no_ga4', { assets: n });
    return;
  }
  try {
    const out = await sendConnectCompleted({ clientName: r.client_name, requestName: r.company, accessLevel: 'manage', assetsConnected: n });
    await audit(requestId, 'ga4_connect_completed', out);
  } catch (err) {
    console.error('[connect] GA4 forward failed:', err.message);
    await audit(requestId, 'ga4_connect_completed_failed', { message: err.message });
  }
}
