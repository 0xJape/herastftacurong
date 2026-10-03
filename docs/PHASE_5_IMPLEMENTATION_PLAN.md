# Phase 5 — Goals, Interventions, and Care Connection

Status: In progress — T501–T528 implemented; release gate pending  
Scope: Account-scoped wellness goals, intervention outcomes, evidence-gated suggestions, care directory, editable health summaries, and user-controlled contact handoff.

## Requirements

- **REQ-501 Goal management:** User can create, edit, pause, resume, and complete measurable wellness goals.
- **REQ-502 Goal progress:** HERA stores dated progress and compares current progress with a prior period.
- **REQ-503 Intervention tracking:** User can record a wellness change, selected measures, before/after periods, and outcome feedback.
- **REQ-504 Outcome comparison:** HERA calculates deterministic before/after summaries only when both periods contain enough reliable data.
- **REQ-505 Recommendation ranking:** HERA ranks suggestions only after relevant feedback or outcome evidence exists; otherwise it shows unranked options.
- **REQ-506 Counterfactual simulation:** User can compare an original result with a hypothetical change clearly labeled `Simulation`, without guaranteed-outcome language.
- **REQ-507 Care directory:** User can search verified clinic and doctor records by need and location and inspect source freshness.
- **REQ-508 Specialist saving:** User can save or remove one preferred specialist within their authenticated profile.
- **REQ-509 Health-summary draft:** User can select records and dates, generate a draft, edit it, preview it, and explicitly approve an immutable version.
- **REQ-510 Contact handoff:** Contact options appear only after summary approval; HERA never transmits health data automatically.
- **REQ-511 Privacy and authorization:** Every record and mutation is account-scoped, validated at API boundaries, and excludes another account's data.
- **REQ-512 Accessibility and states:** Goal and care screens support keyboard use, readable labels, live save/error feedback, and loading, empty, insufficient-data, success, and error states.
- **REQ-513 Timeline integration:** Goal, intervention, outcome, and approved-summary events appear in account-scoped wellness timeline.
- **REQ-514 Verification and documentation:** Deterministic calculations, authorization boundaries, approval gating, API contracts, database design, and browser flows are tested and documented.

## Technical context

- Keep Node.js/Express and native `node:sqlite`; use additive SQLite migrations in `backend/server.js`.
- Keep vanilla JavaScript SPA. Extend existing Profile destination with `Goals` and `Care` sections rather than adding framework or dependency.
- Reuse authenticated `req.user.id`; ignore client-supplied account IDs as authorization decisions.
- Reuse existing daily analytics sources for outcome windows. Missing or unreliable values stay unavailable, never zero.
- Use deterministic calculations for progress, before/after change, evidence gates, and ranking. Generative AI may draft prose but cannot approve, rank without evidence, diagnose, or transmit data.
- Start with curated local care records. No map UI until reliable geocoding/map data exists.

## Safety and privacy gates

1. Goals and interventions remain general wellness features, not treatment plans.
2. Before/after comparisons state association does not prove causation.
3. Suggestions disclose reason, supporting records, date range, confidence, and limitation.
4. Counterfactual output always displays `Simulation` and cannot claim expected medical benefit.
5. Clinic/doctor details display source and last-verified date; stale/unverified contact details are flagged.
6. Health-summary draft remains editable and unapproved by default.
7. Approval creates a frozen snapshot. Later edits require a new approval version.
8. HERA provides copy/download/contact controls only. No automatic sending or appointment booking.

## Implementation plan and tasks

### P5.1 Goals foundation — REQ-501, REQ-502, REQ-511, REQ-512

- [ ] **T501** Add additive `wellness_goals` and `goal_progress` tables, indexes, ownership constraints, status values, and timestamps in `backend/server.js`.
- [ ] **T502** Add account-scoped goal CRUD, pause/resume/complete actions, and dated progress endpoints with strict metric, target, unit, date, and status validation in `backend/server.js`.
- [ ] **T503** Add deterministic target progress and prior-period comparison helper plus runnable `node:assert` checks in `backend/goal-progress.js` and `backend/goal-progress.test.js`.
- [ ] **T504** Build Profile → Goals cards, create/edit form, progress entry, history, and pause/resume controls in `frontend/goals-ui.js` with minimal styles in `frontend/goals.css`.
- [ ] **T505** Wire Goals entry point and cache versions in `frontend/app.js`, `frontend/index.html`, and `frontend/sw.js`.

**Exit gate:** Two authenticated accounts cannot access each other's goals; progress math passes boundary checks; mobile and keyboard flow works.

### P5.2 Intervention effectiveness — REQ-503, REQ-504, REQ-511, REQ-512, REQ-513

- [ ] **T506** Add `interventions` and `intervention_feedback` tables with selected metrics, start/end dates, comparison-window length, status, and outcome fields in `backend/server.js`.
- [ ] **T507** Add account-scoped intervention CRUD, feedback, and outcome endpoints in `backend/server.js`.
- [ ] **T508** Implement reliable before/after metric aggregation, minimum-sample gates, absolute/percentage change, confidence, and limitations in `backend/intervention-outcomes.js`.
- [ ] **T509** Add success, insufficient-data, missing-data, and uneven-window checks in `backend/intervention-outcomes.test.js`.
- [ ] **T510** Build intervention setup, active intervention, feedback, and before/after result UI in `frontend/goals-ui.js`.
- [ ] **T511** Add goal/intervention/outcome events to `backend/wellness-timeline.js` and its test.

**Exit gate:** HERA never reports an outcome without adequate before and after samples; every result names metric, windows, coverage, confidence, and limitation.

### P5.3 Evidence-gated suggestions and simulations — REQ-505, REQ-506, REQ-511, REQ-512

- [ ] **T512** Add suggestion feedback fields or table for saved, dismissed, started, helpful, irrelevant, and linked outcome evidence in `backend/server.js`.
- [ ] **T513** Implement deterministic ranking that stays unavailable until feedback/outcome threshold is met; expose ranking reason and supporting evidence in `backend/intervention-ranking.js`.
- [ ] **T514** Add ranking threshold, tie, missing-evidence, and account-isolation checks in `backend/intervention-ranking.test.js`.
- [ ] **T515** Add ranked/unranked suggestion cards with save, dismiss, start, and feedback actions in `frontend/goals-ui.js`.
- [ ] **T516** Add bounded what-if endpoint using existing deterministic measures only; return original and simulated values, changed inputs, assumptions, and limitations in `backend/server.js`.
- [ ] **T517** Add side-by-side `Simulation` UI without persistence by default in `frontend/goals-ui.js`.

**Exit gate:** Fresh accounts receive no fabricated ranking; simulations remain visually and semantically distinct from observed results.

### P5.4 Care directory and specialist saving — REQ-507, REQ-508, REQ-511, REQ-512

- [ ] **T518** Add `clinics`, `doctors`, `doctor_clinics`, and `saved_specialists` tables with source URL, verification date, service/specialty, location, and public contact fields in `backend/server.js`.
- [ ] **T519** Add a small curated demo-care seed dataset in `backend/seed-demo.js`; do not scrape or invent provider credentials.
- [ ] **T520** Add read-only need/location/specialty search, clinic profile, doctor profile, and account-scoped preferred-specialist endpoints in `backend/server.js`.
- [ ] **T521** Build Profile → Care search, filters, results, profiles, comparison, freshness notices, and save/remove action in `frontend/care-ui.js` and `frontend/care.css`.
- [ ] **T522** Wire Care navigation and offline/cache behavior in `frontend/app.js`, `frontend/index.html`, and `frontend/sw.js`.

**Exit gate:** Search only returns stored verified records; stale data is visible; saved specialist belongs to session account.

### P5.5 Health-summary approval and handoff — REQ-509, REQ-510, REQ-511, REQ-512, REQ-513


- [x] **T523** Add `health_summary_drafts` and immutable `health_summary_versions` tables with selected domains, date range, draft text, approval timestamp, and specialist linkage in `backend/server.js`.
- [x] **T524** Build deterministic structured summary data from selected account records while preserving source references in `backend/health-summary.js`.
- [x] **T525** Add create/edit/preview/approve/version-list endpoints and enforce approval ownership and frozen-version semantics in `backend/server.js`.
- [x] **T526** Add health-summary selection, editable draft, preview, explicit approval confirmation, copy, and local download UI in `frontend/care-ui.js`.
- [x] **T527** Reveal verified contact controls only for approved summaries; never send data automatically in `frontend/care-ui.js`.
- [x] **T528** Add approved-summary timeline events without embedding private summary text in `backend/wellness-timeline.js`.

**Exit gate:** Unapproved drafts expose no contact controls; approval freezes exact text; contact actions never transmit summary content.

### P5.6 Final verification and release readiness — REQ-511, REQ-512, REQ-514

- [ ] **T529** Add cross-account authorization and validation checks for all Phase 5 endpoints using standalone `node:assert` tests.
- [ ] **T530** Validate keyboard, mobile, loading, empty, insufficient-data, error, save, approval, and contact flows in browser.
- [ ] **T531** Update API, database, data-flow, security/privacy, and testing documentation.
- [ ] **T532** Update Phase 5 and stale Phase 4 feature statuses in `UPDATES.md` using verified evidence only.
- [ ] **T533** Complete pre-deployment consent, retention, export, and deletion controls before real-user release.

## Requirement mapping

| Requirement | Stage | Primary evidence |
|---|---|---|
| REQ-501–REQ-502 | P5.1 | goal schema, API, UI, deterministic checks |
| REQ-503–REQ-504 | P5.2 | intervention schema, outcomes, UI, checks |
| REQ-505–REQ-506 | P5.3 | ranking and simulation helpers, UI, checks |
| REQ-507–REQ-508 | P5.4 | directory import/search/map and preferred specialist |
| REQ-509–REQ-510 | P5.5 | draft/version APIs, approval UI, gated handoff |
| REQ-511–REQ-512 | P5.1–P5.6 | account scoping, validation, accessible states |
| REQ-513 | P5.2, P5.5 | timeline events and checks |
| REQ-514 | P5.6 | test suite, browser evidence, documentation |

## Delivery order

Execute one vertical slice at a time:

1. **Goals** — storage → API → calculation → UI → checks.
2. **Interventions** — storage → API → outcomes → UI → timeline → checks.
3. **Suggestions and simulations** — only after outcome evidence exists.
4. **Care directory** — verified local records → search/profile → specialist saving.
5. **Summary and handoff** — draft → edit → approve → user-controlled contact.
6. **Release gate** — authorization, accessibility, privacy controls, docs, browser validation.

No new npm dependency planned. Native SQLite, Express, browser forms, and Blob download APIs cover scope.
