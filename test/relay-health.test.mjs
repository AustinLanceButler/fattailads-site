// node --test test/  — pure checks for the FTA conversion relay health verdict (no network, no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRelay, checkRelayHealth, RELAY_HEALTH_SINCE } from '../api/_lib/relay-health.mjs';

// 2026-11-20 11:00 UTC = 6:00 AM ET; "today" is 11/20, yesterday 11/19 (both after RELAY_HEALTH_SINCE).
const NOW = Date.parse('2026-11-20T11:00:00Z');
const FRESH = new Date(NOW - 30 * 60 * 1000).toISOString();
const row = (day, client, site, dest, event, metric, n) => ({ day, client, site, dest, event, metric, n });
const keys = (v) => v.problems.map((p) => p.key).sort();

test('relay health: a healthy day raises nothing and lists what the daily pass may clear', () => {
  const stats = [
    row('2026-11-19', 'srjt', 'web', '-', 'web_lead', 'received', 4),
    row('2026-11-19', 'srjt', '-', 'meta', '-', 'sent', 4),
    row('2026-11-19', 'srjt', '-', 'meta', '-', 'accepted', 4),
  ];
  const v = assessRelay({ stats, heartbeatAt: FRESH, now: NOW });
  assert.equal(v.day, '2026-11-19');
  assert.deepEqual(v.problems, []);
  assert.ok(v.healthyKeys.includes('relay:heartbeat') && v.healthyKeys.includes('relay:deliver:srjt:meta') && v.healthyKeys.includes('relay:eid:srjt'));
});

test('relay health: dark relay, low accept rate, long breaker and dead letters each raise', () => {
  const stats = [
    row('2026-11-19', 'ace', '-', 'meta', '-', 'sent', 100),
    row('2026-11-19', 'ace', '-', 'meta', '-', 'accepted', 90),
    row('2026-11-19', 'srjt', '-', 'meta', '-', 'breaker_open', 75),
  ];
  const dead = [{ day: '2026-11-19', client: 'ace', dest: 'meta', code: 'expired', n: 5 }];
  const v = assessRelay({ stats, dead, heartbeatAt: new Date(NOW - 5 * 3600 * 1000).toISOString(), now: NOW });
  assert.deepEqual(keys(v), ['relay:deliver:ace:meta', 'relay:deliver:srjt:meta', 'relay:heartbeat']);
  const ace = v.problems.find((p) => p.key === 'relay:deliver:ace:meta');
  assert.match(ace.message, /accepted 90\/100/);
  assert.match(ace.message, /5 dead\/expired/);
  assert.match(v.problems.find((p) => p.key === 'relay:heartbeat').message, /5h ago/);
  assert.equal(assessRelay({ stats: [], heartbeatAt: null, now: NOW }).problems[0].key, 'relay:heartbeat');
});

test('relay health: small volumes never trip the accept-rate rule', () => {
  const stats = [row('2026-11-19', 'srjt', '-', 'meta', '-', 'sent', 3), row('2026-11-19', 'srjt', '-', 'meta', '-', 'accepted', 2)];
  assert.deepEqual(assessRelay({ stats, heartbeatAt: FRESH, now: NOW }).problems, []);
});

test('relay health: intake stop needs 7 judged days of history and a real baseline', () => {
  const hist = Array.from({ length: 7 }, (_, i) => row(`2026-11-1${2 + i}`, 'srjt', 'web', '-', 'web_lead', 'received', 3));
  const v = assessRelay({ stats: hist, heartbeatAt: FRESH, now: NOW }); // 11/12–11/18 = 3/day, 11/19 = 0
  assert.deepEqual(keys(v), ['relay:intake:srjt:web']);
  // Before RELAY_HEALTH_SINCE + 7 days there's no judged baseline, so no intake alert.
  const early = Date.parse('2026-11-14T11:00:00Z');
  const v2 = assessRelay({ stats: [row('2026-11-11', 'srjt', 'web', '-', 'web_lead', 'received', 9)], heartbeatAt: new Date(early - 60000).toISOString(), now: early });
  assert.deepEqual(v2.problems, []);
});

test('relay health: malformed event ids, dupe spikes and flood trips raise per client/site', () => {
  const stats = [
    row('2026-11-19', 'ace', 'specials', '-', 'bad_event_id', 'dropped_invalid', 2),
    row('2026-11-19', 'ace', 'specials', '-', 'coupon_email_sent', 'received', 60),
    row('2026-11-19', 'ace', 'specials', '-', 'coupon_email_sent', 'dupe', 1),
    row('2026-11-19', 'srjt', 'web', '-', 'web_lead', 'dropped_flood', 4),
  ];
  const v = assessRelay({ stats, heartbeatAt: FRESH, now: NOW });
  assert.deepEqual(keys(v), ['relay:eid:ace', 'relay:flood:srjt:web']);
});

test('relay health: days before go-live (Phase 1 test traffic) are never judged', () => {
  const now = Date.parse('2026-11-10T11:00:00Z'); // yesterday = 11/9, before RELAY_HEALTH_SINCE
  assert.ok('2026-11-09' < RELAY_HEALTH_SINCE);
  const stats = [row('2026-11-09', 'ace', 'specials', '-', 'bad_event_id', 'dropped_invalid', 1)];
  assert.deepEqual(assessRelay({ stats, heartbeatAt: new Date(now - 60000).toISOString(), now }).problems, []);
});

test('relay health: the hourly pass judges today, raises only, and never wakes the warehouse when healthy', async () => {
  const reader = { query: async (text) => (text.includes('heartbeat') ? [{ at: FRESH }] : text.includes('daily_stats')
    ? [row('2026-11-20', 'srjt', '-', 'meta', '-', 'sent', 12), row('2026-11-20', 'srjt', '-', 'meta', '-', 'accepted', 12)] : []) };
  let woke = 0;
  const out = await checkRelayHealth({ reader, pass: 'hourly', now: NOW, getWarehouse: async () => { woke++; return null; } });
  assert.equal(out.day, '2026-11-20');
  assert.deepEqual(out.problems, []);
  assert.equal(woke, 0);
  const skipped = await checkRelayHealth({ reader: null, getWarehouse: async () => null });
  assert.match(skipped.relay, /skipped/);
});
