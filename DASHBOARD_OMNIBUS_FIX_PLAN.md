# Dashboard Omnibus Fix — Plan (v1)

**Status:** DRAFT for review (3 internal agents + Codex). Nothing implemented. Nothing committed.
**Author:** Claude (orchestrator) · **Date:** 2026-06-21
**Covers every issue from the live adversarial audit + the class-selector feature, in one plan.**

---

## 0. What this fixes — the issues that arose (and the honest re-scoping)

The live audit (production @ 7b5010e) surfaced findings I initially mis-attributed. After deep investigation, the **real** picture:

| ID | Issue as first seen | Verified root cause | Real? |
|---|---|---|---|
| **F1** | `careful_01_top`: dashboard hero shows "STEP 1 OF 2 / Start new words" but the session is "Review Study — Day 28" | **Render race, NOT the orphan doc.** `fetchUserAttempts` does an **uncached `getDoc(lists/{listId})` per attempt** (`db.js:~2472`) → careful's 70 attempts = ~70 sequential reads = multi-second load. `panelCState` (`Dashboard.jsx:1192-1225`) computes the hero phase from `userAttempts`, which starts `[]`; during the load window `determineStartingPhase([], csd+1)` → defaults to `NEW_WORDS_STUDY` → hero shows "Start new words." Replication proves: with loaded data the phase computes correctly to `REVIEW_STUDY` (matches the session). Light-attempt personas (rushed) load fast → no symptom. | **YES — real, intermittent, worse for heavy-attempt students** |
| **F2** | "13 real students with orphan/duplicate `class_progress`" | **OVERSTATED.** Re-query: all 12 affected uids are `@vocaboost.test` **audit personas**; **0 real students**. The orphan docs have docId = `{classId}` only (not the live `{classId}_{listId}`), with `auditReset`/`studentId` field signatures → written by the **audit seed/reset scripts** (2026-05-30), not live app code. **No code path reads them** (every read uses the composite docId via `getClassProgress`; grep found zero field-queries on `class_progress`). So they are **inert cruft**, not a production bug. | **NO (not a prod bug) — just audit data hygiene** |
| **F3** | Class selector requested (dual-enroll legibility + revive class switching) | Feature. Plan already audited → `DASHBOARD_CLASS_SELECTOR_PLAN.md` (v2). | feature |
| **F4** | Failed-fetch console errors while offline | Cosmetic; the app already recovers when back online. | low |

**So the actual fixes:** F1 (real correctness+perf), F2 (one-time audit-data cleanup, no prod code change), F3 (the selector feature), F4 (optional polish).

### ⚙️ LOCKED SCOPE (owner, 2026-06-21): **F1 + F3 only.**
- **F2 (audit-cruft cleanup) — SKIPPED.** The orphan docs are inert (0 real students, read by nothing); not worth touching. (If audit personas ever need it, a throwaway cleanup script can run later — out of scope here.)
- **F4 (offline console noise) — SKIPPED** (cosmetic).
- **F1 loading UI — SKELETON/muted placeholder** (never show a guessed actionable CTA).
This plan therefore implements **§1 (F1)** and **§3 (F3)** only; §2/§4 remain documented for context but are not built.

---

## 1. F1 — Hero phase race (the real `careful` bug) — TWO parts

### 1a. Correctness: gate `panelCState` on `userAttempts` loaded
`userAttempts` starts `[]` (`Dashboard.jsx:251`); `panelCState` derives the hero phase from it (`:1207,1219,1225`) with **no loading distinction** — an empty array during load is treated identically to "genuinely no attempts," defaulting the CTA to "Start new words."

**Change:**
- Add `userAttemptsLoading` state (set true before `fetchUserAttempts`, false in its `finally`). *(Verify the fetch site — it's in the effect around `:340-350`.)*
- `panelCState` returns a **`loading: true`** (or `phase: null`) result while `userAttemptsLoading` (and/or `progressData` not yet populated for the focus key).
- The hero IIFE (`Dashboard.jsx:~1300`) renders a **neutral loading affordance** for the CTA column when `panelCState.loading` (e.g., a muted "Loading today's plan…" or a skeleton) instead of asserting a phase. Only show the New/Review/Complete CTA once attempts are loaded.

**Why not just "default to review":** we must not *guess* either direction; the honest state during load is "unknown." A brief skeleton is correct and avoids a wrong actionable CTA.

### 1b. Performance: kill the N+1 in `fetchUserAttempts`
`fetchUserAttempts` (`db.js:~2442-2500`) loops attempts and, for each, does `await getDoc(doc(db,'lists',listId))` to get the list title — **uncached**, so K attempts on the same list = K reads. careful = ~70 sequential reads.

**Change:** build a **`listTitleCache = new Map()`** (and the class lookup is already cached). Before/within the loop, resolve each unique `listId`'s title once (fetch unique listIds up front, or memoize on first miss). Turns O(attempts) reads into O(unique lists). Shrinks the F1 load window from seconds to ~instant for heavy students.

**Risk:** low; pure read-path optimization, output shape unchanged. esbuild + verify careful's attempts still return correct titles.

---

## 2. F2 — Orphan/duplicate `class_progress` (audit-only cleanup, NO prod code change)

**Scope (verified):** 12 audit personas, 13 orphan docs (docId=`{classId}`, `totalWordsIntroduced` missing, `csd>0`), all on the two 25WT sandbox classes, created by the seed/reset scripts on 2026-05-30. **0 real students.** No live code reads them.

**Change:**
- **One-time cleanup script** (admin, `scripts/`, NOT committed): for each affected audit user, delete the malformed `class_progress` doc whose **docId === classId** (i.e., docId !== `{classId}_{listId}`), keeping the correct composite-key doc. Snapshot every deleted doc to a restore file first; verify the composite doc survives with real TWI.
- **No production code change** (the dashboard already reads only composite docIds — confirmed safe).
- **Optional hardening (decision §6.1):** patch `scripts/seed-audit-students.js`/reset to write `class_progress` with the correct composite docId + a real `totalWordsIntroduced`, so future seeding doesn't recreate cruft. (Scripts are untracked dev tooling, not prod.)

**Explicitly NOT doing:** no defensive "dedupe in `getClassProgress`" (it reads by docId; there's nothing to dedupe) and no migration over real students (none affected).

---

## 3. F3 — Class selector (feature)

Implement per **`DASHBOARD_CLASS_SELECTOR_PLAN.md` v2** (already 3-agent-reviewed; corrections locked in its §9): `FocusControl` label-or-dropdown, Class + List controls, null-safe gate, `handleClassSelection` same-class assertion, `pickPrimaryList` reading `klass.assignments[listId].assignedAt`, borderless label visual, welcome-row layout (gap/truncate), a11y (ESC/outside-click/mutual-close), cleanup of `showListSelector`/`availableLists`.

**Interaction with F1:** the edits are in **disjoint line ranges** (F1: `panelCState` + hero CTA `:1325-1362`; F3: welcome-header selector `:1255-1284` + derivations `:258-288`) — no collision, either order works. The selector gates ONLY on **`getPrimaryFocus && classOptions.length > 0` + settings/student-classes readiness** (§9.13) — it must **NOT** gate on `userAttemptsLoading`/`progressDataLoading` (those are the F1 hero-phase races; the selector is independent of attempts/progress — `getPrimaryFocus` deps are `[studentClasses, userSettings]` only, `:971`).

---

## 4. F4 — Offline console noise (optional, low)
While offline, failed `fetch`/Firestore calls log console errors. The app recovers on reconnect. **Optional:** wrap the few user-initiated fetches in try/catch that swallow-and-log-once, or detect `navigator.onLine`. Recommend **defer** unless you want it now — purely cosmetic, no user-facing breakage.

---

## 5. Files / blast radius
- `src/services/db.js` — `fetchUserAttempts` list-title cache (F1b).
- `src/pages/Dashboard.jsx` — `userAttemptsLoading` + `panelCState` loading gate + hero loading affordance (F1a); the class selector (F3, per its plan); (F4 if included).
- `scripts/` (untracked) — one-time F2 cleanup; optional seed-script hardening.
- No backend/session-flow/Firestore-schema changes. No new fields.

## 6. Open decisions
1. **F2 seed-script hardening:** patch the seed/reset scripts too, or just clean the data once? (rec: clean now, patch scripts lightly so it doesn't recur.)
2. **F1a loading affordance:** skeleton vs muted "Loading today's plan…" text in the CTA column. (rec: skeleton, matches the app's loading idiom — verify one exists.)
3. **F4:** include now or defer. (rec: defer.)
4. **Sequencing:** F1 → F2 → F3 in one branch/commit set, or separate commits? (rec: F1+F2 together as "audit follow-ups," F3 as its own feature commit.)

## 7. Validation
1. esbuild-validate touched files.
2. **F1:** on `careful` (70 attempts) — live (after deploy) the hero shows the **loading affordance then the correct Review CTA**, never a stale "Start new words"; confirm `fetchUserAttempts` read count drops (log/inspect). Replicate phase = REVIEW_STUDY (already proven in admin).
3. **F2:** run cleanup on a snapshot; verify each affected persona keeps exactly one composite-key `class_progress` doc with real TWI; dashboard unaffected; restore file saved.
4. **F3:** per the selector plan's validation (label/dropdown matrix, dual-enroll, light+dark, a11y).
5. Snapshot+restore any staged personas. Nothing committed until owner-approved.

## 8. Out of scope
- Deeper reconciliation/CSD changes (separate, shipped).
- Real-student data migration (none needed for F2).
- Committing/deploying (owner-gated).

---

# 9. REVIEWER CORRECTIONS (v2) — F1 was under-scoped; these supersede §1
3 agents verified the F1 diagnosis is correct but the **gate as written is insufficient and itself risky.** Locked corrections:

### 9.1 🔴 Gate on BOTH loads, with DEDICATED BOOLEAN FLAGS (not sentinels)
- **Two independent races**, not one:
  - *userAttempts race* → empty attempts → `determineStartingPhase([], …)` → `new-words-study` (the symptom seen).
  - *progressData race* → `progressData[key]` undefined → `currentStudyDay = 0` → `determineStartingPhase(attempts, 1)` → for a real Day-28 student hits the `dayNumber===1 && newTest.passed` branch (`studyService.js:104`) → **`COMPLETE` ("Day 1 done 🎉") AND a spurious `logSystemEvent('impossible_phase_detected')` Firestore write (`:109`) on every load.** Must be closed too.
- **Use booleans, not `[]`/`{}`/`key in progressData`:** add `userAttemptsLoading` AND `progressDataLoading`, each `true` before its fetch and reset in a `finally`. Sentinels can't distinguish "loading" from "genuinely empty/new-user," and `key in progressData` can **stick the skeleton forever** when `getPrimaryFocus` resolves a (classId,listId) the progress effect never enumerated (it iterates `assignments` keys `:552`, while getPrimaryFocus can resolve via `assignedListDetails`/legacy fallback `:938-943`).
- `panelCState` returns `{ loading: true }` while `(userAttemptsLoading || progressDataLoading)`.

### 9.2 🔴 Widen the gate to panelBState (progress numbers), not just the CTA
`panelBState` (`:988`) treats `!progress` (still loading) identically to a new user → the hero ring/words-left/streak/tiles flash **0% / 0 / 0-day** during the progressData window. To honor "never show a guessed hero state," the **hero progress numbers must also show the skeleton while `progressDataLoading`** (use the `key in progressData` idiom from `ListProgressStats:175` only for display-existence, but drive the loading state off the `progressDataLoading` boolean). Same skeleton treatment as the CTA column.

### 9.3 🔴 The hero IIFE MUST render an explicit loading branch (or the gate no-ops)
The hero (`:1292-1296`) is optional-chained (no crash), but with `phase:null`/`loading` it still computes `reviewStage=false, doneToday=false` → renders "Start new words" anyway. **Add an explicit `if (panelCState?.loading) renderSkeleton` branch** in the CTA column AND the progress-number area. The skeleton is load-bearing, not cosmetic.

### 9.4 Flag placement & INIT VALUE (avoid stuck-loading) — (Codex tightened)
**Init each `*Loading` flag to `false`** (NOT `true` — a permanently-true sentinel that's only reset inside a fetch `finally` strands the skeleton on the no-fetch early-return paths). Set `true` **only inside the guarded fetch path** (after the early-return guards: `loadUserAttempts:341-343`, progress effect `:545`), and reset to `false` in `finally` so the catch paths (`:347-349`) also clear it.
- `userAttemptsLoading`: init `false`; set `true` only inside the guarded fetch.
- `progressDataLoading`: init `false`; set `true` only when there ARE focused/fetchable class-list pairs (else it stays `false` — the no-class student never skeletons; §9.12).
- **First-paint skeleton is driven by `!settingsLoaded` / `studentClassesLoading` / the active fetch flags — NOT by a permanently-true initial sentinel.** (On first paint, `settingsLoaded` is false and `studentClassesLoading` is true, so the skeleton shows correctly without needing the fetch flags to init true.)

### 9.5 Skeleton = match the existing precedent
Reuse `ListProgressStats:177-179`: `bg-muted` container + `bg-text-muted/20 rounded animate-pulse` bars. Token-correct in light+dark (verified `index.css`). No raw Tailwind.

### 9.6 🟠 F1/F3 are INDEPENDENT — do NOT gate the selector on userAttempts
Agents confirmed F1 (`panelCState` `:1189-1225` + hero CTA `:1325-1362` + `loadUserAttempts`) and F3 (welcome-header selector `:1255-1284` + derivations `:258-288`) edit **disjoint line ranges** — no collision; either order works. **`getPrimaryFocus` depends only on `[studentClasses, userSettings]` (`:971`), NOT userAttempts**, so the F3 selector is NOT subject to the userAttempts race. The §3/line-68 "selector should respect the loading state" is **corrected**: the selector gates only on its own `getPrimaryFocus && classOptions.length > 0` (per selector-plan §9.1); do NOT wire `userAttemptsLoading` into it (would needlessly hide a resolvable selector for seconds).

### 9.7 F1b cache — correctness notes (Agent 2)
- Keep the `if (listId)` guard (`db.js:2470`); never let null reach the Map or `getDoc(lists/null)`.
- Cache the **resolved title string including the `'Vocabulary Test'` fallback** for non-existent lists (cache the outcome, not the snapshot) — else missing lists re-fetch every iteration (half-fix).
- The class lookup is already cached pre-loop (`:2424-2440`); the list-title getDoc is the only N+1.
- Optional better form: `Promise.all` over `[...new Set(listIds)]` (parallel, order-safe since push order comes from `snapshot.docs`), each wrapped in try/catch so one bad list doesn't reject the batch.

### 9.8 🟡 Noted, OUT OF SCOPE: unbounded attempts query
`fetchUserAttempts` has **no `limit`** (`:2409-2413`) → fetches ALL attempts; the title-cache removes the N+1 reads but not the O(all-attempts) iteration. Full-fetch is required by history/gradebook consumers, so a blind `limit` would truncate them. **Deferred** — flag as the real remaining cost for 100s-of-attempts students; revisit with a separate lightweight phase-only query or pagination if it bites.

### 9.10 🔴 (Codex H2) Progress fetch-task source must MATCH focus resolution
The dual-boolean gate (§9.1) is necessary but **not sufficient** for correctness: the progress effect builds fetch tasks from `Object.keys(cls.assignments)` only (`:550-558`), while `getPrimaryFocus`/`assignedListDetails` derive from `classData.assignedLists || Object.keys(assignments)` (`db.js:500`). So a class with `assignedLists` present but `assignments` empty resolves a focus key whose progress is **never fetched** → after load, `progressDataLoading=false` but `progressData[key]` is absent → `panelCState` reads CSD 0 → guessed phase (gate releases on a never-fetched key).
**Fix:** build progress fetch tasks from the **union** of `cls.assignedListDetails.map(l=>l.id)`, `cls.assignedLists`, and `Object.keys(cls.assignments||{})` (dedupe). And store an explicit entry for **every** fetched pair — `progressMap[key] = progress ?? null` — so "loaded, no doc" is represented (it already does `progress ?? null` at `:566/576`, but only for keys it enumerated; the union ensures the focused key is among them). This makes the §9.1 boolean gate's release point coincide with the focused key actually being present.

### 9.11 🟠 (Codex M2) panelBState must explicitly return a loading object
§9.2's intent must be explicit in code: `panelBState` (`:988`) currently returns zeros when `!progress`. Add `progressDataLoading` to its deps and **return `{ loading: true }` BEFORE the `!progress` zero-fallback**, so the hero progress numbers render the skeleton (not 0%/0/0-streak) during load. (Symmetric with `panelCState` §9.1.)

### 9.12 🔴 (Codex) Precise loading state machine — no-fetch paths must release
The flags must NOT be "init true, reset only in a fetch `finally`" — the effects early-return without fetching for some students, stranding the skeleton.
- **`progressDataLoading`:** the progress effect early-returns when `!user?.uid || !studentClasses.length || isTeacher` (`:545`). State machine:
  - `!getPrimaryFocus` / 0 classes → there is nothing to load → `progressDataLoading = false` (released; the hero shows its existing empty state, NOT a skeleton).
  - has class/list pairs → set `true` before the fetch, `false` in `finally`.
  - **`panelCState`/`panelBState` must check `!getPrimaryFocus` FIRST** (return the empty-class state) **before** consulting the loading flags — so a no-class student never skeletons forever.
- **`userAttemptsLoading`:** symmetric — `loadUserAttempts` early-returns for `!uid`/teacher (`:341`); set `true` only after that guard, `false` in `finally` (covers the catch path `:347-349`).

### 9.13 🟠 (Codex) Gate focus-dependent rendering on userSettings LOADED (preference-clobber race)
`userSettings` starts `null` (`:241`) and loads async (`:593` → `data.settings ?? {}`, or `{}` on error/no-doc `:596`). `getPrimaryFocus` (deps `[studentClasses, userSettings]`, `:971`) **auto-selects while `userSettings === null`** because the saved-pref branch requires `userSettings?.primaryFocusListId`. So during the settings-load window the hero + selector show the **auto-selected** class/list; **if the student clicks then, `handle*Selection` persists a NEW preference, silently overwriting their real saved one.**
- **Fix:** treat `userSettings === null` as "settings loading" (the code already distinguishes it from the loaded-empty `{}`). Add `settingsLoaded = userSettings !== null` (or a dedicated boolean). **Gate the hero CTA/phase AND the F3 selector controls on `settingsLoaded`** — render the skeleton/neutral until settings resolve, EXCEPT the verified loaded-empty (`{}`) case (a real no-settings student → auto-select is correct and clickable).
- This closes the clobber: no actionable control is shown until we know whether a saved preference exists.

### 9.14 🟠 (Codex) Settings/loading gates belong in the STATE DERIVATION, not just render branches
The gates must short-circuit **inside `panelCState`/`panelBState`** *before* `determineStartingPhase` is ever called — otherwise the auto-selected fallback (during the settings/progress window) still derives a phase and can trigger the **`impossible_phase_detected` Firestore write** (`studyService.js:109`) as a side effect, even if the render hides it. **Required order in BOTH `panelCState` and `panelBState`:**
```
1. if (!settingsLoaded)                          return { loading: true }   // §9.13 — before any phase derivation
2. if (!getPrimaryFocus)                          return { ...emptyState }   // §9.12 — 0-class, never skeleton
3. if (progressDataLoading || userAttemptsLoading) return { loading: true }  // §9.1/§9.2
4. // only now derive currentStudyDay, listAttempts, determineStartingPhase / progress numbers
```
This makes the loading state machine authoritative at the data layer (no phase computed, no log written, until inputs are known), with the hero IIFE's `if (panelCState?.loading)` branch (§9.3) purely rendering the skeleton.

### 9.9 Revised validation additions
- Force the **progressData-slow** window (not just userAttempts) and confirm no "Day 1 COMPLETE" flash and **no `impossible_phase_detected` log** is written on dashboard load.
- Confirm a **genuine 0-attempt / new student** releases the skeleton (loaded-empty, not stuck).
- Confirm a **0-class student** does NOT skeleton forever (releases via §9.12 `!getPrimaryFocus` check).
- Confirm the **userSettings window** (§9.13): a student with a saved non-default focus does NOT briefly show the auto-selected class, and a click during load can't clobber the saved pref; a genuine no-settings student still auto-selects and is clickable.
- Confirm the **selector renders during the userAttempts/progressData windows** (not hidden by F1's gates) once settings+classes are loaded.
