// db/migrations/0001_ads.mjs — the `ads` warehouse schema (Funnel.io replacement).
//
// Applied by api/_lib/warehouse.mjs on first use, one statement at a time, and
// recorded in ads.schema_migrations. Every statement is idempotent so a partial
// run can simply be re-run. Keep this file append-only: later changes go in a
// new 000N_*.mjs module and are registered in ./index.mjs.
//
// Shape: dimensions (accounts, campaigns + name history, budgets, conversion
// actions, store/market mapping), facts (ad_daily, conversions_daily, budget
// snapshots), a Funnel archive for reconciliation, ops tables (ingest_runs,
// sheet_feeds, alerts) and the views the Sheets writer and Claude read.

export const id = '0001_ads';

export const statements = [
  `create schema if not exists ads`,

  // ── dimensions ─────────────────────────────────────────────────────────────
  `create table if not exists ads.clients (
     client_id text primary key,
     display_name text not null,
     timezone text not null default 'America/New_York'
   )`,

  `create table if not exists ads.ad_accounts (
     platform text not null check (platform in ('google','microsoft','meta','linkedin')),
     account_id text not null,
     client_id text not null references ads.clients(client_id),
     label text not null,
     parent_id text,
     currency text not null default 'USD',
     timezone text not null default 'America/New_York',
     feed_source_tag text not null,
     backfill_from date,
     enabled boolean not null default true,
     config jsonb not null default '{}'::jsonb,
     primary key (platform, account_id)
   )`,

  `create table if not exists ads.campaigns (
     platform text not null, account_id text not null, campaign_id text not null,
     name text not null,
     status text,
     channel_type text, channel_sub_type text,
     budget_id text,
     first_seen date, last_seen date, removed_at date,
     raw jsonb,
     updated_at timestamptz not null default now(),
     primary key (platform, account_id, campaign_id),
     foreign key (platform, account_id) references ads.ad_accounts(platform, account_id)
   )`,

  `create table if not exists ads.campaign_name_history (
     platform text not null, account_id text not null, campaign_id text not null,
     name text not null,
     valid_from date not null, valid_to date,
     primary key (platform, account_id, campaign_id, valid_from)
   )`,

  `create table if not exists ads.budgets (
     platform text not null, account_id text not null, budget_id text not null,
     name text, is_shared boolean not null default false,
     status text, period text, delivery_method text,
     updated_at timestamptz not null default now(),
     primary key (platform, account_id, budget_id)
   )`,

  `create table if not exists ads.conversion_actions (
     platform text not null, account_id text not null, action_id text not null,
     name text not null, category text, type text, status text,
     include_in_conversions boolean, primary_for_goal boolean,
     report_label text,
     updated_at timestamptz not null default now(),
     primary key (platform, account_id, action_id)
   )`,

  `create table if not exists ads.stores (
     client_id text not null references ads.clients(client_id),
     store_number text not null,
     market text not null,
     store_name text, city text, state text,
     opened_on date, closed_on date,
     meta jsonb,
     primary key (client_id, store_number)
   )`,

  `create table if not exists ads.market_aliases (
     client_id text not null, alias text not null, market text not null,
     primary key (client_id, alias)
   )`,

  `create table if not exists ads.campaign_name_rules (
     rule_id serial primary key,
     client_id text not null,
     platform text,
     priority int not null default 100,
     pattern text not null,
     channel text, tactic text, market text,
     market_group int, store_group int,
     notes text
   )`,

  `create table if not exists ads.campaign_dims_override (
     platform text not null, account_id text not null, campaign_id text not null,
     channel text, tactic text, market text, store_number text, note text,
     primary key (platform, account_id, campaign_id)
   )`,

  // ── facts ──────────────────────────────────────────────────────────────────
  `create table if not exists ads.ad_daily (
     platform text not null, account_id text not null, campaign_id text not null,
     date date not null,
     cost numeric(14,6) not null default 0,
     clicks bigint not null default 0,
     impressions bigint not null default 0,
     all_conversions numeric(14,4),
     conversions numeric(14,4),
     conversions_value numeric(14,4),
     search_impression_share numeric(7,6),
     search_budget_lost_is numeric(7,6),
     search_rank_lost_is numeric(7,6),
     is_complete boolean not null default true,
     source text not null default 'api',
     run_id bigint,
     ingested_at timestamptz not null default now(),
     primary key (platform, account_id, campaign_id, date)
   )`,
  `create index if not exists ad_daily_account_date_idx on ads.ad_daily (platform, account_id, date)`,

  `create table if not exists ads.conversions_daily (
     platform text not null, account_id text not null, campaign_id text not null,
     date date not null, action_id text not null,
     action_name text, category text,
     all_conversions numeric(14,4), conversions numeric(14,4), value numeric(14,4),
     run_id bigint,
     ingested_at timestamptz not null default now(),
     primary key (platform, account_id, campaign_id, date, action_id)
   )`,
  `create index if not exists conversions_daily_cat_idx on ads.conversions_daily (platform, account_id, campaign_id, date, category)`,

  `create table if not exists ads.campaign_budget_daily (
     platform text not null, account_id text not null, campaign_id text not null,
     snapshot_date date not null,
     budget_id text, amount numeric(14,6), is_shared boolean,
     budget_status text, campaign_status text, budget_scope text,
     captured_at timestamptz not null default now(),
     primary key (platform, account_id, campaign_id, snapshot_date)
   )`,

  `create table if not exists ads.shared_budget_daily (
     platform text not null, account_id text not null, budget_id text not null,
     snapshot_date date not null,
     name text, amount numeric(14,6), status text,
     association_count int, active_campaign_count int,
     captured_at timestamptz not null default now(),
     primary key (platform, account_id, budget_id, snapshot_date)
   )`,

  `create table if not exists ads.funnel_archive (
     source_tab text not null,
     data_source text, data_source_name text, account_id text, campaign_id text,
     date date not null, campaign text not null,
     budget_text text, daily_budget numeric, cost numeric, clicks bigint, impressions bigint,
     all_conv numeric, store_visits numeric, search_is numeric,
     extra jsonb,
     loaded_at timestamptz not null default now()
   )`,
  `create index if not exists funnel_archive_idx on ads.funnel_archive (account_id, date, campaign)`,

  // ── ops ────────────────────────────────────────────────────────────────────
  `create table if not exists ads.ingest_runs (
     run_id bigserial primary key,
     job text not null, platform text, account_id text,
     window_from date, window_to date,
     started_at timestamptz not null default now(), finished_at timestamptz,
     status text not null default 'running' check (status in ('running','ok','error','pending_report','skipped')),
     rows_upserted int, detail jsonb, error text
   )`,
  `create index if not exists ingest_runs_job_idx on ads.ingest_runs (job, started_at desc)`,

  `create table if not exists ads.sheet_feeds (
     feed_id serial primary key,
     client_id text not null,
     spreadsheet_id text not null,
     tab text not null,
     accounts jsonb not null,
     columns text[] not null,
     header text[],
     window_rule text not null default 'month_start_minus_2',
     archive_sources text[] not null default '{}',
     date_columns int[] not null default '{1}',
     min_rows int not null default 50,
     enabled boolean not null default true,
     last_pushed_at timestamptz, last_rows int, last_max_date date, last_error text,
     unique (spreadsheet_id, tab)
   )`,

  `create table if not exists ads.alerts (
     id bigserial primary key,
     ts timestamptz not null default now(),
     severity text not null default 'error',
     job text, dedupe_key text,
     message text not null, detail jsonb,
     acked boolean not null default false,
     clickup_task_id text
   )`,

  // ── functions ──────────────────────────────────────────────────────────────
  `create or replace function ads.cutoff(tz text default 'America/New_York') returns date
   language sql stable as $$ select (now() at time zone tz)::date $$`,

  `create or replace function ads.is_live_status(p text, s text) returns boolean
   language sql immutable as $$
     select case p
       when 'google' then s = 'ENABLED'
       when 'microsoft' then s in ('Active','BudgetPaused')
       when 'meta' then s = 'ACTIVE'
       when 'linkedin' then s = 'ACTIVE'
       else coalesce(s,'') <> '' end
   $$`,

  // Campaign name as it was on a date; falls back to the earliest known name,
  // then to the current name. Backfilled history only knows current names.
  `create or replace function ads.name_asof(p text, a text, c text, d date) returns text
   language sql stable as $$
     select coalesce(
       (select h.name from ads.campaign_name_history h
         where h.platform = p and h.account_id = a and h.campaign_id = c
           and h.valid_from <= d and (h.valid_to is null or h.valid_to > d)
         order by h.valid_from desc limit 1),
       (select h.name from ads.campaign_name_history h
         where h.platform = p and h.account_id = a and h.campaign_id = c
         order by h.valid_from asc limit 1),
       (select cm.name from ads.campaigns cm
         where cm.platform = p and cm.account_id = a and cm.campaign_id = c))
   $$`,

  // Daily budget in effect on a date (latest snapshot on or before it); for
  // dates before the first snapshot, the earliest snapshot.
  `create or replace function ads.budget_asof(p text, a text, c text, d date) returns numeric
   language sql stable as $$
     select coalesce(
       (select b.amount from ads.campaign_budget_daily b
         where b.platform = p and b.account_id = a and b.campaign_id = c and b.snapshot_date <= d
         order by b.snapshot_date desc limit 1),
       (select b.amount from ads.campaign_budget_daily b
         where b.platform = p and b.account_id = a and b.campaign_id = c
         order by b.snapshot_date asc limit 1))
   $$`,

  // ── views ──────────────────────────────────────────────────────────────────
  // One home for campaign → channel / tactic / market / store. Manual override
  // wins, then the first matching regex rule (by priority), then the store roster.
  `create or replace view ads.campaign_dims as
   select c.platform, c.account_id, c.campaign_id, c.name, a.client_id, c.status, c.channel_type,
          coalesce(o.channel, r.channel, c.channel_type) as channel,
          coalesce(o.tactic, r.tactic) as tactic,
          coalesce(o.market, ma.market, st.market, r.market_raw) as market,
          coalesce(o.store_number, r.store_number) as store_number,
          case when o.campaign_id is not null then 'override' when r.rule_id is not null then 'rule' else null end as dims_source
   from ads.campaigns c
   join ads.ad_accounts a on a.platform = c.platform and a.account_id = c.account_id
   left join ads.campaign_dims_override o
     on o.platform = c.platform and o.account_id = c.account_id and o.campaign_id = c.campaign_id
   left join lateral (
     select rr.rule_id, rr.channel, rr.tactic,
            coalesce(rr.market, case when rr.market_group is not null then m[rr.market_group] end) as market_raw,
            case when rr.store_group is not null then m[rr.store_group] end as store_number
     from ads.campaign_name_rules rr
     cross join lateral (select regexp_match(c.name, rr.pattern, 'i') as m) x
     where rr.client_id = a.client_id and (rr.platform is null or rr.platform = c.platform) and x.m is not null
     order by rr.priority, rr.rule_id limit 1
   ) r on true
   left join ads.market_aliases ma on ma.client_id = a.client_id and lower(ma.alias) = lower(r.market_raw)
   left join ads.stores st on st.client_id = a.client_id and st.store_number = coalesce(o.store_number, r.store_number)`,

  // Row-per-campaign-per-day feed with every column any pacing sheet reads.
  // The Sheets writer selects the columns a tab needs, in the order it needs them.
  `create or replace view ads.v_feed_daily as
   select d.platform, d.account_id, a.client_id, a.feed_source_tag,
          a.feed_source_tag || ':' || d.account_id as data_source,
          a.label as data_source_name,
          d.campaign_id,
          ads.name_asof(d.platform, d.account_id, d.campaign_id, d.date) as campaign,
          d.date,
          round(d.cost, 2) as cost,
          d.clicks, d.impressions,
          d.all_conversions as all_conv,
          d.conversions, d.conversions_value,
          coalesce(sv.store_visits, 0) as store_visits,
          d.search_impression_share as search_is,
          b.amount as daily_budget,
          case when b.amount is null then '' else 'USD' || to_char(b.amount, 'FM999999990.00') || '/day' end as daily_budget_text,
          c.budget_id, bg.name as budget_name, bg.status as budget_status,
          case when bg.budget_id is null then '' when bg.is_shared then 'Associated' else 'Unassociated' end as budget_association_status,
          c.status as campaign_status,
          'Paid'::text as paid_organic,
          cl.conv_by_label, coalesce(cl.labeled_conv_total, 0) as labeled_conv_total,
          d.is_complete, d.source
   from ads.ad_daily d
   join ads.ad_accounts a on a.platform = d.platform and a.account_id = d.account_id
   left join ads.campaigns c on c.platform = d.platform and c.account_id = d.account_id and c.campaign_id = d.campaign_id
   left join ads.budgets bg on bg.platform = c.platform and bg.account_id = c.account_id and bg.budget_id = c.budget_id
   left join lateral (select ads.budget_asof(d.platform, d.account_id, d.campaign_id, d.date) as amount) b on true
   left join lateral (
     select sum(x.all_conversions) as store_visits
     from ads.conversions_daily x
     where x.platform = d.platform and x.account_id = d.account_id and x.campaign_id = d.campaign_id
       and x.date = d.date and x.category = 'STORE_VISIT'
   ) sv on true
   left join lateral (
     select jsonb_object_agg(l.report_label, l.conv) as conv_by_label, sum(l.conv) as labeled_conv_total
     from (
       select ca.report_label, sum(x.conversions) as conv
       from ads.conversions_daily x
       join ads.conversion_actions ca on ca.platform = x.platform and ca.account_id = x.account_id and ca.action_id = x.action_id
       where x.platform = d.platform and x.account_id = d.account_id and x.campaign_id = d.campaign_id
         and x.date = d.date and ca.report_label is not null
       group by ca.report_label
     ) l
   ) cl on true`,

  // Latest budget snapshot per campaign.
  `create or replace view ads.v_budget_current as
   with latest as (
     select platform, account_id, max(snapshot_date) as snapshot_date
     from ads.campaign_budget_daily group by platform, account_id
   )
   select b.*, c.name as campaign_name, ads.is_live_status(b.platform, b.campaign_status) as is_live
   from ads.campaign_budget_daily b
   join latest l on l.platform = b.platform and l.account_id = b.account_id and l.snapshot_date = b.snapshot_date
   left join ads.campaigns c on c.platform = b.platform and c.account_id = b.account_id and c.campaign_id = b.campaign_id`,

  // One row per live budget: shared pools counted once, standalone campaigns
  // individually. SUM(amount) per account = the account's current daily cap.
  `create or replace view ads.v_budget_pools_current as
   select b.platform, b.account_id, b.snapshot_date as as_of,
          case when b.is_shared then b.budget_id else 'campaign:' || b.campaign_id end as budget_key,
          bool_or(b.is_shared) as is_shared,
          max(coalesce(s.name, b.campaign_name)) as name,
          max(b.amount) as amount,
          count(*) as live_campaigns
   from ads.v_budget_current b
   left join ads.shared_budget_daily s
     on s.platform = b.platform and s.account_id = b.account_id and s.budget_id = b.budget_id and s.snapshot_date = b.snapshot_date
   where b.is_live and b.amount is not null
   group by b.platform, b.account_id, b.snapshot_date,
            case when b.is_shared then b.budget_id else 'campaign:' || b.campaign_id end`,

  // Analysis view for Claude skills: feed + dimensions, all clients.
  `create or replace view ads.v_campaign_daily as
   select f.*, dm.channel, dm.tactic, dm.market, dm.store_number
   from ads.v_feed_daily f
   left join ads.campaign_dims dm on dm.platform = f.platform and dm.account_id = f.account_id and dm.campaign_id = f.campaign_id`,

  // Funnel vs API, by account + date + campaign name. Expect no rows older than
  // ~3 days except campaigns Funnel never carried.
  `create or replace view ads.v_reconcile_funnel as
   select coalesce(a.account_id, f.account_id) as account_id,
          coalesce(a.date, f.date) as date,
          coalesce(a.campaign, f.campaign) as campaign,
          round(a.cost, 2) as funnel_cost, round(f.cost, 2) as api_cost,
          round(coalesce(f.cost, 0) - coalesce(a.cost, 0), 2) as diff,
          a.clicks as funnel_clicks, f.clicks as api_clicks,
          case when a.campaign is null then 'api_only' when f.campaign is null then 'funnel_only' else 'both' end as presence
   from (select account_id, date, campaign, sum(cost) as cost, sum(clicks) as clicks
         from ads.funnel_archive group by account_id, date, campaign) a
   full join (select account_id, date, campaign, sum(cost) as cost, sum(clicks) as clicks
              from ads.v_feed_daily where source = 'api' and is_complete group by account_id, date, campaign) f
     on a.account_id = f.account_id and a.date = f.date and a.campaign = f.campaign
   where abs(coalesce(f.cost, 0) - coalesce(a.cost, 0)) > 0.01`,

  // Per-account health: last complete day and last OK run.
  `create or replace view ads.v_feed_health as
   select a.platform, a.account_id, a.client_id, a.label, a.enabled,
          (select max(d.date) from ads.ad_daily d where d.platform = a.platform and d.account_id = a.account_id and d.is_complete) as last_complete_date,
          (select max(r.finished_at) from ads.ingest_runs r where r.platform = a.platform and r.account_id = a.account_id and r.status = 'ok') as last_ok_at,
          (select r.error from ads.ingest_runs r where r.platform = a.platform and r.account_id = a.account_id and r.status = 'error' order by r.started_at desc limit 1) as last_error
   from ads.ad_accounts a`,

  // Read-only role for the MCP / reporting. Password is set out of band:
  //   alter role ads_reader with login password '…';
  // Skipped (with a NOTICE) when the app role lacks CREATEROLE; create it by hand then.
  `do $$ begin
     begin
       if not exists (select 1 from pg_roles where rolname = 'ads_reader') then
         create role ads_reader nologin;
       end if;
       grant usage on schema ads to ads_reader;
       grant select on all tables in schema ads to ads_reader;
       alter default privileges in schema ads grant select on tables to ads_reader;
     exception when insufficient_privilege then
       raise notice 'ads_reader not created: insufficient privilege (create it manually)';
     end;
   end $$`,
];
