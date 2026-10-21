# fattailads-site
Fat Tail Ads — marketing website (static, deploys to Vercel)

## Structure

Source files at the repo root are the source of truth. `build.mjs` (run by
Vercel via `npm run build`) bundles `src/*.jsx` into `dist/app.js` for the
homepage SPA and copies each standalone page into `dist/`. Compiled output is
never committed.

| Route | Source | Notes |
|---|---|---|
| `/` | `index.html` + `src/*.jsx` | Homepage SPA |
| `/meet` | `meet.html` | Booking page (Google Calendar embed), `noindex` |
| `/connect` | `connect.html` | Client access onboarding — still the Leadsie embed until the FTA Connect cutover, `noindex` |
| `/connect/v2` | `connect-v2.html` | FTA Connect wizard, all 10 platforms (agency + guided), `noindex`, unlisted |
| `/connect/beta` | `connect-beta.html` | FTA Connect Google sign-in prototype (GA4 / GTM one-click), `noindex`, unlisted |
| `/connect/admin` | `connect-admin.html` | FTA Connect admin dashboard + follow-up queue, `noindex`, frame-denied |
| `/connect/about` | `connect-about.html` | Public page describing FTA Connect and its Google API use (Google branding verification home page) |
| `/privacy` | `privacy.html` | Privacy policy (incl. Google API Limited Use + Meta data deletion), indexable |
| `/terms` | `terms.html` | Terms of service, indexable |

## Measurement

GTM container `GTM-KFF7DGR5`, with Consent Mode v2 defaults read from the
`fta_cookie_consent` localStorage key. Page-view dataLayer events:
`book_page_view` (`/meet`) and `connect_page_view` (`/connect`).

## FTA Connect (Leadsie replacement)

In-house client access onboarding. A client opens `/connect/v2`, picks platforms, and
either types an account ID (agency platforms: FTA sends the link from its own manager
account and verifies it) or follows guided steps and reports "I've added Fat Tail Ads"
(the cron then checks FTA's own view where an API allows it). Requests and items live in
Neon (`connect_requests`, `connect_items`); FTA's own platform tokens are sealed in
`connect_fta_credentials`. `connect_completed` goes to GA4 (`source=fta_connect`) once
every item is client-done. Leadsie stays on `/connect` until a real-client parallel run.

| Platform | Mode | Verification |
|---|---|---|
| Google Ads | Agency: CustomerClientLink from MCC 673-311-0705 | Auto, link read-back (proven E2E 2026-10-02) |
| Microsoft Advertising | Agency: AddClientLinks (bill-to-client) from customer 255066022 | Auto via SearchClientLinks. Client account must be **post-pay**; prepaid accounts are refused with a bare "Invalid client data" fault |
| GA4, Google Tag Manager, Search Console | Guided (one-click OAuth on `/connect/beta` until Google verifies the app) | Auto against FTA's own Google token |
| Meta, LinkedIn, Merchant Center, Business Profile, YouTube | Guided | Manual in `/connect/admin` |

| Endpoint | Purpose |
|---|---|
| `GET /api/connect/platforms` | Client-facing platform catalogue (`api/_lib/platforms.mjs`) |
| `POST /api/connect/request` | Start a request; returns an unguessable `requestId` |
| `POST /api/connect/submit` | Client finished a platform → `requested` (agency) or `client_reported` (guided) |
| `GET /api/connect/status` | Per-product status for the wizard |
| `/api/connect/google/*` | Client Google sign-in (beta) and the shared OAuth callback (also used by admin login) |
| `/api/connect/admin/*` | Admin only (Google sign-in, allowlist `CONNECT_ADMIN_EMAILS`, 8 h session): `requests`, `item` (done/sent/failed/reopen), `send-link` (send or re-check now), `fta` + `fta-google` / `fta-microsoft-oauth` / `fta-linkedin` / `fta-tiktok` (connect FTA's own credentials), `ms-whoami` (read-only Microsoft identity check) |
| `GET /api/cron/verify` | Every 15 min: sends queued agency links, reads back pending ones, auto-verifies guided grants. Refusals keep the item `requested`, write the reason to `fta_note` (never shown to the client) and log `[agency-links] … refused` to runtime logs |

Code: `api/_lib/agency-links.mjs` (Google Ads + Microsoft SOAP v13), `agency-sync.mjs`,
`guided-verify.mjs`, `fta-credentials.mjs`, `completion.mjs`. Test requests (`?test=1`)
suppress Microsoft's email to the client.

Environment variables (Production only; Google sign-in can't run on previews by design):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres (Vercel Marketplace store `fta-connect`) |
| `CONNECT_ENC_KEY` | Seals stored tokens and state cookies |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Client-facing OAuth app (Cloud project `fattailads-connect`) |
| `FTA_GOOGLE_CLIENT_ID`, `FTA_GOOGLE_CLIENT_SECRET` | FTA's own Google identity (ops project; Google Ads API Basic access) |
| `FTA_MS_CLIENT_ID`, `FTA_MSADS_DEVELOPER_TOKEN`, `FTA_MS_MANAGER_CUSTOMER_ID` | Microsoft Advertising (Entra app "FTA Connect", public client) |
| `FTA_LINKEDIN_CLIENT_ID/SECRET`, `FTA_TIKTOK_APP_ID/SECRET` | Warehouse sign-ins connected from the admin page |
| `CONNECT_ADMIN_EMAILS` | Admin allowlist |
| `CONNECT_GOOGLE_ADS_MCC`, `CONNECT_META_BUSINESS_ID`, `CONNECT_LINKEDIN_URL`, `CONNECT_LINKEDIN_NAME`, `CONNECT_RECEIVING_EMAIL` | Receiving identities shown to clients |
| `CRON_SECRET` | Bearer Vercel sends to `/api/cron/*` |

Cutover (ClickUp "fta-connect: parallel-run … cut /connect over and cancel Leadsie"):
point `build.mjs` `/connect` at the native wizard in one commit, keep
`api/leadsie-webhook.mjs` 30 days, then delete it.

## API

### `POST /api/leadsie-webhook`

Receives Leadsie client-connection webhooks (v1 or v2 payloads). On
`status: SUCCESS` it forwards a `connect_completed` event to GA4 via the
Measurement Protocol — server-side, because the access grant happens off-browser
and there is no dataLayer to fire. Non-success connections are acknowledged and
skipped. `GET` is a no-op health check.

Authenticated with a shared secret, passed as `?token=…`, an `x-leadsie-token`
header, or `Authorization: Bearer …` (Leadsie publishes no signing scheme).

Environment variables (Vercel → Settings → Environment Variables):

| Variable | Purpose |
|---|---|
| `LEADSIE_WEBHOOK_SECRET` | Shared secret; must match the token registered in Leadsie |
| `GA4_MEASUREMENT_ID` | Web stream Measurement ID (`G-…`) |
| `GA4_API_SECRET` | GA4 Admin → Data Streams → Measurement Protocol API secrets |

Env var changes only take effect on a new deployment.

## Ads warehouse (Funnel.io replacement)

Daily campaign-level ad data for every client lands in the `ads` schema of the same Neon
database the connect portal uses, and a writer pushes a recent window back into each
pacing Google Sheet's data tab in place of the old Funnel.io IMPORTRANGE. The sheets keep
their formulas; the database is the source of truth. Schema: `db/migrations/` (applied
automatically on first use, versioned in `ads.schema_migrations`). Design notes and the
cutover sequence live in the ClickUp umbrella task "FTA — Data — Build DIY replacement for
Funnel.io".

| Piece | Where |
|---|---|
| Google Ads (searchStream GAQL, MCC login, FTA's stored token) | `api/_lib/ingest/google-ads.mjs` |
| Microsoft Advertising (Reporting v13 REST + Campaign Management for shared budget pools) | `api/_lib/ingest/microsoft-ads.mjs` |
| Meta Marketing API (Graph insights + campaign/ad-set budgets) | `api/_lib/ingest/meta.mjs` |
| Runner, run log, failure isolation per account | `api/_lib/ingest/run.mjs`, `ads.ingest_runs` |
| Sheets writer (service account, RAW values, real dates) | `api/_lib/sheets.mjs`, `api/_lib/feeds.mjs`, `ads.sheet_feeds` |
| Staleness check → ClickUp alerts | `api/_lib/health.mjs`, `api/_lib/alerts.mjs`, `ads.alerts` |
| Funnel history for reconciliation | `api/_lib/archive.mjs`, `ads.funnel_archive`, `ads.v_reconcile_funnel` |
| Operator endpoint | `POST /api/admin/ingest` (`probe`, `seed`, `run`, `push_sheets`, `archive_funnel`, `health`, `query`, `simulate_alert`) |

Crons (`vercel.json`, UTC): ingest-google 09:05/15:05/21:05, ingest-microsoft +10 min,
ingest-meta +20 min, push-sheets :50, feed-health 10:30 daily, ingest-google-restate Sun 11:05.
Daily runs re-pull a trailing 35 days (upserts), so attribution restatements land; views
exclude the current ET day so a partial day never reaches a sheet.

Environment variables (in addition to the connect ones):

| Variable | Purpose |
|---|---|
| `INGEST_ADMIN_SECRET` | Bearer for `/api/admin/ingest`; also accepted on the cron routes for manual triggers |
| `META_ADS_TOKEN` | Dedicated read-only (`ads_read`) System User token for the Meta ad accounts |
| `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` | Service account that writes the pacing sheets (share each sheet with it as Editor) |
| `CLICKUP_API_TOKEN`, `ALERT_CLICKUP_LIST_ID` | Where feed-health opens deduplicated alert tasks |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Optional; only if the Ads API starts requiring one on reporting calls |
| `CONNECT_GOOGLE_ADS_MCC`, `FTA_MSADS_DEVELOPER_TOKEN`, `DATABASE_URL`, `CRON_SECRET` | Already present; reused |

Bring-up: `probe` (what the stored tokens can see) → `seed` with a filled-in copy of
`db/seed.example.json` → `scripts/backfill.sh` per account → `archive_funnel` per Funnel tab
→ `push_sheets` with `dry_run: true` → parallel-run into `(SB)` tabs → repoint `sheet_feeds.tab`.

Tests: `npm test` (pure functions). The end-to-end check needs a Postgres:
`PG_TEST_URL=postgres:///postgres node --test test/integration.test.mjs`.
