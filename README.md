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
| `/connect` | `connect.html` | Client access onboarding (Leadsie embed), `noindex` |
| `/privacy` | `privacy.html` | Privacy policy (incl. Google API Limited Use + Meta data deletion), indexable |
| `/terms` | `terms.html` | Terms of service, indexable |

## Measurement

GTM container `GTM-KFF7DGR5`, with Consent Mode v2 defaults read from the
`fta_cookie_consent` localStorage key. Page-view dataLayer events:
`book_page_view` (`/meet`) and `connect_page_view` (`/connect`).

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
