// api/_lib/ingest/linkedin.mjs — LinkedIn Marketing API (REST, versioned) → ads.*
// Campaign-level daily analytics plus the campaign list (name, status, daily budget).
// Token: FTA's own LinkedIn sign-in (provider 'linkedin' in connect_fta_credentials,
// scopes r_ads r_ads_reporting) on the warehouse's own LinkedIn app, never linkedin-mcp's
// app or token. LinkedIn keeps one live grant per member+app, so two consumers on one
// app revoke each other on every sign-in; see fta-credentials.mjs.

import { upsert, syncCampaigns } from '../warehouse.mjs';
import { todayIn } from '../dates.mjs';
import { fetchRetry, num } from './http.mjs';
import { accessToken } from '../fta-credentials.mjs';

const API = 'https://api.linkedin.com/rest';
const VERSION = () => process.env.LINKEDIN_API_VERSION || '202604';
const METRICS = ['costInLocalCurrency', 'impressions', 'clicks', 'externalWebsiteConversions'];

const accountUrn = (id) => `urn:li:sponsoredAccount:${String(id).replace(/\D/g, '')}`;
const urnList = (urns) => `List(${urns.map((u) => encodeURIComponent(u)).join(',')})`;
const ymdParts = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return { y, m, d }; };
export const restliDateRange = (from, to) => {
  const s = ymdParts(from); const e = ymdParts(to);
  return `(start:(year:${s.y},month:${s.m},day:${s.d}),end:(year:${e.y},month:${e.m},day:${e.d}))`;
};

async function liGet(token, path, rawQuery) {
  const r = await fetchRetry(`${API}${path}?${rawQuery}`, {
    headers: { authorization: `Bearer ${token}`, 'LinkedIn-Version': VERSION(), 'X-Restli-Protocol-Version': '2.0.0' },
  }, { label: `linkedin ${path}` });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`LinkedIn ${path}: HTTP ${r.status} ${j.code || ''} ${j.message || ''}`.trim()), { code: 'linkedin', status: r.status });
  return j;
}

// Finder paging: cursor (metadata.nextPageToken) when present, else start/count;
// stop on a short page or a page that adds nothing new (some finders ignore start).
async function liAll(token, path, query, pageSize = 500) {
  const seen = new Set();
  const out = [];
  let start = 0;
  let pageToken = null;
  for (let i = 0; i < 50; i++) {
    const q = `${query}&count=${pageSize}&${pageToken ? `pageToken=${encodeURIComponent(pageToken)}` : `start=${start}`}`;
    const j = await liGet(token, path, q);
    const batch = (j.elements || []).filter((e) => e && typeof e === 'object');
    let added = 0;
    for (const e of batch) { const k = String(e.id); if (!seen.has(k)) { seen.add(k); out.push(e); added++; } }
    const next = j.metadata && j.metadata.nextPageToken;
    if (next) { pageToken = next; continue; }
    if (pageToken || batch.length < pageSize || !added) break;
    start += batch.length;
  }
  return out;
}

// One adAnalytics element (pivot CAMPAIGN, DAILY) → an ad_daily row.
export function analyticsRow(el, { accountId, today, runId = null }) {
  const pv = (el.pivotValues || [])[0] || '';
  const campaignId = String(pv).split(':').pop();
  const s = el.dateRange && el.dateRange.start;
  if (!campaignId || !s) return null;
  const date = `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
  return {
    platform: 'linkedin', account_id: String(accountId), campaign_id: campaignId, date,
    cost: num(el.costInLocalCurrency) ?? 0, clicks: num(el.clicks) ?? 0, impressions: num(el.impressions) ?? 0,
    all_conversions: num(el.externalWebsiteConversions), conversions: num(el.externalWebsiteConversions), conversions_value: null,
    is_complete: date < today, source: 'api', run_id: runId,
  };
}

export async function probeLinkedIn() {
  const token = await accessToken('linkedin');
  const accts = await liAll(token, '/adAccounts', 'q=search');
  return { accounts: accts.map((a) => ({ id: String(a.id), name: a.name, status: a.status, currency: a.currency })) };
}

export async function ingestLinkedIn(q, account, from, to, { snapshots = true, runId = null } = {}) {
  const token = await accessToken('linkedin');
  const aid = String(account.account_id).replace(/\D/g, '');
  const today = todayIn(account.timezone || 'America/New_York');
  const out = { rows: 0, campaigns: 0 };

  const campaigns = await liAll(token, `/adAccounts/${aid}/adCampaigns`, 'q=search');
  out.campaigns += await syncCampaigns(q, 'linkedin', aid, campaigns.map((c) => ({
    campaign_id: String(c.id), name: c.name, status: c.status, channel_type: c.type || null,
    budget_id: c.dailyBudget ? `campaign:${c.id}` : null, last_seen: today,
  })), today);

  if (snapshots) {
    await upsert(q, 'campaign_budget_daily', campaigns.map((c) => ({
      platform: 'linkedin', account_id: aid, campaign_id: String(c.id), snapshot_date: today,
      budget_id: `campaign:${c.id}`, amount: c.dailyBudget ? num(c.dailyBudget.amount) : null, is_shared: false,
      budget_status: c.dailyBudget ? 'daily' : (c.totalBudget ? 'lifetime' : null), campaign_status: c.status, budget_scope: 'campaign',
    })));
  }

  const query = ['q=analytics', 'pivot=CAMPAIGN', 'timeGranularity=DAILY', `dateRange=${restliDateRange(from, to)}`,
    `fields=${[...METRICS, 'pivotValues', 'dateRange'].join(',')}`, `accounts=${urnList([accountUrn(aid)])}`].join('&');
  const j = await liGet(token, '/adAnalytics', query);
  const rows = (j.elements || []).map((el) => analyticsRow(el, { accountId: aid, today, runId })).filter(Boolean);
  // Analytics can name campaigns the search finder no longer lists (e.g. removed).
  const known = new Set(campaigns.map((c) => String(c.id)));
  const extra = [...new Set(rows.map((r) => r.campaign_id).filter((id) => !known.has(id)))];
  if (extra.length) await syncCampaigns(q, 'linkedin', aid, extra.map((id) => ({ campaign_id: id, name: `LinkedIn campaign ${id}` })), today);
  out.rows += await upsert(q, 'ad_daily', rows);
  return out;
}
