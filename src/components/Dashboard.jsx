import React from 'react';
import { isContentDone, isOwner, isStaff, todayISO, addDays, daysFromNow, fmtDate, weekStartISO, hrs, OPEN_REQUEST_STATUSES } from '../constants.js';
import { StageChip, BrandChip, NumChip, WaitChip, People } from './Badges.jsx';
import ReviewBox from './ReviewBox.jsx';
import { effectiveAssignees } from '../people.js';
import { TaskEditorFor } from './TaskEditor.jsx';
import { ChannelChip, ContentStatusChip, ContentReviewBox, canApproveContent } from './Content.jsx';

function SeriesProgress({ videos }) {
  const series = videos.filter((v) => v.brand === 'NuCoat');
  const delivered = series.filter((v) => v.stage === 'delivered').length;
  const waiting = series.filter((v) => v.waiting_on_brady).length;
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Compliance series progress</h3>
      <div className="seg" aria-label="Series progress">
        {series.map((v) => (
          <i key={v.id} title={`#${v.number} ${v.title}`} className={v.stage === 'delivered' ? 'on' : v.stage === 'script' ? '' : 'mid'} />
        ))}
      </div>
      <div className="seg-legend">
        <span><b>{delivered}</b> of {series.length} delivered</span>
        <span>{series.filter((v) => v.stage !== 'delivered' && v.stage !== 'script').length} in production</span>
        <span>{waiting} waiting on approval</span>
      </div>
    </div>
  );
}

function ApprovalsPanel({ me, videos, contentItems, openVideo, goTab, actions }) {
  const waitingVideos = videos.filter((v) => v.stage === 'client_approval' || v.stage === 'client_review');
  const waitingContent = contentItems.filter((c) => c.status === 'in_review').sort((a, b) => a.publish_date.localeCompare(b.publish_date));
  const total = waitingVideos.length + waitingContent.length;
  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Needs approval <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{total}</span></h3>
      {total === 0 && <div className="empty">Nothing is waiting on approval right now.</div>}
      {waitingVideos.map((v) => (
        <div key={v.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
            <NumChip number={v.number} />
            <b style={{ fontSize: '14px' }}>{v.title}</b>
            <StageChip stage={v.stage} />
            <BrandChip brand={v.brand} />
          </div>
          {v.waiting_note && <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginBottom: '8px' }}>{v.waiting_note}</div>}
          <div className="row-actions" style={{ marginBottom: '8px' }}>
            <button className="linkbtn" onClick={() => openVideo(v.id)}>Open {v.stage === 'client_approval' ? 'script' : 'video'} &rarr;</button>
            {v.long_link && <a className="filelink" href={v.long_link} target="_blank" rel="noopener noreferrer">Long-form file</a>}
            {v.short_link && <a className="filelink" href={v.short_link} target="_blank" rel="noopener noreferrer">Short-form file</a>}
          </div>
          <ReviewBox video={v} onReview={actions.reviewVideo} />
        </div>
      ))}
      {waitingContent.slice(0, 8).map((c) => (
        <div key={c.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
            <span className="mono" style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>{fmtDate(c.publish_date)}</span>
            <ChannelChip channel={c.channel} />
            <BrandChip brand={c.brand} />
            <b style={{ fontSize: '14px' }}>{c.title}</b>
            <ContentStatusChip status={c.status} />
          </div>
          {c.caption
            ? <div style={{ fontSize: '13px', background: 'var(--surface-2)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{c.caption}</div>
            : <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginBottom: '8px' }}>No copy written yet.</div>}
          {canApproveContent(c, me)
            ? <ContentReviewBox item={c} onReview={actions.reviewContent} />
            : me.role === 'owner'
              ? <button className="btn sm accent" onClick={() => actions.reviewContent(c.id, 'approved', '')}>Approve it myself</button>
              : <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>Waiting for another editor to approve.</div>}
        </div>
      ))}
      {waitingContent.length > 8 && <button className="linkbtn" style={{ marginTop: '8px' }} onClick={() => goTab('content')}>See all {waitingContent.length} posts waiting &rarr;</button>}
    </div>
  );
}

function ReviewerDashboard({ me, videos, contentItems, requests, profiles, openVideo, goTab, actions }) {
  const delivered = videos.filter((v) => v.stage === 'delivered').slice(-4).reverse();
  const myRequests = requests.filter((r) => r.requested_by === me.id && OPEN_REQUEST_STATUSES.includes(r.status));
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Hi, {me.display_name}</h1>
          <p>Here is what needs your sign-off, and where the series stands.</p>
        </div>
      </div>
      <SeriesProgress videos={videos} />
      <div className="stack">
        <ApprovalsPanel me={me} videos={videos} contentItems={contentItems} openVideo={openVideo} goTab={goTab} actions={actions} />
        <div className="grid2">
          <div className="panel">
            <h3>Recently delivered <button className="linkbtn" onClick={() => goTab('series')}>All videos</button></h3>
            {delivered.length ? delivered.map((v) => (
              <div className="rowline" key={v.id} style={{ cursor: 'pointer' }} onClick={() => openVideo(v.id)}>
                <span><NumChip number={v.number} /> {v.title}</span>
                <StageChip stage={v.stage} />
              </div>
            )) : <div className="empty">Nothing delivered yet.</div>}
          </div>
          <div className="panel">
            <h3>Your requests <button className="linkbtn" onClick={() => goTab('requests')}>Open</button></h3>
            {myRequests.length ? myRequests.map((r) => (
              <div className="rowline" key={r.id}><span>{r.title}</span><span className="chip neutral">{r.status.replace('_', ' ')}</span></div>
            )) : <div className="empty">No open requests. Need design work or an extra post? Use the Requests tab.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Dashboard(props) {
  const [editingTask, setEditingTask] = React.useState(null);
  const { role, me, videos, contentItems, tasks, requests, timeEntries, settings, estimates, profiles, openVideo, goTab, actions } = props;
  if (!isStaff(role)) return <ReviewerDashboard {...props} />;

  const today = todayISO();
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const inProgress = videos.filter((v) => v.stage !== 'delivered');
  const waiting = videos.filter((v) => v.waiting_on_brady);
  const contentWaiting = contentItems.filter((c) => c.status === 'in_review');
  const contentDrafts = contentItems.filter((c) => c.status === 'draft' && c.publish_date >= todayISO() && c.publish_date <= addDays(todayISO(), 7));
  const myTasks = tasks.filter((t) => !t.done && effectiveAssignees(t, profiles).includes(me.id))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const openRequests = requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status));
  const newRequests = requests.filter((r) => r.status === 'submitted');
  const shoots = videos
    .filter((v) => v.shoot_date && v.stage !== 'delivered' && v.shoot_date >= today && v.shoot_date <= addDays(today, 14))
    .sort((a, b) => a.shoot_date.localeCompare(b.shoot_date));

  const owner = isOwner(role);
  let weekLogged = 0;
  const cap = settings?.weekly_cap_hours ?? 10;
  if (owner) {
    const ws = weekStartISO(today);
    weekLogged = timeEntries.filter((e) => weekStartISO(e.entry_date) === ws).reduce((s, e) => s + Number(e.hours), 0);
  }
  const pct = Math.min(100, (weekLogged / cap) * 100);
  const meterClass = weekLogged > cap ? 'over' : weekLogged >= cap * 0.8 ? 'warn' : '';

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Hi, {me.display_name}</h1>
          <p>Where the NuCoat series stands today.</p>
        </div>
      </div>

      <SeriesProgress videos={videos} />

      <div className="tiles">
        <div className="tile"><div className="num">{inProgress.length}</div><div className="lbl">Videos in progress</div></div>
        <div className={`tile ${waiting.length + contentWaiting.length ? 'accent' : ''}`}><div className="num">{waiting.length + contentWaiting.length}</div><div className="lbl">Waiting on approval</div></div>
        <div className="tile"><div className="num">{myTasks.length}</div><div className="lbl">Your open tasks</div></div>
        <div className="tile"><div className="num">{openRequests.length}</div><div className="lbl">Open requests</div></div>
      </div>

      {owner && (
        <div className="panel" style={{ marginBottom: '16px', cursor: 'pointer' }} onClick={() => goTab('hours')}>
          <h3>Retainer hours this week <span className="mono" style={{ fontSize: '12px' }}>{hrs(weekLogged)} of {hrs(cap)}</span></h3>
          <div className={`meter ${meterClass}`}><span style={{ width: `${pct}%` }} /></div>
          <div className="meter-row">
            <span>{weekLogged > cap ? `${hrs(weekLogged - cap)} over: overage applies` : `${hrs(Math.max(0, cap - weekLogged))} left`}</span>
            <span>Only you can see this</span>
          </div>
        </div>
      )}

      {(waiting.length > 0 || contentWaiting.length > 0) && (
        <ApprovalsPanel me={me} videos={videos} contentItems={contentItems} openVideo={openVideo} goTab={goTab} actions={actions} />
      )}

      <div className="grid2" style={{ marginBottom: '16px' }}>
        <div className="panel">
          <h3>Your tasks <button className="linkbtn" onClick={() => goTab('tasks')}>All tasks</button></h3>
          {myTasks.length ? myTasks.slice(0, 6).map((t) => {
            const d = daysFromNow(t.due_date);
            const video = videos.find((v) => v.id === t.video_id);
            return (
              <div className="rowline" key={t.id} style={{ flexWrap: 'wrap' }}>
                <label className="check" style={{ flex: 1, color: 'var(--ink)', fontSize: '13px' }}>
                  <input type="checkbox" checked={t.done} onChange={(e) => actions.toggleTask(t.id, e.target.checked)} /> {t.title}
                </label>
                {video && <span className="chip neutral" style={{ cursor: 'pointer' }} onClick={() => openVideo(video.id)}>#{String(video.number).padStart(2, '0')}</span>}
                {t.due_date && <span className="mono" style={{ fontSize: '11px', color: d < 0 ? 'var(--warn)' : 'var(--ink-soft)', fontWeight: d < 0 ? 700 : 400 }}>{d < 0 && '⚠ '}{fmtDate(t.due_date)}</span>}
                <button className="iconbtn" title="Edit this task" aria-label="Edit task" style={{ width: '24px', height: '24px', fontSize: '11px' }} onClick={() => setEditingTask(editingTask === t.id ? null : t.id)}>&#9998;</button>
                {editingTask === t.id && (
                  <div style={{ flexBasis: '100%' }}>
                    <TaskEditorFor t={t} profiles={profiles} videos={videos} tasks={tasks} actions={actions} onClose={() => setEditingTask(null)} />
                  </div>
                )}
              </div>
            );
          }) : <div className="empty">Nothing assigned to you. Nice.</div>}
        </div>
        <div className="panel">
          <h3>Posts this week <button className="linkbtn" onClick={() => goTab('content')}>Content</button></h3>
          {contentItems.filter((c) => c.publish_date >= todayISO() && c.publish_date <= addDays(todayISO(), 7)).length
            ? contentItems.filter((c) => c.publish_date >= todayISO() && c.publish_date <= addDays(todayISO(), 7)).slice(0, 6).map((c) => (
              <div className="rowline" key={c.id} data-done={isContentDone(c.status) ? 'true' : 'false'} style={{ cursor: 'pointer' }} onClick={() => goTab('content')}>
                <span><span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{fmtDate(c.publish_date)}</span> <ChannelChip channel={c.channel} /> {c.title}</span>
                <ContentStatusChip status={c.status} />
              </div>
            ))
            : <div className="empty">No posts scheduled in the next 7 days.</div>}
          {contentDrafts.length > 0 && <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '8px' }}>{contentDrafts.length} draft{contentDrafts.length > 1 ? 's' : ''} this week not yet submitted for approval.</div>}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>Upcoming shoots (next 14 days)</h3>
          {shoots.length ? shoots.map((v) => (
            <div className="rowline" key={v.id} style={{ cursor: 'pointer' }} onClick={() => openVideo(v.id)}>
              <span><NumChip number={v.number} /> {v.title}</span>
              <span className="mono" style={{ fontSize: '11px' }}>{fmtDate(v.shoot_date)}</span>
            </div>
          )) : <div className="empty">No shoots scheduled in the next two weeks.</div>}
        </div>
        <div className="panel">
          <h3>{owner ? 'Requests to triage' : 'Open requests'} <button className="linkbtn" onClick={() => goTab('requests')}>Requests</button></h3>
          {(owner ? newRequests : openRequests).length ? (owner ? newRequests : openRequests).slice(0, 5).map((r) => (
            <div className="rowline" key={r.id}>
              <span>{r.title} <span style={{ color: 'var(--ink-soft)', fontSize: '12px' }}>from {profileMap[r.requested_by]?.display_name || 'someone'}</span></span>
              <span className="chip neutral">{r.status.replace('_', ' ')}</span>
            </div>
          )) : <div className="empty">{owner ? 'No new requests.' : 'No open requests.'}</div>}
        </div>
      </div>
    </>
  );
}
