// SOW 2.8–2.9: DV scheduling and call letters, the DV desk (live photograph, face match against the
// application photograph, Aadhaar face authentication, document checklist, head and full-length
// images, outcome) and the digital DV dossier; escalations decided by the Member Secretary.
import { h, mount, icon } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, data, save, log, insert, candidate, notify } from '../core/store.js';
import { role, who, is, me } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, stats, stat, split, empty } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form, seg } from '../ui/form.js';
import { modal, ok, fail, otp, remarks } from '../ui/dialogs.js';
import { history } from '../ui/timeline.js';
import { portrait, signature } from '../ui/photo.js';
import { showDoc, sigBlock } from '../ui/doc.js';
import { candLink, catLabel, postName, newId } from './common.js';
import { debarMatches } from './debar.js';
import { date, dateTime, iso, mask } from '../core/format.js';
import { sha256Hex } from '../core/sha256.js';
import { L } from '../i18n.js';
import { callLetter } from '../letters.js';

const CEN = 'CEN 04/2026';
const CHECKS = [
  ['identity', 'Identity proof and photograph'],
  ['name', 'Name as in the application'],
  ['parents', 'Father’s and mother’s names'],
  ['dob', 'Date of birth (Class 10 certificate)'],
  ['class10', 'Class 10 marksheet and certificate'],
  ['eq', 'Essential qualification'],
  ['category', 'Community certificate'],
  ['pwbd', 'Disability certificate (UDID)'],
  ['exsm', 'Ex-servicemen discharge papers'],
  ['noc', 'No-objection certificate (government employees)'],
];
function checkLabel(k) { const x = CHECKS.filter((c) => c[0] === k)[0]; return x ? L('dv.check.' + k, x[1]) : k; }
const OPTS = () => [
  { value: 'Verified', label: L('dv.v.ok', 'Verified') },
  { value: 'Discrepancy', label: L('dv.v.bad', 'Discrepancy'), cls: 'is-bad' },
  { value: 'NA', label: L('aud.v.na', 'NA'), cls: 'is-na' },
];

function threshold() { return data().meritRules.faceThreshold || 0.75; }
function today() { return iso(new Date()); }
function userName(id) { const u = byId('users', id); return u ? u.name : id; }
function slotText(s) { return date(s.date) + ' · ' + (s.session === 'FN' ? L('dv.fn', 'Forenoon') : L('dv.an', 'Afternoon')) + ' · ' + L('dv.reporting', 'reporting {t}', { t: s.reporting }); }
function claim(c, k) {
  switch (k) {
    case 'identity': return 'Aadhaar ' + mask('XXXXXXXX' + c.aadhaar.last4, 4);
    case 'name': return c.name;
    case 'parents': return c.father + ' / ' + c.mother;
    case 'dob': return date(c.dob);
    case 'class10': return L('dv.claim.class10', 'Matriculation');
    case 'eq': return c.qual;
    case 'category': return c.cat === 'UR' ? '' : c.cat + (c.cat === 'OBC' ? ' (non-creamy layer)' : (c.cat === 'EWS' ? ' (income & asset)' : ''));
    case 'pwbd': return c.pwbd ? c.pwbd.type + (c.pwbd.sub ? ' (' + c.pwbd.sub + ')' : '') : '';
    case 'exsm': return c.exsm ? L('dv.claim.exsm', 'Ex-serviceman') : '';
    default: return '';
  }
}
function defaultCheck(c, k) { return (k === 'category' && c.cat === 'UR') || (k === 'pwbd' && !c.pwbd) || (k === 'exsm' && !c.exsm) || k === 'noc' ? 'NA' : ''; }
// Deterministic demo results: most candidates match well, a few fall below the threshold.
function faceFor(c) { const n = Number(c.photo) || 1; return n % 17 === 4 ? Math.round((0.58 + (n % 120) / 1000) * 1000) / 1000 : Math.round((0.80 + (n % 180) / 1000) * 1000) / 1000; }
// A failed face match shows a visibly different live photograph.
export function liveSeed(c, face) { return face != null && face < threshold() ? Number(c.photo) + 7 : c.photo; }
function aadhaarFor(c) { return (Number(c.photo) || 1) % 23 === 5 ? 'Not matched' : 'Matched'; }

function meter(score) {
  const thr = threshold();
  return h('div.rms-meter', { role: 'img', 'aria-label': L('dv.scoreAria', 'Similarity {s}, threshold {t}', { s: score.toFixed(3), t: thr.toFixed(3) }) },
    h('div.rms-meter__track', h('div.rms-meter__bar' + (score < thr ? '.is-low' : ''), { style: { width: Math.round(score * 100) + '%' } }), h('div.rms-meter__mark', { style: { left: Math.round(thr * 100) + '%' } })),
    h('p.rms-meter__text', h('strong', score.toFixed(3)), ' ', L('dv.vsThreshold', 'similarity · threshold {t}', { t: thr.toFixed(3) }), ' ', score < thr ? badge('Failed', L('dv.below', 'Below threshold')) : badge('Matched', L('dv.above', 'Match'))));
}

// ------------------------------------------------------------------ documents

function dossier(c) {
  const d = c.dv;
  const body = h('div',
    h('div.rms-doc__photos', portrait(c.photo, { size: 76, caption: L('dv.photoApp', 'Application photograph') }), portrait(liveSeed(c, d.face), { size: 76, variant: 'live', caption: L('dv.photoLive', 'Live at DV') }), d.aadhaar === 'Matched' ? portrait(c.photo, { size: 76, variant: 'aadhaar', caption: L('dv.photoAadhaar', 'Aadhaar') }) : null),
    h('table', h('tbody',
      h('tr', h('th', L('col.roll', 'Roll no.')), h('td', c.id)), h('tr', h('th', L('col.name', 'Name')), h('td', c.name)), h('tr', h('th', L('col.category', 'Category')), h('td', catLabel(c))),
      h('tr', h('th', L('dv.when', 'DV held')), h('td', dateTime(d.at))), h('tr', h('th', L('dv.verifier', 'Verifier')), h('td', d.verifierName || '—')),
      h('tr', h('th', L('dv.face', 'Face match')), h('td', d.face != null ? d.face.toFixed(3) + ' (' + L('dv.thr', 'threshold {t}', { t: threshold().toFixed(3) }) + ')' : '—')),
      h('tr', h('th', L('dv.aadhaar', 'Aadhaar face authentication')), h('td', d.aadhaar || '—')),
      h('tr', h('th', L('dv.images', 'Images captured')), h('td', [d.images && d.images.head ? L('dv.head', 'Head') : null, d.images && d.images.full ? L('dv.full', 'Full length') : null].filter(Boolean).join(', ') || '—')))),
    h('h3', L('dv.docs', 'Documents')),
    h('table', h('thead', h('tr', h('th', L('dv.document', 'Document')), h('th', L('dv.claimed', 'Claimed')), h('th', L('dv.result', 'Result')))), h('tbody', CHECKS.map((k) => h('tr', h('td', checkLabel(k[0])), h('td', claim(c, k[0]) || '—'), h('td', d.checks[k[0]] || '—'))))),
    h('p', h('strong', L('dv.outcome', 'Outcome') + ': '), d.outcome, d.remarks ? ' — ' + d.remarks : ''),
    d.msDecision ? h('p', h('strong', L('dv.msDecision', 'Member Secretary’s decision') + ': '), d.msDecision.decision + ' (' + d.msDecision.by + ', ' + dateTime(d.msDecision.at) + ') — ' + d.msDecision.remarks) : null,
    h('p.rms-small', L('dv.hash', 'Dossier fingerprint (SHA-256): {h}', { h: sha256Hex(new TextEncoder().encode(JSON.stringify([c.id, d]))).slice(0, 40) + '…' })),
    sigBlock(d.verifierName || '—', L('dv.sigVerifier', 'Verifying official')));
  showDoc({ dialogTitle: L('dv.dossier', 'Digital DV dossier {id}', { id: d.dossier || '' }), title: L('dv.dossierTitle', 'Digital document-verification dossier'), office: 'Railway Recruitment Board, Bengaluru', ref: d.dossier, date: date(d.at), body });
}

// ------------------------------------------------------------------ scheduling
route('/dv-schedule', null, (root) => {
  const draw = () => {
    mount(root);
    const slots = all('dvSlots').filter((s) => s.cen === CEN).sort((a, b) => (a.date + a.session < b.date + b.session ? -1 : 1));
    const cands = all('candidates').filter((c) => c.cen === CEN);
    const waiting = cands.filter((c) => c.stage === 'Shortlisted' && !c.dv);
    const noLetter = cands.filter((c) => c.dv && c.dv.status === 'Scheduled' && !c.dv.callLetter);
    const absent = cands.filter((c) => c.dv && c.dv.status === 'Absent');
    root.appendChild(head({
      title: L('dvs.title', 'DV scheduling'),
      sub: L('dvs.sub', 'CEN 04/2026 at RRB Bengaluru: DV sessions, verifiers, candidates per session and e-call letters. Candidates with horizontal claims are called in the first sessions.'),
      sow: '2.8',
      actions: [btn(L('dvs.addSlot', 'Add DV session'), { icon: 'plus', kind: 'plain', onClick: () => addSlot(draw) }),
        btn(L('dvs.schedule', 'Schedule shortlisted ({n})', { n: waiting.length }), { icon: 'clock', disabled: !waiting.length, onClick: () => scheduleWaiting(waiting, draw) }),
        btn(L('dvs.letters', 'Issue e-call letters ({n})', { n: noLetter.length }), { icon: 'send', disabled: !noLetter.length, onClick: () => issueLetters(noLetter, draw) })],
    }));
    root.appendChild(stats([
      stat(L('dvs.called', 'Called for DV'), cands.filter((c) => c.dv || c.stage === 'Shortlisted').length),
      stat(L('dvs.done', 'DV completed'), cands.filter((c) => c.dv && c.dv.status === 'Completed').length, { tone: 'ok' }),
      stat(L('dvs.upcoming', 'Scheduled (today and later)'), cands.filter((c) => c.dv && c.dv.status === 'Scheduled').length, { tone: 'navy' }),
      stat(L('dvs.absent', 'Absent'), absent.length, { tone: 'danger' }),
      stat(L('dvs.waiting', 'Shortlisted, not scheduled'), waiting.length, { tone: waiting.length ? 'warn' : null }),
    ]));
    root.appendChild(card(L('dvs.sessions', 'DV sessions'), table({
      rows: slots,
      paged: false,
      search: false,
      columns: [
        { key: 'date', label: L('col.date', 'Date'), nowrap: true, value: (s) => date(s.date), sortValue: (s) => s.date + s.session },
        { key: 'session', label: L('dvs.session', 'Session'), value: (s) => (s.session === 'FN' ? L('dv.fn', 'Forenoon') : L('dv.an', 'Afternoon')) + ' · ' + s.reporting },
        { key: 'venue', label: L('dvs.venue', 'Venue') },
        { key: 'verifiers', label: L('dvs.verifiers', 'Verifiers'), value: (s) => s.verifiers.map(userName).join(', ') },
        { key: 'n', label: L('dvs.candidates', 'Candidates'), align: 'right', value: (s) => s.candidates.length + ' / ' + (s.capacity || 6) },
        { key: 'state', label: L('col.status', 'Status'), render: (s) => (s.date < today() ? badge('Completed', L('dvs.held', 'Held')) : (s.date === today() ? badge('In progress', L('dvs.today', 'Today')) : badge('Scheduled', L('dvs.upcomingS', 'Upcoming')))) },
      ],
      onRow: (s) => slotDialog(s),
      rowClass: (s) => (s.date === today() ? 'is-flagged' : null),
    })));
    if (absent.length) root.appendChild(card(L('dvs.absentees', 'Absentees'), table({ rows: absent, search: false, columns: [
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => candLink(c.id, '/dv/') },
      { key: 'cat', label: L('col.category', 'Category'), value: catLabel },
      { key: 'date', label: L('dvs.missed', 'Missed session'), nowrap: true, value: (c) => date(c.dv.date) + ' ' + c.dv.session },
      { key: 'act', label: '', action: true, render: (c) => (c.dv.secondChance ? h('span.rms-small.rms-muted', L('dvs.second', 'Already given a second date')) : btn(L('dvs.again', 'Give another date'), { small: true, kind: 'plain', onClick: () => { c.stage = 'Shortlisted'; c.dv = null; c.secondChance = true; save(); scheduleWaiting([c], draw, true); } })) },
    ] })));
  };
  draw();
});

function slotDialog(s) {
  modal({ title: slotText(s), wide: true, body: h('div', h('p', s.venue + ' · ' + s.verifiers.map(userName).join(', ')), table({ search: false, paged: false, rows: s.candidates.map(candidate).filter(Boolean), columns: [
    { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => candLink(c.id, '/dv/') },
    { key: 'cat', label: L('col.category', 'Category'), value: catLabel },
    { key: 'marks', label: L('col.marks', 'Normalised marks'), align: 'right', value: (c) => c.marks.toFixed(2) },
    { key: 'st', label: L('col.status', 'Status'), render: (c) => badge(c.dv ? (c.dv.outcome || c.dv.status) : c.stage) },
  ] })), actions: [{ label: L('ui.close', 'Close'), kind: 'plain', value: false }] });
}

function addSlot(redraw) {
  const vers = all('users').filter((u) => u.role === 'verifier' && u.active);
  const f = form([
    field({ name: 'date', type: 'date', label: L('col.date', 'Date'), required: true, value: iso(new Date(Date.now() + 2 * 864e5)) }),
    field({ name: 'session', type: 'select', label: L('dvs.session', 'Session'), required: true, value: 'FN', options: [{ value: 'FN', label: L('dv.fn', 'Forenoon') + ' (08:30)' }, { value: 'AN', label: L('dv.an', 'Afternoon') + ' (13:00)' }] }),
    field({ name: 'venue', label: L('dvs.venue', 'Venue'), required: true, value: 'RRB Bengaluru, DV Hall 1' }),
    field({ name: 'capacity', type: 'number', label: L('dvs.capacity', 'Candidates per session'), required: true, value: 6, min: 1, max: 40 }),
  ].concat(vers.map((u) => field({ name: 'v_' + u.id, type: 'checkbox', label: u.name, value: u.id === 'U-DV1' }))), 2);
  modal({ title: L('dvs.addSlot', 'Add DV session'), body: f.node, actions: [
    { label: L('ui.save', 'Save'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      const chosen = vers.filter((u) => v['v_' + u.id]).map((u) => u.id);
      if (!chosen.length) { fail(L('dvs.needVerifier', 'Pick at least one verifier.')); return false; }
      const id = CEN.replace(/\D/g, '') + '-' + v.date + '-' + v.session;
      if (byId('dvSlots', id)) { fail(L('dvs.exists', 'That session already exists.')); return false; }
      insert('dvSlots', { id, cen: CEN, rrb: 'SBC', date: v.date, session: v.session, venue: v.venue, reporting: v.session === 'FN' ? '08:30' : '13:00', verifiers: chosen, candidates: [], capacity: Number(v.capacity) }, true);
      log(who(), role(), 'DV session added', 'DV schedule', id, chosen.map(userName).join(', '));
      save();
      ok(L('dvs.added', 'Session added.'));
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

function scheduleWaiting(list, redraw, quiet) {
  const slots = all('dvSlots').filter((s) => s.cen === CEN && s.date >= today()).sort((a, b) => (a.date + a.session < b.date + b.session ? -1 : 1));
  const order = list.slice().sort((a, b) => b.marks - a.marks);
  let placed = 0;
  order.forEach((c) => {
    const s = slots.filter((x) => x.candidates.length < (x.capacity || 6))[0];
    if (!s) return;
    s.candidates.push(c.id);
    c.dv = { slot: s.id, date: s.date, session: s.session, status: 'Scheduled', outcome: null, callLetter: null, checks: {}, remarks: '', face: null, aadhaar: null, verifier: null, at: null };
    c.stage = 'DV scheduled';
    placed++;
  });
  if (!placed) { fail(L('dvs.noRoom', 'No free place in upcoming sessions. Add a DV session first.')); if (quiet) save(); redraw(); return; }
  log(who(), role(), 'Candidates scheduled for DV', 'DV schedule', CEN, placed + ' candidate(s)');
  save();
  ok(L('dvs.placed', '{n} candidate(s) scheduled{r}. Issue their e-call letters next.', { n: placed, r: placed < order.length ? ' (' + (order.length - placed) + ' ' + L('dvs.noPlace', 'without a place') + ')' : '' }));
  redraw();
}

function issueLetters(list, redraw) {
  otp({ title: L('dvs.signLetters', 'Sign {n} e-call letter(s)', { n: list.length }) }).then((y) => {
    if (!y) return;
    const now = new Date().toISOString();
    list.forEach((c) => {
      c.dv.callLetter = now;
      notify(c.id, 'SMS', 'DV call letter', 'DV on ' + date(c.dv.date) + ' (' + c.dv.session + ')');
      notify(c.id, 'Email', 'DV call letter', 'E-call letter for document verification, ' + c.cen);
    });
    log(who(), role(), 'E-call letters issued', 'DV schedule', CEN, list.length + ' letter(s)');
    save();
    ok(L('dvs.lettersDone', '{n} e-call letter(s) issued; candidates informed by SMS and e-mail.', { n: list.length }));
    redraw();
  });
}

// ------------------------------------------------------------------ DV desk
route('/dv', null, (root) => {
  const q = query();
  const mine = is('verifier') ? me().user.id : null;
  const cands = all('candidates').filter((c) => c.dv);
  const mySlots = all('dvSlots').filter((s) => !mine || s.verifiers.indexOf(mine) >= 0).map((s) => s.id);
  const todays = cands.filter((c) => c.dv.date === today() && mySlots.indexOf(c.dv.slot) >= 0);
  const esc = cands.filter((c) => c.dv.outcome === 'Escalated to MS');
  let tab = q.tab || (is('ms') && esc.length ? 'escalated' : 'today');
  root.appendChild(head({
    title: L('dv.title', 'Document verification'),
    sub: is('verifier') ? L('dv.subV', 'Your DV desk: today’s candidates in your sessions. Open a candidate to capture the live photograph, run the identity checks and record the outcome.') : L('dv.sub', 'DV desk status for CEN 04/2026, escalations waiting for the Member Secretary and completed dossiers.'),
    sow: '2.8–2.9',
  }));
  root.appendChild(stats([
    stat(L('dv.todayN', 'Today'), todays.length, { note: todays.filter((c) => c.dv.status === 'Completed').length + ' ' + L('dv.doneShort', 'done') }),
    stat(L('dv.escN', 'Escalated to MS'), esc.length, { tone: esc.length ? 'warn' : null }),
    stat(L('dv.recN', 'Recommended'), cands.filter((c) => c.cen === CEN && c.dv.outcome === 'Recommended').length, { tone: 'ok' }),
    stat(L('dv.notRecN', 'Not recommended'), cands.filter((c) => c.cen === CEN && c.dv.outcome === 'Not recommended').length, { tone: 'danger' }),
  ]));
  const t = [{ id: 'today', label: L('dv.tab.today', 'Today'), count: todays.length }, { id: 'escalated', label: L('dv.tab.esc', 'Escalated to MS'), count: esc.length }, { id: 'upcoming', label: L('dv.tab.upcoming', 'Upcoming') }, { id: 'done', label: L('dv.tab.done', 'Completed') }];
  const wrap = h('div');
  root.appendChild(wrap);
  const draw = () => {
    let body;
    if (tab === 'today') {
      const slots = all('dvSlots').filter((s) => s.date === today() && mySlots.indexOf(s.id) >= 0);
      body = slots.length ? h('div', slots.map((s) => card(slotText(s), queueTable(s.candidates.map(candidate).filter(Boolean)), { cls: 'rms-card--flush' }))) : empty(L('dv.noToday', 'No DV session today.'), { icon: 'clock' });
    } else if (tab === 'escalated') body = queueTable(esc, true);
    else if (tab === 'upcoming') body = queueTable(cands.filter((c) => c.dv.status === 'Scheduled' && c.dv.date > today() && mySlots.indexOf(c.dv.slot) >= 0));
    else body = queueTable(cands.filter((c) => c.dv.status !== 'Scheduled' && (!mine || c.dv.verifier === mine)), true);
    mount(wrap, tabs(t, tab, (id) => { tab = id; draw(); }), body);
  };
  draw();
});

function queueTable(rows, withOutcome) {
  return table({
    rows,
    pageSize: 10,
    columns: [
      { key: 'id', label: L('col.roll', 'Roll no.'), render: (c) => link(c.id, '/dv/' + c.id) },
      { key: 'name', label: L('col.name', 'Name') },
      { key: 'cat', label: L('col.category', 'Category'), value: catLabel },
      { key: 'slot', label: L('dvs.session', 'Session'), nowrap: true, value: (c) => date(c.dv.date) + ' ' + c.dv.session, sortValue: (c) => c.dv.date + c.dv.session },
      withOutcome ? { key: 'face', label: L('dv.face', 'Face match'), align: 'right', value: (c) => (c.dv.face != null ? c.dv.face.toFixed(3) : '—') } : null,
      { key: 'st', label: L('col.status', 'Status'), render: (c) => badge(c.dv.outcome || c.dv.status), value: (c) => c.dv.outcome || c.dv.status },
      withOutcome ? { key: 'remarks', label: L('ui.remarks', 'Remarks'), value: (c) => c.dv.remarks || '' } : null,
      { key: 'act', label: '', action: true, render: (c) => (c.dv.status === 'Scheduled' && is('verifier') ? btn(L('dv.start', 'Start DV'), { small: true, href: '/dv/' + c.id }) : btn(L('ui.open', 'Open'), { small: true, kind: 'plain', href: '/dv/' + c.id })) },
    ].filter(Boolean),
    onRow: (c) => go('/dv/' + c.id),
  });
}

// ------------------------------------------------------------------ DV workspace
route('/dv/:roll', null, (root, prm) => {
  const c = candidate(prm.roll);
  if (!c || !c.dv) { root.appendChild(head({ title: L('dv.notFound', 'Candidate not in a DV schedule') })); return; }
  const st = { face: null, aadhaar: null, consent: false, live: false, head: false, full: false, checks: {}, outcome: '', remarks: '' };
  CHECKS.forEach((k) => { st.checks[k[0]] = defaultCheck(c, k[0]); });
  const draw = () => {
    mount(root);
    const d = c.dv;
    const actions = [];
    if (d.status === 'Scheduled') actions.push(btn(L('dv.callLetter', 'E-call letter'), { kind: 'plain', icon: 'doc', onClick: () => callLetter(c) }));
    if (d.status === 'Completed') actions.push(btn(L('dv.viewDossier', 'Digital DV dossier'), { kind: 'plain', icon: 'doc', onClick: () => dossier(c) }));
    actions.push(btn(L('dv.trail', 'Identity trail'), { kind: 'plain', icon: 'link', href: '/trail/' + c.id }));
    root.appendChild(head({ title: c.name, sub: c.id + ' · ' + catLabel(c) + ' · ' + slotText(byId('dvSlots', d.slot) || { date: d.date, session: d.session, reporting: '' }), crumbs: [{ label: L('dv.title', 'Document verification'), href: '/dv' }, { label: c.id }], actions, sow: '2.8–2.9' }));
    const debar = debarMatches({ name: c.name, father: c.father, dob: c.dob, last4: c.aadhaar.last4 });
    const alerts = all('alerts').filter((a) => a.roll === c.id && a.status !== 'Cleared');
    root.appendChild(h('div.rms-toolbar', badge(d.outcome || d.status), d.callLetter ? h('span.rms-small.rms-muted', L('dv.letterOn', 'E-call letter issued {d}', { d: dateTime(d.callLetter) })) : badge('Pending', L('dv.noLetter', 'E-call letter not issued'))));
    if (debar.length) root.appendChild(note(h('div', h('strong', L('dv.debarHit', 'Matches active debar record ')), link(debar[0].d.id, '/debar/' + debar[0].d.id), ' — ' + debar[0].d.reason + '. ' + L('dv.debarDo', 'Do not recommend; escalate to the Member Secretary.')), 'danger'));
    alerts.forEach((a) => root.appendChild(note(h('div', h('strong', a.type + ': '), a.detail, ' ', link(a.id, '/fraud/' + a.id)), 'warning')));
    if (d.status === 'Scheduled') workspace(root, c, st, draw);
    else completed(root, c, draw);
  };
  draw();
});

function workspace(root, c, st, redraw) {
  const canWork = is('verifier', 'rrb');
  const early = c.dv.date > today();
  if (!canWork) { root.appendChild(note(L('dv.onlyVerifier', 'The DV desk is operated by the verifying officials. You can see the schedule and, after DV, the dossier.'), 'info')); return; }
  if (early) root.appendChild(note(L('dv.early', 'This candidate is scheduled for {d}. The demo lets you verify ahead of the date.', { d: date(c.dv.date) }), 'info'));
  const thr = threshold();
  const photos = h('div.rms-photos',
    portrait(c.photo, { size: 120, caption: L('dv.photoApp', 'Application photograph') }),
    st.live ? portrait(liveSeed(c, st.face), { size: 120, variant: 'live', caption: L('dv.photoLive', 'Live at DV') }) : h('div.rms-photo-empty', icon('camera', 28), h('span', L('dv.noLive', 'Live photograph not captured'))),
    st.aadhaar === 'Matched' ? portrait(c.photo, { size: 120, variant: 'aadhaar', caption: L('dv.photoAadhaar', 'Aadhaar') }) : h('div.rms-photo-empty', icon('shield', 28), h('span', st.aadhaar === 'Not matched' ? L('dv.aadNo', 'Aadhaar: no match') : L('dv.noAadhaar', 'Aadhaar authentication not done'))));
  const idBox = h('div',
    photos,
    st.face != null ? meter(st.face) : null,
    h('div.rms-toolbar',
      btn(st.live ? L('dv.retake', 'Retake live photograph') : L('dv.capture', 'Capture live photograph'), { icon: 'camera', onClick: () => capture(c, st, redraw) }),
      h('label.rms-check', h('input', { type: 'checkbox', checked: st.consent, onchange: (e) => { st.consent = e.target.checked; } }), h('span', L('dv.consent', 'Candidate consents to Aadhaar face authentication'))),
      btn(L('dv.aadhaarBtn', 'Aadhaar face authentication'), { kind: 'plain', icon: 'shield', onClick: () => {
        if (!st.consent) { fail(L('dv.needConsent', 'Record the candidate’s consent first.')); return; }
        st.aadhaar = aadhaarFor(c);
        log(who(), role(), 'Aadhaar face authentication', 'DV', c.id, st.aadhaar);
        save();
        redraw();
      } })));
  root.appendChild(card(L('dv.identity', '1. Identity'), idBox));
  root.appendChild(card(L('dv.documents', '2. Documents'), h('ol.rms-checklist', CHECKS.map((k) => h('li', h('span.rms-checklist__label', checkLabel(k[0]), claim(c, k[0]) ? h('small', L('dv.claimedX', 'Claimed: {x}', { x: claim(c, k[0]) })) : h('small', L('dv.notClaimed', 'Not claimed'))), seg(checkLabel(k[0]), OPTS(), st.checks[k[0]], (v) => { st.checks[k[0]] = v; refresh(); }))))));
  root.appendChild(card(L('dv.imagesT', '3. Images for the dossier'), h('div.rms-toolbar',
    h('label.rms-check', h('input', { type: 'checkbox', checked: st.head, onchange: (e) => { st.head = e.target.checked; } }), h('span', L('dv.headImg', 'Head photograph captured'))),
    h('label.rms-check', h('input', { type: 'checkbox', checked: st.full, onchange: (e) => { st.full = e.target.checked; } }), h('span', L('dv.fullImg', 'Full-length photograph captured'))),
    signature(c.photo, { caption: L('dv.sig', 'Signature on record') }))));
  const outBox = h('div');
  const fRem = field({ name: 'remarks', type: 'textarea', label: L('ui.remarks', 'Remarks'), value: st.remarks, rows: 3, onChange: (v) => { st.remarks = v; } });
  root.appendChild(card(L('dv.outcomeT', '4. Outcome'), h('div', outBox, fRem.node)));
  root.appendChild(h('div.rms-toolbar', btn(L('dv.complete', 'Complete DV & sign'), { icon: 'check', kind: 'ok', onClick: complete }), btn(L('dv.absent', 'Mark absent'), { kind: 'plain', onClick: absent })));
  function blockers() {
    const b = [];
    if (CHECKS.some((k) => st.checks[k[0]] === 'Discrepancy')) b.push(L('dv.bl.disc', 'a document has a discrepancy'));
    if (st.face != null && st.face < thr) b.push(L('dv.bl.face', 'face match is below the threshold'));
    if (st.aadhaar === 'Not matched') b.push(L('dv.bl.aad', 'Aadhaar face authentication did not match'));
    if (debarMatches({ name: c.name, father: c.father, dob: c.dob, last4: c.aadhaar.last4 }).length) b.push(L('dv.bl.debar', 'the candidate matches the debar list'));
    return b;
  }
  function refresh() {
    const b = blockers();
    if (b.length && st.outcome === 'Recommended') st.outcome = '';
    const opts = [{ value: 'Recommended', label: L('dv.o.rec', 'Recommend') }, { value: 'Escalated to MS', label: L('dv.o.esc', 'Escalate to MS') }, { value: 'Not recommended', label: L('dv.o.not', 'Not recommend'), cls: 'is-bad' }];
    mount(outBox, b.length ? note(L('dv.cannotRec', 'Cannot recommend because {w}. Escalate to the Member Secretary or do not recommend.', { w: b.join('; ') }), 'warning') : null,
      seg(L('dv.outcome', 'Outcome'), b.length ? opts.slice(1) : opts, st.outcome, (v) => { st.outcome = v; }));
  }
  refresh();
  function complete() {
    const missing = CHECKS.filter((k) => !st.checks[k[0]]);
    if (!st.live) { fail(L('dv.needLive', 'Capture the live photograph first.')); return; }
    if (missing.length) { fail(L('dv.needChecks', 'Mark every document ({n} left).', { n: missing.length })); return; }
    if (!st.outcome) { fail(L('dv.needOutcome', 'Choose the outcome.')); return; }
    if (st.outcome !== 'Recommended' && !st.remarks.trim()) { fRem.validate(); fail(L('dv.needRemarks', 'Write the reason in Remarks.')); return; }
    if (!st.head || !st.full) { fail(L('dv.needImages', 'Capture the head and full-length photographs for the dossier.')); return; }
    otp({ title: L('dv.signDv', 'Sign the DV record') }).then((y) => {
      if (!y) return;
      const now = new Date().toISOString();
      Object.assign(c.dv, { status: 'Completed', outcome: st.outcome, checks: Object.assign({}, st.checks), remarks: st.remarks, face: st.face, aadhaar: st.aadhaar || 'Not attempted', verifier: me().user.id, verifierName: who(), at: now, images: { head: st.head, full: st.full }, dossier: 'DVD-' + c.id.slice(-6) });
      c.stage = st.outcome === 'Recommended' ? 'DV completed' : (st.outcome === 'Escalated to MS' ? 'DV escalated' : 'DV not recommended');
      const raise = (type, score, detail) => insert('alerts', { id: newId('alerts', 'alert', (n) => 'ALT-' + (300 + n)), roll: c.id, cen: c.cen, type, score, detail, status: 'Open', at: now, history: [{ at: now, by: 'Integrity engine', role: 'system', action: 'Alert raised', remarks: detail }] });
      if (st.face < thr) raise('Face match below threshold', st.face, 'DV live photograph vs application photograph: similarity ' + st.face.toFixed(3) + ' (threshold ' + thr.toFixed(3) + ').');
      if (st.aadhaar === 'Not matched') raise('Aadhaar authentication failed', null, 'Aadhaar face authentication at DV returned "no match".');
      notify(c.id, 'SMS', 'DV completed', 'Document verification completed, ' + c.cen);
      log(who(), role(), 'DV ' + st.outcome.toLowerCase(), 'Candidate', c.id, c.name + (st.face != null ? ' · face ' + st.face.toFixed(3) : ''));
      save();
      ok(L('dv.saved', 'DV recorded: {o}. Dossier {d} created.', { o: st.outcome, d: c.dv.dossier }));
      redraw();
    });
  }
  function absent() {
    remarks({ title: L('dv.absentTitle', 'Mark {r} absent', { r: c.id }), label: L('ui.remarks', 'Remarks'), ok: L('dv.absent', 'Mark absent'), kind: 'danger' }).then((t) => {
      if (t === null) return;
      c.dv.status = 'Absent';
      c.dv.remarks = t;
      c.stage = 'DV absent';
      log(who(), role(), 'DV absent', 'Candidate', c.id, t);
      save();
      redraw();
    });
  }
}

function capture(c, st, redraw) {
  const view = h('div.rms-camera', portrait(liveSeed(c, faceFor(c)), { size: 150, variant: 'live' }), h('span.rms-camera__hint', L('dv.cameraHint', 'Demo camera: a drawn placeholder stands in for the live photograph.')));
  modal({ title: L('dv.capture', 'Capture live photograph'), body: view, actions: [
    { label: L('dv.shoot', 'Capture & match'), onClick: () => {
      st.live = true;
      st.face = faceFor(c);
      log(who(), role(), 'Live photograph captured', 'DV', c.id, 'similarity ' + st.face.toFixed(3));
      save();
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

function completed(root, c, redraw) {
  const d = c.dv;
  if (d.status === 'Absent') { root.appendChild(card(L('dv.absentT', 'Absent'), h('p', L('dv.absentText', 'The candidate did not attend on {d}.', { d: date(d.date) }) + (d.remarks ? ' ' + d.remarks : '')))); return; }
  root.appendChild(card(L('dv.identity', '1. Identity'), split(h('div',
    h('div.rms-photos', portrait(c.photo, { size: 110, caption: L('dv.photoApp', 'Application photograph') }), portrait(liveSeed(c, d.face), { size: 110, variant: 'live', caption: L('dv.photoLive', 'Live at DV') }), d.aadhaar === 'Matched' ? portrait(c.photo, { size: 110, variant: 'aadhaar', caption: L('dv.photoAadhaar', 'Aadhaar') }) : null),
    d.face != null ? meter(d.face) : null),
  kv([[L('dv.verifier', 'Verifier'), d.verifierName], [L('dv.when', 'DV held'), dateTime(d.at)], [L('dv.aadhaar', 'Aadhaar face authentication'), d.aadhaar || '—'], [L('dv.dossierNo', 'Dossier'), d.dossier || '—']]))));
  root.appendChild(card(L('dv.documents', '2. Documents'), h('table.rms-mini', h('thead', h('tr', h('th', L('dv.document', 'Document')), h('th', L('dv.claimed', 'Claimed')), h('th', L('dv.result', 'Result')))),
    h('tbody', CHECKS.map((k) => h('tr', h('td', checkLabel(k[0])), h('td', claim(c, k[0]) || '—'), h('td', d.checks[k[0]] ? badge(d.checks[k[0]] === 'Discrepancy' ? 'Failed' : d.checks[k[0]], d.checks[k[0]]) : '—')))))));
  const box = h('div', h('p', h('strong', L('dv.outcome', 'Outcome') + ': '), badge(d.outcome), d.remarks ? ' ' + d.remarks : ''));
  if (d.msDecision) box.appendChild(note(h('div', h('strong', L('dv.msDecision', 'Member Secretary’s decision') + ': '), d.msDecision.decision + ' · ' + d.msDecision.by + ' · ' + dateTime(d.msDecision.at), h('br'), d.msDecision.remarks), d.msDecision.decision === 'Recommended' ? 'success' : 'danger'));
  if (d.outcome === 'Escalated to MS' && is('ms')) {
    box.appendChild(h('div.rms-toolbar',
      btn(L('dv.msRec', 'Recommend'), { kind: 'ok', icon: 'check', onClick: () => decide('Recommended') }),
      btn(L('dv.msNot', 'Do not recommend'), { kind: 'plain', onClick: () => decide('Not recommended') })));
  } else if (d.outcome === 'Escalated to MS') box.appendChild(note(L('dv.waitMs', 'Waiting for the Member Secretary’s decision.'), 'warning'));
  root.appendChild(card(L('dv.outcomeT', '4. Outcome'), box));
  const ev = all('audit').filter((e) => e.ref === c.id).slice(0, 12).map((e) => ({ at: e.at, by: e.actor, role: e.role, action: e.action, remarks: e.detail }));
  if (ev.length) root.appendChild(card(L('ind.history', 'History'), history(ev.reverse())));
  function decide(decision) {
    remarks({ title: decision === 'Recommended' ? L('dv.msRecT', 'Recommend {r}', { r: c.id }) : L('dv.msNotT', 'Do not recommend {r}', { r: c.id }), label: L('dv.msWhy', 'Basis of the decision'), required: true, ok: decision === 'Recommended' ? L('dv.msRec', 'Recommend') : L('dv.msNot', 'Do not recommend'), kind: decision === 'Recommended' ? 'ok' : 'danger' }).then((t) => {
      if (t === null) return;
      otp({ title: L('ind.esign', 'Aadhaar e-Sign (demo)') }).then((y) => {
        if (!y) return;
        const now = new Date().toISOString();
        d.msDecision = { decision, by: who(), at: now, remarks: t };
        d.outcome = decision;
        c.stage = decision === 'Recommended' ? 'DV completed' : 'DV not recommended';
        all('alerts').filter((a) => a.roll === c.id && /Face|Aadhaar/.test(a.type) && a.status !== 'Cleared').forEach((a) => { a.status = decision === 'Recommended' ? 'Cleared' : 'Escalated'; a.history.push({ at: now, by: who(), role: role(), action: a.status, remarks: t }); });
        log(who(), role(), 'DV escalation decided: ' + decision, 'Candidate', c.id, t);
        save();
        ok(L('dv.decided', 'Decision recorded.'));
        redraw();
      });
    });
  }
}
