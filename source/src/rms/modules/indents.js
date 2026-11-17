// SOW 2.2 & 2.3: indent creation, approval chain (Unit → CPO → RRB → Nodal RRB), versions,
// consolidation into RRB indents, additional / replacement indents and the indent tracker.
import { h, mount, icon } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, data, save, log, insert } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, grid, band } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, fail, remarks, otp, confirm } from '../ui/dialogs.js';
import { history, stepper } from '../ui/timeline.js';
import { showDoc, sigBlock } from '../ui/doc.js';
import { postName, post as getPost, unitName, rrbName, zoneName, groupName, vacTable, sumVac, scheduleSteps } from './common.js';
import { calc, validateIndent, suggestSplit, suggestHorizontal } from '../core/engine.js';
import { date, dateTime } from '../core/format.js';
import { L } from '../i18n.js';

const MY_UNIT = 'SBC';
const MY_ZONE = 'SWR';
const CATS = ['UR', 'EWS', 'OBC', 'SC', 'ST'];
const HZ = ['ExSM', 'VI', 'HI', 'LD', 'OD', 'MD'];

function scopeRows() {
  const list = all('indents');
  switch (role()) {
    case 'unit': return { field: list.filter((i) => i.level === 'field' && i.unit === MY_UNIT) };
    case 'cpo': return { field: list.filter((i) => i.level === 'field' && i.zone === MY_ZONE), rrb: list.filter((i) => i.level === 'rrb' && i.zone === MY_ZONE) };
    case 'nodal': return { rrb: list.filter((i) => i.level === 'rrb' && i.nodal === 'ADI') };
    case 'rrcb': return { rrb: list.filter((i) => i.level === 'rrb'), field: list.filter((i) => i.level === 'field') };
    default: return { rrb: list.filter((i) => i.level === 'rrb' && i.rrb === 'SBC'), field: list.filter((i) => i.level === 'field' && i.rrb === 'SBC') };
  }
}

function from(i) {
  if (i.level === 'field') return unitName(i.unit);
  return (i.external ? zoneName(i.zone) : 'CPO, ' + zoneName(i.zone)) + ' → ' + rrbName(i.rrb);
}

function columns(level) {
  return [
    { key: 'id', label: L('col.indent', 'Indent no.'), render: (i) => link(i.id, '/indents/' + i.id) },
    { key: 'type', label: L('col.type', 'Type'), render: (i) => (i.type === 'Regular' ? L('ind.regular', 'Regular') : badge('Provisional', i.type)) },
    { key: 'post', label: L('col.post', 'Post'), value: (i) => postName(i.post) },
    { key: 'from', label: level === 'field' ? L('col.unit', 'Unit') : L('col.railwayRrb', 'Railway → RRB'), value: from },
    { key: 'cycle', label: L('col.cycle', 'Cycle'), align: 'center' },
    { key: 'total', label: L('col.vacancies', 'Vacancies'), align: 'right' },
    { key: 'status', label: L('col.status', 'Status'), render: (i) => badge(i.status), value: (i) => i.status },
    { key: 'updatedAt', label: L('col.updated', 'Updated'), nowrap: true, value: (i) => date(i.updatedAt), sortValue: (i) => i.updatedAt },
  ];
}

function filters(rows) {
  const st = rows.map((r) => r.status).filter((x, k, a) => a.indexOf(x) === k).sort();
  return [
    { key: 'cycle', label: L('col.cycle', 'Cycle'), options: ['2027', '2026'], value: '2027' },
    { key: 'status', label: L('col.status', 'Status'), options: st },
    { key: 'post', label: L('col.post', 'Post'), options: rows.map((r) => r.post).filter((x, k, a) => a.indexOf(x) === k).map((p) => ({ value: p, label: postName(p) })) },
  ];
}

route('/indents', null, (root) => {
  const s = scopeRows();
  const q = query();
  const avail = [];
  if (s.field && (is('unit', 'cpo'))) avail.push({ id: 'field', label: is('unit') ? L('ind.tab.mine', 'My indents') : L('ind.tab.field', 'Field indents'), count: s.field.length });
  if (s.rrb) avail.push({ id: 'rrb', label: L('ind.tab.rrb', 'RRB indents'), count: s.rrb.length });
  if (is('cpo')) avail.push({ id: 'consolidate', label: L('ind.tab.consolidate', 'Consolidate into RRB indents') });
  if (s.field && !is('unit', 'cpo')) avail.push({ id: 'field', label: L('ind.tab.constituent', 'Constituent field indents'), count: s.field.length });
  let tab = q.tab || avail[0].id;
  root.appendChild(head({
    title: L('ind.title', 'Indents'),
    sub: is('unit') ? L('ind.sub.unit', 'Raise indents for mapped posts, answer CPO returns and follow each indent to the CEN.')
      : is('cpo') ? L('ind.sub.cpo', 'Approve or return field indents, then consolidate them post-wise into RRB indents.')
        : is('nodal') ? L('ind.sub.nodal', 'RRB indents for ALP & Technicians from every RRB. Approve them for compilation into the CEN.')
          : L('ind.sub.rrb', 'RRB indents received from CPOs, with their constituent field indents.'),
    sow: '2.2–2.3',
    actions: is('unit') ? [btn(L('ind.raise', 'Raise indent'), { href: '/indents/new', icon: 'plus' })] : [],
  }));
  if (is('unit', 'cpo')) root.appendChild(card(L('ind.schedule', 'Indenting schedule, cycle 2027'), stepper(scheduleSteps())));
  const wrap = h('div');
  root.appendChild(wrap);
  draw();
  function draw() {
    let body;
    if (tab === 'consolidate') body = consolidate(() => draw());
    else {
      const rows = tab === 'field' ? s.field : s.rrb;
      body = table({ columns: columns(tab), rows, filters: filters(rows), exportName: 'indents-' + tab, onRow: (i) => go('/indents/' + i.id), rowClass: (i) => (/Returned/.test(i.status) ? 'is-flagged' : null), sort: 'updatedAt', dir: -1 });
    }
    mount(wrap, avail.length > 1 ? tabs(avail, tab, (id) => { tab = id; draw(); }) : null, body);
  }
});

// ------------------------------------------------------------------ CPO consolidation
function consolidate(redraw) {
  const maps = data().mappings;
  const zoneUnits = all('units').filter((u) => u.zone === MY_ZONE).map((u) => u.id);
  const field = all('indents').filter((i) => i.level === 'field' && i.zone === MY_ZONE && i.cycle === '2027' && i.type === 'Regular');
  const posts = field.map((i) => i.post).filter((x, k, a) => a.indexOf(x) === k);
  const rows = posts.map((p) => {
    const mapped = zoneUnits.filter((u) => (maps[u] || []).indexOf(p) >= 0);
    const inds = field.filter((i) => i.post === p);
    const approved = inds.filter((i) => i.status === 'Approved by CPO');
    const consolidated = inds.filter((i) => i.status === 'Consolidated');
    const missing = mapped.filter((u) => !inds.some((i) => i.unit === u && (i.status === 'Approved by CPO' || i.status === 'Consolidated')));
    return { post: p, mapped, inds, approved, consolidated, missing };
  }).filter((r) => r.approved.length || r.missing.length);
  return h('div',
    note(L('ind.cons.note', 'An RRB indent for a post can be created only after every unit that operates the post has an approved indent (a nil indent counts). Approved field indents are then locked into the RRB indent.'), 'info'),
    table({ search: false, paged: false, rows, columns: [
      { key: 'post', label: L('col.post', 'Post'), value: (r) => postName(r.post) },
      { key: 'mapped', label: L('col.units', 'Units operating the post'), value: (r) => r.mapped.length, align: 'right' },
      { key: 'approved', label: L('col.approved', 'Approved'), value: (r) => r.approved.length + r.consolidated.length, align: 'right' },
      { key: 'missing', label: L('col.pending', 'Still pending'), render: (r) => (r.missing.length ? h('span', r.missing.map((u) => {
        const i = r.inds.filter((x) => x.unit === u)[0];
        return h('span.rms-nowrap', unitName(u) + ' ', i ? badge(i.status) : badge('Draft', L('ind.notStarted', 'Not started')), h('br'));
      })) : badge('Completed', L('ind.allIn', 'All received'))) },
      { key: 'vac', label: L('col.vacancies', 'Vacancies'), align: 'right', value: (r) => r.approved.reduce((a, i) => a + i.total, 0) },
      { key: 'act', label: '', action: true, render: (r) => (r.consolidated.length ? h('span.rms-small', L('ind.alreadyIn', 'Already in {id}', { id: r.consolidated[0].rrbIndent })) : btn(L('ind.createRrb', 'Create RRB indent'), { small: true, disabled: r.missing.length > 0 || !r.approved.length, title: r.missing.length ? L('ind.waitFor', 'Waiting for {n} unit(s)', { n: r.missing.length }) : '', onClick: () => createRrb(r, redraw) })) },
    ] }));
}

function createRrb(r, redraw) {
  const vac = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
  const hz = { ExSM: 0, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 };
  r.approved.forEach((i) => { CATS.forEach((c) => { vac[c] += i.vac[c]; }); HZ.forEach((t) => { hz[t] += i.hz[t] || 0; }); });
  const total = sumVac(vac);
  const body = h('div', h('p', L('ind.createQ', 'Consolidate {n} approved field indents for {post} into one RRB indent on {rrb}?', { n: r.approved.length, post: postName(r.post), rrb: rrbName('SBC') })),
    vacTable(r.approved.map((i) => ({ label: i.id + ' · ' + unitName(i.unit), vac: i.vac, hz: i.hz })).concat([{ label: L('vac.total', 'Total'), vac, hz, flag: true }])));
  modal({ title: L('ind.createRrb', 'Create RRB indent'), body, actions: [
    { label: L('ind.create', 'Create'), onClick: () => {
      const seq = all('indents').filter((i) => i.level === 'rrb' && i.zone === MY_ZONE && i.cycle === '2027').length + 1;
      const id = '27' + MY_ZONE + String(seq).replace(/^(\d)$/, '00$1').replace(/^(\d\d)$/, '0$1');
      const now = new Date().toISOString();
      const p = getPost(r.post);
      const ind = { id, level: 'rrb', cycle: '2027', group: p.group, post: r.post, zone: MY_ZONE, cpo: 'CPO-' + MY_ZONE, rrb: 'SBC', nodal: p.nodal, type: 'Regular', children: r.approved.map((i) => i.id), vac, hz, total, status: 'Created by CPO', cen: null, createdAt: now, updatedAt: now, signed: null,
        versions: [{ v: 1, at: now, by: who(), total, vac: Object.assign({}, vac), hz: Object.assign({}, hz), note: 'Consolidated from ' + r.approved.length + ' field indent(s)' }],
        history: [{ at: now, by: who(), role: role(), action: 'Created RRB indent', remarks: 'Consolidated ' + r.approved.map((i) => i.id).join(', ') }] };
      r.approved.forEach((i) => { i.status = 'Consolidated'; i.rrbIndent = id; i.updatedAt = now; i.history.push({ at: now, by: who(), role: role(), action: 'Consolidated', remarks: 'Into RRB indent ' + id }); });
      insert('indents', ind);
      log(who(), role(), 'Created RRB indent', 'Indent', id, postName(r.post) + ' · ' + total);
      save();
      ok(L('ind.created', 'RRB indent {id} created. Sign and submit it to the RRB.', { id }));
      go('/indents/' + id);
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
  void redraw;
}

// ------------------------------------------------------------------ detail
function flowSteps(i) {
  const order = i.level === 'field'
    ? [['Draft', L('flow.draft', 'Prepared')], ['Submitted to CPO', L('flow.cpo', 'With CPO')], ['Approved by CPO', L('flow.cpoOk', 'Approved by CPO')], ['Consolidated', L('flow.cons', 'In RRB indent')]]
    : [['Created by CPO', L('flow.created', 'Created by CPO')], ['Submitted to RRB', L('flow.rrb', 'With RRB')], ['Approved by RRB', L('flow.rrbOk', 'Approved by RRB')], ['Approved by Nodal RRB', L('flow.nodalOk', 'Approved by Nodal RRB')], ['Compiled for CEN', L('flow.cen', 'In CEN')]];
  const norm = { 'Resubmitted to CPO': 'Submitted to CPO', 'Returned by CPO': 'Draft', 'Returned to CPO': 'Created by CPO', 'Returned by Nodal RRB': 'Approved by RRB' };
  const cur = norm[i.status] || i.status;
  let idx = 0;
  order.forEach((o, k) => { if (o[0] === cur) idx = k; });
  const returned = /Returned/.test(i.status);
  return order.map((o, k) => ({ label: o[1], state: k < idx ? 'done' : (k === idx ? (returned ? 'blocked' : (k === order.length - 1 ? 'done' : 'active')) : 'todo'), note: k === idx && returned ? i.status : '' }));
}

function calcTable(i) {
  const c = calc(i.inputs);
  const v = i.inputs;
  const row = (no, label, val, strong) => h('tr' + (strong ? '.is-total' : ''), h('td', no), h('td', label), h('td.is-right' + (strong ? '.is-total' : ''), String(val)));
  return h('div.rms-table__scroll', h('table.rms-mini',
    h('thead', h('tr', h('th', L('col.sno', 'S.No.')), h('th', L('col.item', 'Item')), h('th.is-right', L('col.value', 'Value')))),
    h('tbody',
      row('', L('calc.sanctioned', 'Sanctioned strength (DR quota) / men on roll'), v.sanctioned + ' / ' + v.onRoll),
      row('1', L('calc.dr', 'Direct-recruitment vacancy in the indenting grade'), c.dr),
      row('2', L('calc.resultant', 'Resultant DRQ vacancy from higher-grade vacancies'), v.resultant || 0),
      row('3', L('calc.prq', 'Unfilled promotional quota diverted to DRQ'), v.prq || 0),
      row('4', L('calc.ldce', 'Unfilled LDCE vacancy diverted to DRQ'), v.ldce || 0),
      row('5–6', L('calc.conre', 'DR vacancy of Construction / RE'), (v.con || 0) + (v.re || 0)),
      row('7', L('calc.anticipated', 'Anticipated DRQ vacancy, recruitment and higher grades (3 years)'), v.anticipated || 0),
      row('8', L('calc.unforeseen', 'Unforeseen DRQ vacancy (average of past 3 years)'), v.unforeseen || 0),
      row('9', L('calc.subtotal', 'Subtotal (1 to 8)'), c.subtotal, true),
      row('10', L('calc.nonmat', 'Non-materialisation allowance at {p}% (capped at 30%)', { p: c.nonMatPct }), c.nonMat),
      row('11', L('calc.total', 'Total DRQ vacancy (9 + 10)'), c.total, true),
      row('', L('calc.less', 'Less: in training {a}, panels on hand {b}, outstanding indents {c}, GDCE {d}, compassionate/sports {e}', { a: v.inTraining || 0, b: v.panelsOnHand || 0, c: v.outstanding || 0, d: v.gdce || 0, e: v.compassionate || 0 }), '− ' + c.deductions),
      row('12', L('calc.balance', 'Vacancy to be indented'), c.balance, true))));
}

function actionsFor(i, rerender) {
  const r = role();
  const a = [];
  const editable = i.level === 'field' && r === 'unit' && i.unit === MY_UNIT && (i.status === 'Draft' || i.status === 'Returned by CPO');
  if (editable) {
    a.push(btn(L('ui.edit', 'Edit'), { kind: 'plain', icon: 'edit', href: '/indents/' + i.id + '/edit' }));
    a.push(btn(i.status === 'Draft' ? L('ind.submitCpo', 'Sign & submit to CPO') : L('ind.resubmit', 'Sign & resubmit to CPO'), { icon: 'send', onClick: () => submitToCpo(i, rerender) }));
  }
  if (r === 'cpo' && i.level === 'field' && i.zone === MY_ZONE && /Submitted to CPO|Resubmitted to CPO/.test(i.status)) {
    a.push(btn(L('ui.approve', 'Approve'), { kind: 'ok', icon: 'check', onClick: () => decide(i, 'Approved by CPO', false, rerender) }));
    a.push(btn(L('ind.returnUnit', 'Return to unit'), { kind: 'plain', icon: 'back', onClick: () => decide(i, 'Returned by CPO', true, rerender) }));
  }
  if (r === 'cpo' && i.level === 'rrb' && i.zone === MY_ZONE && /Created by CPO|Returned to CPO/.test(i.status)) {
    a.push(btn(L('ind.submitRrb', 'Sign & submit to RRB'), { icon: 'send', onClick: () => signAndMove(i, 'Submitted to RRB', L('ind.toRrb', 'Submitted to {rrb}', { rrb: rrbName(i.rrb) }), rerender) }));
  }
  if (r === 'ms' && i.level === 'rrb' && i.rrb === 'SBC' && i.status === 'Submitted to RRB') {
    a.push(btn(L('ind.approveFwd', 'Approve & forward to Nodal RRB'), { kind: 'ok', icon: 'check', onClick: () => decide(i, 'Approved by RRB', false, rerender) }));
    a.push(btn(L('ind.returnCpo', 'Return to CPO'), { kind: 'plain', icon: 'back', onClick: () => decide(i, 'Returned to CPO', true, rerender) }));
  }
  if (r === 'nodal' && i.level === 'rrb' && i.nodal === 'ADI' && i.status === 'Approved by RRB') {
    a.push(btn(L('ind.approveNodal', 'Approve for compilation'), { kind: 'ok', icon: 'check', onClick: () => decide(i, 'Approved by Nodal RRB', false, rerender) }));
    a.push(btn(L('ind.returnRrb', 'Return to RRB'), { kind: 'plain', icon: 'back', onClick: () => decide(i, 'Returned by Nodal RRB', true, rerender) }));
  }
  if (i.status === 'Draft' && editable) a.push(btn(L('ind.delete', 'Delete draft'), { kind: 'plain', onClick: () => confirm(L('ind.deleteQ', 'Delete draft indent {id}?', { id: i.id })).then((y) => { if (y) { all('indents').splice(all('indents').indexOf(i), 1); log(who(), role(), 'Draft deleted', 'Indent', i.id, ''); save(); go('/indents'); } }) }));
  a.push(btn(L('ui.print', 'Print'), { kind: 'plain', icon: 'print', onClick: () => printIndent(i) }));
  return a;
}

function decide(i, status, needRemarks, rerender) {
  const neg = /Returned/.test(status);
  remarks({ title: neg ? L('ind.returnTitle', 'Return indent {id}', { id: i.id }) : L('ind.approveTitle', 'Approve indent {id}', { id: i.id }), required: needRemarks, label: neg ? L('ind.returnWhy', 'What needs to be corrected') : L('ind.approveRemarks', 'Remarks (optional)'), ok: neg ? L('ind.return', 'Return') : L('ui.approve', 'Approve'), kind: neg ? 'danger' : 'ok' }).then((text) => {
    if (text === null) return;
    const now = new Date().toISOString();
    i.status = status;
    i.updatedAt = now;
    i.history.push({ at: now, by: who(), role: role(), action: status, remarks: text || '' });
    log(who(), role(), status, 'Indent', i.id, text || '');
    save();
    ok(L('ind.updated', 'Indent {id}: {s}.', { id: i.id, s: status }));
    rerender();
  });
}

function signAndMove(i, status, msg, rerender) {
  otp({ title: L('ind.esign', 'Aadhaar e-Sign (demo)'), to: '98XXXXXX' + String(i.total).slice(-2) }).then((okd) => {
    if (!okd) return;
    const now = new Date().toISOString();
    i.status = status;
    i.updatedAt = now;
    i.signed = { by: who(), at: now, mode: 'Aadhaar e-Sign (demo)' };
    i.history.push({ at: now, by: who(), role: role(), action: status, remarks: L('ind.signedNote', 'Digitally signed') });
    log(who(), role(), status, 'Indent', i.id, 'e-signed');
    save();
    ok(msg);
    rerender();
  });
}

function submitToCpo(i, rerender) {
  const p = getPost(i.post);
  const res = validateIndent(i, i.inputs.sanctioned);
  if (res.problems.length) { fail(res.problems[0].text); return; }
  if (res.warnings.length && !i.roster) { fail(L('ind.needRoster', 'Add the roster justification in the indent before submitting (open Edit).')); return; }
  const resub = i.status === 'Returned by CPO';
  otp({ title: L('ind.esign', 'Aadhaar e-Sign (demo)'), to: '98XXXXXX45' }).then((okd) => {
    if (!okd) return;
    const now = new Date().toISOString();
    const last = i.versions[i.versions.length - 1];
    const changed = !last || last.total !== i.total || CATS.some((c) => last.vac[c] !== i.vac[c]) || HZ.some((t) => (last.hz[t] || 0) !== (i.hz[t] || 0));
    if (resub && changed) i.versions.push({ v: i.versions.length + 1, at: now, by: who(), total: i.total, vac: Object.assign({}, i.vac), hz: Object.assign({}, i.hz), note: L('ind.resubVer', 'Revised after CPO return') });
    i.status = resub ? 'Resubmitted to CPO' : 'Submitted to CPO';
    i.updatedAt = now;
    i.signed = { by: who(), at: now, mode: 'Aadhaar e-Sign (demo)' };
    i.history.push({ at: now, by: who(), role: role(), action: i.status, remarks: i.roster || '' });
    log(who(), role(), i.status, 'Indent', i.id, p.designation + ' · ' + i.total);
    save();
    ok(L('ind.sent', 'Indent {id} sent to the CPO.', { id: i.id }));
    rerender();
  });
}

route('/indents/:id', null, (root, prm) => {
  const draw = () => {
    const i = byId('indents', prm.id);
    mount(root);
    if (!i) { root.appendChild(head({ title: L('ind.notFound', 'Indent not found') })); return; }
    const p = getPost(i.post);
    root.appendChild(head({
      title: L('ind.detailTitle', 'Indent {id}', { id: i.id }),
      sub: postName(i.post) + ' · ' + from(i) + ' · ' + L('ind.cycle', 'cycle {c}', { c: i.cycle }),
      crumbs: [{ label: L('ind.title', 'Indents'), href: '/indents' }, { label: i.id }],
      actions: actionsFor(i, draw),
      sow: i.type === 'Regular' ? '2.2' : '2.3',
    }));
    root.appendChild(h('div.rms-toolbar', badge(i.status), i.type !== 'Regular' ? badge('Provisional', i.type + (i.parent ? ' · ' + L('ind.against', 'against {p}', { p: i.parent }) : '')) : null, i.signed ? h('span.rms-small.rms-muted', icon('shield', 14), ' ' + L('ind.signedBy', 'Signed by {n} on {d}', { n: i.signed.by, d: dateTime(i.signed.at) })) : null));
    root.appendChild(stepper(flowSteps(i)));
    const last = i.history[i.history.length - 1];
    if (/Returned/.test(i.status) && last) root.appendChild(note(h('div', h('p', h('strong', i.status + ': ')), h('p', last.remarks)), 'danger'));
    const res = validateIndent(i, i.inputs ? i.inputs.sanctioned : null);
    root.appendChild(grid(2, [
      card(L('ind.details', 'Indent details'), kv([
        [L('col.post', 'Post'), link(postName(i.post), '/posts/' + i.post)],
        [L('col.examGroup', 'Exam group'), groupName(p.group)],
        [i.level === 'field' ? L('col.unit', 'Unit') : L('col.railway', 'Railway'), i.level === 'field' ? unitName(i.unit) : zoneName(i.zone)],
        [L('col.rrb', 'RRB'), rrbName(i.rrb)],
        [L('col.nodal', 'Nodal RRB'), rrbName(i.nodal)],
        [L('col.medStd', 'Medical std.'), p.med],
        [L('col.levelPay', 'Level'), String(p.level)],
        [L('col.type', 'Type'), i.type],
        i.parent ? [L('ind.parent', 'Original indent'), link(i.parent, '/indents/' + i.parent)] : null,
        i.rrbIndent ? [L('ind.inRrb', 'Consolidated into'), link(i.rrbIndent, '/indents/' + i.rrbIndent)] : null,
        i.cen ? [L('col.cen', 'CEN'), i.cen] : null,
        [L('col.created', 'Created'), dateTime(i.createdAt)],
      ], 2)),
      card(L('ind.checks', 'Validation'), h('div',
        res.problems.length ? note(h('ul', res.problems.map((x) => h('li', x.text))), 'danger') : note(L('ind.noProblems', 'Break-up adds up, no negative values, within sanctioned strength.'), 'success'),
        res.warnings.length ? note(h('div', h('p', L('ind.rosterWarn', 'Differs from the roster share:')), h('ul', res.warnings.map((x) => h('li', x.text))), i.roster ? h('p', h('strong', L('ind.justification', 'Justification: ')), i.roster) : null), 'warning') : null,
        i.remarks ? h('p.rms-small', h('strong', L('ui.remarks', 'Remarks') + ': '), i.remarks) : null)),
    ]));
    if (i.level === 'field' && i.inputs && i.type === 'Regular') root.appendChild(card(L('ind.calc', 'Vacancy calculation'), calcTable(i)));
    const vrows = i.level === 'rrb' && i.children && i.children.length
      ? i.children.map((id) => byId('indents', id)).filter(Boolean).map((c) => ({ label: h('span', link(c.id, '/indents/' + c.id), ' · ' + unitName(c.unit)), vac: c.vac, hz: c.hz })).concat([{ label: L('vac.total', 'Total'), vac: i.vac, hz: i.hz, flag: true }])
      : [{ label: L('ind.thisIndent', 'This indent'), vac: i.vac, hz: i.hz, flag: true }];
    root.appendChild(card(L('ind.breakup', 'Community-wise break-up and horizontal reservation'), h('div', vacTable(vrows, { head: i.level === 'rrb' ? L('col.fieldIndent', 'Field indent') : '' }), h('p.rms-small.rms-muted', L('ind.hzNote', 'ExSM and PwBD (VI, HI, LD, OD, MD) are horizontal: they sit inside the community-wise numbers.')))));
    root.appendChild(grid(2, [
      card(L('ind.versions', 'Versions'), versions(i)),
      card(L('ind.history', 'History'), history(i.history)),
    ]));
  };
  draw();
});

function versions(i) {
  return h('div.rms-table__scroll', h('table.rms-mini',
    h('thead', h('tr', h('th', 'v'), h('th', L('col.date', 'Date')), h('th', L('col.by', 'By')), CATS.map((c) => h('th.is-right', c)), h('th.is-right', L('vac.total', 'Total')), h('th', L('col.note', 'Note')))),
    h('tbody', i.versions.slice().reverse().map((v, k, arr) => {
      const prev = arr[k + 1];
      return h('tr', h('td', 'v' + v.v), h('td.rms-nowrap', { title: dateTime(v.at) }, date(v.at)), h('td.rms-nowrap', v.by), CATS.map((c) => h('td.is-right', { class: prev && prev.vac[c] !== v.vac[c] ? 'rms-changed' : null }, String(v.vac[c]))), h('td.is-right', String(v.total)), h('td', v.note));
    }))));
}

function printIndent(i) {
  const p = getPost(i.post);
  const c = i.inputs ? calc(i.inputs) : null;
  showDoc({
    title: L('ind.docTitle', 'Indent on RRB for recruitment of Group C post'),
    dialogTitle: L('ind.detailTitle', 'Indent {id}', { id: i.id }),
    office: i.level === 'field' ? unitName(i.unit) + ', ' + zoneName(i.zone) : 'Personnel Branch, ' + zoneName(i.zone),
    ref: i.id,
    date: date(i.updatedAt),
    body: h('div',
      h('table', h('tbody',
        h('tr', h('th', L('col.post', 'Post')), h('td', p.designation), h('th', L('col.levelPay', 'Level')), h('td', String(p.level))),
        h('tr', h('th', L('col.dept', 'Department')), h('td', p.dept + ' / ' + p.sub), h('th', L('col.medStd', 'Medical std.')), h('td', p.med)),
        h('tr', h('th', L('col.rrb', 'RRB')), h('td', rrbName(i.rrb)), h('th', L('col.nodal', 'Nodal RRB')), h('td', rrbName(i.nodal))),
        h('tr', h('th', L('col.eq', 'Essential qualification')), h('td', { colspan: '3' }, p.eq)))),
      c ? h('p', L('ind.docCalc', 'Vacancies assessed: subtotal {s}, non-materialisation {n} ({p}%), total {t}, less commitments {d}, vacancy to be indented {b}.', { s: c.subtotal, n: c.nonMat, p: c.nonMatPct, t: c.total, d: c.deductions, b: c.balance })) : null,
      h('table', h('thead', h('tr', CATS.map((x) => h('th', x)), h('th', L('vac.total', 'Total')), HZ.map((t) => h('th', t)))), h('tbody', h('tr', CATS.map((x) => h('td', String(i.vac[x]))), h('td', String(i.total)), HZ.map((t) => h('td', String(i.hz[t] || 0)))))),
      i.roster ? h('p', h('strong', L('ind.justification', 'Justification: ')), i.roster) : null,
      i.signed ? sigBlock(i.signed.by, i.level === 'field' ? L('ind.sigUnit', 'Indenting officer') : L('ind.sigCpo', 'For Principal Chief Personnel Officer')) : h('p.rms-muted', L('ind.unsigned', 'Not yet signed.'))),
  });
}

// ------------------------------------------------------------------ create / edit
route('/indents/new', ['unit'], (root) => editor(root, null));
route('/indents/:id/edit', ['unit'], (root, prm) => editor(root, byId('indents', prm.id)));

function editor(root, existing) {
  const q = query();
  const mapped = data().mappings[MY_UNIT] || [];
  const isNew = !existing;
  const st = existing ? JSON.parse(JSON.stringify(existing)) : { type: q.type || 'Regular', parent: q.parent || '', post: q.post || '', vac: { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 }, hz: { ExSM: 0, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }, inputs: null, roster: '', remarks: '' };
  if (existing && !(existing.status === 'Draft' || existing.status === 'Returned by CPO')) { root.appendChild(head({ title: L('ind.locked', 'This indent can no longer be edited') })); return; }
  root.appendChild(head({ title: isNew ? L('ind.newTitle', 'Raise indent') : L('ind.editTitle', 'Edit indent {id}', { id: existing.id }), sub: unitName(MY_UNIT) + ' · ' + L('ind.cycle', 'cycle {c}', { c: '2027' }), crumbs: [{ label: L('ind.title', 'Indents'), href: '/indents' }, { label: isNew ? L('ind.new', 'New') : existing.id }], sow: '2.2–2.3' }));
  if (existing && existing.status === 'Returned by CPO') {
    const last = existing.history[existing.history.length - 1];
    root.appendChild(note(h('div', h('p', h('strong', L('ind.returnedSays', 'Returned by CPO:'))), h('p', last ? last.remarks : '')), 'danger'));
  }
  const body = h('div');
  root.appendChild(body);
  const regFor = (pid) => all('vacancy').filter((v) => v.unit === MY_UNIT && v.post === pid)[0];

  const fPost = field({ name: 'post', type: 'select', label: L('col.post', 'Post'), required: true, value: st.post, readonly: !isNew, options: mapped.map((p) => ({ value: p, label: postName(p) })), onChange: (v) => { st.post = v; st.inputs = null; draw(); } });
  const fType = field({ name: 'type', type: 'radio', label: L('col.type', 'Type'), value: st.type, readonly: !isNew, options: [{ value: 'Regular', label: L('ind.regular', 'Regular') }, { value: 'Additional', label: L('ind.additional', 'Additional (after CEN closure, with Board approval)') }, { value: 'Replacement', label: L('ind.replacement', 'Replacement (non-joining)') }], onChange: (v) => { st.type = v; draw(); } });
  root.insertBefore(card(L('ind.step1', '1. Post and type'), form([fPost, fType], 2).node), body);

  function draw() {
    mount(body);
    if (!st.post) { body.appendChild(note(L('ind.pickPost', 'Pick a mapped post to continue. Posts not in the list must be mapped first (Post master & mapping).'), 'info')); return; }
    const p = getPost(st.post);
    if (!st.inputs) {
      const r = regFor(st.post) || { sanctioned: 0, onRoll: 0, inTraining: 0, panelsOnHand: 0, outstanding: 0, resultant: 0, anticipated: 0, unforeseen: 0, nonMatPct: 0 };
      st.inputs = { sanctioned: r.sanctioned, onRoll: r.onRoll, resultant: r.resultant || 0, prq: 0, ldce: 0, con: 0, re: 0, anticipated: r.anticipated || 0, unforeseen: r.unforeseen || 0, nonMatPct: r.nonMatPct || 0, inTraining: r.inTraining || 0, panelsOnHand: r.panelsOnHand || 0, outstanding: r.outstanding || 0, gdce: 0, compassionate: 0 };
    }
    let parentField = null;
    if (st.type === 'Replacement' && q.offer && !st.prefilled) {
      const o = byId('offers', q.offer);
      const pnl = o ? byId('panels', o.panel) : null;
      const row = pnl ? pnl.versions[pnl.versions.length - 1].rows.filter((r) => r.roll === o.roll)[0] : null;
      if (row) { st.vac = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 }; st.vac[row.charged] = 1; st.remarks = st.remarks || ('Replacement for ' + o.roll + ' (offer ' + o.id + ', not joined)'); }
      st.prefilled = true;
    }
    if (st.type !== 'Regular') {
      const parents = all('indents').filter((i) => i.level === 'field' && i.unit === MY_UNIT && i.post === st.post && i.type === 'Regular' && i.status === 'Consolidated');
      parentField = field({ name: 'parent', type: 'select', label: L('ind.parent', 'Original indent'), required: true, value: st.parent || '', options: parents.map((x) => ({ value: x.id, label: x.id + ' (' + x.cycle + ', ' + x.total + ')' })), onChange: (v) => { st.parent = v; } });
      body.appendChild(card(L('ind.step1b', 'Original indent'), h('div', parents.length ? parentField.node : note(L('ind.noParent', 'There is no consolidated indent for this post yet, so an {t} indent is not possible.', { t: st.type.toLowerCase() }), 'warning'))));
    }
    // 2. vacancy calculation
    const out = {};
    const live = h('div');
    if (st.type === 'Regular') {
      const inputs = [
        ['sanctioned', L('calc.f.sanctioned', 'Sanctioned strength (DR quota)')], ['onRoll', L('calc.f.onRoll', 'Men on roll (excluding trainees)')],
        ['resultant', L('calc.resultant', 'Resultant DRQ vacancy from higher-grade vacancies')], ['prq', L('calc.prq', 'Unfilled promotional quota diverted to DRQ')], ['ldce', L('calc.ldce', 'Unfilled LDCE vacancy diverted to DRQ')],
        ['con', L('calc.f.con', 'DR vacancy of Construction')], ['re', L('calc.f.re', 'DR vacancy of RE')], ['anticipated', L('calc.anticipated', 'Anticipated DRQ vacancy, recruitment and higher grades (3 years)')], ['unforeseen', L('calc.unforeseen', 'Unforeseen DRQ vacancy (average of past 3 years)')],
        ['nonMatPct', L('calc.f.nonMat', 'Non-materialisation % of past panels (max 30)')], ['inTraining', L('calc.f.training', 'Less: candidates under training')], ['panelsOnHand', L('calc.f.panels', 'Less: panel papers on hand')], ['outstanding', L('calc.f.outstanding', 'Less: outstanding indents on RRB')],
        ['gdce', L('calc.f.gdce', 'Less: reserved for GDCE')], ['compassionate', L('calc.f.compassionate', 'Less: compassionate, sports, cultural quota')],
      ];
      const tbody = h('tbody', inputs.map((x) => {
        const id = 'calc-' + x[0];
        const inp = h('input.field__input.rms-num', { id, type: 'number', min: '0', max: x[0] === 'nonMatPct' ? '30' : null, value: String(st.inputs[x[0]] || 0), oninput: (e) => { st.inputs[x[0]] = Math.max(0, Number(e.target.value) || 0); refresh(); } });
        return h('tr', h('td', h('label', { for: id }, x[1])), h('td.is-right', inp));
      }));
      body.appendChild(card(L('ind.step2', '2. Vacancy calculation'), h('div.rms-split', h('div.rms-split__main', h('div.rms-table__scroll', h('table.rms-mini.rms-calc', h('thead', h('tr', h('th', L('col.item', 'Item')), h('th.is-right', L('col.value', 'Value')))), tbody))), h('aside.rms-split__side', live, h('p.rms-small.rms-muted', L('ind.prefilled', 'Prefilled from the vacancy register; changes here apply to this indent only.'))))));
    }
    // 3. break-up
    const brk = h('div');
    body.appendChild(card(L('ind.step3', '3. Community-wise break-up'), brk, { actions: [btn(L('ind.useRoster', 'Fill from roster'), { small: true, kind: 'plain', onClick: () => { st.vac = suggestSplit(currentTotal()); st.hz = suggestHorizontal(currentTotal(), p.level, { VI: !!p.pwbd.VI, HI: !!p.pwbd.HI, LD: !!p.pwbd.LD, MD: !!p.pwbd.MD }); drawBreakup(); refresh(); } })] }));
    const vbox = h('div');
    const fRoster = field({ name: 'roster', type: 'textarea', label: L('ind.rosterField', 'Roster point / backlog justification (needed when the split differs from the roster)'), value: st.roster, onChange: (v) => { st.roster = v; } });
    const fRemarks = field({ name: 'remarks', type: 'textarea', label: L('ui.remarks', 'Remarks'), value: st.remarks, onChange: (v) => { st.remarks = v; } });
    const fDoc = field({ name: 'doc', type: 'file', label: L('ind.attach', 'Attach roster register extract (optional)'), demoName: 'roster-register-extract.pdf', value: st.doc, onChange: (v) => { st.doc = v; } });
    body.appendChild(card(L('ind.step4', '4. Checks and remarks'), h('div', vbox, form([fRoster, fRemarks, fDoc], 1).node)));
    body.appendChild(h('div.rms-toolbar',
      btn(L('ind.saveDraft', 'Save draft'), { kind: 'plain', onClick: () => persist(false) }),
      btn(isNew || existing.status === 'Draft' ? L('ind.saveSubmit', 'Save, sign & submit to CPO') : L('ind.resubmitBtn', 'Save, sign & resubmit to CPO'), { icon: 'send', onClick: () => persist(true) }),
      btn(L('ui.cancel', 'Cancel'), { kind: 'plain', href: existing ? '/indents/' + existing.id : '/indents' })));

    function currentTotal() { return st.type === 'Regular' ? calc(st.inputs).balance : sumVac(st.vac); }
    function drawBreakup() {
      const row = (list, obj, isHz) => h('tr', list.map((k) => {
        const id = 'brk-' + k;
        const unsuitable = isHz && k !== 'ExSM' && !p.pwbd[k];
        return h('td', h('label.rms-small', { for: id }, k), h('input.field__input.rms-num', { id, type: 'number', min: '0', value: String(obj[k] || 0), disabled: unsuitable, title: unsuitable ? L('ind.notSuitable', 'Post not identified as suitable for {k}', { k }) : null, oninput: (e) => { obj[k] = Math.max(0, Number(e.target.value) || 0); refresh(); } }));
      }));
      mount(brk, h('div.rms-table__scroll', h('table.rms-mini', h('tbody', row(CATS, st.vac, false), row(HZ, st.hz, true)))), h('p.rms-small.rms-muted', L('ind.hzNote', 'ExSM and PwBD (VI, HI, LD, OD, MD) are horizontal: they sit inside the community-wise numbers.')));
    }
    function refresh() {
      const total = currentTotal();
      if (st.type === 'Regular') {
        const c = calc(st.inputs);
        mount(live, h('div.rms-stats', h('div.rms-stat', h('span.rms-stat__value', String(c.subtotal)), h('span.rms-stat__label', L('calc.subtotal', 'Subtotal (1 to 8)'))), h('div.rms-stat', h('span.rms-stat__value', String(c.nonMat)), h('span.rms-stat__label', L('calc.nonmatShort', 'Non-materialisation ({p}%)', { p: c.nonMatPct }))), h('div.rms-stat.rms-stat--navy', h('span.rms-stat__value', String(c.balance)), h('span.rms-stat__label', L('calc.balance', 'Vacancy to be indented')))));
      }
      const probe = { vac: st.vac, hz: st.hz, total };
      const res = validateIndent(probe, st.type === 'Regular' ? st.inputs.sanctioned : null);
      out.res = res;
      mount(vbox,
        h('p', L('ind.splitTotal', 'Break-up total {a} of {b} vacancies.', { a: sumVac(st.vac), b: total })),
        res.problems.length ? note(h('ul', res.problems.map((x) => h('li', x.text))), 'danger') : note(L('ind.noProblems', 'Break-up adds up, no negative values, within sanctioned strength.'), 'success'),
        res.warnings.length ? note(h('ul', res.warnings.map((x) => h('li', x.text))), 'warning') : null);
    }
    drawBreakup();
    refresh();

    function persist(submit) {
      if (!fPost.validate()) return;
      if (parentField && !parentField.validate()) return;
      const total = currentTotal();
      if (submit) {
        if (out.res.problems.length) { fail(out.res.problems[0].text); return; }
        if (out.res.warnings.length && !st.roster.trim()) { fRoster.validate(); fail(L('ind.needRoster2', 'The break-up differs from the roster: add the justification before submitting.')); return; }
        if (!total) { fail(L('ind.zero', 'Vacancy to be indented is 0. Save as a nil indent from the register instead.')); return; }
      }
      const now = new Date().toISOString();
      let ind = existing ? byId('indents', existing.id) : null;
      if (!ind) {
        const pp = getPost(st.post);
        let id;
        if (st.type === 'Replacement') id = st.parent + '_R' + (all('indents').filter((x) => x.parent === st.parent && x.type === 'Replacement').length + 1);
        else if (st.type === 'Additional') id = st.parent + '_A' + (all('indents').filter((x) => x.parent === st.parent && x.type === 'Additional').length + 1);
        else {
          let n = all('indents').filter((x) => x.level === 'field' && x.unit === MY_UNIT && x.cycle === '2027').length + 1;
          id = '27' + MY_UNIT + ('00' + n).slice(-3);
          while (byId('indents', id)) { n++; id = '27' + MY_UNIT + ('00' + n).slice(-3); }
        }
        ind = { id, level: 'field', cycle: st.parent && byId('indents', st.parent) ? byId('indents', st.parent).cycle : '2027', group: pp.group, post: st.post, unit: MY_UNIT, zone: MY_ZONE, cpo: 'CPO-' + MY_ZONE, rrb: 'SBC', nodal: pp.nodal, type: st.type, parent: st.parent || null, createdAt: now, versions: [], history: [{ at: now, by: who(), role: role(), action: 'Created', remarks: '' }], status: 'Draft', rrbIndent: null, cen: null };
        insert('indents', ind);
        log(who(), role(), 'Created', 'Indent', id, postName(st.post));
        if (q.offer) { const o = byId('offers', q.offer); if (o) { o.replacement = id; ind.remarks = ind.remarks || ('Replacement for non-joining under offer ' + o.id); } }
      }
      ind.inputs = Object.assign({}, st.inputs);
      ind.vac = Object.assign({}, st.vac);
      ind.hz = Object.assign({}, st.hz);
      ind.total = total;
      ind.roster = st.roster;
      ind.remarks = st.remarks;
      ind.doc = st.doc;
      ind.updatedAt = now;
      if (!ind.versions.length) ind.versions.push({ v: 1, at: now, by: who(), total, vac: Object.assign({}, st.vac), hz: Object.assign({}, st.hz), note: 'Created' });
      else if (ind.status === 'Draft') Object.assign(ind.versions[ind.versions.length - 1], { at: now, total, vac: Object.assign({}, st.vac), hz: Object.assign({}, st.hz) });
      save();
      if (!submit) { ok(L('ind.saved', 'Draft {id} saved.', { id: ind.id })); go('/indents/' + ind.id); return; }
      submitToCpo(ind, () => go('/indents/' + ind.id));
    }
  }
  draw();
}

// ------------------------------------------------------------------ tracker
route('/tracker', null, (root) => {
  root.appendChild(head({ title: L('trk.title', 'Indent tracker'), sub: L('trk.sub', 'Where every indent of the 2027 cycle stands, field level and RRB level. Green = done, orange = in progress, red = not started or returned.'), sow: '2.2' }));
  root.appendChild(card(L('ind.schedule', 'Indenting schedule, cycle 2027'), stepper(scheduleSteps())));
  const maps = data().mappings;
  const units = all('units').filter((u) => u.zone === MY_ZONE).map((u) => u.id);
  const field = all('indents').filter((i) => i.level === 'field' && i.zone === MY_ZONE && i.cycle === '2027');
  const posts = ['P101', 'P102', 'P103', 'P104', 'P801'];
  const cell = (u, p) => {
    if ((maps[u] || []).indexOf(p) < 0) return h('td.is-center.rms-muted', '·');
    const i = field.filter((x) => x.unit === u && x.post === p)[0];
    if (!i) return h('td.is-center', badge('Rejected', L('trk.notStarted', 'Not started')));
    return h('td.is-center', h('a', { href: '#/indents/' + i.id, title: i.id }, badge(i.status)));
  };
  if (is('cpo', 'rrcb', 'rrb', 'ms')) {
    root.appendChild(card(L('trk.field', 'Field indents by unit and post, South Western Railway'), h('div.rms-table__scroll', h('table.rms-mini',
      h('thead', h('tr', h('th', L('col.post', 'Post')), units.map((u) => h('th.is-center', { title: unitName(u) }, u)))),
      h('tbody', posts.map((p) => h('tr', h('td', postName(p)), units.map((u) => cell(u, p)))))))));
  }
  const rrbLevel = all('indents').filter((i) => i.level === 'rrb' && i.cycle === '2027');
  root.appendChild(card(L('trk.rrb', 'RRB indents, cycle 2027'), table({ rows: rrbLevel, exportName: 'rrb-indents-2027', columns: [
    { key: 'id', label: L('col.indent', 'Indent no.'), render: (i) => link(i.id, '/indents/' + i.id) },
    { key: 'post', label: L('col.post', 'Post'), value: (i) => postName(i.post) },
    { key: 'zone', label: L('col.railway', 'Railway'), value: (i) => zoneName(i.zone) },
    { key: 'rrb', label: L('col.rrb', 'RRB'), value: (i) => rrbName(i.rrb) },
    { key: 'nodal', label: L('col.nodal', 'Nodal RRB'), value: (i) => rrbName(i.nodal) },
    { key: 'total', label: L('col.vacancies', 'Vacancies'), align: 'right' },
    { key: 'status', label: L('col.status', 'Status'), render: (i) => badge(i.status), value: (i) => i.status },
    { key: 'updatedAt', label: L('col.updated', 'Updated'), nowrap: true, value: (i) => date(i.updatedAt), sortValue: (i) => i.updatedAt },
  ], filters: [{ key: 'status', label: L('col.status', 'Status'), options: rrbLevel.map((i) => i.status).filter((x, k, a) => a.indexOf(x) === k) }] })));
  void band;
});
