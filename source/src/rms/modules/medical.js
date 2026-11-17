// SOW 2.10: medical examination. The RRB refers DV-recommended candidates to a railway hospital
// (memo + HMIS push); the hospital records the result and certificate, which returns via HMIS.
import { h, mount, icon } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, data, save, log, candidate, notify, insert, next } from '../core/store.js';
import { role, who, is, me } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, stats, stat, split, empty } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form, seg } from '../ui/form.js';
import { modal, ok, fail, otp } from '../ui/dialogs.js';
import { portrait } from '../ui/photo.js';
import { showDoc, sigBlock } from '../ui/doc.js';
import { candLink, catLabel, postName, hospitalName, newId } from './common.js';
import { STD_ORDER, fitFor } from '../core/engine.js';
import { date, dateTime, iso } from '../core/format.js';
import { L } from '../i18n.js';
import { medicalMemo as memo } from '../letters.js';

function strictest(prefs) {
  let best = 'C2';
  prefs.forEach((pid) => { const p = byId('posts', pid); if (p && STD_ORDER.indexOf(p.med) < STD_ORDER.indexOf(best)) best = p.med; });
  return best;
}
function today() { return iso(new Date()); }
function intLog(system, direction, message, status) {
  insert('intLog', { id: newId('intLog', 'intlog', (n) => 'IL-' + (9000 + n)), system, direction, message, status: status || 'OK', at: new Date().toISOString(), ref: 'MSG-' + (100000 + next('msg') * 7) });
}


route('/medical', null, (root) => {
  const q = query();
  let tab = q.tab || 'refer';
  const draw = () => {
    mount(root);
    const cands = all('candidates').filter((c) => c.cen === 'CEN 04/2026');
    const toRefer = cands.filter((c) => c.dv && c.dv.outcome === 'Recommended' && !c.medical);
    const referred = cands.filter((c) => c.medical && c.medical.status === 'Referred');
    const examined = cands.filter((c) => c.medical && c.medical.status !== 'Referred');
    const hmisPending = cands.filter((c) => c.medical && c.medical.hmis === 'Pending');
    root.appendChild(head({
      title: L('med.title', 'Medical examination & HMIS'),
      sub: L('med.sub', 'CEN 04/2026: refer DV-recommended candidates to railway hospitals for the strictest medical standard among their preferences, push the referral to HMIS and follow the results.'),
      sow: '2.10',
      actions: is('rrb', 'ms') && hmisPending.length ? [btn(L('med.pushAll', 'Push {n} referral(s) to HMIS', { n: hmisPending.length }), { icon: 'send', onClick: () => push(hmisPending, draw) })] : [],
    }));
    root.appendChild(stats([
      stat(L('med.toRefer', 'Recommended, not referred'), toRefer.length, { tone: toRefer.length ? 'warn' : null }),
      stat(L('med.referred', 'Waiting for examination'), referred.length, { tone: 'navy' }),
      stat(L('med.fit', 'Fit'), examined.filter((c) => c.medical.result === 'Fit').length, { tone: 'ok' }),
      stat(L('med.unfit', 'Unfit / temporarily unfit'), examined.filter((c) => /Unfit|Temporarily/.test(c.medical.result || '')).length, { tone: 'danger' }),
      stat(L('med.hmisPending', 'Not yet in HMIS'), hmisPending.length, { tone: hmisPending.length ? 'warn' : null }),
    ]));
    const t = [{ id: 'refer', label: L('med.tab.refer', 'To refer'), count: toRefer.length }, { id: 'referred', label: L('med.tab.referred', 'Referred'), count: referred.length }, { id: 'results', label: L('med.tab.results', 'Results'), count: examined.length }];
    root.appendChild(tabs(t, tab, (id) => { tab = id; draw(); }));
    if (tab === 'refer') {
      const tbl = table({ rows: toRefer, select: is('rrb', 'ms'), rowId: (c) => c.id, columns: [
        { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => candLink(c.id) },
        { key: 'cat', label: L('col.category', 'Category'), value: catLabel },
        { key: 'prefs', label: L('dv.prefs', 'Post preferences'), value: (c) => c.prefs.map(postName).join(', ') },
        { key: 'req', label: L('med.required', 'Medical standard required'), value: (c) => strictest(c.prefs) },
        { key: 'dv', label: L('med.dvOn', 'DV on'), nowrap: true, value: (c) => date(c.dv.at || c.dv.date), sortValue: (c) => c.dv.at || c.dv.date },
      ], empty: L('med.noneToRefer', 'Every recommended candidate has been referred.') });
      root.appendChild(tbl);
      if (is('rrb', 'ms') && toRefer.length) root.appendChild(h('div.rms-toolbar', btn(L('med.referSel', 'Refer selected'), { icon: 'send', onClick: () => { const sel = tbl.selected(); if (!sel.length) { fail(L('med.pick', 'Select candidates first.')); return; } refer(sel, draw); } })));
    }
    if (tab === 'referred') root.appendChild(table({ rows: referred, exportName: 'medical-referrals', columns: [
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => candLink(c.id) },
      { key: 'hospital', label: L('med.hospital', 'Hospital'), value: (c) => hospitalName(c.medical.hospital) },
      { key: 'examDate', label: L('med.examOn', 'Examination on'), nowrap: true, value: (c) => date(c.medical.examDate), sortValue: (c) => c.medical.examDate },
      { key: 'req', label: L('med.std', 'Std.'), value: (c) => c.medical.required },
      { key: 'memo', label: L('med.memoNo', 'Memo'), render: (c) => h('a.rms-link', { href: 'javascript:void 0', onclick: (e) => { e.preventDefault(); memo(c); } }, c.medical.memoNo) },
      { key: 'hmis', label: 'HMIS', render: (c) => badge(c.medical.hmis === 'Pending' ? 'Pending' : 'Acknowledged', c.medical.hmis === 'Pending' ? L('med.notPushed', 'Not pushed') : c.medical.hmisRef), value: (c) => c.medical.hmis },
    ], filters: [{ key: 'h', label: L('med.hospital', 'Hospital'), options: all('hospitals').map((x) => ({ value: x.id, label: x.name })), match: (c, v) => c.medical.hospital === v }] }));
    if (tab === 'results') root.appendChild(table({ rows: examined, exportName: 'medical-results', columns: [
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => candLink(c.id) },
      { key: 'hospital', label: L('med.hospital', 'Hospital'), value: (c) => hospitalName(c.medical.hospital) },
      { key: 'at', label: L('med.examined', 'Examined'), nowrap: true, value: (c) => (c.medical.at ? date(c.medical.at) : date(c.medical.examDate)), sortValue: (c) => c.medical.at || c.medical.examDate },
      { key: 'req', label: L('med.std', 'Std.'), value: (c) => c.medical.required },
      { key: 'result', label: L('med.result', 'Result'), render: (c) => badge(c.medical.result || c.medical.status, (c.medical.result || c.medical.status) + (c.medical.std ? ' · ' + c.medical.std : '')), value: (c) => c.medical.result || c.medical.status },
      { key: 'fitFor', label: L('med.fitFor', 'Fit for preferred posts'), value: (c) => (c.medical.std ? c.prefs.filter((p) => fitFor(c.medical.std, byId('posts', p).med)).map(postName).join(', ') : '—') },
      { key: 'act', label: '', action: true, render: (c) => (c.medical.result === 'Temporarily unfit' && is('rrb', 'ms') && !c.medical.reReferred ? btn(L('med.reRefer', 'Refer for re-examination'), { small: true, kind: 'plain', onClick: () => reRefer(c, draw) }) : (c.medical.reExamBy ? h('span.rms-small.rms-muted', L('med.reBy', 'Re-examine by {d}', { d: date(c.medical.reExamBy) })) : null)) },
    ], filters: [{ key: 'r', label: L('med.result', 'Result'), options: ['Fit', 'Unfit', 'Temporarily unfit', 'Absent'], match: (c, v) => (c.medical.result || c.medical.status) === v }] }));
  };
  draw();
});

function refer(list, redraw) {
  const f = form([
    field({ name: 'hospital', type: 'select', label: L('med.hospital', 'Hospital'), required: true, value: 'SBCDH', options: all('hospitals').map((x) => ({ value: x.id, label: x.name })) }),
    field({ name: 'examDate', type: 'date', label: L('med.examOn', 'Examination on'), required: true, value: iso(new Date(Date.now() + 2 * 864e5)) }),
  ], 2);
  modal({ title: L('med.referN', 'Refer {n} candidate(s) for medical examination', { n: list.length }), body: h('div', f.node, note(L('med.referNote', 'A memo is generated for each candidate and the referral is pushed to HMIS. Candidates are informed by SMS and e-mail.'), 'info')), actions: [
    { label: L('med.refer', 'Refer & push to HMIS'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      if (v.examDate < today()) { fail(L('med.past', 'The examination date cannot be in the past.')); return false; }
      const now = new Date().toISOString();
      list.forEach((c) => {
        c.medical = { hospital: v.hospital, memoNo: 'SBC/MED/04/' + data().seq.memo++, required: strictest(c.prefs), referredAt: now, examDate: v.examDate, hmis: 'Acknowledged', hmisRef: 'HMIS-' + (700000 + next('hmis') * 37), status: 'Referred', result: null, std: null, certificate: null, at: null };
        c.stage = 'Medical referred';
        notify(c.id, 'SMS', 'Medical memo', 'Medical examination on ' + date(v.examDate) + ' at ' + hospitalName(v.hospital));
      });
      intLog('HMIS', 'Outbound', 'Medical advice pushed for ' + list.length + ' candidate(s) (CEN 04/2026)');
      log(who(), role(), 'Referred for medical examination', 'Medical', hospitalName(v.hospital), list.map((c) => c.id).join(', '));
      save();
      ok(L('med.referredOk', '{n} candidate(s) referred; HMIS acknowledged.', { n: list.length }));
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

function push(list, redraw) {
  list.forEach((c) => { c.medical.hmis = 'Acknowledged'; c.medical.hmisRef = 'HMIS-' + (700000 + next('hmis') * 37); });
  intLog('HMIS', 'Outbound', 'Medical advice pushed for ' + list.length + ' candidate(s) (CEN 04/2026)');
  log(who(), role(), 'Referrals pushed to HMIS', 'Medical', '', list.length + ' candidate(s)');
  save();
  ok(L('med.pushed', '{n} referral(s) acknowledged by HMIS.', { n: list.length }));
  redraw();
}

function reRefer(c, redraw) {
  otp({ title: L('med.reRefer', 'Refer for re-examination') }).then((y) => {
    if (!y) return;
    const prev = Object.assign({}, c.medical);
    c.medical = { hospital: prev.hospital, memoNo: 'SBC/MED/04/' + data().seq.memo++, required: prev.required, referredAt: new Date().toISOString(), examDate: prev.reExamBy || iso(new Date(Date.now() + 7 * 864e5)), hmis: 'Acknowledged', hmisRef: 'HMIS-' + (700000 + next('hmis') * 37), status: 'Referred', result: null, std: null, previous: prev, reReferred: true };
    c.stage = 'Medical referred';
    intLog('HMIS', 'Outbound', 'Re-examination advice for ' + c.id);
    log(who(), role(), 'Referred for re-examination', 'Candidate', c.id, '');
    save();
    redraw();
  });
}

// ------------------------------------------------------------------ hospital desk
function myHospital() { return me().user.hospital || 'SBCDH'; }

route('/hospital', null, (root) => {
  const hosp = myHospital();
  const list = all('candidates').filter((c) => c.medical && c.medical.hospital === hosp);
  const due = list.filter((c) => c.medical.status === 'Referred');
  root.appendChild(head({ title: hospitalName(hosp), sub: L('hosp.sub', 'Candidates referred by RRB Bengaluru through HMIS. Confirm identity from the memo photograph, examine for the standard required and send the result back.'), sow: '2.10' }));
  root.appendChild(stats([
    stat(L('hosp.today', 'Due today'), due.filter((c) => c.medical.examDate === today()).length, { tone: 'navy' }),
    stat(L('hosp.later', 'Due later'), due.filter((c) => c.medical.examDate > today()).length),
    stat(L('hosp.overdue', 'Overdue'), due.filter((c) => c.medical.examDate < today()).length, { tone: 'danger' }),
    stat(L('hosp.done', 'Examined'), list.filter((c) => c.medical.status !== 'Referred').length, { tone: 'ok' }),
  ]));
  root.appendChild(card(L('hosp.queue', 'Waiting for examination'), table({ rows: due, sort: 'examDate', dir: 1, columns: [
    { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => link(c.id, '/hospital/' + c.id) },
    { key: 'name', label: L('col.name', 'Name') },
    { key: 'gender', label: L('col.gender', 'Gender') },
    { key: 'examDate', label: L('med.examOn', 'Examination on'), nowrap: true, value: (c) => date(c.medical.examDate), sortValue: (c) => c.medical.examDate },
    { key: 'req', label: L('med.required', 'Medical standard required'), value: (c) => c.medical.required },
    { key: 'memo', label: L('med.memoNo', 'Memo'), value: (c) => c.medical.memoNo },
    { key: 'act', label: '', action: true, render: (c) => btn(L('hosp.examine', 'Examine'), { small: true, href: '/hospital/' + c.id }) },
  ], onRow: (c) => go('/hospital/' + c.id), empty: L('hosp.none', 'No candidate is waiting.') })));
  root.appendChild(card(L('hosp.doneT', 'Examined'), table({ rows: list.filter((c) => c.medical.status !== 'Referred'), pageSize: 8, columns: [
    { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => link(c.id, '/hospital/' + c.id) },
    { key: 'name', label: L('col.name', 'Name') },
    { key: 'at', label: L('med.examined', 'Examined'), nowrap: true, value: (c) => (c.medical.at ? date(c.medical.at) : '—'), sortValue: (c) => c.medical.at || '' },
    { key: 'result', label: L('med.result', 'Result'), render: (c) => badge(c.medical.result || c.medical.status, (c.medical.result || c.medical.status) + (c.medical.std ? ' · ' + c.medical.std : '')) },
    { key: 'cert', label: L('hosp.cert', 'Certificate'), value: (c) => c.medical.certificate || '—' },
  ] })));
});

route('/hospital/:roll', null, (root, prm) => {
  const c = candidate(prm.roll);
  if (!c || !c.medical) { root.appendChild(head({ title: L('hosp.notFound', 'No referral for this roll number') })); return; }
  if (is('hospital') && c.medical.hospital !== myHospital()) { root.appendChild(head({ title: L('hosp.other', 'Referred to another hospital') })); return; }
  const st = { identity: false, result: '', std: c.medical.required, reExam: iso(new Date(Date.now() + 30 * 864e5)), cert: '', remarks: '' };
  const draw = () => {
    mount(root);
    const m = c.medical;
    root.appendChild(head({ title: c.name, sub: c.id + ' · ' + m.memoNo + ' · ' + L('med.required', 'Medical standard required') + ': ' + m.required, crumbs: [{ label: hospitalName(m.hospital), href: '/hospital' }, { label: c.id }], actions: [btn(L('med.memo', 'Medical examination memo'), { kind: 'plain', icon: 'doc', onClick: () => memo(c) })], sow: '2.10' }));
    root.appendChild(card(L('hosp.identity', 'Candidate'), split(kv([
      [L('col.roll', 'Roll no.'), c.id], [L('col.name', 'Name'), c.name], [L('col.gender', 'Gender'), c.gender], [L('col.dob', 'Date of birth'), date(c.dob)],
      [L('med.required', 'Medical standard required'), h('strong', m.required)], [L('med.examOn', 'Examination on'), date(m.examDate)], ['HMIS', m.hmisRef || '—'], [L('dv.prefs', 'Post preferences'), c.prefs.map((p) => postName(p) + ' (' + byId('posts', p).med + ')').join(', ')],
    ]), portrait(c.photo, { size: 110, caption: L('hosp.memoPhoto', 'Photograph on the memo') }))));
    if (m.status !== 'Referred') {
      root.appendChild(card(L('hosp.result', 'Result sent to RRB'), h('div', kv([[L('med.result', 'Result'), badge(m.result || m.status, (m.result || m.status) + (m.std ? ' · ' + m.std : ''))], [L('med.examined', 'Examined'), m.at ? dateTime(m.at) : '—'], [L('hosp.by', 'Examined by'), m.examinedBy || '—'], [L('hosp.cert', 'Certificate'), m.certificate || '—']]),
        m.result === 'Temporarily unfit' ? note(L('hosp.reExamNote', 'Re-examination due by {d}.', { d: date(m.reExamBy) }), 'warning') : null)));
      return;
    }
    if (!is('hospital')) { root.appendChild(note(L('hosp.onlyHosp', 'The result is entered by the hospital.'), 'info')); return; }
    const resBox = h('div');
    const drawRes = () => mount(resBox,
      seg(L('med.result', 'Result'), [{ value: 'Fit', label: L('hosp.fit', 'Fit') }, { value: 'Temporarily unfit', label: L('hosp.temp', 'Temporarily unfit') }, { value: 'Unfit', label: L('hosp.unfit', 'Unfit'), cls: 'is-bad' }, { value: 'Absent', label: L('hosp.absent', 'Absent'), cls: 'is-na' }], st.result, (v) => { st.result = v; drawRes(); }),
      st.result === 'Fit' ? field({ name: 'std', type: 'select', label: L('hosp.stdAchieved', 'Fit in medical standard'), value: st.std, options: STD_ORDER, help: L('hosp.stdHelp', 'Fit in a higher standard means fit for all lower ones.'), onChange: (v) => { st.std = v; } }).node : null,
      st.result === 'Temporarily unfit' ? field({ name: 'reExam', type: 'date', label: L('hosp.reExamBy', 'Re-examine by'), value: st.reExam, onChange: (v) => { st.reExam = v; } }).node : null,
      st.result && st.result !== 'Absent' ? field({ name: 'cert', type: 'file', label: L('hosp.certUp', 'Medical certificate (signed PDF)'), demoName: 'MFC-' + c.id.slice(-6) + '.pdf', onChange: (v) => { st.cert = v; } }).node : null);
    drawRes();
    root.appendChild(card(L('hosp.examineT', 'Examination'), h('div',
      h('label.rms-check', h('input', { type: 'checkbox', checked: st.identity, onchange: (e) => { st.identity = e.target.checked; } }), h('span', L('hosp.idCheck', 'Identity confirmed against the memo photograph and original Aadhaar'))),
      resBox,
      field({ name: 'remarks', type: 'textarea', label: L('ui.remarks', 'Remarks'), rows: 3, onChange: (v) => { st.remarks = v; } }).node)));
    root.appendChild(h('div.rms-toolbar', btn(L('hosp.send', 'Sign & send result through HMIS'), { icon: 'send', kind: 'ok', onClick: send })));
  };
  function send() {
    if (!st.identity && st.result !== 'Absent') { fail(L('hosp.needId', 'Confirm the candidate’s identity first.')); return; }
    if (!st.result) { fail(L('hosp.needResult', 'Choose the result.')); return; }
    if (st.result !== 'Absent' && !st.cert) { fail(L('hosp.needCert', 'Attach the medical certificate.')); return; }
    otp({ title: L('hosp.sign', 'Sign the medical result') }).then((y) => {
      if (!y) return;
      const m = c.medical;
      const now = new Date().toISOString();
      Object.assign(m, { status: st.result === 'Absent' ? 'Absent' : 'Examined', result: st.result === 'Absent' ? null : st.result, std: st.result === 'Fit' ? st.std : null, certificate: st.cert || null, at: now, examinedBy: who(), remarks: st.remarks, reExamBy: st.result === 'Temporarily unfit' ? st.reExam : null });
      c.stage = st.result === 'Fit' ? 'Medically fit' : (st.result === 'Unfit' ? 'Medically unfit' : (st.result === 'Absent' ? 'Medical absent' : 'Temporarily unfit'));
      intLog('HMIS', 'Inbound', 'Medical result received for ' + c.id + ' (' + st.result + ')');
      notify(c.id, 'SMS', 'Medical result', 'Medical examination result recorded, ' + c.cen);
      log(who(), role(), 'Medical result: ' + st.result + (st.result === 'Fit' ? ' (' + st.std + ')' : ''), 'Candidate', c.id, hospitalName(m.hospital));
      save();
      ok(L('hosp.sent', 'Result sent to RRB Bengaluru through HMIS.'));
      draw();
    });
  }
  draw();
  void icon; void empty;
});
