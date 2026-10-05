// ---------- roles ----------
export const ROLES = [
  { key: 'owner', label: 'Owner' },
  { key: 'editor', label: 'Editor' },
  { key: 'reviewer', label: 'Reviewer' }
];
export function roleLabel(key) {
  return ROLES.find((r) => r.key === key)?.label || key;
}
export const isOwner = (role) => role === 'owner';
export const isStaff = (role) => role === 'owner' || role === 'editor';

// ---------- video pipeline ----------
export const STAGES = [
  { key: 'script', label: 'Script', color: '#5B6472', tint: '#EEF0F4' },
  { key: 'client_approval', label: 'Client approval', color: '#B4650F', tint: '#FBEEDD' },
  { key: 'shoot', label: 'Shoot', color: '#0E7C86', tint: '#DDF2F4' },
  { key: 'edit', label: 'Edit', color: '#6B3FB8', tint: '#EFE7FB' },
  { key: 'client_review', label: 'Client review', color: '#B12E68', tint: '#FBE6F0' },
  { key: 'delivered', label: 'Delivered', color: '#1F8A5F', tint: '#E2F5EC' }
];
export const STAGE_ORDER = STAGES.map((s) => s.key);
export const CLIENT_STAGES = ['client_approval', 'client_review'];
export function stageInfo(key) {
  return STAGES.find((s) => s.key === key) || STAGES[0];
}
export function stageLabel(key) {
  return stageInfo(key).label;
}

export const BRANDS = ['NuCoat', 'NuFun'];
export const FORMATS = [
  { key: 'long', label: 'Long-form' },
  { key: 'short', label: 'Short-form' }
];

// ---------- content calendar ----------
export const CONTENT_STATUSES = [
  { key: 'draft', label: 'Draft', color: '#5B6472', tint: '#EEF0F4' },
  { key: 'in_review', label: 'Waiting on approval', color: '#B4650F', tint: '#FBEEDD' },
  { key: 'changes_requested', label: 'Changes requested', color: '#B12E2E', tint: '#FBE6E6' },
  { key: 'approved', label: 'Approved', color: '#1F8A5F', tint: '#E2F5EC' },
  { key: 'scheduled', label: 'Scheduled', color: '#0E7C86', tint: '#DDF2F4' },
  { key: 'posted', label: 'Posted', color: '#6B3FB8', tint: '#EFE7FB' }
];
export function contentStatusInfo(key) {
  return CONTENT_STATUSES.find((s) => s.key === key) || CONTENT_STATUSES[0];
}
export const CHANNELS = [
  { key: 'email', label: 'Email', color: '#8A4C08', tint: '#FBEEDD' },
  { key: 'facebook', label: 'Facebook', color: '#1F4FA8', tint: '#E3ECFB' },
  { key: 'instagram', label: 'Instagram', color: '#A02A66', tint: '#FBE6F0' },
  { key: 'linkedin', label: 'LinkedIn', color: '#0A5C84', tint: '#DDF0F8' },
  { key: 'other', label: 'Other', color: '#5B6472', tint: '#EEF0F4' }
];
export function channelInfo(key) {
  return CHANNELS.find((c) => c.key === key) || CHANNELS[CHANNELS.length - 1];
}
export const CONTENT_KINDS = [
  { key: 'video', label: 'Video' },
  { key: 'takeaway', label: 'Takeaway' },
  { key: 'reminder', label: 'Reminder / article' },
  { key: 'offer', label: 'Offer' },
  { key: 'other', label: 'Other' }
];

// ---------- requests ----------
export const REQUEST_KINDS = [
  { key: 'graphic_design', label: 'Graphic design' },
  { key: 'extra_posts', label: 'Extra social posts' },
  { key: 'video', label: 'Extra video work' },
  { key: 'outside_scope', label: 'Other outside-scope work' },
  { key: 'other', label: 'Something else' }
];
export function requestKindLabel(key) {
  return REQUEST_KINDS.find((k) => k.key === key)?.label || key;
}
export const REQUEST_STATUSES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
  { key: 'declined', label: 'Declined' }
];
export function requestStatusLabel(key) {
  return REQUEST_STATUSES.find((s) => s.key === key)?.label || key;
}
export const OPEN_REQUEST_STATUSES = ['submitted', 'accepted', 'in_progress'];

export const TIME_KINDS = [
  { key: 'content', label: 'Retainer content work' },
  { key: 'request', label: 'Request work' },
  { key: 'admin', label: 'Meetings / admin' }
];
export function timeKindLabel(key) {
  return TIME_KINDS.find((k) => k.key === key)?.label || key;
}

// ---------- dates ----------
export function pad(n) {
  return String(n).padStart(2, '0');
}
export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO() {
  return toISO(new Date());
}
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function fmtDate(iso) {
  if (!iso) return '';
  return parseISO(iso.slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function fmtDateLong(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
export function daysFromNow(iso) {
  if (!iso) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((parseISO(iso) - now) / 86400000);
}
// Weeks run Monday to Sunday.
export function weekStartISO(iso) {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}
export function weekLabel(startIso) {
  const end = addDays(startIso, 6);
  return `${fmtDate(startIso)} – ${fmtDate(end)}`;
}

export function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: v % 1 ? 2 : 0 });
}
export function hrs(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `${v}h`;
}
