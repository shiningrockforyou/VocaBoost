# DEEPFIX2 — 17_ DEPLOY-ORDER REQUIREMENTS (the durable card home, r72 Opus condition 10)

The WinClaude dark-deploy order series MUST carry each item below; nothing here is optional or
handoff-ephemeral.

1. **RESET_V2 flip step [David 2026-08-03: "whenever is convenient" ⇒ the sandbox-rehearsal phase]**:
   `RESET_V2_ENABLED` (functions/foundation.js) deploys FALSE; flipping it is its own named,
   David-acknowledged deploy after the 25WT rehearsal exercises the §9 reset law. Until then production
   reset behavior is the legacy law (state-law parity; response adds resetV2/targetEpoch/rv2Deleted/
   jobsCancelled fields).
2. **THE grading_jobs (uid ASC, status ASC) composite index** — ADDED to firestore.indexes.json at r73
   (it did NOT previously exist; the §9 job-cancellation query and DF2-12's session-start pickup both
   need it). The index deploy precedes any RESET_V2 flip.
2b. **[r75 — Codex r74 #1] ENGINE WRITERS ARE FAIL-CLOSED UNDER ANY RESET LOCK**: a crashed reset
   leaves a partially-deleted graph, so `resetLockActive` refuses on ANY `resetInProgress` (no age
   window — reverted from r74's reader-side window); liveness comes ONLY from the next reset op's
   stale-owner TAKEOVER (re-fence → cleanup → owner-clear), after which the engine serves. FIXTURED AS
   [r76, corrected per Codex r75 #3 — the prior "full sequence" claim overstated the assertions]: dirty
   epoch-old artifacts are PLANTED in the simulated crash state, then the takeover is asserted to
   (i) refuse service while the stale lock stands, (ii) re-fence to a HIGHER epoch, (iii) actually
   DELETE the planted stale-epoch artifacts (a takeover that clears the lock but skips cleanup goes
   RED), (iv) owner-clear, and only then (v) serve. The exhaustive nine-family cleanup count stays
   carried by the ordinary-reset case. The CS repair stays published in SUPPORT_RUNBOOK.
3. **H-A advance interlock + frozen-field consequences [r71 Opus; wording corrected r74 N-7]**: csd/twi
   single-line-of-advance is enforced by the mutual day-guards. The ENGINE side is fixtured (a
   legacy-advanced csd makes completeDay refuse — lap). The completeSession side is the SAME transactional
   day-guard (foundation.js:1356-1364) verified by code reading; a completeSession-side lap fixture is
   EXPLICITLY DEFERRED to the 25WT rehearsal (the callable is live-flagged and its flow needs a full legacy
   session context). For engine-completed days the fields recentSessions/stats/streakDays/interventionLevel/
   reviewMode FREEZE — and they are not display-only: `deriveThrottleModeServer` and the intervention
   derivation CONSUME recentSessions, so a legacy completion after engine days derives throttle/intervention
   from a window that skipped them. Published consequence of the rehearsal window; dissolves when D-1
   removes the throttle and DF2-51 reads engine truth.
4. **Compose read-set sizing [CC-14]**: a first-compose day transactionally reads ≈ the introduced-range
   size in study_states (1,300-word lists ⇒ ~1,300-doc txn read sets; chunked ×300). Label-stamp
   contention aborts retry via runTransaction. No action — a sizing/contention note for the deploy
   monitors.
5. **N-1 twi semantics [r72 Opus; completed r74]**: ENGINE twi = ordinal count over canonical order
   (gap-tolerant; 15_ §2 supersession recorded). The CS anchor law `twi = nwei + 1` is positional and
   exact only on gap-free lists. EVERY canonical load (session/new/rerun/completion) emits the
   `positionGap` ops WARNING on a gapped list — surfaced to CS, no refusal. DUPLICATE positions KEEP
   refusing (`list_words_malformed`) — a duplicate breaks grading-key identity and is the signature of
   the addWord-after-delete COLLISION (mechanism corrected r75: deleteWord deletes WITHOUT reindexing and
   decrements wordCount; addWord/addWordsBatch allocate from the decremented count ⇒ collision; a batch
   add mints a RUN of duplicates; a delete with no add leaves a permanent GAP under warn-and-serve —
   carded in NEED_TO_FIX.md; the read-only sweep's committed receipt lives in
   docs/plans/deepfix2/evidence/list-position-sweep-receipt.json, re-run before 26SM meets the engine;
   any positionGap emission during 25WT = stop-and-fixture trigger for the deferred end-to-end case). **SWEEP RESULT
   (2026-08-03, scripts/deepfix2/list-position-sweep.mjs): 46 lists — 42 clean, 4 empty, ZERO duplicated,
   ZERO gapped. The hazard class is empirically absent from production today.**
6. **THE COMPLETION EVIDENCE FENCE — THE EXACT THREE-WAY RULE [N-10 r74; corrected + completed r76 per
   Codex r75 #2, which caught this artifact contradicting the code].** ONE discriminator governs both
   halves: **`resetEpoch` presence** (engine writers always stamp it; legacy attempts never did).
   - **ENGINE legs (epoch present), BOTH halves**: REQUIRE the claimed server presentation (+ canonical
     queue binding on the consumed half) AND the COMPLETE frozen gatePosture — `effectiveEnabled`
     boolean, `configVersion` integer ≥ 1, `threshold` integer 1-100, `source` non-empty — AND the r48
     row/score arithmetic. Anything less is an IMPOSSIBLE engine record ⇒ `no_evidence`; it is never
     demoted into privilege under a completion-time posture.
   - **LEGACY CONSUMED (review) half (epoch absent)**: the r48 arithmetic is enforced **SKIPPED-AWARE**
     [premise CORRECTED r77 — the r76 text claimed legacy writers derive `totalQuestions` from the rows
     they store; that is FALSE and was verified against the live writers: `src/pages/MCQTest.jsx:685/699`
     sends `totalQuestions = testWords.length` (the FULL test) while the answer array holds ANSWERED
     entries only, and `functions/index.js:429-434` stores `answers`=partial, `totalQuestions`=full,
     `skipped`=the difference; review attempts are `passed:true`. The published blank-undercount census
     (38,825) says the same thing.] THE RULE: integer score 0-100 · integer denominator ≥ 1 ·
     `0 < rows ≤ totalQuestions` · the score must recompute as `round(correct / totalQuestions × 100)`
     (exactly the writers' own formula) · a present `skipped` field must equal the row shortfall.
     A legitimate skipped-question review (e.g. 28 rows / 30 questions / score 93) MUST complete —
     rejecting it would strand any student who skipped a question during the flip window.
     Posture and presentation remain EXEMPT: the attempt ALWAYS demotes to
     `postureSource: "completion_legacy"` and the completion-time source-class posture governs — the
     `resetEpoch` discriminator selects posture authority EXCLUSIVELY, so a complete-looking posture on
     an epoch-less record never overrides it.
     **ENGINE evidence keeps the strict COMPLETE-ROWS law** (`rows === totalQuestions`, blanks
     explicit) — a short engine row set is an impossible engine record.
   - **LEGACY NEW-TEST half (epoch absent)**: identity/day/pass + range ONLY — NO row/score arithmetic,
     NO posture requirement. REASON (the decision, published): this half mints no privilege — graduation
     derives solely from the consumed review half, and its `wordsIntroduced` contribution is clamped to
     the canonical list size — so arithmetic here would add flip-week refusal risk with zero authority
     benefit. Fixtured by the deliberately degenerate LEGACY DAY case (8 rows against
     `totalQuestions: 10`), which exists to prove the leniency is intended.
7. **N-9 [r74]**: `windowRunId` stamping rides the ≤60s registry cache, so a window open/roll has a
   bounded skew where in-flight writers still stamp the prior run (their rows quarantine — fail-closed,
   never misclassified). PROCEDURE (extends the existing generation law's schedule): after writing
   `shadow_registry/window`, WAIT > the 60s TTL before starting batteries; same on teardown.
7b. **THE RULES LEG — ITS OWN WORKSTREAM, NOT A MERGE STEP [r91 HALT, 2026-08-03]. WinClaude REFUSED
   the ordered rules deploy and the refusal was correct — the order (mine) was wrong in three ways:**
   (a) **`firestore.rules` in this repo is NOT the live production ruleset.** It self-declares as the
   P10-CUTOVER (FINAL) end-state — "⛔ DO NOT deploy this file at the P6 (or P10c) step … Deploying it
   EARLY BREAKS LIVE STUDENT FLOWS AND LOCKS OUT UN-BACKFILLED TEACHERS" (firestore.rules:4-12, verified
   first-hand). `firebase.json` maps `rules → firestore.rules`, so the ordered command would have shipped
   TWO unshipped lockdowns (P6 + P10d) to production alongside our clauses. NOT additive.
   (b) **`audit/deepfix/task3/firestore.review_v2.rules` is 131 lines of COMMENTARY** — a SPECIFICATION
   of clauses to AUTHOR, not a fragment to concatenate.
   (c) **The artifact itself mandates a 10-case emulator matrix ON THE MERGED FILE** (its lines 111-126),
   including case 9 "regression sweep: every pre-existing allow in the base still passes" — the test that
   would have caught (a) independently. The ordered sequence had no matrix step. The artifact even names
   the rule the order broke: "The merge base is THE RULESET LIVE IN PRODUCTION AT DARK-TRAIN TIME — not
   any repo draft."
   **THE CORRECT SEQUENCE (WSL-owned; rules edits are not the executor's):** fetch the LIVE ruleset (the
   Firebase Rules REST API / console) as the merge base → AUTHOR the review_v2 clauses as real rule text
   → run the 10-case matrix on the MERGED file incl. the regression sweep → diff-review → deploy as its
   own order. **SEQUENCING: this is NOT a blocker for the dark deploy or the 25WT rehearsal** — the
   engine's safety comes from its callables being server-side (Admin SDK writes bypass rules), and every
   surface the artifact locks is NEW, so no live or cached client writes it. **It IS required before the
   flip**, when the six labels start governing student experience and a hand-rolled client write could
   forge them (B3's backfill overwrites all six from history, so any pre-backfill poisoning is wiped —
   the real exposure window opens at the flip). **DEADLINE TIGHTENED [WinClaude r091, adopted r092]:
   land the rules before GATE 4 (the 26SM backfill), not merely before gate 5 — between backfill and
   rules-deploy, real backfilled labels exist in `study_states` with the field-immunity clauses not yet
   deployed, so that window would leave them client-forgeable.**
   **DEPLOY STATUS (2026-08-03, post-pause resume under David's full-permission go): THE DARK DEPLOY IS
   COMPLETE — all legs except this workstream.** Leg 1 indexes ✅ (r91: 42→43, additive-proven). Leg 3
   functions ✅ (r92: 17→24, nine surgical `--only functions:<name>` targets, REMOVED: NONE; the 7
   `reviewV2*` callables created, `resetProgress`/`reviewChallenge` updated in place; deployed tree =
   `b54c6e5`, `RESET_V2_ENABLED === false` verified from the uploaded source). Leg 4 config doc ✅
   (WSL, seed-review-v2-config.mjs --execute: `system_config/review_v2` CREATED + post-write VERIFIED
   dark — enabled:false, firstEnabledAt:null, rehearsalClassIds:[], configVersion:1, 92/60/30,
   minClientVersion:null). Leg 2 rules = THIS workstream, the only remaining leg. NOTHING ACTIVATED:
   no marker, no rehearsal classes. **Surgical-deploy caveat [r92]: `exports.version` (the
   deploy-provenance probe) was not in the target set, so it still reports the LAST FULL deploy's SHA —
   add `functions:version` to every future surgical target list, or distrust it after surgical trains.**
8. Standard set: functions + `audit/deepfix/task3/firestore.review_v2.rules` + indexes, all
   `enabled:false`, `rehearsalClassIds:[]`; the R2-48 flip choreography (14_ §4) governs activation;
   Firebase hosting is NOT used for the client — **NETLIFY AUTO-DEPLOYS the front-end on EVERY push to
   main** (David 2026-08-03; verified — the program's 17 pushes each shipped the client, whose only src/
   change was db.js's 7-line preimage copy, student-invisible). CONSEQUENCE: every push to main IS a
   production client deploy; the DF2-51 client legs are built on a BRANCH and merge only at deliberate,
   David-visible release points; WinClaude orders state the client-deploy consequence whenever src/
   stages.
   **RULED — David, 2026-08-03, verbatim (via the WinClaude channel, receipt at win-baton rev 169):
   "I turned off auto publishing so it is a non-issue. Continue".** **LEVER CONFIRMED VISUALLY 2026-08-03 (David's Netlify
   page): "Auto Publishing **Locked**" · "Published `main@ce09792`" · the reverse action is labelled
   "Unlock to start auto publishing".** Production is PINNED at `ce09792`; all later pushes show
   `completed` (built, unpublished). CONSEQUENCES, all in force:
   (a) a push to `main` BUILDS but does NOT publish — production stays pinned until David publishes
   deliberately; (b) **Q6 is now properly satisfiable and better than its original wording**: the
   OFF-parity + old-bundle checks are evaluated against a BUILT-BUT-UNPUBLISHED deploy, then David
   publishes; (c) **the frontend hold is LIFTED and NO branch strategy is to be built** — client work
   commits to `main` normally (WinClaude's explicit request; the r76-era branch rule is RETIRED);
   (d) the already-live `db.js` +7 preimage change stays — teacher-path, additive, no rollback indicated.
   THE SUPPORTING FORENSICS (independent, pre-ruling): exactly one deploy is marked `published` — `ce09792` (r72) — while the four newer builds
   (`58af1f1`, `e9e8ac4`, `e1c20ba`, `503b3ed`) show `completed`. That is the signature of auto-publishing
   being STOPPED (or that deploy LOCKED) sometime between 22:24 and 23:07 on 2026-08-02: Netlify keeps
   building every push while production stays pinned. VERIFIED CONSEQUENCE: `git diff ce09792..503b3ed --
   src/ public/ index.html package.json vite.config.js` is EMPTY, so the pinned bundle is byte-identical
   to HEAD — the unpublished builds are redundant, not missing. The program's ONE client change (db.js +7,
   the teacher-path grading preimage) shipped earlier at `c7abf0a` and IS inside the pinned build.
   ACTION WHEN DAVID NAMES THE LEVER: record it here as a ruling and rewire the WinClaude standing orders
   (branch-only vs push-safe) accordingly; until then the frontend phase stays held.**
   **SECOND RULING — BUILDS STOPPED (David, 2026-08-03, this channel): David flagged that every Netlify
   BUILD costs money even unpublished (~20 pushes had bought 1 published deploy), and moved the stronger
   lever on my recommendation: Build settings → Build status → "Stopped builds" (repo link kept;
   auto-publish lock remains underneath). CONSEQUENCE: a push to `main` now triggers NOTHING — no build,
   no cost, no publish; commit/push cadence is fully decoupled from his bill. THE SHIP PATH at flip time
   is now explicit: either re-activate builds for the one Q6 release, or build locally and publish via
   CLI/API (Netlify's own alternative for stopped builds). If a build ever appears on a future push, the
   toggle didn't save — tell David.**
