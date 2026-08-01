# WINCLAUDE round 67 — DEEPFIX2 program briefing — ✅ ACK (read → ack → standby)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`. **taskId:** `DEEPFIX2_BRIEFING` · **execDecision:** `ACK`. Briefing round — no runs, no deploys, no edits (only this review + baton flip + read-only env diagnostics).

---

## 1. Briefing acknowledged
Read the handoff + `02_TASK_LIST.md` (v5) and the ledger pointer `11_…FOLD_PLAN.md` §1 (R2-1..R2-38 govern). I understand:

- **The program:** ONE universal day-structured model for every class — review gate ON at 92%, teacher-set 60/30 rotation queue, four server-written `review*` labels driving priority/graduation, full-history label backfill.
- **THE LAUNCH (DF2-14):** dark-deploy everything `enabled:false` → verify → backfill → **ONE audited cohort-wide flip of `system_config/review_v2.enabled`** (David executes the flip) → 7-study-day monitored soak; kill switch = the same flag.
- **Five-stage gate discipline — nothing deploys until all pass:** (1) implementation auth → (2) dark build (all surfaces `enabled:false`) → (3) post-build 25WT product rehearsal → (4) David's backfill go → (5) David's activation go.
- **My run list (in order):** emulator rules matrix for `firestore.review_v2.rules` (Java runtime) → dark-train deploys (functions + hosting + rules + indexes, all `enabled:false`) + deploy-set verification reads → 25WT product-rehearsal Playwright matrices (dual-class oracle incl. R2-38 mixed-posture, wall/retake loops, force-pass live-dissolve, recovery/expiry, old-bundle + streak fixtures) → session-save commits/pushes at milestones.
- **NOT mine:** Track A/B admin-SDK scripts (WSL, service account), the fireadmin config write, and the flip (David personally).
- **Invariants I'll hold:** 26SM read-only · 25WT sandbox · deploys via me 🔵 on David/WSL authorization · commit on `main`, never branch · targeted `git add` only (renorm hazard) · **the certified core (`completeSession`/`resolveListProgress`, `foundation.js`) stays pinned `0ddbb34`** until the authorized pin-move *inside* DF2-14's dark train, with behavioral re-cert on the new pin · deploy-set derived by call-graph reachability per-change, never copied · rollback = full-set redeploy of the rollback pin, never surgical.

## 2. Runtime versions + env-drift (surfaced now, per request)
| tool | version | note |
|---|---|---|
| **node** | v24.11.1 | unchanged all session |
| **firebase-tools** | 14.27.0 | deploy env ready |
| **Java** | OpenJDK **21.0.9** LTS (Temurin) | ✅ present — the **emulator rules matrix** (Java runtime) can run at stage 2 |
| **Playwright** | 1.58.2 | drove all R49–R60 live-UI runs successfully (~last used R60); browsers installed & functional then |
| **npm** | 11.6.2 | — |

**No drift or breakage since round 66.** All four tools the program needs (node / firebase-tools / Java / Playwright) are present and current. One stage-2 pre-flight I'd suggest before the rehearsal matrices: a quick `npx playwright install --with-deps chromium` verify (confirms the browser binaries are still resolvable after the gap) — cheap, and better to catch now than at stage 3. No blockers.

## 3. Git / deploy-pin state — confirmed unchanged
- **git:** branch `main`, HEAD **`9819336`** (my R66 session-save), **== `origin/main`** (ahead/behind `0 0` after fetch). **No uncommitted `src/` or `functions/` changes.**
- **Deploy pins (match `02_TASK_LIST.md` §0 exactly):**
  - `completeSession` / `resolveListProgress` (foundation.js core) — **`0ddbb34`** (pinned, untouched) ✅
  - `gradeTypedTest` — **`0992f5f`** (r63) · `submitChallenge` — **`6094cdd`** (r65) — the two authorized surgical moves
  - client: Netlify `vocaboostone.netlify.app` @ `9819336` · Firebase hosting `vocaboost-879c2.web.app` @ `6094cdd` (the R66 hosting-parity gap on help pages still stands — David's call)

## Standby
Ready for stage 1 (implementation auth) → the emulator rules matrix as the first run. Holding until the baton dispatches it.

## Hand back
`baton.json` → `turnOwner=claude round=67 taskId=DEEPFIX2_BRIEFING execStatus=review-written execDecision=ACK updatedBy=winclaude revision=134`. Watcher re-armed at baseline 134.
