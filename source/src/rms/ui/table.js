// Data table in the AMS table style (purple header row), with search, filters, sorting,
// paging, selection and CSV export.
import { h, clear, icon } from '../core/h.js';
import { csv, download } from '../core/format.js';
import { L } from '../i18n.js';

function text(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.nodeType) return v.textContent;
  return String(v);
}

export function table(o) {
  const st = { q: '', filters: {}, sort: o.sort || null, dir: o.dir || 1, page: 0, selected: {} };
  const size = o.pageSize || 12;
  const wrap = h('div.rms-table' + (o.cls ? '.' + o.cls : ''));
  const tools = h('div.rms-table__tools');
  const body = h('div.rms-table__scroll');
  const foot = h('div.rms-table__foot');
  let rows = o.rows || [];

  if (o.search !== false) {
    const id = 'q-' + Math.random().toString(36).slice(2, 8);
    tools.appendChild(h('div.rms-table__search', h('label.visually-hidden', { for: id }, L('ui.search', 'Search')), icon('search', 16),
      h('input.field__input', { id, type: 'search', placeholder: o.searchPlaceholder || L('ui.searchTable', 'Search this list'), oninput: (e) => { st.q = e.target.value.trim().toLowerCase(); st.page = 0; draw(); } })));
  }
  (o.filters || []).forEach((f) => {
    const id = 'f-' + f.key + '-' + Math.random().toString(36).slice(2, 6);
    const sel = h('select.field__input', { id, onchange: (e) => { st.filters[f.key] = e.target.value; st.page = 0; draw(); } },
      h('option', { value: '' }, f.all || L('ui.all', 'All')), f.options.map((op) => h('option', { value: typeof op === 'string' ? op : op.value }, typeof op === 'string' ? op : op.label)));
    if (f.value) { sel.value = f.value; st.filters[f.key] = f.value; }
    tools.appendChild(h('div.rms-table__filter', h('label', { for: id }, f.label), sel));
  });
  if (o.tools) tools.appendChild(h('div.rms-table__extra', o.tools));
  if (o.exportName) {
    tools.appendChild(h('button.btn.btn--plain.rms-btn--small', { type: 'button', onclick: exportCsv }, icon('download', 14), h('span', L('ui.csv', 'CSV'))));
  }

  function visible() {
    let list = rows;
    if (st.q) {
      list = list.filter((r) => o.columns.some((c) => {
        const v = c.search ? c.search(r) : (c.value ? c.value(r) : r[c.key]);
        return text(v).toLowerCase().indexOf(st.q) >= 0;
      }));
    }
    (o.filters || []).forEach((f) => {
      const v = st.filters[f.key];
      if (v) list = list.filter((r) => (f.match ? f.match(r, v) : String(r[f.key]) === v));
    });
    if (st.sort) {
      const col = o.columns.filter((c) => c.key === st.sort)[0];
      if (col) {
        const get = (r) => (col.sortValue ? col.sortValue(r) : (col.value ? col.value(r) : r[col.key]));
        list = list.slice().sort((a, b) => {
          const x = get(a);
          const y = get(b);
          if (x === y) return 0;
          if (x === undefined || x === null) return 1;
          if (y === undefined || y === null) return -1;
          return (x > y ? 1 : -1) * st.dir;
        });
      }
    }
    return list;
  }

  function exportCsv() {
    const list = visible();
    const cols = o.columns.filter((c) => !c.noExport);
    const out = [cols.map((c) => c.label)].concat(list.map((r) => cols.map((c) => text(c.value ? c.value(r) : (c.render ? c.render(r) : r[c.key])))));
    download(o.exportName + '.csv', csv(out));
  }

  function draw() {
    const list = visible();
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (st.page >= pages) st.page = pages - 1;
    const slice = o.paged === false ? list : list.slice(st.page * size, st.page * size + size);
    clear(body);
    const thead = h('thead', h('tr',
      o.select ? h('th.rms-table__check', h('input', { type: 'checkbox', 'aria-label': L('ui.selectAll', 'Select all'), checked: slice.length > 0 && slice.every((r) => st.selected[o.rowId(r)]), onchange: (e) => { slice.forEach((r) => { st.selected[o.rowId(r)] = e.target.checked; }); draw(); if (o.onSelect) o.onSelect(selected()); } })) : null,
      o.columns.map((c) => {
        const sortable = c.sortable !== false && !c.action;
        const th = h('th', { class: (c.align ? 'is-' + c.align : '') + (c.width ? '' : ''), style: c.width ? { width: c.width } : null, 'aria-sort': st.sort === c.key ? (st.dir > 0 ? 'ascending' : 'descending') : null });
        if (sortable) th.appendChild(h('button.rms-table__sort', { type: 'button', onclick: () => { if (st.sort === c.key) st.dir = -st.dir; else { st.sort = c.key; st.dir = 1; } draw(); } }, c.label, h('span.rms-table__arrow', { 'aria-hidden': 'true' }, st.sort === c.key ? (st.dir > 0 ? '▲' : '▼') : '')));
        else th.appendChild(document.createTextNode(c.label));
        return th;
      })));
    const tbody = h('tbody');
    if (!slice.length) {
      tbody.appendChild(h('tr', h('td.rms-table__empty', { colspan: String(o.columns.length + (o.select ? 1 : 0)) }, o.empty || L('ui.noRecords', 'No records found.'))));
    }
    slice.forEach((r) => {
      const tr = h('tr', { class: o.rowClass ? o.rowClass(r) : null });
      if (o.onRow) {
        tr.classList.add('is-clickable');
        tr.addEventListener('click', (e) => { if (e.target.closest('a,button,input,select,label')) return; o.onRow(r); });
      }
      if (o.select) tr.appendChild(h('td.rms-table__check', h('input', { type: 'checkbox', 'aria-label': L('ui.selectRow', 'Select row'), checked: !!st.selected[o.rowId(r)], disabled: o.selectable ? !o.selectable(r) : false, onchange: (e) => { st.selected[o.rowId(r)] = e.target.checked; if (o.onSelect) o.onSelect(selected()); } })));
      o.columns.forEach((c) => {
        const v = c.render ? c.render(r) : (c.value ? c.value(r) : r[c.key]);
        tr.appendChild(h('td', { class: [c.align ? 'is-' + c.align : '', c.nowrap ? 'rms-nowrap' : ''].join(' ').trim() || null, 'data-label': c.label }, v === undefined || v === null || v === '' ? '—' : v));
      });
      tbody.appendChild(tr);
    });
    body.appendChild(h('table.rms-table__table', o.caption ? h('caption.visually-hidden', o.caption) : null, thead, tbody));
    clear(foot);
    foot.appendChild(h('span.rms-table__count', L('ui.showing', 'Showing {a}–{b} of {n}', { a: list.length ? st.page * size + 1 : 0, b: Math.min(list.length, (st.page + 1) * size), n: list.length })));
    if (pages > 1 && o.paged !== false) {
      foot.appendChild(h('div.rms-pager',
        h('button.rms-pager__btn', { type: 'button', disabled: st.page === 0, onclick: () => { st.page--; draw(); } }, '« ' + L('ui.prev', 'Previous')),
        h('span.rms-pager__info', L('ui.page', 'Page {p} of {n}', { p: st.page + 1, n: pages })),
        h('button.rms-pager__btn', { type: 'button', disabled: st.page >= pages - 1, onclick: () => { st.page++; draw(); } }, L('ui.next', 'Next') + ' »')));
    }
  }

  function selected() {
    return rows.filter((r) => st.selected[o.rowId(r)]);
  }

  wrap.appendChild(tools);
  wrap.appendChild(body);
  wrap.appendChild(foot);
  draw();
  wrap.update = (next) => { rows = next; draw(); };
  wrap.selected = selected;
  wrap.clearSelection = () => { st.selected = {}; draw(); };
  return wrap;
}
