// db/migrations/0004_conv_labels_all_conversions.mjs — labeled per-action columns
// (conv:<label>, conv_total) sum ALL conversions, not primary conversions.
//
// Funnel.io's per-conversion-action columns are all_conversions. That only differed
// from metrics.conversions once an action was demoted to secondary: Teguar's
// "Teguar (web) Get a Quick Quote" and "First Time Phone Call" (Google 6942385423)
// went secondary ~2026-06-29, and from then on the (SB) feed read 0 for both while
// Funnel kept reporting them. Primary actions are unaffected (conversions =
// all_conversions for them).

export const id = '0004_conv_labels_all_conversions';

export const statements = [
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
       select ca.report_label, sum(coalesce(x.all_conversions, x.conversions)) as conv
       from ads.conversions_daily x
       join ads.conversion_actions ca on ca.platform = x.platform and ca.account_id = x.account_id and ca.action_id = x.action_id
       where x.platform = d.platform and x.account_id = d.account_id and x.campaign_id = d.campaign_id
         and x.date = d.date and ca.report_label is not null
       group by ca.report_label
     ) l
   ) cl on true`,
];
