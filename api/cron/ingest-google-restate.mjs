// GET /api/cron/ingest-google-restate — weekly: re-pull Google days 35–120 back so late
// conversion / store-visit restatements land. No snapshots (dimensions came from the daily run).
import { cronHandler } from '../_lib/cron-auth.mjs';
import { runPlatform } from '../_lib/ingest/run.mjs';
import { todayIn, addDays, ET } from '../_lib/dates.mjs';

export default cronHandler('ingest-google-restate', async () => {
  const today = todayIn(ET);
  return { results: await runPlatform('google', { from: addDays(today, -120), to: addDays(today, -35), snapshots: false, job: 'google-restate' }) };
});
