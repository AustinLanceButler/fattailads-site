// api/_lib/db.mjs — Neon Postgres (Vercel Marketplace store "fta-connect").
// DATABASE_URL is injected by the Vercel↔Neon integration; preview deploys get
// their own database branch, so tests never touch production rows.
//
// The schema is created idempotently on first use per cold start — the data set
// is tiny and this avoids a separate migration step in the static-site pipeline.

import { neon } from '@neondatabase/serverless';

let sqlClient = null;
let schemaReady = null;

export function sql() {
  if (!sqlClient) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    sqlClient = neon(process.env.DATABASE_URL);
  }
  return sqlClient;
}

export async function db() {
  const q = sql();
  if (!schemaReady) {
    schemaReady = (async () => {
      await q`CREATE TABLE IF NOT EXISTS connect_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        client_name text NOT NULL,
        company text NOT NULL,
        email text NOT NULL,
        products text[] NOT NULL,
        is_test boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'open',
        ga4_fired_at timestamptz
      )`;
      await q`CREATE TABLE IF NOT EXISTS connect_items (
        id bigserial PRIMARY KEY,
        request_id uuid NOT NULL REFERENCES connect_requests(id) ON DELETE CASCADE,
        product text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        asset_id text,
        asset_name text,
        role text,
        detail text,
        verified_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (request_id, product)
      )`;
      await q`CREATE TABLE IF NOT EXISTS connect_oauth_states (
        state_hash text PRIMARY KEY,
        request_id uuid NOT NULL REFERENCES connect_requests(id) ON DELETE CASCADE,
        product text NOT NULL,
        code_verifier text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        used_at timestamptz
      )`;
      await q`CREATE TABLE IF NOT EXISTS connect_audit_log (
        id bigserial PRIMARY KEY,
        ts timestamptz NOT NULL DEFAULT now(),
        request_id uuid,
        action text NOT NULL,
        detail jsonb
      )`;
    })().catch((err) => { schemaReady = null; throw err; });
  }
  await schemaReady;
  return q;
}

// Append-only audit trail. Never throws — auditing must not break the flow.
export async function audit(requestId, action, detail = {}) {
  try {
    const q = await db();
    await q`INSERT INTO connect_audit_log (request_id, action, detail)
            VALUES (${requestId || null}, ${action}, ${JSON.stringify(detail)})`;
  } catch (err) {
    console.error('[connect] audit write failed:', action, err.message);
  }
}
