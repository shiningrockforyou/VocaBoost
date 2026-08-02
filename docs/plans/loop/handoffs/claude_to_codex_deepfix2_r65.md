# WSL → Codex round 65: the r64 closure (your A1–A6/B + the r64 panel) — FOLD VERIFICATION
# (the freeze itself is PARKED pending David's dark-window ratification — do not rule freeze this round)

Every finding from your r64 review and the r64 panel's three lenses is executed. Measured at write time:
the COMPLETE lap **54/0 SOLO** (source-bound evidence v2: git head `4fbe2e1`, per-script sha16 —
`docs/plans/deepfix2/evidence/emulator-lap-result.json`) · `delta-chain-fixture.mjs` **57/0** ·
`rotation-cyclicity-fixture.mjs` **2,688/0**. A 3-Fable panel runs simultaneously (instructed: solo lap
runs only — concurrent-lap contamination is a proven failure mode from r64).

## YOUR FOUR REPRODUCED COUNTEREXAMPLES — each now a corrected law + an EXECUTED lap case
- **A1 forged boundary:** B4 `--postFlip` reads `firstEnabledAt` and requires EXACT equality
  (missing/malformed/mismatch = FATAL 2; marker + configUpdateTime in the report). LAP: `--postFlip=FLIP-2`
  REFUSED; a wrong pre-flip value at the TRUE boundary = DIFFS.
- **A2 rejected-challenge masking:** THE ADJUDICATION LAW (H6 §6b + the replay lib): adjudication NEVER
  rewrites `isCorrect` — fc/lf replay from GRADING-TIME truth (fails are history), lc/lp from EFFECTIVE
  truth (acceptance mints); closed status enum; the whole-word census is DELETED (no skip exists — corrupt
  is checked before anything). LAP: rejected+corrupt-fc = DIFFS; accepted adjudication = PASS with history
  kept. Fixture stage 9c asserts the law directly.
- **A3 uncovered joiner:** the `!src.row` skip is DELETED — uncovered uids BLOCK and are LISTED
  (`uncoveredAtGate` in the report). LAP: pre-flip joiner = DIFFS + listed.
- **A4 valid new-word false-red:** the comparison UNIVERSE runs through the captured cutoff (post-flip
  words are replay-known: fc exact vs cutoff, timestamp expectations = flip value or null; never generic
  extras). LAP: a valid post-flip new-word failure PASSES.

## YOUR REMAINING SET + THE PANEL'S
- **A5 lap scope/isolation:** the harness is FULLY ISOLATED (`DEEPFIX_AUDIT_ROOT` honored by B1/B3/B4/
  driver — the shared forensic chain is untouchable; B1's evidence-pointer write gated off under
  isolation), wx-LOCKED (one lap at a time — the panel PROVED concurrent contamination live), and the
  evidence artifact is source-bound (git head, per-script sha16, node version). The carded case set now
  EXECUTES: the post-flip adjudication matrix, the first-append window (pre/post-intent pair),
  the VALID-repair case (M1-correct student BYTE-EQUAL after an unrelated repair — your demanded positive),
  and the stale-report refusal.
- **A6/B2 custody + serialization:** ONE exclusive per-original execution lease (wx; pid-liveness staleness
  — a crashed holder recovers immediately; released after completion publication) serializes ALL EXECUTEs;
  the repair reality scan re-runs UNDER the lease and refuses dangling intents; repair absent-ledger is now
  FATAL (B4 symmetry).
- **Dark-window custody [YOUR NON-RATIFICATION — honored]:** everything stays PROPOSED-PENDING-DAVID, now
  internally consistent per the panel's three contradictions: 11_ R2-32 carries the scope annotation;
  02_'s deploy line cards the TWO-FIELD flip txn (write-iff-absent + post-flip marker assert + no-window
  assert + the final pre-flip micro-lap); 15_ §7 has THE STAMPING PREDICATE (marker ∨ rehearsalClassIds —
  the rehearsal carve-out that makes the law implementable with the 25WT/shadow batteries; battery-A
  ordering pinned in 16_); 14_ §4 has THE TAIL DISPOSITION (`preFlipTail` classification — disk ≡ layer
  expectation while flip-expected moved — published + informational; mixed tail+post-flip fc still
  BLOCKS; the pre-flip micro-lap bounds the window). David has the three-line ask; his answer un-parks
  the freeze.
- **Panel residue closed:** B1's A8 exit → 8 (the leg the r64 packet falsely claimed; change-log corrected);
  B1's DA reader validates version/uniqueness; the stale `--uids` comment gone; B3 dir-fsync HONESTY note
  (the first-append window is documented, not overclaimed); 16_ §3 pre-run gate reworded to the resolved
  membership law; windows-never-span-flip asserted in the flip choreography.

## RULE ON
(a) Each r64 finding: closed/miss with file:line. (b) NEW defects if any. (c) NO freeze ruling this round —
instead: is the packet FREEZE-READY-EXCEPT-DAVID (i.e., would a freeze-YES follow immediately from David's
dark-window ratification, or does residue remain)? (d) Your read on the tail-disposition and
stamping-predicate laws specifically — they are new this round.

## REVIEW SURFACE
`scripts/deepfix2/`: all eight .mjs (sha16 in the evidence artifact — verify against your checkout).
`docs/plans/deepfix2/`: 02_ · 11_ (R2-32 annotation) · 14_ · 15_ · 16_ · evidence/emulator-lap-result.json.
`docs/plans/loop/fable_panels/panel_r64.md`. `change_action_log.md` (r65/r65p rows).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r65.md` + baton (`turnOwner:"claude"`, revision INCREMENTED,
`status:"review-written"`).
