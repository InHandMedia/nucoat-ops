import React, { useState, useEffect, useRef } from 'react';
import {
  CHANNELS, CONTENT_KINDS, CONTENT_STATUSES, BRANDS, isStaff, isOwner, todayISO, addDays, weekStartISO, weekLabel,
  parseISO, fmtDate, channelInfo, contentStatusInfo, isContentDone
} from '../constants.js';
import { BrandChip, NumChip } from './Badges.jsx';
import { supabase, isDemo } from '../supabaseClient.js';

// Preview image for a post: shows it, and lets staff upload, replace or remove it.
function PreviewPicture({ item, staff, actions }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [big, setBig] = useState(false);
  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please pick an image (JPEG or PNG).'); return; }
    if (file.size > 10 * 1024 * 1024) { setErr('That image is over 10 MB. Please use a smaller one.'); return; }
    setErr(''); setBusy(true);
    try {
      let url;
      if (isDemo) {
        url = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
      } else {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${item.id}/${Date.now()}.${ext || 'jpg'}`;
        const up = await supabase.storage.from('post-previews').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        url = supabase.storage.from('post-previews').getPublicUrl(path).data.publicUrl;
      }
      await actions.saveContent(item.id, { preview_url: url });
    } catch (ex) {
      setErr(ex?.message || 'Upload failed. Has the preview migration been run in Supabase?');
    }
    setBusy(false);
  }
  if (!item.preview_url && !staff) return null;
  return (
    <div className="field">
      <label>Preview (what the post looks like)</label>
      {item.preview_url ? (
        <div>
          <img
            src={item.preview_url} alt={`Preview of ${item.title}`} onClick={() => setBig(!big)}
            style={{ display: 'block', maxWidth: big ? '100%' : '260px', width: '100%', borderRadius: '10px', border: '1px solid var(--line)', cursor: 'zoom-in' }}
          />
          <div className="row-actions" style={{ marginTop: '6px' }}>
            <button type="button" className="linkbtn" onClick={() => setBig(!big)}>{big ? 'Make smaller' : 'View bigger'}</button>
            {staff && <label className="linkbtn" style={{ cursor: 'pointer' }}>{busy ? 'Uploading...' : 'Replace'}<input type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} disabled={busy} /></label>}
            {staff && <button type="button" className="linkbtn" onClick={() => actions.saveContent(item.id, { preview_url: '' })}>Remove</button>}
          </div>
        </div>
      ) : (
        <label className="btn sm ghost" style={{ cursor: 'pointer', width: 'fit-content' }}>{busy ? 'Uploading...' : 'Upload a preview image'}<input type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} disabled={busy} /></label>
      )}
      {err && <div style={{ color: 'var(--warn)', fontSize: '12.5px', marginTop: '6px' }}>{err}</div>}
    </div>
  );
}

export function ChannelChip({ channel }) {
  const c = channelInfo(channel);
  return <span className="chip" style={{ background: c.tint, color: c.color }}>{c.label}</span>;
}
export function ContentStatusChip({ status }) {
  const s = contentStatusInfo(status);
  return <span className="chip" style={{ background: s.tint, color: s.color }}>{s.label}</span>;
}

// Draft a plan line from what the post already says (type, channel, brand, linked video).
export function suggestPlan(f, videos) {
  const v = videos.find((x) => x.id === f.video_id);
  const ch = channelInfo(f.channel).label;
  const vid = v ? `Video ${v.number} (${v.title})` : 'the video';
  const email = f.channel === 'email';
  if (f.kind === 'video') {
    return email
      ? `VIDEO EMAIL: link to ${vid} and its article on the Safety & Compliance page.`
      : `VIDEO POST: short vertical cut of ${vid} on ${ch}, with the article linked in the comments.`;
  }
  if (f.kind === 'takeaway') return `TAKEAWAY POST: one key point from ${vid}, as text or a simple graphic on ${ch}.`;
  if (f.kind === 'reminder') {
    return email
      ? `REMINDER EMAIL: recap ${vid} and send people back to watch it.`
      : `REMINDER POST: point back to ${vid} and its article on ${ch}. Keep it credibility-focused, not salesy.`;
  }
  if (f.kind === 'offer') return `OFFER (${f.brand}): state the offer, the end date and the code on ${ch}.`;
  return `${email ? 'Email' : `${ch} post`} for ${f.brand}${v ? ` tied to ${vid}` : ''}. ${f.title ? `Topic: ${f.title}.` : ''}`.trim();
}

// Can this post be dragged to another day? (staff only; posted posts are history)
export const canMoveContent = (item, staff) => staff && item.status !== 'posted';

// Move a post to another day. Approved/scheduled posts go back for approval when the date changes
// (the database enforces this), so ask first.
export async function moveContent(item, newDate, actions) {
  if (!newDate || newDate === item.publish_date) return false;
  if (['approved', 'scheduled'].includes(item.status)) {
    const ok = window.confirm('This post is already approved. Moving it to another day sends it back for approval. Move it anyway?');
    if (!ok) return false;
  }
  await actions.saveContent(item.id, { publish_date: newDate });
  return true;
}

// Can this person approve this post right now? Anyone except the person who created it.
export function canApproveContent(item, me) {
  return item.status === 'in_review' && item.created_by !== me.id;
}

// Owner only: approve without submitting (drafts, changes requested) or approve your own post.
export function canOverrideContent(item, me) {
  return me.role === 'owner' && (['draft', 'changes_requested'].includes(item.status) || (item.status === 'in_review' && item.created_by === me.id));
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

// Posts that share a day, brand, title and video are one piece of content cross-posted to several channels.
function groupItems(items) {
  const m = new Map();
  items.forEach((i) => {
    const k = [i.publish_date, i.brand, i.title, i.video_id || ''].join('|');
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  });
  return Array.from(m.values());
}

function dayLabel(iso) {
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function ItemDetail({ item, me, role, videos, profileMap, comments, actions }) {
  const staff = isStaff(role);
  const [form, setForm] = useState({
    title: item.title, publish_date: item.publish_date, channel: item.channel, brand: item.brand,
    kind: item.kind, caption: item.caption || '', asset_link: item.asset_link || '', notes: item.notes || '', video_id: item.video_id || '', brief: item.brief || ''
  });
  const base = useRef(form);
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Pull in changes made elsewhere without clobbering fields you are mid-editing.
  useEffect(() => {
    const fresh = {
      title: item.title, publish_date: item.publish_date, channel: item.channel, brand: item.brand,
      kind: item.kind, caption: item.caption || '', asset_link: item.asset_link || '', notes: item.notes || '', video_id: item.video_id || '', brief: item.brief || ''
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
      {!staff && item.brief && (
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
      {canOverrideContent(item, me) && (
        <div className="nudge" style={{ display: 'block', margin: '10px 0' }}>
          <div style={{ marginBottom: '8px' }}><b>Owner approval</b>: no need to wait for anyone. Approve it yourself and it is ready to schedule.</div>
          <button className="btn sm accent" onClick={() => actions.reviewContent(item.id, 'approved', '')}>Approve it myself</button>
        </div>
      )}
      {item.status === 'in_review' && !reviewer && staff && item.created_by === me.id && !canOverrideContent(item, me) && (
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
      {(staff || form.brief) && (
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <label htmlFor={`plan-${item.id}`}>Plan (what this post is for)</label>
            {staff && <button type="button" className="linkbtn" onClick={() => set('brief', suggestPlan(form, videos))}>Auto-fill from the post</button>}
          </div>
          <textarea id={`plan-${item.id}`} rows="2" value={form.brief} disabled={!staff} onChange={(e) => set('brief', e.target.value)} placeholder="Short note on the goal, e.g. VIDEO EMAIL: link to the video and its article" style={{ width: '100%' }} />
        </div>
      )}
      <div className="field">
        <label>Copy / caption (this is what gets approved)</label>
        <textarea rows="5" value={form.caption} disabled={!staff} onChange={(e) => set('caption', e.target.value)} placeholder="Write the caption or email copy here" style={{ width: '100%' }} />
      </div>
      <PreviewPicture item={item} staff={staff} actions={actions} />
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
  const [f, setF] = useState({ title: '', publish_date: todayISO(), channel: 'instagram', brand: 'NuCoat', kind: 'other', caption: '', brief: '', video_id: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const row = { ...f, title: f.title.trim(), video_id: f.video_id || null, status: 'draft' };
    if (!row.brief.trim()) row.brief = suggestPlan(row, videos);
    await onCreate(row);
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
      <div className="field"><label>Plan (leave blank and it writes one for you)</label><input type="text" value={f.brief} onChange={(e) => set('brief', e.target.value)} placeholder="What this post is for" /></div>
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
  const [dropWeek, setDropWeek] = useState(null);
  const [adding, setAdding] = useState(false);
  const [weekOpen, setWeekOpen] = useState({});
  const [box, setBox] = useState(null); // which tile's list is open: draft | mine | review | approved | posted
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
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
    approved: contentItems.filter((i) => i.status === 'approved').length,
    scheduled: contentItems.filter((i) => i.status === 'scheduled').length,
    posted: contentItems.filter((i) => i.status === 'posted').length
  };

  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const setMany = (ids, on) => setSelected((s) => (on ? Array.from(new Set([...s, ...ids])) : s.filter((x) => !ids.includes(x))));
  const exitSelect = () => { setSelecting(false); setSelected([]); setConfirmBulk(false); };
  async function deleteSelected() {
    const ids = selected.filter((id) => filtered.some((i) => i.id === id));
    if (!ids.length) return;
    await actions.deleteContentMany(ids);
    exitSelect();
  }
  const BOXES = {
    draft: { label: 'Drafts to submit', test: (i) => i.status === 'draft' },
    mine: { label: 'Waiting on you', test: (i) => canApproveContent(i, me) },
    review: { label: 'Waiting on approval', test: (i) => i.status === 'in_review' },
    approved: { label: 'Approved, not yet scheduled', test: (i) => i.status === 'approved' },
    scheduled: { label: 'Approved and scheduled', test: (i) => i.status === 'scheduled' },
    posted: { label: 'Posted', test: (i) => i.status === 'posted' }
  };
  const boxItems = box ? contentItems.filter(BOXES[box].test).sort((a, b) => (box === 'posted' ? b.publish_date.localeCompare(a.publish_date) : a.publish_date.localeCompare(b.publish_date)) || a.title.localeCompare(b.title)) : [];
  function toggleBox(key) {
    const next = box === key ? null : key;
    setBox(next);
    if (next) setTimeout(() => document.getElementById('status-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  const tileProps = (key) => ({
    role: 'button', tabIndex: 0, onClick: () => toggleBox(key),
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBox(key); } },
    title: box === key ? 'Hide this list' : 'Show these posts'
  });
  const selectedShown = selected.filter((id) => filtered.some((i) => i.id === id));
  // This week and next are open; later weeks start collapsed. Filters and selecting open everything.
  const nearCutoff = addDays(weekStartISO(today), 7);
  const weekIsOpen = (ws) => selecting || status || weekOpen[ws] !== undefined ? (selecting || status ? true : weekOpen[ws]) : ws <= nearCutoff;
  const allOpen = weeks.every((w) => weekIsOpen(w.ws));
  const setAllWeeks = (on) => setWeekOpen(Object.fromEntries(weeks.map((w) => [w.ws, on])));

  const renderRow = (i) => {
    const v = videoMap[i.video_id];
    const expanded = open === i.id;
    const needsMe = canApproveContent(i, me);
    return (
      <div
        key={i.id} className={`content-row ${expanded ? 'open' : ''} ${selecting && selected.includes(i.id) ? 'picked' : ''}`} data-done={isContentDone(i.status) ? 'true' : 'false'}
        draggable={canMoveContent(i, staff) && !expanded && !selecting}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => setDropWeek(null)}
        title={canMoveContent(i, staff) && !expanded && !selecting ? 'Drag to another week to move it' : undefined}
      >
        <div className="content-line" onClick={() => (selecting ? toggleOne(i.id) : setOpen(expanded ? null : i.id))}>
          {selecting && (
            <input
              type="checkbox" checked={selected.includes(i.id)} aria-label={`Select ${i.title}`}
              onChange={() => toggleOne(i.id)} onClick={(e) => e.stopPropagation()}
            />
          )}
          <span className="mono cdate">{dayLabel(i.publish_date)}</span>
          <ChannelChip channel={i.channel} />
          <BrandChip brand={i.brand} />
          {i.preview_url && <img src={i.preview_url} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '5px', flex: 'none', border: '1px solid var(--line)' }} />}
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
  };

  const renderGroup = (g) => {
    const first = g[0];
    const key = `g-${first.id}`;
    const expanded = open === key;
    const allSel = g.every((x) => selected.includes(x.id));
    const v = videoMap[first.video_id];
    const sts = Array.from(new Set(g.map((x) => x.status)));
    const movable = staff && !expanded && !selecting && g.every((x) => canMoveContent(x, staff));
    return (
      <div
        key={key} className={`content-row ${expanded ? 'open' : ''} ${selecting && allSel ? 'picked' : ''}`}
        data-done={g.every((x) => isContentDone(x.status)) ? 'true' : 'false'}
        draggable={movable}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', g.map((x) => x.id).join(',')); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => setDropWeek(null)}
        title={movable ? 'Drag to another week to move all of these' : undefined}
      >
        <div className="content-line" onClick={() => (selecting ? setMany(g.map((x) => x.id), !allSel) : setOpen(expanded ? null : key))}>
          {selecting && (
            <input
              type="checkbox" checked={allSel} aria-label={`Select ${first.title}`}
              onChange={() => setMany(g.map((x) => x.id), !allSel)} onClick={(e) => e.stopPropagation()}
            />
          )}
          <span className="mono cdate">{dayLabel(first.publish_date)}</span>
          <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>{g.map((x) => <ChannelChip key={x.id} channel={x.channel} />)}</span>
          <BrandChip brand={first.brand} />
          <span className="ctitle">{first.title}</span>
          {v && <NumChip number={v.number} />}
          {sts.length === 1 ? <ContentStatusChip status={sts[0]} /> : <span className="chip">Mixed</span>}
          <span className="chev">{expanded ? '▾' : '▸'}</span>
        </div>
        {expanded && g.map((x) => (
          <div key={x.id} style={{ borderTop: '1px solid var(--line)', paddingTop: '8px', marginTop: '8px' }}>
            <div className="meta-line" style={{ gap: '8px', alignItems: 'center' }}><ChannelChip channel={x.channel} /><ContentStatusChip status={x.status} /></div>
            <ItemDetail item={x} me={me} role={role} videos={videos} profileMap={profileMap} comments={contentComments} actions={actions} />
          </div>
        ))}
      </div>
    );
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
        <div className={`tile clickable ${box === 'draft' ? 'accent' : ''}`} {...tileProps('draft')}><div className="num">{counts.draft}</div><div className="lbl">Drafts to submit</div></div>
        <div className={`tile clickable ${box === 'mine' || (!box && mine.length) ? 'accent' : ''}`} {...tileProps('mine')}><div className="num">{mine.length}</div><div className="lbl">Waiting on you</div></div>
        <div className={`tile clickable ${box === 'review' ? 'accent' : ''}`} {...tileProps('review')}><div className="num">{counts.review}</div><div className="lbl">Waiting on approval</div></div>
        <div className={`tile clickable ${box === 'approved' ? 'accent' : ''}`} {...tileProps('approved')}><div className="num">{counts.approved}</div><div className="lbl">Approved, not yet scheduled</div></div>
        <div className={`tile clickable ${box === 'scheduled' ? 'accent' : ''}`} {...tileProps('scheduled')}><div className="num">{counts.scheduled}</div><div className="lbl">Approved and scheduled</div></div>
        <div className={`tile clickable ${box === 'posted' ? 'accent' : ''}`} {...tileProps('posted')}><div className="num">{counts.posted}</div><div className="lbl">Posted</div></div>
      </div>

      {box && (
        <div className="panel" id="status-box" style={{ marginBottom: '14px' }}>
          <h3>
            <span>{BOXES[box].label} <span className="mono" style={{ fontSize: '11px' }}>{boxItems.length}</span></span>
            <button className="linkbtn" onClick={() => setBox(null)}>Close</button>
          </h3>
          {boxItems.length
            ? groupItems(boxItems).map((g) => (g.length === 1 ? renderRow(g[0]) : renderGroup(g)))
            : <div className="empty">Nothing here right now.</div>}
        </div>
      )}

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
        {weeks.length > 1 && !selecting && !status && <button className="btn ghost sm" onClick={() => setAllWeeks(!allOpen)}>{allOpen ? 'Collapse all weeks' : 'Expand all weeks'}</button>}
        {staff && !selecting && <button className="btn ghost sm" onClick={() => setSelecting(true)}>Select posts</button>}
      </div>

      {staff && selecting && (
        <div className="panel" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', position: 'sticky', top: '8px', zIndex: 5 }}>
          <b>{selectedShown.length} selected</b>
          <button className="linkbtn" onClick={() => setMany(filtered.map((i) => i.id), true)}>Select all {filtered.length} shown</button>
          <button className="linkbtn" onClick={() => setSelected([])}>Clear</button>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {!confirmBulk ? (
              <button className="btn sm accent" disabled={!selectedShown.length} onClick={() => setConfirmBulk(true)}>Delete {selectedShown.length || ''}</button>
            ) : (
              <>
                <span style={{ fontSize: '12.5px' }}>Permanently delete {selectedShown.length} post{selectedShown.length === 1 ? '' : 's'}? This cannot be undone.</span>
                <button className="btn sm accent" onClick={deleteSelected}>Yes, delete</button>
                <button className="btn sm ghost" onClick={() => setConfirmBulk(false)}>Keep</button>
              </>
            )}
            <button className="btn sm ghost" onClick={exitSelect}>Done</button>
          </span>
        </div>
      )}

      {weeks.length ? weeks.map((w) => {
        const drafts = w.items.filter((i) => i.status === 'draft');
        return (
          <div
            className={`panel ${dropWeek === w.ws ? 'dropping' : ''}`} key={w.ws} style={{ marginBottom: '14px' }}
            onDragOver={staff ? (e) => { e.preventDefault(); if (dropWeek !== w.ws) setDropWeek(w.ws); } : undefined}
            onDragLeave={staff ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropWeek(null); } : undefined}
            onDrop={staff ? (e) => {
              e.preventDefault(); setDropWeek(null);
              const ids = e.dataTransfer.getData('text/plain').split(',');
              (async () => {
                for (const id of ids) {
                  const item = contentItems.find((c) => c.id === id);
                  if (!item || !canMoveContent(item, staff)) continue;
                  // keep the same weekday, shift to this week
                  const offset = Math.round((parseISO(item.publish_date) - parseISO(weekStartISO(item.publish_date))) / 86400000);
                  await moveContent(item, addDays(w.ws, offset), actions);
                }
              })();
            } : undefined}
          >
            <h3>
              <span
                role="button" tabIndex={0} style={{ cursor: 'pointer' }} title={weekIsOpen(w.ws) ? 'Collapse this week' : 'Expand this week'}
                onClick={() => setWeekOpen((o) => ({ ...o, [w.ws]: !weekIsOpen(w.ws) }))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setWeekOpen((o) => ({ ...o, [w.ws]: !weekIsOpen(w.ws) })); } }}
              >
                {weekIsOpen(w.ws) ? '▾' : '▸'} Week of {weekLabel(w.ws)} <span className="mono" style={{ fontSize: '11px' }}>{w.items.length}</span>
              </span>
              {staff && selecting && (
                <button className="linkbtn" onClick={() => setMany(w.items.map((i) => i.id), !w.items.every((i) => selected.includes(i.id)))}>
                  {w.items.every((i) => selected.includes(i.id)) ? 'Unselect week' : 'Select week'}
                </button>
              )}
              {staff && !selecting && drafts.length > 0 && (
                <span style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <button className="linkbtn" onClick={() => actions.submitContent(drafts.map((d) => d.id))}>Submit {drafts.length} draft{drafts.length > 1 ? 's' : ''} for approval</button>
                  {me.role === 'owner' && (
                    <button
                      className="linkbtn"
                      onClick={() => { if (window.confirm(`Approve ${drafts.length} draft${drafts.length > 1 ? 's' : ''} yourself, without sending them to anyone?`)) actions.approveContentMany(drafts.map((d) => d.id)); }}
                    >Approve {drafts.length} myself</button>
                  )}
                </span>
              )}
            </h3>
            {weekIsOpen(w.ws) && groupItems(w.items).map((g) => (g.length === 1 ? renderRow(g[0]) : renderGroup(g)))}
          </div>
        );
      }) : (
        <div className="panel"><div className="empty">{contentItems.length ? 'Nothing matches these filters.' : 'No posts yet. Add the first one with + New post.'}</div></div>
      )}
    </>
  );
}
