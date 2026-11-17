// Demo sign-in: the role picked on the sign-in page decides the menu and the actions available.
import { L } from '../i18n.js';
import { all } from './store.js';

const KEY = 'rms.demo.session';

export const ROLES = {
  unit: { label: () => L('role.unit', 'Indenting Unit'), user: 'U-UNIT', scope: () => L('role.unit.scope', 'Bengaluru Division, South Western Railway'), layer: 1 },
  cpo: { label: () => L('role.cpo', 'CPO / Zonal HQ'), user: 'U-CPO', scope: () => L('role.cpo.scope', 'South Western Railway (Hubballi)'), layer: 2 },
  rrb: { label: () => L('role.rrb', 'RRB, Dealing Section'), user: 'U-RRB', scope: () => L('role.rrb.scope', 'RRB Bengaluru'), layer: 3 },
  ms: { label: () => L('role.ms', 'RRB, Member Secretary'), user: 'U-MS', scope: () => L('role.ms.scope', 'RRB Bengaluru'), layer: 3 },
  chair: { label: () => L('role.chair', 'RRB, Chairperson'), user: 'U-CHAIR', scope: () => L('role.chair.scope', 'RRB Bengaluru'), layer: 3 },
  nodal: { label: () => L('role.nodal', 'Nodal RRB'), user: 'U-NODAL', scope: () => L('role.nodal.scope', 'RRB Ahmedabad (ALP & Technicians)'), layer: 4 },
  rrcb: { label: () => L('role.rrcb', 'Railway Board (RRCB)'), user: 'U-RRCB', scope: () => L('role.rrcb.scope', 'All RRBs and Railways'), layer: 5 },
  verifier: { label: () => L('role.verifier', 'DV Verifier'), user: 'U-DV1', scope: () => L('role.verifier.scope', 'RRB Bengaluru, DV Hall 1'), layer: 3 },
  hospital: { label: () => L('role.hospital', 'Railway Hospital'), user: 'U-HOSP', scope: () => L('role.hospital.scope', 'Divisional Railway Hospital, Bengaluru'), layer: 3 },
  auditor: { label: () => L('role.auditor', 'Test-centre Auditor'), user: 'U-AUD', scope: () => L('role.auditor.scope', 'RRB Bengaluru, CEN 07/2026'), layer: 3 },
  helpdesk: { label: () => L('role.helpdesk', 'Candidate Helpdesk'), user: 'U-HELP', scope: () => L('role.helpdesk.scope', 'All CENs, RRB Bengaluru'), layer: 0 },
  admin: { label: () => L('role.admin', 'System Administrator'), user: 'U-ADMIN', scope: () => L('role.admin.scope', 'Platform'), layer: 0 },
};

export const ROLE_ORDER = ['unit', 'cpo', 'rrb', 'ms', 'chair', 'nodal', 'rrcb', 'verifier', 'hospital', 'auditor', 'helpdesk', 'admin'];

export function current() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && ROLES[s.role] ? s : null;
  } catch (e) { return null; }
}

export function signIn(role) {
  window.localStorage.setItem(KEY, JSON.stringify({ role, at: new Date().toISOString() }));
}

export function signOut() {
  window.localStorage.removeItem(KEY);
}

export function role() {
  const s = current();
  return s ? s.role : null;
}

export function me() {
  const r = role();
  if (!r) return null;
  const def = ROLES[r];
  const users = all('users');
  let user = null;
  for (let i = 0; i < users.length; i++) if (users[i].id === def.user) user = users[i];
  return { role: r, label: def.label(), scope: def.scope(), user: user || { name: def.label(), title: '' } };
}

export function is() {
  const r = role();
  for (let i = 0; i < arguments.length; i++) if (arguments[i] === r) return true;
  return false;
}

export function who() {
  const m = me();
  return m ? m.user.name : 'System';
}

export function roleName(r) {
  if (r === 'system') return L('role.system', 'System');
  if (r === 'candidate') return L('role.candidate', 'Candidate');
  return ROLES[r] ? ROLES[r].label() : r;
}
