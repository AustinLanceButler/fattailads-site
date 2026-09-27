// api/_lib/google.mjs — Google OAuth + the two grant APIs the beta flow supports.
//
// Each product requests only its own scopes (incremental authorization), with
// access_type=online: Google issues no refresh token, and the short-lived access
// token is held encrypted in a cookie until the grant, then revoked and dropped.
//
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (OAuth web client in the
// fattailads-connect Cloud project), CONNECT_RECEIVING_EMAIL (who gets access).

export const PRODUCTS = {
  ga4: {
    label: 'Google Analytics 4',
    role: 'Editor',
    scopes: [
      'https://www.googleapis.com/auth/analytics.manage.users',
      'https://www.googleapis.com/auth/analytics.readonly',
    ],
  },
  gtm: {
    label: 'Google Tag Manager',
    role: 'User (publish on all containers)',
    scopes: [
      'https://www.googleapis.com/auth/tagmanager.manage.users',
      'https://www.googleapis.com/auth/tagmanager.readonly',
    ],
  },
};

export function receivingEmail() {
  return (process.env.CONNECT_RECEIVING_EMAIL || 'austin@fattailads.com').toLowerCase();
}

// Admin sign-in (product 'admin') asks only for identity.
export const ADMIN_SCOPES = ['openid', 'email'];

export function authUrl({ redirectUri, product, state, codeChallenge }) {
  const scopes = product === 'admin' ? ADMIN_SCOPES : PRODUCTS[product].scopes;
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'online',
    include_granted_scopes: 'false',
    prompt: 'select_account',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode({ code, redirectUri, codeVerifier }) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const err = new Error(`token exchange failed: ${j.error || r.status}`);
    err.code = j.error || 'token_exchange_failed';
    throw err;
  }
  return { accessToken: j.access_token, expiresIn: j.expires_in || 3600, scope: j.scope || '' };
}

// Verified email of the signed-in Google user (admin sign-in only).
export async function fetchVerifiedEmail(token) {
  const r = await gapi(token, 'https://openidconnect.googleapis.com/v1/userinfo');
  if (!r.ok || !r.body.email || r.body.email_verified !== true) return '';
  return String(r.body.email).toLowerCase();
}

// Best-effort: invalidate the client's token once we're done with it.
export async function revokeToken(token) {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch { /* ignore */ }
}

async function gapi(token, url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body: j };
}

function apiErrorMessage(resp) {
  return (resp.body && resp.body.error && resp.body.error.message) || `HTTP ${resp.status}`;
}

// ── Accounts the signed-in client can see ─────────────────────────────────────
// GA4 accounts carry `canGrant`: false only when Google explicitly refuses (403) to
// list users there, i.e. the person isn't an administrator. Throttling or other
// errors leave it true, and the grant call is the final check. Grantable first.
// GTM gets no per-account probing: the Tag Manager API allows only ~25 requests
// per 100 seconds per project, so fanning out across accounts gets throttled
// and misreports admins. GTM admin rights are checked at grant time instead.

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  });
  await Promise.all(workers);
  return out;
}

function grantableFirst(accounts) {
  return accounts.sort((a, b) => Number(b.canGrant) - Number(a.canGrant) || a.name.localeCompare(b.name));
}

export async function listAccounts(product, token) {
  if (product === 'ga4') {
    const out = [];
    let pageToken = '';
    do {
      const url = `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const r = await gapi(token, url);
      if (!r.ok) throw Object.assign(new Error(apiErrorMessage(r)), { status: r.status });
      for (const a of r.body.accountSummaries || []) {
        const n = (a.propertySummaries || []).length;
        out.push({ id: String(a.account).replace('accounts/', ''), name: a.displayName, detail: `${n} ${n === 1 ? 'property' : 'properties'}` });
      }
      pageToken = r.body.nextPageToken || '';
    } while (pageToken);
    await mapLimit(out, 8, async (a) => {
      const probe = await gapi(token, `https://analyticsadmin.googleapis.com/v1alpha/accounts/${a.id}/accessBindings?pageSize=1`);
      a.canGrant = probe.status !== 403;
    });
    return grantableFirst(out);
  }
  if (product === 'gtm') {
    const r = await gapi(token, 'https://tagmanager.googleapis.com/tagmanager/v2/accounts');
    if (!r.ok) throw Object.assign(new Error(apiErrorMessage(r)), { status: r.status });
    return (r.body.account || [])
      .map((a) => ({ id: String(a.accountId), name: a.name, detail: 'Tag Manager account', canGrant: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  throw new Error(`unknown product ${product}`);
}

// ── Grant + read-back verification ────────────────────────────────────────────
// Returns { status: 'verified' | 'already_had_access' | 'invited' | 'failed', detail, trace }.
// `trace` records each Google call's HTTP status and error text (never tokens)
// for the audit log. The read-back retries briefly: listings can lag a write,
// and the Tag Manager API throttles aggressively.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function step(trace, name, resp) {
  const e = resp.body && resp.body.error;
  const b = resp.body || {};
  // Echo only identifying, non-secret fields Google returns for the resource.
  const echo = {};
  for (const k of ['name', 'path', 'user', 'emailAddress', 'accountAccess', 'containerAccess', 'roles']) if (b[k] !== undefined) echo[k] = b[k];
  if (Array.isArray(b.userPermission)) echo.listed = b.userPermission.map((u) => u.emailAddress);
  if (Array.isArray(b.accessBindings)) echo.listed = b.accessBindings.map((x) => x.user);
  trace.push({ step: name, status: resp.status, ...(e ? { error: String(e.message || e.status || '').slice(0, 300) } : {}), ...(Object.keys(echo).length ? { echo } : {}) });
  return resp;
}

async function readBack(trace, name, fetchList, hasUser) {
  for (const wait of [0, 1500, 4000]) {
    if (wait) await sleep(wait);
    const list = step(trace, name, await fetchList());
    if (list.ok && hasUser(list.body)) return true;
  }
  return false;
}

export async function grantAndVerify(product, token, accountId) {
  const email = receivingEmail();
  const trace = [];
  if (!/^\d+$/.test(String(accountId))) return { status: 'failed', detail: 'Invalid account.', trace };

  if (product === 'ga4') {
    const base = `https://analyticsadmin.googleapis.com/v1alpha/accounts/${accountId}/accessBindings`;
    const created = step(trace, 'create_binding', await gapi(token, base, { method: 'POST', body: JSON.stringify({ user: email, roles: ['predefinedRoles/editor'] }) }));
    const already = created.status === 409;
    if (!created.ok && !already) return { status: 'failed', detail: grantFailureMessage(created, 'Google Analytics'), trace };
    const found = await readBack(trace, 'list_bindings', () => gapi(token, `${base}?pageSize=500`),
      (b) => (b.accessBindings || []).some((x) => String(x.user || '').toLowerCase() === email));
    if (!found) return { status: 'failed', detail: 'Access was requested but could not be confirmed. Please try again.', trace };
    return { status: already ? 'already_had_access' : 'verified', detail: '', trace };
  }

  if (product === 'gtm') {
    const base = `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}`;
    const containers = step(trace, 'list_containers', await gapi(token, `${base}/containers`));
    if (!containers.ok) return { status: 'failed', detail: grantFailureMessage(containers, 'Tag Manager'), trace };
    const containerAccess = (containers.body.container || []).map((c) => ({ containerId: String(c.containerId), permission: 'publish' }));
    const created = step(trace, 'create_permission', await gapi(token, `${base}/user_permissions`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: email, accountAccess: { permission: 'user' }, containerAccess }),
    }));
    const already = created.status === 409;
    if (!created.ok && !already) return { status: 'failed', detail: grantFailureMessage(created, 'Tag Manager'), trace };
    const found = await readBack(trace, 'list_permissions', () => gapi(token, `${base}/user_permissions`),
      (b) => (b.userPermission || []).some((u) => String(u.emailAddress || '').toLowerCase() === email));
    // GTM often creates an *invitation* the receiving user must accept; the API's list
    // omits pending invites. A 2xx create that echoes our email + a permission path is
    // a sent invitation — the client's part is done, FTA accepts on its side.
    const createdEmail = String((created.body && created.body.emailAddress) || '').toLowerCase();
    if (!found && created.ok && createdEmail === email && created.body.path) {
      return { status: 'invited', detail: '', trace };
    }
    if (!found) return { status: 'failed', detail: 'Access was requested but could not be confirmed. Please try again.', trace };
    return { status: already ? 'already_had_access' : 'verified', detail: '', trace };
  }

  return { status: 'failed', detail: 'Unsupported product.', trace };
}

function grantFailureMessage(resp, productName) {
  if (resp.status === 403) {
    return `Your Google account doesn't have permission to manage users on this ${productName} account. An administrator of the account needs to complete this step.`;
  }
  if (resp.status === 401) return 'Your Google sign-in expired. Please sign in again.';
  return `${productName} returned an error: ${apiErrorMessage(resp)}`;
}
