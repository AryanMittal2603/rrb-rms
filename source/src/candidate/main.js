// RMS candidate portal (demo): status after the CBT, DV and medical schedule, letters, grievances
// and messages. Uses the same demo data as the staff portal, so actions show up on both sides.
import { initChrome } from '../rms/chrome.js';
import { load, save, all, byId, candidate, insert, log } from '../rms/core/store.js';
import { route, start, path, go, fallback } from '../rms/core/router.js';
import { h, mount, icon } from '../rms/core/h.js';
import { card, btn, note, kv, empty, grid, link, band } from '../rms/ui/page.js';
import { badge } from '../rms/ui/badge.js';
import { field, form } from '../rms/ui/form.js';
import { modal, ok, fail } from '../rms/ui/dialogs.js';
import { stepper, history } from '../rms/ui/timeline.js';
import { portrait } from '../rms/ui/photo.js';
import { table } from '../rms/ui/table.js';
import { callLetter, medicalMemo, offerLetter } from '../rms/letters.js';
import { catLabel, postName, hospitalName, unitName, newId, pad } from '../rms/modules/common.js';
import { date, dateTime, iso, mask } from '../rms/core/format.js';
import { L } from '../rms/i18n.js';
import { isPublic } from '../rms/core/env.js';

const KEY = 'rms.cand.session';
const OTP = '246810';
const CATS = ['Result & score', 'DV schedule', 'Medical examination', 'Documents & certificates', 'Panel & allocation', 'Offer & joining', 'Others'];

function session() { try { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
function me() { const s = session(); return s ? candidate(s.roll) : null; }
function signOut() { try { window.localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ } window.location.replace('candidate.html'); }
function offerOf(c) { return all('offers').filter((o) => o.roll === c.id).slice(-1)[0] || null; }

// ------------------------------------------------------------------ sign-in
function signInView(root) {
  document.body.classList.add('chrome--signin', 'rms-cand--out');
  const demos = load().demoCandidates.map(candidate).filter(Boolean);
  let sent = false;
  const reg = h('input.signin__input', { id: 'c-reg', autocomplete: 'off', placeholder: L('cand.reg', 'Registration number') });
  const dob = h('input.signin__input', { id: 'c-dob', type: 'date', placeholder: L('cand.dob', 'Date of birth') });
  const code = h('input.signin__input', { id: 'c-otp', inputmode: 'numeric', maxlength: '6', placeholder: L('cand.otp', 'OTP'), disabled: true });
  const msg = h('p.rms-small', { role: 'status' });
  const getOtp = h('button.signin__generate', { type: 'button', onclick: () => {
    const c = find();
    if (!c) { mount(msg, h('span.field__error', L('cand.noMatch', 'Registration number and date of birth do not match our records.'))); return; }
    sent = true;
    code.disabled = false;
    code.focus();
    mount(msg, L('cand.sent', 'OTP sent to your registered mobile {m}. Demo: the OTP is {o}.', { m: 'XXXXXX' + c.mobile.slice(-4), o: OTP }));
  } }, L('cand.getOtp', 'Get OTP'));
  function find() {
    const r = reg.value.trim().toUpperCase();
    return all('candidates').filter((c) => c.reg.toUpperCase() === r && c.dob === dob.value)[0] || null;
  }
  const submit = () => {
    const c = find();
    if (!c) { mount(msg, h('span.field__error', L('cand.noMatch', 'Registration number and date of birth do not match our records.'))); return; }
    if (!sent || code.value.trim() !== OTP) { mount(msg, h('span.field__error', L('cand.badOtp', 'Enter the OTP sent to your mobile (demo: {o}).', { o: OTP }))); return; }
    try { window.localStorage.setItem(KEY, JSON.stringify({ roll: c.id, at: new Date().toISOString() })); } catch (e) { /* storage blocked */ }
    log(c.name, 'candidate', 'Signed in to candidate portal', 'Candidate', c.id, '');
    save();
    window.location.hash = '#/status';
    window.location.reload();
  };
  const what = (c) => (c.dv && c.dv.status === 'Scheduled' ? L('cand.demo.dv', 'DV scheduled') : (c.medical && c.medical.status === 'Referred' ? L('cand.demo.med', 'Medical examination due') : (offerOf(c) ? L('cand.demo.offer', 'Offer of appointment') : c.stage)));
  mount(root, h('section.signin.rms-signin', h('div.signin__card.rms-cand-signin',
    h('div.signin__head', h('h1.signin__title', L('cand.title', 'Candidate sign-in'))),
    h('p.rms-signin__intro', L('cand.intro', 'Follow your recruitment after the CBT: document verification, medical examination, panel, offer and joining. Download your letters and raise a grievance.')),
    h('div.signin__view',
      h('div.signin__group', h('label.visually-hidden', { for: 'c-reg' }, L('cand.reg', 'Registration number')), reg),
      h('div.signin__group', h('label.visually-hidden', { for: 'c-dob' }, L('cand.dob', 'Date of birth')), dob),
      h('div.signin__otp-row', getOtp, h('label.visually-hidden', { for: 'c-otp' }, L('cand.otp', 'OTP')), code),
      msg,
      h('button.signin__btn', { type: 'button', onclick: submit }, L('cand.signin', 'Sign in'))),
    h('p.rms-signin__group', L('cand.demos', 'Demo candidates (fills the form)')),
    h('div.rms-roles', demos.map((c) => h('button.rms-role.rms-role--candidate', { type: 'button', onclick: () => { reg.value = c.reg; dob.value = c.dob; getOtp.click(); code.value = OTP; } },
      h('span.rms-role__name', c.name), h('span.rms-role__who', c.reg + ' · ' + c.cen), h('span.rms-role__does', what(c))))),
    h('div.rms-signin__foot', h('span', L('login.note', 'Demo build · frontend only · no backend calls')), h('a', { href: 'index.html?switch=1' }, L('cand.staff', 'Staff sign-in'))))));
}

// ------------------------------------------------------------------ shared bits
function stages(c) {
  const off = offerOf(c);
  const d = c.dv;
  const m = c.medical;
  const st = (done, active, blocked) => (blocked ? 'blocked' : (done ? 'done' : (active ? 'active' : 'todo')));
  return [
    { label: L('cand.s.result', 'Result'), state: 'done', note: L('cand.s.marks', 'Marks {m}', { m: c.marks.toFixed(2) }) },
    { label: L('cand.s.dv', 'Document verification'), state: st(d && d.outcome === 'Recommended', d || c.stage === 'Shortlisted', d && (d.status === 'Absent' || d.outcome === 'Not recommended')), note: d ? (d.status === 'Scheduled' ? date(d.date) : (d.outcome === 'Escalated to MS' ? L('cand.underReview', 'Under review') : (d.outcome || d.status))) : (c.stage === 'Shortlisted' ? L('cand.shortlisted', 'Shortlisted') : '') },
    { label: L('cand.s.med', 'Medical'), state: st(m && m.result === 'Fit', !!m, m && (m.result === 'Unfit' || m.status === 'Absent')), note: m ? (m.status === 'Referred' ? date(m.examDate) : (m.result || m.status)) : '' },
    { label: L('cand.s.panel', 'Panel'), state: st(!!c.panel, false), note: c.panel ? postName(c.panel.post) : '' },
    { label: L('cand.s.offer', 'Offer'), state: st(!!off, false), note: off ? unitName(off.unit) : '' },
    { label: L('cand.s.join', 'Joining'), state: st(off && off.status === 'Joined', off && off.status === 'Offer issued', off && off.status === 'Not joined'), note: off && off.status === 'Joined' ? date(off.joinedAt) : '' },
  ];
}

function nextStep(c) {
  const d = c.dv;
  const m = c.medical;
  const off = offerOf(c);
  const slot = d ? byId('dvSlots', d.slot) : null;
  if (c.withheld) return note(L('cand.n.withheld', 'Your candidature is on hold pending verification. The RRB will contact you; you can raise a grievance if you need clarification.'), 'warning');
  if (d && d.status === 'Scheduled') return note(h('div', h('strong', L('cand.n.dvT', 'Document verification on {d}', { d: date(d.date) })), h('p', L('cand.n.dv', 'Report at {t} to {v}. Bring the original documents listed in your e-call letter and your Aadhaar card.', { t: slot ? slot.reporting : '', v: slot ? slot.venue : 'RRB Bengaluru' })), btn(L('cand.callLetter', 'Download e-call letter'), { small: true, icon: 'download', onClick: () => callLetter(c) })), 'info');
  if (c.stage === 'Shortlisted') return note(L('cand.n.short', 'You are shortlisted for document verification. Your DV date and e-call letter will be published here and sent by SMS.'), 'info');
  if (d && d.outcome === 'Escalated to MS') return note(L('cand.n.esc', 'Your document verification is under review by the Member Secretary. You will be informed of the decision.'), 'warning');
  if (m && m.status === 'Referred') return note(h('div', h('strong', L('cand.n.medT', 'Medical examination on {d}', { d: date(m.examDate) })), h('p', L('cand.n.med', 'Report at 08:00 to {h} with the medical memo and your Aadhaar card. Come fasting; bring spectacles if you use them.', { h: hospitalName(m.hospital) })), btn(L('cand.memo', 'Download medical memo'), { small: true, icon: 'download', onClick: () => medicalMemo(c) })), 'info');
  if (m && m.result === 'Temporarily unfit') return note(L('cand.n.temp', 'You were found temporarily unfit. You will be called for re-examination by {d}.', { d: m.reExamBy ? date(m.reExamBy) : '—' }), 'warning');
  if (off && off.status === 'Offer issued') return note(h('div', h('strong', L('cand.n.offT', 'Offer of appointment from {u}', { u: unitName(off.unit) })), h('p', L('cand.n.off', 'Report by {d} with your original documents.', { d: date(off.reportBy) })), btn(L('cand.offer', 'Download offer letter'), { small: true, icon: 'download', onClick: () => offerLetter(off) })), off.reportBy < iso(new Date()) ? 'warning' : 'success');
  if (off && off.status === 'Joined') return note(L('cand.n.joined', 'You joined {u} on {d}. Employee ID {id}. Welcome to Indian Railways.', { u: unitName(off.unit), d: date(off.joinedAt), id: off.hrmsId }), 'success');
  if (c.panel) return note(L('cand.n.panel', 'You are empanelled for {p}. Your offer of appointment will come from the Railway unit you are allotted to.', { p: postName(c.panel.post) }), 'success');
  if (m && m.result === 'Fit') return note(L('cand.n.fit', 'You are medically fit ({s}). The final result and panels will be published after all candidates complete DV and medical examination.', { s: m.std }), 'success');
  if (d && d.outcome === 'Recommended') return note(L('cand.n.rec', 'Your documents were verified. You will be referred for medical examination shortly.'), 'success');
  if (c.stage === 'Result declared') return note(L('cand.n.result', 'Results are declared. You are not in the current DV list; additional candidates are called in merit order if places remain.'), 'info');
  return note(c.stage, 'info');
}

function page(root, title, ...kids) {
  mount(root, h('h1.rms-cand__hello', title), kids);
}

// ------------------------------------------------------------------ pages
route('/status', null, (root) => {
  const c = me();
  const notes = all('notifications').filter((n) => n.roll === c.id).slice(0, 4);
  page(root, L('cand.hello', 'Welcome, {n}', { n: c.first || c.name }),
    h('p.rms-muted', c.cen + ' · ' + L('cand.rollX', 'Roll no. {r}', { r: c.id }) + ' · ' + L('cand.regX', 'Registration {r}', { r: c.reg })),
    band(L('cand.where', 'Where you are')),
    card(null, stepper(stages(c))),
    nextStep(c),
    grid(2, [
      card(L('cand.summary', 'Your details'), h('div.rms-cand__profile', portrait(c.photo, { size: 84 }), kv([[L('col.category', 'Category'), catLabel(c)], [L('col.marks', 'Normalised marks'), c.marks.toFixed(2)], [L('dv.prefs', 'Post preferences'), c.prefs.map(postName).join(', ')], [L('col.stage', 'Stage'), badge(c.stage)]]))),
      card(L('cand.recent', 'Recent messages'), notes.length ? h('ul.rms-list', notes.map((n) => h('li', h('strong', date(n.at) + ' · ' + n.channel + ': '), n.subject))) : h('p.rms-muted', L('cand.noMsgs', 'No messages yet.')), { actions: [link(L('cand.all', 'All messages'), '/notifications')] }),
    ]));
});

route('/dv', null, (root) => {
  const c = me();
  const d = c.dv;
  const m = c.medical;
  const slot = d ? byId('dvSlots', d.slot) : null;
  let dvCard;
  if (d) {
    const review = d.outcome === 'Escalated to MS';
    const canAsk = d.status === 'Scheduled' && !all('grievances').some((g) => g.roll === c.id && g.category === 'DV schedule');
    const bring = d.status === 'Scheduled' ? h('div',
      h('h3.rms-h3', L('cand.bring', 'Bring the originals of')),
      h('ul.rms-list',
        h('li', L('dv.b1', 'This e-call letter and the Aadhaar card used in the application')),
        h('li', L('dv.b2', 'Class 10 certificate (date of birth) and marksheets')),
        h('li', L('dv.b3', 'Essential-qualification certificate and marksheets')),
        c.cat !== 'UR' ? h('li', L('dv.b4', 'Community certificate in the prescribed format ({c})', { c: c.cat })) : null,
        c.pwbd ? h('li', L('dv.b5', 'Disability certificate / UDID card')) : null,
        c.exsm ? h('li', L('dv.b6', 'Discharge book / PPO')) : null),
      h('p.rms-small.rms-muted', L('cand.faceNote', 'At DV your photograph is taken and matched with your application photograph; Aadhaar face authentication is done with your consent.'))) : null;
    dvCard = card(L('cand.dvT', 'Document verification'), h('div',
      h('div.rms-toolbar', badge(review ? 'Under review' : (d.outcome || d.status), review ? L('cand.underReview', 'Under review') : null)),
      kv([
        [L('col.date', 'Date'), date(d.date) + ' · ' + (d.session === 'FN' ? L('dv.fn', 'Forenoon') : L('dv.an', 'Afternoon'))],
        [L('cand.reporting', 'Reporting time'), slot ? slot.reporting : '—'],
        [L('dvs.venue', 'Venue'), slot ? slot.venue : '—'],
        [L('cand.letter', 'E-call letter'), d.callLetter ? L('cand.issuedOn', 'Issued {d}', { d: date(d.callLetter) }) : L('cand.notYet', 'Not yet issued')],
      ], 2),
      h('div.rms-toolbar',
        d.callLetter ? btn(L('cand.callLetter', 'Download e-call letter'), { icon: 'download', onClick: () => callLetter(c) }) : null,
        canAsk ? btn(L('cand.changeDate', 'Request another date'), { kind: 'plain', onClick: () => raise(c, 'DV schedule', L('cand.changeSubj', 'Request to change DV date')) }) : null),
      bring));
  } else {
    dvCard = card(L('cand.dvT', 'Document verification'), empty(c.stage === 'Shortlisted' ? L('cand.n.short', 'You are shortlisted for document verification. Your DV date and e-call letter will be published here and sent by SMS.') : L('cand.noDv', 'You are not in a DV schedule.')));
  }
  let medCard;
  if (m) {
    medCard = card(L('cand.medT', 'Medical examination'), h('div',
      h('div.rms-toolbar', badge(m.result || m.status)),
      kv([
        [L('med.hospital', 'Hospital'), hospitalName(m.hospital)],
        [L('med.examOn', 'Examination on'), date(m.examDate)],
        [L('med.required', 'Medical standard required'), m.required],
        [L('med.memoNo', 'Memo'), m.memoNo],
        [L('med.result', 'Result'), m.result ? m.result + (m.std ? ' (' + m.std + ')' : '') : L('cand.awaited', 'Awaited')],
      ], 2),
      h('div.rms-toolbar', btn(L('cand.memo', 'Download medical memo'), { icon: 'download', onClick: () => medicalMemo(c) }))));
  } else {
    medCard = card(L('cand.medT', 'Medical examination'), empty(L('cand.noMed', 'You will be referred for the medical examination after document verification.')));
  }
  page(root, L('rms.cnav.dv', 'DV & Medical'), dvCard, medCard);
});

route('/documents', null, (root) => {
  const c = me();
  const off = offerOf(c);
  const docs = [];
  if (c.dv && c.dv.callLetter) docs.push({ name: L('cand.d.call', 'E-call letter for document verification'), at: c.dv.callLetter, open: () => callLetter(c) });
  if (c.medical) docs.push({ name: L('cand.d.memo', 'Medical examination memo'), at: c.medical.referredAt, open: () => medicalMemo(c) });
  if (off) docs.push({ name: L('cand.d.offer', 'Offer of appointment'), at: off.issuedAt, open: () => offerLetter(off) });
  page(root, L('rms.cnav.documents', 'Documents & Letters'),
    docs.length ? card(null, h('ul.rms-doclist', docs.map((d) => h('li', h('span', icon('doc', 18), ' ', h('strong', d.name), h('br'), h('span.rms-small.rms-muted', L('cand.issuedOn', 'Issued {d}', { d: date(d.at) }))), btn(L('cand.view', 'View / print'), { small: true, kind: 'plain', icon: 'print', onClick: d.open }))))) : empty(L('cand.noDocs', 'No letters yet. They appear here as soon as they are issued.')),
    note(L('cand.docNote', 'Letters are signed digitally. Verify a letter by its number at the RRB helpdesk if anyone asks you for money or favours: RRBs never do.'), 'info'));
});

function raise(c, cat, subject, redraw) {
  const f = form([
    field({ name: 'category', type: 'select', label: L('col.category', 'Category'), required: true, value: cat || '', options: CATS }),
    field({ name: 'subject', label: L('grv.subject', 'Subject'), required: true, value: subject || '' }),
    field({ name: 'text', type: 'textarea', label: L('cand.describe', 'Describe the issue'), required: true, rows: 5 }),
    field({ name: 'file', type: 'file', label: L('cand.attach', 'Attachment (optional)'), demoName: 'supporting-document.pdf' }),
  ], 1);
  modal({ title: L('cand.raise', 'Raise a grievance'), body: h('div', note(L('cand.sla', 'We reply within 48 hours. You can follow the reply here and by SMS.'), 'info'), f.node), actions: [
    { label: L('ui.submit', 'Submit'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      const now = new Date().toISOString();
      const g = { id: newId('grievances', 'grievance', (n) => 'GRV-' + pad(5200 + n, 5)), roll: c.id, name: c.name, cen: c.cen, rrb: 'SBC', channel: 'Portal', category: v.category, subject: v.subject, text: v.text, status: 'New', assignee: null, at: now, priority: 'Normal', history: [{ at: now, by: c.name, role: 'candidate', action: 'Raised via Portal', text: v.text }] };
      insert('grievances', g);
      log(c.name, 'candidate', 'Grievance raised', 'Grievance', g.id, v.subject);
      save();
      ok(L('cand.raised', 'Grievance {id} registered. We reply within 48 hours.', { id: g.id }));
      if (redraw) redraw(); else go('/grievances');
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

route('/grievances', null, (root) => {
  const c = me();
  const draw = () => {
    const mine = all('grievances').filter((g) => g.roll === c.id);
    page(root, L('rms.cnav.grievances', 'Grievances'),
      h('div.rms-toolbar', btn(L('cand.raise', 'Raise a grievance'), { icon: 'plus', onClick: () => raise(c, '', '', draw) })),
      mine.length ? mine.map((g) => card(g.subject, h('div',
        h('div.rms-toolbar', badge(g.status), h('span.rms-small.rms-muted', g.id + ' · ' + g.category + ' · ' + dateTime(g.at))),
        history(g.history.filter((e) => e.text || /Responded|Closed|Raised/.test(e.action)).map((e) => ({ at: e.at, by: e.role === 'candidate' ? L('cand.you', 'You') : L('cand.rrb', 'RRB helpdesk'), action: e.action, remarks: e.text })), { oldestFirst: true }),
        g.status === 'Responded' ? h('div.rms-toolbar',
          btn(L('cand.resolved', 'My issue is resolved'), { small: true, kind: 'ok', onClick: () => { g.status = 'Closed'; g.history.push({ at: new Date().toISOString(), by: c.name, role: 'candidate', action: 'Closed', text: L('cand.thanks', 'Closed by the candidate.') }); log(c.name, 'candidate', 'Grievance closed', 'Grievance', g.id, ''); save(); draw(); } }),
          btn(L('cand.reopen', 'Not resolved, reopen'), { small: true, kind: 'plain', onClick: () => { g.status = 'Reopened'; g.history.push({ at: new Date().toISOString(), by: c.name, role: 'candidate', action: 'Reopened', text: L('cand.reopenText', 'The issue is not resolved.') }); log(c.name, 'candidate', 'Grievance reopened', 'Grievance', g.id, ''); save(); draw(); } })) : null))) : empty(L('cand.noGrv', 'You have not raised any grievance.')));
  };
  draw();
});

route('/notifications', null, (root) => {
  const c = me();
  const list = all('notifications').filter((n) => n.roll === c.id);
  page(root, L('rms.cnav.notifications', 'Notifications'), list.length ? table({ rows: list, search: false, columns: [
    { key: 'at', label: L('col.date', 'Date'), nowrap: true, value: (n) => dateTime(n.at), sortValue: (n) => n.at },
    { key: 'channel', label: L('ntf.channel', 'Channel') },
    { key: 'subject', label: L('ntf.subject', 'Message') },
    { key: 'status', label: L('col.status', 'Status'), render: (n) => badge(n.status) },
  ], sort: 'at', dir: -1 }) : empty(L('cand.noMsgs', 'No messages yet.')));
});

route('/profile', null, (root) => {
  const c = me();
  page(root, L('cand.profile', 'Profile'), card(null, h('div.rms-cand__profile', portrait(c.photo, { size: 110, caption: L('dv.photoApp', 'Application photograph') }), kv([
    [L('col.name', 'Name'), c.name], [L('col.father', 'Father’s name'), c.father], [L('cand.mother', 'Mother’s name'), c.mother], [L('col.dob', 'Date of birth'), date(c.dob)], [L('col.gender', 'Gender'), c.gender],
    [L('col.category', 'Category'), catLabel(c)], [L('trl.aadhaar', 'Aadhaar'), mask(c.aadhaar.last4, 4)], [L('trl.mobile', 'Mobile'), 'XXXXXX' + c.mobile.slice(-4)], [L('usr.email', 'E-mail'), c.email.replace(/^(.).*(@.*)$/, '$1•••$2')],
    [L('trl.qual', 'Qualification'), c.qual], [L('cand.address', 'City'), c.city + ', ' + c.state], [L('cand.lang', 'Language for messages'), c.language || 'English'],
  ], 2))), note(L('cand.profileNote', 'Details come from your application and cannot be edited here. To correct a detail, raise a grievance with the document as proof.'), 'info'),
  h('div.rms-toolbar', btn(L('cand.signout', 'Sign out'), { kind: 'plain', onClick: signOut })));
});

fallback(() => go('/status'));

// ------------------------------------------------------------------ boot
function markNav(p) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-candidate-nav] a[data-nav]'), (a) => {
    const on = p.indexOf('/' + a.getAttribute('data-nav')) === 0;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function boot() {
  load();
  const root = document.getElementById('cand-root');
  const c = me();
  initChrome(c ? { name: c.name + ' · ' + c.id, who: c.name, onLogout: signOut } : {});
  if (!c) { signInView(root); return; }
  start((match) => {
    if (!me()) { window.location.replace('candidate.html'); return; }
    const p = path();
    if (!match || p === '/dashboard') { go('/status'); return; }
    mount(root);
    try { match.route.render(root, match.params); } catch (e) { mount(root, note(String(e && e.message ? e.message : e), 'danger')); if (window.console) window.console.error(e); }
    markNav(p);
    const h1 = root.querySelector('h1');
    document.title = (h1 ? h1.textContent + ' | ' : '') + (isPublic() ? L('cand.appNameDemo', 'RMS candidate portal demo (unofficial)') : L('cand.appName', 'RRB candidate portal'));
    window.scrollTo(0, 0);
  });
  void fail;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
