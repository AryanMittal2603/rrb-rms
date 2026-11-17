// Small DOM builder. Text is always set as text nodes, never parsed as HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = { value: 1, checked: 1, selected: 1, indeterminate: 1 };

function apply(node, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.setAttribute('class', ((node.getAttribute('class') || '') + ' ' + v).trim());
    else if (k === 'style' && typeof v === 'object') { for (const s in v) node.style[s] = v[s]; }
    else if (k.length > 2 && k[0] === 'o' && k[1] === 'n' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') { for (const d in v) node.setAttribute('data-' + d, v[d]); }
    else if (PROPS[k]) node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
}

export function add(node, kids) {
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    if (kid === undefined || kid === null || kid === false || kid === true) continue;
    if (Array.isArray(kid)) add(node, kid);
    else node.appendChild(typeof kid === 'object' ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function make(create, sel, attrs, kids) {
  const parts = sel.split('.');
  const node = create(parts[0] || 'div');
  if (parts.length > 1) node.setAttribute('class', parts.slice(1).join(' '));
  if (attrs !== null && attrs !== undefined && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  if (attrs) apply(node, attrs);
  return add(node, kids);
}

export function h(sel, attrs, ...kids) {
  return make((t) => document.createElement(t), sel, attrs, kids);
}

export function s(sel, attrs, ...kids) {
  return make((t) => document.createElementNS(SVG_NS, t), sel, attrs, kids);
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...kids) {
  clear(node);
  return add(node, kids);
}

export function icon(name, size) {
  const paths = ICONS[name] || ICONS.dot;
  const px = size || 16;
  return s('svg.rms-icon', { viewBox: '0 0 24 24', width: px, height: px, 'aria-hidden': 'true', focusable: 'false' }, s('path', { d: paths }));
}

const ICONS = {
  dot: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10m0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  print: 'M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3m-3 11H8v-5h8v5m3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2M18 3H6v4h12V3z',
  download: 'M5 20h14v-2H5v2M19 9h-4V3H9v6H5l7 7 7-7z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4v6m-4 2h14v2H5v-2z',
  send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5m-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  warn: 'M1 21h22L12 2 1 21m12-3h-2v-2h2v2m0-4h-2v-4h2v4z',
  info: 'M11 7h2v2h-2V7m0 4h2v6h-2v-6m1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2m-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4m3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6m2 16H8v-2h8v2m0-4H8v-2h8v2m-3-5V3.5L18.5 9H13z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z',
  refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  link: 'M3.9 12A3.1 3.1 0 0 1 7 8.9h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12M8 13h8v-2H8v2m9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z',
  camera: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M9 2L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  flag: 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z',
  chart: 'M5 9.2h3V19H5V9.2M10.6 5h2.8v14h-2.8V5m5.6 8H19v6h-2.8v-6z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z',
  menu: 'M3 18h18v-2H3v2m0-5h18v-2H3v2m0-7v2h18V6H3z',
};
