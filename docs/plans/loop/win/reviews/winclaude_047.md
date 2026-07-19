# WINCLAUDE round 47 — D3.5 CRITIC PASS R4 (confirm-only, feasibility) — ✅ FEASIBLE

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`. Verify + report only.
- **taskId:** `WINCLAUDE_D35_CRITIC_R4_CONFIRM` · **execDecision:** `FEASIBLE` (round-3 rows buildable; my caveats folded verbatim; one new feasibility caveat on B34's error-injection mechanism — a build-time spike, not a blocker).

## My r46 caveats — folded FAITHFULLY (confirmed)
- **CAT-3 → representative subset + server-side-outcome-over-UI-timing:** folded verbatim (plan line 461). ✓
- **B28 token-expiry → can't-be-triggered-deterministically / callable-authoritative:** folded (line 461). ✓

## Round-3-folded rows — buildable
- **F23** (F02 prefer-active-progress: active list A vs newer-assigned B → focus A), **F25** (multi-list-one-class: `getPrimaryFocus` recency picks a coherent card), **F24** (F01 mastered-word review exclusion) — all seed-progress + drive-dashboard-in-tier-3 patterns I've used; buildable (F24 needs the `study_states` mastered/retired schema — a code-read, moderate). ✓
- **F26** (baked sessionConfig threshold, mitigation-canary observe/never-STOP) — buildable via the white-box `patchSessionConfig`; correctly observe-only. ✓
- **B35** (teacher config mutation vs live session — unassign/reassign) — multi-actor admin-write via B31's guarded wrapper while a student browser is open; buildable, moderate-high effort. ✓
- **S8 BlindSpotCheck** (`/blindspots/:classId/:listId` — a whole routed 30-word MCQ test surface) — buildable once the F-a MCQ driver exists (same test shape); reaching the route is a nav. ✓
- **E7** (`W3MUFXDb` 2nd known-orphan-write, not seedable) — correctly **observe-only**, not a build item. ✓

## Hardened guard / pin — implementable (confirmed)
- **M-B flag-pin now complete:** enumerates all 7 D2 incl. **`RECOVERY_SCORE_CLAMP_ENABLED`** + **`REVIEW_ENGAGEMENT_STAMP_ENABLED`** — the exact two my r42 p4cert posture already asserts. The plan correctly notes `readFlagState()` (`lsr_deepfix_emu.mjs:314-343`) OMITS those two → **concrete build note: extend `readFlagState` by 2 flags (or read from source directly, as my p4cert does).** Trivial, feasible. ✓
- **S-A join = PRE-write check** (join is detect-AFTER-write at `db.js:1038`) → assert the code maps to a run-minted class *before* submitting the join. Implementable (validate the minted joinCode/classId set before the UI join action). ✓
- **S2 rewrite map += `testId` + `teacherIds[]`** (P10c real-teacher-uid array, dormant-but-latent) — implementable (rewrite both to the sandbox teacher). ✓ · **S-C one-prefix** — fine.

## ONE new feasibility caveat (build-time spike, not a blocker)
- **B34 "make ONE per-`{classId}_{listId}` progress read ERROR" — the *injection mechanism* is underspecified and non-trivial headless.** The Firestore web SDK **multiplexes reads over a persistent channel** (hard to abort exactly one document's read by URL), and the student **can read their own `class_progress`** (so no natural permission-race error). The **fail-close *behavior*** (no auto-focus, Start disabled, retry card — Dashboard.jsx:805/1761) is worth testing, but inducing the single-doc error needs a concrete recipe. **Fix (pick at build time):** (a) a **spike** to check whether the per-class `getDoc` issues a distinguishable request `page.route` can abort (works only if the SDK isn't multiplexing that read); else (b) seed a `class_progress` doc shaped so the F02 progress-load's own validation treats it as errored/invalid (if such a branch exists); else (c) prove the fail-close at the component/callable layer. Flag B34 as "behavior high-value, injection needs a spike."

## Verdict
**FEASIBLE.** All round-3 rows buildable with established patterns; the hardened guard + the completed flag-pin are implementable (the pin is literally my r42 code); my CAT-3/B28 caveats are folded verbatim. **No surviving gap, no NEW hard blocker** — only B34's error-injection needs a build-time spike. Tier-3 wall-clock will still run over the estimate.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_047.md`.
- `baton.json` → `turnOwner="claude" round=47 execStatus="run-written" execDecision="FEASIBLE" updatedBy="winclaude" revision=94`.
- Watcher re-armed at baseline 94.
