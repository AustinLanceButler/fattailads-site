// api/_lib/relay-health.mjs — health of the FTA conversion relay (relay.fattailads.com, repo
// AustinLanceButler/fta-conversion-relay), read from the relay's own Neon project through the read-only
// `relay_reader` role (RELAY_READER_URL). Counts only: the role can't see events, hashes or secrets.
//
// Two passes share one verdict function:
//   hourly (cron relay-health, :12, right after the relay's :07 flush so its Neon compute is still awake):
//     heartbeat + today's delivery/breaker checks; RAISES only, and touches the warehouse only when
//     something is wrong (keeps fta-connect's Neon asleep on healthy hours).
//   daily (inside feed-health): yesterday's full checks, raises AND clears.
// Alerts reuse ads.alerts + ClickUp through raiseAlert/clearAlert (dedupe keys `relay:*`, DESIGN §10).

import { neon } from '@neondatabase/serverless';
import { addDays, todayIn, ET } from './dates.mjs';
import { raiseAlert, clearAlert } from './alerts.mjs';

// Days before go-live carry Phase 1 test traffic (deliberate bad event IDs, rate-cap probes): never judge them.
export const RELAY_HEALTH_SINCE = '2026-11-10';
export const HEARTBEAT_MAX_HOURS = 3;
export const MIN_ACCEPT_RATE = 0.98;
export const MIN_SENT_FOR_RATE = 10;
export const BREAKER_MAX_MINUTES = 60; // the drain bumps breaker_open once a minute while a breaker is open
export const INTAKE_MIN_DAILY_AVG = 2;
export const DUPE_MAX_SHARE = 0.005;
export const DUPE_MIN_RECEIVED = 50;

const HOUR = 3600 * 1000;

let readerClient = null;
export function relayReader() {
  const url = process.env.RELAY_READER_URL;
  if (!url) return null;
  if (!readerClient) {
    const client = neon(url);
    readerClient = { query: (text, params = []) => client.query(text, params) };
  }
  return readerClient;
}

// Sum daily_stats rows into { [day]: { [`${client}|${site}|${dest}|${event}|${metric}`]: n } } helpers.
function sum(stats, day, pred) {
  let n = 0;
  for (const r of stats) if (r.day === day && pred(r)) n += Number(r.n) || 0;
  return n;
}
const uniq = (xs) => [...new Set(xs)];

// Delivery verdict for one client|dest on one day.
function deliveryProblems(stats, dead, day, client, dest) {
  const at = (metric) => sum(stats, day, (r) => r.client === client && r.dest === dest && r.metric === metric);
  const sent = at('sent');
  const accepted = at('accepted');
  const breaker = at('breaker_open');
  const lost = dead.filter((d) => d.day === day && d.client === client && d.dest === dest).reduce((a, d) => a + (Number(d.n) || 0), 0);
  const out = [];
  if (sent >= MIN_SENT_FOR_RATE && accepted / sent < MIN_ACCEPT_RATE) out.push(`accepted ${accepted}/${sent} (${((100 * accepted) / sent).toFixed(1)}%) < ${MIN_ACCEPT_RATE * 100}%`);
  if (breaker >= BREAKER_MAX_MINUTES) out.push(`breaker open ~${breaker} min`);
  if (lost > Math.max(1, 0.01 * sent)) out.push(`${lost} dead/expired deliveries`);
  return { out, sent, accepted, breaker, lost };
}

/**
 * Pure verdict. `stats`: daily_stats rows {day, client, site, dest, event, metric, n} (day as YYYY-MM-DD).
 * `dead`: v_dead_letters rows {day, client, dest, code, n}. `heartbeatAt`: last flush (Date|string|null).
 * Returns { problems: [{key, message, detail}], healthyKeys: [key] } — healthyKeys are only those this
 * pass is entitled to clear (daily pass only).
 */
export function assessRelay({ stats = [], dead = [], heartbeatAt = null, now = Date.now(), pass = 'daily', since = RELAY_HEALTH_SINCE }) {
  const today = todayIn(ET, new Date(now));
  const day = pass === 'hourly' ? today : addDays(today, -1);
  const problems = [];
  const healthy = [];
  const judge = (key, msgs, message, detail) => (msgs.length ? problems.push({ key, message: `${message}: ${msgs.join('; ')}`, detail }) : healthy.push(key));

  // Heartbeat: both passes. A dark relay writes no counters at all, so this is the only signal for it.
  const hbAge = heartbeatAt ? now - new Date(heartbeatAt).getTime() : Infinity;
  judge('relay:heartbeat', hbAge > HEARTBEAT_MAX_HOURS * HOUR ? [heartbeatAt ? `last flush ${Math.round(hbAge / HOUR)}h ago` : 'no flush heartbeat recorded'] : [],
    'FTA relay is dark', { heartbeat_at: heartbeatAt });

  if (day < since) return { day, problems, healthyKeys: pass === 'daily' ? healthy : [] };

  // Delivery health per client|dest that sent (or tripped a breaker) that day.
  const pairs = uniq(stats.filter((r) => r.day === day && r.dest !== '-' && ['sent', 'breaker_open'].includes(r.metric)).map((r) => `${r.client}|${r.dest}`));
  for (const p of pairs) {
    const [client, dest] = p.split('|');
    const d = deliveryProblems(stats, dead, day, client, dest);
    judge(`relay:deliver:${client}:${dest}`, d.out, `FTA relay ${client}→${dest} delivery (${day})`, { day, sent: d.sent, accepted: d.accepted, breaker_open_min: d.breaker, dead: d.lost });
  }

  if (pass === 'daily') {
    // Intake alive: a site that normally receives events got none yesterday (needs 7 judged days of history).
    const sites = uniq(stats.filter((r) => r.metric === 'received' && r.site !== '-').map((r) => `${r.client}|${r.site}`));
    for (const s of sites) {
      const [client, site] = s.split('|');
      const recv = (d) => sum(stats, d, (r) => r.client === client && r.site === site && r.metric === 'received');
      const prior = Array.from({ length: 7 }, (_, i) => addDays(day, -(i + 1)));
      if (prior[6] < since) continue; // not enough judged history yet
      const avg = prior.reduce((a, d) => a + recv(d), 0) / 7;
      judge(`relay:intake:${client}:${site}`, recv(day) === 0 && avg >= INTAKE_MIN_DAILY_AVG ? [`0 events on ${day} vs 7-day avg ${avg.toFixed(1)}`] : [],
        `FTA relay ${client}/${site} intake stopped`, { day, prior_avg: avg });
    }
    // Event-id health: the GTM ID variable broke (regex rejects) or replays/dupes spiked.
    for (const client of uniq(stats.filter((r) => r.day === day).map((r) => r.client)).filter((c) => c !== '_')) {
      const badId = sum(stats, day, (r) => r.client === client && r.event === 'bad_event_id');
      const received = sum(stats, day, (r) => r.client === client && r.metric === 'received');
      const dupes = sum(stats, day, (r) => r.client === client && r.metric === 'dupe');
      const msgs = [];
      if (badId > 0) msgs.push(`${badId} beacons rejected for a malformed event_id`);
      if (received >= DUPE_MIN_RECEIVED && dupes / received > DUPE_MAX_SHARE) msgs.push(`dupes ${dupes}/${received}`);
      judge(`relay:eid:${client}`, msgs, `FTA relay ${client} event-id health (${day})`, { day, bad_event_id: badId, received, dupes });
    }
    // Flood circuit tripped: the site went over its hourly ceiling and forwarding paused.
    const floods = uniq(stats.filter((r) => r.day === day && r.metric === 'dropped_flood').map((r) => `${r.client}|${r.site}`));
    for (const f of floods) {
      const [client, site] = f.split('|');
      const n = sum(stats, day, (r) => r.client === client && r.site === site && r.metric === 'dropped_flood');
      judge(`relay:flood:${client}:${site}`, n > 0 ? [`${n} events over the hourly ceiling were not forwarded`] : [], `FTA relay ${client}/${site} flood circuit (${day})`, { day, dropped_flood: n });
    }
  }
  return { day, problems, healthyKeys: pass === 'daily' ? healthy : [] };
}

// Reads the relay's counters (8 days) and heartbeat, judges, and raises/clears alerts in the warehouse.
// `getWarehouse` is lazy so the hourly pass never wakes fta-connect's Neon when the relay is healthy.
export async function checkRelayHealth({ getWarehouse, pass = 'daily', notify = true, reader = relayReader(), now = Date.now() }) {
  if (!reader) return { relay: 'skipped (RELAY_READER_URL not set)' };
  const today = todayIn(ET, new Date(now));
  let stats, dead, hb;
  try {
    stats = (await reader.query(`select day::text as day, client, site, dest, event, metric, n from relay.daily_stats where day >= $1::date`, [addDays(today, -9)]));
    dead = (await reader.query(`select day::text as day, client, dest, code, n from relay.v_dead_letters where day >= $1::date`, [addDays(today, -9)]));
    hb = (await reader.query(`select at from relay.heartbeat where name = 'flush'`))[0];
  } catch (err) {
    const problem = { key: 'relay:reader', message: `FTA relay health check can't read the relay database: ${String(err.message).slice(0, 200)}` };
    if (notify) await raiseAlert(await getWarehouse(), { job: 'relay-health', dedupe_key: problem.key, message: problem.message });
    return { relay: 'error', problems: [problem] };
  }
  const v = assessRelay({ stats, dead, heartbeatAt: hb ? hb.at : null, now, pass });
  if (notify && (v.problems.length || v.healthyKeys.length)) {
    const q = await getWarehouse();
    for (const p of v.problems) await raiseAlert(q, { job: 'relay-health', dedupe_key: p.key, message: p.message, detail: p.detail });
    if (pass === 'daily') {
      for (const k of [...v.healthyKeys, 'relay:reader']) await clearAlert(q, k);
    }
  }
  return { relay: 'ok', pass, day: v.day, problems: v.problems.map((p) => p.message), checked: v.problems.length + v.healthyKeys.length };
}
