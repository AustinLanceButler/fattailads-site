// Integration test against a real Postgres (set PG_TEST_URL; skipped otherwise):
//   PG_TEST_URL=postgres://user@localhost:5432/postgres node --test test/integration.test.mjs
// Exercises the migration, seed, campaign sync + rename history, fact upserts, the
// sheet-contract projection, budget pools, reconciliation and health, end to end.
import { test, mock } from 'node:test';
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
  const { MIGRATIONS } = await import('../db/migrations/index.mjs');
  assert.equal((await q.query('select count(*)::int as n from ads.schema_migrations'))[0].n, MIGRATIONS.length);
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
  await W.upsert(db, 'conversion_actions', [{ platform: 'google', account_id: '1111111111', action_id: 'sv', name: 'Store visits', category: 'STORE_VISIT' }, { platform: 'google', account_id: '1111111111', action_id: 'qq', name: 'Get a Quick Quote' }, { platform: 'google', account_id: '1111111111', action_id: 'pc', name: 'First Time Phone Call', primary_for_goal: false }]);
  await q.query(`update ads.conversion_actions set report_label = 'Get a Quick Quote' where action_id = 'qq'`);
  await q.query(`update ads.conversion_actions set report_label = 'First Time Phone Call' where action_id = 'pc'`);
  await W.upsert(db, 'conversions_daily', [
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', action_id: 'sv', category: 'STORE_VISIT', all_conversions: 7.33, conversions: 0 },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', action_id: 'qq', category: 'LEAD', all_conversions: 2, conversions: 2 },
    // secondary (non-primary) action: conversions = 0, Funnel reports all_conversions
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', date: '2026-10-03', action_id: 'pc', category: 'PHONE_CALL_LEAD', all_conversions: 3, conversions: 0 },
  ]);
  await W.upsert(db, 'budgets', [{ platform: 'google', account_id: '1111111111', budget_id: 'b1', name: 'Dade pool', is_shared: true, status: 'ENABLED' }]);
  await W.upsert(db, 'campaign_budget_daily', [
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', snapshot_date: '2026-10-01', budget_id: 'b1', amount: 300, is_shared: true, campaign_status: 'ENABLED', budget_scope: 'campaign' },
    { platform: 'google', account_id: '1111111111', campaign_id: 'c1', snapshot_date: '2026-10-03', budget_id: 'b1', amount: 401.15, is_shared: true, campaign_status: 'ENABLED', budget_scope: 'campaign' },
  ]);

  // sheet contract (today = 2026-10-04 → the partial 10-04 row must be excluded)
  const feeds = await W.listFeeds(db);
  const google = feeds.find((f) => f.tab.startsWith('Google'));
  // Feeds read only the view columns their spec names; add the label columns to see them.
  const convCols = ['conv:Get a Quick Quote', 'conv:First Time Phone Call', 'conv_total'];
  const { rows } = await queryFeedRows(db, { ...google, columns: [...google.columns, ...convCols] }, today);
  assert.deepEqual(rows.map((r) => [r.date, r.campaign, Number(r.cost)]), [
    ['2026-10-02', 'Brand - Dade - 0804 - Maximize Store Visits', 73.13],
    ['2026-10-03', 'Brand - Dade - 0804 - Maximize Store Visits', 2.31],
    ['2026-10-03', 'PMax - Generic - Broward', 10.5],
  ]);
  const r1003 = rows[1];
  assert.equal(r1003.daily_budget_text, 'USD401.15/day');
  assert.equal(rows[0].daily_budget_text, 'USD300.00/day', 'budget as of 10-02 is the 10-01 snapshot');
  assert.equal(Number(r1003.store_visits), 7.33);
  assert.deepEqual(r1003.conv_by_label, { 'Get a Quick Quote': 2, 'First Time Phone Call': 3 }, 'labeled columns sum all_conversions, so a secondary action still counts');
  assert.equal(Number(r1003.labeled_conv_total), 5);
  const projected = projectRow(r1003, google.columns);
  assert.deepEqual(projected, [46298, 'Brand - Dade - 0804 - Maximize Store Visits', 2.31, 2, 6, 1, 7.33, 0.5, 'USD401.15/day']);
  assert.deepEqual(projectRow(r1003, convCols), [2, 3, 5]);
  // The narrow read (spec columns + date only) projects to the same cells as the wide one.
  const { rows: lean } = await queryFeedRows(db, google, today);
  assert.deepEqual(Object.keys(lean[0]).sort(), [...google.columns].sort());
  assert.deepEqual(lean.map((r) => projectRow(r, google.columns)), rows.map((r) => projectRow(r, google.columns)));
  // A spec column the view doesn't have still projects to a blank cell.
  const { rows: odd } = await queryFeedRows(db, { ...google, columns: ['date', 'no_such_column', 'blank', 'cost'] }, today);
  assert.deepEqual(projectRow(odd[0], ['date', 'no_such_column', 'blank', 'cost']), [46297, '', '', 73.13]);
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

  // campaign_dims feed (0005): store-number markets, leading zeros, roll-ups, unmapped spend
  await W.applySeed(db, {
    stores: [
      { client_id: 'acme', store_number: '0391', market: 'Miami Dade' },
      { client_id: 'acme', store_number: '1254', market: 'Palm Beach North' },
    ],
    market_rollups: [{ client_id: 'acme', market: 'Palm Beach North', pacing_market: 'Palm Beach' }],
    campaign_name_rules: [
      { client_id: 'acme', priority: 10, channel: 'Search', tactic: 'Brand', store_group: 1,
        pattern: '^Brand[[:space:]\\u00a0]+-.*[[:space:]\\u00a0]-[[:space:]\\u00a0]+([0-9]{2,4})(?:[[:space:]\\u00a0]+-|[[:space:]\\u00a0]*$)' },
      { client_id: 'acme', platform: 'google', priority: 20, channel: 'PMax', tactic: '-', market_group: 1, pattern: '^PMax - .* - (Dade|Broward)$' },
    ],
  });
  await W.syncCampaigns(db, 'google', '1111111111', [
    { campaign_id: 'd1', name: 'Brand - Dade - 391 - Maximize Store Visits', status: 'ENABLED', channel_type: 'SEARCH', first_seen: today, last_seen: today },
    { campaign_id: 'd2', name: 'Brand - Palm Beach North - 1254 -  Maximize Store Visits', status: 'ENABLED', channel_type: 'SEARCH', first_seen: today, last_seen: today },
    { campaign_id: 'd3', name: 'Brand - South Carolina - 3342', status: 'ENABLED', channel_type: 'SEARCH', first_seen: today, last_seen: today },
    { campaign_id: 'd4', name: 'Demand Gen - Test', status: 'ENABLED', channel_type: 'DEMAND_GEN', first_seen: today, last_seen: today },
  ], today);
  await W.upsert(db, 'ad_daily', ['d1', 'd2', 'd3', 'd4'].map((c, i) => (
    { platform: 'google', account_id: '1111111111', campaign_id: c, date: '2026-10-03', cost: i + 1, clicks: 1, impressions: 1, is_complete: true, source: 'api' })));
  const ddims = await q.query(`select campaign_id, market, store_number, store_on_roster from ads.campaign_dims where campaign_id like 'd%' order by campaign_id`);
  assert.deepEqual(ddims, [
    { campaign_id: 'd1', market: 'Miami Dade', store_number: '0391', store_on_roster: true },
    { campaign_id: 'd2', market: 'Palm Beach North', store_number: '1254', store_on_roster: true },
    { campaign_id: 'd3', market: null, store_number: '3342', store_on_roster: false },
    { campaign_id: 'd4', market: null, store_number: null, store_on_roster: false },
  ]);
  const cfeed = { feed_id: 0, spreadsheet_id: 'SHEET', tab: 'Media Daily (SB)', source: 'campaign_dims', window_rule: 'from:2026-10-03', min_rows: 1,
    accounts: [{ platform: 'google', account_id: '1111111111' }],
    columns: ['date', 'platform_label', 'channel', 'tactic', 'pacing_market', 'market', 'store_number', 'campaign', 'cost', 'campaign_id', 'dims_source'] };
  const { rows: crows } = await queryFeedRows(db, cfeed, '2026-10-04');
  const byId = Object.fromEntries(crows.map((r) => [r.campaign_id, projectRow(r, cfeed.columns).slice(1)]));
  assert.deepEqual(byId.d1, ['Google', 'Search', 'Brand', 'Miami Dade', 'Miami Dade', '0391', 'Brand - Dade - 391 - Maximize Store Visits', 1, 'd1', 'roster']);
  assert.deepEqual(byId.d2, ['Google', 'Search', 'Brand', 'Palm Beach', 'Palm Beach North', '1254', 'Brand - Palm Beach North - 1254 -  Maximize Store Visits', 2, 'd2', 'roster']);
  assert.deepEqual(byId.d3, ['Google', 'Search', 'Brand', '(unmapped store)', '(unmapped store)', '3342', 'Brand - South Carolina - 3342', 3, 'd3', 'unmapped store']);
  assert.deepEqual(byId.d4, ['Google', '(unmapped)', '-', '(unmapped)', '(unmapped)', '', 'Demand Gen - Test', 4, 'd4', 'unmapped']);
  assert.equal(byId.c2[1], 'PMax', 'market-level rule: market from the name token');
  assert.equal(byId.c2[3], 'Broward');
  assert.equal(byId.c2[9], 'rule');
  // every row of the window is present, mapped or not
  const total = Number((await q.query(`select sum(cost) s from ads.v_feed_daily where date = '2026-10-03' and account_id = '1111111111'`))[0].s);
  assert.equal(crows.filter((r) => r.date === '2026-10-03').reduce((s, r) => s + Number(r.cost), 0).toFixed(2), total.toFixed(2));

  // runs + health + alerts (no ClickUp env → DB rows only)
  const runId = await W.startRun(db, { job: 'google', platform: 'google', account_id: '1111111111', window_from: '2026-08-30', window_to: today });
  await W.finishRun(db, runId, { status: 'ok', rows: 4, detail: { ms: 1 } });
  // checkHealth judges staleness against the wall clock; pin it to the fixture's
  // day so the test doesn't start failing once the fixed dates fall behind.
  mock.timers.enable({ apis: ['Date'], now: Date.parse(`${today}T16:00:00Z`) });
  let health;
  try {
    health = await checkHealth(db, { notify: false });
  } finally {
    mock.timers.reset();
  }
  assert.equal(health.accounts.find((a) => a.platform === 'google').ok, true);
  assert.equal(health.accounts.find((a) => a.platform === 'microsoft').ok, false, 'no runs/rows for microsoft');
  const a1 = await raiseAlert(db, { job: 't', dedupe_key: 'k', message: 'first' });
  const a2 = await raiseAlert(db, { job: 't', dedupe_key: 'k', message: 'again' });
  assert.equal(a1.deduped, false);
  assert.equal(a2.deduped, true);
  assert.equal(await clearAlert(db, 'k'), 2);
}

// 0006 on a database already at 0005 (with rows), then a TikTok ingest through the
// real SQL: depth columns, ad-group grain, the re-created views, fallback semantics.
test('tiktok depth: 0005 → 0006 upgrade and ingest on Postgres', { skip: !url && 'PG_TEST_URL not set' }, async () => {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await runTikTok(client);
  } finally {
    await client.end();
  }
});

async function runTikTok(client) {
  await client.query('drop schema if exists ads cascade');
  const q = { query: async (text, params = []) => (await client.query(text, params)).rows };
  const W = await import('../api/_lib/warehouse.mjs');
  const { MIGRATIONS } = await import('../db/migrations/index.mjs');
  const { queryFeedRows, projectRow } = await import('../api/_lib/feeds.mjs');
  const { ingestTikTok } = await import('../api/_lib/ingest/tiktok.mjs');
  const fx = await import('./fixtures/tiktok.mjs');

  // A warehouse as production has it today: 0001–0005 applied, rows present.
  const before = MIGRATIONS.filter((m) => m.id < '0006');
  await q.query('create schema if not exists ads');
  await q.query('create table if not exists ads.schema_migrations (id text primary key, applied_at timestamptz not null default now())');
  for (const m of before) { for (const s of m.statements) await q.query(s); await q.query('insert into ads.schema_migrations (id) values ($1)', [m.id]); }
  await q.query(`insert into ads.clients (client_id, display_name) values ('acme', 'Acme')`);
  await q.query(`insert into ads.ad_accounts (platform, account_id, client_id, label, feed_source_tag) values
    ('tiktok', $1, 'acme', 'Acme TikTok', 'tiktok'), ('google', '1111111111', 'acme', 'Acme Google', 'adwords')`, [fx.ADVERTISER]);
  await q.query(`insert into ads.ad_daily (platform, account_id, campaign_id, date, cost, clicks, impressions) values
    ('google', '1111111111', 'g1', '2026-11-02', 10, 1, 100), ('tiktok', $1, $2, '2026-11-01', 300, 700, 50000)`, [fx.ADVERTISER, fx.CAMPAIGN]);

  W.useClient(() => q);
  const db = await W.wh();
  assert.deepEqual((await q.query(`select id from ads.schema_migrations order by id`)).map((r) => r.id), MIGRATIONS.map((m) => m.id));
  const old = await q.query(`select platform, cost::float8 as cost, reach, video_views_p100 from ads.ad_daily order by platform`);
  assert.deepEqual(old, [{ platform: 'google', cost: 10, reach: null, video_views_p100: null }, { platform: 'tiktok', cost: 300, reach: null, video_views_p100: null }]);

  await W.applySeed(db, { campaign_name_rules: [{ client_id: 'acme', platform: 'tiktok', priority: 10, pattern: '^Launch Campaign', channel: 'TikTok', tactic: 'Traffic', market: 'All Markets' }] });

  const real = globalThis.fetch;
  try {
    globalThis.fetch = fx.fakeTikTokFetch().fetch;
    const account = (await W.listAccounts(db, { platform: 'tiktok' }))[0];
    const out = await ingestTikTok(db, account, '2026-11-02', '2026-11-03', { token: 't', runId: 1 });
    assert.equal(out.rows, 2);
    assert.equal(out.adgroup_rows, 2);
    assert.equal(out.depth_error, undefined);

    const d = await q.query(`select date::text, reach, frequency::float8 as frequency, video_play_actions, video_views_p100, engaged_view, average_video_play::float8 as avp
      from ads.ad_daily where platform = 'tiktok' and date >= '2026-11-02' order by date`);
    assert.deepEqual(d, [
      { date: '2026-11-02', reach: '30100', frequency: 1.70, video_play_actions: '49800', video_views_p100: '360', engaged_view: '2400', avp: 2.20 },
      { date: '2026-11-03', reach: '26800', frequency: 1.88, video_play_actions: '48700', video_views_p100: '400', engaged_view: '2460', avp: 2.75 },
    ]);

    // Re-ingest where TikTok refuses a depth metric: cost restates, stored depth survives.
    globalThis.fetch = fx.fakeTikTokFetch({ reject: 'reach' }).fetch;
    const out2 = await ingestTikTok(db, account, '2026-11-02', '2026-11-03', { token: 't', runId: 2 });
    assert.match(out2.depth_error, /Invalid metric: reach/);
    const kept = await q.query(`select reach, run_id from ads.ad_daily where platform = 'tiktok' and date = '2026-11-02'`);
    assert.deepEqual(kept, [{ reach: '30100', run_id: '2' }]);
  } finally {
    globalThis.fetch = real;
  }

  // ad-group dimension: listing status kept, first_seen = create date, last_seen ≥ report day
  const [ag] = await q.query(`select name, status, campaign_id, first_seen::text, last_seen::text from ads.adgroups`);
  assert.equal(ag.name, 'Ad Group 1');
  assert.equal(ag.status, 'ENABLE');
  assert.equal(ag.campaign_id, fx.CAMPAIGN);
  assert.equal(ag.first_seen, '2026-10-20');
  assert.ok(ag.last_seen >= '2026-11-03');

  const agv = await q.query(`select adgroup, campaign, date::text, cost::float8 as cost, reach, channel, market from ads.v_adgroup_daily order by date`);
  assert.deepEqual(agv.map((r) => [r.adgroup, r.campaign, r.date, r.cost, r.reach, r.channel, r.market]), [
    ['Ad Group 1', 'Launch Campaign', '2026-11-02', 210.40, '30100', 'TikTok', 'All Markets'],
    ['Ad Group 1', 'Launch Campaign', '2026-11-03', 215.90, '26800', 'TikTok', 'All Markets'],
  ]);

  // Feeds: v_feed_daily, the re-created v_campaign_dims_daily and v_campaign_daily all carry depth.
  const feed = { feed_id: 0, spreadsheet_id: 'S', tab: 'TikTok Data (SB)', window_rule: 'from:2026-11-01', min_rows: 1,
    accounts: [{ platform: 'tiktok', account_id: fx.ADVERTISER }],
    columns: ['date', 'campaign', 'cost', 'clicks', 'impressions', 'reach', 'frequency', 'video_play_actions', 'video_views_p25', 'video_views_p50', 'video_views_p75', 'video_views_p100', 'engaged_view', 'average_video_play'] };
  const { rows } = await queryFeedRows(db, feed, '2026-11-04');
  assert.deepEqual(projectRow(rows[0], feed.columns).slice(1), ['Launch Campaign', 300, 700, 50000, '', '', '', '', '', '', '', '', ''], 'pre-0006 row: depth blank, not 0');
  assert.deepEqual(projectRow(rows[1], feed.columns).slice(1), ['Launch Campaign', 210.40, 610, 51200, 30100, 1.70, 49800, 1800, 1050, 690, 360, 2400, 2.20]);
  const { rows: drows } = await queryFeedRows(db, { ...feed, source: 'campaign_dims', columns: [...feed.columns, 'platform_label', 'channel', 'pacing_market', 'dims_source'] }, '2026-11-04');
  assert.deepEqual(projectRow(drows[2], ['platform_label', 'channel', 'pacing_market', 'reach', 'engaged_view', 'dims_source']), ['TikTok', 'TikTok', 'All Markets', 26800, 2460, 'rule']);
  const [cd] = await q.query(`select reach, channel from ads.v_campaign_daily where platform = 'tiktok' and date = '2026-11-03'`);
  assert.deepEqual(cd, { reach: '26800', channel: 'TikTok' });

  // v_media_daily sums the additive video counts and carries no reach/frequency.
  const cols = (await q.query(`select column_name from information_schema.columns where table_schema = 'ads' and table_name = 'v_media_daily'`)).map((r) => r.column_name);
  assert.ok(cols.includes('video_views_p100') && cols.includes('engaged_view'));
  assert.ok(!cols.includes('reach') && !cols.includes('frequency') && !cols.includes('average_video_play'), 'non-additive metrics are never summed');
  const md = await q.query(`select sum(video_play_actions)::int as plays, sum(spend)::float8 as spend from ads.v_media_daily where platform = 'tiktok' and date between '2026-11-02' and '2026-11-03'`);
  assert.deepEqual(md, [{ plays: 49800 + 48700, spend: 426.30 }]);

  await W.wh(); // idempotent once 0006 is recorded
}
