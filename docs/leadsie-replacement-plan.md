# Leadsie replacement — plan (2026-09-24)

**Status:** planning only. Nothing built, no apps or approvals filed.
**TL;DR**
1. **Most of Leadsie can be replaced without clients ever signing in to our app.**
   - On 6 of 10 platforms, either FTA sends the invite with **its own** credentials (Google Ads, Microsoft Ads, Meta) or the client adds FTA in the platform's own UI.
   - In every case, FTA confirms the grant by reading it back with its own credentials.
   - This skips the heaviest review gates: Meta App Review, Business Verification and Access Verification; Google verification of the *restricted* `adwords` scope and its annual CASA assessment; LinkedIn Standard tier.
2. The only true "one-click" gains come from client-side OAuth for **GA4, GTM, Merchant Center and Business Profile**. Those need Google sensitive-scope verification (about 1–2 weeks, free). They are **Phase 2**, and the verification is filed in Phase 0 so the review runs during the build.
3. **Economics:** Claude does the build and maintenance on Austin's flat-rate Business plan, so marginal build cost is about $0. The real cost is **Austin's own time**: about 6–9 h one-time for approvals, test grants and cutover, then about 20–30 min/month. Against $1,548/yr, it **pays back immediately on cash**. Even pricing his time at $150/h, it pays back in about 13–25 months (§5). Recommended: build Tier C (full parity, including one-click Google), then cancel Leadsie.
4. **Do today, whatever you decide:** fix Leadsie's Microsoft Ads receiving account. It currently points at Ascend FCU, a client, which is a live misrouting risk.

## 1. Current pipeline — how this fits
| Piece | Today | After |
|---|---|---|
| `/connect` | `connect.html` iframes Leadsie | `connect.html` becomes a native vanilla-JS wizard (same tokens, fonts, consent bridge, GTM, `connect_page_view` push) |
| Custom links | Leadsie custom links | `/connect/<slug>` via a `vercel.json` rewrite to the same page |
| Webhook → GA4 | `api/leadsie-webhook.mjs` | `api/connect/*` functions emit `connect_completed` directly. The GA4 helper is extracted to `api/_lib/ga4.mjs` and reused. The Leadsie webhook is kept until Leadsie is cancelled |
| Build | esbuild SPA + copy standalone pages | Unchanged. Optional: one more `copyFileSync` line for `connect-admin.html → dist/connect/admin/` and `privacy.html`/`terms.html`. No framework, no new build step |

## 2. Per-platform feasibility matrix (the core of this doc)

Legend: **Agency-side** = FTA's own credentials do the grant or send the invite; the client clicks Accept in the platform. **Client-OAuth** = the client signs in to our app and the app makes the grant. **Guided** = our UI deep-links the client into the platform's own UI and gives exact steps. Every row can be **auto-verified** with FTA-side credentials unless marked otherwise.

| # | Platform (Leadsie ask) | Client-OAuth possible? | Recommended Phase 1 mechanism | Gate for recommended path | Verify with (FTA-side) | Effort | vs Leadsie |
|---|---|---|---|---|---|---|---|
| 1 | **Google Ads** — manager link | Yes, but `adwords` is **restricted** (about 6-week review + annual CASA) | **Agency-side:** FTA MCC creates a `CustomerClientLink` with status PENDING; the client accepts in Ads UI or email | Google Ads API access level on the Cloud project. Developer tokens were retired 2026-09-09; **Explorer** (automatic) covers production accounts. Link services are not on Explorer's blocked list (our inference) | GAQL `customer_client_link.status = ACTIVE` | 5 h | About equal. The client types their customer ID and clicks Accept once |
| 2 | **GA4** — Editor | Yes: Admin API `accessBindings.create` (**v1alpha only**) | Guided (Admin → Account access → add `austin@fattailads.com` as Editor). Upgrade to client-OAuth in Phase 2 | None (Phase 1). Phase 2: sensitive-scope verification of `analytics.manage.users` | Agency `accountSummaries.list` shows the account | 3 h / +5 h OAuth | Worse in Phase 1 (manual typing); equal after Phase 2 |
| 3 | **GTM** — User | Yes: `accounts.user_permissions.create` | Guided, then client-OAuth in Phase 2 | Phase 2: `tagmanager.manage.users` verification | Agency `accounts.list` / `containers.list` | 3 h / +4 h | Same as GA4 |
| 4 | **Search Console** — Full | **No user API.** The Site Verification API can only add *owners* | Guided (Settings → Users and permissions → Add user → Full) | None | Agency `sites.list` gives `permissionLevel` siteFullUser/siteOwner | 3 h | Equal. Leadsie does this semi-manually too |
| 5 | **Merchant Center** — Standard | Yes: Merchant API `accounts.users.create` (STANDARD/ADMIN); invitee must accept | Guided, then client-OAuth in Phase 2 | Phase 2: `content` verification | `users.get` state VERIFIED / agency `accounts.list` | 3 h / +4 h | FTA must accept an invite by email (no documented API accept) |
| 6 | **Business Profile** — Manager | Yes: `locations.admins.create`; invitee must accept | Guided (client invites `austin@fattailads.com` as Manager). **FTA auto-accepts** via `accounts.invitations.list/accept` | **GBP API access approval** (0 QPM until approved). Filed 2026-09-22 for project 435723479172 (case 1-7091000040979), which covers the FTA-side calls. Phase 2 client-side grants need a second filing for the `fta-connect` project (§3) | Agency locations list | 4 h / +4 h | Equal once auto-accept works; blocked until GBP approval |
| 7 | **YouTube** — Editor | **No API** for channel permissions | Guided (Studio → Settings → Permissions → Invite; invite expires in 30 d) | None | **Not API-verifiable.** Channel-permission invitees can't use YouTube APIs; Austin confirms manually in the admin view | 2 h | Equal. Leadsie is guided-only too |
| 8 | **Meta** — Ad acct, Page, Catalog, Dataset, IG → partner BM 1874940222979161 | Yes for ad account, Page and dataset (`/{asset}/agencies`). **Catalog is legacy-only; IG unclear.** Requires Advanced Access, App Review, BV and Access Verification | **Guided "Share with partner"** (Business Settings → Partners → add FTA business ID → pick all 5 asset types) in one client action. Optional agency-initiated request for ad account/Page (`POST /{fta_bm}/client_ad_accounts`, `/client_pages`) when the client gives IDs. Then FTA **auto-assigns the team** with `POST /{asset}/assigned_users` via its system-user token | FTA acting in its own BM with its own system user: Standard access, no App Review (**spike to confirm in Phase 0**) | `GET /{fta_bm}/client_ad_accounts`, `client_pages`, `client_product_catalogs`, `client_pixels`, `client_instagram_assets` | 8 h + 3 h team | Worse: the client must find Business Settings. Personal ad accounts must first be moved into a portfolio (inferred) |
| 9 | **LinkedIn** — Page Content Admin, Ad Account Campaign Mgr | Ad account: yes (`PUT /rest/adAccountUsers`, `rw_ads`), but Dev tier caps edits at 5 mapped accounts, so Standard tier is needed (discretionary). **Page: no API** ("cannot be granted…through the API") | Guided for both: Page admin tools add Austin as Content Admin (**must be a 1st-degree connection**); Campaign Manager → Manage access add Austin as Campaign Manager | Advertising API **Development tier** for Austin's own read token (linkedin-mcp app likely already has it) | `organizationAcls?q=roleAssignee&state=APPROVED`; `adAccountUsers?q=authenticatedUser` | 4 h | Equal. Leadsie is also semi-manual for both |
| 10 | **Microsoft Ads** — account link | Client-OAuth unnecessary | **Agency-side:** `AddClientLinks` (AccountLink, `IsBillToClient=true`); the client accepts in UI (Accounts & Billing → Requests) | **FTA-owned manager account** (create; fixes the Ascend misroute) + universal developer token (DevSettings; msads MCP already has one) | `SearchClientLinks` Status = Active (pending expires at 30 d) | 5 h | Equal. Needs the client's account number and customer number. Prepaid client accounts can't be linked |

**View-only mode** (audits): Meta tasks `ANALYZE`; GA4 Viewer; GTM read; SC Restricted; Merchant PERFORMANCE_REPORTING; YouTube Viewer; LinkedIn Viewer. For Google Ads and Microsoft Ads, manager links are always management-level, so view-only there means a guided *user* invite (Google "Read only", Microsoft "Viewer"). That is verified by the agency listing accessible customers/accounts. Note that `CustomerUserAccessInvitationService` is blocked on Explorer, so these are guided rather than agency-sent.

### Approval gates (only what the recommended path needs)
| Gate | Needed for | Status / lead time | Cost |
|---|---|---|---|
| `/privacy` + `/terms` crawlable pages (+ Meta data-deletion instructions) | All reviews; good hygiene anyway | Phase 0 task, about 3 h | $0 |
| Google Ads API access level on the Cloud project | #1 | Explorer is automatic; Basic ≈10 business days + brand verification (only if Explorer's 2,880 ops/day or blocked services bite) | $0 |
| GBP API access | #6 | **Filed 2026-09-22**, no SLA (quoted 7–10 business days) | $0 |
| Microsoft manager account + developer token | #10 | Minutes to about 5 business days | $0 |
| Meta: FTA system user in BM with Standard access | #8 verification + team assign | Confirm by spike; BV may be required anyway (days–weeks) | $0 |
| LinkedIn Advertising API Development tier | #9 verification | Likely already held by linkedin-mcp app; else days–2 weeks | $0 |
| *Phase 2 only:* Google sensitive-scope verification (analytics.manage.users, tagmanager.manage.users, content, business.manage) | One-click #2/3/5/6 | Brand verification 2–3 business days + review 3–10 business days. Check each scope's class on the project's **Data Access** page first; if any show restricted, drop it back to guided | $0 (no CASA for sensitive) |
| *Not planned:* Meta App Review + BV + Access Verification (client-login Meta); LinkedIn Standard tier; Google restricted `adwords` | — | 2–6+ weeks each; annual Meta Data Use Checkup; CASA for restricted | CASA assessor fees |


**Update 2026-09-25: scope classification settled.** The `fattailads-connect` project's Data Access page (Google's authoritative classifier) shows:
- `business.manage` is **non-sensitive**.
- `analytics.manage.users`, `tagmanager.manage.users`, `content` **and `adwords` are sensitive**.
- **No restricted scopes, so no CASA** for any path.

Consequence: one-click Google Ads is also viable. The client signs in, the app lists their customers (`ListAccessibleCustomers`), FTA's MCC sends the link, and the client's token sets the `CustomerManagerLink` to ACTIVE in the same session. Doing this needs Google Ads API access (Explorer) on the new project. It's added to Phase 2 as an option.

### Citations
- **Google Ads:** [linking manager accounts](https://developers.google.com/google-ads/api/docs/account-management/linking-manager-accounts) · [access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels) · [developer token retirement](https://developers.google.com/google-ads/api/docs/api-policy/developer-token) · [brand verification](https://developers.google.com/google-ads/api/docs/api-policy/brand-verification) · [security requirements / restricted scope](https://developers.google.com/google-ads/api/docs/oauth/security-requirements) · [link accept (Help)](https://support.google.com/google-ads/answer/7459601)
- **GA4:** [accessBindings.create (v1alpha)](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1alpha/accounts.accessBindings/create)
- **GTM:** [user_permissions.create](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.user_permissions/create)
- **Search Console:** [API index (no user mgmt)](https://developers.google.com/webmaster-tools/v1/api_reference_index) · [sites](https://developers.google.com/webmaster-tools/v1/sites) · [Site Verification webResource](https://developers.google.com/site-verification/v1/webResource) · [users & permissions (Help)](https://support.google.com/webmasters/answer/7687615)
- **Merchant Center:** [control access](https://developers.google.com/merchant/api/guides/accounts/control-access) · [users.create](https://developers.google.com/merchant/api/reference/rest/accounts_v1/accounts.users/create)
- **Business Profile:** [prerequisites / access request](https://developers.google.com/my-business/content/prereqs) · [locations.admins.create](https://developers.google.com/my-business/reference/accountmanagement/rest/v1/locations.admins/create) · [invitations.accept](https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts.invitations/accept)
- **YouTube:** [channels.list](https://developers.google.com/youtube/v3/docs/channels/list) · [channel permissions (Help)](https://support.google.com/youtube/answer/9481328)
- **Google OAuth:** [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) · [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) · [verification requirements](https://support.google.com/cloud/answer/13464321) · [when verification isn't needed](https://support.google.com/cloud/answer/13464323) · [Data Access page](https://support.google.com/cloud/answer/15549135) · [unverified apps / 100-user cap](https://support.google.com/cloud/answer/7454865) · [incremental auth](https://developers.google.com/identity/protocols/oauth2)
- **Meta:** [B2B asset sharing](https://developers.facebook.com/docs/marketing-api/business-asset-management/guides/business-to-business/) · [ad account agencies](https://developers.facebook.com/docs/graph-api/reference/ad-account/agencies/) · [page agencies](https://developers.facebook.com/docs/graph-api/reference/page/agencies/) · [client_pages](https://developers.facebook.com/docs/graph-api/reference/business/client_pages/) · [pixel sharing](https://developers.facebook.com/docs/marketing-api/business-asset-management/guides/business-pixel-sharing/) · [catalog guide](https://developers.facebook.com/docs/marketing-api/business-asset-management/guides/catalog/) · [legacy asset sharing](https://developers.facebook.com/docs/marketing-api/businessmanager/assets/v2.5) · [business reference (IG edges)](https://developers.facebook.com/docs/marketing-api/reference/business/) · [assigned_users](https://developers.facebook.com/docs/graph-api/reference/ad-account/assigned_users/) · [system user tokens](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens) · [access levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/) · [Business Verification](https://developers.facebook.com/docs/development/release/business-verification) · [Access Verification](https://developers.facebook.com/docs/development/release/access-verification) · [App Review submission](https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide) · [data deletion](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback) · [add ad account to portfolio](https://www.facebook.com/business/help/915885887059947)
- **LinkedIn:** [ad account users](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/account-structure/create-and-manage-account-users?view=li-lms-2026-09) · [quick start (Page not grantable)](https://learn.microsoft.com/en-us/linkedin/marketing/quick-start?view=li-lms-2026-09) · [organization ACLs](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role?view=li-lms-2026-09) · [increasing access / tiers](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-09) · [ads getting started (5-account cap)](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/getting-started?view=li-lms-2026-09) · [refresh tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens)
- **Microsoft Ads:** [AddClientLinks](https://learn.microsoft.com/en-us/advertising/customer-management-service/addclientlinks) · [ClientLink](https://learn.microsoft.com/en-us/advertising/customer-management-service/clientlink) · [ClientLinkStatus](https://learn.microsoft.com/en-us/advertising/customer-management-service/clientlinkstatus) · [hierarchy & permissions](https://learn.microsoft.com/en-us/advertising/guides/account-hierarchy-permissions) · [get started / dev token](https://learn.microsoft.com/en-us/advertising/guides/get-started) · [agency linking (Help)](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_proc_agencyenable) · [OAuth tokens](https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth-get-tokens)
- **Leadsie:** [pricing](https://www.leadsie.com/pricing) · [what's automated vs manual](https://help.leadsie.com/article/20-what-can-i-get-access-to-with-leadsie) · [webhook v2](https://help.leadsie.com/article/127-webhooks)

**Doc ambiguities to resolve by spike in Phase 0:**
- `adwords` classification.
- Meta `client_pages` POST ("not supported" in the reference vs. present in the guide).
- Meta catalog/IG sharing endpoints.
- Merchant accept-by-API.
- Whether Explorer is sufficient for link services.
- LinkedIn role needed to add account users.

## 3. Architecture
**Where it lives: this repo, `/connect`. Recommended.**
- It reuses the verified domain fattailads.com, which OAuth redirect URIs, the privacy page and brand verification all need.
- It reuses the same GTM/consent bridge and the same Vercel project and env.
- Nothing new in DNS.

A subdomain or separate repo would add a Vercel project, DNS records and duplicated consent/GTM for no gain at this volume. Revisit only if the admin app grows big enough to need a framework.

**Layout**
- `connect.html` is the client wizard. It stays vanilla JS, like `meet.html`, and reads link config from `GET /api/connect/link?slug=`.
- `connect-admin.html → /connect/admin` is the dashboard, set to noindex.
- `privacy.html`, `terms.html` → `/privacy`, `/terms`.
- `vercel.json`: rewrite `/connect/:slug` → `/connect/index.html` (excluding `admin`), plus security headers (CSP, `X-Frame-Options` for admin, `Referrer-Policy`).
- `api/_lib/{ga4,db,crypto,auth,platforms/*}.mjs` holds shared helpers. `ga4.mjs` is extracted from `leadsie-webhook.mjs` (`safeEqual`, `ga4ClientId`, MP post).
- `api/connect/*` endpoints:
  - `link` (GET config)
  - `start` (creates a request row)
  - `submit-ids` (client-typed IDs → triggers agency-side invites)
  - `status` (client polls)
  - `oauth/[platform]/start|callback` (Phase 2 only)
- `api/admin/*` endpoints: session, links CRUD, requests, resend, verify-now.
- `api/cron/verify.mjs` runs every 15 min and polls pending items. `api/cron/token-health.mjs` runs daily. Both are declared in `vercel.json` `crons` and authenticated by `CRON_SECRET`.
- No SDKs: plain `fetch` to every API. Only new dep: `@neondatabase/serverless`.

**Storage: Neon Postgres via Vercel Marketplace (free tier: 0.5 GB, scale-to-zero).**
| Table | Contents |
|---|---|
| `links` | slug, label, mode(manage/view), platforms[], receiving overrides (e.g., MCC choice), notify_emails[], completion CTA/redirect, active |
| `requests` | id, link_id, client_name, contact_email, created_at, status, ga4_fired_at |
| `request_items` | request_id, platform, asset_type, client-supplied IDs, mechanism, status(pending/invited/verified/failed/expired), invited_at, verified_at, last_checked_at, detail |
| `fta_credentials` | platform, identity, AES-256-GCM-encrypted refresh/system token, expires_at, last_refreshed_at |
| `audit_log` | append-only: actor, action, target, ip hash, ts |

**Token policy**
- **No client tokens are stored**, and Phase 1 has none at all.
- In Phase 2, the client's OAuth access token lives only in the callback function's memory. We request no `offline_access` or refresh token (Google `access_type=online`), use it for the single grant call, then drop it. It is never logged.
- FTA-side tokens are the only persisted secrets. Why they must persist: the cron verification and Microsoft's rotating refresh token need them.
  - Google refresh token for **austin@fattailads.com**: `adwords`, `webmasters.readonly`, `analytics.readonly`, `tagmanager.readonly`, `content`, `business.manage`. It's minted in the **ops project** (see Google Cloud projects below). Only Austin consents, so the personal-use exemption applies, and `adwords` never has to be declared on the client-facing verified app.
  - Meta system-user token (60-day refreshable).
  - LinkedIn member token (60-day access, 365-day non-rolling refresh).
  - Microsoft refresh token (rotates; store newest).
- Encryption key `CONNECT_ENC_KEY` lives in a Vercel **Sensitive** env var.
- Use dedicated credentials for this app, **not** the MCP servers' tokens, to limit blast radius.

**Google Cloud projects (decided 2026-09-24)**
| Project | Owner / org | User type | Used for | Why |
|---|---|---|---|---|
| **Ops:** existing `ga4-mcp-project-498920` (#435723479172) | personal, no org | External, in production, **not** submitted for verification | FTA-side token only (Austin consents once as austin@fattailads.com): Google Ads link create/verify, all read-back verification, GBP invitation auto-accept | Its GBP API application is already pending. It's the proven personal-use pattern the MCP servers use. It keeps the restricted `adwords` scope off the verified app. Google Ads API access level (Explorer) is set here |
| **Client-facing:** new `fta-connect` | fattailads.com org (651299695749), austin@fattailads.com owner, FTA business billing | External, **verified** | Phase 2 one-click client OAuth (sensitive scopes only) + admin "Sign in with Google" | Consent screen reads "Fat Tail Ads" on the verified fattailads.com domain. Workspace-owned, so it survives personal-account changes. Isolated from personal MCP projects, so a review problem can't touch them. Needs its own GBP API filing for Phase 2 |

**Link model**
- Main link `/connect` = slug `main`, all 10 platforms, manage mode.
- Custom links `/connect/<random-10-char>` override platforms, mode, notify recipients and redirect. Google Ads always links to the FTA MCC; PP+K is out of scope.
- `?mode=view` is honored only if the link allows it.

**Branding**
- Use the existing tokens from `connect.html` (Fraunces / Inter Tight / JetBrains Mono, vermillion accent) with no Leadsie limits.
- Per-platform step cards show a progress rail and live status ticks from polling.
- The completion screen has an optional CTA or redirect per link. English only (Leadsie's 8 languages are dropped; flagged).

**Notifications & analytics**
- Email via Resend free tier (3k/mo) from `connect@fattailads.com`. This needs SPF/DKIM DNS records, a gated change.
- Emails go out on: new request started; each platform verified; request complete; link or invite expiring (MS 30 d, YouTube 30 d).
- `connect_completed` is sent server-side via GA4 MP with **the same event name and params**. `source` changes from `leadsie` to `fta_connect`, which keeps reporting continuous and separable during the parallel run.
  - It fires once per request, on the first transition to all-requested-items-verified. This matches today's SUCCESS-only rule.
  - `client_id` = `ga4ClientId(client_name)`, same as today.
- `connect_page_view` push is kept byte-for-byte. Optional new dataLayer events: `connect_step_view`, `connect_ids_submitted` (no PII).

**Admin dashboard (`/connect/admin`)**
- Sign-in: Google "Sign in with Google" (openid email, non-sensitive) → server checks `email == austin@fattailads.com` → HMAC-signed, HttpOnly, Secure, SameSite=Strict session cookie (8 h).
- Features:
  - Request list with per-platform status chips.
  - Verify now, resend link (copy or email), cancel pending MS/Google link.
  - Link builder.
  - FTA token-health panel (expiry dates, last successful call, red at T-14 d).
- Vercel Password Protection is avoided because it costs $20/mo and locks the whole site.

**Security / threat model**
| Threat | Control |
|---|---|
| OAuth CSRF / code injection (Phase 2) | `state` = 32-byte random, stored server-side against request_id, single-use, 10 min TTL; PKCE; exact redirect URIs |
| Admin CSRF | SameSite=Strict + Origin check on all admin mutations |
| Link enumeration / spam requests | Unguessable custom slugs; Vercel WAF rate-limit rule on `/api/connect/*` (e.g., 20 req/min/IP); request cap per link per day |
| Client submits someone else's account ID to receive an invite | Harmless by design: the invite only lands if the real owner accepts in the platform. Invite emails come from Google/Microsoft/Meta, not us |
| Secret leakage | Sensitive env vars; AES-GCM at rest; tokens never logged; `Token` values redacted in errors |
| Over-broad FTA token | Read-only scopes wherever verification only reads; the write scope (`adwords`) is used only for link create/cancel |
| Cron endpoint abuse | `CRON_SECRET` bearer check |
| Audit | append-only `audit_log` on every invite, verify, admin action and token refresh |
| Retention | requests purged after 24 months; no client tokens ever at rest |

Policy pages: `/privacy` (must disclose Google API Services User Data Policy / Limited Use for Phase 2), `/terms`, and data-deletion instructions for Meta.

## 4. Phased roadmap (revised from the brief)
Phase order changes from the brief because the feasibility findings show **all 10 platforms can ship in Phase 1** with agency-side or guided flows. Client-side OAuth becomes a Phase 2 upgrade rather than the foundation.

Effort below is **Claude build hours**. Austin's own time per phase is in §5.

| Phase | Scope | Acceptance tests | Effort | Depends on |
|---|---|---|---|---|
| **0 — Gates & spikes** (start now) | Fix Leadsie MS routing. Create FTA Microsoft manager account (none exists); confirm dev token. Start Meta Business Verification; add a backup Meta admin; create the `fta-connect` Meta system user. Create the `fta-connect` Cloud project in the fattailads.com org. `/privacy` + `/terms` pages. Check GBP case 1-7091000040979. Confirm Google Ads access level = Explorer on the chosen Cloud project. Meta spike: FTA system user reads `client_*` edges + `assigned_users` with Standard access. LinkedIn spike: Austin's token reads `organizationAcls`/`adAccountUsers`. Neon + Resend accounts (gated). **File Google brand + sensitive-scope verification** for the Phase 2 scopes (after checking the Data Access page classification) so the review clock runs during Phase 1. | Each spike returns real data for an existing FTA client asset; privacy/terms 200 on preview | 8–10 h | Austin: MS account creation, any BV paperwork, DNS approval |
| **1 — Lean replacement, all 10 platforms** | Wizard + link model + DB + agency-side invites (Google Ads, MS Ads, Meta request) + guided cards (GA4, GTM, SC, Merchant, GBP, YouTube, LinkedIn, Meta share) + 15-min verify cron + GA4 `connect_completed` + basic admin list | On preview: a test client (Austin's own sandbox assets) completes each platform; each item flips to verified within 15 min; one GA4 `connect_completed` (source `fta_connect`) seen in DebugView; `connect_page_view` still fires under consent; MS link routes to FTA manager account | 40–50 h | Phase 0 spikes |
| **2 — One-click Google** (verification filed in Phase 0; build lands when review clears) | Client-OAuth for GA4, GTM, Merchant, GBP (incremental scopes, online access, no stored token); Google sensitive-scope verification in a Cloud project under the fattailads.com org | Verified consent screen shows "Fat Tail Ads"; each grant succeeds and verifies; DB has no client token | 18–22 h + 1–2 wk review | `/privacy` live; demo video; GBP approval |
| **3 — Dashboard & polish** | Full admin (resend, cancel, link builder), token-health cron + emails, Resend notifications, completion CTA/redirect, WAF rule, audit viewer | Expiry warning fires on a token forced to T-13 d; resend email arrives; rate limit returns 429 | 12–16 h | Phase 1 |
| **Cutover** | Parallel: new flow on a custom link for the next client while `/connect` still iframes Leadsie. Then swap `connect.html` to native (one commit), keep `api/leadsie-webhook.mjs` 30 days, then delete it + cancel Leadsie (month-to-month) | 1 real client end-to-end on new flow; GA4 shows `connect_completed` with `source=fta_connect`; RiffleCM/Dan Golden's Meta access unaffected | 3–4 h | Phase 1 (+3 recommended) |

**Rollback:** `connect.html`'s iframe version stays in git history. Rollback = `git revert <swap commit>` and merge; Vercel promotes in about 1 min. Leadsie stays paid and live until 30 days after cutover, so no link or webhook breaks. Grants already made on the platforms are unaffected by either tool.

## 5. Build vs keep paying
Claude writes all the code on Austin's flat-rate Business plan, so its hours cost roughly nothing extra. What costs money is **Austin's time**, which goes on the steps only he can do: clicks, consents, paperwork, test grants and sign-off.

| Option | Claude build hours | Austin one-time | Austin ongoing | Hard cost |
|---|---|---|---|---|
| **A. Keep Leadsie Agency** | 0 | 5 min (fix MS routing) | 0 | $1,548/yr ($1,284/yr annual). Starter lacks webhooks + white-label, so it's not a viable downgrade |
| **B. Lean build** (Ph 0+1+3 + cutover) | ~65–75 h | ~5–7 h | ~15–20 min/mo | ~$0 (Vercel Pro already paid; Neon/Resend free) |
| **C. Full parity** (B + Ph 2 one-click Google) | ~85–100 h | ~6–9 h (adds Google verification form, a demo video recording, test consents) | ~20–30 min/mo + ~1 h/yr re-verifications | ~$0 |

**What Austin's hours go to (C):**
- Phase 0 gates: create the MS manager account, Meta BV paperwork if needed, DNS approval for Resend, consents for FTA-side tokens. About 2–3 h.
- Phase 1 test grants with his own sandbox assets, plus review. About 2 h.
- Phase 2 verification submission and demo video; Claude scripts it and he records. About 1.5 h.
- Cutover sign-off. About 0.5 h.

**What his ongoing minutes go to:** approving Claude's fixes for API version sunsets (the Google Ads API yearly, Graph API about every 2 years, LinkedIn monthly versions with a 1-year sunset, the GA4 v1alpha API) and re-consenting when an FTA-side token expires. The daily token-health cron emails him before each one.

**Break-even:** even valuing Austin at $150/h, C costs about $1–1.35k of his time once plus about $50–75/mo. The net saving is about $55–80/mo, so it **pays back in about 13–25 months**. B pays back sooner, in about 7–10 months, because it has less review and upkeep. On cash alone, it pays back immediately.

**Where DIY is still worse than Leadsie, whatever it costs:**
- Guided steps for Meta, LinkedIn Page, SC and YouTube. Leadsie is partly guided on these too.
- English only.
- When a platform changes its UI or API, Austin finds out from the health cron rather than from a vendor.

**Model routing for the build** (keeps plan usage low):
- **Opus:** architecture, the OAuth/state/crypto/session code, agency-side grant integrations, security review, and final review of each phase.
- **Sonnet:** the wizard UI, guided-step cards, admin dashboard, DB migrations, cron plumbing, email templates, the privacy/terms pages, and the demo-video script.
- **Haiku:** mechanical passes such as copy edits, link and citation checks, and fixture/test-data generation.

**Recommendation:**
1. Build C in order: Phase 0 → 1 → 3 → cutover → cancel Leadsie → Phase 2. Phase 2 is gated only by Google's review wait, not by volume.
2. File the Google sensitive-scope verification in Phase 0 alongside everything else, so the review clock runs during the build.
3. Fix the Microsoft routing in Leadsie today regardless.

## 6. Decisions (Austin, 2026-09-24) and Phase 0 findings
| # | Question | Decision |
|---|---|---|
| 1 | Tier | **C** (full parity) |
| 2 | Microsoft Ads | Create an FTA-owned manager account; **clients billed directly** (`IsBillToClient=true`, FTA never pre-bills) |
| 3 | Google receiving identity | **austin@fattailads.com**. Cloud projects as in §3 (ops = existing project, client-facing = new `fta-connect` in the fattailads.com org) |
| 4 | Google Ads MCC | **FTA MCC only**, no PP+K |
| 5 | Meta | Found in Chrome (below) |
| 6 | LinkedIn Page needs a 1st-degree connection | Accepted |
| 7 | Languages | English only |
| 8 | Leadsie timing | Decide once the build pace is known; cancel after cutover |

**Phase 0 findings (2026-09-24):**
- **Microsoft Ads:** Austin's login (austin.lance.butler@gmail.com, user 95277130) belongs only to the Jiffy Lube, Ascend and Teguar customers. **No FTA-owned manager account exists yet.** Sign-in uses a passkey, so Austin completes it. Creating the account is Austin's final click.
- **Meta:** the Fat Tail Ads portfolio (1874940222979161) is **not business-verified** ("Eligible for verification"). Already in place: system user **Fattail Connector** (ID 61593607546639, admin) and app **fat-tail-ads-mcp** (1714348542931835, owned by FTA). Security Center flags: **Austin is the only business admin**, so add a backup admin; no trusted domains; 1 inactive ad account owned by others.
  - Recommendation: **start Business Verification in Phase 0.** It's free and takes days to weeks, and it's the fallback if the Standard-access test fails. Use a *new* system user (`fta-connect`) for this app, not Fattail Connector.

## 7. Remaining open items
1. **Microsoft manager account details:** business name, address and a contact. Austin enters them and clicks Create.
2. **Meta Business Verification:** Austin supplies the legal documents (LLC articles or EIN letter, a utility bill or bank statement matching the address).
3. **Backup Meta admin:** who should it be?
4. **Leadsie cancellation date:** set after Phase 1.
