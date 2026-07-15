# Fat Tail Ads site — source & build

Vercel builds this site FROM SOURCE on every push (see /vercel.json):
    npm run build  →  node build.mjs  →  dist/app.js + dist/index.html + dist/meet/index.html
The repo does NOT contain a compiled app.js. The live site serves the dist/
output of the commit — nothing else.

## Editing rules (humans and AIs)
- Content / components / pages: edit src/1.jsx … src/7.jsx, src/8_inline.jsx
  (concatenated in that order at build).
- Head, meta, GTM (GTM-KFF7DGR5), Consent Mode bridge, styles, fonts, the
  inlined about-photo: edit /index.html — it is deployed as-is.
- Booking page: edit /meet.html — plain standalone HTML, copied to
  dist/meet/index.html and served at /meet. It is NOT part of the React app
  and NOT a Claude Design export; edit it directly.
- NEVER commit a compiled app.js or a raw Claude Design export bundle here.
  Claude Design exports must be diffed against src/ and merged intentionally
  (Design's runtime keeps babel-standalone + dev React; production must not).
- esbuild is pinned in package.json; build flags in build.mjs are the contract
  (--jsx=transform, --minify, --target=es2018). Change them knowingly or not at all.

## Measurement wiring (do not remove casually)
- dataLayer events in src: generate_lead (form success only), phone_call
  (tel: links ×3), book_call_click (nav CTA), email_click (privacy mailto).
- meet.html dataLayer event: book_page_view (scheduler page loaded).
- index.html + meet.html: Consent Mode v2 bridge — default denied, reads
  localStorage 'fta_cookie_consent', listens for 'fta:consent-updated'.
- GTM container GTM-KFF7DGR5 → GA4 G-RD78J97VX0 (property 372281364).

## /meet — branded booking page (added 2026-07-15)
- Standalone meet.html in the FTA design system wraps the Google Calendar
  appointment scheduler (iframe, ?gv=true) so the page feels native.
- Unlisted: noindex + not linked from nav. Reachable only via the shared link.
- The earlier /meet → calendar.app.google redirect in vercel.json was removed
  when this page shipped (a redirect would shadow the page).

## Changes made outside Claude Design on 2026-07-14 (already merged everywhere)
- Approach-page bio Miami → Fort Lauderdale
- Mobile responsive pass: useMobile() hook, two-row wrap nav, clamp() type and
  padding, auto-fit grids, mobile work/article rows, table scroll wrappers
- tel:+19542285080 links + conversion dataLayer pushes
- privacy@fattail.ads → privacy@fattailads.com (mailto:)
- index.html: viewport/title/meta description, GTM head+noscript, consent bridge
