// POST /api/admin/ingest — operator entry point for the ads warehouse.
// Auth: `Authorization: Bearer $INGEST_ADMIN_SECRET`. Body: { action, ...params }.
//
//   probe            → what the stored credentials can see (Google MCC clients, Meta
//                      ad accounts, Microsoft campaigns per configured account) + env flags
//   seed             → { seed: {...} } upsert clients / ad_accounts / sheet_feeds / stores /
//                      market_aliases / campaign_name_rules / conversion_labels (see db/seed.example.json)
//   run              → { platform, account_id?, from?, to?, snapshots? } one ingest pass
//   push_sheets      → { feed_id?, dry_run? }
//   archive_funnel   → { spreadsheet_id, tab, preset, source_tag?, account_id?, source_accounts? }
//   health           → { notify? } run the staleness check
//   query            → { sql } read-only SELECT, ≤ 500 rows (ops convenience until the MCP is wired)
//   simulate_alert   → raise a test alert (exercises the ClickUp path)

import { allowMethods, readBody, sendError, sendJson } from '../_lib/http.mjs';
import { requireAdminSecret } from '../_lib/cron-auth.mjs';
import { wh, exec, applySeed, listAccounts } from '../_lib/warehouse.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';
import { probeAccess } from '../_lib/ingest/google-ads.mjs';
import { probeMeta } from '../_lib/ingest/meta.mjs';
import { fetchCampaignsAndBudgets } from '../_lib/ingest/microsoft-ads.mjs';
import { pushAllFeeds } from '../_lib/feeds.mjs';
import { loadFunnelTab } from '../_lib/archive.mjs';
import { checkHealth } from '../_lib/health.mjs';
import { raiseAlert } from '../_lib/alerts.mjs';
import { isYmd } from '../_lib/dates.mjs';
import { saConfigured, saKeyShape } from '../_lib/sheets.mjs';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!requireAdminSecret(req, res)) return;
  const body = readBody(req);
  const action = String(body.action || '');
  const started = Date.now();
  try {
    const q = await wh();
    let out;
    switch (action) {
      case 'probe': out = await probe(q); break;
      case 'seed': {
        if (!body.seed || typeof body.seed !== 'object') return sendError(res, 400, 'invalid_input', 'Provide seed object.');
        out = await applySeed(q, body.seed);
        break;
      }
      case 'run': {
        const platform = String(body.platform || '');
        if (!['google', 'microsoft', 'meta'].includes(platform)) return sendError(res, 400, 'invalid_input', 'platform must be google | microsoft | meta.');
        for (const k of ['from', 'to']) if (body[k] && !isYmd(body[k])) return sendError(res, 400, 'invalid_input', `${k} must be YYYY-MM-DD.`);
        out = { results: await runPlatform(platform, { account_id: body.account_id ? String(body.account_id) : null, from: body.from || null, to: body.to || null, snapshots: body.snapshots !== false, job: body.job || null }) };
        break;
      }
      case 'push_sheets': out = await pushAllFeeds(q, { feed_id: body.feed_id ? Number(body.feed_id) : null, dryRun: !!body.dry_run }); break;
      case 'archive_funnel': {
        if (!body.spreadsheet_id || !body.tab || !body.preset) return sendError(res, 400, 'invalid_input', 'spreadsheet_id, tab and preset are required.');
        out = await loadFunnelTab(q, { spreadsheetId: String(body.spreadsheet_id), tab: String(body.tab), preset: String(body.preset), sourceTag: body.source_tag || 'adwords', accountId: body.account_id ? String(body.account_id) : null, sourceAccounts: body.source_accounts || null });
        break;
      }
      case 'health': out = await checkHealth(q, { notify: body.notify !== false }); break;
      case 'query': {
        const sql = String(body.sql || '').trim();
        if (!/^(select|with)\b/i.test(sql) || /;\s*\S/.test(sql)) return sendError(res, 400, 'invalid_input', 'Single SELECT/WITH statement only.');
        await exec(q, "set statement_timeout = '20s'");
        const rows = await exec(q, `select * from (${sql.replace(/;\s*$/, '')}) _q limit 500`);
        out = { rows, count: rows.length };
        break;
      }
      case 'simulate_alert': out = await raiseAlert(q, { job: 'admin', dedupe_key: `test:${Date.now()}`, message: body.message || 'Test alert from /api/admin/ingest', detail: { by: 'admin' }, severity: 'info' }); break;
      default: return sendError(res, 400, 'invalid_input', `Unknown action '${action}'.`);
    }
    return sendJson(res, { action, ms: Date.now() - started, ...out });
  } catch (err) {
    console.error('[admin/ingest]', action, err);
    return sendError(res, 500, err.code || 'server_error', String(err.message).slice(0, 800));
  }
}

async function probe(q) {
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    CRON_SECRET: !!process.env.CRON_SECRET,
    INGEST_ADMIN_SECRET: !!process.env.INGEST_ADMIN_SECRET,
    FTA_MSADS_DEVELOPER_TOKEN: !!process.env.FTA_MSADS_DEVELOPER_TOKEN,
    META_ADS_TOKEN: !!process.env.META_ADS_TOKEN,
    GOOGLE_SA: saConfigured(),
    CLICKUP_ALERTS: !!(process.env.CLICKUP_API_TOKEN && process.env.ALERT_CLICKUP_LIST_ID),
    CONNECT_GOOGLE_ADS_MCC: process.env.CONNECT_GOOGLE_ADS_MCC || '(default 673-311-0705)',
  };
  const out = { env, google_sa_key: env.GOOGLE_SA ? saKeyShape() : null };
  const [migrations, accounts] = await Promise.all([
    exec(q, 'select id, applied_at from ads.schema_migrations order by applied_at'),
    listAccounts(q, { includeDisabled: true }),
  ]);
  out.migrations = migrations;
  out.accounts = accounts.map((a) => ({ platform: a.platform, account_id: a.account_id, label: a.label, enabled: a.enabled, parent_id: a.parent_id, timezone: a.timezone }));
  try { out.google = { mcc_clients: await probeAccess() }; } catch (err) { out.google = { error: err.message }; }
  if (env.META_ADS_TOKEN) { try { out.meta = await probeMeta(); } catch (err) { out.meta = { error: err.message }; } } else out.meta = { skipped: 'META_ADS_TOKEN not set' };
  out.microsoft = [];
  for (const a of accounts.filter((x) => x.platform === 'microsoft')) {
    try {
      const { campaigns, budgets } = await fetchCampaignsAndBudgets(a);
      out.microsoft.push({ account_id: a.account_id, label: a.label, campaigns: campaigns.length, shared_budgets: budgets.map((b) => ({ id: b.Id, name: b.Name, amount: b.Amount, associations: b.AssociationCount })) });
    } catch (err) { out.microsoft.push({ account_id: a.account_id, label: a.label, error: err.message }); }
  }
  return out;
}
