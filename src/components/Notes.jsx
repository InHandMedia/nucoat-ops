import React from 'react';
import { isStaff, fmtDate } from '../constants.js';

// Notes and pins on the dashboard. Everyone sees notes shared with them; staff can share or pin onto other dashboards.
export default function Notes({ me, role, profiles, videos, contentItems, tasks, notes, actions, openVideo, goTab }) {
  const staff = isStaff(role);
  const [body, setBody] = React.useState('');
  const [scope, setScope] = React.useState('private'); // private | everyone | <profile id>
  const [pin, setPin] = React.useState(false);
  const [ref, setRef] = React.useState(''); // "video:<id>" etc
  const [showAll, setShowAll] = React.useState(false);

  const nameOf = (id) => profiles.find((p) => p.id === id)?.display_name || 'Someone';
  const others = profiles.filter((p) => p.id !== me.id);

  const mine = notes.filter((n) => n.author === me.id || n.scope === 'everyone' || n.to_user === me.id);
  const visible = mine.slice().sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
  const shown = showAll ? visible : visible.slice(0, 6);

  const refOptions = [
    ...videos.filter((v) => v.stage !== 'delivered').map((v) => ({ key: `video:${v.id}`, label: `Video #${String(v.number).padStart(2, '0')} ${v.title}` })),
    ...contentItems.filter((c) => !['posted'].includes(c.status)).slice(0, 60).map((c) => ({ key: `content:${c.id}`, label: `Post ${fmtDate(c.publish_date)} ${c.title}` })),
    ...(staff ? tasks.filter((t) => !t.done).slice(0, 60).map((t) => ({ key: `task:${t.id}`, label: `Task ${t.title}` })) : [])
  ];

  async function add() {
    const text = body.trim();
    if (!text) return;
    const row = { body: text, pinned: pin, scope: scope === 'private' ? 'private' : scope === 'everyone' ? 'everyone' : 'person', to_user: scope !== 'private' && scope !== 'everyone' ? scope : null };
    if (ref) {
      const [type, id] = ref.split(':');
      row.ref_type = type;
      row.ref_id = id;
      row.ref_label = refOptions.find((o) => o.key === ref)?.label || '';
    }
    const res = await actions.addNote(row);
    if (!res?.error) { setBody(''); setPin(false); setRef(''); }
  }

  function open(n) {
    if (n.ref_type === 'video') openVideo(n.ref_id);
    else goTab(n.ref_type === 'content' ? 'content' : 'tasks');
  }

  const who = (n) => (n.scope === 'private' ? 'Only you' : n.scope === 'everyone' ? 'Everyone' : n.to_user === me.id ? 'For you' : `For ${nameOf(n.to_user)}`);

  return (
    <div className="panel" style={{ marginBottom: '16px' }}>
      <h3>Notes &amp; pins <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{visible.length}</span></h3>
      {visible.length === 0 && <div className="empty">No notes yet. Jot something down, or {staff ? 'pin a note to someone’s dashboard' : 'keep a private note'}.</div>}
      {shown.map((n) => {
        const own = n.author === me.id || role === 'owner';
        return (
          <div key={n.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0', background: n.pinned ? 'var(--accent-tint)' : 'transparent', borderRadius: n.pinned ? '8px' : 0, paddingLeft: n.pinned ? '10px' : 0, paddingRight: n.pinned ? '10px' : 0, marginBottom: n.pinned ? '4px' : 0 }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px' }}>{n.body}</div>
            {n.ref_label && <div style={{ marginTop: '6px' }}><button className="linkbtn" onClick={() => open(n)}>{n.ref_label} &rarr;</button></div>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px', fontSize: '11.5px', color: 'var(--ink-soft)' }}>
              {n.pinned && <span className="chip wait">Pinned</span>}
              <span className="chip neutral">{who(n)}</span>
              <span>{n.author === me.id ? 'You' : nameOf(n.author)} &middot; {fmtDate(n.created_at.slice(0, 10))}</span>
              {own && (
                <>
                  {(n.scope === 'private' || staff) && <button className="linkbtn" onClick={() => actions.saveNote(n.id, { pinned: !n.pinned })}>{n.pinned ? 'Unpin' : 'Pin'}</button>}
                  <button className="linkbtn" onClick={() => actions.deleteNote(n.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {visible.length > 6 && <button className="linkbtn" style={{ marginTop: '8px' }} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${visible.length}`}</button>}
      <div className="mini-form" style={{ marginTop: '10px' }}>
        <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a note..." aria-label="New note" style={{ width: '100%', marginBottom: '8px' }} />
        <div className="row-actions">
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Who sees this">
            <option value="private">Only me</option>
            {staff && <option value="everyone">Everyone</option>}
            {staff && others.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <select value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Attach an item" style={{ flex: 1, minWidth: '140px' }}>
            <option value="">Attach a video, post or task (optional)</option>
            {refOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> Pin to top</label>
          <button className="btn sm accent" disabled={!body.trim()} onClick={add}>Add note</button>
        </div>
      </div>
    </div>
  );
}
