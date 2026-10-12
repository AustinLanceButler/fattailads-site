// node --test test/  — pure-function checks for the ads warehouse (no network, no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, monthStartMinus, monthChunks, sheetSerial, windowStart, todayIn, isYmd } from '../api/_lib/dates.mjs';
import { parseCsv, num } from '../api/_lib/ingest/http.mjs';
import { parseReportCsv, toYmd, REPORT_COLUMNS, mergeCampaignDays, downloadReport } from '../api/_lib/ingest/microsoft-ads.mjs';
import { projectRow } from '../api/_lib/feeds.mjs';
import { colLetter, gridShortfall, normalizeSaKey, saKeyShape } from '../api/_lib/sheets.mjs';
import crypto from 'node:crypto';
import { MIGRATIONS } from '../db/migrations/index.mjs';
import { assessAccount, runCoversDay, accountsCovered, feedDateStale } from '../api/_lib/health.mjs';

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
