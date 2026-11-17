// Workflow history (who did what, when) and the AMS stepper for stage progress.
import { h, icon } from '../core/h.js';
import { dateTime } from '../core/format.js';
import { roleName } from '../core/session.js';
import { L } from '../i18n.js';

export function history(items, o) {
  const list = (items || []).slice();
  if (!(o && o.oldestFirst)) list.reverse();
  if (!list.length) return h('p.rms-muted', L('ui.noHistory', 'No actions recorded yet.'));
  return h('ol.rms-timeline', list.map((e) => h('li.rms-timeline__item' + (/return|reject|fail|unfit|revok|not /i.test(e.action) ? '.is-negative' : ''),
    h('span.rms-timeline__dot', { 'aria-hidden': 'true' }),
    h('div.rms-timeline__body',
      h('p.rms-timeline__action', e.action),
      h('p.rms-timeline__meta', [e.by, e.role ? roleName(e.role) : null, dateTime(e.at)].filter(Boolean).join(' · ')),
      e.remarks || e.text ? h('p.rms-timeline__remarks', e.remarks || e.text) : null))));
}

// steps: [{label, state:'done'|'active'|'todo'|'blocked', note}]
export function stepper(steps) {
  return h('ol.stepper.rms-stepper', steps.map((s, i) => h('li.stepper__item' + (s.state === 'done' ? '.stepper__item--done' : '') + (s.state === 'active' ? '.stepper__item--active' : '') + (s.state === 'blocked' ? '.rms-stepper--blocked' : ''),
    { 'aria-current': s.state === 'active' ? 'step' : null },
    h('div.stepper__btn', { role: 'presentation' },
      h('span.stepper__circle', s.state === 'done' ? icon('check', 18) : (s.state === 'blocked' ? icon('close', 16) : h('span', String(i + 1)))),
      h('span.stepper__label', s.label),
      s.note ? h('span.rms-stepper__note', s.note) : null))));
}
