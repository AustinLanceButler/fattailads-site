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

export function authUrl({ redirectUri, product, state, codeChallenge }) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PRODUCTS[product].scopes.join(' '),
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
    return out;
  }
  if (product === 'gtm') {
    const r = await gapi(token, 'https://tagmanager.googleapis.com/tagmanager/v2/accounts');
    if (!r.ok) throw Object.assign(new Error(apiErrorMessage(r)), { status: r.status });
    const accounts = r.body.account || [];
    return Promise.all(accounts.map(async (a) => {
      const c = await gapi(token, `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${a.accountId}/containers`);
      const n = c.ok ? (c.body.container || []).length : 0;
      return { id: String(a.accountId), name: a.name, detail: `${n} ${n === 1 ? 'container' : 'containers'}` };
    }));
  }
  throw new Error(`unknown product ${product}`);
}

// ── Grant + read-back verification ────────────────────────────────────────────
// Returns { status: 'verified' | 'already_had_access' | 'failed', detail }.

export async function grantAndVerify(product, token, accountId) {
  const email = receivingEmail();
  if (!/^\d+$/.test(String(accountId))) return { status: 'failed', detail: 'Invalid account.' };

  if (product === 'ga4') {
    const base = `https://analyticsadmin.googleapis.com/v1alpha/accounts/${accountId}/accessBindings`;
    const created = await gapi(token, base, { method: 'POST', body: JSON.stringify({ user: email, roles: ['predefinedRoles/editor'] }) });
    const already = created.status === 409;
    if (!created.ok && !already) return { status: 'failed', detail: grantFailureMessage(created, 'Google Analytics') };
    const list = await gapi(token, `${base}?pageSize=500`);
    const found = list.ok && (list.body.accessBindings || []).some((b) => String(b.user || '').toLowerCase() === email);
    if (!found) return { status: 'failed', detail: 'Access was requested but could not be confirmed. Please try again.' };
    return { status: already ? 'already_had_access' : 'verified', detail: '' };
  }

  if (product === 'gtm') {
    const base = `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}`;
    const containers = await gapi(token, `${base}/containers`);
    if (!containers.ok) return { status: 'failed', detail: grantFailureMessage(containers, 'Tag Manager') };
    const containerAccess = (containers.body.container || []).map((c) => ({ containerId: String(c.containerId), permission: 'publish' }));
    const created = await gapi(token, `${base}/user_permissions`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: email, accountAccess: { permission: 'user' }, containerAccess }),
    });
    const already = created.status === 409;
    if (!created.ok && !already) return { status: 'failed', detail: grantFailureMessage(created, 'Tag Manager') };
    const list = await gapi(token, `${base}/user_permissions`);
    const found = list.ok && (list.body.userPermission || []).some((u) => String(u.emailAddress || '').toLowerCase() === email);
    if (!found) return { status: 'failed', detail: 'Access was requested but could not be confirmed. Please try again.' };
    return { status: already ? 'already_had_access' : 'verified', detail: '' };
  }

  return { status: 'failed', detail: 'Unsupported product.' };
}

function grantFailureMessage(resp, productName) {
  if (resp.status === 403) {
    return `Your Google account doesn't have permission to manage users on this ${productName} account. An administrator of the account needs to complete this step.`;
  }
  if (resp.status === 401) return 'Your Google sign-in expired. Please sign in again.';
  return `${productName} returned an error: ${apiErrorMessage(resp)}`;
}
