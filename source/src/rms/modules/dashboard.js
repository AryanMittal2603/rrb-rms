// Role-based landing dashboards (SOW 2.15).
import { h } from '../core/h.js';
import { route } from '../core/router.js';
import { all, data } from '../core/store.js';
import { me, role } from '../core/session.js';
import { head, stat, stats, card, grid, btn, link, note, progress } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { stepper } from '../ui/timeline.js';
import { hbars, split } from '../ui/charts.js';
import { date, dateTime, num, iso, hoursBetween } from '../core/format.js';
import { postName, unitName, rrbName, scheduleSteps, pipeline } from './common.js';
import { L } from '../i18n.js';

route('/dashboard', null, (root) => {
  const m = me();
  const r = role();
  root.appendChild(head({
    title: L('dash.title', 'Dashboard'),
    sub: L('dash.hello', 'Welcome, {name} · {role}, {scope}', { name: m.user.name, role: m.label, scope: m.scope }),
  }));
  const fn = BOARDS[r] || BOARDS.rrb;
  fn(root);
});

function indents() { return all('indents'); }

function pendingTable(rows, cols) {
  return table({ columns: cols, rows, search: false, pageSize: 6, empty: L('dash.nothingPending', 'Nothing is waiting for you.') });
}

const indentCols = [
  { key: 'id', label: L('col.indent', 'Indent no.'), render: (i) => link(i.id, '/indents/' + i.id) },
  { key: 'post', label: L('col.post', 'Post'), value: (i) => postName(i.post) },
  { key: 'unit', label: L('col.from', 'From'), value: (i) => (i.level === 'field' ? unitName(i.unit) : (i.external ? i.zone : 'CPO ' + i.zone)) },
  { key: 'total', label: L('col.vacancies', 'Vacancies'), align: 'right' },
  { key: 'status', label: L('col.status', 'Status'), render: (i) => badge(i.status) },
  { key: 'updatedAt', label: L('col.updated', 'Updated'), value: (i) => date(i.updatedAt), sortValue: (i) => i.updatedAt },
];

const BOARDS = {
  unit(root) {
    const mine = indents().filter((i) => i.level === 'field' && i.unit === 'SBC' && i.cycle === '2027');
    const offers = all('offers').filter((o) => o.unit === 'SBC');
    root.appendChild(stats([
      stat(L('dash.u.drafts', 'Draft indents'), mine.filter((i) => i.status === 'Draft').length, { href: '/indents', tone: 'warn' }),
      stat(L('dash.u.atCpo', 'Pending with CPO'), mine.filter((i) => /Submitted|Resubmitted/.test(i.status)).length, { href: '/indents' }),
      stat(L('dash.u.approved', 'Approved / consolidated'), mine.filter((i) => /Approved|Consolidated/.test(i.status)).length, { href: '/indents', tone: 'ok' }),
      stat(L('dash.u.mapped', 'Posts mapped'), (data().mappings.SBC || []).length, { href: '/posts' }),
      stat(L('dash.u.offers', 'Offers awaiting joining'), offers.filter((o) => o.status === 'Offer issued').length, { href: '/joining', tone: 'navy' }),
    ]));
    root.appendChild(grid(2, [
      card(L('dash.u.schedule', 'Indenting schedule, cycle 2027 (ALP & Technicians)'), stepper(scheduleSteps())),
      card(L('dash.u.todo', 'Needs your action'), pendingTable(indents().filter((i) => i.level === 'field' && i.unit === 'SBC' && (i.status === 'Draft' || i.status === 'Returned by CPO')), indentCols)),
    ]));
    root.appendChild(card(L('dash.u.mine', 'My indents this cycle'), table({ columns: indentCols, rows: mine, search: false, pageSize: 6 }), { actions: [btn(L('dash.u.new', 'Raise indent'), { href: '/indents/new', icon: 'plus', small: true })] }));
  },

  cpo(root) {
    const field = indents().filter((i) => i.level === 'field' && i.zone === 'SWR');
    const pend = field.filter((i) => /Submitted to CPO|Resubmitted/.test(i.status));
    const ready = field.filter((i) => i.status === 'Approved by CPO');
    root.appendChild(stats([
      stat(L('dash.c.pending', 'Field indents to approve'), pend.length, { href: '/indents', tone: 'warn' }),
      stat(L('dash.c.ready', 'Approved, not yet consolidated'), ready.length, { href: '/tracker' }),
      stat(L('dash.c.rrb', 'RRB indents with RRB'), indents().filter((i) => i.level === 'rrb' && i.zone === 'SWR' && i.status === 'Submitted to RRB').length, { href: '/indents' }),
      stat(L('dash.c.panels', 'Panels distributed'), all('panels').filter((p) => p.distribution).length, { href: '/distribution', tone: 'ok' }),
    ]));
    root.appendChild(grid(2, [
      card(L('dash.c.todo', 'Field indents waiting for approval'), pendingTable(pend, indentCols)),
      card(L('dash.c.tracker', 'Receipt status by post (cycle 2027)'), trackerMini()),
    ]));
    root.appendChild(card(L('dash.u.schedule', 'Indenting schedule, cycle 2027 (ALP & Technicians)'), stepper(scheduleSteps())));
  },

  rrb(root) { rrbBoard(root); },
  ms(root) { rrbBoard(root); },
  chair(root) { rrbBoard(root); },

  nodal(root) {
    const list = indents().filter((i) => i.level === 'rrb' && i.nodal === 'ADI' && i.cycle === '2027');
    root.appendChild(stats([
      stat(L('dash.n.received', 'RRB indents received'), list.filter((i) => i.status !== 'Submitted to RRB').length, { href: '/indents' }),
      stat(L('dash.n.pending', 'Waiting for Nodal approval'), list.filter((i) => i.status === 'Approved by RRB').length, { href: '/indents', tone: 'warn' }),
      stat(L('dash.n.approved', 'Approved for compilation'), list.filter((i) => i.status === 'Approved by Nodal RRB').length, { href: '/cen', tone: 'ok' }),
      stat(L('dash.n.returned', 'Returned to RRB'), list.filter((i) => i.status === 'Returned by Nodal RRB').length, { tone: 'danger' }),
      stat(L('dash.n.vac', 'Vacancies approved so far'), num(list.filter((i) => i.status === 'Approved by Nodal RRB' || i.status === 'Compiled for CEN').reduce((a, i) => a + i.total, 0)), { href: '/cen', tone: 'navy' }),
    ]));
    const byRrb = {};
    list.forEach((i) => { byRrb[i.rrb] = (byRrb[i.rrb] || 0) + i.total; });
    root.appendChild(grid(2, [
      card(L('dash.n.todo', 'RRB indents waiting for you'), pendingTable(list.filter((i) => i.status === 'Approved by RRB'), indentCols)),
      card(L('dash.n.byRrb', 'Vacancies indented by RRB (cycle 2027, ALP group)'), hbars(Object.keys(byRrb).map((k) => ({ label: rrbName(k), value: byRrb[k] })).sort((a, b) => b.value - a.value), { title: L('dash.n.byRrb', 'Vacancies indented by RRB (cycle 2027, ALP group)'), labelHead: L('col.rrb', 'RRB') })),
    ]));
  },

  rrcb(root) {
    const cens = all('cens');
    root.appendChild(stats([
      stat(L('dash.r.cens', 'CENs in progress'), cens.length, { href: '/reports' }),
      stat(L('dash.r.indents', 'Indents in cycle 2027'), indents().filter((i) => i.level === 'rrb' && i.cycle === '2027').length, { href: '/tracker' }),
      stat(L('dash.r.alerts', 'Open integrity alerts'), all('alerts').filter((a) => a.status === 'Open').length, { href: '/fraud', tone: 'danger' }),
      stat(L('dash.r.debar', 'Active debarments'), all('debar').filter((d) => d.status === 'Active').length, { href: '/debar' }),
      stat(L('dash.r.grv', 'Grievances open'), all('grievances').filter((g) => g.status !== 'Closed').length, { tone: 'warn' }),
    ]));
    root.appendChild(card(L('dash.r.cenTitle', 'Recruitment cycles'), table({ search: false, paged: false, rows: cens, columns: [
      { key: 'id', label: L('col.cen', 'CEN') },
      { key: 'title', label: L('col.posts', 'Posts') },
      { key: 'status', label: L('col.stage', 'Stage'), render: (c) => badge(c.status, c.status) },
      { key: 'nodal', label: L('col.nodal', 'Nodal RRB'), value: (c) => rrbName(c.nodal) },
      { key: 'cbt', label: L('col.cbt', 'CBT'), value: (c) => (c.cbtFrom ? date(c.cbtFrom) + ' – ' + date(c.cbtTo) : '—') },
    ] })));
    root.appendChild(grid(2, [
      card(L('dash.r.pipeline', 'CEN 04/2026 pipeline, RRB Bengaluru'), pipelineChart('CEN 04/2026')),
      card(L('dash.r.indentSplit', 'Cycle 2027 RRB indents by status'), indentSplit()),
    ]));
  },

  verifier(root) {
    const today = iso(new Date());
    const slots = all('dvSlots').filter((s) => s.cen === 'CEN 04/2026');
    const mine = all('candidates').filter((c) => c.cen === 'CEN 04/2026' && c.dv);
    const next = slots.filter((s) => s.date >= today).sort((a, b) => (a.date + a.session < b.date + b.session ? -1 : 1))[0];
    root.appendChild(stats([
      stat(L('dash.v.done', 'DVs completed (CEN 04/2026)'), mine.filter((c) => c.dv.status === 'Completed').length, { href: '/dv', tone: 'ok' }),
      stat(L('dash.v.next', 'Next batch'), next ? date(next.date) + ' ' + next.session : '—', { note: next ? next.candidates.length + ' ' + L('dash.v.cands', 'candidates') : '' }),
      stat(L('dash.v.scheduled', 'Still to verify'), mine.filter((c) => c.dv.status === 'Scheduled').length, { href: '/dv', tone: 'warn' }),
      stat(L('dash.v.alerts', 'Identity alerts raised at DV'), all('alerts').filter((a) => a.cen === 'CEN 04/2026').length, { href: '/fraud', tone: 'danger' }),
    ]));
    if (next) {
      root.appendChild(card(L('dash.v.batch', 'Next DV batch: {d} {s}, {v}', { d: date(next.date), s: next.session, v: next.venue }), table({ search: false, paged: false, rows: next.candidates.map((rl) => all('candidates').filter((c) => c.id === rl)[0]).filter(Boolean), columns: [
        { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => link(c.id, '/dv/' + c.id) },
        { key: 'name', label: L('col.name', 'Name') },
        { key: 'cat', label: L('col.cat', 'Category') },
        { key: 'status', label: L('col.status', 'Status'), render: (c) => badge(c.dv.status) },
      ] }), { actions: [btn(L('dash.v.open', 'Open DV desk'), { href: '/dv', small: true })] }));
    }
  },

  hospital(root) {
    const list = all('candidates').filter((c) => c.medical && c.medical.hospital === 'SBCDH');
    root.appendChild(stats([
      stat(L('dash.h.referred', 'Referred, awaiting examination'), list.filter((c) => c.medical.status === 'Referred').length, { href: '/hospital', tone: 'warn' }),
      stat(L('dash.h.examined', 'Examined'), list.filter((c) => c.medical.status === 'Examined').length, { href: '/hospital', tone: 'ok' }),
      stat(L('dash.h.unfit', 'Unfit / temporarily unfit'), list.filter((c) => c.medical.result && c.medical.result !== 'Fit').length, { tone: 'danger' }),
    ]));
    root.appendChild(note(L('dash.h.note', 'Medical advice arrives from RMS through HMIS. Results and certificates entered here return to RMS through HMIS automatically.'), 'info'));
    root.appendChild(card(L('dash.h.queue', 'Candidates referred to this hospital'), table({ search: false, pageSize: 8, rows: list.filter((c) => c.medical.status === 'Referred'), columns: [
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => link(c.id, '/hospital/' + c.id) },
      { key: 'name', label: L('col.name', 'Name') },
      { key: 'std', label: L('col.medStd', 'Standard to examine'), value: (c) => c.medical.required },
      { key: 'exam', label: L('col.examDate', 'Exam date'), value: (c) => date(c.medical.examDate), sortValue: (c) => c.medical.examDate },
    ] })));
  },

  auditor(root) {
    const a = all('audits');
    root.appendChild(stats([
      stat(L('dash.a.mine', 'Audits submitted'), a.filter((x) => x.status !== 'Draft').length, { href: '/audits', tone: 'ok' }),
      stat(L('dash.a.draft', 'Drafts'), a.filter((x) => x.status === 'Draft').length, { href: '/audits', tone: 'warn' }),
      stat(L('dash.a.high', 'High-severity findings'), a.filter((x) => x.severity === 'High').length, { href: '/audits', tone: 'danger' }),
      stat(L('dash.a.centres', 'Centres in CEN 07/2026'), all('centres').length, { href: '/exam-reports' }),
    ]));
    root.appendChild(card(L('dash.a.recent', 'Recent audits'), table({ search: false, pageSize: 6, rows: a, columns: [
      { key: 'id', label: L('col.audit', 'Audit'), render: (x) => link(x.id, '/audits/' + x.id) },
      { key: 'centre', label: L('col.centre', 'Centre') },
      { key: 'date', label: L('col.date', 'Date'), value: (x) => date(x.date) },
      { key: 'score', label: L('col.compliance', 'Compliance'), value: (x) => x.score + '%' },
      { key: 'status', label: L('col.status', 'Status'), render: (x) => badge(x.status) },
    ] }), { actions: [btn(L('dash.a.new', 'New audit'), { href: '/audits/new', icon: 'plus', small: true })] }));
  },

  helpdesk(root) {
    const g = all('grievances');
    const now = new Date().toISOString();
    const overdue = g.filter((x) => x.status !== 'Closed' && x.status !== 'Responded' && hoursBetween(x.at, now) > 48);
    root.appendChild(stats([
      stat(L('dash.hd.new', 'New grievances'), g.filter((x) => x.status === 'New').length, { href: '/grievances', tone: 'warn' }),
      stat(L('dash.hd.overdue', 'Past 48-hour reply time'), overdue.length, { href: '/grievances', tone: 'danger' }),
      stat(L('dash.hd.rrb', 'Waiting for RRB'), g.filter((x) => x.status === 'Awaiting RRB').length, { href: '/grievances' }),
      stat(L('dash.hd.closed', 'Closed'), g.filter((x) => x.status === 'Closed').length, { tone: 'ok' }),
    ]));
    root.appendChild(note(L('dash.hd.hours', 'Helpdesk hours: 10:00–18:00, Monday to Saturday. Emails must be answered within 48 hours; matters needing an RRB decision get a follow-up within 48 hours.'), 'info'));
    root.appendChild(card(L('dash.hd.queue', 'Grievance queue'), table({ search: false, pageSize: 8, rows: g.filter((x) => x.status !== 'Closed'), columns: [
      { key: 'id', label: L('col.ticket', 'Ticket'), render: (x) => link(x.id, '/grievances/' + x.id) },
      { key: 'subject', label: L('col.subject', 'Subject') },
      { key: 'channel', label: L('col.channel', 'Channel') },
      { key: 'at', label: L('col.raised', 'Raised'), value: (x) => dateTime(x.at), sortValue: (x) => x.at },
      { key: 'status', label: L('col.status', 'Status'), render: (x) => badge(x.status) },
    ] })));
  },

  admin(root) {
    const ints = all('integrations');
    const sys = data().system;
    root.appendChild(stats([
      stat(L('dash.ad.users', 'Active users'), all('users').filter((u) => u.active).length, { href: '/users' }),
      stat(L('dash.ad.ints', 'Integrations healthy'), ints.filter((i) => i.status === 'Operational').length + ' / ' + ints.length, { href: '/integrations', tone: ints.some((i) => i.status !== 'Operational') ? 'warn' : 'ok' }),
      stat(L('dash.ad.dr', 'DR replication'), sys.dr.status, { href: '/system', tone: 'ok', note: L('dash.ad.lastSync', 'Last sync {t}', { t: dateTime(sys.dr.lastSync) }) }),
      stat(L('dash.ad.log', 'Activity log entries'), num(all('audit').length), { href: '/audit-log' }),
    ]));
    root.appendChild(card(L('dash.ad.intTitle', 'Integration health'), table({ search: false, paged: false, rows: ints, columns: [
      { key: 'name', label: L('col.system', 'System') },
      { key: 'owner', label: L('col.owner', 'Provider') },
      { key: 'status', label: L('col.status', 'Status'), render: (i) => badge(i.status) },
      { key: 'last', label: L('col.lastCall', 'Last call'), value: (i) => dateTime(i.last) },
    ] })));
  },
};

function rrbBoard(root) {
  const r = role();
  const c = all('candidates').filter((x) => x.cen === 'CEN 04/2026');
  const dvDone = c.filter((x) => x.dv && x.dv.status === 'Completed').length;
  const dvAll = c.filter((x) => x.dv).length;
  const med = c.filter((x) => x.medical);
  const medDone = med.filter((x) => x.medical.status === 'Examined').length;
  const items = [];
  if (r === 'ms') items.push(stat(L('dash.m.indents', 'RRB indents to approve'), indents().filter((i) => i.level === 'rrb' && i.rrb === 'SBC' && i.status === 'Submitted to RRB').length, { href: '/indents', tone: 'warn' }));
  if (r === 'ms') items.push(stat(L('dash.m.esc', 'DV escalations'), c.filter((x) => x.dv && x.dv.outcome === 'Escalated to MS').length, { href: '/dv', tone: 'warn' }));
  if (r === 'ms' || r === 'chair') items.push(stat(L('dash.m.debar', 'Debar records to decide'), all('debar').filter((d) => (r === 'ms' && d.status === 'Pending checker') || (r === 'chair' && d.status === 'Pending final approval')).length, { href: '/debar', tone: 'warn' }));
  items.push(stat(L('dash.m.dv', 'DV completed'), dvDone + ' / ' + dvAll, { href: '/dv', tone: 'ok', note: 'CEN 04/2026' }));
  items.push(stat(L('dash.m.med', 'Medical examined'), medDone + ' / ' + med.length, { href: '/medical', note: 'CEN 04/2026' }));
  items.push(stat(L('dash.m.alerts', 'Open integrity alerts'), all('alerts').filter((a) => a.status === 'Open').length, { href: '/fraud', tone: 'danger' }));
  items.push(stat(L('dash.m.grv', 'Grievances waiting for RRB'), all('grievances').filter((g) => g.status === 'Awaiting RRB').length, { href: '/grievances', tone: 'warn' }));
  root.appendChild(stats(items));
  root.appendChild(grid(2, [
    card(L('dash.m.pipeline', 'CEN 04/2026 (JE, DMS & CMA): where candidates are'), pipelineChart('CEN 04/2026'), { actions: [btn(L('dash.m.panels', 'Panels'), { href: '/panels', small: true, kind: 'plain' })] }),
    card(L('dash.m.progress', 'Progress'), h('div',
      h('p.rms-small', L('dash.m.dvProg', 'Document verification')), progress(dvDone, dvAll, L('dash.m.dvProg', 'Document verification')),
      h('p.rms-small', L('dash.m.medProg', 'Medical examination')), progress(medDone, med.length, L('dash.m.medProg', 'Medical examination')),
      h('p.rms-small', L('dash.m.cen3', 'CEN 03/2026 joining (Section Controller)')), progress(all('offers').filter((o) => o.status === 'Joined').length, all('offers').length, L('dash.m.cen3', 'CEN 03/2026 joining (Section Controller)')),
      h('p.rms-small.rms-muted', L('dash.m.when', 'Updated {t}', { t: dateTime(new Date()) })))),
  ]));
  const waiting = indents().filter((i) => i.level === 'rrb' && i.rrb === 'SBC' && /Submitted to RRB|Approved by RRB/.test(i.status));
  root.appendChild(card(L('dash.m.indentsTitle', 'RRB indents, cycle 2027'), pendingTable(waiting, indentCols)));
}

function pipelineChart(cen) {
  return hbars(pipeline(cen).map((p) => ({ label: p.label, value: p.value })), { title: L('dash.m.pipeline', 'CEN 04/2026 (JE, DMS & CMA): where candidates are'), labelHead: L('col.stage', 'Stage'), labelWidth: 200 });
}

function trackerMini() {
  const posts = {};
  all('indents').filter((i) => i.level === 'field' && i.zone === 'SWR' && i.cycle === '2027').forEach((i) => {
    posts[i.post] = posts[i.post] || { post: i.post, received: 0, mapped: 0 };
    posts[i.post].mapped++;
    if (i.status !== 'Draft') posts[i.post].received++;
  });
  return table({ search: false, paged: false, rows: Object.keys(posts).map((k) => posts[k]), columns: [
    { key: 'post', label: L('col.post', 'Post'), value: (p) => postName(p.post) },
    { key: 'received', label: L('col.received', 'Received'), align: 'right' },
    { key: 'mapped', label: L('col.expected', 'Expected'), align: 'right' },
    { key: 'pct', label: L('col.progress', 'Progress'), render: (p) => progress(p.received, p.mapped) },
  ] });
}

function indentSplit() {
  const list = all('indents').filter((i) => i.level === 'rrb' && i.cycle === '2027');
  const c = (re) => list.filter((i) => re.test(i.status)).length;
  return h('div', split([
    { label: L('dash.split.withRrb', 'With RRB'), value: c(/Submitted to RRB/), tone: 'info' },
    { label: L('dash.split.rrbOk', 'Approved by RRB'), value: c(/^Approved by RRB$/), tone: 'warning' },
    { label: L('dash.split.nodalOk', 'Approved by Nodal RRB'), value: c(/Approved by Nodal|Compiled/), tone: 'success' },
    { label: L('dash.split.returned', 'Returned'), value: c(/Returned/), tone: 'danger' },
  ]), h('p.rms-small.rms-muted', L('dash.split.note', 'Each RRB indent consolidates the field indents of one Railway for one post.')));
}
