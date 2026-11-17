// SOW 2.2: Nodal RRB compiles the approved RRB indents of its exam group into the vacancy
// statement of the CEN (Annexure A RRB-wise, Annexure B Railway-wise) and sends it for CEN processing.
import { h, mount } from '../core/h.js';
import { route, go } from '../core/router.js';
import { all, byId, save, log } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, btn, link, note, stats, stat, tabs } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { modal, ok, fail, otp, confirm } from '../ui/dialogs.js';
import { history } from '../ui/timeline.js';
import { showDoc, sigBlock } from '../ui/doc.js';
import { postName, rrbName, zoneName, groupName, sumVac } from './common.js';
import { date } from '../core/format.js';
import { L } from '../i18n.js';

const CATS = ['UR', 'EWS', 'OBC', 'SC', 'ST'];
const HZ = ['ExSM', 'VI', 'HI', 'LD', 'OD', 'MD'];

function compilation() { return all('compilations')[0]; }
function groupIndents(c) { return all('indents').filter((i) => i.level === 'rrb' && i.group === c.group && i.cycle === c.cycle); }

function addUp(list) {
  const vac = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
  const hz = { ExSM: 0, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 };
  list.forEach((i) => { CATS.forEach((c) => { vac[c] += i.vac[c] || 0; }); HZ.forEach((t) => { hz[t] += (i.hz && i.hz[t]) || 0; }); });
  return { vac, hz, total: sumVac(vac) };
}

function statementRows(list, keyOf, labelOf) {
  const keys = list.map(keyOf).filter((x, k, a) => a.indexOf(x) === k).sort();
  const rows = [];
  keys.forEach((k) => {
    const mine = list.filter((i) => keyOf(i) === k);
    const posts = mine.map((i) => i.post).filter((x, j, a) => a.indexOf(x) === j).sort();
    posts.forEach((p, j) => {
      const s = addUp(mine.filter((i) => i.post === p));
      rows.push(h('tr', h('td', j === 0 ? labelOf(k) : ''), h('td', postName(p)), CATS.map((c) => h('td.is-right', String(s.vac[c]))), h('td.is-right', h('strong', String(s.total))), HZ.map((t) => h('td.is-right', String(s.hz[t])))));
    });
  });
  const t = addUp(list);
  rows.push(h('tr.is-total', h('td', h('strong', L('vac.total', 'Total'))), h('td', ''), CATS.map((c) => h('td.is-right', h('strong', String(t.vac[c])))), h('td.is-right', h('strong', String(t.total))), HZ.map((x) => h('td.is-right', h('strong', String(t.hz[x]))))));
  return rows;
}

function statementTable(list, by) {
  const keyOf = by === 'rrb' ? (i) => i.rrb : (i) => i.zone;
  const labelOf = by === 'rrb' ? rrbName : zoneName;
  return h('table.rms-mini',
    h('thead', h('tr', h('th', by === 'rrb' ? L('col.rrb', 'RRB') : L('col.railway', 'Railway')), h('th', L('col.post', 'Post')), CATS.map((c) => h('th.is-right', c)), h('th.is-right', L('vac.total', 'Total')), HZ.map((t) => h('th.is-right', t)))),
    h('tbody', statementRows(list, keyOf, labelOf)));
}

function preview(c) {
  const list = c.indents.map((id) => byId('indents', id)).filter(Boolean);
  if (!list.length) { fail(L('cen.nothing', 'No indents in the compilation yet.')); return; }
  showDoc({
    dialogTitle: L('cen.statement', 'Vacancy statement, {g} {c}', { g: groupName(c.group), c: c.cycle }),
    title: L('cen.docTitle', 'Consolidated vacancy statement for CEN: {g}', { g: groupName(c.group) }),
    office: rrbName(c.nodal) + ' (' + L('cen.nodalFor', 'Nodal RRB for {g}', { g: groupName(c.group) }) + ')',
    ref: c.id,
    date: date(new Date()),
    body: h('div',
      h('h3', L('cen.annexA', 'Annexure A: RRB-wise, post-wise vacancies')),
      statementTable(list, 'rrb'),
      h('h3', L('cen.annexB', 'Annexure B: Railway-wise, post-wise vacancies')),
      statementTable(list, 'zone'),
      h('p', L('cen.docNote', 'Compiled from {n} RRB indents approved by the Nodal RRB. Horizontal reservations (ExSM, PwBD) are included within the community-wise vacancies.', { n: list.length })),
      sigBlock(c.status === 'Sent for CEN processing' ? 'Nikhil Desai' : L('cen.unsigned', 'Not yet signed'), L('cen.sigTitle', 'Chairperson / Nodal officer, {r}', { r: rrbName(c.nodal) }))),
  });
}

route('/cen', null, (root) => {
  let tab = 'compile';
  const draw = () => {
    mount(root);
    const c = compilation();
    const list = groupIndents(c);
    const inComp = c.indents.map((id) => byId('indents', id)).filter(Boolean);
    const ready = list.filter((i) => i.status === 'Approved by Nodal RRB' && c.indents.indexOf(i.id) < 0);
    const waiting = list.filter((i) => /Submitted to RRB|Approved by RRB|Created by CPO|Returned/.test(i.status));
    const locked = c.status === 'Sent for CEN processing';
    const canAct = is('nodal') && !locked;
    root.appendChild(head({
      title: L('cen.title', 'CEN compilation'),
      sub: L('cen.sub', 'The Nodal RRB adds approved RRB indents to the vacancy statement of the CEN, previews Annexures A and B, then locks and sends it for CEN processing.'),
      sow: '2.2',
    }));
    root.appendChild(tabs([{ id: 'compile', label: L('cen.tab.compile', 'Compilation {id}', { id: c.id }) }, { id: 'cens', label: L('cen.tab.cens', 'All CENs'), count: all('cens').length }], tab, (id) => { tab = id; draw(); }));
    if (tab === 'cens') { root.appendChild(censTable()); return; }
    root.appendChild(stats([
      stat(L('cen.received', 'RRB indents received'), list.length),
      stat(L('cen.inComp', 'In this compilation'), inComp.length, { tone: 'ok' }),
      stat(L('cen.ready', 'Approved, not yet added'), ready.length, { tone: ready.length ? 'warn' : null }),
      stat(L('cen.waiting', 'Still with RRBs / returned'), waiting.length, { tone: waiting.length ? 'danger' : null }),
      stat(L('cen.vacancies', 'Vacancies compiled'), addUp(inComp).total, { tone: 'navy' }),
    ]));
    const actions = [];
    if (canAct) {
      actions.push(btn(L('cen.addReady', 'Add approved indents ({n})', { n: ready.length }), { icon: 'plus', disabled: !ready.length, onClick: () => {
        const now = new Date().toISOString();
        ready.forEach((i) => c.indents.push(i.id));
        c.history.push({ at: now, by: who(), role: role(), action: 'Indents added', remarks: ready.map((i) => i.id).join(', ') });
        log(who(), role(), 'Indents added to compilation', 'CEN compilation', c.id, ready.map((i) => i.id).join(', '));
        save();
        ok(L('cen.added', '{n} indent(s) added.', { n: ready.length }));
        draw();
      } }));
    }
    actions.push(btn(L('cen.preview', 'Preview Annexures A & B'), { kind: 'plain', icon: 'doc', onClick: () => preview(c) }));
    if (canAct) actions.push(btn(L('cen.lock', 'Lock & send for CEN processing'), { kind: 'ok', icon: 'send', disabled: !inComp.length, onClick: () => lock(c, waiting, draw) }));
    root.appendChild(card(L('cen.compTitle', '{g}, cycle {c}', { g: groupName(c.group), c: c.cycle }), h('div',
      h('div.rms-toolbar', badge(c.status), h('span.rms-small.rms-muted', L('cen.nodal', 'Nodal RRB: {r}', { r: rrbName(c.nodal) })), c.cen ? h('span.rms-small', L('cen.cenNo', 'CEN: {c}', { c: c.cen })) : null),
      locked ? note(L('cen.lockedNote', 'Locked and sent for CEN processing. Indents in it are now "Compiled for CEN" and cannot change; any further vacancies need an additional indent.'), 'success')
        : (waiting.length ? note(L('cen.waitingNote', '{n} RRB indent(s) of this group are still with RRBs or were returned. You can lock without them; they will need an additional indent.', { n: waiting.length }), 'warning') : null),
      h('div.rms-toolbar', actions))));
    root.appendChild(card(L('cen.rrbIndents', 'RRB indents for {g}, cycle {c}', { g: groupName(c.group), c: c.cycle }), table({
      rows: list,
      exportName: 'rrb-indents-' + c.group + '-' + c.cycle,
      columns: [
        { key: 'id', label: L('col.indent', 'Indent no.'), render: (i) => link(i.id, '/indents/' + i.id) },
        { key: 'rrb', label: L('col.rrb', 'RRB'), value: (i) => rrbName(i.rrb) },
        { key: 'zone', label: L('col.railway', 'Railway'), value: (i) => zoneName(i.zone) },
        { key: 'post', label: L('col.post', 'Post'), value: (i) => postName(i.post) },
        { key: 'total', label: L('col.vacancies', 'Vacancies'), align: 'right' },
        { key: 'status', label: L('col.status', 'Status'), render: (i) => badge(i.status), value: (i) => i.status },
        { key: 'inComp', label: L('cen.col.inComp', 'In compilation'), value: (i) => (c.indents.indexOf(i.id) >= 0 ? L('ui.yes', 'Yes') : ''), render: (i) => (c.indents.indexOf(i.id) >= 0 ? badge('Consolidated', L('ui.yes', 'Yes')) : null) },
        { key: 'act', label: '', action: true, render: (i) => (canAct && c.indents.indexOf(i.id) >= 0 ? btn(L('cen.remove', 'Remove'), { small: true, kind: 'plain', onClick: () => confirm(L('cen.removeQ', 'Remove {id} from the compilation?', { id: i.id })).then((y) => {
          if (!y) return;
          c.indents.splice(c.indents.indexOf(i.id), 1);
          c.history.push({ at: new Date().toISOString(), by: who(), role: role(), action: 'Indent removed', remarks: i.id });
          log(who(), role(), 'Indent removed from compilation', 'CEN compilation', c.id, i.id);
          save();
          draw();
        }) }) : null) },
      ],
      filters: [{ key: 'status', label: L('col.status', 'Status'), options: list.map((i) => i.status).filter((x, k, a) => a.indexOf(x) === k) }],
      onRow: (i) => go('/indents/' + i.id),
    })));
    root.appendChild(card(L('cen.draftA', 'Draft Annexure A (RRB-wise)'), inComp.length ? h('div.rms-table__scroll', statementTable(inComp, 'rrb')) : h('p.rms-muted', L('cen.nothing', 'No indents in the compilation yet.'))));
    root.appendChild(card(L('ind.history', 'History'), history(c.history)));
  };
  draw();
});

function lock(c, waiting, draw) {
  const go2 = () => otp({ title: L('cen.lockSign', 'Sign the vacancy statement'), to: '98XXXXXX63' }).then((y) => {
    if (!y) return;
    const now = new Date().toISOString();
    const cen = byId('cens', 'CEN 01/2027');
    c.status = 'Sent for CEN processing';
    c.cen = cen ? cen.id : 'CEN 01/2027';
    c.history.push({ at: now, by: who(), role: role(), action: 'Locked and sent for CEN processing', remarks: c.indents.length + ' indents' });
    c.indents.forEach((id) => {
      const i = byId('indents', id);
      if (!i) return;
      i.status = 'Compiled for CEN';
      i.cen = c.cen;
      i.updatedAt = now;
      i.history.push({ at: now, by: who(), role: role(), action: 'Compiled for CEN', remarks: c.cen });
      (i.children || []).forEach((k) => { const f = byId('indents', k); if (f) f.cen = c.cen; });
    });
    if (cen) cen.status = 'CEN processing';
    log(who(), role(), 'Vacancy statement locked', 'CEN compilation', c.id, c.cen);
    save();
    ok(L('cen.locked', 'Vacancy statement locked and sent for CEN processing.'));
    draw();
  });
  if (waiting.length) {
    modal({ title: L('cen.lockQ', 'Lock without {n} pending indent(s)?', { n: waiting.length }), body: h('div', h('p', L('cen.lockWarn', 'These indents are not approved yet and will not be part of this CEN:')), h('ul', waiting.map((i) => h('li', i.id + ' · ' + rrbName(i.rrb) + ' · ' + i.status)))), actions: [
      { label: L('cen.lockAnyway', 'Lock anyway'), kind: 'theme', onClick: () => { setTimeout(go2, 50); return true; } },
      { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
    ] });
  } else go2();
}

function censTable() {
  return table({
    rows: all('cens'),
    exportName: 'cens',
    columns: [
      { key: 'id', label: L('col.cen', 'CEN') },
      { key: 'title', label: L('col.title', 'Title') },
      { key: 'nodal', label: L('col.nodal', 'Nodal RRB'), value: (c) => rrbName(c.nodal) },
      { key: 'published', label: L('cen.col.published', 'Published'), nowrap: true, value: (c) => (c.published ? date(c.published) : '—'), sortValue: (c) => c.published || '' },
      { key: 'cbt', label: L('cen.col.cbt', 'CBT'), value: (c) => (c.cbtFrom ? date(c.cbtFrom) + ' – ' + date(c.cbtTo) : '—') },
      { key: 'applicants', label: L('cen.col.applicants', 'Applicants'), align: 'right', value: (c) => c.applicants || '' },
      { key: 'status', label: L('col.status', 'Status'), render: (c) => badge(c.status), value: (c) => c.status },
    ],
  });
}
