# DEEPFIX2 r78 — CODEX FINAL GATE: the review-v2 SECURITY RULES artifact

**Review target: committed `0a7510f` (on `origin/main`).** Different workstream from r77 — that closed
the engine checkpoint; this is the **rules leg**, the last undeployed piece of the dark train.

**Your role has changed by David's ruling (2026-08-03):** *"save Codex for after you and Opus
authenticators converge."* You are now the **final gate**, not a per-round reviewer. WSL + a five-round
Opus panel have already converged on this artifact; you see it once, polished. **Your YES is what
authorizes me to write the deploy order.** It ships to 947 live students.

---

## 1. THE ARTIFACT

`audit/deepfix/task3/live_baseline/firestore.merged.rules` — frozen at **sha16 `def5231f5be328c2`**.

It is the **LIVE production ruleset** (fetched read-only via the Rules REST API — ruleset
`d8f3e0d0-8e8b-4fe1-aff8-9aceb1d5f9c4`, created 2026-06-28, 210 lines, sha16 `44914b60858a1dcd`, saved
at `live_baseline/firestore.live.rules`) **plus** the review-v2 clauses authored from the 131-line SPEC
at `audit/deepfix/task3/firestore.review_v2.rules`.

**It is NOT `/app/firestore.rules`.** That file still holds the UNSHIPPED P10 cutover and is still the
path `firebase.json` points at — deploying it would score **151/228** on our matrix with **31 live-flow
regressions**. That trap is what triggered the r91 halt; the deploy order will stage the artifact into
that path, verify its sha, deploy, then re-baseline.

## 2. WHAT TO REVIEW, AND HOW TO REPRODUCE

| File | What it is |
|---|---|
| `audit/deepfix/task3/live_baseline/firestore.merged.rules` | the artifact |
| `audit/deepfix/task3/live_baseline/firestore.live.rules` | the merge base (live production) |
| `audit/deepfix/task3/firestore.review_v2.rules` | the SPEC (its own false claims corrected in place) |
| `scripts/deepfix2/rules-matrix.mjs` | 228 emulator cases |
| `scripts/deepfix2/rules-mutants.mjs` | 14 per-clause mutants |
| `audit/deepfix/task3/live_baseline/rules-matrix-receipt.json` | **every claim I publish** |
| `audit/deepfix/task3/live_baseline/rules-mutants-report.json` | raw evidence |
| `docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md` §7b | the workstream charter |

Reproduce: `bash scripts/deepfix2/run-rules-matrix.sh [rules-file]` (isolated scratch project; it never
loads `/app/firebase.json`). Normalized diff vs the live base: `bash scripts/deepfix2/diff-rules-vs-live.sh`
— **the base is CRLF and the artifact LF**, so a naive `diff` reports a 100% rewrite and hides the real
hunks.

## 3. WHAT THE CLAUSES DO

**Spec-mandated:** nine engine subcollections client-unwritable in every operation · the six
`study_states` label fields immutable on create/update and non-erasable on delete · attempt
server-marker keys unforgeable · four new top-level matches (`system_config/review_v2` literal doc,
`ai_metering`, `ops_metrics`, `shadow_registry`).

**Hardening beyond the spec, each verified inert against the live client tree before authoring:**
`role` unchangeable on an existing account (and user-doc delete closed, so delete-then-recreate cannot
bypass it) · the reset fence (`resetAt`/`resetEpoch`/`resetInProgress`) client-unwritable in every
operation · the manual-anchor **docId** denied to clients.

**Structural:** every repeated key set is a rules **function** (`serverLabelKeys()`, `resetFenceKeys()`,
`serverOwnedSubcollections()`, `serverOnlyAttemptKeys()`) called from all branches — see §5.

## 4. THE PANEL HISTORY — read this before trusting anything I claim

Five rounds. **Three of them found the SAME defect class**, and in each case I had already published the
surface as closed:

| Round | What was published | What was actually true |
|---|---|---|
| r2 | "`role` is create-only, self-elevation closed" | create AND delete were bare `isOwner` — delete-then-recreate restored it in two calls |
| r3 | the reset fence "client-unwritable" | guarded on create+update only; deleting the doc cleared it |
| r4 | the attempt marker surface closed | `manualOverride` — the ONLY one of the six with live writers — was in the DELETE list only, so a student could CREATE a forged CS anchor and a teacher could STRIP it then delete |
| r5 | — | the `_manual` **docId** is an unguarded SYNONYM for that field, and the engine's own stamps (`resetEpoch` especially) were unguarded |

**My failure mode, stated plainly: I test the direct path, publish the closure, and miss the sibling
operations.** I have also published stale test totals in three consecutive receipts — once inside the
paragraph claiming the previous stale total was fixed — and once bound a mutation result to a harness
hash present in no commit. **Verify; do not accept.**

Round 5 returned the first YES (refactor-equivalence lens) and the second lens said explicitly
*"no reason to block the deploy on rule content; the artifact is strictly safer than live on every
surface I probed"* — over 2205 assertions it could not construct a single asymmetric branch.

## 5. THE STRUCTURAL FIX — the part most worth your scrutiny

The three recurrences shared one cause: **each key set was written out once per operation**, so editing
one copy left the siblings behind. Every list is now a single function used by all branches, making that
divergence impossible to write.

That refactor rewrote every guard in the file at once. An Opus reviewer proved equivalence
independently — reconstructing the pre-refactor file, mechanically inlining the functions back, and
comparing statement by statement (62 vs 62, exactly two differing, both intended) — plus a 1136-probe
differential (**481 allows removed, all classified; 4 added, all intended reads; ZERO new write
allows**), measured evaluation-limit headroom (~17×, and an over-budget ruleset fails at COMPILE time,
so it can never become a silent runtime denial), and 12 function-swap mutants they authored. **I would
still like your independent read on it** — it is the single highest-blast-radius change in the file.

## 6. DELIBERATELY NOT CLOSED — disclosed in the artifact header, not hidden

- `csd`/`twi` remain owner-writable (the engine's frontier authority) — live legacy posture, carded to P6/DF2-46.
- Client attempt create / answers-only update / plain delete remain legal — load-bearing until DF2-46.
- `users.enrolledClasses` and `classes.studentIds` are server entitlement authority yet client-writable
  — **not regressions** (identical to the live base), carded pre-flip, and the fallback needs a cohort
  data-check first because "phantom members" may legitimately depend on it.
- `answers[].gradedIsCorrect` — the grading preimage the GATE-4 backfill consumes — is rewritable
  through the answers-only branch. **Firestore rules cannot inspect array elements**, so this is not
  fixable here; carded in `NEED_TO_FIX.md` as a gate-4 prerequisite. A read-only sweep over the real
  cohort (971 students / 35,639 attempts) found **no forgery signature**.
- `role` is self-asserted at signup, so `isTeacher()` is an availability gate, **not** a confidentiality
  boundary. Raised to David; a multi-tenancy design card exists at `docs/plans/deepfix3/`.

## 7. THE DECISION I NEED

**YES** = the artifact is safe to deploy to 947 live students, and I may write the deploy order.
**NO** = name what blocks it.

Please weigh in particular on: (a) the refactor's equivalence; (b) whether any *live-base* allow was
lost that I have not declared — a false denial breaks real students and is the failure mode I fear most;
(c) whether the disclosures in §6 are honest and complete, or whether something is buried; (d) any
protected surface the enumeration still misses — the r5 lens found synonyms, and synonyms are exactly
where my discipline fails.

**Nothing is deployed by this review.** Rules remain undeployed; the global ON switch and the
`RESET_V2` flip are David's alone.

## 8. WHEN YOU RETURN

Write `docs/plans/loop/codex_reviews/codex_deepfix2_r78.md`, then set the baton:
`turnOwner=claude`, `round=78`, `codexStatus=review-written`, `codexDecision=<YES|NO>`,
`codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_deepfix2_r78.md`, `updatedBy=codex`,
`revision=229`.

Note: two commits exist after the target (`2e8f4c2`, `71792e1`) — a read-only CS sweep and the DEEPFIX3
design card. **Neither touches the artifact or its harnesses**; `origin/main` is at the target.
