// GET /api/cron/ingest-tiktok — TikTok API for Business → warehouse (campaign daily
// report + campaign/budget snapshot).
import { cronHandler } from '../_lib/cron-auth.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';

export default cronHandler('ingest-tiktok', async () => ({ results: await runPlatform('tiktok') }));
