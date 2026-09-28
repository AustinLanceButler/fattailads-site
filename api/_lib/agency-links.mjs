// api/_lib/agency-links.mjs — FTA-side link requests and read-back checks for the
// two "agency" platforms. Both use FTA's own stored credentials (fta-credentials.mjs);
// the client only accepts inside the platform.
//
// Google Ads: the FTA MCC creates a CustomerClientLink (status PENDING); the client
//   accepts in Google Ads. Developer tokens were retired 2026-09-09 — access comes from
//   the Cloud project behind the OAuth client, so no developer-token header is sent.
// Microsoft Advertising: AddClientLinks (AccountLink, bill-to-client) from the FTA
//   manager customer; the client accepts under Accounts & Billing → Requests.
//   SOAP v13; element order inside ClientLink must stay alphabetical (WCF).
//
// Each function returns { status, detail } where status is one of
//   'invite_sent' | 'verified' | 'pending' | 'failed'.

import { accessToken } from './fta-credentials.mjs';

const ADS_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';
const mccId = () => String(process.env.CONNECT_GOOGLE_ADS_MCC || '673-311-0705').replace(/\D/g, '');
const msManagerCustomerId = () => String(process.env.FTA_MS_MANAGER_CUSTOMER_ID || '255066022');
const MS_CM_URL = 'https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc';

// ── Google Ads ────────────────────────────────────────────────────────────────

async function ads(path, body) {
  const token = await accessToken('google');
  const r = await fetch(`https://googleads.googleapis.com/${ADS_VERSION}/customers/${mccId()}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'login-customer-id': mccId() },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

function adsErrors(body) {
  const details = (body && body.error && body.error.details) || [];
  const errs = details.flatMap((d) => d.errors || []);
  return errs.map((e) => ({ code: Object.values(e.errorCode || {})[0] || '', message: e.message || '' }));
}

export async function googleAdsLinkStatus(customerId) {
  const q = `SELECT customer_client_link.client_customer, customer_client_link.status, customer_client_link.manager_link_id
             FROM customer_client_link WHERE customer_client_link.client_customer = 'customers/${customerId}'`;
  const r = await ads('googleAds:search', { query: q });
  if (!r.ok) return { status: 'failed', detail: `Google Ads read-back failed: ${(r.body.error && r.body.error.message) || r.status}` };
  const rows = (r.body.results || []).map((x) => x.customerClientLink && x.customerClientLink.status);
  if (rows.includes('ACTIVE')) return { status: 'verified', detail: '' };
  if (rows.includes('PENDING')) return { status: 'pending', detail: 'Link request sent; waiting for the client to accept.' };
  if (rows.includes('REFUSED')) return { status: 'failed', detail: 'The client declined the link request.' };
  return { status: 'none', detail: rows.length ? `Link status: ${rows.join(', ')}` : '' };
}

export async function sendGoogleAdsLink(customerId) {
  const cid = String(customerId).replace(/\D/g, '');
  if (!/^\d{10}$/.test(cid)) return { status: 'failed', detail: 'Invalid customer ID.' };
  const existing = await googleAdsLinkStatus(cid);
  if (existing.status === 'verified' || existing.status === 'pending') {
    return { status: existing.status === 'verified' ? 'verified' : 'invite_sent', detail: existing.detail };
  }
  const r = await ads('customerClientLinks:mutate', { operation: { create: { clientCustomer: `customers/${cid}`, status: 'PENDING' } } });
  if (r.ok) return { status: 'invite_sent', detail: `Link request sent from MCC ${mccId()}.` };
  const errs = adsErrors(r.body);
  if (errs.some((e) => /ALREADY_MANAGED|ALREADY_INVITED/.test(e.code))) {
    const again = await googleAdsLinkStatus(cid);
    return { status: again.status === 'verified' ? 'verified' : 'invite_sent', detail: errs[0].message };
  }
  const msg = errs.length ? errs.map((e) => `${e.code}: ${e.message}`).join('; ') : ((r.body.error && r.body.error.message) || `HTTP ${r.status}`);
  return { status: 'failed', detail: `Google Ads refused the link request — ${msg}`.slice(0, 480) };
}

// ── Microsoft Advertising ─────────────────────────────────────────────────────

const xmlEsc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

async function msSoap(action, bodyXml) {
  const devToken = process.env.FTA_MSADS_DEVELOPER_TOKEN;
  if (!devToken) throw Object.assign(new Error('FTA_MSADS_DEVELOPER_TOKEN is not set'), { code: 'not_configured' });
  const token = await accessToken('microsoft');
  const envelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Header xmlns="https://bingads.microsoft.com/Customer/v13">
<Action s:mustUnderstand="1">${action}</Action>
<AuthenticationToken>${xmlEsc(token)}</AuthenticationToken>
<DeveloperToken>${xmlEsc(devToken)}</DeveloperToken>
</s:Header>
<s:Body>${bodyXml}</s:Body>
</s:Envelope>`;
  const r = await fetch(MS_CM_URL, { method: 'POST', headers: { 'content-type': 'text/xml; charset=utf-8', SOAPAction: action }, body: envelope });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// Tiny tag readers — the responses are small and flat enough for this.
const tag = (xml, name) => { const m = new RegExp(`<(?:\\w+:)?${name}(?=[\\s>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml); return m ? m[1] : ''; };
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}(?=[\\s>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'g'))].map((m) => m[1]);
function msErrors(xml) {
  return tags(xml, 'OperationError').concat(tags(xml, 'AdApiError'))
    .map((e) => `${tag(e, 'ErrorCode') || tag(e, 'Code')}: ${tag(e, 'Message')}`.trim())
    .concat(tag(xml, 'faultstring') ? [tag(xml, 'faultstring')] : [])
    .filter((s) => s && s !== ':');
}

export async function microsoftLinkStatus(accountNumber) {
  const body = `<SearchClientLinksRequest xmlns="https://bingads.microsoft.com/Customer/v13">
<Predicates xmlns:e="https://bingads.microsoft.com/Customer/v13/Entities">
<e:Predicate><e:Field>ManagingCustomerId</e:Field><e:Operator>Equals</e:Operator><e:Value>${xmlEsc(msManagerCustomerId())}</e:Value></e:Predicate>
</Predicates>
<Ordering i:nil="true" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>
<PageInfo xmlns:e="https://bingads.microsoft.com/Customer/v13/Entities"><e:Index>0</e:Index><e:Size>1000</e:Size></PageInfo>
</SearchClientLinksRequest>`;
  const r = await msSoap('SearchClientLinks', body);
  if (!r.ok) return { status: 'failed', detail: `Microsoft read-back failed: ${msErrors(r.text).join('; ') || `HTTP ${r.status}`}`.slice(0, 480) };
  const links = tags(r.text, 'ClientLink').map((l) => ({ number: tag(l, 'ClientEntityNumber').toUpperCase(), status: tag(l, 'Status') }));
  const mine = links.filter((l) => l.number === String(accountNumber).toUpperCase()).map((l) => l.status);
  if (mine.includes('Active')) return { status: 'verified', detail: '' };
  if (mine.some((s) => /Pending/.test(s))) return { status: 'pending', detail: 'Link request sent; waiting for the client to accept.' };
  if (mine.some((s) => /Reject|Declin/.test(s))) return { status: 'failed', detail: 'The client declined the link request.' };
  if (mine.some((s) => /Expired/.test(s))) return { status: 'failed', detail: 'The link request expired (30 days). Send it again.' };
  return { status: 'none', detail: mine.length ? `Link status: ${mine.join(', ')}` : '' };
}

export async function sendMicrosoftLink(accountNumber, clientName) {
  const num = String(accountNumber || '').toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(num)) return { status: 'failed', detail: 'Invalid account number.' };
  const existing = await microsoftLinkStatus(num);
  if (existing.status === 'verified') return { status: 'verified', detail: '' };
  if (existing.status === 'pending') return { status: 'invite_sent', detail: existing.detail };
  // Alphabetical element order is required by the WCF data contract.
  const body = `<AddClientLinksRequest xmlns="https://bingads.microsoft.com/Customer/v13">
<ClientLinks xmlns:e="https://bingads.microsoft.com/Customer/v13/Entities">
<e:ClientLink>
<e:ClientEntityNumber>${xmlEsc(num)}</e:ClientEntityNumber>
<e:IsBillToClient>true</e:IsBillToClient>
<e:ManagingCustomerId>${xmlEsc(msManagerCustomerId())}</e:ManagingCustomerId>
<e:Name>${xmlEsc(`Fat Tail Ads - ${clientName || num}`.slice(0, 100))}</e:Name>
<e:Note>Fat Tail Ads account access request</e:Note>
<e:SuppressNotification>false</e:SuppressNotification>
<e:Type>AccountLink</e:Type>
</e:ClientLink>
</ClientLinks>
</AddClientLinksRequest>`;
  const r = await msSoap('AddClientLinks', body);
  const errs = msErrors(r.text);
  if (r.ok && !errs.length) return { status: 'invite_sent', detail: 'Link request sent from the Fat Tail Ads manager account.' };
  return { status: 'failed', detail: `Microsoft refused the link request — ${errs.join('; ') || `HTTP ${r.status}`}`.slice(0, 480) };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export async function sendAgencyLink(product, input, clientName) {
  if (product === 'google_ads') return sendGoogleAdsLink(input.customerId);
  if (product === 'microsoft_ads') return sendMicrosoftLink(input.accountNumber, clientName);
  return { status: 'failed', detail: 'Not an agency platform.' };
}

export async function agencyLinkStatus(product, input) {
  if (product === 'google_ads') return googleAdsLinkStatus(String(input.customerId || '').replace(/\D/g, ''));
  if (product === 'microsoft_ads') return microsoftLinkStatus(input.accountNumber);
  return { status: 'none', detail: '' };
}
