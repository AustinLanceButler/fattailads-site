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
