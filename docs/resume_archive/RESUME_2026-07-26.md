# RESUME — current active work

> **Canonical resume pointer.** When the user says "resume," read this first. The FULL plan of record is
> **`docs/plans/MASTER_TASK_LIST.md`** (canonical) — see its **ACTIVE work items (A/B/C)** block. Living logs:
> `change_action_log.md`, `SUPPORT_RUNBOOK.md` (CS events). This RESUME is a thin pointer.
> **Rotate at each save-state:** copy → `docs/resume_archive/RESUME_<date>.md` (copy, don't move), then overwrite here.

---

## ▶ ACTIVE STREAM (rotated 2026-07-20 KST): CS work items — grader + token reset SHIPPED; review-pass gate BANKED

**READ FIRST:** `docs/plans/MASTER_TASK_LIST.md` → the "ACTIVE work items (A/B/C)" block (full detail per item).
(The D3.5 recovery+adversarial audit is DONE/CERTIFIED — that backdrop is in the `RESUME_2026-07-20.md` archive + `D3.5_FINDINGS.md`.
D4/P5 one-way migration is still the eventual next-big-thing, NOT active — needs its own fresh backup + rehearsal + Codex-GO'd plan.)

### Deployed state (as of 2026-07-20 KST)
- **client** `6094cdd` (Firebase hosting `vocaboost-879c2.web.app` + Netlify `vocaboostone.netlify.app` auto-build — TWO surfaces)
- **`submitChallenge`** `6094cdd` · **`gradeTypedTest`** `0992f5f` · **`completeSession`/`resolveListProgress`** `0ddbb34` (PINNED GO-HOLD — do not re-stamp)

### Shipped THIS session (both git-ground-truth-verified by WSL)
- **(B) Grader false-negative fix — DEPLOYED `0992f5f`** (WinClaude r63). Rule 1 scoped English-only + Korean-translation-is-a-meaning
  + CS examples; regression harness `scripts/grader-regression.mjs` (gate passed). **Verified vs 윤여진's REAL inputs (CS-2026-07-19e):**
  her failures were 67% English-definition rejections (NOT the Korean pattern) — replayed 25 canonical-def cases (WinClaude r64) →
  deployed grader ACCEPTS all 25 + Korean cases; both false-negative families cleared. Her rejections were 07-08 under an older prompt.
- **(C) Challenge-token reset MONTHLY→WEEKLY — DEPLOYED `6094cdd`** (WinClaude r65). Approach 1 read-time (David: "if it resets, no
  amnesty"): both readers count `challengedAt >= startOfKstWeekMs(now)`; boundary = **Monday 04:00 KST** (`WEEKLY_RESET_HOUR_KST=4`).
  No cron, no data write. 16/16 unit tests (`scripts/challenge-token-kst-test.mjs`). Codex-verified r38/r39.
  - **✅ CONFIRMED LIVE (04:05 KST 07-20):** `scripts/cs/verify-token-reset.mjs` ran at the boundary — token-week correctly rolled to
    2026-07-20 04:00 KST, **0 students still penalized**, 5 genuinely-stuck released to 5 (incl. 김호형/조형우). Token thread fully closed.

### BANKED — next up on David's go
- **(A) Review Pass Threshold (retake-until-pass, like the new-word test)** — plan `docs/plans/D3.5_WORKITEM_review_pass_threshold.md`,
  Codex-verified ×2 rounds (r36/r37). BUILD-READY, flag-gated + default-OFF (byte-identical until a teacher opts in). ~8-9 files,
  mostly mirroring the new-word passThreshold/retake machinery + 1 careful spot (server `review_retake_required` gate) + 4 reader-invariant
  sites (must gate on `passed===true`) + retake UX. **Awaiting David: 2 decisions** (throttle-day gate y/n; retake-surface N) **+ go-to-build.**

### Follow-ups (non-urgent, non-student-facing)
- 2 CS diag scripts still read the old `replenishAt` predicate: `scripts/cs/deepfix-f6-tokens.mjs`, `scripts/cs/scan-preemptive-fixes.mjs` — update to the week-window predicate later.
- Uncommitted on disk: this session's docs/coordination (baton loop r38/r39 + win r63-r65, plan docs, RESUME) + `scripts/cs/verify-token-reset.mjs`. The DEPLOYED code (`6094cdd`) is committed+pushed; the rest is docs/scripts (commit via WinClaude at will).

### Loop state
- Codex baton: r39 DONE (turnOwner=claude). WinClaude baton: r65 DONE/DEPLOYED (turnOwner=claude). Both idle/at-rest.

### David's STANDING instructions
- **26SM = real cohort — READ-ONLY, no writes without explicit authorization.** 25WT/25WTsynth = sandbox.
- **Deploy via WinClaude** (WSL has no push/firebase creds); **surgical `--only functions:<name>`** — never blanket (protect pinned `0ddbb34`).
  Focused `git add` (not `-A`; `.gitattributes = * text=auto` renorm hazard).
- **Never trust an agent (or your own tooling) blindly** — verify every claim vs code/live Firestore. Keep Codex (+ WinClaude) in the loop; "check with codex" on work items.
- Rotate RESUME at each save-state; log code→`change_action_log`, CS/data→`SUPPORT_RUNBOOK`.

Prior streams: `docs/resume_archive/RESUME_2026-07-20.md` (D3.5 audit-complete snapshot), `RESUME_2026-07-19.md`, earlier in `docs/resume_archive/`.
