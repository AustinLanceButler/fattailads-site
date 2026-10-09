// api/_lib/dates.mjs — date helpers for the ads warehouse. Everything is a plain
// 'YYYY-MM-DD' string in a named time zone; no Date arithmetic leaks into callers.

export const ET = 'America/New_York';

// Calendar date in `tz` for an instant (default now).
export function todayIn(tz = ET, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Normalize a DB date value to 'YYYY-MM-DD'. Postgres drivers hand `date` columns
// back either as text or as a JS Date built from local components; the local
// getters invert that construction regardless of the process time zone.
export function ymd(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

export function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function monthStart(ymd) {
  return `${ymd.slice(0, 7)}-01`;
}

// First day of the month `n` months before the month containing `ymd`.
export function monthStartMinus(ymd, n) {
  const d = new Date(`${monthStart(ymd)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// Google Sheets serial date (days since 1899-12-30).
export function sheetSerial(ymd) {
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse('1899-12-30T00:00:00Z')) / 86400000);
}

// Split [from, to] into inclusive month-sized chunks.
export function monthChunks(from, to) {
  const out = [];
  let start = from;
  while (start <= to) {
    const nextMonth = monthStartMinus(start, -1);
    const end = addDays(nextMonth, -1) < to ? addDays(nextMonth, -1) : to;
    out.push([start, end]);
    start = addDays(end, 1);
  }
  return out;
}

// Resolve a sheet_feeds.window_rule into a start date (inclusive).
//   month_start_minus_2 → 1st of the month two months back (ACE's current QUERY window)
//   from:YYYY-MM-DD     → fixed start
//   days:N              → today − N
export function windowStart(rule, today) {
  const m = /^month_start_minus_(\d+)$/.exec(rule || '');
  if (m) return monthStartMinus(today, Number(m[1]));
  const f = /^from:(\d{4}-\d{2}-\d{2})$/.exec(rule || '');
  if (f) return f[1];
  const d = /^days:(\d+)$/.exec(rule || '');
  if (d) return addDays(today, -Number(d[1]));
  throw new Error(`unknown window_rule: ${rule}`);
}
