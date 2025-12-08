# Dropdown/Select Styles Audit

## 1. Dropdowns in Assignment/List Edit Modals

### AssignListModal.jsx

#### Select 1: List Selection (Line 48-59)
- **Full className:** `mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2`
- **Options:** Lists from teacher's library (shows "No lists available" if empty)
- **Label:** "List" (`text-sm font-medium text-slate-700`)
- **Wrapper:** `<label className="block text-sm font-medium text-slate-700">`

#### Select 2: Test Mode (Line 93-101)
- **Full className:** `mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2`
- **Options:** 
  - "Multiple Choice Only" (mcq)
  - "Written Only" (typed)
  - "Both" (both)
- **Label:** "Test Mode" (`text-sm font-medium text-slate-700`)
- **Wrapper:** `<label className="block text-sm font-medium text-slate-700">`

**Pattern:** Both use identical styling with `bg-slate-50` that changes to `bg-white` on focus.

---

### ClassDetail.jsx - Settings Modal

#### Select: Test Mode (Line 746-759)
- **Full className:** `mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:ring-2`
- **Options:**
  - "Multiple Choice Only" (mcq)
  - "Written Only" (typed)
  - "Both" (both)
- **Label:** "Test Mode" (`text-sm font-medium text-slate-700`)
- **Wrapper:** `<label className="block text-sm font-medium text-slate-700">`

**Difference:** Uses `bg-white` instead of `bg-slate-50` (no focus color change).

---

## 2. All Other Dropdowns in Codebase

### Gradebook.jsx - Rows Per Page Selector (Line 600-608)

- **Location:** Control bar above table
- **Full className:** `h-8 px-3 text-sm border border-slate-200 rounded-lg text-slate-600 focus:ring-brand-primary focus:ring-2 focus:border-brand-primary cursor-pointer bg-white`
- **Options:** 10, 50, 100
- **Label:** "Show:" (`text-sm text-slate-600`)
- **Wrapper:** `<div className="flex items-center gap-2">`
- **Differences:**
  - Smaller height (`h-8` vs `py-2`)
  - Uses `text-slate-600` instead of `text-slate-900`
  - Uses `focus:ring-brand-primary` instead of generic focus
  - Explicit `cursor-pointer`
  - Different border radius (`rounded-lg` vs `rounded-xl` in UI library)

---

### ClassDetail.jsx - Gradebook Tab Filter (Line 612-623)

- **Location:** Gradebook tab filter dropdown
- **Full className:** `rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2`
- **Options:** "All Lists" + assigned lists
- **Label:** "Filter:" (`text-sm text-slate-600`)
- **Wrapper:** `<div className="flex items-center gap-3">`
- **Differences:**
  - Smaller padding (`py-1.5` vs `py-2`)
  - No `w-full` (inline width)
  - Uses `rounded-lg` instead of `rounded-xl`
  - No focus color specification

---

### ListEditor.jsx - Part of Speech Select (Line 354-365)

- **Location:** Word form in ListEditor
- **Full className:** `mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2`
- **Options:** 
  - "—" (empty)
  - "n. (Noun)"
  - "v. (Verb)"
  - "adj. (Adjective)"
  - "adv. (Adverb)"
- **Label:** "Part of Speech" (`text-sm font-medium text-slate-700`)
- **Wrapper:** `<label className="block text-sm font-medium text-slate-700">`
- **Differences:**
  - Uses `bg-slate-50` with `focus:bg-white` (matches AssignListModal pattern)
  - Uses `rounded-lg` instead of `rounded-xl`

---

## 3. UI Library Component

### src/components/ui/Select.jsx

**Base Styles:**
- `w-full rounded-xl border border-slate-200 bg-white text-slate-900`
- `outline-none ring-slate-300`
- `focus:ring-2 focus:ring-brand-primary focus:border-brand-primary`
- `disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50`

**Sizes:**
- `sm`: `h-10 px-3 text-sm`
- `md`: `h-11 px-3 text-sm` (default)
- `lg`: `h-12 px-4 text-sm`

**Key Differences from Modal Dropdowns:**
1. ✅ Uses `rounded-xl` (more rounded)
2. ✅ Uses `bg-white` (no slate-50 background)
3. ✅ Uses `focus:ring-brand-primary` (brand color focus)
4. ✅ Uses `focus:border-brand-primary` (brand color border)
5. ❌ Missing `focus:bg-white` transition (modals have this)
6. ✅ Has disabled states
7. ✅ Has size variants

---

## 4. Summary Table

| Location | Current Style | Matches Modal Style? | Matches UI Library? | Notes |
|----------|---------------|---------------------|---------------------|-------|
| **AssignListModal** (List) | `rounded-lg border-slate-200 bg-slate-50 focus:bg-white focus:ring-2` | ✓ (reference) | ❌ | Uses `rounded-lg`, `bg-slate-50`, no brand color focus |
| **AssignListModal** (Test Mode) | `rounded-lg border-slate-200 bg-slate-50 focus:bg-white focus:ring-2` | ✓ (reference) | ❌ | Same as List select |
| **ClassDetail** (Settings Modal) | `rounded-lg border-slate-200 bg-white focus:ring-2` | ⚠️ Partial | ❌ | Uses `bg-white` (no slate-50), no focus color change |
| **ClassDetail** (Gradebook Filter) | `rounded-lg border-slate-200 bg-white py-1.5 focus:ring-2` | ❌ | ❌ | Smaller, inline width, no brand focus |
| **Gradebook** (Rows Per Page) | `rounded-lg border-slate-200 bg-white h-8 focus:ring-brand-primary` | ❌ | ⚠️ Partial | Smaller height, has brand focus but different size |
| **ListEditor** (Part of Speech) | `rounded-lg border-slate-200 bg-slate-50 focus:bg-white focus:ring-2` | ✓ | ❌ | Matches modal pattern but not UI library |

---

## 5. Style Inconsistencies Found

### Border Radius:
- **Modals:** `rounded-lg` (8px)
- **UI Library:** `rounded-xl` (12px)
- **Inconsistency:** Modals use less rounded corners

### Background:
- **Modals:** `bg-slate-50` with `focus:bg-white` transition
- **UI Library:** `bg-white` (no transition)
- **Inconsistency:** Different background patterns

### Focus States:
- **Modals:** Generic `focus:ring-2` (no color specified)
- **UI Library:** `focus:ring-brand-primary focus:border-brand-primary`
- **Inconsistency:** UI library uses brand colors, modals don't

### Size Variations:
- **Modals:** Fixed `px-3 py-2` (no size variants)
- **UI Library:** Size variants (sm, md, lg)
- **Inconsistency:** UI library is more flexible

### Height:
- **Gradebook filter:** `h-8` (32px)
- **Modals:** `py-2` (~36px with border)
- **UI Library:** `h-10` (sm), `h-11` (md), `h-12` (lg)
- **Inconsistency:** Different heights across components

---

## 6. Recommendations

### Option 1: Standardize on UI Library Component
- Replace all `<select>` elements with `<Select>` from `src/components/ui/Select.jsx`
- Ensures consistency across the app
- Provides size variants
- Uses brand colors for focus states

### Option 2: Update Modal Styles to Match UI Library
- Change `rounded-lg` → `rounded-xl`
- Remove `bg-slate-50` → use `bg-white`
- Add `focus:ring-brand-primary focus:border-brand-primary`
- Keep `focus:bg-white` transition if desired

### Option 3: Create Modal-Specific Variant
- Add a `variant="modal"` prop to UI Select component
- Maintains `bg-slate-50` → `bg-white` transition
- Uses `rounded-lg` for modals
- Keeps brand color focus states

**Recommended:** Option 1 (use UI library component) for consistency, with Option 3 as fallback if modal-specific styling is desired.

