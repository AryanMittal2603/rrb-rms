// Screen text helper. Write L('area.key', 'English text', {param}) - the build copies every
// key and its English text into i18n/rms.en.json; a Hindi pack (i18n/rms.hi.json) overrides it.
import { text, lang } from '../lib/i18n.js';

export { lang };

export function L(key, fallback, params) {
  let s = Object.prototype.hasOwnProperty.call(text, key) ? text[key] : fallback;
  if (s == null) s = key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) => (params[name] != null ? String(params[name]) : m));
}
