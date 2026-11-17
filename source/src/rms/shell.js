// Staff shell: AMS admin bar + left menu + content card, inside the standard AMS chrome.
import { h, mount, icon } from './core/h.js';
import { menu } from './nav.js';
import { me } from './core/session.js';
import { href, path } from './core/router.js';
import { L } from './i18n.js';

let navEl = null;
let contentEl = null;

export function mountShell(root) {
  const m = me();
  const toggle = h('button.admin__menu', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rms-nav' }, icon('menu', 18), h('span', L('shell.menu', 'Menu')));
  const bar = h('header.admin__bar.rms-bar',
    toggle,
    h('div.admin__user.rms-bar__user',
      h('span.rms-bar__role', m.label),
      h('span.rms-bar__scope', m.scope)),
    h('a.btn.btn--theme.admin__logout.rms-bar__switch', { href: 'index.html?switch=1' }, icon('user', 16), h('span', L('shell.switch', 'Switch role'))));
  navEl = h('nav.admin__nav.rms-nav', { id: 'rms-nav', 'aria-label': L('shell.navLabel', 'RMS menu') });
  contentEl = h('section.admin__content.rms-content', { id: 'rms-content', tabindex: '-1' });
  toggle.addEventListener('click', () => {
    const open = navEl.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mount(root, h('div.admin.rms', bar, h('div.admin__body.rms-body', navEl, contentEl)));
  drawNav();
  return contentEl;
}

export function drawNav() {
  if (!navEl) return;
  const here = path();
  const groups = menu();
  mount(navEl, groups.map((g) => h('div.rms-nav__group',
    h('p.rms-nav__heading', g.group),
    h('ul.admin__links', g.items.map((it) => {
      const active = here === it.path || here.indexOf(it.path + '/') === 0;
      const n = it.count ? it.count() : 0;
      return h('li', h('a.admin__link.rms-nav__link', { href: href(it.path), 'aria-current': active ? 'page' : null },
        h('span.rms-nav__label', it.label),
        n ? h('span.rms-nav__count', { title: L('shell.pending', 'Waiting for your action') }, String(n)) : null));
    })))));
}

export function closeNav() {
  if (navEl) navEl.classList.remove('is-open');
}
