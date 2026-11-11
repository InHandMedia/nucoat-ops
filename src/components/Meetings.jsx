import React, { useState } from 'react';
import { isStaff, fmtDate } from '../constants.js';
import { toggleIn } from './TaskEditor.jsx';
import { meetingDayISO, meetingTime, localInputValue, teamsLink, mailtoLink, downloadICS, meetingEmails } from '../workspace.js';

// The three ways to get a meeting onto people's calendars.
export function InviteButtons({ meeting, profiles }) {
  const emails = meetingEmails(meeting, profiles);
  return (
    <div>
      <div className="row-actions">
        <a className="btn sm accent" href={teamsLink(meeting, profiles)} target="_blank" rel="noopener noreferrer">Send Teams invite</a>
        <a className="btn sm ghost" href={mailtoLink(meeting, profiles)}>Email invite</a>
        <button className="btn sm ghost" type="button" onClick={() => downloadICS(meeting, profiles)}>Calendar file</button>
        {meeting.join_link && <a className="filelink" href={meeting.join_link} target="_blank" rel="noopener noreferrer">Join</a>}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '6px' }}>
        {emails.length
          ? `Goes to: ${emails.join(', ')}`
          : 'No email addresses yet. Add each person’s email on the Team tab, or type addresses under “Also invite”.'}
      </div>
    </div>
  );
}

// Add or edit one meeting. `initial` may carry just a date (from clicking a calendar day).
export function MeetingModal({ initial, me, profiles, projects = [], actions, onClose }) {
  const editing = !!initial?.id;
  const [f, setF] = useState(() => ({
    title: initial?.title || '',
    when: initial?.starts_at ? localInputValue(initial.starts_at) : `${initial?.day || localInputValue().slice(0, 10)}T10:00`,
    duration_min: initial?.duration_min || 30,
    attendee_ids: initial?.attendee_ids || [me.id],
    extra_emails: initial?.extra_emails || '',
    join_link: initial?.join_link || '',
    notes: initial?.notes || '',
    project_id: initial?.project_id || ''
  }));
  const [saved, setSaved] = useState(editing ? initial : null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  function toRow() {
    return {
      title: f.title.trim(), starts_at: new Date(f.when).toISOString(), duration_min: Number(f.duration_min) || 30,
      attendee_ids: f.attendee_ids, extra_emails: f.extra_emails.trim(), join_link: f.join_link.trim(),
      notes: f.notes, project_id: f.project_id || null
    };
  }
  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim() || !f.when) return;
    const row = toRow();
    if (saved?.id) {
      const res = await actions.saveMeeting(saved.id, row);
      if (!res?.error) setSaved({ ...saved, ...row });
    } else {
      const made = await actions.addMeeting(row);
      if (made) setSaved(made);
    }
  }
  const people = profiles.filter((p) => p.role !== 'reviewer' || f.attendee_ids.includes(p.id));

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{editing ? 'Meeting' : 'New meeting'}</h2>
        <div className="field"><label>What is it about</label><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. TikTok Shop kickoff" autoFocus={!editing} /></div>
        <div className="two-col">
          <div className="field"><label>When (your time)</label><input type="datetime-local" value={f.when} onChange={(e) => set('when', e.target.value)} /></div>
          <div className="field">
            <label>Length</label>
            <select value={f.duration_min} onChange={(e) => set('duration_min', e.target.value)}>
              {[15, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} minutes</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Who</label>
          <div className="checks">
            {people.map((p) => (
              <label key={p.id}><input type="checkbox" checked={f.attendee_ids.includes(p.id)} onChange={() => set('attendee_ids', toggleIn(f.attendee_ids, p.id))} /> {p.display_name}</label>
            ))}
          </div>
        </div>
        <div className="field"><label>Also invite (emails, comma separated)</label><input type="text" value={f.extra_emails} onChange={(e) => set('extra_emails', e.target.value)} placeholder="taylor@example.com, halle@example.com" /></div>
        {projects.length > 0 && (
          <div className="field">
            <label>Project</label>
            <select value={f.project_id} onChange={(e) => set('project_id', e.target.value)}>
              <option value="">Not tied to a project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="field"><label>Agenda / notes</label><textarea rows="3" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        <div className="field"><label>Join link (paste the Teams link here once it exists)</label><input type="text" value={f.join_link} onChange={(e) => set('join_link', e.target.value)} placeholder="https://teams.microsoft.com/..." /></div>

        {saved && (
          <div className="mini-form" style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-soft)', marginBottom: '8px' }}>Saved. Now send the invite</div>
            <InviteButtons meeting={{ ...saved, ...toRow() }} profiles={profiles} />
          </div>
        )}

        <div className="modal-actions">
          <div className="row-actions">
            <button className="btn accent" type="submit">{saved ? 'Save changes' : 'Save meeting'}</button>
            {saved?.id && <button className="btn ghost" type="button" onClick={async () => { await actions.deleteMeeting(saved.id); onClose(); }}>Delete</button>}
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>Close</button>
        </div>
      </form>
    </div>
  );
}

// Dashboard / project panel: what is coming up.
export function MeetingsPanel({ me, role, meetings, profiles, projects, actions, projectId = null, title = 'Upcoming meetings' }) {
  const [open, setOpen] = useState(null); // null | {} (new) | meeting
  const now = Date.now() - 60 * 60000;
  const mine = meetings
    .filter((m) => new Date(m.starts_at).getTime() >= now)
    .filter((m) => (projectId ? m.project_id === projectId : (m.attendee_ids || []).includes(me.id) || m.created_by === me.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const staff = isStaff(role);
  return (
    <div className="panel">
      <h3>{title} {staff && <button className="linkbtn" onClick={() => setOpen(projectId ? { project_id: projectId } : {})}>+ Meeting</button>}</h3>
      {mine.length ? mine.slice(0, 6).map((m) => (
        <div className="rowline" key={m.id} style={{ cursor: staff ? 'pointer' : 'default' }} onClick={() => staff && setOpen(m)}>
          <span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{fmtDate(meetingDayISO(m))} {meetingTime(m)}</span> {m.title}
          </span>
          {m.join_link
            ? <a className="chip ok" href={m.join_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Join</a>
            : <span className="chip neutral">{m.duration_min} min</span>}
        </div>
      )) : <div className="empty">No meetings coming up.</div>}
      {open && <MeetingModal initial={open} me={me} profiles={profiles} projects={projects} actions={actions} onClose={() => setOpen(null)} />}
    </div>
  );
}
