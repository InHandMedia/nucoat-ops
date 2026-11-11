import React, { useState } from 'react';
import { isOwner, isStaff, fmtDate, daysFromNow } from '../constants.js';
import { DEPARTMENTS, PROJECT_STATUSES, projectStatusInfo } from '../workspace.js';
import { toggleIn } from './TaskEditor.jsx';
import { MeetingsPanel } from './Meetings.jsx';

export function ProjectStatusChip({ status }) {
  const s = projectStatusInfo(status);
  return <span className="chip" style={{ background: s.tint, color: s.color }}>{s.label}</span>;
}

function MemberBadges({ project, profiles }) {
  const names = (project.member_ids || []).map((id) => profiles.find((p) => p.id === id)?.display_name).filter(Boolean);
  const outside = (project.outside_members || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {names.map((n) => <span className="badge assignee" key={n}>{n}</span>)}
      {outside.map((n) => <span className="badge who" key={n} title="No login yet">{n}</span>)}
    </>
  );
}

function ProjectForm({ initial, profiles, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({
    name: initial?.name || '', description: initial?.description || '', department: initial?.department || 'Marketing',
    status: initial?.status || 'planning', member_ids: initial?.member_ids || [], outside_members: initial?.outside_members || '',
    due_date: initial?.due_date || '', link: initial?.link || '', show_in_menu: initial?.show_in_menu ?? true
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="mini-form" style={{ marginBottom: '16px' }}
      onSubmit={(e) => { e.preventDefault(); if (f.name.trim()) onSave({ ...f, name: f.name.trim(), due_date: f.due_date || null }); }}
    >
      <div className="field"><label>Project name</label><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
      <div className="field"><label>What it is</label><textarea rows="2" value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      <div className="two-col">
        <div className="field">
          <label>Team</label>
          <select value={f.department} onChange={(e) => set('department', e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {PROJECT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="two-col">
        <div className="field"><label>Target date</label><input type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
        <div className="field"><label>Link (folder, doc, seller center)</label><input type="text" value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" /></div>
      </div>
      <div className="field">
        <label>Who is on it (only these people can see the project)</label>
        <div className="checks">
          {profiles.map((p) => (
            <label key={p.id}><input type="checkbox" checked={f.member_ids.includes(p.id)} onChange={() => set('member_ids', toggleIn(f.member_ids, p.id))} /> {p.display_name}</label>
          ))}
        </div>
      </div>
      <div className="field"><label>Also on it, no login yet</label><input type="text" value={f.outside_members} onChange={(e) => set('outside_members', e.target.value)} placeholder="e.g. Taylor, Halle" /></div>
      <div className="field">
        <label className="check" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '13px', color: 'var(--ink)' }}>
          <input type="checkbox" checked={f.show_in_menu} onChange={(e) => set('show_in_menu', e.target.checked)} /> Give each member a tab for this project in their menu
        </label>
      </div>
      <div className="row-actions">
        <button className="btn sm accent" type="submit">{initial ? 'Save project' : 'Create project'}</button>
        <button className="btn sm ghost" type="button" onClick={onCancel}>Cancel</button>
        {onDelete && <button className="btn sm ghost" type="button" style={{ marginLeft: 'auto' }} onClick={onDelete}>Delete project</button>}
      </div>
    </form>
  );
}

// One project: its tasks, updates and meetings. Shown from the Projects tab or from a pinned tab.
export function ProjectDetail({ project, onBack, ...props }) {
  const { me, role, profiles, tasks, projectUpdates, meetings, projects, actions } = props;
  const [editing, setEditing] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', due_date: '', assigned_to: [me.id] });
  const [update, setUpdate] = useState('');
  const owner = isOwner(role);
  const staff = isStaff(role);
  const members = profiles.filter((p) => (project.member_ids || []).includes(p.id));
  const ptasks = tasks.filter((t) => t.project_id === project.id);
  const open = ptasks.filter((t) => !t.done).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const done = ptasks.filter((t) => t.done);
  const updates = projectUpdates.filter((u) => u.project_id === project.id);
  const pct = ptasks.length ? Math.round((done.length / ptasks.length) * 100) : 0;

  async function addTask(e) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    await actions.addTask({ title: newTask.title.trim(), due_date: newTask.due_date || null, assigned_to: newTask.assigned_to, project_id: project.id, category: project.name });
    setNewTask({ title: '', due_date: '', assigned_to: [me.id] });
  }

  return (
    <>
      <div className="section-head">
        <div>
          {onBack && <button className="linkbtn" onClick={onBack} style={{ marginBottom: '6px' }}>&larr; All projects</button>}
          <h1>{project.name}</h1>
          <p>{project.description || 'No description yet.'}</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
            <ProjectStatusChip status={project.status} />
            <span className="chip neutral">{project.department}</span>
            {project.due_date && <span className="chip neutral">Target {fmtDate(project.due_date)}</span>}
            <MemberBadges project={project} profiles={profiles} />
            {project.link && <a className="filelink" href={project.link} target="_blank" rel="noopener noreferrer">Open link</a>}
          </div>
        </div>
        {owner && <button className="btn ghost" onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Edit project'}</button>}
      </div>

      {editing && (
        <ProjectForm
          initial={project} profiles={profiles} onCancel={() => setEditing(false)}
          onSave={async (row) => { await actions.saveProject(project.id, row); setEditing(false); }}
          onDelete={async () => { if (window.confirm(`Delete "${project.name}"? Its tasks stay on the Tasks tab.`)) { await actions.deleteProject(project.id); if (onBack) onBack(); } }}
        />
      )}

      <div className="panel" style={{ marginBottom: '16px' }}>
        <h3>Progress <span className="mono" style={{ fontSize: '12px' }}>{done.length} of {ptasks.length} tasks done</span></h3>
        <div className="meter"><span style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="grid2" style={{ marginBottom: '16px' }}>
        <div className="panel">
          <h3>Tasks</h3>
          {open.length ? open.map((t) => {
            const d = daysFromNow(t.due_date);
            return (
              <div className="rowline" key={t.id} style={{ flexWrap: 'wrap' }}>
                <label className="check" style={{ flex: 1, color: 'var(--ink)', fontSize: '13px' }}>
                  <input type="checkbox" checked={false} disabled={!staff} onChange={() => actions.toggleTask(t.id, true)} /> {t.title}
                </label>
                {(t.assigned_to || []).map((id) => profiles.find((p) => p.id === id)).filter(Boolean).map((p) => <span className="badge assignee" key={p.id}>{p.display_name}</span>)}
                {t.due_date && <span className="mono" style={{ fontSize: '11px', color: d < 0 ? 'var(--warn)' : 'var(--ink-soft)', fontWeight: d < 0 ? 700 : 400 }}>{d < 0 && '⚠ '}{fmtDate(t.due_date)}</span>}
              </div>
            );
          }) : <div className="empty">No open tasks on this project.</div>}
          {done.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ fontSize: '12px', color: 'var(--ink-soft)', cursor: 'pointer' }}>{done.length} finished</summary>
              {done.map((t) => (
                <div className="rowline" key={t.id} data-done="true">
                  <label className="check" style={{ flex: 1, fontSize: '13px' }}>
                    <input type="checkbox" checked disabled={!staff} onChange={() => actions.toggleTask(t.id, false)} /> {t.title}
                  </label>
                </div>
              ))}
            </details>
          )}
          {staff && (
            <form className="mini-form" style={{ marginTop: '10px' }} onSubmit={addTask}>
              <div className="row-actions">
                <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Add a task" style={{ flex: 1, minWidth: '160px' }} />
                <input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} aria-label="Due date" />
                <button className="btn sm accent" type="submit" disabled={!newTask.title.trim()}>Add</button>
              </div>
              <div className="checks" style={{ marginTop: '8px' }}>
                {members.map((p) => (
                  <label key={p.id}><input type="checkbox" checked={newTask.assigned_to.includes(p.id)} onChange={() => setNewTask({ ...newTask, assigned_to: toggleIn(newTask.assigned_to, p.id) })} /> {p.display_name}</label>
                ))}
              </div>
            </form>
          )}
        </div>

        <div className="stack">
          <MeetingsPanel me={me} role={role} meetings={meetings} profiles={profiles} projects={projects} actions={actions} projectId={project.id} title="Project meetings" />
          <div className="panel">
            <h3>Updates</h3>
            <form className="row-actions" style={{ marginBottom: '10px' }} onSubmit={async (e) => { e.preventDefault(); if (!update.trim()) return; await actions.addProjectUpdate(project.id, update.trim()); setUpdate(''); }}>
              <input type="text" value={update} onChange={(e) => setUpdate(e.target.value)} placeholder="Post a quick update for the team" style={{ flex: 1, minWidth: '160px' }} />
              <button className="btn sm accent" type="submit" disabled={!update.trim()}>Post</button>
            </form>
            {updates.length ? updates.map((u) => (
              <div key={u.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0', fontSize: '13px' }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{u.body}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '3px', display: 'flex', gap: '8px' }}>
                  <span>{profiles.find((p) => p.id === u.author)?.display_name || 'Someone'} · {fmtDate(u.created_at)}</span>
                  {(u.author === me.id || owner) && <button className="linkbtn" onClick={() => actions.deleteProjectUpdate(u.id)}>Delete</button>}
                </div>
              </div>
            )) : <div className="empty">No updates yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Projects(props) {
  const { role, profiles, projects, tasks, actions } = props;
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const owner = isOwner(role);
  const current = projects.find((p) => p.id === openId);
  if (current) return <ProjectDetail project={current} onBack={() => { setOpenId(null); window.scrollTo(0, 0); }} {...props} />;

  const sorted = [...projects].sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.name.localeCompare(b.name));
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Projects</h1>
          <p>{owner ? 'Every project. Each one is only visible to the people on it.' : 'The projects you are on.'}</p>
        </div>
        {owner && <button className="btn accent" onClick={() => setAdding(!adding)}>{adding ? 'Close' : '+ New project'}</button>}
      </div>
      {adding && (
        <ProjectForm
          profiles={profiles} onCancel={() => setAdding(false)}
          onSave={async (row) => { const made = await actions.addProject(row); if (made) { setAdding(false); setOpenId(made.id); } }}
        />
      )}
      {sorted.length ? (
        <div className="project-grid">
          {sorted.map((p) => {
            const pt = tasks.filter((t) => t.project_id === p.id);
            const doneCount = pt.filter((t) => t.done).length;
            const pct = pt.length ? Math.round((doneCount / pt.length) * 100) : 0;
            return (
              <div className="panel clickable" key={p.id} role="button" tabIndex={0} onClick={() => { setOpenId(p.id); window.scrollTo(0, 0); }} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(p.id); }}>
                <h3>{p.name} <ProjectStatusChip status={p.status} /></h3>
                <div style={{ fontSize: '13px', color: 'var(--ink-soft)', minHeight: '18px' }}>{p.description}</div>
                <div className="meter" style={{ margin: '10px 0 6px' }}><span style={{ width: `${pct}%` }} /></div>
                <div className="meter-row"><span>{doneCount} of {pt.length} tasks done</span><span>{p.due_date ? `Target ${fmtDate(p.due_date)}` : p.department}</span></div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}><MemberBadges project={p} profiles={profiles} /></div>
              </div>
            );
          })}
        </div>
      ) : <div className="panel"><div className="empty">{owner ? 'No projects yet. Create the first one.' : 'You are not on any projects yet.'}</div></div>}
    </>
  );
}
