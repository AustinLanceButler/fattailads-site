// api/_lib/health.mjs — is every account fresh and every sheet feed pushed?
// Raises one deduplicated alert per stale thing, clears it when healthy again.

import { exec } from './warehouse.mjs';
import { todayIn, addDays, ymd, ET } from './dates.mjs';
import { raiseAlert, clearAlert } from './alerts.mjs';

const HOURS = 3600 * 1000;

export async function checkHealth(q, { maxAgeHours = 26, notify = true } = {}) {
  const now = Date.now();
  const accounts = await exec(q, 'select * from ads.v_feed_health where enabled order by client_id, platform, account_id');
  const out = { accounts: [], feeds: [], alerts: 0 };
  for (const a of accounts) {
    const yesterday = addDays(todayIn(a.platform === 'microsoft' ? 'America/Chicago' : ET), -1);
    const problems = [];
    const lastComplete = ymd(a.last_complete_date);
    if (!lastComplete || lastComplete < yesterday) problems.push(`last complete day ${lastComplete || 'none'} (expected ≥ ${yesterday})`);
    if (!a.last_ok_at || now - new Date(a.last_ok_at).getTime() > maxAgeHours * HOURS) problems.push(`no successful run in ${maxAgeHours}h${a.last_error ? ` (last error: ${a.last_error.slice(0, 200)})` : ''}`);
    const key = `account:${a.platform}:${a.account_id}`;
    if (problems.length) {
      out.alerts++;
      if (notify) await raiseAlert(q, { job: 'feed-health', dedupe_key: key, message: `${a.label} (${a.platform} ${a.account_id}) stale: ${problems.join('; ')}`, detail: { last_complete_date: lastComplete, last_ok_at: a.last_ok_at } });
    } else if (notify) await clearAlert(q, key);
    out.accounts.push({ platform: a.platform, account_id: a.account_id, label: a.label, last_complete_date: lastComplete, last_ok_at: a.last_ok_at, ok: !problems.length, problems });
  }
  const feeds = await exec(q, 'select * from ads.sheet_feeds where enabled order by feed_id');
  const today = todayIn(ET);
  for (const f of feeds) {
    const problems = [];
    if (!f.last_pushed_at || now - new Date(f.last_pushed_at).getTime() > maxAgeHours * HOURS) problems.push(`not pushed in ${maxAgeHours}h`);
    if (f.window_rule !== 'budgets_current') {
      const md = ymd(f.last_max_date);
      if (!md || md < addDays(today, -2)) problems.push(`max date ${md || 'none'} older than ${addDays(today, -2)}`);
    }
    if (f.last_error) problems.push(`last error: ${f.last_error.slice(0, 200)}`);
    const key = `feed:${f.spreadsheet_id}:${f.tab}`;
    if (problems.length) {
      out.alerts++;
      if (notify) await raiseAlert(q, { job: 'feed-health', dedupe_key: key, message: `Sheet feed ${f.tab} stale: ${problems.join('; ')}`, detail: { feed_id: f.feed_id } });
    } else if (notify) await clearAlert(q, key);
    out.feeds.push({ feed_id: f.feed_id, tab: f.tab, last_pushed_at: f.last_pushed_at, last_max_date: f.last_max_date, ok: !problems.length, problems });
  }
  return out;
}
