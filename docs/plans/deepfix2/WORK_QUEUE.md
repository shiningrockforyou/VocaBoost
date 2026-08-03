# DEEPFIX2 WORK QUEUE — machine-read by `scripts/deepfix2/whats-next.mjs`

**SEQUENCED, NOT PARALLEL (David, 2026-08-03).** The server contract moved twice in one day, so
client work would be built against a shifting target. One item at a time; `after:` chains enforce it.

Format (one per line, parsed):  `- [ ] <id> | <what> | blocker: <token>`
Blocker tokens the script can RESOLVE by itself:
  `none`            — runnable right now
  `codex`           — the Codex baton is not back with claude
  `codex:YES`       — Codex has not returned a YES verdict (a returned baton is NOT approval)
  `win`             — the WinClaude baton is not back with claude
  `david:<what>`    — a decision only David can make (never auto-runnable)
  `after:<id>`      — another queue item must be done first

- [x] rules-artifact | Author + verify the merged rules artifact | blocker: none
- [x] rules-fix-r78 | Codex r78 blocker closed (agent-authored, I verified: 244/244 + pre-fix reproduction) | blocker: none
- [x] rules-receipt | Receipt/evidence INDEPENDENTLY RE-EXECUTED on a fresh harness (canonical 244/244 · full mutants regeneration byte-identical · pre-fix def5231f reproduced at 234/244, ten exact failures) · win 96 push verified by own ls-remote · r79 handed to Codex (flip follows the receipt commit) | blocker: none
- [x] rules-deploy-order | **DEPLOYED 2026-08-03** — order 97 executed, verdict DEPLOYED. Production ruleset `384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1` (523 lines, sha16 f40f91fce3693b82) is BYTE-IDENTICAL to the certified artifact; the P10d trap did NOT ship. **Independently verified by me, not accepted from the report:** re-fetched production read-only (matched the executor's handback exactly) and re-ran the full matrix against THOSE fetched bytes — **262/262 green**. Rollback artifact preserved at live_baseline/firestore.live.PRE_R79_DEPLOY.rules; P10d draft preserved at audit/deepfix/task3/firestore.p10d.rules | blocker: none
- [x] engine-key-provenance-scan | CLOSED — full read-only cohort scan (scripts/deepfix2/engine-key-provenance-scan.mjs, NEW): **41,680 attempts, ZERO carrying any of the four engine keys, 0 quarantine candidates.** Codex r79's qualification is now measured rather than argued. Receipt: audit/deepfix/task3/live_baseline/engine-key-provenance-receipt.json. The artifact COMMENT repair is now DOWNGRADED: with the rules deployed, the claim is true on both legs, so the remaining nicety (cite this scan in the comment) BUNDLES with the next real rules change rather than forcing a comment-only production redeploy | blocker: none
- [x] typed-design | Engine typed-leg DESIGN (18_TYPED_LEG_DESIGN.md — reuse grading_jobs keyed on rv2_{presentationId}) | blocker: none
- [x] typed-fix-audit | CLOSED — cached-grade forgery closed at BOTH seams (usableCachedResults: engine provenance + presentation + answer-sheet hash), A3 completeDay wordId binding, A4 rv2_ replay provenance. Authoring delegated + independently audited (PASS WITH FINDINGS; the audit proved the already_graded sibling was code-true but evidence-free — now pinned by CASE TS + M-A1-SIBLING-CALL-SITE). Evidence re-executed by me: lap 395/395 · 7/7 typed mutants · rules 262/262 · 15/15 rules mutants. **NOT typed-leg readiness — see rv2-docid-collision and NEED_TO_FIX 21** | blocker: none
- [ ] rv2-docid-collision | **REHEARSAL BLOCKER, found by the typed-fix-audit lap (NEED_TO_FIX card 18):** `presentationId` carries no uid (`presentations.js:445` over `composer.js:82-84`) while `attempts`/`grading_jobs` are GLOBAL — so every student in a class derives the SAME `rv2_` attempt id and grading-job key. Pre-A4 the second student was served the FIRST student's grade as a "replay"; A4 now fails that closed. **CORRECTED by audit: NOT "both blocked" — the FIRST student's attempt lands normally (lap:1906/:1913); only the SECOND is refused (lap:1910), recovering by a forced recompose to `_p2`.** Fix = uid-scope the derived ids (attempts AND grading_jobs together). Pinned by the `TR COLLISION` fixtures | blocker: after:typed-fix-audit
- [ ] df2-51-client | Session-flow cutover behind REVIEW_V2_CLIENT. **Two hard prerequisites, both found 2026-08-03:** NEED_TO_FIX 21 must be DECIDED (`grading_in_progress` is returned for a permanent condition while its frozen contract says poll-don't-recompose — building the client against that ships a poll-forever path), and the rv2_ id collision must be fixed or the cutover meets it in a real class | blocker: after:rv2-docid-collision
- [ ] df2-11-teacher-ui | Teacher settings UI (threshold / sizes / rehearsal classes) | blocker: after:df2-51-client
- [ ] df2-07-messaging | Messaging copy on existing screens | blocker: after:df2-51-client
- [ ] rehearsal-25wt | 25WT rehearsal: localhost client → deployed dark backend. **The backend is now FULLY deployed (indexes · functions · config doc · rules), so this is gated on the CLIENT work, not the server** | blocker: after:df2-51-client
- [ ] shadow-audit-16 | Shadow audit | blocker: after:rehearsal-25wt
- [ ] gate4-backfill | THE 26SM BACKFILL | blocker: david:backfill-go
- [ ] gate5-flip | THE FLIP | blocker: david:flip-go
- [ ] gradedIsCorrect-decision | Decide how the backfill treats a client-writable preimage (NEED_TO_FIX) | blocker: david:backfill-trust
- [ ] gradejob-namespace | Reserve the `rv2_` grading-job key prefix inside the LIVE gradeTypedTest (defense in depth; the engine already fails closed without it — NEED_TO_FIX card 2026-08-03). Touches the live grading path for 947 students ⇒ its own fold + deploy order | blocker: after:typed-fix-audit
- [ ] teacher-signup-decision | Remove the public Teacher radio, or scope the grant (NEED_TO_FIX) | blocker: david:teacher-registration
