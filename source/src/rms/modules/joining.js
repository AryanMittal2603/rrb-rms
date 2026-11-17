// SOW 2.13: offers of appointment and joining. Units issue offers to accepted candidates, send
// reminders, record joining (HRMS employee ID, police verification, training) or non-joining,
// which leads to a replacement indent.
import { h, mount } from '../core/h.js';
import { route, go } from '../core/router.js';
import { all, byId, save, log, candidate, insert, notify, next } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, btn, link, note, stats, stat, tabs } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, fail, otp, remarks } from '../ui/dialogs.js';
import { showDoc, sigBlock } from '../ui/doc.js';
import { hbars } from '../ui/charts.js';
import { candLink, postName, unitName, newId, pad } from './common.js';
import { date, iso } from '../core/format.js';
import { L } from '../i18n.js';
import { offerLetter } from '../letters.js';

const MY_UNIT = 'SBC';
function today() { return iso(new Date()); }
function overdue(o) { return o.status === 'Offer issued' && o.reportBy < today(); }


route('/joining', null, (root) => {
  let tab = 'offers';
  const draw = () => {
    mount(root);
    const scope = is('unit') ? all('offers').filter((o) => o.unit === MY_UNIT) : all('offers');
    const toOffer = is('unit') ? pendingOffers() : [];
    root.appendChild(head({
      title: L('job.title', 'Offers & joining'),
      sub: is('unit') ? L('job.subUnit', 'Issue offers to candidates accepted by your unit, follow joining, and raise a replacement indent when a candidate does not join.') : L('job.sub', 'Offers of appointment and joining across units of South Western Railway.'),
      sow: '2.13',
      actions: is('unit') && toOffer.length ? [btn(L('job.issue', 'Issue offers ({n})', { n: toOffer.length }), { icon: 'send', onClick: () => issue(toOffer, draw) })] : [],
    }));
    root.appendChild(stats([
      stat(L('job.issued', 'Offers issued'), scope.length),
      stat(L('job.joined', 'Joined'), scope.filter((o) => o.status === 'Joined').length, { tone: 'ok' }),
      stat(L('job.waiting', 'Awaiting joining'), scope.filter((o) => o.status === 'Offer issued').length, { tone: 'navy' }),
      stat(L('job.overdue', 'Past the reporting date'), scope.filter(overdue).length, { tone: 'danger' }),
      stat(L('job.notJoined', 'Not joined'), scope.filter((o) => o.status === 'Not joined').length, { tone: 'warn' }),
    ]));
    const t = [{ id: 'offers', label: L('job.tab.offers', 'Offers'), count: scope.length }];
    if (!is('unit')) t.push({ id: 'units', label: L('job.tab.units', 'By unit') });
    root.appendChild(tabs(t, tab, (id) => { tab = id; draw(); }));
    if (tab === 'units') {
      const units = scope.map((o) => o.unit).filter((x, k, a) => a.indexOf(x) === k);
      root.appendChild(card(L('job.byUnit', 'Joining by unit'), hbars(units.map((u) => ({ label: unitName(u), value: scope.filter((o) => o.unit === u).length, value2: scope.filter((o) => o.unit === u && o.status === 'Joined').length })), { series: [L('job.issuedS', 'Offers'), L('job.joinedS', 'Joined')], labelWidth: 180, title: L('job.byUnit', 'Joining by unit'), labelHead: L('col.unit', 'Unit') })));
      return;
    }
    root.appendChild(table({ rows: scope, exportName: 'offers', sort: 'issuedAt', dir: -1, columns: [
      { key: 'id', label: L('col.offer', 'Offer'), render: (o) => h('a.rms-link', { href: 'javascript:void 0', onclick: (e) => { e.preventDefault(); offerLetter(o); } }, o.id) },
      { key: 'roll', label: L('col.roll', 'Roll no.'), render: (o) => candLink(o.roll) },
      is('unit') ? null : { key: 'unit', label: L('col.unit', 'Unit'), value: (o) => unitName(o.unit) },
      { key: 'post', label: L('col.post', 'Post'), value: (o) => postName(o.post) },
      { key: 'issuedAt', label: L('job.issuedOn', 'Issued'), nowrap: true, value: (o) => date(o.issuedAt), sortValue: (o) => o.issuedAt },
      { key: 'reportBy', label: L('job.reportBy', 'Report by'), nowrap: true, render: (o) => (overdue(o) ? h('span.rms-nowrap', date(o.reportBy), ' ', badge('Failed', L('job.late', 'Overdue'))) : date(o.reportBy)), value: (o) => date(o.reportBy), sortValue: (o) => o.reportBy },
      { key: 'status', label: L('col.status', 'Status'), render: (o) => h('span', badge(o.status), o.hrmsId ? h('span.rms-small.rms-muted', ' ' + o.hrmsId) : null), value: (o) => o.status },
      { key: 'act', label: '', action: true, render: (o) => actions(o, draw) },
    ].filter(Boolean), filters: [{ key: 'status', label: L('col.status', 'Status'), options: ['Offer issued', 'Joined', 'Not joined'] }].concat(is('unit') ? [] : [{ key: 'unit', label: L('col.unit', 'Unit'), options: scope.map((o) => o.unit).filter((x, k, a) => a.indexOf(x) === k).map((u) => ({ value: u, label: unitName(u) })) }]) }));
  };
  draw();
});

function pendingOffers() {
  const out = [];
  all('panels').forEach((p) => {
    if (!p.distribution || !p.distribution.accepted || !p.distribution.accepted[MY_UNIT]) return;
    p.versions[p.versions.length - 1].rows.forEach((r) => {
      if (p.distribution.units[r.roll] !== MY_UNIT) return;
      if (all('offers').some((o) => o.roll === r.roll && o.panel === p.id)) return;
      out.push({ roll: r.roll, panel: p.id, post: p.post });
    });
  });
  return out;
}

function issue(list, redraw) {
  otp({ title: L('job.signOffers', 'Sign {n} offer(s) of appointment', { n: list.length }) }).then((y) => {
    if (!y) return;
    const now = new Date().toISOString();
    const by = iso(new Date(Date.now() + 30 * 864e5));
    list.forEach((x) => {
      const id = newId('offers', 'offer', (n) => 'OFR-' + MY_UNIT + '-' + (200 + n));
      insert('offers', { id, roll: x.roll, unit: MY_UNIT, post: x.post, panel: x.panel, issuedAt: now, sentAt: now, reportBy: by, status: 'Offer issued', reminders: [], signedBy: who() });
      const c = candidate(x.roll);
      if (c) { c.stage = 'Offer issued'; c.joining = { status: 'Offer issued', offer: id }; }
      notify(x.roll, 'Email', 'Offer of appointment', 'Offer of appointment ' + id + ', report by ' + date(by));
      notify(x.roll, 'SMS', 'Offer of appointment', 'Offer issued; report by ' + date(by));
    });
    log(who(), role(), 'Offers issued', 'Offer', MY_UNIT, list.length + ' offer(s)');
    save();
    ok(L('job.issuedOk', '{n} offer(s) issued and sent to the candidates.', { n: list.length }));
    redraw();
  });
}

function actions(o, redraw) {
  if (!is('unit') || o.unit !== MY_UNIT) return null;
  if (o.status === 'Offer issued') {
    return h('span.rms-nowrap',
      btn(L('job.joinedBtn', 'Record joining'), { small: true, kind: 'ok', onClick: () => joined(o, redraw) }), ' ',
      btn(L('job.remind', 'Remind'), { small: true, kind: 'plain', onClick: () => { o.reminders.push(new Date().toISOString()); notify(o.roll, 'SMS', 'Joining reminder', 'Report by ' + date(o.reportBy)); log(who(), role(), 'Joining reminder sent', 'Offer', o.id, ''); save(); ok(L('job.reminded', 'Reminder sent by SMS.')); redraw(); } }), ' ',
      btn(L('job.notJoinedBtn', 'Not joined'), { small: true, kind: 'plain', onClick: () => notJoined(o, redraw) }));
  }
  if (o.status === 'Not joined' && !o.replacement) {
    return btn(L('job.replace', 'Raise replacement indent'), { small: true, onClick: () => {
      const p = byId('panels', o.panel);
      const ind = p ? byId('indents', p.indent) : null;
      const fieldId = ind && ind.children ? ind.children.filter((id) => { const f = byId('indents', id); return f && f.unit === MY_UNIT; })[0] : null;
      if (!fieldId) { fail(L('job.noIndent', 'The original field indent was not found.')); return; }
      o.replacement = 'requested';
      save();
      go('/indents/new?type=Replacement&post=' + o.post + '&parent=' + fieldId + '&offer=' + o.id);
    } });
  }
  if (o.replacement && o.replacement !== 'requested') return link(o.replacement, '/indents/' + o.replacement);
  return null;
}

function joined(o, redraw) {
  const f = form([
    field({ name: 'joinedAt', type: 'date', label: L('job.joinedOn', 'Joined on'), required: true, value: today() }),
    field({ name: 'pv', type: 'select', label: L('job.pv', 'Police verification'), required: true, value: 'Initiated', options: ['Initiated', 'Received'] }),
    field({ name: 'training', type: 'select', label: L('job.training', 'Training'), value: 'Reported to ZRTI Mysuru', options: ['Reported to ZRTI Mysuru', 'Reported to ZRTI Bhuj', 'Not applicable'] }),
  ], 3);
  modal({ title: L('job.recordT', 'Record joining of {r}', { r: o.roll }), body: h('div', f.node, note(L('job.hrmsNote', 'An employee ID is created in HRMS when you save.'), 'info')), actions: [
    { label: L('ui.save', 'Save'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      Object.assign(o, { status: 'Joined', joinedAt: v.joinedAt, reportedAt: v.joinedAt, pv: v.pv, training: v.training, hrmsId: 'HR' + pad(4170000 + next('hrmsId') * 13, 7) });
      const c = candidate(o.roll);
      if (c) { c.stage = 'Joined'; c.joining = { status: 'Joined', offer: o.id, date: v.joinedAt, hrmsId: o.hrmsId }; }
      log(who(), role(), 'Joined', 'Offer', o.id, o.roll + ' · ' + o.hrmsId);
      save();
      ok(L('job.joinedOk', 'Joining recorded; HRMS employee ID {id}.', { id: o.hrmsId }));
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

function notJoined(o, redraw) {
  remarks({ title: L('job.notJoinedT', '{r} did not join', { r: o.roll }), label: L('job.reason', 'Reason / communication from the candidate'), required: true, ok: L('job.notJoinedBtn', 'Not joined'), kind: 'danger' }).then((t) => {
    if (t === null) return;
    o.status = 'Not joined';
    o.reason = t;
    const c = candidate(o.roll);
    if (c) { c.stage = 'Not joined'; c.joining = { status: 'Not joined', offer: o.id, reason: t }; }
    log(who(), role(), 'Not joined', 'Offer', o.id, t);
    save();
    ok(L('job.notJoinedOk', 'Recorded. Raise a replacement indent for the vacancy.'));
    redraw();
  });
}
