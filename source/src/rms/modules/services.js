// SOW 3.1–3.3: grievances with a 48-hour service level, the helpdesk console and notifications
// (log, templates, bulk messages) across SMS, e-mail and WhatsApp.
import { h, mount } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, save, log, insert, candidate, notify } from '../core/store.js';
import { role, who, is, me } from '../core/session.js';
import { head, card, kv, tabs, btn, link, note, stats, stat, grid, split, empty } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { field, form } from '../ui/form.js';
import { modal, ok, fail, remarks } from '../ui/dialogs.js';
import { history } from '../ui/timeline.js';
import { portrait } from '../ui/photo.js';
import { candLink, catLabel, postName, hospitalName, newId, pad } from './common.js';
import { date, dateTime, iso, hoursBetween } from '../core/format.js';
import { L } from '../i18n.js';

const SLA = 48;
const CATS = ['Result & score', 'DV schedule', 'Medical examination', 'Documents & certificates', 'Panel & allocation', 'Offer & joining', 'Exam centre & admit card', 'Fee refund', 'Others'];
const REPLIES = {
  'DV schedule': 'One change of DV date is allowed for a documented clash. Your new date will be shown in a revised e-call letter.',
  'Medical examination': 'The hospital has sent your result through HMIS; your status will update within one working day.',
  'Documents & certificates': 'Certificates in the state format are accepted if they show the non-creamy-layer status for the year asked in the notice.',
  'Result & score': 'Normalised marks are computed by the formula in the CEN notice; the response sheet shows raw marks only.',
  'Panel & allocation': 'Posts are allotted strictly by merit and preference; higher-ranked candidates in your category took the posts you preferred first.',
  'Offer & joining': 'Your request for extension has been sent to the unit; the decision will be communicated by e-mail.',
};

function answered(g) { return g.history.filter((e) => /Responded|Closed/.test(e.action))[0]; }
function slaState(g) {
  const a = answered(g);
  const hrs = hoursBetween(g.at, a ? a.at : new Date());
  if (a) return { text: hrs <= SLA ? L('grv.inSla', 'Answered in {h} h', { h: Math.round(hrs) }) : L('grv.lateAns', 'Answered late ({h} h)', { h: Math.round(hrs) }), tone: hrs <= SLA ? 'Completed' : 'Pending' };
  const left = SLA - hrs;
  return left >= 0 ? { text: L('grv.left', '{h} h left', { h: Math.round(left) }), tone: left < 12 ? 'Pending' : 'Scheduled' } : { text: L('grv.over', 'Overdue by {h} h', { h: Math.round(-left) }), tone: 'Failed' };
}

route('/grievances', null, (root) => {
  const q = query();
  const draw = () => {
    mount(root);
    const list = all('grievances');
    root.appendChild(head({
      title: L('grv.title', 'Grievances'),
      sub: L('grv.sub', 'Candidate grievances from the portal, e-mail, phone and RRB counters. The helpdesk answers within 48 hours or refers the case to the RRB for a decision.'),
      sow: '3.2',
      actions: is('helpdesk') ? [btn(L('grv.log', 'Log a grievance'), { icon: 'plus', onClick: () => logGrievance(null, draw) })] : [],
    }));
    root.appendChild(stats([
      stat(L('grv.open', 'Open'), list.filter((g) => g.status !== 'Closed').length, { tone: 'navy' }),
      stat(L('grv.overdue', 'Overdue (no answer in 48 h)'), list.filter((g) => !answered(g) && hoursBetween(g.at, new Date()) > SLA).length, { tone: 'danger' }),
      stat(L('grv.awaitRrb', 'Awaiting RRB'), list.filter((g) => g.status === 'Awaiting RRB').length, { tone: 'warn' }),
      stat(L('grv.closed', 'Closed'), list.filter((g) => g.status === 'Closed').length, { tone: 'ok' }),
    ]));
    root.appendChild(table({ rows: list, exportName: 'grievances', sort: 'at', dir: -1, columns: [
      { key: 'id', label: L('col.ref', 'Ref.'), render: (g) => link(g.id, '/grievances/' + g.id) },
      { key: 'name', label: L('col.name', 'Name'), render: (g) => h('span', g.name, h('br'), h('span.rms-small.rms-muted', g.roll)), value: (g) => g.name + ' ' + g.roll },
      { key: 'category', label: L('col.category', 'Category'), render: (g) => h('span', g.category, h('br'), h('span.rms-small', g.subject)), value: (g) => g.category + ' ' + g.subject },
      { key: 'channel', label: L('ntf.channel', 'Channel') },
      { key: 'at', label: L('grv.raised', 'Raised'), nowrap: true, value: (g) => dateTime(g.at), sortValue: (g) => g.at },
      { key: 'sla', label: L('grv.sla', '48-hour target'), render: (g) => { const s = slaState(g); return badge(s.tone, s.text); }, value: (g) => slaState(g).text },
      { key: 'status', label: L('col.status', 'Status'), render: (g) => badge(g.status), value: (g) => g.status },
    ], filters: [
      { key: 'status', label: L('col.status', 'Status'), options: ['New', 'Assigned', 'Awaiting RRB', 'Responded', 'Reopened', 'Closed'], value: q.status || (is('rrb', 'ms') ? 'Awaiting RRB' : '') },
      { key: 'category', label: L('col.category', 'Category'), options: CATS },
      { key: 'channel', label: L('ntf.channel', 'Channel'), options: ['Portal', 'Email', 'Phone', 'RRB-forwarded'] },
    ], onRow: (g) => go('/grievances/' + g.id), rowClass: (g) => (slaState(g).tone === 'Failed' ? 'is-flagged' : null) }));
  };
  draw();
});

function logGrievance(c, redraw) {
  const f = form([
    field({ name: 'roll', label: L('col.roll', 'Roll no.'), required: true, value: c ? c.id : '' }),
    field({ name: 'channel', type: 'select', label: L('ntf.channel', 'Channel'), required: true, value: 'Phone', options: ['Phone', 'Email', 'RRB-forwarded'] }),
    field({ name: 'category', type: 'select', label: L('col.category', 'Category'), required: true, options: CATS }),
    field({ name: 'subject', label: L('grv.subject', 'Subject'), required: true }),
    field({ name: 'text', type: 'textarea', label: L('grv.text', 'What the candidate says'), required: true, wide: true }),
    field({ name: 'solved', type: 'checkbox', label: L('grv.solved', 'Answered on the call (close now)') }),
  ], 2);
  modal({ title: L('grv.log', 'Log a grievance'), body: f.node, actions: [
    { label: L('ui.save', 'Save'), onClick: () => {
      if (!f.validate()) return false;
      const v = f.values();
      const cand = candidate(v.roll.trim());
      if (!cand) { fail(L('grv.noCand', 'No candidate with that roll number.')); return false; }
      const now = new Date().toISOString();
      const g = { id: newId('grievances', 'grievance', (n) => 'GRV-' + pad(5200 + n, 5)), roll: cand.id, name: cand.name, cen: cand.cen, rrb: 'SBC', channel: v.channel, category: v.category, subject: v.subject, text: v.text, status: v.solved ? 'Closed' : 'Assigned', assignee: who(), at: now, priority: 'Normal',
        history: [{ at: now, by: cand.name, role: 'candidate', action: 'Raised via ' + v.channel, text: v.text }, { at: now, by: who(), role: role(), action: v.solved ? 'Closed' : 'Assigned', text: v.solved ? L('grv.onCall', 'Answered on the call.') : '' }] };
      insert('grievances', g);
      log(who(), role(), 'Grievance logged', 'Grievance', g.id, cand.id);
      save();
      ok(L('grv.logged', 'Grievance {id} logged.', { id: g.id }));
      if (redraw) redraw(); else go('/grievances/' + g.id);
      return true;
    } },
    { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
  ] });
}

route('/grievances/:id', null, (root, prm) => {
  const draw = () => {
    mount(root);
    const g = byId('grievances', prm.id);
    if (!g) { root.appendChild(head({ title: L('grv.notFound', 'Grievance not found') })); return; }
    const c = candidate(g.roll);
    const step = (status, action, text) => {
      const now = new Date().toISOString();
      g.status = status;
      g.history.push({ at: now, by: who(), role: role(), action, text: text || '' });
      if (action === 'Responded') { g.respondedAt = now; notify(g.roll, g.channel === 'Email' ? 'Email' : 'SMS', 'Grievance response', g.id + ': ' + g.subject); }
      log(who(), role(), 'Grievance ' + action.toLowerCase(), 'Grievance', g.id, text || '');
      save();
      draw();
    };
    const respond = () => {
      const f = form([field({ name: 'text', type: 'textarea', label: L('grv.reply', 'Reply to the candidate'), required: true, rows: 5, value: REPLIES[g.category] || '' })], 1);
      modal({ title: L('grv.respondT', 'Reply to {n}', { n: g.name }), body: h('div', note(L('grv.replyNote', 'Sent by {c}; the candidate can reopen the case from the portal within 7 days.', { c: g.channel === 'Email' ? 'e-mail' : 'SMS and the portal' }), 'info'), f.node), actions: [
        { label: L('grv.send', 'Send reply'), onClick: () => { if (!f.validate()) return false; step('Responded', 'Responded', f.values().text); ok(L('grv.sent', 'Reply sent.')); return true; } },
        { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
      ] });
    };
    const actions = [];
    if (is('helpdesk')) {
      if (g.status === 'New' || g.status === 'Reopened') actions.push(btn(L('grv.take', 'Assign to me'), { kind: 'plain', onClick: () => { g.assignee = who(); step('Assigned', 'Assigned', ''); } }));
      if (/New|Assigned|Reopened/.test(g.status)) {
        actions.push(btn(L('grv.respond', 'Reply'), { icon: 'send', onClick: respond }));
        actions.push(btn(L('grv.toRrb', 'Refer to RRB'), { kind: 'plain', onClick: () => remarks({ title: L('grv.toRrb', 'Refer to RRB'), label: L('grv.toRrbWhy', 'What the RRB needs to decide'), required: true, ok: L('grv.refer', 'Refer') }).then((t) => { if (t !== null) step('Awaiting RRB', 'Referred to RRB', t); }) }));
      }
      if (g.status === 'Responded') actions.push(btn(L('grv.close', 'Close'), { kind: 'ok', onClick: () => step('Closed', 'Closed', L('grv.closedText', 'Closed after the reply.')) }));
    }
    if (is('rrb', 'ms') && g.status === 'Awaiting RRB') {
      actions.push(btn(L('grv.decide', 'Reply with RRB decision'), { icon: 'send', onClick: respond }));
      actions.push(btn(L('grv.back', 'Return to helpdesk'), { kind: 'plain', onClick: () => remarks({ title: L('grv.back', 'Return to helpdesk'), required: true, ok: L('grv.back', 'Return to helpdesk') }).then((t) => { if (t !== null) step('Assigned', 'Returned to helpdesk', t); }) }));
    }
    const s = slaState(g);
    root.appendChild(head({ title: g.subject, sub: g.id + ' · ' + g.category + ' · ' + g.channel, crumbs: [{ label: L('grv.title', 'Grievances'), href: '/grievances' }, { label: g.id }], actions, sow: '3.2' }));
    root.appendChild(h('div.rms-toolbar', badge(g.status), badge(s.tone, s.text), g.priority === 'High' ? badge('High', L('grv.high', 'High priority')) : null, g.assignee ? h('span.rms-small.rms-muted', L('grv.assignee', 'With {a}', { a: g.assignee })) : null));
    root.appendChild(grid(2, [
      card(L('grv.thread', 'Conversation'), history(g.history, { oldestFirst: true })),
      c ? card(L('grv.cand', 'Candidate'), split(kv([[L('col.roll', 'Roll no.'), candLink(c.id)], [L('col.cen', 'CEN'), c.cen], [L('col.category', 'Category'), catLabel(c)], [L('col.stage', 'Stage'), badge(c.stage)],
        c.dv ? [L('trl.s.dv', 'DV'), date(c.dv.date) + ' ' + c.dv.session + ' · ' + (c.dv.outcome || c.dv.status)] : null, c.medical ? [L('trl.s.med', 'Medical'), hospitalName(c.medical.hospital) + ' · ' + (c.medical.result || c.medical.status)] : null]), portrait(c.photo, { size: 80 }))) : null,
    ]));
  };
  draw();
});

// ------------------------------------------------------------------ helpdesk console
route('/helpdesk', null, (root) => {
  root.appendChild(head({ title: L('hd.title', 'Helpdesk console'), sub: L('hd.sub', 'Look up a caller by roll number, registration number or mobile, answer from their current status, resend messages and log the call.'), sow: '3.3' }));
  const today = iso(new Date());
  const calls = all('grievances').filter((g) => g.channel === 'Phone');
  root.appendChild(stats([
    stat(L('hd.new', 'New grievances'), all('grievances').filter((g) => g.status === 'New' || g.status === 'Reopened').length, { tone: 'warn', href: '/grievances?status=New' }),
    stat(L('hd.calls', 'Calls logged today'), calls.filter((g) => g.at.slice(0, 10) === today).length),
    stat(L('hd.dvTomorrow', 'DV candidates tomorrow'), all('candidates').filter((c) => c.dv && c.dv.status === 'Scheduled' && c.dv.date === iso(new Date(Date.now() + 864e5))).length, { tone: 'navy' }),
    stat(L('hd.failed', 'Failed messages'), all('notifications').filter((n) => n.status === 'Failed').length, { tone: 'danger', href: '/notifications' }),
  ]));
  const out = h('div');
  const input = h('input.field__input', { id: 'hd-q', type: 'search', placeholder: L('hd.ph', 'Roll no., registration no. or mobile'), onkeydown: (e) => { if (e.key === 'Enter') find(); } });
  root.appendChild(card(L('hd.lookup', 'Caller lookup'), h('div', h('div.rms-toolbar', h('label.visually-hidden', { for: 'hd-q' }, L('ui.search', 'Search')), input, btn(L('ui.search', 'Search'), { icon: 'search', onClick: () => find() })), h('p.rms-small.rms-muted', L('hd.try', 'Try 2604020000001379 or 2603020000001268.')))));
  root.appendChild(out);
  root.appendChild(card(L('hd.faq', 'Quick answers'), h('ul.rms-list', Object.keys(REPLIES).map((k) => h('li', h('strong', k + ': '), REPLIES[k])))));
  function find() {
    const t = input.value.trim().toUpperCase();
    const c = all('candidates').filter((x) => x.id === t || x.reg.toUpperCase() === t || x.mobile === t)[0];
    if (!c) { mount(out, note(L('hd.none', 'No candidate found. Check the number with the caller.'), 'warning')); return; }
    log(who(), role(), 'Helpdesk lookup', 'Candidate', c.id, '');
    save();
    const nextStep = c.dv && c.dv.status === 'Scheduled' ? L('hd.nextDv', 'DV on {d} ({s}), reporting {t}', { d: date(c.dv.date), s: c.dv.session, t: c.dv.session === 'FN' ? '08:30' : '13:00' })
      : (c.medical && c.medical.status === 'Referred' ? L('hd.nextMed', 'Medical examination on {d} at {h}', { d: date(c.medical.examDate), h: hospitalName(c.medical.hospital) }) : (c.joining && c.joining.status === 'Offer issued' ? L('hd.nextJoin', 'Offer issued; report to the unit as per the offer') : L('hd.nextNone', 'No upcoming event')));
    const notes = all('notifications').filter((n) => n.roll === c.id).slice(0, 6);
    const open = all('grievances').filter((g) => g.roll === c.id);
    mount(out, card(c.name + ' · ' + c.id, h('div',
      split(kv([[L('col.cen', 'CEN'), c.cen], [L('col.stage', 'Stage'), badge(c.stage)], [L('hd.next', 'Next step'), nextStep], [L('col.category', 'Category'), catLabel(c)], [L('trl.mobile', 'Mobile'), c.mobile.slice(0, 2) + 'XXXXXX' + c.mobile.slice(-2)], [L('dv.prefs', 'Post preferences'), c.prefs.map(postName).join(', ')]], 2), portrait(c.photo, { size: 80 })),
      h('div.rms-toolbar',
        btn(L('hd.logCall', 'Log this call'), { icon: 'plus', onClick: () => logGrievance(c, find) }),
        notes[0] ? btn(L('hd.resend', 'Resend last message ({t})', { t: notes[0].template }), { kind: 'plain', icon: 'refresh', onClick: () => { notify(c.id, 'SMS', notes[0].template, notes[0].subject + ' (resent)'); log(who(), role(), 'Message resent', 'Notification', c.id, notes[0].template); save(); ok(L('hd.resent', 'Message resent by SMS.')); find(); } }) : null,
        btn(L('dv.trail', 'Identity trail'), { kind: 'plain', icon: 'link', href: '/trail/' + c.id })),
      grid(2, [
        card(L('trl.notes', 'Messages sent'), notes.length ? h('table.rms-mini', h('tbody', notes.map((n) => h('tr', h('td.rms-nowrap', date(n.at)), h('td', n.channel), h('td', n.subject), h('td', badge(n.status)))))) : h('p.rms-muted', '—')),
        card(L('hd.grv', 'Grievances'), open.length ? h('ul.rms-list', open.map((g) => h('li', link(g.id, '/grievances/' + g.id), ' · ' + g.subject + ' · ', badge(g.status)))) : h('p.rms-muted', '—')),
      ]))));
  }
});

// ------------------------------------------------------------------ notifications
route('/notifications', null, (root) => {
  let tab = 'log';
  const wrap = h('div');
  root.appendChild(head({ title: L('ntf.title', 'Notifications'), sub: L('ntf.sub', 'Every SMS, e-mail and WhatsApp message sent to candidates, the templates used and bulk messages for a stage.'), sow: '3.1' }));
  root.appendChild(wrap);
  const t = [{ id: 'log', label: L('ntf.tab.log', 'Message log') }, { id: 'templates', label: L('ntf.tab.tpl', 'Templates'), count: all('templates').length }];
  if (is('rrb', 'ms', 'admin')) t.push({ id: 'bulk', label: L('ntf.tab.bulk', 'Send to a group') });
  const draw = () => mount(wrap, tabs(t, tab, (id) => { tab = id; draw(); }), tab === 'log' ? logTable(draw) : (tab === 'templates' ? templates(draw) : bulk(draw)));
  draw();
});

function logTable(redraw) {
  const list = all('notifications');
  return h('div', stats([
    stat(L('ntf.total', 'Messages'), list.length),
    stat(L('ntf.delivered', 'Delivered'), list.filter((n) => n.status === 'Delivered').length, { tone: 'ok' }),
    stat(L('ntf.failed', 'Failed'), list.filter((n) => n.status === 'Failed').length, { tone: 'danger' }),
  ]), table({ rows: list, exportName: 'notifications', sort: 'at', dir: -1, columns: [
    { key: 'id', label: L('col.ref', 'Ref.') },
    { key: 'roll', label: L('col.roll', 'Roll no.'), render: (n) => candLink(n.roll) },
    { key: 'channel', label: L('ntf.channel', 'Channel') },
    { key: 'template', label: L('ntf.template', 'Template') },
    { key: 'subject', label: L('ntf.subject', 'Message') },
    { key: 'at', label: L('col.date', 'Date'), nowrap: true, value: (n) => dateTime(n.at), sortValue: (n) => n.at },
    { key: 'status', label: L('col.status', 'Status'), render: (n) => badge(n.status), value: (n) => n.status },
    { key: 'act', label: '', action: true, render: (n) => (n.status === 'Failed' && is('helpdesk', 'rrb', 'ms', 'admin') ? btn(L('ntf.retry', 'Resend'), { small: true, kind: 'plain', onClick: () => { n.status = 'Delivered'; n.retriedAt = new Date().toISOString(); log(who(), role(), 'Message resent', 'Notification', n.id, n.roll); save(); redraw(); } }) : null) },
  ], filters: [
    { key: 'channel', label: L('ntf.channel', 'Channel'), options: ['SMS', 'Email', 'WhatsApp'] },
    { key: 'status', label: L('col.status', 'Status'), options: ['Delivered', 'Sent', 'Failed'] },
    { key: 'template', label: L('ntf.template', 'Template'), options: list.map((n) => n.template).filter((x, k, a) => a.indexOf(x) === k) },
  ] }));
}

function templates(redraw) {
  const canEdit = is('ms', 'admin');
  return h('div', all('templates').map((tpl) => card(tpl.name, h('div', h('p', tpl.text), h('p.rms-small.rms-muted', L('ntf.channels', 'Channels: {c}', { c: tpl.channels.join(', ') })),
    canEdit ? btn(L('ui.edit', 'Edit'), { small: true, kind: 'plain', onClick: () => {
      const f = form([field({ name: 'text', type: 'textarea', label: L('ntf.text', 'Text'), value: tpl.text, rows: 5, required: true, help: L('ntf.vars', 'Placeholders in braces, e.g. {name}, {cen}, {date}, are filled in for each candidate.') })], 1);
      modal({ title: tpl.name, body: f.node, actions: [{ label: L('ui.save', 'Save'), onClick: () => { if (!f.validate()) return false; tpl.text = f.values().text; log(who(), role(), 'Template changed', 'Notification template', tpl.id, ''); save(); ok(L('ntf.saved', 'Template saved.')); redraw(); return true; } }, { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false }] });
    } }) : null))));
}

function bulk(redraw) {
  const tomorrow = iso(new Date(Date.now() + 864e5));
  const groups = [
    { id: 'dv', label: L('ntf.g.dv', 'DV candidates for tomorrow ({d})', { d: date(tomorrow) }), list: () => all('candidates').filter((c) => c.dv && c.dv.status === 'Scheduled' && c.dv.date === tomorrow), tpl: 'T-DV' },
    { id: 'med', label: L('ntf.g.med', 'Medical examinations tomorrow'), list: () => all('candidates').filter((c) => c.medical && c.medical.status === 'Referred' && c.medical.examDate === tomorrow), tpl: 'T-MED' },
    { id: 'all', label: L('ntf.g.all', 'Everyone in CEN 04/2026 (status update)'), list: () => all('candidates').filter((c) => c.cen === 'CEN 04/2026'), tpl: 'T-RES' },
  ];
  const out = h('div');
  const f = form([
    field({ name: 'group', type: 'select', label: L('ntf.group', 'Who'), required: true, options: groups.map((g) => ({ value: g.id, label: g.label })), onChange: () => preview() }),
    field({ name: 'sms', type: 'checkbox', label: 'SMS', value: true }),
    field({ name: 'email', type: 'checkbox', label: L('ntf.email', 'E-mail'), value: true }),
    field({ name: 'wa', type: 'checkbox', label: 'WhatsApp' }),
  ], 4);
  function preview() {
    const g = groups.filter((x) => x.id === f.get('group').get())[0];
    if (!g) { mount(out); return; }
    const list = g.list();
    const tpl = byId('templates', g.tpl) || all('templates')[0];
    const c = list[0];
    const sample = c ? tpl.text.replace('{name}', c.name).replace('{cen}', c.cen).replace('{date}', c.dv ? date(c.dv.date) : (c.medical ? date(c.medical.examDate) : '')).replace('{session}', c.dv ? c.dv.session : '').replace('{venue}', 'RRB Bengaluru, DV Hall 1') : tpl.text;
    mount(out, note(h('div', h('p', h('strong', L('ntf.recipients', '{n} recipient(s)', { n: list.length }))), h('p', L('ntf.sample', 'Sample: {t}', { t: sample }))), 'info'));
  }
  const box = card(L('ntf.bulkT', 'Send a message to a group'), h('div', f.node, out, h('div.rms-toolbar', btn(L('ntf.send', 'Send'), { icon: 'send', onClick: () => {
    if (!f.validate()) return;
    const v = f.values();
    const g = groups.filter((x) => x.id === v.group)[0];
    const list = g.list();
    const tpl = byId('templates', g.tpl) || all('templates')[0];
    const ch = [v.sms ? 'SMS' : null, v.email ? 'Email' : null, v.wa ? 'WhatsApp' : null].filter(Boolean);
    if (!ch.length) { fail(L('ntf.needCh', 'Pick at least one channel.')); return; }
    if (!list.length) { fail(L('ntf.empty', 'Nobody is in this group right now.')); return; }
    list.forEach((c) => ch.forEach((x) => notify(c.id, x, tpl.name, tpl.name + ', ' + c.cen)));
    log(who(), role(), 'Bulk message sent', 'Notification', tpl.id, list.length + ' recipients · ' + ch.join('/'));
    save();
    ok(L('ntf.sentN', '{n} message(s) queued.', { n: list.length * ch.length }));
    redraw();
  } }))));
  setTimeout(preview, 0);
  return box;
}
