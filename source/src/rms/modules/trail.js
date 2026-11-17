// SOW 2.15: candidate identity trail (every stage, photograph and check in one place, plus who
// looked at the record) and MIS reports across indenting, CENs, DV, medical and services.
import { h, mount } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, data, save, log, candidate } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, btn, link, note, stats, stat, grid, split, empty, tabs } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { history, stepper } from '../ui/timeline.js';
import { portrait, signature } from '../ui/photo.js';
import { hbars, columns } from '../ui/charts.js';
import { catLabel, postName, unitName, hospitalName, pipeline, zoneName, groupName } from './common.js';
import { liveSeed } from './dv.js';
import { date, dateTime, num, pct, hoursBetween } from '../core/format.js';
import { L } from '../i18n.js';

route('/trail', null, (root) => {
  const q = query();
  let term = q.q || '';
  root.appendChild(head({ title: L('trl.title', 'Candidate identity trail'), sub: L('trl.sub', 'Find a candidate by roll number, registration number, name or mobile number to see every stage, photograph and identity check in one place.'), sow: '2.15' }));
  const out = h('div');
  const input = h('input.field__input', { id: 'trail-q', type: 'search', value: term, placeholder: L('trl.ph', 'Roll no., registration no., name or mobile'), onkeydown: (e) => { if (e.key === 'Enter') run(); } });
  root.appendChild(card(L('trl.find', 'Find a candidate'), h('div.rms-toolbar', h('label.visually-hidden', { for: 'trail-q' }, L('ui.search', 'Search')), input, btn(L('ui.search', 'Search'), { icon: 'search', onClick: () => run() }))));
  root.appendChild(out);
  function run() {
    term = input.value.trim().toUpperCase();
    if (!term) { show(all('candidates').filter((c) => data().demoCandidates.indexOf(c.id) >= 0), L('trl.examples', 'Examples')); return; }
    const res = all('candidates').filter((c) => c.id.indexOf(term) >= 0 || c.reg.toUpperCase().indexOf(term) >= 0 || c.name.indexOf(term) >= 0 || c.mobile.indexOf(term) >= 0).slice(0, 50);
    log(who(), role(), 'Candidate search', 'Candidate', '', term);
    save();
    show(res, L('trl.results', '{n} match(es)', { n: res.length }));
  }
  function show(list, title) {
    mount(out, card(title, list.length ? table({ rows: list, search: false, columns: [
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => link(c.id, '/trail/' + c.id) },
      { key: 'name', label: L('col.name', 'Name') },
      { key: 'cen', label: L('col.cen', 'CEN'), nowrap: true },
      { key: 'cat', label: L('col.category', 'Category'), value: catLabel },
      { key: 'stage', label: L('col.stage', 'Stage'), render: (c) => badge(c.stage), value: (c) => c.stage },
    ], onRow: (c) => go('/trail/' + c.id) }) : empty(L('trl.none', 'No candidate matches.'))));
  }
  run();
});

function stages(c) {
  const d = c.dv;
  const m = c.medical;
  const off = all('offers').filter((o) => o.roll === c.id)[0];
  const st = (doneFlag, active, blocked) => (blocked ? 'blocked' : (doneFlag ? 'done' : (active ? 'active' : 'todo')));
  return [
    { label: L('trl.s.result', 'Result'), state: 'done', note: c.marks.toFixed(2) },
    { label: L('trl.s.dv', 'DV'), state: st(d && d.status === 'Completed' && d.outcome === 'Recommended', !!d, d && (d.status === 'Absent' || d.outcome === 'Not recommended')), note: d ? (d.outcome || d.status) : '' },
    { label: L('trl.s.med', 'Medical'), state: st(m && m.result === 'Fit', !!m, m && (m.result === 'Unfit' || m.status === 'Absent')), note: m ? (m.result || m.status) : '' },
    { label: L('trl.s.panel', 'Panel'), state: st(!!c.panel, false, c.withheld), note: c.panel ? c.panel.id : (c.withheld ? L('trl.withheld', 'Withheld') : '') },
    { label: L('trl.s.offer', 'Offer'), state: st(!!off, false), note: off ? off.id : '' },
    { label: L('trl.s.join', 'Joining'), state: st(off && off.status === 'Joined', off && off.status === 'Offer issued', off && off.status === 'Not joined'), note: off ? off.status + (off.hrmsId ? ' · ' + off.hrmsId : '') : '' },
  ];
}

function events(c) {
  const ev = [];
  const add = (at, action, by, remarks) => { if (at) ev.push({ at, action, by, remarks }); };
  const cen = byId('cens', c.cen);
  if (cen && cen.result) add(cen.result + 'T11:00:00', L('trl.e.result', 'Result declared: normalised marks {m}', { m: c.marks.toFixed(2) }), 'ECA / RRB', '');
  if (c.shortlistedAt) add(c.shortlistedAt, L('trl.e.short', 'Shortlisted for DV (additional call)'), 'RRB', '');
  if (c.dv) {
    add(c.dv.callLetter, L('trl.e.call', 'E-call letter issued for DV on {d} ({s})', { d: date(c.dv.date), s: c.dv.session }), 'RRB', '');
    if (c.dv.status === 'Completed') add(c.dv.at, L('trl.e.dv', 'DV: {o}', { o: c.dv.msDecision ? 'Escalated to MS' : c.dv.outcome }), c.dv.verifierName, [c.dv.face != null ? 'face ' + c.dv.face.toFixed(3) : '', c.dv.aadhaar ? 'Aadhaar ' + c.dv.aadhaar : '', c.dv.remarks].filter(Boolean).join(' · '));
    if (c.dv.msDecision) add(c.dv.msDecision.at, L('trl.e.ms', 'Member Secretary: {d}', { d: c.dv.msDecision.decision }), c.dv.msDecision.by, c.dv.msDecision.remarks);
    if (c.dv.status === 'Absent') add(c.dv.date + 'T17:00:00', L('trl.e.absent', 'Absent at DV'), 'RRB', c.dv.remarks);
  }
  if (c.medical) {
    if (c.medical.previous) add(c.medical.previous.at, L('trl.e.medPrev', 'Medical: {r}', { r: c.medical.previous.result }), c.medical.previous.examinedBy, '');
    add(c.medical.referredAt, L('trl.e.ref', 'Referred to {h} for {s} (memo {m})', { h: hospitalName(c.medical.hospital), s: c.medical.required, m: c.medical.memoNo }), 'RRB', 'HMIS ' + (c.medical.hmisRef || c.medical.hmis));
    if (c.medical.at) add(c.medical.at, L('trl.e.med', 'Medical: {r}', { r: (c.medical.result || c.medical.status) + (c.medical.std ? ' in ' + c.medical.std : '') }), c.medical.examinedBy, c.medical.certificate || '');
  }
  all('panels').forEach((p) => p.versions.forEach((v, i) => {
    const inNow = v.rows.some((r) => r.roll === c.id);
    const inPrev = i > 0 && p.versions[i - 1].rows.some((r) => r.roll === c.id);
    if (inNow && !inPrev) add(v.at, L('trl.e.panel', 'Included in panel {p} (v{v})', { p: p.id, v: v.v }), v.by, '');
    if (!inNow && inPrev) add(v.at, L('trl.e.panelOut', 'Removed from panel {p} (v{v})', { p: p.id, v: v.v }), v.by, v.note);
  }));
  all('offers').filter((o) => o.roll === c.id).forEach((o) => {
    add(o.issuedAt, L('trl.e.offer', 'Offer {o} from {u}', { o: o.id, u: unitName(o.unit) }), o.signedBy, L('trl.e.reportBy', 'report by {d}', { d: date(o.reportBy) }));
    if (o.joinedAt) add(o.joinedAt + 'T10:00:00', L('trl.e.joined', 'Joined {u}', { u: unitName(o.unit) }), o.signedBy, 'HRMS ' + o.hrmsId);
    if (o.status === 'Not joined') add(o.reportBy + 'T17:00:00', L('trl.e.notJoined', 'Did not join'), o.signedBy, o.reason || '');
  });
  all('alerts').filter((a) => a.roll === c.id).forEach((a) => add(a.at, L('trl.e.alert', 'Integrity alert: {t} ({s})', { t: a.type, s: a.status }), 'Integrity engine', a.detail));
  all('grievances').filter((g) => g.roll === c.id).forEach((g) => add(g.at, L('trl.e.grv', 'Grievance {id}: {s}', { id: g.id, s: g.subject }), g.channel, g.status));
  return ev.sort((a, b) => (a.at < b.at ? -1 : 1));
}

route('/trail/:roll', null, (root, prm) => {
  const c = candidate(prm.roll);
  if (!c) { root.appendChild(head({ title: L('trl.notFound', 'Candidate not found') })); return; }
  log(who(), role(), 'Identity trail viewed', 'Candidate', c.id, c.name);
  save();
  root.appendChild(head({ title: c.name, sub: c.id + ' · ' + c.reg + ' · ' + c.cen, crumbs: [{ label: L('trl.title', 'Candidate identity trail'), href: '/trail' }, { label: c.id }], sow: '2.15' }));
  root.appendChild(h('div.rms-toolbar', badge(c.stage), c.withheld ? badge('Candidature withheld') : null));
  root.appendChild(stepper(stages(c)));
  const photos = [portrait(c.photo, { size: 104, caption: L('trl.p.app', 'Application') })];
  if (c.dv && c.dv.status === 'Completed') photos.push(portrait(liveSeed(c, c.dv.face), { size: 104, variant: 'live', caption: L('trl.p.dv', 'DV live · {s}', { s: c.dv.face != null ? c.dv.face.toFixed(3) : '—' }) }));
  if (c.dv && c.dv.aadhaar === 'Matched') photos.push(portrait(c.photo, { size: 104, variant: 'aadhaar', caption: L('trl.p.aad', 'Aadhaar (DV)') }));
  root.appendChild(card(L('trl.identity', 'Identity across stages'), split(h('div', h('div.rms-photos', photos, signature(c.photo, { caption: L('dv.sig', 'Signature on record') }))),
    kv([[L('col.name', 'Name'), c.name], [L('col.father', 'Father’s name'), c.father], [L('col.dob', 'Date of birth'), date(c.dob)], [L('col.category', 'Category'), catLabel(c)],
      [L('trl.aadhaar', 'Aadhaar'), 'XXXX-XXXX-' + c.aadhaar.last4 + ' · ' + c.aadhaar.status], [L('trl.mobile', 'Mobile'), c.mobile.slice(0, 2) + 'XXXXXX' + c.mobile.slice(-2)], [L('trl.qual', 'Qualification'), c.qual], [L('dv.prefs', 'Post preferences'), c.prefs.map(postName).join(', ')]]))));
  const ev = events(c);
  const access = all('audit').filter((e) => e.ref === c.id).slice(0, 15);
  const notes = all('notifications').filter((n) => n.roll === c.id).slice(0, 10);
  root.appendChild(grid(2, [
    card(L('trl.timeline', 'Timeline'), history(ev)),
    h('div',
      card(L('trl.access', 'Who worked on or viewed this record'), access.length ? h('table.rms-mini', h('thead', h('tr', h('th', L('col.date', 'Date')), h('th', L('col.by', 'By')), h('th', L('trl.action', 'Action')))), h('tbody', access.map((e) => h('tr', h('td.rms-nowrap', dateTime(e.at)), h('td', e.actor), h('td', e.action))))) : h('p.rms-muted', '—')),
      card(L('trl.notes', 'Messages sent'), notes.length ? h('table.rms-mini', h('thead', h('tr', h('th', L('col.date', 'Date')), h('th', L('ntf.channel', 'Channel')), h('th', L('ntf.subject', 'Message')))), h('tbody', notes.map((n) => h('tr', h('td.rms-nowrap', date(n.at)), h('td', n.channel), h('td', n.subject))))) : h('p.rms-muted', '—'))),
  ]));
});

// ------------------------------------------------------------------ MIS
route('/reports', null, (root) => {
  let tab = 'pipeline';
  root.appendChild(head({ title: L('mis.title', 'MIS & dashboards'), sub: L('mis.sub', 'Summary figures across indenting, examination, DV, medical, panels and candidate services. Every table exports to CSV.'), sow: '2.15' }));
  const wrap = h('div');
  root.appendChild(wrap);
  const t = [{ id: 'pipeline', label: L('mis.tab.pipe', 'Recruitment pipeline') }, { id: 'indents', label: L('mis.tab.ind', 'Indents, cycle 2027') }, { id: 'dv', label: L('mis.tab.dv', 'DV & medical') }, { id: 'services', label: L('mis.tab.svc', 'Grievances & integrity') }];
  const draw = () => mount(wrap, tabs(t, tab, (id) => { tab = id; draw(); }), tab === 'pipeline' ? pipe() : (tab === 'indents' ? indentsMis() : (tab === 'dv' ? dvMis() : services())));
  draw();
});

function pipe() {
  const box = h('div');
  ['CEN 04/2026', 'CEN 03/2026'].forEach((cen) => {
    const p = pipeline(cen);
    const c = byId('cens', cen);
    box.appendChild(card(cen + ' · ' + (c ? c.title : ''), h('div', hbars(p.map((x) => ({ label: x.label, value: x.value })), { labelWidth: 170, title: cen, labelHead: L('mis.stage', 'Stage') }))));
  });
  box.appendChild(card(L('mis.cens', 'CENs'), table({ rows: all('cens'), search: false, exportName: 'cens', columns: [
    { key: 'id', label: L('col.cen', 'CEN'), nowrap: true }, { key: 'title', label: L('col.title', 'Title') }, { key: 'status', label: L('col.status', 'Status'), render: (x) => badge(x.status), value: (x) => x.status },
    { key: 'cands', label: L('mis.inRms', 'Candidates in RMS'), align: 'right', value: (x) => all('candidates').filter((c) => c.cen === x.id).length || (x.applicants ? num(x.applicants) + ' ' + L('mis.applicants', 'applicants') : '—') },
  ] })));
  return box;
}

function indentsMis() {
  const list = all('indents').filter((i) => i.level === 'rrb' && i.cycle === '2027');
  const zones = list.map((i) => i.zone).filter((x, k, a) => a.indexOf(x) === k);
  const rows = zones.map((z) => {
    const mine = list.filter((i) => i.zone === z);
    return { zone: z, n: mine.length, vac: mine.reduce((x, i) => x + i.total, 0), approved: mine.filter((i) => /Nodal|Compiled/.test(i.status)).length, pending: mine.filter((i) => !/Nodal|Compiled/.test(i.status)).length };
  });
  const field = all('indents').filter((i) => i.level === 'field' && i.cycle === '2027');
  return h('div',
    stats([stat(L('mis.rrbInd', 'RRB indents'), list.length), stat(L('mis.vac', 'Vacancies indented'), num(list.reduce((x, i) => x + i.total, 0)), { tone: 'navy' }), stat(L('mis.fieldInd', 'Field indents (SWR)'), field.length), stat(L('mis.returned', 'Returned at any level'), all('indents').filter((i) => i.cycle === '2027' && i.history.some((e) => /Returned/.test(e.action))).length, { tone: 'warn' })]),
    card(L('mis.byZone', 'Vacancies by Railway'), hbars(rows.map((r) => ({ label: zoneName(r.zone), value: r.vac })), { labelWidth: 200, title: L('mis.byZone', 'Vacancies by Railway'), labelHead: L('col.railway', 'Railway') })),
    table({ rows, search: false, exportName: 'indents-by-railway-2027', columns: [
      { key: 'zone', label: L('col.railway', 'Railway'), value: (r) => zoneName(r.zone) },
      { key: 'n', label: L('mis.rrbInd', 'RRB indents'), align: 'right' },
      { key: 'vac', label: L('col.vacancies', 'Vacancies'), align: 'right' },
      { key: 'approved', label: L('mis.approvedNodal', 'Approved by Nodal RRB'), align: 'right' },
      { key: 'pending', label: L('mis.pending', 'Pending'), align: 'right' },
    ] }));
}

function dvMis() {
  const je = all('candidates').filter((c) => c.cen === 'CEN 04/2026');
  const days = je.filter((c) => c.dv && c.dv.status === 'Completed').map((c) => c.dv.date).filter((x, k, a) => a.indexOf(x) === k).sort();
  const per = days.map((d) => ({ label: date(d), short: d.slice(8, 10) + '/' + d.slice(5, 7), value: je.filter((c) => c.dv && c.dv.status === 'Completed' && c.dv.date === d).length }));
  const hosp = all('hospitals').map((x) => ({ label: x.name, value: je.filter((c) => c.medical && c.medical.hospital === x.id).length, value2: je.filter((c) => c.medical && c.medical.hospital === x.id && c.medical.status !== 'Referred').length })).filter((x) => x.value);
  const faces = je.filter((c) => c.dv && c.dv.face != null);
  return h('div',
    stats([stat(L('mis.dvDone', 'DV completed'), faces.length), stat(L('mis.faceAvg', 'Average face match'), faces.length ? (faces.reduce((x, c) => x + c.dv.face, 0) / faces.length).toFixed(3) : '—', { tone: 'navy' }), stat(L('mis.faceLow', 'Below threshold'), faces.filter((c) => c.dv.face < data().meritRules.faceThreshold).length, { tone: 'danger' }), stat(L('mis.fitRate', 'Fit rate'), pct(je.filter((c) => c.medical && c.medical.result === 'Fit').length, je.filter((c) => c.medical && c.medical.status === 'Examined').length), { tone: 'ok' })]),
    grid(2, [card(L('mis.dvPerDay', 'DV completed per day'), columns(per, { title: L('mis.dvPerDay', 'DV completed per day'), labelHead: L('col.date', 'Date') })),
      card(L('mis.byHosp', 'Medical referrals by hospital'), hbars(hosp, { series: [L('mis.referredS', 'Referred'), L('mis.examinedS', 'Examined')], labelWidth: 200, title: L('mis.byHosp', 'Medical referrals by hospital'), labelHead: L('med.hospital', 'Hospital') }))]));
}

function services() {
  const g = all('grievances');
  const cats = g.map((x) => x.category).filter((x, k, a) => a.indexOf(x) === k);
  const answered = g.filter((x) => x.respondedAt || x.status === 'Closed' || x.status === 'Responded');
  const within = answered.filter((x) => { const r = x.history.filter((e) => /Responded|Closed/.test(e.action))[0]; return r && hoursBetween(x.at, r.at) <= 48; });
  return h('div',
    stats([stat(L('mis.grv', 'Grievances'), g.length), stat(L('mis.sla', 'Answered within 48 hours'), pct(within.length, answered.length || 1), { tone: 'ok' }), stat(L('mis.open', 'Open'), g.filter((x) => x.status !== 'Closed').length, { tone: 'warn' }), stat(L('mis.alerts', 'Integrity alerts'), all('alerts').length, { tone: 'danger' })]),
    grid(2, [card(L('mis.grvCat', 'Grievances by category'), hbars(cats.map((c) => ({ label: c, value: g.filter((x) => x.category === c).length })), { labelWidth: 200, title: L('mis.grvCat', 'Grievances by category'), labelHead: L('col.category', 'Category') })),
      card(L('mis.debar', 'Debar register'), hbars(['Active', 'Pending checker', 'Pending final approval', 'Expired', 'Revoked'].map((s) => ({ label: s, value: all('debar').filter((d) => d.status === s).length })), { labelWidth: 170, title: L('mis.debar', 'Debar register'), labelHead: L('col.status', 'Status') }))]));
}
