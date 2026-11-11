// Builds and sends the weekly digest email for the owner.
// Reads everything with the Supabase secret key (server only, never sent to the browser)
// and sends through Resend. Used by weekly-digest.mjs (Mondays) and digest-now.mjs (test button).
const TZ = 'America/New_York';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function fmtDay(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function config() {
  return {
    url: Netlify.env.get('VITE_SUPABASE_URL'),
    anon: Netlify.env.get('VITE_SUPABASE_ANON_KEY'),
    secret: Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    resend: Netlify.env.get('RESEND_API_KEY'),
    from: Netlify.env.get('DIGEST_FROM') || 'NuCoat Ops <onboarding@resend.dev>',
    to: Netlify.env.get('DIGEST_TO') || '',
    site: Netlify.env.get('URL') || ''
  };
}

export function missing(cfg) {
  const need = [];
  if (!cfg.url) need.push('VITE_SUPABASE_URL');
  if (!cfg.secret) need.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!cfg.resend) need.push('RESEND_API_KEY');
  return need;
}

export async function table(cfg, name, query = 'select=*') {
  const res = await fetch(`${cfg.url}/rest/v1/${name}?${query}`, {
    headers: { apikey: cfg.secret, Authorization: `Bearer ${cfg.secret}` }
  });
  if (!res.ok) throw new Error(`Could not read ${name} (${res.status})`);
  return res.json();
}

// Same idea as people.js in the app: a task belongs to someone if they are ticked on it,
// or its free-text owner ("Ali Bea / Brady") names them.
const firstWord = (s) => (s || '').trim().toLowerCase().split(/[\s.@_-]+/)[0] || '';
function assignees(task, people) {
  const ids = new Set((task.assigned_to || []).filter((id) => people.some((p) => p.id === id)));
  (task.owner_label || '').split(/\/|,|&|\band\b|\+/i).map(firstWord).filter((w) => w.length >= 3).forEach((w) => {
    const hit = people.find((p) => { const d = firstWord(p.display_name); return d.length >= 3 && (d.startsWith(w) || w.startsWith(d)); });
    if (hit) ids.add(hit.id);
  });
  return [...ids];
}

export function buildDigest(data, now = new Date(), site = '') {
  const { profiles, tasks, content, videos, meetings, projects, time, billing } = data;
  const today = dayISO(now);
  const weekEnd = addDays(today, 6);
  const lastStart = addDays(today, -7);
  const people = profiles.filter((p) => p.role !== 'reviewer');
  const name = (id) => profiles.find((p) => p.id === id)?.display_name || 'Someone';

  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.due_date && t.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueThisWeek = open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const finished = tasks.filter((t) => t.done && t.done_at && dayISO(new Date(t.done_at)) >= lastStart);
  const waitingPosts = content.filter((c) => c.status === 'in_review').sort((a, b) => a.publish_date.localeCompare(b.publish_date));
  const waitingVideos = videos.filter((v) => v.waiting_on_brady);
  const thisWeekPosts = content.filter((c) => c.publish_date >= today && c.publish_date <= weekEnd).sort((a, b) => a.publish_date.localeCompare(b.publish_date));
  const notReady = thisWeekPosts.filter((c) => ['draft', 'changes_requested', 'in_review'].includes(c.status));
  const posted = content.filter((c) => c.status === 'posted' && c.publish_date >= lastStart && c.publish_date < today);
  const weekMeetings = meetings.filter((m) => { const d = dayISO(new Date(m.starts_at)); return d >= today && d <= weekEnd; }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const shoots = videos.filter((v) => v.shoot_date && v.stage !== 'delivered' && v.shoot_date >= today && v.shoot_date <= weekEnd);
  const lastHours = time.filter((e) => e.entry_date >= lastStart && e.entry_date < today).reduce((s, e) => s + Number(e.hours), 0);
  const cap = Number(billing?.weekly_cap_hours ?? 10);

  const who = (t) => { const ids = assignees(t, people); return ids.length ? ids.map(name).join(', ') : (t.owner_label || 'Unassigned'); };
  const h2 = (t) => `<h2 style="font:700 13px Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#0E5A82;margin:26px 0 8px;border-bottom:2px solid #E2F2FA;padding-bottom:6px">${esc(t)}</h2>`;
  const row = (left, right = '') => `<tr><td style="padding:6px 0;border-bottom:1px solid #EEF0F4;font:14px Arial,sans-serif;color:#111318">${left}</td><td style="padding:6px 0 6px 12px;border-bottom:1px solid #EEF0F4;font:12px Arial,sans-serif;color:#5B6472;text-align:right;white-space:nowrap">${right}</td></tr>`;
  const list = (rows, empty) => (rows.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.join('')}</table>` : `<p style="font:13px Arial,sans-serif;color:#5B6472;margin:4px 0">${esc(empty)}</p>`);
  const more = (arr, max) => (arr.length > max ? [row(`<span style="color:#5B6472">and ${arr.length - max} more</span>`)] : []);
  const stat = (n, label, bad) => `<td style="background:${bad ? '#FBE5E0' : '#F2F4F8'};border-radius:8px;padding:12px 6px;text-align:center;width:25%"><div style="font:700 26px Arial,sans-serif;color:${bad ? '#A8321C' : '#111318'}">${n}</div><div style="font:700 10px Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#5B6472">${label}</div></td>`;

  const attention = [
    ...overdue.slice(0, 8).map((t) => row(`<b style="color:#A8321C">Overdue:</b> ${esc(t.title)}`, `${esc(who(t))} · ${fmtDay(t.due_date)}`)),
    ...more(overdue, 8),
    ...waitingVideos.map((v) => row(`<b>Needs approval:</b> video #${v.number} ${esc(v.title)}`, 'video')),
    ...waitingPosts.slice(0, 6).map((c) => row(`<b>Needs approval:</b> ${esc(c.title)}`, `${esc(c.channel)} · ${fmtDay(c.publish_date)}`)),
    ...more(waitingPosts, 6),
    ...notReady.filter((c) => c.status !== 'in_review').map((c) => row(`<b>Not submitted yet:</b> ${esc(c.title)}`, `goes out ${fmtDay(c.publish_date)}`))
  ];
  const ahead = [
    ...weekMeetings.map((m) => row(`<b>Meeting:</b> ${esc(m.title)}`, `${fmtDay(dayISO(new Date(m.starts_at)))} ${fmtTime(m.starts_at)}`)),
    ...shoots.map((v) => row(`<b>Shoot:</b> #${v.number} ${esc(v.title)}`, fmtDay(v.shoot_date))),
    ...thisWeekPosts.slice(0, 10).map((c) => row(`${esc(c.channel[0].toUpperCase() + c.channel.slice(1))}: ${esc(c.title)}`, `${fmtDay(c.publish_date)} · ${esc(c.status.replace('_', ' '))}`)),
    ...more(thisWeekPosts, 10),
    ...dueThisWeek.slice(0, 10).map((t) => row(`<b>Due:</b> ${esc(t.title)}`, `${esc(who(t))} · ${fmtDay(t.due_date)}`)),
    ...more(dueThisWeek, 10)
  ];
  const team = people.map((p) => {
    const mine = open.filter((t) => assignees(t, people).includes(p.id));
    const late = mine.filter((t) => t.due_date && t.due_date < today).length;
    const did = finished.filter((t) => assignees(t, people).includes(p.id)).length;
    return row(`<b>${esc(p.display_name)}</b> <span style="color:#5B6472">${esc(p.department || '')}</span>`, `${plural(mine.length, 'open task')}${late ? ` · <b style="color:#A8321C">${late} overdue</b>` : ''} · ${did} finished`);
  });
  const proj = projects.filter((p) => p.status !== 'done').map((p) => {
    const pt = tasks.filter((t) => t.project_id === p.id);
    return row(`<b>${esc(p.name)}</b> <span style="color:#5B6472">${esc(p.status)}</span>`, `${pt.filter((t) => t.done).length} of ${pt.length} tasks done${p.due_date ? ` · target ${fmtDay(p.due_date)}` : ''}`);
  });
  const wins = [
    ...finished.slice(0, 10).map((t) => row(`&#10003; ${esc(t.title)}`, esc(who(t)))),
    ...more(finished, 10),
    ...posted.slice(0, 8).map((c) => row(`Posted: ${esc(c.title)}`, `${esc(c.channel)} · ${fmtDay(c.publish_date)}`)),
    ...more(posted, 8)
  ];

  const html = `<!doctype html><html><body style="margin:0;background:#F2F4F8;padding:24px 12px">
<table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;border-top:5px solid #1B7FB3"><tr><td style="padding:26px 28px 30px">
<div style="font:700 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5B6472">NuCoat Ops · weekly digest</div>
<h1 style="font:700 24px Arial,sans-serif;color:#111318;margin:6px 0 18px">Week of ${fmtDay(today)}</h1>
<table width="100%" cellpadding="0" cellspacing="6"><tr>
${stat(open.length, 'open tasks')}${stat(overdue.length, 'overdue', overdue.length > 0)}${stat(waitingPosts.length + waitingVideos.length, 'to approve')}${stat(thisWeekPosts.length, 'posts this week')}
</tr></table>
${h2('Needs attention')}${list(attention, 'Nothing is overdue or stuck. Clean start.')}
${h2('The week ahead')}${list(ahead, 'Nothing scheduled in the next 7 days.')}
${h2('Team')}${list(team, 'No team members yet.')}
${proj.length ? h2('Projects') + list(proj, '') : ''}
${h2('Finished last week')}${list(wins, 'Nothing was marked finished last week.')}
${h2('Retainer hours last week')}<p style="font:14px Arial,sans-serif;color:#111318;margin:4px 0">${Math.round(lastHours * 100) / 100}h logged of ${cap}h included${lastHours > cap ? ` · <b style="color:#A8321C">${Math.round((lastHours - cap) * 100) / 100}h over</b>` : ''}. <span style="color:#5B6472">Only you get this email.</span></p>
${site ? `<p style="margin:26px 0 0"><a href="${esc(site)}" style="background:#1B7FB3;color:#ffffff;font:700 13px Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;padding:11px 18px;border-radius:8px;display:inline-block">Open NuCoat Ops</a></p>` : ''}
</td></tr></table></body></html>`;

  const bits = [plural(open.length, 'open task')];
  if (overdue.length) bits.push(`${overdue.length} overdue`);
  if (waitingPosts.length + waitingVideos.length) bits.push(`${waitingPosts.length + waitingVideos.length} to approve`);
  return { subject: `NuCoat Ops, week of ${fmtDay(today)}: ${bits.join(', ')}`, html };
}

export async function sendDigest() {
  const cfg = config();
  const need = missing(cfg);
  if (need.length) return { ok: false, message: `Not set up yet. Add these in Netlify, Environment variables: ${need.join(', ')}. Then redeploy.` };

  const [profiles, tasks, content, videos, meetings, projects, time, billing] = await Promise.all([
    table(cfg, 'profiles'), table(cfg, 'tasks'), table(cfg, 'content_items'), table(cfg, 'videos'),
    table(cfg, 'meetings'), table(cfg, 'projects'), table(cfg, 'time_entries'), table(cfg, 'billing_settings', 'select=*&id=eq.1')
  ]);
  const owner = profiles.find((p) => p.role === 'owner');
  const to = cfg.to || owner?.email;
  if (!to) return { ok: false, message: 'No email address for the owner. Add yours on the Team tab under People.' };

  const { subject, html } = buildDigest({ profiles, tasks, content, videos, meetings, projects, time, billing: billing[0] }, new Date(), cfg.site);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.resend}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to: [to], subject, html })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: `The email service refused it: ${body.message || res.status}` };
  }
  return { ok: true, message: `Sent to ${to}. Check your inbox.` };
}
