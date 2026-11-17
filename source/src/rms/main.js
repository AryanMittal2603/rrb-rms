// RMS staff portal (demo). Frontend only: data comes from core/store.js (browser storage).
import { load, reset, onChange } from './core/store.js';
import { current, me, signOut, roleName } from './core/session.js';
import { start, path, href } from './core/router.js';
import { h, mount } from './core/h.js';
import { mountShell, drawNav, closeNav } from './shell.js';
import { allowed } from './nav.js';
import { initChrome } from './chrome.js';
import { confirm } from './ui/dialogs.js';
import { head, empty, btn } from './ui/page.js';
import { L } from './i18n.js';
import { isPublic } from './core/env.js';
import './modules/index.js';

function boot() {
  if (!current()) {
    window.location.replace('index.html');
    return;
  }
  load();
  const m = me();
  initChrome({
    name: m.user.name,
    role: m.label + ' · ' + m.scope,
    who: m.user.name + ' · ' + m.label,
    onLogout: () => { signOut(); window.location.assign('index.html'); },
    onReset: () => confirm(L('shell.resetConfirm', 'Reset all demo data to the starting point? Changes made in this browser will be lost.')).then((yes) => { if (yes) { reset(); window.location.reload(); } }),
  });
  const root = document.getElementById('rms-root');
  const content = mountShell(root);
  onChange(drawNav);
  start((match) => {
    closeNav();
    const p = path();
    const r = match && match.route.roles;
    const ok = r && r.indexOf(me().role) < 0 ? false : allowed(p);
    if (!match) {
      mount(content, head({ title: L('shell.notFound', 'Page not found') }), empty(L('shell.notFoundText', 'This address does not match any RMS screen.'), { action: btn(L('shell.toDashboard', 'Go to dashboard'), { href: '/dashboard' }) }));
    } else if (ok === false) {
      mount(content, head({ title: L('shell.notForRole', 'Not available for this role') }),
        empty(L('shell.notForRoleText', 'The {role} role cannot open this screen. Switch role to see it.', { role: roleName(me().role) }),
          { icon: 'lock', action: h('a.btn.btn--theme', { href: 'index.html?switch=1' }, L('shell.switch', 'Switch role')) }));
    } else {
      mount(content);
      try {
        match.route.render(content, match.params);
      } catch (e) {
        mount(content, head({ title: L('shell.error', 'Something went wrong') }), empty(String(e && e.message ? e.message : e)));
        if (window.console) window.console.error(e);
      }
    }
    drawNav();
    document.title = (content.querySelector('h1') ? content.querySelector('h1').textContent + ' | ' : '') + (isPublic() ? L('shell.appNameDemo', 'RMS product demo (unofficial)') : L('shell.appName', 'RRB Recruitment Management System'));
    window.scrollTo(0, 0);
  });
  void href;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
