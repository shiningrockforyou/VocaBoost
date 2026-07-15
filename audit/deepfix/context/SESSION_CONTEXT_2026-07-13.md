# Session context digest — state as of 2026-07-13 (end of session)

> Primary context file for deepfix agents. Distills the 2026-07-12→13 session (full transcript:
> `transcripts/session_2026-07-12_to_13_full.jsonl`, 47MB — search it, don't read it whole).
> Cross-check everything here against the referenced files; this digest is a map, not the authority.

## 1. The structural problem (validated live)
The app models a student as advancing linearly through ONE list, one new-words day at a time, forever. It
breaks at the two boundary conditions real students hit at scale (~6 weeks into the 26SM cohort):

**Flaw A — the Day-2+ completion gate can't handle a day with zero new words (NEED_TO_FIX #11).**
`completeSessionFromTest` (src/services/studyService.js) blocks day-completion unless a new-word test was
passed. It conflates "failed/skipped the new-word test" (should block) with "NO new-word test existed" — a
legitimately review-only day (should complete on review). `newWordCount = min(round(pace×(1−interv)),
wordsRemaining) ≤ 0` in TWO cases: **list-end** (finished all words; the dominant case — scans found
**≈169–172 students** at this wall depending on scan time/metric (169 first scan; 170 re-scan; 172 total
finishers in the by-class report), all list-end) and **throttle** (3 consecutive low reviews →
interventionLevel=1.0 → 0 new words MID-list; case: 김준서). Result: review submits are refused ("Day not complete — pass the
new-word test first"), csd frozen, permanent stuck.

**Flaw B — cross-class carry on a shared list is inconsistent.** Reconciliation is student+list scoped
(`getMostRecentPassedNewTest`, src/services/db.js:3250) and SHOULD carry progress on class promotion
(INT→ADV→FINAL share the same physical lists). Verified working for most (홍승연, 손지성, 6 Final-movers,
Sarah Sung) but: (i) **#12 carry-miss** — intermittently strands promoted students at Day 1 (안이연, Lucy Son,
유혜준; Lucy's ADV[한] reconciled on 7/09-13 yet applied her native position, not her Inter[한] anchor nwei=879
— cause NOT pinned; ruled out missing index (#13 composite exists) and anchor-query errors (0
csd_anchor_query_error cohort-wide)); (ii) **csd UNDERCOUNT** — cross-class review-pairing fails → csd =
anchorDay−1 → phantom "day complete" loop, can't advance (Kaila Chung).

## 2. The Phase-1 fix — BUILT, code-CONVERGED, NOT deployed, NOT acceptance-tested
- LOCAL-ONLY on `main`, **uncommitted** (diff: `phase1_current_uncommitted_fix.diff`, 232 lines, 3 files).
- `studyService.js` completeSessionFromTest: `reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
  && cfgNewWordCount<=0 && (allocation.newWords<=0 || isListComplete===true || startPhase===REVIEW_STUDY)`
  (confirmed-reason predicate, ROI-1); `wordsIntroduced` clamped 0 (no TWI decrement); gate skip `!reviewOnlyDay &&`;
  literal-null session-state keyed on ATTEMPT-ABSENCE (not reviewOnlyDay — a Fix-#9 resume keeps its real score).
- `DailySessionFlow.jsx`: §5 "🎉 You finished the list!" terminal in CompletePhase (isListComplete); empty-review
  NON-recording terminal at the fresh branch (:824-830 — no completeSession/recordSessionCompletion, ROI2-1).
- `Dashboard.jsx`: persistent finished-hero (`listFinished = listTotal>0 && wordsLeft===0`).
- Review history: 3-agent audit + Codex REVIEWONLY_IMPL r1 NEEDS_FIXES(ROI-1) → r2 NEEDS_FIXES(ROI2-1) → **r3 GO
  (0/0/0/0)**. Design doc: `docs/plans/PLAN_review_only_day_completion.md` (also converged; §11 tracks deferred:
  B2 observability log, newWordsTestPassed-derivation preexisting bug, W3 hard sequencing dependency in §4).
- **Codex's Windows `npm run build` SUCCEEDED with these changes** (prep report) — they compile in a real build.
- **Deploy posture (David, 2026-07-13, verbatim): "Hmm, never mind. we'll just fix as requests come in."**
  Deploy is deliberately DEFERRED despite ≈169 students at the wall; interim = reactive CS via `scripts/cs/*`;
  the deepfix program is the intended durable resolution. Do NOT re-litigate deploy urgency without new facts.

## 3. Playwright acceptance audit — design CONVERGED, harness BUILT, NOT RUN
- Design: `docs/plans/PLAN_reviewonly_playwright_audit.md` v2 (Codex REVIEWONLY_AUDIT_DESIGN r2 GO 0/0/0/0;
  RAD-3 conceded to code evidence — clean no-attempt list-end seeding is safe + pre-verifier mandatory).
  HYBRID: E2E RA1-RA9 + white-box W-RA3/W-RA4/W-RA4b (the stale-0 gate is NOT reachable via UI routing).
- Harness files (built by fork agent, syntax-clean, NEVER executed): `audit/playwright/lsr_reviewonly.mjs`,
  `lsr_reviewonly_fb.mjs`, `lsr_reviewonly_whitebox.mjs`, `REVIEWONLY_HARNESS.md`; `lsr_ui.mjs` modified
  (BASE env-configurable, default `http://localhost:5173`, import-time fail-closed localhost guard).
  Build-manifest caveats to verify on first run: A1 words-collection path, A2 WORD_STATUS.MASTERED string,
  A3 seedFix9Anchor→REVIEW_STUDY, white-box injection timing, LSR_TEACHER default, dangling TIER_SIZE imports.
- **Environment truth:** THIS WSL env CANNOT run Playwright/Vite (`/app` = 9p Windows mount; node_modules =
  win32 binaries; Linux reinstall blocked). Admin/Firestore CS scripts DO run from WSL
  (`NODE_PATH=/app/node_modules node scripts/cs/...`).
- **Codex prep verdict (codex_review_audit_prep_001.md): NOT_READY** — Node/deps/build/Vite-serve/Chromium all
  READY (browser + dev-server need UNSANDBOXED execution from Codex's interface), BUT **Firestore Admin
  read-only preflight TIMED OUT from Codex's env (app-timeout-12000ms)** = unproven egress = run blocker.
  Recommendation: a bounded sandbox read preflight must pass in whatever env executes the harness; if Codex's
  egress stays blocked, Claude/David runs the harness and Codex reviews artifacts.
- **Baton is IDLE** (REVIEWONLY_AUDIT_PREP closed, `turnOwner=claude`, decision NOT_READY) — no loop mid-flight;
  safe to open a new `taskId`.

## 4. CS interventions 2026-07-13 (all in SUPPORT_RUNBOOK.md CS-2026-07-13 a–f; sweeps clean)
Individual: 오하린 carry-correct(no write); 김동현 #11 list-end→SUMMIT; 안이연/유혜준/Lucy #12→reconciled to
earned anchors (d5/420, d10/800, d11/880); Kaila csd 2→3; 김준서 #11-throttle→manual review-only completion
(interv 1.0→0.78); 손지성 carry-correct(no write); Bridge TOP 최다온/한예진(Annette Han)/최우성 #11→Ascent;
허은서 NOT-#11 (mid-day-14, passed new — likely transient). Systemic: **ensure-all-lists** (all 32 26SM classes
now have Base+Ascent+Summit; props mirrored; assignedAt BACKDATED so no default-focus bump; 32 backups);
**batch-advance 87** list-end finishers to next list (config-only primaryFocus; forward-progression
highest-finished+1). **Remaining: 63 finishers still to advance** (`next-list-by-class_2026-07-13.md`),
**5 finished-everything** (함지민†, Soul Kim, 유찬†, 이가온, Young Cho; † = 수강종료). New CS scripts in
`scripts/cs/`: diag-reviewonly-cases, sweep-ascent-carry, reconcile-ascent-carry, move-kimdonghyun-to-summit,
fix-kaila-junseo, scan-reviewonly-frozen, report-next-list, ensure-all-lists, batch-advance-listend.
**KNOWN BENIGN ARTIFACT:** manual/fix-created review-only completions trip the sweep's `reviewNoNewPass` check
(김준서 d5 + list-end finishers) — the sweep must learn review-only days when the fix ships.

## 5. TA chat-log triage (6/30→7/13) — `docs/audits/TA_CHATLOG_TRIAGE_2026-07-13.md`
Whole week = Flaw A + Flaw B live. NEW issues → NEED_TO_FIX **#13** (test-size mis-generated at boundaries:
이혜성 day-1 totalQ=10 vs config 30 VERIFIED; 김호형 promotion-retake 30≠35 UNVERIFIED/open — email has no auth
record; 이서현 d9 15-question dup-serve, David says fixed), **#14** (permanent-fail: deterministic grader
false-negative + challenge-token exhaustion + no teacher override; tokens replenish **30 days** (VERIFIED in
users/{uid}.challenges.history) not "next week" as TAs told; rejected challenges consume tokens; promoted
students lack grade permission in the new class), **#15** (no review-retake; reviews non-gating so a 2%
mis-submit stands; chronic low reviews (13-40%) still "pass" and silently feed the #11 THROTTLE).

## 6. David's feature request (2026-07-13, verbatim intent) — the forward design
1. List-end notice: "You completed the list. Would you like to **start over**, or **advance to the next list**?"
2. The next list in series starts **continuously** (no dead-end, no TA intervention).
3. **Ability to LINK lists within a class** (explicit per-class sequence; today "next" is inferred
   Base→Ascent→Summit by convention only — Summit is 800 words, smaller than Ascent 1600, so size can't order).
"Start over" = the cycling capstone (`docs/plans/loop/x/plan.md`: per-word study_state RESET; twi stays
MONOTONIC via virtual index — David's earlier reset-twi idea was explicitly REJECTED as recon-breaking).
Open sub-decision: student-chooses-each-time vs teacher-set auto-advance.

## 7. Where everything lives
| Thing | Path |
|---|---|
| Issue registry | `NEED_TO_FIX.md` (#11 gate-deadlock, #12 carry-miss, #13 test-size, #14 permanent-fail, #15 review-retake; older: #5 threshold, #8 gradebook filter, #1/#1b/#1c override+security, #2 grader, #3/#4 grading reliability, #10 self-race) |
| CS event log | `SUPPORT_RUNBOOK.md` (CS-2026-07-13 a–f = today) |
| Converged fix design | `docs/plans/PLAN_review_only_day_completion.md` |
| Converged audit design | `docs/plans/PLAN_reviewonly_playwright_audit.md` |
| Cycling capstone design | `docs/plans/loop/x/plan.md` |
| Baton system | `docs/plans/loop/` (baton.json, lib/CLAUDE_ROUND_SOP.md, lib/CODEX_STANDING_INSTRUCTIONS.md, lib/baton-watch.sh, lib/baton.mjs; reviews in codex_reviews/, handoffs in handoffs/) |
| Uncommitted fix diff | `audit/deepfix/context/phase1_current_uncommitted_fix.diff` |
| TA chat log (verbatim) | `audit/deepfix/context/TA_CHATLOG_2026-06-30_to_07-13.md` |
| Chat-log triage | `docs/audits/TA_CHATLOG_TRIAGE_2026-07-13.md` |
| Advance reports | `audit/deepfix/context/next-list-by-class_2026-07-13.md`, `next-list-report_2026-07-13.md` |
| Change log / resume | `change_action_log.md`, `RESUME.md` (+ `docs/resume_archive/`) |
| Persona-fleet findings (prior audit) | `docs/audits/PERSONA_FLEET_FINDINGS.md`, cert `audit/playwright/findings/fleet_manifest_fleet3.json` |

## 8. Hard operating constraints (verbatim standing rules)
- **VERIFY EVERYTHING** (David 2026-07-13): every agent + Codex claim verified vs code/data before acting.
  Session evidence this matters: Codex RAD-3 refuted by progressService.js:236; my own sweep's 12 "affected"
  → mostly false positives on validation; my RESUME claimed "Codex prepped" when the verdict was NOT_READY.
- NO app-source change until the governing plan has Codex GO **and** David's explicit go-ahead. Reverting counts.
- Owner (David) deploys; Claude cannot build/deploy. Live (https://vocaboostone.netlify.app) has ACTIVE 26SM
  students — never target/deploy without David.
- Sandbox only for audits (`lsr_*@vocaboost.test`, 25WT classes); 26SM only for genuine CS (read-only diagnose
  first; write only derived/verified values; data-integrity-sweep before+after).
- Log: code→`change_action_log.md`; CS/data→`SUPPORT_RUNBOOK.md`; rotate `RESUME.md` at save-state.
- `Date.now()`/`Math.random()`/argless `new Date()` unavailable inside Workflow scripts. `.ps1` from WSL = ASCII-only.
