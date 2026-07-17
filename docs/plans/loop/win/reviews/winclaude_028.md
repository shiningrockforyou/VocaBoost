# WINCLAUDE round 28 — flag-ON M-UI — ⛔ BLOCKED (harness gap, not a permission gate)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `WINCLAUDE_TASK6_FLAGON_MUI`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_028.md`
- **run:** 2026-07-17T17:15Z (investigation only — nothing executed)
- **execDecision:** `BLOCKED` — flag-ON M-UI **against the emulator** is structurally blocked in-env: the M-UI harness has no emulator seeding/awareness. This is a **harness gap for WSL-Claude to fill** (NOT a David-permission gate, NOT a source-app defect). Per the handoff, reporting precisely rather than improvising a risky path.

---

## What I did (investigation only — flipped NOTHING)
Per the handoff's "don't improvise a risky path; say precisely what's blocked," I inspected the choreography feasibility **before** flipping any flags or starting any server. **No flags flipped, no dev server/emulator started, nothing to restore.** (The `src/config/featureFlags.js` working-tree diff you'll see is *your* ongoing implementation work between rounds — not from me.)

## The blocker — three confirmed facts
**1. App-side emulator support EXISTS ✅** — `src/firebase.js:47-58`: `if (import.meta.env.VITE_USE_EMULATOR === 'true')` connects Firestore(8080)/Auth(9099)/Storage(9199)/**Functions(5001)** to the emulator, with an explicit `[deepfix flag-on E2E]` comment wiring the Functions emulator "to validate flags-ON end-to-end." So the client mechanism is ready.

**2. The M-UI harness is HARD-WIRED to PROD sandbox fixtures ❌** — `lsr_deepfix_ui.mjs`:
- has **zero** emulator awareness (grep for `EMULATOR`/`emulator`/`VITE_USE_EMULATOR`/seed → nothing).
- reads **prod** teacher-clone list doc IDs from `lsr_lists.json` (line 62: `listsFile = JSON.parse(readFileSync('lsr_lists.json'))`; line 66: `chosen.newId`) — e.g. `EQ0Dc9rb7gvoerflHlnz`, `0HrPB6ejvDxQ16arUh7C` — and drives the browser to select those exact IDs.
- assumes the `lsr_*@vocaboost.test` roster, `lsr_teacher_02`, its clones, and 25WT classes already exist (they do — **in prod**).

**3. `scripts/seedEmulator.js` does NOT cover these fixtures ❌** — it seeds only **generic** dev data (a single generic teacher/student/list via `createUser`/`createWordList`/`createClass`); no `lsr_*` roster, no `lsr_lists.json` clone IDs, no 25WT classes.

**⇒ Net:** point the dev server at a fresh emulator (`VITE_USE_EMULATOR=true`) and the harness fails immediately — the `lsr_*` accounts don't exist in emulator Auth, and the `lsr_lists.json` clone list docs don't exist in emulator Firestore. The scenarios (RS-3/CA-*/CY-*/OV-*/CUT-* — all present in the harness) can't reach a valid state.

## Why I did NOT improvise the two "obvious" workarounds
- **Run flag-ON M-UI against PROD Firebase (flags on, `VITE_USE_EMULATOR=false`)** — contradicts the handoff's explicit "against the emulator," AND would route the new server write-paths (`completeSession`/`reviewChallenge`/`overrideAttempt`/progress writes) against **prod** data. That's flag-ON behavior on production — exactly the risky path the handoff says not to improvise.
- **Hand-seed the emulator myself** — building an emulator-seeding step (recreate the `lsr_*` roster + `lsr_teacher_02` clones keyed to `lsr_lists.json` IDs + 25WT classes) is a **harness change**, which is executor-out-of-scope (§2: no matrix/harness edits) and would be improvising.

## For WSL-Claude — exactly what's needed to unblock (your build)
The client side is ready (`VITE_USE_EMULATOR`). What's missing is an **emulator seeding + emulator-aware M-UI path**:
1. An **emulator seed** that recreates the sandbox fixtures the harness needs, in the emulator Firestore/Auth: the `lsr_*@vocaboost.test` accounts (Auth `createUser`), `lsr_teacher_02` + its cloned list docs **keyed by the exact `lsr_lists.json` `newId` IDs** (or make the harness resolve list IDs *after* seeding rather than from the static prod file), and the 25WT classes. `scripts/seedEmulator.js` is a starting point but seeds the wrong (generic) fixtures.
2. Make `lsr_deepfix_ui.mjs` (or a wrapper) **emulator-aware**: start the flag-ON dev server with `VITE_USE_EMULATOR=true`, and route its Admin-SDK oracle to the emulator (`FIRESTORE_EMULATOR_HOST`, which `emulators:exec` sets for a child) so the oracle reads the same emulator data the app writes.
3. Then hand me the exact one-command choreography (ideally wrapped in `lsr_deepfix_flag_on.mjs --exec` so the flag-restore is guaranteed, like M-CALL).

**Alternative to consider (your call):** M-CALL already certified the server callables flag-ON on the emulator (r27 CLEAN 21/0/0). The unique remaining value of flag-ON M-UI is the **client render/routing** (RS-3 assigned-lists surface, CUT client→server routing). If full emulator-seeding is too heavy, you may decide M-CALL's emulator coverage + the flag-OFF M-UI passes suffice for the cert — or scope the flag-ON M-UI seed down to just RS-3/CUT.

## Executor discipline / hygiene
Executor-only, no source/matrix/flag edits. Read-only investigation only (greps + code inspection). No flags flipped (nothing to restore). No dev server/emulator started. No 26SM/prod contact. No commits/branches/deploys. This is a **harness capability gap** — not a permission gate; **no David ask this round** (the deploy-auth question from r27 is still separately open, unchanged).

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_028.md`.
- `baton.json` → `turnOwner="claude"`, `round=28`, `execStatus="run-written"`, `execDecision="BLOCKED"`, `updatedBy="winclaude"`, `revision=56`.
- Watcher re-backgrounded at baseline 56.
