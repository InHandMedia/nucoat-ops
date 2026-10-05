import React, { useState } from 'react';
import { BRANDS, todayISO, fmtDate, channelInfo } from '../constants.js';
import { BrandChip } from './Badges.jsx';
import { effectiveAssignees } from '../people.js';

// ---------- number helpers ----------
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function fmtVal(v, m) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (m.kind === 'yesno') return v >= 1 ? 'Yes' : 'No';
  const n = Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100);
  if (m.unit === '$') return `$${n}`;
  if (m.unit === '%') return `${n}%`;
  if (m.unit === '★') return `${n} ★`;
  return n;
}

// Everything the cards need, worked out from the logged entries.
export function metricStats(m, entries, today) {
  const mine = entries
    .filter((e) => e.metric_id === m.id)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || String(a.created_at).localeCompare(String(b.created_at)));
  const monthKey = today.slice(0, 7);
  let current = null;
  if (mine.length) {
    if (m.rollup === 'sum') current = mine.reduce((s, e) => s + Number(e.value), 0);
    else if (m.rollup === 'month') {
      const inMonth = mine.filter((e) => e.entry_date.slice(0, 7) === monthKey);
      current = inMonth.length ? inMonth.reduce((s, e) => s + Number(e.value), 0) : 0;
    } else current = Number(mine[mine.length - 1].value);
  }
  let baseline = num(m.baseline);
  if (baseline === null) baseline = m.rollup === 'latest' ? (mine.length ? Number(mine[0].value) : null) : 0;
  let target = num(m.target);
  if (m.rollup === 'month' && m.monthly_targets && m.monthly_targets[monthKey] != null) target = Number(m.monthly_targets[monthKey]);
  let goal = target;
  if (target !== null && m.relative) goal = (baseline ?? 0) + target;
  let pct = null;
  let met = false;
  if (goal !== null && current !== null) {
    const base = m.rollup === 'month' ? 0 : baseline ?? 0;
    pct = goal === base ? (current >= goal ? 1 : 0) : (current - base) / (goal - base);
    pct = Math.max(0, Math.min(1, pct));
    met = goal >= base ? current >= goal : current <= goal;
  }
  return { entries: mine, current, baseline, goal, pct, met };
}

// ---------- auto-tracked numbers (from the rest of the app) ----------
function quarterBounds(today) {
  const y = Number(today.slice(0, 4));
  const mo = Number(today.slice(5, 7));
  const qs = Math.floor((mo - 1) / 3) * 3 + 1;
  const start = `${y}-${String(qs).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(y, qs + 2, 0)).toISOString().slice(0, 10);
  return { start, end, label: `Q${Math.floor((mo - 1) / 3) + 1} ${y}` };
}

function Bar({ label, done, total, sub, doneLabel }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  return (
    <div className="autobar" data-done={complete ? 'true' : 'false'}>
      <div className="autobar-top">
        <span>{label}</span>
        <b className="mono">{done} of {total}{doneLabel ? ` ${doneLabel}` : ''}</b>
      </div>
      <div className="meter"><span style={{ width: `${pct}%` }} /></div>
      {sub && <div className="autobar-sub">{sub}</div>}
    </div>
  );
}

function AutoPanel({ videos, contentItems, tasks, profiles }) {
  const today = todayISO();
  const q = quarterBounds(today);
  const monthKey = today.slice(0, 7);
  const inQ = contentItems.filter((c) => c.publish_date >= q.start && c.publish_date <= q.end);
  const inMonth = contentItems.filter((c) => c.publish_date.slice(0, 7) === monthKey);
  const posted = (list) => list.filter((c) => c.status === 'posted').length;
  const dueSoFar = (list) => list.filter((c) => c.publish_date <= today);
  const emails = inQ.filter((c) => c.channel === 'email');
  const videoPosts = inQ.filter((c) => c.kind === 'video');
  const series = videos.filter((v) => v.brand === 'NuCoat');
  const social = ['facebook', 'instagram', 'linkedin'];
  const staff = profiles.filter((p) => p.role !== 'reviewer');
  const overdue = tasks.filter((t) => !t.done && t.due_date && t.due_date < today).length;

  const lateEmails = dueSoFar(emails).filter((c) => c.status !== 'posted').length;
  const lateVideo = dueSoFar(videoPosts).filter((c) => c.status !== 'posted').length;

  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Tracked automatically <span className="mono" style={{ fontSize: '11px' }}>{q.label}</span></h3>
      <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
        These come from the Content, Series and Tasks tabs, so there is nothing to type. Mark a post as posted and it counts.
      </p>
      <div className="autogrid">
        <Bar label="Compliance videos delivered" done={series.filter((v) => v.stage === 'delivered').length} total={series.length} />
        <Bar
          label="Video release posts sent" done={posted(videoPosts)} total={videoPosts.length}
          sub={lateVideo ? `${lateVideo} past its date and not posted yet` : 'Nothing running late'}
        />
        <Bar
          label="Emails sent on schedule" done={posted(emails)} total={emails.length}
          sub={lateEmails ? `${lateEmails} past its date and not sent yet` : 'Nothing running late'}
        />
        {social.map((ch) => {
          const list = inMonth.filter((c) => c.channel === ch);
          return <Bar key={ch} label={`${channelInfo(ch).label} posts this month`} done={posted(list)} total={list.length} />;
        })}
        <Bar label="Tasks finished" done={tasks.filter((t) => t.done).length} total={tasks.length} sub={overdue ? `${overdue} overdue` : 'None overdue'} />
      </div>
      <h3 style={{ marginTop: '18px' }}>Tasks by person</h3>
      <div className="autogrid">
        {staff.map((p) => {
          const mine = tasks.filter((t) => effectiveAssignees(t, profiles).includes(p.id));
          return <Bar key={p.id} label={p.display_name} done={mine.filter((t) => t.done).length} total={mine.length} sub={`${mine.filter((t) => !t.done).length} open`} />;
        })}
      </div>
    </div>
  );
}

// ---------- one goal ----------
function MetricCard({ m, entries, actions }) {
  const today = todayISO();
  const st = metricStats(m, entries, today);
  const [val, setVal] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(null);

  function startEdit() {
    setF({
      name: m.name, detail: m.detail || '', unit: m.unit || '', rollup: m.rollup, baseline: m.baseline ?? '', target: m.target ?? '',
      target_label: m.target_label || '', target_date: m.target_date || '', owner_label: m.owner_label || '', notes: m.notes || ''
    });
    setEditing(true);
  }
  async function saveEdit() {
    await actions.saveMetric(m.id, {
      name: f.name.trim() || m.name, detail: f.detail, unit: f.unit, rollup: f.rollup,
      baseline: f.baseline === '' ? null : Number(f.baseline), target: f.target === '' ? null : Number(f.target),
      target_label: f.target_label, target_date: f.target_date || null, owner_label: f.owner_label, notes: f.notes
    });
    setEditing(false);
  }
  async function log(e, forced) {
    e.preventDefault();
    const v = forced !== undefined ? forced : Number(val);
    if (forced === undefined && (val === '' || Number.isNaN(v))) return;
    await actions.addEntry({ metric_id: m.id, entry_date: date || today, value: v, note: note.trim() });
    setVal(''); setNote('');
  }

  const monthTarget = m.rollup === 'month' && m.monthly_targets && m.monthly_targets[today.slice(0, 7)] != null;
  const overdueGoal = m.target_date && m.target_date < today && !st.met;

  return (
    <div className="panel metric-card" data-done={st.met ? 'true' : 'false'}>
      <div className="metric-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="metric-name">{m.name}</div>
          {m.detail && <div className="task-meta">{m.detail}</div>}
        </div>
        <BrandChip brand={m.brand} />
        {m.owner_label && <span className="badge assignee">{m.owner_label}</span>}
      </div>

      <div className="metric-nums">
        <div>
          <div className="metric-big">{st.current === null ? '—' : fmtVal(st.current, m)}</div>
          <div className="metric-cap">
            {m.rollup === 'sum' ? 'total so far' : m.rollup === 'month' ? 'this month' : 'latest'}
          </div>
        </div>
        <div className="metric-side">
          {st.baseline !== null && m.kind !== 'yesno' && <div>Start <b>{fmtVal(st.baseline, m)}</b></div>}
          {st.goal !== null
            ? <div>{monthTarget ? 'This month’s goal' : 'Goal'} <b>{fmtVal(st.goal, m)}</b></div>
            : <div>Goal <b>{m.target_label || 'not set'}</b></div>}
          {m.target_date && <div style={overdueGoal ? { color: 'var(--warn)', fontWeight: 700 } : undefined}>By {fmtDate(m.target_date)}</div>}
        </div>
      </div>

      {st.pct !== null && (
        <div className="meter metric-meter"><span style={{ width: `${Math.round(st.pct * 100)}%` }} /></div>
      )}
      {m.target_label && st.goal !== null && <div className="task-meta">{m.target_label}</div>}
      {m.notes && <div className="task-meta">{m.notes}</div>}

      {m.kind === 'yesno' ? (
        <div className="row-actions" style={{ marginTop: '10px' }}>
          {st.current >= 1
            ? <button className="btn sm ghost" onClick={(e) => log(e, 0)}>Undo (mark not done)</button>
            : <button className="btn sm accent" onClick={(e) => log(e, 1)}>Mark done</button>}
          <button className="linkbtn" onClick={() => setShowLog(!showLog)}>{showLog ? 'Hide history' : `History (${st.entries.length})`}</button>
          <button className="linkbtn" onClick={() => (editing ? setEditing(false) : startEdit())}>{editing ? 'Cancel' : 'Edit'}</button>
        </div>
      ) : (
        <form className="metric-log" onSubmit={log}>
          <input type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} placeholder={m.rollup === 'latest' ? 'New number' : 'This week’s number'} aria-label={`Log a number for ${m.name}`} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          <button className="btn sm accent" type="submit" disabled={val === ''}>Log</button>
          <button type="button" className="linkbtn" onClick={() => setShowLog(!showLog)}>{showLog ? 'Hide history' : `History (${st.entries.length})`}</button>
          <button type="button" className="linkbtn" onClick={() => (editing ? setEditing(false) : startEdit())}>{editing ? 'Cancel' : 'Edit'}</button>
        </form>
      )}

      {showLog && (
        <div style={{ marginTop: '8px' }}>
          {st.entries.length ? [...st.entries].reverse().map((e) => (
            <div className="rowline" key={e.id}>
              <span><span className="mono" style={{ color: 'var(--ink-soft)', fontSize: '11.5px' }}>{fmtDate(e.entry_date)}</span> &nbsp;<b>{fmtVal(Number(e.value), m)}</b>{e.note ? <span style={{ color: 'var(--ink-soft)' }}> · {e.note}</span> : null}</span>
              <button className="iconbtn" style={{ width: '24px', height: '24px', fontSize: '11px' }} aria-label="Delete this entry" onClick={() => actions.deleteEntry(e.id)}>&#10005;</button>
            </div>
          )) : <div className="empty" style={{ padding: '8px 0' }}>Nothing logged yet.</div>}
        </div>
      )}

      {editing && f && (
        <div className="mini-form" style={{ marginTop: '10px' }}>
          <div className="field"><label>Name</label><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>How we measure it</label><input type="text" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></div>
          <div className="two-col">
            <div className="field"><label>Start (baseline)</label><input type="number" step="any" value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} /></div>
            <div className="field"><label>Goal</label><input type="number" step="any" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></div>
          </div>
          <div className="two-col">
            <div className="field"><label>Goal wording (optional)</label><input type="text" value={f.target_label} onChange={(e) => setF({ ...f, target_label: e.target.value })} placeholder="e.g. 5 / month" /></div>
            <div className="field"><label>Goal date</label><input type="date" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} /></div>
          </div>
          <div className="two-col">
            <div className="field">
              <label>Counts as</label>
              <select value={f.rollup} onChange={(e) => setF({ ...f, rollup: e.target.value })}>
                <option value="latest">Latest number</option>
                <option value="sum">Running total</option>
                <option value="month">Total for this month</option>
              </select>
            </div>
            <div className="field"><label>Owner</label><input type="text" value={f.owner_label} onChange={(e) => setF({ ...f, owner_label: e.target.value })} /></div>
          </div>
          <div className="field"><label>Notes</label><input type="text" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <div className="row-actions">
            <button className="btn sm accent" onClick={saveEdit}>Save</button>
            <button className="btn sm ghost" onClick={() => { if (window.confirm(`Delete “${m.name}” and everything logged on it?`)) actions.deleteMetric(m.id); }}>Delete metric</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------
export default function Metrics({ metrics, metricEntries, videos, contentItems, tasks, profiles, actions }) {
  const [brand, setBrand] = useState('');
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ name: '', brand: 'NuCoat', unit: '', kind: 'number', rollup: 'latest', target: '', owner_label: '' });

  const shown = metrics.filter((m) => !brand || m.brand === brand);
  const groups = BRANDS.map((b) => ({ brand: b, items: shown.filter((m) => m.brand === b) })).filter((g) => g.items.length);

  async function add(e) {
    e.preventDefault();
    if (!n.name.trim()) return;
    await actions.addMetric({
      name: n.name.trim(), brand: n.brand, unit: n.unit, kind: n.kind, rollup: n.kind === 'yesno' ? 'latest' : n.rollup,
      baseline: n.kind === 'yesno' ? 0 : null, target: n.kind === 'yesno' ? 1 : n.target === '' ? null : Number(n.target),
      owner_label: n.owner_label, position: metrics.length + 1
    });
    setN({ ...n, name: '', target: '' });
    setAdding(false);
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Metrics</h1>
          <p>How the marketing is doing. The top block fills itself in from the app; the goals below are numbers you log, about five minutes on Fridays.</p>
        </div>
        <button className="btn accent sm" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ New metric'}</button>
      </div>

      {adding && (
        <form className="panel" style={{ marginBottom: '16px' }} onSubmit={add}>
          <div className="field"><label>What are you tracking?</label><input type="text" autoFocus value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="e.g. Newsletter sign-ups" /></div>
          <div className="two-col">
            <div className="field"><label>Brand</label><select value={n.brand} onChange={(e) => setN({ ...n, brand: e.target.value })}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</select></div>
            <div className="field"><label>Type</label><select value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })}><option value="number">A number</option><option value="yesno">Done or not done</option></select></div>
          </div>
          {n.kind === 'number' && (
            <div className="two-col">
              <div className="field"><label>Counts as</label><select value={n.rollup} onChange={(e) => setN({ ...n, rollup: e.target.value })}><option value="latest">Latest number</option><option value="sum">Running total</option><option value="month">Total for this month</option></select></div>
              <div className="field"><label>Goal (optional)</label><input type="number" step="any" value={n.target} onChange={(e) => setN({ ...n, target: e.target.value })} /></div>
            </div>
          )}
          <div className="two-col">
            <div className="field"><label>Unit</label><select value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })}><option value="">Plain number</option><option value="%">Percent</option><option value="$">Dollars</option><option value="★">Stars</option></select></div>
            <div className="field"><label>Owner</label><input type="text" value={n.owner_label} onChange={(e) => setN({ ...n, owner_label: e.target.value })} placeholder="e.g. Ali Bea" /></div>
          </div>
          <button className="btn accent sm" type="submit">Add metric</button>
        </form>
      )}

      <AutoPanel videos={videos} contentItems={contentItems} tasks={tasks} profiles={profiles} />

      <div className="filters">
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Both brands</option>
          {BRANDS.map((b) => <option key={b} value={b}>{b} only</option>)}
        </select>
      </div>

      {groups.length ? groups.map((g) => (
        <div key={g.brand} style={{ marginBottom: '20px' }}>
          <h2 className="disp" style={{ fontSize: '20px', margin: '4px 0 10px' }}>{g.brand} goals</h2>
          <div className="metric-grid">
            {g.items.map((m) => <MetricCard key={m.id} m={m} entries={metricEntries} actions={actions} />)}
          </div>
        </div>
      )) : <div className="panel"><div className="empty">No metrics yet. Use “+ New metric”, or run the metrics SQL to load the starter set from the Goals sheet.</div></div>}
    </>
  );
}
