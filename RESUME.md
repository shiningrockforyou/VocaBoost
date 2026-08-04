# RESUME — DEEPFIX2 (2026-08-04: cutover-a LANDED + browser-verified · cutover-b was IN FLIGHT, cancelled clean)

## ⚡ FIRST ACTION OF THIS SESSION — before session-start, before reading further
```
Monitor({command: "bash /app/scripts/deepfix2/baton-monitor.sh",
         description: "DEEPFIX2 baton returns (win + codex)", persistent: true, timeout_ms: 3600000})
```
Then `bash scripts/deepfix2/session-start.sh`, then read `/tmp/deepfix2-baton-events.log` for anything
that changed while nothing was armed. **This is CLAUDE.md's documented first action** — it exists because
on 2026-08-04 a passive log-only watcher let win order 98 sit unread for an hour.

## WHERE THINGS STAND
**Nothing is activated.** `REVIEW_V2_CLIENT=false`, client pinned `ce09792`, Netlify builds stopped.
**Both batons idle with claude** (win rev 192 round 99 CLEAN · codex rev 231 round 79 YES).
Production: indexes 43 · functions 24 (**STALE — `b54c6e5`, predates the typed leg, the typed-fix-audit
guards, the collision fix and cutover-a**) · config doc dark · **rules DEPLOYED** (`384c9c7a…`,
sha16 `f40f91fce3693b82`, re-verified 262/262 against bytes fetched from production).

**Server ~done (4,370 lines, 11 modules). Client ~1/4 through (11,157 legacy lines still the live path).**

## WHAT WAS IN FLIGHT WHEN THIS WAS SAVED
`cutover-b-submit` — implementer **CANCELLED CLEANLY** before it edited anything (it was still reading the
server contract). **Tree verified intact**: no source modified, no mutant residue, all three touched files
parse. **Nothing to recover or undo.**
- Its ledger is ACTIVE and gate-`--plan` ACCEPTED at `<scratch>/cutover-b-submit-fold-ledger.md`.
  **⚠ That scratchpad dies with the session.** If it is gone, the six V-row answers below are the value —
  re-derive the ledger from them rather than starting cold.
- **The brief that was in flight is worth reconstructing from the ledger** — it named six things the
  implementer must not re-derive.

### The six V rows, ALL ANSWERED (this is the expensive part — do not redo it)
1. **V1** — legacy submit `context` carries `attemptDocId = uid_testId_nonce` (`MCQTest.jsx:700`): the
   client-minted nonce that IS the 06-29 outage root cause. Every other field is server-supplied under the
   engine. **Send ONLY `{presentationId, answers}`** — never smuggle a client attemptDocId/totalQuestions.
2. **V2 (was the BLOCKING row) — the gradeToken is SUBSUMED, not lost, so the fold can ship.** Both
   `GRADE_TOKEN_MINT` and `GRADE_TOKEN_ENFORCED` are `false` in prod (`index.js:67,79`) — nothing live is
   removed. It was disarmed because ENFORCING it re-armed the 06-29 outage (nonce→docId divergence, still
   unpatched on legacy). The engine kills that root cause: `attemptId = engineDocId(uid, presentationId)`
   is SERVER-derived, and verdicts never reach the client before the write (`callables.js:550`, `:812`).
   **DO NOT touch either flag.**
3. **V3** — the client is the denominator authority today (`totalQuestions: testWords.length`). Under the
   engine it comes from the presentation. **This is why cutover-a's truncation bug existed**: 50/50 = 100%
   today, but 50 answers against a 60-word presentation is a guaranteed fail once the server sizes it.
4. **V4** — 8 statuses from the callable, **and `grade_unusable` is NOT among them** (it passes through
   from the typed grading resolver — a census grepping only the callable MISSES it). Classified:
   terminal `attempt_written` (incl. `replayed:true`) · poll `grading_in_progress` · recompose-ONCE
   `grade_unusable` · block-with-reason (6) · legacy-fallback `config_hold`/`review_v2_dark` + the thrown trio.
5. **V5 — recovery INVERTS.** Today the client fetches a cached grade and writes it. Under the engine the
   client never holds a grade and never writes, so that leg is **impossible**, not merely unnecessary.
   Replacement: call submit again — same presentationId returns `attempt_written, replayed:true`, zero
   writes (`callables.js:636-637`). This is why cutover-a's persisted composeKey matters here.
6. **V6** — flag-off parity is a DESIGN obligation, not a discoverable property. Only C2 can prove it.

## LANDED TODAY (9 commits since the backup point 3ad1fc5)
- **cutover-a-compose COMMITTED `f9b423f`** — review composition from the engine, flag-gated. Algorithm
  REPLACED (priority-bands→cursor rotation), so no fixture asserts client==server. Lazy compose at review
  entry · presented order verbatim · composeKey persisted. Opus audit PASS WITH FINDINGS: **three
  undeclared student-visible changes folded** (MCQ distractor pool narrowed ⇒ 3-option questions; dead
  range label; typed truncation ⇒ 83% cap) + a silent fallback + a FALSIFIED receipt whose root cause is
  now structurally fixed. **VISUAL CHECK CLOSED** — win 98 (review path) + win 99 (new-word path, CLEAN).
- **19_REHEARSAL_SPEC.md** — closes 13_ O1-5's data half. Leads with: 25WT is 13 students vs 947, so it
  **cannot rehearse a mass-wall event**.
- **gate.mjs hardened twice**: an EVIDENCE check (fold receipts must report success AND bind the tree —
  it caught a falsified receipt on my own run) and a MUTANT-residue check (a mutation run leaves a
  REVERTED GUARD in the tree mid-run; committing then ships it).
- **The baton watcher is now an EVENT monitor** and CLAUDE.md's first action.

## NEXT, in order (`node scripts/deepfix2/whats-next.mjs` is authoritative)
1. **cutover-b-submit** — re-brief from the ledger/V-rows above.
2. **gradejob-namespace + attempt-id-squat** — the two PRE-FLIP BLOCKERS (NEED_TO_FIX 19 + 22): a
   classmate can PERMANENTLY block another student's test. Dark today, LIVE AT THE FLIP. Decide together —
   one root cause: a global collection accepting client creates at server-derived names.
3. **monitoring-abort-rule** (13_ O1-6 HIGH) — the flip's monitoring has no numbers, no card, no abort
   rule, and **the rehearsal explicitly cannot cover the mass-wall risk, so this carries it**. B1 has run.
4. Then: cutover-c/d · dashboard (2 items — the engine writes `streak_credits` and NOTHING in src/ reads
   it, NEED_TO_FIX 25) · df2-11 teacher UI · df2-07 messaging · df2-51-navui · **functions-deploy-engine**
   · playwright-suite · rehearsal-25wt · shadow-audit.
5. **David's four:** backfill-go · flip-go · gradedIsCorrect backfill-trust · teacher-registration.

## STANDING FACTS THAT KEEP MATTERING
- **The dev build talks to REAL production Firebase** (`VITE_USE_EMULATOR=false`). Any UI check writes to
  live Firestore ⇒ 25WT identities only, never 26SM. Typed tests bill real AI tokens.
- **WSL cannot run vite** (win32 node_modules, shared checkout) ⇒ every UI fold's visual check is a
  WinClaude order. Cannot git push either (schannel); read-only checks work via
  `git -c http.sslBackend=gnutls ls-remote`.
- **A concurrent session writes to this repo** (26SM-T19 extraction; `.claude/settings*.json` are theirs).
  **Stage explicitly, never `git add -A`.**
- **Codex checkpoints:** proposed at the three pre-flip blockers as a SET (one is live-path and
  unassessed — NEED_TO_FIX 23), and before the functions deploy. Not on intermediate folds.
- **My recurring failure mode, verified repeatedly:** I undercount enumerations (fixture censuses twice)
  and publish numbers that have since moved. Derive counts, never type them; pair every implementer with
  an independent auditor told not to trust the report.
