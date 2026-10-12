// GET /api/cron/ingest-linkedin — LinkedIn Marketing API → warehouse (campaign daily
// analytics + campaign/daily-budget snapshot).
import { cronHandler } from '../_lib/cron-auth.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';

export default cronHandler('ingest-linkedin', async () => ({ results: await runPlatform('linkedin') }));
