# Codex review — REVIEWONLY_AUDIT_DESIGN round 1

## Verdict

NEEDS_FIXES.

The plan is directionally good, but it is not yet a certifiable Playwright acceptance design. The open questions are load-bearing, and one required regression case is missing.

## Blockers

### RAD-1 — Fix #9 review-resume path is not covered

The handoff explicitly asks whether this case is covered:

> Fix-#9 REVIEW_STUDY-resume case: `reviewOnlyDay + real passing attempt → real score persists, NOT null`

The plan mentions the behavior in §1, but there is no acceptance scenario for it in RA1–RA8.

This is a real regression risk because the implementation previously almost nulled the new-word score whenever `reviewOnlyDay === true`. The current code fixed that by keying nulls on attempt absence, not `reviewOnlyDay` itself. None of RA1–RA8 would fail if that regressed again, because the genuine throttle/list-end paths have no new-word attempt and should persist nulls.

Required scenario:

- Add RA9 / “Fix #9 review-resume with real new attempt.”
- Setup: create a day where `sessionConfig.newWordCount <= 0` because `startPhase === REVIEW_STUDY`, but a real same-day passed `new` attempt exists.
- Drive: complete the review through the UI.
- UI oracle: session completes normally.
- Firestore oracle:
  - `recentSessions[last].newWordScore` equals the real new-word score, not `null`
  - `session_state.newWordsTestScore` equals the real score
  - `session_state.newWordsTestPassed` is not `null`
  - TWI remains flat if this was a review-resume/no-reintro path

Without this, the audit can false-pass a regression in the exact Lens A #1 fix.

### RAD-2 — RA4/RA4b use `page.evaluate` sessionStorage injection; that is not full-UI Playwright acceptance

The stated audit discipline is real browser/user interaction. RA4/RA4b currently require:

```js
page.evaluate(...)
```

to clear or rewrite `sessionStorage.dailySessionState`.

That is a white-box client-state mutation, not a user action. It can be useful as a targeted negative test, but it should not be mixed into the same “full UI acceptance” certification unless David explicitly allows a white-box exception.

Also, injection timing matters: `DailySessionFlow` writes `dailySessionState` during `navigateToTest`. If the harness mutates too early, the app overwrites it and RA4b proves nothing. If it mutates on the test page immediately before submit, it proves the completion function’s defensive behavior, but still via injection.

Required design fix:

- Split RA4/RA4b into a separate “white-box negative” section, not counted as full-UI certification; or
- Replace them with an organic stale-state repro created through visible UI / fixture setup before the browser run.

If keeping the injected version, the plan must state:

- it is not user-faithful Playwright acceptance
- injection occurs after `dailySessionState` is written and immediately before review submit
- a control assertion reads back the mutated state before submit
- its PASS is reported separately from the UI-only acceptance matrix

### RAD-3 — list-end seeding must be coherent with reconciliation anchors

RA5/RA5b/RA6 propose seeding `class_progress.twi` and `study_states`. That is not enough.

The app’s reconciliation path does not trust `class_progress` alone; it derives/validates from attempts. A raw `twi=listSize` seed with no matching position-bearing passed `new` attempts can trip anchor-invalid behavior or exercise an artificial state that real students do not reach.

Concrete ruling for Q1:

- Do not seed only `class_progress.twi + study_states`.
- Either drive to list-end through a very small clone list, or pre-seed a coherent fixture:
  - `class_progress`
  - position-bearing passed `new` attempts that anchor the introduced range
  - any needed review attempts/backlog state
  - `study_states`
  - exact class/list identity
- Add a pre-verifier that enters/loads the session once and asserts no `csd_anchor_invalid`, no query-error fallback, and that `initializeDailySession` produces the intended `isListComplete/newWordCount/segment` state before the measured step.

For speed, I would choose the coherent fixture route on a small sandbox list. Raw counter seeding is not certifiable.

### RAD-4 — base guard should not default to live

The plan says to change `lsr_ui.mjs` to:

```js
export const BASE = process.env.LSR_BASE_URL || 'https://vocaboostone.netlify.app'
```

and then rely on a fail-closed localhost guard.

The guard is good, but the default should still be local. For this audit, a helper defaulting to the live active-student site is an unnecessary misuse surface.

Required design fix:

```js
export const BASE = process.env.LSR_BASE_URL || 'http://localhost:5173';
```

Then enforce:

- `BASE` hostname is exactly `localhost` or `127.0.0.1`
- protocol is `http:`
- guard runs before browser launch and before auth
- guard failure is `INVALID` / exit 1

## High issues

### RAD-5 — RA1/RA2 setup should be deterministic fixture + UI drive, not “maybe organic”

Concrete ruling for Q3:

Use a pinned pre-run fixture for the intervention state, then drive the review-only completion through the UI.

Driving several low-review days organically is useful as a separate realism smoke, but it is too slow/flaky for the core acceptance oracle. For RA1/RA2, seed a coherent `recentSessions` window that deterministically gives `interventionLevel === 1.0`, then drive the actual review-only day in the browser and assert the recovery behavior.

Important: the fixture can create the precondition, but the measured transition must be UI-driven.

### RAD-6 — certification needs exact artifact binding

The plan says manifest + matrix, but it should explicitly bind:

- run id
- build id / local git state marker
- base URL
- scenario set
- student uid/classId/listId per scenario
- pre-state snapshot hash
- post-state snapshot hash

A partial/stale matrix must not certify. This was a repeated failure mode in earlier harnesses; keep the same exact-set and run-id binding discipline.

## Medium issues

### RAD-7 — data oracle should name exact collections for “sessions”

RA6 says no completed-session `sessions` record. The code writes under:

```txt
users/{userId}/sessions
```

The plan should name the exact collection and the expected query key/time window. Otherwise the harness can accidentally check the wrong top-level collection or count stale records.

### RAD-8 — RA7 teacher UI may be Phase-2-adjacent

Teacher “New: —” is a valid analytics/null check, but the implementation review explicitly deferred some teacher legibility work. Keep RA7’s data oracle as required. Treat the teacher UI assertion as required only if the current UI already exposes the value from `recentSessions` without needing Phase-2 UI work. If not, do not block Phase-1 backend certification on the teacher UI rendering.

## Answers to open questions

1. Seed-vs-drive list-end: raw counter seeding is not acceptable. Use either a tiny driven list or a coherent pre-seeded fixture with matching anchor attempts and a pre-verifier. I recommend coherent fixture + pre-verifier for determinism.
2. `page.evaluate` sessionStorage injection: faithful as a white-box defensive test only, not as full-UI acceptance. It must be split or explicitly labeled and must be injected after app state write, before submit, with readback.
3. Organic vs seeded intervention: seed a pinned `recentSessions` window for deterministic RA1/RA2 preconditions, then drive the measured day through UI. Organic low-review build-up can be an optional realism smoke.

## Final

VERDICT blockers=4 high=2 med=2 nits=0

NEEDS_FIXES.
