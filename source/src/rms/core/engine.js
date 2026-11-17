// Business rules used by the screens and the seed data: vacancy calculation, roster checks,
// panel formation (merit-cum-preference with vertical and horizontal reservation) and distribution.
import { ROSTER, CATEGORIES, QUALIFYING } from './refdata.js';

export const STD_ORDER = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2'];
export const HZ_TYPES = ['ExSM', 'VI', 'HI', 'LD', 'OD', 'MD'];

// A candidate fit in a higher standard is fit for every lower one (A1 is the highest).
export function fitFor(achieved, required) {
  const a = STD_ORDER.indexOf(achieved);
  const r = STD_ORDER.indexOf(required);
  return a >= 0 && r >= 0 && a <= r;
}

function n(v) { return Number(v) || 0; }

// Vacancy assessment, following the OIRMS form: DR vacancy in the indenting grade plus resultant,
// diverted, construction/RE, anticipated and unforeseen vacancies, plus a non-materialisation
// allowance (capped at 30%), less commitments already in the pipeline.
export function calc(c) {
  const dr = Math.max(0, n(c.sanctioned) - n(c.onRoll));
  const subtotal = dr + n(c.resultant) + n(c.prq) + n(c.ldce) + n(c.con) + n(c.re) + n(c.anticipated) + n(c.unforeseen);
  const nonMatPct = Math.min(30, Math.max(0, n(c.nonMatPct)));
  const nonMat = Math.round((subtotal * nonMatPct) / 100);
  const total = subtotal + nonMat;
  const deductions = n(c.inTraining) + n(c.panelsOnHand) + n(c.outstanding) + n(c.gdce) + n(c.compassionate);
  const balance = Math.max(0, total - deductions);
  return { dr, subtotal, nonMatPct, nonMat, total, deductions, balance };
}

export function sum(vac) {
  let t = 0;
  for (let i = 0; i < CATEGORIES.length; i++) t += n(vac[CATEGORIES[i]]);
  return t;
}

// Suggested community-wise split for a number of vacancies using the DR roster percentages.
export function suggestSplit(total) {
  const out = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
  let used = 0;
  ['OBC', 'SC', 'EWS', 'ST'].forEach((c) => {
    out[c] = Math.floor((total * ROSTER[c]) / 100);
    used += out[c];
  });
  out.UR = total - used;
  return out;
}

export function suggestHorizontal(total, level, pwbdSuitable) {
  const hz = { ExSM: Math.round((total * (level === 1 ? 20 : 10)) / 100), VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 };
  const pwbd = Math.floor((total * 4) / 100);
  const types = ['VI', 'HI', 'LD', 'MD'].filter((t) => pwbdSuitable && pwbdSuitable[t]);
  for (let i = 0; i < pwbd && types.length; i++) hz[types[i % types.length]]++;
  return hz;
}

// Problems are blocking; warnings need a remark but can be submitted.
export function validateIndent(ind, sanctionedDR) {
  const problems = [];
  const warnings = [];
  const total = sum(ind.vac);
  if (total !== n(ind.total)) problems.push({ key: 'sum', text: 'Community-wise break-up adds up to ' + total + ' but the vacancy to be indented is ' + n(ind.total) + '.' });
  CATEGORIES.forEach((c) => { if (n(ind.vac[c]) < 0) problems.push({ key: 'neg', text: c + ' cannot be negative.' }); });
  if (sanctionedDR && n(ind.total) > sanctionedDR) problems.push({ key: 'ss', text: 'Indent (' + n(ind.total) + ') exceeds the sanctioned DR-quota strength (' + sanctionedDR + ').' });
  const s = suggestSplit(n(ind.total));
  ['SC', 'ST', 'OBC', 'EWS'].forEach((c) => {
    const d = n(ind.vac[c]) - s[c];
    if (Math.abs(d) > 1) warnings.push({ key: 'roster-' + c, text: c + ' is ' + (d > 0 ? d + ' above' : -d + ' below') + ' the roster share (' + s[c] + '). Record the roster point or backlog that justifies it.' });
  });
  let hzTotal = 0;
  for (const k in ind.hz || {}) hzTotal += n(ind.hz[k]);
  if (hzTotal > n(ind.total)) problems.push({ key: 'hz', text: 'Horizontal reservations (' + hzTotal + ') exceed the vacancies.' });
  return { problems, warnings };
}

export function qualifies(c, rules) {
  const r = rules || QUALIFYING;
  const floor = (r[c.cat] != null ? r[c.cat] : 40) - (c.pwbd && r.pwbdRelax ? r.pwbdRelax : 0);
  return c.marks >= floor;
}

function byMerit(a, b) {
  if (b.marks !== a.marks) return b.marks - a.marks;
  if (a.dob !== b.dob) return a.dob < b.dob ? -1 : 1;
  return a.name < b.name ? -1 : 1;
}

function hasHz(c, t) {
  return t === 'ExSM' ? !!c.exsm : !!(c.pwbd && c.pwbd.type === t);
}

// posts: [{ post, med, vac:{UR..ST}, hz:{ExSM,VI..}, pwbd:{VI:'LV'|'',...} }]
// pool:  [{ id, name, cat, marks, dob, prefs:[post ids], exsm, pwbd:{type,sub}|null, medStd|null, medPending }]
export function formPanels(posts, pool, opts) {
  const provisional = !!(opts && opts.provisional);
  const byPost = {};
  const seats = {};
  const alloc = {};
  posts.forEach((p) => {
    byPost[p.post] = p;
    seats[p.post] = { UR: n(p.vac.UR), EWS: n(p.vac.EWS), OBC: n(p.vac.OBC), SC: n(p.vac.SC), ST: n(p.vac.ST) };
    alloc[p.post] = [];
  });
  const sorted = pool.slice().sort(byMerit);
  const state = {};
  sorted.forEach((c, i) => { state[c.id] = { merit: i + 1, done: false }; });

  function eligible(c, p) {
    if (c.pwbd && !(p.pwbd && p.pwbd[c.pwbd.type])) return false;
    if (c.medStd) return fitFor(c.medStd, p.med);
    return provisional && !!c.medPending;
  }
  function row(c, charged, pref, hz, adjusted) {
    return { roll: c.id, name: c.name, cat: c.cat, charged, hz: hz || '', marks: c.marks, merit: state[c.id].merit, pref: pref + 1, provisional: !c.medStd, adjusted: !!adjusted, dob: c.dob };
  }

  // Vertical: merit order, each candidate takes the best preference with a UR seat or a seat in their category.
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    for (let k = 0; k < c.prefs.length; k++) {
      const p = byPost[c.prefs[k]];
      if (!p || !eligible(c, p)) continue;
      const s = seats[p.post];
      const hz = hasHz(c, 'ExSM') ? 'ExSM' : (c.pwbd ? c.pwbd.type : '');
      if (s.UR > 0) { s.UR--; alloc[p.post].push(row(c, 'UR', k, hz)); state[c.id].done = true; break; }
      if (c.cat !== 'UR' && s[c.cat] > 0) { s[c.cat]--; alloc[p.post].push(row(c, c.cat, k, hz)); state[c.id].done = true; break; }
    }
  }

  // Horizontal: if a post is short of ExSM/PwBD candidates, bring in the best-placed eligible one and
  // move out the lowest-merit candidate without a horizontal claim in the same compartment.
  const hzShort = {};
  const displaced = [];
  posts.forEach((p) => {
    hzShort[p.post] = {};
    HZ_TYPES.forEach((t) => {
      const need = n(p.hz && p.hz[t]);
      if (!need) return;
      let have = alloc[p.post].filter((r) => r.hz === t).length;
      while (have < need) {
        let cand = null;
        for (let i = 0; i < sorted.length; i++) {
          const c = sorted[i];
          if (!state[c.id].done && hasHz(c, t) && c.prefs.indexOf(p.post) >= 0 && eligible(c, p)) { cand = c; break; }
        }
        if (!cand) break;
        const list = alloc[p.post].filter((r) => !r.hz && (r.charged === cand.cat || r.charged === 'UR'));
        if (!list.length) break;
        list.sort((a, b) => (a.charged === cand.cat) === (b.charged === cand.cat) ? b.merit - a.merit : (a.charged === cand.cat ? -1 : 1));
        const victim = list[0];
        alloc[p.post].splice(alloc[p.post].indexOf(victim), 1);
        state[victim.roll].done = false;
        displaced.push({ roll: victim.roll, post: p.post, by: cand.id });
        alloc[p.post].push(row(cand, victim.charged, cand.prefs.indexOf(p.post), t, true));
        state[cand.id].done = true;
        have++;
      }
      if (have < need) hzShort[p.post][t] = need - have;
    });
  });

  return posts.map((p) => ({
    post: p.post,
    rows: alloc[p.post].sort((a, b) => a.merit - b.merit),
    shortfall: seats[p.post],
    hzShort: hzShort[p.post],
    displaced: displaced.filter((d) => d.post === p.post),
  }));
}

// Distribute a post's panel across the field indents that make it up: merit order, each candidate to
// the first unit that still needs that category (units in the order given).
export function distribute(rows, fieldIndents) {
  const need = fieldIndents.map((f) => ({ unit: f.unit, left: { UR: n(f.vac.UR), EWS: n(f.vac.EWS), OBC: n(f.vac.OBC), SC: n(f.vac.SC), ST: n(f.vac.ST) } }));
  const out = {};
  rows.forEach((r) => {
    let placed = null;
    for (let i = 0; i < need.length; i++) {
      if (need[i].left[r.charged] > 0) { need[i].left[r.charged]--; placed = need[i].unit; break; }
    }
    if (!placed) {
      for (let i = 0; i < need.length; i++) {
        const l = need[i].left;
        if (l.UR + l.EWS + l.OBC + l.SC + l.ST > 0) { placed = need[i].unit; break; }
      }
    }
    out[r.roll] = placed || (need[0] && need[0].unit) || '';
  });
  return out;
}
