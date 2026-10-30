// api/_lib/verify-queue.mjs — which connect items the 15-minute verify cron re-checks.
//
// The cron used to poll every unfinished item forever. A test request whose grant can
// never verify (e.g. a GTM container FTA's own login can't see) then cost ~190 Tag
// Manager calls a day on the quota pool gtm-mcp shares, indefinitely (found 2026-10-30).
// Now:
//   * test requests (is_test) are auto-checked only for TEST_AUTO_VERIFY_HOURS after
//     they were created — long enough to exercise the cron, then they stop;
//   * every request stops being auto-checked AUTO_VERIFY_DAYS after it was created.
// Older items stay on the admin to-do list; "Send link" / re-check in the dashboard
// still works on them by hand.
export const AUTO_VERIFY_DAYS = 14;
export const TEST_AUTO_VERIFY_HOURS = 24;

// Agency links (Google Ads / Microsoft Ads): send queued requests, read back pending ones.
export function agencyQueue(q, batch) {
  return q`SELECT i.id, i.request_id, i.product, i.status, i.client_input, r.company
           FROM connect_items i JOIN connect_requests r ON r.id = i.request_id
           WHERE i.product IN ('google_ads', 'microsoft_ads') AND i.status IN ('requested', 'invite_sent')
             AND r.created_at > now() - make_interval(days => ${AUTO_VERIFY_DAYS}::int)
             AND (NOT r.is_test OR r.created_at > now() - make_interval(hours => ${TEST_AUTO_VERIFY_HOURS}::int))
           ORDER BY i.updated_at ASC LIMIT ${batch}`;
}

// Guided grants (GA4 / GTM / Search Console) still waiting on FTA-side verification.
export function guidedQueue(q, products, batch) {
  return q`SELECT i.id, i.request_id, i.product, i.status, i.asset_id, i.client_input
           FROM connect_items i JOIN connect_requests r ON r.id = i.request_id
           WHERE i.product = ANY(${products}) AND i.status IN ('client_reported', 'invited')
             AND i.fta_status = 'todo'
             AND r.created_at > now() - make_interval(days => ${AUTO_VERIFY_DAYS}::int)
             AND (NOT r.is_test OR r.created_at > now() - make_interval(hours => ${TEST_AUTO_VERIFY_HOURS}::int))
           ORDER BY i.updated_at ASC LIMIT ${batch}`;
}
