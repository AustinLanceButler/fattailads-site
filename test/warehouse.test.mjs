// node --test test/  — pure-function checks for the ads warehouse (no network, no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, monthStartMinus, monthChunks, sheetSerial, windowStart, todayIn, isYmd } from '../api/_lib/dates.mjs';
import { parseCsv, num } from '../api/_lib/ingest/http.mjs';
import { parseReportCsv, toYmd, REPORT_COLUMNS } from '../api/_lib/ingest/microsoft-ads.mjs';
import { projectRow } from '../api/_lib/feeds.mjs';
import { colLetter } from '../api/_lib/sheets.mjs';
import { MIGRATIONS } from '../db/migrations/index.mjs';

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
