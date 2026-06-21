# Dashboard Class Selector — Implementation Plan (v1)

**Status:** DRAFT for review (3 internal agents + Codex). Nothing implemented. Nothing committed.
**Author:** Claude (orchestrator) · **Date:** 2026-06-21

## 0. Goal & LOCKED decisions
Revive a **class selector** on the student dashboard. Owner decisions (locked):
1. **Always show** both a **Class** control and a **List** control (not hidden for single-class students).
2. Each control **renders as a static LABEL when it has ≤1 option, and as an interactive DROPDOWN when it has ≥2 options.** ("Selectors that look like labels.")
3. **Keep both** (class + list), two-tier.

**Data reality (verified):** 44/45 classes assign exactly 1 list; only "SAT" has 2. Most students are in 1 class. So the common render is **two labels**; dropdowns appear only for multi-class students (Class dropdown) or the rare multi-list class (List dropdown).

---

## 1. Current state (verified)
- `availableLists` (`Dashboard.jsx:261-274`): flat array of `{ id, title, classId, className }` over `studentClasses[].assignedListDetails`.
- `getPrimaryFocus` (`:902-971`): the active pair `{ id, title, classId, className, pace, studyDaysPerWeek, wordCount, stats }` — resolved by saved `primaryFocusClassId`+`primaryFocusListId` (3-tier, post-Fix-B), else auto-select.
- `handleListSelection(list)` (`:276-288`): persists `primaryFocusListId`+`primaryFocusClassId` via `updateUserSettings` + `setUserSettings`.
- Current selector (`:1255-1284`): single list-based dropdown, shown only when `availableLists.length > 1`; trigger `Studying: <title>`; rows class-sublabeled. State `showListSelector`.
- `studentClasses` (from `fetchStudentClasses`): each `{ id, name, assignedListDetails: [{id,title,wordCount,stats,...}], assignments }`.
- `ChevronDown` from lucide already imported.

---

## 2. Design

> ⚠️ **IMPLEMENTATION PRECEDENCE: §9 (reviewer corrections) OVERRIDES §2 wherever they conflict.** Notably §2a's "label & dropdown share the same footprint" is reversed by §9.4 (borderless label), and §2a's "open state internal to each FocusControl" is reversed by §9.11 (parent-controlled `openFocus`). Build from §9; §2 is background intent.

### 2a. `<FocusControl>` — the label-or-dropdown component (new, local to Dashboard.jsx)
```
FocusControl({ prefix, value, options, activeKey, getKey, getPrimary, getSub, onSelect })
  interactive = options.length > 1
  if (!interactive)  -> render a styled, non-interactive LABEL: "<prefix>: <value>" (no chevron, no hover, not focusable)
  else               -> render the dropdown: button "<prefix>: <value> ▾" + menu of options (primary + sub text), active row highlighted by activeKey
```
- Same visual container/footprint in both modes (label = dropdown minus chevron/interactivity) so the layout doesn't shift.
- Open/close state is internal to the component (avoids two module-level `show*` flags).

### 2b. The two controls (always rendered, in the welcome-header right side)
- **Class control:** `prefix="Class"`, `value=getPrimaryFocus.className`, `options=classOptions` (one per `studentClasses` entry: `{classId, className}`), `activeKey=getPrimaryFocus.classId`, `onSelect=handleClassSelection`.
- **List control:** `prefix="List"`, `value=getPrimaryFocus.title`, `options=listOptions` (the **currently-focused class's** lists), `activeKey=getPrimaryFocus.id`, `onSelect=handleListSelection`.

### 2c. New derivations
- `classOptions = useMemo(studentClasses.map(k => ({ classId:k.id, className:k.name })), [studentClasses])`.
- `listOptions = useMemo(studentClasses.find(k => k.id === getPrimaryFocus?.classId)?.assignedListDetails ?? [], [studentClasses, getPrimaryFocus])`.

### 2d. `handleClassSelection(classOption)` (new)
Switching class must also pick a valid list in that class:
```
const klass = studentClasses.find(k => k.id === classOption.classId)
const lists = klass?.assignedListDetails ?? []
// keep current list if it belongs to the new class (it won't, across classes), else the class's
// "primary" list — mirror getPrimaryFocus's most-recently-assigned rule, fallback first.
const nextList = pickPrimaryList(klass)   // most-recent assignedAt, else lists[0]
if (!nextList) return
persist { primaryFocusClassId: classOption.classId, primaryFocusListId: nextList.id }  (updateUserSettings + setUserSettings)
```
`handleListSelection` stays as-is (sets list within the current class; also writes classId, harmless).

---

## 3. Behavior matrix
| Student | Class control | List control |
|---|---|---|
| 1 class, 1 list (most) | **label** | **label** |
| 2+ classes, 1 list each (dual-enroll) | **dropdown** | label (per selected class) |
| 1 class, 2+ lists ("SAT") | label | **dropdown** |
| 2+ classes, some multi-list | dropdown | dropdown when the selected class has 2+ |
| 0 classes (new user) | render nothing (or "No class") — hero already shows the empty state | — |

Switching the Class dropdown updates the List control's options to the new class's lists, and re-keys hero/panels/session URL automatically (all consume `getPrimaryFocus`).

---

## 4. Edge cases
- **0 classes / `getPrimaryFocus === null`:** don't render the controls (or a muted "No class enrolled"); the hero's existing empty-state covers it.
- **Switch to a class whose list differs:** `handleClassSelection` always sets a valid `primaryFocusListId` for the new class (never leaves a stale list id that fails the focus resolver).
- **Stale saved list after class switch:** resolved because we always write a fresh `primaryFocusListId`.
- **Dual-enroll same list:** Class dropdown shows two distinct class names (the legibility fix); List is a label.
- **a11y:** label mode is plain text (not a disabled button) so screen readers don't announce a non-actionable control; dropdown mode keeps button semantics + keyboard.
- **Async persistence race:** mirror `handleListSelection` (await `updateUserSettings`, then `setUserSettings`); double-click guarded by closing the menu on select.

---

## 5. Blast radius / files
- `src/pages/Dashboard.jsx` ONLY: add `FocusControl` (local component), `classOptions`/`listOptions` memos, `handleClassSelection`, `pickPrimaryList` helper; replace the `:1255-1284` selector block with the two controls; remove the now-unused `showListSelector` state if `FocusControl` owns its own open state (grep first).
- No data-model, backend, or session-flow changes. No new Firestore fields (reuses `primaryFocusClassId`/`primaryFocusListId`).

---

## 6. Validation
1. esbuild-validate `Dashboard.jsx`.
2. Playwright (light + dark), 0 console errors:
   - **Single-class persona:** both controls render as **labels** (no chevron, not clickable).
   - **Dual-enroll persona** (reuse the staged throwaway-class setup): Class = **dropdown** (two class names), switching it changes hero + List label; List = label.
   - **Multi-list class** (the "SAT" student, or a staged 2-list class): List = **dropdown**.
   - Active-row highlight correct; selection persists across reload.
3. Snapshot + restore any staged personas/classes.

## 7. Open decisions (for reviewers/Codex)
1. `pickPrimaryList` rule when switching to a multi-list class: most-recently-assigned (mirror getPrimaryFocus) vs first — recommend mirror.
2. Layout of the two controls: stacked vs side-by-side in the welcome header; truncation for long class/list names.
3. Visual distinction of label-mode vs dropdown-mode (so a label doesn't look like a broken/disabled dropdown) — e.g., dropdown has chevron + border + hover; label has no chevron, lighter/no border.
4. 0-class rendering: nothing vs "No class enrolled" affordance.

## 8. Out of scope
- The orphan/duplicate `class_progress` data bug (separate; that's the `careful` root-cause).
- Teacher `ClassDetail` "Switch Class" (unrelated).
- Committing / deploying (owner-gated).

---

# 9. REVIEWER CORRECTIONS (v2) — supersede the conflicting parts of §2/§4
3 internal agents reviewed §1–8. The data-model/blast-radius claims verified accurate (Dashboard-only, tokens exist + work in dark, `ChevronDown` imported, getPrimaryFocus re-keys everything, no downstream selector consumers, new component justified — `ui/Select.jsx` is a native `<select>`, can't do this). The following corrections are LOCKED.

### 9.1 🔴 Null-safety / loading window (Agent 2 + Codex) — REQUIRED
The welcome header (`:1247`) renders **unconditionally**, so the controls are NOT inside any 0-class branch. `value={getPrimaryFocus.className}` would throw when `getPrimaryFocus === null` (0 classes) OR during the `studentClassesLoading` window (`studentClasses` starts `[]`). **Gate the entire two-control block on `getPrimaryFocus && classOptions.length > 0` AND `settingsLoaded` (`userSettings !== null`)**, keeping optional chaining inside. The `settingsLoaded` gate is REQUIRED (omnibus §9.13): without it the selector renders the **auto-selected** class during the userSettings-load window, and a click then **clobbers the student's real saved preference**. Render skeleton/neutral until settings resolve, except the verified loaded-empty (`{}`) case (genuine no-settings → auto-select is correct + clickable). §2b's non-optional prop spec is replaced by this gated render.

### 9.2 🔴 `handleClassSelection` must assert same-class list (Agent 2) — REQUIRED
The 3-tier resolver (`:923-945`) MASKS a bad write: if `handleClassSelection` persists a `primaryFocusListId` not in the new class, Tier 1a fails → Tier 1b (legacy list-only, `:938-943`) can match that list in **another** class and silently snap the focus there — worst precisely in the dual-enroll-same-list case this feature targets. **`handleClassSelection` must compute `nextList` from the new class and assert it belongs to that class before persisting** (guard wrong-class, not just `if(!nextList) return`).

### 9.3 🔴 `pickPrimaryList` field path (Agent 1) — REQUIRED
`assignedListDetails` entries do NOT carry `assignedAt` (db.js:508-513); it lives only in `klass.assignments[listId].assignedAt` (the dead `list.assignedAt` fallback at `:957` never fires). So `pickPrimaryList` must read **`klass.assignments[list.id]?.assignedAt`** (toDate-normalized, mirroring `:955-957`), else it silently degrades to "first list." (Acceptable fallback when no dates: `assignedListDetails[0]`.)

### 9.4 🟠 LABEL visual = borderless muted text, NOT a chevron-less box (Agents 2+3) — LOCKED
§2a's "same footprint, label = dropdown minus chevron" is REVERSED: a bordered `bg-surface` box without a chevron reads as a **disabled/broken dropdown** (no existing in-app precedent for that). Label mode must match the app's real read-only idiom — the hero eyebrow/stat-tile style (`:1316`, `:1373`): inline `prefix:` micro-label + value as **plain muted text, no border/shadow/hover/chevron**. The bordered+chevron box is reserved strictly for the interactive (≥2-option) mode.

### 9.5 🟠 Welcome-row layout (Agent 3) — REQUIRED
The header container `:1247` (`flex items-end justify-between`) has **no `gap`/`flex-wrap`/truncation**; always rendering two controls will crowd/overflow with long class/list names. Add `gap` + a right-side wrapper with `min-w-0 truncate` on the values. (Resolves open decision §7.2: side-by-side with truncation; stack on narrow if needed.)

### 9.6 🟠 a11y + close behavior (Agent 2) — REQUIRED
The current selector has NO ESC/outside-click close (the ESC handler `:603-614` only covers the PDF modal). `FocusControl` (owning its open state) must add **outside-click + ESC to close**, and **opening one dropdown closes the other** (Class + List can both be interactive in the multi-list-multi-class row). Label mode is plain text (not a `disabled` button) for screen readers; dropdown mode keeps button semantics + `aria-expanded`.

### 9.7 🟠 Cleanup completeness (Agent 3) — REQUIRED
Removing `showListSelector` must also delete **`setShowListSelector(false)` at `:278`** inside `handleListSelection` (plan §5 only named the `useState`). And **delete the now-dead `availableLists` memo (`:261-274`)** — it's consumed only inside the replaced block (`:1256`, `:1269`). (`availableLists` in ClassDetail/StudySelectionModal/Settings are unrelated local vars.)

### 9.8 🟡 List `activeKey`/`getKey` class-qualified (Agent 1) — LOCKED
Keep the List control's key class-qualified (`${classId}_${id}`) to match the existing intentional pattern (`:1271/1274`), robust even though `listOptions` is single-class-scoped.

### 9.10 🔴 (Codex H1) `listOptions` MUST be class-qualified — else it corrupts `primaryFocusClassId`
`assignedListDetails` entries are `{...listData, pace, testOptionsCount, testMode}` with **NO `classId`** (`db.js:508-513`). The current `availableLists` works only because it *adds* `classId: klass.id` (`:268`); `handleListSelection` then writes `primaryFocusClassId: list.classId` (`:281`). If §2c's `listOptions` is sourced from **raw** `assignedListDetails`, selecting a list writes `primaryFocusClassId: undefined` → degrades to legacy list-only resolution (re-introducing the very ambiguity F3/Fix-B fixes).
**Fix:** build `listOptions` class-qualified:
```
listOptions = (focusedClass?.assignedListDetails ?? []).map(l => ({ ...l, classId: focusedClass.id, className: focusedClass.name }))
```
(or wrap `handleListSelection(list, focusedClass.id)` and assert `classId` is set before persisting). Either way, the List control must never persist an `undefined` classId.

### 9.11 🟠 (Codex M1) FocusControl open-state must be PARENT-controlled (mutual close)
§2a "open/close state internal to each FocusControl" CONFLICTS with §9.6's "opening one dropdown closes the other" — sibling mutual-close with isolated internal state is unreliable. **Fix:** lift to parent: `const [openFocus, setOpenFocus] = useState(null)` (`'class' | 'list' | null`); pass `open={openFocus===kind}`, `onOpen={() => setOpenFocus(kind)}`, `onClose={() => setOpenFocus(null)}` into each `FocusControl`. Opening one sets the parent state, which closes the other for free. (Also makes outside-click/ESC a single handler.)

### 9.9 Open decisions now resolved
§7.1 → mirror getPrimaryFocus (9.3). §7.2 → side-by-side + truncate (9.5). §7.3 → borderless label (9.4). §7.4 → gate on `getPrimaryFocus && classOptions.length` (9.1).
