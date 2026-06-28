# Grading Idempotency & Concurrency — UI-Only Playwright Audit

**Plan:** `docs/plans/PLAN_grading_idempotent_concurrency.md`  
**Priority:** P0  
**Mode:** Black-box, user-visible interaction only  
**Surfaces:** Student dashboard/session, typed test, MCQ test, results, gradebook, challenges, reset

## 1. Audit contract

Playwright must behave like a real person using the product.

### Allowed

- Open normal browser windows, tabs, and independent browser contexts.
- Log in through the visible login form.
- Navigate only through visible links, menus, buttons, browser Back/Forward, reload, and reopening the site.
- Enter answers using keyboard events (`pressSequentially`), not `.fill()`.
- Click visible controls, including rapid or near-simultaneous clicks from two windows.
- Close a tab/window during grading and reopen the application normally.
- Observe visible text, enabled/disabled states, focus, URLs, spinners, progress indicators, dialogs, toasts, results, gradebook rows, and dashboard progression.
- Capture screenshots/video of visible states.

### Prohibited

- No Firebase Admin SDK or Firestore reads/writes.
- No direct callable/REST/API requests.
- No `page.evaluate`, DOM mutation, React-state access, or hidden-property inspection.
- No local/session-storage injection, deletion, or editing.
- No route interception, mocked responses, artificial response delays, or forced status codes.
- No clock/Date shims.
- No direct deep-linking to bypass the normal product flow.
- No CSS selectors or JavaScript used to click invisible/covered controls.
- No database assertions masquerading as UI assertions.

If a condition cannot be reached through the visible product, mark it **not UI-testable**. Do not manufacture it.

## 2. Evidence required for every scenario

Record:

- Persona/account, class, list, day, session type, and test type.
- Starting screen and visible day/phase.
- Exact user actions in order.
- Screenshots at start, grading/in-progress, result/error, and final dashboard/gradebook state.
- Visible result score, pass/fail state, attempt/history count where displayed, and next available action.
- Any flicker, duplicate dialog, stale result, unexplained navigation, frozen control, or contradictory copy.
- PASS/FAIL/NOT-UI-TESTABLE with one-sentence evidence.

Do not infer backend correctness from silence. Assert only what the UI visibly proves.

## 3. Global UX acceptance criteria

Across every scenario:

- Submit becomes visibly disabled immediately and cannot launch duplicate visible workflows.
- Exactly one grading/in-progress presentation is shown per logical submission.
- The page never flashes a prior attempt's result while the current attempt is grading.
- Loading copy explains what is happening and whether the user may safely leave or retry.
- A retry never asks the student to retype answers that the UI still visibly retains.
- No contradictory states such as “Failed” plus “Continue to next day.”
- No false red “Grading Failed” state when a result later exists.
- Refresh/re-entry converges to one understandable state without loops.
- Buttons have clear labels, keyboard focus, disabled/loading treatment, and no layout shift.
- Desktop and mobile layouts keep the primary action and status visible.
- User-facing copy is calm, specific, and actionable; internal terms such as job, lease, epoch, token, callable, or transaction never appear.

## 4. Baseline flows

### UI-01 — Normal typed submission

1. Log in normally.
2. Enter a daily session through the dashboard.
3. Study through the visible flow and begin the typed test.
4. Type every answer character-by-character.
5. Submit once.

Accept:

- One grading state, then one results screen.
- Score and pass/fail copy agree.
- Reloading results or returning through the dashboard does not create another visible attempt.
- The next phase/day offered is correct.

### UI-02 — Normal MCQ submission

Repeat UI-01 through an MCQ-configured test.

Accept:

- Selected options remain visibly selected through review/submit.
- One result appears and normal progression survives reload.

### UI-03 — Practice mode isolation

Complete a practice-mode test, return to the dashboard, then begin the assigned daily test.

Accept:

- Practice completion does not advance the assigned day or appear as the day's completed graded result.
- The real assigned test remains available and behaves normally.

## 5. Same-window idempotency and navigation

### UI-04 — Rapid repeated Submit clicks

On a completed answer form, click Submit repeatedly as quickly as a person can.

Accept:

- First click disables/debounces the control immediately.
- One grading view and one final result.
- No stacked modals, duplicate toasts, second spinner, or duplicate gradebook row visible later.

### UI-05 — Keyboard activation plus click

Focus Submit, press Enter, then immediately click it.

Accept: same as UI-04.

### UI-06 — Reload while grading

Submit a real typed test and reload while the visible grading state is active.

Accept:

- Re-entry shows an in-progress/recovery state or the completed result.
- It does not silently return to an empty test or show a stale prior result.
- The student is not charged with a second visible attempt merely for reloading.

### UI-07 — Close tab while grading, then reopen

Submit, close the tab during grading, reopen the site, log in if required, and navigate normally back to the session.

Accept:

- The UI discovers in-progress or completed work.
- Completed work returns the correct result without requiring another submission.
- In-progress work provides a clear wait/retry action without claiming the grade was lost.

### UI-08 — Browser Back during grading

Submit, press browser Back during grading, then return using visible navigation or Forward.

Accept:

- A clear navigation warning appears if leaving is unsafe, or recovery works after leaving.
- No zombie overlay, permanent disabled screen, or second result flow.

### UI-09 — Retry after a visible connection hiccup

Only run if a genuine transient error occurs naturally during the audit. Use the visible retry control.

Accept:

- Copy says the work may still be processing and gives one clear next action.
- Retry converges to the existing job/result.
- Answers remain visible when resubmission is genuinely required.

Do not force an error with interception or network scripting.

## 6. Multi-window and multi-device behavior

Use two independent browser contexts, both authenticated through the UI as the same student. Navigate both through the visible product flow.

### UI-10 — Same test, same answers, simultaneous submit

1. Bring both windows to the same logical test.
2. Enter the same answers manually in both.
3. Submit as close together as possible.

Accept:

- One window may own grading while the other shows “in progress,” waits, or converges to the same result.
- Both eventually show the same logical outcome.
- Neither shows a false failure.
- Dashboard, session re-entry, and gradebook show no duplicate logical result.

### UI-11 — Same test, different answers, simultaneous submit

Enter visibly different answers in the two windows and submit together.

Accept:

- The UI deterministically converges to one generation/outcome.
- The losing window does not present its local answers as an independently accepted grade.
- Both windows eventually agree on score, pass/fail, and available next action.
- The product explains an already-submitted/in-progress condition without exposing internals.

### UI-12 — Winner window closes during grading

Submit simultaneously, then close whichever window first shows active grading.

Accept:

- The remaining window eventually recovers the result or offers a safe wait/retry path.
- No permanent “in progress” state after a reasonable real grading interval plus UI timeout.

### UI-13 — Same account, different lists concurrently

Use two windows to take assigned tests for two different lists.

Accept:

- Each retains its own questions, score, progression, and result.
- No cross-list result, day, title, or vocabulary appears.

### UI-14 — Different students concurrently

Two independently logged-in students complete tests at roughly the same time.

Accept:

- Each sees only their own session, status, result, and progression.

## 7. Retakes and immutable history

### UI-15 — Fail, then pass a new-word retake

1. Intentionally fail a new-word test through visible answers.
2. Use the visible Retake path.
3. Pass the retake.

Accept:

- The failed result remains visible where attempt history is intended to be shown.
- The passing retake is a distinct visible attempt/result.
- The accepted logical outcome becomes passed.
- The student advances to the correct next phase and is not stuck on the failed generation.

### UI-16 — Two windows request the retake together

After a visible failure, request Retake in both windows as close together as possible.

Accept:

- Both windows enter the same next generation rather than two separate retakes.
- Questions/session metadata agree.
- Simultaneous submit converges as in UI-10/UI-11.

### UI-17 — Typed-to-MCQ review fallback

Through visible review retakes, reach the configured point where review changes from typed to MCQ.

Accept:

- The mode change is understandable and intentional.
- Prior typed attempts remain visible in history.
- The MCQ result participates in the same logical review outcome.
- No stale typed screen or mismatched question count appears.

### UI-18 — Equal/competing passed results

If the UI permits another retake after a pass, complete it with a different score.

Accept:

- Gradebook summary and student progression consistently show the defined accepted/best outcome.
- Attempt history still shows both submissions in a stable order.

If retaking a pass is not offered, record NOT-UI-TESTABLE rather than bypassing the UI.

## 8. Lost-response and stale-result experience

### UI-19 — Previous result must not flash on a new generation

Complete one failed generation, begin a retake, and submit it.

Accept:

- The prior score never appears as the current result while grading.
- Labels clearly distinguish attempt history from the active generation.

### UI-20 — Reopen from dashboard while work is in progress

While one window is grading, open a fresh window, log in normally, and enter the same class/list from the dashboard.

Accept:

- The second window discovers the active work.
- It does not offer a conflicting fresh Submit path for the same generation.
- When grading completes, both windows converge without manual refresh loops.

### UI-21 — Repeated recovery loop

Reload/re-enter the in-progress screen more than once through normal browser actions.

Accept:

- Status remains stable and understandable.
- No increasing number of results, notifications, or history rows.

## 9. Progression and side-effect experience

### UI-22 — Two-window final test completion

Bring two windows to the final test of the same day and submit together.

Accept:

- Dashboard advances exactly one visible day.
- One completion summary is presented.
- Re-entering the class does not skip another day or return to an already-completed phase.
- Gradebook summary contains one logical outcome while retaining legitimate immutable submissions.

### UI-23 — Refresh immediately after day completion

Complete the day, reload immediately, and revisit dashboard/session.

Accept:

- Day, phase, streak, summary, and next action agree across screens.
- No temporary regression followed by a jump forward.

### UI-24 — Blind Spot regression

Complete a Blind Spot Check through its normal UI after completing a graded test.

Accept:

- Blind Spot results still update its visible vocabulary state normally.
- It does not create a daily-test result, advance the day, or corrupt the gradebook summary.

### UI-25 — Empty-review completion

Using a naturally eligible student/session with no review words, complete the visible empty-review flow.

Accept:

- The day completes once.
- Re-entry and reload continue to show the day as complete.
- No empty 0-question test screen, duplicate review row, or stuck review phase appears.

Do not edit study state to manufacture an empty queue.

## 10. Challenge, override, and accepted-outcome UX

### UI-26 — Accepted challenge changes a failed outcome

1. Student submits a challenge through the visible result/gradebook UI.
2. Teacher logs in normally and accepts it through the gradebook.
3. Student reloads/re-enters normally.

Accept:

- Teacher sees one clear success state and cannot accept twice.
- Student sees corrected answer, score, pass status, and adjustment explanation.
- Gradebook summary and progression follow the corrected accepted outcome.
- History remains understandable; no duplicate attempt appears.

### UI-27 — Teacher force-pass/override

When the feature is available, apply it through visible teacher controls.

Accept:

- Confirmation explains consequences before action.
- Real score remains visible when force-pass policy requires it.
- Student sees teacher adjustment/reason.
- Gradebook summary and next phase update consistently.
- Repeating the action is disabled or visibly idempotent.

If the control is not implemented in this release, mark NOT-UI-TESTABLE.

### UI-28 — Two teacher windows act on the same challenge

Open the same pending challenge in two teacher windows and accept nearly simultaneously.

Accept:

- One succeeds; the other refreshes to already-reviewed/no-op messaging.
- No duplicate toast, double progression, or contradictory challenge status.

## 11. Reset and epoch isolation

### UI-29 — Reset after finalized results

Use the visible progress-reset flow after one or more completed attempts.

Accept:

- Confirmation clearly states what will be removed.
- Dashboard/session returns to the intended fresh state.
- Old results do not reappear as the active outcome during or after cleanup.
- Starting and completing a new test after reset works normally.

### UI-30 — Reset while another window is grading

1. Window A submits and visibly enters grading.
2. Window B uses the visible reset flow for that scope.
3. Observe both windows, then start a new test normally.

Accept:

- Window A cannot resurrect or finalize the pre-reset result into the fresh scope.
- It receives calm stale/reset messaging rather than a generic crash.
- The new test begins fresh and never shows the pre-reset result.

### UI-31 — Empty review after reset

After UI reset, naturally reach an empty-review completion again.

Accept:

- The new marker/outcome behaves as fresh work.
- No stale “already completed” state from before reset.

## 12. Error and recovery copy

### UI-32 — Deterministic visible failure

If normal navigation reaches a deterministic validation failure, inspect the UI.

Accept:

- Auto-retry stops.
- Copy asks the user to reload/resubmit and does not say a grade was saved.
- Answers remain available when technically possible.

Do not corrupt parameters or call routes directly to force this state.

### UI-33 — Long-running grading

Observe the slowest naturally occurring typed grade.

Accept:

- Status remains alive and non-alarming throughout.
- The UI does not time out earlier than the documented user wait period without a recovery action.
- No repeated spinner reset or countdown restart suggests duplicate grading.

## 13. Mobile, accessibility, and interaction quality

Repeat UI-01, UI-06, UI-10, UI-15, UI-20, UI-26, UI-29, and UI-30 at a mobile viewport.

Check:

- Status, score, and primary action remain above the fold or easy to reach.
- Modals fit the viewport and scroll internally when necessary.
- No background controls receive clicks while a modal is open.
- Keyboard focus enters dialogs and returns to the invoking control.
- Enter/Space activates focused controls once.
- Disabled buttons expose a visible disabled state and do not appear broken.
- Focus indicators are visible.
- Screen text names the current phase and action without relying on color alone.
- Error, pending, success, adjusted, and force-pass states have distinct text/icon treatment.
- Korean and English copy does not truncate, overlap, or expose mojibake.
- Rapid status changes do not cause large layout shifts.

## 14. UI-only release gates

Do not approve the UI release if any of these occur:

- Duplicate logical result or day completion visible after concurrent user actions.
- Failed retake prevents a later passing retake from advancing.
- Two windows disagree permanently about the accepted score/pass state.
- Reload, close/reopen, or Back turns successful grading into “Grading Failed.”
- A stale pre-reset result appears in the new post-reset session.
- Challenge/override changes one screen but not gradebook/progression after normal refresh.
- Empty-review completion reverts or duplicates after reload.
- Submit/Retry/Reset can be visibly activated twice while already processing.
- User is left indefinitely in “grading” with no recovery action.
- Internal implementation vocabulary reaches the user.

## 15. Guarantees this UI-only audit cannot prove

The following require separate function/emulator/rules tests and must not be claimed from Playwright UI evidence:

- Exactly one grading-job document or lease transition.
- Fencing-token correctness and stale-worker rejection.
- Transaction retry behavior and effect-ledger exactly-once writes.
- Firestore rule denial for guessed server-owned document IDs.
- Reset cleanup deleting every old-epoch document.
- Exact outcome-pointer contents or comparator execution.
- Composite-index readiness.
- Old-client/new-server protocol compatibility unless an actual old deployed client is exercised visibly.

UI audits validate the student's and teacher's observable experience. Backend invariants still require the plan's dedicated automated tests.
