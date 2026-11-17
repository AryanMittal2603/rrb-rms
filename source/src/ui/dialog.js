import { el, content, uid } from './dom.js';
import { t } from '../lib/i18n.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const open = [];
const FADE_MS = 300;
let lockedPadding = null;

function lockScroll() {
  if (open.length > 1) return;
  const body = document.body;
  lockedPadding = body.style.paddingRight;
  const bar = window.innerWidth - document.documentElement.clientWidth;
  if (bar > 0) body.style.paddingRight = bar + 'px';
  body.classList.add('is-locked');
}

function unlockScroll() {
  if (open.length > 0) return;
  document.body.classList.remove('is-locked');
  document.body.style.paddingRight = lockedPadding;
}

function show(kind, title, build, closable, pinned) {
  const opener = document.activeElement;
  const scrollY = window.pageYOffset;
  let close;
  const promise = new Promise((resolve) => {
    const backdrop = el('div', 'dialog-backdrop dialog-backdrop--' + kind + (pinned ? ' dialog-backdrop--pinned' : ''));
    const box = el('div', 'dialog dialog--' + kind);
    const titleId = uid('dialog-title');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', titleId);
    box.tabIndex = -1;
    const head = el('div', 'dialog__head');
    const heading = el('h2', 'dialog__title', title);
    heading.id = titleId;
    head.appendChild(heading);
    box.appendChild(head);
    const entry = { backdrop: backdrop, close: null };
    close = (value) => {
      if (!backdrop.parentNode) return;
      backdrop.classList.add('is-closing');
      setTimeout(() => {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }, FADE_MS);
      document.removeEventListener('keydown', onKey, true);
      open.splice(open.indexOf(entry), 1);
      unlockScroll();
      if (pinned) window.scrollTo(0, scrollY);
      if (opener && opener.focus && document.contains(opener)) opener.focus();
      resolve(value);
    };
    entry.close = close;
    const onKey = (e) => {
      if (open[open.length - 1] !== entry) return;
      if (e.key === 'Escape' && (closable || kind === 'alertify')) {
        const at = document.activeElement;
        if (at && at.getAttribute && at.getAttribute('aria-expanded') === 'true' && box.contains(at)) return;
        e.preventDefault();
        close(false);
      } else if (e.key === 'Tab') {
        const items = box.querySelectorAll(FOCUSABLE);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!box.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    if (closable) {
      const x = el('button', 'dialog__x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', t('common.close'));
      x.addEventListener('click', () => close(false));
      head.appendChild(x);
    }
    build(box, head, close);
    backdrop.appendChild(box);
    open.push(entry);
    if (pinned) window.scrollTo(0, 0);
    lockScroll();
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKey, true);
    (box.querySelector('[data-autofocus]') || box.querySelector('.dialog__foot button') || box.querySelector(FOCUSABLE) || box).focus();
  });
  promise.close = close;
  return promise;
}

function body(box, value) {
  const b = el('div', 'dialog__body');
  content(b, value);
  box.appendChild(b);
}

function foot(box, value) {
  if (!value) return;
  const f = el('div', 'dialog__foot');
  content(f, value);
  box.appendChild(f);
}

function button(label, cls, onClick) {
  const b = el('button', 'btn ' + cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export function info(opts) {
  const gradient = opts.header === 'gradient';
  return show('info', opts.title || t('common.information'), (box, head, close) => {
    if (!gradient) box.classList.add('dialog--plain-head');
    body(box, opts.text);
    foot(box, button(opts.button || t('common.agree'), 'btn--theme', () => close(true)));
  }, !gradient && !!opts.closable);
}

export function plain(opts) {
  return show('plain', opts.title, (box) => body(box, opts.body), opts.closable !== false);
}

export function capture(opts) {
  return show('capture', opts.title, (box, head) => {
    if (opts.toggle) head.insertBefore(opts.toggle, head.firstChild.nextSibling);
    body(box, opts.body);
    foot(box, opts.footer);
  }, false);
}

export function large(opts) {
  return show('large', opts.title, (box) => {
    body(box, opts.body);
    foot(box, opts.footer);
  }, true, !!opts.pinned);
}

export function confirm(opts) {
  return show('confirm', opts.title || t('common.confirm'), (box, head, close) => {
    box.insertBefore(el('span', 'dialog__shield'), head);
    head.classList.add('visually-hidden');
    const text = el('p', 'dialog__text', opts.text);
    text.id = uid('dialog-text');
    box.setAttribute('aria-describedby', text.id);
    box.appendChild(text);
    const row = el('div', 'dialog__foot');
    row.appendChild(button(opts.ok || t('common.yes'), 'btn--theme', () => close(true)));
    row.appendChild(button(opts.cancel || t('common.no'), 'btn--plain', () => close(false)));
    box.appendChild(row);
  }, false);
}

export function alertify(question) {
  return show('alertify', t('common.confirm'), (box, head, close) => {
    head.classList.add('visually-hidden');
    const text = el('p', 'dialog__text', question);
    text.id = uid('dialog-text');
    box.setAttribute('aria-describedby', text.id);
    box.appendChild(text);
    const row = el('div', 'dialog__foot');
    const ok = button(t('common.ok'), 'dialog__ok', () => close(true));
    ok.setAttribute('data-autofocus', '');
    row.appendChild(button(t('common.cancel'), 'dialog__cancel', () => close(false)));
    row.appendChild(ok);
    box.appendChild(row);
  }, false);
}

export function choice(opts) {
  return show('info', opts.title || t('common.information'), (box, head, close) => {
    box.classList.add('dialog--plain-head', 'dialog--choice');
    const b = el('div', 'dialog__body');
    const mark = el('span', 'dialog__mark');
    mark.setAttribute('aria-hidden', 'true');
    b.appendChild(mark);
    const lines = el('div', 'dialog__lines');
    lines.id = uid('dialog-text');
    opts.lines.forEach((line) => content(lines.appendChild(el('p', 'dialog__line')), line));
    b.appendChild(lines);
    box.setAttribute('aria-describedby', lines.id);
    box.appendChild(b);
    const f = el('div', 'dialog__foot');
    opts.buttons.forEach((o) => f.appendChild(button(o.label, o.light ? 'btn--light' : 'btn--theme', () => close(o.value))));
    box.appendChild(f);
  }, true);
}

export function closeAll() {
  open.slice().forEach((d) => d.close(false));
}
