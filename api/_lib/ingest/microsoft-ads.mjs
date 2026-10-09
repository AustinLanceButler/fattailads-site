// api/_lib/ingest/microsoft-ads.mjs — Microsoft Advertising → ads.*
//
// Reporting API v13 (REST): submit a daily CampaignPerformanceReport, poll, download
// the zip, parse the CSV. Campaign Management v13 (REST): campaigns + shared budget
// pools, which the reports (and Funnel) never carried — this is what retires the
// hand-pinned Bing "Current Daily" in the ACE pacing sheet.
//
// Headers follow the SOAP pattern in api/_lib/agency-links.mjs: FTA's stored
// refresh token + FTA_MSADS_DEVELOPER_TOKEN, plus the client's CustomerId and
// CustomerAccountId (ad_accounts.parent_id / account_id).
//
// Report generation can outlast a function invocation: after `maxWaitMs` the
// request id is parked in ingest_runs (status pending_report) and drained first
// thing on the next run.

import { unzipSync, strFromU8 } from 'fflate';
import { accessToken } from '../fta-credentials.mjs';
import { upsert, syncCampaigns, exec } from '../warehouse.mjs';
import { todayIn } from '../dates.mjs';
import { fetchRetry, parseCsv, num, sleep } from './http.mjs';

const REPORTING = 'https://reporting.api.bingads.microsoft.com/Reporting/v13';
const CAMPAIGN_MGMT = 'https://campaign.api.bingads.microsoft.com/CampaignManagement/v13';

const TZ_MAP = {
  'America/New_York': 'EasternTimeUSCanada',
  'America/Chicago': 'CentralTimeUSCanada',
  'America/Denver': 'MountainTimeUSCanada',
  'America/Phoenix': 'Arizona',
  'America/Los_Angeles': 'PacificTimeUSCanadaTijuana',
};

async function headers(account) {
  const devToken = process.env.FTA_MSADS_DEVELOPER_TOKEN;
  if (!devToken) throw Object.assign(new Error('FTA_MSADS_DEVELOPER_TOKEN is not set'), { code: 'not_configured' });
  const token = await accessToken('microsoft');
  return {
    Authorization: `Bearer ${token}`,
    DeveloperToken: devToken,
    CustomerId: String(account.parent_id || ''),
    CustomerAccountId: String(account.account_id),
    'Content-Type': 'application/json',
  };
}

async function post(url, account, body, label) {
  const r = await fetchRetry(url, { method: 'POST', headers: await headers(account), body: JSON.stringify(body) }, { label });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text.slice(0, 500) } }
  return { ok: r.ok, status: r.status, body: j };
}

function msErrorMessage(body, status) {
  const errs = []
    .concat(body.Errors || [], body.OperationErrors || [], body.BatchErrors || [], body.PartialErrors || [])
    .map((e) => `${e.Code || e.ErrorCode || ''} ${e.Message || e.Details || ''}`.trim());
  if (body.error) errs.push(typeof body.error === 'string' ? body.error : JSON.stringify(body.error).slice(0, 300));
  return `HTTP ${status}${errs.length ? `: ${errs.join('; ')}` : body.raw ? `: ${body.raw}` : ''}`.slice(0, 600);
}

const ymdParts = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return { Day: d, Month: m, Year: y }; };

export const REPORT_COLUMNS = ['TimePeriod', 'AccountId', 'CampaignId', 'CampaignName', 'CampaignStatus', 'Spend', 'Clicks', 'Impressions',
  'Conversions', 'AllConversions', 'BudgetName', 'BudgetStatus', 'BudgetAssociationStatus'];

export async function submitReport(account, from, to, { withImpressionShare = true } = {}) {
  const tz = (account.config && account.config.report_time_zone) || TZ_MAP[account.timezone] || 'EasternTimeUSCanada';
  const columns = withImpressionShare ? [...REPORT_COLUMNS, 'ImpressionSharePercent'] : REPORT_COLUMNS;
  const body = {
    ReportRequest: {
      Type: 'CampaignPerformanceReportRequest',
      Aggregation: 'Daily',
      Format: 'Csv',
      ExcludeColumnHeaders: false,
      ExcludeReportHeader: true,
      ExcludeReportFooter: true,
      ReturnOnlyCompleteData: false,
      ReportName: `ads-warehouse ${account.account_id} ${from}..${to}`,
      Columns: columns,
      Scope: { AccountIds: [Number(account.account_id)] },
      Time: { CustomDateRangeStart: ymdParts(from), CustomDateRangeEnd: ymdParts(to), ReportTimeZone: tz },
    },
  };
  const r = await post(`${REPORTING}/GenerateReport/Submit`, account, body, 'ms submit');
  if (!r.ok || !r.body.ReportRequestId) {
    // Impression share has column-compatibility rules; retry once without it.
    if (withImpressionShare) return submitReport(account, from, to, { withImpressionShare: false });
    throw Object.assign(new Error(`Microsoft report submit failed: ${msErrorMessage(r.body, r.status)}`), { code: 'ms_submit' });
  }
  return r.body.ReportRequestId;
}

export async function pollReport(account, reportRequestId) {
  const r = await post(`${REPORTING}/GenerateReport/Poll`, account, { ReportRequestId: reportRequestId }, 'ms poll');
  if (!r.ok) throw Object.assign(new Error(`Microsoft report poll failed: ${msErrorMessage(r.body, r.status)}`), { code: 'ms_poll' });
  const s = r.body.ReportRequestStatus || {};
  return { status: s.Status, url: s.ReportDownloadUrl || null };
}

// Rows: { date, campaign_id, campaign_name, campaign_status, spend, clicks, impressions, conversions, all_conversions, budget_name, budget_status, budget_association_status, impression_share }
export async function downloadReport(url) {
  const r = await fetchRetry(url, {}, { label: 'ms download' });
  if (!r.ok) throw Object.assign(new Error(`Microsoft report download failed: HTTP ${r.status}`), { code: 'ms_download' });
  const zip = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const name = Object.keys(zip).find((k) => /\.csv$/i.test(k)) || Object.keys(zip)[0];
  if (!name) return [];
  return parseReportCsv(strFromU8(zip[name]));
}

export function parseReportCsv(text) {
  const rows = parseCsv(text);
  const hi = rows.findIndex((r) => r.includes('TimePeriod'));
  if (hi < 0) return [];
  const header = rows[hi];
  const col = (name) => header.indexOf(name);
  const ix = {
    date: col('TimePeriod'), id: col('CampaignId'), name: col('CampaignName'), status: col('CampaignStatus'),
    spend: col('Spend'), clicks: col('Clicks'), impr: col('Impressions'), conv: col('Conversions'), allConv: col('AllConversions'),
    bName: col('BudgetName'), bStatus: col('BudgetStatus'), bAssoc: col('BudgetAssociationStatus'), is: col('ImpressionSharePercent'),
  };
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    if (!r[ix.date] || !r[ix.id]) continue;
    const date = toYmd(r[ix.date]);
    if (!date) continue;
    const isPct = ix.is >= 0 ? num(r[ix.is]) : null;
    out.push({
      date, campaign_id: String(r[ix.id]), campaign_name: r[ix.name], campaign_status: r[ix.status],
      spend: num(r[ix.spend]) ?? 0, clicks: num(r[ix.clicks]) ?? 0, impressions: num(r[ix.impr]) ?? 0,
      conversions: num(r[ix.conv]), all_conversions: ix.allConv >= 0 ? num(r[ix.allConv]) : null,
      budget_name: ix.bName >= 0 ? r[ix.bName] : null, budget_status: ix.bStatus >= 0 ? r[ix.bStatus] : null,
      budget_association_status: ix.bAssoc >= 0 ? r[ix.bAssoc] : null,
      impression_share: isPct === null ? null : isPct / 100,
    });
  }
  return out;
}

// Microsoft writes dates as M/D/YYYY (or YYYY-MM-DD depending on report settings).
export function toYmd(s) {
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// Campaigns + budgets (Campaign Management REST).
export async function fetchCampaignsAndBudgets(account) {
  const acct = Number(account.account_id);
  const types = 'Search Shopping DynamicSearchAds Audience PerformanceMax';
  let c = await post(`${CAMPAIGN_MGMT}/Campaigns/QueryByAccountId`, account, { AccountId: acct, CampaignType: types }, 'ms campaigns');
  if (!c.ok) c = await post(`${CAMPAIGN_MGMT}/Campaigns/QueryByAccountId`, account, { AccountId: acct }, 'ms campaigns');
  if (!c.ok) throw Object.assign(new Error(`Microsoft campaigns query failed: ${msErrorMessage(c.body, c.status)}`), { code: 'ms_campaigns' });
  const b = await post(`${CAMPAIGN_MGMT}/Budgets/QueryByIds`, account, { AccountId: acct, BudgetIds: null }, 'ms budgets');
  if (!b.ok) throw Object.assign(new Error(`Microsoft budgets query failed: ${msErrorMessage(b.body, b.status)}`), { code: 'ms_budgets' });
  return { campaigns: c.body.Campaigns || [], budgets: b.body.Budgets || [] };
}

const LIVE = new Set(['Active', 'BudgetPaused']);

export async function ingestMicrosoft(q, account, from, to, { snapshots = true, runId = null, maxWaitMs = 200000 } = {}) {
  const aid = String(account.account_id);
  const today = todayIn(account.timezone || 'America/New_York');
  const out = { rows: 0, campaigns: 0, budgets: 0, pending: null };

  if (snapshots) {
    const { campaigns, budgets } = await fetchCampaignsAndBudgets(account);
    const pools = new Map(budgets.map((b) => [String(b.Id), b]));
    out.campaigns += await syncCampaigns(q, 'microsoft', aid, campaigns.map((c) => ({
      campaign_id: c.Id, name: c.Name, status: c.Status, channel_type: c.CampaignType, channel_sub_type: c.SubType || null,
      budget_id: c.BudgetId ? String(c.BudgetId) : null, first_seen: today, last_seen: today,
    })), today);
    await upsert(q, 'campaign_budget_daily', campaigns.map((c) => {
      const pool = c.BudgetId ? pools.get(String(c.BudgetId)) : null;
      return {
        platform: 'microsoft', account_id: aid, campaign_id: String(c.Id), snapshot_date: today,
        budget_id: c.BudgetId ? String(c.BudgetId) : `campaign:${c.Id}`,
        amount: pool ? num(pool.Amount) : num(c.DailyBudget), is_shared: !!c.BudgetId,
        budget_status: pool ? 'Active' : null, campaign_status: c.Status, budget_scope: 'campaign',
      };
    }));
    const liveByPool = new Map();
    for (const c of campaigns) if (c.BudgetId && LIVE.has(c.Status)) liveByPool.set(String(c.BudgetId), (liveByPool.get(String(c.BudgetId)) || 0) + 1);
    out.budgets += await upsert(q, 'budgets', budgets.map((b) => ({
      platform: 'microsoft', account_id: aid, budget_id: String(b.Id), name: b.Name, is_shared: true, status: 'Active', period: b.BudgetType || null, delivery_method: null,
    })));
    await upsert(q, 'shared_budget_daily', budgets.map((b) => ({
      platform: 'microsoft', account_id: aid, budget_id: String(b.Id), snapshot_date: today, name: b.Name, amount: num(b.Amount), status: 'Active',
      association_count: num(b.AssociationCount), active_campaign_count: liveByPool.get(String(b.Id)) || 0,
    })));
  }

  const reportRequestId = await submitReport(account, from, to);
  const started = Date.now();
  let st = { status: 'Pending', url: null };
  while (Date.now() - started < maxWaitMs) {
    st = await pollReport(account, reportRequestId);
    if (st.status === 'Success' || st.status === 'Error') break;
    await sleep(5000);
  }
  if (st.status === 'Error') throw Object.assign(new Error('Microsoft report generation failed (status Error)'), { code: 'ms_report_error' });
  if (st.status !== 'Success') { out.pending = reportRequestId; return out; }
  out.rows += await loadReportRows(q, account, await downloadReport(st.url), { today, runId });
  return out;
}

export async function loadReportRows(q, account, rows, { today, runId = null }) {
  const aid = String(account.account_id);
  const camps = new Map();
  for (const r of rows) {
    const c = camps.get(r.campaign_id) || { campaign_id: r.campaign_id, name: r.campaign_name, status: r.campaign_status, first_seen: r.date, last_seen: r.date };
    if (r.date < c.first_seen) c.first_seen = r.date;
    if (r.date > c.last_seen) c.last_seen = r.date;
    camps.set(r.campaign_id, c);
  }
  await syncCampaigns(q, 'microsoft', aid, [...camps.values()], today);
  return upsert(q, 'ad_daily', rows.map((r) => ({
    platform: 'microsoft', account_id: aid, campaign_id: r.campaign_id, date: r.date,
    cost: r.spend, clicks: r.clicks, impressions: r.impressions,
    all_conversions: r.all_conversions ?? r.conversions, conversions: r.conversions, conversions_value: null,
    search_impression_share: r.impression_share, is_complete: r.date < today, source: 'api', run_id: runId,
  })));
}

// Finish any report parked by an earlier invocation. Returns the number of runs closed.
export async function drainPending(q, account) {
  const pend = await exec(q, `select run_id, detail from ads.ingest_runs where platform = 'microsoft' and account_id = $1 and status = 'pending_report' order by started_at`, [String(account.account_id)]);
  let closed = 0;
  for (const run of pend) {
    const id = run.detail && run.detail.report_request_id;
    if (!id) { await exec(q, `update ads.ingest_runs set status = 'error', error = 'pending_report without id', finished_at = now() where run_id = $1`, [run.run_id]); continue; }
    try {
      const st = await pollReport(account, id);
      if (st.status === 'Success') {
        const today = todayIn(account.timezone || 'America/New_York');
        const n = await loadReportRows(q, account, await downloadReport(st.url), { today, runId: Number(run.run_id) });
        await exec(q, `update ads.ingest_runs set status = 'ok', rows_upserted = $2, finished_at = now() where run_id = $1`, [run.run_id, n]);
        closed++;
      } else if (st.status === 'Error') {
        await exec(q, `update ads.ingest_runs set status = 'error', error = 'report Error on drain', finished_at = now() where run_id = $1`, [run.run_id]);
        closed++;
      }
    } catch (err) {
      await exec(q, `update ads.ingest_runs set status = 'error', error = $2, finished_at = now() where run_id = $1`, [run.run_id, String(err.message).slice(0, 2000)]);
      closed++;
    }
  }
  return closed;
}
