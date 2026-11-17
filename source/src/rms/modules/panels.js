// SOW 2.11: final result and panels. Merit-cum-preference allotment with vertical and horizontal
// reservation (provisional mode for candidates whose medical is pending), approval by the Member
// Secretary and the Chairperson, versioned corrections with a visible difference.
import { h, mount } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, save, log, insert, candidate } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, stats, stat, grid } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge, pill } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, fail, otp, remarks } from '../ui/dialogs.js';
import { history, stepper } from '../ui/timeline.js';
import { showDoc, sigBlock } from '../ui/doc.js';
import { candLink, postName, catLabel } from './common.js';
import { formPanels } from '../core/engine.js';
import { date, dateTime } from '../core/format.js';
import { L } from '../i18n.js';

const CEN = 'CEN 04/2026';
const CATS = ['UR', 'EWS', 'OBC', 'SC', 'ST'];

function postsFor(cen) {
  return all('indents').filter((i) => i.level === 'rrb' && i.cen === cen).map((i) => {
    const p = byId('posts', i.post);
    return { post: i.post, med: p.med, vac: i.vac, hz: i.hz, pwbd: p.pwbd, indent: i.id };
  });
}
export function poolFor(cen, provisional, exclude) {
  return all('candidates').filter((c) => c.cen === cen && !c.withheld && c.dv && c.dv.outcome === 'Recommended' && c.medical && (c.medical.result === 'Fit' || (provisional && c.medical.status === 'Referred')) && !(exclude && exclude.indexOf(c.id) >= 0))
    .map((c) => ({ id: c.id, name: c.name, cat: c.cat, marks: c.marks, dob: c.dob, prefs: c.prefs, exsm: c.exsm, pwbd: c.pwbd, medStd: c.medical.result === 'Fit' ? c.medical.std : null, medPending: c.medical.status === 'Referred' }));
}
function openAlerts(roll) { return all('alerts').filter((a) => a.roll === roll && a.status !== 'Cleared'); }
function current(p) { return p.versions[p.versions.length - 1]; }

function rowsTable(rows, o) {
  o = o || {};
  return table({
    rows,
    search: rows.length > 12,
    pageSize: 25,
    exportName: o.exportName,
    columns: [
      { key: 'merit', label: L('pnl.merit', 'Merit'), align: 'right' },
      { key: 'roll', label: L('col.roll', 'Roll no.'), render: (r) => candLink(r.roll), value: (r) => r.roll + ' ' + r.name },
      { key: 'cat', label: L('col.category', 'Category') },
      { key: 'charged', label: L('pnl.charged', 'Against'), render: (r) => (r.charged !== r.cat ? h('strong', r.charged) : r.charged), value: (r) => r.charged },
      { key: 'hz', label: L('pnl.hz', 'Horizontal'), value: (r) => r.hz || '' },
      { key: 'marks', label: L('col.marks', 'Normalised marks'), align: 'right', value: (r) => r.marks.toFixed(2), sortValue: (r) => r.marks },
      { key: 'pref', label: L('pnl.pref', 'Pref.'), align: 'right' },
      { key: 'flags', label: '', render: (r) => h('span', r.provisional ? pill(L('pnl.prov', 'Provisional (medical pending)'), 'warning') : null, r.adjusted ? pill(L('pnl.adj', 'Adjusted for horizontal'), 'info') : null, openAlerts(r.roll).length ? pill(L('pnl.alert', 'Integrity alert open'), 'danger') : null) },
    ],
    rowClass: (r) => (o.added && o.added.indexOf(r.roll) >= 0 ? 'is-flagged' : null),
  });
}

function shortfallLine(run) {
  const s = CATS.filter((c) => run.shortfall[c]).map((c) => c + ' ' + run.shortfall[c]);
  const z = Object.keys(run.hzShort || {}).filter((k) => run.hzShort[k]).map((k) => k + ' ' + run.hzShort[k]);
  if (!s.length && !z.length) return badge('Completed', L('pnl.noShort', 'No shortfall'));
  return h('span', s.length ? badge('Pending', L('pnl.shortV', 'Short: {s}', { s: s.join(', ') })) : null, ' ', z.length ? badge('Pending', L('pnl.shortH', 'Horizontal short: {s}', { s: z.join(', ') })) : null);
}

route('/panels', null, (root) => {
  const q = query();
  let tab = q.tab || 'list';
  let provisional = false;
  let preview = null;
  const draw = () => {
    mount(root);
    const panels = all('panels');
    root.appendChild(head({
      title: L('pnl.title', 'Final result & panels'),
      sub: L('pnl.sub', 'Panels are formed post-wise by merit-cum-preference with community-wise (vertical) and ExSM/PwBD (horizontal) reservation, from candidates recommended at DV and found medically fit for the post.'),
      sow: '2.11',
    }));
    root.appendChild(stats([
      stat(L('pnl.count', 'Panels'), panels.length),
      stat(L('pnl.waitMs', 'With the Member Secretary'), panels.filter((p) => p.status === 'Submitted to MS').length, { tone: 'warn' }),
      stat(L('pnl.waitChair', 'With the Chairperson'), panels.filter((p) => p.status === 'Submitted to Chairperson').length, { tone: 'warn' }),
      stat(L('pnl.approved', 'Approved or distributed'), panels.filter((p) => /Approved by Chairperson|Allocated|Distributed/.test(p.status)).length, { tone: 'ok' }),
    ]));
    const t = [{ id: 'list', label: L('pnl.tab.list', 'Panels'), count: panels.length }];
    if (is('rrb', 'ms')) t.push({ id: 'form', label: L('pnl.tab.form', 'Form panels: CEN 04/2026') });
    root.appendChild(tabs(t, tab, (id) => { tab = id; draw(); }));
    if (tab === 'list') {
      root.appendChild(table({ rows: panels, exportName: 'panels', columns: [
        { key: 'id', label: L('col.panel', 'Panel'), render: (p) => link(p.id, '/panels/' + p.id) },
        { key: 'cen', label: L('col.cen', 'CEN'), nowrap: true },
        { key: 'post', label: L('col.post', 'Post'), value: (p) => postName(p.post) },
        { key: 'v', label: L('pnl.version', 'Version'), value: (p) => 'v' + p.versions.length },
        { key: 'n', label: L('pnl.candidates', 'Candidates'), align: 'right', value: (p) => current(p).rows.length },
        { key: 'short', label: L('pnl.shortfall', 'Shortfall'), render: (p) => shortfallLine(current(p)) },
        { key: 'status', label: L('col.status', 'Status'), render: (p) => badge(p.status), value: (p) => p.status },
      ], onRow: (p) => go('/panels/' + p.id) }));
      return;
    }
    // formation
    const posts = postsFor(CEN);
    const fullPool = poolFor(CEN, true);
    const fit = fullPool.filter((c) => c.medStd).length;
    root.appendChild(card(L('pnl.inputs', 'Inputs'), h('div',
      kv([[L('pnl.postsN', 'Posts (RRB indents in the CEN)'), posts.map((p) => postName(p.post) + ' · ' + p.med).join('; ')], [L('pnl.vacTotal', 'Vacancies'), String(posts.reduce((x, p) => x + CATS.reduce((y, c) => y + p.vac[c], 0), 0))], [L('pnl.fitN', 'Recommended and medically fit'), String(fit)], [L('pnl.pendN', 'Recommended, medical pending'), String(fullPool.length - fit)]]),
      h('label.rms-check', h('input', { type: 'checkbox', checked: provisional, onchange: (e) => { provisional = e.target.checked; preview = null; draw(); } }), h('span', L('pnl.provMode', 'Provisional panel: include candidates whose medical result is pending (they are marked and confirmed later)'))),
      h('div.rms-toolbar', btn(L('pnl.run', 'Run allotment'), { icon: 'refresh', onClick: () => { preview = formPanels(posts, poolFor(CEN, provisional), { provisional }); log(who(), role(), 'Panel allotment run', 'Panel', CEN, provisional ? 'provisional' : 'final'); save(); draw(); } })))));
    if (!preview) { root.appendChild(note(L('pnl.runHint', 'Run the allotment to see the panels. Nothing is saved until you save them as drafts.'), 'info')); return; }
    preview.forEach((run) => {
      const ex = all('panels').filter((p) => p.cen === CEN && p.post === run.post)[0];
      root.appendChild(card(postName(run.post) + ' · ' + L('pnl.medStd', 'medical {m}', { m: byId('posts', run.post).med }), h('div', h('div.rms-toolbar', shortfallLine(run), ex ? h('span.rms-small.rms-muted', L('pnl.exists', 'Saved panel {id} ({s}) will get a new version.', { id: ex.id, s: ex.status })) : null), rowsTable(run.rows))));
    });
    root.appendChild(h('div.rms-toolbar', btn(L('pnl.saveDrafts', 'Save as draft panels'), { icon: 'check', onClick: () => saveDrafts(preview, provisional) })));
  };
  draw();
});

function saveDrafts(runs, provisional) {
  const now = new Date().toISOString();
  const ids = [];
  runs.forEach((run) => {
    const m = CEN.match(/(\d+)\/(\d+)/);
    const id = 'PNL-' + m[1] + m[2].slice(-2) + '-' + run.post;
    let p = byId('panels', id);
    const ver = { v: 1, at: now, by: who(), rows: run.rows, note: provisional ? 'Provisional panel (medical pending marked)' : 'Formed from merit list after medical results', shortfall: run.shortfall, hzShort: run.hzShort, provisional };
    if (!p) {
      const ind = all('indents').filter((i) => i.level === 'rrb' && i.cen === CEN && i.post === run.post)[0];
      p = { id, cen: CEN, rrb: 'SBC', post: run.post, indent: ind ? ind.id : '', status: 'Draft', version: 1, createdAt: now, versions: [ver], history: [{ at: now, by: who(), role: role(), action: 'Panel formed (v1)', remarks: ver.note }] };
      insert('panels', p, true);
    } else {
      if (/Allocated|Distributed/.test(p.status)) return;
      ver.v = p.versions.length + 1;
      p.versions.push(ver);
      p.version = ver.v;
      p.status = 'Draft';
      p.history.push({ at: now, by: who(), role: role(), action: 'Panel re-formed (v' + ver.v + ')', remarks: ver.note });
    }
    ids.push(id);
  });
  log(who(), role(), 'Draft panels saved', 'Panel', CEN, ids.join(', '));
  save();
  ok(L('pnl.saved', '{n} draft panel(s) saved. Open each panel to submit it to the Member Secretary.', { n: ids.length }));
  go('/panels');
}

function panelSteps(p) {
  const order = ['Draft', 'Submitted to MS', 'Submitted to Chairperson', 'Approved by Chairperson', 'Allocated to CPO', 'Distributed to units'];
  const idx = Math.max(0, order.indexOf(p.status === 'Returned by RRB' ? 'Draft' : p.status));
  const labels = [L('pnl.s.formed', 'Formed by RRB'), L('pnl.s.ms', 'Member Secretary'), L('pnl.s.chair', 'Chairperson'), L('pnl.s.approved', 'Approved'), L('pnl.s.cpo', 'Allocated to CPO'), L('pnl.s.units', 'Distributed to units')];
  return labels.map((l, k) => ({ label: l, state: k < idx ? 'done' : (k === idx ? (k === order.length - 1 ? 'done' : 'active') : 'todo') }));
}

function diff(a, b) {
  const ra = a ? a.rows.map((r) => r.roll) : [];
  const rb = b.rows.map((r) => r.roll);
  return { added: rb.filter((x) => ra.indexOf(x) < 0), removed: ra.filter((x) => rb.indexOf(x) < 0) };
}

function printPanel(p, v) {
  showDoc({
    dialogTitle: L('pnl.print', 'Panel {id} v{v}', { id: p.id, v: v.v }),
    title: L('pnl.docTitle', 'Panel of candidates for appointment: {post}', { post: postName(p.post) }),
    office: 'Railway Recruitment Board, Bengaluru',
    ref: p.id + '/v' + v.v,
    date: date(v.at),
    body: h('div',
      h('p', L('pnl.docText', '{cen}. Indent {ind}. The following candidates, recommended at document verification and found medically fit, are empanelled in order of merit.', { cen: p.cen, ind: p.indent })),
      h('table', h('thead', h('tr', h('th', L('pnl.merit', 'Merit')), h('th', L('col.roll', 'Roll no.')), h('th', L('col.name', 'Name')), h('th', L('col.category', 'Category')), h('th', L('pnl.charged', 'Against')), h('th', L('pnl.hz', 'Horizontal')))),
        h('tbody', v.rows.map((r) => h('tr', h('td', String(r.merit)), h('td', r.roll), h('td', r.name), h('td', r.cat), h('td', r.charged), h('td', r.hz || ''))))),
      h('p', L('pnl.docShort', 'Shortfall: {s}', { s: CATS.filter((c) => v.shortfall[c]).map((c) => c + ' ' + v.shortfall[c]).join(', ') || L('pnl.none', 'none') })),
      sigBlock(p.status === 'Draft' ? L('pnl.unapproved', 'Not yet approved') : 'Vikram Iyer', L('pnl.sigChair', 'Chairperson, RRB Bengaluru'))),
  });
}

route('/panels/:id', null, (root, prm) => {
  let showV = null;
  const draw = () => {
    mount(root);
    const p = byId('panels', prm.id);
    if (!p) { root.appendChild(head({ title: L('pnl.notFound', 'Panel not found') })); return; }
    const v = showV ? p.versions[showV - 1] : current(p);
    const prev = p.versions[v.v - 2];
    const d = diff(prev, v);
    const actions = [];
    const move = (status, action, needRemarks, needOtp, kind) => btn(action, { kind: kind || 'theme', onClick: () => {
      const alerts = current(p).rows.filter((r) => openAlerts(r.roll).length);
      remarks({ title: action + ' · ' + p.id, required: needRemarks, ok: action, kind: kind === 'plain' ? 'danger' : (kind || 'theme'), text: alerts.length && !needRemarks ? L('pnl.alertWarn', '{n} candidate(s) in this panel have an open integrity alert.', { n: alerts.length }) : '' }).then((t) => {
        if (t === null) return;
        const fin = () => {
          const now = new Date().toISOString();
          p.status = status;
          p.history.push({ at: now, by: who(), role: role(), action: status === 'Returned by RRB' ? action : status, remarks: (t || '') + (needOtp ? ' · OTP verified' : '') });
          if (status === 'Approved by Chairperson') current(p).rows.forEach((r) => { const c = candidate(r.roll); if (c) { c.panel = { id: p.id, post: p.post, charged: r.charged, merit: r.merit, provisional: r.provisional }; c.stage = 'In panel'; } });
          log(who(), role(), status, 'Panel', p.id, t || '');
          save();
          ok(L('pnl.moved', '{id}: {s}', { id: p.id, s: status }));
          draw();
        };
        if (needOtp) otp({ title: L('ind.esign', 'Aadhaar e-Sign (demo)') }).then((y) => { if (y) fin(); }); else fin();
      });
    } });
    if (is('rrb') && (p.status === 'Draft' || p.status === 'Returned by RRB')) actions.push(move('Submitted to MS', L('pnl.toMs', 'Submit to Member Secretary'), false, false));
    if (is('ms') && p.status === 'Submitted to MS') { actions.push(move('Submitted to Chairperson', L('pnl.msOk', 'Approve & forward to Chairperson'), false, false, 'ok')); actions.push(move('Draft', L('pnl.return', 'Return to dealing section'), true, false, 'plain')); }
    if (is('chair') && p.status === 'Submitted to Chairperson') { actions.push(move('Approved by Chairperson', L('pnl.chairOk', 'Approve panel'), false, true, 'ok')); actions.push(move('Submitted to MS', L('pnl.return', 'Return to dealing section'), true, false, 'plain')); }
    if (is('rrb', 'ms') && /Approved by Chairperson|Allocated to CPO|Distributed to units/.test(p.status)) actions.push(btn(L('pnl.correct', 'Issue correction'), { kind: 'plain', icon: 'edit', onClick: () => correct(p, draw) }));
    actions.push(btn(L('ui.print', 'Print'), { kind: 'plain', icon: 'print', onClick: () => printPanel(p, v) }));
    root.appendChild(head({ title: L('pnl.detail', 'Panel {id}', { id: p.id }), sub: postName(p.post) + ' · ' + p.cen + ' · ' + L('pnl.indentX', 'indent {i}', { i: p.indent }), crumbs: [{ label: L('pnl.title', 'Final result & panels'), href: '/panels' }, { label: p.id }], actions, sow: '2.11' }));
    root.appendChild(h('div.rms-toolbar', badge(p.status), shortfallLine(v), v.provisional ? pill(L('pnl.provPanel', 'Provisional'), 'warning') : null));
    root.appendChild(stepper(panelSteps(p)));
    if (p.versions.length > 1) root.appendChild(tabs(p.versions.map((x) => ({ id: String(x.v), label: 'v' + x.v + (x.v === p.versions.length ? ' · ' + L('pnl.current', 'current') : '') })), String(v.v), (id) => { showV = Number(id); draw(); }));
    root.appendChild(card(L('pnl.versionX', 'Version {v}: {n} candidates', { v: v.v, n: v.rows.length }), h('div',
      h('p.rms-small.rms-muted', v.note + ' · ' + v.by + ' · ' + dateTime(v.at)),
      prev && (d.added.length || d.removed.length) ? note(h('div', h('strong', L('pnl.changes', 'Changes from v{v}: ', { v: prev.v })),
        d.removed.length ? h('span', L('pnl.removed', 'removed {r}', { r: d.removed.join(', ') })) : null, d.removed.length && d.added.length ? '; ' : '',
        d.added.length ? h('span', L('pnl.addedX', 'added {r}', { r: d.added.join(', ') })) : null), 'warning') : null,
      rowsTable(v.rows, { added: d.added, exportName: p.id + '-v' + v.v }))));
    root.appendChild(grid(2, [
      card(L('pnl.shortT', 'Shortfall'), h('table.rms-mini', h('thead', h('tr', CATS.map((c) => h('th.is-right', c)), h('th', L('pnl.hz', 'Horizontal')))), h('tbody', h('tr', CATS.map((c) => h('td.is-right', String(v.shortfall[c] || 0))), h('td', Object.keys(v.hzShort || {}).filter((k) => v.hzShort[k]).map((k) => k + ' ' + v.hzShort[k]).join(', ') || '—'))))),
      card(L('ind.history', 'History'), history(p.history)),
    ]));
  };
  draw();
});

function correct(p, redraw) {
  const v = current(p);
  const f = form([
    field({ name: 'roll', type: 'select', label: L('pnl.drop', 'Candidate to remove'), required: true, options: v.rows.map((r) => ({ value: r.roll, label: r.merit + '. ' + r.roll + ' · ' + r.name })) }),
    field({ name: 'reason', type: 'textarea', label: L('pnl.dropWhy', 'Reason (order or report reference)'), required: true }),
  ], 1);
  modal({ title: L('pnl.correct', 'Issue correction'), body: h('div', note(L('pnl.correctNote', 'The allotment is run again without the candidate; the next eligible candidate in merit comes in. The corrected panel is a new version and goes through approval again.'), 'info'), f.node), actions: [
    { label: L('pnl.makeVersion', 'Create corrected version'), onClick: () => {
      if (!f.validate()) return false;
      const x = f.values();
      const excluded = (p.excluded || []).concat([x.roll]);
      const posts = postsFor(p.cen).length ? postsFor(p.cen) : [{ post: p.post, med: byId('posts', p.post).med, vac: byId('indents', p.indent).vac, hz: byId('indents', p.indent).hz, pwbd: byId('posts', p.post).pwbd }];
      const run = formPanels(posts, poolFor(p.cen, !!v.provisional, excluded), { provisional: !!v.provisional }).filter((r) => r.post === p.post)[0];
      if (!run) { fail(L('pnl.noRun', 'Could not re-run the allotment.')); return false; }
      const now = new Date().toISOString();
      p.excluded = excluded;
      const ver = { v: p.versions.length + 1, at: now, by: who(), rows: run.rows, note: 'Correction: ' + x.roll + ' removed (' + x.reason + ')', shortfall: run.shortfall, hzShort: run.hzShort, provisional: !!v.provisional };
      p.versions.push(ver);
      p.version = ver.v;
      p.status = 'Submitted to MS';
      p.history.push({ at: now, by: who(), role: role(), action: 'Correction issued (v' + ver.v + ')', remarks: x.reason });
      const c = candidate(x.roll);
      if (c && c.panel && c.panel.id === p.id) { c.panel = null; c.stage = 'Removed from panel'; }
      log(who(), role(), 'Panel correction', 'Panel', p.id, x.roll + ': ' + x.reason);
      save();
      ok(L('pnl.corrected', 'Version {v} created and sent to the Member Secretary.', { v: ver.v }));
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}
