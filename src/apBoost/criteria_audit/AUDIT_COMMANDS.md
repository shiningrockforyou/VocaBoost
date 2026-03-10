# apBoost Audit Commands

Run in Claude Code CLI (`claude`) from the vocaboost directory. Dev server must be running (`npm run dev`).

## B0: Setup & Seed (RUN FIRST)
```
@apboost-audit Run audit batch B0 (Setup & Seed)
```

## Safe to run in parallel after B0:

```
@apboost-audit Run audit batch B1 (Student Core Flow)
```
```
@apboost-audit Run audit batch B7 (Teacher Dashboard & Gradebook)
```
```
@apboost-audit Run audit batch B9 (Teacher Management & Editor)
```
```
@apboost-audit Run audit batch B10 (Error Handling)
```
```
@apboost-audit Run audit batch B11 (Cross-Cutting Quality)
```

## Run sequentially (student test completion — same account, would conflict):

```
@apboost-audit Run audit batch B2 (Student Complete & Report)
```
```
@apboost-audit Run audit batch B3 (Report Card Deep Dive)
```
```
@apboost-audit Run audit batch B4 (Second Test & Session Edge Cases)
```
```
@apboost-audit Run audit batch B5 (Annotation Tools & Visual Polish)
```
```
@apboost-audit Run audit batch B6 (Resilience & Browser Edge Cases)
```
```
@apboost-audit Run audit batch B8 (Teacher Grading & Analytics)
```

---

## Phase 2: Advanced Testing (run AFTER B0-B11 complete)

### B12: Data Correctness (1 terminal)
```
@apboost-audit Run audit batch B12 (Data Correctness). Use student account: student@apboost.test / Student123! and teacher account: teacher@apboost.test / Teacher123!. Take the Micro test answering Q1-Q10 correctly and Q11-Q15 incorrectly, then verify scores, percentages, AP projection, gradebook, and analytics are all mathematically correct.
```

### B13: Chaos Testing (8 terminals, all parallel)
```
@apboost-audit Run B13-P1 (Speed Clicker). Account: student4@apboost.test / Student123!. Take the Macro test. Click through all answers in <200ms, double-click Next/Submit, complete in <10s. Verify no double-submit, no duplicate results, report card shows last-selected answers.
```
```
@apboost-audit Run B13-P2 (Rapid Flagger). Account: student5@apboost.test / Student123!. Take the Macro test. Flag/unflag Q1 ten times rapidly (100ms), flag every other question, verify flag state consistency on review screen and navigator.
```
```
@apboost-audit Run B13-P3 (Navigator Spammer). Account: student6@apboost.test / Student123!. Take the Macro test. Open navigator and jump between questions 20+ times in rapid succession (Q15→Q1→Q8→Q3→Q12 etc). Verify correct question loads and answers persist across jumps.
```
```
@apboost-audit Run B13-P4 (Submit Interceptor). Account: student7@apboost.test / Student123!. Take the Macro test. Answer all MCQ, go to review, click Submit, then intercept Firestore requests to simulate timeout. Verify SubmitProgressModal appears, retry works, no duplicate submissions.
```
```
@apboost-audit Run B13-P5 (XSS/Injection Tester). Account: student8@apboost.test / Student123!. Take the Calc test. Complete MCQ normally. On FRQ type: <script>alert('xss')</script> and '; DROP TABLE;-- and 2000 chars of mixed Korean/emoji. Verify no XSS, answers stored safely, report card renders as text.
```
```
@apboost-audit Run B13-P6 (Back Button Abuser). Account: student9@apboost.test / Student123!. Take the Calc test. After each question, press browser Back (page.goBack()). Handle beforeunload dialog, click Stay. Verify dialog fires every time and answers persist.
```
```
@apboost-audit Run B13-P7 (Timer Manipulator). Account: student10@apboost.test / Student123!. Take the Calc test. Use page.evaluate to set timer to 30 seconds. Watch warning color transitions (yellow→red). Let timer hit 0, verify auto-submit fires and report card shows correct results.
```
```
@apboost-audit Run B13-P8 (Concurrent Submitter). Account: student11@apboost.test / Student123!. Take the Calc test. Answer all MCQ, go to review, use page.evaluate to fire submitSection() twice simultaneously. Verify only one result created, no error, report card loads.
```

### B14: Realistic Student Simulation (8 terminals, all parallel)
```
@apboost-audit Run B14-A (The Careful One). Account: student4@apboost.test / Student123!. Take the Micro test. Read each question 8-15s, select answer, sometimes change it (30% chance), flag 3-4 questions, go back to flagged via navigator, change 1 answer, review slowly, submit. Verify report card reflects FINAL answers after changes.
```
```
@apboost-audit Run B14-B (The Rusher). Account: student5@apboost.test / Student123!. Take the Micro test. 1-3s per question, never flag, skip review, type minimal FRQ (1-2 sentences). Finish in under 3 minutes. Verify fast completion works, timer visible throughout, report card loads instantly.
```
```
@apboost-audit Run B14-C (The Second-Guesser). Account: student6@apboost.test / Student123!. Take the Micro test. Answer all 15 MCQ, then go back and change Q3, Q11, Q14 via navigator. Visit review screen 3 times (clicking Return to Questions twice). Verify final answers correct after all changes, review screen updated each time.
```
```
@apboost-audit Run B14-D (The Confused One). Account: student7@apboost.test / Student123!. Take the Micro test. Complete MCQ normally. On FRQ Choice screen, click a topic, read 5s, try to go back. Pick different topic. Type FRQ, delete half, retype. Submit with incomplete sentence. Verify FRQ navigation works, partial answers save, report card shows FRQ as submitted.
```
```
@apboost-audit Run B14-E (The Distracted One). Account: student8@apboost.test / Student123!. Take the Micro test. Answer Q1-Q5, open new tab and wait 45s, switch back. Answer Q6-Q10, trigger page blur for 30s, restore focus. Answer Q11-Q15, submit. Verify session survives tab switching and blur/focus, timer correct, all answers persist.
```
```
@apboost-audit Run B14-F (The Lost One — Mobile). Account: student9@apboost.test / Student123!. Take the Micro test. Viewport 375x667. Tap wrong answer then correct one. Find and use navigator. Press browser back, handle dialog. Type FRQ with small viewport (375x350). Verify all touch targets reachable, navigator usable, submission works on mobile.
```
```
@apboost-audit Run B14-G (The Technical Difficulties). Account: student10@apboost.test / Student123!. Take the Micro test. Answer Q1-Q5, intercept Firestore requests for 10s (offline), answer Q6-Q8 offline, restore network. Answer Q9-Q12, close page entirely, reopen and resume. Verify offline answers synced, session resume restores all 12 answers, finish and submit, report card correct.
```
```
@apboost-audit Run B14-H (The Group Chat Student). Account: student11@apboost.test / Student123!. Take the Micro test. Answer Q1-Q3 in Tab 1. Open same URL in Tab 2, click Take Control. Answer Q4-Q6 in Tab 2. Close Tab 2, go back to Tab 1, click Take Control. Verify Q1-Q6 all present. Answer Q7-Q15, submit. Verify no answer loss across tab takeovers.
```

### Run order for B13 + B14 simultaneously

B14 uses **Micro test**, B13 uses **Macro or Calc test** — no session conflicts.
Run all 16 personas across 16 terminals if resources allow, or run B14 first (8 terminals), then B13 (8 terminals).
