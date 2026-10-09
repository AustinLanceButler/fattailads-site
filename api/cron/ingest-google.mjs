// GET /api/cron/ingest-google — Google Ads → warehouse, trailing 35 days, all enabled
// accounts, with today's campaign/budget snapshot. Schedule in vercel.json.
import { cronHandler } from '../_lib/cron-auth.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';

export default cronHandler('ingest-google', async () => ({ results: await runPlatform('google') }));
