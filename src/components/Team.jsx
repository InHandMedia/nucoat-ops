import React, { useState } from 'react';
import { ROLES, roleLabel, todayISO, fmtDate, daysFromNow } from '../constants.js';
import { effectiveAssignees } from '../people.js';
import { TAB_DEFS, TAB_PRESETS, DEPARTMENTS, roleAllows, tabOn, tabsFor, seenLabel, isOnline, meetingDayISO, meetingTime } from '../workspace.js';
import { toggleIn } from './TaskEditor.jsx';
import { supabase, isDemo } from '../supabaseClient.js';

const ROLE_HELP = {
  owner: 'Sees everything, including hours and billing.',
  editor: 'Edits everything they have a tab for, has a task list, and approves posts and videos. Never sees hours or billing.',
  reviewer: 'Outside viewer. Sees status, scripts and posts, comments, approves. Cannot edit or see tasks.'
};

// Everything the live view needs to know about one person.
function snapshot(p, { tasks, contentItems, videos, projects, meetings, profiles }) {
  const today = todayISO();
  const mine = tasks.filter((t) => !t.done && effectiveAssignees(t, profiles).includes(p.id))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const overdue = mine.filter((t) => t.due_date && t.due_date < today);
  const canApprove = p.role !== 'owner' && p.can_approve !== false;
  const approvals = canApprove
    ? contentItems.filter((c) => c.status === 'in_review' && c.created_by !== p.id).length + videos.filter((v) => v.waiting_on_brady).length
    : 0;
  const drafts = contentItems.filter((c) => c.created_by === p.id && ['draft', 'changes_requested'].includes(c.status)).length;
  const myProjects = projects.filter((x) => (x.member_ids || []).includes(p.id) && x.status !== 'done');
  const next = meetings
    .filter((m) => new Date(m.starts_at).getTime() > Date.now() - 30 * 60000 && ((m.attendee_ids || []).includes(p.id) || m.created_by === p.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const weekAgo = Date.now() - 7 * 86400000;
  const finished = tasks.filter((t) => t.done && t.done_at && new Date(t.done_at).getTime() >= weekAgo && effectiveAssignees(t, profiles).includes(p.id)).length;
  return { mine, overdue, approvals, drafts, myProjects, next, finished };
}

function PersonPeek({ person, snap, projects, customTabs, onClose }) {
  const menu = tabsFor(person, projects, customTabs);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '620px' }}>
        <h2>{person.display_name}</h2>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginBottom: '12px' }}>
          {person.title ? `${person.title} · ` : ''}{roleLabel(person.role)} · {person.department || 'Marketing'} · {seenLabel(person.last_seen_at)}{person.role !== 'owner' && person.can_approve === false ? ' · does not approve' : ''}
        </div>
        <div className="field">
          <label>Their menu right now</label>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{menu.map(([k, label, kind]) => <span key={k} className={`chip ${kind ? 'nucoat' : 'neutral'}`}>{label}</span>)}</div>
        </div>
        <div className="field">
          <label>Open tasks ({snap.mine.length})</label>
          {snap.mine.length ? snap.mine.map((t) => {
            const d = daysFromNow(t.due_date);
            return (
              <div className="rowline" key={t.id}>
                <span style={{ fontSize: '13px' }}>{t.title}</span>
                {t.due_date
                  ? <span className="mono" style={{ fontSize: '11px', color: d < 0 ? 'var(--warn)' : 'var(--ink-soft)', fontWeight: d < 0 ? 700 : 400 }}>{d < 0 && '⚠ '}{fmtDate(t.due_date)}</span>
                  : <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>no date</span>}
              </div>
            );
          }) : <div className="empty">Nothing open.</div>}
        </div>
        {snap.myProjects.length > 0 && (
          <div className="field">
            <label>Projects</label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{snap.myProjects.map((x) => <span key={x.id} className="chip nucoat">{x.name}</span>)}</div>
          </div>
        )}
        <div className="modal-actions"><span /><button className="btn ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function LiveTeam(props) {
  const { profiles, projects, customTabs } = props;
  const [dept, setDept] = useState('');
  const [peek, setPeek] = useState(null);
  const depts = [...new Set(profiles.map((p) => p.department || 'Marketing'))];
  const people = profiles.filter((p) => !dept || (p.department || 'Marketing') === dept);
  const snaps = Object.fromEntries(profiles.map((p) => [p.id, snapshot(p, props)]));
  const peekPerson = peek && profiles.find((p) => p.id === peek);
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>
        Live team view
        <span className="row-actions" style={{ gap: '4px' }}>
          {depts.length > 1 && [['', 'All'], ...depts.map((d) => [d, d])].map(([k, label]) => (
            <button key={k || 'all'} className={`btn sm ${dept === k ? '' : 'ghost'}`} onClick={() => setDept(k)}>{label}</button>
          ))}
        </span>
      </h3>
      <div className="team-grid">
        {people.map((p) => {
          const s = snaps[p.id];
          return (
            <div className="team-card" key={p.id} role="button" tabIndex={0} onClick={() => setPeek(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') setPeek(p.id); }}>
              <div className="team-card-head">
                <span className={`presence ${isOnline(p.last_seen_at) ? 'on' : ''}`} />
                <b>{p.display_name}</b>
                <span className="chip neutral">{p.department || 'Marketing'}</span>
              </div>
              <div className="team-seen">{p.title ? `${p.title} · ` : ''}{seenLabel(p.last_seen_at)}</div>
              <div className="team-stats">
                <div><b>{s.mine.length}</b><span>open tasks</span></div>
                <div className={s.overdue.length ? 'bad' : ''}><b>{s.overdue.length}</b><span>overdue</span></div>
                <div className={s.approvals ? 'warn' : ''}><b>{s.approvals}</b><span>to approve</span></div>
                <div><b>{s.drafts}</b><span>drafts</span></div>
              </div>
              <div className="team-next">
                {s.mine[0] ? <div><span>Next up</span> {s.mine[0].title}{s.mine[0].due_date ? ` · ${fmtDate(s.mine[0].due_date)}` : ''}</div> : <div><span>Next up</span> Nothing open</div>}
                {s.next && <div><span>Meeting</span> {s.next.title} · {fmtDate(meetingDayISO(s.next))} {meetingTime(s.next)}</div>}
                {s.finished > 0 && <div><span>Finished</span> {s.finished} in the last 7 days</div>}
                {s.myProjects.length > 0 && <div><span>Projects</span> {s.myProjects.map((x) => x.name).join(', ')}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '10px' }}>Updates on its own as people work. Click a person to see their task list and menu.</div>
      {peekPerson && <PersonPeek person={peekPerson} snap={snaps[peekPerson.id]} projects={projects} customTabs={customTabs} onClose={() => setPeek(null)} />}
    </div>
  );
}

function TabMatrix({ me, profiles, actions }) {
  const cols = TAB_DEFS.filter((d) => !d.lock);
  const setHidden = (p, hidden) => actions.updateProfile(p.id, { hidden_tabs: hidden });
  const flip = (p, key) => setHidden(p, toggleIn(p.hidden_tabs || [], key));
  // Column header: switch a tab on or off for everyone but you.
  function flipAll(key) {
    const others = profiles.filter((p) => p.id !== me.id && roleAllows(TAB_DEFS.find((d) => d.key === key), p.role));
    const anyOn = others.some((p) => tabOn(p, key));
    others.forEach((p) => {
      const hidden = p.hidden_tabs || [];
      const next = anyOn ? [...new Set([...hidden, key])] : hidden.filter((k) => k !== key);
      if (next.length !== hidden.length) setHidden(p, next);
    });
  }
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Tabs and features</h3>
      <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        Tick what each person should see. <b>Approves</b> decides who gets asked to sign off on posts and videos. Click a column name to switch it on or off for everyone except you. Changes show up on their screen right away.
      </p>
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th>Person</th>
              {cols.map((c) => <th key={c.key}><button className="linkbtn" title={`Switch ${c.label} on or off for everyone but you`} onClick={() => flipAll(c.key)}>{c.label}</button></th>)}
              <th title="Can this person approve posts and videos?">Approves</th>
              <th>Quick setup</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td><b>{p.display_name}</b></td>
                {cols.map((c) => {
                  const allowed = roleAllows(c, p.role);
                  return (
                    <td key={c.key}>
                      {allowed
                        ? <input type="checkbox" aria-label={`${c.label} for ${p.display_name}`} checked={tabOn(p, c.key)} onChange={() => flip(p, c.key)} />
                        : <span title={`${roleLabel(p.role)}s never get this tab`} style={{ color: 'var(--line)' }}>&ndash;</span>}
                    </td>
                  );
                })}
                <td>
                  <input type="checkbox" aria-label={`${p.display_name} approves posts and videos`} disabled={p.role === 'owner'} checked={p.role === 'owner' || p.can_approve !== false} onChange={() => actions.updateProfile(p.id, { can_approve: p.can_approve === false })} />
                </td>
                <td>
                  <select value="" onChange={(e) => { const preset = TAB_PRESETS.find((x) => x.key === e.target.value); if (preset) setHidden(p, preset.hide); }} aria-label={`Quick setup for ${p.display_name}`}>
                    <option value="">Apply…</option>
                    {TAB_PRESETS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--ink-soft)', margin: '10px 0 0' }}>
        Switching a tab off also removes its panels from that person’s dashboard. They can no longer open it in the app. It is a tidy-up, not a vault: Hours, projects and project tasks are the parts locked in the database.
      </p>
    </div>
  );
}

function CustomTabs({ profiles, customTabs, actions }) {
  const blank = { label: '', url: '', mode: 'embed', everyone: false, member_ids: [] };
  const [f, setF] = useState(blank);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Extra tabs</h3>
      <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        Add a tab for any web page and choose who gets it: a sales sheet, a price list, a report, the TikTok seller center.
      </p>
      {customTabs.map((t) => (
        <div className="rowline" key={t.id} style={{ flexWrap: 'wrap' }}>
          <span><b>{t.label}</b> <span style={{ color: 'var(--ink-soft)', fontSize: '12px' }}>{t.mode === 'embed' ? 'shows inside the app' : 'opens in a new window'}</span></span>
          <span style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
            {t.everyone ? <span className="chip nucoat">Everyone</span> : (t.member_ids || []).map((id) => profiles.find((p) => p.id === id)).filter(Boolean).map((p) => <span className="badge assignee" key={p.id}>{p.display_name}</span>)}
            <button className="linkbtn" onClick={() => actions.deleteCustomTab(t.id)}>Remove</button>
          </span>
        </div>
      ))}
      <form
        className="mini-form" style={{ marginTop: '10px' }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.label.trim() || !/^https?:\/\//i.test(f.url.trim())) return;
          await actions.addCustomTab({ ...f, label: f.label.trim(), url: f.url.trim(), position: customTabs.length });
          setF(blank);
        }}
      >
        <div className="two-col">
          <div className="field"><label>Tab name</label><input type="text" value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Sales pipeline" /></div>
          <div className="field"><label>Web address</label><input type="text" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://" /></div>
        </div>
        <div className="field">
          <label>How it opens</label>
          <select value={f.mode} onChange={(e) => set('mode', e.target.value)}>
            <option value="embed">Inside the app (works for Google Sheets, Docs, Canva, most reports)</option>
            <option value="link">In a new window (for sites that refuse to be embedded)</option>
          </select>
        </div>
        <div className="field">
          <label>Who gets it</label>
          <div className="checks">
            <label><input type="checkbox" checked={f.everyone} onChange={(e) => set('everyone', e.target.checked)} /> Everyone</label>
            {!f.everyone && profiles.map((p) => (
              <label key={p.id}><input type="checkbox" checked={f.member_ids.includes(p.id)} onChange={() => set('member_ids', toggleIn(f.member_ids, p.id))} /> {p.display_name}</label>
            ))}
          </div>
        </div>
        <button className="btn sm accent" type="submit" disabled={!f.label.trim() || !/^https?:\/\//i.test(f.url.trim())}>Add tab</button>
      </form>
    </div>
  );
}

function DigestSetup() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function send() {
    if (isDemo) { setMsg('The digest only sends from the live site, not demo mode.'); return; }
    setBusy(true); setMsg('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/digest-now', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
      const out = await res.json();
      setMsg(out.message || 'Done.');
    } catch {
      setMsg('Could not reach the digest. Has the site been redeployed since this was added?');
    }
    setBusy(false);
  }
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Weekly digest email</h3>
      <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        Every Monday morning you get one email: what is overdue or stuck, the week ahead (meetings, posts, due dates), each person’s load, project progress, what got finished, and last week’s retainer hours. It only goes to you.
      </p>
      <div className="row-actions">
        <button className="btn sm accent" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send me this week’s digest now'}</button>
        {msg && <span style={{ fontSize: '12.5px' }}>{msg}</span>}
      </div>
    </div>
  );
}

function WidgetSetup() {
  const [address, setAddress] = useState('');
  const [copied, setCopied] = useState(false);
  async function load(reset) {
    const { data, error } = await supabase.rpc('my_feed_token', { p_reset: !!reset });
    if (error || !data) { setAddress('error'); return; }
    setAddress(`${window.location.origin.replace(/^https?:/, 'webcal:')}/.netlify/functions/feed?token=${data}`);
    setCopied(false);
  }
  const mini = `${window.location.origin}/?mini${isDemo ? '&demo' : ''}`;
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>On your Mac</h3>
      <div className="grid2">
        <div>
          <b style={{ fontSize: '13.5px' }}>Calendar widget</b>
          <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '4px 0 8px' }}>
            Your open tasks and meetings as a private calendar. Subscribe once in Apple Calendar, then add the Calendar widget to your desktop.
          </p>
          {!address && <button className="btn sm accent" onClick={() => load(false)}>Get my calendar address</button>}
          {address === 'error' && <div className="empty">Could not create the address. Run migration_07 first.</div>}
          {address && address !== 'error' && (
            <>
              <input type="text" readOnly value={address} onFocus={(e) => e.target.select()} style={{ width: '100%', fontSize: '12px' }} />
              <div className="row-actions" style={{ marginTop: '8px' }}>
                <a className="btn sm accent" href={address}>Subscribe in Calendar</a>
                <button className="btn sm ghost" onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy'}</button>
                <button className="btn sm ghost" title="Makes a new address and switches the old one off" onClick={() => load(true)}>Reset</button>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '6px' }}>Keep this address to yourself. Anyone who has it can read your task list.</div>
            </>
          )}
        </div>
        <div>
          <b style={{ fontSize: '13.5px' }}>Mini window</b>
          <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '4px 0 8px' }}>
            A small always-live list of your open tasks and today’s meetings. Open it in Safari, then choose File, Add to Dock.
          </p>
          <a className="btn sm ghost" href={mini} target="_blank" rel="noopener noreferrer">Open the mini window</a>
        </div>
      </div>
    </div>
  );
}

export default function Team(props) {
  const { me, profiles, actions, customTabs, upgraded } = props;
  if (!upgraded) {
    return (
      <>
        <div className="section-head"><div><h1>Team</h1><p>One step left before the new team tools switch on.</p></div></div>
        <div className="panel">
          <h3>Run the database upgrade</h3>
          <p style={{ fontSize: '13.5px', lineHeight: 1.6 }}>
            In Supabase, open <b>SQL Editor</b>, start a <b>New query</b>, paste all of <code>supabase/migration_07_workspace.sql</code>, and click <b>Run</b>. Then refresh this page.
            The live team view, tab switches, projects, meetings and the Mac widget all appear after that.
          </p>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Team</h1>
          <p>See what everyone is working on, and choose what each person sees.</p>
        </div>
      </div>

      <LiveTeam {...props} />
      <TabMatrix me={me} profiles={profiles} actions={actions} />

      <div className="panel" style={{ marginBottom: '16px' }}>
        <h3>People</h3>
        {profiles.map((p) => (
          <div className="rowline" key={p.id} style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <input
                type="text" defaultValue={p.display_name} style={{ fontWeight: 700, width: '100%', maxWidth: '240px' }} aria-label="Name"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.display_name) actions.updateProfile(p.id, { display_name: v }); }}
              />
              <div style={{ color: 'var(--ink-soft)', fontSize: '12px', marginTop: '4px' }}>{ROLE_HELP[p.role]}</div>
            </div>
            <input
              type="text" defaultValue={p.title || ''} placeholder="Job title" aria-label={`Job title for ${p.display_name}`} style={{ width: '170px' }}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.title || '')) actions.updateProfile(p.id, { title: v }); }}
            />
            <input
              type="email" defaultValue={p.email || ''} placeholder="Email for invites" aria-label={`Email for ${p.display_name}`} style={{ width: '210px' }}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.email || '')) actions.updateProfile(p.id, { email: v }); }}
            />
            <select value={p.department || 'Marketing'} onChange={(e) => actions.updateProfile(p.id, { department: e.target.value })} aria-label={`Team for ${p.display_name}`}>
              {[...new Set([...DEPARTMENTS, p.department || 'Marketing'])].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={p.role} disabled={p.id === me.id} onChange={(e) => actions.updateProfile(p.id, { role: e.target.value })} title={p.id === me.id ? 'You cannot change your own role' : ''} aria-label={`Role for ${p.display_name}`}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      <CustomTabs profiles={profiles} customTabs={customTabs} actions={actions} />
      <DigestSetup />
      <WidgetSetup />

      <div className="panel">
        <h3>Adding someone new</h3>
        <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.7, fontSize: '13.5px' }}>
          <li>In Supabase, open <b>Authentication, then Users, then Add user</b>, and create their login.</li>
          <li>They appear here as an <b>Editor</b> with Series switched off. Set their team, then use <b>Quick setup</b> above (Marketing, Sales, or Projects only).</li>
          <li>Add them to any projects from the <b>Projects</b> tab. A project tab appears in their menu on its own.</li>
        </ol>
      </div>
    </>
  );
}
