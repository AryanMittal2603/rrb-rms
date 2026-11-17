// Synthetic portrait placeholders. The demo never shows real faces: each candidate gets a
// drawn silhouette whose colours come from their id, with a label for where it was captured.
import { s, h } from '../core/h.js';

const SKIN = ['#e6b48c', '#d49b70', '#c08457', '#a46c45', '#8d5a38', '#f0c9a4'];
const HAIR = ['#1f1a17', '#2b211b', '#3b2a20', '#151515', '#4a3426'];
const BG = ['#efe7f6', '#e8eef7', '#f3ece4', '#e9f2ec', '#f6eaea'];

function pick(list, n) { return list[Math.abs(n) % list.length]; }

export function portrait(seed, o) {
  o = o || {};
  const n = Number(seed) || 7;
  const variant = o.variant || 'application';
  const bg = variant === 'live' ? '#e3f1f6' : (variant === 'aadhaar' ? '#fff8e6' : pick(BG, n));
  const skin = pick(SKIN, n >> 2);
  const hair = pick(HAIR, n >> 4);
  const shirt = pick(['#6f499c', '#2f5d8a', '#3a843a', '#8e0f19', '#5f7886', '#b06d1e'], n >> 6);
  const tilt = variant === 'live' ? 2 : 0;
  const size = o.size || 96;
  const svg = s('svg', { viewBox: '0 0 96 120', width: size, height: Math.round(size * 1.25), role: 'img', 'aria-label': o.label || 'Photograph placeholder', class: 'rms-portrait__svg' },
    s('rect', { x: 0, y: 0, width: 96, height: 120, fill: bg }),
    s('path', { d: 'M8 120c2-26 18-36 40-36s38 10 40 36z', fill: shirt }),
    s('rect', { x: 40, y: 70, width: 16, height: 18, rx: 6, fill: skin }),
    s('ellipse', { cx: 48 + tilt, cy: 52, rx: 20, ry: 24, fill: skin }),
    s('path', { d: 'M27 48c0-17 9-26 21-26s22 9 22 26c-4-8-11-12-21-12s-17 4-22 12z', fill: hair, transform: 'translate(' + tilt + ',0)' }),
    s('circle', { cx: 41 + tilt, cy: 54, r: 2, fill: '#2a2a2a' }),
    s('circle', { cx: 55 + tilt, cy: 54, r: 2, fill: '#2a2a2a' }),
    s('path', { d: 'M42 66q6 4 12 0', stroke: '#7a3e2c', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', transform: 'translate(' + tilt + ',0)' }));
  return h('figure.rms-portrait' + (o.cls ? '.' + o.cls : ''), svg, o.caption ? h('figcaption', o.caption) : null);
}

export function signature(seed, o) {
  const n = Number(seed) || 3;
  const a = 10 + (n % 9);
  const b = 14 + ((n >> 3) % 11);
  return h('figure.rms-signature', s('svg', { viewBox: '0 0 160 48', width: 160, height: 48, role: 'img', 'aria-label': (o && o.label) || 'Signature placeholder' },
    s('rect', { width: 160, height: 48, fill: '#fff' }),
    s('path', { d: 'M8 34c' + a + '-24 ' + b + ' 10 26-6s10 18 22 4 16-14 24 2 14 10 22-8 16 6 30 2', stroke: '#1d2a6b', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' })),
    o && o.caption ? h('figcaption', o.caption) : null);
}
