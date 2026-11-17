const SIZES = { '-2': [8.6, '--'], '-1': [9.4, '-'], 0: [10.2, ''], 1: [12.12, '+'], 2: [13.4, '++'] };
const BASE = 10.2;
const ROOT = 16;
const SWITCHES = ['high-contrast', 'highlight-links', 'text-spacing', 'line-height'];

let doc = null;
let size = 0;
let on = {};

// RMS demo: AMS keeps these in Secure cookies; the demo runs from file:// or plain http, so it uses localStorage with the same names.
function cookie(name) {
  try { return window.localStorage.getItem('rms.' + name) || ''; } catch (e) { return ''; }
}

function write(name, value) {
  try {
    if (value) window.localStorage.setItem('rms.' + name, value);
    else window.localStorage.removeItem('rms.' + name);
  } catch (e) { /* storage unavailable: setting lasts for this page only */ }
}

function apply() {
  const root = doc.documentElement;
  root.style.setProperty('--font-size', ((ROOT * SIZES[size][0]) / BASE).toFixed(2) + 'px');
  for (let i = 0; i < SWITCHES.length; i++) root.classList.toggle('a11y-' + SWITCHES[i], !!on[SWITCHES[i]]);
  root.classList.toggle('a11y-larger', size > 0);
  const buttons = doc.querySelectorAll('[data-font-step]');
  for (let i = 0; i < buttons.length; i++) buttons[i].classList.toggle('is-active', buttons[i].getAttribute('data-font-step') === String(size));
}

export function initAccess(d) {
  doc = d;
  const saved = cookie('APSCFONTSIZE');
  size = 0;
  for (const s in SIZES) if (saved && String(SIZES[s][0]) === saved) size = Number(s);
  on = {};
  const names = cookie('A11Y').split('.');
  for (let i = 0; i < SWITCHES.length; i++) on[SWITCHES[i]] = names.indexOf(SWITCHES[i]) >= 0;
  apply();
}

export function state() {
  const s = { size };
  for (let i = 0; i < SWITCHES.length; i++) s[SWITCHES[i]] = on[SWITCHES[i]];
  return s;
}

export function setSize(s) {
  if (!SIZES[s]) throw new RangeError('unknown-size:' + s);
  size = s;
  write('APSCFONTSIZE', s ? String(SIZES[s][0]) : '');
  write('FONTTYPE', SIZES[s][1]);
  apply();
}

export function step(d) {
  if (d !== 1 && d !== -1) throw new RangeError('unknown-step:' + d);
  setSize(Math.max(-2, Math.min(2, size + d)));
}

export function reset() {
  setSize(0);
}

export function set(name, value) {
  if (SWITCHES.indexOf(name) < 0) throw new RangeError('unknown-setting:' + name);
  on[name] = !!value;
  write('A11Y', SWITCHES.filter((n) => on[n]).join('.'));
  apply();
}
