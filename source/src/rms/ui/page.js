// Page building blocks. Visual vocabulary comes from AMS: .admin__title, .card, .band, .flow, .btn.
import { h, icon } from '../core/h.js';
import { href } from '../core/router.js';
import { L } from '../i18n.js';

export function head(o) {
  return h('div.rms-head',
    o.crumbs && o.crumbs.length ? h('nav.rms-crumbs', { 'aria-label': L('ui.breadcrumb', 'Breadcrumb') },
      o.crumbs.map((c, i) => [i ? h('span.rms-crumbs__sep', { 'aria-hidden': 'true' }, '/') : null, c.href ? h('a', { href: href(c.href) }, c.label) : h('span', c.label)])) : null,
    h('div.rms-head__row',
      h('div.rms-head__text',
        h('h1.admin__title.rms-head__title', o.title),
        o.sub ? h('p.rms-head__sub', o.sub) : null),
      o.actions && o.actions.length ? h('div.rms-head__actions', o.actions) : null),
    o.sow ? h('p.rms-sow', { title: L('ui.sowRef', 'Scope-of-work reference') }, L('ui.sow', 'SOW') + ' ' + o.sow) : null);
}

export function btn(label, o) {
  o = o || {};
  const cls = 'btn ' + (o.kind ? 'btn--' + o.kind : 'btn--theme') + (o.small ? ' rms-btn--small' : '') + (o.cls ? ' ' + o.cls : '');
  const attrs = { type: 'button', class: cls, onclick: o.onClick, disabled: o.disabled, title: o.title, 'aria-label': o.aria };
  if (o.href) return h('a', { class: cls, href: o.external ? o.href : href(o.href), title: o.title }, o.icon ? icon(o.icon) : null, label ? h('span', label) : null);
  return h('button', attrs, o.icon ? icon(o.icon) : null, label ? h('span', label) : null);
}

export function card(title, body, o) {
  o = o || {};
  return h('section.card.rms-card' + (o.cls ? '.' + o.cls : ''),
    title ? h('div.rms-card__head', h('h2.card__title.rms-card__title', title), o.actions ? h('div.rms-card__actions', o.actions) : null) : null,
    body);
}

export function band(text, o) {
  return h('h2.band.band--lavender.rms-band' + (o && o.cls ? '.' + o.cls : ''), text);
}

export function grid(cols, items) {
  return h('div.flow.flow--' + cols + '.rms-grid', items.map((it) => h('div.flow__item', it)));
}

// Definition list for read-only details.
export function kv(pairs, cols) {
  return h('dl.rms-kv' + (cols ? '.rms-kv--' + cols : ''), pairs.filter(Boolean).map((p) => h('div.rms-kv__item', h('dt', p[0]), h('dd', p[1] === undefined || p[1] === null || p[1] === '' ? '—' : p[1]))));
}

export function stat(label, value, o) {
  o = o || {};
  const body = [h('span.rms-stat__value', value), h('span.rms-stat__label', label), o.note ? h('span.rms-stat__note', o.note) : null];
  return o.href ? h('a.rms-stat' + (o.tone ? '.rms-stat--' + o.tone : ''), { href: href(o.href) }, body) : h('div.rms-stat' + (o.tone ? '.rms-stat--' + o.tone : ''), body);
}

export function stats(items) {
  return h('div.rms-stats', items);
}

export function tabs(items, active, onPick) {
  const bar = h('div.rms-tabs', { role: 'tablist' });
  items.forEach((it) => {
    const b = h('button.rms-tabs__tab', { type: 'button', role: 'tab', 'aria-selected': it.id === active ? 'true' : 'false', onclick: () => onPick(it.id) }, it.label, it.count !== undefined ? h('span.rms-tabs__count', String(it.count)) : null);
    bar.appendChild(b);
  });
  return bar;
}

export function empty(text, o) {
  return h('div.rms-empty', icon((o && o.icon) || 'info', 28), h('p', text), o && o.action ? o.action : null);
}

export function note(text, tone) {
  return h('div.rms-note.rms-note--' + (tone || 'info'), icon(tone === 'danger' ? 'warn' : (tone === 'success' ? 'check' : 'info'), 18), h('div.rms-note__body', text));
}

export function link(label, path) {
  return h('a.rms-link', { href: href(path) }, label);
}

export function bar(items) {
  return h('div.rms-toolbar', items);
}

export function split(main, side) {
  return h('div.rms-split', h('div.rms-split__main', main), h('aside.rms-split__side', side));
}

export function progress(value, max, label) {
  const p = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return h('div.rms-progress', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(value), 'aria-label': label || '' },
    h('span.rms-progress__bar', { style: { width: p + '%' } }), h('span.rms-progress__text', value + ' / ' + max));
}
