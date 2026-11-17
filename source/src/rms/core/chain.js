import { sha256Hex } from './sha256.js';

// Hash for the tamper-evident activity log: covers the previous entry's hash and this entry.
export function chainHash(prev, e) {
  const text = [prev, e.seq, e.at, e.actor, e.role, e.action, e.entity, e.ref, e.detail].join('|');
  return sha256Hex(new TextEncoder().encode(text));
}
