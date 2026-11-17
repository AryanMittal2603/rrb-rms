// Behaviour for the AMS chrome: text size, language menu, avatar menu and the session timer.
import { initFontSize } from '../lib/fontsize.js';
import { info } from '../ui/toast.js';
import { L } from './i18n.js';

export function initChrome(o) {
  o = o || {};
  initFontSize(document);
  const menus = document.querySelectorAll('[data-lang-menu]');
  Array.prototype.forEach.call(menus, (btn) => {
    const list = btn.parentNode.querySelector('.lang-switch');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !list.classList.contains('show');
      list.classList.toggle('show', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.lang-menu')) return;
    Array.prototype.forEach.call(document.querySelectorAll('.lang-switch.show'), (x) => x.classList.remove('show'));
  });
  Array.prototype.forEach.call(document.querySelectorAll('.lang-switch a[href="#hindi-pending"]'), (a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      info(L('chrome.hindiPending', 'Hindi screens are ready to switch on: add the translations to i18n/rms.hi.json and rebuild.'));
    });
  });

  const button = document.getElementById('avatar-btn');
  const menu = document.getElementById('avatar-menu');
  if (button && menu) {
    const set = (open) => { menu.hidden = !open; button.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    button.addEventListener('click', () => set(menu.hidden));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); button.focus(); } });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) set(false); });
    const name = document.getElementById('avatar-name');
    const role = document.getElementById('avatar-role');
    if (name && o.name) name.textContent = o.name;
    if (role && o.role) role.textContent = o.role;
    const out = menu.querySelector('[data-logout]');
    if (out && o.onLogout) out.addEventListener('click', o.onLogout);
    const reset = menu.querySelector('[data-reset-demo]');
    if (reset && o.onReset) reset.addEventListener('click', o.onReset);
    Array.prototype.forEach.call(menu.querySelectorAll('a[href^="#/"]'), (a) => a.addEventListener('click', () => set(false)));
  }
  const who = document.querySelector('[data-who]');
  if (who && o.who) who.textContent = o.who;

  const timer = document.querySelector('[data-countdown]');
  if (timer) {
    let left = 30 * 60;
    const tick = () => {
      left = left > 0 ? left - 1 : 30 * 60;
      const m = Math.floor(left / 60);
      const s = left % 60;
      timer.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    };
    tick();
    setInterval(tick, 1000);
    ['click', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { left = 30 * 60; }));
  }
}
