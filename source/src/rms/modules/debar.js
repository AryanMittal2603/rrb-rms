// SOW 2.4: debar register with maker (RRB) → checker (Member Secretary) → final approval
// (Chairperson), revocation, a lookup tool and screening of a CEN's candidates against the list.
import { h, mount, icon } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, save, log, insert, candidate } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, split, stats, stat } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { ok, fail, remarks, otp } from '../ui/dialogs.js';
import { history, stepper } from '../ui/timeline.js';
import { portrait } from '../ui/photo.js';
import { rrbName, newId, pad, candLink } from './common.js';
import { date, iso } from '../core/format.js';
import { L } from '../i18n.js';

const REASONS = [
  'Impersonation at CBT',
  'Use of unfair means (electronic device) at CBT',
  'Tampering with documents at DV',
  'Fake caste / EWS certificate',
  'Fake educational certificate',
  'Suppression of facts: pending criminal case not declared',
  'Multiple applications with different identities',
  'Misbehaviour with exam officials',
];
const PERIODS = ['1 year', '2 years', '3 years', '5 years', 'Lifetime'];
const STAGES = ['Application', 'CBT', 'DV', 'Medical', 'Appointment'];

function myQueue() {
  const r = role();
  const list = all('debar');
  if (r === 'rrb') return list.filter((d) => d.status === 'Draft' || d.status === 'Returned to maker');
  if (r === 'ms') return list.filter((d) => d.status === 'Pending checker');
  if (r === 'chair') return list.filter((d) => d.status === 'Pending final approval');
  return [];
}

function cols() {
  return [
    { key: 'id', label: L('col.record', 'Record'), render: (d) => link(d.id, '/debar/' + d.id) },
    { key: 'name', label: L('col.name', 'Name') },
    { key: 'father', label: L('col.father', 'Father’s name') },
    { key: 'dob', label: L('col.dob', 'Date of birth'), nowrap: true, value: (d) => date(d.dob), sortValue: (d) => d.dob },
    { key: 'id4', label: L('col.idDoc', 'ID (last 4)'), value: (d) => d.idType + ' ·' + d.idLast4 },
    { key: 'reason', label: L('col.reason', 'Reason') },
    { key: 'period', label: L('col.period', 'Period'), value: (d) => d.period + (d.to ? ' (' + L('debar.till', 'till {d}', { d: date(d.to) }) + ')' : '') },
    { key: 'status', label: L('col.status', 'Status'), render: (d) => badge(d.status), value: (d) => d.status },
  ];
}

route('/debar', null, (root) => {
  const q = query();
  const queue = myQueue();
  const t = [{ id: 'register', label: L('debar.tab.register', 'Register'), count: all('debar').filter((d) => ['Active', 'Expired', 'Revoked'].indexOf(d.status) >= 0).length }];
  if (is('rrb', 'ms', 'chair')) t.push({ id: 'queue', label: L('debar.tab.queue', 'Waiting for me'), count: queue.length });
  t.push({ id: 'pipeline', label: L('debar.tab.pipeline', 'In approval') });
  t.push({ id: 'check', label: L('debar.tab.check', 'Check a person / screen a CEN') });
  let tab = q.tab || (queue.length ? 'queue' : 'register');
  root.appendChild(head({
    title: L('debar.title', 'Debar register'),
    sub: L('debar.sub', 'Candidates debarred for malpractice. Each record is created by the RRB (maker), checked by the Member Secretary and approved by the Chairperson. Active records are screened at every stage.'),
    sow: '2.4',
    actions: is('rrb') ? [btn(L('debar.new', 'New debar record'), { icon: 'plus', href: '/debar/new' })] : [],
  }));
  const list = all('debar');
  root.appendChild(stats([
    stat(L('debar.active', 'Active debarments'), list.filter((d) => d.status === 'Active').length, { tone: 'danger' }),
    stat(L('debar.pending', 'In approval'), list.filter((d) => /Pending|Draft|Returned/.test(d.status)).length, { tone: 'warn' }),
    stat(L('debar.expired', 'Expired'), list.filter((d) => d.status === 'Expired').length),
    stat(L('debar.revoked', 'Revoked'), list.filter((d) => d.status === 'Revoked').length),
  ]));
  const wrap = h('div');
  root.appendChild(wrap);
  const draw = () => {
    let body;
    if (tab === 'check') body = checker();
    else {
      const rows = tab === 'queue' ? myQueue() : (tab === 'pipeline' ? list.filter((d) => /Pending|Draft|Returned/.test(d.status)) : list.filter((d) => ['Active', 'Expired', 'Revoked'].indexOf(d.status) >= 0));
      body = table({ rows, columns: cols(), exportName: 'debar-' + tab, onRow: (d) => go('/debar/' + d.id), empty: tab === 'queue' ? L('debar.queueEmpty', 'Nothing is waiting for you.') : null,
        filters: tab === 'register' ? [{ key: 'status', label: L('col.status', 'Status'), options: ['Active', 'Expired', 'Revoked'] }, { key: 'stage', label: L('col.detectedAt', 'Detected at'), options: STAGES }] : [] });
    }
    mount(wrap, tabs(t, tab, (id) => { tab = id; draw(); }), body);
  };
  draw();
});

// ------------------------------------------------------------------ lookup & CEN screening
function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, ''); }

export function debarMatches(p) {
  return all('debar').filter((d) => d.status === 'Active').map((d) => {
    let score = 0;
    const why = [];
    if (p.name && norm(d.name) === norm(p.name)) { score += 2; why.push(L('debar.m.name', 'name')); }
    if (p.father && norm(d.father) === norm(p.father)) { score += 1; why.push(L('debar.m.father', 'father’s name')); }
    if (p.dob && d.dob === p.dob) { score += 2; why.push(L('debar.m.dob', 'date of birth')); }
    if (p.last4 && d.idLast4 === p.last4) { score += 2; why.push(L('debar.m.id', 'ID last 4 digits')); }
    return { d, score, why };
  }).filter((m) => m.score >= 4).sort((a, b) => b.score - a.score);
}

function checker() {
  const out = h('div');
  const f = form([
    field({ name: 'name', label: L('col.name', 'Name') }),
    field({ name: 'father', label: L('col.father', 'Father’s name') }),
    field({ name: 'dob', type: 'date', label: L('col.dob', 'Date of birth') }),
    field({ name: 'last4', label: L('debar.f.last4', 'ID number, last 4 digits'), pattern: /^[0-9]{4}$/, patternMsg: L('debar.f.last4Msg', 'Enter 4 digits') }),
  ], 4);
  const screenOut = h('div');
  const run = () => {
    const v = f.values();
    if (!v.name && !v.dob && !v.last4) { fail(L('debar.needOne', 'Enter at least a name, date of birth or ID digits.')); return; }
    const m = debarMatches(v);
    log(who(), role(), 'Debar list searched', 'Debar', '', [v.name, v.dob].filter(Boolean).join(' · '));
    save();
    mount(out, m.length ? h('div', note(L('debar.found', '{n} active debar record(s) match.', { n: m.length }), 'danger'), h('ul.rms-list', m.map((x) => h('li', link(x.d.id, '/debar/' + x.d.id), ' · ' + x.d.name + ' · ' + x.d.reason + ' · ' + L('debar.matchedOn', 'matched on {w}', { w: x.why.join(', ') }))))) : note(L('debar.clear', 'No active debar record matches these details.'), 'success'));
  };
  const screen = () => {
    const pool = all('candidates').filter((c) => c.cen === 'CEN 04/2026');
    const hits = [];
    pool.forEach((c) => { const m = debarMatches({ name: c.name, father: c.father, dob: c.dob, last4: c.aadhaar && c.aadhaar.last4 }); if (m.length) hits.push({ c, m: m[0] }); });
    log(who(), role(), 'CEN screened against debar list', 'Debar', 'CEN 04/2026', pool.length + ' candidates, ' + hits.length + ' match(es)');
    save();
    mount(screenOut, hits.length ? h('div', note(L('debar.screenHits', '{n} of {t} candidates match an active debar record.', { n: hits.length, t: pool.length }), 'danger'),
      table({ search: false, paged: false, rows: hits, columns: [
        { key: 'roll', label: L('col.roll', 'Roll no.'), render: (x) => candLink(x.c.id) },
        { key: 'rec', label: L('col.record', 'Record'), render: (x) => link(x.m.d.id, '/debar/' + x.m.d.id) },
        { key: 'why', label: L('debar.col.why', 'Matched on'), value: (x) => x.m.why.join(', ') },
        { key: 'stage', label: L('col.stage', 'Stage'), value: (x) => x.c.stage },
        { key: 'act', label: '', action: true, render: () => btn(L('debar.toAlerts', 'Open integrity alerts'), { small: true, kind: 'plain', href: '/fraud' }) },
      ] })) : note(L('debar.screenClear', 'All {t} candidates screened; no match.', { t: pool.length }), 'success'));
  };
  return h('div',
    card(L('debar.lookup', 'Check a person against active debarments'), h('div', f.node, h('div.rms-toolbar', btn(L('ui.search', 'Search'), { icon: 'search', onClick: run })), out)),
    card(L('debar.screen', 'Screen a CEN'), h('div', h('p', L('debar.screenText', 'Compares every candidate of CEN 04/2026 (JE, DMS & CMA) with the active debar list on name, father’s name, date of birth and Aadhaar last 4 digits. The same check runs automatically before DV and before panel approval.')), h('div.rms-toolbar', btn(L('debar.screenBtn', 'Screen CEN 04/2026'), { kind: 'plain', icon: 'shield', onClick: screen })), screenOut)));
}

// ------------------------------------------------------------------ new record
route('/debar/new', ['rrb'], (root) => {
  const q = query();
  const c = q.roll ? candidate(q.roll) : null;
  const src = q.report ? byId('examReports', q.report) : null;
  const alertRec = q.alert ? byId('alerts', q.alert) : null;
  root.appendChild(head({ title: L('debar.newTitle', 'New debar record'), crumbs: [{ label: L('debar.title', 'Debar register'), href: '/debar' }, { label: L('ind.new', 'New') }], sow: '2.4' }));
  if (c || src) root.appendChild(note(c ? L('debar.fromCand', 'Prefilled from candidate {r}{a}.', { r: c.id, a: alertRec ? ' (' + alertRec.id + ')' : '' }) : L('debar.fromReport', 'Prefilled from exam report {id}.', { id: src.id }), 'info'));
  const f = form([
    field({ name: 'name', label: L('col.name', 'Name'), required: true, value: c ? c.name : (src ? src.candidate : '') }),
    field({ name: 'father', label: L('col.father', 'Father’s name'), required: true, value: c ? c.father : '' }),
    field({ name: 'gender', type: 'select', label: L('col.gender', 'Gender'), required: true, value: c ? c.gender : '', options: ['Female', 'Male', 'Transgender'] }),
    field({ name: 'dob', type: 'date', label: L('col.dob', 'Date of birth'), required: true, value: c ? c.dob : '' }),
    field({ name: 'idType', type: 'select', label: L('debar.f.idType', 'Identity document'), required: true, value: c ? 'Aadhaar' : '', options: ['Aadhaar', 'PAN', 'Passport', 'Driving Licence', 'Voter ID'] }),
    field({ name: 'idLast4', label: L('debar.f.last4', 'ID number, last 4 digits'), required: true, value: c ? c.aadhaar.last4 : '', pattern: /^[0-9]{4}$/, patternMsg: L('debar.f.last4Msg', 'Enter 4 digits') }),
    field({ name: 'cen', type: 'select', label: L('col.cen', 'CEN'), required: true, value: c ? c.cen : (src ? src.cen : ''), options: all('cens').map((x) => x.id) }),
    field({ name: 'roll', label: L('col.roll', 'Roll no.'), value: c ? c.id : (src ? src.roll : '') }),
    field({ name: 'stage', type: 'select', label: L('col.detectedAt', 'Detected at'), required: true, value: src ? 'CBT' : (c && c.dv ? 'DV' : ''), options: STAGES }),
    field({ name: 'reason', type: 'select', label: L('col.reason', 'Reason'), required: true, value: src && /device|Bluetooth|phone/i.test(src.detail || '') ? REASONS[1] : (src && /impersonation|mismatch/i.test(src.detail || '') ? REASONS[0] : (alertRec && /Duplicate/.test(alertRec.type) ? REASONS[6] : (alertRec && /Face|Aadhaar/.test(alertRec.type) ? REASONS[0] : ''))), options: REASONS }),
    field({ name: 'period', type: 'select', label: L('col.period', 'Period'), required: true, options: PERIODS, value: '3 years' }),
    field({ name: 'order', label: L('debar.f.order', 'Vigilance / inquiry reference'), required: true }),
    field({ name: 'evidence', type: 'file', label: L('debar.f.evidence', 'Inquiry report and evidence (PDF)'), required: true, demoName: 'inquiry-report.pdf' }),
    field({ name: 'remarks', type: 'textarea', label: L('ui.remarks', 'Remarks'), wide: true, value: src ? src.detail : (alertRec ? alertRec.detail : '') }),
  ], 3);
  root.appendChild(card(L('debar.person', 'Person and grounds'), f.node));
  root.appendChild(note(L('debar.makerNote', 'You are the maker. The Member Secretary checks the record and the Chairperson gives final approval; the debarment is effective only after that.'), 'info'));
  const create = (submit) => {
    if (!f.validate()) return;
    const v = f.values();
    const now = new Date().toISOString();
    const yrs = v.period === 'Lifetime' ? null : parseInt(v.period, 10);
    const id = newId('debar', 'debar', (n) => 'DBR-' + pad(2600 + n, 5));
    const rec = Object.assign({ id, photo: c ? c.photo : Math.floor(Math.random() * 999999), rrb: 'SBC', from: iso(now), to: yrs ? iso(new Date(Date.now() + yrs * 365 * 864e5)) : null, status: submit ? 'Pending checker' : 'Draft', maker: who(), checker: null, approver: null, createdAt: now,
      history: [{ at: now, by: who(), role: role(), action: 'Record created (maker)', remarks: v.remarks || '' }].concat(submit ? [{ at: now, by: who(), role: role(), action: 'Submitted to checker', remarks: '' }] : []) }, v);
    rec.idLast4 = v.idLast4;
    insert('debar', rec);
    if (src) { src.status = 'Referred to debar'; src.debar = id; }
    if (alertRec) { alertRec.status = 'Referred to debar'; alertRec.history.push({ at: now, by: who(), role: role(), action: 'Referred to debar', remarks: id }); }
    log(who(), role(), submit ? 'Debar record submitted to checker' : 'Debar record saved as draft', 'Debar', id, v.name);
    save();
    ok(submit ? L('debar.sentChecker', 'Record {id} sent to the Member Secretary for checking.', { id }) : L('debar.savedDraft', 'Draft {id} saved.', { id }));
    go('/debar/' + id);
  };
  root.appendChild(h('div.rms-toolbar', btn(L('ind.saveDraft', 'Save draft'), { kind: 'plain', onClick: () => create(false) }), btn(L('debar.submitChecker', 'Submit to checker'), { icon: 'send', onClick: () => create(true) }), btn(L('ui.cancel', 'Cancel'), { kind: 'plain', href: '/debar' })));
});

// ------------------------------------------------------------------ detail
function steps(d) {
  const order = ['Draft', 'Pending checker', 'Pending final approval', 'Active'];
  const st = d.status === 'Returned to maker' ? 'Draft' : d.status;
  let idx = order.indexOf(st);
  if (idx < 0) idx = 4;
  return [
    { label: L('debar.s.maker', 'Maker (RRB)'), state: idx > 0 ? 'done' : (d.status === 'Returned to maker' ? 'blocked' : 'active'), note: d.maker },
    { label: L('debar.s.checker', 'Checker (Member Secretary)'), state: idx > 1 ? 'done' : (idx === 1 ? 'active' : 'todo'), note: d.checker || '' },
    { label: L('debar.s.final', 'Final approval (Chairperson)'), state: idx > 2 ? (d.status === 'Rejected' ? 'blocked' : 'done') : (idx === 2 ? 'active' : 'todo'), note: d.approver || '' },
    { label: d.status === 'Revoked' ? L('status.revoked', 'Revoked') : (d.status === 'Expired' ? L('status.expired', 'Expired') : L('debar.s.active', 'In force')), state: d.status === 'Active' ? 'active' : (d.status === 'Revoked' || d.status === 'Rejected' ? 'blocked' : (idx >= 4 ? 'done' : 'todo')) },
  ];
}

route('/debar/:id', null, (root, prm) => {
  const draw = () => {
    mount(root);
    const d = byId('debar', prm.id);
    if (!d) { root.appendChild(head({ title: L('debar.notFound', 'Record not found') })); return; }
    const act = (status, action, kind, needOtp, needRemarks, set) => btn(action, { kind, onClick: () => {
      remarks({ title: action + ' · ' + d.id, required: needRemarks, ok: action, kind: kind === 'plain' ? 'danger' : kind }).then((text) => {
        if (text === null) return;
        const fin = () => {
          const now = new Date().toISOString();
          d.status = status;
          if (set) set(now);
          d.history.push({ at: now, by: who(), role: role(), action, remarks: text || '' });
          log(who(), role(), action, 'Debar', d.id, d.name);
          save();
          ok(L('debar.done', '{id}: {s}', { id: d.id, s: status }));
          draw();
        };
        if (needOtp) otp({ title: L('ind.esign', 'Aadhaar e-Sign (demo)') }).then((y) => { if (y) fin(); }); else fin();
      });
    } });
    const actions = [];
    if (is('rrb') && (d.status === 'Draft' || d.status === 'Returned to maker')) actions.push(act('Pending checker', L('debar.submitChecker', 'Submit to checker'), 'theme', false, false));
    if (is('ms') && d.status === 'Pending checker') {
      if (d.maker === who()) actions.push(h('span.rms-small.rms-muted', L('debar.sameUser', 'The maker cannot check the same record.')));
      else {
        actions.push(act('Pending final approval', L('debar.check', 'Check & forward to Chairperson'), 'ok', false, false, () => { d.checker = who(); }));
        actions.push(act('Returned to maker', L('debar.return', 'Return to maker'), 'plain', false, true));
      }
    }
    if (is('chair') && d.status === 'Pending final approval') {
      actions.push(act('Active', L('debar.approve', 'Approve debarment'), 'ok', true, false, (now) => { d.approver = who(); d.from = iso(now); const yrs = d.period === 'Lifetime' ? null : parseInt(d.period, 10); d.to = yrs ? iso(new Date(Date.now() + yrs * 365 * 864e5)) : null; }));
      actions.push(act('Rejected', L('ui.reject', 'Reject'), 'plain', false, true));
    }
    if (is('chair') && d.status === 'Active') actions.push(act('Revoked', L('debar.revoke', 'Revoke'), 'plain', true, true));
    root.appendChild(head({ title: d.name, sub: d.id + ' · ' + d.reason, crumbs: [{ label: L('debar.title', 'Debar register'), href: '/debar' }, { label: d.id }], actions, sow: '2.4' }));
    root.appendChild(h('div.rms-toolbar', badge(d.status), d.status === 'Active' ? h('span.rms-small', icon('warn', 14), ' ' + L('debar.inForce', 'In force from {a} {b}', { a: date(d.from), b: d.to ? L('debar.to', 'to {d}', { d: date(d.to) }) : L('debar.lifetime', 'for life') })) : null));
    root.appendChild(stepper(steps(d)));
    root.appendChild(card(L('debar.person', 'Person and grounds'), split(kv([
      [L('col.name', 'Name'), d.name], [L('col.father', 'Father’s name'), d.father], [L('col.gender', 'Gender'), d.gender], [L('col.dob', 'Date of birth'), date(d.dob)],
      [L('debar.f.idType', 'Identity document'), d.idType + ' · XXXX ' + d.idLast4], [L('col.cen', 'CEN'), d.cen], [L('col.roll', 'Roll no.'), d.roll || '—'], [L('col.rrb', 'RRB'), rrbName(d.rrb)],
      [L('col.detectedAt', 'Detected at'), d.stage], [L('col.reason', 'Reason'), d.reason], [L('col.period', 'Period'), d.period], [L('debar.f.order', 'Vigilance / inquiry reference'), d.order],
    ], 3), portrait(d.photo, { variant: 'application', size: 110, caption: L('debar.photo', 'Photograph on record') }))));
    root.appendChild(card(L('ind.history', 'History'), history(d.history)));
  };
  draw();
});
