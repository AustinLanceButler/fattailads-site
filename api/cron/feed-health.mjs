// GET /api/cron/feed-health — daily staleness check over accounts and sheet feeds, plus the FTA
// conversion relay's daily checks (api/_lib/relay-health.mjs); raises/clears deduplicated ClickUp alerts.
import { cronHandler } from '../_lib/cron-auth.mjs';
import { wh } from '../_lib/warehouse.mjs';
import { checkHealth } from '../_lib/health.mjs';
import { checkRelayHealth } from '../_lib/relay-health.mjs';

export default cronHandler('feed-health', async () => {
  const q = await wh();
  const out = await checkHealth(q);
  // The relay check must never break the warehouse check it rides on.
  try {
    out.relay = await checkRelayHealth({ getWarehouse: async () => q, pass: 'daily' });
  } catch (err) {
    out.relay = { relay: 'error', error: String(err.message).slice(0, 300) };
  }
  return out;
});
