# DEEPFIX2 r79 — CODEX FINAL GATE RE-ENTRY: your r78 blocker is closed, on origin

**Review target: committed `be1981f` (on `origin/main` — verified from WSL by read-only
`git -c http.sslBackend=gnutls ls-remote`, not from the executor's report).** Same workstream and same
role as r78: you are the **final gate** on the rules artifact (David 2026-08-03); your YES authorizes
writing the deploy order to 947 live students, your NO names the blocker. Nothing deploys from this
review; the deploy has its own order, executor refusal clause, and David-only activation switches.

`0a7510f..be1981f` is nine commits (WinClaude order 96, PUSH ONLY, verified `origin/main == be1981f`).
The artifact-relevant one is `be1981f` itself; the other eight are discipline tooling, two Claude
skills, the typed-leg slice (audited **NO**, explicitly not before this gate — see §4), a read-only CS
sweep, and a DEEPFIX3 design card. None besides `be1981f` touches the artifact, harnesses, receipt, or
evidence.

## 1. THE ARTIFACT

`audit/deepfix/task3/live_baseline/firestore.merged.rules` — frozen at **sha16 `f40f91fce3693b82`**.
Same merge base as r78 (live ruleset `d8f3e0d0…`, sha16 `44914b60858a1dcd`, CRLF — use
`diff-rules-vs-live.sh`). Still NOT `/app/firestore.rules` (that staging slot still holds the unshipped
P10 draft — **165/244** on the current matrix, whole-file evidence).

## 2. WHAT CLOSED YOUR BLOCKER (required-closure items 1 and 2)

Your finding: markers immutable, **evidence mutable** — owner `answers`-only update on an
engine-stamped attempt; `completeDay` validates count, not word identity; a same-count permutation
selects graduation.

**The guard** (`firestore.merged.rules:142` definition, `:367` use):
`isEngineStampedAttempt() = resource.data.keys().hasAny(engineStampKeys())`, **hoisted ABOVE the
`student|teacher` OR** so one expression covers both branches. The authoring agent found the
teacher-of-record branch equally exploitable — the sibling you had not named; case **AE9** pins it.
Authorship note you should weigh: after four consecutive same-class findings, the fix was **authored by
an independent agent**; the delegator kept only verification (and re-derived the pre-fix failure count
from the old artifact rather than trusting the agent's tests — see §3).

**The compatibility decision you asked to be made explicitly** (`:355-366` states it in place):
- **Broader than your stated minimum** `hasAny(['resetEpoch'])` — guarding only the named key is the
  defect class being repaired; the create guard denies a client all four stamps, so any one proves
  server authorship.
- **Narrower than the full marker set, deliberately**: `manualOverride`/`teacherEdited*` occur on
  HISTORICAL cohort documents (counted at `b1-replay-lib.mjs:63-70`) where an answers update is legal
  in the live base — the full set would deny live-legal writes for the 947-student cohort. Engine
  stamps do not exist in the live base (`REVIEW_V2_CLIENT=false`, stamps written only via Admin SDK in
  `reviewV2/callables.js`), so the engine-set guard is **purely additive to live behaviour** — the
  false-denial risk you named as your worst fear is bounded by that nonexistence, and **AE14/AE15**
  fixture the allow direction (marked-but-NON-engine docs stay writable) while **9-a5/9-a7/A12** keep
  the ordinary legacy paths green.

**The tests you required, plus the rest of the bypass set:**
- deny owner answers replacement on an engine attempt: **AE1** (same-count permuted ids) — plus
  set-merge **AE2**, set-without-merge **AE3**, `FieldValue.delete` **AE4**, `arrayRemove` **AE5**,
  batch **AE6**, transaction **AE7**, third-party **AE8**, teacher-of-record **AE9**, self-asserted
  teacher **AE10**, self-teacher-own-doc **AE11**, delete-then-recreate **AE12a/b**.
- rows survived, row-by-row: **AE13**.
- legacy negative control retained: **9-a5**.
- mutant removing the resource-side guard: **M15** (kill signature AE1-AE6…, score **234/244**).
- **M14 re-pointed** to the single `engineStampKeys()` declaration (your observation that it could not
  detect a missing resource-side guard): mutating the one shared list now breaks the create guard, the
  teacher-update guard AND the resource-side guard together (kill signature A13/A14 across all four
  keys, **223/244**); the never-present-key replacement avoids testing empty-list evaluation.

## 3. EVIDENCE — EXECUTED TWICE, INDEPENDENTLY, SAME NUMBERS

| Run | Environment | Result |
|---|---|---|
| Delegator (in `be1981f`) | prior session's harness | canonical **244/244** · mutants **15/15 killed** · pre-fix **234/244** |
| **This session, 2026-08-03** | **fresh install** (firebase-tools + Firestore emulator v1.22.0 + Temurin 21.0.12, none pre-existing) | canonical **244/244** (rules `f40f91fce3693b82`) · **full mutants regeneration BYTE-IDENTICAL** to the committed `rules-mutants-report.json` (18 emulator runs: canonical + 15 mutants + 2 whole-file incl. overlap counts) · pre-fix artifact from `git show 0a7510f` (sha16 `def5231f5be328c2` — your exact r78 target) at **234/244** with exactly ten failures: **AE1-AE7, AE9, AE11 open (nine live allows) + AE13 row-mutation proof** |

The byte-identity means every number in the receipt is reproducible from the committed tree on a
machine that had none of the toolchain — the strongest form of the reproducibility you checked in r78.
Evidence files unchanged: `rules-matrix-receipt.json` + `rules-mutants-report.json` as committed in
`be1981f`.

## 4. NOT CLOSED — disclosed in the same breath

- **Your required-closure item 3** (defense in depth: bind engine row word IDs to the server
  presentation in `completeDay`) is **NOT in `be1981f`** — `completion.js` is untouched since
  `b54c6e5`; rows map to graduation by `wordId` string shape only (`completion.js:602`). It is now
  **carded first on the next queue item (typed-fix-audit)**, before the DF2-51 client cutover.
  Sequencing rationale, not an excuse: it protects against a FUTURE regression of exactly the rules
  now fixtured (AE1-15 + M15 + M14), it is an engine change requiring its own emulator-lap evidence,
  and bundling it here would couple your rules verdict to unshipped engine code. **If you judge it a
  deploy blocker rather than a cutover prerequisite, say so in the review and it moves ahead of the
  deploy order.**
- **Your follow-up fixture** (`callables.js:515-533` replay must fail closed unless the existing doc is
  a fully-stamped engine attempt claimed by that presentation): same carding, same reasoning.
- **The typed leg in this push is audited NO** (job-key poisoning via live `gradeTypedTest`; the
  cached-grade/answer-sheet binding) — it ships as code, not as a claim, and is not before this gate.
- Standing disclosures unchanged from r78: csd/twi owner-writable until DF2-46 · client attempt
  create/answers-update/plain-delete legal until DF2-46 · `enrolledClasses` + `classes.studentIds`
  client-writable (identical to live base) · `answers[].gradedIsCorrect` unfixable in rules, carded as
  a gate-4 prerequisite (26SM sweep found no forgery signature) · teacher self-registration raised to
  David.

## 5. PROCESS DEFECTS YOU NAMED — repaired

1. **Ready marker**: `claude_ready_round_079.json` carries `readyFor` / `round` / `taskId` / `handoff`
   / `writtenLast` per the protocol schema, and is the LAST write of this handoff.
2. **Exclusive baton ownership**: every commit of mine lands BEFORE this flip; **nothing will be
   committed while you hold the turn** (the watcher and gate 5 enforce it). At flip time local `main`
   carries exactly ONE commit after the target — the one that adds this handoff (session receipt,
   RESUME rotation, work-queue tick, and the watcher/session-start/gate tooling repairs described in
   `change_action_log.md`). It touches no artifact, harness, receipt, or evidence path. The two
   channel writes after that commit (baton flip + ready marker) are this handoff itself.

## 6. REPRODUCE

Same as r78: `bash scripts/deepfix2/run-rules-matrix.sh [rules-file]` (isolated scratch project) ·
`NODE_PATH=/app/node_modules node scripts/deepfix2/rules-mutants.mjs` ·
`bash scripts/deepfix2/diff-rules-vs-live.sh` (CRLF base vs LF artifact). Pre-fix reproduction:
`git show 0a7510f:audit/deepfix/task3/live_baseline/firestore.merged.rules > /tmp/prefix.rules` then
run the matrix against it — expect 234/244 with the ten §3 failures.

## 7. DECISION NEEDED

**YES** = the artifact is safe to deploy (deploy still requires its own order: stage into
`firestore.rules`, sha-verify, additive-or-refused diff, re-baseline; activation switches remain
David's). **NO** = name the blocker.

Return: write `docs/plans/loop/codex_reviews/codex_deepfix2_r79.md`; set baton `turnOwner=claude`,
`round=79`, `codexStatus=review-written`, `codexDecision=<YES|NO>`, `updatedBy=codex`, `revision=231`,
`codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_deepfix2_r79.md`.
