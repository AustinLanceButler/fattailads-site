// db/migrations/0005_store_dims.mjs — campaign-level feed rows carrying channel,
// tactic, market, pacing market and store, so a pacing sheet can SUMIFS on exact
// columns instead of wildcard campaign-name matches.
//
// 1. campaign_dims matches the store roster with leading zeros ignored: ACE names
//    some stores "391" while the roster says "0391". It now reports the roster's
//    store number when one matches, plus store_on_roster.
// 2. ads.market_rollups maps a media market to the market a pacing sheet reports
//    (ACE: Palm Beach North / South → Palm Beach).
// 3. ads.v_campaign_dims_daily = v_feed_daily + those dimensions, with explicit
//    "(unmapped)" values so unclassified spend is visible, never silently dropped.
//    sheet_feeds.source 'campaign_dims' reads it.

export const id = '0005_store_dims';

export const statements = [
  // Same columns and order as 0001; store_on_roster is appended (create or replace
  // view can only add columns at the end).
  `create or replace view ads.campaign_dims as
   select c.platform, c.account_id, c.campaign_id, c.name, a.client_id, c.status, c.channel_type,
          coalesce(o.channel, r.channel, c.channel_type) as channel,
          coalesce(o.tactic, r.tactic) as tactic,
          coalesce(o.market, ma.market, st.market, r.market_raw) as market,
          coalesce(st.store_number, o.store_number, r.store_number) as store_number,
          case when o.campaign_id is not null then 'override' when r.rule_id is not null then 'rule' else null end as dims_source,
          (st.store_number is not null) as store_on_roster
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
   left join ads.stores st on st.client_id = a.client_id
     and ltrim(st.store_number, '0') = ltrim(coalesce(o.store_number, r.store_number), '0')`,

  `create table if not exists ads.market_rollups (
     client_id text not null references ads.clients(client_id),
     market text not null,
     pacing_market text not null,
     primary key (client_id, market)
   )`,

  // dims_source: override | roster (store on the roster) | unmapped store (store
  // number not on the roster) | rule (no store; market from the name or the rule) |
  // unmapped (no rule matched, or a rule gave no market).
  `create or replace view ads.v_campaign_dims_daily as
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

  `alter table ads.sheet_feeds drop constraint if exists sheet_feeds_source_check`,
  `alter table ads.sheet_feeds add constraint sheet_feeds_source_check check (source in ('campaign_daily', 'media_daily', 'campaign_dims'))`,
];
