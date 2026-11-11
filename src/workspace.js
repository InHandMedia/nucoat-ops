// Tabs, departments, projects and meetings: the pieces that make the app work for
// more than one team. Everything here is plain data and helpers, no React.
import { isOwner, isStaff, pad, toISO } from './constants.js';

// ---------- tabs ----------
// who: 'any' = everyone, 'staff' = owner + editors, 'owner' = owner only.
// lock: the owner cannot switch this tab off (it would lock them out).
export const TAB_DEFS = [
  { key: 'dashboard', label: 'Dashboard', who: 'any', lock: true },
  { key: 'tasks', label: 'Tasks', who: 'staff' },
  { key: 'projects', label: 'Projects', who: 'any' },
  { key: 'series', label: 'Series', who: 'any' },
  { key: 'content', label: 'Content', who: 'any' },
  { key: 'calendar', label: 'Calendar', who: 'any' },
  { key: 'metrics', label: 'Metrics', who: 'staff' },
  { key: 'requests', label: 'Requests', who: 'any' },
  { key: 'hours', label: 'Hours', who: 'owner' },
  { key: 'team', label: 'Team', who: 'owner', lock: true }
];

export function roleAllows(def, role) {
  if (def.who === 'owner') return isOwner(role);
  if (def.who === 'staff') return isStaff(role);
  return true;
}

// Is this built-in tab switched on for this person?
export function tabOn(person, key) {
  const def = TAB_DEFS.find((d) => d.key === key);
  if (!def || !roleAllows(def, person?.role)) return false;
  if (def.lock) return true;
  return !(person?.hidden_tabs || []).includes(key);
}

// The full menu for one person: built-in tabs, their pinned projects, their custom tabs.
export function tabsFor(person, projects = [], customTabs = []) {
  const tabs = [];
  TAB_DEFS.forEach((def) => {
    if (!tabOn(person, def.key)) return;
    tabs.push([def.key, def.label]);
    if (def.key === 'projects') {
      projects
        .filter((p) => p.show_in_menu && p.status !== 'done' && (p.member_ids || []).includes(person.id))
        .forEach((p) => tabs.push([`project:${p.id}`, p.name, 'project']));
    }
  });
  customTabs
    .filter((t) => t.everyone || (t.member_ids || []).includes(person.id))
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .forEach((t) => tabs.push([`custom:${t.id}`, t.label, 'custom']));
  return tabs;
}

// One-click setups for the Team tab. Each lists the tabs to switch OFF.
export const TAB_PRESETS = [
  { key: 'all', label: 'Everything', hide: [] },
  { key: 'marketing', label: 'Marketing', hide: ['series'] },
  { key: 'sales', label: 'Sales', hide: ['series', 'content', 'metrics'] },
  { key: 'projects', label: 'Projects only', hide: ['series', 'content', 'metrics', 'requests'] }
];

export const DEPARTMENTS = ['Marketing', 'Sales', 'Operations', 'Leadership', 'Outside partner'];

export const PROJECT_STATUSES = [
  { key: 'planning', label: 'Planning', color: '#5B6472', tint: '#EEF0F4' },
  { key: 'active', label: 'Active', color: '#0E7C86', tint: '#DDF2F4' },
  { key: 'paused', label: 'Paused', color: '#B4650F', tint: '#FBEEDD' },
  { key: 'done', label: 'Done', color: '#1F8A5F', tint: '#E2F5EC' }
];
export const projectStatusInfo = (key) => PROJECT_STATUSES.find((s) => s.key === key) || PROJECT_STATUSES[0];

// ---------- presence ----------
export function seenLabel(iso) {
  if (!iso) return 'Not signed in yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 10) return 'Online now';
  if (mins < 60) return `Active ${mins} min ago`;
  if (mins < 60 * 24) return `Active ${Math.round(mins / 60)}h ago`;
  const days = Math.round(mins / 1440);
  return `Active ${days} day${days === 1 ? '' : 's'} ago`;
}
export const isOnline = (iso) => !!iso && Date.now() - new Date(iso).getTime() < 10 * 60000;

// ---------- meetings ----------
export const meetingDayISO = (m) => toISO(new Date(m.starts_at)); // the day in the viewer's own time zone
export function meetingTime(m) {
  return new Date(m.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function meetingEnd(m) {
  return new Date(new Date(m.starts_at).getTime() + (m.duration_min || 30) * 60000);
}
export function localInputValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function meetingEmails(m, profiles) {
  const fromApp = (m.attendee_ids || []).map((id) => profiles.find((p) => p.id === id)?.email).filter(Boolean);
  const extra = (m.extra_emails || '').split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
  return [...new Set([...fromApp, ...extra])];
}

// Opens Teams with the meeting form already filled in. Pressing Send there is what
// creates the Teams meeting and emails the invites.
export function teamsLink(m, profiles) {
  const q = new URLSearchParams({
    subject: m.title,
    startTime: new Date(m.starts_at).toISOString(),
    endTime: meetingEnd(m).toISOString(),
    content: m.notes || '',
    attendees: meetingEmails(m, profiles).join(',')
  });
  return `https://teams.microsoft.com/l/meeting/new?${q.toString()}`;
}

function whenLine(m) {
  const d = new Date(m.starts_at);
  return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${meetingTime(m)} (${m.duration_min} min)`;
}

// Opens the person's own mail app with a ready-to-send invite.
export function mailtoLink(m, profiles) {
  const lines = [`You are invited to: ${m.title}`, `When: ${whenLine(m)}`];
  if (m.join_link) lines.push(`Join: ${m.join_link}`);
  if (m.notes) lines.push('', m.notes);
  const q = `subject=${encodeURIComponent(`Invite: ${m.title}`)}&body=${encodeURIComponent(lines.join('\n'))}`;
  return `mailto:${meetingEmails(m, profiles).map(encodeURIComponent).join(',')}?${q}`;
}

const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// A calendar file that Outlook, Apple Calendar and Google Calendar all open.
export function meetingICS(m, profiles) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NuCoat Ops//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:meeting-${m.id || Date.now()}@nucoat-ops`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(new Date(m.starts_at))}`,
    `DTEND:${icsStamp(meetingEnd(m))}`,
    `SUMMARY:${icsEsc(m.title)}`,
    `DESCRIPTION:${icsEsc([m.join_link ? `Join: ${m.join_link}` : '', m.notes].filter(Boolean).join('\n'))}`
  ];
  if (m.join_link) lines.push(`LOCATION:${icsEsc(m.join_link)}`);
  meetingEmails(m, profiles).forEach((e) => lines.push(`ATTENDEE;RSVP=TRUE:mailto:${e}`));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(m, profiles) {
  const blob = new Blob([meetingICS(m, profiles)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${m.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'meeting'}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
