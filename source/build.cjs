'use strict';
// RMS demo build. Follows the AMS conventions (pages/*.html with a JSON front-matter comment,
// layout.html shell, chrome/ partials, {{t:key}} text from i18n/*.json, esbuild IIFE bundles)
// but emits relative URLs so the output runs from any folder, a static server or file://.
//
//   node source/build.cjs            -> writes ../built (official RRB look, for local and internal demos)
//   RMS_DIST=out node source/build.cjs
//   RMS_PUBLIC=1 RMS_DIST=site node source/build.cjs
//       -> public demo build for GitHub Pages: neutral masthead and footer instead of the emblem and
//          RRB / Government of India marks, a 'not an official website' notice, specimen letters,
//          and robots noindex so it is never taken for an official RRB portal.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const dist = path.resolve(process.env.RMS_DIST || path.join(root, '..', 'built'));
const targets = ['es2015', 'chrome49', 'firefox54', 'safari11', 'ios11'];
const PUBLIC = process.env.RMS_PUBLIC === '1';

function fail(msg) {
  process.stderr.write('rms build: ' + msg + '\n');
  process.exit(1);
}
function read(p) { return fs.readFileSync(p, 'utf8'); }
function readJSON(p) { return fs.existsSync(p) ? JSON.parse(read(p)) : {}; }
function hash(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10); }
function walk(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- i18n
// Screen text is written in code as L('area.key', 'English default'). The build collects every
// key into i18n/rms.en.json (the file translators work from) and checks i18n/rms.hi.json against it.
const KEY_RE = /\bL\(\s*'([a-z0-9_.-]+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g;
function collectKeys() {
  const found = {};
  const files = walk(path.join(root, 'src')).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const src = read(f);
    let m;
    KEY_RE.lastIndex = 0;
    while ((m = KEY_RE.exec(src))) {
      const key = m[1];
      const text = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
      if (found[key] !== undefined && found[key] !== text) {
        fail('key ' + key + ' has two different English texts:\n  "' + found[key] + '"\n  "' + text + '"\n  (second in ' + path.relative(root, f) + ')');
      }
      found[key] = text;
    }
  }
  return found;
}

const common = { en: readJSON(path.join(root, 'i18n/common.en.json')), hi: readJSON(path.join(root, 'i18n/common.hi.json')) };
// Status words shown in badges are data values; their display text gets keys too (see ui/badge.js).
function statusKeys() {
  const src = read(path.join(root, 'src/rms/ui/badge.js'));
  const block = /const TONES = \{([\s\S]*?)\n\};/.exec(src);
  const out = {};
  if (!block) return out;
  const re = /'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(block[1]))) {
    const s = m[1];
    out['status.' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')] = s;
  }
  return out;
}
const rmsEn = Object.assign(readJSON(path.join(root, 'i18n/rms-chrome.en.json')), statusKeys(), collectKeys());
const sortedEn = {};
Object.keys(rmsEn).sort().forEach((k) => { sortedEn[k] = rmsEn[k]; });
fs.writeFileSync(path.join(root, 'i18n/rms.en.json'), JSON.stringify(sortedEn, null, 2) + '\n');
const hiPath = path.join(root, 'i18n/rms.hi.json');
if (!fs.existsSync(hiPath)) fs.writeFileSync(hiPath, '{}\n');
const rmsHi = readJSON(hiPath);
const stale = Object.keys(rmsHi).filter((k) => !(k in sortedEn));
if (stale.length) process.stderr.write('rms build: warning: ' + stale.length + ' Hindi keys no longer used, e.g. ' + stale.slice(0, 3).join(', ') + '\n');
const hiCoverage = Object.keys(sortedEn).filter((k) => k in rmsHi).length;
const buildHindi = process.env.RMS_HINDI === '1' || hiCoverage > 0;

function pack(lang) {
  const text = Object.assign({}, common.en, sortedEn);
  if (lang === 'hi') Object.assign(text, common.hi, rmsHi);
  return { lang, text };
}

// ---------------------------------------------------------------- output
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

function emit(rel, body) {
  const ext = path.extname(rel);
  const base = rel.slice(0, -ext.length);
  const out = 'assets/' + base + '-' + hash(body) + ext;
  fs.mkdirSync(path.dirname(path.join(dist, out)), { recursive: true });
  fs.writeFileSync(path.join(dist, out), body);
  return out;
}

const brandCache = {};
function brand(rel) {
  if (!brandCache[rel]) {
    const src = path.join(root, 'src/brand', rel);
    if (!fs.existsSync(src)) fail('missing brand asset ' + rel);
    brandCache[rel] = emit('brand/' + rel, fs.readFileSync(src));
  }
  return brandCache[rel];
}

async function bundle() {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: {
      rms: 'src/rms/main.js',
      candidate: 'src/candidate/main.js',
      login: 'src/login/main.js',
      'rms-styles': 'src/styles/rms-app.css',
    },
    bundle: true,
    minify: true,
    format: 'iife',
    target: targets,
    legalComments: 'none',
    charset: 'utf8',
    entryNames: 'assets/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    loader: { '.woff2': 'file', '.svg': 'file', '.png': 'file', '.jpg': 'file' },
    outdir: dist,
    metafile: true,
    logLevel: 'warning',
  });
  const outputs = {};
  for (const out of Object.keys(result.metafile.outputs)) {
    const meta = result.metafile.outputs[out];
    if (!meta.entryPoint) continue;
    const name = path.basename(meta.entryPoint).replace(/\.(js|css)$/, '');
    const key = meta.entryPoint.indexOf('styles/') >= 0 ? 'css' : meta.entryPoint.split('/')[1];
    outputs[key] = path.relative(dist, path.join(root, out)).split(path.sep).join('/');
    void name;
  }
  return outputs;
}

// ---------------------------------------------------------------- pages
const layout = read(path.join(root, 'layout.html'));
function partial(name) {
  const p = path.join(root, 'chrome', name + '.html');
  if (!fs.existsSync(p)) fail('missing chrome partial ' + name);
  return read(p);
}

function render(tpl, ctx) {
  let out = tpl;
  for (let i = 0; i < 4; i++) out = out.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (m, n) => partial(n));
  out = out.replace(/\{\{lang-switch\}\}/g, partial('lang'));
  out = out.replace(/\{\{t:([\w.-]+)\}\}/g, (m, key) => {
    if (!(key in ctx.text)) fail('unknown text key ' + key + ' in ' + ctx.page);
    return escapeHtml(ctx.text[key]);
  });
  out = out.replace(/\{\{brand:([^}]+)\}\}/g, (m, rel) => ctx.prefix + brand(rel.trim()));
  out = out.replace(/\{\{asset:([^}]+)\}\}/g, (m, rel) => ctx.prefix + rel.trim());
  out = out.replace(/\{\{lang:(en|hi)\}\}/g, (m, l) => (l === 'en' ? ctx.prefix + ctx.file : (buildHindi ? ctx.prefix + 'hi/' + ctx.file : '#hindi-pending')));
  out = out.replace(/\{\{href:([^}]+)\}\}/g, (m, rel) => rel.trim());
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CHROMES = {
  staff: { topbar: 'topbar-staff', nav: '', footer: 'footer-candidate' },
  candidate: { topbar: 'topbar-candidate', nav: 'nav-candidate', footer: 'footer-candidate' },
  signin: { topbar: 'topbar-public', nav: '', footer: 'footer-public' },
};

async function main() {
  const out = await bundle();
  ['rms', 'candidate', 'login', 'css'].forEach((k) => { if (!out[k]) fail('bundle ' + k + ' missing'); });
  const langs = buildHindi ? ['en', 'hi'] : ['en'];
  const packs = {};
  langs.forEach((l) => { packs[l] = emit('i18n-' + l + '.js', Buffer.from('window.__RMS_I18N__=' + JSON.stringify(pack(l)) + ';')); });

  const pages = fs.readdirSync(path.join(root, 'pages')).filter((f) => f.endsWith('.html'));
  for (const lang of langs) {
    for (const file of pages) {
      const raw = read(path.join(root, 'pages', file));
      const m = /^<!--\s*(\{[\s\S]*?\})\s*-->\s*/.exec(raw);
      if (!m) fail(file + ' has no front-matter comment');
      const meta = JSON.parse(m[1]);
      const body = raw.slice(m[0].length);
      const chrome = CHROMES[meta.chrome || 'staff'];
      if (!chrome) fail(file + ': unknown chrome ' + meta.chrome);
      const prefix = lang === 'en' ? '' : '../';
      const ctx = { text: pack(lang).text, prefix, file, page: file };
      const scripts = '<script defer src="' + prefix + packs[lang] + '"></script>\n<script defer src="' + prefix + out[meta.script] + '"></script>';
      let html = layout
        .replace('{{content}}', body)
        .replace('{{topbar}}', chrome.topbar ? partial(chrome.topbar) : '')
        .replace('{{header}}', partial(PUBLIC ? 'header-demo' : 'header'))
        .replace('{{nav}}', chrome.nav ? partial(chrome.nav) : '')
        .replace('{{footer}}', partial(PUBLIC ? 'footer-demo' : chrome.footer))
        .replace('{{lang}}', lang)
        .replace('{{chrome}}', meta.chrome || 'staff')
        .replace('{{bodyClass}}', (meta.chrome === 'signin' ? ' chrome--public' : (meta.chrome === 'candidate' ? '' : ' chrome--candidate')) + (PUBLIC ? ' rms-public' : ''))
        .replace('{{title}}', escapeHtml((meta.title ? meta.title + ' | ' : '') + (PUBLIC ? 'RMS product demo (unofficial)' : 'RRB Recruitment Management System')))
        .replace('{{css}}', prefix + out.css)
        .replace('{{fonts}}', '')
        .replace('{{script}}', scripts);
      if (PUBLIC) {
        html = html.replace('{{brand:favicon.png}}', '{{brand:demo-favicon.png}}')
          .replace('<meta name="referrer" content="no-referrer">', '<meta name="referrer" content="no-referrer">\n<meta name="robots" content="noindex, nofollow">');
      }
      html = render(html, ctx);
      const dest = path.join(dist, lang === 'en' ? '' : 'hi', file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, html);
    }
  }
  if (PUBLIC) {
    fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    fs.writeFileSync(path.join(dist, '.nojekyll'), '');
  }
  const total = Object.keys(sortedEn).length;
  process.stdout.write('rms build: ' + pages.length + ' pages, ' + total + ' text keys (' + hiCoverage + ' translated to Hindi)' + (buildHindi ? ', Hindi pages built' : '') + (PUBLIC ? ', public demo branding' : '') + ' -> ' + path.relative(process.cwd(), dist) + '\n');
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
