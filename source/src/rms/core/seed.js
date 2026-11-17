// Synthetic, deterministic demo data. Dates are relative to the moment the demo is (re)seeded so
// screens always look current. Nothing here is real candidate data.
import { rng } from './rng.js';
import { RRBS, ZONES, CPOS, UNITS, EXAM_GROUPS, POSTS, HOSPITALS, CENTRES, FIRST, LAST, STATES, CITIES, QUALIFYING } from './refdata.js';
import { calc, suggestSplit, formPanels, distribute, sum, STD_ORDER } from './engine.js';
import { chainHash } from './chain.js';

export const VERSION = 11;
const DAY = 86400000;

function pad(v, len) { let s = String(v); while (s.length < len) s = '0' + s; return s; }

export function seed() {
  const R = rng(20261117);
  const T0 = Date.now();
  const at = (days, hour, min) => {
    const d = new Date(T0 + days * DAY);
    d.setHours(hour == null ? 10 : hour, min == null ? 0 : min, 0, 0);
    return d.toISOString();
  };
  const ymd = (days) => {
    const d = new Date(T0 + days * DAY);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  };
  const post = (id) => POSTS.filter((p) => p.id === id)[0];
  const events = [];
  const ev = (when, actor, role, action, entity, ref, detail) => events.push({ at: when, actor, role, action, entity, ref, detail: detail || '' });

  const db = {
    version: VERSION,
    seededAt: new Date(T0).toISOString(),
    seq: { notification: 0, grievance: 100, debar: 30, alert: 50, audit: 0, eca: 4, centreAudit: 20, report: 40, panel: 2, offer: 40, request: 3, memo: 500 },
    rrbs: RRBS, zones: ZONES, cpos: CPOS, units: UNITS, groups: EXAM_GROUPS, hospitals: HOSPITALS, centres: CENTRES,
    posts: POSTS.map((p) => Object.assign({ nodal: EXAM_GROUPS.filter((g) => g.id === p.group)[0].nodal, status: 'Active' }, p)),
    meritRules: { UR: QUALIFYING.UR, EWS: QUALIFYING.EWS, OBC: QUALIFYING.OBC, SC: QUALIFYING.SC, ST: QUALIFYING.ST, pwbdRelax: 2, faceThreshold: 0.75 },
  };

  // ------------------------------------------------------------------ users
  const U = {
    unit: { id: 'U-UNIT', name: 'Ramesh Kulkarni', title: 'Sr. Divisional Personnel Officer, Bengaluru', role: 'unit', unit: 'SBC', zone: 'SWR', rrb: 'SBC' },
    cpo: { id: 'U-CPO', name: 'Anitha Rao', title: 'Dy. Chief Personnel Officer (Recruitment), SWR', role: 'cpo', zone: 'SWR', rrb: 'SBC' },
    rrb: { id: 'U-RRB', name: 'Mohan Gowda', title: 'Office Superintendent, Confidential Section', role: 'rrb', rrb: 'SBC' },
    ms: { id: 'U-MS', name: 'Kavya Hegde', title: 'Member Secretary, RRB Bengaluru', role: 'ms', rrb: 'SBC' },
    chair: { id: 'U-CHAIR', name: 'Vikram Iyer', title: 'Chairperson, RRB Bengaluru', role: 'chair', rrb: 'SBC' },
    nodal: { id: 'U-NODAL', name: 'Nikhil Desai', title: 'Assistant Secretary, Nodal cell (ALP & Technicians), RRB Ahmedabad', role: 'nodal', rrb: 'ADI' },
    rrcb: { id: 'U-RRCB', name: 'Priya Menon', title: 'Director (RRCB), Railway Board', role: 'rrcb' },
    verifier: { id: 'U-DV1', name: 'Suresh Naik', title: 'Chief Office Superintendent (DV), RRB Bengaluru', role: 'verifier', rrb: 'SBC' },
    hospital: { id: 'U-HOSP', name: 'Dr. Lakshmi Murthy', title: 'ACMS, Divisional Railway Hospital, Bengaluru', role: 'hospital', hospital: 'SBCDH' },
    helpdesk: { id: 'U-HELP', name: 'Sneha Patil', title: 'Helpdesk Executive (Candidate support)', role: 'helpdesk' },
    auditor: { id: 'U-AUD', name: 'Arjun Shetty', title: 'Test-centre Auditor, RRB Bengaluru', role: 'auditor', rrb: 'SBC' },
    admin: { id: 'U-ADMIN', name: 'Deepak Verma', title: 'System Administrator', role: 'admin' },
  };
  const extra = [
    { id: 'U-UNIT2', name: 'Shilpa Bhat', title: 'APO, Mysuru Division', role: 'unit', unit: 'MYS', zone: 'SWR', rrb: 'SBC' },
    { id: 'U-UNIT3', name: 'Harish Angadi', title: 'Sr. DPO, Hubballi Division', role: 'unit', unit: 'UBL', zone: 'SWR', rrb: 'SBC' },
    { id: 'U-UNIT4', name: 'Rekha Pillai', title: 'Works Personnel Officer, CWM', role: 'unit', unit: 'CWM', zone: 'SWR', rrb: 'SBC' },
    { id: 'U-UNIT5', name: 'Gaurav Joshi', title: 'Personnel Officer, Construction', role: 'unit', unit: 'CNSWR', zone: 'SWR', rrb: 'SBC' },
    { id: 'U-UNIT6', name: 'Varsha Desai', title: 'APO (Recruitment), HQ SWR', role: 'unit', unit: 'SWRHQ', zone: 'SWR', rrb: 'SBC' },
    { id: 'U-DV2', name: 'Pallavi Kamble', title: 'Office Superintendent (DV), RRB Bengaluru', role: 'verifier', rrb: 'SBC' },
    { id: 'U-DV3', name: 'Imran Shaikh', title: 'Chief Office Superintendent (DV), RRB Bengaluru', role: 'verifier', rrb: 'SBC' },
    { id: 'U-HOSP2', name: 'Dr. Karthik Hiremath', title: 'CMS, Central Hospital, Hubballi', role: 'hospital', hospital: 'UBLCH' },
    { id: 'U-HOSP3', name: 'Dr. Nandini Rao', title: 'ACMS, Divisional Railway Hospital, Mysuru', role: 'hospital', hospital: 'MYSDH' },
    { id: 'U-HELP2', name: 'Faisal Khan', title: 'Helpdesk Executive (Calls)', role: 'helpdesk' },
    { id: 'U-AUD2', name: 'Meghana Biradar', title: 'Test-centre Auditor, RRB Bengaluru', role: 'auditor', rrb: 'SBC' },
    { id: 'U-RRB2', name: 'Joseph Fernandes', title: 'Dealing Assistant, Panel cell', role: 'rrb', rrb: 'SBC' },
    { id: 'U-CPO2', name: 'Ganesh Murthy', title: 'Dy. CPO (Recruitment), SR', role: 'cpo', zone: 'SR', rrb: 'MAS' },
    { id: 'U-MS2', name: 'Bharath Reddy', title: 'Member Secretary, RRB Chennai', role: 'ms', rrb: 'MAS' },
  ];
  db.users = Object.keys(U).map((k) => U[k]).concat(extra).map((u, i) => Object.assign({ active: true, email: u.id.toLowerCase().replace('u-', '') + '@rrb.demo', mobile: '9' + pad(800000000 + i * 7919, 9), lastLogin: at(-R.int(0, 6), R.int(9, 18), R.int(0, 59)), mfa: 'OTP' }, u));
  db.users.push({ id: 'U-OLD1', name: 'Rakesh Choudhary', title: 'Dealing Assistant (transferred)', role: 'rrb', rrb: 'SBC', active: false, email: 'old1@rrb.demo', mobile: '9811111111', lastLogin: at(-120), mfa: 'OTP' });

  // ------------------------------------------------------------------ post mapping & vacancy register
  const SWR_UNITS = ['SBC', 'MYS', 'UBL', 'SWRHQ', 'CWM', 'CNSWR'];
  const MAP = {
    SBC: ['P101', 'P102', 'P103', 'P104', 'P201', 'P202', 'P204', 'P301', 'P401', 'P402', 'P404', 'P501', 'P801', 'P802', 'P803'],
    MYS: ['P101', 'P102', 'P103', 'P201', 'P202', 'P301', 'P401', 'P402', 'P501', 'P801', 'P803'],
    UBL: ['P101', 'P102', 'P103', 'P201', 'P202', 'P204', 'P301', 'P401', 'P402', 'P404', 'P501', 'P801', 'P802', 'P803'],
    SWRHQ: ['P203', 'P403', 'P502', 'P601', 'P602', 'P701'],
    CWM: ['P103', 'P204', 'P205', 'P502'],
    CNSWR: ['P102', 'P202', 'P801'],
  };
  db.mappings = MAP;
  db.vacancy = [];
  SWR_UNITS.forEach((u) => {
    MAP[u].forEach((pid) => {
      const p = post(pid);
      const big = p.level <= 2 ? 1 : 0.35;
      const sanctioned = Math.round(R.int(40, 260) * big) + 12;
      const vac = Math.max(2, Math.round(sanctioned * (0.08 + R.next() * 0.12)));
      db.vacancy.push({
        id: u + '-' + pid, unit: u, post: pid, cycle: '2027', sanctioned, onRoll: sanctioned - vac,
        inTraining: R.int(0, Math.max(0, Math.floor(vac / 5))), panelsOnHand: R.int(0, 2), outstanding: R.int(0, 3),
        resultant: Math.round(vac * 0.1), anticipated: R.int(1, 4), unforeseen: R.int(0, 3), nonMatPct: R.int(8, 22),
        updatedAt: at(-R.int(3, 40), R.int(10, 17)), updatedBy: u === 'SBC' ? U.unit.name : 'Unit user',
      });
    });
  });
  db.postRequests = [
    { id: 'PR-1', unit: 'CWM', designation: 'Technician Gr III (Welder)', dept: 'Mechanical', sub: 'Workshop', level: 2, med: 'B1', ref: 'RBE 41/2025', reason: 'Trade not in post master; welders currently indented as Technician Gr III (Fitter).', status: 'Pending with RRB Admin', at: at(-6, 12) },
    { id: 'PR-2', unit: 'SBC', designation: 'Junior Engineer (Track Machine)', dept: 'Engineering', sub: 'Track Machine', level: 6, med: 'B1', ref: 'Board letter 2025/E(RRB)/25/18', reason: 'Track machine JE posts created for new machines.', status: 'Approved', at: at(-48, 11), decidedAt: at(-41, 15) },
    { id: 'PR-3', unit: 'UBL', designation: 'Commercial Clerk (Parcel)', dept: 'Commercial', sub: 'Commercial', level: 3, med: 'C2', ref: '—', reason: 'Duplicate of Commercial cum Ticket Clerk.', status: 'Rejected', at: at(-30, 10), decidedAt: at(-27, 16), remarks: 'Use the standard designation Commercial cum Ticket Clerk.' },
  ];

  // ------------------------------------------------------------------ indents
  db.indents = [];
  function inputsFor(target, sanctionedHint) {
    const nonMatPct = R.int(8, 20);
    const inTraining = R.int(0, 2);
    const panelsOnHand = R.int(0, 2);
    const outstanding = R.int(0, 2);
    const resultant = R.int(0, Math.max(1, Math.round(target / 6)));
    const prq = R.int(0, 1);
    const ldce = R.int(0, 1);
    const con = 0;
    const anticipated = R.int(1, 3);
    const unforeseen = R.int(0, 2);
    const base = { nonMatPct, inTraining, panelsOnHand, outstanding, resultant, prq, ldce, con, re: 0, anticipated, unforeseen, gdce: 0, compassionate: 0 };
    let dr = Math.max(0, Math.round((target + inTraining + panelsOnHand + outstanding) / (1 + nonMatPct / 100)) - (resultant + prq + ldce + anticipated + unforeseen));
    for (let i = 0; i < 40; i++) {
      const sanctioned = Math.max(sanctionedHint || 0, dr + 20 + target * 3);
      const c = calc(Object.assign({ sanctioned, onRoll: sanctioned - dr }, base));
      if (c.balance === target) return Object.assign({ sanctioned, onRoll: sanctioned - dr }, base);
      dr += c.balance < target ? 1 : -1;
      if (dr < 0) { dr = 0; base.resultant = Math.max(0, base.resultant - 1); base.anticipated = Math.max(0, base.anticipated - 1); }
    }
    const sanctioned = target * 4 + 20;
    return Object.assign({}, base, { sanctioned, onRoll: sanctioned - target, nonMatPct: 0, inTraining: 0, panelsOnHand: 0, outstanding: 0, resultant: 0, prq: 0, ldce: 0, anticipated: 0, unforeseen: 0 });
  }
  function hzZero() { return { ExSM: 0, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }; }
  const actor = (u) => ({ by: u.name, role: u.role });
  function fieldIndent(o) {
    const p = post(o.post);
    const unit = UNITS.filter((x) => x.id === o.unit)[0];
    const total = o.total;
    const vac = o.vac || suggestSplit(total);
    const ind = {
      id: o.id, level: 'field', cycle: o.cycle, group: p.group, post: o.post, unit: o.unit, zone: unit.zone, cpo: 'CPO-' + unit.zone,
      rrb: unit.rrb, nodal: EXAM_GROUPS.filter((g) => g.id === p.group)[0].nodal, type: o.type || 'Regular', parent: o.parent || null,
      inputs: inputsFor(total), vac, hz: o.hz || hzZero(), total, status: o.status, rrbIndent: o.rrbIndent || null, cen: o.cen || null,
      createdAt: o.created, updatedAt: o.updated || o.created, remarks: o.remarks || '', roster: o.roster || '',
      signed: o.status === 'Draft' ? null : { by: o.who.name, at: o.created, mode: 'Aadhaar e-Sign (demo)' },
      versions: [{ v: 1, at: o.created, by: o.who.name, total, vac: Object.assign({}, o.vacV1 || vac), hz: Object.assign({}, o.hz || hzZero()), note: 'Created' }],
      history: [{ at: o.created, by: o.who.name, role: o.who.role, action: 'Created', remarks: '' }],
    };
    (o.trail || []).forEach((t) => {
      ind.history.push({ at: t.at, by: t.who.name, role: t.who.role, action: t.action, remarks: t.remarks || '' });
      if (t.version) ind.versions.push({ v: ind.versions.length + 1, at: t.at, by: t.who.name, total: t.version.total, vac: t.version.vac, hz: t.version.hz || ind.hz, note: t.version.note });
      ev(t.at, t.who.name, t.who.role, t.action, 'Indent', ind.id, t.remarks || '');
    });
    ev(o.created, o.who.name, o.who.role, 'Created', 'Indent', ind.id, p.designation + ' · ' + total + ' vacancies');
    db.indents.push(ind);
    return ind;
  }
  function rrbIndent(o) {
    const kids = o.children.map((id) => db.indents.filter((x) => x.id === id)[0]);
    const vac = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
    const hz = hzZero();
    kids.forEach((k) => {
      for (const c in vac) vac[c] += k.vac[c];
      for (const t in hz) hz[t] += k.hz[t] || 0;
      k.rrbIndent = o.id;
    });
    const total = sum(vac);
    const p = post(o.post);
    const ind = {
      id: o.id, level: 'rrb', cycle: o.cycle, group: p.group, post: o.post, zone: o.zone, cpo: 'CPO-' + o.zone, rrb: o.rrb,
      nodal: EXAM_GROUPS.filter((g) => g.id === p.group)[0].nodal, type: o.type || 'Regular', children: o.children, vac, hz, total,
      status: o.status, cen: o.cen || null, createdAt: o.created, updatedAt: o.updated || o.created,
      signed: { by: o.who.name, at: o.created, mode: 'Aadhaar e-Sign (demo)' },
      versions: [{ v: 1, at: o.created, by: o.who.name, total, vac: Object.assign({}, vac), hz: Object.assign({}, hz), note: 'Consolidated from ' + o.children.length + ' field indent(s)' }],
      history: [{ at: o.created, by: o.who.name, role: o.who.role, action: 'Created RRB indent', remarks: 'Consolidated ' + o.children.join(', ') }],
    };
    (o.trail || []).forEach((t) => {
      ind.history.push({ at: t.at, by: t.who.name, role: t.who.role, action: t.action, remarks: t.remarks || '' });
      ev(t.at, t.who.name, t.who.role, t.action, 'Indent', ind.id, t.remarks || '');
    });
    ev(o.created, o.who.name, o.who.role, 'Created RRB indent', 'Indent', ind.id, p.designation + ' · ' + total);
    db.indents.push(ind);
    return ind;
  }
  function otherZoneRRBIndent(o) {
    // Indents from other zones: field indents are summarised, not modelled one by one.
    const p = post(o.post);
    const vac = o.vac || suggestSplit(o.total);
    const ind = {
      id: o.id, level: 'rrb', cycle: o.cycle, group: p.group, post: o.post, zone: o.zone, cpo: 'CPO-' + o.zone, rrb: o.rrb,
      nodal: EXAM_GROUPS.filter((g) => g.id === p.group)[0].nodal, type: 'Regular', children: [], external: true,
      vac, hz: o.hz || { ExSM: Math.round(o.total / 10), VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }, total: o.total, status: o.status, cen: o.cen || null,
      createdAt: o.created, updatedAt: o.updated || o.created, signed: { by: o.by, at: o.created, mode: 'Aadhaar e-Sign (demo)' },
      versions: [{ v: 1, at: o.created, by: o.by, total: o.total, vac, hz: {}, note: 'Received from ' + o.zone }],
      history: [{ at: o.created, by: o.by, role: 'cpo', action: 'Created RRB indent', remarks: '' }].concat(o.trail || []),
    };
    db.indents.push(ind);
  }

  // CEN 03/2026 - Section Controller (complete cycle, now at joining)
  fieldIndent({ id: '26SBC011', cycle: '2026', post: 'P301', unit: 'SBC', total: 8, vac: { UR: 4, EWS: 1, OBC: 2, SC: 1, ST: 0 }, hz: { ExSM: 1, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }, status: 'Consolidated', created: at(-420, 11), who: U.unit, cen: 'CEN 03/2026',
    trail: [{ at: at(-419, 15), who: U.unit, action: 'Submitted to CPO' }, { at: at(-414, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '26MYS011', cycle: '2026', post: 'P301', unit: 'MYS', total: 5, vac: { UR: 2, EWS: 1, OBC: 1, SC: 1, ST: 0 }, hz: { ExSM: 1, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }, status: 'Consolidated', created: at(-421, 10), who: extra[0], cen: 'CEN 03/2026',
    trail: [{ at: at(-418, 16), who: extra[0], action: 'Submitted to CPO' }, { at: at(-414, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '26UBL011', cycle: '2026', post: 'P301', unit: 'UBL', total: 5, vac: { UR: 2, EWS: 0, OBC: 1, SC: 1, ST: 1 }, status: 'Consolidated', created: at(-420, 15), who: extra[1], cen: 'CEN 03/2026',
    trail: [{ at: at(-417, 11), who: extra[1], action: 'Submitted to CPO' }, { at: at(-414, 12), who: U.cpo, action: 'Approved by CPO' }] });
  rrbIndent({ id: '26SWR011', cycle: '2026', post: 'P301', zone: 'SWR', rrb: 'SBC', children: ['26SBC011', '26MYS011', '26UBL011'], status: 'Compiled for CEN', cen: 'CEN 03/2026', created: at(-413, 11), who: U.cpo,
    trail: [{ at: at(-413, 16), who: U.cpo, action: 'Submitted to RRB' }, { at: at(-409, 12), who: U.ms, action: 'Approved by RRB' }, { at: at(-402, 15), who: { name: 'Nodal RRB Bhopal', role: 'nodal' }, action: 'Approved by Nodal RRB' }, { at: at(-380, 11), who: { name: 'Nodal RRB Bhopal', role: 'nodal' }, action: 'Compiled for CEN', remarks: 'CEN 03/2026' }] });

  // CEN 04/2026 - JE, DMS & CMA (at DV & medical)
  const JE = [
    { post: 'P201', parts: [['SBC', 10], ['MYS', 6], ['UBL', 8]], hz: { ExSM: 2, HI: 1 } },
    { post: 'P202', parts: [['SBC', 8], ['MYS', 5], ['UBL', 7]], hz: { ExSM: 2, LD: 1 } },
    { post: 'P203', parts: [['SWRHQ', 6]], hz: { ExSM: 1, LD: 1 } },
    { post: 'P204', parts: [['SBC', 3], ['UBL', 3], ['CWM', 2]], hz: { ExSM: 1 } },
    { post: 'P205', parts: [['CWM', 4]], hz: {} },
  ];
  const unitUser = { SBC: U.unit, MYS: extra[0], UBL: extra[1], CWM: extra[2], CNSWR: extra[3], SWRHQ: extra[4] };
  JE.forEach((j, idx) => {
    const kids = j.parts.map((pt, i) => {
      const hz = hzZero();
      if (i === 0) for (const t in j.hz) hz[t] = Math.ceil(j.hz[t] / 2);
      if (i === 1) for (const t in j.hz) hz[t] = Math.floor(j.hz[t] / 2);
      if (j.parts.length === 1) for (const t in j.hz) hz[t] = j.hz[t];
      const id = '26' + pt[0] + pad(21 + idx, 3);
      fieldIndent({ id, cycle: '2026', post: j.post, unit: pt[0], total: pt[1], hz, status: 'Consolidated', created: at(-400 + i, 11), who: unitUser[pt[0]], cen: 'CEN 04/2026',
        trail: [{ at: at(-399 + i, 15), who: unitUser[pt[0]], action: 'Submitted to CPO' }, { at: at(-394, 12), who: U.cpo, action: 'Approved by CPO' }] });
      return id;
    });
    rrbIndent({ id: '26SWR' + pad(21 + idx, 3), cycle: '2026', post: j.post, zone: 'SWR', rrb: 'SBC', children: kids, status: 'Compiled for CEN', cen: 'CEN 04/2026', created: at(-393, 11), who: U.cpo,
      trail: [{ at: at(-393, 16), who: U.cpo, action: 'Submitted to RRB' }, { at: at(-390, 12), who: U.ms, action: 'Approved by RRB' }, { at: at(-384, 15), who: { name: 'Nodal RRB Secunderabad', role: 'nodal' }, action: 'Approved by Nodal RRB' }, { at: at(-360, 11), who: { name: 'Nodal RRB Secunderabad', role: 'nodal' }, action: 'Compiled for CEN', remarks: 'CEN 04/2026' }] });
  });

  // 2027 cycle - ALP & Technicians (live indenting, every stage represented)
  const cyc = '2027';
  fieldIndent({ id: '27SBC001', cycle: cyc, post: 'P101', unit: 'SBC', total: 46, status: 'Consolidated', created: at(-21, 11), who: U.unit,
    trail: [{ at: at(-20, 15), who: U.unit, action: 'Submitted to CPO' }, { at: at(-17, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27MYS001', cycle: cyc, post: 'P101', unit: 'MYS', total: 28, status: 'Consolidated', created: at(-21, 15), who: extra[0],
    trail: [{ at: at(-19, 10), who: extra[0], action: 'Submitted to CPO' }, { at: at(-17, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27UBL001', cycle: cyc, post: 'P101', unit: 'UBL', total: 39, status: 'Consolidated', created: at(-22, 10), who: extra[1],
    trail: [{ at: at(-20, 11), who: extra[1], action: 'Submitted to CPO' }, { at: at(-18, 16), who: U.cpo, action: 'Returned by CPO', remarks: 'Non-materialisation % taken as 30 without justification. Recheck against last 3 panels.' },
      { at: at(-18, 18), who: extra[1], action: 'Resubmitted to CPO', remarks: 'Corrected non-materialisation to 18%.', version: { total: 39, vac: suggestSplit(39), note: 'Non-materialisation revised 30% → 18%' } }, { at: at(-17, 12), who: U.cpo, action: 'Approved by CPO' }] });
  rrbIndent({ id: '27SWR001', cycle: cyc, post: 'P101', zone: 'SWR', rrb: 'SBC', children: ['27SBC001', '27MYS001', '27UBL001'], status: 'Approved by RRB', created: at(-16, 11), who: U.cpo,
    trail: [{ at: at(-16, 15), who: U.cpo, action: 'Submitted to RRB' }, { at: at(-12, 12), who: U.ms, action: 'Approved by RRB', remarks: 'Forwarded to Nodal RRB Ahmedabad.' }] });

  fieldIndent({ id: '27SBC002', cycle: cyc, post: 'P102', unit: 'SBC', total: 18, hz: { ExSM: 2, VI: 0, HI: 0, LD: 1, OD: 0, MD: 0 }, status: 'Consolidated', created: at(-19, 12), who: U.unit,
    trail: [{ at: at(-18, 10), who: U.unit, action: 'Submitted to CPO' }, { at: at(-15, 11), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27MYS002', cycle: cyc, post: 'P102', unit: 'MYS', total: 11, hz: { ExSM: 1, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }, status: 'Consolidated', created: at(-19, 14), who: extra[0],
    trail: [{ at: at(-18, 12), who: extra[0], action: 'Submitted to CPO' }, { at: at(-15, 11), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27UBL002', cycle: cyc, post: 'P102', unit: 'UBL', total: 15, hz: { ExSM: 1, VI: 0, HI: 0, LD: 1, OD: 0, MD: 0 }, status: 'Consolidated', created: at(-19, 16), who: extra[1],
    trail: [{ at: at(-17, 12), who: extra[1], action: 'Submitted to CPO' }, { at: at(-15, 11), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27CNSWR002', cycle: cyc, post: 'P102', unit: 'CNSWR', total: 6, status: 'Consolidated', created: at(-20, 11), who: extra[3],
    trail: [{ at: at(-18, 16), who: extra[3], action: 'Submitted to CPO' }, { at: at(-15, 11), who: U.cpo, action: 'Approved by CPO' }] });
  rrbIndent({ id: '27SWR002', cycle: cyc, post: 'P102', zone: 'SWR', rrb: 'SBC', children: ['27SBC002', '27MYS002', '27UBL002', '27CNSWR002'], status: 'Submitted to RRB', created: at(-3, 11), who: U.cpo,
    trail: [{ at: at(-3, 16), who: U.cpo, action: 'Submitted to RRB' }] });

  fieldIndent({ id: '27SBC003', cycle: cyc, post: 'P103', unit: 'SBC', total: 14, hz: { ExSM: 1, VI: 0, HI: 0, LD: 1, OD: 0, MD: 0 }, status: 'Submitted to CPO', created: at(-4, 10), who: U.unit,
    trail: [{ at: at(-2, 17), who: U.unit, action: 'Submitted to CPO' }] });
  fieldIndent({ id: '27MYS003', cycle: cyc, post: 'P103', unit: 'MYS', total: 9, vacV1: { UR: 4, EWS: 0, OBC: 2, SC: 3, ST: 0 }, status: 'Approved by CPO', created: at(-9, 11), who: extra[0],
    trail: [{ at: at(-8, 12), who: extra[0], action: 'Submitted to CPO' }, { at: at(-6, 15), who: U.cpo, action: 'Returned by CPO', remarks: 'SC break-up is 3 against a roster share of 1. Attach the roster point register or correct.' },
      { at: at(-5, 11), who: extra[0], action: 'Resubmitted to CPO', remarks: 'Corrected as per roster register.', version: { total: 9, vac: suggestSplit(9), note: 'SC 3 → 1, UR 4 → 6 as per roster register' } }, { at: at(-4, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27UBL003', cycle: cyc, post: 'P103', unit: 'UBL', total: 12, status: 'Approved by CPO', created: at(-8, 16), who: extra[1],
    trail: [{ at: at(-7, 10), who: extra[1], action: 'Submitted to CPO' }, { at: at(-4, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27CWM003', cycle: cyc, post: 'P103', unit: 'CWM', total: 21, hz: { ExSM: 2, VI: 0, HI: 0, LD: 1, OD: 0, MD: 0 }, status: 'Approved by CPO', created: at(-7, 11), who: extra[2],
    trail: [{ at: at(-6, 10), who: extra[2], action: 'Submitted to CPO' }, { at: at(-3, 12), who: U.cpo, action: 'Approved by CPO' }] });
  fieldIndent({ id: '27SBC005', cycle: cyc, post: 'P801', unit: 'SBC', total: 64, vac: { UR: 24, EWS: 6, OBC: 17, SC: 13, ST: 4 }, hz: { ExSM: 13, VI: 0, HI: 0, LD: 0, OD: 0, MD: 0 }, status: 'Returned by CPO', created: at(-6, 11), who: U.unit,
    trail: [{ at: at(-5, 15), who: U.unit, action: 'Submitted to CPO' }, { at: at(-2, 16), who: U.cpo, action: 'Returned by CPO', remarks: 'SC (13) is above the roster share (9). Either attach the roster point / backlog justification or correct the break-up.' }] });
  fieldIndent({ id: '27SBC004', cycle: cyc, post: 'P104', unit: 'SBC', total: 5, status: 'Draft', created: at(-2, 12), who: U.unit });

  [
    { id: '27SR001', post: 'P101', zone: 'SR', rrb: 'MAS', total: 132, status: 'Approved by Nodal RRB', by: 'Ganesh Murthy', created: at(-25, 11), trail: [{ at: at(-14, 11), by: 'Bharath Reddy', role: 'ms', action: 'Approved by RRB', remarks: '' }, { at: at(-6, 12), by: 'Nikhil Desai', role: 'nodal', action: 'Approved by Nodal RRB', remarks: '' }] },
    { id: '27SR002', post: 'P102', zone: 'SR', rrb: 'MAS', total: 58, status: 'Approved by RRB', by: 'Ganesh Murthy', created: at(-24, 11), trail: [{ at: at(-10, 11), by: 'Bharath Reddy', role: 'ms', action: 'Approved by RRB', remarks: '' }] },
    { id: '27SR003', post: 'P101', zone: 'SR', rrb: 'TVC', total: 41, status: 'Approved by RRB', by: 'CPO SR', created: at(-23, 15), trail: [{ at: at(-9, 12), by: 'MS, RRB Thiruvananthapuram', role: 'ms', action: 'Approved by RRB', remarks: '' }] },
    { id: '27SCR001', post: 'P101', zone: 'SCR', rrb: 'SC', total: 118, status: 'Approved by Nodal RRB', by: 'CPO SCR', created: at(-26, 11), trail: [{ at: at(-15, 11), by: 'MS, RRB Secunderabad', role: 'ms', action: 'Approved by RRB', remarks: '' }, { at: at(-5, 12), by: 'Nikhil Desai', role: 'nodal', action: 'Approved by Nodal RRB', remarks: '' }] },
    { id: '27SCR002', post: 'P102', zone: 'SCR', rrb: 'SC', total: 47, status: 'Returned by Nodal RRB', by: 'CPO SCR', created: at(-26, 15), trail: [{ at: at(-15, 11), by: 'MS, RRB Secunderabad', role: 'ms', action: 'Approved by RRB', remarks: '' }, { at: at(-4, 16), by: 'Nikhil Desai', role: 'nodal', action: 'Returned by Nodal RRB', remarks: 'EWS shown as 0; confirm with the roster before compilation.' }], vac: { UR: 23, EWS: 0, OBC: 13, SC: 7, ST: 4 } },
    { id: '27CR001', post: 'P101', zone: 'CR', rrb: 'BB', total: 96, status: 'Approved by Nodal RRB', by: 'CPO CR', created: at(-27, 11), trail: [{ at: at(-16, 11), by: 'MS, RRB Mumbai', role: 'ms', action: 'Approved by RRB', remarks: '' }, { at: at(-7, 10), by: 'Nikhil Desai', role: 'nodal', action: 'Approved by Nodal RRB', remarks: '' }] },
    { id: '27WR001', post: 'P101', zone: 'WR', rrb: 'ADI', total: 88, status: 'Approved by RRB', by: 'CPO WR', created: at(-24, 11), trail: [{ at: at(-8, 11), by: 'MS, RRB Ahmedabad', role: 'ms', action: 'Approved by RRB', remarks: '' }] },
    { id: '27ECOR001', post: 'P103', zone: 'ECOR', rrb: 'BBS', total: 64, status: 'Submitted to RRB', by: 'CPO ECoR', created: at(-6, 11), trail: [] },
  ].forEach((o) => otherZoneRRBIndent(Object.assign({ cycle: cyc }, o)));

  db.schedule = {
    cycle: '2027', group: 'ALP', title: 'Indenting schedule, ALP & Technicians (cycle 2027)',
    steps: [
      { key: 'unit', label: 'Indenting units submit to CPO', from: ymd(-28), to: ymd(-2) },
      { key: 'cpo', label: 'CPO consolidates and submits RRB indents', from: ymd(-20), to: ymd(4) },
      { key: 'rrb', label: 'RRBs approve and forward to Nodal RRB', from: ymd(-14), to: ymd(9) },
      { key: 'nodal', label: 'Nodal RRB compiles vacancy statement for CEN', from: ymd(-7), to: ymd(18) },
      { key: 'cen', label: 'CEN processing and publication', from: ymd(19), to: ymd(48) },
    ],
  };

  // ------------------------------------------------------------------ CENs
  db.cens = [
    { id: 'CEN 03/2026', group: 'SCTL', title: 'Section Controller', status: 'Panel & joining', published: ymd(-372), cbtFrom: ymd(-212), cbtTo: ymd(-209), result: ymd(-150), posts: ['P301'], nodal: 'BPL', stage: 'joining' },
    { id: 'CEN 04/2026', group: 'JE', title: 'Junior Engineer, DMS & CMA', status: 'DV & medical', published: ymd(-352), cbtFrom: ymd(-96), cbtTo: ymd(-88), result: ymd(-21), posts: ['P201', 'P202', 'P203', 'P204', 'P205'], nodal: 'SC', stage: 'dv' },
    { id: 'CEN 07/2026', group: 'NTPCG', title: 'Non-Technical Popular Categories (Graduate)', status: 'CBT in progress', published: ymd(-170), cbtFrom: ymd(-3), cbtTo: ymd(6), posts: ['P401', 'P402', 'P403', 'P404'], nodal: 'MAS', stage: 'exam', applicants: 98452 },
    { id: 'CEN 01/2027', group: 'ALP', title: 'Assistant Loco Pilot & Technicians', status: 'Indenting', posts: ['P101', 'P102', 'P103', 'P104'], nodal: 'ADI', stage: 'indent' },
  ];
  db.compilations = [
    { id: 'CMP-ALP-2027', group: 'ALP', cycle: '2027', nodal: 'ADI', status: 'In compilation', indents: ['27SR001', '27SCR001', '27CR001'], createdAt: at(-5, 11), by: 'Nikhil Desai', history: [{ at: at(-5, 11), by: 'Nikhil Desai', role: 'nodal', action: 'Compilation opened', remarks: 'Cycle 2027, ALP & Technicians' }] },
  ];

  // ------------------------------------------------------------------ candidates
  function gauss() {
    let u = 0;
    let v = 0;
    while (u === 0) u = R.next();
    while (v === 0) v = R.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function person() {
    const g = R.chance(0.64) ? 'M' : 'F';
    const first = R.pick(FIRST[g]);
    const last = R.pick(LAST);
    return { name: (first + ' ' + last).toUpperCase(), first, last, father: (R.pick(FIRST.M) + ' ' + last).toUpperCase(), mother: (R.pick(FIRST.F) + ' ' + last).toUpperCase(), gender: g === 'M' ? 'Male' : 'Female' };
  }
  function dobFor(minAge, maxAge) {
    const d = new Date(T0 - (R.int(minAge, maxAge) * 365.25 + R.int(0, 360)) * DAY);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }
  db.candidates = [];
  function makeCandidate(cen, prefix, i, prefs, ages, quals) {
    const p = person();
    const cat = R.weighted([['UR', 0.4], ['OBC', 0.27], ['SC', 0.15], ['ST', 0.08], ['EWS', 0.1]]);
    const pwbd = R.chance(0.045) ? R.pick([{ type: 'LD', sub: 'OL' }, { type: 'HI', sub: 'HH' }, { type: 'LD', sub: 'OA' }, { type: 'VI', sub: 'LV' }]) : null;
    const st = R.weighted(STATES);
    const marks = Math.max(18, Math.min(94, 56 + gauss() * 13));
    const c = Object.assign(p, {
      id: prefix + pad(i * 37 + 1009, 9).slice(-9),
      reg: prefix.slice(0, 4) + 'SBC' + pad(R.int(1000000, 9999999), 7),
      cen, rrb: 'SBC', prefs, dob: dobFor(ages[0], ages[1]), cat, pwbd, exsm: !pwbd && R.chance(0.055), ccaa: R.chance(0.03),
      state: st, city: R.pick(CITIES[st]), mobile: '9' + pad(R.int(100000000, 999999999), 9), email: p.first.toLowerCase() + '.' + p.last.toLowerCase().replace(/[^a-z]/g, '') + R.int(10, 99) + '@example.in',
      aadhaar: { status: R.chance(0.94) ? 'Verified at application' : 'Alternate ID used', last4: pad(R.int(0, 9999), 4), token: 'AT' + pad(R.int(10000000, 99999999), 8) },
      photo: R.int(1, 999999), qual: R.pick(quals), marks: Math.round(marks * 10000) / 10000, stage: 'Result declared', dv: null, medical: null, panel: null, joining: null,
      language: R.weighted([['English', 0.55], ['Hindi', 0.2], ['Kannada', 0.15], ['Telugu', 0.05], ['Tamil', 0.05]]),
    });
    db.candidates.push(c);
    return c;
  }

  // ---- CEN 03/2026 Section Controller
  const SC_CANDS = [];
  for (let i = 0; i < 42; i++) SC_CANDS.push(makeCandidate('CEN 03/2026', '2603020', i, ['P301'], [21, 32], ['B.A.', 'B.Sc.', 'B.Com.', 'B.E.']));
  // ---- CEN 04/2026 JE
  const JE_POSTS = ['P201', 'P202', 'P203', 'P204', 'P205'];
  const JE_CANDS = [];
  for (let i = 0; i < 210; i++) {
    const prefs = R.shuffle(JE_POSTS).slice(0, R.int(2, 5));
    JE_CANDS.push(makeCandidate('CEN 04/2026', '2604020', i, prefs, [19, 32], ['Diploma (Electrical)', 'Diploma (Civil)', 'Diploma (Mechanical)', 'B.E. (Electrical)', 'B.Tech (IT)', 'B.Sc. (Physics, Chemistry)', 'BCA', 'Diploma (Electronics)']));
  }
  // Make sure the horizontal-reservation rules have candidates to work with in the demo.
  [[11, { exsm: true, prefs: ['P201', 'P202', 'P204'], marks: 58.4127 }], [23, { exsm: true, prefs: ['P202', 'P201'], marks: 55.9081 }], [37, { exsm: true, prefs: ['P203', 'P204'], marks: 61.2235 }],
    [52, { pwbd: { type: 'LD', sub: 'OL' }, prefs: ['P202', 'P203'], marks: 49.7712 }], [64, { pwbd: { type: 'HI', sub: 'HH' }, prefs: ['P201', 'P204'], marks: 52.3304 }], [71, { pwbd: { type: 'LD', sub: 'OA' }, prefs: ['P203', 'P202'], marks: 47.1958 }]]
    .forEach((x) => { const c = JE_CANDS[x[0]]; Object.assign(c, { exsm: !!x[1].exsm, pwbd: x[1].pwbd || null, prefs: x[1].prefs, marks: x[1].marks }); if (c.cat === 'ST' || c.cat === 'SC') c.cat = 'OBC'; });

  // DV shortlist: candidates at or above the qualifying marks, top 1.3x per category of vacancies.
  function shortlist(cands, vacs, mult) {
    const q = cands.filter((c) => c.marks >= QUALIFYING[c.cat]).sort((a, b) => b.marks - a.marks);
    const chosen = {};
    q.slice(0, Math.ceil(vacs.UR * mult)).forEach((c) => { chosen[c.id] = true; });
    ['OBC', 'SC', 'ST', 'EWS'].forEach((cat) => {
      q.filter((c) => c.cat === cat && !chosen[c.id]).slice(0, Math.ceil(vacs[cat] * mult)).forEach((c) => { chosen[c.id] = true; });
    });
    q.filter((c) => (c.pwbd || c.exsm) && !chosen[c.id]).slice(0, 10).forEach((c) => { chosen[c.id] = true; });
    return q.filter((c) => chosen[c.id]);
  }
  const jeVac = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
  db.indents.filter((x) => x.level === 'rrb' && x.cen === 'CEN 04/2026').forEach((x) => { for (const c in jeVac) jeVac[c] += x.vac[c]; });
  const scVac = db.indents.filter((x) => x.id === '26SWR011')[0].vac;
  const SC_LIST = shortlist(SC_CANDS, scVac, 1.3);
  const JE_LIST = shortlist(JE_CANDS, jeVac, 1.3);

  // ------------------------------------------------------------------ DV
  const VERIFIERS = ['U-DV1', 'U-DV2', 'U-DV3'];
  const VNAME = { 'U-DV1': 'Suresh Naik', 'U-DV2': 'Pallavi Kamble', 'U-DV3': 'Imran Shaikh' };
  const CHECKS = ['identity', 'name', 'parents', 'dob', 'class10', 'eq', 'category', 'pwbd', 'exsm', 'noc'];
  db.dvSlots = [];
  function dvRun(cen, list, days, perSession) {
    let k = 0;
    days.forEach((d) => {
      ['FN', 'AN'].forEach((sess) => {
        const slot = { id: cen.replace(/\D/g, '') + '-' + ymd(d) + '-' + sess, cen, rrb: 'SBC', date: ymd(d), session: sess, venue: 'RRB Bengaluru, DV Hall 1', reporting: sess === 'FN' ? '08:30' : '13:00', verifiers: VERIFIERS.slice(0, 2 + (k % 2)), candidates: [] };
        db.dvSlots.push(slot);
        for (let j = 0; j < perSession && k < list.length; j++, k++) slot.candidates.push(list[k].id);
      });
    });
    return k;
  }
  dvRun('CEN 03/2026', SC_LIST, [-178, -177, -176], 5);
  // DV batches mix merit positions; candidates with horizontal claims are called in the first batches.
  const firstIn = JE_LIST.filter((c) => c.exsm || c.pwbd);
  dvRun('CEN 04/2026', firstIn.concat(R.shuffle(JE_LIST.filter((c) => !(c.exsm || c.pwbd)))), [-9, -8, -7, -6, -3, -2, 0, 1], 6);
  const slotOf = {};
  db.dvSlots.forEach((s) => s.candidates.forEach((r) => { slotOf[r] = s; }));
  // Demo: one candidate in today's afternoon session falls below the face-match threshold at the DV desk.
  const pmSlot = db.dvSlots.filter((s) => s.cen === 'CEN 04/2026' && s.date === ymd(0) && s.session === 'AN')[0];
  const pmCand = pmSlot && JE_CANDS.filter((x) => x.id === pmSlot.candidates[2])[0];
  if (pmCand) pmCand.photo = pmCand.photo - (pmCand.photo % 17) + 4;

  function doDV(c, slotDay) {
    const s = slotOf[c.id];
    const past = slotDay < 0;
    const face = Math.round((R.chance(0.06) ? 0.52 + R.next() * 0.2 : 0.83 + R.next() * 0.15) * 1000) / 1000;
    c.stage = 'DV scheduled';
    c.dv = { slot: s.id, date: s.date, session: s.session, status: 'Scheduled', outcome: null, callLetter: at(slotDay - 12, 11), checks: {}, remarks: '', face: null, aadhaar: null, verifier: null, at: null };
    if (!past) return;
    if (R.chance(0.045)) {
      c.dv.status = 'Absent';
      c.stage = 'DV absent';
      return;
    }
    const v = R.pick(VERIFIERS);
    const aad = c.aadhaar.status.indexOf('Verified') === 0 ? (R.chance(0.97) ? 'Matched' : 'Failed') : (R.chance(0.7) ? 'Matched' : 'Not attempted');
    const checks = {};
    CHECKS.forEach((k) => { checks[k] = 'Verified'; });
    if (c.cat === 'UR') checks.category = 'NA';
    if (!c.pwbd) checks.pwbd = 'NA';
    if (!c.exsm) checks.exsm = 'NA';
    checks.noc = 'NA';
    let outcome = 'Recommended';
    let remarks = '';
    const roll = R.next();
    if (roll < 0.05) { outcome = 'Escalated to MS'; checks.category = 'Discrepancy'; remarks = 'Community certificate issued after closing date; candidate produced acknowledgement only.'; }
    else if (roll < 0.075) { outcome = 'Not recommended'; checks.eq = 'Discrepancy'; remarks = 'Essential qualification result declared after the cut-off date.'; }
    // Identity doubts are never decided at the desk: they go to the Member Secretary.
    if (outcome === 'Recommended' && face < 0.75) { outcome = 'Escalated to MS'; remarks = 'Live photograph similarity ' + face.toFixed(3) + ' is below the 0.750 threshold' + (aad === 'Matched' ? '; Aadhaar face authentication matched.' : '.'); }
    else if (outcome === 'Recommended' && aad === 'Failed') { outcome = 'Escalated to MS'; remarks = 'Aadhaar face authentication returned no match twice; documents otherwise in order.'; }
    const t = at(slotDay, s.session === 'FN' ? R.int(9, 12) : R.int(14, 17), R.int(0, 59));
    c.dv = Object.assign(c.dv, { status: 'Completed', outcome, checks, remarks, face, aadhaar: aad, verifier: v, verifierName: VNAME[v], at: t, images: { head: true, full: true }, dossier: 'DVD-' + c.id.slice(-6) });
    c.stage = outcome === 'Recommended' ? 'DV completed' : (outcome === 'Escalated to MS' ? 'DV escalated' : 'DV not recommended');
    ev(t, VNAME[v], 'verifier', 'DV ' + outcome.toLowerCase(), 'Candidate', c.id, c.name);
  }
  SC_LIST.forEach((c) => { const s = slotOf[c.id]; if (s) doDV(c, Math.round((new Date(s.date) - new Date(ymd(0))) / DAY)); });
  JE_LIST.forEach((c) => {
    const s = slotOf[c.id];
    if (!s) return;
    doDV(c, Math.round((new Date(s.date) - new Date(ymd(0))) / DAY));
    if ((c.exsm || c.pwbd) && c.dv.status !== 'Scheduled') { c.dv.status = 'Completed'; c.dv.outcome = 'Recommended'; c.dv.remarks = ''; c.stage = 'DV completed'; if (c.dv.face != null && c.dv.face < 0.75) c.dv.face = 0.874; if (c.dv.aadhaar === 'Failed') c.dv.aadhaar = 'Matched'; Object.keys(c.dv.checks || {}).forEach((k) => { if (c.dv.checks[k] === 'Discrepancy') c.dv.checks[k] = 'Verified'; }); if (!c.dv.verifier) { c.dv.verifier = 'U-DV1'; c.dv.verifierName = 'Suresh Naik'; c.dv.at = at(-8, 11); c.dv.face = 0.912; c.dv.aadhaar = 'Matched'; c.dv.images = { head: true, full: true }; c.dv.dossier = 'DVD-' + c.id.slice(-6); } }
  });
  // Escalations: CEN 03/2026 ones were decided long ago; for CEN 04/2026 one of each kind is decided, the rest wait for the MS.
  const dayOf = (d) => Math.round((new Date(d) - new Date(ymd(0))) / DAY);
  SC_CANDS.filter((c) => c.dv && c.dv.outcome === 'Escalated to MS').forEach((c, i) => {
    const okd = /similarity|Aadhaar/.test(c.dv.remarks) || i % 2 === 0;
    c.dv.msDecision = { decision: okd ? 'Recommended' : 'Not recommended', by: U.ms.name, at: at(dayOf(c.dv.date) + 2, 15), remarks: okd ? 'Re-verified in person; identity confirmed with Aadhaar face authentication and original certificates.' : 'Certificate not produced within the time allowed.' };
    c.dv.outcome = c.dv.msDecision.decision;
    c.stage = okd ? 'DV completed' : 'DV not recommended';
  });
  const esc = JE_CANDS.filter((c) => c.dv && c.dv.outcome === 'Escalated to MS' && /Community/.test(c.dv.remarks));
  if (esc[0]) { esc[0].dv.msDecision = { decision: 'Recommended', by: U.ms.name, at: at(-5, 16), remarks: 'Certificate verified with the issuing Tahsildar office.' }; esc[0].dv.outcome = 'Recommended'; esc[0].stage = 'DV completed'; }
  const faceEsc = JE_CANDS.filter((c) => c.dv && c.dv.outcome === 'Escalated to MS' && /similarity/.test(c.dv.remarks));
  if (faceEsc[0]) { faceEsc[0].dv.msDecision = { decision: 'Recommended', by: U.ms.name, at: at(dayOf(faceEsc[0].dv.date) + 1, 12), remarks: 'Re-verified in person with Aadhaar face authentication.' }; faceEsc[0].dv.outcome = 'Recommended'; faceEsc[0].stage = 'DV completed'; }

  // ------------------------------------------------------------------ medical
  const HOSP = ['SBCDH', 'UBLCH', 'MYSDH'];
  function strictest(prefs) {
    let best = 'C2';
    prefs.forEach((pid) => { const m = post(pid).med; if (STD_ORDER.indexOf(m) < STD_ORDER.indexOf(best)) best = m; });
    return best;
  }
  function doMedical(c, dvDay) {
    const required = strictest(c.prefs);
    const hosp = HOSP[R.int(0, 2)];
    const memoNo = 'SBC/MED/' + c.cen.replace(/\D/g, '').slice(0, 2) + '/' + (db.seq.memo++);
    const examDay = dvDay + R.int(1, 3);
    c.medical = { hospital: hosp, memoNo, required, referredAt: at(dvDay, 17), examDate: ymd(examDay), hmis: 'Acknowledged', hmisRef: 'HMIS-' + R.int(100000, 999999), status: 'Referred', result: null, std: null, certificate: null, at: null };
    c.stage = 'Medical referred';
    if (examDay >= 0) return;
    if (R.chance(0.03)) { c.medical.status = 'Absent'; c.stage = 'Medical absent'; return; }
    const r = R.next();
    let result = 'Fit';
    let std = required;
    if (r < 0.04) { result = 'Unfit'; std = null; }
    else if (r < 0.07) { result = 'Temporarily unfit'; std = null; c.medical.reExamBy = ymd(examDay + 30); }
    else if (r < 0.15) { const idx = Math.min(STD_ORDER.length - 1, STD_ORDER.indexOf(required) + 2); std = STD_ORDER[idx]; }
    c.medical = Object.assign(c.medical, { status: 'Examined', result, std, certificate: 'MFC-' + c.id.slice(-6) + '.pdf', at: at(examDay, R.int(10, 16)), examinedBy: hosp === 'SBCDH' ? 'Dr. Lakshmi Murthy' : (hosp === 'UBLCH' ? 'Dr. Karthik Hiremath' : 'Dr. Nandini Rao') });
    c.stage = result === 'Fit' ? 'Medically fit' : (result === 'Unfit' ? 'Medically unfit' : 'Temporarily unfit');
  }
  db.candidates.forEach((c) => {
    if (!c.dv || c.dv.outcome !== 'Recommended') return;
    const dvDay = Math.round((new Date(c.dv.date) - new Date(ymd(0))) / DAY);
    // The latest past DV session's recommended candidates are still to be referred (demo of the referral step).
    if (c.cen === 'CEN 04/2026' && dvDay === -2 && c.dv.session === 'AN' && !c.exsm && !c.pwbd) return;
    if (c.cen === 'CEN 04/2026' && dvDay >= -3) {
      // Recent DV: referred, some not yet pushed to HMIS.
      doMedical(c, dvDay);
      if (R.chance(0.35)) c.medical.hmis = 'Pending';
      return;
    }
    doMedical(c, dvDay);
  });

  // ------------------------------------------------------------------ panels (CEN 03/2026 complete)
  db.panels = [];
  function poolFrom(cands) {
    return cands.filter((c) => c.dv && c.dv.outcome === 'Recommended' && c.medical && (c.medical.result === 'Fit' || c.medical.status === 'Referred'))
      .map((c) => ({ id: c.id, name: c.name, cat: c.cat, marks: c.marks, dob: c.dob, prefs: c.prefs, exsm: c.exsm, pwbd: c.pwbd, medStd: c.medical.result === 'Fit' ? c.medical.std : null, medPending: c.medical.status === 'Referred' }));
  }
  const scInd = db.indents.filter((x) => x.id === '26SWR011')[0];
  const scPost = { post: 'P301', med: 'A2', vac: scInd.vac, hz: scInd.hz, pwbd: post('P301').pwbd };
  const scRun = formPanels([scPost], poolFrom(SC_CANDS), {})[0];
  // v1 then a correction: the lowest-placed UR candidate was replaced after a re-verification.
  const v1 = scRun.rows.map((r) => Object.assign({}, r));
  const v2 = scRun.rows.map((r) => Object.assign({}, r));
  const spare = poolFrom(SC_CANDS).filter((c) => !v2.some((r) => r.roll === c.id) && c.medStd).sort((a, b) => b.marks - a.marks)[0];
  let corrected = null;
  if (spare) {
    const urRows = v2.filter((r) => r.charged === 'UR' && !r.hz);
    const out = urRows[urRows.length - 1];
    if (out) {
      const sc = SC_CANDS.filter((c) => c.id === out.roll)[0];
      sc.dv.postPanelNote = 'Experience certificate found invalid on re-verification (vigilance reference VIG/SBC/2026/112).';
      v2.splice(v2.indexOf(out), 1, { roll: spare.id, name: spare.name, cat: spare.cat, charged: 'UR', hz: '', marks: spare.marks, merit: out.merit + 1, pref: 1, provisional: false, adjusted: true });
      corrected = { out: out.roll, in: spare.id };
    }
  }
  const scPanel = {
    id: 'PNL-0326-P301', cen: 'CEN 03/2026', rrb: 'SBC', post: 'P301', indent: '26SWR011', status: 'Distributed to units', version: 2, createdAt: at(-140, 11),
    versions: [
      { v: 1, at: at(-140, 11), by: U.rrb.name, rows: v1, note: 'Formed from merit list after medical results', shortfall: scRun.shortfall, hzShort: scRun.hzShort },
      { v: 2, at: at(-118, 15), by: U.rrb.name, rows: v2, note: corrected ? 'Correction: ' + corrected.out + ' removed after re-verification; ' + corrected.in + ' brought in from the merit list' : 'Re-issued', shortfall: scRun.shortfall, hzShort: scRun.hzShort },
    ],
    history: [
      { at: at(-140, 11), by: U.rrb.name, role: 'rrb', action: 'Panel formed (v1)', remarks: '' },
      { at: at(-139, 12), by: U.ms.name, role: 'ms', action: 'Approved by MS', remarks: '' },
      { at: at(-137, 16), by: U.chair.name, role: 'chair', action: 'Approved by Chairperson', remarks: '' },
      { at: at(-118, 15), by: U.rrb.name, role: 'rrb', action: 'Correction issued (v2)', remarks: corrected ? 'Replacement of ' + corrected.out : '' },
      { at: at(-117, 11), by: U.ms.name, role: 'ms', action: 'Approved by MS', remarks: 'v2' },
      { at: at(-116, 12), by: U.chair.name, role: 'chair', action: 'Approved by Chairperson', remarks: 'v2' },
      { at: at(-115, 11), by: U.ms.name, role: 'ms', action: 'Allocated to CPO', remarks: 'CPO, South Western Railway (Hubballi) · OTP verified' },
      { at: at(-110, 15), by: U.cpo.name, role: 'cpo', action: 'Distributed to units', remarks: 'SBC, MYS, UBL' },
    ],
  };
  const scFields = ['26SBC011', '26MYS011', '26UBL011'].map((id) => db.indents.filter((x) => x.id === id)[0]);
  const scDist = distribute(v2, scFields);
  scPanel.distribution = { cpo: 'CPO-SWR', at: at(-110, 15), by: U.cpo.name, units: scDist, accepted: { SBC: at(-108, 11), MYS: at(-109, 15), UBL: at(-107, 12) }, history: [{ at: at(-110, 15), by: U.cpo.name, action: 'Distributed', remarks: 'Auto-distribution by merit, accepted without change' }] };
  scPanel.hrms = { pushed: at(-106, 18), status: 'Delivered', records: v2.length, ref: 'HRMS-OB-' + R.int(10000, 99999) };
  db.panels.push(scPanel);
  history(scPanel);
  function history(pnl) { pnl.history.forEach((hh) => ev(hh.at, hh.by, hh.role, hh.action, 'Panel', pnl.id, hh.remarks)); }

  // Offers and joining for CEN 03/2026
  db.offers = [];
  let off = 100;
  v2.forEach((r, i) => {
    const c = SC_CANDS.filter((x) => x.id === r.roll)[0];
    const unit = scDist[r.roll];
    c.panel = { id: scPanel.id, post: 'P301', charged: r.charged, unit, merit: r.merit };
    const offerAt = at(-100 + (i % 3), 11);
    const o = { id: 'OFR-' + unit + '-' + (off++), roll: c.id, unit, post: 'P301', panel: scPanel.id, issuedAt: offerAt, sentAt: at(-100 + (i % 3), 12), reportBy: ymd(-70), status: 'Offer issued', reminders: [], signedBy: unit === 'SBC' ? U.unit.name : unitUser[unit].name };
    const roll = R.next();
    if (i < v2.length - 4 || roll < 0) {
      o.status = 'Joined';
      o.reportedAt = ymd(-80 + (i % 9));
      o.joinedAt = ymd(-78 + (i % 9));
      o.hrmsId = 'HR' + pad(R.int(1000000, 9999999), 7);
      o.pv = 'Received';
      o.training = 'Reported to ZRTI Mysuru';
      c.stage = 'Joined';
    } else if (i === v2.length - 4 || i === v2.length - 3) {
      o.status = 'Not joined';
      o.reminders = [at(-72, 11)];
      o.reason = i % 2 ? 'Did not report after reminder' : 'Declined: joined another organisation';
      o.replacement = 'Requested';
      c.stage = 'Not joined';
    } else {
      o.status = 'Offer issued';
      o.reportBy = ymd(6);
      c.stage = 'Offer issued';
      // One offer in Bengaluru Division is past its reporting date (demo of non-joining and replacement).
      if (i === v2.length - 1) { o.unit = 'SBC'; o.id = 'OFR-SBC-' + (off - 1); o.signedBy = U.unit.name; o.reportBy = ymd(-3); o.reminders = [at(-6, 11)]; c.panel.unit = 'SBC'; scDist[r.roll] = 'SBC'; }
    }
    c.joining = { offer: o.id, status: o.status };
    db.offers.push(o);
  });
  // Replacement indent for non-joining in Bengaluru division
  const nj = db.offers.filter((o) => o.status === 'Not joined');
  if (nj.length) {
    const u0 = nj[0].unit;
    const cats = { UR: 0, EWS: 0, OBC: 0, SC: 0, ST: 0 };
    nj.filter((o) => o.unit === u0).forEach((o) => { const r = v2.filter((x) => x.roll === o.roll)[0]; cats[r.charged]++; });
    const parentField = scFields.filter((f) => f.unit === u0)[0];
    fieldIndent({ id: parentField.id + '_R1', cycle: '2026', post: 'P301', unit: u0, total: sum(cats), vac: cats, type: 'Replacement', parent: parentField.id, status: 'Submitted to CPO', created: at(-2, 11), who: unitUser[u0] || U.unit, remarks: 'Replacement against non-joining of ' + nj.filter((o) => o.unit === u0).map((o) => o.roll).join(', '),
      trail: [{ at: at(-1, 12), who: unitUser[u0] || U.unit, action: 'Submitted to CPO', remarks: 'Against non-materialisation in panel ' + scPanel.id }] });
  }

  // ------------------------------------------------------------------ debar register
  const REASONS = [
    ['Impersonation detected at CBT (biometric and photo mismatch)', 'CBT', 'Lifetime'],
    ['Proxy candidate at document verification', 'DV', 'Lifetime'],
    ['Multiple applications with different photographs for the same CEN', 'Application', '3 years'],
    ['Use of mobile phone inside the examination lab (PUFM)', 'CBT', '5 years'],
    ['Forged community certificate produced at DV', 'DV', '2 years'],
    ['Suppression of facts: pending criminal case not declared', 'Appointment', '2 years'],
    ['Bluetooth device concealed in clothing (PUFM)', 'CBT', '5 years'],
    ['Tampered marksheet (essential qualification)', 'DV', '3 years'],
    ['Impersonation at medical examination', 'Medical', 'Lifetime'],
  ];
  const STAT = [['Active', 0.6], ['Pending checker', 0.1], ['Pending final approval', 0.1], ['Revoked', 0.08], ['Expired', 0.07], ['Draft', 0.05]];
  db.debar = [];
  for (let i = 0; i < 24; i++) {
    const p = person();
    const rs = R.pick(REASONS);
    const status = i === 0 ? 'Pending checker' : (i === 1 ? 'Pending final approval' : R.weighted(STAT));
    const pending = /Pending|Draft/.test(status);
    const from = pending ? -R.int(2, 6) : -R.int(30, 900);
    const yrs = rs[2] === 'Lifetime' ? null : parseInt(rs[2], 10);
    const rec = {
      id: 'DBR-' + pad(2400 + i * 7, 5), name: p.name, father: p.father, gender: p.gender, dob: dobFor(20, 34), photo: R.int(1, 999999),
      idType: R.pick(['Aadhaar', 'Aadhaar', 'Aadhaar', 'PAN', 'Passport', 'Driving Licence']), idLast4: pad(R.int(0, 9999), 4),
      cen: R.pick(['CEN 01/2024', 'CEN 02/2024', 'CEN 05/2024', 'CEN 03/2026', 'CEN 04/2026', 'CEN 07/2026']), roll: '24' + pad(R.int(1000000000000, 9999999999999), 13),
      rrb: R.pick(['SBC', 'SBC', 'SBC', 'MAS', 'SC', 'BB']), stage: rs[1], reason: rs[0], period: rs[2], from: ymd(from), to: yrs ? ymd(from + yrs * 365) : null,
      status: status === 'Active' && yrs && from + yrs * 365 < 0 ? 'Expired' : status, order: 'RRB/SBC/VIG/' + (2400 + i * 7), maker: U.rrb.name, checker: status === 'Pending checker' || status === 'Draft' ? null : U.ms.name,
      approver: ['Active', 'Revoked', 'Expired'].indexOf(status) >= 0 ? U.chair.name : null, createdAt: at(pending ? from : from - 5, 11),
      history: [{ at: at(pending ? from : from - 5, 11), by: U.rrb.name, role: 'rrb', action: 'Record created (maker)', remarks: '' }],
    };
    if (rec.checker) rec.history.push({ at: at(pending ? from + 1 : from - 3, 15), by: U.ms.name, role: 'ms', action: 'Checked', remarks: 'Evidence verified' });
    if (rec.approver) rec.history.push({ at: at(from, 12), by: U.chair.name, role: 'chair', action: 'Final approval', remarks: 'Debarment effective from ' + ymd(from) });
    if (rec.status === 'Revoked') rec.history.push({ at: at(Math.min(from + 120, -2), 11), by: U.chair.name, role: 'chair', action: 'Revoked', remarks: 'Court order in O.A. ' + R.int(100, 999) + '/2025' });
    db.debar.push(rec);
    rec.history.forEach((hh) => ev(hh.at, hh.by, hh.role, hh.action, 'Debar', rec.id, rec.name));
  }
  // A JE applicant who matches an active debar record (picked up by the fraud check).
  const hit = JE_CANDS.filter((c) => c.dv && c.dv.status === 'Scheduled')[3] || JE_CANDS[5];
  const dbHit = db.debar.filter((d) => d.status === 'Active')[0];
  dbHit.name = hit.name; dbHit.father = hit.father; dbHit.dob = hit.dob; dbHit.idType = 'Aadhaar'; dbHit.idLast4 = hit.aadhaar.last4; dbHit.cen = 'CEN 01/2024';

  // ------------------------------------------------------------------ integrity alerts
  db.alerts = [];
  let al = 300;
  function alert(c, type, score, detail, status, days) {
    const a = { id: 'ALT-' + (al++), roll: c.id, cen: c.cen, type, score, detail, status: status || 'Open', at: at(days, R.int(10, 17), R.int(0, 59)), history: [{ at: at(days, 9), by: 'Integrity engine', role: 'system', action: 'Alert raised', remarks: detail }] };
    if (status && status !== 'Open') a.history.push({ at: at(days + 1, 12), by: U.ms.name, role: 'ms', action: status, remarks: status === 'Cleared' ? 'Re-verified in person with Aadhaar face authentication.' : 'Referred for inquiry.' });
    db.alerts.push(a);
  }
  let openFace = 0;
  JE_CANDS.concat(SC_CANDS).filter((c) => c.dv && c.dv.face != null && c.dv.face < 0.75).forEach((c) => {
    const status = c.dv.msDecision ? 'Cleared' : (openFace++ === 0 ? 'Under review' : 'Open');
    alert(c, 'Face match below threshold', c.dv.face, 'DV live photograph vs application photograph: similarity ' + c.dv.face.toFixed(3) + ' (threshold 0.750).', status, Math.min(-1, dayOf(c.dv.date)));
  });
  JE_CANDS.concat(SC_CANDS).filter((c) => c.dv && c.dv.aadhaar === 'Failed').forEach((c) => alert(c, 'Aadhaar authentication failed', null, 'Aadhaar face authentication at DV returned "no match" twice.', c.dv.msDecision ? 'Cleared' : 'Open', Math.min(-1, dayOf(c.dv.date))));
  const dupA = JE_CANDS.filter((c) => c.dv && c.dv.status === 'Completed')[7];
  const dupB = SC_CANDS[11];
  if (dupA && dupB) {
    dupA.aadhaar.token = dupB.aadhaar.token;
    alert(dupA, 'Duplicate identity across CENs', null, 'Same Aadhaar token as ' + dupB.id + ' (' + dupB.name + ', CEN 03/2026) with a different name and date of birth.', 'Escalated', -4);
  }
  alert(hit, 'Debar list match', 0.94, 'Name, father’s name, date of birth and Aadhaar last 4 digits match debar record ' + dbHit.id + ' (' + dbHit.reason + ').', 'Open', -1);
  const sig = JE_CANDS.filter((c) => c.dv && c.dv.status === 'Completed')[15];
  if (sig) alert(sig, 'Signature mismatch', 0.61, 'Signature on DV attendance sheet differs from the application signature (similarity 0.61).', 'Open', -6);

  // ------------------------------------------------------------------ ECA exchange, centres, audits, exam reports
  db.eca = [
    { id: 'ECA-0701', cen: 'CEN 07/2026', direction: 'Outbound', dataset: 'Candidate master for admit cards', records: 98452, size: '41.2 MB', channel: 'SFTP', status: 'Acknowledged by ECA', sha256: '9f2c4b7e1a6d3c58e0b4d2f7a9c1e6b3d8f05a2c7e9b1d4f6a8c0e2b4d6f8a1c3', createdAt: at(-24, 11), by: U.rrb.name,
      steps: [{ name: 'Schema & count validation', at: at(-24, 11, 5), ok: true }, { name: 'Encrypted (AES-256, ECA public key)', at: at(-24, 11, 9), ok: true }, { name: 'Transferred over SFTP', at: at(-24, 11, 40), ok: true }, { name: 'ECA checksum acknowledgement', at: at(-24, 14, 2), ok: true }],
      copies: { nodal: at(-24, 11, 41), rrbsc: at(-24, 11, 41) } },
    { id: 'ECA-0702', cen: 'CEN 07/2026', direction: 'Outbound', dataset: 'Scribe and PwBD facility list', records: 1284, size: '0.6 MB', channel: 'API', status: 'Acknowledged by ECA', sha256: '1b7e3a9c5d2f8e4a6c0b3d9f7e1a5c8b2d6f4e0a9c3b7d1e5f8a2c6b0d4e9f7a', createdAt: at(-18, 15), by: U.rrb.name,
      steps: [{ name: 'Schema & count validation', at: at(-18, 15, 2), ok: true }, { name: 'Encrypted (AES-256, ECA public key)', at: at(-18, 15, 3), ok: true }, { name: 'Pushed over API', at: at(-18, 15, 4), ok: true }, { name: 'ECA checksum acknowledgement', at: at(-18, 15, 6), ok: true }],
      copies: { nodal: at(-18, 15, 5), rrbsc: at(-18, 15, 5) } },
    { id: 'ECA-0703', cen: 'CEN 07/2026', direction: 'Outbound', dataset: 'Photographs & signatures (batch 3)', records: 32105, size: '3.9 GB', channel: 'SFTP', status: 'Validation failed', sha256: '', createdAt: at(-1, 16), by: U.rrb.name,
      steps: [{ name: 'Schema & count validation', at: at(-1, 16, 4), ok: false, note: '12 records have no photograph; 3 signatures below 10 KB.' }], copies: {} },
    { id: 'ECA-0401', cen: 'CEN 04/2026', direction: 'Inbound', dataset: 'Result file (normalised marks) from ECA', records: 210, size: '0.1 MB', channel: 'SFTP', status: 'Imported', sha256: 'c4a8e2b6d0f3a7c1e5b9d3f7a1c5e9b3d7f1a5c9e3b7d1f5a9c3e7b1d5f9a3c7', createdAt: at(-22, 11), by: U.rrb.name,
      steps: [{ name: 'Received from ECA', at: at(-22, 11), ok: true }, { name: 'Decrypted & checksum matched', at: at(-22, 11, 2), ok: true }, { name: 'Imported to Results', at: at(-22, 11, 30), ok: true }], copies: { nodal: at(-22, 11, 31), rrbsc: at(-22, 11, 31) } },
  ];
  db.examDays = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((d) => ymd(d));
  db.shifts = [{ id: 'S1', label: 'Shift 1', time: '09:00' }, { id: 'S2', label: 'Shift 2', time: '12:45' }, { id: 'S3', label: 'Shift 3', time: '16:30' }];
  const CHECKLIST = ['cctv', 'jammer', 'frisking', 'biometric', 'seating', 'servers', 'pwbd', 'signage', 'staff', 'clocks'];
  db.audits = [];
  CENTRES.slice(0, 8).forEach((cen, i) => {
    const day = [-3, -3, -2, -2, -1, -1, 0, 0][i];
    const items = {};
    let score = 0;
    CHECKLIST.forEach((k) => {
      const v = R.weighted([['Compliant', 0.82], ['Partially compliant', 0.12], ['Non-compliant', 0.06]]);
      items[k] = v;
      score += v === 'Compliant' ? 1 : (v === 'Partially compliant' ? 0.5 : 0);
    });
    if (i === 2) { items.jammer = 'Non-compliant'; items.cctv = 'Partially compliant'; }
    score = Math.round((score / CHECKLIST.length) * 100);
    const obs = items.jammer === 'Non-compliant' ? 'Jammer in Lab 3 not powered at 08:40; restored at 08:55 before gate closing. Two CCTV cameras in Lab 2 not recording.' : (score < 90 ? 'Ramp at the main gate is steep; scribe room shared with the waiting area.' : 'No significant deviation observed.');
    db.audits.push({
      id: 'TCA-' + (1200 + i), cen: 'CEN 07/2026', centre: cen.id, date: ymd(day), shift: R.pick(['S1', 'S2']), auditor: i % 2 ? 'Meghana Biradar' : 'Arjun Shetty', items, score,
      severity: score < 75 ? 'High' : (score < 90 ? 'Medium' : 'Low'), observations: obs, evidence: ['entry-gate-' + cen.id.toLowerCase() + '.jpg', 'lab-overview-' + (i + 1) + '.jpg'].concat(items.jammer === 'Non-compliant' ? ['jammer-lab3.mp4'] : []),
      status: i < 5 ? 'Reviewed by RRB' : (i < 7 ? 'Submitted' : 'Draft'), submittedAt: i < 7 ? at(day, 12, 30) : null, reviewedBy: i < 5 ? U.ms.name : null, actionTaken: i === 2 ? 'Centre warned; ECA asked to deploy standby jammer. Repeat audit scheduled.' : '',
    });
  });
  db.examReports = [];
  let rep = 900;
  const past = [[-3, 'S1'], [-3, 'S2'], [-3, 'S3'], [-2, 'S1'], [-2, 'S2'], [-2, 'S3'], [-1, 'S1'], [-1, 'S2'], [-1, 'S3'], [0, 'S1']];
  past.forEach((ps) => {
    CENTRES.forEach((cen) => {
      const scheduled = Math.round(cen.seats * (0.82 + R.next() * 0.15));
      const present = Math.round(scheduled * (0.56 + R.next() * 0.16));
      db.examReports.push({ id: 'ATT-' + (rep++), type: 'Attendance', cen: 'CEN 07/2026', centre: cen.id, date: ymd(ps[0]), shift: ps[1], scheduled, present, biometricFail: R.int(0, 6), lateEntryDenied: R.int(0, 9), at: at(ps[0], ps[1] === 'S1' ? 11 : (ps[1] === 'S2' ? 15 : 19)) });
    });
  });
  const INCIDENTS = [
    ['Power interruption', 'Mains failure for 14 minutes in Lab 2; DG took over in 40 seconds, no candidate time lost (exam timer paused by ECA).', 'Medium', 'BLR02', -3, 'S2'],
    ['Server restart', 'Local server restarted at 09:22; 38 candidates resumed with 6 minutes compensatory time.', 'Medium', 'MYS01', -2, 'S1'],
    ['Medical emergency', 'Candidate felt dizzy in Lab 1; first aid given, candidate completed the test.', 'Low', 'UBL01', -2, 'S3'],
    ['Late start', 'Biometric registration queue delayed the start by 11 minutes.', 'Low', 'BLR04', -1, 'S1'],
    ['Network outage', 'Lease line down at 16:42; switched to backup link at 16:47.', 'Medium', 'KLB01', -1, 'S3'],
  ];
  INCIDENTS.forEach((x) => db.examReports.push({ id: 'INC-' + (rep++), type: 'Incident', cen: 'CEN 07/2026', title: x[0], detail: x[1], severity: x[2], centre: x[3], date: ymd(x[4]), shift: x[5], status: x[4] < -1 ? 'Closed' : 'Open', at: at(x[4], 13) }));
  const PUFM = [
    ['Mobile phone found in pocket during random check', 'BLR01', -3, 'S1'],
    ['Photograph and live face mismatch at entry (suspected impersonation)', 'UBL02', -2, 'S2'],
    ['Bluetooth earpiece detected by frisking', 'MYS02', -1, 'S1'],
    ['Exchanging notes with adjacent candidate', 'BGM01', -1, 'S3'],
  ];
  PUFM.forEach((x, i) => {
    const p = person();
    db.examReports.push({ id: 'PUFM-' + (rep++), type: 'PUFM', cen: 'CEN 07/2026', candidate: p.name, roll: '2607020' + pad(R.int(10000000, 99999999), 8), detail: x[0], centre: x[1], date: ymd(x[2]), shift: x[3], action: i === 1 ? 'Referred to debar' : 'Candidature cancelled; FIR lodged', status: i === 1 ? 'Referred to debar' : 'Under inquiry', at: at(x[2], 12) });
  });
  db.ccReports = CENTRES.map((cen) => ({ id: 'CC-' + cen.id, cen: 'CEN 07/2026', centre: cen.id, date: ymd(-1), shifts: 3, startDelayMin: R.int(0, 12), systemsUsed: cen.seats + R.int(10, 25), spareSystems: R.int(10, 25), systemFailures: R.int(0, 4), observer: R.pick(['RRB observer', 'Railway observer']), remarks: R.pick(['Smooth conduct.', 'Gate closing time enforced strictly.', 'Water and toilets adequate.', 'Two systems replaced from spares.']), status: 'Submitted' }));

  // ------------------------------------------------------------------ grievances
  const GCAT = ['Result & score', 'DV schedule', 'Medical examination', 'Documents & certificates', 'Panel & allocation', 'Offer & joining', 'Exam centre & admit card', 'Fee refund', 'Others'];
  const GTXT = {
    'Result & score': ['Normalised marks lower than expected', 'My normalised score does not match the response sheet calculation.'],
    'DV schedule': ['Request to change DV date', 'I have a university examination on my DV date. Please allow a later date.'],
    'Medical examination': ['Medical result not updated', 'My medical examination was completed but the status still shows referred.'],
    'Documents & certificates': ['Community certificate format', 'My OBC-NCL certificate is in the state format. Will it be accepted at DV?'],
    'Panel & allocation': ['Post allotted not as per preference', 'I was allotted my second preference although my marks are higher than another candidate.'],
    'Offer & joining': ['Joining date extension', 'I need 30 more days to get a relieving order from my present employer.'],
    'Exam centre & admit card': ['Exam city far from native place', 'My exam city is 600 km away though I chose Bengaluru.'],
    'Fee refund': ['Refund not received', 'I attended the CBT but the refund of the examination fee has not reached my account.'],
    Others: ['Name spelling in call letter', 'My surname is spelt wrongly in the DV call letter.'],
  };
  db.grievances = [];
  const gc = JE_CANDS.slice(0, 120).concat(SC_CANDS);
  for (let i = 0; i < 32; i++) {
    const c = gc[R.int(0, gc.length - 1)];
    const cat = GCAT[i % GCAT.length];
    const opened = -R.int(0, 26) - (i < 6 ? 0 : 1);
    const status = i < 4 ? 'New' : R.weighted([['Assigned', 0.15], ['Awaiting RRB', 0.18], ['Responded', 0.2], ['Closed', 0.42], ['Reopened', 0.05]]);
    const g = {
      id: 'GRV-' + pad(5100 + i * 3, 5), roll: c.id, name: c.name, cen: c.cen, rrb: 'SBC', channel: R.weighted([['Portal', 0.45], ['Email', 0.3], ['Phone', 0.18], ['RRB-forwarded', 0.07]]), category: cat,
      subject: GTXT[cat][0], text: GTXT[cat][1], status, assignee: status === 'New' ? null : R.pick(['Sneha Patil', 'Faisal Khan']), at: at(opened, R.int(9, 18), R.int(0, 59)), priority: R.weighted([['Normal', 0.8], ['High', 0.2]]),
      history: [],
    };
    g.history.push({ at: g.at, by: c.name, role: 'candidate', action: 'Raised via ' + g.channel, text: g.text });
    if (status !== 'New') g.history.push({ at: at(opened, 18), by: g.assignee, role: 'helpdesk', action: 'Assigned', text: '' });
    if (status === 'Awaiting RRB') g.history.push({ at: at(opened + 1, 11), by: g.assignee, role: 'helpdesk', action: 'Referred to RRB', text: 'Needs a decision by RRB Bengaluru.' });
    if (status === 'Responded' || status === 'Closed' || status === 'Reopened') g.history.push({ at: at(opened + 1, 15), by: g.assignee, role: 'helpdesk', action: 'Responded', text: 'Your request has been examined. ' + (cat === 'DV schedule' ? 'You may report on the block date shown in your call letter.' : 'Please see the updated status on your dashboard.') });
    if (status === 'Closed') g.history.push({ at: at(opened + 2, 12), by: 'System', role: 'system', action: 'Closed', text: 'Auto-closed after candidate acknowledgement.' });
    if (status === 'Reopened') g.history.push({ at: at(opened + 2, 10), by: c.name, role: 'candidate', action: 'Reopened', text: 'The issue is not resolved.' });
    db.grievances.push(g);
  }

  // ------------------------------------------------------------------ notifications
  db.notifications = [];
  let nn = 1;
  db.candidates.forEach((c) => {
    if (c.dv) {
      ['SMS', 'Email'].forEach((ch) => db.notifications.push({ id: 'N' + (nn++), roll: c.id, channel: ch, template: 'DV call letter', subject: 'DV on ' + c.dv.date + ' (' + c.dv.session + '), ' + c.cen, at: c.dv.callLetter, status: R.chance(0.03) ? 'Failed' : 'Delivered' }));
    }
    if (c.medical) db.notifications.push({ id: 'N' + (nn++), roll: c.id, channel: 'SMS', template: 'Medical memo', subject: 'Medical examination on ' + c.medical.examDate, at: c.medical.referredAt, status: 'Delivered' });
    if (c.joining) db.notifications.push({ id: 'N' + (nn++), roll: c.id, channel: 'Email', template: 'Offer of appointment', subject: 'Offer of appointment, Section Controller', at: at(-100, 12), status: 'Delivered' });
  });
  db.notifications.push({ id: 'N' + (nn++), roll: JE_CANDS[0].id, channel: 'WhatsApp', template: 'Result published', subject: 'CEN 04/2026 result published', at: at(-21, 18), status: 'Delivered' });
  db.notifications.sort((a, b) => (a.at < b.at ? 1 : -1));
  db.seq.notification = nn;
  db.templates = [
    { id: 'T-DV', name: 'DV call letter', channels: ['SMS', 'Email', 'WhatsApp'], text: 'Dear {name}, you are shortlisted for Document Verification for {cen} on {date} ({session}) at {venue}. Download the e-call letter from the RRB portal.' },
    { id: 'T-MED', name: 'Medical memo', channels: ['SMS', 'Email'], text: 'Dear {name}, report to {hospital} on {date} for medical examination. Carry the medical memo and one photo ID.' },
    { id: 'T-RES', name: 'Result published', channels: ['SMS', 'Email', 'WhatsApp'], text: 'Result of {cen} is published. Check your status on the RRB portal.' },
    { id: 'T-OFR', name: 'Offer of appointment', channels: ['Email', 'SMS'], text: 'Dear {name}, offer of appointment for {post} has been issued by {unit}. Report on or before {date}.' },
    { id: 'T-GRV', name: 'Grievance update', channels: ['SMS', 'Email'], text: 'Your grievance {id} has been updated: {status}.' },
  ];

  // ------------------------------------------------------------------ integrations, system
  db.integrations = [
    { id: 'ECA', name: 'Examination Conducting Agency', owner: 'ECA (CEN 07/2026)', mode: 'SFTP + REST API', status: 'Operational', last: at(0, 9, 12), ok: 412, fail: 3, latency: 380 },
    { id: 'AUTH', name: 'Aadhaar authentication', owner: 'RailTel (AUA/KUA)', mode: 'REST API', status: 'Operational', last: at(0, 9, 31), ok: 1286, fail: 22, latency: 610 },
    { id: 'FACE', name: 'Aadhaar face authentication', owner: 'RailTel', mode: 'REST API', status: 'Degraded', last: at(0, 9, 30), ok: 911, fail: 64, latency: 1420, note: 'Response time above 1 s since 08:50; retries succeeding.' },
    { id: 'HMIS', name: 'Hospital Management Information System', owner: 'CRIS', mode: 'REST API', status: 'Operational', last: at(0, 8, 55), ok: 238, fail: 1, latency: 520 },
    { id: 'HRMS', name: 'HRMS onboarding & dossier', owner: 'CRIS', mode: 'REST API', status: 'Operational', last: at(-1, 17, 40), ok: 64, fail: 0, latency: 700 },
    { id: 'DIGI', name: 'DigiLocker', owner: 'MeitY', mode: 'Pull API', status: 'Operational', last: at(-1, 15, 4), ok: 57, fail: 2, latency: 900 },
    { id: 'SMS', name: 'SMS gateway', owner: 'NIC / approved provider', mode: 'API', status: 'Operational', last: at(0, 9, 34), ok: 5022, fail: 61, latency: 200 },
    { id: 'MAIL', name: 'Email gateway', owner: 'NIC', mode: 'SMTP relay', status: 'Operational', last: at(0, 9, 33), ok: 4120, fail: 17, latency: 260 },
  ];
  db.intLog = [];
  const LOGS = [
    ['HMIS', 'Outbound', 'Medical advice pushed for 6 candidates (CEN 04/2026)', 'OK'],
    ['HMIS', 'Inbound', 'Fitness result received: 4 records with certificates', 'OK'],
    ['FACE', 'Outbound', 'Face authentication request (DV desk 2)', 'Retry'],
    ['AUTH', 'Outbound', 'Aadhaar demographic authentication', 'OK'],
    ['ECA', 'Inbound', 'Shift S1 attendance file (CEN 07/2026)', 'OK'],
    ['ECA', 'Outbound', 'Photographs & signatures batch 3', 'Rejected (validation)'],
    ['HRMS', 'Outbound', 'Dossier + onboarding data for 2 joinees', 'OK'],
    ['DIGI', 'Inbound', 'Class 10 certificate pulled for DV', 'OK'],
    ['SMS', 'Outbound', 'DV call letter SMS batch (54)', 'OK'],
    ['MAIL', 'Outbound', 'Medical memo email batch (12)', 'OK'],
  ];
  for (let i = 0; i < 36; i++) {
    const l = LOGS[i % LOGS.length];
    db.intLog.push({ id: 'IL-' + (8000 + i), system: l[0], direction: l[1], message: l[2], status: l[3], at: at(-Math.floor(i / 8), 18 - (i % 8), R.int(0, 59)), ref: 'MSG-' + R.int(100000, 999999) });
  }
  db.system = {
    primary: { site: 'Primary data centre (Government Community Cloud, South)', status: 'Active', since: at(-41, 2) },
    dr: { site: 'Disaster-recovery site (Government Community Cloud, West)', status: 'In sync', lastSync: new Date(T0 - 11 * 60000).toISOString() },
    rtoMin: 45, replicationMin: 30, lastDrill: at(-38, 23), drillRto: 31, drillNote: 'Planned switchover with CEN 04/2026 DV desks live; 31 min to restore all services.',
    backups: [
      { name: 'Database (full)', last: at(-1, 1, 30), size: '182 GB', status: 'OK' },
      { name: 'Database (incremental)', last: new Date(T0 - 40 * 60000).toISOString(), size: '2.1 GB', status: 'OK' },
      { name: 'Documents & images (object store)', last: at(-1, 3), size: '6.4 TB', status: 'OK' },
    ],
    retention: [
      { cen: 'CEN 03/2026', live: 'Until ' + ymd(730), backup: 'Until 5 years from first panel', handover: 'Not due' },
      { cen: 'CEN 04/2026', live: 'Until ' + ymd(740), backup: 'Until 5 years from first panel', handover: 'Not due' },
      { cen: 'CEN 01/2023', live: 'Expired ' + ymd(-30), backup: 'Until ' + ymd(700), handover: 'Due — prepare offline package' },
    ],
  };

  // ------------------------------------------------------------------ activity log with hash chain
  events.sort((a, b) => (a.at < b.at ? -1 : 1));
  db.audit = [];
  let prev = '0'.repeat(64);
  events.forEach((e, i) => {
    e.seq = i + 1;
    e.prev = prev;
    e.hash = chainHash(prev, e);
    prev = e.hash;
    db.audit.unshift(e);
  });

  // Demo candidate logins for the candidate portal.
  const firstUpcoming = JE_CANDS.filter((c) => c.dv && c.dv.status === 'Scheduled' && c.id !== hit.id)[0];
  const referred = JE_CANDS.filter((c) => c.medical && c.medical.status === 'Referred')[0];
  const offered = SC_CANDS.filter((c) => c.joining && c.joining.status === 'Offer issued' && db.offers.filter((o) => o.roll === c.id && o.reportBy >= ymd(0)).length)[0] || SC_CANDS.filter((c) => c.joining)[0];
  db.demoCandidates = [firstUpcoming, referred, offered].filter(Boolean).map((c) => c.id);
  return db;
}
