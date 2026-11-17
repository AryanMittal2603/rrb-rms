// SOW 2.6: test-centre audits (checklist, score, evidence, RRB review) and exam-process reports
// (attendance, incidents, PUFM cases, centre-coordinator reports) for the CBT in progress.
import { h, mount } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, save, log, insert } from '../core/store.js';
import { role, who, is, me } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, stats, stat, progress, split } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form, seg } from '../ui/form.js';
import { ok, fail, remarks, confirm } from '../ui/dialogs.js';
import { hbars } from '../ui/charts.js';
import { centreName, newId } from './common.js';
import { date, dateTime, num, pct, iso } from '../core/format.js';
import { L } from '../i18n.js';

const ITEMS = [
  ['cctv', 'CCTV recording in every lab, gate and frisking area'],
  ['jammer', 'Mobile signal jammers working in every lab'],
  ['frisking', 'Frisking with hand-held metal detector; separate enclosure for women'],
  ['biometric', 'Biometric and face capture at entry'],
  ['seating', 'Seating as per ECA allocation, spacing between systems'],
  ['servers', 'Local server, UPS and generator back-up tested'],
  ['pwbd', 'PwBD access: ramp, ground-floor lab, scribe room'],
  ['signage', 'Signage, help desk and drinking water'],
  ['staff', 'Centre staff identity verified, declaration of no relatives appearing'],
  ['clocks', 'Wall clocks synchronised with server time'],
];
function itemLabel(k) { const x = ITEMS.filter((i) => i[0] === k)[0]; return x ? L('aud.item.' + k, x[1]) : k; }
const VALUES = () => [
  { value: 'Compliant', label: L('aud.v.ok', 'Compliant') },
  { value: 'Partially compliant', label: L('aud.v.part', 'Partly') },
  { value: 'Non-compliant', label: L('aud.v.no', 'Not compliant'), cls: 'is-bad' },
  { value: 'NA', label: L('aud.v.na', 'NA'), cls: 'is-na' },
];

function score(items) {
  let s = 0;
  let n = 0;
  Object.keys(items).forEach((k) => {
    if (items[k] === 'NA' || !items[k]) return;
    n++;
    s += items[k] === 'Compliant' ? 1 : (items[k] === 'Partially compliant' ? 0.5 : 0);
  });
  return n ? Math.round((s / n) * 100) : 0;
}
function severity(sc, items) {
  if (items && (items.jammer === 'Non-compliant' || items.cctv === 'Non-compliant' || items.frisking === 'Non-compliant')) return 'High';
  return sc < 75 ? 'High' : (sc < 90 ? 'Medium' : 'Low');
}

// Drafts stay with the auditor who wrote them until submitted.
function visible() { return all('audits').filter((a) => a.status !== 'Draft' || (is('auditor') && a.auditor === me().user.name)); }

route('/audits', null, (root) => {
  const rows = visible();
  root.appendChild(head({
    title: L('aud.title', 'Test-centre audits'),
    sub: L('aud.sub', 'Audits of CBT centres for CEN 07/2026 against a fixed checklist. Auditors submit from the centre; the RRB reviews every audit and records the action taken.'),
    sow: '2.6',
    actions: is('auditor') ? [btn(L('aud.new', 'New audit'), { icon: 'plus', href: '/audits/new' })] : [],
  }));
  root.appendChild(stats([
    stat(L('aud.count', 'Audits'), rows.filter((a) => a.status !== 'Draft').length),
    stat(L('aud.avg', 'Average score'), Math.round(rows.reduce((x, a) => x + a.score, 0) / Math.max(1, rows.length)) + '%', { tone: 'navy' }),
    stat(L('aud.high', 'High-severity findings'), rows.filter((a) => a.severity === 'High').length, { tone: 'danger' }),
    stat(L('aud.toReview', 'Waiting for RRB review'), rows.filter((a) => a.status === 'Submitted').length, { tone: 'warn' }),
  ]));
  root.appendChild(table({
    rows,
    exportName: 'test-centre-audits',
    columns: [
      { key: 'id', label: L('col.audit', 'Audit'), render: (a) => link(a.id, '/audits/' + a.id) },
      { key: 'centre', label: L('col.centre', 'Centre'), value: (a) => centreName(a.centre) },
      { key: 'date', label: L('col.date', 'Date'), nowrap: true, value: (a) => date(a.date), sortValue: (a) => a.date + a.shift },
      { key: 'shift', label: L('col.shift', 'Shift') },
      { key: 'auditor', label: L('col.auditor', 'Auditor') },
      { key: 'score', label: L('col.score', 'Score'), align: 'right', value: (a) => a.score + '%', sortValue: (a) => a.score },
      { key: 'severity', label: L('col.severity', 'Severity'), render: (a) => badge(a.severity), value: (a) => a.severity },
      { key: 'status', label: L('col.status', 'Status'), render: (a) => badge(a.status), value: (a) => a.status },
    ],
    filters: [{ key: 'status', label: L('col.status', 'Status'), options: ['Draft', 'Submitted', 'Reviewed by RRB'] }, { key: 'severity', label: L('col.severity', 'Severity'), options: ['High', 'Medium', 'Low'] }],
    onRow: (a) => go('/audits/' + a.id),
    rowClass: (a) => (a.severity === 'High' ? 'is-flagged' : null),
    sort: 'date',
    dir: -1,
  }));
});

route('/audits/new', ['auditor'], (root) => editor(root, null));

route('/audits/:id', null, (root, prm) => {
  const a = byId('audits', prm.id);
  if (!a) { root.appendChild(head({ title: L('aud.notFound', 'Audit not found') })); return; }
  if (a.status === 'Draft' && is('auditor')) { editor(root, a); return; }
  if (a.status === 'Draft') { root.appendChild(head({ title: L('aud.detail', 'Audit {id}', { id: a.id }), crumbs: [{ label: L('aud.title', 'Test-centre audits'), href: '/audits' }, { label: a.id }] })); root.appendChild(note(L('aud.stillDraft', 'This audit is still a draft with the auditor.'), 'info')); return; }
  const draw = () => {
    mount(root);
    const actions = [];
    if (is('rrb', 'ms') && a.status === 'Submitted') {
      actions.push(btn(L('aud.review', 'Record review & action taken'), { kind: 'ok', icon: 'check', onClick: () => remarks({ title: L('aud.reviewTitle', 'Review {id}', { id: a.id }), label: L('aud.actionTaken', 'Action taken'), required: a.severity !== 'Low', ok: L('aud.markReviewed', 'Mark reviewed') }).then((t) => {
        if (t === null) return;
        a.status = 'Reviewed by RRB';
        a.reviewedBy = who();
        a.actionTaken = t;
        a.reviewedAt = new Date().toISOString();
        log(who(), role(), 'Audit reviewed', 'Test-centre audit', a.id, t);
        save();
        ok(L('aud.reviewed', 'Audit {id} reviewed.', { id: a.id }));
        draw();
      }) }));
    }
    root.appendChild(head({ title: L('aud.detail', 'Audit {id}', { id: a.id }), sub: centreName(a.centre) + ' · ' + date(a.date) + ' · ' + a.shift, crumbs: [{ label: L('aud.title', 'Test-centre audits'), href: '/audits' }, { label: a.id }], actions, sow: '2.6' }));
    root.appendChild(h('div.rms-toolbar', badge(a.status), badge(a.severity, L('aud.sev', 'Severity: {s}', { s: a.severity }))));
    root.appendChild(card(L('aud.result', 'Checklist'), split(
      h('ol.rms-checklist', ITEMS.map((it) => h('li', h('span.rms-checklist__label', itemLabel(it[0])), badge(a.items[it[0]] || 'NA', a.items[it[0]] === 'Partially compliant' ? L('aud.v.part', 'Partly') : null)))),
      h('div', h('div.rms-stat.rms-stat--navy', h('span.rms-stat__value', a.score + '%'), h('span.rms-stat__label', L('col.score', 'Score'))), progress(a.score, 100, L('aud.compliance', 'Compliance')),
        kv([[L('col.auditor', 'Auditor'), a.auditor], [L('aud.submitted', 'Submitted'), a.submittedAt ? dateTime(a.submittedAt) : '—'], [L('aud.reviewedBy', 'Reviewed by'), a.reviewedBy || '—']])))));
    root.appendChild(card(L('aud.obs', 'Observations and evidence'), h('div', h('p', a.observations || '—'), h('ul.rms-list', (a.evidence || []).map((e) => h('li', e))),
      a.actionTaken ? note(h('div', h('strong', L('aud.actionTaken', 'Action taken') + ': '), a.actionTaken), 'info') : null)));
  };
  draw();
});

function editor(root, existing) {
  const st = existing ? JSON.parse(JSON.stringify(existing)) : { items: {}, evidence: [] };
  ITEMS.forEach((i) => { if (!st.items[i[0]]) st.items[i[0]] = ''; });
  root.appendChild(head({ title: existing ? L('aud.editTitle', 'Audit {id} (draft)', { id: existing.id }) : L('aud.new', 'New audit'), sub: L('aud.editSub', 'CEN 07/2026 · fill every item; NA only where the item does not apply at this centre.'), crumbs: [{ label: L('aud.title', 'Test-centre audits'), href: '/audits' }, { label: existing ? existing.id : L('ind.new', 'New') }], sow: '2.6' }));
  const f = form([
    field({ name: 'centre', type: 'select', label: L('col.centre', 'Centre'), required: true, value: st.centre || '', options: all('centres').map((c) => ({ value: c.id, label: c.name })) }),
    field({ name: 'date', type: 'date', label: L('col.date', 'Date'), required: true, value: st.date || iso(new Date()) }),
    field({ name: 'shift', type: 'select', label: L('col.shift', 'Shift'), required: true, value: st.shift || '', options: all('shifts').map((s) => ({ value: s.id, label: s.label + ' (' + s.time + ')' })) }),
  ], 3);
  root.appendChild(card(L('aud.where', 'Centre and shift'), f.node));
  const live = h('div');
  const refresh = () => {
    const sc = score(st.items);
    const done = ITEMS.filter((i) => st.items[i[0]]).length;
    mount(live, h('div.rms-stat.rms-stat--navy', h('span.rms-stat__value', sc + '%'), h('span.rms-stat__label', L('col.score', 'Score'))), progress(done, ITEMS.length, L('aud.answered', 'Items answered')), done ? badge(severity(sc, st.items), L('aud.sev', 'Severity: {s}', { s: severity(sc, st.items) })) : null);
  };
  root.appendChild(card(L('aud.result', 'Checklist'), split(h('ol.rms-checklist', ITEMS.map((it) => h('li', h('span.rms-checklist__label', itemLabel(it[0])), seg(itemLabel(it[0]), VALUES(), st.items[it[0]], (v) => { st.items[it[0]] = v; refresh(); })))), live)));
  refresh();
  const fObs = field({ name: 'observations', type: 'textarea', label: L('aud.obsField', 'Observations'), value: st.observations || '', required: true, rows: 4 });
  const fEv = field({ name: 'evidence', type: 'file', label: L('aud.evidence', 'Photographs / video'), demoName: 'lab-overview.jpg' });
  root.appendChild(card(L('aud.obs', 'Observations and evidence'), form([fObs, fEv], 1).node));
  const persist = (submit) => {
    if (!f.validate()) return;
    if (submit) {
      const missing = ITEMS.filter((i) => !st.items[i[0]]);
      if (missing.length) { fail(L('aud.missing', 'Answer every checklist item ({n} left).', { n: missing.length })); return; }
      if (!fObs.validate()) return;
    }
    const v = f.values();
    const now = new Date().toISOString();
    let a = existing ? byId('audits', existing.id) : null;
    if (!a) {
      a = { id: newId('audits', 'centreAudit', (n) => 'TCA-' + (1200 + n)), cen: 'CEN 07/2026', auditor: me().user.name, evidence: [] };
      insert('audits', a);
    }
    const ev = fEv.get();
    Object.assign(a, v, { items: st.items, score: score(st.items), observations: fObs.get(), status: submit ? 'Submitted' : 'Draft', submittedAt: submit ? now : null });
    a.severity = severity(a.score, a.items);
    if (ev && a.evidence.indexOf(ev) < 0) a.evidence.push(ev);
    log(who(), role(), submit ? 'Audit submitted' : 'Audit saved as draft', 'Test-centre audit', a.id, centreName(a.centre) + ' · ' + a.score + '%');
    save();
    ok(submit ? L('aud.sent', 'Audit {id} submitted to the RRB.', { id: a.id }) : L('ind.saved', 'Draft {id} saved.', { id: a.id }));
    go(submit ? '/audits/' + a.id : '/audits');
  };
  root.appendChild(h('div.rms-toolbar', btn(L('ind.saveDraft', 'Save draft'), { kind: 'plain', onClick: () => persist(false) }), btn(L('aud.submit', 'Submit to RRB'), { icon: 'send', onClick: () => persist(true) }), btn(L('ui.cancel', 'Cancel'), { kind: 'plain', href: '/audits' })));
}

// ------------------------------------------------------------------ exam-process reports
route('/exam-reports', null, (root) => {
  const q = query();
  let tab = q.tab || 'attendance';
  const reps = all('examReports');
  root.appendChild(head({
    title: L('rep.title', 'Exam-process reports'),
    sub: L('rep.sub', 'CEN 07/2026 (NTPC Graduate) CBT, 14–23 November 2026: attendance by shift, incidents, unfair-means (PUFM) cases and centre-coordinator reports.'),
    sow: '2.6',
  }));
  const att = reps.filter((r) => r.type === 'Attendance');
  const sch = att.reduce((x, r) => x + r.scheduled, 0);
  const pres = att.reduce((x, r) => x + r.present, 0);
  root.appendChild(stats([
    stat(L('rep.scheduled', 'Scheduled so far'), num(sch)),
    stat(L('rep.present', 'Present'), num(pres), { note: pct(pres, sch) }),
    stat(L('rep.incidents', 'Open incidents'), reps.filter((r) => r.type === 'Incident' && r.status === 'Open').length, { tone: 'warn' }),
    stat(L('rep.pufm', 'PUFM cases'), reps.filter((r) => r.type === 'PUFM').length, { tone: 'danger' }),
  ]));
  const wrap = h('div');
  root.appendChild(wrap);
  const t = [
    { id: 'attendance', label: L('rep.tab.att', 'Attendance') },
    { id: 'incidents', label: L('rep.tab.inc', 'Incidents'), count: reps.filter((r) => r.type === 'Incident').length },
    { id: 'pufm', label: L('rep.tab.pufm', 'PUFM cases'), count: reps.filter((r) => r.type === 'PUFM').length },
    { id: 'cc', label: L('rep.tab.cc', 'Centre-coordinator reports'), count: all('ccReports').length },
  ];
  const draw = () => mount(wrap, tabs(t, tab, (id) => { tab = id; draw(); }), tab === 'attendance' ? attendance(att) : (tab === 'incidents' ? incidents(draw) : (tab === 'pufm' ? pufm(draw) : ccTable())));
  draw();
});

function attendance(att) {
  const days = att.map((r) => r.date).filter((x, k, a) => a.indexOf(x) === k).sort();
  let day = days[days.length - 2] || days[0];
  const box = h('div');
  const pick = field({ name: 'day', type: 'select', label: L('rep.day', 'Exam day'), value: day, options: days.map((d) => ({ value: d, label: date(d) })), onChange: (v) => { day = v; draw(); } });
  const draw = () => {
    const list = att.filter((r) => r.date === day);
    const byCentre = all('centres').map((c) => {
      const mine = list.filter((r) => r.centre === c.id);
      return { label: c.id, value: mine.reduce((x, r) => x + r.scheduled, 0), value2: mine.reduce((x, r) => x + r.present, 0) };
    }).filter((x) => x.value);
    mount(box,
      card(L('rep.chart', 'Scheduled and present by centre, {d}', { d: date(day) }), hbars(byCentre, { series: [L('rep.scheduledS', 'Scheduled'), L('rep.presentS', 'Present')], labelWidth: 90, title: L('rep.chart', 'Scheduled and present by centre, {d}', { d: date(day) }), labelHead: L('col.centre', 'Centre') })),
      table({ rows: list, exportName: 'attendance-' + day, columns: [
        { key: 'centre', label: L('col.centre', 'Centre'), value: (r) => centreName(r.centre) },
        { key: 'shift', label: L('col.shift', 'Shift') },
        { key: 'scheduled', label: L('rep.scheduledS', 'Scheduled'), align: 'right' },
        { key: 'present', label: L('rep.presentS', 'Present'), align: 'right' },
        { key: 'pct', label: L('rep.pct', 'Attendance'), align: 'right', value: (r) => pct(r.present, r.scheduled), sortValue: (r) => r.present / r.scheduled },
        { key: 'biometricFail', label: L('rep.bioFail', 'Biometric failures'), align: 'right' },
        { key: 'lateEntryDenied', label: L('rep.late', 'Late entry denied'), align: 'right' },
      ], filters: [{ key: 'shift', label: L('col.shift', 'Shift'), options: ['S1', 'S2', 'S3'] }] }));
  };
  draw();
  return h('div', h('div.rms-toolbar', pick.node), box);
}

function incidents(redraw) {
  const rows = all('examReports').filter((r) => r.type === 'Incident');
  return table({ rows, exportName: 'incidents', columns: [
    { key: 'id', label: L('col.ref', 'Ref.') },
    { key: 'title', label: L('col.title', 'Title'), render: (r) => h('span', h('strong', r.title), h('br'), h('span.rms-small', r.detail)) },
    { key: 'centre', label: L('col.centre', 'Centre'), value: (r) => r.centre },
    { key: 'date', label: L('col.date', 'Date'), nowrap: true, value: (r) => date(r.date) + ' ' + r.shift, sortValue: (r) => r.date + r.shift },
    { key: 'severity', label: L('col.severity', 'Severity'), render: (r) => badge(r.severity), value: (r) => r.severity },
    { key: 'status', label: L('col.status', 'Status'), render: (r) => badge(r.status), value: (r) => r.status },
    { key: 'act', label: '', action: true, render: (r) => (r.status === 'Open' && is('rrb', 'ms') ? btn(L('rep.close', 'Close'), { small: true, kind: 'plain', onClick: () => remarks({ title: L('rep.closeTitle', 'Close incident {id}', { id: r.id }), label: L('rep.resolution', 'Resolution'), required: true, ok: L('rep.close', 'Close') }).then((t) => {
      if (t === null) return;
      r.status = 'Closed';
      r.resolution = t;
      log(who(), role(), 'Incident closed', 'Exam report', r.id, t);
      save();
      redraw();
    }) }) : (r.resolution ? h('span.rms-small.rms-muted', r.resolution) : null)) },
  ], filters: [{ key: 'status', label: L('col.status', 'Status'), options: ['Open', 'Closed'] }] });
}

function pufm(redraw) {
  const rows = all('examReports').filter((r) => r.type === 'PUFM');
  return h('div', note(L('rep.pufmNote', 'PUFM = person using unfair means. The RRB decides each case; a debarment goes through the debar register (maker, checker, Chairperson).'), 'info'), table({ rows, exportName: 'pufm-cases', columns: [
    { key: 'id', label: L('col.ref', 'Ref.') },
    { key: 'candidate', label: L('col.name', 'Name'), render: (r) => h('span', r.candidate, h('br'), h('span.rms-small.rms-muted', r.roll)) },
    { key: 'detail', label: L('rep.what', 'What happened') },
    { key: 'centre', label: L('col.centre', 'Centre') },
    { key: 'date', label: L('col.date', 'Date'), nowrap: true, value: (r) => date(r.date) + ' ' + r.shift, sortValue: (r) => r.date + r.shift },
    { key: 'status', label: L('col.status', 'Status'), render: (r) => h('span', badge(r.status), r.debar ? h('span.rms-small', ' ', link(r.debar, '/debar/' + r.debar)) : null), value: (r) => r.status },
    { key: 'act', label: '', action: true, render: (r) => (is('rrb') && r.status === 'Under inquiry' ? btn(L('rep.toDebar', 'Refer to debar'), { small: true, onClick: () => confirm(L('rep.toDebarQ', 'Open a debar record for {n}, prefilled from {id}?', { n: r.candidate, id: r.id })).then((y) => { if (y) go('/debar/new?report=' + r.id); }) }) : null) },
  ] }));
}

function ccTable() {
  return table({ rows: all('ccReports'), exportName: 'centre-coordinator-reports', columns: [
    { key: 'centre', label: L('col.centre', 'Centre'), value: (r) => centreName(r.centre) },
    { key: 'date', label: L('col.date', 'Date'), nowrap: true, value: (r) => date(r.date) },
    { key: 'shifts', label: L('rep.shifts', 'Shifts'), align: 'right' },
    { key: 'startDelayMin', label: L('rep.delay', 'Start delay (min)'), align: 'right' },
    { key: 'systemsUsed', label: L('rep.systems', 'Systems used'), align: 'right' },
    { key: 'spareSystems', label: L('rep.spares', 'Spares'), align: 'right' },
    { key: 'systemFailures', label: L('rep.failures', 'System failures'), align: 'right' },
    { key: 'remarks', label: L('ui.remarks', 'Remarks') },
    { key: 'status', label: L('col.status', 'Status'), render: (r) => badge(r.status), value: (r) => r.status },
  ] });
}
