# RESUME — DEEPFIX2 (2026-08-04: the CLIENT CUTOVER is DONE — a·b·c·d + dashboard + df2-11 all committed, audited, most visual-CLEAN)

## ⚡ FIRST ACTION — arm the monitor, then session-start, then READ THE BATON
```
Monitor({command: "bash /app/scripts/deepfix2/baton-monitor.sh",
         description: "DEEPFIX2 baton returns (win + codex)", persistent: true, timeout_ms: 3600000})
```
Then `bash scripts/deepfix2/session-start.sh`. **The win baton is IDLE with claude** (order 103 returned
CLEAN and was FOLDED last session — both visual checks closed; all commits pushed, `origin/main == e37fe76`).
Nothing pending on WinClaude. Confirm `docs/plans/loop/win/baton.json` (turnOwner=claude, rev 200), then
pick up the queue.

## OPERATING MODEL (CLAUDE.md "DELEGATE, KEEP JUDGMENT")
Delegate implementation to the **`implementer`** agent-def (Sonnet; `model: opus` at spawn for a live-path/
security/data fold) from a WRITTEN BRIEF + a fold ledger. Verify live-path/shared work with the independent
**`auditor`** agent-def (Opus, no Edit/Write — re-executes the evidence, returns GO/NO-GO); read the verdict,
not the diff. Scale it: a small flag-gated client fold can stop at orchestrator level-4 self-verification
(re-run the evidence + confirm byte-identity), as `dashboard-streak-authority` did. Set **`[>]`** before
delegating; **`[~]`** = carded. Durable ledgers live in `docs/plans/deepfix2/_ledgers/`. Stage EXPLICITLY.

## WHERE THINGS STAND
**Nothing is deployed; nothing is activated.** `REVIEW_V2_CLIENT=false`. Production functions STALE at
`b54c6e5`; rules DEPLOYED at `f40f91`. Committed ≠ deployed — the committed `firestore.rules`/`functions`
(sha16 `4d8e511b`, namespace guard) ship later via `functions-deploy-engine` (David/Codex-gated).

**THE CLIENT CUTOVER IS COMPLETE (all committed, local; nothing deployed).** Every fold flag-OFF byte-identical:
- cutover-a/b/c/d (compose·submit·complete·refusals) — auditor-verified GO, **visual-CLEAN win 101+102**.
- `f60ebf7` **dashboard-streak-authority** (NTF-25) — Dashboard reads the account-wide server streak behind
  the flag; orchestrator level-4 verified (pure 32/0, mutants 2/2, `calculateStreak` byte-identical). VISUAL owed.
- `1c05038` **df2-11 teacher review-settings** — review-settings group in BOTH teacher modals + BOTH writers +
  the ClassDetail read card, behind the flag; **independent OPUS auditor GO** (pure 42/0, mutants 6/6,
  reviewGateEnabled default-TRUE confirmed). VISUAL owed. `reviewSettingsAuthority.js` mirrors config.js.
- `54d98a2` **NTF-23 verified**: the legacy cached-grade cross-student vector is fenced (uid throw + client-
  write-denial + namespace reservation); shrinks to an off-critical-path defense-in-depth card (Codex ratifies).

## RECENTLY CLOSED (nothing in flight)
- **win order 103 — CLEAN, FOLDED** (both `dashboard-streak-authority-visual` + `df2-11-teacher-ui-visual`
  closed): flag-OFF, the Dashboard loads + streak renders unchanged; BOTH teacher modals show today's Min/Max
  (NOT the new group), the Edit-modal save was exercised, the read card has no review block. 0 console errors.
  WinClaude also PUSHED all local commits (`origin/main == e37fe76`). ⇒ **The client cutover is now COMPLETE
  end-to-end: code + independent audit + browser, all CLEAN.** No WinClaude work pending.

## PENDING — DAVID (the real bottleneck for the rehearsal → flip)
- **NTF-26** — the LEGACY typed grader marks garbage 100% (root-caused to Haiku prompt leniency; win-102 MCQ
  scored 32% ⇒ TYPED-specific, not DEEPFIX2-caused). Gates the deploy content. Options: (a) I prep the fix
  (prompt negatives + regression + same-answer heuristic), committed-not-deployed, you deploy; (b) a
  wrong-but-plausible typed probe first; (c) card it. **Your call.**
- **`functions-deploy-engine`** (deploy the engine — the rehearsal runs against the DEPLOYED dark backend),
  **backfill-go · flip-go · gradedIsCorrect-trust · teacher-registration · the flip abort-threshold RATIFY.**

## NEXT — AUTONOMOUS (`node scripts/deepfix2/whats-next.mjs` is authoritative). All NON-gating polish.
- **`df2-07-messaging`** — SCOPED (a real fold, not a swap; see the queue row): (a) threshold copy threads
  `retakeThreshold` through 4 SessionProgressSheet sites + genericize HelpModal (:212 mislabels Review at 95%
  when review=92); (b) review-only reason banner = NET-NEW UI (heavy, own design); (e) delete the 30% throttle
  passages from help HTML + TA docs. Suggested split: bounded (a/d/e) + a separate (b/c) fold.
- **`df2-51-navui`** — the past-day browser + within-day toggle (retests, metered). Bigger new-nav feature.
- **`dashboard-df2-33`** — hero/per-list presentation unification; owes a David decision (read-only assembly variant).
- **Deploy prep** (ordering-deploys) — can PREPARE the order, but content depends on NTF-26; David executes.
- `namespace-legacy-cache-23` `[~]` — carded defense-in-depth; Codex checkpoint ratifies the shrink.

## CRITICAL PATH to the rehearsal (why the autonomous folds don't unblock it)
`df2-11 ✓ → playwright-suite (now unblocked, but runs against the DEPLOYED dark backend) → rehearsal-25wt`
AND `functions-deploy-engine (David) → b0-baseline`. Both prerequisites are WinClaude/David-gated — the
remaining autonomous UI folds pre-position the UI side but do NOT unblock the rehearsal alone.

## STANDING FACTS
- Dev build talks to REAL production Firebase (`VITE_USE_EMULATOR=false`) ⇒ UI checks use 25WT ONLY, never
  26SM. Typed tests bill real AI tokens (David OK'd ≤200 on 25WT).
- WSL cannot run vite or git push ⇒ both are WinClaude orders. Every UI fold ends with a WinClaude visual order.
- A concurrent session shares this repo (`.claude/settings*.json` are THEIRS, always `M`) ⇒ stage explicitly,
  never `git add -A`. The gate's NUMBERS/EVIDENCE reds against `engine-lap-result.json` + `audit/deepfix/task3`
  are FOREIGN/pre-existing (re-run at the engine deploy) — enumerate them, don't chase them.
- Before scoping a fold from a one-line queue entry, READ THE FULL SPEC — df2-11 and df2-07 were both bigger
  than their queue lines (launch-train live surfaces, not quick wins).
