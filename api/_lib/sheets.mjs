// api/_lib/sheets.mjs — Google Sheets writes with a service account (no googleapis
// dependency). The SA (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY, the same one the
// acu-bing-feed project uses) must be shared on each target spreadsheet as Editor.
//
// Values are written RAW: dates as Sheets serial numbers, then the date columns are
// number-formatted, so downstream formulas see real dates regardless of locale.

import crypto from 'node:crypto';
import { fetchRetry } from './ingest/http.mjs';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
let cached = null; // { token, exp }

export function saConfigured() {
  return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
}

async function saToken() {
  if (cached && Date.now() < cached.exp - 60000) return cached.token;
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw Object.assign(new Error('GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY are not set'), { code: 'not_configured' });
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw Object.assign(new Error(`SA token failed: ${j.error || r.status} ${j.error_description || ''}`.trim()), { code: 'sa_token' });
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return cached.token;
}

async function api(method, path, body) {
  const token = await saToken();
  const r = await fetchRetry(`${SHEETS}/${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }, { label: `sheets ${method} ${path.split('?')[0]}` });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Sheets ${method} ${path.split('?')[0]}: ${(j.error && j.error.message) || r.status}`), { code: 'sheets', status: r.status });
  return j;
}

export const colLetter = (n) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
const quoteTab = (tab) => `'${String(tab).replace(/'/g, "''")}'`;

export async function getSheetId(spreadsheetId, tab, { create = true } = {}) {
  const meta = await api('GET', `${spreadsheetId}?fields=sheets.properties(sheetId,title)`);
  const hit = (meta.sheets || []).find((s) => s.properties.title === tab);
  if (hit) return hit.properties.sheetId;
  if (!create) return null;
  const r = await api('POST', `${spreadsheetId}:batchUpdate`, { requests: [{ addSheet: { properties: { title: tab } } }] });
  return r.replies[0].addSheet.properties.sheetId;
}

// Write a whole tab: optional header in row 1 (only rewritten when it differs),
// rows from A2, stale tail cleared, date columns (1-based) formatted yyyy-mm-dd.
export async function writeTab(spreadsheetId, tab, { header = null, rows, dateColumns = [], chunk = 10000 }) {
  const sheetId = await getSheetId(spreadsheetId, tab);
  const width = Math.max(header ? header.length : 0, ...rows.map((r) => r.length), 1);
  const last = colLetter(width);
  const t = quoteTab(tab);

  if (header) {
    const cur = await api('GET', `${spreadsheetId}/values/${encodeURIComponent(`${t}!A1:${last}1`)}`);
    const have = (cur.values && cur.values[0]) || [];
    if (header.some((h, i) => String(have[i] ?? '') !== String(h))) {
      await api('PUT', `${spreadsheetId}/values/${encodeURIComponent(`${t}!A1:${last}1`)}?valueInputOption=RAW`, { values: [header] });
    }
  }

  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk).map((r) => r.map((v) => (v === undefined || v === null ? '' : v)));
    const range = `${t}!A${i + 2}:${last}${i + 1 + part.length}`;
    await api('PUT', `${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { values: part });
  }
  // Clear anything below the new data (previous longer pushes). ZZ keeps it bounded.
  await api('POST', `${spreadsheetId}/values/${encodeURIComponent(`${t}!A${rows.length + 2}:ZZ`)}:clear`, {});

  if (dateColumns.length && rows.length) {
    await api('POST', `${spreadsheetId}:batchUpdate`, {
      requests: dateColumns.map((c) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: rows.length + 1, startColumnIndex: c - 1, endColumnIndex: c },
          cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })),
    });
  }
  return { sheetId, rows: rows.length, width };
}

export async function readRange(spreadsheetId, rangeA1) {
  const r = await api('GET', `${spreadsheetId}/values/${encodeURIComponent(rangeA1)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
  return r.values || [];
}
