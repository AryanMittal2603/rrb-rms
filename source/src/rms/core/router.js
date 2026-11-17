// Hash router: #/path/:param. Each route lists the roles allowed to open it.
const routes = [];
let notFound = null;
let listener = null;

export function route(pattern, roles, render) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (m, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  routes.push({ pattern, keys, re, roles, render });
}

export function fallback(fn) { notFound = fn; }

export function path() {
  return (window.location.hash || '').replace(/^#/, '').split('?')[0] || '/dashboard';
}

export function query() {
  const q = (window.location.hash.split('?')[1] || '');
  const out = {};
  q.split('&').filter(Boolean).forEach((kv) => { const p = kv.split('='); out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
  return out;
}

// A static segment beats a parameter: /indents/new wins over /indents/:id whatever the import order.
export function resolve(p) {
  let best = null;
  for (let i = 0; i < routes.length; i++) {
    const m = routes[i].re.exec(p);
    if (m && (!best || routes[i].keys.length < best.route.keys.length)) {
      const params = {};
      routes[i].keys.forEach((k, j) => { params[k] = decodeURIComponent(m[j + 1]); });
      best = { route: routes[i], params };
    }
  }
  return best;
}

export function start(onRoute) {
  listener = onRoute;
  window.addEventListener('hashchange', () => listener(resolve(path()), notFound));
  listener(resolve(path()), notFound);
}

export function refresh() { if (listener) listener(resolve(path()), notFound); }

export function go(p) {
  if (window.location.hash === '#' + p) refresh();
  else window.location.hash = '#' + p;
}

export function href(p) { return '#' + p; }
