// api/_lib/ingest/tiktok.mjs — TikTok API for Business (Marketing API v1.3) → ads.*
// Campaign- and ad-group-level daily BASIC reports plus the campaign / ad-group lists
// and budgets. Token: FTA's own TikTok for Business sign-in (provider 'tiktok' in
// connect_fta_credentials, minted via /api/connect/admin/fta-tiktok on
// FTA_TIKTOK_APP_ID / FTA_TIKTOK_APP_SECRET). Read-only: every call here is a GET.
// Reports are in the advertiser's own timezone and currency.
//
// Depth (0006): reach, frequency and the video funnel ride on the same report call.
// If TikTok refuses the wider metric list, the call is retried with the core metrics
// so spend never goes missing; the run detail records depth_error.
//
// Pixel events: inert until ad_accounts.config.tiktok_events lists the event metrics
// to pull, e.g. [{ "metric": "complete_payment", "name": "Complete Payment" }]. Each
// becomes a conversion action 'event:<metric>' with campaign-day rows in
// conversions_daily, so a seed conversion_labels entry gives it a conv:<label> column
// exactly like a Google conversion action.

import { upsert, syncCampaigns } from '../warehouse.mjs';
import { todayIn, addDays } from '../dates.mjs';
import { fetchRetry, num, sleep } from './http.mjs';
import { accessToken } from '../fta-credentials.mjs';

export const TIKTOK_API = 'https://business-api.tiktok.com/open_api/v1.3';
const PAGE_SIZE = 1000;
// A daily (stat_time_day) report may span at most 30 days.
export const MAX_REPORT_DAYS = 30;
const CORE_METRICS = ['spend', 'impressions', 'clicks', 'conversion'];
const METRICS = ['campaign_name', ...CORE_METRICS];
const ADGROUP_METRICS = ['adgroup_name', 'campaign_id', 'campaign_name', ...CORE_METRICS];
// TikTok metric name = ads.ad_daily / ads.adgroup_daily column name. reach, frequency
// and average_video_play are per row only (non-additive).
export const DEPTH_METRICS = [
  'reach', 'frequency', 'video_play_actions', 'video_watched_2s', 'video_watched_6s',
  'video_views_p25', 'video_views_p50', 'video_views_p75', 'video_views_p100',
  'engaged_view', 'average_video_play',
];
const RATIO_METRICS = new Set(['frequency', 'average_video_play']);
// TikTok answers HTTP 200 with a body code; these are rate limits / transient.
const RETRY_CODES = new Set([40100, 40200, 40201, 50000, 50002, 51004]);

async function ttGet(token, path, params = {}) {
  const u = new URL(`${TIKTOK_API}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  for (let attempt = 0; ; attempt++) {
    const r = await fetchRetry(u, { headers: { 'Access-Token': token } }, { label: `tiktok ${path}` });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.code === 0) return j.data || {};
    if (RETRY_CODES.has(j.code) && attempt < 3) { await sleep(2000 * 2 ** attempt); continue; }
    throw Object.assign(new Error(`TikTok ${path}: HTTP ${r.status} code ${j.code ?? '?'} ${j.message || ''}`.trim()), { code: 'tiktok', status: r.status, tiktok: j.code });
  }
}

// Page through a list endpoint (data.list + data.page_info.total_page).
async function ttAll(token, path, params) {
  const out = [];
  for (let page = 1; page <= 200; page++) {
    const d = await ttGet(token, path, { ...params, page, page_size: PAGE_SIZE });
    out.push(...(d.list || []));
    const total = d.page_info && d.page_info.total_page;
    if (!total || page >= total) break;
  }
  return out;
}

// [from, to] split into spans of at most MAX_REPORT_DAYS days.
export function reportChunks(from, to, days = MAX_REPORT_DAYS) {
  const out = [];
  for (let s = from; s <= to; s = addDays(s, days)) {
    const e = addDays(s, days - 1);
    out.push([s, e < to ? e : to]);
  }
  return out;
}

// Depth metrics of one report row → column values. Counts are integers; a missing
// or '-' value is NULL, never 0, so "not reported" stays distinguishable.
export function depthFields(m = {}) {
  const out = {};
  for (const k of DEPTH_METRICS) {
    const v = num(m[k]);
    out[k] = v === null ? null : RATIO_METRICS.has(k) ? v : Math.round(v);
  }
  return out;
}

const reportDate = (dim) => {
  const d = String(dim.stat_time_day || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

// One report row (dimensions campaign_id + stat_time_day) → an ad_daily row.
// depth: the request carried DEPTH_METRICS, so write those columns (else leave them
// out and an upsert keeps whatever is stored).
export function reportRow(item, { accountId, today, runId = null, depth = false }) {
  const dim = item.dimensions || {};
  const m = item.metrics || {};
  const campaignId = dim.campaign_id ? String(dim.campaign_id) : '';
  const date = reportDate(dim);
  if (!campaignId || !date) return null;
  const conv = num(m.conversion);
  return {
    platform: 'tiktok', account_id: String(accountId), campaign_id: campaignId, date,
    cost: num(m.spend) ?? 0, clicks: num(m.clicks) ?? 0, impressions: num(m.impressions) ?? 0,
    all_conversions: conv, conversions: conv, conversions_value: null,
    ...(depth ? depthFields(m) : {}),
    is_complete: date < today, source: 'api', run_id: runId,
  };
}

// One AUCTION_ADGROUP report row (dimensions adgroup_id + stat_time_day; campaign_id
// and names as attribute metrics) → an adgroup_daily row.
export function adgroupRow(item, { accountId, today, runId = null, depth = false }) {
  const dim = item.dimensions || {};
  const m = item.metrics || {};
  const adgroupId = dim.adgroup_id ? String(dim.adgroup_id) : '';
  const date = reportDate(dim);
  if (!adgroupId || !date) return null;
  const conv = num(m.conversion);
  return {
    platform: 'tiktok', account_id: String(accountId), adgroup_id: adgroupId, date,
    campaign_id: m.campaign_id && m.campaign_id !== '-' ? String(m.campaign_id) : null,
    cost: num(m.spend) ?? 0, clicks: num(m.clicks) ?? 0, impressions: num(m.impressions) ?? 0,
    all_conversions: conv, conversions: conv, conversions_value: null,
    ...(depth ? depthFields(m) : {}),
    is_complete: date < today, source: 'api', run_id: runId,
  };
}

// ad_accounts.config.tiktok_events → [{ metric, name, category, value_metric }].
// Empty (the default) keeps the pixel breakdown off. Metric names go straight into
// the report request, so anything that is not a plain metric identifier is dropped.
export function eventSpecs(config) {
  const list = config && Array.isArray(config.tiktok_events) ? config.tiktok_events : [];
  const ok = (v) => typeof v === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v);
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const spec = typeof e === 'string' ? { metric: e } : e || {};
    if (!ok(spec.metric) || seen.has(spec.metric)) continue;
    seen.add(spec.metric);
    out.push({
      metric: spec.metric,
      name: typeof spec.name === 'string' && spec.name.trim() ? spec.name.trim() : spec.metric,
      category: typeof spec.category === 'string' && spec.category.trim() ? spec.category.trim() : 'TIKTOK_EVENT',
      value_metric: ok(spec.value_metric) ? spec.value_metric : null,
    });
  }
  return out;
}

export const eventActionId = (metric) => `event:${metric}`;

// Configured events → conversion_actions rows (report_label stays operator-owned).
export function eventActions(events, accountId) {
  return events.map((e) => ({
    platform: 'tiktok', account_id: String(accountId), action_id: eventActionId(e.metric), name: e.name,
    category: e.category, type: 'TIKTOK_REPORT_METRIC', status: 'ENABLED', include_in_conversions: null, primary_for_goal: null,
  }));
}

// One campaign report row → conversions_daily rows, one per configured event with a
// non-zero count or value.
export function eventRows(item, events, { accountId, runId = null }) {
  const dim = item.dimensions || {};
  const m = item.metrics || {};
  const campaignId = dim.campaign_id ? String(dim.campaign_id) : '';
  const date = reportDate(dim);
  if (!campaignId || !date) return [];
  const out = [];
  for (const e of events) {
    const n = num(m[e.metric]);
    const value = e.value_metric ? num(m[e.value_metric]) : null;
    if (!n && !value) continue;
    out.push({
      platform: 'tiktok', account_id: String(accountId), campaign_id: campaignId, date,
      action_id: eventActionId(e.metric), action_name: e.name, category: e.category,
      all_conversions: n ?? 0, conversions: n ?? 0, value, run_id: runId,
    });
  }
  return out;
}

// Metric list for a report call: base attributes + core, then depth, then events.
export function reportMetrics(base, { depth = true, events = [] } = {}) {
  const out = [...base];
  if (depth) out.push(...DEPTH_METRICS);
  for (const e of events) {
    out.push(e.metric);
    if (e.value_metric) out.push(e.value_metric);
  }
  return [...new Set(out)];
}

// Run a report with the full metric list; if TikTok refuses it, retry with the base
// list alone so the core facts still land. Returns { items, extended, error }.
async function reportWithFallback(fetchReport, base, opts) {
  const full = reportMetrics(base, opts);
  if (full.length === base.length) return { items: await fetchReport(base), extended: false, error: null };
  try {
    return { items: await fetchReport(full), extended: true, error: null };
  } catch (err) {
    const items = await fetchReport(base);
    return { items, extended: false, error: err.message };
  }
}
export { reportWithFallback as _reportWithFallback };

// Campaign budget as a daily amount. BUDGET_MODE_INFINITE campaigns budget at the ad
// group, so they take the sum of their live ad groups' daily budgets (like Meta ABO).
export function campaignBudget(c, adgroupDaily) {
  if (c.budget_mode === 'BUDGET_MODE_DAY' || c.budget_mode === 'BUDGET_MODE_DYNAMIC_DAILY_BUDGET') {
    return { amount: num(c.budget), budget_status: 'daily', budget_scope: 'campaign' };
  }
  if (c.budget_mode === 'BUDGET_MODE_TOTAL') return { amount: null, budget_status: 'lifetime', budget_scope: 'campaign' };
  const sum = adgroupDaily.get(String(c.campaign_id));
  return { amount: sum ?? null, budget_status: sum !== undefined ? 'daily' : null, budget_scope: 'adsets_sum' };
}

export async function probeTikTok() {
  const token = await accessToken('tiktok');
  const d = await ttGet(token, '/oauth2/advertiser/get/', { app_id: process.env.FTA_TIKTOK_APP_ID, secret: process.env.FTA_TIKTOK_APP_SECRET });
  return { accounts: (d.list || []).map((a) => ({ id: String(a.advertiser_id), name: a.advertiser_name })) };
}

// token: tests pass one in; production reads FTA's stored TikTok credential.
export async function ingestTikTok(q, account, from, to, { snapshots = true, runId = null, token: tokenOverride = null } = {}) {
  const token = tokenOverride || await accessToken('tiktok');
  const aid = String(account.account_id).replace(/\D/g, '');
  const today = todayIn(account.timezone || 'America/New_York');
  let events = eventSpecs(account.config);
  const out = { rows: 0, campaigns: 0, adgroup_rows: 0, adgroups: 0, conversions: 0 };
  const note = (k, msg) => { if (msg && !out[k]) out[k] = String(msg).slice(0, 500); };

  const campaigns = await ttAll(token, '/campaign/get/', {
    advertiser_id: aid,
    fields: ['campaign_id', 'campaign_name', 'operation_status', 'secondary_status', 'objective_type', 'budget', 'budget_mode', 'create_time'],
  });
  out.campaigns += await syncCampaigns(q, 'tiktok', aid, campaigns.map((c) => ({
    campaign_id: String(c.campaign_id), name: c.campaign_name, status: c.operation_status, channel_type: c.objective_type || null,
    budget_id: `campaign:${c.campaign_id}`, first_seen: String(c.create_time || today).slice(0, 10), last_seen: today,
  })), today);

  if (snapshots) {
    const adgroups = await ttAll(token, '/adgroup/get/', {
      advertiser_id: aid, fields: ['adgroup_id', 'adgroup_name', 'campaign_id', 'operation_status', 'budget', 'budget_mode', 'create_time'],
    });
    const adgroupDaily = new Map();
    for (const g of adgroups) {
      if (g.operation_status !== 'ENABLE' || g.budget_mode !== 'BUDGET_MODE_DAY') continue;
      const k = String(g.campaign_id);
      adgroupDaily.set(k, (adgroupDaily.get(k) || 0) + (num(g.budget) || 0));
    }
    await upsert(q, 'campaign_budget_daily', campaigns.map((c) => ({
      platform: 'tiktok', account_id: aid, campaign_id: String(c.campaign_id), snapshot_date: today,
      budget_id: `campaign:${c.campaign_id}`, is_shared: false, campaign_status: c.operation_status,
      ...campaignBudget(c, adgroupDaily),
    })));
    out.adgroups += await upsert(q, 'adgroups', adgroups.map((g) => ({
      platform: 'tiktok', account_id: aid, adgroup_id: String(g.adgroup_id), campaign_id: g.campaign_id ? String(g.campaign_id) : null,
      name: g.adgroup_name || `TikTok ad group ${g.adgroup_id}`, status: g.operation_status || null,
      budget: num(g.budget), budget_mode: g.budget_mode || null,
      first_seen: String(g.create_time || today).slice(0, 10), last_seen: today,
    })));
    if (events.length) await upsert(q, 'conversion_actions', eventActions(events, aid));
  }

  const report = (dataLevel, dimensions, s, e) => (metrics) => ttAll(token, '/report/integrated/get/', {
    advertiser_id: aid, report_type: 'BASIC', data_level: dataLevel,
    dimensions, metrics, start_date: s, end_date: e, query_lifetime: 'false',
  });
  const names = new Map();
  const known = new Set(campaigns.map((c) => String(c.campaign_id)));
  let depth = true;
  let agDepth = true;
  let agOk = true;
  for (const [s, e] of reportChunks(from, to)) {
    // Once a chunk falls back, later chunks skip the wider request.
    const r = await reportWithFallback(report('AUCTION_CAMPAIGN', ['campaign_id', 'stat_time_day'], s, e), METRICS, { depth, events });
    const gotDepth = r.extended && depth;
    const gotEvents = r.extended && events.length > 0;
    if (r.error) { depth = false; events = []; note('depth_error', r.error); }
    const items = r.items;
    for (const it of items) {
      const id = it.dimensions && it.dimensions.campaign_id;
      if (id && it.metrics && it.metrics.campaign_name) names.set(String(id), it.metrics.campaign_name);
    }
    const rows = items.map((it) => reportRow(it, { accountId: aid, today, runId, depth: gotDepth })).filter(Boolean);
    // The report can name campaigns /campaign/get/ no longer lists (deleted).
    const extra = [...new Set(rows.map((x) => x.campaign_id).filter((id) => !known.has(id)))];
    if (extra.length) {
      await syncCampaigns(q, 'tiktok', aid, extra.map((id) => ({ campaign_id: id, name: names.get(id) || `TikTok campaign ${id}` })), today);
      for (const id of extra) known.add(id);
    }
    out.rows += await upsert(q, 'ad_daily', rows);
    if (gotEvents) {
      out.conversions += await upsert(q, 'conversions_daily', items.flatMap((it) => eventRows(it, eventSpecs(account.config), { accountId: aid, runId })));
    }

    // Ad-group grain. Secondary: a failure here is recorded on the run, never fatal,
    // so campaign spend (what the pacing sheet reads) is never held hostage to it.
    if (!agOk) continue;
    try {
      const g = await reportWithFallback(report('AUCTION_ADGROUP', ['adgroup_id', 'stat_time_day'], s, e), ADGROUP_METRICS, { depth: agDepth });
      if (g.error) { agDepth = false; note('adgroup_depth_error', g.error); }
      const grows = g.items.map((it) => adgroupRow(it, { accountId: aid, today, runId, depth: g.extended })).filter(Boolean);
      const seen = new Map();
      for (const it of g.items) {
        const row = adgroupRow(it, { accountId: aid, today });
        if (!row) continue;
        const cur = seen.get(row.adgroup_id) || { platform: 'tiktok', account_id: aid, adgroup_id: row.adgroup_id, campaign_id: row.campaign_id,
          name: (it.metrics && it.metrics.adgroup_name) || `TikTok ad group ${row.adgroup_id}`, first_seen: row.date, last_seen: row.date };
        if (row.date < cur.first_seen) cur.first_seen = row.date;
        if (row.date > cur.last_seen) cur.last_seen = row.date;
        seen.set(row.adgroup_id, cur);
      }
      await upsert(q, 'adgroups', [...seen.values()]);
      out.adgroup_rows += await upsert(q, 'adgroup_daily', grows);
    } catch (err) {
      agOk = false;
      note('adgroup_error', err.message);
    }
  }
  return out;
}
