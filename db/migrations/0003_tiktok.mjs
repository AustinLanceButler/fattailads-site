// db/migrations/0003_tiktok.mjs — TikTok as a warehouse platform: widen the
// ad_accounts platform check and teach is_live_status TikTok's operation_status.

export const id = '0003_tiktok';

export const statements = [
  `alter table ads.ad_accounts drop constraint if exists ad_accounts_platform_check`,
  `alter table ads.ad_accounts add constraint ad_accounts_platform_check
     check (platform in ('google','microsoft','meta','linkedin','tiktok'))`,

  `create or replace function ads.is_live_status(p text, s text) returns boolean
   language sql immutable as $$
     select case p
       when 'google' then s = 'ENABLED'
       when 'microsoft' then s in ('Active','BudgetPaused')
       when 'meta' then s = 'ACTIVE'
       when 'linkedin' then s = 'ACTIVE'
       when 'tiktok' then s = 'ENABLE'
       else coalesce(s,'') <> '' end
   $$`,
];
