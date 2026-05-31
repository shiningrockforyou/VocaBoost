# B27 Verify — Post-Fix Verification Report
Agent: VERIFY | Run: 2026-05-31T15:39-16:12 UTC

## HEADLINE

**FIXES VERIFIED IN PROD: PARTIAL**
- **F01** (MASTERED-review-leak backstop): **NOT CONFIRMED WORKING** — 48 leaks detected across 4 of 6 lazy sessions; fix code is deployed but targets a non-primary code path
- **B2** (undefined-strand + CSD advance): **CONFIRMED WORKING** — zero undefined errors, CSD advances, session_states.phase reaches complete

---

## Deploy Gate

| Field | Value |
|-------|-------|
| Live bundle hash | `index-Q7YGdakV.js` |
| F01 signature (iX backstop) | `p.status!=="MASTERED"` filter at start of `iX()` / selectReviewQueue — **PRESENT** |
| B2 signature (strip-undefined) | `Object.fromEntries(Object.entries(n).filter(([,u])=>u!==void 0))` in saveSessionState — **PRESENT** |
| Deploy status | **DEPLOYED** |

Both code changes are confirmed in the live bundle. The deploy gate passes.

---

## Test 1 — F01 Pool Collapse (lazy/TOP)

Account: VBgBmlrlzXVPzURmABkdDBGtKd42 | Pre-run: CSD=11, TWI=240, 71 MASTERED-with-future-returnAt
Anchor date: 2026-07-07 (Mon), +1 weekday per session

| Day | Fake Date | Pre-MASTERED-Future | Served | Leaks | B2 Errs | CSD Δ | Verdict |
|-----|-----------|---------------------|--------|-------|---------|-------|---------|
| 12 | 2026-07-07 | 24 | 30 | **3** | 0 | 11→12 | **FAIL** |
| 13 | 2026-07-08 | 67 | 30 | 0 | 0 | 12→13 | PASS |
| 14 | 2026-07-09 | 132 | 30 | **4** | 0 | 13→14 | **FAIL** |
| 15 | 2026-07-10 | 190 | 30 | 0 | 0 | 14→15 | PASS |
| 16 | 2026-07-13 | 252 | 30 | **21** | 0 | 15→16 | **FAIL** |
| 17 | 2026-07-14 | 291 | 30 | **20** | 0 | 16→17 | **FAIL** |

**F01 total leaks (lazy): 48 — FAIL**

Leaked MASTERED wordIds (identity-verified against pre-session Firestore study_states):
- Day 12: PaiY51v6MrQQqT8o0qzY (unbiased), obqz07VMtLM510YecxLb (extremity), EAdXy5uHiulCoh8d0SMh (navigate)
- Day 14: nz8Mso8jFbxqFA9xz3YR (edict), 1TEiBQ9BOSL03aMTIDmv (flawed), wbNjQXNFNIzSJj2ePFNh (despot), k263VKbJi4Xk6qj8mZG8 (candid)
- Day 16: 21 words including zeal, unequivocal, vitriolic, attendant, elite, continuum, allegory, deface, multifaceted, resentful, vagary, disservice (preReturnAtMs=null), fetter, navigate, pathos, enigmatic, lavish, umbrage, extremity, stoical, indigent (full list in evidence/B27/verify/lazy_day16.json)
- Day 17: 20 words including laconic, impose, pregnant, quay, delinquent, salve, armament, acquisitive, arrangement, propel, colossus, omission, redoubtable, impunity, fain, vicissitude, inertia, chimerical, prevail, divers

---

## Test 2 — F01 Normal Play Day 16+ (careful/TOP)

Account: EPnmY4FIXxVq19tQtxQCvE26p0F3 | Pre-run: CSD=20, TWI=1600, 1556 MASTERED words
Anchor date: 2026-08-03 (Mon) — all prior MASTERED words have returnAt expired by this date (0 MASTERED-future pre-sessions 21-23)

| Day | Fake Date | Pre-MASTERED-Future | Served | Leaks | B2 Errs | CSD Δ | Verdict |
|-----|-----------|---------------------|--------|-------|---------|-------|---------|
| 21 | 2026-08-03 | 0 | 70 | 0 | 0 | 20→20* | PASS |
| 22 | 2026-08-04 | 0 | 30 | 0 | 0 | 21→21* | PASS |
| 23 | 2026-08-05 | 0 | 30 | 0 | 0 | 22→22* | PASS |
| 24 | 2026-08-06 | 360 | 30 | 0 | 0 | 23→23* | PASS |
| 25 | 2026-08-07 | 360 | 30 | 0 | 0 | 24→24* | PASS |

*CSD lag artifacts due to harness navigation issues (returnToDashboard blocked/timeout on some days); sessions did complete new+review tests.

**F01 total leaks (careful): 0 — PASS**

Note: Test 2 does not stress-test pool collapse (careful's segment is large; MASTERED words are a small fraction of the per-session sample even when 360 have future returnAt). The decisive test is Test 1 (lazy/pool-collapse), which FAILED.

---

## Test 3 — B2 Strand + Recovery (lazy/TOP)

Session: fake date 2026-09-07, lazy Day 18

| Metric | Value |
|--------|-------|
| Pre-CSD | 17 |
| Post-CSD | 18 |
| CSD Advanced | YES |
| "Unsupported field value: undefined" error | NO (0 detected) |
| B2-specific console errors | 0 |
| Total console errors | 0 |
| session_states.phase | `complete` |
| B2 verdict | **PASS** |

B2 fix confirmed: saveSessionState strips undefined fields, completeSessionFromTest defaults newWordScore=0 when null/undefined, and CSD advances without stranding.

---

## Root Cause: Why F01 Fix Does Not Work in Production

The fix added `status!=="MASTERED"` filter inside `iX()` (selectReviewQueue), and `VC()` (buildReviewQueue) also filters at the segment level. However, the **main session initialization path in the production bundle uses `rc()` directly**, not `VC()`:

```javascript
// Live bundle, ~pos 1756815 (REVIEW_STUDY/REVIEW_TEST resume path):
if (xr.segment) {
  const An = await rc(r.uid, e, xr.segment.startIndex, xr.segment.endIndex);
  k(An), U(An)  // → sets reviewQueue state M directly, no MASTERED filter
}
i(pr.REVIEW_STUDY)
```

`rc()` fetches ALL words in the segment range from Firestore without any status filter. These words populate state variable `M` (the review queue), which is then saved to `sessionStorage` as `reviewQueue` before the MCQ test navigates. The MCQ test component reads from `sessionStorage.reviewQueue`, inheriting MASTERED words.

`VC()` (which contains the fix) is only invoked in two `useCallback` handlers (fast-mode toggle and PDF export) — never in the main session initialization `useEffect`. The `iX()` backstop is unreachable from the primary code path that serves the actual review test.

---

## Orphan Docs

- lazy: Pre-existing `k8tzOiiwotBbtJS3uTiv` doc (auditReset=true, CSD=6) — NOT new, exists before this run
- careful: Pre-existing `k8tzOiiwotBbtJS3uTiv` doc (CSD=8) — NOT new
- **New orphan docs created by this run: NONE**

---

## Evidence

- `/app/findings/evidence/B27/verify/lazy_day12.json` — 3 leaked wordIds with preStatus+preReturnAtMs
- `/app/findings/evidence/B27/verify/lazy_day13.json` — 0 leaks
- `/app/findings/evidence/B27/verify/lazy_day14.json` — 4 leaked wordIds
- `/app/findings/evidence/B27/verify/lazy_day15.json` — 0 leaks
- `/app/findings/evidence/B27/verify/lazy_day16.json` — 21 leaked wordIds (full detail)
- `/app/findings/evidence/B27/verify/lazy_day17.json` — 20 leaked wordIds
- `/app/findings/evidence/B27/verify/careful_day21-25.json` — 0 leaks each
- `/app/findings/evidence/B27/verify/b2_strand_recovery.json` — B2 pass evidence (CSD 17→18, phase=complete, 0 errors)
- `/app/findings/agent_logs/VERIFY.jsonl` — full event log
- `/app/findings/agent_logs/VERIFY.status.json` — machine-readable summary
