// GET /api/cron/relay-health — hourly at :12 (just after the relay's :07 flush): is the FTA conversion
// relay alive and delivering today? Raises deduplicated ClickUp alerts; the daily feed-health pass clears them.
import { cronHandler } from '../_lib/cron-auth.mjs';
import { wh } from '../_lib/warehouse.mjs';
import { checkRelayHealth } from '../_lib/relay-health.mjs';

export default cronHandler('relay-health', async () => checkRelayHealth({ getWarehouse: wh, pass: 'hourly' }));
