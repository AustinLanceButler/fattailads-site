# Fat Tail Ads site — source & build

Live site = compiled `index.html` + `app.js` at repo root, auto-deployed by Vercel from `main`.

## Sources (this folder)
`1.jsx` … `7.jsx` + `8_inline.jsx` — React sources in load order, extracted from the
Claude Design export and since modified directly (see history below). These are the
EDITABLE truth. `index.html` at repo root is hand-maintained (head/meta/GTM/consent
bridge/styles) — edit it directly.

## Build app.js
    cat 1.jsx 2.jsx 3.jsx 4.jsx 5.jsx 6.jsx 7.jsx 8_inline.jsx > concat.jsx  # with '\n;\n' between files
    esbuild concat.jsx --loader:.jsx=jsx --jsx=transform --minify --target=es2018 --outfile=app.js
React 18 UMD is loaded globally by index.html — no bundler imports.

## Changes made outside Claude Design (Design's copy does NOT have these)
- Approach-page bio: Miami → Fort Lauderdale
- Mobile responsive pass: useMobile() hook (1.jsx), two-row wrap nav, clamp() type
  and padding, auto-fit grids, mobile work/article rows, table scroll wrappers
- Conversion tracking: tel:+19542285080 links (footer/contact/privacy) + dataLayer
  pushes: phone_call, generate_lead (form success only), book_call_click, email_click
- privacy@fattail.ads → privacy@fattailads.com, now a mailto:
- index.html: viewport/title/meta, GTM-KFF7DGR5 head+noscript, Consent Mode v2
  bridge (reads localStorage 'fta_cookie_consent', listens to 'fta:consent-updated')

## If re-exporting from Claude Design
Do NOT ship the export directly — it will revert everything above. Diff the export's
JSX against this folder and merge intentionally.
