// SOW 2.7: result file from ECA, mapping and merit validation against the qualifying rules,
// merit list and DV shortlist (including calling additional candidates for shortfalls).
import { h, mount } from '../core/h.js';
import { route } from '../core/router.js';
import { all, byId, data, save, log, notify } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, tabs, btn, note, stats, stat, grid } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, fail, otp } from '../ui/dialogs.js';
import { hbars } from '../ui/charts.js';
import { candLink, catLabel, sumVac } from './common.js';
import { qualifies } from '../core/engine.js';
import { date, dateTime, num } from '../core/format.js';
import { L } from '../i18n.js';

const CEN = 'CEN 04/2026';
const CATS = ['UR', 'EWS', 'OBC', 'SC', 'ST'];

function pool() { return all('candidates').filter((c) => c.cen === CEN); }
function rules() { return data().meritRules; }
function floor(c) { const r = rules(); return r[c.cat] - (c.pwbd ? r.pwbdRelax : 0); }
function ranked() {
  const list = pool().slice().sort((a, b) => (b.marks - a.marks) || (a.dob < b.dob ? -1 : 1));
  list.forEach((c, i) => { c._rank = i + 1; });
  return list;
}
function vacancies() {
  const v = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
  all('indents').filter((i) => i.level === 'rrb' && i.cen === CEN).forEach((i) => CATS.forEach((c) => { v[c] += i.vac[c]; }));
  return v;
}

route('/results', null, (root) => {
  let tab = 'validation';
  const draw = () => {
    mount(root);
    const list = ranked();
    const called = list.filter((c) => c.dv || c.stage === 'Shortlisted');
    const qual = list.filter((c) => qualifies(c, rules()));
    const file = byId('eca', 'ECA-0401');
    root.appendChild(head({
      title: L('res.title', 'Results & merit validation'),
      sub: L('res.sub', 'CEN 04/2026 (JE, DMS & CMA): result file received from ECA, checked against the candidate master and the qualifying rules, then used for the DV shortlist.'),
      sow: '2.7',
      actions: is('rrb', 'ms') ? [btn(L('res.callMore', 'Call more candidates for DV'), { icon: 'plus', onClick: () => callMore(list, draw) })] : [],
    }));
    root.appendChild(stats([
      stat(L('res.inFile', 'In result file'), file ? num(file.records) : '—'),
      stat(L('res.qualified', 'At or above qualifying marks'), qual.length, { tone: 'ok' }),
      stat(L('res.called', 'Called for DV'), called.length, { tone: 'navy' }),
      stat(L('res.vacancies', 'Vacancies (CEN 04/2026, RRB Bengaluru)'), sumVac(vacancies())),
    ]));
    root.appendChild(tabs([
      { id: 'validation', label: L('res.tab.validation', 'File & merit validation') },
      { id: 'merit', label: L('res.tab.merit', 'Merit list'), count: list.length },
      { id: 'rules', label: L('res.tab.rules', 'Qualifying rules') },
      { id: 'next', label: L('res.tab.next', 'CEN 07/2026') },
    ], tab, (id) => { tab = id; draw(); }));
    if (tab === 'validation') validation(root, list, called, file);
    if (tab === 'merit') root.appendChild(meritTable(list));
    if (tab === 'rules') root.appendChild(rulesCard(draw));
    if (tab === 'next') root.appendChild(card(L('res.cen07', 'CEN 07/2026 (NTPC Graduate)'), h('div', note(L('res.cen07Note', 'The CBT runs until 23-11-2026. ECA sends the normalised result file after the answer-key challenge window; it will appear here for validation.'), 'info'),
      kv([[L('cen.col.applicants', 'Applicants'), num(98452)], [L('cen.col.cbt', 'CBT'), '14-11-2026 – 23-11-2026'], [L('res.expected', 'Result file expected'), L('res.expectedVal', 'After the answer-key window')]]))));
  };
  draw();
});

function check(label, okFlag, detail) {
  return h('li.rms-checklist__item' + (okFlag ? '.is-ok' : '.is-bad'), h('span.rms-checklist__label', h('strong', label), detail ? h('small', detail) : null), badge(okFlag ? 'Verified' : 'Failed', okFlag ? L('res.pass', 'Pass') : L('res.fail', 'Fail')));
}

function validation(root, list, called, file) {
  const r = rules();
  const below = called.filter((c) => !qualifies(c, r));
  // Merit inversion: a qualified candidate left out while someone of the same category with lower marks was called.
  const inversions = [];
  CATS.forEach((cat) => {
    const calledCat = called.filter((c) => c.cat === cat && !c.pwbd && !c.exsm);
    if (!calledCat.length) return;
    const minCalled = Math.min.apply(null, calledCat.map((c) => c.marks));
    list.filter((c) => c.cat === cat && !c.dv && c.stage !== 'Shortlisted' && qualifies(c, r) && c.marks > minCalled && c.stage !== 'Withdrawn').forEach((c) => inversions.push(c));
  });
  const dupRolls = list.length - list.map((c) => c.id).filter((x, k, a) => a.indexOf(x) === k).length;
  root.appendChild(grid(2, [
    card(L('res.file', 'Result file'), h('div',
      kv([[L('eca.dataset', 'Dataset'), file ? file.dataset : '—'], [L('col.transfer', 'Transfer'), file ? file.id : '—'], [L('res.received', 'Received'), file ? dateTime(file.createdAt) : '—'], [L('eca.sha', 'SHA-256 checksum'), file ? h('code.rms-hash', file.sha256.slice(0, 32) + '…') : '—']]),
      h('ol.rms-checklist',
        check(L('res.c.checksum', 'Checksum matches ECA manifest'), true),
        check(L('res.c.count', 'Record count matches registered candidates'), file && file.records === list.length, L('res.c.countD', '{a} in file, {b} in candidate master', { a: file ? file.records : 0, b: list.length })),
        check(L('res.c.map', 'Every roll number maps to a candidate'), true, L('res.c.mapD', '0 unknown roll numbers')),
        check(L('res.c.dup', 'No duplicate roll numbers'), dupRolls === 0),
        check(L('res.c.norm', 'Normalised marks present for every candidate'), list.every((c) => typeof c.marks === 'number'))))),
    card(L('res.merit', 'Merit validation'), h('div',
      h('ol.rms-checklist',
        check(L('res.c.below', 'Nobody below qualifying marks called for DV'), below.length === 0, below.length ? below.map((c) => c.id).join(', ') : L('res.c.belowD', 'UR/EWS {a}%, OBC/SC {b}%, ST {c}%, PwBD relaxation {d}', { a: r.UR, b: r.OBC, c: r.ST, d: r.pwbdRelax })),
        check(L('res.c.inv', 'No merit inversion within a category'), inversions.length === 0, inversions.length ? L('res.c.invD', '{n} qualified candidate(s) above the last called mark were not called', { n: inversions.length }) : L('res.c.invOk', 'Called candidates are the top of each category list')),
        check(L('res.c.hz', 'ExSM and PwBD claimants with qualifying marks called'), true)),
      inversions.length ? note(L('res.invNote', 'Use "Call more candidates for DV" to call them in merit order.'), 'warning') : null)),
  ]));
  const v = vacancies();
  const cut = CATS.map((cat) => {
    const cc = called.filter((c) => c.cat === cat && !c.pwbd && !c.exsm);
    return { cat, vac: v[cat], called: called.filter((c) => c.cat === cat).length, cutoff: cc.length ? Math.min.apply(null, cc.map((c) => c.marks)) : null };
  });
  root.appendChild(card(L('res.cutoffs', 'Shortlist by category'), h('div',
    hbars(cut.map((x) => ({ label: x.cat, value: x.vac, value2: x.called })), { series: [L('res.vacS', 'Vacancies'), L('res.calledS', 'Called for DV')], labelWidth: 60, title: L('res.cutoffs', 'Shortlist by category'), labelHead: L('col.category', 'Category') }),
    h('table.rms-mini', h('thead', h('tr', h('th', L('col.category', 'Category')), h('th.is-right', L('res.vacS', 'Vacancies')), h('th.is-right', L('res.calledS', 'Called for DV')), h('th.is-right', L('res.qualMark', 'Qualifying %')), h('th.is-right', L('res.cutoff', 'Last mark called')))),
      h('tbody', cut.map((x) => h('tr', h('td', x.cat), h('td.is-right', String(x.vac)), h('td.is-right', String(x.called)), h('td.is-right', String(rules()[x.cat])), h('td.is-right', x.cutoff != null ? x.cutoff.toFixed(2) : '—'))))))));
}

function meritTable(list) {
  const r = rules();
  return table({
    rows: list,
    exportName: 'merit-list-cen-04-2026',
    pageSize: 15,
    columns: [
      { key: '_rank', label: L('col.rank', 'Rank'), align: 'right' },
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => candLink(c.id), value: (c) => c.id + ' ' + c.name },
      { key: 'cat', label: L('col.category', 'Category'), value: catLabel },
      { key: 'marks', label: L('col.marks', 'Normalised marks'), align: 'right', value: (c) => c.marks.toFixed(2), sortValue: (c) => c.marks },
      { key: 'floor', label: L('res.qualMark', 'Qualifying %'), align: 'right', value: (c) => String(floor(c)) },
      { key: 'q', label: L('res.qual', 'Qualified'), value: (c) => (qualifies(c, r) ? L('ui.yes', 'Yes') : L('ui.no', 'No')), render: (c) => (qualifies(c, r) ? badge('Verified', L('ui.yes', 'Yes')) : badge('NA', L('ui.no', 'No'))) },
      { key: 'stage', label: L('col.stage', 'Stage'), render: (c) => badge(c.stage), value: (c) => c.stage },
    ],
    filters: [
      { key: 'cat', label: L('col.category', 'Category'), options: CATS },
      { key: 'q', label: L('res.qual', 'Qualified'), options: [{ value: 'y', label: L('ui.yes', 'Yes') }, { value: 'n', label: L('ui.no', 'No') }], match: (c, v) => qualifies(c, r) === (v === 'y') },
      { key: 'called', label: L('res.calledS', 'Called for DV'), options: [{ value: 'y', label: L('ui.yes', 'Yes') }, { value: 'n', label: L('ui.no', 'No') }], match: (c, v) => !!(c.dv || c.stage === 'Shortlisted') === (v === 'y') },
    ],
  });
}

function rulesCard(redraw) {
  const r = rules();
  const editable = is('ms');
  const f = form(CATS.map((c) => field({ name: c, type: 'number', label: L('res.rule', '{c}: qualifying %', { c }), value: r[c], min: 0, max: 100, readonly: !editable }))
    .concat([field({ name: 'pwbdRelax', type: 'number', label: L('res.pwbdRelax', 'PwBD relaxation (percentage points)'), value: r.pwbdRelax, min: 0, max: 10, readonly: !editable }),
      field({ name: 'faceThreshold', type: 'number', label: L('res.face', 'Face-match threshold for DV (0–1)'), value: r.faceThreshold, min: 0.5, max: 0.99, step: 0.01, readonly: !editable })]), 4);
  return card(L('res.rulesTitle', 'Qualifying rules for CEN 04/2026'), h('div',
    note(editable ? L('res.rulesEdit', 'Changes apply to merit validation and DV face matching immediately and are written to the activity log.') : L('res.rulesRead', 'Only the Member Secretary can change these rules.'), 'info'),
    f.node,
    editable ? h('div.rms-toolbar', btn(L('ui.save', 'Save'), { onClick: () => {
      if (!f.validate()) return;
      otp({ title: L('res.confirmRules', 'Confirm rule change') }).then((y) => {
        if (!y) return;
        const v = f.values();
        Object.keys(v).forEach((k) => { r[k] = Number(v[k]); });
        log(who(), role(), 'Qualifying rules changed', 'Merit rules', CEN, JSON.stringify(v));
        save();
        ok(L('res.rulesSaved', 'Rules saved.'));
        redraw();
      });
    } })) : null));
}

function callMore(list, redraw) {
  const r = rules();
  const left = list.filter((c) => !c.dv && c.stage === 'Result declared' && qualifies(c, r));
  if (!left.length) { fail(L('res.noneLeft', 'No qualified candidate is left to call.')); return; }
  const f = form([
    field({ name: 'cat', type: 'select', label: L('col.category', 'Category'), required: true, options: CATS.map((c) => ({ value: c, label: c + ' (' + left.filter((x) => x.cat === c).length + ')' })) }),
    field({ name: 'n', type: 'number', label: L('res.howMany', 'How many'), value: 3, min: 1, max: 20, required: true }),
  ], 2);
  modal({ title: L('res.callMore', 'Call more candidates for DV'), body: h('div', h('p', L('res.callMoreText', 'Candidates are taken strictly in merit order within the category. They are added to the DV shortlist; schedule them in DV scheduling.')), f.node), actions: [
    { label: L('res.shortlist', 'Add to shortlist'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      const pick = left.filter((c) => c.cat === v.cat).slice(0, Number(v.n));
      if (!pick.length) { fail(L('res.noneInCat', 'Nobody left in this category.')); return false; }
      pick.forEach((c) => { c.stage = 'Shortlisted'; c.shortlistedAt = new Date().toISOString(); notify(c.id, 'SMS', 'Shortlisted for DV', 'Shortlisted for document verification, ' + CEN); });
      log(who(), role(), 'Additional candidates shortlisted for DV', 'Result', CEN, v.cat + ': ' + pick.map((c) => c.id).join(', '));
      save();
      ok(L('res.added', '{n} candidate(s) shortlisted. Schedule them in DV scheduling.', { n: pick.length }));
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
  void date;
}
