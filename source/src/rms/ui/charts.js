// Minimal SVG charts using the AMS purple; second series in amber (palette validated for
// colour-vision deficiency). Every chart has value labels, a hover tooltip and a table view.
import { h, s } from '../core/h.js';
import { num } from '../core/format.js';
import { L } from '../i18n.js';

export const C1 = '#6f499c';
export const C2 = '#e08a00';

function tipLayer(wrap) {
  const tip = h('div.rms-chart__tip', { role: 'status', hidden: true });
  wrap.appendChild(tip);
  return {
    show(e, text) {
      tip.textContent = text;
      tip.hidden = false;
      const r = wrap.getBoundingClientRect();
      tip.style.left = Math.min(r.width - 10, e.clientX - r.left + 12) + 'px';
      tip.style.top = (e.clientY - r.top - 10) + 'px';
    },
    hide() { tip.hidden = true; },
  };
}

function tableView(items, o) {
  return h('details.rms-chart__table', h('summary', L('ui.chartTable', 'View as table')),
    h('table.rms-mini', h('thead', h('tr', h('th', o.labelHead || L('ui.item', 'Item')), h('th', (o.series && o.series[0]) || L('ui.value', 'Value')), o.series && o.series[1] ? h('th', o.series[1]) : null)),
      h('tbody', items.map((it) => h('tr', h('td', it.label), h('td.is-right', num(it.value)), o.series && o.series[1] ? h('td.is-right', num(it.value2)) : null)))));
}

// Horizontal bars as HTML (text stays at page size). Optional second series as a thinner bar.
export function hbars(items, o) {
  o = o || {};
  const two = !!(o.series && o.series[1]);
  const max = o.max || Math.max(1, ...items.map((i) => Math.max(i.value || 0, two ? i.value2 || 0 : 0)));
  const wrap = h('figure.rms-chart.rms-hbars', { role: 'img', 'aria-label': o.title || '' });
  const tip = tipLayer(wrap);
  items.forEach((it) => {
    const row = h('div.rms-hbars__row', { style: { gridTemplateColumns: (o.labelWidth || 170) + 'px 1fr' } },
      h('span.rms-hbars__label', it.label),
      h('span.rms-hbars__bars',
        bar(it.value, o.color || C1, it.label + ': ' + num(it.value) + (o.unit ? ' ' + o.unit : '')),
        two ? bar(it.value2, C2, it.label + ' (' + o.series[1] + '): ' + num(it.value2), true) : null));
    wrap.appendChild(row);
  });
  function bar(v, color, label, thin) {
    const pct = Math.max(v ? 1.5 : 0, ((v || 0) / max) * 100);
    const b = h('span.rms-hbars__bar' + (thin ? '.rms-hbars__bar--thin' : ''), { style: { width: pct + '%', background: color } });
    b.addEventListener('mousemove', (e) => tip.show(e, label));
    b.addEventListener('mouseleave', tip.hide);
    return h('span.rms-hbars__line', b, h('span.rms-hbars__value' + (thin ? '.rms-hbars__value--thin' : ''), num(v || 0)));
  }
  if (two) wrap.appendChild(legend(o.series));
  wrap.appendChild(tableView(items, o));
  return wrap;
}

// Vertical columns for a sequence (e.g. shifts). Single series.
export function columns(items, o) {
  o = o || {};
  const max = o.max || Math.max(1, ...items.map((i) => i.value || 0));
  const W = 560;
  const H = 180;
  const base = H - 34;
  const gap = 8;
  const colW = Math.max(8, Math.min(46, (W - 40) / items.length - gap));
  const wrap = h('figure.rms-chart');
  const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': o.title || '' });
  const tip = tipLayer(wrap);
  [0.5, 1].forEach((f) => {
    const y = base - (base - 18) * f;
    svg.appendChild(s('line', { x1: 30, x2: W, y1: y, y2: y, class: 'rms-chart__grid' }));
    svg.appendChild(s('text', { x: 26, y: y + 4, 'text-anchor': 'end', class: 'rms-chart__tick' }, num(Math.round(max * f))));
  });
  items.forEach((it, i) => {
    const x = 36 + i * (colW + gap);
    const hgt = Math.max(it.value ? 3 : 0, ((base - 18) * (it.value || 0)) / max);
    const r = s('rect', { x, y: base - hgt, width: colW, height: hgt, rx: 3, fill: it.color || o.color || C1, class: 'rms-chart__bar' });
    r.addEventListener('mousemove', (e) => tip.show(e, it.label + ': ' + num(it.value) + (o.unit ? ' ' + o.unit : '')));
    r.addEventListener('mouseleave', tip.hide);
    svg.appendChild(r);
    if (o.valueLabels !== false) svg.appendChild(s('text', { x: x + colW / 2, y: base - hgt - 4, 'text-anchor': 'middle', class: 'rms-chart__value rms-chart__value--small' }, o.format ? o.format(it.value) : num(it.value)));
    svg.appendChild(s('text', { x: x + colW / 2, y: base + 14, 'text-anchor': 'middle', class: 'rms-chart__tick' }, it.short || it.label));
  });
  svg.appendChild(s('line', { x1: 30, x2: W, y1: base, y2: base, class: 'rms-chart__axis' }));
  wrap.insertBefore(svg, wrap.firstChild);
  wrap.appendChild(tableView(items, o));
  return wrap;
}

export function legend(series) {
  return h('div.rms-legend', series.map((name, i) => h('span.rms-legend__item', h('span.rms-legend__swatch', { style: { background: i ? C2 : C1 } }), name)));
}

// Stacked part-of-whole bar for a status split, with labels (status colours carry text too).
export function split(parts) {
  const total = parts.reduce((a, p) => a + (p.value || 0), 0) || 1;
  return h('div.rms-split-bar',
    h('div.rms-split-bar__track', parts.filter((p) => p.value).map((p) => h('span.rms-split-bar__seg.rms-split-bar__seg--' + (p.tone || 'purple'), { style: { width: (p.value / total) * 100 + '%' }, title: p.label + ': ' + p.value }))),
    h('ul.rms-split-bar__legend', parts.map((p) => h('li', h('span.rms-split-bar__dot.rms-split-bar__seg--' + (p.tone || 'purple')), p.label + ' ', h('strong', num(p.value))))));
}
