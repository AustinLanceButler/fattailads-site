// api/_lib/warehouse.mjs — the `ads` warehouse on the same Neon database as the
// connect portal (api/_lib/db.mjs). Schema lives in db/migrations and is applied
// here on first use per cold start, versioned through ads.schema_migrations.
//
// Bulk writes go through jsonb_to_recordset(): one parameter per statement, typed
// columns, ON CONFLICT upsert, chunked so a single statement stays small.

import { sql as neonSql } from './db.mjs';
import { MIGRATIONS } from '../../db/migrations/index.mjs';

let ready = null;
let clientFactory = neonSql;

// Tests swap the Neon HTTP client for a local Postgres client with the same
// `.query(text, params) → rows` surface.
export function useClient(factory) {
  clientFactory = factory;
  ready = null;
}

export async function wh() {
  const q = clientFactory();
  if (!ready) {
    ready = migrate(q).catch((err) => { ready = null; throw err; });
  }
  await ready;
  return q;
}

export function exec(q, text, params = []) {
  return q.query(text, params);
}

async function migrate(q) {
  await exec(q, 'create schema if not exists ads');
  await exec(q, 'create table if not exists ads.schema_migrations (id text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await exec(q, 'select id from ads.schema_migrations')).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    for (const s of m.statements) await exec(q, s);
    await exec(q, 'insert into ads.schema_migrations (id) values ($1) on conflict do nothing', [m.id]);
  }
}

// ── table specs for upserts ──────────────────────────────────────────────────

export const TABLES = {
  ad_daily: {
    types: {
      platform: 'text', account_id: 'text', campaign_id: 'text', date: 'date',
      cost: 'numeric', clicks: 'bigint', impressions: 'bigint',
      all_conversions: 'numeric', conversions: 'numeric', conversions_value: 'numeric',
      search_impression_share: 'numeric', search_budget_lost_is: 'numeric', search_rank_lost_is: 'numeric',
      is_complete: 'boolean', source: 'text', run_id: 'bigint',
    },
    conflict: ['platform', 'account_id', 'campaign_id', 'date'],
    extraSet: 'ingested_at = now()',
  },
  conversions_daily: {
    types: {
      platform: 'text', account_id: 'text', campaign_id: 'text', date: 'date', action_id: 'text',
      action_name: 'text', category: 'text',
      all_conversions: 'numeric', conversions: 'numeric', value: 'numeric', run_id: 'bigint',
    },
    conflict: ['platform', 'account_id', 'campaign_id', 'date', 'action_id'],
    extraSet: 'ingested_at = now()',
  },
  campaign_budget_daily: {
    types: {
      platform: 'text', account_id: 'text', campaign_id: 'text', snapshot_date: 'date',
      budget_id: 'text', amount: 'numeric', is_shared: 'boolean',
      budget_status: 'text', campaign_status: 'text', budget_scope: 'text',
    },
    conflict: ['platform', 'account_id', 'campaign_id', 'snapshot_date'],
    extraSet: 'captured_at = now()',
  },
  shared_budget_daily: {
    types: {
      platform: 'text', account_id: 'text', budget_id: 'text', snapshot_date: 'date',
      name: 'text', amount: 'numeric', status: 'text', association_count: 'int', active_campaign_count: 'int',
    },
    conflict: ['platform', 'account_id', 'budget_id', 'snapshot_date'],
    extraSet: 'captured_at = now()',
  },
  budgets: {
    types: {
      platform: 'text', account_id: 'text', budget_id: 'text',
      name: 'text', is_shared: 'boolean', status: 'text', period: 'text', delivery_method: 'text',
    },
    conflict: ['platform', 'account_id', 'budget_id'],
    extraSet: 'updated_at = now()',
  },
  conversion_actions: {
    types: {
      platform: 'text', account_id: 'text', action_id: 'text',
      name: 'text', category: 'text', type: 'text', status: 'text',
      include_in_conversions: 'boolean', primary_for_goal: 'boolean',
    },
    conflict: ['platform', 'account_id', 'action_id'],
    // report_label is operator-maintained; never overwrite it from the API.
    extraSet: 'updated_at = now()',
  },
  funnel_archive: {
    types: {
      source_tab: 'text', data_source: 'text', data_source_name: 'text', account_id: 'text', campaign_id: 'text',
      date: 'date', campaign: 'text', budget_text: 'text', daily_budget: 'numeric', cost: 'numeric',
      clicks: 'bigint', impressions: 'bigint', all_conv: 'numeric', store_visits: 'numeric', search_is: 'numeric', extra: 'jsonb',
    },
    conflict: null,
  },
};

// Insert/upsert `rows` (array of plain objects) into ads.<table>. Only columns
// present in the spec AND in the first row are written; missing keys become NULL.
export async function upsert(q, table, rows, { chunk = 1500 } = {}) {
  const spec = TABLES[table];
  if (!spec) throw new Error(`no upsert spec for ${table}`);
  if (!rows.length) return 0;
  const cols = Object.keys(spec.types).filter((c) => rows.some((r) => r[c] !== undefined));
  const recordDef = cols.map((c) => `${c} ${spec.types[c]}`).join(', ');
  const colList = cols.join(', ');
  let conflictClause = '';
  if (spec.conflict) {
    const updates = cols.filter((c) => !spec.conflict.includes(c)).map((c) => `${c} = excluded.${c}`);
    if (spec.extraSet) updates.push(spec.extraSet);
    conflictClause = updates.length
      ? ` on conflict (${spec.conflict.join(', ')}) do update set ${updates.join(', ')}`
      : ` on conflict (${spec.conflict.join(', ')}) do nothing`;
  }
  const text = `insert into ads.${table} (${colList}) select ${colList} from jsonb_to_recordset($1::jsonb) as r(${recordDef})${conflictClause}`;
  let n = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk).map((r) => Object.fromEntries(cols.map((c) => [c, r[c] === undefined ? null : r[c]])));
    await exec(q, text, [JSON.stringify(part)]);
    n += part.length;
  }
  return n;
}

// Campaign dimension + name history. `campaigns` rows: { campaign_id, name, status,
// channel_type, channel_sub_type, budget_id, first_seen, last_seen, raw }.
export async function syncCampaigns(q, platform, accountId, campaigns, today) {
  if (!campaigns.length) return 0;
  const rows = campaigns.map((c) => ({
    platform, account_id: accountId, campaign_id: String(c.campaign_id), name: c.name || '', status: c.status || null,
    channel_type: c.channel_type || null, channel_sub_type: c.channel_sub_type || null, budget_id: c.budget_id ? String(c.budget_id) : null,
    first_seen: c.first_seen || today, last_seen: c.last_seen || today, raw: c.raw || null,
  }));
  const def = 'platform text, account_id text, campaign_id text, name text, status text, channel_type text, channel_sub_type text, budget_id text, first_seen date, last_seen date, raw jsonb';
  for (let i = 0; i < rows.length; i += 1500) {
    const part = JSON.stringify(rows.slice(i, i + 1500));
    await exec(q, `insert into ads.campaigns (platform, account_id, campaign_id, name, status, channel_type, channel_sub_type, budget_id, first_seen, last_seen, raw)
      select platform, account_id, campaign_id, name, status, channel_type, channel_sub_type, budget_id, first_seen, last_seen, raw
      from jsonb_to_recordset($1::jsonb) as r(${def})
      on conflict (platform, account_id, campaign_id) do update set
        name = excluded.name, status = coalesce(excluded.status, ads.campaigns.status),
        channel_type = coalesce(excluded.channel_type, ads.campaigns.channel_type),
        channel_sub_type = coalesce(excluded.channel_sub_type, ads.campaigns.channel_sub_type),
        budget_id = coalesce(excluded.budget_id, ads.campaigns.budget_id),
        first_seen = least(coalesce(ads.campaigns.first_seen, excluded.first_seen), excluded.first_seen),
        last_seen = greatest(coalesce(ads.campaigns.last_seen, excluded.last_seen), excluded.last_seen),
        removed_at = case when excluded.status in ('REMOVED','Deleted','DELETED') then coalesce(ads.campaigns.removed_at, excluded.last_seen) else null end,
        raw = coalesce(excluded.raw, ads.campaigns.raw), updated_at = now()`, [part]);
    // Close the open history row when the name changed, then open a new one.
    await exec(q, `update ads.campaign_name_history h set valid_to = $2::date
      from jsonb_to_recordset($1::jsonb) as r(${def})
      where h.platform = r.platform and h.account_id = r.account_id and h.campaign_id = r.campaign_id
        and h.valid_to is null and h.name <> r.name and h.valid_from < $2::date`, [part, today]);
    await exec(q, `insert into ads.campaign_name_history (platform, account_id, campaign_id, name, valid_from)
      select r.platform, r.account_id, r.campaign_id, r.name,
             case when exists (select 1 from ads.campaign_name_history h0 where h0.platform = r.platform and h0.account_id = r.account_id and h0.campaign_id = r.campaign_id)
                  then $2::date else r.first_seen end
      from jsonb_to_recordset($1::jsonb) as r(${def})
      where not exists (select 1 from ads.campaign_name_history h where h.platform = r.platform and h.account_id = r.account_id
                        and h.campaign_id = r.campaign_id and h.valid_to is null and h.name = r.name)
      on conflict (platform, account_id, campaign_id, valid_from) do update set name = excluded.name, valid_to = null`, [part, today]);
  }
  return rows.length;
}

// ── runs ─────────────────────────────────────────────────────────────────────

export async function startRun(q, { job, platform = null, account_id = null, window_from = null, window_to = null, detail = null }) {
  const [row] = await exec(q, `insert into ads.ingest_runs (job, platform, account_id, window_from, window_to, detail)
    values ($1, $2, $3, $4, $5, $6) returning run_id`, [job, platform, account_id, window_from, window_to, detail ? JSON.stringify(detail) : null]);
  return Number(row.run_id);
}

export async function finishRun(q, runId, { status, rows = null, detail = null, error = null }) {
  await exec(q, `update ads.ingest_runs set status = $2, rows_upserted = $3, detail = coalesce($4::jsonb, detail), error = $5, finished_at = now() where run_id = $1`,
    [runId, status, rows, detail ? JSON.stringify(detail) : null, error ? String(error).slice(0, 2000) : null]);
}

// ── config ───────────────────────────────────────────────────────────────────

export async function listAccounts(q, { platform = null, account_id = null, includeDisabled = false } = {}) {
  return exec(q, `select * from ads.ad_accounts
    where ($1::text is null or platform = $1) and ($2::text is null or account_id = $2) and ($3::boolean or enabled)
    order by client_id, platform, account_id`, [platform, account_id, includeDisabled]);
}

export async function listFeeds(q, { feed_id = null, includeDisabled = false } = {}) {
  return exec(q, `select * from ads.sheet_feeds where ($1::int is null or feed_id = $1) and ($2::boolean or enabled) order by feed_id`, [feed_id, includeDisabled]);
}

// Admin-driven seeding: clients, ad_accounts, sheet_feeds, stores, rules, aliases,
// conversion-action labels. Each list is upserted by its natural key. Account IDs
// and client config stay in the database, never in this (public) repo.
export async function applySeed(q, seed) {
  const out = {};
  for (const c of seed.clients || []) {
    await exec(q, `insert into ads.clients (client_id, display_name, timezone) values ($1, $2, coalesce($3, 'America/New_York'))
      on conflict (client_id) do update set display_name = excluded.display_name, timezone = excluded.timezone`, [c.client_id, c.display_name, c.timezone || null]);
  }
  out.clients = (seed.clients || []).length;
  for (const a of seed.ad_accounts || []) {
    await exec(q, `insert into ads.ad_accounts (platform, account_id, client_id, label, parent_id, currency, timezone, feed_source_tag, backfill_from, enabled, config)
      values ($1, $2, $3, $4, $5, coalesce($6, 'USD'), coalesce($7, 'America/New_York'), $8, $9, coalesce($10, true), coalesce($11::jsonb, '{}'::jsonb))
      on conflict (platform, account_id) do update set client_id = excluded.client_id, label = excluded.label, parent_id = excluded.parent_id,
        currency = excluded.currency, timezone = excluded.timezone, feed_source_tag = excluded.feed_source_tag,
        backfill_from = excluded.backfill_from, enabled = excluded.enabled, config = excluded.config`,
      [a.platform, String(a.account_id), a.client_id, a.label, a.parent_id ? String(a.parent_id) : null, a.currency || null, a.timezone || null,
        a.feed_source_tag, a.backfill_from || null, a.enabled ?? null, a.config ? JSON.stringify(a.config) : null]);
  }
  out.ad_accounts = (seed.ad_accounts || []).length;
  for (const f of seed.sheet_feeds || []) {
    await exec(q, `insert into ads.sheet_feeds (client_id, spreadsheet_id, tab, accounts, columns, header, window_rule, archive_sources, date_columns, min_rows, enabled, source)
      values ($1, $2, $3, $4::jsonb, $5::text[], $6::text[], coalesce($7, 'month_start_minus_2'), coalesce($8::text[], '{}'), coalesce($9::int[], '{1}'), coalesce($10, 50), coalesce($11, true), coalesce($12, 'campaign_daily'))
      on conflict (spreadsheet_id, tab) do update set client_id = excluded.client_id, accounts = excluded.accounts, columns = excluded.columns, header = excluded.header,
        window_rule = excluded.window_rule, archive_sources = excluded.archive_sources, date_columns = excluded.date_columns, min_rows = excluded.min_rows, enabled = excluded.enabled, source = excluded.source`,
      [f.client_id, f.spreadsheet_id, f.tab, JSON.stringify(f.accounts), f.columns, f.header || null, f.window_rule || null, f.archive_sources || null, f.date_columns || null, f.min_rows ?? null, f.enabled ?? null, f.source || null]);
  }
  out.sheet_feeds = (seed.sheet_feeds || []).length;
  for (const s of seed.stores || []) {
    await exec(q, `insert into ads.stores (client_id, store_number, market, store_name, city, state, opened_on, closed_on, meta)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      on conflict (client_id, store_number) do update set market = excluded.market, store_name = excluded.store_name, city = excluded.city, state = excluded.state,
        opened_on = excluded.opened_on, closed_on = excluded.closed_on, meta = excluded.meta`,
      [s.client_id, String(s.store_number), s.market, s.store_name || null, s.city || null, s.state || null, s.opened_on || null, s.closed_on || null, s.meta ? JSON.stringify(s.meta) : null]);
  }
  out.stores = (seed.stores || []).length;
  for (const m of seed.market_aliases || []) {
    await exec(q, `insert into ads.market_aliases (client_id, alias, market) values ($1, $2, $3) on conflict (client_id, alias) do update set market = excluded.market`, [m.client_id, m.alias, m.market]);
  }
  out.market_aliases = (seed.market_aliases || []).length;
  if (seed.campaign_name_rules) {
    // Rules are replaced per client so priorities stay coherent.
    const clients = [...new Set(seed.campaign_name_rules.map((r) => r.client_id))];
    for (const c of clients) await exec(q, 'delete from ads.campaign_name_rules where client_id = $1', [c]);
    for (const r of seed.campaign_name_rules) {
      await exec(q, `insert into ads.campaign_name_rules (client_id, platform, priority, pattern, channel, tactic, market, market_group, store_group, notes)
        values ($1, $2, coalesce($3, 100), $4, $5, $6, $7, $8, $9, $10)`,
        [r.client_id, r.platform || null, r.priority ?? null, r.pattern, r.channel || null, r.tactic || null, r.market || null, r.market_group ?? null, r.store_group ?? null, r.notes || null]);
    }
    out.campaign_name_rules = seed.campaign_name_rules.length;
  }
  for (const l of seed.conversion_labels || []) {
    // { platform, account_id, match: 'regex on action name', report_label }
    await exec(q, `update ads.conversion_actions set report_label = $4, updated_at = now() where platform = $1 and account_id = $2 and name ~* $3`,
      [l.platform, String(l.account_id), l.match, l.report_label]);
  }
  out.conversion_labels = (seed.conversion_labels || []).length;
  return out;
}
