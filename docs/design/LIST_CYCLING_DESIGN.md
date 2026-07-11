# List Cycling — design discussion (2026-07-08)

**Question:** when a student finishes a full list (twi = list size), how should the app keep them
studying instead of dead-ending? Prompted by the list-completion bug + repeated CS tickets
(최도훈, 안예진, 고아연 — all stuck on a phantom "Day N+1" review after finishing a list).

## The bug being worked around
`isListComplete` (`studyService.js:277`, = `wordsRemaining <= 0`) is **computed but never handled in
the UI**. When a list is complete the allocation yields **0 new words**, but the app still generates a
"Day N+1" whose review can't complete ("pass the new-word test first" — there's no new-word test with
words). → student stuck. (Logged as a NEED_TO_FIX-class product bug.)

## Options considered

### A. `(day − 1) × pace % listSize` — day-based window  ❌ rejected
Drive the word window off the day number, keep twi bounded.
- **Fatal flaw:** `(day−1)×pace ≠ totalWordsIntroduced` whenever pace isn't perfectly constant.
  Intervention reduces daily new-words (`studyAlgorithm.js:107`: `round(pace × (1−interventionLevel))`),
  pace changes on class moves, and CS carry-forwards set twi directly. So the day-based window
  **overshoots and silently skips content** a student never studied. Also a 2nd source of truth that
  drifts from the anchor-derived twi. Unsafe.

### B. `twi % listSize` — wrap the window, twi unbounded, bound only display  ❌ breaks reconciliation
One-line allocation change; single source of truth (twi).
- **Fatal flaw:** wrapping makes `newWordEndIndex` **repeat** (0–1199 each lap). Reconciliation selects
  the anchor by **greatest `nwei`**, so it forever picks end-of-lap-1 (nwei 1199) → twi snaps back to the
  list size → student re-sticks. To fix, reconciliation would need to become **cycle-aware** (cycle
  counter + changed anchor selection) — i.e. touch the flag-gated recon logic we hardened all through
  LIST_SCOPED_RECON. Not simple, not safe.
- Also has a review wrinkle: same `wordId` re-appears already-mastered → review pool goes thin.

### C. Extend the list behind the scenes — duplicate words to positions 1200–2399, 2400–3599  ✅ RECOMMENDED
Make the list physically longer (append laps as fresh word docs); no logic change.
- **Positions stay monotonic** (0→3599) → `twi = nwei + 1` holds, greatest-nwei keeps working →
  **reconciliation unchanged.** twi, gate, review pool, CSD, phase — all unchanged. No deploy.
- Each lap's words are **new wordIds** → lap-2 words are unmastered → **review repopulates naturally**
  (fixes B's wrinkle).
- **Costs:** finite cushion (extend generously — 3× ≫ any course length); duplicate word docs +
  study_state growth (modest); and the ONE real check ⤵.
- **⚠ prerequisite check:** any feature that aggregates by **word TEXT** rather than `wordId` — **Blind
  Spots, gradebook word views, "Full" PDF export** — would show each word 2–3×. If they key off
  `wordId`/position → safe. Must verify before shipping.
- **Don't forget:** bump the list's `wordCount` field to the extended length (so the sweep's
  twi-over-list check and the allocation's `wordsRemaining` use the real length).

### D. New `classId`/`listId` per cycle, retire old, migrate review  ❌ worst
Fork a fresh progress key each cycle.
- **Self-inflicts the class-change reset** (the exact bug behind every carry-forward ticket this week) as
  a routine per-student, per-cycle migration. Plus: assignments are **class-wide not per-student** (can't
  fork a key per student-cycle); migrating review = copying every `study_state` to new wordIds each
  cycle; progress-doc **fragmentation** + orphan/ghost/dup risk; retired `listId` still referenced by
  historical attempts. Maximum blast radius.

## The deciding insight
**Reconciliation breaks whenever `newWordEndIndex` repeats or goes backward.** It re-derives twi as
`greatest-nwei + 1`. Wrapping (B) and forking keys (D) both violate monotonicity; **extending the list
(C) keeps positions monotonic**, so nothing in the recon/anchor/twi chain changes.

## Recommendation
**C — extend the list.** Simplest (data-only, no deploy), safest (touches no counting/recon logic, all
invariants hold), efficient enough (a few thousand extra word docs/list). Gate on the by-word-aggregation
check (Blind Spots / gradebook / Full-PDF). Implement as a small **reversible admin script** that appends
lap-2/3 copies with fresh IDs in order, and bumps `wordCount`.

## Related / still open
- Product bug (list-completion not handled) → NEED_TO_FIX candidate; C is the workaround, a real UI fix
  (auto-advance to next assigned list, or handle isListComplete) is the durable path.
- Stuck students 최도훈 / 안예진 / 고아연 need unsticking regardless (move to next list) — pending owner go.
  최도훈 also holds an erroneous manual Day-16 Base Camp anchor (Base Camp is 1200 = Day 15 complete) to undo.
