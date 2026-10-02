// api/_lib/guided-verify.mjs — auto-verify guided grants (GA4, GTM, Search Console)
// by checking what FTA's own Google identity can now see. Used by the verify cron
// and the admin "Re-check" button.
//
// FTA's view is loaded lazily, once per run (one call per product, plus GTM
// container listings only when a client gave a GTM-XXXX ID: the Tag Manager API
// allows ~25 requests / 100 s per project, so container lookups are capped).
//
// Matching uses what the client typed:
//   ga4            — account name or numeric account ID
//   gtm            — account name, numeric account ID, or container ID (GTM-XXXX);
//                    OAuth-beta items carry the account ID in asset_id
//   search_console — domain or URL; a property counts only at Full or Owner level
// No input → nothing to match, the item stays on the admin follow-up list.

import { accessToken } from './fta-credentials.mjs';

export const GUIDED_AUTOVERIFY = ['ga4', 'gtm', 'search_console'];
const GTM_CONTAINER_CALL_CAP = 15;

async function gget(token, url) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`${url.split('?')[0]} → ${r.status} ${(j.error && j.error.message) || ''}`.trim()), { status: r.status });
  return j;
}

const norm = (s) => String(s || '').trim().toLowerCase();

export function domainOf(s) {
  let v = norm(s).replace(/^sc-domain:/, '');
  try { if (/^https?:\/\//.test(v)) v = new URL(v).hostname; } catch { /* keep v */ }
  return v.replace(/^www\./, '').replace(/\/.*$/, '');
}

export function createFtaView() {
  let tokenP = null;
  const cache = {};
  const token = () => (tokenP ||= accessToken('google'));
  let gtmContainerCalls = 0;

  async function ga4Accounts() {
    if (!cache.ga4) cache.ga4 = (async () => {
      const t = await token();
      const out = [];
      let page = '';
      do {
        const j = await gget(t, `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
        for (const a of j.accountSummaries || []) out.push({ id: String(a.account).replace('accounts/', ''), name: a.displayName || '' });
        page = j.nextPageToken || '';
      } while (page);
      return out;
    })();
    return cache.ga4;
  }

  async function gtmAccounts() {
    if (!cache.gtm) cache.gtm = (async () => {
      const t = await token();
      const j = await gget(t, 'https://tagmanager.googleapis.com/tagmanager/v2/accounts');
      return (j.account || []).map((a) => ({ id: String(a.accountId), name: a.name || '', containers: null }));
    })();
    return cache.gtm;
  }

  async function gtmContainers(account) {
    if (account.containers) return account.containers;
    if (gtmContainerCalls >= GTM_CONTAINER_CALL_CAP) return null; // over budget this run
    gtmContainerCalls++;
    const t = await token();
    const j = await gget(t, `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${account.id}/containers`);
    account.containers = (j.container || []).map((c) => String(c.publicId || '').toUpperCase());
    return account.containers;
  }

  async function scSites() {
    if (!cache.sc) cache.sc = (async () => {
      const t = await token();
      const j = await gget(t, 'https://www.googleapis.com/webmasters/v3/sites');
      return (j.siteEntry || []).map((s) => ({ url: s.siteUrl, level: s.permissionLevel }));
    })();
    return cache.sc;
  }

  return { ga4Accounts, gtmAccounts, gtmContainers, scSites };
}

// Returns { status: 'verified' | 'pending' | 'skip', detail }.
export async function checkGuidedItem(view, item) {
  const input = item.client_input || {};

  if (item.product === 'ga4') {
    const want = norm(input.accountName || item.asset_id);
    if (!want) return { status: 'skip', detail: 'No account name or ID to match.' };
    const hit = (await view.ga4Accounts()).find((a) => a.id === want || norm(a.name) === want);
    return hit
      ? { status: 'verified', detail: `Auto-verified: GA4 account "${hit.name}" (${hit.id}) is visible to FTA.` }
      : { status: 'pending', detail: `Not visible to FTA yet (looking for "${input.accountName || item.asset_id}").` };
  }

  if (item.product === 'gtm') {
    const raw = String(input.accountName || item.asset_id || '').trim();
    if (!raw) return { status: 'skip', detail: 'No account name or container ID to match.' };
    const accounts = await view.gtmAccounts();
    const want = norm(raw);
    let hit = accounts.find((a) => a.id === want || norm(a.name) === want);
    if (!hit && /^gtm-[a-z0-9]+$/i.test(raw)) {
      for (const a of accounts) {
        const containers = await view.gtmContainers(a);
        if (containers === null) return { status: 'pending', detail: 'Container lookup deferred to the next run (Tag Manager rate limit).' };
        if (containers.includes(raw.toUpperCase())) { hit = a; break; }
      }
    }
    return hit
      ? { status: 'verified', detail: `Auto-verified: Tag Manager account "${hit.name}" (${hit.id}) is visible to FTA.` }
      : { status: 'pending', detail: `Not visible to FTA yet (looking for "${raw}"). If it's an invitation, accept it in Tag Manager → Invitations as austin@fattailads.com.` };
  }

  if (item.product === 'search_console') {
    const want = domainOf(input.property);
    if (!want) return { status: 'skip', detail: 'No property to match.' };
    const sites = (await view.scSites()).filter((s) => domainOf(s.url) === want);
    const full = sites.find((s) => s.level === 'siteFullUser' || s.level === 'siteOwner');
    if (full) return { status: 'verified', detail: `Auto-verified: Search Console ${full.url} shared with FTA (${full.level}).` };
    if (sites.length) return { status: 'pending', detail: `Search Console ${sites[0].url} is shared, but only as ${sites[0].level}. Ask the client for Full.` };
    return { status: 'pending', detail: `Not shared with FTA yet (looking for ${want}).` };
  }

  return { status: 'skip', detail: 'Not auto-verifiable.' };
}

// Writes a check result back to the item. Never throws.
export async function applyGuidedResult(q, item, result, actor = 'system') {
  const { audit } = await import('./db.mjs');
  try {
    if (result.status === 'verified') {
      await q`UPDATE connect_items SET status = 'verified', verified_at = now(), detail = null,
                fta_status = 'done', fta_note = ${result.detail}, fta_updated_at = now(), updated_at = now()
              WHERE id = ${item.id}`;
    } else if (result.status === 'pending') {
      await q`UPDATE connect_items SET fta_note = ${result.detail}, updated_at = now() WHERE id = ${item.id}`;
    }
    await audit(item.request_id, 'guided_verify', { product: item.product, actor, result: result.status, detail: result.detail });
  } catch (err) {
    console.error('[guided-verify] apply failed', err.message);
  }
}
