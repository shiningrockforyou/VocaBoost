# Dashboard F1 + F3 — Implementation & Validation Report

**For:** Codex review (self-contained — no prior context assumed)
**Date:** 2026-06-21
**Commit:** `9c162f6` *fix(dashboard): gate hero phase on load (skeletons) + class selector; cache attempt list titles*
**Status:** Implemented, committed, deployed to production (`vocaboostone.netlify.app`, bundle `index-BdGEbdUP.js`), live-validated. No outstanding blockers; one documented lint exception (see §7).
**Files changed:** `src/services/db.js`, `src/pages/Dashboard.jsx`, `change_action_log.md`.
**Process:** 3 independent internal review agents + Codex across multiple rounds; every finding folded in before commit; two crash/UX bugs found in the *implementation* (not just the plan) and fixed; then live Playwright validation on audit-only personas.

---

## 1. Context — where these came from

A prior live adversarial audit of the student dashboard surfaced two things. Investigation re-scoped both:

- **F1 (real bug):** the hero "today" CTA could show **"Start new words"** for a student actually at the **Review** phase. First mis-attributed to an orphan `class_progress` doc; the true root cause is a **render race** — `panelCState`/`panelBState` derive the hero phase/numbers from `userAttempts` / `progressData` / `userSettings` *before they finish loading*, and an empty/loading input deterministically falls through to `new-words-study` / zeros. Worst for students with many attempts, because `fetchUserAttempts` did an **uncached `getDoc` per attempt** for the list title (e.g. 70 attempts on one list = ~70 sequential reads), lengthening the load window.
  - The "orphan `class_progress`" lead was investigated and **dropped**: those docs exist only on **12 audit personas** (seed-script artifacts, docId = `{classId}` only), **0 real students**, and **no code path reads them** (all reads use the composite `{classId}_{listId}` docId). They are inert.

- **F3 (feature):** revive a **class selector**. The dashboard had been consolidated to a single list-based "Studying: \<list\>" control, which renders **two identical-looking rows** for a student enrolled in two classes that share a vocabulary list (distinguishable only by a tiny sublabel). Owner wants class-first selection back.

**Scope decision (owner):** implement **F1 + F3 only**; skip the audit-cruft cleanup and an unrelated cosmetic offline-console-noise item. F1 loading UI = **skeleton** (never a guessed actionable CTA).

---

## 2. F1 — hero phase loading race

### 2a. `fetchUserAttempts` list-title cache (`src/services/db.js:2448-2470`)
Previously the per-attempt loop did `await getDoc(doc(db,'lists',listId))` to fetch the list title — **uncached**, so K attempts on one list = K sequential reads. Now a `listTitleCache = new Map()` + `resolveListTitle(listId)` resolves each unique listId's title **once**, caching the **resolved string** (including the `'Vocabulary Test'` fallback for a missing list, so a non-existent list doesn't re-fetch). The `if (listId)` guard is preserved (null listId never hits the cache or `getDoc(lists/null)`). Output shape unchanged; pure read-path optimization. Class-name lookup was already cached pre-loop.

### 2b. Loading state machine (`src/pages/Dashboard.jsx`)
The dashboard has **three independent async loads** that each race the hero:
- `studentClasses` (+ `studentClassesLoading`),
- `userSettings` (starts `null`, resolves to the settings object or `{}`),
- `progressData` and `userAttempts`.

Added explicit, separable loading signals (init `false`, set `true` only **inside the guarded fetch** after early-return guards, reset in `finally` — so no-fetch paths can't strand them):
- `userAttemptsLoading` (`:318`), set in `loadUserAttempts` (`:399` area).
- `progressDataLoading` (`:320`), set in the progress effect; the effect now **releases the flag on the no-class early-return** so a 0-class student never skeletons forever, and builds fetch tasks from the **union of `assignedListDetails` ids + `assignedLists` + `Object.keys(assignments)`** (because `getPrimaryFocus` can resolve a `(classId,listId)` pair that `Object.keys(assignments)` alone omits — a class with `assignedLists` but no assignment metadata — which would otherwise leave the focused key unfetched → CSD 0 → guessed phase).
- `settingsLoaded = userSettings !== null` (`:1115`).

**Authoritative gate order — in the state derivation, before any phase/number computation** (so no wrong value and no side-effect ever fires from a half-loaded auto-selected fallback):
```
panelCState / panelBState:
  1. if (!settingsLoaded)                            return { loading: true }
  2. if (!getPrimaryFocus)                            return emptyState
  3. if (progressDataLoading || userAttemptsLoading)  return { loading: true }
  4. derive currentStudyDay, listAttempts, determineStartingPhase / numbers
```
- `panelCState` (`:1342`) — the phase/CTA.
- `panelBState` (`:1121`) — the progress numbers; now **returns `{ loading: true }` before the `!progress` zero-fallback** (previously it returned zeros indistinguishable from a new user).

Why ordering matters: `determineStartingPhase([], dayNumber)` returns `new-words-study`; and with `progressData` unloaded, `currentStudyDay` reads `0` → `determineStartingPhase(attempts, 1)` can hit a `day===1 && passed` branch that returns `COMPLETE` **and writes a `impossible_phase_detected` system log** as a side effect. Gating in the derivation prevents both.

### 2c. Hero render (`:1451+`, inside the hero IIFE)
- `heroLoading = panelBLoading || panelCState?.loading` — numbers/phase still loading (focus known).
- `firstPaintLoading = !settingsLoaded || studentClassesLoading` — no focus resolved yet.
- `anyLoading = firstPaintLoading || heroLoading` — drives the always-rendered stat tiles.
- Render branches:
  - `firstPaintLoading` → a **full skeleton hero** (does not deref `getPrimaryFocus`), **before** the `getPrimaryFocus ? hero : "No active list"` ternary — so the empty state only shows for a genuinely class-less student *after* load.
  - hero card: ring numbers / streak+words-left chips / CTA column each render skeletons when `heroLoading`.
  - stat tiles: each number renders a skeleton (`tileSk`) or a safe value (`tIntro`, etc.) gated on `anyLoading` — because `panelBState` returns `{ loading }` with no numeric fields, so an unguarded `totalWordsIntroduced.toLocaleString()` would crash.
- Skeletons match the app's existing idiom (`ListProgressStats`): navy hero uses `bg-white/20 animate-pulse`; light tiles use `bg-text-muted/20 animate-pulse`. Token-correct in light + dark.

---

## 3. F3 — class selector

### 3a. `FocusControl` component (`src/pages/Dashboard.jsx:227`, module-level)
A single control that renders as:
- a **borderless label** ("`prefix: value`", muted text, no chevron/border/hover) when it has **≤1 option** — the app's read-only idiom, so it doesn't read as a broken/disabled dropdown;
- an **interactive dropdown** (bordered button + chevron + menu, active row highlighted) when **≥2 options**.

Open state is **parent-controlled** (`isOpen`/`onOpen`/`onClose`) so opening one control closes the other; ESC + outside-click close (handlers scoped to the open dropdown).

### 3b. Two controls + derivations
- `classOptions` (`:1064`): one per enrolled class (`{ classId, className }`).
- `listOptions` (`:1071`): the **focused class's** lists, **class-qualified** — `{ id, title, classId: focusedClass.id, className }`. (Raw `assignedListDetails` entries carry **no `classId`**; persisting from them would write `primaryFocusClassId: undefined` and silently degrade to legacy list-only resolution.)
- `pickPrimaryList(klass)` (`:1083`): most-recently-assigned list (reads `klass.assignments[listId].assignedAt`, **not** `assignedListDetails` which has no `assignedAt`), else first.
- `handleClassSelection(classOption)` (`:1101`): resolves a list **in the target class** and persists both ids, with a **same-class assertion** (the 3-tier focus resolver would otherwise mask a wrong/stale `primaryFocusListId` as a silent class snap-back).
- `persistFocus(classId, listId)`: never persists an undefined id; writes via `updateUserSettings` + optimistic `setUserSettings`.

### 3c. Render gate
Both controls render only when **`settingsLoaded && getPrimaryFocus && classOptions.length > 0`**. The `settingsLoaded` gate is required: while `userSettings === null`, `getPrimaryFocus` auto-selects, so rendering an actionable control then could **clobber the saved preference** on a click.

Removed the dead `availableLists` memo and `showListSelector` state (including the `setShowListSelector(false)` call inside the old handler).

---

## 4. Review history (what the audit caught and fixed, in order)

**Plan stage (3 agents + Codex ×4):**
- Dual independent races (userAttempts **and** progressData), not one; gate must cover both.
- Use **dedicated boolean flags**, not `[]`/`{}`/`key in progressData` sentinels (which can't distinguish loading from genuinely-empty and can stick the skeleton permanently when `getPrimaryFocus` resolves a key the progress effect never enumerated).
- `panelBState` must also return a loading object (progress numbers had the same flash).
- The hero IIFE must render an **explicit** loading branch (optional chaining alone falls through to "Start new words").
- Progress fetch source must be the **union** of `assignedListDetails`/`assignedLists`/`assignments` (else a focused key is never fetched).
- `listOptions` must be **class-qualified** (else `classId=undefined` on select) — High.
- `FocusControl` open state must be **parent-controlled** (mutual close).
- `userSettings === null` race → gate on `settingsLoaded` to prevent **preference clobber** — and put the gate in the **derivation**, before `determineStartingPhase`, to also prevent the `impossible_phase_detected` side-effect write.
- Loading flags init **`false`**, set inside the guarded fetch; first-paint skeleton driven by `!settingsLoaded`/`studentClassesLoading`.

**Implementation stage (Codex reviewed the actual code):**
- 🔴 **Critical (crash):** the stat tiles called `totalWordsIntroduced.toLocaleString()` on the now-possibly-`undefined` destructured value → fixed with `anyLoading`-gated tile skeletons + safe `tIntro`.
- 🟠 **High:** the hero showed the "No active list" empty state during the settings/classes-load window → fixed with the `firstPaintLoading` full-skeleton hero branch before the empty-state ternary.
- 🟡 **Medium (lint, see §7):** pre-existing `react-hooks/rules-of-hooks` violation; this change adds two hooks to the existing student-only region.

---

## 5. Live validation (production, audit personas only)

Playwright against the deployed build; all staged data on `@vocaboost.test` audit personas in the 25WT sandbox classes; nothing touched real students.

| Check | Result | Verdict |
|---|---|---|
| **F1 — loading skeleton** (careful, 70 attempts, Firestore throttled 1.4s) | Hero renders white-tinted skeletons (ring/title/CTA) + gray tile skeletons; **no guessed "Start new words", no crash, no 0% flash.** Granular: class name + Class/List controls resolve first; numbers/CTA stay skeletoned until ready. | ✓ PASS |
| **F1 — correct phase after load** | careful resolves to **"One step left — review"** (the exact persona that previously flashed "Start new words"); skeletons gone; 0 console errors. | ✓ PASS |
| **F3 — dual-enrolled same-list** (speedrunner in 2 classes sharing a list, saved focus = class B) | Hero + Class control resolve to the **saved class B** (not the first-iterated class); Class control = dropdown showing both classes; List control = label. Staged class fully torn down afterward. | ✓ PASS |
| **F3 — label/dropdown + dark mode** | Single-class students show Class/List as borderless **labels**; multi-class shows a **dropdown**; correct in light **and** dark (navy hero, readable tiles). | ✓ PASS |
| **Stability** | 0 console errors across personas/themes. | ✓ |

(esbuild syntax-validates both files; the container can't run the Rollup-based Vite build, so visual checks were done live post-deploy.)

---

## 6. Verification points for Codex

1. **Gate order** — confirm `panelBState` (`:1121`) and `panelCState` (`:1342`) short-circuit `!settingsLoaded` → `!getPrimaryFocus` → `(progressDataLoading || userAttemptsLoading)` **before** any `determineStartingPhase`/number derivation, so no phase is computed and no `impossible_phase_detected` log is written during load.
2. **Flag lifecycle** — `userAttemptsLoading`/`progressDataLoading` init `false`, set `true` only inside the guarded fetch (after early-return guards), reset in `finally`; the progress effect releases `progressDataLoading` on the no-class path.
3. **No unguarded deref** — every `totalWordsIntroduced`/`masteryRate`/`streakDays`/`tIntro` consumer is either inside `panelBState`'s own return, gated by `heroLoading`/`anyLoading`, or uses the null-safe `tIntro`.
4. **Empty-state ordering** — `firstPaintLoading` skeleton hero renders **before** the `getPrimaryFocus ? hero : "No active list"` ternary.
5. **F3 persistence** — `listOptions` are class-qualified; `handleClassSelection` asserts same-class before persist; nothing persists an undefined id; controls gated on `settingsLoaded` (no clobber).
6. **Cache** — `resolveListTitle` keeps the `if (listId)` guard and caches the resolved string incl. fallback.
7. **Cleanup** — `availableLists`/`showListSelector` removed with no dangling refs.

---

## 7. Known exception (documented, not fixed here)

**ESLint `react-hooks/rules-of-hooks`** flags pre-existing conditional hooks: the `if (isTeacher) return …` early-return (`Dashboard.jsx:768`) precedes the student-only hooks (`getPrimaryFocus`, `classOptions`, `listOptions`, `panelBState`, `panelCState`, `dailyActivity`). This change **adds two** hooks (`classOptions`, `listOptions`) to that existing region.

**No runtime impact under the current flow** (verified): `PrivateRoute` (`src/components/PrivateRoute.jsx:8-20`) blocks Dashboard from mounting until `!initializing && user`, and `AuthContext` (`:37-39`) sets `user` **atomically with `role`** (never non-null without `role`). So `isTeacher` has its final value on Dashboard's first render and the hook count never flips. The Vite build does not run ESLint.

**Tracked follow-up:** split `Dashboard.jsx` into `TeacherDashboard` + `StudentDashboard` so each has unconditional hooks (removes the conditional-hook structure without hoisting large student-only logic above the teacher path). Deferred as its own audited task to avoid bundling a large structural refactor into this fix.

---

## 8. Out of scope / related
- Orphan/duplicate `class_progress` cleanup — audit-persona-only seed cruft, 0 real students, read by no code path; intentionally not touched.
- Offline failed-fetch console noise — cosmetic; deferred.
- The unmastered-pool review-segment engine + CSD anomaly observability — separate, already shipped (prior commits).
