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
- [ ] rules-deploy-order | Write + issue the rules deploy order (stage into firestore.rules, verify sha, deploy, re-baseline) | blocker: codex:YES
- [x] typed-design | Engine typed-leg DESIGN (18_TYPED_LEG_DESIGN.md — reuse grading_jobs keyed on rv2_{presentationId}) | blocker: none
- [ ] typed-fix-audit | Typed leg: close the audit BLOCKER (job-key poisoning via live gradeTypedTest) + the cached-grade/answer-sheet binding + Codex r78 item 3 (completeDay: bind engine row wordIds to the server presentation, completion.js:602 — defense-in-depth) + the rv2_ replay-provenance fixture (callables.js:515-533 must fail closed on an unstamped/unclaimed existing doc) | blocker: after:rules-receipt
- [ ] df2-51-client | Session-flow cutover behind REVIEW_V2_CLIENT | blocker: after:typed-fix-audit
- [ ] df2-11-teacher-ui | Teacher settings UI (threshold / sizes / rehearsal classes) | blocker: after:df2-51-client
- [ ] df2-07-messaging | Messaging copy on existing screens | blocker: after:df2-51-client
- [ ] rehearsal-25wt | 25WT rehearsal: localhost client → deployed dark backend | blocker: after:df2-12-13-typed
- [ ] shadow-audit-16 | Shadow audit | blocker: after:rehearsal-25wt
- [ ] gate4-backfill | THE 26SM BACKFILL | blocker: david:backfill-go
- [ ] gate5-flip | THE FLIP | blocker: david:flip-go
- [ ] gradedIsCorrect-decision | Decide how the backfill treats a client-writable preimage (NEED_TO_FIX) | blocker: david:backfill-trust
- [ ] teacher-signup-decision | Remove the public Teacher radio, or scope the grant (NEED_TO_FIX) | blocker: david:teacher-registration
