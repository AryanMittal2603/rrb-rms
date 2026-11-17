// SOW 2.12: panel distribution. RRB allocates an approved panel to the CPO (OTP); the CPO
// distributes candidates to indenting units against their field indents (automatic by merit and
// community, with recorded manual changes); units accept and the records go to HRMS onboarding.
import { h, mount } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, save, log, candidate, insert, next } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, tabs, btn, link, note, stats, stat, empty } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { modal, ok, fail, otp, remarks } from '../ui/dialogs.js';
import { history } from '../ui/timeline.js';
import { candLink, postName, unitName, newId } from './common.js';
import { distribute } from '../core/engine.js';
import { date, dateTime } from '../core/format.js';
import { L } from '../i18n.js';

const MY_UNIT = 'SBC';

function current(p) { return p.versions[p.versions.length - 1]; }
function fieldIndents(p) {
  const ind = byId('indents', p.indent);
  return ind && ind.children ? ind.children.map((id) => byId('indents', id)).filter(Boolean) : [];
}
function intLog(system, direction, message) {
  insert('intLog', { id: newId('intLog', 'intlog', (n) => 'IL-' + (9000 + n)), system, direction, message, status: 'OK', at: new Date().toISOString(), ref: 'MSG-' + (100000 + next('msg') * 7) });
}

route('/distribution', null, (root) => {
  const q = query();
  if (is('unit')) { unitView(root); return; }
  const draw = () => {
    mount(root);
    const panels = all('panels').filter((p) => /Approved by Chairperson|Allocated to CPO|Distributed to units/.test(p.status));
    root.appendChild(head({
      title: L('dist.title', 'Panel distribution'),
      sub: is('cpo') ? L('dist.subCpo', 'Panels allocated to your Railway. Distribute candidates to indenting units against their field indents; units then accept them.') : L('dist.sub', 'Approved panels are allocated to the CPO with OTP confirmation. The CPO distributes candidates to units; acceptance and HRMS onboarding are tracked here.'),
      sow: '2.12',
    }));
    root.appendChild(stats([
      stat(L('dist.toAllocate', 'Approved, not allocated'), panels.filter((p) => p.status === 'Approved by Chairperson').length, { tone: 'warn' }),
      stat(L('dist.withCpo', 'With CPO'), panels.filter((p) => p.status === 'Allocated to CPO').length, { tone: 'navy' }),
      stat(L('dist.done', 'Distributed to units'), panels.filter((p) => p.status === 'Distributed to units').length, { tone: 'ok' }),
    ]));
    root.appendChild(table({ rows: panels, columns: [
      { key: 'id', label: L('col.panel', 'Panel'), render: (p) => link(p.id, '/panels/' + p.id) },
      { key: 'post', label: L('col.post', 'Post'), value: (p) => postName(p.post) },
      { key: 'n', label: L('pnl.candidates', 'Candidates'), align: 'right', value: (p) => current(p).rows.length },
      { key: 'units', label: L('dist.units', 'Units'), value: (p) => fieldIndents(p).map((f) => f.unit).join(', ') },
      { key: 'status', label: L('col.status', 'Status'), render: (p) => badge(p.status), value: (p) => p.status },
      { key: 'hrms', label: 'HRMS', render: (p) => (p.hrms ? badge('Delivered', L('dist.hrmsOk', 'Onboarding sent {d}', { d: date(p.hrms.pushed) })) : null) },
      { key: 'act', label: '', action: true, render: (p) => {
        if (is('rrb', 'ms') && p.status === 'Approved by Chairperson') return btn(L('dist.allocate', 'Allocate to CPO'), { small: true, onClick: () => allocate(p, draw) });
        if (is('cpo') && p.status === 'Allocated to CPO') return btn(L('dist.distribute', 'Distribute to units'), { small: true, onClick: () => go('/distribution/' + p.id) });
        return btn(L('ui.open', 'Open'), { small: true, kind: 'plain', href: '/distribution/' + p.id });
      } },
    ], empty: L('dist.none', 'No approved panel yet.') }));
    void q;
  };
  draw();
});

function allocate(p, redraw) {
  otp({ title: L('dist.allocOtp', 'Allocate {id} to CPO, South Western Railway', { id: p.id }) }).then((y) => {
    if (!y) return;
    const now = new Date().toISOString();
    p.status = 'Allocated to CPO';
    p.history.push({ at: now, by: who(), role: role(), action: 'Allocated to CPO', remarks: 'CPO, South Western Railway (Hubballi) · OTP verified' });
    log(who(), role(), 'Panel allocated to CPO', 'Panel', p.id, 'CPO-SWR');
    save();
    ok(L('dist.allocated', '{id} allocated to the CPO.', { id: p.id }));
    redraw();
  });
}

route('/distribution/:id', null, (root, prm) => {
  const p = byId('panels', prm.id);
  if (!p) { root.appendChild(head({ title: L('pnl.notFound', 'Panel not found') })); return; }
  const fi = fieldIndents(p);
  const rows = current(p).rows;
  const plan = p.distribution && p.distribution.units ? Object.assign({}, p.distribution.units) : distribute(rows, fi);
  const changes = [];
  const draw = () => {
    mount(root);
    const editable = is('cpo') && p.status === 'Allocated to CPO';
    root.appendChild(head({ title: L('dist.detail', 'Distribution of {id}', { id: p.id }), sub: postName(p.post) + ' · ' + p.cen, crumbs: [{ label: L('dist.title', 'Panel distribution'), href: '/distribution' }, { label: p.id }], sow: '2.12',
      actions: editable ? [btn(L('dist.confirm', 'Confirm distribution'), { kind: 'ok', icon: 'check', onClick: confirmDist })] : [] }));
    root.appendChild(h('div.rms-toolbar', badge(p.status)));
    // Unit-wise demand versus allotted
    const byUnit = fi.map((f) => {
      const mine = rows.filter((r) => plan[r.roll] === f.unit);
      return { unit: f.unit, need: f.total, got: mine.length, cats: ['UR', 'EWS', 'OBC', 'SC', 'ST'].map((c) => mine.filter((r) => r.charged === c).length + ' / ' + f.vac[c]).join(' · '), accepted: p.distribution && p.distribution.accepted && p.distribution.accepted[f.unit] };
    });
    root.appendChild(card(L('dist.byUnit', 'Units and their field indents'), table({ search: false, paged: false, rows: byUnit, columns: [
      { key: 'unit', label: L('col.unit', 'Unit'), value: (u) => unitName(u.unit) },
      { key: 'need', label: L('dist.need', 'Indented'), align: 'right' },
      { key: 'got', label: L('dist.got', 'Allotted'), align: 'right' },
      { key: 'cats', label: L('dist.cats', 'UR · EWS · OBC · SC · ST (allotted / indented)') },
      { key: 'acc', label: L('dist.accepted', 'Accepted by unit'), render: (u) => (u.accepted ? badge('Accepted', date(u.accepted)) : badge('Pending', L('dist.notYet', 'Not yet'))) },
    ] })));
    root.appendChild(card(L('dist.candidates', 'Candidates'), h('div',
      editable ? note(L('dist.autoNote', 'Proposed automatically: candidates in merit order go to units in indent order against the community they are charged to. Change a unit only with a reason; every change is recorded.'), 'info') : null,
      table({ rows, pageSize: 25, columns: [
        { key: 'merit', label: L('pnl.merit', 'Merit'), align: 'right' },
        { key: 'roll', label: L('col.roll', 'Roll no.'), render: (r) => candLink(r.roll) },
        { key: 'charged', label: L('pnl.charged', 'Against') },
        { key: 'hz', label: L('pnl.hz', 'Horizontal'), value: (r) => r.hz || '' },
        { key: 'unit', label: L('col.unit', 'Unit'), value: (r) => unitName(plan[r.roll]), render: (r) => (editable ? h('select.field__input.rms-select-small', { 'aria-label': L('col.unit', 'Unit'), onchange: (e) => change(r, e.target) }, fi.map((f) => h('option', { value: f.unit, selected: plan[r.roll] === f.unit }, unitName(f.unit)))) : unitName(plan[r.roll])) },
      ] }))));
    const hist = (p.distribution && p.distribution.history ? p.distribution.history : []).concat(changes);
    if (hist.length) root.appendChild(card(L('ind.history', 'History'), history(hist)));
  };
  function change(r, sel) {
    const from = plan[r.roll];
    const to = sel.value;
    remarks({ title: L('dist.changeT', 'Move {r} from {a} to {b}', { r: r.roll, a: from, b: to }), label: L('dist.why', 'Reason'), required: true, ok: L('dist.move', 'Move') }).then((t) => {
      if (t === null) { sel.value = from; return; }
      plan[r.roll] = to;
      changes.push({ at: new Date().toISOString(), by: who(), role: role(), action: 'Moved ' + r.roll + ' from ' + from + ' to ' + to, remarks: t });
      log(who(), role(), 'Distribution changed', 'Panel', p.id, r.roll + ': ' + from + ' → ' + to + ' (' + t + ')');
      save();
      draw();
    });
  }
  function confirmDist() {
    otp({ title: L('dist.confirmOtp', 'Confirm distribution of {id}', { id: p.id }) }).then((y) => {
      if (!y) return;
      const now = new Date().toISOString();
      p.status = 'Distributed to units';
      p.distribution = { cpo: 'CPO-SWR', at: now, by: who(), units: plan, accepted: {}, history: changes.concat([{ at: now, by: who(), role: role(), action: 'Distributed', remarks: changes.length ? changes.length + ' manual change(s)' : 'Accepted proposal without change' }]) };
      p.history.push({ at: now, by: who(), role: role(), action: 'Distributed to units', remarks: fi.map((f) => f.unit).join(', ') });
      rows.forEach((r) => { const c = candidate(r.roll); if (c) { c.panel = Object.assign(c.panel || { id: p.id, post: p.post, charged: r.charged, merit: r.merit }, { unit: plan[r.roll] }); c.stage = 'Allotted to unit'; } });
      log(who(), role(), 'Panel distributed to units', 'Panel', p.id, fi.map((f) => f.unit).join(', '));
      save();
      ok(L('dist.doneOk', 'Distributed. Units can now accept their candidates.'));
      draw();
    });
  }
  draw();
});

function unitView(root) {
  const draw = () => {
    mount(root);
    const panels = all('panels').filter((p) => p.status === 'Distributed to units' && p.distribution && Object.keys(p.distribution.units).some((k) => p.distribution.units[k] === MY_UNIT));
    root.appendChild(head({ title: L('dist.unitTitle', 'Candidates allotted to {u}', { u: unitName(MY_UNIT) }), sub: L('dist.unitSub', 'Accept the candidates the CPO has allotted to your unit. Accepted candidates are sent to HRMS for onboarding and appear in Offers & joining.'), sow: '2.12' }));
    if (!panels.length) { root.appendChild(empty(L('dist.unitNone', 'No candidates have been allotted to your unit.'))); return; }
    panels.forEach((p) => {
      const rows = current(p).rows.filter((r) => p.distribution.units[r.roll] === MY_UNIT);
      const acc = p.distribution.accepted && p.distribution.accepted[MY_UNIT];
      root.appendChild(card(p.id + ' · ' + postName(p.post) + ' · ' + p.cen, h('div',
        h('div.rms-toolbar', acc ? badge('Accepted', L('dist.acceptedOn', 'Accepted on {d}', { d: dateTime(acc) })) : btn(L('dist.accept', 'Accept {n} candidate(s)', { n: rows.length }), { kind: 'ok', icon: 'check', onClick: () => accept(p, rows, draw) }),
          p.hrms ? badge('Delivered', L('dist.hrmsRef', 'HRMS onboarding {r}', { r: p.hrms.ref })) : null),
        table({ search: false, rows, columns: [
          { key: 'merit', label: L('pnl.merit', 'Merit'), align: 'right' },
          { key: 'roll', label: L('col.roll', 'Roll no.'), render: (r) => candLink(r.roll) },
          { key: 'cat', label: L('col.category', 'Category') },
          { key: 'charged', label: L('pnl.charged', 'Against') },
          { key: 'hz', label: L('pnl.hz', 'Horizontal'), value: (r) => r.hz || '' },
        ] }))));
    });
  };
  draw();
}

function accept(p, rows, redraw) {
  otp({ title: L('dist.acceptOtp', 'Accept candidates for {u}', { u: unitName(MY_UNIT) }) }).then((y) => {
    if (!y) return;
    const now = new Date().toISOString();
    p.distribution.accepted = p.distribution.accepted || {};
    p.distribution.accepted[MY_UNIT] = now;
    p.distribution.history.push({ at: now, by: who(), role: role(), action: 'Accepted by ' + MY_UNIT, remarks: rows.length + ' candidate(s)' });
    rows.forEach((r) => { const c = candidate(r.roll); if (c) c.stage = 'Accepted by unit'; });
    p.hrms = p.hrms || { pushed: now, status: 'Delivered', records: 0, ref: 'HRMS-OB-' + (40000 + next('hrms')) };
    p.hrms.records += rows.length;
    intLog('HRMS', 'Outbound', 'Onboarding records for ' + rows.length + ' candidate(s) of ' + p.id + ' (' + MY_UNIT + ')');
    log(who(), role(), 'Candidates accepted by unit', 'Panel', p.id, MY_UNIT + ' · ' + rows.length);
    save();
    ok(L('dist.acceptedOk', 'Accepted. Records sent to HRMS onboarding; issue offers in Offers & joining.'));
    redraw();
  });
  void fail;
  void modal;
}
