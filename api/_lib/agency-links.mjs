// api/_lib/agency-links.mjs — FTA-side link requests and read-back checks for the
// two "agency" platforms. Both use FTA's own stored credentials (fta-credentials.mjs);
// the client only accepts inside the platform.
//
// Google Ads: the FTA MCC creates a CustomerClientLink (status PENDING); the client
//   accepts in Google Ads. Developer tokens were retired 2026-09-09 — access comes from
//   the Cloud project behind the OAuth client, so no developer-token header is sent.
// Microsoft Advertising: AddClientLinks (AccountLink, bill-to-client) from the FTA
//   manager customer; the client accepts under Accounts & Billing → Requests.
//   SOAP v13; elements must follow the WSDL sequence (NOT alphabetical) or WCF drops them.
//   The client account must be post-pay with a payment method — prepaid can't be linked.
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
  // Agency links must act as FTA's own Ads user, not the gmail login (a different Ads
  // user per customer; the API picks the client-side one). Prefer a Microsoft-identity
  // microsoft_agency credential; otherwise use the stored austin@fattailads.com Google
  // login, which is the FTA manager's Super Admin and signs in to Microsoft Ads with
  // Google — Microsoft accepts Google access tokens with IdentityProvider: Google.
  let token; let idp = '';
  try {
    token = await accessToken('microsoft_agency');
  } catch (err) {
    if (err.code !== 'not_connected') throw err;
    token = await accessToken('google');
    idp = 'Google';
  }
  const envelope = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Header xmlns="https://bingads.microsoft.com/Customer/v13">
<Action s:mustUnderstand="1">${action}</Action>
<AuthenticationToken>${xmlEsc(token)}</AuthenticationToken>
<DeveloperToken>${xmlEsc(devToken)}</DeveloperToken>${idp ? `
<IdentityProvider>${idp}</IdentityProvider>` : ''}
</s:Header>
<s:Body>${bodyXml}</s:Body>
</s:Envelope>`;
  const r = await fetch(MS_CM_URL, { method: 'POST', headers: { 'content-type': 'text/xml; charset=utf-8', SOAPAction: action, ...(idp ? { IdentityProvider: idp } : {}) }, body: envelope });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// Tiny tag readers — the responses are small and flat enough for this.
const tag = (xml, name) => { const m = new RegExp(`<(?:\\w+:)?${name}(?=[\\s>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml); return m ? m[1] : ''; };
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}(?=[\\s>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'g'))].map((m) => m[1]);
function msErrors(xml) {
  return tags(xml, 'OperationError').concat(tags(xml, 'AdApiError'))
    .map((e) => `${tag(e, 'ErrorCode') || tag(e, 'Code')}: ${tag(e, 'Message')}${tag(e, 'Details') || tag(e, 'Detail') ? ` (${tag(e, 'Details') || tag(e, 'Detail')})` : ''}`.trim())
    .concat(tag(xml, 'faultstring') ? [tag(xml, 'faultstring')] : [])
    .filter((s) => s && s !== ':');
}

// Microsoft account links key on the numeric account ID (aid=). Older items only have
// the account number, which AddClientLinks accepts for customer links only.
const msRef = (input) => ({ id: String((input && input.accountId) || '').replace(/\D/g, ''), number: String((input && input.accountNumber) || '').toUpperCase() });

export async function microsoftLinkStatus(input) {
  const ref = msRef(input);
  const body = `<SearchClientLinksRequest xmlns="https://bingads.microsoft.com/Customer/v13">
<Predicates xmlns:e="https://bingads.microsoft.com/Customer/v13/Entities">
<e:Predicate><e:Field>DirectManagingCustomerId</e:Field><e:Operator>Equals</e:Operator><e:Value>${xmlEsc(msManagerCustomerId())}</e:Value></e:Predicate>
</Predicates>
<Ordering i:nil="true" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>
<PageInfo xmlns:e="https://bingads.microsoft.com/Customer/v13/Entities"><e:Index>0</e:Index><e:Size>1000</e:Size></PageInfo>
</SearchClientLinksRequest>`;
  const r = await msSoap('SearchClientLinks', body);
  if (!r.ok) return { status: 'failed', detail: `Microsoft read-back failed: ${msErrors(r.text).join('; ') || `HTTP ${r.status}`}`.slice(0, 480) };
  const links = tags(r.text, 'ClientLink').map((l) => ({ id: tag(l, 'ClientEntityId'), number: tag(l, 'ClientEntityNumber').toUpperCase(), status: tag(l, 'Status') }));
  const mine = links.filter((l) => (ref.id && l.id === ref.id) || (ref.number && l.number === ref.number)).map((l) => l.status);
  if (mine.includes('Active')) return { status: 'verified', detail: '' };
  if (mine.some((s) => /^Link(Pending|Accepted|InProgress)$/.test(s))) return { status: 'pending', detail: 'Link request sent; waiting for the client to accept.' };
  if (mine.includes('LinkDeclined')) return { status: 'failed', detail: 'The client declined the link request.' };
  if (mine.includes('LinkExpired')) return { status: 'failed', detail: 'The link request expired (30 days). Send it again.' };
  if (mine.some((s) => /^Link(Canceled|Failed)$/.test(s))) return { status: 'failed', detail: `Microsoft link status: ${mine.join(', ')}` };
  return { status: 'none', detail: mine.length ? `Link status: ${mine.join(', ')}` : '' };
}

export async function sendMicrosoftLink(input, clientName, { suppressNotification = false } = {}) {
  const ref = msRef(input);
  if (!/^\d{5,15}$/.test(ref.id)) return { status: 'failed', detail: 'Missing Microsoft account ID (aid=) — ask the client for it, then Send link again.' };
  const existing = await microsoftLinkStatus(input);
  if (existing.status === 'verified') return { status: 'verified', detail: '' };
  if (existing.status === 'pending') return { status: 'invite_sent', detail: existing.detail };
  // Element order follows the WSDL ClientLink sequence: Type, ClientEntityId,
  // ManagingCustomerId, Note, Name, IsBillToClient, SuppressNotification. Name max 40 chars.
  const body = `<AddClientLinksRequest xmlns="https://bingads.microsoft.com/Customer/v13">
<ClientLinks xmlns:e="https://bingads.microsoft.com/Customer/v13/Entities">
<e:ClientLink>
<e:Type>AccountLink</e:Type>
<e:ClientEntityId>${xmlEsc(ref.id)}</e:ClientEntityId>
<e:ManagingCustomerId>${xmlEsc(msManagerCustomerId())}</e:ManagingCustomerId>
<e:Note>Fat Tail Ads account access request</e:Note>
<e:Name>${xmlEsc(`Fat Tail Ads - ${clientName || ref.id}`.slice(0, 40))}</e:Name>
<e:IsBillToClient>true</e:IsBillToClient>
<e:SuppressNotification>${suppressNotification ? 'true' : 'false'}</e:SuppressNotification>
</e:ClientLink>
</ClientLinks>
</AddClientLinksRequest>`;
  const r = await msSoap('AddClientLinks', body);
  const errs = msErrors(r.text);
  if (r.ok && !errs.length) return { status: 'invite_sent', detail: 'Link request sent from the Fat Tail Ads manager account.' };
  // The response never contains credentials; log the raw body so a refusal can be diagnosed.
  console.error('[agency-links] AddClientLinks refused', r.status, r.text.slice(0, 3000));
  return { status: 'failed', detail: `Microsoft refused the link request — ${errs.join('; ') || `HTTP ${r.status}`}`.slice(0, 480) };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

// opts.isTest: test requests don't make Microsoft email the client account's admins.
export async function sendAgencyLink(product, input, clientName, opts = {}) {
  if (product === 'google_ads') return sendGoogleAdsLink(input.customerId);
  if (product === 'microsoft_ads') return sendMicrosoftLink(input, clientName, { suppressNotification: !!opts.isTest });
  return { status: 'failed', detail: 'Not an agency platform.' };
}

export async function agencyLinkStatus(product, input) {
  if (product === 'google_ads') return googleAdsLinkStatus(String(input.customerId || '').replace(/\D/g, ''));
  if (product === 'microsoft_ads') return microsoftLinkStatus(input);
  return { status: 'none', detail: '' };
}
