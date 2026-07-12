# Run S-Long v1 — 3-agent audit synthesis (code-verified)

3 agents (A correctness / B anti-false-green / C UI-feasibility) audited plan v1. Deduped + ranked. The
findings converge on a few deep themes that substantially reshape the plan.

## THE REFRAMING FINDING (A-blocker1, corroborated B-high2, C-blocker3)
**The deployed build is PHASE 1 ONLY.** `LIST_SCOPED_RECON=true`, but there is NO Phase-2 doc-flip — no
`list_progress/{listId}` collection; progress is still class-keyed `{classId}_{listId}`
(`progressService.js:33`), and reconciliation is **lazy** (session-init only; `getClassProgress` does NOT
reconcile, `:498-509`). Consequences for my oracles:
- My §5 "ALL class_progress docs converge at rest" is a **FALSE-RED against the correct build** — an
  abandoned class's doc stays frozen until re-entered. I wrote oracles as if Phase 2 (single list_progress
  doc) were live; it isn't.
- **Correct Phase-1 oracle:** assert the **ACTIVE/last-launched** doc reconciles to the list-wide anchor
  (this IS the #6 fix — verified correct), and that any doc **converges only after a session load** — so
  the driver must ENTER each class before reading, never assert at-rest all-docs-agree.

## FALSE-GREEN TRAPS (must fix — the audit would pass a broken build)
- **B-blocker1: reassignment never asserts destination class is FRESH at move-time** → the #6 day-reset is
  never actually triggered; a fully-broken build passes trivially. Add a hard fresh-B `--pre` precondition
  (mirror Run L L2, `lsr_runL_verify.mjs:116`).
- **B-high3: a mid-stream reset SELF-HEALS by day 16** via `Math.max(stored, reconciled)` → end-state alone
  can't catch it. Per-day oracle must be fail-closed EVERY day.
- **A-blocker2 + B-high4: threshold-edge (persona-9) is doc-invisible.** Server `passThreshold` default is
  **95** (`functions/index.js:340,377`), so 92-93% is a FAIL at default (false-RED), AND the client #5
  retake-loop is a CLIENT bug a doc-oracle can't see. Fix: fixture must PIN `passThreshold`+
  `newWordRetakeThreshold`; assert the VISIBLE "Pass" verdict + no retake loop; oracle = `score >=
  class.passThreshold`, not hardcoded 92. (Note: `manual-pass.mjs:53` defaults 92 vs server 95 — inconsistent.)
- **B-high5: persona-12 EXPECTED-RED without a pinned signature = blanket amnesty** hiding a different real
  bug (CS-07-07 lost-save at the same Day-15/16 boundary). Pin the exact signature.
- **B-high6: no persona×day manifest bound into the verdict** → a silently-dropped persona reads as
  "covered." Emit a manifest; mark UNRUN explicitly (mirror Run L's REQUIRED set, `lsr_runL_verify.mjs:144`).

## PER-DAY ORACLE IS WRONG AS WRITTEN (A-high3/4, B-high3)
"+1 csd / +pace twi per day" is false on: intervention days (`newWordCount = round(pace·(1−intervention))`,
`studyAlgorithm.js:107`), list-tail days (capped), REVIEW_STUDY resume days (`nwCount=0`), and switch days
(fresh doc jumps 0→anchorDay). → per-day oracle must be a **per-persona expected delta** (Δcsd, Δtwi from
the persona's schedule), fail-closed, expecting the reconciled `newWordCount` and the switch-day base+anchor.

## UI-FEASIBILITY / POLICY (C)
- **C-blocker1: persona-10 manual-pass seed = Admin WRITE — forbidden by the audit policy** (§1/§2). Drop,
  or induce a real passing anchor via UI. AND (B-med7) a valid-anchor seed is a tautology — it misses the
  actual CS-06-21 invalid-anchor incident (missing `newWordEndIndex` → studyDay-fallback + `csd_anchor_invalid`).
- **C-blocker3: per-day Admin confirmation violates the one-pre/one-post-snapshot policy** — the primitive's
  fail-closed core reads Admin between days. Resolve: UI-only per-day gate (`readVisibleProgress`) + exact
  CSD/TWI reconcile at the single post-snapshot, OR amend the policy for bounded per-day reads. **← DAVID.**
- **C-blocker2 + C-med7: persona-5 (promotion-ladder) + persona-12 (list-completer) need a 2nd assignable
  list AND list-completion in ≤16 days** — the teacher can assign only ONE list, and completion needs
  `ceil(wordCount/pace)` days. Need a tiny audit list + multi-list teacher, or defer these personas.
- **C-high4: the "rebuild" screen has a genuine dead-end branch** (`sessionCleared:false` → "tell your
  teacher", `TypedTest.jsx:1048`, `studyService.js:632-644`) — must be a HARD STOP, not recover-and-continue.
  And **C-med6/open-Q1: the rebuild may be an APP defect** (a resume/re-submit day-guard race,
  `progressService.js:442`) → if so, Phase-1 "16 zero-rebuild days" needs an app fix first. **← DAVID (fork).**
- **C-high5: no teacher "MOVE student" primitive** — reassignment = `removeStudent(A)` + student
  `joinClass(B)`; the day-reset fidelity of that path is a Phase-3 validation question, not an assumption.

## MISSING PERSONAS / SCOPE (B-med8/10/11)
- Add: **getPrimaryFocus footgun** (teacher adds a 2nd list mid-stream → students bumped to Day 1;
  CS-06-24b/06-28b, 200/215 students) · **invalid-anchor** (CS-06-21) · **lost-save** (CS-07-07, if in scope).
- Add an explicit **OUT-OF-SCOPE** section (grader accuracy, grade-token/save-path, gradebook query #8,
  webview-freeze, forgery #1c) so their absence isn't read as coverage; delete the tautological "no forgery"
  oracle line or back it with a real laundered-pass persona.

## CONFIRMED CORRECT (Lens A verified against code — the fixes work)
twi = greatest-nwei + 1 (self-healing); **no day-reset on class change (active doc) — #6 fixed**; failed
attempts never anchor; **persona-2 #9 acceptance is correct** (REVIEW_STUDY zeroes nwCount, preserves anchor
range, cross-class review pairs by position + lineage); manual-pass writes a valid anchor. So the underlying
FIXES are sound; the plan's problems are oracle-precision + feasibility + false-green, not the code.

## Adjudication plan (fold autonomously) vs DAVID forks
- **Fold:** Phase-1-active-doc oracles; fresh-B precondition; per-persona per-day deltas; pinned
  threshold+visible-verdict; pinned persona-12 signature; bound manifest; drop/rework persona-10;
  tiny-audit-list + multi-list-teacher prereq (or defer 5/12); rebuild dead-end hard-stop; remove+rejoin
  reassignment; add footgun/invalid-anchor personas; explicit out-of-scope section.
- **DAVID forks:** (1) the Admin-per-day-confirmation policy tension; (2) whether the "rebuild" screen is a
  real app bug to fix FIRST (it also blocked the S-1 run).
