// GET /api/cron/push-sheets — write every enabled sheet feed (ads.sheet_feeds) into its
// pacing-sheet tab, then refresh each spreadsheet's `_Feed Status` tab.
import { cronHandler } from '../_lib/cron-auth.mjs';
import { wh } from '../_lib/warehouse.mjs';
import { pushAllFeeds } from '../_lib/feeds.mjs';

export default cronHandler('push-sheets', async () => {
  const q = await wh();
  return pushAllFeeds(q);
});
