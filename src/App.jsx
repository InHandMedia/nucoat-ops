import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isDemo } from './supabaseClient.js';
import { isOwner, isStaff, roleLabel } from './constants.js';
import { tabsFor, tabOn } from './workspace.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import MyTasks from './components/MyTasks.jsx';
import Series from './components/Series.jsx';
import Content from './components/Content.jsx';
import Metrics from './components/Metrics.jsx';
import VideoDetail from './components/VideoDetail.jsx';
import CalendarView from './components/CalendarView.jsx';
import Requests from './components/Requests.jsx';
import Hours from './components/Hours.jsx';
import Team from './components/Team.jsx';
import Projects, { ProjectDetail } from './components/Projects.jsx';
import Mini from './components/Mini.jsx';
import { RolePill } from './components/Badges.jsx';

const EMPTY = {
  profiles: [], videos: [], internal: [], checklist: [], comments: [],
  tasks: [], contentItems: [], contentComments: [], metrics: [], metricEntries: [], requests: [], estimates: [], timeEntries: [], notes: [], settings: null,
  projects: [], projectUpdates: [], meetings: [], customTabs: [], upgraded: true
};

const isMini = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mini');

// An extra tab the owner added: a web page shown inside the app, or a link out.
function CustomTabView({ tab }) {
  return (
    <>
      <div className="section-head">
        <div><h1>{tab.label}</h1></div>
        <a className="btn ghost" href={tab.url} target="_blank" rel="noopener noreferrer">Open in a new window</a>
      </div>
      {tab.mode === 'embed'
        ? <iframe className="embed-frame" src={tab.url} title={tab.label} />
        : <div className="panel"><div className="empty">This page opens in its own window. Use the button above.</div></div>}
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [dashKey, setDashKey] = useState(0); // bumping this resets the dashboard to its main view
  const [data, setData] = useState(EMPTY);
  const [toast, setToast] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const { data: profiles } = await supabase.from('profiles').select('*');
    const role = (profiles || []).find((p) => p.id === userId)?.role;
    const staff = isStaff(role);
    const owner = isOwner(role);
    const empty = Promise.resolve({ data: [] });
    const [v, vi, ci, vc, t, ct, cc, r, re, te, bs, mt, me, nt, pj, pu, mg, cu] = await Promise.all([
      supabase.from('videos').select('*').order('number', { ascending: true }),
      staff ? supabase.from('video_internal').select('*') : empty,
      staff ? supabase.from('checklist_items').select('*').order('position', { ascending: true }) : empty,
      supabase.from('video_comments').select('*').order('created_at', { ascending: true }),
      staff ? supabase.from('tasks').select('*').order('created_at', { ascending: false }) : empty,
      supabase.from('content_items').select('*').order('publish_date', { ascending: true }),
      supabase.from('content_comments').select('*').order('created_at', { ascending: true }),
      supabase.from('requests').select('*').order('created_at', { ascending: false }),
      owner ? supabase.from('request_estimates').select('*') : empty,
      owner ? supabase.from('time_entries').select('*').order('entry_date', { ascending: false }) : empty,
      owner ? supabase.from('billing_settings').select('*').eq('id', 1).maybeSingle() : Promise.resolve({ data: null }),
      staff ? supabase.from('metrics').select('*').order('position', { ascending: true }) : empty,
      staff ? supabase.from('metric_entries').select('*').order('entry_date', { ascending: true }) : empty,
      supabase.from('notes').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: true }),
      supabase.from('project_updates').select('*').order('created_at', { ascending: false }),
      supabase.from('meetings').select('*').order('starts_at', { ascending: true }),
      supabase.from('custom_tabs').select('*').order('position', { ascending: true })
    ]);
    setData({
      profiles: profiles || [],
      videos: v.data || [],
      internal: vi.data || [],
      checklist: ci.data || [],
      comments: vc.data || [],
      tasks: t.data || [],
      contentItems: ct.data || [],
      contentComments: cc.data || [],
      metrics: mt.data || [],
      metricEntries: me.data || [],
      requests: r.data || [],
      estimates: re.data || [],
      timeEntries: te.data || [],
      notes: nt.data || [],
      settings: bs.data || null,
      projects: pj.data || [],
      projectUpdates: pu.data || [],
      meetings: mg.data || [],
      customTabs: cu.data || [],
      // false until supabase/migration_07_workspace.sql has been run
      upgraded: !pj.error && !mg.error
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) { setData(EMPTY); return undefined; }
    loadAll();
    const tables = ['profiles', 'videos', 'video_internal', 'checklist_items', 'video_comments', 'tasks', 'content_items', 'content_comments', 'metrics', 'metric_entries', 'requests', 'request_estimates', 'time_entries', 'billing_settings', 'notes', 'projects', 'project_updates', 'meetings', 'custom_tabs'];
    let ch = supabase.channel('nucoat-live');
    tables.forEach((table) => { ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, loadAll); });
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId, loadAll]);

  // Presence for the live team view: note when this person was last here.
  const upgraded = data.upgraded && data.profiles.length > 0;
  useEffect(() => {
    if (!userId || !upgraded) return undefined;
    const ping = () => {
      if (document.visibilityState === 'visible') supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {});
    };
    ping();
    const timer = setInterval(ping, 5 * 60000);
    return () => clearInterval(timer);
  }, [userId, upgraded]);

  function say(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }
  async function run(promise) {
    const res = await promise;
    if (res?.error) say(res.error.message || 'Something went wrong');
    else loadAll();
    return res;
  }

  if (session === undefined) return null;
  if (!session) return <Login />;

  const me = data.profiles.find((p) => p.id === userId);
  const role = me?.role;
  if (!me) return null; // profile still loading
  const tabs = tabsFor(me, data.projects, data.customTabs).filter(([k]) => data.upgraded || k !== 'projects');
  const tab = tabs.some(([k]) => k === activeTab) ? activeTab : 'dashboard';
  // shows.series etc: is that tab switched on for me? Dashboard and Calendar use it to hide panels.
  const shows = new Proxy({}, { get: (_t, key) => tabOn(me, key) });

  const actions = {
    // videos
    async createVideo(row) {
      const res = await supabase.from('videos').insert({ ...row, created_by: userId }).select().single();
      if (res.error) say(res.error.message); else loadAll();
      return res.data;
    },
    saveVideo: (id, patch) => run(supabase.from('videos').update(patch).eq('id', id)),
    deleteVideo: (id) => run(supabase.from('videos').delete().eq('id', id)),
    saveInternal: (videoId, notes) => run(supabase.from('video_internal').upsert({ video_id: videoId, notes }, { onConflict: 'video_id' })),
    reviewVideo: (videoId, decision, note) => run(supabase.rpc('review_video', { p_video: videoId, p_decision: decision, p_note: note || '' })),
    // checklist
    toggleCheck: (id, done) => run(supabase.from('checklist_items').update({ done }).eq('id', id)),
    addCheck: (videoId, title, position) => run(supabase.from('checklist_items').insert({ video_id: videoId, title, position })),
    deleteCheck: (id) => run(supabase.from('checklist_items').delete().eq('id', id)),
    // comments
    addComment: (videoId, body) => run(supabase.from('video_comments').insert({ video_id: videoId, author: userId, kind: 'comment', body })),
    deleteComment: (id) => run(supabase.from('video_comments').delete().eq('id', id)),
    // tasks
    addTask: (row) => run(supabase.from('tasks').insert({ ...row, created_by: userId })),
    toggleTask: (id, done) => run(supabase.from('tasks').update({ done }).eq('id', id)),
    deleteTask: (id) => run(supabase.from('tasks').delete().eq('id', id)),
    updateTask: (id, patch) => run(supabase.from('tasks').update(patch).eq('id', id)),
    async updateTasks(list) {
      const results = await Promise.all(list.map(([id, patch]) => supabase.from('tasks').update(patch).eq('id', id)));
      const bad = results.find((r) => r?.error);
      if (bad) say(bad.error.message); else say(`Linked ${list.length} task${list.length === 1 ? '' : 's'}`);
      loadAll();
    },
    // content calendar
    async addContent(row) {
      const res = await supabase.from('content_items').insert({ ...row, created_by: userId });
      if (res.error) say(res.error.message); else loadAll();
      return res;
    },
    saveContent: (id, patch) => run(supabase.from('content_items').update(patch).eq('id', id)),
    deleteContent: (id) => run(supabase.from('content_items').delete().eq('id', id)),
    deleteContentMany: (ids) => run(supabase.from('content_items').delete().in('id', ids)),
    submitContent: (ids) => run(supabase.from('content_items').update({ status: 'in_review' }).in('id', ids)),
    reviewContent: (id, decision, note) => run(supabase.rpc('review_content', { p_item: id, p_decision: decision, p_note: note || '' })),
    async approveContentMany(ids) {
      const results = await Promise.all(ids.map((id) => supabase.rpc('review_content', { p_item: id, p_decision: 'approved', p_note: '' })));
      const bad = results.find((r) => r?.error);
      say(bad ? bad.error.message : `Approved ${ids.length} post${ids.length === 1 ? '' : 's'}`);
      loadAll();
    },
    addContentComment: (id, body) => run(supabase.from('content_comments').insert({ content_id: id, author: userId, kind: 'comment', body })),
    deleteContentComment: (id) => run(supabase.from('content_comments').delete().eq('id', id)),
    // metrics
    addMetric: (row) => run(supabase.from('metrics').insert({ ...row, created_by: userId })),
    saveMetric: (id, patch) => run(supabase.from('metrics').update(patch).eq('id', id)),
    deleteMetric: (id) => run(supabase.from('metrics').delete().eq('id', id)),
    addEntry: (row) => run(supabase.from('metric_entries').insert({ ...row, created_by: userId })),
    deleteEntry: (id) => run(supabase.from('metric_entries').delete().eq('id', id)),
    // requests
    addRequest: (row) => run(supabase.from('requests').insert({ ...row, requested_by: userId, status: 'submitted' })),
    updateRequest: (id, patch) => run(supabase.from('requests').update(patch).eq('id', id)),
    deleteRequest: (id) => run(supabase.from('requests').delete().eq('id', id)),
    setEstimate: (requestId, hours) => run(supabase.from('request_estimates').upsert({ request_id: requestId, estimate_hours: hours }, { onConflict: 'request_id' })),
    // hours (owner)
    addTime: (row) => run(supabase.from('time_entries').insert(row)),
    deleteTime: (id) => run(supabase.from('time_entries').delete().eq('id', id)),
    saveSettings: (patch) => run(supabase.from('billing_settings').update(patch).eq('id', 1)),
    // notes and pins
    addNote: (row) => run(supabase.from('notes').insert({ ...row, author: userId })),
    saveNote: (id, patch) => run(supabase.from('notes').update(patch).eq('id', id)),
    deleteNote: (id) => run(supabase.from('notes').delete().eq('id', id)),
    // projects
    async addProject(row) {
      const res = await supabase.from('projects').insert({ ...row, created_by: userId }).select().single();
      if (res.error) say(res.error.message); else loadAll();
      return res.data;
    },
    saveProject: (id, patch) => run(supabase.from('projects').update(patch).eq('id', id)),
    deleteProject: (id) => run(supabase.from('projects').delete().eq('id', id)),
    addProjectUpdate: (projectId, body) => run(supabase.from('project_updates').insert({ project_id: projectId, author: userId, body })),
    deleteProjectUpdate: (id) => run(supabase.from('project_updates').delete().eq('id', id)),
    // meetings
    async addMeeting(row) {
      const res = await supabase.from('meetings').insert({ ...row, created_by: userId }).select().single();
      if (res.error) say(res.error.message); else loadAll();
      return res.data;
    },
    saveMeeting: (id, patch) => run(supabase.from('meetings').update(patch).eq('id', id)),
    deleteMeeting: (id) => run(supabase.from('meetings').delete().eq('id', id)),
    // extra tabs (owner)
    addCustomTab: (row) => run(supabase.from('custom_tabs').insert(row)),
    deleteCustomTab: (id) => run(supabase.from('custom_tabs').delete().eq('id', id)),
    // people
    updateProfile: (id, patch) => run(supabase.from('profiles').update(patch).eq('id', id))
  };

  function openVideo(id) {
    setActiveTab('series');
    setSelectedVideoId(id);
    window.scrollTo(0, 0);
  }
  function goTab(key) {
    if (key === 'dashboard') setDashKey((n) => n + 1);
    setActiveTab(key);
    setSelectedVideoId(null);
    window.scrollTo(0, 0);
  }
  async function saveDisplayName() {
    const val = nameInput.trim();
    setEditingName(false);
    if (val && val !== me.display_name) await actions.updateProfile(userId, { display_name: val });
  }

  const common = { role, me, ...data, actions, openVideo, goTab, shows };
  if (isMini) return <Mini {...common} />;
  const pinnedProject = tab.startsWith('project:') ? data.projects.find((p) => p.id === tab.slice(8)) : null;
  const customTab = tab.startsWith('custom:') ? data.customTabs.find((t) => t.id === tab.slice(7)) : null;
  const selectedVideo = selectedVideoId ? data.videos.find((v) => v.id === selectedVideoId) : null;

  return (
    <div id="app" className={me.show_done_green ? 'green-done' : ''}>
      {isDemo && (
        <div className="demo-banner">
          <b>Demo mode</b>: sample data, nothing is saved. Viewing as{' '}
          <select value={userId} onChange={(e) => { supabase.demoSignInAs(e.target.value); goTab('dashboard'); }} style={{ padding: '2px 6px', fontSize: '12px' }}>
            {supabase.demoUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({roleLabel(u.role)})</option>)}
          </select>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/nucoat-logo.png" alt="NuCoat" />
          <span className="ops">Ops</span>
        </div>
        <nav className="tabs">
          {tabs.map(([key, label, kind]) => (
            <button key={key} className={`${tab === key ? 'active' : ''} ${kind ? `tab-${kind}` : ''}`} onClick={() => goTab(key)}>{label}</button>
          ))}
        </nav>
        <div className="viewer-chip">
          <div className="who">{(me.display_name || '?').slice(0, 1).toUpperCase()}</div>
          {editingName ? (
            <>
              <input
                type="text" autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{ width: '100px', padding: '4px 6px', fontSize: '12px' }}
              />
              <button className="iconbtn" style={{ width: '24px', height: '24px', fontSize: '11px' }} onClick={saveDisplayName}>&#10003;</button>
            </>
          ) : (
            <span title="Click to rename yourself" style={{ cursor: 'pointer' }} onClick={() => { setNameInput(me.display_name || ''); setEditingName(true); }}>
              {me.display_name}
            </span>
          )}
          <RolePill role={role} title={me.title} />
          <button
            type="button" className={`greentoggle ${me.show_done_green ? 'on' : ''}`} aria-pressed={!!me.show_done_green}
            title="Show finished tasks, posts and videos in green. Only changes your own view."
            onClick={() => actions.updateProfile(userId, { show_done_green: !me.show_done_green })}
          ><i />Green</button>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard key={dashKey} {...common} />}
        {tab === 'tasks' && <MyTasks {...common} />}
        {tab === 'series' && (selectedVideo
          ? <VideoDetail key={selectedVideo.id} video={selectedVideo} {...common} onBack={() => setSelectedVideoId(null)} />
          : <Series {...common} />)}
        {tab === 'content' && <Content {...common} />}
        {tab === 'calendar' && <CalendarView {...common} />}
        {tab === 'metrics' && <Metrics {...common} />}
        {tab === 'requests' && <Requests {...common} />}
        {tab === 'hours' && <Hours {...common} />}
        {tab === 'team' && <Team {...common} />}
        {tab === 'projects' && <Projects {...common} />}
        {pinnedProject && <ProjectDetail key={pinnedProject.id} project={pinnedProject} {...common} />}
        {customTab && <CustomTabView key={customTab.id} tab={customTab} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
