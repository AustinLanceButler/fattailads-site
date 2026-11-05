// test/fixtures/tiktok.mjs — TikTok Marketing API v1.3 report shapes, copied from a
// live read-only call in Nov 2026 (field names, string values, 'YYYY-MM-DD 00:00:00'
// days, attribute metrics). Ids, names and every number are made up.

export const ADVERTISER = '7012345678901234567';
export const CAMPAIGN = '1812345678901234';
export const ADGROUP = '1812345678905678';

const depth = (o) => ({
  reach: o.reach, frequency: o.frequency, video_play_actions: o.plays, video_watched_2s: o.w2, video_watched_6s: o.w6,
  video_views_p25: o.p25, video_views_p50: o.p50, video_views_p75: o.p75, video_views_p100: o.p100,
  engaged_view: o.engaged, average_video_play: o.avg,
});

const DAYS = {
  '2026-11-02': { spend: '210.40', impressions: '51200', clicks: '610', conversion: '0', reach: '30100', frequency: '1.70', plays: '49800', w2: '5200', w6: '2150', p25: '1800', p50: '1050', p75: '690', p100: '360', engaged: '2400', avg: '2.20' },
  '2026-11-03': { spend: '215.90', impressions: '50400', clicks: '590', conversion: '0', reach: '26800', frequency: '1.88', plays: '48700', w2: '5050', w6: '2280', p25: '1950', p50: '1210', p75: '760', p100: '400', engaged: '2460', avg: '2.75' },
};

// AUCTION_CAMPAIGN, dimensions [campaign_id, stat_time_day], core + depth metrics.
export const campaignItems = Object.entries(DAYS).map(([day, o]) => ({
  dimensions: { campaign_id: CAMPAIGN, stat_time_day: `${day} 00:00:00` },
  metrics: { campaign_name: 'Launch Campaign', spend: o.spend, impressions: o.impressions, clicks: o.clicks, conversion: o.conversion, ...depth(o) },
}));

// AUCTION_ADGROUP, dimensions [adgroup_id, stat_time_day]; parent id and names are attribute metrics.
export const adgroupItems = Object.entries(DAYS).map(([day, o]) => ({
  dimensions: { adgroup_id: ADGROUP, stat_time_day: `${day} 00:00:00` },
  metrics: { adgroup_name: 'Ad Group 1', campaign_id: CAMPAIGN, campaign_name: 'Launch Campaign', spend: o.spend, impressions: o.impressions, clicks: o.clicks, conversion: o.conversion, ...depth(o) },
}));

export const campaignList = [{ campaign_id: CAMPAIGN, campaign_name: 'Launch Campaign', operation_status: 'ENABLE', objective_type: 'TRAFFIC', budget: 330, budget_mode: 'BUDGET_MODE_DAY', create_time: '2026-10-20 14:02:11' }];
export const adgroupList = [{ adgroup_id: ADGROUP, adgroup_name: 'Ad Group 1', campaign_id: CAMPAIGN, operation_status: 'ENABLE', budget: 0, budget_mode: 'BUDGET_MODE_INFINITE', create_time: '2026-10-20 14:05:40' }];

// Only the metrics a request asked for come back (TikTok omits the rest).
export function pick(items, metrics) {
  return items.map((it) => ({ dimensions: it.dimensions, metrics: Object.fromEntries(metrics.map((m) => [m, it.metrics[m] ?? '0'])) }));
}

// fetch stand-in for the TikTok API. opts.reject: a metric name the report endpoint
// refuses (code 40002, as TikTok does for an unknown metric); opts.failAdgroup: the
// ad-group report errors outright.
export function fakeTikTokFetch({ reject = null, failAdgroup = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    const u = new URL(url);
    const path = u.pathname.replace(/^.*\/v1\.3/, '');
    const metrics = u.searchParams.get('metrics') ? JSON.parse(u.searchParams.get('metrics')) : null;
    const level = u.searchParams.get('data_level');
    calls.push({ path, level, metrics });
    const ok = (data) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ code: 0, message: 'OK', data }) });
    const bad = (code, message) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ code, message }) });
    const page = (list) => ok({ list, page_info: { page: 1, total_page: 1, total_number: list.length } });
    if (path === '/campaign/get/') return page(campaignList);
    if (path === '/adgroup/get/') return page(adgroupList);
    if (path === '/report/integrated/get/') {
      if (reject && metrics.includes(reject)) return bad(40002, `Invalid metric: ${reject}`);
      if (level === 'AUCTION_ADGROUP') return failAdgroup ? bad(40002, 'adgroup report broke') : page(pick(adgroupItems, metrics));
      return page(pick(campaignItems, metrics));
    }
    return bad(40400, `unexpected ${path}`);
  };
  return { fetch, calls };
}

// q stand-in: records every statement; upserts decode to { table → rows[] }.
export function recordingClient() {
  const statements = [];
  const q = { query: async (text, params = []) => { statements.push({ text, params }); return []; } };
  const upserts = (table) => statements
    .filter((s) => new RegExp(`^insert into ads\\.${table} \\(`).test(s.text) && /jsonb_to_recordset/.test(s.text))
    .flatMap((s) => JSON.parse(s.params[0]));
  return { q, statements, upserts };
}
