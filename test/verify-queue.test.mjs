// Integration test for the verify cron's re-check queues (set PG_TEST_URL; skipped otherwise):
//   PG_TEST_URL=postgres://user@localhost:5432/postgres node --test test/verify-queue.test.mjs
// Runs the real agencyQueue / guidedQueue SQL against temp tables shaped like the
// connect schema, through a tagged-template adapter that mimics the Neon client.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.PG_TEST_URL;

test('verify queues skip stale and old test requests', { skip: !url && 'PG_TEST_URL not set' }, async () => {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    const q = async (strings, ...vals) => {
      const text = strings.reduce((acc, s, i) => acc + '$' + i + s);
      return (await client.query(text, vals)).rows;
    };
    await client.query(`CREATE TEMP TABLE connect_requests (id uuid PRIMARY KEY, created_at timestamptz NOT NULL,
                          company text NOT NULL, is_test boolean NOT NULL DEFAULT false)`);
    await client.query(`CREATE TEMP TABLE connect_items (id serial PRIMARY KEY, request_id uuid NOT NULL,
                          product text NOT NULL, status text NOT NULL, asset_id text, client_input jsonb,
                          fta_status text, updated_at timestamptz NOT NULL DEFAULT now())`);
    const reqs = [
      ['11111111-1111-1111-1111-111111111111', '2 days', 'Real recent', false],
      ['22222222-2222-2222-2222-222222222222', '20 days', 'Real stale', false],
      ['33333333-3333-3333-3333-333333333333', '2 hours', 'Test fresh', true],
      ['44444444-4444-4444-4444-444444444444', '3 days', 'Test old', true],
    ];
    for (const [id, age, company, isTest] of reqs) {
      await client.query(`INSERT INTO connect_requests VALUES ($1, now() - $2::interval, $3, $4)`, [id, age, company, isTest]);
      await client.query(`INSERT INTO connect_items (request_id, product, status, fta_status, client_input)
                          VALUES ($1, 'gtm', 'client_reported', 'todo', '{"accountName":"GTM-TEST"}')`, [id]);
      await client.query(`INSERT INTO connect_items (request_id, product, status) VALUES ($1, 'microsoft_ads', 'requested')`, [id]);
    }
    // A finished guided item on a recent request must never be picked up.
    await client.query(`INSERT INTO connect_items (request_id, product, status, fta_status)
                        VALUES ('11111111-1111-1111-1111-111111111111', 'ga4', 'failed', 'done')`);

    const { agencyQueue, guidedQueue, AUTO_VERIFY_DAYS, TEST_AUTO_VERIFY_HOURS } = await import('../api/_lib/verify-queue.mjs');
    assert.equal(AUTO_VERIFY_DAYS, 14);
    assert.equal(TEST_AUTO_VERIFY_HOURS, 24);
    const companyOf = async (rows) => {
      const ids = rows.map((r) => r.request_id);
      const names = (await client.query('SELECT id, company FROM connect_requests WHERE id = ANY($1)', [ids])).rows;
      return rows.map((r) => names.find((n) => n.id === r.request_id).company).sort();
    };

    const guided = await guidedQueue(q, ['ga4', 'gtm', 'search_console'], 25);
    assert.deepEqual(await companyOf(guided), ['Real recent', 'Test fresh']);
    assert.ok(guided.every((r) => r.product === 'gtm'));

    const agency = await agencyQueue(q, 25);
    assert.deepEqual(agency.map((r) => r.company).sort(), ['Real recent', 'Test fresh']);

    assert.equal((await guidedQueue(q, ['gtm'], 1)).length, 1); // LIMIT still applies
  } finally {
    await client.end();
  }
});
