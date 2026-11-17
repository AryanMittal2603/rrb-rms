// Demo database: everything lives in the browser (localStorage), seeded with synthetic data.
// Swap these functions for API calls when the backend is ready; screens only use this module.
import { seed, VERSION } from './seed.js';
import { chainHash } from './chain.js';

export { chainHash };

const KEY = 'rms.demo.db';
let db = null;
const listeners = [];

export function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === VERSION) {
        db = parsed;
        return db;
      }
    }
  } catch (e) { /* fall through to a fresh seed */ }
  db = seed();
  save();
  return db;
}

export function save() {
  try { window.localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* quota: keep working in memory */ }
  for (let i = 0; i < listeners.length; i++) listeners[i]();
}

export function reset() {
  db = seed();
  save();
}

export function onChange(fn) { listeners.push(fn); }

export function data() { return db || load(); }
export function all(coll) { return data()[coll]; }
export function byId(coll, id) {
  const list = all(coll);
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
export function where(coll, fn) { return all(coll).filter(fn); }

export function insert(coll, obj, atEnd) {
  if (atEnd) all(coll).push(obj); else all(coll).unshift(obj);
  save();
  return obj;
}

export function patch(obj, changes) {
  for (const k in changes) obj[k] = changes[k];
  save();
  return obj;
}

export function next(name) {
  const d = data();
  d.seq[name] = (d.seq[name] || 0) + 1;
  return d.seq[name];
}

export function now() { return new Date().toISOString(); }

export function candidate(roll) {
  const list = all('candidates');
  for (let i = 0; i < list.length; i++) if (list[i].id === roll) return list[i];
  return null;
}

// Tamper-evident activity log: each entry's hash covers the previous entry's hash.
export function log(actor, role, action, entity, ref, detail) {
  const d = data();
  const prev = d.audit.length ? d.audit[0].hash : '0'.repeat(64);
  const e = { seq: (d.audit.length ? d.audit[0].seq : 0) + 1, at: now(), actor, role, action, entity, ref: ref || '', detail: detail || '' };
  e.prev = prev;
  e.hash = chainHash(prev, e);
  d.audit.unshift(e);
  return e;
}

export function verifyChain() {
  const list = all('audit').slice().reverse();
  let prev = '0'.repeat(64);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.prev !== prev || chainHash(prev, e) !== e.hash) return { ok: false, at: e.seq, checked: i };
    prev = e.hash;
  }
  return { ok: true, checked: list.length };
}

export function notify(roll, channel, template, subject) {
  const d = data();
  d.notifications.unshift({ id: 'N' + next('notification'), roll, channel, template, subject, at: now(), status: 'Sent' });
}
