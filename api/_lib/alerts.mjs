// api/_lib/alerts.mjs — warehouse alerts: a row in ads.alerts plus one deduplicated
// ClickUp task per open problem (CLICKUP_API_TOKEN + ALERT_CLICKUP_LIST_ID). A repeat
// of the same dedupe_key while the first is still open is recorded but not re-posted;
// clearAlert() acks it when the condition heals.

import { exec } from './warehouse.mjs';

export async function raiseAlert(q, { job, dedupe_key, message, detail = null, severity = 'error' }) {
  const open = dedupe_key
    ? await exec(q, `select id, clickup_task_id from ads.alerts where dedupe_key = $1 and not acked and ts > now() - interval '7 days' order by ts desc limit 1`, [dedupe_key])
    : [];
  const [row] = await exec(q, `insert into ads.alerts (severity, job, dedupe_key, message, detail, clickup_task_id)
    values ($1, $2, $3, $4, $5::jsonb, $6) returning id`,
    [severity, job, dedupe_key || null, String(message).slice(0, 2000), detail ? JSON.stringify(detail) : null, open[0] ? open[0].clickup_task_id : null]);
  if (open.length) return { id: row.id, deduped: true, clickup_task_id: open[0].clickup_task_id };
  let taskId = null;
  try {
    taskId = await createClickUpTask({ name: `Feed failure: ${job} — ${String(message).slice(0, 120)}`, description: `${message}\n\n${detail ? '```\n' + JSON.stringify(detail, null, 2) + '\n```\n\n' : ''}Raised by fattailads-site ads warehouse (${job}). Dedupe key: ${dedupe_key || 'n/a'}.` });
    if (taskId) await exec(q, 'update ads.alerts set clickup_task_id = $2 where id = $1', [row.id, taskId]);
  } catch (err) {
    console.error('[alerts] ClickUp task failed:', err.message);
  }
  return { id: row.id, deduped: false, clickup_task_id: taskId };
}

export async function clearAlert(q, dedupe_key) {
  if (!dedupe_key) return 0;
  const rows = await exec(q, `update ads.alerts set acked = true where dedupe_key = $1 and not acked returning id`, [dedupe_key]);
  return rows.length;
}

async function createClickUpTask({ name, description }) {
  const token = process.env.CLICKUP_API_TOKEN;
  const list = process.env.ALERT_CLICKUP_LIST_ID;
  if (!token || !list) return null;
  const r = await fetch(`https://api.clickup.com/api/v2/list/${encodeURIComponent(list)}/task`, {
    method: 'POST',
    headers: { Authorization: token, 'content-type': 'application/json' },
    body: JSON.stringify({ name, markdown_description: description, priority: 2, tags: ['feed-alert'] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`ClickUp ${r.status}: ${j.err || j.error || ''}`);
  return j.id || null;
}
