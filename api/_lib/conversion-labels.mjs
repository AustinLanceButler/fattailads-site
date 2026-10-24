// api/_lib/conversion-labels.mjs — guard for the seed's conversion_labels.
//
// A conv:<label> column sums every action tagged with that label. Two live actions
// that track the same event under one label double-count it, and nothing downstream
// notices: the sheet just shows a bigger number. Teguar's Quick Quote is the case
// that prompted this (2026-10-17): the GA4 import "Teguar (web) Get a Quick Quote"
// and the Google Ads tag "GAds - Submit Quick Quote" record the same submissions,
// and the label now points at the tag. Re-applying the original seed (match
// "Get a Quick Quote") would quietly tag the GA4 import again.
//
// applySeed simulates the label updates first and refuses the whole seed if any
// label would end up on more than one live action in an account, unless an entry
// for that label says allow_multiple: true.

// Statuses that never record conversions, so sharing a label with them is harmless.
export const INACTIVE_STATUSES = new Set(['REMOVED', 'HIDDEN']);

// actions: current rows [{ platform, account_id, action_id, name, status, report_label }]
//          for every account the seed touches.
// entries: the seed's label entries in order, each with `matched` = the action_ids
//          its regex hits ([{ platform, account_id, report_label, allow_multiple, matched }]).
// Returns the conflicts the seed would create (or leave in place):
//   [{ platform, account_id, report_label, actions: [{ action_id, name, status }] }]
export function conversionLabelConflicts(actions, entries) {
  const key = (p, a) => `${p}|${a}`;
  const label = new Map(actions.map((r) => [key(r.platform, r.account_id) + '|' + r.action_id, r.report_label ?? null]));
  const allowed = new Set();
  for (const e of entries) {
    const acct = key(e.platform, String(e.account_id));
    for (const id of e.matched || []) {
      const k = `${acct}|${id}`;
      if (label.has(k)) label.set(k, e.report_label ?? null);
    }
    if (e.allow_multiple && e.report_label) allowed.add(`${acct}|${e.report_label}`);
  }
  const groups = new Map();
  for (const r of actions) {
    if (INACTIVE_STATUSES.has(String(r.status || '').toUpperCase())) continue;
    const acct = key(r.platform, r.account_id);
    const l = label.get(`${acct}|${r.action_id}`);
    if (!l) continue;
    const g = `${acct}|${l}`;
    if (!groups.has(g)) groups.set(g, { platform: r.platform, account_id: r.account_id, report_label: l, actions: [] });
    groups.get(g).actions.push({ action_id: r.action_id, name: r.name, status: r.status });
  }
  return [...groups.entries()]
    .filter(([g, v]) => v.actions.length > 1 && !allowed.has(g))
    .map(([, v]) => v);
}
