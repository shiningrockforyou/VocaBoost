# B08 — Erratic Interaction

**Priority:** P1
**Estimated duration:** 60–90 minutes
**Depends on:** B00 (and ideally B02/B03 for context).
**Personas:** Rushed Student, Hostile Student.

## Goal

Real students aren't careful clickers. They double-tap, mash Enter, click-while-loading, scroll while submitting, paste then submit, hit Cmd+R out of habit. The app must hold up.

## Scenarios

### S01 — Rapid-fire answer changes

**Persona:** Rushed Student

1. Begin MCQ test.
2. On Q1, click option A, then B, then C, then D, then A — five clicks within 1 second.
3. Final state: answer A selected, no visual artefacts.
4. Submit; assert attempt records A.

### S02 — Double-tap on Submit (covered briefly in B02, fuller here)

1. Begin test, answer all.
2. `await Promise.all([page.click('Submit'), page.click('Submit')])`.
3. Single attempt doc.

### S03 — Triple-tap on Submit (just in case)

Same shape — three rapid clicks.

### S04 — Submit while still typing (Typed test)

**Persona:** Rushed Student

1. Begin typed test.
2. In the LAST input, start typing a long answer.
3. While still typing, click Submit at the 5th character.
4. Submit goes through; attempt has the partial 5-char answer (NOT the longer not-yet-typed answer).

**Pass criteria:** Behaviour is deterministic and matches whatever `responses` state held at click time.

---

### S05 — Mash Next/Previous keys

1. Begin MCQ.
2. Press Tab + Enter repeatedly to advance through questions without answering.
3. Reach the end. Try to submit.
4. Expected: either validation prevents submit, or submit goes through with all answers blank.

---

### S06 — Click "Skip" or "Next" while no answer

1. If a Skip button exists, click it on every question.
2. Submit with 0 answers.
3. Behaviour matches B02 S08 (validation or score 0).

---

### S07 — Keyboard shortcuts spam

1. Begin MCQ.
2. Hold down 1/2/3/4 (option shortcuts if they exist) for 5 seconds.
3. Expected: app survives. Final answer is whatever the last key released was.

---

### S08 — Right-click context menu mid-test

1. Begin MCQ. Right-click on the question text.
2. Expected: native context menu appears; no app state corruption.

### S09 — Triple-click select-all

1. Begin Typed test. Triple-click an input to select-all.
2. Type to replace; verify the replacement is the only content.

### S10 — Drag-select then delete

1. Typed test. Drag-select to highlight part of an answer.
2. Press Delete.
3. Verify only the selected portion is removed.

### S11 — Copy-paste between inputs

1. Typed test. Copy text from Q1's input to Q2's input.
2. Verify content matches in both.
3. Submit. Attempt doc has both correctly.

### S12 — Open devtools mid-test

1. Begin test. Open devtools (F12) during the run.
2. Expected: no crashes. No "production check" gates the test.

### S13 — Resize window mid-test

1. Begin MCQ at 1440x900.
2. Resize to 375x812 (mobile).
3. Resize to 768x1024 (tablet).
4. Expected: layout responds; no answer loss; test continues normally.

### S14 — Zoom in/out mid-test

1. Begin test.
2. Zoom to 200%. Verify all options still clickable.
3. Zoom to 50%. Same check.

### S15 — Mash the back button

1. Begin test. Click browser Back.
2. Confirmation dialog (if present) → click Cancel.
3. Click Back again, again, again. Verify no state corruption.

### S16 — Forward + back loop

1. Begin test. Answer 5 questions.
2. Back. Forward. Back. Forward.
3. Verify answers preserved at each step (or recovery prompt appears each time).

### S17 — Refresh during loading (before test renders)

1. Trigger test start.
2. While loading spinner is up (questions not yet rendered), refresh.
3. Verify no orphan session state. Reload should put user back at dashboard or recovery prompt.

### S18 — Click outside modal then back

1. Open the Quit Confirm modal mid-test.
2. Click outside (or press Escape).
3. Modal closes. Test continues normally; no state lost.

### S19 — Hammer the Quit button

1. Begin test, answer some questions.
2. Click Quit, see confirm, click Cancel.
3. Click Quit, confirm, click Quit (confirm). Test exits.
4. Verify: no orphan localStorage; navigating back to test starts fresh.

### S20 — Form submit via Enter key (Typed test)

1. Typed test. Type an answer in Q1.
2. Press Enter. Expected: focuses next input (NOT submits the test).
3. Press Enter on the last input. Expected: focus stays OR test submits (consistent behaviour; document which).

### S21 — Submit via Cmd+Enter shortcut

If a submit shortcut exists, use it. Verify equivalence with button click.

### S22 — Tab through entire test (keyboard-only)

1. Begin MCQ. Tab through to first option of Q1.
2. Press Space/Enter to select.
3. Tab to Q2 first option, repeat.
4. Reach Submit, press Enter to submit.
5. Attempt records all answers correctly.

### S23 — Screen reader simulation (briefly here, deeper in B21)

1. Use Playwright accessibility tree: `await page.accessibility.snapshot()`.
2. Verify the test renders meaningful labels for screen readers.

### S24 — Spam scroll wheel

1. Begin test. Scroll up/down rapidly during a question.
2. Verify no answer change. (Some apps mis-handle scroll on radio buttons.)

## Severity reminder

S02 / S04 / S15 = HIGH. Others MEDIUM/LOW. Crashes = BLOCKER regardless of scenario.
