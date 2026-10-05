import React, { useState } from 'react';
import { todayISO, fmtDateLong, pad, OPEN_REQUEST_STATUSES, channelInfo } from '../constants.js';

const EVENT_TYPES = {
  shoot: { label: 'Shoot', bg: '#DDF2F4', fg: '#0A5C64', dot: '#0E7C86' },
  due: { label: 'Due', bg: '#FBEEDD', fg: '#8A4C08', dot: '#C9711B' },
  request: { label: 'Request needed by', bg: '#EFE7FB', fg: '#5A3399', dot: '#7B4FC9' },
  post: { label: 'Post / email', bg: '#E3ECFB', fg: '#1F4FA8', dot: '#2F6FDB' }
};

export default function CalendarView({ videos, requests, contentItems = [], openVideo, goTab }) {
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
  const push = (iso, ev) => { if (iso) (events[iso] = events[iso] || []).push(ev); };
  videos.forEach((v) => {
    const label = `#${String(v.number).padStart(2, '0')} ${v.title}`;
    push(v.shoot_date, { type: 'shoot', label, brand: v.brand, videoId: v.id, key: `s-${v.id}` });
    push(v.due_date, { type: 'due', label, brand: v.brand, videoId: v.id, key: `d-${v.id}` });
  });
  contentItems.filter((c) => c.status !== 'posted').forEach((c) => {
    push(c.publish_date, { type: 'post', label: `${channelInfo(c.channel).label}: ${c.title}`, brand: c.brand, contentId: c.id, key: `c-${c.id}` });
  });
  requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status)).forEach((r) => {
    push(r.due_date, { type: 'request', label: r.title, requestId: r.id, key: `r-${r.id}` });
  });

  const todayIso = todayISO();
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function openEvent(ev) {
    setDayModal(null);
    if (ev.videoId) openVideo(ev.videoId); else if (ev.contentId) goTab('content'); else goTab('requests');
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Calendar</h1>
          <p>Shoots, due dates, posts and emails, and request deadlines. Click a day for details.</p>
        </div>
      </div>
      <div className="cal-legend">
        {Object.values(EVENT_TYPES).map((t) => (
          <span className="cal-legend-item" key={t.label}><span className="cal-legend-dot" style={{ background: t.dot }} />{t.label}</span>
        ))}
        <span className="cal-legend-item"><span className="cal-legend-dot" style={{ background: 'linear-gradient(90deg,#E0457B,#3E8EDE)' }} />NuFun (tinted)</span>
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
              <div className={`cal-day ${c.iso === todayIso ? 'today' : ''}`} key={i} onClick={() => setDayModal(c.iso)}>
                <span className="dnum">{c.day}</span>
                {items.slice(0, 3).map((ev) => {
                  const t = EVENT_TYPES[ev.type];
                  return (
                    <span
                      key={ev.key} className={`cal-chip ev ${ev.brand === 'NuFun' ? 'brand-nufun' : ''}`}
                      style={{ background: ev.brand === 'NuFun' ? undefined : t.bg, color: t.fg, borderLeft: `3px solid ${t.dot}` }}
                    >{ev.label}</span>
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
              <div className="rowline" style={{ cursor: 'pointer' }} key={ev.key} onClick={() => openEvent(ev)}>
                <span>{ev.label}</span>
                <span className="chip" style={{ background: EVENT_TYPES[ev.type].bg, color: EVENT_TYPES[ev.type].fg }}>{EVENT_TYPES[ev.type].label}</span>
              </div>
            )) : <div className="empty">Nothing on this day.</div>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDayModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
