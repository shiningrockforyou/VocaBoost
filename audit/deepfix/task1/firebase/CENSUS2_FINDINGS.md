# Census v2 findings — deep per-student pass (F-2/F-3/F-4/F-9/F-11) — READ-ONLY, 2026-07-13

`scripts/cs/deepfix-census2.mjs`. Cohort: 817 students / 774 started. Exports: scan_F2/F3/F4/F9/F11.json.

## F-2 · #13 test-size — REAL SCALE PINNED: 18 undersized tests / 17 students (5 on day-1)
Heuristic corrected (naive census: 257): each 'new' attempt pinned to the class it was TAKEN under
(attempt.classId), retakes excluded (kept as separate bucket), list-end remainders excluded, only q < 0.6×expected.
Buckets: q10→30 ×4 (2 day-1), q13→30 ×5 (1 day-1), q14→30, q12→30 ×2, q8→25, q13→25, q20→35, q10→35 day-1, etc.
- **17 distinct students, 5 day-1** (the 이혜성 first-day pattern), 13 mid-list (dup/re-serve or pool-collapse).
- No class has testSizeNew < 25 (dist {25 ×12, 30 ×69, 35 ×15}) → small-q is genuinely undersized, not attribution noise.
- **#13 is REAL but SMALL (~18) — not epidemic.** Feeds I-3 (pin the generation path on these exemplars).

## F-3 · dual-enroll — LIVE #12 count H1-REFINED
141 dual-enroll student-lists (98 distinct students; some dual on 2 lists). Anchor = student+list max passed-new nwei.
The raw "104 stranded" (any doc behind anchor) OVER-COUNTS inactive 2nd-enrollments. Split by the ACTIVE doc
(most-recent-activity doc):
- **LIVE-STRAND: 36** — the student's ACTIVELY-STUDIED doc is ≥1 day behind their own cross-class anchor →
  they are re-doing words RIGHT NOW = genuine live #6/#12. (e.g. a student active in Final B at twi200 with a
  1520 anchor in Adv B1.)
- **divergent: 6** — both docs active at different positions (cross-pace, e.g. Bridge pace-60 twi1140 vs Inter
  pace-80 twi1200, both active 07-10/07-13).
- **stale-2nd-enroll: 72** — a 2nd doc behind the anchor but the student is active in the ANCHOR doc → HARMLESS
  now (reconciles up via non-demoting max if they ever switch; latent, not live).
- benign-equal: 22, benign-finished: 5.
- **⇒ TRUE live carry-problem population ≈ 42 (36 LIVE-STRAND + 6 divergent), + 72 latent** — vs the 3 CS-known
  cases. This is the quantified live CR-1/#6/#12 substrate. It RECURS after CS drops (이주헌 OCzwBwAb re-split).
- **Note:** pinning the #12 MECHANISM still needs the I-1 instrumented repro (data shows prevalence, not cause).

## F-4 · H/P/B partition (the acceptance baseline) — of 774 started
- **H (healthy) = 541** (~70%): no active signature, not hand-patched.
- **P (hand-patched) = 45** distinct students (v1's "82" = 82 flagged rows across these 45 students on multiple
  docs). **P_holding = 21, P_failed = 24** (also at the #11 wall now → the patch didn't hold).
- **B (broken, active signature) = 188** (~24%): at the #11 wall (finished-list review-only freeze) OR LIVE-STRAND
  OR undersized-test. (v1's 106 rose to 188 once the #11-wall population — correctly — counts as broken, not healthy.)
- **⇒ ~30% of started students are currently broken (B) or hand-patched (P).** Task-2 acceptance metric = move
  B→H and make P unnecessary. Re-run before/after any fix ships (X5). H1 caveat: B counts the #11-wall students
  who unfreeze on DEPLOY (fix built) — so a chunk of B is "fixed-in-tree, pending deploy," not needing new code.

## F-9 · deploy-state — PROD POSTURE PINNED
Recent 21d (15633 attempts): correctnessSource {null 11990 (77%), undefined 3481, server-ai 162};
writtenBy {cloud-function 14970 (96%), (none) 663}.
- **null correctnessSource dominant ⇒ `GRADE_TOKEN_ENFORCED = false` live** (per CS-2026-06-29A: gate-off writes
  null). Confirms the **G1 landmine**: HEAD has it `true` (functions/index.js:58) vs prod `false` → deploying
  functions/index.js re-arms the 06-29 outage.
- **cloud-function writtenBy dominant ⇒ `SERVER_ATTEMPT_WRITE = true` live** (server-authoritative attempt writes
  are on). Legacy client writes (663) are the tail.
- **Prod = {GRADE_TOKEN_ENFORCED:false, SERVER_ATTEMPT_WRITE:true, LIST_SCOPED_RECON:true (853 csd_twi_reconciled
  logs)}.** This is the deploy-state truth Task-2 sequencing needs (F-9 gate).

## F-11 · twi > mastery — C-05 is REAL but RARE (4)
4 student-lists where twi > count(study_states on list) by >5: MolfYHnf (+100), TGJNuQ1v=이가온 (+97, PATCHED),
IRcn5Ksb=최도훈 (+80, PATCHED), hLSeh3q7 (+60). **2 of 4 are documented manual advances** (credited words the
student never studied); 2 are cross-pace organic over-credits (조준모 pattern). **Resolves the census-tension:**
C-05 over-credit is real but rare (4), mostly explained by known patches/cross-pace — NOT a widespread corruption.
