// SOW 4.1–4.6: users and role-based access, integrations, the tamper-evident activity log,
// disaster recovery and backups, and data retention with offline handover.
import { h, mount } from '../core/h.js';
import { route } from '../core/router.js';
import { all, byId, data, save, log, insert, verifyChain, next } from '../core/store.js';
import { role, who, is, roleName, ROLES, ROLE_ORDER } from '../core/session.js';
import { head, card, kv, tabs, btn, note, stats, stat, grid } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, fail, otp, confirm, remarks } from '../ui/dialogs.js';
import { menuAll } from '../nav.js';
import { rrbName, zoneName, hospitalName, newId } from './common.js';
import { chainHash } from '../core/chain.js';
import { sha256Hex } from '../core/sha256.js';
import { date, dateTime, ago, num } from '../core/format.js';
import { L } from '../i18n.js';

// ------------------------------------------------------------------ users & roles
function scopeOf(u) {
  if (u.hospital) return hospitalName(u.hospital);
  if (u.unit) return u.unit;
  if (u.zone && u.role === 'cpo') return zoneName(u.zone);
  if (u.rrb) return rrbName(u.rrb);
  return '—';
}

route('/users', null, (root) => {
  let tab = 'users';
  const draw = () => {
    mount(root);
    const users = all('users');
    root.appendChild(head({ title: L('usr.title', 'Users & roles'), sub: L('usr.sub', 'Accounts for every layer — indenting units, CPOs, RRBs, Nodal RRBs, Railway Board, DV, hospitals, auditors and the helpdesk. Access follows the role; sign-in needs an OTP.'), sow: '4.1',
      actions: [btn(L('usr.add', 'Add user'), { icon: 'plus', onClick: () => addUser(draw) })] }));
    root.appendChild(stats([
      stat(L('usr.active', 'Active users'), users.filter((u) => u.active).length, { tone: 'ok' }),
      stat(L('usr.inactive', 'Deactivated'), users.filter((u) => !u.active).length),
      stat(L('usr.roles', 'Roles'), ROLE_ORDER.length, { tone: 'navy' }),
      stat(L('usr.stale', 'Not signed in for 30 days'), users.filter((u) => u.active && (Date.now() - new Date(u.lastLogin).getTime()) > 30 * 864e5).length, { tone: 'warn' }),
    ]));
    root.appendChild(tabs([{ id: 'users', label: L('usr.tab.users', 'Users'), count: users.length }, { id: 'matrix', label: L('usr.tab.matrix', 'Role permissions') }], tab, (id) => { tab = id; draw(); }));
    if (tab === 'matrix') { root.appendChild(matrix()); return; }
    root.appendChild(table({ rows: users, exportName: 'users', columns: [
      { key: 'name', label: L('col.name', 'Name'), render: (u) => h('span', h('strong', u.name), h('br'), h('span.rms-small.rms-muted', u.title)), value: (u) => u.name + ' ' + u.title },
      { key: 'role', label: L('usr.role', 'Role'), value: (u) => roleName(u.role) },
      { key: 'scope', label: L('usr.scope', 'Scope'), value: scopeOf },
      { key: 'email', label: L('usr.email', 'E-mail') },
      { key: 'mfa', label: L('usr.mfa', 'Second factor'), value: (u) => u.mfa },
      { key: 'lastLogin', label: L('usr.last', 'Last sign-in'), nowrap: true, value: (u) => ago(u.lastLogin), sortValue: (u) => u.lastLogin },
      { key: 'active', label: L('col.status', 'Status'), render: (u) => badge(u.active ? 'Active' : 'Inactive'), value: (u) => (u.active ? 'Active' : 'Inactive') },
      { key: 'act', label: '', action: true, render: (u) => h('span.rms-nowrap',
        btn(u.active ? L('usr.deactivate', 'Deactivate') : L('usr.activate', 'Activate'), { small: true, kind: 'plain', onClick: () => confirm(u.active ? L('usr.deactQ', 'Deactivate {n}? They lose access at once.', { n: u.name }) : L('usr.actQ', 'Activate {n}?', { n: u.name })).then((y) => {
          if (!y) return;
          u.active = !u.active;
          log(who(), role(), u.active ? 'User activated' : 'User deactivated', 'User', u.id, u.name);
          save();
          draw();
        }) }), ' ',
        btn(L('usr.resetMfa', 'Reset OTP device'), { small: true, kind: 'plain', onClick: () => otp({ title: L('usr.resetMfaT', 'Confirm reset for {n}', { n: u.name }) }).then((y) => { if (y) { log(who(), role(), 'Second factor reset', 'User', u.id, u.name); save(); ok(L('usr.mfaDone', 'Reset. {n} registers a new device at the next sign-in.', { n: u.name })); } }) })) },
    ], filters: [{ key: 'role', label: L('usr.role', 'Role'), options: ROLE_ORDER.map((r) => ({ value: r, label: roleName(r) })) }, { key: 'active', label: L('col.status', 'Status'), options: [{ value: 'y', label: L('status.active', 'Active') }, { value: 'n', label: L('status.inactive', 'Inactive') }], match: (u, v) => u.active === (v === 'y') }] }));
  };
  draw();
});

function addUser(redraw) {
  const f = form([
    field({ name: 'name', label: L('col.name', 'Name'), required: true }),
    field({ name: 'title', label: L('usr.titleF', 'Designation'), required: true }),
    field({ name: 'role', type: 'select', label: L('usr.role', 'Role'), required: true, options: ROLE_ORDER.map((r) => ({ value: r, label: roleName(r) })) }),
    field({ name: 'email', label: L('usr.email', 'E-mail'), required: true, pattern: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i, patternMsg: L('usr.emailMsg', 'Enter a valid e-mail address') }),
    field({ name: 'mobile', label: L('usr.mobile', 'Mobile'), required: true, pattern: /^[6-9][0-9]{9}$/, patternMsg: L('usr.mobileMsg', 'Enter a 10-digit mobile number') }),
  ], 2);
  modal({ title: L('usr.add', 'Add user'), body: h('div', f.node, note(L('usr.addNote', 'The user receives an activation link by e-mail and registers an OTP device at first sign-in.'), 'info')), actions: [
    { label: L('ui.save', 'Save'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      if (all('users').some((u) => u.email === v.email)) { fail(L('usr.dup', 'A user with this e-mail already exists.')); return false; }
      const u = Object.assign({ id: newId('users', 'user', (n) => 'U-N' + n), active: true, mfa: 'OTP', lastLogin: new Date().toISOString(), rrb: 'SBC' }, v);
      insert('users', u, true);
      log(who(), role(), 'User created', 'User', u.id, u.name + ' · ' + roleName(u.role));
      save();
      ok(L('usr.added', 'User {n} added.', { n: u.name }));
      redraw();
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

function matrix() {
  const groups = menuAll();
  const headRow = h('tr', h('th', L('usr.screen', 'Screen')), h('th', 'SOW'), ROLE_ORDER.map((r) => h('th.is-center', { title: roleName(r) }, h('span.rms-matrix__role', roleName(r)))));
  const body = [];
  groups.forEach((g) => {
    body.push(h('tr.rms-matrix__group', h('td', { colspan: String(ROLE_ORDER.length + 2) }, g.group)));
    g.items.forEach((it) => body.push(h('tr', h('td', it.label), h('td.rms-small', it.sow || ''), ROLE_ORDER.map((r) => h('td.is-center', it.roles.indexOf(r) >= 0 ? '✓' : '')))));
  });
  const tbl = h('table.rms-mini.rms-matrix', h('thead', headRow), h('tbody', body));
  return card(L('usr.matrixT', 'Screens each role can open'), h('div',
    h('div.rms-table__scroll', tbl),
    h('p.rms-small.rms-muted', L('usr.matrixNote', 'Within a screen, actions are limited further by role and scope (for example, only the Chairperson approves a panel; a unit sees only its own indents).'))));
}

// ------------------------------------------------------------------ integrations
route('/integrations', null, (root) => {
  const draw = () => {
    mount(root);
    const ints = all('integrations');
    root.appendChild(head({ title: L('int.title', 'Integrations'), sub: L('int.sub', 'Connections to the examination agency, Aadhaar authentication, face matching, HMIS, HRMS, DigiLocker, SMS and e-mail gateways. Every message is logged.'), sow: '4.2' }));
    root.appendChild(stats([
      stat(L('int.ok', 'Operational'), ints.filter((x) => x.status === 'Operational').length, { tone: 'ok' }),
      stat(L('int.degraded', 'Degraded'), ints.filter((x) => x.status === 'Degraded').length, { tone: 'warn' }),
      stat(L('int.down', 'Down'), ints.filter((x) => x.status === 'Down').length, { tone: 'danger' }),
      stat(L('int.msgs', 'Messages today'), all('intLog').filter((x) => x.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, { tone: 'navy' }),
    ]));
    root.appendChild(grid(3, ints.map((x) => card(x.name, h('div',
      h('div.rms-toolbar', badge(x.status), h('span.rms-small.rms-muted', x.mode)),
      kv([[L('int.owner', 'Owner'), x.owner], [L('int.last', 'Last message'), ago(x.last)], [L('int.success', 'Success / failed (7 days)'), num(x.ok) + ' / ' + num(x.fail)], [L('int.latency', 'Average response'), x.latency + ' ms']]),
      is('admin') ? btn(L('int.test', 'Test connection'), { small: true, kind: 'plain', onClick: () => test(x, draw) }) : null)))));
    root.appendChild(card(L('int.log', 'Message log'), table({ rows: all('intLog'), exportName: 'integration-log', sort: 'at', dir: -1, columns: [
      { key: 'at', label: L('col.date', 'Date'), nowrap: true, value: (x) => dateTime(x.at), sortValue: (x) => x.at },
      { key: 'system', label: L('int.system', 'System') },
      { key: 'direction', label: L('eca.direction', 'Direction') },
      { key: 'message', label: L('ntf.subject', 'Message') },
      { key: 'ref', label: L('col.ref', 'Ref.') },
      { key: 'status', label: L('col.status', 'Status'), render: (x) => badge(x.status), value: (x) => x.status },
    ], filters: [{ key: 'system', label: L('int.system', 'System'), options: ints.map((x) => x.id) }, { key: 'status', label: L('col.status', 'Status'), options: ['OK', 'Retry', 'Failed'] }] })));
  };
  draw();
});

function test(x, redraw) {
  const now = new Date().toISOString();
  const okd = x.status !== 'Down';
  x.last = now;
  x.ok += okd ? 1 : 0;
  x.fail += okd ? 0 : 1;
  insert('intLog', { id: newId('intLog', 'intlog', (n) => 'IL-' + (9000 + n)), system: x.id, direction: 'Outbound', message: 'Connection test (heartbeat)', status: okd ? 'OK' : 'Failed', at: now, ref: 'MSG-' + (100000 + next('msg') * 7) });
  log(who(), role(), 'Integration tested', 'Integration', x.id, okd ? 'OK' : 'Failed');
  save();
  if (okd) ok(L('int.testOk', '{n}: responded in {ms} ms.', { n: x.name, ms: x.latency })); else fail(L('int.testFail', '{n} did not respond.', { n: x.name }));
  redraw();
}

// ------------------------------------------------------------------ activity log
route('/audit-log', null, (root) => {
  let result = null;
  const draw = () => {
    mount(root);
    const list = all('audit');
    root.appendChild(head({ title: L('aud.logTitle', 'Activity log'), sub: L('aud.logSub', 'Every action in RMS, in order. Each entry carries the SHA-256 hash of the previous entry, so changing or deleting any entry breaks the chain from that point.'), sow: '4.3',
      actions: [btn(L('aud.verify', 'Verify chain'), { icon: 'shield', onClick: () => { result = verifyChain(); log(who(), role(), 'Activity log verified', 'Activity log', '', result.ok ? 'intact' : 'broken at ' + result.at); save(); draw(); } }),
        btn(L('aud.tamper', 'Simulate tampering'), { kind: 'plain', onClick: tamper })] }));
    if (result) root.appendChild(result.ok ? note(L('aud.intact', 'Chain intact: {n} entries checked, every hash matches.', { n: num(result.checked) }), 'success') : note(L('aud.broken', 'Chain broken at entry {s}: the stored hash does not match the content. Entries from there on cannot be trusted.', { s: result.at }), 'danger'));
    root.appendChild(stats([stat(L('aud.entries', 'Entries'), num(list.length)), stat(L('aud.today', 'Today'), list.filter((e) => e.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, { tone: 'navy' }), stat(L('aud.actors', 'People and systems'), list.map((e) => e.actor).filter((x, k, a) => a.indexOf(x) === k).length)]));
    root.appendChild(table({ rows: list, exportName: 'activity-log', pageSize: 15, columns: [
      { key: 'seq', label: '#', align: 'right' },
      { key: 'at', label: L('col.date', 'Date'), nowrap: true, value: (e) => dateTime(e.at), sortValue: (e) => e.seq },
      { key: 'actor', label: L('col.by', 'By'), render: (e) => h('span', e.actor, h('br'), h('span.rms-small.rms-muted', roleName(e.role))) , value: (e) => e.actor + ' ' + roleName(e.role) },
      { key: 'action', label: L('trl.action', 'Action') },
      { key: 'entity', label: L('aud.entity', 'Record'), value: (e) => e.entity + (e.ref ? ' · ' + e.ref : '') },
      { key: 'detail', label: L('aud.detailCol', 'Detail') },
      { key: 'hash', label: L('aud.hash', 'Hash'), render: (e) => h('code.rms-hash', { title: e.hash }, e.hash.slice(0, 10) + '…'), value: (e) => e.hash },
    ], filters: [{ key: 'role', label: L('usr.role', 'Role'), options: ROLE_ORDER.map((r) => ({ value: r, label: roleName(r) })).concat([{ value: 'system', label: roleName('system') }]) }, { key: 'entity', label: L('aud.entity', 'Record'), options: list.map((e) => e.entity).filter((x, k, a) => a.indexOf(x) === k).sort() }] }));
  };
  // Demonstration only: works on a copy, never on the stored log.
  function tamper() {
    const copy = JSON.parse(JSON.stringify(all('audit'))).reverse();
    const victim = copy[Math.floor(copy.length / 2)];
    const before = victim.detail;
    victim.detail = (victim.detail || '') + ' (edited)';
    let prev = '0'.repeat(64);
    let brokeAt = null;
    for (let i = 0; i < copy.length; i++) {
      if (copy[i].prev !== prev || chainHash(prev, copy[i]) !== copy[i].hash) { brokeAt = copy[i].seq; break; }
      prev = copy[i].hash;
    }
    modal({ title: L('aud.tamper', 'Simulate tampering'), body: h('div',
      h('p', L('aud.tamperText', 'A copy of the log was taken and entry {s} was edited ("{a}" → "{b}"). Verification on the copy:', { s: victim.seq, a: before || '—', b: victim.detail })),
      note(L('aud.tamperResult', 'Detected at entry {s}: its content no longer produces the stored hash, and every later entry depends on it.', { s: brokeAt }), 'danger'),
      h('p.rms-small.rms-muted', L('aud.tamperNote', 'The stored log was not changed.'))), actions: [{ label: L('ui.close', 'Close'), kind: 'plain', value: false }] });
  }
  draw();
});

// ------------------------------------------------------------------ system & DR
route('/system', null, (root) => {
  const draw = () => {
    mount(root);
    const s = data().system;
    root.appendChild(head({ title: L('sys.title', 'System & disaster recovery'), sub: L('sys.sub', 'Primary and disaster-recovery sites on Government Community Cloud, replication, backups and the last recovery drill.'), sow: '4.4',
      actions: is('admin') ? [btn(L('sys.drill', 'Run DR drill (simulated)'), { icon: 'refresh', onClick: () => drill(s, draw) })] : [] }));
    root.appendChild(stats([
      stat(L('sys.rto', 'Recovery time objective'), s.rtoMin + ' min', { tone: 'navy' }),
      stat(L('sys.rpo', 'Replication interval'), s.replicationMin + ' min'),
      stat(L('sys.drillRto', 'Last drill restored in'), s.drillRto + ' min', { tone: s.drillRto <= s.rtoMin ? 'ok' : 'danger' }),
      stat(L('sys.lastSync', 'Last sync to DR'), ago(s.dr.lastSync)),
    ]));
    root.appendChild(grid(2, [
      card(L('sys.primary', 'Primary site'), h('div', badge(s.primary.status), kv([[L('sys.site', 'Site'), s.primary.site], [L('sys.since', 'Active since'), dateTime(s.primary.since)]]))),
      card(L('sys.dr', 'Disaster-recovery site'), h('div', badge(s.dr.status), kv([[L('sys.site', 'Site'), s.dr.site], [L('sys.lastSync', 'Last sync to DR'), dateTime(s.dr.lastSync)]]))),
    ]));
    root.appendChild(card(L('sys.backups', 'Backups'), table({ rows: s.backups, search: false, paged: false, columns: [
      { key: 'name', label: L('sys.backup', 'Backup') }, { key: 'last', label: L('sys.last', 'Last run'), value: (b) => dateTime(b.last) }, { key: 'size', label: L('eca.size', 'Size'), align: 'right' }, { key: 'status', label: L('col.status', 'Status'), render: (b) => badge(b.status) },
    ] })));
    root.appendChild(card(L('sys.lastDrill', 'Last drill'), h('p', dateTime(s.lastDrill) + ' · ' + s.drillNote)));
  };
  draw();
});

function drill(s, redraw) {
  confirm(L('sys.drillQ', 'Start a simulated switchover to the DR site? Nothing is actually switched in the demo.')).then((y) => {
    if (!y) return;
    const steps = [L('sys.d1', 'Freeze writes on primary'), L('sys.d2', 'Final replication to DR'), L('sys.d3', 'Promote DR database'), L('sys.d4', 'Switch DNS and load balancer'), L('sys.d5', 'Smoke tests: sign-in, DV desk, HMIS, ECA')];
    const list = h('ol.rms-checklist');
    const dlg = modal({ title: L('sys.drill', 'Run DR drill (simulated)'), body: list, actions: [{ label: L('ui.close', 'Close'), kind: 'plain', value: false }] });
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        const mins = 24 + (next('drill') % 9);
        s.lastDrill = new Date().toISOString();
        s.drillRto = mins;
        s.drillNote = L('sys.drillNote', 'Simulated switchover from the console; {m} min to restore all services.', { m: mins });
        s.dr.lastSync = new Date().toISOString();
        log(who(), role(), 'DR drill run', 'System', '', mins + ' min');
        save();
        list.appendChild(h('li', note(L('sys.drillDone', 'All services restored on the DR site in {m} minutes (objective {o}).', { m: mins, o: s.rtoMin }), 'success')));
        redraw();
        return;
      }
      list.appendChild(h('li.rms-checklist__item.is-ok', h('span', '✓ ' + steps[i])));
      i++;
      setTimeout(tick, 350);
    };
    tick();
    void dlg;
  });
}

// ------------------------------------------------------------------ retention & handover
route('/retention', null, (root) => {
  const draw = () => {
    mount(root);
    const s = data().system;
    root.appendChild(head({ title: L('ret.title', 'Data retention & handover'), sub: L('ret.sub', 'Live data for each CEN is kept for the period in the policy, then moved to backup. When the period ends, an encrypted offline package with a manifest of checksums is prepared and handed over to the RRB.'), sow: '4.6' }));
    root.appendChild(table({ rows: s.retention, search: false, paged: false, columns: [
      { key: 'cen', label: L('col.cen', 'CEN'), nowrap: true },
      { key: 'live', label: L('ret.live', 'Live data') },
      { key: 'backup', label: L('ret.backup', 'Backup') },
      { key: 'handover', label: L('ret.handover', 'Offline handover'), render: (r) => badge(r.handover === 'Not due' ? 'Not due' : (r.package ? 'Handed over' : 'Due — prepare offline package'), r.package ? L('ret.handed', 'Handed over · {p}', { p: r.package.id }) : r.handover), value: (r) => r.handover },
      { key: 'act', label: '', action: true, render: (r) => (/Due/.test(r.handover) && !r.package && is('admin') ? btn(L('ret.prepare', 'Prepare package'), { small: true, onClick: () => prepare(r, draw) }) : (r.package ? btn(L('ret.manifest', 'Manifest'), { small: true, kind: 'plain', onClick: () => manifest(r.package) }) : null)) },
    ] }));
    root.appendChild(card(L('ret.policy', 'Policy'), h('ul.rms-list',
      h('li', L('ret.p1', 'Live: two years from the last panel of the CEN, or until all court cases are closed.')),
      h('li', L('ret.p2', 'Backup: five years from the first panel.')),
      h('li', L('ret.p3', 'Handover: encrypted offline media with a SHA-256 manifest, signed by the RRB and the vendor; the online copy is then purged and the purge recorded in the activity log.')))));
  };
  draw();
});

function prepare(r, redraw) {
  otp({ title: L('ret.sign', 'Sign the handover package for {c}', { c: r.cen }) }).then((y) => {
    if (!y) return;
    const files = [['candidates.csv.enc', '18.4 MB'], ['dv-dossiers.tar.enc', '3.1 GB'], ['medical-certificates.tar.enc', '1.2 GB'], ['panels-and-offers.csv.enc', '2.2 MB'], ['activity-log.jsonl.enc', '96.0 MB']];
    const pkg = { id: 'HOV-' + r.cen.replace(/\D/g, ''), at: new Date().toISOString(), by: who(), files: files.map((f) => ({ name: f[0], size: f[1], sha256: sha256Hex(new TextEncoder().encode(r.cen + '|' + f[0])) })) };
    r.package = pkg;
    r.handover = 'Handed over';
    log(who(), role(), 'Offline handover package prepared', 'Retention', r.cen, pkg.id);
    save();
    manifest(pkg);
    redraw();
  });
}

function manifest(pkg) {
  modal({ title: L('ret.manifestT', 'Manifest {id}', { id: pkg.id }), wide: true, body: h('div', h('p.rms-small.rms-muted', L('ret.preparedBy', 'Prepared by {b} on {d}', { b: pkg.by, d: dateTime(pkg.at) })),
    h('table.rms-mini', h('thead', h('tr', h('th', L('ret.file', 'File')), h('th.is-right', L('eca.size', 'Size')), h('th', 'SHA-256'))), h('tbody', pkg.files.map((f) => h('tr', h('td', f.name), h('td.is-right', f.size), h('td', h('code.rms-hash', f.sha256))))))),
  actions: [{ label: L('ui.close', 'Close'), kind: 'plain', value: false }] });
}

void ROLES; void remarks; void date; void byId;
