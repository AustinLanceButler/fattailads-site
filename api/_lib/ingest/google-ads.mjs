// api/_lib/ingest/google-ads.mjs — Google Ads → ads.* (campaign-level daily metrics,
// per-conversion-action rows, budget snapshots). Same call shape as
// api/_lib/agency-links.mjs: FTA's stored refresh token, login-customer-id = the
// FTA MCC, no developer token (set GOOGLE_ADS_DEVELOPER_TOKEN only if the API
// starts demanding one).

import { accessToken } from '../fta-credentials.mjs';
import { upsert, syncCampaigns } from '../warehouse.mjs';
import { todayIn } from '../dates.mjs';
import { fetchRetry } from './http.mjs';

const ADS_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';
export const mccId = () => String(process.env.CONNECT_GOOGLE_ADS_MCC || '673-311-0705').replace(/\D/g, '');

export async function googleAds(customerId, path, body, { loginCustomerId } = {}) {
  const token = await accessToken('google');
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'login-customer-id': String(loginCustomerId || mccId()).replace(/\D/g, '') };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) headers['developer-token'] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const r = await fetchRetry(`https://googleads.googleapis.com/${ADS_VERSION}/customers/${String(customerId).replace(/\D/g, '')}/${path}`,
    { method: 'POST', headers, body: JSON.stringify(body) }, { label: `googleAds ${path}` });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

function adsErrorMessage(body, status) {
  const b = Array.isArray(body) ? body.find((x) => x && x.error) || body[0] : body;
  const e = b && b.error;
  if (!e) return `HTTP ${status}`;
  const details = (e.details || []).flatMap((d) => d.errors || []).map((x) => `${Object.values(x.errorCode || {})[0] || ''}: ${x.message || ''}`.trim());
  return `${e.status || e.code || status}: ${e.message || ''}${details.length ? ` — ${details.join('; ')}` : ''}`.slice(0, 600);
}

// searchStream → flat array of result rows (camelCase JSON as the REST API returns it).
export async function gaql(customerId, query, opts = {}) {
  const r = await googleAds(customerId, 'googleAds:searchStream', { query }, opts);
  if (!r.ok) throw Object.assign(new Error(adsErrorMessage(r.body, r.status)), { code: 'google_ads', status: r.status });
  const batches = Array.isArray(r.body) ? r.body : [r.body];
  return batches.flatMap((b) => (b && b.results) || []);
}

const idOf = (resourceName) => String(resourceName || '').split('/').pop();
const micros = (v) => (v === undefined || v === null ? null : Number(v) / 1e6);
const n = (v) => (v === undefined || v === null ? null : Number(v));

// Day-1 identity check: which client accounts the stored token sees under the MCC.
export async function probeAccess() {
  const rows = await gaql(mccId(), `SELECT customer_client.id, customer_client.descriptive_name, customer_client.level,
      customer_client.manager, customer_client.status, customer_client.currency_code, customer_client.time_zone
    FROM customer_client WHERE customer_client.level <= 2`);
  return rows.map((r) => ({
    id: String(r.customerClient.id), name: r.customerClient.descriptiveName, level: r.customerClient.level,
    manager: !!r.customerClient.manager, status: r.customerClient.status, timezone: r.customerClient.timeZone,
  }));
}

// Pull one account for [from, to]. Returns { rows, conversions, campaigns } counts.
//   snapshots: also refresh campaign/budget/conversion-action dimensions and write
//   today's budget snapshot (daily runs: true; historical backfill chunks: false).
export async function ingestGoogle(q, account, from, to, { snapshots = true, runId = null } = {}) {
  const cid = account.account_id;
  const login = account.parent_id || mccId();
  const today = todayIn(account.timezone || 'America/New_York');
  const opts = { loginCustomerId: login };
  const out = { rows: 0, conversions: 0, campaigns: 0, budgets: 0 };

  if (snapshots) {
    // Current campaign + budget state (all non-removed campaigns, with or without spend).
    const cur = await gaql(cid, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
        campaign.advertising_channel_sub_type, campaign.campaign_budget,
        campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.explicitly_shared,
        campaign_budget.status, campaign_budget.delivery_method, campaign_budget.period
      FROM campaign WHERE campaign.status != 'REMOVED'`, opts);
    const camps = cur.map((r) => ({
      campaign_id: r.campaign.id, name: r.campaign.name, status: r.campaign.status,
      channel_type: r.campaign.advertisingChannelType, channel_sub_type: r.campaign.advertisingChannelSubType,
      budget_id: r.campaignBudget && r.campaignBudget.id, first_seen: today, last_seen: today,
    }));
    out.campaigns += await syncCampaigns(q, 'google', cid, camps, today);
    out.rows += 0;
    const snap = cur.filter((r) => r.campaignBudget && r.campaignBudget.id).map((r) => ({
      platform: 'google', account_id: cid, campaign_id: String(r.campaign.id), snapshot_date: today,
      budget_id: String(r.campaignBudget.id), amount: micros(r.campaignBudget.amountMicros),
      is_shared: !!r.campaignBudget.explicitlyShared, budget_status: r.campaignBudget.status,
      campaign_status: r.campaign.status, budget_scope: 'campaign',
    }));
    await upsert(q, 'campaign_budget_daily', snap);

    const bud = await gaql(cid, `SELECT campaign_budget.id, campaign_budget.name, campaign_budget.amount_micros,
        campaign_budget.explicitly_shared, campaign_budget.status, campaign_budget.reference_count,
        campaign_budget.period, campaign_budget.delivery_method
      FROM campaign_budget WHERE campaign_budget.status != 'REMOVED'`, opts);
    const liveByBudget = new Map();
    for (const r of cur) if (r.campaign.status === 'ENABLED' && r.campaignBudget) liveByBudget.set(String(r.campaignBudget.id), (liveByBudget.get(String(r.campaignBudget.id)) || 0) + 1);
    out.budgets += await upsert(q, 'budgets', bud.map((r) => ({
      platform: 'google', account_id: cid, budget_id: String(r.campaignBudget.id), name: r.campaignBudget.name,
      is_shared: !!r.campaignBudget.explicitlyShared, status: r.campaignBudget.status,
      period: r.campaignBudget.period, delivery_method: r.campaignBudget.deliveryMethod,
    })));
    await upsert(q, 'shared_budget_daily', bud.filter((r) => r.campaignBudget.explicitlyShared).map((r) => ({
      platform: 'google', account_id: cid, budget_id: String(r.campaignBudget.id), snapshot_date: today,
      name: r.campaignBudget.name, amount: micros(r.campaignBudget.amountMicros), status: r.campaignBudget.status,
      association_count: n(r.campaignBudget.referenceCount), active_campaign_count: liveByBudget.get(String(r.campaignBudget.id)) || 0,
    })));

    const acts = await gaql(cid, `SELECT conversion_action.id, conversion_action.name, conversion_action.category,
        conversion_action.type, conversion_action.status, conversion_action.include_in_conversions_metric,
        conversion_action.primary_for_goal FROM conversion_action`, opts);
    await upsert(q, 'conversion_actions', acts.map((r) => ({
      platform: 'google', account_id: cid, action_id: String(r.conversionAction.id), name: r.conversionAction.name,
      category: r.conversionAction.category, type: r.conversionAction.type, status: r.conversionAction.status,
      include_in_conversions: r.conversionAction.includeInConversionsMetric ?? null,
      primary_for_goal: r.conversionAction.primaryForGoal ?? null,
    })));
  }

  // Daily metrics. Removed campaigns are queried explicitly as well, so history
  // survives a campaign removal (ACE's rule is pause-never-remove, but belt and braces).
  const metricsQ = (extra) => `SELECT segments.date, campaign.id, campaign.name, campaign.status,
      campaign.advertising_channel_type, campaign.advertising_channel_sub_type, campaign.campaign_budget,
      metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.all_conversions, metrics.conversions,
      metrics.conversions_value, metrics.search_impression_share, metrics.search_budget_lost_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'${extra}`;
  const seen = new Set();
  const rows = [];
  const campaignsSeen = new Map();
  for (const extra of ['', " AND campaign.status = 'REMOVED'"]) {
    let res;
    try { res = await gaql(cid, metricsQ(extra), opts); } catch (err) { if (extra) { res = []; } else throw err; }
    for (const r of res) {
      const key = `${r.campaign.id}|${r.segments.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        platform: 'google', account_id: cid, campaign_id: String(r.campaign.id), date: r.segments.date,
        cost: micros(r.metrics.costMicros) ?? 0, clicks: n(r.metrics.clicks) ?? 0, impressions: n(r.metrics.impressions) ?? 0,
        all_conversions: n(r.metrics.allConversions), conversions: n(r.metrics.conversions), conversions_value: n(r.metrics.conversionsValue),
        search_impression_share: n(r.metrics.searchImpressionShare), search_budget_lost_is: n(r.metrics.searchBudgetLostImpressionShare),
        search_rank_lost_is: n(r.metrics.searchRankLostImpressionShare),
        is_complete: r.segments.date < today, source: 'api', run_id: runId,
      });
      const c = campaignsSeen.get(String(r.campaign.id)) || {
        campaign_id: r.campaign.id, name: r.campaign.name, status: r.campaign.status,
        channel_type: r.campaign.advertisingChannelType, channel_sub_type: r.campaign.advertisingChannelSubType,
        budget_id: idOf(r.campaign.campaignBudget), first_seen: r.segments.date, last_seen: r.segments.date,
      };
      if (r.segments.date < c.first_seen) c.first_seen = r.segments.date;
      if (r.segments.date > c.last_seen) c.last_seen = r.segments.date;
      campaignsSeen.set(String(r.campaign.id), c);
    }
  }
  out.campaigns += await syncCampaigns(q, 'google', cid, [...campaignsSeen.values()], today);
  out.rows += await upsert(q, 'ad_daily', rows);

  // Per conversion action (store visits, Teguar's named actions). Click metrics
  // cannot share a query with conversion segments, hence the second query.
  const conv = await gaql(cid, `SELECT segments.date, campaign.id, segments.conversion_action,
      segments.conversion_action_name, segments.conversion_action_category,
      metrics.all_conversions, metrics.conversions, metrics.all_conversions_value
    FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`, opts);
  out.conversions += await upsert(q, 'conversions_daily', conv.map((r) => ({
    platform: 'google', account_id: cid, campaign_id: String(r.campaign.id), date: r.segments.date,
    action_id: idOf(r.segments.conversionAction), action_name: r.segments.conversionActionName,
    category: r.segments.conversionActionCategory,
    all_conversions: n(r.metrics.allConversions), conversions: n(r.metrics.conversions), value: n(r.metrics.allConversionsValue),
    run_id: runId,
  })));
  return out;
}
