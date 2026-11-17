// Letters shared by the staff screens and the candidate portal: e-call letter for DV, medical
// examination memo and offer of appointment. Printed on the RRB / Railway letterhead.
import { h } from './core/h.js';
import { byId, candidate } from './core/store.js';
import { portrait } from './ui/photo.js';
import { showDoc, sigBlock } from './ui/doc.js';
import { catLabel, postName, hospitalName, unitName } from './modules/common.js';
import { date } from './core/format.js';
import { L } from './i18n.js';

export function callLetter(c) {
  const s = byId('dvSlots', c.dv.slot) || {};
  showDoc({
    dialogTitle: L('dv.callLetter', 'E-call letter'),
    title: L('dv.callTitle', 'E-call letter for document verification'),
    office: 'Railway Recruitment Board, Bengaluru',
    ref: 'RRB/SBC/DV/' + c.cen.replace(/\D/g, '') + '/' + c.id.slice(-5),
    date: date(c.dv.callLetter || new Date()),
    body: h('div',
      h('div.rms-doc__photos', portrait(c.photo, { size: 84, caption: L('dv.photoApp', 'Application photograph') })),
      h('table', h('tbody',
        h('tr', h('th', L('col.roll', 'Roll no.')), h('td', c.id)), h('tr', h('th', L('col.reg', 'Registration no.')), h('td', c.reg)),
        h('tr', h('th', L('col.name', 'Name')), h('td', c.name)), h('tr', h('th', L('col.father', 'Father’s name')), h('td', c.father)),
        h('tr', h('th', L('col.dob', 'Date of birth')), h('td', date(c.dob))), h('tr', h('th', L('col.category', 'Category')), h('td', catLabel(c))),
        h('tr', h('th', L('col.cen', 'CEN')), h('td', c.cen)), h('tr', h('th', L('dv.prefs', 'Post preferences')), h('td', c.prefs.map(postName).join(', '))))),
      h('p', h('strong', L('dv.reportOn', 'Report on {d} ({s}) at {t}, {v}.', { d: date(s.date), s: s.session === 'FN' ? L('dv.fn', 'Forenoon') : L('dv.an', 'Afternoon'), t: s.reporting, v: s.venue }))),
      h('p', L('dv.bring', 'Bring the originals and one self-attested copy of:')),
      h('ol', h('li', L('dv.b1', 'This e-call letter and the Aadhaar card used in the application')), h('li', L('dv.b2', 'Class 10 certificate (date of birth) and marksheets')), h('li', L('dv.b3', 'Essential-qualification certificate and marksheets')),
        c.cat !== 'UR' ? h('li', L('dv.b4', 'Community certificate in the prescribed format ({c})', { c: c.cat })) : null, c.pwbd ? h('li', L('dv.b5', 'Disability certificate / UDID card')) : null, c.exsm ? h('li', L('dv.b6', 'Discharge book / PPO')) : null,
        h('li', L('dv.b7', 'Two recent passport-size photographs matching the application photograph'))),
      h('p.rms-small', L('dv.instr', 'Candidates found ineligible at DV will not be considered further. Your live photograph will be matched with the application photograph and Aadhaar face authentication will be done with your consent.')),
      sigBlock('Kavya Hegde', L('dv.sigMs', 'Member Secretary, RRB Bengaluru'))),
  });
}

export function medicalMemo(c) {
  const m = c.medical;
  showDoc({
    dialogTitle: L('med.memo', 'Medical examination memo'),
    title: L('med.memoTitle', 'Memo for medical examination of a candidate for appointment'),
    office: 'Railway Recruitment Board, Bengaluru',
    ref: m.memoNo,
    date: date(m.referredAt),
    body: h('div',
      h('div.rms-doc__photos', portrait(c.photo, { size: 84, caption: L('dv.photoApp', 'Application photograph') })),
      h('p', L('med.to', 'To: The Medical Superintendent, {h}', { h: hospitalName(m.hospital) })),
      h('p', L('med.memoText', 'The candidate below has been recommended at document verification for {cen}. Please examine the candidate for the medical standard shown and return the result with the certificate through HMIS.', { cen: c.cen })),
      h('table', h('tbody',
        h('tr', h('th', L('col.roll', 'Roll no.')), h('td', c.id)), h('tr', h('th', L('col.name', 'Name')), h('td', c.name)),
        h('tr', h('th', L('col.dob', 'Date of birth')), h('td', date(c.dob))), h('tr', h('th', L('col.gender', 'Gender')), h('td', c.gender)),
        h('tr', h('th', L('med.required', 'Medical standard required')), h('td', h('strong', m.required))),
        h('tr', h('th', L('dv.prefs', 'Post preferences')), h('td', c.prefs.map((p) => postName(p) + ' (' + byId('posts', p).med + ')').join(', '))),
        h('tr', h('th', L('med.examOn', 'Examination on')), h('td', date(m.examDate) + ', 08:00')))),
      h('p.rms-small', L('med.memoNote', 'Identify the candidate from the photograph above and the original Aadhaar. A candidate found fit in a higher standard is fit for all lower standards.')),
      sigBlock('Kavya Hegde', L('dv.sigMs', 'Member Secretary, RRB Bengaluru'))),
  });
}

export function offerLetter(o) {
  const c = candidate(o.roll);
  const p = byId('posts', o.post);
  showDoc({
    dialogTitle: L('job.offer', 'Offer of appointment'),
    title: L('job.offerTitle', 'Offer of appointment'),
    office: unitName(o.unit) + ', ' + 'South Western Railway',
    ref: o.id,
    date: date(o.issuedAt),
    body: h('div',
      h('p', L('job.to', 'To: {n}, {r}', { n: c.name, r: c.id })),
      h('p', L('job.text1', 'On the recommendation of Railway Recruitment Board, Bengaluru ({cen}, panel {p}), you are offered appointment as {post} in Level {lvl} of the pay matrix (7th CPC), subject to the conditions below.', { cen: c.cen, p: o.panel, post: p.designation, lvl: p.level })),
      h('ol',
        h('li', L('job.c1', 'Report to the Senior Divisional Personnel Officer, {u}, on or before {d} with the original documents verified at DV.', { u: unitName(o.unit), d: date(o.reportBy) })),
        h('li', L('job.c2', 'The appointment is provisional, subject to police verification of character and antecedents.')),
        p.training ? h('li', L('job.c3', 'You will undergo {w} weeks of initial training; the training period counts as service.', { w: p.training })) : null,
        h('li', L('job.c4', 'If you do not report by the date above, the offer lapses and the vacancy is filled from the panel or by a replacement indent.'))),
      sigBlock(o.signedBy, L('job.sig', 'Sr. Divisional Personnel Officer, {u}', { u: unitName(o.unit) }))),
  });
}
