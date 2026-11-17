// SOW 2.1: post master, post mapping, add-post requests and the vacancy register.
import { h, mount } from '../core/h.js';
import { route, go } from '../core/router.js';
import { all, byId, data, save, log, insert, next } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, grid, stats, stat } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, confirm } from '../ui/dialogs.js';
import { groupName, unitName, rrbName } from './common.js';
import { date } from '../core/format.js';
import { calc } from '../core/engine.js';
import { L } from '../i18n.js';

const MY_UNIT = 'SBC';

function pwbdText(p) {
  const parts = [];
  ['VI', 'HI', 'LD', 'OD', 'MD'].forEach((k) => { if (p.pwbd[k] && p.pwbd[k] !== 'No') parts.push(k + (p.pwbd[k] === 'Yes' ? '' : ' (' + p.pwbd[k] + ')')); });
  return parts.length ? parts.join(', ') : L('posts.notSuitable', 'Not suitable');
}

route('/posts', null, (root) => {
  let tab = role() === 'unit' ? 'mapped' : 'master';
  const wrap = h('div');
  root.appendChild(head({
    title: L('posts.title', 'Post master & mapping'),
    sub: L('posts.sub', 'Standard designations with eligibility attributes. Indenting units map the direct-recruitment posts they operate; only mapped posts can be assessed and indented.'),
    sow: '2.1',
    actions: is('unit') ? [btn(L('posts.request', 'Request a new post'), { icon: 'plus', onClick: requestPost })] : [],
  }));
  root.appendChild(wrap);
  draw();
  function draw() {
    const t = [{ id: 'master', label: L('posts.tab.master', 'Post master'), count: all('posts').length }];
    if (is('unit', 'cpo', 'admin')) t.push({ id: 'mapped', label: is('unit') ? L('posts.tab.mine', 'Mapped to my unit') : L('posts.tab.mapping', 'Mapping by unit') });
    t.push({ id: 'requests', label: L('posts.tab.requests', 'Add-post requests'), count: all('postRequests').length });
    mount(wrap, tabs(t, tab, (id) => { tab = id; draw(); }), tab === 'master' ? master() : (tab === 'mapped' ? mapping() : requests()));
  }
  function requestPost() {
    const f = form([
      field({ name: 'designation', label: L('posts.f.designation', 'Designation'), required: true }),
      field({ name: 'dept', label: L('posts.f.dept', 'Department'), required: true, type: 'select', options: ['Mechanical', 'Electrical', 'Engineering', 'S&T', 'Operating', 'Commercial', 'Accounts', 'Stores', 'Medical', 'Personnel'] }),
      field({ name: 'level', label: L('posts.f.level', 'Pay level'), required: true, type: 'select', options: ['1', '2', '3', '4', '5', '6', '7'] }),
      field({ name: 'med', label: L('posts.f.med', 'Medical standard'), required: true, type: 'select', options: ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2'] }),
      field({ name: 'ref', label: L('posts.f.ref', 'Railway Board / Railway reference'), required: true }),
      field({ name: 'doc', label: L('posts.f.doc', 'Supporting order (PDF)'), type: 'file', demoName: 'rb-order-post-creation.pdf' }),
      field({ name: 'reason', label: L('posts.f.reason', 'Why the post is needed'), type: 'textarea', required: true, wide: true }),
    ], 2);
    modal({ title: L('posts.request', 'Request a new post'), body: h('div', note(L('posts.requestNote', 'The RRB Administrator checks the request against existing designations before adding it to the post master.'), 'info'), f.node), actions: [
      { label: L('ui.submit', 'Submit'), onClick: () => {
        if (!f.validate()) return false;
        const v = f.values();
        insert('postRequests', { id: 'PR-' + next('request'), unit: MY_UNIT, designation: v.designation, dept: v.dept, sub: v.dept, level: Number(v.level), med: v.med, ref: v.ref, reason: v.reason, status: 'Pending with RRB Admin', at: new Date().toISOString() });
        log(who(), role(), 'Add-post request submitted', 'Post master', v.designation, v.ref);
        ok(L('posts.requested', 'Request sent to the RRB Administrator.'));
        tab = 'requests';
        draw();
        return true;
      } },
      { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
    ] });
  }
});

function master() {
  return table({
    exportName: 'post-master',
    columns: [
      { key: 'id', label: L('col.code', 'Code') },
      { key: 'designation', label: L('col.designation', 'Designation'), render: (p) => link(p.designation, '/posts/' + p.id) },
      { key: 'group', label: L('col.examGroup', 'Exam group'), value: (p) => groupName(p.group) },
      { key: 'dept', label: L('col.dept', 'Department') },
      { key: 'level', label: L('col.level', 'Level'), align: 'right' },
      { key: 'med', label: L('col.medStd', 'Medical std.') },
      { key: 'pwbd', label: L('col.pwbd', 'PwBD suitability'), value: pwbdText },
      { key: 'drq', label: L('col.drq', 'DR quota %'), align: 'right' },
      { key: 'age', label: L('col.age', 'Age'), value: (p) => p.age[0] + '–' + p.age[1] },
    ],
    rows: all('posts'),
    filters: [
      { key: 'group', label: L('col.examGroup', 'Exam group'), options: all('groups').map((g) => ({ value: g.id, label: g.name })) },
      { key: 'dept', label: L('col.dept', 'Department'), options: uniq(all('posts').map((p) => p.dept)) },
    ],
    onRow: (p) => go('/posts/' + p.id),
  });
}

function uniq(list) { return list.filter((x, i) => list.indexOf(x) === i).sort(); }

function mapping() {
  const maps = data().mappings;
  if (is('unit')) {
    const mine = maps[MY_UNIT] || [];
    const box = h('div');
    const redraw = () => mount(box,
      note(L('posts.mapNote', 'Tick a post to map it to {unit}. Unmapping is blocked while an indent for the post is open.', { unit: unitName(MY_UNIT) }), 'info'),
      table({
        rows: all('posts'),
        columns: [
          { key: 'map', label: L('col.mapped', 'Mapped'), sortable: false, render: (p) => h('input', { type: 'checkbox', 'aria-label': p.designation, checked: mine.indexOf(p.id) >= 0, onchange: (e) => toggle(p, e.target) }) },
          { key: 'designation', label: L('col.designation', 'Designation') },
          { key: 'group', label: L('col.examGroup', 'Exam group'), value: (p) => groupName(p.group) },
          { key: 'dept', label: L('col.dept', 'Department') },
          { key: 'level', label: L('col.level', 'Level'), align: 'right' },
        ],
        filters: [{ key: 'mapped', label: L('col.show', 'Show'), options: [{ value: 'yes', label: L('posts.onlyMapped', 'Mapped only') }, { value: 'no', label: L('posts.onlyUnmapped', 'Not mapped') }], match: (p, v) => (mine.indexOf(p.id) >= 0) === (v === 'yes') }],
      }));
    const toggle = (p, cb) => {
      const open = all('indents').some((i) => i.level === 'field' && i.unit === MY_UNIT && i.post === p.id && !/Consolidated/.test(i.status));
      if (!cb.checked && open) { cb.checked = true; ok(L('posts.openIndent', 'An open indent exists for this post; finish or withdraw it first.')); return; }
      if (cb.checked) mine.push(p.id); else mine.splice(mine.indexOf(p.id), 1);
      maps[MY_UNIT] = mine;
      log(who(), role(), cb.checked ? 'Post mapped' : 'Post unmapped', 'Post mapping', p.id, unitName(MY_UNIT));
      save();
    };
    redraw();
    return box;
  }
  const units = Object.keys(maps);
  const posts = all('posts').filter((p) => units.some((u) => maps[u].indexOf(p.id) >= 0));
  return card(L('posts.matrix', 'Post mapping, South Western Railway'), h('div.rms-table__scroll', h('table.rms-mini',
    h('thead', h('tr', h('th', L('col.post', 'Post')), units.map((u) => h('th.is-center', { title: unitName(u) }, u)))),
    h('tbody', posts.map((p) => h('tr', h('td', p.designation), units.map((u) => h('td.is-center', maps[u].indexOf(p.id) >= 0 ? '✓' : ''))))))));
}

function requests() {
  const canDecide = is('admin', 'rrb', 'ms');
  const box = h('div');
  const draw = () => mount(box, table({
    rows: all('postRequests'),
    columns: [
      { key: 'id', label: L('col.request', 'Request') },
      { key: 'unit', label: L('col.unit', 'Unit'), value: (r) => unitName(r.unit) },
      { key: 'designation', label: L('col.designation', 'Designation') },
      { key: 'level', label: L('col.level', 'Level'), align: 'right' },
      { key: 'ref', label: L('col.reference', 'Reference') },
      { key: 'at', label: L('col.date', 'Date'), nowrap: true, value: (r) => date(r.at), sortValue: (r) => r.at },
      { key: 'status', label: L('col.status', 'Status'), render: (r) => badge(r.status) },
      { key: 'act', label: '', action: true, render: (r) => (canDecide && r.status === 'Pending with RRB Admin' ? h('span.rms-nowrap', btn(L('ui.approve', 'Approve'), { small: true, kind: 'ok', onClick: () => decide(r, 'Approved') }), ' ', btn(L('ui.reject', 'Reject'), { small: true, kind: 'plain', onClick: () => decide(r, 'Rejected') })) : (r.remarks ? h('span.rms-small.rms-muted', r.remarks) : null)) },
    ],
  }));
  const decide = (r, status) => {
    confirm(status === 'Approved' ? L('posts.approveQ', 'Add "{d}" to the post master and map it to the unit?', { d: r.designation }) : L('posts.rejectQ', 'Reject the request for "{d}"?', { d: r.designation })).then((y) => {
      if (!y) return;
      r.status = status;
      r.decidedAt = new Date().toISOString();
      if (status === 'Approved') {
        const id = 'P9' + next('request');
        all('posts').push({ id, designation: r.designation, group: 'MI', dept: r.dept, sub: r.sub, level: r.level, med: r.med, drq: 100, age: [18, 33], type: 'Non-safety', training: 0, pwbd: { VI: '', HI: '', LD: '', OD: '', MD: '' }, eq: 'As per recruitment rules', police: false, nodal: 'CDG', status: 'Active' });
        const m = data().mappings;
        (m[r.unit] = m[r.unit] || []).push(id);
      }
      log(who(), role(), 'Add-post request ' + status.toLowerCase(), 'Post master', r.id, r.designation);
      save();
      ok(status === 'Approved' ? L('posts.added', 'Post added to the master and mapped.') : L('posts.rejected', 'Request rejected.'));
      draw();
    });
  };
  draw();
  return box;
}

route('/posts/:id', null, (root, p) => {
  const post = byId('posts', p.id);
  if (!post) { root.appendChild(head({ title: L('posts.notFound', 'Post not found') })); return; }
  const maps = data().mappings;
  const units = Object.keys(maps).filter((u) => maps[u].indexOf(post.id) >= 0);
  const inds = all('indents').filter((i) => i.post === post.id);
  root.appendChild(head({ title: post.designation, crumbs: [{ label: L('posts.title', 'Post master & mapping'), href: '/posts' }, { label: post.id }], sow: '2.1' }));
  root.appendChild(card(L('posts.details', 'Post details'), kv([
    [L('col.code', 'Code'), post.id],
    [L('col.examGroup', 'Exam group'), groupName(post.group)],
    [L('col.nodal', 'Nodal RRB'), rrbName(post.nodal)],
    [L('col.dept', 'Department'), post.dept + ' / ' + post.sub],
    [L('col.level', 'Level'), L('posts.levelPay', 'Level {l} (₹{p} entry pay)', { l: post.level, p: [0, 18000, 19900, 21700, 25500, 29200, 35400, 44900][post.level] })],
    [L('col.medStd', 'Medical std.'), post.med],
    [L('col.postType', 'Post type'), post.type],
    [L('col.age', 'Age'), post.age[0] + '–' + post.age[1] + ' ' + L('posts.years', 'years')],
    [L('col.drq', 'DR quota %'), post.drq + '%'],
    [L('col.training', 'Training'), post.training ? post.training + ' ' + L('posts.weeks', 'weeks') : L('posts.noTraining', 'None')],
    [L('col.pv', 'Police verification'), post.police ? L('ui.yes', 'Yes') : L('ui.no', 'No')],
    [L('col.pwbd', 'PwBD suitability'), pwbdText(post)],
    [L('col.eq', 'Essential qualification'), post.eq],
  ], 2)));
  root.appendChild(grid(2, [
    card(L('posts.mappedUnits', 'Mapped to units'), units.length ? h('ul', units.map((u) => h('li', unitName(u)))) : h('p.rms-muted', L('posts.noUnits', 'Not mapped to any unit yet.'))),
    card(L('posts.indents', 'Indents for this post'), table({ search: false, pageSize: 6, rows: inds, columns: [
      { key: 'id', label: L('col.indent', 'Indent no.'), render: (i) => link(i.id, '/indents/' + i.id) },
      { key: 'level', label: L('col.levelType', 'Type'), value: (i) => (i.level === 'field' ? L('ind.field', 'Field') : L('ind.rrb', 'RRB')) },
      { key: 'total', label: L('col.vacancies', 'Vacancies'), align: 'right' },
      { key: 'status', label: L('col.status', 'Status'), render: (i) => badge(i.status) },
    ] })),
  ]));
});

// ------------------------------------------------------------------ vacancy register
route('/vacancy', null, (root) => {
  const unitScope = is('unit') ? [MY_UNIT] : Object.keys(data().mappings);
  const rows = all('vacancy').filter((v) => unitScope.indexOf(v.unit) >= 0);
  const net = (v) => calc(v).balance;
  root.appendChild(head({
    title: L('vac.title', 'Vacancy register'),
    sub: L('vac.sub', 'Sanctioned DR-quota strength, men on roll and commitments already in the pipeline for every mapped post. Indents start from these figures.'),
    sow: '2.1',
  }));
  root.appendChild(stats([
    stat(L('vac.posts', 'Posts tracked'), rows.length),
    stat(L('vac.sanctioned', 'Sanctioned (DR quota)'), rows.reduce((a, v) => a + v.sanctioned, 0)),
    stat(L('vac.vacant', 'Vacant today'), rows.reduce((a, v) => a + Math.max(0, v.sanctioned - v.onRoll), 0), { tone: 'warn' }),
    stat(L('vac.net', 'Net vacancy to indent (assessed)'), rows.reduce((a, v) => a + net(v), 0), { tone: 'navy' }),
  ]));
  const t = table({
    exportName: 'vacancy-register',
    rows,
    columns: [
      is('unit') ? null : { key: 'unit', label: L('col.unit', 'Unit'), value: (v) => unitName(v.unit) },
      { key: 'post', label: L('col.post', 'Post'), render: (v) => link(byId('posts', v.post).designation, '/posts/' + v.post), value: (v) => byId('posts', v.post).designation },
      { key: 'sanctioned', label: L('col.sanctioned', 'Sanctioned'), align: 'right' },
      { key: 'onRoll', label: L('col.onRoll', 'On roll'), align: 'right' },
      { key: 'vacant', label: L('col.vacant', 'Vacant'), align: 'right', value: (v) => v.sanctioned - v.onRoll },
      { key: 'inTraining', label: L('col.inTraining', 'In training'), align: 'right' },
      { key: 'panelsOnHand', label: L('col.panels', 'Panels on hand'), align: 'right' },
      { key: 'outstanding', label: L('col.outstanding', 'Outstanding indents'), align: 'right' },
      { key: 'net', label: L('col.net', 'Net to indent'), align: 'right', value: net, render: (v) => h('strong', String(net(v))) },
      { key: 'updatedAt', label: L('col.updated', 'Updated'), nowrap: true, value: (v) => date(v.updatedAt), sortValue: (v) => v.updatedAt },
      { key: 'act', label: '', action: true, render: (v) => h('span.rms-nowrap', btn(L('ui.edit', 'Edit'), { small: true, kind: 'plain', onClick: () => edit(v) }), is('unit') ? [' ', btn(L('vac.raise', 'Raise indent'), { small: true, onClick: () => go('/indents/new?post=' + v.post) })] : null) },
    ].filter(Boolean),
    filters: is('unit') ? [] : [{ key: 'unit', label: L('col.unit', 'Unit'), options: unitScope.map((u) => ({ value: u, label: unitName(u) })) }],
  });
  root.appendChild(t);
  function edit(v) {
    const f = form([
      field({ name: 'sanctioned', type: 'number', label: L('col.sanctioned', 'Sanctioned'), value: v.sanctioned, min: 0, required: true }),
      field({ name: 'onRoll', type: 'number', label: L('col.onRoll', 'On roll'), value: v.onRoll, min: 0, required: true }),
      field({ name: 'inTraining', type: 'number', label: L('col.inTraining', 'In training'), value: v.inTraining, min: 0 }),
      field({ name: 'panelsOnHand', type: 'number', label: L('col.panels', 'Panels on hand'), value: v.panelsOnHand, min: 0 }),
      field({ name: 'outstanding', type: 'number', label: L('col.outstanding', 'Outstanding indents'), value: v.outstanding, min: 0 }),
      field({ name: 'anticipated', type: 'number', label: L('vac.anticipated', 'Anticipated vacancies (3 years, DRQ share)'), value: v.anticipated, min: 0 }),
      field({ name: 'unforeseen', type: 'number', label: L('vac.unforeseen', 'Unforeseen vacancies (3-year average, DRQ share)'), value: v.unforeseen, min: 0 }),
      field({ name: 'nonMatPct', type: 'number', label: L('vac.nonMat', 'Non-materialisation % (max 30)'), value: v.nonMatPct, min: 0, max: 30 }),
    ], 2);
    modal({ title: L('vac.edit', 'Update vacancy position: {p}', { p: byId('posts', v.post).designation }), body: f.node, actions: [
      { label: L('ui.save', 'Save'), onClick: () => {
        if (!f.validate()) return false;
        const x = f.values();
        if (x.onRoll > x.sanctioned) { f.get('onRoll').validate(); ok(L('vac.onRollHigh', 'Men on roll cannot exceed sanctioned strength.')); return false; }
        Object.assign(v, x, { updatedAt: new Date().toISOString(), updatedBy: who() });
        log(who(), role(), 'Vacancy position updated', 'Vacancy register', v.id, '');
        save();
        ok(L('vac.saved', 'Vacancy position saved.'));
        t.update(all('vacancy').filter((y) => unitScope.indexOf(y.unit) >= 0));
        return true;
      } },
      { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
    ] });
  }
});
