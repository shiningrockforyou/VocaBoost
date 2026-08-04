# 21 — DF2-14 FLIP ABORT CARD (closes 13_ O1-6 [HIGH]: numbers · card · abort rule)

**What this is.** The pre-flip, numeric abort rule for THE LAUNCH (DF2-14: the one audited cohort-wide
flip of the review-graduation redesign, gate ON@92). O1-6 found the riskiest deploy in the program had
"no numbers, no card and no abort rule" — R2-18 set the signal set "at WSL discretion" with "numbers
from B1", and B1 had not run. **B1 has now run** (`evidence/b1-baseline-pointer-full.json`, 947 students
/ 34,867 eligible attempts) and the **H8 seeded re-sim** exists (`evidence/h8-resim-results.json`), so
the numbers can be set. This card converts the signal set into per-signal thresholds with an owner and a
rollback, and gates the flip on THEM — not on CS tickets that arrive only after students are blocked.

Status: PROPOSED (2026-08-04). **Threshold RATIFICATION is David's** (R2-18: owner = David, or WSL on
standing instruction) — this card supplies the derivation and candidate values; the risk line is his.
All numbers are derived from the two evidence files; none is hand-typed (see §DERIVATION).

---

## THE STRUCTURAL CONSTRAINT O1-6 ALSO NAMED — thresholds must be ABSOLUTE / vs-B1, never vs a control
A cohort-wide flip leaves **no comparison class**. DF2-61's old success ladder ("pilot CS tickets ≤ its
own forced baseline …") is void (R2-24a) and required a control the flip removes. So every threshold
below is **absolute or vs the frozen B1/H8 baseline**, measured on the live cohort — not a delta against
a concurrent unflipped group, which will not exist.

## WHY THE REHEARSAL CANNOT CARRY THIS (so this card must)
25WT is 13 students vs 947; `19_REHEARSAL_SPEC.md` leads with the fact that it **cannot rehearse a
mass-wall event**. The rehearsal proves the mechanism works; THIS card is the only thing standing between
a modelling error and 900+ students silently walled. They are complements, not substitutes.

---

## WHERE THE WALL RISK LIVES (H8 per-band, derived across all 15 rerun/seed/size/launch scenarios/band)

| accuracy band | mean wall-days /120 | fully-walled (0 days advanced) | mean days advanced |
|---|---|---|---|
| **lt50** (<50%) | **120.0** | **100%** | **0.0** |
| **b50_70** | 116.7 | 0% | 3.3 (crawls) |
| b70_85 | 2.8 | 0% | 117.2 |
| b85p (≥85%) | 0.0 | 0% | 120.0 |

**Reading:** under the @92 gate the entire wall risk is the bottom two bands — `lt50` hard-walls, `b50_70`
crawls. The top two sail. So the flip's danger is precisely **the size of the lt50+b50_70 population**.

**H8's own caveats, carried so a threshold is not set to a pessimistic PREDICTION:** the sim is a
single-student closed world with **no cross-day learning** beyond the within-day retake bonus, so
"lt50 = 100% walled" is a **pessimistic FLOOR, not a forecast** — real students improve day to day. H8
tells us the SHAPE (walls concentrate in low bands) and the mechanism; it does **not** license a
pre-flip cohort wall-rate to abort against. The abort fires on **OBSERVED** wall behaviour vs a baseline
tolerance (below), which is why the exact prediction is not on the critical path.

---

## THE ABORT RULE

**Soak window:** 7 study-days post-flip (inherits DF2-10's; DF2-14 previously inherited none).
**Action on any RED:** flip `system_config/review_v2.enabled = false` — instant, state-preserving under
the kill-switch label law (R2-32/R2-48). No surgical rollback; the deep fallback is the full-set redeploy
to the DF2-10 pin. **PITR verified pre-launch with one restore rehearsal; RPO ≤ 1 min, RTO ≤ 1 h (FF1-05).**
**Owner:** David, or WSL on standing instruction. **CS tickets = David's primary signal**, but the flip is
gated on the machine signals below so it never depends on a ticket that arrives after a student is stuck.

| # | Signal | Source | ABORT (RED) when | Grounding |
|---|--------|--------|------------------|-----------|
| S1 | **Wall rate** — % of ACTIVE students who submit a review test but do not advance their frontier (score < 92), day-1 and rolling-3-day | `ops_metrics` (server-only) vs B1 | day-1 non-advance among actives **> [RATIFY: candidate 2× the B1 today-fail floor 15.6% → ~31%]**, OR the rolling-3-day cohort still-walled set **> [RATIFY]** | B1 `distributions.failed = 15.6%` is the today-floor (reviews auto-pass today, so any wall is NEW); H8 shows walls are real for lt50/b50_70 |
| S2 | **Force-pass volume** — teacher force-pass events/day | `ops_metrics` | **> [RATIFY: candidate = the daily load teachers can sustain]**; proxy at-risk pool = 15.6% × 947 ≈ **148 students** | a force-pass spike = the wall is real AND teachers cannot keep up — the operational failure mode |
| S3 | **Label-write failure rate** — accepted attempts that fail to stamp the six `review*` labels | `ops_metrics` | **> 0.5%** over any rolling hour (near-zero tolerance) | the stamping law is the redesign's spine; a failure is silent data corruption, not a UX nit — abort fast |
| S4 | **Score drop vs B1** — cohort mean review score | `ops_metrics` vs B1 | mean review score **> [RATIFY: candidate 10 pts]** below the B1 accuracy baseline | B1 `everCorrect 93.3%` / the per-band accuracy cells; a drop = grading/composition broken, not merely a hard gate |
| S5 | **composition_fallback rate + priority-saturation days** | `ops_metrics` (never client `system_logs`) | fallback **> [RATIFY]** of composes, OR any priority-saturation day | R2-42/46: a fallback means the deterministic composer failed its post-compose invariant |
| S6 | **rerun-graduation volume** | `ops_metrics` | anomalous vs H8 rerun-graduation counts **[RATIFY band]** | R2-41(g): reruns graduate tested-correct only; a spike signals a stamping/graduation defect |
| S7 | **"stuck despite ≥92%"** — a student at/above the gate not advancing | `ops_metrics` + CS | **any occurrence** → re-opens DF2-0P (R2-22) AND is an S1 contributor | David's own stated day-one signal (13_ O1-2 correction) |

Any single RED → abort. S3 and S7 are **fast** signals (near-zero tolerance / any-occurrence); S1/S2/S4
are **windowed** (day-1 spot + rolling-3-day) so a slow build still trips before the 7-day soak ends.

---

## THE SECOND SIGNAL FAMILY — REGRESSION INVARIANTS (DF2-34 re-derived; closes 13_ O1-5's third limb)

S1–S7 ask *"is the new gate harming students?"* — the redesign's intended-but-risky effects. This family
asks the orthogonal question: *"did the flip break something it was NOT supposed to touch?"* DF2-34
originally carried a **canary** (1 class → N) whose regression signal was pilot-vs-rest; **R2-5/R2-24
killed the pilot**, so — exactly as with S1 — there is **no control class**. The re-derivation is
therefore **TEMPORAL, not cross-sectional**: each invariant is measured against **the cohort's OWN
pre-flip baseline** (the last N pre-flip study-days, captured as B0 in the same `ops_metrics` sink the
day before the flip), and RED = a regression beyond tolerance vs that baseline. Same abort action, same
owner, same soak window as above — one card, one dashboard, one `enabled:false`.

**The flip-invariants** — surfaces the review-graduation redesign does not change, so any movement is a
regression, not an expected effect:

| # | Invariant (must NOT change at the flip) | RED when vs the pre-flip B0 baseline |
|---|------------------------------------------|--------------------------------------|
| R1 | **Auth / session start** success rate | login or app-load success drops **> [RATIFY: 1–2 pts]** |
| R2 | **NEW-word (non-review) test** submit success | new-word submit success drops at all (the flip touches REVIEW composition, not new-word) |
| R3 | **Attempt-write success** rate (the write path itself) | write-failure rate rises above B0 — a proxy for the cutover-b/c seam or the namespace guards misfiring |
| R4 | **Dashboard load** success + **client JS exception** rate | dashboard error rate or uncaught-exception rate rises above B0 (the new client code broke an unrelated surface) |
| R5 | **Teacher gradebook / analytics** load | teacher read surfaces regress (DF2-11 menu + gradebook ride this train) |
| R6 | **Classes NOT yet at a review day** complete normally | a non-review day-completion regresses — the flip should be invisible to them |
| R7 | **Grading availability** (MCQ + typed) | grader error/timeout rate rises above B0 (distinct from S4's score DROP — this is availability, not accuracy) |

**Why R2/R3/R6 matter most:** the cutover folds (a/b/c/d) rewire compose→submit→complete and the
namespace fold guards the write path; a defect there shows first as a write/submit/completion regression
on students who are NOT even at a review day yet — the earliest possible warning that the flip broke the
spine, before any wall-rate signal could accumulate. These are **fast** signals (day-1, hourly rolling).

**The baseline this family needs — B0, and it must be captured BEFORE the flip:** a temporal regression
signal is only as good as its pre-flip baseline. B0 = the same `ops_metrics` invariant rates over the
final pre-flip week, frozen the day before the flip. **Without B0 there is no regression signal** — this
is the one hard sequencing dependency: the `ops_metrics` writers (DF2-10 dark build) must be emitting
R1–R7 in production, dark, for at least the baseline window before the ACTIVATION go. Carded as a
pre-flip gate, not a post-flip nicety.

> **Playwright scope for the no-canary flip** (O1-5's remaining ask, PAIRED with this) is DF2-34's
> validation-matrix half and belongs with the `playwright-suite` queue item, not here: the E2E matrix
> (every exit status × both test types × crash-recovery × modal path × the 10-case dual-class oracle,
> R2-5's "extensive Playwright") is the PRE-flip proof; R1–R7 are the DURING/POST-flip watch. This card
> owns the watch; the suite owns the proof.

---

## THE ONE NUMBER STILL OWED (carded, not hidden)
The **pre-flip PREDICTED cohort wall-rate** (what fraction of the 947 fall in lt50+b50_70) needs the
cohort binned by H8's **last-answer** accuracy metric. It **cannot be faithfully re-derived** from
`graduation-validity-26SM.json` alone — that file carries word-level conditional cells (proven/afterWrong/
untestedFresh/untestedAged), not a per-student last-answer band — and guessing the binning would publish
an authoritative-looking but wrong number. **Deliverable:** extend the H8 harness to emit per-band
STUDENT COUNTS for the cohort (it already bins them to build its rate table), publish to
`evidence/`, and set S1's candidate 31% against that prediction with David. **This is a refinement of S1's
threshold, NOT a blocker on the card** — S1 already fires on OBSERVED walls vs the B1 floor, which needs
no prediction.

## DERIVATION (every number traces to evidence — none typed)
- B1: `students 947`, `attempts.eligible 34,867`, `distributions.failed 15.6%`, `everCorrect 93.3%`,
  `proven 84.2%` — `evidence/b1-baseline-pointer-full.json`.
- H8 per-band wall table: aggregated from `evidence/h8-resim-results.json` `results[]` (60 scenarios, 15
  per band), `mean(wallDays)` / `count(daysAdvanced==0)` / `mean(daysAdvanced)`. GATE=92, QUEUE=60, TEST=30.
- 148 at-risk proxy = 0.156 × 947 (a labelled PROXY for S2's pool, not a prediction).
- `[RATIFY]` marks a risk-tolerance value that is David's to set; the candidate is WSL's proposal.

## SEQUENCING
Slots UNDER DF2-14's existing MONITORING block (02_TASK_LIST:124) as its abort artifact; `19_REHEARSAL_
SPEC.md` and `17_DEPLOY_ORDER_REQUIREMENTS.md` point here. Fires at the flip, which is David's ACTIVATION
go — nothing here deploys or flips anything. `ops_metrics` evaluator + thresholds are the DF2-10 dark-build
deliverables (`evaluateThresholds`) this card supplies the numbers for.
