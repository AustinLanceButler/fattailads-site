// api/_lib/ingest/meta.mjs — Meta Marketing API (Graph v25) → ads.*
// Campaign-level daily insights plus campaign/ad-set budgets. Token: a dedicated
// read-only System User token in META_ADS_TOKEN (ads_read; never the connector's).

import { upsert, syncCampaigns } from '../warehouse.mjs';
import { todayIn } from '../dates.mjs';
import { fetchRetry, num } from './http.mjs';

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v25.0'}`;

function token() {
  const t = process.env.META_ADS_TOKEN;
  if (!t) throw Object.assign(new Error('META_ADS_TOKEN is not set'), { code: 'not_configured' });
  return t;
}

async function graphGet(path, params = {}) {
  const u = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  const r = await fetchRetry(u, { headers: { authorization: `Bearer ${token()}` } }, { label: `meta ${path}` });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {};
    throw Object.assign(new Error(`Meta ${path}: ${e.code || r.status} ${e.type || ''} ${e.message || ''}`.trim()), { code: 'meta', status: r.status, meta: e });
  }
  return j;
}

// Follow paging.next until exhausted.
async function graphAll(path, params) {
  const out = [];
  let j = await graphGet(path, { ...params, limit: params.limit || 500 });
  for (;;) {
    out.push(...(j.data || []));
    const next = j.paging && j.paging.next;
    if (!next) break;
    const r = await fetchRetry(next, { headers: { authorization: `Bearer ${token()}` } }, { label: `meta ${path} page` });
    j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Object.assign(new Error(`Meta paging ${path}: ${(j.error && j.error.message) || r.status}`), { code: 'meta' });
  }
  return out;
}

const actId = (account) => (String(account.account_id).startsWith('act_') ? String(account.account_id) : `act_${account.account_id}`);
const money = (v) => (v === undefined || v === null || v === '' ? null : Number(v) / 100);

export async function probeMeta() {
  const me = await graphGet('me', { fields: 'id,name' });
  const accts = await graphAll('me/adaccounts', { fields: 'id,name,account_status,business{id,name}' });
  return { user: me, accounts: accts.map((a) => ({ id: a.id, name: a.name, status: a.account_status, business: a.business && a.business.name })) };
}

export async function ingestMeta(q, account, from, to, { snapshots = true, runId = null } = {}) {
  const act = actId(account);
  const aid = String(account.account_id);
  const today = todayIn(account.timezone || 'America/New_York');
  const out = { rows: 0, campaigns: 0 };

  const campaigns = await graphAll(`${act}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,budget_remaining,updated_time,created_time',
    effective_status: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES'],
  });
  out.campaigns += await syncCampaigns(q, 'meta', aid, campaigns.map((c) => ({
    campaign_id: c.id, name: c.name, status: c.effective_status || c.status, channel_type: c.objective,
    budget_id: c.daily_budget ? `campaign:${c.id}` : null, first_seen: (c.created_time || today).slice(0, 10), last_seen: today,
  })), today);

  if (snapshots) {
    const adsets = await graphAll(`${act}/adsets`, { fields: 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget' });
    const adsetSum = new Map();
    for (const s of adsets) {
      if (s.effective_status !== 'ACTIVE' || !s.daily_budget) continue;
      adsetSum.set(s.campaign_id, (adsetSum.get(s.campaign_id) || 0) + Number(s.daily_budget));
    }
    await upsert(q, 'campaign_budget_daily', campaigns.map((c) => {
      const cbo = money(c.daily_budget);
      const sum = adsetSum.has(c.id) ? adsetSum.get(c.id) / 100 : null;
      return {
        platform: 'meta', account_id: aid, campaign_id: String(c.id), snapshot_date: today,
        budget_id: `campaign:${c.id}`, amount: cbo ?? sum, is_shared: false,
        budget_status: c.lifetime_budget && !cbo && sum === null ? 'lifetime' : 'daily',
        campaign_status: c.effective_status || c.status, budget_scope: cbo !== null ? 'campaign' : 'adsets_sum',
      };
    }));
  }

  const ins = await graphAll(`${act}/insights`, {
    level: 'campaign', time_increment: 1,
    time_range: { since: from, until: to },
    fields: 'campaign_id,campaign_name,spend,clicks,impressions,actions,date_start,date_stop',
  });
  const camps = new Map();
  const rows = ins.map((r) => {
    const c = camps.get(r.campaign_id) || { campaign_id: r.campaign_id, name: r.campaign_name, first_seen: r.date_start, last_seen: r.date_start };
    if (r.date_start < c.first_seen) c.first_seen = r.date_start;
    if (r.date_start > c.last_seen) c.last_seen = r.date_start;
    camps.set(r.campaign_id, c);
    return {
      platform: 'meta', account_id: aid, campaign_id: String(r.campaign_id), date: r.date_start,
      cost: num(r.spend) ?? 0, clicks: num(r.clicks) ?? 0, impressions: num(r.impressions) ?? 0,
      all_conversions: sumActions(r.actions), conversions: null, conversions_value: null,
      is_complete: r.date_start < today, source: 'api', run_id: runId,
    };
  });
  // Insights can mention campaigns the /campaigns listing filtered out (e.g. deleted).
  await syncCampaigns(q, 'meta', aid, [...camps.values()].filter((c) => !campaigns.some((k) => k.id === c.campaign_id)), today);
  out.rows += await upsert(q, 'ad_daily', rows);
  return out;
}

// Funnel's "All Conv." for Meta is loose; keep a defensible definition: every
// conversion-type action (offsite pixel/CAPI events, leads, on-site conversions).
function sumActions(actions) {
  if (!Array.isArray(actions)) return null;
  let total = 0;
  let any = false;
  for (const a of actions) {
    const t = String(a.action_type || '');
    if (/^(offsite_conversion\.|onsite_conversion\.|lead$|omni_purchase$|omni_complete_registration$|app_custom_event\.)/.test(t)) {
      total += Number(a.value) || 0;
      any = true;
    }
  }
  return any ? total : 0;
}
