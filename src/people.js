// Matching free-text owners from the sheets ("Ali Bea / Brady") to real teammates.
const firstWord = (s) => (s || '').trim().toLowerCase().split(/[\s.@_-]+/)[0] || '';

export function labelTokens(label) {
  return (label || '').split(/\/|,|&|\band\b|\+/i).map((s) => s.trim()).filter(Boolean);
}

function staffOnly(profiles) {
  return (profiles || []).filter((p) => p.role !== 'reviewer');
}

// Which teammate (if any) does one name from a label refer to?
export function matchToken(token, profiles) {
  const w = firstWord(token);
  if (w.length < 3) return null;
  return staffOnly(profiles).find((p) => {
    const d = firstWord(p.display_name);
    return d.length >= 3 && (d.startsWith(w) || w.startsWith(d));
  }) || null;
}

// Everyone a task is really assigned to: saved assignees plus anyone named in its label.
export function effectiveAssignees(task, profiles) {
  const known = new Set((profiles || []).map((p) => p.id));
  const ids = (task.assigned_to || []).filter((id) => known.has(id));
  labelTokens(task.owner_label).forEach((tok) => {
    const p = matchToken(tok, profiles);
    if (p && !ids.includes(p.id)) ids.push(p.id);
  });
  return ids;
}

// The part of the label that is NOT a teammate (shown as a plain badge).
export function outsideLabel(task, profiles) {
  return labelTokens(task.owner_label).filter((tok) => !matchToken(tok, profiles)).join(' / ');
}

export function isAssignedTo(task, profiles, personId) {
  return effectiveAssignees(task, profiles).includes(personId);
}

// Tasks whose saved assignees are missing someone the label names.
export function needsLinking(tasks, profiles) {
  return tasks.filter((t) => {
    const eff = effectiveAssignees(t, profiles);
    const saved = (t.assigned_to || []).filter((id) => (profiles || []).some((p) => p.id === id));
    return eff.length !== saved.length || eff.some((id) => !saved.includes(id));
  });
}

// First names the sheets use that nobody on the team matches yet.
export function missingNames(tasks, profiles, wanted = ['brady', 'jodi', 'marcel']) {
  const seen = new Set();
  tasks.forEach((t) => labelTokens(t.owner_label).forEach((tok) => {
    const w = firstWord(tok);
    if (wanted.includes(w) && !matchToken(tok, profiles)) seen.add(w);
  }));
  return [...seen].map((w) => w[0].toUpperCase() + w.slice(1));
}
