// A tiny in-memory stand-in for the Supabase client, used when no Supabase keys are
// configured (or ?demo is in the URL). It mimics the permission rules from schema.sql
// so every role can be tested without any setup. Data resets on refresh.
import { buildSeed, DEMO_USERS, CHECKLIST_TEMPLATE } from './demoData.js';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}${Date.now()}`);
const nowISO = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

export function createDemoClient() {
  const db = buildSeed();
  let currentUserId = null;
  const authListeners = new Set();
  const channels = new Set();

  const me = () => db.profiles.find((p) => p.id === currentUserId);
  const role = () => me()?.role;
  const isOwner = () => role() === 'owner';
  const isStaff = () => role() === 'owner' || role() === 'editor';

  const OWNER_ONLY = ['request_estimates', 'time_entries', 'billing_settings'];
  const STAFF_ONLY = ['video_internal', 'checklist_items', 'tasks', 'metrics', 'metric_entries'];

  function canRead(table) {
    if (!currentUserId) return false;
    if (OWNER_ONLY.includes(table)) return isOwner();
    if (STAFF_ONLY.includes(table)) return isStaff();
    return true;
  }

  function canWrite(table, op, row, patch) {
    if (!currentUserId) return false;
    if (OWNER_ONLY.includes(table)) return isOwner();
    if (STAFF_ONLY.includes(table) || table === 'videos' || table === 'content_items') return isStaff();
    if (table === 'profiles') {
      if (isOwner()) return true;
      return row.id === currentUserId && !(patch && 'role' in patch && patch.role !== row.role);
    }
    if (table === 'video_comments' || table === 'content_comments') {
      if (op === 'insert') return row.author === currentUserId && row.kind === 'comment';
      return row.author === currentUserId || isOwner();
    }
    if (table === 'requests') {
      if (isOwner()) return true;
      if (op === 'insert') return row.requested_by === currentUserId && row.status === 'submitted';
      return row.requested_by === currentUserId && row.status === 'submitted' && (!patch || !patch.status || patch.status === 'submitted');
    }
    return false;
  }

  const defaults = {
    videos: () => ({ id: uid(), stage: 'script', brand: 'NuCoat', formats: ['long', 'short'], talent: 'Jodi', summary: '', script: '', shot_list: '', long_link: '', short_link: '', approval_status: 'none', waiting_on_brady: false, waiting_note: '', assigned_to: [], created_by: currentUserId, created_at: nowISO(), updated_at: nowISO() }),
    tasks: () => ({ id: uid(), assigned_to: [], done: false, video_id: null, due_date: null, created_by: currentUserId, created_at: nowISO() }),
    requests: () => ({ id: uid(), details: '', kind: 'graphic_design', status: 'submitted', requested_by: currentUserId, due_date: null, video_id: null, decline_reason: '', created_at: nowISO(), updated_at: nowISO() }),
    time_entries: () => ({ id: uid(), kind: 'content', video_id: null, request_id: null, note: '', entry_date: new Date().toISOString().slice(0, 10), created_at: nowISO() }),
    video_comments: () => ({ id: uid(), author: currentUserId, kind: 'comment', body: '', created_at: nowISO() }),
    checklist_items: () => ({ id: uid(), done: false, position: 99, created_at: nowISO() }),
    content_items: () => ({ id: uid(), brand: 'NuCoat', channel: 'instagram', kind: 'other', brief: '', caption: '', asset_link: '', notes: '', video_id: null, status: 'draft', created_by: currentUserId, reviewed_by: null, reviewed_at: null, created_at: nowISO(), updated_at: nowISO() }),
    content_comments: () => ({ id: uid(), author: currentUserId, kind: 'comment', body: '', created_at: nowISO() }),
    metrics: () => ({ id: uid(), brand: 'NuCoat', detail: '', unit: '', kind: 'number', rollup: 'latest', baseline: null, target: null, target_label: '', relative: false, monthly_targets: null, target_date: null, owner_label: '', notes: '', position: 99, created_by: currentUserId, created_at: nowISO() }),
    metric_entries: () => ({ id: uid(), note: '', entry_date: new Date().toISOString().slice(0, 10), created_by: currentUserId, created_at: nowISO() })
  };

  function notify(table) {
    setTimeout(() => {
      channels.forEach((ch) => ch.handlers.forEach((h) => { if (h.table === table) h.cb({ table, eventType: '*' }); }));
    }, 0);
  }

  function afterVideoInsert(v) {
    CHECKLIST_TEMPLATE.forEach((title, i) => db.checklist_items.push({ id: uid(), video_id: v.id, title, done: false, position: i + 1, created_at: nowISO() }));
    db.video_internal.push({ video_id: v.id, notes: '' });
    notify('checklist_items');
    notify('video_internal');
  }

  function beforeVideoUpdate(old, next) {
    next.updated_at = nowISO();
    if (next.stage !== old.stage && (next.stage === 'client_approval' || next.stage === 'client_review')) {
      next.approval_status = 'pending';
      next.waiting_on_brady = true;
    }
  }

  const ok = (data) => ({ data, error: null });
  const err = (message) => ({ data: null, error: { message } });

  function matches(row, filters) {
    return filters.every(([c, v, list]) => (c === '__in' ? list.includes(row[v]) : row[c] === v));
  }

  // Mirrors the content_guard trigger in schema.sql.
  function contentGuard(old, next, viaRpc) {
    next.updated_at = nowISO();
    if (!old) {
      if (!['draft', 'in_review'].includes(next.status)) return 'New posts start as a draft';
      return null;
    }
    if (next.status !== old.status && !viaRpc) {
      if (['approved', 'changes_requested'].includes(next.status)) return 'Use Approve / Request changes to review a post';
      if (['scheduled', 'posted'].includes(next.status) && !['approved', 'scheduled', 'posted'].includes(old.status)) return 'A post must be approved before it is scheduled';
    }
    if (!viaRpc && ['approved', 'scheduled', 'posted'].includes(old.status) && next.status === old.status
      && ['caption', 'asset_link', 'title', 'publish_date', 'channel'].some((k) => next[k] !== old[k])) {
      next.status = 'in_review'; next.reviewed_by = null; next.reviewed_at = null;
    }
    return null;
  }

  function exec(q) {
    const { table, op, filters } = q;
    if (!db[table]) return err(`Unknown table ${table}`);

    if (op === 'select') {
      if (!canRead(table)) return ok(q.single || q.maybe ? null : []);
      let rows = db[table].filter((r) => matches(r, filters));
      if (q.order) {
        const [c, asc] = q.order;
        rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      }
      rows = clone(rows);
      return ok(q.single || q.maybe ? rows[0] || null : rows);
    }

    if (op === 'insert' || op === 'upsert') {
      const list = Array.isArray(q.payload) ? q.payload : [q.payload];
      const out = [];
      for (const raw of list) {
        let row = { ...(defaults[table] ? defaults[table]() : {}), ...raw };
        if (op === 'upsert') {
          const key = q.onConflict || 'id';
          const existing = db[table].find((r) => r[key] === row[key]);
          if (existing) {
            if (!canWrite(table, 'update', existing, raw)) return err('Permission denied (row level security)');
            Object.assign(existing, raw);
            out.push(existing);
            continue;
          }
        }
        if (!canWrite(table, 'insert', row)) return err('Permission denied (row level security)');
        if (table === 'content_items') { const e = contentGuard(null, row, false); if (e) return err(e); }
        db[table].push(row);
        if (table === 'videos') afterVideoInsert(row);
        out.push(row);
      }
      notify(table);
      return ok(q.returning ? clone(q.single ? out[0] : out) : null);
    }

    if (op === 'update') {
      const rows = db[table].filter((r) => matches(r, filters));
      for (const r of rows) {
        if (!canWrite(table, 'update', r, q.payload)) return err('Permission denied (row level security)');
        if (table === 'content_items') { const e = contentGuard(r, { ...r, ...q.payload }, false); if (e) return err(e); }
      }
      rows.forEach((r) => {
        const next = { ...r, ...q.payload };
        if (table === 'content_items') contentGuard(r, next, false);
        if (table === 'videos') beforeVideoUpdate(r, next);
        if (table === 'requests') next.updated_at = nowISO();
        Object.assign(r, next);
      });
      notify(table);
      return ok(q.returning ? clone(rows) : null);
    }

    if (op === 'delete') {
      const rows = db[table].filter((r) => matches(r, filters));
      for (const r of rows) {
        if (!canWrite(table, 'delete', r)) return err('Permission denied (row level security)');
      }
      db[table] = db[table].filter((r) => !rows.includes(r));
      // cascades
      if (table === 'videos') {
        const ids = rows.map((r) => r.id);
        db.checklist_items = db.checklist_items.filter((c) => !ids.includes(c.video_id));
        db.video_internal = db.video_internal.filter((c) => !ids.includes(c.video_id));
        db.video_comments = db.video_comments.filter((c) => !ids.includes(c.video_id));
        db.tasks.forEach((t) => { if (ids.includes(t.video_id)) t.video_id = null; });
        db.content_items.forEach((t) => { if (ids.includes(t.video_id)) t.video_id = null; });
        ['checklist_items', 'video_internal', 'video_comments', 'tasks'].forEach(notify);
      }
      if (table === 'metrics') {
        const ids = rows.map((r) => r.id);
        db.metric_entries = db.metric_entries.filter((e) => !ids.includes(e.metric_id));
        notify('metric_entries');
      }
      if (table === 'content_items') {
        const ids = rows.map((r) => r.id);
        db.content_comments = db.content_comments.filter((c) => !ids.includes(c.content_id));
        notify('content_comments');
      }
      if (table === 'requests') {
        const ids = rows.map((r) => r.id);
        db.request_estimates = db.request_estimates.filter((c) => !ids.includes(c.request_id));
        notify('request_estimates');
      }
      notify(table);
      return ok(null);
    }
    return err('Unsupported');
  }

  function from(table) {
    const q = { table, op: 'select', filters: [], order: null, payload: null, single: false, maybe: false, returning: false };
    const api = {
      select() { q.returning = true; return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      delete() { q.op = 'delete'; return api; },
      upsert(p, opts) { q.op = 'upsert'; q.payload = p; q.onConflict = opts?.onConflict; return api; },
      eq(c, v) { q.filters.push([c, v]); return api; },
      in(c, list) { q.filters.push(['__in', c, list]); return api; },
      order(c, o) { q.order = [c, o?.ascending !== false]; return api; },
      single() { q.single = true; return api; },
      maybeSingle() { q.maybe = true; return api; },
      then(res, rej) { return Promise.resolve().then(() => exec(q)).then(res, rej); }
    };
    return api;
  }

  async function rpc(name, args) {
    if (name === 'review_content') {
      if (!['reviewer', 'editor', 'owner'].includes(role())) return err('You do not have permission to approve');
      const c = db.content_items.find((x) => x.id === args.p_item);
      if (!c) return err('Post not found');
      if (c.created_by === currentUserId) return err('You cannot approve a post you created. Another editor needs to review it.');
      if (c.status !== 'in_review') return err('This post is not waiting for approval');
      c.status = args.p_decision === 'approved' ? 'approved' : 'changes_requested';
      c.reviewed_by = currentUserId; c.reviewed_at = nowISO(); c.updated_at = nowISO();
      db.content_comments.push({ id: uid(), content_id: c.id, author: currentUserId, kind: args.p_decision, body: args.p_note || '', created_at: nowISO() });
      notify('content_items'); notify('content_comments');
      return ok(null);
    }
    if (name !== 'review_video') return err('Unknown function');
    if (!['reviewer', 'editor', 'owner'].includes(role())) return err('You do not have permission to approve');
    const v = db.videos.find((x) => x.id === args.p_video);
    if (!v) return err('Video not found');
    if (!['client_approval', 'client_review'].includes(v.stage)) return err('This video is not waiting for review');
    if (args.p_decision === 'approved') {
      v.stage = v.stage === 'client_approval' ? 'shoot' : 'delivered';
      v.approval_status = 'approved';
    } else {
      v.stage = v.stage === 'client_approval' ? 'script' : 'edit';
      v.approval_status = 'changes_requested';
    }
    v.waiting_on_brady = false;
    v.updated_at = nowISO();
    db.video_comments.push({ id: uid(), video_id: v.id, author: currentUserId, kind: args.p_decision, body: args.p_note || '', created_at: nowISO() });
    notify('videos');
    notify('video_comments');
    return ok(null);
  }

  const session = () => (currentUserId ? { user: { id: currentUserId, email: me()?.email || DEMO_USERS.find((u) => u.id === currentUserId)?.email } } : null);
  const emitAuth = () => authListeners.forEach((cb) => cb('SIGNED_IN', session()));

  return {
    isDemo: true,
    demoUsers: DEMO_USERS,
    demoSignInAs(userId) { currentUserId = userId; emitAuth(); },
    from,
    rpc,
    auth: {
      async getSession() { return { data: { session: session() } }; },
      onAuthStateChange(cb) {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
      },
      async signInWithPassword({ email }) {
        const u = DEMO_USERS.find((x) => x.email === email);
        if (!u) return { error: { message: 'Demo accounts only' } };
        currentUserId = u.id; emitAuth();
        return { error: null };
      },
      async signOut() { currentUserId = null; authListeners.forEach((cb) => cb('SIGNED_OUT', null)); }
    },
    channel() {
      const ch = { handlers: [] };
      const api = {
        on(_type, filter, cb) { ch.handlers.push({ table: filter.table, cb }); return api; },
        subscribe() { channels.add(ch); return api; },
        _ch: ch
      };
      return api;
    },
    removeChannel(api) { channels.delete(api._ch); }
  };
}
