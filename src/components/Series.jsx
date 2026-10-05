import React, { useState } from 'react';
import { STAGES, BRANDS, FORMATS, isStaff, fmtDate, daysFromNow } from '../constants.js';
import { StageChip, BrandChip, NumChip, WaitChip, FormatChips, People } from './Badges.jsx';

export default function Series({ role, videos, checklist, profiles, actions, openVideo }) {
  const [view, setView] = useState('board');
  const [brand, setBrand] = useState('all');
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [newBrand, setNewBrand] = useState('NuCoat');
  const [formats, setFormats] = useState(['long', 'short']);
  const staff = isStaff(role);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const list = videos.filter((v) => (brand === 'all' || v.brand === brand) && (!waitingOnly || v.waiting_on_brady));

  function progress(videoId) {
    const items = checklist.filter((c) => c.video_id === videoId);
    if (!items.length) return null;
    return `${items.filter((c) => c.done).length}/${items.length}`;
  }

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const next = Math.max(0, ...videos.filter((v) => v.brand === newBrand).map((v) => v.number || 0)) + 1;
    const row = await actions.createVideo({ title: title.trim(), brand: newBrand, formats, number: next, stage: 'script' });
    setTitle(''); setAdding(false);
    if (row) openVideo(row.id);
  }
  function toggleFormat(k) {
    setFormats((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Series</h1>
          <p>Every video from script to delivery. {staff ? 'Click a card to open it.' : 'Open a video to read the script or leave your sign-off.'}</p>
        </div>
        {staff && <button className="btn accent" onClick={() => setAdding((a) => !a)}>+ New video</button>}
      </div>

      {adding && (
        <form className="panel" style={{ marginBottom: '14px' }} onSubmit={create}>
          <div className="two-col">
            <div className="field">
              <label>Title</label>
              <input type="text" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Heat press safety" />
            </div>
            <div className="field">
              <label>Brand</label>
              <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)}>
                {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Versions</label>
            <div className="checks">
              {FORMATS.map((f) => (
                <label key={f.key}><input type="checkbox" checked={formats.includes(f.key)} onChange={() => toggleFormat(f.key)} /> {f.label}</label>
              ))}
            </div>
          </div>
          <div className="row-actions">
            <button className="btn accent sm" type="submit">Create video</button>
            <button className="btn ghost sm" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="filters">
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="all">NuCoat + NuFun</option>
          {BRANDS.map((b) => <option key={b} value={b}>{b} only</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={waitingOnly} onChange={(e) => setWaitingOnly(e.target.checked)} /> Waiting on approval only</label>
        <span style={{ flex: 1 }} />
        <button className={`btn sm ${view === 'board' ? 'accent' : 'ghost'}`} onClick={() => setView('board')}>Board</button>
        <button className={`btn sm ${view === 'list' ? 'accent' : 'ghost'}`} onClick={() => setView('list')}>List</button>
      </div>

      {view === 'board' ? (
        <div className="board stages">
          {STAGES.map((st) => {
            const items = list.filter((v) => v.stage === st.key);
            return (
              <div className="col" key={st.key}>
                <div className="col-head">
                  <span className="disp" style={{ fontSize: '14px', color: st.color }}>{st.label}</span>
                  <span className="count mono">{items.length}</span>
                </div>
                {items.map((v) => {
                  const shootSoon = v.shoot_date && v.stage !== 'delivered' && daysFromNow(v.shoot_date) <= 3 && daysFromNow(v.shoot_date) >= 0;
                  const prog = staff && v.stage !== 'delivered' ? progress(v.id) : null;
                  return (
                    <div className="card vcard" key={v.id} data-done={v.stage === 'delivered' ? 'true' : 'false'} onClick={() => openVideo(v.id)}>
                      <div className="vtop"><NumChip number={v.number} />{v.brand === 'NuFun' && <BrandChip brand="NuFun" />}</div>
                      <div className="title">{v.title}</div>
                      <div className="badges"><FormatChips formats={v.formats} /></div>
                      <div className="badges"><WaitChip video={v} /></div>
                      {v.shoot_date && v.stage !== 'delivered' && (
                        <div className="meta" style={shootSoon ? { color: 'var(--accent)', fontWeight: 700 } : undefined}>Shoot {fmtDate(v.shoot_date)}</div>
                      )}
                      <div className="meta" style={{ flexWrap: 'wrap' }}>
                        {v.talent && <span>{v.talent}</span>}
                        {prog && <span>· checklist {prog}</span>}
                      </div>
                      {staff && (v.assigned_to || []).length > 0 && (
                        <div className="meta" style={{ flexWrap: 'wrap' }}><People ids={v.assigned_to} profileMap={profileMap} /></div>
                      )}
                    </div>
                  );
                })}
                {!items.length && <div className="empty" style={{ padding: '10px 0' }}>None</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>#</th><th>Video</th><th>Stage</th><th>Versions</th><th>Talent</th><th>Shoot</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.length ? list.map((v) => (
                <tr key={v.id} data-done={v.stage === 'delivered' ? 'true' : 'false'} style={{ cursor: 'pointer' }} onClick={() => openVideo(v.id)}>
                  <td data-label="#"><NumChip number={v.number} /></td>
                  <td data-label="Video"><b>{v.title}</b> {v.brand === 'NuFun' && <BrandChip brand="NuFun" />}</td>
                  <td data-label="Stage"><StageChip stage={v.stage} /></td>
                  <td data-label="Versions"><FormatChips formats={v.formats} /></td>
                  <td data-label="Talent">{v.talent || '—'}</td>
                  <td className="mono" data-label="Shoot">{v.shoot_date ? fmtDate(v.shoot_date) : '—'}</td>
                  <td className="mono" data-label="Due">{v.due_date ? fmtDate(v.due_date) : '—'}</td>
                  <td data-label="Status"><WaitChip video={v} />{!v.waiting_on_brady && '—'}</td>
                </tr>
              )) : <tr><td colSpan={8} className="empty">No videos match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
