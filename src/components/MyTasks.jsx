import React, { useState } from 'react';
import { todayISO, addDays, fmtDate } from '../constants.js';
import { People, NumChip } from './Badges.jsx';

function toggleIn(list, x) {
  return list.includes(x) ? list.filter((i) => i !== x) : [...list, x];
}

export default function MyTasks({ me, tasks, videos, profiles, actions, openVideo }) {
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('me'); // 'me' | 'all' | a person id
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState('');
  const [videoId, setVideoId] = useState('');
  const [assignees, setAssignees] = useState([me.id]);
  const [due, setDue] = useState('');
  const [otherOwner, setOtherOwner] = useState('');
  const today = todayISO();
  const weekEnd = addDays(today, 7);
  const staffPeople = profiles.filter((p) => p.role !== 'reviewer');
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const videoMap = Object.fromEntries(videos.map((v) => [v.id, v]));

  const scoped = tasks.filter((t) => {
    if (category && t.category !== category) return false;
    if (scope === 'all') return true;
    if (scope === 'unassigned') return !(t.assigned_to || []).length;
    const who = scope === 'me' ? me.id : scope;
    return (t.assigned_to || []).includes(who);
  });
  const categories = [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort();
  const open = scoped.filter((t) => !t.done).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const done = scoped.filter((t) => t.done);
  const groups = [
    { key: 'overdue', label: 'Overdue', items: open.filter((t) => t.due_date && t.due_date < today) },
    { key: 'soon', label: 'Next 7 days', items: open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd) },
    { key: 'later', label: 'Later or no date', items: open.filter((t) => !t.due_date || t.due_date > weekEnd) }
  ];

  function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    actions.addTask({ title: title.trim(), video_id: videoId || null, assigned_to: assignees, owner_label: otherOwner.trim(), due_date: due || null });
    setTitle(''); setDue(''); setVideoId(''); setOtherOwner('');
  }

  function Row({ t }) {
    const v = videoMap[t.video_id];
    const overdue = !t.done && t.due_date && t.due_date < today;
    const hasPerson = (t.assigned_to || []).some((id) => profileMap[id]);
    return (
      <div className={`checkitem ${t.done ? 'done' : ''}`} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={t.done} onChange={(e) => actions.toggleTask(t.id, e.target.checked)} style={{ marginTop: '3px' }} />
        <span style={{ flex: 1, minWidth: '140px' }}>
          {t.title}
          {t.notes && <div className="task-meta">{t.notes}</div>}
        </span>
        {t.category && <span className="chip task-cat">{t.category}</span>}
        {v && <span style={{ cursor: 'pointer' }} onClick={() => openVideo(v.id)}><NumChip number={v.number} /></span>}
        <People ids={t.assigned_to} profileMap={profileMap} />
        {!hasPerson && t.owner_label && <span className="badge assignee">{t.owner_label}</span>}
        {t.due_date && <span className="mono" style={{ fontSize: '11px', color: overdue ? 'var(--warn)' : 'var(--ink-soft)', fontWeight: overdue ? 700 : 400 }}>{overdue && '⚠ '}{fmtDate(t.due_date)}</span>}
        <button className="iconbtn" style={{ width: '24px', height: '24px', fontSize: '11px' }} onClick={() => actions.deleteTask(t.id)}>&#10005;</button>
      </div>
    );
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Tasks</h1>
          <p>The team to-do list, including everything imported from the marketing sheets. Assign a task to one person or several.</p>
        </div>
      </div>

      <form className="panel" style={{ marginBottom: '14px' }} onSubmit={add}>
        <div className="field">
          <label>New task</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Record voiceover for the PPE video" />
        </div>
        <div className="two-col">
          <div className="field">
            <label>Video (optional)</label>
            <select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
              <option value="">Not tied to a video</option>
              {videos.map((v) => <option key={v.id} value={v.id}>#{String(v.number).padStart(2, '0')} {v.title}</option>)}
            </select>
          </div>
          <div className="field"><label>Due date</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Other owner (someone who is not in the app, optional)</label>
          <input type="text" value={otherOwner} onChange={(e) => setOtherOwner(e.target.value)} placeholder="e.g. Alex, Jake, Heather" />
        </div>
        <div className="field">
          <label>Assign to</label>
          <div className="checks">
            {staffPeople.map((p) => (
              <label key={p.id}><input type="checkbox" checked={assignees.includes(p.id)} onChange={() => setAssignees(toggleIn(assignees, p.id))} /> {p.display_name}</label>
            ))}
          </div>
        </div>
        <button className="btn accent sm" type="submit">+ Add task</button>
      </form>

      <div className="filters">
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="me">Assigned to me</option>
          <option value="all">Everyone</option>
          <option value="unassigned">Owned by someone outside the app</option>
          {staffPeople.filter((p) => p.id !== me.id).map((p) => <option key={p.id} value={p.id}>{p.display_name}’s tasks</option>)}
        </select>
        {categories.length > 0 && (
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed ({done.length})</label>
      </div>

      <div className="stack">
        {groups.map((g) => g.items.length > 0 && (
          <div className="panel" key={g.key}>
            <h3 style={g.key === 'overdue' ? { color: 'var(--warn)' } : undefined}>{g.label} <span className="mono" style={{ fontSize: '11px' }}>{g.items.length}</span></h3>
            {g.items.map((t) => <Row key={t.id} t={t} />)}
          </div>
        ))}
        {!open.length && <div className="panel"><div className="empty">Nothing open here.</div></div>}
        {showDone && done.length > 0 && (
          <div className="panel"><h3>Completed</h3>{done.map((t) => <Row key={t.id} t={t} />)}</div>
        )}
      </div>
    </>
  );
}
