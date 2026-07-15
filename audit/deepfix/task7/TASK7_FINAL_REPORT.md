# DEEPFIX — Final Report (Task 7)

**Date:** 2026-07-14 · **Program:** the 7-task deep root-cause audit → fix → validate of VocaBoost, governed by
`audit/deepfix/MASTER_TASK_PLAN.md`. This report ties it together and states exactly what remains for David.

---

## 1. Executive summary

The deepfix program **rebuilt the progress/reconciliation foundation** of VocaBoost to fix a cluster of live
student-facing failures (the #11 list-end freeze, class-change progress resets, anchor/progress forgery surfaces,
the permafail dead-end, the manual-advance treadmill) — and to replace symptom-patching with a
**server-authoritative, student-owned-progress** model plus David's list-continuation/cycling/override features.

**Status:**
- **Implementation (P0–P10 + P7): COMPLETE and SIGNED OFF.** Every phase is Codex-converged, and the whole
  surface passed a **2-Fable + Codex defense-in-depth final review** (all ~13 findings folded + re-verified).
- **Everything is LOCAL, uncommitted, and DORMANT behind flags** — **day-one deploy behavior is unchanged**
  (all reviewers re-confirmed flag-off byte-equivalence). Nothing has touched live students via code.
- **Audit harness (Task 5): COMPLETE** — 6 matrices + cert consolidator, validated here; the emulator run-path
  is confirmed viable on Codex's env.
- **Remaining: 2 things** — (a) **Codex RUNS the Playwright/emulator audit** (Task 6, the acceptance gate, on
  David's Windows env), and (b) **David deploys** the staged cutover per `DEPLOY_ORDER.md`.

---

## 2. The 7 tasks

| Task | What | Outcome |
|---|---|---|
| **1 · Investigation** | root-cause (code + live-Firebase empirical) | 38 issues → 7 root causes (CR-1..7); live 26SM census (F-3 dual-enroll/strand, F-4 H/P/B, F-9 prod deploy-state); CS manual-write catalog |
| **2 · FIX_PLAN** | the plan (11 phases P0–P10) | Codex-converged (`audit/deepfix/task2/FIX_PLAN.md`) |
| **3 · Implementation** | build the fix | **COMPLETE + SIGNED OFF** — see §3 |
| **4 · Audit design** | `AUDIT_DESIGN.md` (83 scenarios, 6 matrices) | done |
| **5 · Harness build** | the runnable audit | **COMPLETE** — 6 matrices + cert, validated |
| **6 · Audit run** | Codex runs it before deploy | **PENDING** (David's env — the acceptance gate) |
| **7 · This report** | | done |

---

## 3. What was implemented (P0–P10 + P7) — all Codex-converged, dormant behind flags

- **P0** grade-token disarm (aligned HEAD to prod). **P1 (RO)** the #11 review-only-completion fix (unfreezes
  the ~169 list-end students). **P2 (RS)** read/render truth surfaces (server-side gradebook filter, testId-less
  rows, assignedLists, C-23). **P3 (FND-1)** the server surface (`completeSession`/`resolveListProgress`/
  `resetProgress`/`advanceForChallenge`/`markReviewComplete`/M4 anchor-validation). **P4 (FND-2)** the client
  cutover (server-authoritative writes, nonce fixes, build stamp). **P5 (FND-3)** the one-time
  class_progress→list_progress data migration (`--dry`-only in-repo). **P6 (FND-4)** the rules cutoff
  (attempts/progress client-write lockdown, role split). **P8 (CONT-A)** list continuation + choice terminal.
  **P9 (CYC)** per-student cycling ("start over", monotonic virtual index, lap-aware M4). **P10 (OVR)** teacher
  override + reviewChallenge→server + the read-surface widening (teacherIds denorm) + custom-claim role model +
  rules narrowing. **P7 (FND-5)** the retirement inventory + apply-clean patch (prepared, applied post-deploy).

**The final review earned its keep** — it caught real issues that survived the per-phase loop, most importantly
that **the FIX_PLAN's "this cutoff closes the forgery surfaces" claim was overstated as coded**: the M4
anchor-enforcement was never wired, `completeSession` advanced without test evidence, and post-P5 `reset` didn't
zero the canonical doc. **Those are now genuinely closed**, plus a deploy-order composition blocker (one rules
file couldn't be stage-deployed) — see `FINAL_REVIEW_FINDINGS.md` (all 13, verdicts, verification).

---

## 4. What David needs to do

### 4.1 Run the audit (Task 6 — the acceptance gate, on the Windows env)
Per `audit/deepfix/task5/CODEX_RUNBOOK.md` (Codex-confirmed): run all 6 matrices to ALL-CLEAN under one `runId`,
then `lsr_deepfix_cert.mjs <runId>` must say **CERTIFIED**. Browser matrices (M-UI/M-WB) hit localhost + the
**25WT sandbox**; M-CALL/M-RULES hit the **Firebase emulator** (flag-on via the disposable `lsr_deepfix_flag_on.mjs`
`--exec` wrapper, guaranteed-restore); M-STATIC/M-MIG-`--dry` run anywhere. **NEVER 26SM.** Some legs are
DEFERRED by design (secret-backed `gradeTypedTest`/grading-job suite; the migration `--commit`/catch-up/RET-3;
the deployed `exports.version`/hosting-stamp DG-2/DG-3) — the cert surfaces them as a documented ledger, not PASS.

### 4.2 Deploy — the staged cutover (`DEPLOY_ORDER.md`)
One global ordered sequence; the load-bearing rule: **a P6 rules deploy must NOT include P10d.** Rules deploy as
three stage artifacts: **R1 `firestore.p6.rules`** (cutoff) → **R2 `firestore.p10c.rules`** (+ teacherIds read) →
**R3 `firestore.rules`** (P10d claim/narrowing, AFTER claim-backfill + token-refresh). Each phase's hard
preconditions (P3 soak → P4 flags → P5 migration → P6 rules → P9/P10 → P7 ≥14d) are composed there. **The whole
deepfix stack is UNCOMMITTED working-tree state** — David commits it deliberately; **a `git checkout` on any
touched file destroys the dormant drafts.**

### 4.3 Carry-forward items surfaced by the review/harness (not blockers, tracked)
1. **CS toolchain retarget (MIG-10 / F6-3) — NOT implemented:** `data-integrity-sweep.mjs` + census still read
   `class_progress`; post-P5 they'd false-CLEAN off the dead collection. **Fold before P5-deploy.**
2. **Pre-existing DSF `dayGuardRejected` false-success** (`DailySessionFlow.jsx:1529`, live under
   `LIST_SCOPED_RECON`): a rare stale/duplicate completion falsely succeeds. Out of deepfix byte-equiv scope →
   a dedicated small fix.
3. **F-9 challenge-token ledger** owner-forgeable until P7 retires the legacy client `submitChallenge` (then add
   `challenges` to the owner-update exclusion) — noted in `P7_RETIREMENT_INVENTORY.md`.
4. **F-11 enrolledClasses trust** (self-enroll to write attempts / unlock cycling) — largely pre-existing; a
   long-term server-owned-enrollment item.

---

## 5. CS / ops side-work done this program (live 26SM, David-authorized)
- **LAP2 lists:** created `(LAP2) Ascent` + `(LAP2) Summit` and assigned them to the 14 Adv/Final/Top classes —
  the non-destructive "start over" for #11 finishers (CS-2026-07-13g). Backed up + verified.
- **Pre-emptive-fix scan** (read-only): 4 reset candidates (finished Ascent+Summit), 38 finished-with-next-list,
  ~4 genuine cross-class strand, 0 invalid-anchor, 0 permafail (`PREEMPTIVE_FIXES_2026-07-13.md`). **Parked:**
  repointing the 4 finishers' focus to `(LAP2) Ascent`.

---

## 6. Honest caveats
- The implementation is **reviewed** (Codex per-phase + 2-Fable+Codex whole-surface) but **the Playwright/emulator
  RUN (Task 6) is the final acceptance gate and has not been executed** — it needs David's Windows env. The
  harness is built + self-validated; the run certifies the *behavior*.
- **Nothing is deployed; nothing has touched live students via code.** The only live changes are the read-only
  scans and the additive LAP2 lists/assignments.
- Day-one safety rests on **flag-off byte-equivalence**, re-verified by all reviewers; the new behavior activates
  only at the staged flag flips per `DEPLOY_ORDER.md`.

---

## 7. Key artifacts (map)
`FIX_PLAN.md` (the plan) · `adjudication_log.md` (every phase + review round, H1-verified) ·
`FINAL_REVIEW_FINDINGS.md` (the 13 final-review findings) · `DEPLOY_ORDER.md` + `firestore.p6/p10c.rules` (the
staged cutover) · `P7_RETIREMENT_INVENTORY.md` + `phase7_retirement.patch` (post-deploy cleanup) ·
`AUDIT_DESIGN.md` + `audit/playwright/lsr_deepfix_*.mjs` (the runnable audit) · `CODEX_RUNBOOK.md` (how to run it) ·
the phase `*_impl_notes.md` + `final_fold_*.patch` (per-change detail).
