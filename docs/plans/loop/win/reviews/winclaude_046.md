# WINCLAUDE round 46 — D3.5 CRITIC PASS R3 (feasibility re-confirm on regenerated plan) — ✅ FEASIBLE

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`. Verify + report only.
- **taskId:** `WINCLAUDE_D35_CRITIC_R3` · **execDecision:** `FEASIBLE` (all new/changed scenarios buildable + the hardened guard/flag-posture implementable; two feasibility caveats, no NEW blocker, no surviving gap).

## New/changed scenarios — buildability (my "can it be built + run" lens)
- **B23 storage-block/cleared mid-test — BUILDABLE (proven pattern).** The white-box harness already ships `armStorageKill` (`lsr_deepfix_whitebox.mjs`: patches `Storage.prototype.setItem` to throw on BOTH localStorage+sessionStorage) + `page.evaluate` clear + `addInitScript` for cold-start-with-storage-disabled. The idempotency-keyed-on-(student,day,type) assertion is server read-back. ✓
- **B24 two isolated CONTEXTS (phone+PC) — BUILDABLE (trivial).** `browser.newContext()` ×2 = isolated storage/nonce; submit same test from both; assert one advance / no double-count. (Distinct from a two-tab test — correct.) ✓
- **B25 results-screen nav (stuck A3 / list-end A6) — BUILDABLE.** Drive a test to the TestResults screen, click each button (Practice again / Continue / challenge), assert routing (no dashboard-bounce loop). Depends on the F-a MCQ/typed driver + F-b seed-render (already scoped). ✓
- **B30 mobile 375px + touch — BUILDABLE (trivial).** `newContext({viewport:{width:375}, hasTouch:true, isMobile:true})`; assert `boundingBox` in-viewport + tappable + modal fits. Parameterize B1/B3/B12/B20/B25's viewport. ✓
- **B-SCREENS S1–S7 + CAT-3 challenge round-trip — BUILDABLE but the HIGHEST-effort/fragility of the whole audit** (see caveat 1).

## Hardened guard + flag-posture pin — IMPLEMENTABLE (one is already proven by me)
- **Hardened prod-seeder guard (S1 fix): implementable.** A per-write wrapper: `uid ∈ this-run minted-sandbox allowlist` (in-memory set, populated as the run mints `lsr_` uids) ∧ `classId` `lsr_`-prefixed ∧ path ≠ `lists/{realListId}` ∧ **fail-closed on ABSENT fields**. Straightforward (a stricter variant of the `assertSandboxTarget` I already use). **Key build detail confirmed sound:** classes must be **admin-minted with `lsr_`-prefixed ids** (prod UI-created classes get random ids like `vTN0kl…`, which the guard would reject) — so seeder creates the class via Admin with a joinCode; the student joins by code (S4 asserts the joined classId ∈ the run's created set). Feasible. ✓
- **Flag-posture pin (tier 1): PROVEN implementable — I built exactly this in r42.** My `lsr_deepfix_p4cert.mjs` reads the loaded flags from source and asserts `postureMatchesProd` (`FORCED_PATHWAY_ENABLED=true` + epoch `1784333239063` + 7 D2 true + `LIST_PROGRESS_CANONICAL=false` + `ANCHOR_VALIDATION_ENFORCE=false`); a mismatch = the r34 failure class. Same code applies here. ✓

## TWO feasibility caveats to flag (not blockers — effort/mechanism)
1. **CAT-3 (challenge round-trip student↔teacher) is the highest-risk new build.** It compounds every hard bit at once: a **second coordinated browser (teacher)** + the **results-dispute UI** + the **Gradebook challenge-accept UI** + a **score-recompute-across-the-pass-threshold** assertion + "does the student's day unlock." Buildable, but the most likely to be flaky. **Fix/scope:** run CAT-3 (and B-SCREENS S1/S2 challenge legs, B8/B9/B22) on a **representative subset**, not per-student; budget extra wall-clock; assert the server-side outcome (score/token/day) as the source of truth over UI timing.
2. **B28 (auth-token expiry mid-test) is hard to trigger deterministically.** A Firebase **ID token is valid ~1h**, and `admin.auth().revokeRefreshTokens(uid)` does NOT invalidate the already-cached ID token immediately — so you can't naturally "expire it mid-test" in a short run. **Fix:** either inject an expired/garbage bearer by overwriting the SDK's IndexedDB token via `page.evaluate` (fiddly), or exercise it at the **callable level** (send `completeSession` with an invalid/expired bearer → assert graceful 401 + no lost attempt + correct modal, not a false "answers saved"). Flag B28 as best-effort-UI + callable-authoritative.

## Endorsements (cross-lens, affect executability — sound)
- The **156** count correction + backups being `class_progress`-only/pre-fix-07-15 while the full backup is post-fix-07-17 matches my r1 GAP-2/3 exactly; provenance-per-student (`SYNTHETIC_FROM_TICKET`) is the right honesty. ✓
- `INVALID_PRECONDITION` verdict + server-path-proof-per-tier-3-fixed-scenario (M7/M8) are the right guards against false-PASS/FAIL. ✓
- B31 (CS-intervention vs live session) + B32 (phantom/nulled recentSessions render) + B33 (submit-after-reset) — buildable (admin write during an open browser session + read-back), moderate effort.

## Verdict
**FEASIBLE.** All new/changed scenarios are buildable with established patterns (two — flag-posture pin + storage-block — I've already built); the hardened guard is implementable; **no surviving gap from r1/r2, no NEW hard blocker.** The two caveats (CAT-3 multi-actor effort, B28 token-expiry mechanism) are scope/mechanism notes. Tier-3 wall-clock will still run over the estimate — plan for it.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_046.md`.
- `baton.json` → `turnOwner="claude" round=46 execStatus="run-written" execDecision="FEASIBLE" updatedBy="winclaude" revision=92`.
- Watcher re-armed at baseline 92.
