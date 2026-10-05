import React, { useEffect, useRef, useState } from 'react';
import { STAGES, BRANDS, FORMATS, CLIENT_STAGES, isOwner, isStaff, fmtDate } from '../constants.js';
import { StageChip, BrandChip, NumChip, WaitChip, ApprovalChip, FormatChips, People } from './Badges.jsx';
import ReviewBox from './ReviewBox.jsx';

const toForm = (v) => ({
  title: v.title || '',
  stage: v.stage,
  brand: v.brand,
  formats: v.formats || [],
  talent: v.talent || '',
  shoot_date: v.shoot_date || '',
  due_date: v.due_date || '',
  summary: v.summary || '',
  script: v.script || '',
  shot_list: v.shot_list || '',
  long_link: v.long_link || '',
  short_link: v.short_link || '',
  assigned_to: v.assigned_to || [],
  waiting_on_brady: !!v.waiting_on_brady,
  waiting_note: v.waiting_note || ''
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function toggleIn(list, x) {
  return list.includes(x) ? list.filter((i) => i !== x) : [...list, x];
}

function Checklist({ video, items, actions }) {
  const [text, setText] = useState('');
  const done = items.filter((i) => i.done).length;
  return (
    <div className="panel">
      <h3>Pre-shoot checklist <span className="mono" style={{ fontSize: '12px' }}>{done}/{items.length}</span></h3>
      {items.map((i) => (
        <div className={`checkitem ${i.done ? 'done' : ''}`} data-done={i.done ? 'true' : 'false'} key={i.id}>
          <input type="checkbox" checked={i.done} onChange={(e) => actions.toggleCheck(i.id, e.target.checked)} />
          <span style={{ flex: 1 }}>{i.title}</span>
          <button className="iconbtn" style={{ width: '24px', height: '24px', fontSize: '11px' }} onClick={() => actions.deleteCheck(i.id)}>&#10005;</button>
        </div>
      ))}
      <form
        style={{ display: 'flex', gap: '8px', marginTop: '10px' }}
        onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; actions.addCheck(video.id, text.trim(), items.length + 1); setText(''); }}
      >
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a checklist item" style={{ flex: 1 }} />
        <button className="btn sm accent" type="submit">Add</button>
      </form>
    </div>
  );
}

function VideoTasks({ video, tasks, profiles, me, actions }) {
  const [title, setTitle] = useState('');
  const [assignees, setAssignees] = useState([me.id]);
  const [due, setDue] = useState('');
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const staffPeople = profiles.filter((p) => p.role !== 'reviewer');
  return (
    <div className="panel">
      <h3>Tasks for this video</h3>
      {tasks.length ? tasks.map((t) => (
        <div className={`checkitem ${t.done ? 'done' : ''}`} data-done={t.done ? 'true' : 'false'} key={t.id} style={{ flexWrap: 'wrap' }}>
          <input type="checkbox" checked={t.done} onChange={(e) => actions.toggleTask(t.id, e.target.checked)} />
          <span style={{ flex: 1 }}>{t.title}</span>
          <People ids={t.assigned_to} profileMap={profileMap} />
          {t.due_date && <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{fmtDate(t.due_date)}</span>}
          <button className="iconbtn" style={{ width: '24px', height: '24px', fontSize: '11px' }} onClick={() => actions.deleteTask(t.id)}>&#10005;</button>
        </div>
      )) : <div className="empty" style={{ padding: '6px 0 12px' }}>No tasks yet.</div>}
      <div className="mini-form" style={{ marginTop: '8px' }}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Record voiceover" style={{ width: '100%', marginBottom: '8px' }} />
        <div className="two-col">
          <div className="field" style={{ marginBottom: '8px' }}>
            <label>Assign to</label>
            <div className="checks">
              {staffPeople.map((p) => (
                <label key={p.id}><input type="checkbox" checked={assignees.includes(p.id)} onChange={() => setAssignees(toggleIn(assignees, p.id))} /> {p.display_name}</label>
              ))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: '8px' }}>
            <label>Due date</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <button
          className="btn sm accent" type="button"
          onClick={() => {
            if (!title.trim()) return;
            actions.addTask({ title: title.trim(), video_id: video.id, assigned_to: assignees, due_date: due || null });
            setTitle(''); setDue('');
          }}
        >+ Add task</button>
      </div>
    </div>
  );
}

function Comments({ video, comments, profiles, me, role, actions }) {
  const [body, setBody] = useState('');
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return (
    <div className="panel">
      <h3>Comments and approvals</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {comments.length ? comments.map((c) => (
          <div className="quote" key={c.id}>
            <div className="by">
              <b>{profileMap[c.author]?.display_name || 'Someone'}</b>
              <span>{fmtDate(c.created_at)}</span>
              {c.kind === 'approved' && <span className="chip ok">Approved</span>}
              {c.kind === 'changes' && <span className="chip bad">Requested changes</span>}
              {(c.author === me.id || isOwner(role)) && (
                <button className="linkbtn" style={{ marginLeft: 'auto', color: 'var(--ink-soft)' }} onClick={() => actions.deleteComment(c.id)}>Delete</button>
              )}
            </div>
            {c.body || <span style={{ color: 'var(--ink-soft)' }}>(no note)</span>}
          </div>
        )) : <div className="empty" style={{ padding: '6px 0' }}>No comments yet.</div>}
      </div>
      <form
        style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}
        onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return; actions.addComment(video.id, body.trim()); setBody(''); }}
      >
        <textarea rows="2" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a comment" style={{ flex: 1 }} />
        <button className="btn sm accent" type="submit">Post</button>
      </form>
    </div>
  );
}

export default function VideoDetail({ video, role, me, profiles, internal, checklist, comments, tasks, actions, onBack }) {
  const staff = isStaff(role);
  const owner = isOwner(role);
  const [form, setForm] = useState(() => toForm(video));
  const base = useRef(toForm(video));
  const internalRow = internal.find((i) => i.video_id === video.id);
  const [notes, setNotes] = useState(internalRow?.notes || '');
  const notesBase = useRef(internalRow?.notes || '');
  const [flash, setFlash] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // Pull in changes made elsewhere (e.g. someone approves) without clobbering fields you are mid-editing.
  useEffect(() => {
    const next = toForm(video);
    setForm((cur) => {
      const merged = { ...cur };
      Object.keys(next).forEach((k) => { if (same(cur[k], base.current[k])) merged[k] = next[k]; });
      return merged;
    });
    base.current = next;
  }, [video]);
  useEffect(() => {
    const incoming = internalRow?.notes || '';
    setNotes((cur) => (cur === notesBase.current ? incoming : cur));
    notesBase.current = incoming;
  }, [internalRow?.notes]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const staffPeople = profiles.filter((p) => p.role !== 'reviewer');
  const videoChecklist = checklist.filter((c) => c.video_id === video.id);
  const videoTasks = tasks.filter((t) => t.video_id === video.id);
  const videoComments = comments.filter((c) => c.video_id === video.id);
  const needsReview = CLIENT_STAGES.includes(video.stage);

  async function handleSave() {
    const patch = {};
    Object.keys(form).forEach((k) => { if (!same(form[k], base.current[k])) patch[k] = form[k]; });
    ['shoot_date', 'due_date'].forEach((k) => { if (k in patch && !patch[k]) patch[k] = null; });
    if ('title' in patch && !patch.title.trim()) delete patch.title;
    let did = false;
    if (Object.keys(patch).length) {
      const res = await actions.saveVideo(video.id, patch);
      if (!res?.error) { base.current = { ...base.current, ...form }; did = true; }
    }
    if (notes !== notesBase.current) {
      const res = await actions.saveInternal(video.id, notes);
      if (!res?.error) { notesBase.current = notes; did = true; }
    }
    setFlash(did ? 'Saved' : 'No changes');
    setTimeout(() => setFlash(''), 1800);
  }

  const header = (
    <>
      <button className="linkbtn" style={{ marginBottom: '14px' }} onClick={onBack}>&larr; All videos</button>
      <div className="section-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          {staff ? (
            <input type="text" className="disp titleinput" value={form.title} onChange={(e) => set('title', e.target.value)} />
          ) : (
            <h1 style={{ margin: 0 }}>{video.title}</h1>
          )}
          <div className="tag-row">
            <NumChip number={video.number} />
            <StageChip stage={video.stage} />
            <BrandChip brand={video.brand} />
            <FormatChips formats={video.formats} />
            <WaitChip video={video} />
            <ApprovalChip video={video} />
          </div>
        </div>
        {staff && (
          <div className="row-actions">
            {flash && <span style={{ fontSize: '12.5px', color: 'var(--accent)', fontWeight: 700 }}>{flash}</span>}
            <button className="btn accent" onClick={handleSave}>Save</button>
          </div>
        )}
      </div>
    </>
  );

  const reviewPanel = needsReview && (
    <div className="nudge" style={{ display: 'block' }}>
      <div style={{ marginBottom: '8px' }}>
        <b>{video.stage === 'client_approval' ? 'Script approval' : 'Final video review'}</b>
        {owner ? ': another editor (usually Brady) approves this. You can also record a decision here if they replied outside the app.' : ': read below, then approve or ask for changes.'}
      </div>
      <ReviewBox video={video} onReview={actions.reviewVideo} />
    </div>
  );

  // ---------- Reviewer (read-only) ----------
  if (!staff) {
    return (
      <div>
        {header}
        {reviewPanel}
        <div className="stack">
          {video.summary && <div className="panel"><h3>Summary</h3><div className="readonly-block">{video.summary}</div></div>}
          <div className="panel"><h3>Script</h3><div className="readonly-block">{video.script || 'The script is not written yet.'}</div></div>
          {(video.long_link || video.short_link) && (
            <div className="panel">
              <h3>Files</h3>
              <div className="row-actions">
                {video.long_link && <a className="filelink" href={video.long_link} target="_blank" rel="noopener noreferrer">Long-form file &rarr;</a>}
                {video.short_link && <a className="filelink" href={video.short_link} target="_blank" rel="noopener noreferrer">Short-form file &rarr;</a>}
              </div>
            </div>
          )}
          <Comments video={video} comments={videoComments} profiles={profiles} me={me} role={role} actions={actions} />
        </div>
      </div>
    );
  }

  // ---------- Owner / Editor ----------
  return (
    <div>
      {header}
      {reviewPanel}
      <div className="stack">
        <div className="panel">
          <h3>Overview</h3>
          <div className="two-col">
            <div className="field">
              <label>Stage</label>
              <select value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Brand</label>
              <select value={form.brand} onChange={(e) => set('brand', e.target.value)}>
                {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '12px', margin: '-4px 0 12px' }}>
            Moving a video into Client approval or Client review automatically flags it as waiting on approval.
          </p>
          <div className="field">
            <label>Versions</label>
            <div className="checks">
              {FORMATS.map((f) => (
                <label key={f.key}><input type="checkbox" checked={form.formats.includes(f.key)} onChange={() => set('formats', toggleIn(form.formats, f.key))} /> {f.label}</label>
              ))}
            </div>
          </div>
          <div className="two-col">
            <div className="field"><label>Talent</label><input type="text" value={form.talent} onChange={(e) => set('talent', e.target.value)} /></div>
            <div className="field">
              <label>Assigned to</label>
              <div className="checks">
                {staffPeople.map((p) => (
                  <label key={p.id}><input type="checkbox" checked={form.assigned_to.includes(p.id)} onChange={() => set('assigned_to', toggleIn(form.assigned_to, p.id))} /> {p.display_name}</label>
                ))}
              </div>
            </div>
          </div>
          <div className="two-col">
            <div className="field"><label>Shoot date</label><input type="date" value={form.shoot_date} onChange={(e) => set('shoot_date', e.target.value)} /></div>
            <div className="field"><label>Due date</label><input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
          </div>
          <div className="two-col">
            <div className="field">
              <label>Waiting on approval</label>
              <label className="check" style={{ color: 'var(--ink)' }}>
                <input type="checkbox" checked={form.waiting_on_brady} onChange={(e) => set('waiting_on_brady', e.target.checked)} /> Yes, we are waiting on him
              </label>
            </div>
            <div className="field"><label>What we need from him</label><input type="text" value={form.waiting_note} onChange={(e) => set('waiting_note', e.target.value)} placeholder="e.g. Sign-off on compliance wording" /></div>
          </div>
        </div>

        <div className="panel">
          <h3>Summary</h3>
          <textarea rows="3" value={form.summary} onChange={(e) => set('summary', e.target.value)} placeholder="What this video covers and who it is for" style={{ width: '100%' }} />
        </div>

        <div className="panel">
          <h3>Script</h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: '12.5px', marginTop: '-6px', marginBottom: '10px' }}>Approvers read this version when it is in Client approval.</p>
          <textarea className="script" value={form.script} onChange={(e) => set('script', e.target.value)} placeholder="Hook, body, close..." />
        </div>

        <div className="panel">
          <h3>Shot list and plan</h3>
          <textarea rows="6" value={form.shot_list} onChange={(e) => set('shot_list', e.target.value)} placeholder="Shot-by-shot plan, B-roll, locations" style={{ width: '100%' }} />
        </div>

        <div className="panel">
          <h3>Deliverable files</h3>
          <div className="two-col">
            <div className="field"><label>Long-form link</label><input type="url" value={form.long_link} onChange={(e) => set('long_link', e.target.value)} placeholder="https://drive.google.com/..." /></div>
            <div className="field"><label>Short-form link</label><input type="url" value={form.short_link} onChange={(e) => set('short_link', e.target.value)} placeholder="https://drive.google.com/..." /></div>
          </div>
        </div>

        <Checklist video={video} items={videoChecklist} actions={actions} />
        <VideoTasks video={video} tasks={videoTasks} profiles={profiles} me={me} actions={actions} />

        <div className="panel">
          <h3>Internal notes <span className="chip neutral">Hidden from outside reviewers</span></h3>
          <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private notes for the team" style={{ width: '100%' }} />
        </div>

        <Comments video={video} comments={videoComments} profiles={profiles} me={me} role={role} actions={actions} />

        <div className="modal-actions" style={{ marginBottom: '40px' }}>
          {owner ? (
            confirmDel ? (
              <div className="row-actions">
                <span style={{ fontSize: '13px' }}>Delete this video for good?</span>
                <button className="btn sm" style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={async () => { await actions.deleteVideo(video.id); onBack(); }}>Yes, delete</button>
                <button className="btn sm ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn ghost" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }} onClick={() => setConfirmDel(true)}>Delete video</button>
            )
          ) : <span />}
          <button className="btn accent" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
