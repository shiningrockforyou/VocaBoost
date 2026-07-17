# Forced / Determined Pathway — Consolidated Fix Plan (2026-07-16)

**Scope:** fix the forced day-progression + intervention pathway end-to-end. Free-navigation pivot is **ON HOLD**
(`docs/design/FREE_NAVIGATION_MODEL.md`). This plan makes the *existing* forced pathway work correctly.

**Method:** same rigor as deepfix — each fix gets a grounded, adversarial verification (agents; I verify every
finding) before code; LIST_SCOPED_RECON-adjacent fixes route through the Codex gate; Playwright smoke (sandbox +
prod) after. **No code until David approves the product decisions in §4 + gives go-ahead** (standing rule).

---

## 1. Root-cause map — every recent CS finding, grouped

All the week's tickets collapse into **four** root causes. The ~57 throttle-reset band-aids (CS-2026-07-14/15/16),
the 이아연 investigation (CS-16c), and NEED_TO_FIX #9–#16 are all symptoms of these.

### Cluster A — the intervention throttle is BOTH a trap AND poisoned by non-engagement
- `interventionLevel=1.0` → `calculateDailyAllocation` gives **newWordCount=0** → review-only day. Pre-#11 that
  deadlocked (frozen); post-#11 it "completes" but the student is stuck on review with no new words. **NEED_TO_FIX #11.**
- A **skipped** review records `score:0`, which feeds `calculateInterventionLevel` (last-3 window) → it
  **false-throttles good students who skip** (이아연 scores 73–77% when she takes it; 7/10 of her reviews were skips
  → interv pinned 1.0). *This session's finding.* (NOT empty tests — CS-16c disproved that.)
- Self-reinforcing: a maxed student can't self-recover without doing reviews (which throttled students often skip).

### Cluster B — csd advancement is wrong in several ways
- **Runaway (#16 / THROTTLE_REVIEWONLY_ADVANCE_FLAW):** #11 advances csd on **throttle** review-only days, even when
  the review is **skipped** → the day counter races ahead of real progress (이아연 csd 11 vs real ~8). *This session.*
- **Self-race (#10):** reconciliation writes the advanced csd *between* the attempt write and `completeSession` →
  the completion is stale-blocked → "session refreshed." Latent (0 in prod) but a real correctness smell.
- **Off-by-one (CS-07-14b/16 root):** review-before-new ordering → the day-completion pairing misses → csd lands at
  `anchorDay-1` (김우주/이찬희/서혜빈 + 16 latent, all hand-fixed).
- **Cross-class spurious retake (#9):** cross-class review completion forces a new-word retake.

### Cluster C — the review is not enforced, non-gating, and un-retakeable
- **Skip-bail (this session):** the **"Submit Test (0/30 answered)"** button is always active (`MCQTest.jsx:1457`,
  disabled only while submitting) — one click bails the whole review with 0 answers; only a soft text warning.
- **Always-passes (`MCQTest.jsx:537`):** a bailed review still records `passed:true` → the day completes → csd
  advances → feeds the runaway.
- **No retake (#15):** a garbage/accidental review is permanent; reviews are non-gating.

### Cluster D — test generation produces degenerate tests
- **Empty-slice ceil bug** in `computeUnmasteredSegmentIds` (studyAlgorithm.js): `segmentSize=ceil(pool/divisor)` +
  `start=pos*segmentSize` means later day-of-week slices start past the end of a **small** pool → empty slice →
  `totalQuestions:0` review. (Safe today — empty tests score 100/`reviewScore:null`, they do NOT poison — but
  degenerate, and it disproportionately hits *good* students with small unmastered pools.) *This session.*
- **Test-size mis-generated at boundaries (#13).**

---

## 2. The fixes (the linchpin first)

### PHASE 1 — the linchpin (David's decisions locked 2026-07-16)

**Model (David):** the throttle becomes an explicit **BINARY** gate — *below a review-average threshold T →
FORCED REVIEW MODE* (0 new words); do reviews → average rises → *above T → new words UNGATED* (full pace). No
linear middle. Skipping is allowed but **warned and counts as 0%** (skipping is a real signal, not a bug). A
genuinely-engaged **review is REQUIRED to advance** a day.

**F1 · Binary intervention (replaces the linear interpolation)** — NEED_TO_FIX #11.
Replace `calculateInterventionLevel`'s 0.0–1.0 ramp + `calculateDailyAllocation` with a binary decision:
`reviewAvg(last-N) < T` → **review mode, newWords = 0**; else **newWords = full pace**. The review-mode state
MUST be clean: (a) reviews **record and update the average even in review mode** (so escape is possible — verified:
2 good reviews → out), (b) **no deadlock** (review mode completes via doing the review, per F3), (c) **no
poisoning artifact** — the average is the honest last-N reviews. ⚠ Same **multi-writer invariant**: mirror across
`studyAlgorithm.js` (live client), `functions/foundation.js:913`/`:1861` (dormant server), `db.js:3038` (legacy).
*Sub-decisions:* threshold **T** (single, or hysteresis: enter <0.30 / exit >0.50 to avoid flapping); and whether
review mode **HOLDS csd** (stay put until escape → no day-counter inflation, recommended) vs advances per review.

**F2 · Clear skip WARNING (skip still counts as 0%)** — replaces the earlier "record null" idea (David: keep the 0).
On an empty/under-answered Submit, show an explicit confirm: *"This will be submitted as 0%. Your review scores
will drop and your progress may be throttled into review-only mode."* The 0% is a real signal (student chose not
to review) and correctly drives F1. So 이아연-type students are **correctly** put in review mode — the fix is
clarity + escapability, not nulling the score.

**F3 · Review REQUIRED to advance** (David: yes). A day completes only on a **genuinely-engaged** review; a skip
(0%) records for the average but does **NOT** complete/advance the day → **this is what kills the runaway (#16)**
(a skipped review-only day no longer advances csd). Replaces `MCQTest.jsx:537` "review tests always pass."
*Coupled with F9's "minimum-to-pass" question — see §4/F9.*

> With F1 + F2 + F3: skipping → warned, counts 0%, does NOT advance (runaway dead), correctly routes to review
> mode; doing reviews → average up → new words unlock. The whole throttle-wave + runaway ticket class closes.
> Existing throttled students **self-heal** by doing reviews (verified) — no forced intervention data write.

### PHASE 2 — csd advancement correctness

**F4 · csd advances only on a genuinely-completed day** (#16). Mostly subsumed by F1 (no throttle review-only days);
this covers the remaining LIST-END review-only case + a single clear "advance on real completion" rule.
**F5 · Fix the flag-ON self-race (#10)** — take the pre-completion snapshot WITHOUT reconciling, or make completion
idempotent to "already reconciled from this same day's attempt." LIST_SCOPED_RECON path → **Codex gate**.
**F6 · Fix the review-pairing off-by-one** (CS-07-14b/16 root) — csd reflects a completed day regardless of
new/review order. Retires `fix-csd-undercount.mjs`/`fix-csd-to-completed.mjs` as recurring band-aids. **Codex gate.**
**F7 · Fix cross-class review → spurious new-word retake (#9).** **Codex gate.**

### PHASE 3 — test generation + review UX

**F8 · Fix `computeUnmasteredSegmentIds` empty-slice** — distribute the remainder / rotate so no day gets an empty
slice while the pool is non-empty; + test-size at boundaries (#13). Removes the degenerate `totalQuestions:0` reviews.
**F9 · Review retake path (#15)** — let a student re-take a review so an accidental/garbage one isn't permanent
(complements F3).

### PHASE 4 — data cleanup (AFTER the code deploys)

**F10 · Correct inflated csd** for runaway victims — non-demoting to their real completed day (cosmetic: csd
inflation doesn't block new words, but the day counter should be honest). Use a verified corrector + before/after
sweep. **No intervention data write** — students self-heal once F1/F2 ship and they take reviews.

---

## 3. Sequencing & risk

| Phase | Fixes | Path | Risk | Deploy |
|---|---|---|---|---|
| 1 | F1, F2, F3 | client (studyAlgorithm/MCQTest/TypedTest) | low–med | Netlify (git push) |
| 2 | F4–F7 | reconciliation/server, LIST_SCOPED_RECON | **med–high** | client + functions; **Codex gate** |
| 3 | F8, F9 | client test-gen | low–med | Netlify |
| 4 | F10 | CS data script | low | admin script, dry-first |

Phase 1 is the 80/20 — ship it first and most of the week's ticket volume disappears. Phases 2–3 harden correctness.
**Do NOT** deploy the staged P10d `firestore.rules` as part of any of this (bare deploy = cohort freeze).

---

## 4. Product decisions David must make (before Phase 1 code)

1. **Throttle floor (F1):** floor `newWordCount` at **1**, or at a small fraction of pace (e.g. `max(1, 0.25·pace)`)?
   (How much to weaken the throttle for low-retention students vs. keeping review emphasis.)
2. **Review enforcement (F3):** **hard** (Submit disabled until ≥N answered) or **soft** (can submit, but a
   below-min review records null + doesn't complete/advance the day)?
3. **Is the review GATING?** Today "review tests always pass." Should a real, engaged review be *required* to
   complete a day (so students can't advance without genuinely reviewing)? This is the core of "forced pathway."
4. **Review retake (F9):** allow re-taking a review? (Yes recommended — pairs with F3.)

---

## 5. Verification (per rigor)

- Each fix: grounded read of the live path + adversarial agents (correctness / safety / independent re-derivation);
  I verify every finding. Phase-2 fixes (F5–F7, hardened LIST_SCOPED_RECON) additionally go through the **Codex gate**.
- Playwright: sandbox E2E for each fix (my env drives public URLs) + a prod smoke on the throttle/skip/runaway
  personas (the THROTTLE_FIX_VALIDATION roster).
- Flag-off byte-equivalence for any server-path edit (foundation.js is dormant).
