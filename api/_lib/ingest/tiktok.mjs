// api/_lib/ingest/tiktok.mjs — TikTok API for Business (Marketing API v1.3) → ads.*
// Campaign-level daily BASIC report plus the campaign list and budgets. Token: FTA's
// own TikTok for Business sign-in (provider 'tiktok' in connect_fta_credentials,
// minted via /api/connect/admin/fta-tiktok on FTA_TIKTOK_APP_ID / FTA_TIKTOK_APP_SECRET).
// Reports are in the advertiser's own timezone and currency.

import { upsert, syncCampaigns } from '../warehouse.mjs';
import { todayIn, addDays } from '../dates.mjs';
import { fetchRetry, num, sleep } from './http.mjs';
import { accessToken } from '../fta-credentials.mjs';

export const TIKTOK_API = 'https://business-api.tiktok.com/open_api/v1.3';
const PAGE_SIZE = 1000;
// A daily (stat_time_day) report may span at most 30 days.
export const MAX_REPORT_DAYS = 30;
const METRICS = ['campaign_name', 'spend', 'impressions', 'clicks', 'conversion'];
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

// One report row (dimensions campaign_id + stat_time_day) → an ad_daily row.
export function reportRow(item, { accountId, today, runId = null }) {
  const dim = item.dimensions || {};
  const m = item.metrics || {};
  const campaignId = dim.campaign_id ? String(dim.campaign_id) : '';
  const date = String(dim.stat_time_day || '').slice(0, 10);
  if (!campaignId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const conv = num(m.conversion);
  return {
    platform: 'tiktok', account_id: String(accountId), campaign_id: campaignId, date,
    cost: num(m.spend) ?? 0, clicks: num(m.clicks) ?? 0, impressions: num(m.impressions) ?? 0,
    all_conversions: conv, conversions: conv, conversions_value: null,
    is_complete: date < today, source: 'api', run_id: runId,
  };
}

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

export async function ingestTikTok(q, account, from, to, { snapshots = true, runId = null } = {}) {
  const token = await accessToken('tiktok');
  const aid = String(account.account_id).replace(/\D/g, '');
  const today = todayIn(account.timezone || 'America/New_York');
  const out = { rows: 0, campaigns: 0 };

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
      advertiser_id: aid, fields: ['adgroup_id', 'campaign_id', 'operation_status', 'budget', 'budget_mode'],
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
  }

  const names = new Map();
  for (const [s, e] of reportChunks(from, to)) {
    const items = await ttAll(token, '/report/integrated/get/', {
      advertiser_id: aid, report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN',
      dimensions: ['campaign_id', 'stat_time_day'], metrics: METRICS,
      start_date: s, end_date: e, query_lifetime: 'false',
    });
    for (const it of items) {
      const id = it.dimensions && it.dimensions.campaign_id;
      if (id && it.metrics && it.metrics.campaign_name) names.set(String(id), it.metrics.campaign_name);
    }
    const rows = items.map((it) => reportRow(it, { accountId: aid, today, runId })).filter(Boolean);
    // The report can name campaigns /campaign/get/ no longer lists (deleted).
    const known = new Set(campaigns.map((c) => String(c.campaign_id)));
    const extra = [...new Set(rows.map((r) => r.campaign_id).filter((id) => !known.has(id)))];
    if (extra.length) await syncCampaigns(q, 'tiktok', aid, extra.map((id) => ({ campaign_id: id, name: names.get(id) || `TikTok campaign ${id}` })), today);
    out.rows += await upsert(q, 'ad_daily', rows);
  }
  return out;
}
