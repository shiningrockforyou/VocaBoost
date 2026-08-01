# SESSION STATE BRIEF — 2026-07-26 (session 4817fc5a, saved for --rm restart)

> **Purpose:** make the next session 100% aware of this session's context. Read THIS fully first — it carries
> everything actionable. The raw transcript (`transcript/4817fc5a-….jsonl`, 24MB) is for TARGETED lookup only
> (grep for a topic; never ingest wholesale). `memory/` is a backup of the persistent memory dir (restore to
> `/home/ubuntu/.claude/projects/-app/memory/` if the container wiped it — CHECK FIRST, don't blind-overwrite).
> `scratchpad/` holds the review-pool simulators (`review-pool-sim.mjs`, `sim2.mjs`, `sim3.mjs`) + older evidence.

## 1. Orientation (60 seconds)

VocaBoost (React 19 + Vite + Firebase; repo `/app`) — David's vocab app; live cohort **26SM ≈ 824 real students
(READ-ONLY, no writes without explicit authorization; 25WT = sandbox)**. Deploys via **WinClaude** (WSL has no
push/firebase creds). External reviewer **Codex** coordinates via `docs/plans/loop/baton.json` (currently:
round 43 ANSWERED, turnOwner=claude). This session designed **DEEPFIX 2** — the consolidated forward program
(deepfix remainder + unified session container + free-nav mode + status messaging) — and ran it through THREE
convergence rounds. **Nothing shipped; no student-visible change occurred this session. All design/planning.**

## 2. Deployed/live state (UNCHANGED this session)

- client `6094cdd` (Firebase hosting + Netlify vocaboostone.netlify.app)
- `submitChallenge` `6094cdd` · `gradeTypedTest` `0992f5f` · **`completeSession`/`resolveListProgress` pinned `0ddbb34`**
  (certified core; GO-HOLD; any move = David-authorized clean-tree pin-move w/ re-cert, NEVER surgical for foundation.js)
- M4 shadow clock running (ends ~2026-08-01). Review-score throttle STILL LIVE (David decided to remove it — not yet built).

## 3. What this session produced (all on disk, all logged in change_action_log.md)

| Artifact | State |
|---|---|
| `docs/design/UNIFIED_SESSION_STATE_MAP.md` | THE full session-system map, **3×-Fable-audited ground truth** (§16 audit log). Where docs disagree, MAP wins. |
| `docs/design/unified-session-state-wireframe.html` | Visual wireframe, post-audit; artifact URL https://claude.ai/code/artifact/27e74007-fec0-423c-bcf9-bca86e4fdb4c (favicon 🧭) |
| `docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md` | §1-§9 container convergence · §10 mode seam · §11 surface map+gates · §12 ship/UX/messaging (+row 16; §12.1 has a SUPERSESSION banner → deepfix2) |
| `docs/design/FREE_NAVIGATION_MODEL.md` | Layered-doc banner + CONSISTENCY section + **pass-to-advance CLOSED YES (2026-07-25)** |
| **`docs/plans/deepfix2/`** | **THE PLAN OF RECORD**: 00_ORIENTATION, 01_SOURCES, **02_TASK_LIST v3** (v2 in `_archive/`). Waves 0-6, DF2-IDs, §3 full reconciliation, §4 decisions register (w/ D-1..D-4 block), §6/§7 convergence records |
| Convergence | R1 (Codex r41 UNSOUND→folded) · R2 (Codex r42 SOUND-WITH-GAPS + 5 internal → folded as v3) · **R3 = Codex r43 ANSWERED but only PARTIALLY folded — see §5** |
| `docs/plans/loop/` | handoffs r41/r42/r43 + codex_reviews r41/r42/**r43** + baton (r43 done, revision 159) |

## 4. David's decisions THIS session (binding)

1. **Pass-to-advance = YES** (both modes; frontier advances only on a passed segment test).
2. **D-1: REMOVE the review-score throttle entirely** (redundant under the review-pass gate). Kills reviewMode/
   interventionLevel machinery, dissolves register items 2+6, messaging rows 1-2, the 30%/50% copy; rides the Wave-1
   core pin-move; ~27 currently-held students get released at ship (CS comms needed); review-test-size needs a new rule.
3. **D-2: graduation only on a PASSED review test; failed review graduates ZERO.** Within-pass rule OPEN — see §6.
4. **D-3: ALL attempts recorded, pass or fail, MCQ+typed, new+review** → program invariant. BUT windows exist (§6).
5. **D-4: gate-OFF = nothing retroactive** (uniform `passed===true` evidence reader; retake-to-advance). Closes r43-H2's
   amnesty question (the kill-switch MECHANICS part of H2 still needs spec).
6. **DECIDE-0 (ship model) still OPEN** — incremental-line (recommended) vs strict single-train; blocks only Wave-3 exposure.
7. **"Stop asking me if I want to commit plans to git"** — saved to memory (`no-git-commit-nagging.md`). NEVER raise it.

## 5. Codex r43 (read in full: `docs/plans/loop/codex_reviews/codex_deepfix2_r43.md`) — PARTIALLY folded

Verdict: **plan-of-record ACCEPTED; Wave-0 partial GO; Wave-1 needs fixes.** Its authorization matrix is the
operative per-task ruling. **Folded already:** nothing (it arrived, was reported to David, then D-1..D-4 superseded
parts). **STILL TO FOLD into deepfix2 v3 (→v4):**
- **B1 BLOCKER**: `markReviewComplete` (index.js:617-653 → foundation writeUpgradedReviewMarker :1076-1102) lets an
  authenticated student mint a `passed:true` marker after failing a real review → bypasses the review gate. Fix:
  retire the public route (preferred; completeSession writes the marker internally after server-proving no-score) or
  server-side re-derivation + rejection. Required tests listed in the review.
- **H3**: DF2-07(b)'s claimed "entry-returned `reviewOnlyReasons` client already reads (studyService:1783)" is **FALSE
  — my error**: :1783 is a boolean (`reviewOnlyReasonConfirmed`); the object is server-local (foundation:1390-1398),
  returned only on `completed` (:1677-1683), stripped on `review_recorded` (:1584-1590). Fix: client-local derived
  `reviewOnlyReason` discriminant in initializeDailySession config. (NOTE: D-1 throttle removal SIMPLIFIES this —
  remaining reasons = list_complete | review_resume | no-score.)
- **H4**: DF2-10 vs DF2-31 response-schema mismatch — define the exact completeSession response fields once.
- **H2 residue**: kill-switch mechanics (name, storage, precedence, flip-without-deploy?, version exposure, fail-closed).
- **M5**: HelpModal.jsx:212 hardcodes "95%" too; live result cards ALREADY derive (MCQTest:1201/TypedTest:1461) — fix DF2-07(a) cites.
- **M6**: replace the "only remaining decisions" footer with the task-scoped authorization matrix.
- **M7**: R8 success-stamp proof contract. **M8**: DF2-35 needs an authoritative data contract. **L9**: orientation status language.

## 6. THE LAST EXCHANGE (in chat only — NOT yet in any doc; fold on resume)

**(a) Review-pool projections** (sim scripts in `scratchpad/`; exact mechanics: graduation = floor(segSize×score)
random from segment-minus-test-failed, MASTERED = 21-day parole → NEEDS_CHECK returns FOREVER — no permanent exit;
daily review = pool/5 fifth capped 60 studied / 30 tested). Steady-state ACTIVE pool, 600-word list, pace 20:
| avg | (a) tested-correct | (b) all-tested | (c) today | (a60) correct, test-60 |
| 50% | 390 | 180 | 252 | 250 | · 70% | 306 | 180 | 205 | 200 | · 90% | 222 | 180 | 174 | 167 | · 100% | 180 | 180 | 160 | 160 |
Insights: (c)'s purpose = pool control via unproven graduation (David's memory correct); (a) swells >300 at ≤70% avg →
60-cap binds → tail starvation; (b) graduates wrong answers (rejected); **(a60)/adaptive = recommendation**:
tested-correct only + adaptive test size (30 normal → up to 60 while pool oversized). **David has NOT yet picked**
(a) vs (a)+adaptive vs keep (c). This resolves D-2's open clause.

**(b) STARVATION DISCOVERY (real, verified by tracer `sim3.mjs`):** the daily-fifth rotation is unfair under churn —
words settle into stable "shadow orbits" dodging every slice (traced word: index 30 vs slices starting 36, weekly,
72+ study-days unseen). Live code slices identically (`computeUnmasteredSegmentIds`) → likely live in production.
**BlindSpots (just hidden, §11.1) was the accidental safety net** for exactly these words. Real fix = the G-DUE
scheduler (DF2-42). Proposed + not yet done: (i) read-only live probe counting orbit-starved words on 26SM,
(ii) a fixture, (iii) note on the BlindSpot-hide card. David was OFFERED the probe — no answer yet.

**(c) Attempt-write windows (D-3 verification — David's memory CORRECT):** historical loss class = pre-06-22
client writes ("graded but the write never reached Firestore" — the SERVER_ATTEMPT_WRITE flag's own comment).
TODAY's residual windows: (i) grade OK → client's submitVocabAttempt call fails → student abandons → attempt never
written (grade cached server-side, recovers only if they return); (ii) grader outage mid-take → nothing written
(조은서-class); (iii) crash + "Start Fresh" discards. **Fix mostly built**: gradeTypedTest's writeContext direct-write
path exists (index.js:~1160-1178, writeAttemptTxn in the grading call) — client doesn't use it yet ("legs ship at
P4"). Plan addition needed: flip typed to direct-write + make MCQ grade+save one durable call = the D-3 implementation.

## 7. Work queue on resume (in order)

1. **Fold §5 + §6 into deepfix2** (v3→v4): B1 spec, H3 corrected contract (simplified by D-1), H4 schema, H2 mechanics,
   M5/M6/M7/M8/L9, the D-1 throttle-removal ripple through DF2-10 and messaging, D-2 resolution (once David picks),
   D-3 window-closure tasks, starvation probe/fixture/BlindSpot-note items. Update MASTER_TASK_TRACKER with DF2-IDs used.
2. **Per r43's authorization matrix, these can START without David**: DF2-0H, DF2-03, DF2-42d, DF2-47/43-spec authoring,
   DF2-04 prep, DF2-05 (own gates), DF2-01 (own gate), DF2-02a minus dead-lever branch.
3. **Bounded re-review** (r43 said no more teardowns): after the v4 fold, a SMALL panel verifying the fold + Codex r44.
4. If David answers the probe offer: run the read-only starvation probe on 26SM (diagnosis only).

## 8. Awaiting DAVID (ask only when relevant; never nag)

- **D-2 within-pass graduation rule**: (a) strict / **(a)+adaptive test size [recommended]** / keep (c). [projections in §6a]
- **DECIDE-0** ship model (blocks Wave-3 exposure only). Recommended (a) incremental.
- Dead levers wire-or-remove (rec: remove) · grader round-2 go + verbatim-intent · starvation-probe go ·
  later-wave items (pilot class, PMv2 rail, pacing metric, re-test semantics, hub UX).
- ~~throttle-day gate~~ DISSOLVED by D-1. ~~float fate~~ DISSOLVED by D-1. ~~gate-off amnesty~~ CLOSED by D-4.

## 9. Standing constraints + preferences (memory dir has more)

26SM read-only · WinClaude deploys, commit on main never branch, never `git add -A` · pinned core discipline (§2 above) ·
rules never bare-deployed, P10d draft is a trap, R3-last · one-way-door ceremony (backup + 25WT rehearsal + census +
David auth) · byte-identity falsifier + named per-wave deltas · convergence roster: 3 Fable + 2 Opus + Codex, WSL
synthesizes · **NEVER suggest committing plan docs** · logs: code→change_action_log.md, CS→SUPPORT_RUNBOOK.md ·
David's replies are terse — answer precisely, flag ambiguity, give recommendations with numbers.

## 10. Transcript lookup tips (24MB jsonl — grep, don't read)

Topics → grep patterns: pool projections `review-pool-sim|steady-state|graduat`; starvation `shadow orbit|starv|lastSeen`;
attempt windows `writeContext|never reached Firestore|pendingSaveRef`; r43 `markReviewComplete|B1|automarker`;
D-1..D-4 `remove throttling|graduated only on a passing|Am I answering the right question`; convergence verdicts
`SOUND-WITH-GAPS|UNSOUND|GO-WITH-CONDITIONS`; the 6 audit reports `FABLE-A|Fable-B|Fable-C|Opus-A|Opus-B|OPUS-B`.
