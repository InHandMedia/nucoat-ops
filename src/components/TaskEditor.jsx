import React, { useState } from 'react';
import { effectiveAssignees, outsideLabel } from '../people.js';

export function toggleIn(list, x) {
  return list.includes(x) ? list.filter((i) => i !== x) : [...list, x];
}

// Full edit form for one task. Used on the Tasks tab, the Dashboard and inside a video.
export default function TaskEditor({ t, ids, outside, staffPeople, videos, categories, onSave, onCancel }) {
  const [f, setF] = useState({
    title: t.title, notes: t.notes || '', category: t.category || '', due_date: t.due_date || '',
    video_id: t.video_id || '', owner_label: outside || '', assigned_to: ids
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  function submit(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    onSave({
      title: f.title.trim(), notes: f.notes, category: f.category.trim(), due_date: f.due_date || null,
      video_id: f.video_id || null, owner_label: f.owner_label.trim(), assigned_to: f.assigned_to
    });
  }
  return (
    <form className="mini-form" style={{ flexBasis: '100%' }} onSubmit={submit}>
      <div className="field"><label>Task</label><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></div>
      <div className="field"><label>Notes</label><textarea rows="2" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      <div className="two-col">
        <div className="field"><label>Due date</label><input type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
        <div className="field">
          <label>Category</label>
          <input type="text" list="task-cats" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Social, SEO" />
          <datalist id="task-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </div>
      <div className="two-col">
        <div className="field">
          <label>Video</label>
          <select value={f.video_id} onChange={(e) => set('video_id', e.target.value)}>
            <option value="">Not tied to a video</option>
            {videos.map((v) => <option key={v.id} value={v.id}>#{String(v.number).padStart(2, '0')} {v.title}</option>)}
          </select>
        </div>
        <div className="field"><label>Other owner (not in the app)</label><input type="text" value={f.owner_label} onChange={(e) => set('owner_label', e.target.value)} placeholder="e.g. Alex, Jake" /></div>
      </div>
      <div className="field">
        <label>Assigned to</label>
        <div className="checks">
          {staffPeople.map((p) => (
            <label key={p.id}><input type="checkbox" checked={f.assigned_to.includes(p.id)} onChange={() => set('assigned_to', toggleIn(f.assigned_to, p.id))} /> {p.display_name}</label>
          ))}
        </div>
      </div>
      <div className="row-actions">
        <button className="btn sm accent" type="submit">Save changes</button>
        <button className="btn sm ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// Convenience wrapper: works out the current assignees from the task + people, saves through actions.
export function TaskEditorFor({ t, profiles, videos, tasks, actions, onClose }) {
  const staffPeople = profiles.filter((p) => p.role !== 'reviewer');
  const categories = [...new Set((tasks || []).map((x) => x.category).filter(Boolean))].sort();
  return (
    <TaskEditor
      t={t} ids={effectiveAssignees(t, profiles)} outside={outsideLabel(t, profiles)}
      staffPeople={staffPeople} videos={videos} categories={categories}
      onCancel={onClose}
      onSave={async (patch) => { await actions.updateTask(t.id, patch); onClose(); }}
    />
  );
}
