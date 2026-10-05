import React, { useState } from 'react';
import {
  REQUEST_KINDS, REQUEST_STATUSES, OPEN_REQUEST_STATUSES, isOwner,
  requestKindLabel, requestStatusLabel, fmtDate, todayISO, hrs
} from '../constants.js';

const STATUS_STYLE = {
  submitted: 'chip wait',
  accepted: 'chip nucoat',
  in_progress: 'chip nucoat',
  done: 'chip ok',
  declined: 'chip bad'
};

function OwnerControls({ r, estimate, logged, actions }) {
  const [hours, setHours] = useState(estimate ?? '');
  const [reason, setReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logNote, setLogNote] = useState('');

  return (
    <div className="mini-form" style={{ marginTop: '10px' }}>
      {r.status === 'submitted' && !declining && (
        <div className="row-actions">
          <input type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hour estimate" style={{ width: '130px' }} />
          <button
            className="btn sm accent" disabled={hours === '' || Number(hours) <= 0}
            onClick={async () => { await actions.setEstimate(r.id, Number(hours)); await actions.updateRequest(r.id, { status: 'accepted' }); }}
          >Accept</button>
          <button className="btn sm ghost" onClick={() => setDeclining(true)}>Decline</button>
        </div>
      )}
      {r.status === 'submitted' && declining && (
        <div className="row-actions">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the requester)" style={{ flex: 1, minWidth: '180px' }} />
          <button className="btn sm accent" onClick={() => actions.updateRequest(r.id, { status: 'declined', decline_reason: reason })}>Confirm decline</button>
          <button className="btn sm ghost" onClick={() => setDeclining(false)}>Back</button>
        </div>
      )}
      {(r.status === 'accepted' || r.status === 'in_progress') && (
        <>
          <div className="row-actions" style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '12.5px' }}>Estimate <b>{hrs(estimate)}</b> · Logged <b>{hrs(logged)}</b></span>
            {r.status === 'accepted' && <button className="btn sm ghost" onClick={() => actions.updateRequest(r.id, { status: 'in_progress' })}>Start</button>}
            <button className="btn sm accent" onClick={() => actions.updateRequest(r.id, { status: 'done' })}>Mark done</button>
          </div>
          <div className="row-actions">
            <input type="number" min="0" step="0.25" value={logHours} onChange={(e) => setLogHours(e.target.value)} placeholder="Hours" style={{ width: '90px' }} />
            <input type="text" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="What you did" style={{ flex: 1, minWidth: '140px' }} />
            <button
              className="btn sm ghost" disabled={!(Number(logHours) > 0)}
              onClick={async () => {
                await actions.addTime({ entry_date: todayISO(), hours: Number(logHours), kind: 'request', request_id: r.id, note: logNote });
                setLogHours(''); setLogNote('');
              }}
            >+ Log time</button>
          </div>
        </>
      )}
      {r.status === 'done' && (
        <div className="row-actions">
          <span style={{ fontSize: '12.5px' }}>Estimate <b>{hrs(estimate)}</b> · Logged <b>{hrs(logged)}</b></span>
          <button className="btn sm ghost" onClick={() => actions.updateRequest(r.id, { status: 'in_progress' })}>Reopen</button>
        </div>
      )}
      {r.status === 'declined' && (
        <div className="row-actions">
          <span style={{ fontSize: '12.5px' }}>Declined{r.decline_reason ? `: ${r.decline_reason}` : ''}</span>
          <button className="btn sm ghost" onClick={() => actions.updateRequest(r.id, { status: 'submitted', decline_reason: '' })}>Reconsider</button>
        </div>
      )}
    </div>
  );
}

export default function Requests({ role, me, requests, profiles, videos, estimates, timeEntries, actions }) {
  const owner = isOwner(role);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [kind, setKind] = useState('graphic_design');
  const [due, setDue] = useState('');
  const [videoId, setVideoId] = useState('');
  const [filter, setFilter] = useState('open');
  const [mineOnly, setMineOnly] = useState(false);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const videoMap = Object.fromEntries(videos.map((v) => [v.id, v]));

  const list = requests.filter((r) => {
    if (mineOnly && r.requested_by !== me.id) return false;
    if (filter === 'open') return OPEN_REQUEST_STATUSES.includes(r.status);
    if (filter === 'all') return true;
    return r.status === filter;
  });

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    actions.addRequest({ title: title.trim(), details, kind, due_date: due || null, video_id: videoId || null });
    setTitle(''); setDetails(''); setDue(''); setVideoId('');
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Requests</h1>
          <p>
            Graphic design, extra posts, and anything outside the monthly content plan goes here.
            {owner ? ' Accept a request with an hour estimate and it counts against the weekly retainer.' : ' Ali reviews each one and confirms timing.'}
          </p>
        </div>
      </div>

      <form className="panel" style={{ marginBottom: '16px' }} onSubmit={submit}>
        <h3>New request</h3>
        <div className="field">
          <label>What do you need?</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Social graphic for the trade show" />
        </div>
        <div className="field">
          <label>Details</label>
          <textarea rows="3" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Sizes, copy, links, anything that helps" />
        </div>
        <div className="two-col">
          <div className="field">
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {REQUEST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Needed by</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Related video (optional)</label>
          <select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
            <option value="">Not tied to a video</option>
            {videos.map((v) => <option key={v.id} value={v.id}>#{String(v.number).padStart(2, '0')} {v.title}</option>)}
          </select>
        </div>
        <button className="btn accent sm" type="submit">Submit request</button>
      </form>

      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Open requests</option>
          <option value="all">All requests</option>
          {REQUEST_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label} only</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Only mine</label>
      </div>

      <div className="trend-list">
        {list.length ? list.map((r) => {
          const mine = r.requested_by === me.id;
          const est = estimates.find((e) => e.request_id === r.id)?.estimate_hours;
          const logged = timeEntries.filter((t) => t.request_id === r.id).reduce((s, t) => s + Number(t.hours), 0);
          const v = videoMap[r.video_id];
          return (
            <div className="trend-item" key={r.id} data-done={r.status === 'done' ? 'true' : 'false'}>
              <div className="top">
                <div>
                  <span className="title">{r.title}</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <span className={STATUS_STYLE[r.status]}>{requestStatusLabel(r.status)}</span>
                    <span className="chip neutral">{requestKindLabel(r.kind)}</span>
                    {v && <span className="chip neutral" style={{ cursor: 'default' }}>#{String(v.number).padStart(2, '0')} {v.title}</span>}
                  </div>
                </div>
                {r.due_date && <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)', flex: 'none' }}>Needed {fmtDate(r.due_date)}</span>}
              </div>
              {r.details && <div className="notes">{r.details}</div>}
              {r.status === 'declined' && !owner && r.decline_reason && <div className="notes">Declined: {r.decline_reason}</div>}
              <div className="foot">
                <span>From {profileMap[r.requested_by]?.display_name || 'someone'} · {fmtDate(r.created_at)}</span>
                {mine && r.status === 'submitted' && (
                  <button className="linkbtn" style={{ color: 'var(--ink-soft)' }} onClick={() => actions.deleteRequest(r.id)}>Withdraw</button>
                )}
                {owner && <button className="linkbtn" style={{ color: 'var(--ink-soft)' }} onClick={() => actions.deleteRequest(r.id)}>Delete</button>}
              </div>
              {owner && <OwnerControls r={r} estimate={est} logged={logged} actions={actions} />}
            </div>
          );
        }) : <div className="empty">No requests here.</div>}
      </div>
    </>
  );
}
