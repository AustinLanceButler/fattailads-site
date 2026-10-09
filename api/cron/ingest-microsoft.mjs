// GET /api/cron/ingest-microsoft — Microsoft Advertising → warehouse (daily report +
// campaign/shared-budget snapshot), draining any report left pending by the last run.
import { cronHandler } from '../_lib/cron-auth.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';

export default cronHandler('ingest-microsoft', async () => ({ results: await runPlatform('microsoft') }));
