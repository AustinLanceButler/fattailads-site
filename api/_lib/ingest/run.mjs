// api/_lib/ingest/run.mjs — run one platform's ingest across its enabled accounts,
// one ingest_runs row per account, failures isolated per account.

import { wh, listAccounts, startRun, finishRun } from '../warehouse.mjs';
import { todayIn, addDays } from '../dates.mjs';
import { ingestGoogle } from './google-ads.mjs';
import { ingestMicrosoft, drainPending } from './microsoft-ads.mjs';
import { ingestMeta } from './meta.mjs';

export const DEFAULT_LOOKBACK_DAYS = 35;

const INGEST = { google: ingestGoogle, microsoft: ingestMicrosoft, meta: ingestMeta };

// opts: { from, to, account_id, snapshots, job }
export async function runPlatform(platform, opts = {}) {
  const fn = INGEST[platform];
  if (!fn) throw new Error(`unknown platform ${platform}`);
  const q = await wh();
  const accounts = await listAccounts(q, { platform, account_id: opts.account_id || null });
  const results = [];
  for (const account of accounts) {
    const today = todayIn(account.timezone || 'America/New_York');
    const to = opts.to || today;
    const from = opts.from || addDays(to, -DEFAULT_LOOKBACK_DAYS);
    const job = opts.job || platform;
    const runId = await startRun(q, { job, platform, account_id: account.account_id, window_from: from, window_to: to, detail: { snapshots: opts.snapshots !== false } });
    const started = Date.now();
    try {
      if (platform === 'microsoft') await drainPending(q, account);
      const out = await fn(q, account, from, to, { snapshots: opts.snapshots !== false, runId });
      if (out.pending) {
        await finishRun(q, runId, { status: 'pending_report', rows: out.rows, detail: { report_request_id: out.pending, snapshots: opts.snapshots !== false } });
        results.push({ account_id: account.account_id, label: account.label, status: 'pending_report', from, to, ...out });
      } else {
        await finishRun(q, runId, { status: 'ok', rows: out.rows, detail: { ...out, ms: Date.now() - started } });
        results.push({ account_id: account.account_id, label: account.label, status: 'ok', from, to, ...out });
      }
    } catch (err) {
      console.error(`[ingest/${platform}] ${account.account_id}:`, err.message);
      await finishRun(q, runId, { status: 'error', error: err.message });
      results.push({ account_id: account.account_id, label: account.label, status: 'error', from, to, error: err.message.slice(0, 500) });
    }
  }
  return results;
}
