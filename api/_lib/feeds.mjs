// api/_lib/feeds.mjs — push warehouse views into the pacing sheets' data tabs.
//
// A sheet_feeds row says: which spreadsheet/tab, which accounts, which columns (in
// order), the date window, and which Funnel-archive sources to union in (Teguar's
// LinkedIn rows until a LinkedIn job exists). The current ET day is never written,
// so a partial day can't poison MAX(date)-anchored formulas.
//
// Column spec (from ads.v_feed_daily unless noted):
//   date, campaign, campaign_id, account_id, data_source, data_source_name, cost,
//   clicks, impressions, all_conv, conversions, conversions_value, store_visits,
//   search_is, daily_budget, daily_budget_text, budget_id, budget_name, budget_status,
//   budget_association_status, campaign_status, paid_organic, conv_total,
//   conv:<label>   → conv_by_label->>'<label>' (per-conversion-action column)
//   blank          → empty cell
// window_rule 'budgets_current' switches the source to ads.v_budget_pools_current
// (columns: as_of, budget_key, name, is_shared, amount, live_campaigns).
// source 'media_daily' reads ads.v_media_daily instead, one row per date × channel ×
// market × tactic (columns: date, platform, account_id, channel, market, tactic,
// spend, impressions, clicks, conversions, store_visits) — for dashboards.

import { exec, listFeeds } from './warehouse.mjs';
import { todayIn, windowStart, sheetSerial, addDays, ymd, ET } from './dates.mjs';
import { writeTab, saConfigured } from './sheets.mjs';
import { raiseAlert, clearAlert } from './alerts.mjs';

const ARCHIVE_MAP = {
  date: 'date', campaign: 'campaign', campaign_id: 'campaign_id', account_id: 'account_id', data_source: 'data_source',
  data_source_name: 'data_source_name', cost: 'cost', clicks: 'clicks', impressions: 'impressions', all_conv: 'all_conv',
  store_visits: 'store_visits', search_is: 'search_is', daily_budget: 'daily_budget', daily_budget_text: 'budget_text',
};

function accountFilter(accounts) {
  // accounts: [{platform, account_id}, ...] → SQL predicate + params
  const parts = [];
  const params = [];
  for (const a of accounts) {
    params.push(a.platform, String(a.account_id));
    parts.push(`(platform = $${params.length - 1} and account_id = $${params.length})`);
  }
  return { where: parts.length ? `(${parts.join(' or ')})` : 'false', params };
}

export async function queryFeedRows(q, feed, today) {
  const accounts = Array.isArray(feed.accounts) ? feed.accounts : JSON.parse(feed.accounts || '[]');
  const { where, params } = accountFilter(accounts);
  if (feed.window_rule === 'budgets_current') {
    const rows = await exec(q, `select * from ads.v_budget_pools_current where ${where} order by is_shared desc, name`, params);
    for (const r of rows) r.as_of = ymd(r.as_of);
    return { rows, from: null };
  }
  const from = windowStart(feed.window_rule, today);
  const p = [...params, from, today];
  if (feed.source === 'media_daily') {
    const rows = await exec(q, `select * from ads.v_media_daily where ${where} and date >= $${p.length - 1}::date and date < $${p.length}::date order by date, platform, channel, market, tactic`, p);
    for (const r of rows) r.date = ymd(r.date);
    return { rows, from };
  }
  const rows = await exec(q, `select * from ads.v_feed_daily where ${where} and date >= $${p.length - 1}::date and date < $${p.length}::date order by date, campaign, campaign_id`, p);
  const archive = (feed.archive_sources || []).filter(Boolean);
  if (archive.length) {
    const likes = archive.map((s, i) => `data_source like $${i + 1} || ':%'`).join(' or ');
    const arows = await exec(q, `select * from ads.funnel_archive where (${likes}) and date >= $${archive.length + 1}::date and date < $${archive.length + 2}::date order by date, campaign`, [...archive, from, today]);
    for (const r of arows) rows.push(Object.fromEntries(Object.entries(ARCHIVE_MAP).map(([k, v]) => [k, r[v]])));
  }
  for (const r of rows) r.date = ymd(r.date);
  if (archive.length) rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.campaign).localeCompare(String(b.campaign))));
  return { rows, from };
}

const DATE_COLS = new Set(['date', 'as_of']);

export function projectRow(row, columns) {
  return columns.map((c) => {
    if (c === 'blank') return '';
    if (c === 'conv_total') return numOrBlank(row.labeled_conv_total);
    if (c.startsWith('conv:')) {
      const label = c.slice(5);
      const v = row.conv_by_label && row.conv_by_label[label];
      return v === undefined || v === null ? '' : Number(v);
    }
    const v = row[c];
    if (v === undefined || v === null) return '';
    if (DATE_COLS.has(c)) return sheetSerial(ymd(v));
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !['campaign_id', 'account_id', 'budget_id', 'budget_key', 'data_source', 'campaign'].includes(c)) return Number(v);
    return v;
  });
}

const numOrBlank = (v) => (v === undefined || v === null ? '' : Number(v));

export async function pushFeed(q, feed, { today = todayIn(ET), dryRun = false } = {}) {
  const columns = feed.columns;
  const { rows, from } = await queryFeedRows(q, feed, today);
  const values = rows.map((r) => projectRow(r, columns));
  const dates = rows.map((r) => ymd(r.date || r.as_of)).filter(Boolean);
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  const key = `feed:${feed.spreadsheet_id}:${feed.tab}`;
  const problems = [];
  if (values.length < (feed.min_rows ?? 50)) problems.push(`only ${values.length} rows (min ${feed.min_rows})`);
  if (feed.window_rule !== 'budgets_current' && (!maxDate || maxDate < addDays(today, -2))) problems.push(`latest complete date ${maxDate || 'none'} is older than ${addDays(today, -2)}`);
  if (problems.length) {
    const msg = `Sheet feed ${feed.tab} not written: ${problems.join('; ')}`;
    await exec(q, 'update ads.sheet_feeds set last_error = $2 where feed_id = $1', [feed.feed_id, msg]);
    if (!dryRun) await raiseAlert(q, { job: 'push-sheets', dedupe_key: key, message: msg, detail: { feed_id: feed.feed_id, rows: values.length, maxDate } });
    return { feed_id: feed.feed_id, tab: feed.tab, status: 'refused', rows: values.length, maxDate, problems };
  }
  if (dryRun) return { feed_id: feed.feed_id, tab: feed.tab, status: 'dry_run', rows: values.length, from, maxDate, sample: values.slice(0, 3) };

  const dateColumns = (feed.date_columns && feed.date_columns.length) ? feed.date_columns : columns.map((c, i) => (DATE_COLS.has(c) ? i + 1 : null)).filter(Boolean);
  await writeTab(feed.spreadsheet_id, feed.tab, { header: feed.header && feed.header.length ? feed.header : null, rows: values, dateColumns });
  await exec(q, 'update ads.sheet_feeds set last_pushed_at = now(), last_rows = $2, last_max_date = $3, last_error = null where feed_id = $1', [feed.feed_id, values.length, maxDate]);
  await clearAlert(q, key);
  return { feed_id: feed.feed_id, tab: feed.tab, status: 'ok', rows: values.length, from, maxDate };
}

// Write a `_Feed Status` tab per spreadsheet so staleness is visible in the sheet.
export async function writeStatusTabs(q, feeds, today) {
  const bySheet = new Map();
  for (const f of feeds) { if (!bySheet.has(f.spreadsheet_id)) bySheet.set(f.spreadsheet_id, []); bySheet.get(f.spreadsheet_id).push(f); }
  const out = [];
  for (const [spreadsheetId, fs] of bySheet) {
    const rows = await exec(q, `select tab, last_rows, last_max_date, last_pushed_at, last_error, enabled from ads.sheet_feeds where spreadsheet_id = $1 order by tab`, [spreadsheetId]);
    const values = rows.map((r) => [r.tab, r.last_rows ?? '', r.last_max_date ? sheetSerial(ymd(r.last_max_date)) : '',
      r.last_pushed_at ? new Date(r.last_pushed_at).toLocaleString('en-US', { timeZone: ET }) + ' ET' : '', r.last_error || '', r.enabled ? 'on' : 'off']);
    values.push([`Data through (max complete date across feeds)`, '', sheetSerial(rows.map((r) => ymd(r.last_max_date)).filter(Boolean).sort().pop() || today), '', '', '']);
    try {
      await writeTab(spreadsheetId, '_Feed Status', { header: ['Tab', 'Rows', 'Max date', 'Pushed at', 'Last error', 'Enabled'], rows: values, dateColumns: [3] });
      out.push({ spreadsheetId, status: 'ok' });
    } catch (err) {
      out.push({ spreadsheetId, status: 'error', error: err.message });
    }
  }
  return out;
}

export async function pushAllFeeds(q, { feed_id = null, dryRun = false, today = todayIn(ET) } = {}) {
  if (!saConfigured() && !dryRun) throw Object.assign(new Error('GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY are not set'), { code: 'not_configured' });
  const feeds = await listFeeds(q, { feed_id });
  const results = [];
  for (const f of feeds) {
    try {
      results.push(await pushFeed(q, f, { today, dryRun }));
    } catch (err) {
      console.error(`[push-sheets] ${f.tab}:`, err.message);
      await exec(q, 'update ads.sheet_feeds set last_error = $2 where feed_id = $1', [f.feed_id, err.message.slice(0, 1000)]);
      if (!dryRun) await raiseAlert(q, { job: 'push-sheets', dedupe_key: `feed:${f.spreadsheet_id}:${f.tab}`, message: `Sheet feed ${f.tab} failed: ${err.message}`, detail: { feed_id: f.feed_id } });
      results.push({ feed_id: f.feed_id, tab: f.tab, status: 'error', error: err.message.slice(0, 500) });
    }
  }
  const status = dryRun ? [] : await writeStatusTabs(q, feeds, today);
  return { results, status };
}
