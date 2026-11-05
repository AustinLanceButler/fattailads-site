// db/migrations/0006_delivery_depth.mjs — reach, frequency and video metrics on the
// daily facts, plus an ad-group grain. TikTok fills them first (api/_lib/ingest/
// tiktok.mjs); the columns are platform-neutral so Meta can fill them later.
//
// 1. ad_daily gains reach, frequency and the video funnel. Other platforms never
//    send these keys, so their rows keep NULL (upsert only writes columns present).
// 2. ads.adgroups + ads.adgroup_daily: one row per ad group (TikTok ad group, Meta
//    ad set) per day, same metric columns as ad_daily. ads.v_adgroup_daily adds names
//    and the parent campaign's dimensions.
// 3. v_feed_daily appends the new columns (a sheet feed can now ask for 'reach',
//    'video_views_p100', ...). v_campaign_dims_daily and v_campaign_daily select f.*,
//    so they are dropped and re-created to pick the new columns up; nothing else
//    depends on them.
// 4. v_media_daily appends SUMS of the additive video counts only.
//
// NON-ADDITIVE: reach and frequency are unique-user measures for one campaign (or ad
// group) on one day. Summing reach across days or campaigns over-counts people, and
// frequency is a ratio. They are stored per row and no view here sums them. Same for
// average_video_play (seconds per play): weight it by video_play_actions if you
// must roll it up.

export const id = '0006_delivery_depth';

const DEPTH_COLS = `
     reach bigint,
     frequency numeric(10,4),
     video_play_actions bigint,
     video_watched_2s bigint,
     video_watched_6s bigint,
     video_views_p25 bigint,
     video_views_p50 bigint,
     video_views_p75 bigint,
     video_views_p100 bigint,
     engaged_view bigint,
     average_video_play numeric(10,4)`;

export const statements = [
  `alter table ads.ad_daily
     add column if not exists reach bigint,
     add column if not exists frequency numeric(10,4),
     add column if not exists video_play_actions bigint,
     add column if not exists video_watched_2s bigint,
     add column if not exists video_watched_6s bigint,
     add column if not exists video_views_p25 bigint,
     add column if not exists video_views_p50 bigint,
     add column if not exists video_views_p75 bigint,
     add column if not exists video_views_p100 bigint,
     add column if not exists engaged_view bigint,
     add column if not exists average_video_play numeric(10,4)`,

  // ── ad-group grain ─────────────────────────────────────────────────────────
  `create table if not exists ads.adgroups (
     platform text not null, account_id text not null, adgroup_id text not null,
     campaign_id text,
     name text not null,
     status text,
     budget numeric(14,6), budget_mode text,
     first_seen date, last_seen date,
     updated_at timestamptz not null default now(),
     primary key (platform, account_id, adgroup_id),
     foreign key (platform, account_id) references ads.ad_accounts(platform, account_id)
   )`,

  `create table if not exists ads.adgroup_daily (
     platform text not null, account_id text not null, adgroup_id text not null,
     date date not null,
     campaign_id text,
     cost numeric(14,6) not null default 0,
     clicks bigint not null default 0,
     impressions bigint not null default 0,
     all_conversions numeric(14,4),
     conversions numeric(14,4),
     conversions_value numeric(14,4),${DEPTH_COLS},
     is_complete boolean not null default true,
     source text not null default 'api',
     run_id bigint,
     ingested_at timestamptz not null default now(),
     primary key (platform, account_id, adgroup_id, date)
   )`,
  `create index if not exists adgroup_daily_campaign_idx on ads.adgroup_daily (platform, account_id, campaign_id, date)`,

  `create or replace view ads.v_adgroup_daily as
   select d.platform, d.account_id, a.client_id, a.feed_source_tag,
          a.feed_source_tag || ':' || d.account_id as data_source,
          d.campaign_id,
          ads.name_asof(d.platform, d.account_id, d.campaign_id, d.date) as campaign,
          d.adgroup_id, g.name as adgroup, g.status as adgroup_status,
          d.date,
          round(d.cost, 2) as cost, d.clicks, d.impressions,
          d.all_conversions as all_conv, d.conversions, d.conversions_value,
          d.reach, d.frequency, d.video_play_actions, d.video_watched_2s, d.video_watched_6s,
          d.video_views_p25, d.video_views_p50, d.video_views_p75, d.video_views_p100,
          d.engaged_view, d.average_video_play,
          dm.channel, dm.tactic, dm.market, dm.store_number,
          d.is_complete, d.source
   from ads.adgroup_daily d
   join ads.ad_accounts a on a.platform = d.platform and a.account_id = d.account_id
   left join ads.adgroups g on g.platform = d.platform and g.account_id = d.account_id and g.adgroup_id = d.adgroup_id
   left join ads.campaign_dims dm on dm.platform = d.platform and dm.account_id = d.account_id and dm.campaign_id = d.campaign_id`,

  // ── feed views ─────────────────────────────────────────────────────────────
  // 0004's v_feed_daily, unchanged, with the depth columns appended at the end.
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
          d.is_complete, d.source,
          d.reach, d.frequency, d.video_play_actions, d.video_watched_2s, d.video_watched_6s,
          d.video_views_p25, d.video_views_p50, d.video_views_p75, d.video_views_p100,
          d.engaged_view, d.average_video_play
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
       select ca.report_label, sum(coalesce(x.all_conversions, x.conversions)) as conv
       from ads.conversions_daily x
       join ads.conversion_actions ca on ca.platform = x.platform and ca.account_id = x.account_id and ca.action_id = x.action_id
       where x.platform = d.platform and x.account_id = d.account_id and x.campaign_id = d.campaign_id
         and x.date = d.date and ca.report_label is not null
       group by ca.report_label
     ) l
   ) cl on true`,

  // f.* was expanded when these were created, so re-create them to carry the new columns.
  `drop view if exists ads.v_campaign_dims_daily`,
  // 0005's definition, unchanged.
  `create view ads.v_campaign_dims_daily as
   select f.*,
          case f.platform when 'google' then 'Google' when 'microsoft' then 'Bing' when 'meta' then 'Facebook'
                          when 'tiktok' then 'TikTok' when 'linkedin' then 'LinkedIn' else f.platform end as platform_label,
          case when dm.dims_source is null then '(unmapped)' else coalesce(nullif(dm.channel, ''), '(unmapped)') end as channel,
          coalesce(nullif(dm.tactic, ''), '-') as tactic,
          mk.market,
          coalesce(mr.pacing_market, mk.market) as pacing_market,
          coalesce(dm.store_number, '') as store_number,
          case when dm.dims_source is null then 'unmapped'
               when dm.dims_source = 'override' then 'override'
               when dm.store_number is not null and dm.store_on_roster then 'roster'
               when dm.store_number is not null and coalesce(dm.market, '') = '' then 'unmapped store'
               when coalesce(dm.market, '') = '' then 'unmapped'
               else 'rule' end as dims_source
   from ads.v_feed_daily f
   left join ads.campaign_dims dm on dm.platform = f.platform and dm.account_id = f.account_id and dm.campaign_id = f.campaign_id
   cross join lateral (
     select case when dm.dims_source is null then '(unmapped)'
                 when coalesce(dm.market, '') <> '' then dm.market
                 when dm.store_number is not null then '(unmapped store)'
                 else '(unmapped)' end as market
   ) mk
   left join ads.market_rollups mr on mr.client_id = f.client_id and mr.market = mk.market`,

  `drop view if exists ads.v_campaign_daily`,
  // 0001's definition, unchanged.
  `create view ads.v_campaign_daily as
   select f.*, dm.channel, dm.tactic, dm.market, dm.store_number
   from ads.v_feed_daily f
   left join ads.campaign_dims dm on dm.platform = f.platform and dm.account_id = f.account_id and dm.campaign_id = f.campaign_id`,

  // 0002's v_media_daily with additive video counts appended (reach/frequency are not).
  `create or replace view ads.v_media_daily as
   select d.platform, d.account_id, a.client_id, d.date,
          coalesce(dm.channel, '(unmapped)') as channel,
          coalesce(dm.market, '') as market,
          coalesce(dm.tactic, '') as tactic,
          round(sum(d.cost), 2) as spend,
          sum(d.impressions) as impressions,
          sum(d.clicks) as clicks,
          round(sum(coalesce(d.conversions, 0)), 2) as conversions,
          round(sum(coalesce(sv.store_visits, 0)), 2) as store_visits,
          bool_and(d.is_complete) as is_complete,
          sum(d.video_play_actions) as video_play_actions,
          sum(d.video_watched_2s) as video_watched_2s,
          sum(d.video_watched_6s) as video_watched_6s,
          sum(d.video_views_p25) as video_views_p25,
          sum(d.video_views_p50) as video_views_p50,
          sum(d.video_views_p75) as video_views_p75,
          sum(d.video_views_p100) as video_views_p100,
          sum(d.engaged_view) as engaged_view
   from ads.ad_daily d
   join ads.ad_accounts a on a.platform = d.platform and a.account_id = d.account_id
   left join ads.campaign_dims dm on dm.platform = d.platform and dm.account_id = d.account_id and dm.campaign_id = d.campaign_id
   left join (
     select platform, account_id, campaign_id, date, sum(all_conversions) as store_visits
     from ads.conversions_daily where category = 'STORE_VISIT'
     group by platform, account_id, campaign_id, date
   ) sv on sv.platform = d.platform and sv.account_id = d.account_id and sv.campaign_id = d.campaign_id and sv.date = d.date
   group by d.platform, d.account_id, a.client_id, d.date, 5, 6, 7`,

  // Default privileges (0001) cover these when the app role made them; grant
  // explicitly too in case ads_reader was created by hand.
  `do $$ begin
     if exists (select 1 from pg_roles where rolname = 'ads_reader') then
       begin
         grant select on ads.adgroups, ads.adgroup_daily, ads.v_adgroup_daily,
           ads.v_campaign_dims_daily, ads.v_campaign_daily to ads_reader;
       exception when insufficient_privilege then
         raise notice 'ads_reader grants skipped: insufficient privilege';
       end;
     end if;
   end $$`,
];
