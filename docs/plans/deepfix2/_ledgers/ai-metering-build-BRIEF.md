# BRIEF — ai-metering-build: the AI-grading meter + spend cap (server, live path)
2026-08-05 · orchestrator → implementer (OPUS — live grading path for 947 students) · ledger:
`_ledgers/ai-metering-build-fold-ledger.md` · COMMITTED-NOT-DEPLOYED (its deploy is a separate later
David-executed order; it does NOT ride order 105, which is already deployed).

## Why this exists
David ruled 2026-08-05 ("build the spending cap first, launch both"): DF2-51's typed re-tests may not
launch without a real ceiling. NTF-28 records the gap — the contract was frozen and never built.
**Contract (frozen, implement THIS shape, do not redesign):** `15_H6_SCHEMAS_AND_CONTRACTS.md:184` and
`:191` — `ai_metering/{uid}` + `ai_metering/_global`, shape `{count, windowStart}` per period,
"incremented in the grading-job claim txn"; plus per-job `aiCallCount` on `grading_jobs`. Law
`R2-20` (`11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:63`): *"every AI-grading call is METERED (count per
student + global — the grading job is the natural counting point) as the metric for a FUTURE global
AI-grading limit gate."* David's ruling promotes that future gate to now.

## ⚠ THE LOAD-BEARING FINDING — READ TWICE, IT IS THE WHOLE DESIGN
**The metering point cannot currently tell a re-test from a live test.** The counting point named by
the contract (`claimOrRecoverGradingJob`, `functions/index.js:1051`) and the engine's typed path
(`functions/reviewV2/typedGrading.js`) carry NO rerun/retest discriminator — I grepped for one; the
`kind: "rerun"` fingerprint exists only up at `functions/reviewV2/callables.js:676`
(`isRerunTxn = p.requestFingerprint?.kind === "rerun"`, stamping `type:"retest"` at `:761`).
**Therefore a naive cap at the claim txn would refuse LIVE typed tests for 947 students the moment the
cap trips — a catastrophic outage, and the exact opposite of the intent.** Verify all of this yourself
before designing (line numbers drift), then implement the split below.

## ORCHESTRATOR DECISIONS (law — implement, do not re-litigate)
1. **COUNT EVERYTHING, ENFORCE NARROWLY.** Metering (increment + record) applies to EVERY AI-grading
   call, exactly per R2-20. **Enforcement (refusal) applies ONLY to the re-test/rerun path.** A live or
   required typed test — new-word test, review test, retake — MUST NEVER be refused by this meter,
   whatever the counters say. Cost control may degrade an optional feature; it may not break a
   student's required work.
2. **The discriminator must REACH the enforcement point** — plumb it explicitly (an argument threaded
   from the caller that knows `kind`/`type`), never inferred from a doc id, a name, or a heuristic.
   **Absence of the discriminator MUST read as "live"** (the safe default), never as "retest".
3. **Limits are CONFIG, not constants** — read from Firestore (extend `system_config/review_v2` with a
   `metering` sub-object, or add `system_config/ai_metering`; pick one, justify it in the ledger, keep
   it server-only-writable). Defaults if unset — state them as defaults, not truths:
   per-student **40 AI-graded calls/day**, global **6,000/day**. Window = the KST day boundary already
   canonical in this codebase (find and REUSE the existing helper — do not invent a second day law).
4. **Failure semantics.** Config unreadable / counter read fails: the LIVE path proceeds (fail-OPEN —
   never block required work on an infra hiccup); the RETEST path refuses (fail-CLOSED — an optional
   feature declining is cheap, an uncapped bill is not). Increment failure must never fail a grade
   that already ran.
5. **Refusal shape:** a distinct, non-transient status the client can render (mirror the frozen RV2
   status idiom used by `grade_unusable` — a permanent "not now" that must NOT be polled/retried in a
   loop). Name it explicitly, add it to the frozen status list beside its siblings, and give it a
   student-facing message ("You've reached today's practice-grading limit — try again tomorrow, or use
   a multiple-choice re-test"). MCQ re-tests are unmetered and must stay available.
6. **Idempotency:** the counter increments in the SAME transaction that claims the job (the contract's
   words), so a retried/recovered claim of an ALREADY-COUNTED job must not double-count. Prove it.

## VERIFY BEFORE EDITING (V-rows; each is load-bearing)
- The real claim-txn shape + where a transactional increment can sit without widening the txn's
  read-set dangerously (`claimOrRecoverGradingJob`, and every branch: fresh claim · `return_cached` ·
  `already_graded` · lease recovery — WHICH of these represent a real AI call? Only the ones that
  actually invoke the grader should count. State your mapping in the ledger.)
- Every call path into typed grading: the legacy public `gradeTypedTest` (live student tests today) and
  the engine's `defaultGrade` (`typedGrading.js:144-149`) — BOTH must count; only the rerun leg enforces.
- Whether any client currently displays an arbitrary refusal status (so your new one renders, not blanks).
- The canonical KST day helper (there IS one — `streak_credits` is keyed on a KST date; reuse it).

## FIXTURES + MUTANTS (pure node where possible; emulator where the txn matters)
Cases, at minimum: count increments on a real grade · no double-count on cached/recovered claim ·
per-student cap trips at the boundary (N-1 allowed, N refused) on the RETEST path · **the same
over-cap state does NOT refuse a LIVE test** (the outage-prevention case — this is the most important
fixture in the fold) · global cap trips independently of per-student · window rollover resets · missing
discriminator ⇒ treated as live ⇒ allowed · config-unreadable ⇒ live allowed, retest refused ·
increment failure doesn't fail the grade. BYPASS SET (this IS a closure claim): enumerate every path
that reaches AI grading (legacy callable · engine defaultGrade · rerun · retake · recompose-after-
`grade_unusable` · cached-return · already-graded sibling) and say for each: counted? enforced? why.
One mutant per new clause (flip the live/retest branch · drop the idempotency guard · invert a
boundary comparison · drop the fail-open default) — each killed, restore clean.
Emulator runs: `PATH="$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH" ~/fbtools/node_modules/.bin/firebase
emulators:exec --only firestore --project vocaboost-879c2 "node <script>"`. ONE lap at a time
(`audit/deepfix/emulator-lap.lock`).

## REGRESSION GUARD (non-negotiable)
Re-run the deploy-certification lap after your change and paste the result:
`node scripts/deepfix2/engine-emulator-lap.mjs` inside the emulator — it was 452/452 green at
commit 0e52c13. Anything less is a STOP-and-report, not something to fix by editing fixtures.
Also re-run `scripts/deepfix2/ntf26-heuristic-fixtures.mjs` (free) — the grader guard must stay intact.

## CONSTRAINTS (law)
- Touch ONLY: `functions/index.js`, `functions/reviewV2/typedGrading.js`, `functions/reviewV2/
  callables.js` (only if the discriminator must be threaded from there), a new pure helper module under
  `functions/` if it keeps the logic testable, your fixtures/mutants under `scripts/deepfix2/`, their
  evidence JSONs, and your fold ledger. NOTHING else — no client (`src/`), no rules, no `.claude/*`,
  no batons, no queue/RESUME/change-log, no `git add`, NO COMMIT, NO DEPLOY, no `firebase deploy`.
- A parallel CS session shares this tree — expect dirty living logs and moving HEAD; never stage.
- `firestore.rules`: the metering docs are server-only-written (Admin SDK bypasses rules). If you
  believe a rules clause is needed, CARD it — do not edit rules (that's a separate gated workstream).
- No flag flips. No model/temperature changes. eslint must stay exit 0 (`npm run lint` is a predeploy
  hook — a lint failure aborts a future deploy).

## Report back
Per-decision compliance; the counted-vs-enforced mapping for every path in the bypass set; the exact
config doc + defaults you chose and why; fixture/mutant results with evidence paths (numbers derived
from the JSONs, never hand-typed); the lap re-run result; every judgment call; anything that surprised
you. Your report is a CLAIM — an independent opus auditor re-executes it before the orchestrator
trusts it.
