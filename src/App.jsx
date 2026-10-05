import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isDemo } from './supabaseClient.js';
import { isOwner, isStaff, roleLabel } from './constants.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import MyTasks from './components/MyTasks.jsx';
import Series from './components/Series.jsx';
import Content from './components/Content.jsx';
import VideoDetail from './components/VideoDetail.jsx';
import CalendarView from './components/CalendarView.jsx';
import Requests from './components/Requests.jsx';
import Hours from './components/Hours.jsx';
import Team from './components/Team.jsx';
import { RolePill } from './components/Badges.jsx';

const EMPTY = {
  profiles: [], videos: [], internal: [], checklist: [], comments: [],
  tasks: [], contentItems: [], contentComments: [], requests: [], estimates: [], timeEntries: [], settings: null
};

function tabsFor(role) {
  const tabs = [['dashboard', 'Dashboard']];
  if (isStaff(role)) tabs.push(['tasks', 'Tasks']);
  tabs.push(['series', 'Series'], ['content', 'Content'], ['calendar', 'Calendar'], ['requests', 'Requests']);
  if (isOwner(role)) tabs.push(['hours', 'Hours'], ['team', 'Team']);
  return tabs;
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedVideoId, setSelectedVideoId] = useState(null);
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
    const [v, vi, ci, vc, t, ct, cc, r, re, te, bs] = await Promise.all([
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
      owner ? supabase.from('billing_settings').select('*').eq('id', 1).maybeSingle() : Promise.resolve({ data: null })
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
      requests: r.data || [],
      estimates: re.data || [],
      timeEntries: te.data || [],
      settings: bs.data || null
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) { setData(EMPTY); return undefined; }
    loadAll();
    const tables = ['profiles', 'videos', 'video_internal', 'checklist_items', 'video_comments', 'tasks', 'content_items', 'content_comments', 'requests', 'request_estimates', 'time_entries', 'billing_settings'];
    let ch = supabase.channel('nucoat-live');
    tables.forEach((table) => { ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, loadAll); });
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId, loadAll]);

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
  const tabs = tabsFor(role);
  const tab = tabs.some(([k]) => k === activeTab) ? activeTab : 'dashboard';

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
    // content calendar
    async addContent(row) {
      const res = await supabase.from('content_items').insert({ ...row, created_by: userId });
      if (res.error) say(res.error.message); else loadAll();
      return res;
    },
    saveContent: (id, patch) => run(supabase.from('content_items').update(patch).eq('id', id)),
    deleteContent: (id) => run(supabase.from('content_items').delete().eq('id', id)),
    submitContent: (ids) => run(supabase.from('content_items').update({ status: 'in_review' }).in('id', ids)),
    reviewContent: (id, decision, note) => run(supabase.rpc('review_content', { p_item: id, p_decision: decision, p_note: note || '' })),
    addContentComment: (id, body) => run(supabase.from('content_comments').insert({ content_id: id, author: userId, kind: 'comment', body })),
    deleteContentComment: (id) => run(supabase.from('content_comments').delete().eq('id', id)),
    // requests
    addRequest: (row) => run(supabase.from('requests').insert({ ...row, requested_by: userId, status: 'submitted' })),
    updateRequest: (id, patch) => run(supabase.from('requests').update(patch).eq('id', id)),
    deleteRequest: (id) => run(supabase.from('requests').delete().eq('id', id)),
    setEstimate: (requestId, hours) => run(supabase.from('request_estimates').upsert({ request_id: requestId, estimate_hours: hours }, { onConflict: 'request_id' })),
    // hours (owner)
    addTime: (row) => run(supabase.from('time_entries').insert(row)),
    deleteTime: (id) => run(supabase.from('time_entries').delete().eq('id', id)),
    saveSettings: (patch) => run(supabase.from('billing_settings').update(patch).eq('id', 1)),
    // people
    updateProfile: (id, patch) => run(supabase.from('profiles').update(patch).eq('id', id))
  };

  function openVideo(id) {
    setActiveTab('series');
    setSelectedVideoId(id);
    window.scrollTo(0, 0);
  }
  function goTab(key) {
    setActiveTab(key);
    setSelectedVideoId(null);
    window.scrollTo(0, 0);
  }
  async function saveDisplayName() {
    const val = nameInput.trim();
    setEditingName(false);
    if (val && val !== me.display_name) await actions.updateProfile(userId, { display_name: val });
  }

  const common = { role, me, ...data, actions, openVideo, goTab };
  const selectedVideo = selectedVideoId ? data.videos.find((v) => v.id === selectedVideoId) : null;

  return (
    <div id="app">
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
          <div className="mark">NC</div>
          <div>
            <div className="name disp">NuCoat Ops</div>
            <span className="tag">Content Ops</span>
          </div>
        </div>
        <nav className="tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => goTab(key)}>{label}</button>
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
          <RolePill role={role} />
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard {...common} />}
        {tab === 'tasks' && <MyTasks {...common} />}
        {tab === 'series' && (selectedVideo
          ? <VideoDetail key={selectedVideo.id} video={selectedVideo} {...common} onBack={() => setSelectedVideoId(null)} />
          : <Series {...common} />)}
        {tab === 'content' && <Content {...common} />}
        {tab === 'calendar' && <CalendarView {...common} />}
        {tab === 'requests' && <Requests {...common} />}
        {tab === 'hours' && <Hours {...common} />}
        {tab === 'team' && <Team {...common} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
