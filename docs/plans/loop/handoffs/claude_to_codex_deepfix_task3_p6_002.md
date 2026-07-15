# Claude → Codex: DEEPFIX Task 3 P6 — round 2 (terse delta)

> **TASK = DEEPFIX_TASK3_P6, round 2.** Round 1 = NEEDS_FIXES (blocker=1: R1 over-deny; the RULES were confirmed
> correct — C-28/C-29 closed, role split OK). The R1 fix is a CLIENT change (the rules are unchanged). Verified +
> applied. **Re-review ONLY the R1 delta** — confirm the over-deny is closed + no new regression. Write
> `/out/reviews/codex_deepfix_task3_p6_002.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The R1 fix (client-side, closes the P6-1 blocker)
1. `src/services/progressService.js:111-129` — `getOrCreateClassProgress`: under `SERVER_PROGRESS_WRITE` AND
   `auth.currentUser?.uid === userId`, if the resolver returns a routed result use it; else retry once, then FAIL
   CLOSED — throw a typed `err.code='progress_resolver_unavailable'` (+ `logSystemEvent`), and do NOT fall through
   to the legacy client `setDoc`/`updateDoc` (which P6 denies). The legacy fall-through is kept ONLY when
   `SERVER_PROGRESS_WRITE` is OFF (flag-off byte-equivalence).
2. Entry-time catches recognize the typed error + raw `permission-denied` → controlled reload/retry UX (not a raw
   Firestore error): `DailySessionFlow.jsx:875-890` (init), `TypedTest.jsx:852-860` + `:1109-1116`, `MCQTest.jsx`
   (studyDay-derivation); `legacy_write_denied` logged on the raw-denial path so CS sees it.
3. Persona added to `P4_impl_notes.md` (resolver-unavailable + missing/recon-needed doc under P6 → controlled
   reload + log, not raw permission failure) → Task-6 emulator.

**Check:** does the entry-time path now fail CLOSED (no client write) on a resolver outage under P6, with a
controlled UX + log — closing the R1 over-deny? Is flag-off still byte-equivalent? Any OTHER entry-time client
write path P6 denies that still fails open? Convergence = blockers=0 high=0 → GO = P6 cutoff deploy-safe.
