import React from 'react';
import { todayISO, fmtDate, daysFromNow } from '../constants.js';
import { effectiveAssignees } from '../people.js';
import { meetingDayISO, meetingTime } from '../workspace.js';

// The small "widget" window (address ends in ?mini). Add it to the Dock from Safari
// and it sits on the desktop showing open tasks and today's meetings, live.
export default function Mini({ me, tasks, meetings, profiles, contentItems, actions }) {
  const today = todayISO();
  const mine = tasks.filter((t) => !t.done && effectiveAssignees(t, profiles).includes(me.id))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const overdue = mine.filter((t) => t.due_date && t.due_date < today).length;
  const todays = meetings
    .filter((m) => meetingDayISO(m) === today && ((m.attendee_ids || []).includes(me.id) || m.created_by === me.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const toApprove = contentItems.filter((c) => c.status === 'in_review' && c.created_by !== me.id).length;
  const full = window.location.href.replace(/[?&]mini\b/, '').replace(/\?$/, '');
  return (
    <div className="mini">
      <div className="mini-head">
        <img src="/nucoat-logo.png" alt="NuCoat" />
        <a href={full} target="_blank" rel="noopener noreferrer">Open Ops &rarr;</a>
      </div>
      <div className="mini-count">
        <b>{mine.length}</b> open task{mine.length === 1 ? '' : 's'}
        {overdue > 0 && <span className="chip bad">{overdue} overdue</span>}
        {toApprove > 0 && <span className="chip wait">{toApprove} to approve</span>}
      </div>
      {todays.length > 0 && (
        <div className="mini-block">
          <div className="mini-label">Today</div>
          {todays.map((m) => (
            <div className="mini-row" key={m.id}>
              <span className="mono">{meetingTime(m)}</span>
              <span>{m.title}</span>
              {m.join_link && <a href={m.join_link} target="_blank" rel="noopener noreferrer">Join</a>}
            </div>
          ))}
        </div>
      )}
      <div className="mini-block">
        <div className="mini-label">Tasks</div>
        {mine.length ? mine.map((t) => {
          const d = daysFromNow(t.due_date);
          return (
            <label className="mini-row" key={t.id}>
              <input type="checkbox" checked={false} onChange={() => actions.toggleTask(t.id, true)} />
              <span>{t.title}</span>
              {t.due_date && <span className="mono" style={{ color: d < 0 ? 'var(--warn)' : 'var(--ink-soft)', fontWeight: d < 0 ? 700 : 400 }}>{fmtDate(t.due_date)}</span>}
            </label>
          );
        }) : <div className="empty">All clear.</div>}
      </div>
    </div>
  );
}
