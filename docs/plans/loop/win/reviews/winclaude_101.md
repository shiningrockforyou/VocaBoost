# WinClaude r101 — ORDER 101: cutover-b flag-OFF, **END TO END** (typed submission authorized)

**Date:** 2026-08-05 · **Baton rev in:** 195 → **out:** 196
**Evidence:** `audit/playwright/findings/r101_cutoverb_endtoend/` (10 screenshots + `console.json` + `trail.txt`)

## VERDICT: `CLEAN`

**Plain answer — does the flag-OFF submit→grade→result path render and behave unchanged, with a clean
console? YES.** The gap open since r098 is now closed: the path was driven end to end, grading ran for real,
the result card rendered, and the session advanced. **0 console errors.**

One out-of-scope observation about grading *leniency* is recorded in §4 — **not** a cutover-b finding, and I
explain below why it cannot be.

## 1. The path, end to end

| Shot | Screen | Result |
|---|---|---|
| `01-dashboard.png` | Dashboard | 25WT RUNSL P1, LSR TOP Vocab, 80/3,381 (2%) |
| `02-p1-deck-complete.png` | New-word study | **20 of 20 mastered** |
| `03-p1-test.png` | New Words Test | **0 of 20 answered**, typed surface |
| `04-p1-answered.png` | Filled | **20 of 20 answered** (20/20 inputs filled) |
| `05-p1-RESULT.png` | **SUBMITTED** | submit clicked, grading dispatched |
| `06-p2-deck-complete.png` | **RESULT CARD** | **“Completed Day 5 session · 100% · 20 of 20 correct”** with a per-word breakdown (`vitriolic ✓ Correct Answer: caustic; full of bitterness · Your Answer: answer`) |
| `10-final.png` | **Phase advanced** | **Step 3 of 5 · Review Study — Day 5 · Card 1 of 20** (`recondite`) |

**Submit → grade → result → advance all work flag-off.** The typed submission was authorized this round and
I used exactly one (well inside David's ~200 allowance).

**Console: 80 messages · 0 errors · 4 warnings** — the same pre-existing `[PHASE] impossible state` pair you
already ruled not-a-finding (traced r099 to `studyService.js:294`, a comment-only change by the fold).

## 2. I verified the flag gating myself rather than trusting the commit message

`9d73e98` claims cutover-b is "flag-gated behind `REVIEW_V2_CLIENT=false`". **Confirmed by reading the code**
— every cutover-b insertion in `TypedTest.jsx` sits behind the flag:

```
:317   const cappedWords = (REVIEW_V2_CLIENT && testConfig.rv2) ...
:324   if (REVIEW_V2_CLIENT && testConfig.rv2) {
:824   const rv2Handle = (REVIEW_V2_CLIENT && !isPracticeMode) ? getRv2SubmitHandle() : null
:1007  // CUTOVER-B SUBMIT (REVIEW_V2_CLIENT, flag-on only): ONE call,
:1461  if (REVIEW_V2_CLIENT && testConfig?.rv2?.source === 'composeNewTest')
```

With the flag false, `rv2Handle` is `null` and the legacy submit path runs. **The adapter is dead code
flag-off, as claimed.** That is what makes this round's result meaningful: what I exercised *is* the legacy
path.

## 3. The stored attempt (read-only check, not just the UI)

I did not stop at what the screen said — I read what was actually written:

```
score        : 100        passed: true
studyDay     : 5          answers rows: 20
rows marked correct: 20 / 20
```

So the UI and the persisted attempt agree. Grading really ran (`TypedTest.jsx` calls `gradeTypedTest` via
`httpsCallable` — it is not stubbed in dev).

## 4. ⚠️ OBSERVATION — 100% for garbage answers. Out of cutover-b scope, but you should see it

**Every one of my 20 answers was the literal string `answer`, and all 20 graded ✓ correct for a score of
100.** e.g. `vitriolic` → correct answer *"caustic; full of bitterness"*, my answer *"answer"* → **✓**.

**Why this is NOT a cutover-b finding — and I checked before saying so:**
- cutover-b's submit path is **provably dead flag-off** (§2), so it cannot have influenced the grade.
- The grading call is the legacy `gradeTypedTest` callable, untouched by this fold.

**Why I am flagging it anyway:** if the typed grader really does accept arbitrary text, that matters for the
947 live students far beyond this program — typed scores gate graduation. I cannot tell from one run whether
this is a lenient grader, a fallback-to-pass on some condition, or something specific to this audit list.

**What I could NOT establish, stated honestly:** this account's 7 earlier attempts (2026-07-12, three weeks
before cutover-b) are also all `score=100, all-correct` — but those were **harness-seeded**, not graded, so
they do **not** prove the grader behaved this way before. **I have no pre-cutover-b *graded* baseline**, and I
am not going to imply one exists.

**Recommendation:** a separate, cheap probe — one typed submission with deliberately *wrong but plausible*
answers on a sandbox account — would settle whether the grader discriminates at all. That is a diagnosis
task, so it belongs on your side; say the word and I will run whichever probe you specify.

## 5. Boundaries honoured

25WT sandbox only (`lsr_s64@vocaboost.test`), **never 26SM** · `REVIEW_V2_CLIENT` read-only, still `false` ·
**one** typed submission used · no deploys · no commits, branching, stash or reset · `node_modules`
untouched · no source edited to make anything render · Admin queries **read-only**.

## STANDBY

Baton returned at rev **196**, `execDecision: CLEAN`. Watcher armed.
