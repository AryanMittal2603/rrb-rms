import { el } from './dom.js';

const SHOW_MS = { error: 10000, success: 10000, info: 10000 };
let stack;
let live;

function mount() {
  if (stack && stack.isConnected) return;
  stack = el('div', 'toasts');
  live = el('div', 'visually-hidden');
  live.appendChild(region('assertive'));
  live.appendChild(region('polite'));
  document.body.appendChild(stack);
  document.body.appendChild(live);
}

function region(mode) {
  const r = el('div');
  r.setAttribute('aria-live', mode);
  r.setAttribute('aria-atomic', 'true');
  r.setAttribute('data-live', mode);
  return r;
}

function announce(mode, text) {
  const r = live.querySelector('[data-live="' + mode + '"]');
  r.textContent = '';
  setTimeout(() => {
    r.textContent = text;
  }, 50);
}

function show(kind, text) {
  mount();
  for (let i = 0; i < stack.children.length; i++) {
    if (stack.children[i].lastChild.textContent === text) return;
  }
  const toast = el('button', 'toast toast--' + kind);
  toast.type = 'button';
  toast.appendChild(el('span', 'toast__icon'));
  toast.lastChild.setAttribute('aria-hidden', 'true');
  toast.appendChild(el('span', 'toast__text', text));
  stack.insertBefore(toast, stack.firstChild);
  announce(kind === 'error' ? 'assertive' : 'polite', text);

  let left = SHOW_MS[kind];
  let started = 0;
  let timer = 0;
  const close = () => {
    clearTimeout(timer);
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  };
  const resume = () => {
    if (toast.matches(':hover, :focus')) return;
    started = Date.now();
    timer = setTimeout(close, left);
  };
  const pause = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = 0;
    left = Math.max(1000, left - (Date.now() - started));
  };
  toast.addEventListener('mouseenter', pause);
  toast.addEventListener('focus', pause);
  toast.addEventListener('mouseleave', resume);
  toast.addEventListener('blur', resume);
  toast.addEventListener('click', close);
  resume();
}

export function error(text) {
  show(/please wait|कृपया(?: \S+){0,3} प्रतीक्षा करें/i.test(text) ? 'info' : 'error', text);
}

export function success(text) {
  show('success', text);
}

// RMS demo addition: neutral information toast (AMS uses it only for "please wait" messages).
export function info(text) {
  show('info', text);
}
