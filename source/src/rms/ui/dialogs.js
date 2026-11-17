// Dialog helpers built on the AMS dialog module (same markup, focus trap and styling).
import { large, confirm as amsConfirm } from '../../ui/dialog.js';
import { success as toastOk, error as toastErr } from '../../ui/toast.js';
import { h } from '../core/h.js';
import { field } from './form.js';
import { L } from '../i18n.js';

export function modal(o) {
  let dlg = null;
  const foot = h('div.rms-dialog-actions');
  (o.actions || []).forEach((a) => {
    const b = h('button.btn.' + (a.kind ? 'btn--' + a.kind : 'btn--theme'), { type: 'button' }, a.label);
    b.addEventListener('click', () => {
      const r = a.onClick ? a.onClick() : true;
      if (r === false) return;
      if (r && typeof r.then === 'function') {
        b.setAttribute('aria-busy', 'true');
        r.then((ok) => { b.removeAttribute('aria-busy'); if (ok !== false) dlg.close(a.value === undefined ? true : a.value); });
        return;
      }
      dlg.close(a.value === undefined ? true : a.value);
    });
    foot.appendChild(b);
  });
  dlg = large({ title: o.title, body: o.body, footer: o.actions && o.actions.length ? foot : null, pinned: o.pinned });
  if (o.wide === false) {
    const box = document.querySelector('.dialog-backdrop:last-child .dialog');
    if (box) box.classList.add('rms-dialog--narrow');
  }
  return dlg;
}

export function confirm(text, o) {
  return amsConfirm({ title: (o && o.title) || L('ui.confirm', 'Please confirm'), text, ok: (o && o.ok) || L('ui.yes', 'Yes'), cancel: (o && o.cancel) || L('ui.no', 'No') });
}

// Ask for remarks before an approval / return. Resolves with the text, or null if cancelled.
export function remarks(o) {
  const f = field({ name: 'remarks', type: 'textarea', label: o.label || L('ui.remarks', 'Remarks'), required: !!o.required, rows: 4, value: o.value || '', help: o.help });
  return new Promise((resolve) => {
    let done = false;
    const dlg = modal({
      title: o.title,
      wide: false,
      body: h('div', o.text ? h('p.rms-dialog-text', o.text) : null, o.extra || null, f.node),
      actions: [
        { label: o.ok || L('ui.submit', 'Submit'), kind: o.kind || 'theme', onClick: () => { if (!f.validate()) return false; done = true; resolve(f.get()); return true; } },
        { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
      ],
    });
    dlg.then(() => { if (!done) resolve(null); });
  });
}

// Demo OTP step (used where OIRMS asked the MS/Chairperson for an OTP).
export function otp(o) {
  const code = '246810';
  const f = field({ name: 'otp', type: 'text', label: L('ui.otp', 'One-time password'), required: true, placeholder: '6 digits', help: L('ui.otpDemo', 'Demo: the OTP is {code}', { code }) });
  return new Promise((resolve) => {
    let done = false;
    const dlg = modal({
      title: o.title || L('ui.otpTitle', 'Verify with OTP'),
      wide: false,
      body: h('div', h('p.rms-dialog-text', L('ui.otpSent', 'An OTP has been sent to the registered mobile {to}.', { to: o.to || '98XXXXXX21' })), f.node),
      actions: [
        { label: L('ui.verify', 'Verify'), onClick: () => {
          if (!f.validate()) return false;
          if (String(f.get()).trim() !== code) { toastErr(L('ui.otpWrong', 'The OTP does not match. Use {code} in the demo.', { code })); return false; }
          done = true; resolve(true); return true;
        } },
        { label: L('ui.cancel', 'Cancel'), kind: 'plain', value: false },
      ],
    });
    dlg.then(() => { if (!done) resolve(false); });
  });
}

export function ok(text) { toastOk(text); }
export function fail(text) { toastErr(text); }
