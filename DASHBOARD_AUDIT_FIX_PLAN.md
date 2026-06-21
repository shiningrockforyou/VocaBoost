# Dashboard Audit — Fix Plan (v1)

**Status:** DRAFT for review (3 internal agents + Codex). Nothing implemented. Nothing committed.
**Author:** Claude (orchestrator) · **Date:** 2026-06-21
**Source:** `CODE_AUDIT_RECENT_2026-06-21.md` §2 — all 5 findings independently verified against current source.

---

## 0. Findings recap (all verified)
| # | Sev | Finding | Verified at |
|---|---|---|---|
| A | 🔴 High | `fetchUserAttempts` overwrites the attempt's real `classId` with a first-class-containing-listId guess | `db.js:2451,2466,2483-2498` |
| B | 🔴 High | `getPrimaryFocus` resolves saved focus by `listId` only (ignores saved `primaryFocusClassId`); dropdown highlight compares `id` only | `Dashboard.jsx:908-926, 1343` |
| C | 🟠 Med | `dailyStatus`/`testCompletedToday`/`sessionCompletedToday` computed from **all** `userAttempts`; **dead** (only `phase`+`currentStudyDay` are read) | `Dashboard.jsx:1256-1289`; consumers `:1361,1363` |
| D | 🟠 Med | Hero + list selector use raw Tailwind/hex colors instead of design tokens (violates CLAUDE.md) | `Dashboard.jsx:1308-1343, 1370-1429` |
| E | 🟡 Low | Null-date fallback in `getPrimaryFocus` selects the **last** list, not the first (comment says first) | `Dashboard.jsx:944-960` |

**Trigger reality:** A/B/(C) only mis-behave for a student **dual-enrolled in two classes that share a list**. *(Verified from current production data, not source:* lists ARE heavily reused across classes — all 26SM Adv classes share one list, all Inter share another — so the only thing preventing the bug today is one-class-per-student.*)* Latent landmine → worth fixing. D and E are unconditional.

---

## 1. Fix A (root) — preserve real `classId` in `fetchUserAttempts` (`db.js`)
The attempt doc already carries an authoritative `classId` (verified on real docs), and the new `testId` format is `vocaboost_test_{classId}_{listId}_{testType}`. Today both are discarded.

**Change:**
- Extend the new-format regex to capture classId: `^vocaboost_test_([^_]+)_([^_]+)_` → `parsedClassId = g1`, `listId = g2`. *(Reviewer note: `parsedClassId` is redundant — the doc `classId` and the testId classId are both written from the same `classIdParam`, so they can't disagree. Keep it only as a belt-and-suspenders tier for a hypothetical doc with a new-format testId but no classId field; don't oversell it.)*
- Resolve with precedence (most→least authoritative): **`classId = validDocClassId ?? parsedClassId ?? derivedFromClassLookup`**, where `validDocClassId = (attemptData.classId && attemptData.classId !== 'no_class') ? attemptData.classId : undefined`.
- **🔴 `'no_class'` SENTINEL GUARD (required, Agent 1 finding):** `scripts/backfillAttempts.cjs` stamps unresolvable legacy docs with `classId: 'no_class'`. Without the guard, Fix A would trust `'no_class'` (truthy) over the lookup → those attempts silently drop from the phase calc, where today the lookup re-derivation could still place them. Treat `'no_class'` as absent (above). **Before shipping: query prod for `attempts where classId == 'no_class'` to size the affected set.**
- In `attempts.push({...attemptData, …, classId})`, ensure the final `classId` uses that precedence (so `...attemptData` is not clobbered by a worse guess). `className` is **moot** — no consumer reads `.className` off attempt results (verified); leave its current `classLookup` derivation.

**Caller scope (verified):** `fetchUserAttempts` has exactly ONE caller (`Dashboard.jsx:345`); gradebook/ClassDetail use different fetchers. Fix A cannot regress those views.

**Risk:** low. New attempts → doc `classId` (correct). Pristine old-format docs (no classId field) → existing lookup (unchanged). The only regression vector is the `'no_class'` sentinel, closed by the guard. No write path; read-only enrichment.

---

## 2. Fix B — resolve focus by `classId`+`listId` (`Dashboard.jsx`)
Save side already stores both (`handleListSelection:281-286`). Only the resolve + highlight ignore class.

**Change `getPrimaryFocus` (`:907-928`) — explicit 3-tier guarded chain (Agent 2 HOLE 1):**
1. **Class-first:** if `primaryFocusClassId` AND `primaryFocusListId` set → `klass = studentClasses.find(k => k.id === primaryFocusClassId)`; **guard `klass` may be `undefined`** (student removed from that class). If `klass` found AND it has the list → return that exact pair.
2. **Legacy list-only fallback:** if the class is not found OR doesn't contain the list (stale pref) → fall through to the current list-only scan (NOT to auto-select). This preserves today's behavior for a student removed from the saved class whose list is still assigned elsewhere.
3. **Auto-select fallback** (`:930+`) only if both above miss.
The class-not-found case must reach tier 2, never skip to tier 3 — that's the easiest regression to introduce.

**Change dropdown highlight (`:1343`):** `list.classId === getPrimaryFocus?.classId && list.id === getPrimaryFocus?.id`. *(Coordinate with Fix D — the token swap edits this same line; land both together.)*

**Blast radius (verified):** `getPrimaryFocus.classId` is the spine — it keys panelA/B/C, dailyActivity, and the hero session URL (`:1426`). Fixing it correctly propagates the right class to ALL of them (the intended benefit). Confirmed the corrected `classId_listId` key always exists in `progressData` (keyed off `studentClasses`).

**Risk:** low; purely resolution logic. `availableLists` items carry `classId` (`:1340` key uses it).

---

## 3. Fix C — delete the dead daily-status fields (`Dashboard.jsx`)
`dailyStatus`, `testCompletedToday`, `sessionCompletedToday` are computed + returned by `panelCState` but **never read** (only `phase`+`currentStudyDay` consumed at `:1361,1363`).

**Change:** remove these three from the `panelCState` return + their computation (`:1256-1265, 1277-1289`), including the unscoped `hasTestToday(userAttempts)` call. **Delete BOTH now-dead helpers** `hasTestToday` (`:1092`, only caller `:1257`) AND `hasSessionToday` (`:1079`, only caller `:1256`) — Agent 2 confirmed both are dead (plan v1 only flagged `hasTestToday`).
- **⚠️ PRESERVE the adjacent `listAttempts`/`phase` block (`:1270-1273`)** — it IS list-scoped and feeds the live hero CTA. The dead block (`:1256-1265`) and the live block (`:1270-1273`) are adjacent; do not over-delete.

**Verified:** only `panelCState.currentStudyDay` (`:1361`) and `panelCState.phase` (`:1363`) are read; the three fields and both helpers have no other consumer (cross-file grep clean); `panelCState` is never spread/passed as props.

**Risk:** low (dead-code removal).

---

## 4. Fix D — design tokens for hero + list selector (`Dashboard.jsx`)
Two zones; the hero is an **inverse** (navy, light text) surface that the standard `text-text-*` tokens (built for light backgrounds) don't map onto. **Token names below corrected per Codex + Agent 3 (verified against `src/index.css`).**

**SCOPE (honest):** Fix D covers only the **redesign-introduced** raw colors (the hero) + the in-zone **list selector** and **student error banner**. The same file still has PRE-EXISTING raw colors elsewhere — `ListProgressStats` (`:205,210,215`), the teacher branch (`:686,687,720,804`), join forms (`:1532,1537,1568,1573`), re-entry modal (`:1871,1880`). Those are **logged as a separate follow-up** (§7.4); do NOT claim "Dashboard.jsx token-clean" after this fix.

**4a. Non-inverse (direct token swaps — tokens verified to exist):**
- List selector (`:1329-1347`): `bg-white`→`bg-surface`, `border-gray-200`→`border-border-default`, `text-gray-500`→`text-text-muted`, `text-gray-900`→`text-text-primary`, `text-gray-400`→`text-text-faint`, `hover:bg-gray-50/100`→`hover:bg-muted`. **Selected row `bg-blue-50`→`bg-muted`** (NOT `bg-brand-fill` — that token is a progress-FILL: navy in light, **white in dark** → illegible; `bg-brand-primary/10` is an acceptable subtler alternative).
- Error banner (`:1308-1309`): `border-red-300 bg-red-50 text-red-600` → **`border-border-error bg-error-subtle text-text-error`** (NOT `border-error`/`text-error-text` — the generated tokens are `border-border-error` and `text-text-error`).

**4b. Hero inverse surface (`:1370-1429`) — white/opacity + brand/state tokens (no new tokens):**
The hero is always brand-navy and `--color-brand-primary`/`--color-brand-accent` are NOT overridden in `.dark` → **theme-invariant**, so white-on-brand is a fixed, safe treatment consistent with the hero's existing `bg-brand-primary/90`, `text-white`, `bg-white/15`:
- `to-blue-700`→`to-brand-primary`; `text-blue-200`/`text-blue-100`→`text-white/70`.
- Badge `bg-[#A9C0FF] text-[#0B2570]`→`bg-white/90 text-brand-primary`.
- **Checkmark dot `bg-green-500 text-green-950`→ `bg-btn-success text-white`** (solid emerald-600, theme-stable; the shared `Button.jsx:61` uses exactly this). NOT `bg-success` (a light-emerald *background* → near-white, invisible with white text), and NOT `bg-success-ring` (invalid — the repo token is `ring-success`, not `success-ring`). Verified: `--color-btn-success` exists in both `:root` and `.dark` (`index.css:438,221`).

**Dark mode IS active** (user-toggleable via `ThemeContext`; `.dark` block in `index.css`). The hero swaps above are theme-invariant, but Fix D MUST be screenshotted in BOTH light and dark (§8.5), and the corrected selected-row/error/checkmark tokens specifically re-checked in dark.

**Risk:** visual; Playwright-screenshot before/after at desktop in both themes to confirm parity + contrast.

---

## 5. Fix E — null-date fallback selects first list (`Dashboard.jsx:944-960`)
When all `assignedAt` are null, `if (!latestAssignedAt || …)` stays true every iteration → `primaryList` ends on the **last** list.

**Change:** only replace on a strictly-newer dated assignment, and capture the first list separately as the null-date fallback:
```
if (assignedAt && (!latestAssignedAt || assignedAt > latestAssignedAt)) { latestAssignedAt = assignedAt; primaryList = {...} }
else if (!primaryList) { primaryList = {...} }   // first list seen, only if nothing dated yet
```
This makes the `:962` "first available list" comment true and lets the existing dated search still win when dates exist.

**Note (Agent 2):** after this fix the existing `:962-983` "first available list" block becomes **unreachable** (primaryList is now always set when any class has lists) — harmless dead code; optional to remove. No double-handling (it's `!primaryList`-guarded).

**Risk:** low; matches documented intent.

---

## 6. Blast radius / files
- `src/services/db.js` — `fetchUserAttempts` (Fix A).
- `src/pages/Dashboard.jsx` — `getPrimaryFocus` (B, E), dropdown (B), `panelCState` (C), hero + selector + error banner (D).
- `src/index.css` — only if Fix D Option 2 chosen.
- No backend/session-flow changes; no Firestore writes.

**Interaction:** Fix A and B together close the multi-class mis-attribution; A also de-risks my redesign's `listAttempts.filter(a => a.classId===…)` (`:1270`).

---

## 7. Open decisions
1. **Fix D hero tokens:** confirmed Option 1 (white/opacity + brand/state tokens, no new tokens) — token names now corrected in §4.
2. **Fix C:** delete dead fields + both helpers (confirmed by reviewers).
3. **Regression seed:** add a sandbox student dual-enrolled in two same-list classes to exercise A/B end-to-end (§8.7), or trust unit-level reasoning? Rec: seed it — it's the exact failure mode and cheap on the audit personas.
4. **Pre-existing in-file raw colors** (`ListProgressStats`, teacher branch, join forms, re-entry modal — Agent 3 list): fold into Fix D, or log as a **separate follow-up token pass**? Rec: separate follow-up (keeps this change focused on the redesign-introduced + in-zone surfaces).

---

## 8. Validation
0. **Pre-ship (Fix A):** query prod for `attempts where classId == 'no_class'` to size the backfill-sentinel set the guard protects.
1. esbuild-validate `db.js`, `Dashboard.jsx`.
2. **Fix A:** dry-run `fetchUserAttempts` logic against a real new-format attempt — confirm returned `classId` == doc `classId`, not the lookup guess; old-format attempt still derives; a `'no_class'`-stamped doc is treated as absent (falls to lookup).
3. **Fix B:** sandbox student with a saved `primaryFocusClassId` → `getPrimaryFocus` returns that class; dropdown highlights the right row; a student removed from the saved class falls to the list-only tier (not auto-select).
4. **Fix C:** grep confirms no consumers; both helpers removed; dashboard renders unchanged; `listAttempts`/`phase` block intact.
5. **Fix D:** Playwright screenshot hero + selector + error states at 1440px in **BOTH light and dark mode** (dark mode IS active); compare against current; verify checkmark/selected-row/error contrast in dark; 0 console errors.
6. **Fix E:** simulate all-null `assignedAt` → first list selected.
7. **(§7.3) Regression:** seed a dual-enrolled same-list student; confirm hero/panels show the correct class's progress + phase and the session URL routes to the saved class.
8. Snapshot+restore any touched personas.

## 9. Out of scope
- The CSD v5 change (separate, already shipped-pending-deploy).
- Broader dark-mode token sweep beyond these dashboard surfaces.
- Committing / deploying (owner-gated).
