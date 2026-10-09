// GET /api/cron/feed-health — daily staleness check over accounts and sheet feeds;
// raises/clears deduplicated ClickUp alerts.
import { cronHandler } from '../_lib/cron-auth.mjs';
import { wh } from '../_lib/warehouse.mjs';
import { checkHealth } from '../_lib/health.mjs';

export default cronHandler('feed-health', async () => {
  const q = await wh();
  return checkHealth(q);
});
