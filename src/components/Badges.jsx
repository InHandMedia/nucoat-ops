import React from 'react';
import { stageInfo, roleLabel, FORMATS } from '../constants.js';

export function StageChip({ stage }) {
  const s = stageInfo(stage);
  return <span className="chip" style={{ background: s.tint, color: s.color }}>{s.label}</span>;
}

export function BrandChip({ brand }) {
  return <span className={`chip ${brand === 'NuFun' ? 'nufun' : 'nucoat'}`}>{brand}</span>;
}

export function NumChip({ number }) {
  if (number == null) return null;
  return <span className="chip num">#{String(number).padStart(2, '0')}</span>;
}

export function WaitChip({ video }) {
  if (!video.waiting_on_brady) return null;
  return <span className="chip wait">Waiting on approval</span>;
}

export function ApprovalChip({ video }) {
  if (video.approval_status === 'approved') return <span className="chip ok">Approved</span>;
  if (video.approval_status === 'changes_requested') return <span className="chip bad">Changes requested</span>;
  return null;
}

export function FormatChips({ formats }) {
  return (formats || []).map((f) => (
    <span className="chip neutral" key={f}>{FORMATS.find((x) => x.key === f)?.label || f}</span>
  ));
}

export function People({ ids, profileMap }) {
  return (ids || []).map((id) => {
    const name = profileMap?.[id]?.display_name;
    if (!name) return null;
    return <span className="badge assignee" key={id}>{name}</span>;
  });
}

export function RolePill({ role }) {
  return <span className="role-pill">{roleLabel(role)}</span>;
}
