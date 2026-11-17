// Lookups and small shared views used across modules.
import { h } from '../core/h.js';
import { all, byId, candidate, data, next } from '../core/store.js';
import { href } from '../core/router.js';
import { iso } from '../core/format.js';
import { L } from '../i18n.js';

export function postName(id) { const p = byId('posts', id); return p ? p.designation : id; }
export function post(id) { return byId('posts', id); }
export function unitName(id) { const u = byId('units', id); return u ? u.name : id; }
export function rrbName(id) { const r = byId('rrbs', id); return r ? r.name : id; }
export function zoneName(id) { const z = byId('zones', id); return z ? z.name : id; }
export function hospitalName(id) { const x = byId('hospitals', id); return x ? x.name : id; }
export function centreName(id) { const x = byId('centres', id); return x ? x.name : id; }
export function groupName(id) { const g = byId('groups', id); return g ? g.name : id; }

export function candLink(roll, path) {
  const c = candidate(roll);
  return h('a.rms-link', { href: href((path || '/trail/') + roll) }, roll, c ? h('span.rms-muted', ' · ' + c.name) : null);
}

export function catLabel(c) {
  const bits = [c.cat];
  if (c.pwbd) bits.push('PwBD-' + c.pwbd.type + (c.pwbd.sub ? ' (' + c.pwbd.sub + ')' : ''));
  if (c.exsm) bits.push('ExSM');
  return bits.join(' · ');
}

export function scheduleSteps() {
  const sched = data().schedule;
  const today = iso(new Date());
  return sched.steps.map((st) => ({
    label: st.label,
    note: st.from.slice(8, 10) + '/' + st.from.slice(5, 7) + ' – ' + st.to.slice(8, 10) + '/' + st.to.slice(5, 7),
    state: today > st.to ? 'done' : (today >= st.from ? 'active' : 'todo'),
  }));
}

export function pipeline(cen) {
  const c = all('candidates').filter((x) => x.cen === cen);
  const n = (fn) => c.filter(fn).length;
  return [
    { key: 'result', label: L('pipe.result', 'In result list'), value: c.length },
    { key: 'shortlist', label: L('pipe.shortlist', 'Called for DV'), value: n((x) => !!x.dv) },
    { key: 'dvdone', label: L('pipe.dvdone', 'DV completed'), value: n((x) => x.dv && x.dv.status === 'Completed') },
    { key: 'dvok', label: L('pipe.dvok', 'Recommended at DV'), value: n((x) => x.dv && x.dv.outcome === 'Recommended') },
    { key: 'medref', label: L('pipe.medref', 'Sent for medical'), value: n((x) => !!x.medical) },
    { key: 'fit', label: L('pipe.fit', 'Medically fit'), value: n((x) => x.medical && x.medical.result === 'Fit') },
    { key: 'panel', label: L('pipe.panel', 'In a panel'), value: n((x) => !!x.panel) },
    { key: 'joined', label: L('pipe.joined', 'Joined'), value: n((x) => x.joining && x.joining.status === 'Joined') },
  ];
}

export function sumVac(v) { return (v.UR || 0) + (v.EWS || 0) + (v.OBC || 0) + (v.SC || 0) + (v.ST || 0); }

export function vacTable(rows, o) {
  // rows: [{label, vac:{UR..ST}, hz:{ExSM,VI..}}]
  o = o || {};
  const cats = ['UR', 'EWS', 'OBC', 'SC', 'ST'];
  const hz = ['ExSM', 'VI', 'HI', 'LD', 'OD', 'MD'];
  return h('div.rms-table__scroll', h('table.rms-mini',
    h('thead', h('tr', h('th', o.head || ''), cats.map((c) => h('th.is-right', c)), h('th.is-right.is-total', L('vac.total', 'Total')), o.hz === false ? null : hz.map((t) => h('th.is-right', t)))),
    h('tbody', rows.map((r) => h('tr' + (r.flag ? '.is-flagged' : ''), h('td', r.label), cats.map((c) => h('td.is-right', String((r.vac && r.vac[c]) || 0))), h('td.is-right.is-total', String(sumVac(r.vac || {}))), o.hz === false ? null : hz.map((t) => h('td.is-right', String((r.hz && r.hz[t]) || 0))))))));
}

// A fresh id that does not clash with seeded records: fmt(n) is called with the next counter value.
export function newId(coll, seqName, fmt) {
  let id = fmt(next(seqName));
  while (byId(coll, id)) id = fmt(next(seqName));
  return id;
}

export function pad(n, w) { return String(n).padStart ? String(n).padStart(w, '0') : ('0000000000' + n).slice(-w); }
