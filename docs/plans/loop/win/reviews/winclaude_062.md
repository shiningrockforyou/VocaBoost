# WINCLAUDE round 62 — CRITIC PASS (8th of 8) on `D3.5_DEEPFIX_AUDIT_REPORT.md`

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`. **execDecision:** `GAPS-FOUND` (no factual/data errors; confidence-framing gaps to fix). Read-only; zero writes (26SM read-only too).
- **My unique lane:** live-Firestore spot-checks the other 7 critics can't run. I checked **23 concrete values** incl. the real 26SM account. **All 23 MATCH the report — 0 MISMATCH.**

---

## A. Live-number verification (report value vs live Firestore) — ALL MATCH
| claim | live | report | |
|---|---|---|---|
| thr_0DnzKs / bFV18s / yiVt86 / jisu_a1 `reviewMode` | false ×4 | false | ✅ |
| …their csd (unchanged) | 11 / 7 / 17 / 5 | 11 / 7 / 17 / 5 | ✅ |
| obo_GL7SXB csd | 6 | 5→6 | ✅ |
| obo_JoJ2ch csd | 7 | 6→7 | ✅ |
| live_lhs | csd 10, twi 800 | 9→10, +80 | ✅ |
| live_oyk csd (HELD) | 12 (twi 320, interv 1) | @12 | ✅ |
| choi_a12 clone | csd 16, twi 1200 | list-end, capped 1200 | ✅ |
| lostsave_bc_d6 | csd 6, twi 480 | 5→6, 400→480 | ✅ |
| A2_skip_hold / F1 / F4 csd | 5 / 30 / 6 | 5 / 30 / 6 | ✅ |
| F8 canonical count | 1 (no proliferation) | 1 | ✅ |
| **REAL 최도훈 twi** | **1200** | 1200 (not 1280) | ✅ |
| **REAL 최도훈 csd / day-16 new anchors** | **16 / 0** | 16 / 0 | ✅ |
| BC `words` subcollection count | 1200 | 1200 (0–1199) | ✅ |

**The report's quantitative spine is accurate** — including the hardest-to-check claim (a real-cohort record I read directly). The SHAs (`59df732`/`26cd8ee`/`d2bb2bc`/`0ddbb34`/`6bffe1c`/`e20b532`) and live posture (client `6bffe1c` / functions `0ddbb34`) also match. So my critique below is about **what the accurate numbers are made to mean**, not the numbers.

## B. Ranked issues ([claim] → [problem] → [fix])

**1. [HIGH] "15 PASS" overstates breadth — it's ~9 families at N=1.** Claim: a 15-wide scorecard reads as broad coverage. Problem: throttle is N=5 but every other family is **N=1** (lost-save, list-end, normal, runaway, skip-hold, read-only, canonical, incoherent). A single faithful instance can't distinguish "family robustly fixed" from "this one state happens to pass." Fix: reframe as "**9 families, N=1 each except throttle N=5**"; downgrade "validated" → "demonstrated on one faithful instance" for the N=1 rows.

**2. [HIGH] Every drive scored ~100% → the dead-band *exit* and real-score behavior are untested, and "requires TWO good reviews" is over-generalized.** Claim (§4.1/§6.2): throttle escape "requires **two** good reviews (not one)." Problem: that's true **for these deeply-throttled seeds** (recent avg ≈ 0.2, so even a 100% review lands avg ≈ 0.49, still in the dead-band). A *less*-throttled student (seed avg ≈ 0.4) would cross 0.50 on **one** 0.85 review — so "two, not one" is seed-dependent, not a universal property. And all reviews were driven at 100% (matcher-perfect), never at a realistic 0.70–0.85, so the **exact 0.50 exit boundary** is never exercised. Fix: state the two-step result is conditional on deep throttle; add one partial (~0.70) drive to probe the exit threshold; caveat that real scores weren't sampled. *(Credit: driving 100% is actually the strongest test of "stay held after 1," so the HOLD side is solid — it's the EXIT that's thin.)*

**3. [MED] 4 of 15 are WSL-invented synthetics, scored by WSL-invented criteria — same headline as real-ticket clones.** Claim: uniform "15 PASS" scorecard. Problem: F1/F8/F4/A2 are self-designed states whose pass criteria the same entity wrote (designer == judge). Legitimate as boundary probes, but not the evidential weight of a real-ticket recovery. Fix: split the scorecard **"11 real-clone / 4 synthetic-adversarial"** and label the synthetics' criteria as self-designed.

**4. [MED] "0 FAIL" headline absorbs a genuine FAIL-then-reclassify.** Claim: "15 PASS / 0 FAIL." Problem: choi_a12 **did** read FAIL, and became a PASS only by reclassifying the family (lost-save → list-end) after forensics. The forensic is real and I verified the real-account fix live — but "test failed → relabel → passes" is exactly the pattern a skeptic should distrust, and the headline hides it (it's only a footnote). Fix: headline **"14 PASS + 1 reclassified (choi: FAIL→list-end PASS after forensic + real data-defect fix)."**

**5. [MED] Real *triggers* aren't reproduced — only their resulting states.** Problem: (a) the #16 runaway trigger was "8 reviews in 8 min"; live_oyk tests empty×2 **containment**, not rapid-fire succession. (b) The lost-save is seeded as the *result* (missing anchor), not the network/grading failure that causes it. (c) The dominant real #11 impact is **169 list-end students** (per SUPPORT_RUNBOOK #11 scan) — represented here by **one** special phantom clone. Fix: add these to §7 known-limits as *trigger-coverage* gaps (distinct from the browser-storage exclusion already disclosed).

**6. [LOW] live_kjk "escaped" via csd-advance with `reviewMode=null`, not `reviewMode=false`.** Live shows csd 4→5 but `reviewMode=null` (vs the thr_ students' explicit `false`). Not a mismatch (escape confirmed by advance), but the mechanism differs and the report lumps it as "escaped." Fix: note the two escape signatures.

**7. [LOW / disclosed] M7 proof is flag-posture-specific.** The server-only-log proof validates the **CANONICAL=false** resolver path (current). Post-P5 (CANONICAL=true) the resolver *writes* canonical — unproven, and the report says so. Fine; just make explicit that M7 covers the current posture only.

## C. What's genuinely strong (not rubber-stamping — earned)
- Every live number verifiable-and-verified, including a real 26SM record — rare rigor.
- The 3 self-caught tooling/fidelity defects (§4.1/4.4/4.5) and the real legacy data-defect find (§5) are real and materially strengthen credibility; I independently confirmed my own 3 premature reads were corrected (they never entered the record).
- `session_states`-inert (§4.2) and non-demoting `safeCSD` (§4.3) are load-bearing and consistent with everything I observed driving live.

## D. BOTTOM LINE — **QUALIFIED** (not "NOT-DESERVED", not a clean "DESERVED")
The report is unusually honest and its **data is fully accurate** (23/23 live checks MATCH). But **"15 PASS / 0 FAIL" oversells robustness**: ~9 families at N=1, 4/15 self-designed synthetics, all drives at 100% scores, one FAIL reclassified. The recoveries shown are **real**; the leap from "this faithful clone recovered" to "the family is fixed for real students" is where the confidence outruns the evidence.

**Single biggest risk:** *N=1-at-100%-score.* The exact dead-band **exit** threshold and real-score (0.7–0.85) behavior are never sampled — that's the seam where a real throttled/borderline student could still diverge from the clone's perfect-score pass. One partial-score drive per throttle + one non-choi list-end clone would close most of the gap.

---
**Hand back:** baton `turnOwner=claude round=62 execStatus=review-written execDecision=GAPS-FOUND updatedBy=winclaude revision=124`. Verification script: `audit/deepfix/task6/r62_verify_report.mjs` (read-only, re-runnable).
