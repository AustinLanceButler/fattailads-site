# Leadsie: how it worked for Fat Tail Ads, and what FTA Connect needs to match it

Written 2026-11-21. Leadsie was cancelled on 2026-11-19. The last paid period, Agency Plan $129
(receipt #2588-4075), runs **Oct 23 – Nov 23, 2026**, so the Leadsie link and embed stop working
around **Nov 23**. Access that clients already granted through Leadsie stays in place: Leadsie only
brokered grants made inside Meta, Google and the other platforms, and those grants persist after
cancellation.

Screenshots of the live client page, captured 2026-11-21, are in `docs/leadsie-reference/`.

---

## 1. What was wired into fattailads.com

| Piece | Where | What it did |
|---|---|---|
| `/connect` page | `connect.html` (built to `dist/connect/index.html` by `build.mjs`) | FTA-branded hero ("Connect your accounts.", chips 2 Minutes / No Passwords / Revoke Anytime) wrapping an iframe of `https://app.leadsie.com/embed/connect/fattailads/manage` (height 1000px, 1180px on mobile). Fallback link: `https://app.leadsie.com/connect/fattailads/manage` in a new tab. `noindex`. |
| Page-view event | `connect.html` | dataLayer `connect_page_view` {page_type: `onboarding`}; GTM `GTM-KFF7DGR5` with Consent Mode v2 read from `fta_cookie_consent`. |
| Webhook | `api/leadsie-webhook.mjs` → `POST /api/leadsie-webhook?token=…` | Leadsie POSTed on every connection attempt. On `status: SUCCESS` it sent GA4 Measurement Protocol `connect_completed` {source: `leadsie`, client_name, request_name, access_level, assets_connected}. Non-success payloads were acknowledged and skipped. Auth was the shared secret `LEADSIE_WEBHOOK_SECRET` (query, `x-leadsie-token` or Bearer). |
| Env | Vercel | `LEADSIE_WEBHOOK_SECRET`, plus `GA4_MEASUREMENT_ID` / `GA4_API_SECRET` (FTA Connect reuses these two). |
| Leadsie account settings | app.leadsie.com (Austin's login: "Log in with Google/Facebook") | Slug `fattailads`; FTA logo; Microsoft integration in **manager mode → Fat Tail Ads, LLC** (its dropdown resets to Teguar after a refresh). Webhook registered under Settings → Webhooks & API. |

**Teardown:** `/connect` now serves the FTA Connect wizard (this branch). Once Leadsie stops posting,
the webhook receives nothing. Delete `api/leadsie-webhook.mjs`, `connect.html` and
`LEADSIE_WEBHOOK_SECRET` after 2026-12-23 (30-day rollback window). Check whether any GA4 key event or
Google Ads conversion filters on `source = leadsie`. If one does, switch it to `fta_connect` or drop
the filter.

---

## 2. The Leadsie client experience (what a client saw at /connect)

Captured from `app.leadsie.com/connect/fattailads/manage`. The page title read: "Fat Tail Ads is
requesting access to Meta, Google, LinkedIn, YouTube and Microsoft".

1. **No intake form.** The link opens directly on the platforms; the client never types a name or
   email. Leadsie learns who they are from the platform logins.
2. **Header:** FTA logo, then "**Fat Tail Ads** would like to **manage** your **Meta**, **Google**
   and <u>more</u>". Hovering "more" shows "LinkedIn, YouTube, and Microsoft".
3. **Three-step progress bar:** `1. Connect Meta` → `2. Select Accounts` → `3. Connected`. The first
   label names whichever platform is currently active.
4. **One primary platform card open (Meta first),** with "4 more platforms to connect" collapsed
   underneath (Google, LinkedIn, YouTube and Microsoft icons). Each card shows:
   - The platform and the asset types requested, with overflow behind a "+N" tooltip.
   - "**Fat Tail Ads's account details:**", the receiving identity.
   - "**Access Level: Manage**".
   - A single sign-in button. Google's card adds the Google API Services User Data Policy /
     Limited Use line.
5. **The platform cards** (receiving identities exactly as Leadsie displayed them):

| Card | Assets requested | Receiving identity shown | Button |
|---|---|---|---|
| Meta | Ad Account, Page, Catalog, Dataset, Instagram Account | Meta Business Portfolio **Fat Tail Ads** | Connect Facebook |
| Google | Ads Account, Analytics Account, Business Profile Location, Tag Manager, Search Console, Merchant Center | Google Ads Account **Fat Tail Ads - Google Ads - MCC**; Google Account **austin.lance.butler@gmail.com** | Sign in with Google |
| LinkedIn | Company Page, Ad Account | LinkedIn User **Austin Lance Butler** | Sign in with LinkedIn |
| YouTube | Channel | YouTube Account **austin.lance.butler@gmail.com** | Connect YouTube |
| Microsoft | Ads Account | Microsoft Account **Fat Tail Ads, LLC** | Sign in with Microsoft |

6. **After a sign-in** (from Leadsie's docs; this needs a client login, so it wasn't captured):
   - **Select Accounts:** the client ticks the assets their login can see, and Leadsie grants access
     through the platform API.
   - If the client lacks admin rights on an asset, they see "You don't have permissions to share
     [asset]…" and are told to get Manage rights or forward the link to an admin. Facebook requires
     2FA before ad accounts can be shared.
7. **Connected:** a "Connection Complete" page, optionally with a custom CTA button.
8. **Footer:** Privacy Policy, Terms & Conditions, Manage Cookies, a language picker (English),
   "© Fat Tail Ads in Partnership with Leadsie Ltd 2026", and a floating Help widget.

### How Leadsie actually granted access (help.leadsie.com, article 20 and others)

| Platform | Leadsie mechanism |
|---|---|
| Meta Business Portfolio, Pages, Instagram, Catalogs, Datasets/Pixels | Automatic via the client's Facebook login: FTA's portfolio is added as a **partner**. Pages default to the highest partner level. Ad accounts are "semi-manual". |
| Google Ads | Automatic, MCC method: the client picks the account and Leadsie links it to FTA's MCC with **no invitation to accept**. |
| GA4, Business Profile, Tag Manager, Merchant Center | Automatic (user added through the client's Google token) |
| Search Console | Semi-automatic (manual step, then validated) |
| LinkedIn Company Page + Ad Account | Semi-automatic (manual step, then validated) |
| YouTube | Manual, with personalised instructions and deep links |
| Microsoft Ads | Automatic |

### Agency side

- **Notifications:** a "connection summary email" to the agency on success (contents not documented).
- **Requests:** the standing `manage` link, plus custom requests built at
  `app.leadsie.com/connect/request/create` for specific assets, a different Business Manager or
  Google account, a per-request language, or a different update email. The agency can share the
  link or have Leadsie email an invite.
- **Webhook v2 payload:**
  - Top level: `user`, `requestUrl`, `requestName`, `clientName`, `clientSummaryUrl`,
    `connectionSummaryHtml/Text`, `assetSummaryHtml/Text`, `assetCount`, `accessLevel`,
    `granularPermissions`, `status` (SUCCESS / PARTIAL_SUCCESS / FAILED), `connectionAssets[]`.
  - Per asset: `id`, `name`, `type`, `platform`, `connectionStatus`, `accessLevel`,
    `assignedUsers[]`, `linkToAsset`.

---

## 3. FTA Connect today vs Leadsie

| Area | Leadsie | FTA Connect (main, 2026-11-21) | Gap for "exactly the same" |
|---|---|---|---|
| Entry | Link opens straight onto the platforms | Step 1 form (name, company, work email) plus a pre-ticked platform checklist | Per-client request links prefilled by the admin, so the form is skipped or minimal |
| Header / steps | "would like to manage your Meta, Google and more"; Connect → Select Accounts → Connected | "Connect your accounts."; About you → Connect → Done | Copy and progress-bar parity (cosmetic, quick) |
| Platform grouping | 5 cards (Meta, Google bundle, LinkedIn, YouTube, Microsoft) | 10 separate platform cards | Regroup into the same 5 cards with sub-assets |
| Receiving identity / access level shown | Every card | Per-card role text plus a copy chip for austin@fattailads.com | Add the "Fat Tail Ads's account details" + "Access Level: Manage" block |
| Meta | One-click Facebook login → partner grant | Guided steps → "I've added Fat Tail Ads" → **manual** verify | Auto-verify now (FTA system user lists client assets shared to portfolio 1874940222979161). One-click needs a Meta app with **Advanced Access to business_management** (App Review) |
| Google Ads | One-click (MCC link, no invite) | Client types the ID → FTA MCC sends a link → client accepts → auto-verify | The client still has to accept. One-click needs the client's `adwords` OAuth (sensitive scope → Google verification) |
| GA4 / GTM | One-click | Guided + auto-verify; one-click exists on `/connect/beta` (Google app unverified) | Move OAuth into the main wizard; Google verification (demo video, 86bcd0ee1) |
| Search Console | Semi-auto | Guided + auto-verify | **At parity** |
| Merchant Center / Business Profile | One-click | Guided, manual verify | Auto-verify with FTA's token now; one-click needs `content` / `business.manage` in the verified app |
| LinkedIn | Semi-auto (manual + validated) | Guided, manual verify; client must be a 1st-degree connection | Auto-verify the ad account with the FTA LinkedIn token (r_ads); Page admin validation needs Community Management API access |
| YouTube | Manual + deep links | Guided, manual | **Effectively at parity** (receiving email differs: Leadsie used the gmail) |
| Microsoft Ads | One-click (client MS login) | Agency AddClientLinks; **never proven** (Teguar test is prepay) | Post-pay E2E test (86bcd0er1 / 86bcjg73f) |
| Confirmation page | "Connection Complete" + CTA | "You're all set." + list | Add a CTA (book a call / back to site) |
| Agency email on completion | Yes | **None** | Notifications (86bcd0exk), a blocker |
| Resume / revisit | Link is reusable; Leadsie remembers | sessionStorage only; closing the tab loses progress | Persist the request id in the URL (`?r=<uuid>`) so the link resumes |
| GA4 conversion | `connect_completed` source=leadsie | `connect_completed` source=fta_connect | At parity (update any source filter) |
| Language | English (picker) | English | At parity (decision: English only) |

**Receiving-identity difference:** Leadsie gave clients **austin.lance.butler@gmail.com** for Google
and YouTube. FTA Connect uses **austin@fattailads.com** (decision 2026-09-24). Clients onboarded
through Leadsie granted the gmail; new clients grant the fattailads.com address. That's intentional,
not a bug.

---

## 4. Parity plan

**Phase 0: before Nov 23 (Leadsie goes dark).** Ship this branch.
- `/connect` serves the FTA Connect wizard; `/connect/v2` stays as an alias.
- README documents FTA Connect.
- Mark the stale Teguar and ACE test items Failed in /connect/admin, so the cron stops re-sending
  to Microsoft.

**Phase 1: look and flow parity (no platform approvals needed; about 2–3 build days).**
1. Leadsie-style UI:
   - Header "Fat Tail Ads would like to manage your Meta, Google and more".
   - Progress bar Connect → Confirm → Connected.
   - 5 grouped cards, each with sub-asset lines, an "account details" block and "Access Level: Manage".
   - "N more platforms to connect" collapse, and a footer matching Leadsie's.
2. Per-client request links: the admin creates a request (client name, company, email, platforms)
   and gets `fattailads.com/connect?r=<id>`. The client lands straight on the platform cards. The
   link is resumable and has no step-1 form. A bare `/connect` keeps the short form.
3. A "Connection complete" page with a CTA.
4. Email notifications (86bcd0exk): request started, client finished, follow-up needed, verified.
   Plus an agency summary email equivalent to Leadsie's.
5. Auto-verify for Meta (system user), Merchant Center, Business Profile and the LinkedIn ad account,
   so no platform needs manual marking unless it's YouTube.

**Phase 2: one-click OAuth like Leadsie (needs approvals, which take weeks).**
- **Google:** one app verification covering `adwords`, `analytics.manage.users`,
  `tagmanager.manage.users`, `webmasters`, `content` and `business.manage`. One demo video (86bcd0ee1
  re-scoped). Then "Sign in with Google" grants all six from the client's token.
- **Meta:** Advanced Access to `business_management` (plus `pages_show_list`, `ads_management`)
  through Meta App Review on the verified business. Then "Connect Facebook" makes FTA a partner via
  the API.
- **LinkedIn:** Community Management API application (Page admin), so "Sign in with LinkedIn" can
  validate automatically.
- **Microsoft:** prove AddClientLinks on a post-pay account, then decide whether to add a client-side
  Microsoft sign-in (`msads.manage`; no review needed).

Until Phase 2 lands, the guided steps and auto-verify carry the same outcome. Access ends up in
FTA's accounts and verified, but each card takes the client a minute of clicks inside the platform
instead of one sign-in.

---

## 5. Leadsie agency-side settings (captured 2026-11-22, logged in)

Captured read-only from app.leadsie.com while the plan was still active. Screenshots `10-…` to `21-…`
are in `docs/leadsie-reference/`.

**Account**
- Login: Facebook "Austin Lance Butler" + Google austin.lance.butler@gmail.com.
- Joined 2026-07-16; subscription started 2026-09-23.
- Plan & Billing: "Agency Plan will be cancelled November 23, 2026"; current period Oct 23 – Nov 23.
- Credits: 10 full-access connections/month + 50 view-access, rolling over.
- **Lifetime usage: 1 full-access connection** (Riffle CM). No custom links were ever created.
- Team: one member, austin.lance.butler@gmail.com (Manager).

**Main link** (`/connect/fattailads/manage`; custom links would be `/connect/to/fattailads/LINK-NAME`).
Every integration was ON:

| Integration | Requested assets | Receiving account | Access level (the "manage users" upgrade was OFF everywhere) |
|---|---|---|---|
| Meta | Ad Account, Page (all permissions), Catalog, Dataset (**full Dataset access ON**), Instagram (full Instagram access OFF) | Business Portfolio Fat Tail Ads (1874940222979161); **auto-assign team: Austin Lance Butler** | Partner, "Manage" |
| Google Ads | Ads Account | **MCC Fat Tail Ads - Google Ads - MCC (673-311-0705)**. Others offered: PP+K SEM 789-592-9855, Fat Tail Ads 640-744-7337, Pandotic AI 652-857-9941 | Manager link |
| GA4 | Analytics Account | austin.lance.butler@gmail.com | **Editor** (Administrator was opt-in) |
| Business Profile | Location | austin.lance.butler@gmail.com | **Manager** (Owner opt-in) |
| Tag Manager | Container | austin.lance.butler@gmail.com | **User** (Administrator opt-in) |
| Search Console | Property | austin.lance.butler@gmail.com | **Full** (Owner opt-in) |
| Merchant Center | Account | austin.lance.butler@gmail.com | **Standard** (Admin opt-in) |
| LinkedIn | Company Page, Ad Account | LinkedIn user Austin Lance Butler | **Content Admin** page / **Campaign Manager** ad account (Super Admin / Account Manager opt-in) |
| YouTube | Channel ("your client will invite this Google Account to their YouTube Studio"; YouTube Ads go via Google Ads) | austin.lance.butler@gmail.com | **Editor** (Manager opt-in) |
| Microsoft | Ads Account | Manager account **Fat Tail Ads, LLC** | Account link |

**White-label**
- Company name "Fat Tail Ads", slug `fattailads`, default language English (the picker also offered
  DA/DE/ES/FR/IT/NL/PT), font Inter, FTA bell-curve logo.
- Progress-bar color **#C8502A**.
- **Custom CTA on the Connection Complete page: ON.** Button "**Return to Fat Tail Ads**" →
  `https://fattailads.com`, vermillion button with white text.
- Connection notification emails went to **austin.lance.butler@gmail.com**.

**Webhooks & API**
- One webhook → `https://fattailads.com/api/leadsie-webhook?token=…`, data format **v2**. API access
  was not enabled.

**Tokens**
- Google (austin.lance.butler@gmail.com): "Missing permissions".
- Microsoft (Fat Tail Ads, LLC): expires in about a month.
- Google Ads MCC token: 6 months. Facebook: 2 months. LinkedIn: 8 months.

**The "Connected" screen** (client- and agency-facing, `/connect/connection/<id>`):
- Progress shows ✓ Connect Meta, ✓ Select Accounts, ✓ Connected.
- Platform icons, then "Riffle CM successfully connected their Facebook assets".
- "4 Meta assets successfully connected" expands to a per-asset result list: status, assignment
  ("Assigned with admin access – Austin Lance Butler"), and per-asset warnings with a "Try To Assign
  Again" button.
- "View the Client Summary" link.

**Client summary** (`/client/<id>/<slug>`):
- Client name with a "Connected" badge, plus the link and Copy.
- Buttons: **Mark as complete**, **Refresh** (re-check statuses), **Offboard** (remove access).
- Per-platform table: Account / Status ("Connected – Checked 2 months ago", "Needs confirmation –
  Unable to check") / Granted to.

**Found during capture: Riffle CM loose ends**
- Meta Ad Account "RiffleCM Main": the auto-assignment of Austin **failed** ("An error occurred on
  Facebook's end"). Partner access is Connected, but Austin isn't assigned to the ad account through
  Leadsie.
- Meta Dataset RiffleCM.com: "Needs confirmation – Unable to check".
- Both live in Meta Business Settings, not Leadsie, so they survive the cancellation. Check them in
  Business Settings → Partners / Ad accounts.

### What FTA Connect must copy from this (adds to §3)
- Same **default access levels** per platform: GA4 Editor, GBP Manager, GTM User, Search Console
  Full, Merchant Standard, LinkedIn Content Admin + Campaign Manager, YouTube Editor. Plus the
  optional "manage users" upgrade per platform.
- Meta: request **full Dataset access**, and **auto-assign Austin** to the client's assets after the
  partner grant.
- Completion page: a "**Return to Fat Tail Ads**" button → fattailads.com, brand color #C8502A.
- Agency notification email on every new connection (Leadsie sent these to the gmail).
- An admin client summary with **Refresh / Mark as complete / Offboard** and per-asset "checked X ago".

---

## 6. Next steps (for the gameplan session)

Done: Leadsie cancelled (ends 2026-11-23); `/connect` serves FTA Connect (PR #32, live 2026-11-22);
the Leadsie integration is documented in §1–§5.

1. **Cleanup (small, any time):**
   - Mark the stale Teguar and ACE Jiffy (#11) test items Failed in /connect/admin. The Teguar item
     re-sends to Microsoft every 15 min.
   - Check the Riffle CM ad-account assignment and dataset in Meta Business Settings.
   - After 2026-12-23, delete `connect.html`, `api/leadsie-webhook.mjs` and `LEADSIE_WEBHOOK_SECRET`.
   - Check GA4 / Google Ads for any filter on `connect_completed` source=leadsie.
2. **Notifications** (ClickUp 86bcd0exk): Resend + SPF/DKIM, a connection-summary email per
   request. Austin signs up for Resend and approves the DNS records.
3. **Phase 1 parity build** (ClickUp 86bd5waxp), using §3 and §5 as the spec:
   - Leadsie-style UI.
   - Per-client links with no intake form.
   - Completion page CTA.
   - Leadsie's default access levels plus the optional manage-users upgrade.
   - Meta auto-assign.
   - Auto-verify Meta / Merchant / GBP / LinkedIn.
   - Admin client summary with Refresh / Mark complete / Offboard.
4. **Microsoft post-pay link test** (ClickUp 86bcjg73f / 86bcd0er1): Austin creates a post-pay
   throwaway account.
5. **Phase 2 one-click OAuth approvals** (ClickUp 86bd5waxq): a widened Google verification video
   (86bcd0ee1), Meta App Review, LinkedIn CMA.
6. **Open decision:** keep austin@fattailads.com as the receiving identity for Google/YouTube (current
   build), or match Leadsie's austin.lance.butler@gmail.com?
