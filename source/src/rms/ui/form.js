// Form fields in the AMS markup (.field, .field__label, .field__input, .field__error).
import { h, icon, mount } from '../core/h.js';
import { L } from '../i18n.js';

let seq = 0;

export function field(o) {
  const id = 'fld-' + (o.name || 'x') + '-' + (++seq);
  const err = h('p.field__error', { id: id + '-err', hidden: true });
  let input;
  if (o.type === 'select') {
    input = h('select.field__input', { id, name: o.name, disabled: o.readonly },
      o.placeholder !== false ? h('option', { value: '' }, o.placeholder || L('ui.select', '— Select —')) : null,
      (o.options || []).map((op) => h('option', { value: typeof op === 'string' ? op : op.value }, typeof op === 'string' ? op : op.label)));
    if (o.value !== undefined && o.value !== null) input.value = o.value;
  } else if (o.type === 'textarea') {
    input = h('textarea.field__input.rms-textarea', { id, name: o.name, rows: o.rows || 3, placeholder: o.placeholder, readonly: o.readonly, maxlength: o.max });
    if (o.value) input.value = o.value;
  } else if (o.type === 'checkbox') {
    input = h('input', { id, name: o.name, type: 'checkbox', checked: !!o.value, disabled: o.readonly });
    const lab = h('label.rms-check', { for: id }, input, h('span', o.label));
    const wrap = h('div.field.rms-field', lab, o.help ? h('p.field__help', o.help) : null, err);
    return api(wrap, input, err, o, () => input.checked, (v) => { input.checked = !!v; });
  } else if (o.type === 'radio') {
    const name = o.name + '-' + seq;
    const group = h('div.rms-radios', { role: 'radiogroup', 'aria-labelledby': id + '-lbl' }, (o.options || []).map((op, i) => {
      const val = typeof op === 'string' ? op : op.value;
      const rid = id + '-' + i;
      return h('label.rms-radio', { for: rid }, h('input', { id: rid, type: 'radio', name, value: val, checked: o.value === val, disabled: o.readonly }), h('span', typeof op === 'string' ? op : op.label));
    }));
    const wrap = h('div.field.rms-field', h('span.field__label', { id: id + '-lbl' }, o.label, o.required ? h('span.field__required', ' *') : null), group, o.help ? h('p.field__help', o.help) : null, err);
    const get = () => { const c = group.querySelector('input:checked'); return c ? c.value : ''; };
    const set = (v) => { Array.prototype.forEach.call(group.querySelectorAll('input'), (x) => { x.checked = x.value === v; }); };
    group.addEventListener('change', () => { if (o.onChange) o.onChange(get()); });
    return api(wrap, group, err, o, get, set);
  } else if (o.type === 'file') {
    const fileInput = h('input.visually-hidden', { id, type: 'file', accept: o.accept || '.pdf,.jpg,.jpeg,.png' });
    const nameOut = h('span.rms-file__name', o.value || L('ui.noFile', 'No file chosen'));
    let chosen = o.value || '';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (f) { chosen = f.name; nameOut.textContent = f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)'; if (o.onChange) o.onChange(chosen); }
    });
    const pick = h('label.btn.btn--plain.rms-btn--small.rms-file__pick', { for: id }, icon('upload', 14), h('span', L('ui.chooseFile', 'Choose file')));
    const demo = h('button.rms-file__demo', { type: 'button', onclick: () => { chosen = o.demoName || 'document-demo.pdf'; nameOut.textContent = chosen + ' (demo)'; if (o.onChange) o.onChange(chosen); } }, L('ui.useSample', 'Use sample file'));
    const wrap = h('div.field.rms-field', h('label.field__label', { for: id }, o.label, o.required ? h('span.field__required', ' *') : null), h('div.rms-file', fileInput, pick, nameOut, demo), o.help ? h('p.field__help', o.help) : null, err);
    return api(wrap, fileInput, err, o, () => chosen, (v) => { chosen = v; nameOut.textContent = v || L('ui.noFile', 'No file chosen'); });
  } else {
    input = h('input.field__input', { id, name: o.name, type: o.type || 'text', placeholder: o.placeholder, min: o.min, max: o.max, step: o.step, readonly: o.readonly, inputmode: o.type === 'number' ? 'numeric' : null, autocomplete: 'off' });
    if (o.value !== undefined && o.value !== null) input.value = o.value;
  }
  if (o.describedBy) input.setAttribute('aria-describedby', o.describedBy);
  const wrap = h('div.field.rms-field' + (o.wide ? '.rms-field--wide' : ''),
    h('label.field__label', { for: id }, o.label, o.required ? h('span.field__required', ' *') : null),
    input, o.help ? h('p.field__help', o.help) : null, err);
  input.addEventListener(o.type === 'select' ? 'change' : 'input', () => { clearErr(input, err); if (o.onChange) o.onChange(get()); });
  function get() { return o.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value; }
  return api(wrap, input, err, o, get, (v) => { input.value = v === undefined || v === null ? '' : v; });
}

function clearErr(input, err) {
  input.removeAttribute('aria-invalid');
  err.hidden = true;
}

function api(wrap, input, err, o, get, set) {
  return {
    node: wrap, input, name: o.name, get, set, wide: o.wide,
    validate() {
      const v = get();
      let msg = '';
      if (o.required && (v === '' || v === null || v === undefined || v === false)) msg = L('ui.required', 'This field is required.');
      else if (o.type === 'number' && v !== '' && o.min !== undefined && v < o.min) msg = L('ui.min', 'Must be at least {n}.', { n: o.min });
      else if (o.type === 'number' && v !== '' && o.max !== undefined && v > o.max) msg = L('ui.max', 'Must be at most {n}.', { n: o.max });
      else if (o.pattern && v && !o.pattern.test(v)) msg = o.patternMsg || L('ui.format', 'Check the format.');
      else if (o.check) msg = o.check(v) || '';
      if (msg) {
        err.textContent = msg;
        err.hidden = false;
        if (input.setAttribute) input.setAttribute('aria-invalid', 'true');
        return false;
      }
      err.hidden = true;
      if (input.removeAttribute) input.removeAttribute('aria-invalid');
      return true;
    },
  };
}

export function form(fields, cols) {
  const node = h('div.flow.flow--' + (cols || 3) + '.rms-form', fields.map((f) => h('div.flow__item' + (f.wide ? '.flow__item--wide' : ''), f.node)));
  return {
    node,
    fields,
    values() {
      const out = {};
      fields.forEach((f) => { if (f.name) out[f.name] = f.get(); });
      return out;
    },
    validate() {
      let ok = true;
      let first = null;
      fields.forEach((f) => { if (!f.validate()) { ok = false; if (!first) first = f; } });
      if (first && first.input && first.input.focus) first.input.focus();
      return ok;
    },
    get(name) { return fields.filter((f) => f.name === name)[0]; },
  };
}

// Segmented choice (Compliant / Partly / Not compliant ...). options: [{ value, label, cls }]
export function seg(label, options, value, onPick) {
  const wrap = h('div.rms-seg', { role: 'group', 'aria-label': label });
  const draw = () => mount(wrap, options.map((op) => h('button', { type: 'button', class: op.cls || null, 'aria-pressed': String(op.value === value), onclick: () => { value = op.value; draw(); if (onPick) onPick(value); } }, op.label)));
  draw();
  return wrap;
}
