// SOW 2.14: integrity alerts raised by the checks (face match below threshold, Aadhaar failure,
// duplicate identity across CENs, debar-list match, signature mismatch) and their resolution.
import { h, mount } from '../core/h.js';
import { route, go, query } from '../core/router.js';
import { all, byId, save, log, candidate } from '../core/store.js';
import { role, who, is } from '../core/session.js';
import { head, card, kv, btn, link, note, stats, stat, grid, split } from '../ui/page.js';
import { table } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { ok, remarks, confirm, otp } from '../ui/dialogs.js';
import { history } from '../ui/timeline.js';
import { portrait, signature } from '../ui/photo.js';
import { hbars } from '../ui/charts.js';
import { candLink, catLabel } from './common.js';
import { debarMatches } from './debar.js';
import { liveSeed } from './dv.js';
import { date, dateTime } from '../core/format.js';
import { L } from '../i18n.js';

route('/fraud', null, (root) => {
  const q = query();
  const list = all('alerts');
  root.appendChild(head({
    title: L('frd.title', 'Integrity alerts'),
    sub: L('frd.sub', 'Raised automatically by the identity checks at DV, the debar screening and the duplicate check across CENs. Every alert is cleared, escalated or referred to the debar register with reasons.'),
    sow: '2.14',
  }));
  root.appendChild(stats([
    stat(L('frd.open', 'Open'), list.filter((a) => a.status === 'Open').length, { tone: 'danger' }),
    stat(L('frd.review', 'Under review / escalated'), list.filter((a) => /Under review|Escalated/.test(a.status)).length, { tone: 'warn' }),
    stat(L('frd.cleared', 'Cleared'), list.filter((a) => a.status === 'Cleared').length, { tone: 'ok' }),
    stat(L('frd.debar', 'Referred to debar'), list.filter((a) => a.status === 'Referred to debar').length),
  ]));
  const types = list.map((a) => a.type).filter((x, k, a) => a.indexOf(x) === k);
  root.appendChild(grid(2, [
    card(L('frd.byType', 'Alerts by type'), hbars(types.map((t) => ({ label: t, value: list.filter((a) => a.type === t).length })), { labelWidth: 220, title: L('frd.byType', 'Alerts by type'), labelHead: L('col.type', 'Type') })),
    card(L('frd.how', 'How alerts are raised'), h('ul.rms-list',
      h('li', L('frd.h1', 'Live photograph at DV compared with the application photograph; below the threshold set by the Member Secretary.')),
      h('li', L('frd.h2', 'Aadhaar face authentication at DV returns no match.')),
      h('li', L('frd.h3', 'Same Aadhaar token appears under another name or date of birth in any CEN.')),
      h('li', L('frd.h4', 'Name, father’s name, date of birth and ID digits match an active debar record.')),
      h('li', L('frd.h5', 'Signature at DV differs from the signature in the application.')))),
  ]));
  root.appendChild(table({ rows: list, exportName: 'integrity-alerts', sort: 'at', dir: -1, columns: [
    { key: 'id', label: L('col.alert', 'Alert'), render: (a) => link(a.id, '/fraud/' + a.id) },
    { key: 'type', label: L('col.type', 'Type') },
    { key: 'roll', label: L('col.roll', 'Roll no.'), render: (a) => candLink(a.roll) },
    { key: 'cen', label: L('col.cen', 'CEN'), nowrap: true },
    { key: 'score', label: L('frd.score', 'Score'), align: 'right', value: (a) => (a.score != null ? a.score.toFixed(3) : '—') },
    { key: 'at', label: L('col.date', 'Date'), nowrap: true, value: (a) => date(a.at), sortValue: (a) => a.at },
    { key: 'status', label: L('col.status', 'Status'), render: (a) => badge(a.status), value: (a) => a.status },
  ], filters: [{ key: 'status', label: L('col.status', 'Status'), options: ['Open', 'Under review', 'Escalated', 'Cleared', 'Referred to debar'], value: q.status || '' }, { key: 'type', label: L('col.type', 'Type'), options: types }], onRow: (a) => go('/fraud/' + a.id), rowClass: (a) => (a.status === 'Open' ? 'is-flagged' : null) }));
});

route('/fraud/:id', null, (root, prm) => {
  const draw = () => {
    mount(root);
    const a = byId('alerts', prm.id);
    if (!a) { root.appendChild(head({ title: L('frd.notFound', 'Alert not found') })); return; }
    const c = candidate(a.roll);
    const canAct = is('rrb', 'ms', 'chair') && a.status !== 'Cleared' && a.status !== 'Referred to debar';
    const act = (status, label, kind, needOtp) => btn(label, { kind, onClick: () => remarks({ title: label + ' · ' + a.id, required: true, ok: label, kind: kind === 'plain' ? 'danger' : kind }).then((t) => {
      if (t === null) return;
      const fin = () => {
        const now = new Date().toISOString();
        a.status = status;
        a.history.push({ at: now, by: who(), role: role(), action: status, remarks: t });
        if (status === 'Candidature withheld' && c) { c.withheld = { at: now, by: who(), reason: t, alert: a.id }; c.stage = 'Candidature withheld'; }
        log(who(), role(), 'Alert ' + status.toLowerCase(), 'Integrity alert', a.id, t);
        save();
        ok(L('frd.done', '{id}: {s}', { id: a.id, s: status }));
        draw();
      };
      if (needOtp) otp({ title: L('ind.esign', 'Aadhaar e-Sign (demo)') }).then((y) => { if (y) fin(); }); else fin();
    }) });
    const actions = [];
    if (canAct) {
      actions.push(act('Cleared', L('frd.clear', 'Clear'), 'ok'));
      if (a.status !== 'Escalated' && !is('chair')) actions.push(act('Escalated', L('frd.escalate', 'Escalate'), 'plain'));
      if (is('rrb')) actions.push(btn(L('rep.toDebar', 'Refer to debar'), { kind: 'plain', onClick: () => confirm(L('frd.toDebarQ', 'Open a debar record prefilled from this alert?')).then((y) => { if (y) go('/debar/new?roll=' + a.roll + '&alert=' + a.id); }) }));
      if (is('ms', 'chair') && c && !c.withheld) actions.push(act('Candidature withheld', L('frd.withhold', 'Withhold candidature'), 'plain', true));
    }
    root.appendChild(head({ title: a.type, sub: a.id + ' · ' + a.roll + (c ? ' · ' + c.name : ''), crumbs: [{ label: L('frd.title', 'Integrity alerts'), href: '/fraud' }, { label: a.id }], actions, sow: '2.14' }));
    root.appendChild(h('div.rms-toolbar', badge(a.status), c && c.withheld ? badge('Candidature withheld') : null, h('span.rms-small.rms-muted', L('frd.raised', 'Raised {d}', { d: dateTime(a.at) }))));
    root.appendChild(note(a.detail, a.status === 'Cleared' ? 'success' : 'warning'));
    if (c) {
      const photos = [portrait(c.photo, { size: 110, caption: L('dv.photoApp', 'Application photograph') })];
      if (c.dv && c.dv.status === 'Completed') photos.push(portrait(liveSeed(c, c.dv.face), { size: 110, variant: 'live', caption: L('dv.photoLive', 'Live at DV') }));
      if (c.dv && c.dv.aadhaar === 'Matched') photos.push(portrait(c.photo, { size: 110, variant: 'aadhaar', caption: L('dv.photoAadhaar', 'Aadhaar') }));
      const side = [];
      if (/Duplicate/.test(a.type)) {
        const other = all('candidates').filter((x) => x.id !== c.id && x.aadhaar.token === c.aadhaar.token)[0];
        if (other) side.push(card(L('frd.other', 'Other record with the same Aadhaar token'), split(kv([[L('col.roll', 'Roll no.'), candLink(other.id)], [L('col.name', 'Name'), other.name], [L('col.dob', 'Date of birth'), date(other.dob)], [L('col.cen', 'CEN'), other.cen], [L('col.stage', 'Stage'), other.stage]]), portrait(other.photo, { size: 100, caption: other.cen }))));
      }
      if (/Debar/.test(a.type)) {
        const m = debarMatches({ name: c.name, father: c.father, dob: c.dob, last4: c.aadhaar.last4 })[0];
        if (m) side.push(card(L('frd.debarRec', 'Matching debar record'), split(kv([[L('col.record', 'Record'), link(m.d.id, '/debar/' + m.d.id)], [L('col.name', 'Name'), m.d.name], [L('col.reason', 'Reason'), m.d.reason], [L('col.period', 'Period'), m.d.period + (m.d.to ? ' (' + L('debar.till', 'till {d}', { d: date(m.d.to) }) + ')' : '')], [L('debar.col.why', 'Matched on'), m.why.join(', ')]]), portrait(m.d.photo, { size: 100, caption: L('debar.photo', 'Photograph on record') }))));
      }
      if (/Signature/.test(a.type)) side.push(card(L('frd.sigs', 'Signatures'), h('div.rms-photos', signature(c.photo, { caption: L('frd.sigApp', 'Application') }), signature(c.photo + 11, { caption: L('frd.sigDv', 'At DV') }))));
      root.appendChild(card(L('frd.candidate', 'Candidate'), split(h('div', h('div.rms-photos', photos), kv([[L('col.roll', 'Roll no.'), candLink(c.id)], [L('col.category', 'Category'), catLabel(c)], [L('col.dob', 'Date of birth'), date(c.dob)], [L('col.stage', 'Stage'), badge(c.stage)], [L('dv.face', 'Face match'), c.dv && c.dv.face != null ? c.dv.face.toFixed(3) : '—'], [L('dv.aadhaar', 'Aadhaar face authentication'), c.dv ? c.dv.aadhaar || '—' : '—']], 2)), h('div', btn(L('dv.trail', 'Identity trail'), { kind: 'plain', icon: 'link', href: '/trail/' + c.id }), c.dv ? h('p', btn(L('frd.toDv', 'DV record'), { kind: 'plain', icon: 'doc', href: '/dv/' + c.id })) : null))));
      side.forEach((x) => root.appendChild(x));
    }
    root.appendChild(card(L('ind.history', 'History'), history(a.history)));
  };
  draw();
});
