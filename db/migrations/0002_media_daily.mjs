// db/migrations/0002_media_daily.mjs — a rolled-up feed shape for dashboards.
//
// The campaign-per-day feed is ~150k rows for ACE since 2025: too big for a sheet a
// dashboard reads live. ads.v_media_daily sums the same facts to date × channel ×
// market × tactic (dimensions from ads.campaign_dims, i.e. the name rules), and
// sheet_feeds.source picks which view a feed reads.

export const id = '0002_media_daily';

export const statements = [
  `alter table ads.sheet_feeds add column if not exists source text not null default 'campaign_daily'`,

  `do $$ begin
     if not exists (select 1 from pg_constraint where conname = 'sheet_feeds_source_check') then
       alter table ads.sheet_feeds add constraint sheet_feeds_source_check check (source in ('campaign_daily', 'media_daily'));
     end if;
   end $$`,

  // Reads ad_daily directly (not v_feed_daily) so the roll-up skips the per-row
  // name/budget lookups it doesn't need. Store visits match v_feed_daily's.
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
          bool_and(d.is_complete) as is_complete
   from ads.ad_daily d
   join ads.ad_accounts a on a.platform = d.platform and a.account_id = d.account_id
   left join ads.campaign_dims dm on dm.platform = d.platform and dm.account_id = d.account_id and dm.campaign_id = d.campaign_id
   left join (
     select platform, account_id, campaign_id, date, sum(all_conversions) as store_visits
     from ads.conversions_daily where category = 'STORE_VISIT'
     group by platform, account_id, campaign_id, date
   ) sv on sv.platform = d.platform and sv.account_id = d.account_id and sv.campaign_id = d.campaign_id and sv.date = d.date
   group by d.platform, d.account_id, a.client_id, d.date, 5, 6, 7`,
  // ads_reader (if it exists) already gets this view via 0001's default privileges.
];
