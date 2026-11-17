import { initAccess, setSize } from './access.js';

export function initFontSize(doc) {
  initAccess(doc);
  const buttons = doc.querySelectorAll('[data-font-step]');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      setSize(Number(this.getAttribute('data-font-step')));
    });
  }
}
