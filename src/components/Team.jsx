import React from 'react';
import { ROLES } from '../constants.js';

const ROLE_HELP = {
  owner: 'Sees everything, including hours and billing.',
  editor: 'Edits everything, has a task list, and approves Alistair’s posts and videos. Never sees hours or billing.',
  reviewer: 'Outside viewer. Sees status, scripts and posts, comments, approves. Cannot edit or see tasks.'
};

export default function Team({ me, profiles, actions }) {
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Team</h1>
          <p>Choose what each person can do. Changes apply the next time they load the app.</p>
        </div>
      </div>
      <div className="panel" style={{ marginBottom: '16px' }}>
        <h3>People</h3>
        {profiles.map((p) => (
          <div className="rowline" key={p.id} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <input
                type="text" defaultValue={p.display_name} style={{ fontWeight: 700, width: '100%', maxWidth: '240px' }}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.display_name) actions.updateProfile(p.id, { display_name: v }); }}
              />
              <div style={{ color: 'var(--ink-soft)', fontSize: '12px', marginTop: '4px' }}>{ROLE_HELP[p.role]}</div>
            </div>
            <select value={p.role} disabled={p.id === me.id} onChange={(e) => actions.updateProfile(p.id, { role: e.target.value })} title={p.id === me.id ? 'You cannot change your own role' : ''}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Adding someone new</h3>
        <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.7, fontSize: '13.5px' }}>
          <li>In Supabase, open <b>Authentication, then Users, then Add user</b>, and create their login.</li>
          <li>They appear here as an <b>Editor</b> automatically. Jodi, Marcel and Brady should all be Editors.</li>
          <li>Any Editor can approve Alistair’s posts and videos, so approvals do not have to wait on one person.</li>
        </ol>
      </div>
    </>
  );
}
