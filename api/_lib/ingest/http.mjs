// api/_lib/ingest/http.mjs — fetch with bounded retries for the ad-platform APIs.
// Retries on network errors, 429 and 5xx (honouring Retry-After), never on 4xx.

export async function fetchRetry(url, init = {}, { retries = 3, baseDelayMs = 1500, label = '' } = {}) {
  let attempt = 0;
  for (;;) {
    let r;
    try {
      r = await fetch(url, init);
    } catch (err) {
      if (attempt >= retries) throw Object.assign(new Error(`${label || url}: ${err.message}`), { code: 'network' });
      await sleep(backoff(attempt++, baseDelayMs));
      continue;
    }
    if (r.status === 429 || r.status >= 500) {
      if (attempt >= retries) return r;
      const ra = Number(r.headers.get('retry-after'));
      await sleep(ra > 0 ? Math.min(ra * 1000, 60000) : backoff(attempt, baseDelayMs));
      attempt++;
      continue;
    }
    return r;
  }
}

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const backoff = (attempt, base) => Math.round(base * 2 ** attempt * (0.75 + Math.random() / 2));

// Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). Returns array of arrays.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[,%$\s]/g, '');
  if (s === '' || s === '--' || s === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
