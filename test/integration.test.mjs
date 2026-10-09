// Integration test against a real Postgres (set PG_TEST_URL; skipped otherwise):
//   PG_TEST_URL=postgres://user@localhost:5432/postgres node --test test/integration.test.mjs
// Exercises the migration, seed, campaign sync + rename history, fact upserts, the
// sheet-contract projection, budget pools, reconciliation and health, end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.PG_TEST_URL;

test('warehouse end-to-end on Postgres', { skip: !url && 'PG_TEST_URL not set' }, async () => {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
});

async function run(client) {
  await client.query('drop schema if exists ads cascade');
  const q = { query: async (text, params = []) => (await client.query(text, params)).rows };

  const W = await import('../api/_lib/warehouse.mjs');
  const { queryFeedRows, projectRow, pushFeed } = await import('../api/_lib/feeds.mjs');
  const { checkHealth } = await import('../api/_lib/health.mjs');
  const { raiseAlert, clearAlert } = await import('../api/_lib/alerts.mjs');
  W.useClient(() => q);
  const db = await W.wh();
  assert.equal((await q.query('select count(*)::int as n from ads.schema_migrations'))[0].n, 1);
  await W.wh(); // idempotent second call

  // seed
  const seed = {
    clients: [{ client_id: 'acme', display_name: 'Acme' }],
    ad_accounts: [
      { platform: 'google', account_id: '1111111111', client_id: 'acme', label: 'Acme Google', feed_source_tag: 'adwords' },
      { platform: 'microsoft', account_id: '2222', client_id: 'acme', label: 'Acme Bing', parent_id: '999', feed_source_tag: 'bing', timezone: 'America/Chicago' },
    ],
    sheet_feeds: [
      { client_id: 'acme', spreadsheet_id: 'SHEET', tab: 'Google Ads Data (SB)', accounts: [{ platform: 'google', account_id: '1111111111' }],
        columns: ['date', 'campaign', 'cost', 'clicks', 'impressions', 'all_conv', 'store_visits', 'search_is', 'daily_budget_text'],
        header: ['Date', 'Campaign', 'Cost', 'Clicks', 'Impressions', 'All Conv.', 'Store visits', 'Search Impr. share', 'Daily Budget'], window_rule: 'from:2026-01-01', min_rows: 1 },
      { client_id: 'acme', spreadsheet_id: 'SHEET', tab: 'Bing Budgets', accounts: [{ platform: 'microsoft', account_id: '2222' }],
        columns: ['as_of', 'budget_key', 'name', 'is_shared', 'amount', 'live_campaigns'], window_rule: 'budgets_current', min_rows: 1 },
    ],
    stores: [{ client_id: 'acme', store_number: '0804', market: 'Broward' }],
    market_aliases: [{ client_id: 'acme', alias: 'Dade', market: 'Miami Dade' }],
    campaign_name_rules: [
      { client_id: 'acme', platform: 'google', priority: 10, pattern: '^(Brand|Non Brand|Conquesting) - ([A-Za-z ]+?) - (\\d{3,4})', tactic: null, market_group: 2, store_group: 3, channel: 'search' },
      { client_id: 'acme', platform: 'google', priority: 20, pattern: '^PMax - .* - ([A-Za-z ]+)$', channel: 'pmax', market_group: 1 },
    ],
  };
  const seeded = await W.applySeed(db, seed);
  assert.equal(seeded.ad_accounts, 2);
  await q.query(`update ads.campaign_name_rules set tactic = null`); // tactic derived separately below

  // campaigns + rename history
  const today = '2026-10-04';
  await W.syncCampaigns(db, 'google', '1111111111', [
    { campaign_id: 'c1', name: 'Brand - Dade - 0804 - Maximize Store Visits', status: 'ENABLED', channel_type: 'SEARCH', budget_id: 'b1', first_seen: '2026-09-01', last_seen: today },
    { campaign_id: 'c2', name: 'PMax - Generic - Broward', status: 'ENABLED', channel_type: 'PERFORMANCE_MAX', budget_id: 'b2', first_seen: '2026-09-01', last_seen: today },
  ], today);
  await W.syncCampaigns(db, 'google', '1111111111', [
    { campaign_id: 'c1', name: 'Brand - Dade - 0804 - Store Visits v2', status: 'ENABLED', channel_type: 'SEARCH', budget_id: 'b1', first_seen: today, last_seen: today },
  ], '2026-10-05');
  const hist = await q.query(`select name, valid_from::text, valid_to::text from ads.campaign_name_history where campaign_id = 'c1' order by valid_from`);
  assert.deepEqual(hist, [
    { name: 'Brand - Dade - 0804 - Maximize Store Visits', valid_from: '2026-09-01', valid_to: '2026-10-05' },
    { name: 'Brand - Dade - 0804 - Store Visits v2', valid_from: '2026-10-05', valid_to: null },
  ]);

  // facts
  await W.upsert(db, 'ad_daily', [
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-02', cost: 73.132915, clicks: 15, impressions: 62, all_conversions: 0.33, search_impression_share: 0.476923, is_complete: true, source: 'api' },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', cost: 2.31, clicks: 2, impressions: 6, all_conversions: 1, search_impression_share: 0.5, is_complete: true, source: 'api' },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-04', cost: 1, clicks: 1, impressions: 1, is_complete: false, source: 'api' },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c2', date: '2026-10-03', cost: 10.5, clicks: 3, impressions: 100, is_complete: true, source: 'api' },
  ]);
  // re-upsert restates cost
  await W.upsert(db, 'ad_daily', [{ platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', cost: 2.31, clicks: 2, impressions: 6, all_conversions: 1, search_impression_share: 0.5, is_complete: true, source: 'api' }]);
  assert.equal((await q.query(`select count(*)::int n from ads.ad_daily`))[0].n, 4);
  await W.upsert(db, 'conversion_actions', [{ platform: 'google', account_id: '1111111111', action_id: 'sv', name: 'Store visits', category: 'STORE_VISIT' }, { platform: 'google', account_id: '1111111111', action_id: 'qq', name: 'Get a Quick Quote' }]);
  await q.query(`update ads.conversion_actions set report_label = 'Get a Quick Quote' where action_id = 'qq'`);
  await W.upsert(db, 'conversions_daily', [
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', action_id: 'sv', category: 'STORE_VISIT', all_conversions: 7.33, conversions: 0 },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', action_id: 'qq', category: 'LEAD', all_conversions: 2, conversions: 2 },
  ]);
  await W.upsert(db, 'budgets', [{ platform: 'google', account_id: '1111111111', budget_id: 'b1', name: 'Dade pool', is_shared: true, status: 'ENABLED' }]);
  await W.upsert(db, 'campaign_budget_daily', [
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', snapshot_date: '2026-10-01', budget_id: 'b1', amount: 300, is_shared: true, campaign_status: 'ENABLED', budget_scope: 'campaign' },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', snapshot_date: '2026-10-03', budget_id: 'b1', amount: 401.15, is_shared: true, campaign_status: 'ENABLED', budget_scope: 'campaign' },
  ]);

  // sheet contract (today = 2026-10-04 → the partial 10-04 row must be excluded)
  const feeds = await W.listFeeds(db);
  const google = feeds.find((f) => f.tab.startsWith('Google'));
  const { rows } = await queryFeedRows(db, google, today);
  assert.deepEqual(rows.map((r) => [r.date, r.campaign, Number(r.cost)]), [
    ['2026-10-02', 'Brand - Dade - 0804 - Maximize Store Visits', 73.13],
    ['2026-10-03', 'Brand - Dade - 0804 - Maximize Store Visits', 2.31],
    ['2026-10-03', 'PMax - Generic - Broward', 10.5],
  ]);
  const r1003 = rows[1];
  assert.equal(r1003.daily_budget_text, 'USD401.15/day');
  assert.equal(rows[0].daily_budget_text, 'USD300.00/day', 'budget as of 10-02 is the 10-01 snapshot');
  assert.equal(Number(r1003.store_visits), 7.33);
  assert.deepEqual(r1003.conv_by_label, { 'Get a Quick Quote': 2 });
  const projected = projectRow(r1003, google.columns);
  assert.deepEqual(projected, [46298, 'Brand - Dade - 0804 - Maximize Store Visits', 2.31, 2, 6, 1, 7.33, 0.5, 'USD401.15/day']);
  const dry = await pushFeed(db, google, { today, dryRun: true });
  assert.equal(dry.status, 'dry_run');
  assert.equal(dry.rows, 3);
  assert.equal(dry.maxDate, '2026-10-03');

  // dims
  const dims = await q.query(`select campaign_id, channel, market, store_number, dims_source from ads.campaign_dims order by campaign_id`);
  assert.deepEqual(dims, [
    { campaign_id: 'c1', channel: 'search', market: 'Miami Dade', store_number: '0804', dims_source: 'rule' },
    { campaign_id: 'c2', channel: 'pmax', market: 'Broward', store_number: null, dims_source: 'rule' },
  ]);

  // microsoft pools: 2 campaigns on one shared pool + 1 standalone → 2 rows, sum = 161.29
  await W.syncCampaigns(db, 'microsoft', '2222', [
    { campaign_id: 'm1', name: 'Brand - Broward - 0176', status: 'Active', budget_id: 'p1' },
    { campaign_id: 'm2', name: 'Brand - Broward - 0178', status: 'BudgetPaused', budget_id: 'p1' },
    { campaign_id: 'm3', name: 'Brand - PB South - 4281', status: 'Active' },
    { campaign_id: 'm4', name: 'Old', status: 'Paused' },
  ], today);
  await W.upsert(db, 'shared_budget_daily', [{ platform: 'microsoft', account_id: '2222', budget_id: 'p1', snapshot_date: today, name: 'Brand pool', amount: 146.29, active_campaign_count: 2 }]);
  await W.upsert(db, 'campaign_budget_daily', [
    { platform: 'microsoft', account_id: '2222', campaign_id: 'm1', snapshot_date: today, budget_id: 'p1', amount: 146.29, is_shared: true, campaign_status: 'Active' },
    { platform: 'microsoft', account_id: '2222', campaign_id: 'm2', snapshot_date: today, budget_id: 'p1', amount: 146.29, is_shared: true, campaign_status: 'BudgetPaused' },
    { platform: 'microsoft', account_id: '2222', campaign_id: 'm3', snapshot_date: today, budget_id: 'campaign:m3', amount: 15, is_shared: false, campaign_status: 'Active' },
    { platform: 'microsoft', account_id: '2222', campaign_id: 'm4', snapshot_date: today, budget_id: 'campaign:m4', amount: 50, is_shared: false, campaign_status: 'Paused' },
  ]);
  const pools = await q.query(`select name, is_shared, amount::float8 as amount, live_campaigns::int from ads.v_budget_pools_current where account_id = '2222' order by is_shared desc, name`);
  assert.deepEqual(pools, [{ name: 'Brand pool', is_shared: true, amount: 146.29, live_campaigns: 2 }, { name: 'Brand - PB South - 4281', is_shared: false, amount: 15, live_campaigns: 1 }]);
  assert.equal(Number((await q.query(`select sum(amount) s from ads.v_budget_pools_current where account_id = '2222'`))[0].s).toFixed(2), '161.29');
  const bfeed = feeds.find((f) => f.tab === 'Bing Budgets');
  const bdry = await pushFeed(db, bfeed, { today, dryRun: true });
  assert.equal(bdry.rows, 2);

  // reconciliation: archive matches 10-02 exactly, differs on 10-03
  await W.upsert(db, 'funnel_archive', [
    { source_tab: 't', data_source: 'adwords:1111111111', account_id: '1111111111', date: '2026-10-02', campaign: 'Brand - Dade - 0804 - Maximize Store Visits', cost: 73.13, clicks: 15 },
    { source_tab: 't', data_source: 'adwords:1111111111', account_id: '1111111111', date: '2026-10-03', campaign: 'Brand - Dade - 0804 - Maximize Store Visits', cost: 2.0, clicks: 2 },
  ]);
  const rec = await q.query(`select date::text, presence, diff::float8 as diff from ads.v_reconcile_funnel order by date`);
  assert.deepEqual(rec, [{ date: '2026-10-03', presence: 'both', diff: 0.31 }, { date: '2026-10-03', presence: 'api_only', diff: 10.5 }]);

  // runs + health + alerts (no ClickUp env → DB rows only)
  const runId = await W.startRun(db, { job: 'google', platform: 'google', account_id: '1111111111', window_from: '2026-08-30', window_to: today });
  await W.finishRun(db, runId, { status: 'ok', rows: 4, detail: { ms: 1 } });
  const health = await checkHealth(db, { notify: false });
  assert.equal(health.accounts.find((a) => a.platform === 'google').ok, true);
  assert.equal(health.accounts.find((a) => a.platform === 'microsoft').ok, false, 'no runs/rows for microsoft');
  const a1 = await raiseAlert(db, { job: 't', dedupe_key: 'k', message: 'first' });
  const a2 = await raiseAlert(db, { job: 't', dedupe_key: 'k', message: 'again' });
  assert.equal(a1.deduped, false);
  assert.equal(a2.deduped, true);
  assert.equal(await clearAlert(db, 'k'), 2);
}
