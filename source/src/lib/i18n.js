// RMS demo: the build writes the language pack to window.__RMS_I18N__ (assets/i18n-<lang>-<hash>.js); AMS inlines it at '__RRB_I18N__'.
const built = typeof window !== 'undefined' && window.__RMS_I18N__ ? window.__RMS_I18N__ : load('__RRB_I18N__');

function load(raw) {
  return raw.charAt(0) === '{' ? JSON.parse(raw) : { lang: 'en', text: {} };
}

export const lang = built.lang;
export const text = built.text;

export function has(key) {
  return Object.prototype.hasOwnProperty.call(text, key);
}

export function t(key, params) {
  const s = has(key) ? text[key] : key;
  return s.replace(/\{(\w+)\}/g, (m, name) => (params && params[name] != null ? String(params[name]) : m));
}

export function localPath(path) {
  return lang === 'hi' ? 'hi/' + path.replace(/^\//, '') : path.replace(/^\//, '');
}

export function remember(to) {
  document.cookie = 'lang=' + to + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
}

export function remembered() {
  const m = /(?:^|;\s*)lang=(en|hi)(?:;|$)/.exec(document.cookie);
  return m ? m[1] : '';
}
