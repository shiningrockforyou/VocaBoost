# Playwright audit — list progress persistence, Phase 1

Companion to [`PLAN_list_progress_persist.md`](./PLAN_list_progress_persist.md).

This audit validates the implemented **Phase 1 list-scoped reconciliation slice** behind
`LIST_SCOPED_RECON`. It does not validate Phase 2 `list_progress`, migration, quarantine, or list-wide
reset, because those features are not part of this implementation.

## 1. Non-negotiable execution policy

Every application interaction must be performed through the visible UI exactly as a real student or
teacher would perform it.

### Allowed Playwright actions

- Open the public application entry URL.
- Use visible, enabled controls with semantic locators: role, accessible name, label, placeholder, and
  visible text.
- Click, type, select, press ordinary keyboard keys, scroll, and use normal browser back/reload controls.
- Use separate browser contexts for genuinely separate users/devices and separate pages for tabs.
- Observe visible text, URL changes, focus, enabled/disabled state, screenshots, video, console errors,
  and uncaught page errors.
- Use Playwright waiting/assertion APIs to wait for visible user outcomes.

### Forbidden

- `page.evaluate`, `locator.evaluate`, `evaluateHandle`, `addInitScript`, or injected JavaScript of any
  kind.
- Reading or changing localStorage, sessionStorage, IndexedDB, cookies, React state, hidden DOM state, or
  Firebase state from the browser context.
- DOM mutation, synthetic `dispatchEvent`, hidden-control activation, or `{ force: true }` clicks.
- Direct Firebase SDK, REST, callable-function, or application API requests from Playwright.
- Request interception, response mocking, artificial status codes, network aborts, offline emulation,
  clock manipulation, CDP commands, or service-worker manipulation.
- Deep-linking directly to internal test/session/result routes. Start at the public entry/login page and
  navigate using visible controls.
- Changing feature flags, assignments, progress, attempts, session documents, or test outcomes outside
  the UI.
- Using Admin SDK while a browser scenario is running.

If a case cannot be reached through normal UI behavior, mark it **not UI-reproducible under this audit
policy**. Do not manufacture the state with an injected script or database write.

## 2. Firebase Admin boundary

Admin SDK use is optional and strictly **read-only**.

- Run one pre-audit snapshot before opening any audit browser.
- Stop the Admin process before Playwright starts.
- Run one post-audit snapshot only after every audit browser/context is closed.
- Restrict reads to the named sandbox personas and relevant `class_progress`, `attempts`,
  `session_states`, and `system_logs` records.
- Admin must never create, update, delete, reset, seed, repair, or restore anything.
- Preserve both snapshots as timestamped evidence and compare them after the run.

Because restoration through Admin is forbidden, every mutating case needs its own disposable,
forward-only sandbox persona. Prepare advanced-history personas before the audit through ordinary product
UI flows or reuse already-established audit personas whose starting state was verified read-only.

## 3. Deployment matrix

Run the suite against two separately deployed client builds. Never flip the flag from Playwright.

| Run | `LIST_SCOPED_RECON` | Purpose |
|---|---:|---|
| L | `false` | Legacy regression and flag-off equivalence |
| S | `true` | Phase 1 list-scoped behavior |

For Run S, all **seven** Phase 1 `attempts` composite indexes must report ready before the browser run.
Record deployment URL, build identifier, flag value, index readiness, browser/version, viewport, start/end
time, and persona IDs in the audit report.

Do not run these cases against real students. Use a sandbox academy with two classes assigning the same
list:

- Class A: smaller daily pace.
- Class B: larger daily pace.
- Both typed and MCQ variants must be represented.
- Use the same pass threshold unless a case explicitly verifies launching-class policy.

## 4. Evidence requirements

For every case capture:

1. A screenshot of the starting dashboard/session state.
2. Screenshots at each class switch or phase transition.
3. The final visible outcome, including exact error/recovery copy where applicable.
4. Console errors, uncaught page errors, and failed application requests as observational evidence only.
5. A short step log containing only visible user actions and visible assertions.

The post-run Admin comparison may additionally confirm:

- which class-scoped progress document changed;
- final `currentStudyDay` and `totalWordsIntroduced`;
- relevant attempt class/list/day/start/end/pass fields;
- stale `session_states` deletion;
- orphan attempts were retained;
- expected `day_guard_*` or reconciliation logs exist.

Admin evidence supports the UI result; it must never replace a missing visible assertion.

## 5. Required personas

| Persona | Starting state | Used by |
|---|---|---|
| P-L1 | Single class, fresh list | Flag-off smoke |
| P-L2 | Dual-enrolled, existing progress in A | Flag-off dual-class regression |
| P-MOVE | Progressed in A; B assigns the same list; B has not advanced it | Move/carry-forward |
| P-DUAL | Simultaneously enrolled in A and B on the same list | Shared-anchor switching |
| P-JOIN | Same uncompleted day available in A and B | Same-day join guard |
| P-STALE-T | Typed mode; session opened in B while A can advance | Typed stale-session rejection |
| P-STALE-M | MCQ mode; session opened in B while A can advance | MCQ stale-session rejection |
| P-PAIR | Existing mixed-class history where the highest-position anchor and same-numbered reviews differ by class/lineage | Review pairing |
| P-ORPHAN | Legitimate review with `studyDay` greater than the position-winning anchor day | Log-only orphan handling |
| P-SPARSE | Existing legacy passed-new attempt missing `newWordEndIndex`, if an accessible sandbox persona exists | Sparse fallback |

Before the run, use the UI to confirm each persona can log in and access the intended class/list. The
read-only pre-snapshot confirms the deeper starting facts. If no naturally existing P-SPARSE persona is
available, report that case as unavailable rather than creating malformed data with Admin.

## 6. Run L — flag OFF regression

### L1. Normal single-class completion

1. Log in as P-L1 through the login UI.
2. Select the assigned class and list through visible Dashboard controls.
3. Complete the full new-word flow and its test using normal clicks/typing.
4. If the day includes review, complete the review flow as well.
5. Return to Dashboard through visible navigation.

Pass conditions:

- No new error, rebuild, or retry state appears.
- Day/position and normal results UI behave as before Phase 1.
- Typed and MCQ submission remain usable.

### L2. Flag-off dual-class behavior is unchanged

1. Log in as P-L2.
2. Record the visible A and B progress displays by switching classes through the selector.
3. Enter and leave each list through visible navigation without completing extra work.

Pass conditions:

- No unexpected cross-class carry-forward occurs while the flag is off.
- No `list_progress` behavior or new reconciliation-only UI is visible.
- No missing-index/query error appears.

## 7. Run S — flag ON functional audit

### S1. Move A to B: carry forward position, use B policy

1. Log in as P-MOVE and select Class A.
2. Record the visible day, phase, list, and next-work presentation.
3. Return to Dashboard and select Class B using the class selector.
4. Enter the same list under B.
5. Continue until the next new-word allocation/test is visibly established.

Pass conditions:

- B does not restart the student at Day 1 or re-serve the already-completed initial range.
- Session entry carries B to the list-wide anchor.
- The session uses B's visible policy: pace/question allocation/test mode as configured.
- Returning to A does not demote the carried position.

Expected Phase 1 limitation: Dashboard may initially show B's stale class-scoped value until session
entry reconciles it. Record this, but do not fail Phase 1 solely for the pre-entry stale display.

### S2. Dual enrollment: no ping-pong

1. Log in as P-DUAL and enter the shared list from A.
2. Complete one normal user-visible progression step under A.
3. Return to Dashboard, switch to B, and enter the same list.
4. Observe the starting day/phase and complete the next allowed step.
5. Switch back to A and re-enter.

Pass conditions:

- Each entry converges to the greatest proven list position.
- Switching classes never lowers TWI or restarts completed words.
- The launching class changes policy only; it does not create a competing lower position.

### S3. Same-day passed-position join guard

Use two independent browser contexts for P-JOIN so each represents a real device.

1. In Context A, log in, select A, and complete the day's new-word test with a passing result.
2. Only after the passing result is visible, log in/open the list in Context B under B.
3. Continue using visible controls.

Pass conditions:

- B recognizes the same-day passed attempt only when it belongs to the same word-position base.
- B joins the remaining review/completion flow instead of introducing a second different range.
- The final visible position does not jump by both class paces.

For the negative side, use an already-existing mixed-history persona if available: a passed attempt with
the same `studyDay` but a different `newWordStartIndex` must not unlock completion. Do not create the
inconsistent attempt through Admin.

### S4. Launching-class fallback remains local

Use a persona whose current day's launching-class attempt is visible but whose legacy attempt lacks usable
position proof, if naturally available.

1. Enter the list under the class that owns that attempt.
2. Complete the normal review/test flow.
3. Repeat observation from the other class without manufacturing another attempt.

Pass conditions:

- Legacy score fallback can support the launching class's existing behavior.
- Missing position proof never authorizes a cross-class completion.

If no natural legacy persona exists, mark this as covered by code review plus post-run data inspection, not
as a passed Playwright case.

### S5. Anchor convergence from either class

1. Log in as P-PAIR and enter the list from A; record the visible reconciled day/phase.
2. Leave through normal navigation.
3. Enter the same list from B; record the visible reconciled day/phase.

Pass conditions:

- Both entry paths resolve the same highest-position passed-new anchor.
- Equal-position history does not produce different outcomes between classes.
- CSD never decreases from the pre-audit value.

The read-only post-snapshot must confirm that the resulting TWI equals the greatest valid integer anchor,
including any history beyond malformed numeric records. Do not insert malformed records for this test.

### S6. Review pairing uses anchor class and temporal lineage

Use P-PAIR, whose pre-snapshot establishes the intended anchor and review chronology.

1. Enter from the class that did not produce the winning anchor.
2. Observe whether the UI begins at the expected day/phase.
3. Complete only the work the UI presents.

Pass conditions:

- A same-numbered review from another class does not incorrectly complete the anchor day.
- A pre-anchor review from the anchor class does not pair with the later anchor.
- A legitimate post-anchor review from the anchor class does pair.
- No query/index error demotes or advances CSD.

### S7. Orphan cleanup is log-only

1. Log in as P-ORPHAN.
2. Enter the shared list and allow reconciliation to complete visibly.
3. Leave normally without using reset/delete UI.

Pass conditions:

- The student can continue normally.
- No visible history unexpectedly disappears.
- The post-snapshot confirms every pre-existing review attempt still exists.
- An `orphaned_attempt_flagged` log may be added; no `orphaned_attempt_deleted` action may occur for this
  run.

### S8. Sparse legacy-anchor fallback

Only run with an existing P-SPARSE persona.

1. Log in and enter the relevant list through its assigned class.
2. Observe the resulting day/phase and verify the student is not reset to a fabricated fresh state.
3. Leave normally.

Pass conditions:

- The UI remains usable and does not show an index/query failure.
- Existing progress is preserved rather than demoted.
- Post-snapshot/log evidence identifies the invalid/sparse anchor without destructive correction.

## 8. Concurrency and stale-session audit

Run both typed and MCQ variants because both test pages consume the rebuild sentinel.

### S9-T / S9-M. Stale completion rejection and successful clear

For each mode, use two independent contexts logged into the same disposable persona.

1. Context B: select B, open the list, progress to the final test, and stop before submitting.
2. Context A: select A and complete enough work to advance the shared day/anchor.
3. Context B: return to the already-open stale test and submit using normal UI controls.
4. Observe the blocking result.
5. Follow the visible instruction using ordinary browser/UI navigation and re-enter the list.

Pass conditions:

- The stale completion does not show the normal success/results screen.
- Exact recovery meaning is visible: answers saved, session refreshed, return to study.
- No completed-session record or mastery graduation is attributed to the rejected completion according to
  the read-only post-snapshot.
- Re-entry builds from current progress and the student is not stuck.
- The stale session document is absent post-run and the cleared warning log exists.

### S10. Stale restored display state

1. Context B: open a session and establish visible progress within it without submitting the final test.
2. Context A: advance the shared list day.
3. Context B: use normal reload/navigation and return to the session.

Pass conditions:

- Old scores, dismissed-word state, and stale phase presentation are not restored into the new day.
- The visible session is rebuilt from the current day.

### Deletion-failure UI branch

The `sessionCleared:false` branch must have a component-level or code-review check, but this audit must not
force a Firestore deletion failure through rules changes, interception, offline emulation, or Admin writes.
If the failure occurs naturally, assert the distinct visible message: answers saved, session could not be
reset, reload, and contact the teacher if repeated.

## 9. UX coverage

Repeat the core happy path (S1 or S2) and stale-rebuild path (S9) at:

- Desktop: 1440×900.
- Mobile: a supported phone viewport, with touch-equivalent clicks.
- Light and dark themes if the theme control is available through the UI.

For each viewport verify:

- class/list selectors remain understandable and operable;
- progress/day/phase does not visibly flicker to Day 1 after reconciliation completes;
- loading/submitting states prevent accidental double interaction;
- Korean and English recovery copy wraps without clipping;
- the recovery state provides a visible, usable route back to study;
- keyboard focus remains visible on actionable controls;
- no horizontal overflow obscures test answers or recovery actions.

## 10. Cases deferred to later phases

Do not claim these from the Phase 1 Playwright report:

- creation or hydration of `list_progress/{listId}`;
- migration/catch-up and old-bundle retirement;
- quarantine blocking;
- list-wide reset and reset-vs-in-flight behavior;
- teacher shared `list_progress` gradebook reads;
- Phase 2 server-transactional concurrency guarantees.

Add them to this companion when their implementation lands.

## 11. Final acceptance gate

Phase 1 passes only when:

- Run L shows no user-visible regression with the flag off.
- S1–S3 and S5–S7 pass; S4/S8 are either run against natural legacy personas or explicitly marked
  unavailable without synthetic data.
- Both S9-T and S9-M pass.
- S10 passes.
- Seven required indexes were ready before Run S.
- There are no unexpected uncaught page errors, permission errors, missing-index errors, or infinite loading
  states.
- Pre/post read-only evidence shows no TWI regression and no review deletion.
- Every application mutation in the report was caused by a documented visible UI action.
- No forbidden automation or Admin mutation occurred.

Any failure must include persona, class/list, build, flag state, visible reproduction steps, screenshot/video,
and the relevant read-only before/after diff. Leave the flag off until all blocking failures are resolved.
