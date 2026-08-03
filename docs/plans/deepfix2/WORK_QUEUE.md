# DEEPFIX2 WORK QUEUE — machine-read by `scripts/deepfix2/whats-next.mjs`

Format (one per line, parsed):  `- [ ] <id> | <what> | blocker: <token>`
Blocker tokens the script can RESOLVE by itself:
  `none`            — runnable right now
  `codex`           — the Codex baton is not back with claude
  `win`             — the WinClaude baton is not back with claude
  `david:<what>`    — a decision only David can make (never auto-runnable)
  `after:<id>`      — another queue item must be done first

- [x] rules-artifact | Author + verify the merged rules artifact | blocker: none
- [ ] rules-deploy-order | Write + issue the rules deploy order (stage into firestore.rules, verify sha, deploy, re-baseline) | blocker: codex
- [x] typed-design | Engine typed-leg DESIGN (18_TYPED_LEG_DESIGN.md — reuse grading_jobs keyed on rv2_{presentationId}) | blocker: none
- [ ] df2-12-13-typed | Typed-test durable grading — IMPLEMENT 18_'s design + the typed emulator battery | blocker: none
- [ ] df2-51-client | Session-flow cutover behind REVIEW_V2_CLIENT (compose→submit→complete with legacy fallback) | blocker: none
- [ ] df2-11-teacher-ui | Teacher settings UI (threshold / sizes / rehearsal classes) | blocker: none
- [ ] df2-07-messaging | Messaging copy on existing screens | blocker: none
- [ ] rehearsal-25wt | 25WT rehearsal: localhost client → deployed dark backend | blocker: after:df2-12-13-typed
- [ ] shadow-audit-16 | Shadow audit | blocker: after:rehearsal-25wt
- [ ] gate4-backfill | THE 26SM BACKFILL | blocker: david:backfill-go
- [ ] gate5-flip | THE FLIP | blocker: david:flip-go
- [ ] gradedIsCorrect-decision | Decide how the backfill treats a client-writable preimage (NEED_TO_FIX) | blocker: david:backfill-trust
- [ ] teacher-signup-decision | Remove the public Teacher radio, or scope the grant (NEED_TO_FIX) | blocker: david:teacher-registration
