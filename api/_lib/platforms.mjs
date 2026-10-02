// api/_lib/platforms.mjs — the Phase 1 platform catalogue: who receives access,
// what the client does, what they type, and what FTA must do afterwards.
//
// Mechanisms:
//   agency — the client types an account ID; FTA sends the link request from its
//            own manager account, and the client accepts it inside the platform.
//   guided — the client adds FTA themselves by following the steps, then says so.
// The Google one-click (OAuth) flow stays on /connect/beta until Google verifies
// the app; while it's in Testing mode only listed test users can sign in.
//
// Step text is plain text with **bold** markers; the wizard escapes it before
// rendering. Identities come from env so they can change without a code edit.

import { receivingEmail } from './google.mjs';

export function identities() {
  return {
    google: receivingEmail(),
    metaBusinessId: process.env.CONNECT_META_BUSINESS_ID || '1874940222979161',
    metaBusinessName: 'Fat Tail Ads',
    msManager: 'Fat Tail Ads, LLC',
    googleAdsMcc: process.env.CONNECT_GOOGLE_ADS_MCC || '673-311-0705',
    linkedinName: process.env.CONNECT_LINKEDIN_NAME || 'Austin Butler',
    linkedinUrl: process.env.CONNECT_LINKEDIN_URL || 'https://www.linkedin.com/in/austinlancebutler/',
  };
}

// Client-side states that mean "the client's part is done".
export const CLIENT_DONE = ['verified', 'already_had_access', 'invited', 'requested', 'invite_sent', 'client_reported'];

const text = (max) => (v) => {
  const s = String(v || '').trim();
  return s.length <= max ? { ok: true, value: s } : { ok: false };
};
const digits = (min, max) => (v) => {
  const s = String(v || '').replace(/[\s-]/g, '');
  return new RegExp(`^\\d{${min},${max}}$`).test(s) ? { ok: true, value: s } : { ok: false };
};
const alnum = (min, max) => (v) => {
  const s = String(v || '').trim().toUpperCase();
  return new RegExp(`^[A-Z0-9]{${min},${max}}$`).test(s) ? { ok: true, value: s } : { ok: false };
};

function catalogue() {
  const id = identities();
  const li = id.linkedinUrl ? `${id.linkedinName} (${id.linkedinUrl})` : id.linkedinName;
  return {
    google_ads: {
      label: 'Google Ads', group: 'Google', role: 'Manager account link', mechanism: 'agency',
      intro: 'Tell us your Google Ads customer ID. We’ll send a link request from the Fat Tail Ads manager account, and you accept it in Google Ads.',
      fields: [{ key: 'customerId', label: 'Google Ads customer ID', hint: 'Top-right of Google Ads, like 123-456-7890', required: true, check: digits(10, 10), error: 'Enter the 10-digit customer ID, like 123-456-7890.' }],
      after: [
        'Watch for an email from Google Ads (usually within one business day) and click **Accept**.',
        'Or in Google Ads: **Admin → Access and security → Managers** → accept the request from **Fat Tail Ads**.',
      ],
      ftaAction: `Send a manager link request from the FTA MCC (${id.googleAdsMcc}) to this customer ID.`,
    },
    ga4: {
      label: 'Google Analytics 4', group: 'Google', role: 'Editor', mechanism: 'guided',
      steps: [
        'Open **analytics.google.com** and click **Admin** (the gear, bottom-left).',
        'Under **Account settings**, click **Account access management**.',
        'Click **+** → **Add users**.',
        `Enter **${id.google}**, choose the **Editor** role, and click **Add**.`,
      ],
      link: 'https://analytics.google.com/analytics/web/#/admin',
      fields: [{ key: 'accountName', label: 'GA4 account name or ID', hint: 'Shown in Admin → Account settings. We use it to confirm access automatically.', required: true, check: text(160), error: 'Enter the GA4 account name or ID so we can confirm access.' }],
      ftaAction: 'Confirm the GA4 account shows up for austin@fattailads.com.',
    },
    gtm: {
      label: 'Google Tag Manager', group: 'Google', role: 'User, publish on all containers', mechanism: 'guided',
      steps: [
        'Open **tagmanager.google.com** and click **Admin**.',
        'In the **Account** column, click **User Management**, then **+** → **Add users**.',
        `Enter **${id.google}**. Set **Account permissions** to **User**.`,
        'Under **Container permissions**, give each container **Publish**, then click **Invite**.',
      ],
      link: 'https://tagmanager.google.com/',
      fields: [{ key: 'accountName', label: 'GTM account name or container ID', hint: 'Like GTM-ABC1234. We use it to confirm access automatically.', required: true, check: text(160), error: 'Enter the Tag Manager account name or container ID (GTM-…).' }],
      ftaAction: 'Accept the pending invitation: Tag Manager → Invitations → Accept, signed in as austin@fattailads.com.',
    },
    search_console: {
      label: 'Google Search Console', group: 'Google', role: 'Full user', mechanism: 'guided',
      steps: [
        'Open **search.google.com/search-console** and pick your property.',
        'Click **Settings → Users and permissions → Add user**.',
        `Enter **${id.google}**, set **Permission** to **Full**, and click **Add**.`,
      ],
      link: 'https://search.google.com/search-console/users',
      fields: [{ key: 'property', label: 'Website or property', hint: 'Like example.com', required: true, check: text(200), error: 'Enter your website or Search Console property.' }],
      ftaAction: 'Confirm the property shows as Full in Search Console.',
    },
    merchant: {
      label: 'Google Merchant Center', group: 'Google', role: 'Standard access', mechanism: 'guided',
      steps: [
        'Open **merchants.google.com** and click the **gear → People and access**.',
        `Click **Add person**, enter **${id.google}**, choose **Standard**, and click **Add**.`,
      ],
      link: 'https://merchants.google.com/',
      fields: [{ key: 'merchantId', label: 'Merchant Center ID', hint: 'Top-right of Merchant Center', required: true, check: digits(5, 15), error: 'Enter the numeric Merchant Center ID.' }],
      ftaAction: 'Accept the Merchant Center invitation email sent to austin@fattailads.com.',
    },
    gbp: {
      label: 'Google Business Profile', group: 'Google', role: 'Manager', mechanism: 'guided',
      steps: [
        'Search your business name on Google while signed in, or open **business.google.com**.',
        'Click the **⋮ menu → Business Profile settings → People and access**.',
        `Click **Add**, enter **${id.google}**, choose **Manager**, and click **Invite**.`,
      ],
      link: 'https://business.google.com/',
      fields: [{ key: 'businessName', label: 'Business name and city', hint: 'As it appears on Google', required: true, check: text(200), error: 'Enter your business name as it appears on Google.' }],
      ftaAction: 'Accept the Business Profile invitation for austin@fattailads.com.',
    },
    youtube: {
      label: 'YouTube', group: 'Google', role: 'Editor', mechanism: 'guided',
      steps: [
        'Open **studio.youtube.com** and click **Settings → Permissions**.',
        `Click **Invite**, enter **${id.google}**, choose **Editor**, and click **Done**, then **Save**.`,
      ],
      link: 'https://studio.youtube.com/',
      fields: [{ key: 'channel', label: 'Channel URL or @handle', required: true, check: text(200), error: 'Enter your channel URL or @handle.' }],
      ftaAction: 'Accept the YouTube channel invitation email (it expires after 30 days).',
    },
    microsoft_ads: {
      label: 'Microsoft Advertising', group: 'Microsoft', role: 'Account link (you keep billing)', mechanism: 'agency',
      intro: 'Tell us your Microsoft Advertising account number. We’ll send a link request from the Fat Tail Ads manager account. Billing stays with you.',
      fields: [
        { key: 'accountNumber', label: 'Account number', hint: 'Accounts & Billing → Accounts, like B012ABCD', required: true, check: alnum(6, 12), error: 'Enter the account number, letters and numbers like B012ABCD.' },
        { key: 'customerId', label: 'Customer ID', hint: 'Optional — the number in your ads.microsoft.com URL after cid=', check: (v) => (String(v || '').trim() ? digits(5, 15)(v) : { ok: true, value: '' }), error: 'The customer ID is numbers only.' },
      ],
      after: [
        'Watch for the request in Microsoft Advertising: **Tools → Accounts & Billing → Requests**, then **Accept** the one from **Fat Tail Ads, LLC**.',
        'Requests expire after 30 days. Prepaid accounts can’t be linked; tell us if yours is prepaid.',
      ],
      ftaAction: 'Send an account link (AddClientLinks, bill-to-client) from manager account K145003FWF.',
    },
    meta: {
      label: 'Meta (Facebook & Instagram)', group: 'Meta', role: 'Partner access to your assets', mechanism: 'guided',
      steps: [
        'Open **business.facebook.com/settings** and choose your business portfolio.',
        'Click **Users → Partners → Add → Give a partner access to your assets**.',
        `Enter the Fat Tail Ads business ID **${id.metaBusinessId}** and click **Next**.`,
        'Select your **ad account** (Manage campaigns), **Facebook Page**, **Instagram account**, **catalog** and **dataset/pixel** with full control, then **Save**.',
      ],
      link: 'https://business.facebook.com/settings/partners',
      fields: [{ key: 'business', label: 'Your business portfolio name', hint: 'Optional — helps us match the share', check: text(160) }],
      ftaAction: 'Confirm the shared assets in FTA Business Settings and assign the team to each one.',
    },
    linkedin: {
      label: 'LinkedIn', group: 'LinkedIn', role: 'Page Content Admin + Campaign Manager', mechanism: 'guided',
      steps: [
        `First, connect with **${li}** on LinkedIn. Page roles can only be given to your connections.`,
        'Page: open your Page as an admin → **Settings → Manage admins → Add admin**, pick that person, choose **Content admin**, and **Save**.',
        'Ads: in **Campaign Manager**, open the ad account → **Manage access → Edit → Add user**, pick that person, choose **Campaign Manager**, and **Save**.',
      ],
      link: 'https://www.linkedin.com/campaignmanager/',
      fields: [
        { key: 'page', label: 'Company Page URL', hint: 'Like linkedin.com/company/example', check: text(200) },
        { key: 'adAccountId', label: 'Ad account ID', hint: 'Optional, from Campaign Manager', check: (v) => (String(v || '').trim() ? digits(5, 15)(v) : { ok: true, value: '' }), error: 'The ad account ID is numbers only.' },
      ],
      ftaAction: 'Confirm Content Admin on the Page and Campaign Manager on the ad account.',
    },
  };
}

export const PLATFORM_IDS = ['google_ads', 'ga4', 'gtm', 'search_console', 'merchant', 'gbp', 'youtube', 'microsoft_ads', 'meta', 'linkedin'];

export function platform(id) {
  return PLATFORM_IDS.includes(id) ? catalogue()[id] : null;
}

// Client-safe view for GET /api/connect/platforms (no validators).
export function publicCatalogue() {
  const c = catalogue();
  return PLATFORM_IDS.map((pid) => {
    const p = c[pid];
    return {
      id: pid, label: p.label, group: p.group, role: p.role, mechanism: p.mechanism,
      intro: p.intro || '', steps: p.steps || [], after: p.after || [], link: p.link || '',
      fields: p.fields.map((f) => ({ key: f.key, label: f.label, hint: f.hint || '', required: !!f.required })),
    };
  });
}

// Validates the client's typed fields. Returns { ok, input } or { ok: false, message }.
export function validateInput(id, raw) {
  const p = platform(id);
  if (!p) return { ok: false, message: 'Unknown platform.' };
  const src = raw && typeof raw === 'object' ? raw : {};
  const input = {};
  for (const f of p.fields) {
    const v = src[f.key];
    if (f.required && !String(v || '').trim()) return { ok: false, message: f.error || `Enter your ${f.label.toLowerCase()}.` };
    const r = f.check(v);
    if (!r.ok) return { ok: false, message: f.error || `Check your ${f.label.toLowerCase()}.` };
    if (r.value) input[f.key] = r.value;
  }
  return { ok: true, input };
}

// One-line summary of what the client typed, for asset_name and the admin view.
export function summarizeInput(id, input) {
  const v = Object.values(input || {}).filter(Boolean);
  if (id === 'google_ads' && input.customerId) return input.customerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return v.join(' · ').slice(0, 200);
}
