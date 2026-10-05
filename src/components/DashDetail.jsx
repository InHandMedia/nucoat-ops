import React from 'react';
import { STAGES, fmtDate } from '../constants.js';
import { StageChip, BrandChip, NumChip, WaitChip } from './Badges.jsx';

export function BackBar({ onBack, title, sub }) {
  return (
    <div className="section-head">
      <div>
        <button className="linkbtn" onClick={onBack} style={{ marginBottom: '6px' }}>&larr; Back to the dashboard</button>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
}

// Every NuCoat video in order, delivered ones marked so you can see the 9 of 14 at a glance.
export function SeriesDetail({ videos, openVideo, onBack }) {
  const series = videos.filter((v) => v.brand === 'NuCoat').sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const delivered = series.filter((v) => v.stage === 'delivered').length;
  return (
    <>
      <BackBar onBack={onBack} title="Compliance series" sub={`${delivered} of ${series.length} delivered. Click any video to open it.`} />
      <div className="seg" style={{ marginBottom: '16px' }} aria-label="Series progress">
        {series.map((v) => <i key={v.id} title={`#${v.number} ${v.title}`} className={v.stage === 'delivered' ? 'on' : v.stage === 'script' ? '' : 'mid'} />)}
      </div>
      <div className="series-grid">
        {series.map((v) => {
          const done = v.stage === 'delivered';
          return (
            <div
              key={v.id} className={`card vcard series-card ${done ? 'is-delivered' : ''}`} data-done={done ? 'true' : 'false'}
              role="button" tabIndex={0} onClick={() => openVideo(v.id)} onKeyDown={(e) => { if (e.key === 'Enter') openVideo(v.id); }}
            >
              <div className="vtop">
                <NumChip number={v.number} />
                {done && <span className="deliv-badge">&#10003; Delivered</span>}
              </div>
              <div className="title">{v.title}</div>
              <div className="badges"><StageChip stage={v.stage} /><WaitChip video={v} /></div>
              {v.shoot_date && !done && <div className="meta">Shoot {fmtDate(v.shoot_date)}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// Everything not yet delivered, grouped by where it is in the pipeline.
export function InProgressDetail({ videos, openVideo, onBack }) {
  const list = videos.filter((v) => v.stage !== 'delivered');
  return (
    <>
      <BackBar onBack={onBack} title="Videos in progress" sub={`${list.length} videos that are not delivered yet, grouped by stage.`} />
      <div className="stack">
        {STAGES.filter((s) => s.key !== 'delivered').map((st) => {
          const items = list.filter((v) => v.stage === st.key).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
          if (!items.length) return null;
          return (
            <div className="panel" key={st.key}>
              <h3 style={{ color: st.color }}>{st.label} <span className="mono" style={{ fontSize: '11px' }}>{items.length}</span></h3>
              {items.map((v) => (
                <div className="rowline" key={v.id} style={{ cursor: 'pointer' }} onClick={() => openVideo(v.id)}>
                  <span><NumChip number={v.number} /> <b>{v.title}</b> {v.brand === 'NuFun' && <BrandChip brand="NuFun" />}</span>
                  <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <WaitChip video={v} />
                    {v.shoot_date && <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>Shoot {fmtDate(v.shoot_date)}</span>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {!list.length && <div className="panel"><div className="empty">Everything is delivered.</div></div>}
      </div>
    </>
  );
}
