// node --test test/  — pure-function checks for the ads warehouse (no network, no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, monthStartMinus, monthChunks, sheetSerial, windowStart, todayIn, isYmd } from '../api/_lib/dates.mjs';
import { parseCsv, num } from '../api/_lib/ingest/http.mjs';
import { parseReportCsv, toYmd, REPORT_COLUMNS, mergeCampaignDays, downloadReport } from '../api/_lib/ingest/microsoft-ads.mjs';
import { projectRow, feedSelectList } from '../api/_lib/feeds.mjs';
import { clearBelowRange, colLetter, gridShortfall, normalizeSaKey, saKeyShape, tabWidth } from '../api/_lib/sheets.mjs';
import crypto from 'node:crypto';
import { MIGRATIONS } from '../db/migrations/index.mjs';
import { assessAccount, runCoversDay, accountsCovered, feedDateStale } from '../api/_lib/health.mjs';
import { conversionLabelConflicts } from '../api/_lib/conversion-labels.mjs';

test('dates: arithmetic and windows', () => {
  assert.equal(addDays('2026-10-04', -35), '2026-08-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(monthStartMinus('2026-10-04', 2), '2026-08-01');
  assert.equal(monthStartMinus('2026-01-15', 2), '2025-11-01');
  assert.equal(windowStart('month_start_minus_2', '2026-10-04'), '2026-08-01');
  assert.equal(windowStart('from:2025-01-01', '2026-10-04'), '2025-01-01');
  assert.equal(windowStart('days:35', '2026-10-04'), '2026-08-30');
  assert.throws(() => windowStart('nonsense', '2026-10-04'));
  assert.deepEqual(monthChunks('2025-11-20', '2026-01-05'), [['2025-11-20', '2025-11-30'], ['2025-12-01', '2025-12-31'], ['2026-01-01', '2026-01-05']]);
  assert.equal(sheetSerial('2026-10-03'), 46298); // matches the serial Funnel wrote for 2026-10-03
  assert.equal(sheetSerial('2025-04-12'), 45759);
  assert.ok(isYmd('2026-02-28') && !isYmd('2026-2-28') && !isYmd('2026-13-01'));
  // 23:30 ET on Oct 3 is Oct 4 UTC; ET must still say Oct 3.
  assert.equal(todayIn('America/New_York', new Date('2026-10-04T03:30:00Z')), '2026-10-03');
});

test('csv: quotes, CRLF, BOM', () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","he said ""hi"""\r\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x, y', 'he said "hi"']]);
  assert.equal(num('1,234.50'), 1234.5);
  assert.equal(num('--'), null);
  assert.equal(num(''), null);
  assert.equal(num('25.00%'), 25);
});

test('microsoft: report csv → rows', () => {
  assert.equal(toYmd('10/3/2026'), '2026-10-03');
  assert.equal(toYmd('2026-10-03'), '2026-10-03');
  assert.equal(toYmd('garbage'), null);
  const csv = [
    [...REPORT_COLUMNS, 'ImpressionSharePercent'].join(','),
    '10/3/2026,2796348,123,"Brand - Broward - 0176",Active,3.08,3,67,0,0,"Brand Pool A",Active,Associated,25.00',
    '10/3/2026,2796348,124,"Brand - Broward - 0178",BudgetPaused,0,0,35,,,,,,--',
    '', // footer blank
  ].join('\n');
  const rows = parseReportCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    date: '2026-10-03', campaign_id: '123', campaign_name: 'Brand - Broward - 0176', campaign_status: 'Active',
    spend: 3.08, clicks: 3, impressions: 67, conversions: 0, all_conversions: 0,
    budget_name: 'Brand Pool A', budget_status: 'Active', budget_association_status: 'Associated', impression_share: 0.25,
  });
  assert.equal(rows[1].impression_share, null);
  assert.equal(rows[1].spend, 0);
});

test('feeds: column projection reproduces the sheet contracts', () => {
  const row = {
    date: '2026-10-03', campaign: 'Brand - Dade - 1334 - Maximize Store Visits', cost: '2.31', clicks: '2', impressions: '6',
    all_conv: '1', store_visits: '0', search_is: '0.5', daily_budget: '401.15', daily_budget_text: 'USD401.15/day',
    data_source: 'adwords:9700431393', campaign_id: '1234567890', conv_by_label: { 'Get a Quick Quote': 2 }, labeled_conv_total: '3',
  };
  // ACE Google Ads Data: Date, Campaign, Cost, Clicks, Impressions, All Conv., Store visits, Search IS, Daily Budget (TEXT)
  const ace = projectRow(row, ['date', 'campaign', 'cost', 'clicks', 'impressions', 'all_conv', 'store_visits', 'search_is', 'daily_budget_text']);
  assert.deepEqual(ace, [46298, 'Brand - Dade - 1334 - Maximize Store Visits', 2.31, 2, 6, 1, 0, 0.5, 'USD401.15/day']);
  assert.equal(typeof ace[8], 'string', 'budget must stay text for the REGEXEXTRACT formulas');
  // Teguar-style per-action columns and ids stay strings
  const teg = projectRow(row, ['data_source', 'campaign_id', 'conv:Get a Quick Quote', 'conv:Chat Connected', 'conv_total', 'blank']);
  assert.deepEqual(teg, ['adwords:9700431393', '1234567890', 2, '', 3, '']);
});

test('sheets: column letters', () => {
  assert.equal(colLetter(1), 'A');
  assert.equal(colLetter(9), 'I');
  assert.equal(colLetter(26), 'Z');
  assert.equal(colLetter(27), 'AA');
  assert.equal(colLetter(52), 'AZ');
});

test('sheets: grid shortfall before writing', () => {
  const rows = (n) => Array.from({ length: n }, () => []);
  // 2026-10-11 ACE Master 'Google Ads Data (SB)': 10,001-row grid, 15,536 data rows.
  assert.deepEqual(gridShortfall({ rowCount: 10001, columnCount: 26 }, rows(15536), 12), { rows: Math.ceil(15537 * 1.1) - 10001, columns: 0 });
  // Fits exactly (header + data) → nothing to append.
  assert.deepEqual(gridShortfall({ rowCount: 101, columnCount: 5 }, rows(100), 5), { rows: 0, columns: 0 });
  // One row short, and columns short.
  assert.deepEqual(gridShortfall({ rowCount: 100, columnCount: 3 }, rows(100), 5), { rows: 112 - 100, columns: 2 });
  assert.deepEqual(gridShortfall({ rowCount: 10, columnCount: 3 }, 100, 3, 0), { rows: 91, columns: 0 });
  assert.deepEqual(gridShortfall(undefined, rows(0), 1), { rows: 2, columns: 1 });
});

test('sheets: tab width survives very large pushes', () => {
  // 2026-10-17 ACE 'Google Ads Data (SB)' from 2025-01-01: 140,271 rows overflowed Math.max(...rows).
  const big = Array.from({ length: 200000 }, (_, i) => (i === 123456 ? new Array(11).fill(0) : new Array(9).fill(0)));
  assert.equal(tabWidth(null, big), 11);
  assert.equal(tabWidth(['a', 'b', 'c'], [[1]]), 3);
  assert.equal(tabWidth(null, []), 1);
});

test('migrations: ids unique, statements are single statements', () => {
  const ids = MIGRATIONS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of MIGRATIONS) {
    for (const s of m.statements) {
      assert.equal(typeof s, 'string');
      // no stray second statement (a ';' outside a $$ body)
      const stripped = s.replace(/\$\$[\s\S]*?\$\$/g, '');
      assert.ok(!/;\s*\S/.test(stripped), `multiple statements in: ${s.slice(0, 60)}`);
    }
  }
});

test('microsoft: budget-split campaign-days merge to one row', async () => {
  const rows = mergeCampaignDays([
    { date: '2026-09-01', campaign_id: '7', campaign_name: 'Brand - Broward - 0176', campaign_status: 'Active', spend: 1.5, clicks: 2, impressions: 10, conversions: 1, all_conversions: null, budget_name: 'Broward West - Brand', impression_share: 0.4 },
    { date: '2026-09-01', campaign_id: '7', campaign_name: 'Brand - Broward - 0176', campaign_status: 'Active', spend: 2.5, clicks: 3, impressions: 30, conversions: null, all_conversions: 2, budget_name: 'Broward - Brand', impression_share: 0.6 },
    { date: '2026-09-02', campaign_id: '7', campaign_name: 'Brand - Broward - 0176', campaign_status: 'Active', spend: 1, clicks: 1, impressions: 5, conversions: 0, all_conversions: 0, budget_name: 'Broward - Brand', impression_share: 0.5 },
  ]);
  assert.equal(rows.length, 2);
  const d1 = rows.find((r) => r.date === '2026-09-01');
  assert.deepEqual([d1.spend, d1.clicks, d1.impressions, d1.conversions, d1.all_conversions], [4, 5, 40, 1, 2]);
  assert.equal(d1.budget_name, 'Broward - Brand'); // dimensions come from the row with more impressions
  assert.equal(d1.impression_share, 0.6);
  assert.deepEqual(await downloadReport(null), []); // empty report: Success with no URL
});

test('sheets: SA key accepts the shapes a hand paste produces', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pastes = [pem, pem.replace(/\n/g, '\\n'), `"${pem.replace(/\n/g, '\\n')}"`, JSON.stringify({ type: 'service_account', private_key: pem }),
    Buffer.from(pem).toString('base64'), pem.replace(/\n/g, '\r\n')];
  for (const p of pastes) assert.equal(saKeyShape(p).parses, true);
  assert.equal(normalizeSaKey(JSON.stringify({ private_key: pem })), pem);
  const bad = saKeyShape('[Sensitive]');
  assert.equal(bad.parses, false);
  assert.equal(bad.length, 11);
});

test('feeds: media_daily rows project to typed cells', () => {
  const row = { date: '2026-10-08', platform: 'microsoft', channel: 'Bing Search', market: 'Broward', tactic: 'Brand', spend: '14.20', impressions: '201', clicks: '2', conversions: '0.00', store_visits: '0.00' };
  assert.deepEqual(projectRow(row, ['date', 'platform', 'channel', 'market', 'tactic', 'spend', 'impressions', 'clicks', 'conversions', 'store_visits']),
    [sheetSerial('2026-10-08'), 'microsoft', 'Bing Search', 'Broward', 'Brand', 14.2, 201, 2, 0, 0]);
});

test('health: freshness follows ingest coverage, not rows (weekday-only accounts)', () => {
  // Monday 2026-10-12 10:30 UTC (06:30 ET), when the feed-health cron runs.
  const now = Date.parse('2026-10-12T10:30:00Z');
  const tz = 'America/New_York';
  const okRun = { status: 'ok', window_from: '2026-09-07', window_to: '2026-10-12', started_at: '2026-10-12T09:05:00Z' };
  const base = { platform: 'google', timezone: tz, now, lastOkAt: '2026-10-12T09:06:00Z', lastError: null };

  // Teguar: no Sat/Sun rows (last complete day Friday) but this morning's run covered Sunday → fresh.
  const weekend = assessAccount({ ...base, runs: [okRun], lastCompleteDate: '2026-10-09' });
  assert.equal(weekend.yesterday, '2026-10-11');
  assert.equal(weekend.ok, true, weekend.problems.join('; '));
  assert.deepEqual(weekend.notices, []);

  // Same gap, but this morning's run failed: yesterday's last ok run started Sunday, so Sunday isn't complete → stale.
  const sunRun = { ...okRun, window_to: '2026-10-11', started_at: '2026-10-11T21:05:00Z' };
  const failed = assessAccount({ ...base, runs: [sunRun, { ...okRun, status: 'error' }], lastCompleteDate: '2026-10-09', lastOkAt: '2026-10-11T21:06:00Z', lastError: 'boom' });
  assert.equal(failed.ok, false);
  assert.match(failed.problems[0], /no successful ingest covering 2026-10-11/);

  // No runs at all → stale on both signals.
  const missing = assessAccount({ ...base, runs: [], lastCompleteDate: '2026-10-09', lastOkAt: null });
  assert.equal(missing.ok, false);
  assert.equal(missing.problems.length, 2);

  // Ok runs every day but no rows for a week → fresh, with an info notice only.
  const quiet = assessAccount({ ...base, runs: [okRun], lastCompleteDate: '2026-10-04' });
  assert.equal(quiet.ok, true);
  assert.match(quiet.notices[0], /no rows since 2026-10-04/);

  // Coverage edges: window must include the day, and the run must start after the day ended locally.
  assert.equal(runCoversDay(okRun, '2026-10-11', tz), true);
  assert.equal(runCoversDay({ ...okRun, window_to: '2026-10-10' }, '2026-10-11', tz), false);
  assert.equal(runCoversDay({ ...okRun, window_from: '2026-10-12' }, '2026-10-11', tz), false);
  assert.equal(runCoversDay({ ...okRun, started_at: '2026-10-12T03:30:00Z' }, '2026-10-11', tz), false); // 23:30 ET Sunday
  assert.equal(runCoversDay({ ...okRun, status: 'pending_report' }, '2026-10-11', tz), false);
  // Microsoft defaults to Central when the account has no zone: 04:15 CT Monday covers Sunday.
  assert.equal(assessAccount({ ...base, platform: 'microsoft', timezone: null, runs: [{ ...okRun, started_at: '2026-10-12T09:15:00Z' }], lastCompleteDate: '2026-10-09' }).ok, true);
});

test('health: sheet-feed date guard tolerates weekend gaps when ingest covered yesterday', () => {
  const now = Date.parse('2026-10-12T09:50:00Z'); // Monday push-sheets run
  const today = '2026-10-12';
  const run = (started_at) => ({ status: 'ok', window_from: '2026-09-07', window_to: '2026-10-12', started_at });
  const cov = new Map([
    ['google:6942385423', { platform: 'google', timezone: 'America/New_York', runs: [run('2026-10-12T09:05:00Z')] }],
    ['microsoft:138954119', { platform: 'microsoft', timezone: 'America/Chicago', runs: [run('2026-10-12T09:15:00Z')] }],
    ['microsoft:999', { platform: 'microsoft', timezone: 'America/Chicago', runs: [run('2026-10-11T21:15:00Z')] }],
  ]);
  const teguar = [{ platform: 'google', account_id: '6942385423' }, { platform: 'microsoft', account_id: '138954119' }];
  assert.equal(accountsCovered(cov, teguar, now), true);
  assert.equal(accountsCovered(cov, [...teguar, { platform: 'microsoft', account_id: '999' }], now), false); // one account's run is from Sunday
  assert.equal(accountsCovered(cov, [{ platform: 'meta', account_id: 'act_1' }], now), false); // unknown account
  assert.equal(accountsCovered(cov, [], now), false);

  // Friday max date on a Monday: fresh if covered, stale if not; a missing max date is always stale.
  assert.equal(feedDateStale({ maxDate: '2026-10-09', today, covered: true }), false);
  assert.equal(feedDateStale({ maxDate: '2026-10-09', today, covered: false }), true);
  assert.equal(feedDateStale({ maxDate: '2026-10-11', today, covered: false }), false);
  assert.equal(feedDateStale({ maxDate: null, today, covered: true }), true);
});

test('linkedin: adAnalytics element → ad_daily row, Restli date range', async () => {
  const { analyticsRow, restliDateRange } = await import('../api/_lib/ingest/linkedin.mjs');
  assert.equal(restliDateRange('2025-01-01', '2026-10-09'), '(start:(year:2025,month:1,day:1),end:(year:2026,month:10,day:9))');
  const row = analyticsRow({
    pivotValues: ['urn:li:sponsoredCampaign:412345678'],
    dateRange: { start: { year: 2026, month: 10, day: 9 }, end: { year: 2026, month: 10, day: 9 } },
    costInLocalCurrency: '41.27', impressions: 3120, clicks: 18, externalWebsiteConversions: 2,
  }, { accountId: '506507044', today: '2026-10-12', runId: 7 });
  assert.deepEqual(row, {
    platform: 'linkedin', account_id: '506507044', campaign_id: '412345678', date: '2026-10-09',
    cost: 41.27, clicks: 18, impressions: 3120, all_conversions: 2, conversions: 2, conversions_value: null,
    is_complete: true, source: 'api', run_id: 7,
  });
  assert.equal(analyticsRow({ pivotValues: [], dateRange: null }, { accountId: '1', today: '2026-10-12' }), null);
  const today = analyticsRow({ pivotValues: ['urn:li:sponsoredCampaign:9'], dateRange: { start: { year: 2026, month: 10, day: 12 } } }, { accountId: '1', today: '2026-10-12' });
  assert.equal(today.is_complete, false);
});

test('tiktok: report row → ad_daily row, 30-day chunks, budget modes', async () => {
  const { reportRow, reportChunks, campaignBudget, MAX_REPORT_DAYS } = await import('../api/_lib/ingest/tiktok.mjs');
  const row = reportRow({
    dimensions: { campaign_id: '1812345678901234', stat_time_day: '2026-10-09 00:00:00' },
    metrics: { campaign_name: 'ACE | Tampa | Awareness', spend: '83.12', impressions: '40211', clicks: '212', conversion: '9' },
  }, { accountId: '7012345678901234567', today: '2026-10-13', runId: 3 });
  assert.deepEqual(row, {
    platform: 'tiktok', account_id: '7012345678901234567', campaign_id: '1812345678901234', date: '2026-10-09',
    cost: 83.12, clicks: 212, impressions: 40211, all_conversions: 9, conversions: 9, conversions_value: null,
    is_complete: true, source: 'api', run_id: 3,
  });
  assert.equal(reportRow({ dimensions: { campaign_id: '1', stat_time_day: '2026-10-13 00:00:00' }, metrics: {} }, { accountId: '1', today: '2026-10-13' }).is_complete, false);
  assert.equal(reportRow({ dimensions: {}, metrics: {} }, { accountId: '1', today: '2026-10-13' }), null);

  assert.equal(MAX_REPORT_DAYS, 30);
  assert.deepEqual(reportChunks('2026-09-08', '2026-10-13'), [['2026-09-08', '2026-10-07'], ['2026-10-08', '2026-10-13']]);
  assert.deepEqual(reportChunks('2026-10-13', '2026-10-13'), [['2026-10-13', '2026-10-13']]);
  const year = reportChunks('2025-01-01', '2025-12-31');
  assert.equal(year[0][0], '2025-01-01');
  assert.equal(year.at(-1)[1], '2025-12-31');
  for (let i = 1; i < year.length; i++) assert.equal(year[i][0] > year[i - 1][1], true);

  const ag = new Map([['2', 45]]);
  assert.deepEqual(campaignBudget({ campaign_id: '1', budget_mode: 'BUDGET_MODE_DAY', budget: 50 }, ag), { amount: 50, budget_status: 'daily', budget_scope: 'campaign' });
  assert.deepEqual(campaignBudget({ campaign_id: '1', budget_mode: 'BUDGET_MODE_TOTAL', budget: 900 }, ag), { amount: null, budget_status: 'lifetime', budget_scope: 'campaign' });
  assert.deepEqual(campaignBudget({ campaign_id: '2', budget_mode: 'BUDGET_MODE_INFINITE', budget: 0 }, ag), { amount: 45, budget_status: 'daily', budget_scope: 'adsets_sum' });
  assert.deepEqual(campaignBudget({ campaign_id: '3', budget_mode: 'BUDGET_MODE_INFINITE' }, ag), { amount: null, budget_status: null, budget_scope: 'adsets_sum' });
});

test('conversion labels: a seed that would double-count a label is caught', () => {
  // Teguar Google 6942385423 as of 2026-10-17: Quick Quote moved to the Google Ads tag.
  const acct = { platform: 'google', account_id: '6942385423' };
  const actions = [
    { ...acct, action_id: '6679096977', name: 'Teguar (web) Get a Quick Quote', status: 'ENABLED', report_label: null },
    { ...acct, action_id: '806451510', name: 'GAds - Submit Quick Quote', status: 'ENABLED', report_label: 'Get a Quick Quote' },
    { ...acct, action_id: '588217874', name: 'Sidebar - Get a Quick Quote (New 2021)', status: 'HIDDEN', report_label: null },
    { ...acct, action_id: '6801518095', name: 'First Time Phone Call', status: 'ENABLED', report_label: 'First Time Phone Call' },
  ];
  // Re-applying the original seed entry (match "Get a Quick Quote") re-tags the GA4 import.
  const old = [{ ...acct, report_label: 'Get a Quick Quote', matched: ['6679096977', '588217874'] }];
  const c = conversionLabelConflicts(actions, old);
  assert.equal(c.length, 1);
  assert.equal(c[0].report_label, 'Get a Quick Quote');
  assert.deepEqual(c[0].actions.map((a) => a.action_id).sort(), ['6679096977', '806451510']);
  // The HIDDEN sidebar action matched too, but records nothing, so it is not part of the conflict.
  assert.ok(!c[0].actions.some((a) => a.action_id === '588217874'));
  // The 10/17 relabel itself (clear the GA4 import, tag the Google Ads tag) is clean.
  const relabel = [
    { ...acct, report_label: null, matched: ['6679096977'] },
    { ...acct, report_label: 'Get a Quick Quote', matched: ['806451510'] },
  ];
  assert.deepEqual(conversionLabelConflicts(actions, relabel), []);
  // A later entry clearing the duplicate in the same seed resolves it.
  assert.deepEqual(conversionLabelConflicts(actions, [...old, { ...acct, report_label: null, matched: ['6679096977'] }]), []);
  // allow_multiple opts a label in deliberately.
  assert.deepEqual(conversionLabelConflicts(actions, [{ ...old[0], allow_multiple: true }]), []);
  // Seed entries carry account ids as numbers sometimes.
  assert.equal(conversionLabelConflicts(actions, [{ ...old[0], account_id: 6942385423 }]).length, 1);
});

test('sheets: clearBelowRange skips rows past the grid', () => {
  // _Feed Status: 7-row grid holding header + 6 rows has nothing below to clear.
  assert.equal(clearBelowRange("'_Feed Status'", 7, 6), null);
  assert.equal(clearBelowRange("'_Feed Status'", 8, 6), "'_Feed Status'!A8:ZZ");
  assert.equal(clearBelowRange("'X'", 1000, 155), "'X'!A157:ZZ");
  assert.equal(clearBelowRange("'X'", 1, 0), null);
});

test('tiktok: depth metrics (reach, frequency, video funnel) and ad-group rows', async () => {
  const { reportRow, adgroupRow, depthFields, DEPTH_METRICS } = await import('../api/_lib/ingest/tiktok.mjs');
  const fx = await import('./fixtures/tiktok.mjs');
  const opts = { accountId: fx.ADVERTISER, today: '2026-11-05', runId: 9, depth: true };
  const row = reportRow(fx.campaignItems[0], opts);
  assert.deepEqual(row, {
    platform: 'tiktok', account_id: fx.ADVERTISER, campaign_id: fx.CAMPAIGN, date: '2026-11-02',
    cost: 210.40, clicks: 610, impressions: 51200, all_conversions: 0, conversions: 0, conversions_value: null,
    reach: 30100, frequency: 1.70, video_play_actions: 49800, video_watched_2s: 5200, video_watched_6s: 2150,
    video_views_p25: 1800, video_views_p50: 1050, video_views_p75: 690, video_views_p100: 360,
    engaged_view: 2400, average_video_play: 2.20,
    is_complete: true, source: 'api', run_id: 9,
  });
  // Without depth the keys are absent, so an upsert leaves stored depth values alone.
  const core = reportRow(fx.campaignItems[0], { ...opts, depth: false });
  for (const k of DEPTH_METRICS) assert.ok(!(k in core), k);
  // Missing / '-' depth values are NULL, not 0; counts are integers.
  assert.deepEqual(depthFields({ reach: '-', video_play_actions: '12.0', frequency: '1.234' }).reach, null);
  assert.equal(depthFields({ video_play_actions: '12.0' }).video_play_actions, 12);
  assert.equal(depthFields({ frequency: '1.234' }).frequency, 1.234);
  assert.equal(depthFields({}).engaged_view, null);

  const g = adgroupRow(fx.adgroupItems[1], opts);
  assert.equal(g.adgroup_id, fx.ADGROUP);
  assert.equal(g.campaign_id, fx.CAMPAIGN);
  assert.equal(g.date, '2026-11-03');
  assert.equal(g.cost, 215.90);
  assert.equal(g.reach, 26800);
  assert.equal(adgroupRow({ dimensions: { stat_time_day: '2026-11-03 00:00:00' }, metrics: {} }, opts), null);
  assert.equal(adgroupRow({ dimensions: { adgroup_id: '1', stat_time_day: '2026-11-05 00:00:00' }, metrics: { campaign_id: '-' } }, opts).campaign_id, null);
});

test('tiktok: pixel event breakdown is inert until configured', async () => {
  const { eventSpecs, eventRows, eventActions, reportMetrics, DEPTH_METRICS } = await import('../api/_lib/ingest/tiktok.mjs');
  assert.deepEqual(eventSpecs(undefined), []);
  assert.deepEqual(eventSpecs({}), []);
  assert.deepEqual(reportMetrics(['spend'], { depth: false, events: eventSpecs({}) }), ['spend']);
  assert.deepEqual(reportMetrics(['spend'], { depth: true }), ['spend', ...DEPTH_METRICS]);

  const events = eventSpecs({ tiktok_events: [
    'complete_payment',
    { metric: 'form', name: 'Coupon Lead', category: 'LEAD' },
    { metric: 'complete_payment' }, // duplicate
    { metric: 'spend; drop' }, { metric: 'Bad' }, null, // not metric identifiers
    { metric: 'on_web_order', value_metric: 'total_on_web_order_value' },
  ] });
  assert.deepEqual(events.map((e) => [e.metric, e.name, e.category, e.value_metric]), [
    ['complete_payment', 'complete_payment', 'TIKTOK_EVENT', null],
    ['form', 'Coupon Lead', 'LEAD', null],
    ['on_web_order', 'on_web_order', 'TIKTOK_EVENT', 'total_on_web_order_value'],
  ]);
  assert.deepEqual(reportMetrics(['spend'], { depth: false, events }), ['spend', 'complete_payment', 'form', 'on_web_order', 'total_on_web_order_value']);

  const acts = eventActions(events, '7012');
  assert.deepEqual(acts[1], { platform: 'tiktok', account_id: '7012', action_id: 'event:form', name: 'Coupon Lead', category: 'LEAD',
    type: 'TIKTOK_REPORT_METRIC', status: 'ENABLED', include_in_conversions: null, primary_for_goal: null });

  const item = { dimensions: { campaign_id: '18', stat_time_day: '2026-11-03 00:00:00' },
    metrics: { complete_payment: '0', form: '4', on_web_order: '0', total_on_web_order_value: '25.50' } };
  assert.deepEqual(eventRows(item, events, { accountId: '7012', runId: 2 }), [
    { platform: 'tiktok', account_id: '7012', campaign_id: '18', date: '2026-11-03', action_id: 'event:form', action_name: 'Coupon Lead', category: 'LEAD', all_conversions: 4, conversions: 4, value: null, run_id: 2 },
    { platform: 'tiktok', account_id: '7012', campaign_id: '18', date: '2026-11-03', action_id: 'event:on_web_order', action_name: 'on_web_order', category: 'TIKTOK_EVENT', all_conversions: 0, conversions: 0, value: 25.5, run_id: 2 },
  ], 'zero-count, zero-value events write no row');
});

test('tiktok: ingest writes campaign + ad-group depth, read-only GETs only', async () => {
  const { ingestTikTok, DEPTH_METRICS } = await import('../api/_lib/ingest/tiktok.mjs');
  const fx = await import('./fixtures/tiktok.mjs');
  const { fetch, calls } = fx.fakeTikTokFetch();
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = (url, init = {}) => { seen.push(init.method || 'GET'); return fetch(url, init); };
  try {
    const { q, upserts } = fx.recordingClient();
    const out = await ingestTikTok(q, { account_id: fx.ADVERTISER, timezone: 'America/New_York', config: {} }, '2026-11-02', '2026-11-03', { token: 't', runId: 5 });
    assert.deepEqual(out, { rows: 2, campaigns: 1, adgroup_rows: 2, adgroups: 1, conversions: 0 });
    assert.deepEqual([...new Set(seen)], ['GET']);
    const ad = upserts('ad_daily');
    assert.equal(ad.length, 2);
    assert.equal(ad[0].reach, 30100);
    assert.equal(ad[1].video_views_p100, 400);
    const ag = upserts('adgroup_daily');
    assert.deepEqual(ag.map((r) => [r.adgroup_id, r.campaign_id, r.date, r.cost, r.engaged_view]), [
      [fx.ADGROUP, fx.CAMPAIGN, '2026-11-02', 210.40, 2400], [fx.ADGROUP, fx.CAMPAIGN, '2026-11-03', 215.90, 2460]]);
    const groups = upserts('adgroups');
    // listing upsert (status, budget) then the report sighting, which carries no status
    // column at all, so the stored status is never blanked by it.
    assert.deepEqual(groups.map((g) => [g.name, g.status, g.first_seen, g.last_seen]),
      [['Ad Group 1', 'ENABLE', '2026-10-20', groups[0].last_seen], ['Ad Group 1', undefined, '2026-11-02', '2026-11-03']]);
    assert.equal(upserts('conversions_daily').length, 0, 'no events configured → no breakdown');
    assert.equal(upserts('conversion_actions').length, 0);
    const reports = calls.filter((c) => c.path === '/report/integrated/get/');
    assert.deepEqual(reports.map((c) => c.level), ['AUCTION_CAMPAIGN', 'AUCTION_ADGROUP']);
    for (const c of reports) for (const m of DEPTH_METRICS) assert.ok(c.metrics.includes(m), `${c.level} asks for ${m}`);
  } finally {
    globalThis.fetch = real;
  }
});

test('tiktok: a refused depth metric falls back to core; ad-group failure is not fatal', async () => {
  const { ingestTikTok, DEPTH_METRICS } = await import('../api/_lib/ingest/tiktok.mjs');
  const fx = await import('./fixtures/tiktok.mjs');
  const real = globalThis.fetch;
  try {
    // 1. TikTok refuses 'engaged_view': spend still lands, depth columns are left out.
    let fake = fx.fakeTikTokFetch({ reject: 'engaged_view' });
    globalThis.fetch = fake.fetch;
    let rec = fx.recordingClient();
    let out = await ingestTikTok(rec.q, { account_id: fx.ADVERTISER }, '2026-11-02', '2026-11-03', { token: 't' });
    assert.equal(out.rows, 2);
    assert.match(out.depth_error, /Invalid metric: engaged_view/);
    assert.match(out.adgroup_depth_error, /Invalid metric: engaged_view/);
    const ad = rec.upserts('ad_daily');
    assert.equal(ad[0].cost, 210.40);
    for (const k of DEPTH_METRICS) assert.ok(!(k in ad[0]), `${k} not written`);
    // the insert's column list carries no depth column, so stored values survive
    const ins = rec.statements.find((s) => s.text.startsWith('insert into ads.ad_daily'));
    assert.ok(!/reach/.test(ins.text));
    assert.equal(rec.upserts('adgroup_daily').length, 2, 'ad groups fall back to core too');

    // 2. 40-day window = two report chunks: after the first falls back, the second asks for core only.
    fake = fx.fakeTikTokFetch({ reject: 'reach' });
    globalThis.fetch = fake.fetch;
    await ingestTikTok(fx.recordingClient().q, { account_id: fx.ADVERTISER }, '2026-09-25', '2026-11-03', { token: 't', snapshots: false });
    const camp = fake.calls.filter((c) => c.level === 'AUCTION_CAMPAIGN').map((c) => c.metrics.includes('reach'));
    assert.deepEqual(camp, [true, false, false], 'chunk 1 full → refused → core; chunk 2 core only');

    // 3. Ad-group report broken: campaign rows still written, error recorded, no throw.
    fake = fx.fakeTikTokFetch({ failAdgroup: true });
    globalThis.fetch = fake.fetch;
    rec = fx.recordingClient();
    out = await ingestTikTok(rec.q, { account_id: fx.ADVERTISER }, '2026-11-02', '2026-11-03', { token: 't' });
    assert.equal(out.rows, 2);
    assert.equal(out.adgroup_rows, 0);
    assert.match(out.adgroup_error, /adgroup report broke/);
    assert.equal(rec.upserts('ad_daily')[0].reach, 30100);
  } finally {
    globalThis.fetch = real;
  }
});

test('tiktok: configured pixel events become conversion actions + campaign-day rows', async () => {
  const { ingestTikTok } = await import('../api/_lib/ingest/tiktok.mjs');
  const fx = await import('./fixtures/tiktok.mjs');
  const real = globalThis.fetch;
  const fake = fx.fakeTikTokFetch();
  // The fixture has no 'form' values; give day 2 four leads.
  globalThis.fetch = async (url, init) => {
    const r = await fake.fetch(url, init);
    const j = await r.json();
    for (const it of (j.data && j.data.list) || []) if (it.metrics && 'form' in it.metrics) it.metrics.form = it.dimensions.stat_time_day.startsWith('2026-11-03') ? '4' : '0';
    return { ...r, json: async () => j };
  };
  try {
    const rec = fx.recordingClient();
    const out = await ingestTikTok(rec.q, { account_id: fx.ADVERTISER, config: { tiktok_events: [{ metric: 'form', name: 'Coupon Lead', category: 'LEAD' }] } },
      '2026-11-02', '2026-11-03', { token: 't' });
    assert.equal(out.conversions, 1);
    assert.deepEqual(rec.upserts('conversion_actions').map((a) => [a.action_id, a.name]), [['event:form', 'Coupon Lead']]);
    const cv = rec.upserts('conversions_daily');
    assert.deepEqual(cv.map((r) => [r.campaign_id, r.date, r.action_id, r.all_conversions]), [[fx.CAMPAIGN, '2026-11-03', 'event:form', 4]]);
    assert.ok(fake.calls.find((c) => c.level === 'AUCTION_CAMPAIGN').metrics.includes('form'));
    assert.ok(!fake.calls.find((c) => c.level === 'AUCTION_ADGROUP').metrics.includes('form'), 'events stay campaign-grain');
  } finally {
    globalThis.fetch = real;
  }
});

test('feeds: select list reads only the view columns the spec needs', () => {
  const view = ['platform', 'account_id', 'date', 'campaign', 'cost', 'clicks', 'conv_by_label', 'labeled_conv_total', 'reach'];
  assert.equal(feedSelectList(['date', 'campaign', 'cost'], view), '"date", "campaign", "cost"');
  // conv:<label> and conv_total read the label columns once; blank and unknown columns read nothing.
  assert.equal(feedSelectList(['cost', 'conv:A', 'conv:B', 'conv_total', 'blank', 'no_such_column'], view),
    '"date", "cost", "conv_by_label", "labeled_conv_total"');
  // date is always read (the max-date guard needs it); extras such as the archive sort key are added.
  assert.equal(feedSelectList(['clicks'], view, ['campaign']), '"date", "campaign", "clicks"');
  assert.equal(feedSelectList([], []), '');
});
