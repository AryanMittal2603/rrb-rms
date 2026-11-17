// SOW 2.5: data exchange with the examination conducting agency. Outbound files are validated,
// checksummed (SHA-256), encrypted and sent; ECA acknowledges by checksum. Every file is copied
// to the Nodal RRB and RRB/SC. Inbound result files are imported in Results & merit validation.
import { h, mount, icon } from '../core/h.js';
import { route } from '../core/router.js';
import { all, byId, save, log, insert } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, btn, note, stats, stat } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok } from '../ui/dialogs.js';
import { rrbName, newId, pad } from './common.js';
import { date, dateTime, num } from '../core/format.js';
import { sha256Hex } from '../core/sha256.js';
import { L } from '../i18n.js';

const DATASETS = [
  { name: 'Candidate master for admit cards', records: 98452, size: '41.2 MB', channel: 'SFTP' },
  { name: 'Scribe and PwBD facility list', records: 1284, size: '0.6 MB', channel: 'API' },
  { name: 'Photographs & signatures (batch 3)', records: 32105, size: '3.9 GB', channel: 'SFTP' },
  { name: 'Exam city allocation', records: 98452, size: '6.8 MB', channel: 'API' },
  { name: 'Debar list for exam-day screening', records: 0, size: '0.1 MB', channel: 'API' },
];

const ERRORS = {
  'ECA-0703': [
    ['Photograph below 20 KB or not 3.5 × 4.5 cm', 214],
    ['Signature file missing', 37],
    ['Roll number not in candidate master', 3],
  ],
};

function hashOf(text) { return sha256Hex(new TextEncoder().encode(text)); }

function stepsList(x) {
  return h('ol.rms-checklist', x.steps.map((s) => h('li.rms-checklist__item' + (s.ok === false ? '.is-bad' : (s.ok ? '.is-ok' : '')),
    icon(s.ok === false ? 'close' : (s.ok ? 'check' : 'clock'), 16),
    h('span', s.name), s.at ? h('span.rms-small.rms-muted', ' · ' + dateTime(s.at)) : null, s.note ? h('span.rms-small', ' · ' + s.note) : null)));
}

function detail(x, redraw) {
  const errs = ERRORS[x.id] || x.errors || null;
  const actions = [];
  if (x.status === 'Awaiting acknowledgement' && is('rrb', 'ms')) actions.push({ label: L('eca.checkAck', 'Check acknowledgement'), onClick: () => { acknowledge(x); redraw(); return true; } });
  if (x.status === 'Validation failed' && is('rrb', 'ms') && !x.rerun) actions.push({ label: L('eca.rerun', 'Fix & re-run'), onClick: () => { setTimeout(() => runTransfer({ cen: x.cen, dataset: x.dataset, rerunOf: x.id }, redraw), 50); return true; } });
  actions.push({ label: L('ui.close', 'Close'), kind: 'plain', value: false });
  modal({ title: x.id + ' · ' + x.dataset, wide: true, body: h('div',
    h('div.rms-toolbar', badge(x.status), h('span.rms-small.rms-muted', x.direction + ' · ' + x.channel)),
    kv([
      [L('col.cen', 'CEN'), x.cen], [L('eca.records', 'Records'), num(x.records)], [L('eca.size', 'Size'), x.size], [L('col.by', 'By'), x.by],
      [L('col.created', 'Created'), dateTime(x.createdAt)], [L('eca.sha', 'SHA-256 checksum'), x.sha256 ? h('code.rms-hash', x.sha256) : '—'],
    ], 2),
    h('h3.rms-h3', L('eca.steps', 'Steps')), stepsList(x),
    errs ? h('div', h('h3.rms-h3', L('eca.errors', 'Validation errors')), h('table.rms-mini', h('thead', h('tr', h('th', L('eca.rule', 'Check')), h('th.is-right', L('eca.count', 'Records')))), h('tbody', errs.map((e) => h('tr', h('td', e[0]), h('td.is-right', String(e[1]))))))) : null,
    x.copies ? note(L('eca.copies', 'Copies delivered to Nodal RRB ({n}) on {a} and RRB/SC on {b}.', { n: rrbName(x.nodal || 'MAS'), a: dateTime(x.copies.nodal), b: dateTime(x.copies.rrbsc) }), 'info') : null,
    x.rerun ? note(L('eca.rerunOf', 'Re-run as {id}.', { id: x.rerun }), 'info') : null),
  actions });
}

function acknowledge(x) {
  const now = new Date().toISOString();
  x.status = 'Acknowledged by ECA';
  x.steps.push({ name: 'ECA checksum acknowledgement', at: now, ok: true, note: L('eca.ackMatch', 'checksum matched') });
  log(who(), role(), 'ECA acknowledged transfer', 'ECA transfer', x.id, x.sha256.slice(0, 16) + '…');
  save();
  ok(L('eca.acked', '{id} acknowledged by ECA; checksums match.', { id: x.id }));
}

function runTransfer(o, redraw) {
  const ds = DATASETS.filter((d) => d.name === o.dataset)[0] || DATASETS[0];
  const records = ds.name.indexOf('Debar') === 0 ? all('debar').filter((d) => d.status === 'Active').length : (o.rerunOf ? ds.records - 3 : ds.records);
  const id = newId('eca', 'eca', (n) => 'ECA-' + (o.cen === 'CEN 07/2026' ? '07' : '04') + pad(n, 2));
  const list = h('ol.rms-checklist');
  const status = h('p.rms-small', L('eca.running', 'Running…'));
  const plan = [
    { name: 'Schema & count validation', note: L('eca.n.valid', '{n} records, 0 errors', { n: num(records) }) },
    { name: 'SHA-256 checksum computed' },
    { name: 'Encrypted (AES-256, ECA public key)' },
    { name: 'Transferred over ' + ds.channel },
    { name: 'Copies to Nodal RRB and RRB/SC' },
  ];
  const x = { id, cen: o.cen, direction: 'Outbound', dataset: ds.name, records, size: ds.size, channel: ds.channel, status: 'In progress', sha256: '', createdAt: new Date().toISOString(), by: who(), steps: [], nodal: 'MAS' };
  let i = 0;
  let closed = false;
  const dlg = modal({ title: L('eca.sending', 'Sending {d}', { d: ds.name }), body: h('div', list, status), actions: [{ label: L('ui.close', 'Close'), kind: 'plain', value: false }] });
  dlg.then(() => { closed = true; });
  const tick = () => {
    if (i >= plan.length) {
      x.status = 'Awaiting acknowledgement';
      x.copies = { nodal: new Date().toISOString(), rrbsc: new Date().toISOString() };
      insert('eca', x);
      if (o.rerunOf) { const old = byId('eca', o.rerunOf); if (old) old.rerun = id; }
      log(who(), role(), 'ECA transfer sent', 'ECA transfer', id, ds.name + ' · ' + records + ' records');
      save();
      mount(status, note(L('eca.sent', 'Sent as {id}. ECA acknowledges by returning the same checksum; use "Check acknowledgement" on the transfer.', { id }), 'success'));
      if (redraw) redraw();
      return;
    }
    const p = plan[i];
    const at = new Date().toISOString();
    if (i === 1) {
      x.sha256 = hashOf([id, o.cen, ds.name, records, at].join('|'));
      p.note = x.sha256.slice(0, 20) + '…';
    }
    x.steps.push({ name: p.name, at, ok: true, note: p.note || '' });
    list.appendChild(h('li.rms-checklist__item.is-ok', icon('check', 16), h('span', p.name), p.note ? h('span.rms-small.rms-muted', ' · ' + p.note) : null));
    i++;
    setTimeout(tick, closed ? 0 : 450);
  };
  setTimeout(tick, 300);
}

route('/eca', null, (root) => {
  const draw = () => {
    mount(root);
    const rows = all('eca');
    root.appendChild(head({
      title: L('eca.title', 'ECA data exchange'),
      sub: L('eca.sub', 'Files exchanged with the examination conducting agency. Each outbound file is validated, checksummed (SHA-256), encrypted and sent; ECA acknowledges by checksum. Copies go to the Nodal RRB and RRB/SC.'),
      sow: '2.5',
      actions: is('rrb', 'ms') ? [btn(L('eca.new', 'New outbound transfer'), { icon: 'upload', onClick: () => newTransfer(draw) })] : [],
    }));
    root.appendChild(stats([
      stat(L('eca.total', 'Transfers'), rows.length),
      stat(L('eca.acked2', 'Acknowledged'), rows.filter((x) => x.status === 'Acknowledged by ECA').length, { tone: 'ok' }),
      stat(L('eca.awaiting', 'Awaiting acknowledgement'), rows.filter((x) => x.status === 'Awaiting acknowledgement').length, { tone: 'warn' }),
      stat(L('eca.failed', 'Failed validation'), rows.filter((x) => x.status === 'Validation failed' && !x.rerun).length, { tone: 'danger' }),
      stat(L('eca.inbound', 'Inbound files'), rows.filter((x) => x.direction === 'Inbound').length, { tone: 'navy' }),
    ]));
    root.appendChild(table({
      rows,
      exportName: 'eca-transfers',
      columns: [
        { key: 'id', label: L('col.transfer', 'Transfer'), render: (x) => h('a.rms-link', { href: 'javascript:void 0', onclick: (e) => { e.preventDefault(); detail(x, draw); } }, x.id) },
        { key: 'cen', label: L('col.cen', 'CEN'), nowrap: true },
        { key: 'direction', label: L('eca.direction', 'Direction') },
        { key: 'dataset', label: L('eca.dataset', 'Dataset') },
        { key: 'records', label: L('eca.records', 'Records'), align: 'right', value: (x) => num(x.records), sortValue: (x) => x.records },
        { key: 'channel', label: L('eca.channel', 'Channel') },
        { key: 'sha256', label: L('eca.shaShort', 'Checksum'), value: (x) => (x.sha256 ? x.sha256.slice(0, 12) + '…' : '—') },
        { key: 'status', label: L('col.status', 'Status'), render: (x) => h('span', badge(x.status), x.rerun ? h('span.rms-small.rms-muted', ' → ' + x.rerun) : null), value: (x) => x.status },
        { key: 'createdAt', label: L('col.date', 'Date'), nowrap: true, value: (x) => date(x.createdAt), sortValue: (x) => x.createdAt },
      ],
      filters: [{ key: 'direction', label: L('eca.direction', 'Direction'), options: ['Outbound', 'Inbound'] }, { key: 'cen', label: L('col.cen', 'CEN'), options: ['CEN 07/2026', 'CEN 04/2026'] }],
      onRow: (x) => detail(x, draw),
      sort: 'createdAt',
      dir: -1,
    }));
    root.appendChild(card(L('eca.rules', 'Exchange rules'), h('ul.rms-list',
      h('li', L('eca.r1', 'Only the RRB (dealing assistant or Member Secretary) can start an outbound transfer; every step is written to the activity log.')),
      h('li', L('eca.r2', 'Files are encrypted with the ECA public key before transfer and are never sent over e-mail.')),
      h('li', L('eca.r3', 'ECA must acknowledge with the same SHA-256 checksum; a mismatch blocks the CEN until the file is re-sent.')),
      h('li', L('eca.r4', 'The result file from ECA is imported and validated in Results & merit validation.')))));
  };
  draw();
});

function newTransfer(redraw) {
  const f = form([
    field({ name: 'cen', type: 'select', label: L('col.cen', 'CEN'), required: true, value: 'CEN 07/2026', options: ['CEN 07/2026'] }),
    field({ name: 'dataset', type: 'select', label: L('eca.dataset', 'Dataset'), required: true, options: DATASETS.map((d) => d.name) }),
  ], 1);
  modal({ title: L('eca.new', 'New outbound transfer'), body: h('div', note(L('eca.newNote', 'The file is built from RMS data at this moment. Validation runs before anything leaves RMS.'), 'info'), f.node), actions: [
    { label: L('eca.start', 'Validate & send'), onClick: () => { if (!f.validate()) return false; const v = f.values(); setTimeout(() => runTransfer(v, redraw), 50); return true; } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}
