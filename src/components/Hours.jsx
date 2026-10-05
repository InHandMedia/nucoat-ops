import React, { useState } from 'react';
import {
  TIME_KINDS, timeKindLabel, todayISO, addDays, weekStartISO, weekLabel, fmtDate, money, hrs, OPEN_REQUEST_STATUSES
} from '../constants.js';

export default function Hours({ timeEntries, requests, estimates, videos, settings, actions }) {
  const today = todayISO();
  const thisWeek = weekStartISO(today);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [date, setDate] = useState(today);
  const [hoursIn, setHoursIn] = useState('');
  const [kind, setKind] = useState('content');
  const [videoId, setVideoId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [note, setNote] = useState('');

  const cap = Number(settings?.weekly_cap_hours ?? 10);
  const fee = Number(settings?.weekly_fee ?? 300);
  const rate = settings?.overage_rate != null && settings.overage_rate !== '' ? Number(settings.overage_rate) : fee / cap;
  const [capIn, setCapIn] = useState(String(cap));
  const [feeIn, setFeeIn] = useState(String(fee));
  const [rateIn, setRateIn] = useState(settings?.overage_rate != null ? String(settings.overage_rate) : '');

  const sumFor = (ws) => timeEntries.filter((e) => weekStartISO(e.entry_date) === ws).reduce((s, e) => s + Number(e.hours), 0);
  const logged = sumFor(weekStart);
  const over = Math.max(0, logged - cap);
  const overAmt = over * rate;
  const pct = Math.min(100, (logged / cap) * 100);
  const meterClass = logged > cap ? 'over' : logged >= cap * 0.8 ? 'warn' : '';
  const entries = timeEntries
    .filter((e) => weekStartISO(e.entry_date) === weekStart)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  // Hours still expected on requests you've accepted (estimate minus time already logged)
  const committed = requests
    .filter((r) => r.status === 'accepted' || r.status === 'in_progress')
    .map((r) => {
      const est = Number(estimates.find((e) => e.request_id === r.id)?.estimate_hours || 0);
      const l = timeEntries.filter((t) => t.request_id === r.id).reduce((s, t) => s + Number(t.hours), 0);
      return { r, est, l, left: Math.max(0, est - l) };
    });
  const committedLeft = committed.reduce((s, c) => s + c.left, 0);
  const untriaged = requests.filter((r) => r.status === 'submitted').length;
  const openRequests = requests.filter((r) => OPEN_REQUEST_STATUSES.includes(r.status) && r.status !== 'submitted');

  const history = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * i)).map((ws) => {
    const h = sumFor(ws);
    const o = Math.max(0, h - cap);
    return { ws, h, o, oAmt: o * rate, total: fee + o * rate };
  });

  async function addEntry(e) {
    e.preventDefault();
    if (!(Number(hoursIn) > 0)) return;
    await actions.addTime({
      entry_date: date, hours: Number(hoursIn), kind,
      video_id: videoVisible(kind) && videoId ? videoId : null,
      request_id: kind === 'request' && requestId ? requestId : null,
      note
    });
    setHoursIn(''); setNote('');
  }
  function videoVisible(k) { return k !== 'admin'; }

  function saveSettings(e) {
    e.preventDefault();
    actions.saveSettings({
      weekly_cap_hours: Number(capIn) || 10,
      weekly_fee: Number(feeIn) || 0,
      overage_rate: rateIn === '' ? null : Number(rateIn)
    });
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Hours</h1>
          <p>Your retainer time and billing. Only the owner account can see this tab or its data.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '16px' }}>
        <div className="row-actions" style={{ justifyContent: 'space-between', marginBottom: '14px' }}>
          <div className="row-actions">
            <button className="iconbtn" onClick={() => setWeekStart(addDays(weekStart, -7))}>&larr;</button>
            <b className="disp" style={{ fontSize: '17px' }}>{weekStart === thisWeek ? 'This week' : 'Week of'} · {weekLabel(weekStart)}</b>
            <button className="iconbtn" onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={weekStart >= thisWeek}>&rarr;</button>
          </div>
          {weekStart !== thisWeek && <button className="linkbtn" onClick={() => setWeekStart(thisWeek)}>Back to this week</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
          <span className="bigstat">{hrs(logged)}</span>
          <span style={{ color: 'var(--ink-soft)' }}>of {hrs(cap)} included</span>
        </div>
        <div className={`meter ${meterClass}`}><span style={{ width: `${pct}%` }} /></div>
        <div className="meter-row">
          {over > 0 ? (
            <span style={{ color: 'var(--warn)', fontWeight: 700 }}>Overage: {hrs(over)} ≈ {money(overAmt)}. Bill this on top of the {money(fee)} retainer.</span>
          ) : (
            <span>{hrs(cap - logged)} left this week{logged >= cap * 0.8 ? ' (getting close)' : ''}</span>
          )}
          <span>Billing this week: <b>{money(fee + overAmt)}</b></span>
        </div>
        {weekStart === thisWeek && (committedLeft > 0 || untriaged > 0) && (
          <div className="nudge" style={{ marginTop: '14px', marginBottom: 0 }}>
            <span>
              {committedLeft > 0 && <>Accepted requests still need about <b>{hrs(committedLeft)}</b>. If you finish them all, the week lands at <b>{hrs(logged + committedLeft)}</b>{logged + committedLeft > cap ? <> (<b style={{ color: 'var(--warn)' }}>{hrs(logged + committedLeft - cap)} over</b>)</> : ''}. </>}
              {untriaged > 0 && <>{untriaged} new request{untriaged > 1 ? 's are' : ' is'} waiting for an estimate.</>}
            </span>
          </div>
        )}
      </div>

      <div className="grid2" style={{ marginBottom: '16px' }}>
        <form className="panel" onSubmit={addEntry}>
          <h3>Log time</h3>
          <div className="two-col">
            <div className="field"><label>Date</label><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field"><label>Hours</label><input type="number" min="0" step="0.25" value={hoursIn} onChange={(e) => setHoursIn(e.target.value)} placeholder="1.5" /></div>
          </div>
          <div className="field">
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {TIME_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          {kind === 'request' && (
            <div className="field">
              <label>Request</label>
              <select value={requestId} onChange={(e) => setRequestId(e.target.value)}>
                <option value="">Choose a request</option>
                {openRequests.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
          )}
          {kind !== 'admin' && (
            <div className="field">
              <label>Video (optional)</label>
              <select value={videoId} onChange={(e) => setVideoId(e.target.value)}>
                <option value="">Not tied to a video</option>
                {videos.map((v) => <option key={v.id} value={v.id}>#{String(v.number).padStart(2, '0')} {v.title}</option>)}
              </select>
            </div>
          )}
          <div className="field"><label>Note</label><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you worked on" /></div>
          <button className="btn accent sm" type="submit" disabled={!(Number(hoursIn) > 0)}>+ Add entry</button>
        </form>

        <form className="panel" onSubmit={saveSettings}>
          <h3>Retainer terms</h3>
          <div className="field"><label>Included hours per week</label><input type="number" min="1" step="0.5" value={capIn} onChange={(e) => setCapIn(e.target.value)} /></div>
          <div className="field"><label>Weekly fee ($)</label><input type="number" min="0" step="1" value={feeIn} onChange={(e) => setFeeIn(e.target.value)} /></div>
          <div className="field">
            <label>Overage rate ($ per hour)</label>
            <input type="number" min="0" step="1" value={rateIn} onChange={(e) => setRateIn(e.target.value)} placeholder={`Blank = ${money(fee / cap)}/h (fee ÷ hours)`} />
          </div>
          <button className="btn ghost sm" type="submit">Save terms</button>
        </form>
      </div>

      <div className="panel" style={{ marginBottom: '16px' }}>
        <h3>Entries · {weekLabel(weekStart)}</h3>
        <div className="tablewrap" style={{ border: 'none', boxShadow: 'none' }}>
          <table>
            <thead><tr><th>Date</th><th>Hours</th><th>Type</th><th>Linked to</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {entries.length ? entries.map((e) => {
                const v = videos.find((x) => x.id === e.video_id);
                const r = requests.find((x) => x.id === e.request_id);
                return (
                  <tr key={e.id}>
                    <td className="mono" data-label="Date">{fmtDate(e.entry_date)}</td>
                    <td className="mono" data-label="Hours">{hrs(e.hours)}</td>
                    <td data-label="Type">{timeKindLabel(e.kind)}</td>
                    <td data-label="Linked to">{r ? r.title : v ? `#${String(v.number).padStart(2, '0')} ${v.title}` : '—'}</td>
                    <td data-label="Note">{e.note || '—'}</td>
                    <td><button className="iconbtn" onClick={() => actions.deleteTime(e.id)} title="Delete entry">&#10005;</button></td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="empty">No time logged this week.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Last 8 weeks</h3>
        <div className="tablewrap" style={{ border: 'none', boxShadow: 'none' }}>
          <table>
            <thead><tr><th>Week</th><th>Hours</th><th>Over cap</th><th>Overage</th><th>Total to bill</th></tr></thead>
            <tbody>
              {history.map((w) => (
                <tr key={w.ws} style={{ cursor: 'pointer' }} onClick={() => setWeekStart(w.ws)}>
                  <td data-label="Week">{weekLabel(w.ws)}</td>
                  <td className="mono" data-label="Hours">{hrs(w.h)}</td>
                  <td className="mono" data-label="Over cap" style={w.o > 0 ? { color: 'var(--warn)', fontWeight: 700 } : undefined}>{w.o > 0 ? hrs(w.o) : '—'}</td>
                  <td className="mono" data-label="Overage">{w.o > 0 ? money(w.oAmt) : '—'}</td>
                  <td className="mono" data-label="Total to bill"><b>{money(w.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
