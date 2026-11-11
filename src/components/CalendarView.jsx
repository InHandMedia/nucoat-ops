import React, { useState } from 'react';
import { moveContent, canMoveContent } from './Content.jsx';
import { MeetingModal } from './Meetings.jsx';
import { meetingDayISO, meetingTime } from '../workspace.js';
import { isStaff, todayISO, fmtDateLong, pad, OPEN_REQUEST_STATUSES, channelInfo, isContentDone } from '../constants.js';

const EVENT_TYPES = {
  shoot: { label: 'Shoot', bg: '#DDF2F4', fg: '#0A5C64', dot: '#0E7C86' },
  due: { label: 'Due', bg: '#FBEEDD', fg: '#8A4C08', dot: '#C9711B' },
  request: { label: 'Request needed by', bg: '#EFE7FB', fg: '#5A3399', dot: '#7B4FC9' },
  post: { label: 'Post / email', bg: '#E3ECFB', fg: '#1F4FA8', dot: '#2F6FDB' },
  meeting: { label: 'Meeting', bg: '#E6F6EC', fg: '#14663F', dot: '#1F8A5F' },
  task: { label: 'My task due', bg: '#F2F4F8', fg: '#3A4150', dot: '#5B6472' }
};

export default function CalendarView({ me, role, videos, requests, contentItems = [], meetings = [], tasks = [], profiles = [], projects = [], shows = {}, upgraded, actions, openVideo, goTab }) {
  const staff = isStaff(role);
  const [off, setOff] = useState([]); // event types switched off in the legend
  const [meeting, setMeeting] = useState(null); // null | { day } (new) | meeting row
  const types = Object.keys(EVENT_TYPES).filter((k) => {
    if (k === 'shoot' || k === 'due') return shows.series;
    if (k === 'post') return shows.content;
    if (k === 'request') return shows.requests;
    if (k === 'meeting') return upgraded;
    return staff;
  });
  const on = (k) => types.includes(k) && !off.includes(k);
  const [dropIso, setDropIso] = useState(null);
  const green = !!me?.show_done_green;
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dayModal, setDayModal] = useState(null);

  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, out: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, out: false, iso: `${y}-${pad(m + 1)}-${pad(d)}` });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length, out: true });

  // Build every event once, keyed by date.
  const events = {};
  const push = (iso, ev) => { if (iso && on(ev.type)) (events[iso] = events[iso] || []).push(ev); };
  videos.forEach((v) => {
    const label = `#${String(v.number).padStart(2, '0')} ${v.title}`;
    const vdone = v.stage === 'delivered';
    push(v.shoot_date, { type: 'shoot', label, brand: v.brand, videoId: v.id, key: `s-${v.id}`, done: vdone });
    push(v.due_date, { type: 'due', label, brand: v.brand, videoId: v.id, key: `d-${v.id}`, done: vdone });
  });
  // Posted posts and finished requests only appear when "Green" is on, so the default view is unchanged.
  contentItems.filter((c) => green || c.status !== 'posted').forEach((c) => {
    push(c.publish_date, { type: 'post', label: `${channelInfo(c.channel).label}: ${c.title}`, brand: c.brand, contentId: c.id, key: `c-${c.id}`, done: isContentDone(c.status), item: c });
  });
  requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status) || (green && r.status === 'done')).forEach((r) => {
    push(r.due_date, { type: 'request', label: r.title, requestId: r.id, key: `r-${r.id}`, done: r.status === 'done' });
  });

  meetings.forEach((m) => {
    push(meetingDayISO(m), { type: 'meeting', label: `${meetingTime(m)} ${m.title}`, meeting: m, key: `m-${m.id}`, done: false, sort: m.starts_at });
  });
  tasks.filter((t) => t.due_date && (t.assigned_to || []).includes(me.id) && (green || !t.done)).forEach((t) => {
    push(t.due_date, { type: 'task', label: t.title, taskId: t.id, key: `t-${t.id}`, done: t.done });
  });
  // Meetings first, in time order, so the day reads top to bottom.
  Object.values(events).forEach((list) => list.sort((a, b) => (b.type === 'meeting') - (a.type === 'meeting') || (a.sort || '').localeCompare(b.sort || '')));

  const todayIso = todayISO();
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function openEvent(ev) {
    setDayModal(null);
    if (ev.meeting) { if (staff) setMeeting(ev.meeting); else if (ev.meeting.join_link) window.open(ev.meeting.join_link, '_blank', 'noopener'); }
    else if (ev.videoId) openVideo(ev.videoId); else if (ev.contentId) goTab('content'); else if (ev.taskId) goTab('tasks'); else goTab('requests');
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Calendar</h1>
          <p>Meetings, posts and emails, deadlines and your task due dates. Click a day for details{staff && upgraded ? ' or to add a meeting' : ''}.{staff && shows.content ? ' Drag a post or email onto another day to move it.' : ''}</p>
        </div>
        {staff && upgraded && <button className="btn accent" onClick={() => setMeeting({ day: todayISO() })}>+ Meeting</button>}
      </div>
      <div className="cal-legend">
        {types.map((k) => (
          <button
            type="button" className={`cal-legend-item cal-filter ${off.includes(k) ? 'off' : ''}`} key={k} aria-pressed={!off.includes(k)}
            title="Click to show or hide" onClick={() => setOff(off.includes(k) ? off.filter((x) => x !== k) : [...off, k])}
          ><span className="cal-legend-dot" style={{ background: EVENT_TYPES[k].dot }} />{EVENT_TYPES[k].label}</button>
        ))}
        {(shows.series || shows.content) && <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: 'linear-gradient(90deg,#E0457B,#3E8EDE)' }} />NuFun (tinted)</span>}
        {green && <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: '#1F8A5F' }} />Done: approved, scheduled, posted</span>}
      </div>
      <div className="cal">
        <div className="cal-head">
          <button className="iconbtn" onClick={() => setMonth(new Date(y, m - 1, 1))}>&larr;</button>
          <h2 className="disp" style={{ margin: 0, fontSize: '19px' }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <button className="iconbtn" onClick={() => setMonth(new Date(y, m + 1, 1))}>&rarr;</button>
        </div>
        <div className="cal-grid">
          {dow.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
          {cells.map((c, i) => {
            if (c.out) return <div className="cal-day out" key={i}><span className="dnum">{c.day}</span></div>;
            const items = events[c.iso] || [];
            return (
              <div
                className={`cal-day ${c.iso === todayIso ? 'today' : ''} ${dropIso === c.iso ? 'dropping' : ''}`} key={i} onClick={() => setDayModal(c.iso)}
                onDragOver={staff ? (e) => { e.preventDefault(); if (dropIso !== c.iso) setDropIso(c.iso); } : undefined}
                onDragLeave={staff ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropIso(null); } : undefined}
                onDrop={staff ? (e) => {
                  e.preventDefault(); setDropIso(null);
                  const item = contentItems.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                  if (item && canMoveContent(item, staff)) moveContent(item, c.iso, actions);
                } : undefined}
              >
                <span className="dnum">{c.day}</span>
                {items.slice(0, 3).map((ev) => {
                  const t = EVENT_TYPES[ev.type];
                  return (
                    <span
                      key={ev.key} className={`cal-chip ev ${ev.brand === 'NuFun' ? 'brand-nufun' : ''} ${ev.item && canMoveContent(ev.item, staff) ? 'movable' : ''}`} data-done={ev.done ? 'true' : 'false'}
                      draggable={!!(ev.item && canMoveContent(ev.item, staff))}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', ev.contentId); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => setDropIso(null)}
                      style={{ background: ev.brand === 'NuFun' ? undefined : t.bg, color: t.fg, borderLeft: `3px solid ${t.dot}` }}
                    >{green && ev.done ? '✓ ' : ''}{ev.label}</span>
                  );
                })}
                {items.length > 3 && <span className="cal-more">+{items.length - 3} more</span>}
              </div>
            );
          })}
        </div>
      </div>

      {dayModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDayModal(null)}>
          <div className="modal">
            <h2>{fmtDateLong(dayModal)}</h2>
            {(events[dayModal] || []).length ? events[dayModal].map((ev) => (
              <div className="rowline" data-done={ev.done ? 'true' : 'false'} style={{ cursor: 'pointer' }} key={ev.key} onClick={() => openEvent(ev)}>
                <span>{green && ev.done ? '✓ ' : ''}{ev.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {ev.item && canMoveContent(ev.item, staff) && (
                    <input
                      type="date" value={ev.item.publish_date} aria-label="Move to another day" title="Move to another day"
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => { if (await moveContent(ev.item, e.target.value, actions)) setDayModal(null); }}
                      style={{ padding: '3px 6px', fontSize: '12px', width: '132px' }}
                    />
                  )}
                  <span className="chip" style={{ background: EVENT_TYPES[ev.type].bg, color: EVENT_TYPES[ev.type].fg }}>{EVENT_TYPES[ev.type].label}</span>
                </span>
              </div>
            )) : <div className="empty">Nothing on this day.</div>}
            <div className="modal-actions">
              {staff && upgraded ? <button className="btn accent" onClick={() => { setMeeting({ day: dayModal }); setDayModal(null); }}>+ Meeting this day</button> : <span />}
              <button className="btn ghost" onClick={() => setDayModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {meeting && <MeetingModal initial={meeting} me={me} profiles={profiles} projects={projects} actions={actions} onClose={() => setMeeting(null)} />}
    </>
  );
}
