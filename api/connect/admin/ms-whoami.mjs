// GET /api/connect/admin/ms-whoami — read-only: which Microsoft Ads user each FTA identity
// resolves to, and its roles per customer. "agency" is what AddClientLinks sends as;
// "warehouse" is the gmail reporting login. GetUser + GetCustomersInfo only; no token
// material is returned. ?account=<id> also resolves that account's customer number.

import { allowMethods, sendError, sendJson } from '../../_lib/http.mjs';
import { requireAdmin } from '../../_lib/admin-session.mjs';
import { msSoap, resolveMsCustomerNumber, tag, tags } from '../../_lib/agency-links.mjs';

// Microsoft Ads role IDs (Customer Management v13 GetUser docs).
const ROLES = { 41: 'Super Admin', 16: 'Standard', 33: 'Advertiser Campaign Manager', 100: 'Viewer', 203: 'Ad account viewer' };

async function describe(as) {
  try {
    const u = await msSoap('GetUser', '<GetUserRequest xmlns="https://bingads.microsoft.com/Customer/v13"><UserId i:nil="true" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/></GetUserRequest>', { as });
    if (!u.ok) return { error: (tag(u.text, 'faultstring') || `HTTP ${u.status}`).slice(0, 300) };
    // Drop ContactInfo first: its nested Address has its own Id.
    const user = tag(u.text, 'User').replace(/<(\w+:)?ContactInfo[\s\S]*?<\/(\w+:)?ContactInfo>/, '');
    const roles = tags(u.text, 'CustomerRole').map((r) => ({
      customerId: tag(r, 'CustomerId'),
      roleId: tag(r, 'RoleId'),
      role: ROLES[tag(r, 'RoleId')] || 'other',
      accountIds: tags(tag(r, 'AccountIds'), 'long'),
      linkedAccountIds: tags(tag(r, 'LinkedAccountIds'), 'long'),
    }));
    const c = await msSoap('GetCustomersInfo', '<GetCustomersInfoRequest xmlns="https://bingads.microsoft.com/Customer/v13"><CustomerNameFilter></CustomerNameFilter><TopN>100</TopN></GetCustomersInfoRequest>', { as });
    const customers = tags(c.text, 'CustomerInfo').map((x) => ({ id: tag(x, 'Id'), name: tag(x, 'Name') }));
    return { userId: tag(user, 'Id'), userName: tag(user, 'UserName'), customerId: tag(user, 'CustomerId'), roles, customers };
  } catch (err) {
    return { error: String(err.code || err.message).slice(0, 200) };
  }
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const admin = requireAdmin(req, res);
  if (!admin) return;
  try {
    const out = { agency: await describe('agency'), warehouse: await describe('warehouse') };
    const account = String((req.query && req.query.account) || '').replace(/\D/g, '');
    if (account) out.account = { id: account, customerNumber: await resolveMsCustomerNumber(account) };
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, out);
  } catch (err) {
    console.error('[connect/admin/ms-whoami]', err.message);
    return sendError(res, 500, 'server_error', 'Lookup failed.');
  }
}
