import React, { useState, useEffect, useRef } from 'react';
import {
  CHANNELS, CONTENT_KINDS, CONTENT_STATUSES, BRANDS, isStaff, isOwner, todayISO, addDays, weekStartISO, weekLabel,
  parseISO, fmtDate, channelInfo, contentStatusInfo
} from '../constants.js';
import { BrandChip, NumChip } from './Badges.jsx';

export function ChannelChip({ channel }) {
  const c = channelInfo(channel);
  return <span className="chip" style={{ background: c.tint, color: c.color }}>{c.label}</span>;
}
export function ContentStatusChip({ status }) {
  const s = contentStatusInfo(status);
  return <span className="chip" style={{ background: s.tint, color: s.color }}>{s.label}</span>;
}

// Can this person approve this post right now? Anyone except the person who created it.
export function canApproveContent(item, me) {
  return item.status === 'in_review' && item.created_by !== me.id;
}

// Approve / Request changes box, shared by the Content tab and the Dashboard.
export function ContentReviewBox({ item, onReview }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(decision) {
    setBusy(true);
    await onReview(item.id, decision, note.trim());
    setBusy(false);
    setNote('');
  }
  return (
    <div className="mini-form">
      <textarea
        rows="2" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', marginBottom: '8px' }}
        placeholder="Notes (required if you request changes)"
      />
      <div className="row-actions">
        <button className="btn sm accent" disabled={busy} onClick={() => send('approved')}>Approve</button>
        <button className="btn sm ghost" disabled={busy || !note.trim()} onClick={() => send('changes')}>Request changes</button>
      </div>
    </div>
  );
}

function dayLabel(iso) {
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function ItemDetail({ item, me, role, videos, profileMap, comments, actions }) {
  const staff = isStaff(role);
  const [form, setForm] = useState({
    title: item.title, publish_date: item.publish_date, channel: item.channel, brand: item.brand,
    kind: item.kind, caption: item.caption || '', asset_link: item.asset_link || '', notes: item.notes || '', video_id: item.video_id || ''
  });
  const base = useRef(form);
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Pull in changes made elsewhere without clobbering fields you are mid-editing.
  useEffect(() => {
    const fresh = {
      title: item.title, publish_date: item.publish_date, channel: item.channel, brand: item.brand,
      kind: item.kind, caption: item.caption || '', asset_link: item.asset_link || '', notes: item.notes || '', video_id: item.video_id || ''
    };
    setForm((f) => {
      const next = { ...f };
      Object.keys(fresh).forEach((k) => { if (f[k] === base.current[k]) next[k] = fresh[k]; });
      return next;
    });
    base.current = fresh;
  }, [item]);

  const dirty = Object.keys(form).some((k) => form[k] !== base.current[k]);
  const reviewer = canApproveContent(item, me);
  const creator = profileMap[item.created_by]?.display_name;
  const reviewedBy = profileMap[item.reviewed_by]?.display_name;
  const myComments = comments.filter((c) => c.content_id === item.id);

  function save() {
    const patch = {};
    Object.keys(form).forEach((k) => { if (form[k] !== base.current[k]) patch[k] = k === 'video_id' ? (form[k] || null) : form[k]; });
    actions.saveContent(item.id, patch);
  }

  return (
    <div className="content-detail" onClick={(e) => e.stopPropagation()}>
      {item.brief && (
        <div className="brief"><b>Plan:</b> {item.brief}</div>
      )}
      <div className="meta-line">
        {creator && <span>Created by {creator}</span>}
        {reviewedBy && item.reviewed_at && (item.status === 'approved' || item.status === 'changes_requested' || item.status === 'scheduled' || item.status === 'posted') && (
          <span>{item.status === 'changes_requested' ? 'Changes requested' : 'Approved'} by {reviewedBy}</span>
        )}
      </div>

      {reviewer && (
        <div className="nudge" style={{ display: 'block', margin: '10px 0' }}>
          <div style={{ marginBottom: '8px' }}><b>Waiting on your approval</b>: read the copy below, then approve or ask for changes.</div>
          <ContentReviewBox item={item} onReview={actions.reviewContent} />
        </div>
      )}
      {item.status === 'in_review' && !reviewer && staff && item.created_by === me.id && (
        <div className="meta-line"><span>Waiting for another editor to approve. You cannot approve your own post.</span></div>
      )}

      <div className="two-col" style={{ marginTop: '10px' }}>
        <div className="field">
          <label>Title</label>
          <input type="text" value={form.title} disabled={!staff} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="field">
          <label>Publish date</label>
          <input type="date" value={form.publish_date} disabled={!staff} onChange={(e) => set('publish_date', e.target.value)} />
        </div>
      </div>
      <div className="two-col">
        <div className="field">
          <label>Channel</label>
          <select value={form.channel} disabled={!staff} onChange={(e) => set('channel', e.target.value)}>
            {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Brand</label>
          <select value={form.brand} disabled={!staff} onChange={(e) => set('brand', e.target.value)}>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
      <div className="two-col">
        <div className="field">
          <label>Type</label>
          <select value={form.kind} disabled={!staff} onChange={(e) => set('kind', e.target.value)}>
            {CONTENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Video</label>
          <select value={form.video_id} disabled={!staff} onChange={(e) => set('video_id', e.target.value)}>
            <option value="">Not tied to a video</option>
            {videos.map((v) => <option key={v.id} value={v.id}>#{String(v.number).padStart(2, '0')} {v.title}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Copy / caption (this is what gets approved)</label>
        <textarea rows="5" value={form.caption} disabled={!staff} onChange={(e) => set('caption', e.target.value)} placeholder="Write the caption or email copy here" style={{ width: '100%' }} />
      </div>
      <div className="two-col">
        <div className="field">
          <label>Asset link (Drive, Klaviyo, SocialPilot...)</label>
          <input type="text" value={form.asset_link} disabled={!staff} onChange={(e) => set('asset_link', e.target.value)} placeholder="https://" />
        </div>
        <div className="field">
          <label>Notes</label>
          <input type="text" value={form.notes} disabled={!staff} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      {staff && ['approved', 'scheduled', 'posted'].includes(item.status) && dirty && (form.caption !== base.current.caption || form.title !== base.current.title || form.asset_link !== base.current.asset_link || form.publish_date !== base.current.publish_date || form.channel !== base.current.channel) && (
        <p style={{ color: 'var(--warn)', fontSize: '12.5px', margin: '0 0 8px' }}>Changing the copy of an approved post sends it back for approval.</p>
      )}

      {staff && (
        <div className="row-actions" style={{ marginBottom: '14px' }}>
          {dirty && <button className="btn sm accent" onClick={save}>Save changes</button>}
          {(item.status === 'draft' || item.status === 'changes_requested') && !dirty && (
            <button className="btn sm accent" onClick={() => actions.saveContent(item.id, { status: 'in_review' })}>Submit for approval</button>
          )}
          {item.status === 'in_review' && !dirty && (
            <button className="btn sm ghost" onClick={() => actions.saveContent(item.id, { status: 'draft' })}>Pull back to draft</button>
          )}
          {item.status === 'approved' && !dirty && (
            <button className="btn sm accent" onClick={() => actions.saveContent(item.id, { status: 'scheduled' })}>Mark scheduled</button>
          )}
          {(item.status === 'approved' || item.status === 'scheduled') && !dirty && (
            <button className="btn sm ghost" onClick={() => actions.saveContent(item.id, { status: 'posted' })}>Mark posted</button>
          )}
          {item.status === 'posted' && !dirty && (
            <button className="btn sm ghost" onClick={() => actions.saveContent(item.id, { status: 'scheduled' })}>Undo posted</button>
          )}
          {!confirmDelete
            ? <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDelete(true)}>Delete</button>
            : (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '6px', alignItems: 'center', fontSize: '12px' }}>
                Delete this post?
                <button className="btn sm accent" onClick={() => actions.deleteContent(item.id)}>Yes, delete</button>
                <button className="btn sm ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
              </span>
            )}
        </div>
      )}

      <h4 className="mini-h">Comments and approvals</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {myComments.length ? myComments.map((c) => (
          <div className="quote" key={c.id}>
            <div className="by">
              <b>{profileMap[c.author]?.display_name || 'Someone'}</b>
              <span>{fmtDate(c.created_at)}</span>
              {c.kind === 'approved' && <span className="chip ok">Approved</span>}
              {c.kind === 'changes' && <span className="chip bad">Requested changes</span>}
              {(c.author === me.id || isOwner(role)) && c.kind === 'comment' && (
                <button className="linkbtn" style={{ marginLeft: 'auto', color: 'var(--ink-soft)' }} onClick={() => actions.deleteContentComment(c.id)}>Delete</button>
              )}
            </div>
            {c.body || <span style={{ color: 'var(--ink-soft)' }}>(no note)</span>}
          </div>
        )) : <div className="empty" style={{ padding: '6px 0' }}>No comments yet.</div>}
      </div>
      <form
        style={{ display: 'flex', gap: '8px', marginTop: '8px' }}
        onSubmit={(e) => { e.preventDefault(); if (comment.trim()) { actions.addContentComment(item.id, comment.trim()); setComment(''); } }}
      >
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" style={{ flex: 1 }} />
        <button className="btn sm ghost" type="submit">Comment</button>
      </form>
    </div>
  );
}

function NewPostForm({ videos, onCreate, onCancel }) {
  const [f, setF] = useState({ title: '', publish_date: todayISO(), channel: 'instagram', brand: 'NuCoat', kind: 'other', caption: '', video_id: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    await onCreate({ ...f, title: f.title.trim(), video_id: f.video_id || null, status: 'draft' });
    onCancel();
  }
  return (
    <form className="panel" style={{ marginBottom: '14px' }} onSubmit={submit}>
      <h3>New post or email</h3>
      <div className="field"><label>Title</label><input type="text" autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Video 10 vertical video post" /></div>
      <div className="two-col">
        <div className="field"><label>Publish date</label><input type="date" value={f.publish_date} onChange={(e) => set('publish_date', e.target.value)} /></div>
        <div className="field"><label>Channel</label>
          <select value={f.channel} onChange={(e) => set('channel', e.target.value)}>{CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        </div>
      </div>
      <div className="two-col">
        <div className="field"><label>Brand</label>
          <select value={f.brand} onChange={(e) => set('brand', e.target.value)}>{BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        </div>
        <div className="field"><label>Video (optional)</label>
          <select value={f.video_id} onChange={(e) => set('video_id', e.target.value)}>
            <option value="">Not tied to a video</option>
            {videos.map((v) => <option key={v.id} value={v.id}>#{String(v.number).padStart(2, '0')} {v.title}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Copy / caption</label><textarea rows="3" value={f.caption} onChange={(e) => set('caption', e.target.value)} style={{ width: '100%' }} /></div>
      <div className="row-actions">
        <button className="btn accent sm" type="submit">Add as draft</button>
        <button className="btn ghost sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Content({ me, role, contentItems, contentComments, videos, profiles, actions }) {
  const staff = isStaff(role);
  const [brand, setBrand] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [earlier, setEarlier] = useState(false);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const cutoff = addDays(weekStartISO(today), 0);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const videoMap = Object.fromEntries(videos.map((v) => [v.id, v]));

  const mine = contentItems.filter((i) => canApproveContent(i, me));
  const filtered = contentItems.filter((i) => {
    if (brand && i.brand !== brand) return false;
    if (channel && i.channel !== channel) return false;
    if (status === 'mine') { if (!canApproveContent(i, me)) return false; }
    else if (status && i.status !== status) return false;
    if (!earlier && !status && i.publish_date < cutoff) return false;
    return true;
  }).sort((a, b) => a.publish_date.localeCompare(b.publish_date) || a.channel.localeCompare(b.channel) || a.title.localeCompare(b.title));

  const weeks = [];
  filtered.forEach((i) => {
    const ws = weekStartISO(i.publish_date);
    let w = weeks.find((x) => x.ws === ws);
    if (!w) { w = { ws, items: [] }; weeks.push(w); }
    w.items.push(i);
  });

  const counts = {
    draft: contentItems.filter((i) => i.status === 'draft' && i.publish_date >= cutoff).length,
    review: contentItems.filter((i) => i.status === 'in_review').length,
    approved: contentItems.filter((i) => i.status === 'approved').length
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Content</h1>
          <p>Every post and email on the calendar. Alistair drafts, then another editor (usually Brady) approves before it goes out.</p>
        </div>
        {staff && !adding && <button className="btn accent" onClick={() => setAdding(true)}>+ New post</button>}
      </div>

      {adding && <NewPostForm videos={videos} onCreate={actions.addContent} onCancel={() => setAdding(false)} />}

      <div className="tiles" style={{ marginBottom: '14px' }}>
        <div className="tile"><div className="num">{counts.draft}</div><div className="lbl">Drafts to submit</div></div>
        <div className={`tile ${mine.length ? 'accent' : ''}`}><div className="num">{mine.length}</div><div className="lbl">Waiting on you</div></div>
        <div className="tile"><div className="num">{counts.review}</div><div className="lbl">Waiting on approval</div></div>
        <div className="tile"><div className="num">{counts.approved}</div><div className="lbl">Approved, not yet scheduled</div></div>
      </div>

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="mine">Waiting on my approval ({mine.length})</option>
          {CONTENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Both brands</option>
          {BRANDS.map((b) => <option key={b} value={b}>{b} only</option>)}
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">All channels</option>
          {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={earlier} onChange={(e) => setEarlier(e.target.checked)} /> Include earlier weeks</label>
      </div>

      {weeks.length ? weeks.map((w) => {
        const drafts = w.items.filter((i) => i.status === 'draft');
        return (
          <div className="panel" key={w.ws} style={{ marginBottom: '14px' }}>
            <h3>
              <span>Week of {weekLabel(w.ws)} <span className="mono" style={{ fontSize: '11px' }}>{w.items.length}</span></span>
              {staff && drafts.length > 0 && (
                <button className="linkbtn" onClick={() => actions.submitContent(drafts.map((d) => d.id))}>Submit {drafts.length} draft{drafts.length > 1 ? 's' : ''} for approval</button>
              )}
            </h3>
            {w.items.map((i) => {
              const v = videoMap[i.video_id];
              const expanded = open === i.id;
              const needsMe = canApproveContent(i, me);
              return (
                <div key={i.id} className={`content-row ${expanded ? 'open' : ''}`} data-done={i.status === 'posted' ? 'true' : 'false'}>
                  <div className="content-line" onClick={() => setOpen(expanded ? null : i.id)}>
                    <span className="mono cdate">{dayLabel(i.publish_date)}</span>
                    <ChannelChip channel={i.channel} />
                    <BrandChip brand={i.brand} />
                    <span className="ctitle">{i.title}</span>
                    {v && <NumChip number={v.number} />}
                    {needsMe && <span className="chip wait">Your approval</span>}
                    <ContentStatusChip status={i.status} />
                    <span className="chev">{expanded ? '▾' : '▸'}</span>
                  </div>
                  {expanded && (
                    <ItemDetail
                      item={i} me={me} role={role} videos={videos} profileMap={profileMap}
                      comments={contentComments} actions={actions}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      }) : (
        <div className="panel"><div className="empty">{contentItems.length ? 'Nothing matches these filters.' : 'No posts yet. Add the first one with + New post.'}</div></div>
      )}
    </>
  );
}
