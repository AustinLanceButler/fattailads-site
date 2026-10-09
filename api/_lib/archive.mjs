// api/_lib/archive.mjs — one-time load of the Funnel.io export tabs into
// ads.funnel_archive, for reconciliation against the API pulls (and to keep rows
// no API job produces yet, e.g. Teguar's LinkedIn line). Reads through the service
// account (share the source spreadsheet with it, Viewer is enough).
//
// Presets describe each tab's column layout:
//   alb     – the "ALB Funnel" per-platform tabs (13 cols)
//   teguar  – Teguar Pacing `Funnel` tab (26 cols)
//   ascend  – Ascend master `Funnel Data` tab (5 cols)

import { readRange } from './sheets.mjs';
import { upsert, exec } from './warehouse.mjs';
import { num } from './ingest/http.mjs';

const serialToYmd = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(Number(n)) * 86400000).toISOString().slice(0, 10);
const toYmd = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return serialToYmd(v);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(s)) return serialToYmd(Number(s));
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
};
const txt = (v) => (v === null || v === undefined ? null : String(v));

// opts.sourceTag: 'adwords' | 'bing' | 'facebook'; opts.accountId override; opts.sourceAccounts: { adwords: '…', bing: '…' } for ascend
const PRESETS = {
  alb: (r, o) => ({
    data_source: `${o.sourceTag}:${txt(r[1]) || txt(r[2]) || o.accountId || ''}`, data_source_name: txt(r[0]),
    account_id: o.accountId || txt(r[1]) || txt(r[2]), campaign_id: null,
    date: toYmd(r[3]), campaign: txt(r[4]), budget_text: txt(r[5]) || null, daily_budget: num(r[6]), cost: num(r[7]) ?? 0,
    clicks: num(r[8]) ?? 0, impressions: num(r[9]) ?? 0, all_conv: num(r[10]), store_visits: num(r[11]), search_is: num(r[12]),
    extra: null,
  }),
  teguar: (r, o) => ({
    data_source: txt(r[0]), data_source_name: txt(r[1]), account_id: txt(r[2]) || accountFromSource(r[0], o), campaign_id: txt(r[3]),
    date: toYmd(r[4]), campaign: txt(r[5]), budget_text: null, daily_budget: num(r[19]), cost: num(r[6]) ?? 0,
    clicks: num(r[7]) ?? 0, impressions: num(r[8]) ?? 0, all_conv: num(r[9]), store_visits: null, search_is: num(r[11]),
    extra: { conversions: num(r[12]), quick_quote: num(r[13]), contact_form: num(r[14]), chat_connected: num(r[15]), first_time_call: num(r[16]), purchase: num(r[17]),
      teguar_conversions: num(r[18]), budget_association_status: txt(r[20]), budget_name: txt(r[21]), budget_status: txt(r[22]), campaign_status: txt(r[24]) },
  }),
  ascend: (r, o) => ({
    data_source: txt(r[1]), data_source_name: null, account_id: accountFromSource(r[1], o), campaign_id: null,
    date: toYmd(r[0]), campaign: txt(r[2]), budget_text: null, daily_budget: num(r[3]), cost: num(r[4]) ?? 0,
    clicks: null, impressions: null, all_conv: null, store_visits: null, search_is: null, extra: null,
  }),
};

function accountFromSource(ds, o) {
  const prefix = String(ds || '').split(':')[0];
  return (o.sourceAccounts && o.sourceAccounts[prefix]) || o.accountId || null;
}

// Load one tab. Idempotent per (source_tab): existing rows for that source_tab are replaced.
export async function loadFunnelTab(q, { spreadsheetId, tab, preset, sourceTag, accountId, sourceAccounts, chunkRows = 20000, maxRows = 400000 }) {
  const map = PRESETS[preset];
  if (!map) throw new Error(`unknown preset ${preset}`);
  const sourceTab = `${spreadsheetId}:${tab}`;
  await exec(q, 'delete from ads.funnel_archive where source_tab = $1', [sourceTab]);
  const o = { sourceTag, accountId, sourceAccounts };
  let start = 2;
  let loaded = 0;
  let skipped = 0;
  const quoted = `'${tab.replace(/'/g, "''")}'`;
  while (start < maxRows) {
    const values = await readRange(spreadsheetId, `${quoted}!A${start}:Z${start + chunkRows - 1}`);
    if (!values.length) break;
    const rows = [];
    for (const r of values) {
      const row = map(r, o);
      if (!row.date || !row.campaign) { skipped++; continue; }
      rows.push({ source_tab: sourceTab, ...row });
    }
    loaded += await upsert(q, 'funnel_archive', rows);
    if (values.length < chunkRows) break;
    start += chunkRows;
  }
  return { source_tab: sourceTab, loaded, skipped };
}
