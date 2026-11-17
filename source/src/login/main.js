// Demo sign-in: pick a role (staff) or open the candidate portal.
import { initChrome } from '../rms/chrome.js';
import { load, reset } from '../rms/core/store.js';
import { ROLES, signIn, current } from '../rms/core/session.js';
import { h, mount } from '../rms/core/h.js';
import { confirm } from '../rms/ui/dialogs.js';
import { L } from '../rms/i18n.js';

const GROUPS = [
  { title: () => L('login.g.units', 'Railway units'), roles: [['unit', () => L('login.does.unit', 'Post mapping, vacancy assessment, indents, offers and joining')], ['cpo', () => L('login.does.cpo', 'Approves field indents, creates RRB indents, distributes panels')]] },
  { title: () => L('login.g.rrb', 'Railway Recruitment Board'), roles: [['rrb', () => L('login.does.rrb', 'Results import, DV schedule, medical referrals, panel formation')], ['ms', () => L('login.does.ms', 'Approves indents, DV escalations, panels and debarments')], ['chair', () => L('login.does.chair', 'Final approval of panels and debarments')], ['verifier', () => L('login.does.verifier', 'Conducts document verification and identity checks')], ['auditor', () => L('login.does.auditor', 'Test-centre audit observations and evidence')]] },
  { title: () => L('login.g.oversight', 'Oversight'), roles: [['nodal', () => L('login.does.nodal', 'Compiles RRB indents for the CEN')], ['rrcb', () => L('login.does.rrcb', 'All-India dashboards, schedules and audit')]] },
  { title: () => L('login.g.services', 'Services & platform'), roles: [['hospital', () => L('login.does.hospital', 'Medical examination results through HMIS')], ['helpdesk', () => L('login.does.helpdesk', 'Grievances, calls and emails from candidates')], ['admin', () => L('login.does.admin', 'Users, integrations, activity log, recovery')]] },
];

function render() {
  const root = document.getElementById('signin-root');
  const users = load().users;
  const byId = {};
  users.forEach((u) => { byId[u.id] = u; });
  const card = h('div.signin__card',
    h('div.signin__head', h('h1.signin__title', L('login.title', 'Sign in to the Recruitment Management System'))),
    h('p.rms-signin__intro', L('login.intro', 'This is a demo of the RRB Recruitment Management System (post-exam and indenting modules). Pick a role to sign in as; every role sees its own menu and actions. All data is synthetic and stays in this browser.')),
    GROUPS.map((g) => [
      h('p.rms-signin__group', g.title()),
      h('div.rms-roles', g.roles.map((r) => {
        const def = ROLES[r[0]];
        const u = byId[def.user] || {};
        return h('button.rms-role', { type: 'button', onclick: () => { signIn(r[0]); window.location.assign('rms.html#/dashboard'); } },
          h('span.rms-role__name', def.label()),
          h('span.rms-role__who', u.name + ' · ' + def.scope()),
          h('span.rms-role__does', r[1]()));
      })),
    ]),
    h('p.rms-signin__group', L('login.g.candidate', 'Candidates')),
    h('div.rms-roles', h('a.rms-role.rms-role--candidate', { href: 'candidate.html' },
      h('span.rms-role__name', L('login.candidate', 'Candidate portal')),
      h('span.rms-role__who', L('login.candidateWho', 'Sign in with registration number and date of birth')),
      h('span.rms-role__does', L('login.does.candidate', 'Recruitment status, DV & medical schedule, letters, grievances')))),
    h('div.rms-signin__foot',
      h('span', L('login.note', 'Demo build · frontend only · no backend calls')),
      h('button.rms-signin__reset', { type: 'button', onclick: () => confirm(L('login.resetQ', 'Reset all demo data to the starting point?')).then((y) => { if (y) { reset(); window.location.reload(); } }) }, L('login.reset', 'Reset demo data'))));
  mount(root, card);
}

function boot() {
  const q = window.location.search;
  if (current() && q.indexOf('switch=1') < 0) {
    window.location.replace('rms.html#/dashboard');
    return;
  }
  initChrome({});
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
