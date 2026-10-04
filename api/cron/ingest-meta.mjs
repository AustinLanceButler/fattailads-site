// GET /api/cron/ingest-meta — Meta Marketing API → warehouse (campaign daily insights +
// campaign/ad-set budget snapshot).
import { cronHandler } from '../_lib/cron-auth.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';

export default cronHandler('ingest-meta', async () => ({ results: await runPlatform('meta') }));
