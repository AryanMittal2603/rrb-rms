# RRB Recruitment Management System (RMS) — demo frontend

A clickable, demo-ready frontend for every RMS module in the RMS scope of work (sections 2.1–2.15, 3.1–3.4 and 4.1–4.7), built on the design system of the RRB candidate portal (AMS, `rrb-portal-ui`) so that AMS and RMS look the same.

**Frontend only.** No backend calls. All people, roll numbers and documents are synthetic, and the data is kept in the browser's local storage, so every action you take shows up on the other roles' screens.

## Open it

- **Public demo:** <https://aryanmittal2603.github.io/rrb-rms/> (GitHub Pages; neutral branding, see below).
- **Official look, on your machine:** `npm install`, then `npm run build`, then open `built/index.html` in Chrome, Edge or Firefox. It works straight from disk. To serve it instead, run `npm run serve` and go to <http://localhost:8080>.
- **Sign in:** pick a staff role on the first page, or open the candidate portal.
- **OTP:** every e-sign and approval asks for an OTP. In the demo it is **246810**.
- **Start over:** use *Reset demo data* in the avatar menu or on the sign-in page.

## Same look as AMS

The following are copied unchanged from `rrb-portal-ui`:

- page shell (`layout.html`)
- top bar, masthead, footer and nav-pill partials
- design tokens and components (`tokens.css`, `components.css`, `chrome.css`, `admin.css`), plus the sign-in styles
- fonts and brand images
- the dialog, toast, font-size and i18n modules
- the build approach: esbuild, page front-matter, `{{> partial}}`, and `{{t:key}}` text files

New code lives in `source/src/rms`, `source/src/candidate` and `source/src/login`, with styles in `source/src/styles/features/rms.css`. That stylesheet only uses the AMS tokens: the AMS purples, the red top-bar gradient, the lavender page background and Roboto.

Every module screen shows a small **SOW x.y** chip, so a reviewer can trace each screen to the scope of work.

## Roles

| Role | Demo user | What to try |
|---|---|---|
| Indenting Unit | Ramesh Kulkarni, Bengaluru Division | Vacancy register, raise or resubmit an indent, accept allotted candidates, offers and joining, replacement indent |
| CPO / Zonal HQ | Anitha Rao, South Western Railway | Approve or return field indents, consolidate them into RRB indents, indent tracker, distribute panels to units |
| RRB, Dealing Section | Mohan Gowda, RRB Bengaluru | ECA transfers, results, DV scheduling, medical referral, panel formation, debar maker |
| RRB, Member Secretary | Kavya Hegde | Approve RRB indents, DV escalations, panels, debar checker, qualifying rules, integrity alerts |
| RRB, Chairperson | Vikram Iyer | Final approval of panels and debarments, revocation |
| Nodal RRB | Nikhil Desai, RRB Ahmedabad (ALP) | Approve RRB indents, compile the CEN vacancy statement (Annexures A and B), lock it |
| Railway Board (RRCB) | Priya Menon | All-India views: CENs, MIS, activity log, DR status, retention |
| DV Verifier | Suresh Naik | DV desk: live photo, face match, Aadhaar authentication, document checklist, outcome, dossier |
| Railway Hospital | Dr. Lakshmi Murthy, DRH Bengaluru | Medical examination results back through HMIS |
| Test-centre Auditor | Arjun Shetty | Test-centre audit checklist with score and evidence |
| Candidate Helpdesk | Sneha Patil | Grievances (48-hour target), caller lookup, resend messages |
| System Administrator | Deepak Verma | Users and role permissions, integrations, activity-log verification, DR drill, handover package |
| Candidate | 3 demo logins on the candidate sign-in page | Status, DV and medical, letters, grievances, messages |

## Demo walkthroughs

1. **Indent to CEN (2.1–2.3).**
   1. As the Indenting Unit, open *Indents* → *Raise indent*. Pick a post: the vacancy calculation prefills from the register. Use *Fill from roster*, then submit with the OTP.
   2. Open the returned indent **27SBC005**, correct the break-up and resubmit. A new version is recorded.
   3. As the CPO, approve **27SBC003**. Then go to *Consolidate into RRB indents* and create the RRB indent for Technician Gr III (Electrical/TRD), then sign and submit it.
   4. As the Member Secretary, approve that RRB indent.
   5. As the Nodal RRB, approve it as well. Then, in *CEN compilation*, add it, preview Annexures A and B, and lock and send for CEN processing.
2. **Debarment (2.4).** As the Dealing Section, create a debar record. The Member Secretary checks it and the Chairperson approves it with the OTP. Under *Check a person / screen a CEN*, you can screen CEN 04/2026 against the debar list.
3. **ECA and exam stage (2.5–2.6).**
   - In *ECA data exchange*, open ECA-0703 (validation failed) and choose *Fix & re-run*. Watch the checksum being computed, then check the acknowledgement.
   - As the Auditor, file a test-centre audit. The Member Secretary then records the review.
   - *Exam-process reports* has attendance, incidents, PUFM cases (refer one to debar) and centre-coordinator reports.
4. **Results to DV (2.7–2.9).**
   1. *Results & merit validation* shows the file checks, the qualifying rules and the merit list. *Call more candidates for DV* adds candidates in merit order.
   2. In *DV scheduling*, schedule the shortlisted candidates and issue their e-call letters.
   3. As the DV Verifier, open today's session and verify **2604020000001379**: capture the photo, record consent, run Aadhaar authentication, mark the documents, capture the images and recommend. Then open the digital dossier.
   4. Open **2604020000007114** in today's afternoon session: the face match comes out below the threshold, so the desk can only escalate.
   5. As the Member Secretary, decide the escalations under *Document verification → Escalated to MS*.
5. **Medical (2.10).**
   1. As the Dealing Section, open *Medical & HMIS → To refer*, select the candidates and refer them. HMIS acknowledges.
   2. As the Hospital, examine a candidate, enter the standard, attach the certificate and send it back through HMIS.
6. **Panels to joining (2.11–2.13).**
   1. As the Dealing Section, go to *Final result & panels → Form panels* and run the allotment. Try provisional mode too, then save the panels as drafts.
   2. Submit **PNL-0426-P201**. The Member Secretary forwards it and the Chairperson approves it with the OTP.
   3. Back in *Panel distribution*, allocate the panel to the CPO. As the CPO, open the panel, optionally move a candidate (a reason is required) and confirm.
   4. As the Unit, accept the candidates, which pushes them to HRMS. Then, in *Offers & joining*, issue offers and record a joining.
   5. **OFR-SBC-117** is past its reporting date. Mark it *Not joined*, then *Raise replacement indent*.
7. **Integrity (2.14–2.15).**
   - *Integrity alerts* shows face, Aadhaar, duplicate-identity, debar-match and signature alerts. On ALT-306 (debar match), withhold the candidature.
   - *Candidate identity trail* shows every stage and photograph of a candidate, and who opened the record.
   - *MIS & dashboards* has the summary figures.
8. **Candidate portal (3.4).** On the candidate sign-in page, use the three demo candidates (DV today, medical due, offer). Download letters, request another DV date and follow the reply. The helpdesk sees the request at once.
9. **Services and platform (3.1–3.3, 4.1–4.6).**
   - Helpdesk: reply to a grievance, look up a caller, send a group message.
   - Admin: role-permission matrix, integration tests, *Verify chain* and *Simulate tampering* on the activity log, DR drill, offline handover package for CEN 01/2023.

## Scope-of-work coverage

| SOW | Screen(s) |
|---|---|
| 2.1 Post master, vacancy | Post master & mapping, add-post requests, Vacancy register |
| 2.2 Indents and approval | Indents (create, versions, return/resubmit, e-sign), CPO consolidation, Indent tracker, CEN compilation |
| 2.3 Additional / replacement | Indent type *Additional* / *Replacement*, started from non-joining in Offers & joining |
| 2.4 Debar | Debar register: maker → checker → final approval, revoke, lookup, CEN screening |
| 2.5 Data transfer to ECA | ECA data exchange: validation, SHA-256 checksum, encryption, acknowledgement, copies to Nodal RRB and RRB/SC |
| 2.6 Test-centre audits | Test-centre audits, Exam-process reports (attendance, incidents, PUFM, CC reports) |
| 2.7 Result import and merit | Results & merit validation: file checks, qualifying rules, merit list, additional shortlisting |
| 2.8–2.9 Document verification | DV scheduling, e-call letters, DV desk, Member Secretary escalations, digital DV dossier |
| 2.10 Medical and HMIS | Medical & HMIS: referral, memo, HMIS push, re-examination; hospital desk |
| 2.11 Final result and panels | Final result & panels: merit-cum-preference with vertical and horizontal reservation, provisional mode, approvals, corrections as versions |
| 2.12 Panel distribution | Allocation to CPO, unit-wise distribution with recorded changes, unit acceptance, HRMS onboarding |
| 2.13 Appointment and joining | Offers & joining: offer letters, reminders, joining with HRMS ID, non-joining → replacement indent |
| 2.14 Fraud and identity | Integrity alerts, face match at DV, Aadhaar authentication, duplicate identity across CENs, debar match, withholding |
| 2.15 Dashboards and identity trail | Role dashboards, MIS & dashboards, Candidate identity trail with access log |
| 3.1 Notifications | Notifications: log, templates, group messages, resend failed |
| 3.2 Grievances | Grievances: 48-hour target, referral to RRB, replies, closure, reopening |
| 3.3 Helpdesk | Helpdesk console: caller lookup, call logging, quick answers |
| 3.4 Candidate dashboard | Candidate portal |
| 4.1 Users and authorisation | Users & roles, role-permission matrix; menus and actions limited by role and scope |
| 4.2 External integrations | Integrations (ECA, Aadhaar, face authentication, HMIS, HRMS, DigiLocker, SMS, e-mail) and message log |
| 4.3 Security and auditability | Hash-chained activity log with verification and a tampering demo; OTP e-sign on approvals |
| 4.4 Hosting and recovery | Hosting & recovery: primary/DR status, RTO 45 min, 30-min replication, backups, DR drill |
| 4.5 Data protection | Aadhaar and mobile masked everywhere; synthetic data only; data never leaves the browser |
| 4.6 Retention and handover | Data retention: CEN-wise retention, offline package with SHA-256 manifest |
| 4.7 Documentation | This file; SOW chips on every module screen |

## What is simulated

- OTP and Aadhaar e-sign (OTP 246810).
- Face matching: a fixed demo score per candidate; a few fall below the threshold.
- Aadhaar face authentication.
- The DV camera: drawn placeholder portraits; there are no real photographs anywhere.
- File uploads: *Use sample file*.
- ECA, HMIS, HRMS, SMS and e-mail exchanges: written to the logs, nothing is sent.

The SHA-256 checksums and the activity-log hash chain are real computations.

## Two builds: official look and public demo

| Build | Command | Where it goes | Branding |
|---|---|---|---|
| Official look | `npm run build` | `built/`; not committed | Same masthead, emblem, Railway logo and footer as the AMS portal. For local demos, internal servers and presentations to RRB. |
| Public demo | `npm run build:public` | `site/`; published by GitHub Actions | Neutral "Recruitment Management System — product demo" masthead with RMS/DEMO marks, a "not an official RRB or Government of India website" notice on every page, specimen letters with a watermark, and `noindex` plus `robots.txt` so search engines skip it. |

The public link carries no official marks because a site open to anyone, carrying the RRB / Government of India masthead, the emblem and a candidate sign-in, could be taken by candidates for a real RRB portal. The State Emblem also may not be used on unofficial sites. Everything else is identical.

### Deploying to GitHub Pages

The workflow in `.github/workflows/pages.yml` builds and publishes `site/` on every push to `main`.

One-time setup: in the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. Do not choose *Deploy from a branch*. You can re-run the deployment from the **Actions** tab.

## Build from source

```
npm install           # esbuild only
npm run build         # official look -> built/
npm run build:public  # public demo   -> site/
```

`source/build.cjs` does the following:

1. Bundles `src/rms/main.js` (staff), `src/candidate/main.js`, `src/login/main.js` and the stylesheet into `built/assets`, with the same browser targets as AMS.
2. Renders `source/pages/*.html` into `layout.html` with the chrome partials.
3. Collects every `L('key', 'English text')` from the code into `i18n/rms.en.json`.

The build stops if two different English texts share a key.

```
source/
  build.cjs            build script
  layout.html          page shell (AMS)
  chrome/              top bar, masthead, nav pills, footer (AMS; staff top bar adapted)
  pages/               index.html (sign-in), rms.html (staff), candidate.html
  i18n/                common.*.json (AMS), rms.en.json (generated), rms.hi.json (to translate)
  src/rms/core/        store, seed data, business rules (engine.js), session, router, hashing
  src/rms/ui/          tables, forms, dialogs, charts, timelines, printable letters
  src/rms/modules/     one file per module group
  src/candidate/       candidate portal
  src/styles/          AMS styles + features/rms.css
```

## Hindi

Every screen text is in `source/i18n/rms.en.json`. To switch on Hindi:

1. Translate the values you need into `source/i18n/rms.hi.json`, keeping the keys. Untranslated keys fall back to English.
2. Run `npm run build`.

As soon as the file has any translation, `built/hi/` is produced and the *हिंदी* link in the language menu opens it, the same way AMS works.

## Data

The data is seeded deterministically on first load and stored under the local-storage key `rms.demo.db` (about 600 KB). Dates are relative to the day you first open the demo, so the scenario stays current: today's DV session, examinations due today, an overdue offer and so on.

A newer build with a changed seed replaces old data automatically.
