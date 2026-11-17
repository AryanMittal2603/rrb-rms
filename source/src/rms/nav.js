// Menu: one entry per RMS module, grouped like the scope of work, filtered by role.
import { L } from './i18n.js';
import { iso } from './core/format.js';
import { all } from './core/store.js';
import { role } from './core/session.js';

const ALL = ['unit', 'cpo', 'rrb', 'ms', 'chair', 'nodal', 'rrcb', 'verifier', 'hospital', 'auditor', 'helpdesk', 'admin'];

function count(fn) { return () => { try { return fn(); } catch (e) { return 0; } }; }

// Every menu entry with the roles allowed to open it (used by the role-permission matrix).
export function menuAll() { return defs(role()); }

export function menu() {
  const r = role();
  return defs(r).map((g) => ({ group: g.group, items: g.items.filter((it) => it.roles.indexOf(r) >= 0) })).filter((g) => g.items.length);
}

function defs(r) {
  const ind = () => all('indents');
  return [
    { group: L('nav.overview', 'Overview'), items: [
      { path: '/dashboard', label: L('nav.dashboard', 'Dashboard'), roles: ALL },
    ] },
    { group: L('nav.indenting', 'Vacancies & indents'), items: [
      { path: '/posts', label: L('nav.posts', 'Post master & mapping'), roles: ['unit', 'cpo', 'rrb', 'ms', 'nodal', 'rrcb', 'admin'], sow: '2.1' },
      { path: '/vacancy', label: L('nav.vacancy', 'Vacancy register'), roles: ['unit', 'cpo'], sow: '2.1' },
      { path: '/indents', label: L('nav.indents', 'Indents'), roles: ['unit', 'cpo', 'rrb', 'ms', 'chair', 'nodal', 'rrcb'], sow: '2.2–2.3',
        count: count(() => ind().filter((i) => (r === 'unit' && i.level === 'field' && i.unit === 'SBC' && (i.status === 'Draft' || i.status === 'Returned by CPO'))
          || (r === 'cpo' && ((i.level === 'field' && i.zone === 'SWR' && (i.status === 'Submitted to CPO' || i.status === 'Resubmitted to CPO')) || (i.level === 'rrb' && i.zone === 'SWR' && i.status === 'Returned to CPO')))
          || (r === 'ms' && i.level === 'rrb' && i.rrb === 'SBC' && i.status === 'Submitted to RRB')
          || (r === 'nodal' && i.level === 'rrb' && i.nodal === 'ADI' && i.status === 'Approved by RRB')).length) },
      { path: '/tracker', label: L('nav.tracker', 'Indent tracker'), roles: ['cpo', 'rrb', 'ms', 'nodal', 'rrcb'], sow: '2.2' },
      { path: '/cen', label: L('nav.cen', 'CEN compilation'), roles: ['nodal', 'rrcb'], sow: '2.2' },
    ] },
    { group: L('nav.exam', 'Examination stage'), items: [
      { path: '/eca', label: L('nav.eca', 'ECA data exchange'), roles: ['rrb', 'ms', 'nodal', 'rrcb'], sow: '2.5' },
      { path: '/audits', label: L('nav.audits', 'Test-centre audits'), roles: ['auditor', 'rrb', 'ms', 'chair', 'rrcb'], sow: '2.6',
        count: count(() => (r === 'ms' || r === 'rrb' ? all('audits').filter((a) => a.status === 'Submitted').length : 0)) },
      { path: '/exam-reports', label: L('nav.examReports', 'Exam-process reports'), roles: ['auditor', 'rrb', 'ms', 'chair', 'rrcb'], sow: '2.6' },
    ] },
    { group: L('nav.postExam', 'Results to joining'), items: [
      { path: '/results', label: L('nav.results', 'Results & merit validation'), roles: ['rrb', 'ms', 'chair', 'rrcb'], sow: '2.7' },
      { path: '/dv-schedule', label: L('nav.dvSchedule', 'DV scheduling'), roles: ['rrb', 'ms'], sow: '2.8' },
      { path: '/dv', label: L('nav.dv', 'Document verification'), roles: ['verifier', 'rrb', 'ms', 'chair'], sow: '2.8–2.9',
        count: count(() => (r === 'ms' ? all('candidates').filter((c) => c.dv && c.dv.outcome === 'Escalated to MS').length : (r === 'verifier' ? all('candidates').filter((c) => c.dv && c.dv.status === 'Scheduled' && c.dv.date === iso(new Date())).length : 0))) },
      { path: '/medical', label: L('nav.medical', 'Medical & HMIS'), roles: ['rrb', 'ms', 'chair'], sow: '2.10' },
      { path: '/hospital', label: L('nav.hospital', 'Medical examinations'), roles: ['hospital'], sow: '2.10',
        count: count(() => all('candidates').filter((c) => c.medical && c.medical.hospital === 'SBCDH' && c.medical.status === 'Referred').length) },
      { path: '/panels', label: L('nav.panels', 'Final result & panels'), roles: ['rrb', 'ms', 'chair', 'rrcb'], sow: '2.11',
        count: count(() => all('panels').filter((p) => (r === 'ms' && p.status === 'Submitted to MS') || (r === 'chair' && p.status === 'Submitted to Chairperson')).length) },
      { path: '/distribution', label: L('nav.distribution', 'Panel distribution'), roles: ['rrb', 'ms', 'chair', 'cpo', 'unit'], sow: '2.12' },
      { path: '/joining', label: L('nav.joining', 'Offers & joining'), roles: ['unit', 'cpo', 'rrb', 'ms'], sow: '2.13' },
    ] },
    { group: L('nav.integrity', 'Integrity'), items: [
      { path: '/debar', label: L('nav.debar', 'Debar register'), roles: ['rrb', 'ms', 'chair', 'nodal', 'rrcb', 'admin'], sow: '2.4',
        count: count(() => all('debar').filter((d) => (r === 'ms' && d.status === 'Pending checker') || (r === 'chair' && d.status === 'Pending final approval')).length) },
      { path: '/fraud', label: L('nav.fraud', 'Integrity alerts'), roles: ['rrb', 'ms', 'chair', 'verifier', 'rrcb'], sow: '2.14',
        count: count(() => all('alerts').filter((a) => a.status === 'Open').length) },
      { path: '/trail', label: L('nav.trail', 'Candidate identity trail'), roles: ['rrb', 'ms', 'chair', 'rrcb', 'helpdesk', 'verifier'], sow: '2.15' },
    ] },
    { group: L('nav.services', 'Candidate services'), items: [
      { path: '/grievances', label: L('nav.grievances', 'Grievances'), roles: ['helpdesk', 'rrb', 'ms', 'chair'], sow: '3.2',
        count: count(() => all('grievances').filter((g) => (r === 'helpdesk' && (g.status === 'New' || g.status === 'Reopened')) || ((r === 'rrb' || r === 'ms') && g.status === 'Awaiting RRB')).length) },
      { path: '/helpdesk', label: L('nav.helpdesk', 'Helpdesk console'), roles: ['helpdesk'], sow: '3.3' },
      { path: '/notifications', label: L('nav.notifications', 'Notifications'), roles: ['helpdesk', 'rrb', 'ms', 'admin'], sow: '3.1' },
    ] },
    { group: L('nav.mis', 'Reports'), items: [
      { path: '/reports', label: L('nav.reports', 'MIS & dashboards'), roles: ['rrcb', 'nodal', 'ms', 'chair', 'cpo', 'rrb'], sow: '2.15' },
    ] },
    { group: L('nav.platform', 'Platform'), items: [
      { path: '/users', label: L('nav.users', 'Users & roles'), roles: ['admin'], sow: '4.1' },
      { path: '/integrations', label: L('nav.integrations', 'Integrations'), roles: ['admin', 'rrb', 'ms'], sow: '4.2' },
      { path: '/audit-log', label: L('nav.auditLog', 'Activity log'), roles: ['admin', 'rrcb', 'chair', 'ms'], sow: '4.3' },
      { path: '/system', label: L('nav.system', 'Hosting & recovery'), roles: ['admin', 'rrcb'], sow: '4.4' },
      { path: '/retention', label: L('nav.retention', 'Retention & handover'), roles: ['admin', 'rrcb'], sow: '4.6' },
    ] },
  ];
}

export function allowed(path) {
  const r = role();
  const groups = defs(r);
  for (let i = 0; i < groups.length; i++) {
    for (let j = 0; j < groups[i].items.length; j++) {
      const it = groups[i].items[j];
      if (path === it.path || path.indexOf(it.path + '/') === 0) return it.roles.indexOf(r) >= 0;
    }
  }
  return null;
}
