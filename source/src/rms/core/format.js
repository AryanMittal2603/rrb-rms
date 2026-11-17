// Formatting helpers. Dates follow AMS/OIRMS usage: DD-MM-YYYY.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return (n < 10 ? '0' : '') + n; }

export function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function date(v) {
  const d = toDate(v);
  return d ? pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() : '—';
}

export function dateTime(v) {
  const d = toDate(v);
  return d ? date(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '—';
}

export function dayMonth(v) {
  const d = toDate(v);
  return d ? pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] : '—';
}

export function iso(v) {
  const d = toDate(v);
  return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : '';
}

export function num(n) {
  if (n === null || n === undefined || n === '') return '—';
  const neg = n < 0;
  const parts = String(Math.abs(Math.round(n * 100) / 100)).split('.');
  let x = parts[0];
  if (x.length > 3) {
    const last = x.slice(-3);
    x = x.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last;
  }
  return (neg ? '-' : '') + x + (parts[1] ? '.' + parts[1] : '');
}

export function pct(a, b) {
  if (!b) return '0%';
  return Math.round((a / b) * 1000) / 10 + '%';
}

export function rupees(n) { return '₹' + num(n); }

export function ago(v, now) {
  const d = toDate(v);
  if (!d) return '—';
  const mins = Math.round(((now || Date.now()) - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return hrs + ' h ago';
  return Math.round(hrs / 24) + ' days ago';
}

export function hoursBetween(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  if (!x || !y) return 0;
  return (y.getTime() - x.getTime()) / 3600000;
}

export function mask(s, keep) {
  if (!s) return '—';
  const k = keep || 4;
  return s.length <= k ? s : 'XXXX-XXXX-' + s.slice(-k);
}

export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function csv(rows) {
  return rows.map((r) => r.map((c) => {
    const v = c === null || c === undefined ? '' : String(c);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',')).join('\r\n');
}

export function download(name, content, type) {
  const blob = new Blob([content], { type: type || 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
