// api/_lib/health.mjs — is every account fresh and every sheet feed pushed?
// Raises one deduplicated alert per stale thing, clears it when healthy again.
//
// Account freshness is judged on ingest coverage, not on rows: an account that
// doesn't serve on weekends (Teguar) has no Saturday rows even though every run
// succeeded. Rows only feed an informational "no spend for N days" notice.

import { exec } from './warehouse.mjs';
import { todayIn, addDays, ymd, ET } from './dates.mjs';
import { raiseAlert, clearAlert } from './alerts.mjs';

const HOURS = 3600 * 1000;
export const NO_SPEND_NOTICE_DAYS = 4; // > a weekend plus a Monday holiday

export function defaultTimezone(platform) {
  return platform === 'microsoft' ? 'America/Chicago' : ET;
}

// A run leaves `day` complete (is_complete = date < run's today) when it succeeded,
// its window includes `day`, and it started after `day` ended in the account's zone.
export function runCoversDay(run, day, tz) {
  if (!run || run.status !== 'ok') return false;
  const from = ymd(run.window_from);
  const to = ymd(run.window_to);
  if (!from || !to || from > day || to < day) return false;
  return todayIn(tz, new Date(run.started_at)) > day;
}

// Pure verdict for one account. `runs` are its recent ingest_runs rows.
export function assessAccount({ platform, timezone, runs = [], lastCompleteDate, lastOkAt, lastError, now = Date.now(), maxAgeHours = 26 }) {
  const tz = timezone || defaultTimezone(platform);
  const yesterday = addDays(todayIn(tz, new Date(now)), -1);
  const problems = [];
  const notices = [];
  if (!runs.some((r) => runCoversDay(r, yesterday, tz))) problems.push(`no successful ingest covering ${yesterday}`);
  if (!lastOkAt || now - new Date(lastOkAt).getTime() > maxAgeHours * HOURS) problems.push(`no successful run in ${maxAgeHours}h${lastError ? ` (last error: ${lastError.slice(0, 200)})` : ''}`);
  const lastComplete = ymd(lastCompleteDate);
  if (!lastComplete || lastComplete < addDays(yesterday, -(NO_SPEND_NOTICE_DAYS - 1))) notices.push(`no rows since ${lastComplete || 'ever'} (≥ ${NO_SPEND_NOTICE_DAYS} days without spend)`);
  return { yesterday, ok: !problems.length, problems, notices };
}

export async function checkHealth(q, { maxAgeHours = 26, notify = true } = {}) {
  const now = Date.now();
  const accounts = await exec(q, `select h.*, a.timezone from ads.v_feed_health h
    join ads.ad_accounts a using (platform, account_id) where h.enabled order by h.client_id, h.platform, h.account_id`);
  const recent = await exec(q, `select platform, account_id, status, window_from, window_to, started_at from ads.ingest_runs
    where status = 'ok' and account_id is not null and started_at > now() - interval '3 days'`);
  const runsBy = new Map();
  for (const r of recent) {
    const k = `${r.platform}:${r.account_id}`;
    if (!runsBy.has(k)) runsBy.set(k, []);
    runsBy.get(k).push(r);
  }
  const out = { accounts: [], feeds: [], alerts: 0 };
  for (const a of accounts) {
    const lastComplete = ymd(a.last_complete_date);
    const { ok, problems, notices } = assessAccount({
      platform: a.platform, timezone: a.timezone, runs: runsBy.get(`${a.platform}:${a.account_id}`) || [],
      lastCompleteDate: lastComplete, lastOkAt: a.last_ok_at, lastError: a.last_error, now, maxAgeHours,
    });
    const key = `account:${a.platform}:${a.account_id}`;
    if (!ok) {
      out.alerts++;
      if (notify) await raiseAlert(q, { job: 'feed-health', dedupe_key: key, message: `${a.label} (${a.platform} ${a.account_id}) stale: ${problems.join('; ')}`, detail: { last_complete_date: lastComplete, last_ok_at: a.last_ok_at } });
    } else if (notify) await clearAlert(q, key);
    out.accounts.push({ platform: a.platform, account_id: a.account_id, label: a.label, last_complete_date: lastComplete, last_ok_at: a.last_ok_at, ok, problems, notices });
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
