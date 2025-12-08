# Card Pattern Audit

## Section 1: Summary

| Pattern | Count | Files |
|---------|-------|-------|
| `.surface-card` class | 4 | Dashboard.jsx (3), StudySelectionModal.jsx (1) |
| Inline card styling | 80+ | All pages and components |
| Modal/Dialog cards | 6 | CreateClassModal, ImportWordsModal, AssignListModal, StudySelectionModal, Login, Signup |
| Page section cards | 15+ | Dashboard, ClassDetail, ListLibrary, ListEditor, Gradebook |
| Content/List cards | 20+ | Dashboard, ListLibrary, ClassDetail |
| Flashcard | 1 | Flashcard.jsx |

---

## Section 2: Detailed Usage by File

### src/pages/Dashboard.jsx

#### Card 1: My Classes Section Container
- **Line:** 356
- **Classes:** `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm`
- **Padding:** p-6
- **Radius:** rounded-3xl
- **Shadow:** shadow-sm
- **Border:** border-slate-200

#### Card 2: Class Card (Individual)
- **Line:** 385
- **Classes:** `flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5`
- **Padding:** p-5
- **Radius:** rounded-2xl
- **Shadow:** none
- **Border:** border-slate-200

#### Card 3: My Vocabulary Lists Section Container
- **Line:** 438
- **Classes:** `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm`
- **Padding:** p-6
- **Radius:** rounded-3xl
- **Shadow:** shadow-sm
- **Border:** border-slate-200

#### Card 4: List Card (Individual)
- **Line:** 469
- **Classes:** `group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:border-brand-primary/30`
- **Padding:** p-5
- **Radius:** rounded-2xl
- **Shadow:** none (hover:shadow-md)
- **Border:** border-slate-200

#### Card 5: Empty State Card
- **Line:** 427, 529
- **Classes:** `rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center`
- **Padding:** p-8
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-dashed border-slate-300

#### Card 6: Error Alert Card
- **Line:** 370, 454
- **Classes:** `rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700`
- **Padding:** px-3 py-2
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-red-200

#### Card 7: Student Dashboard - Focus Panel
- **Line:** 829
- **Classes:** `py-4 px-6 min-h-[280px] flex flex-col justify-center h-full rounded-2xl border shadow-lg` (with gradient backgrounds)
- **Padding:** py-4 px-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** border (color varies)

#### Card 8: Student Dashboard - Vitals Card
- **Line:** 907, 932, 957
- **Classes:** `bg-white border border-slate-200 rounded-2xl flex items-center gap-4 p-4 flex-1 shadow-sm hover:shadow-md transition-shadow`
- **Padding:** p-4
- **Radius:** rounded-2xl
- **Shadow:** shadow-sm (hover:shadow-md)
- **Border:** border-slate-200

#### Card 9: Student Dashboard - Activity Bar
- **Line:** 990
- **Classes:** `bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-row items-center justify-between gap-6 px-6 h-28`
- **Padding:** px-6
- **Radius:** rounded-3xl
- **Shadow:** shadow-sm
- **Border:** border-slate-200

#### Card 10: Student Dashboard - surface-card Usage
- **Line:** 1053, 1068, 1108, 1147
- **Classes:** `surface-card p-6`, `surface-card p-12`, `surface-card p-4`, `surface-card p-5`
- **Padding:** p-4, p-5, p-6, p-12
- **Radius:** rounded-xl (from CSS class)
- **Shadow:** shadow-sm (from CSS class)
- **Border:** border-slate-300 (from CSS class)

---

### src/pages/ClassDetail.jsx

#### Card 1: Page Header
- **Line:** 409
- **Classes:** `rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200 (no border class)

#### Card 2: Join Code Display
- **Line:** 479
- **Classes:** `rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-4 text-center`
- **Padding:** px-6 py-4
- **Radius:** rounded-xl
- **Shadow:** none
- **Border:** border-dashed border-slate-300

#### Card 3: Section Container (Assigned Lists)
- **Line:** 507
- **Classes:** `rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-md
- **Border:** ring-1 ring-slate-100

#### Card 4: Assigned List Card
- **Line:** 522
- **Classes:** `rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-slate-200 hover:bg-white`
- **Padding:** p-4
- **Radius:** rounded-xl
- **Shadow:** none
- **Border:** border-slate-100

#### Card 5: Section Container (Students)
- **Line:** 593
- **Classes:** `rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-md
- **Border:** ring-1 ring-slate-100

#### Card 6: Empty State Card
- **Line:** 583, 703
- **Classes:** `rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center`
- **Padding:** p-8
- **Radius:** rounded-xl
- **Shadow:** none
- **Border:** border-dashed border-slate-300

#### Card 7: Settings Card
- **Line:** 706
- **Classes:** `rounded-xl border border-slate-300 bg-white px-6 py-4`
- **Padding:** px-6 py-4
- **Radius:** rounded-xl
- **Shadow:** none
- **Border:** border-slate-300

#### Card 8: Section Container (Gradebook)
- **Line:** 726
- **Classes:** `rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-md
- **Border:** ring-1 ring-slate-100

#### Card 9: Modal Container
- **Line:** 752
- **Classes:** `w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-2xl
- **Border:** none

#### Card 10: Class Switcher Popover
- **Line:** 445
- **Classes:** `absolute top-full left-0 mt-2 z-20 w-72 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden`
- **Padding:** p-2 (internal)
- **Radius:** rounded-xl
- **Shadow:** shadow-lg
- **Border:** border-slate-200

---

### src/pages/Gradebook.jsx

#### Card 1: Filter Toolbox
- **Line:** 669
- **Classes:** `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6`
- **Padding:** p-6
- **Radius:** rounded-3xl
- **Shadow:** shadow-sm
- **Border:** border-slate-200

#### Card 2: Calendar Popup
- **Line:** 784
- **Classes:** `bg-white border border-slate-200 rounded-xl p-4 shadow-lg max-w-xs`
- **Padding:** p-4
- **Radius:** rounded-xl
- **Shadow:** shadow-lg
- **Border:** border-slate-200

#### Card 3: Results Table Container
- **Line:** 910
- **Classes:** `bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden`
- **Padding:** none (internal padding on cells)
- **Radius:** rounded-3xl
- **Shadow:** shadow-sm
- **Border:** border-slate-200

#### Card 4: Detail Drawer Content
- **Line:** 1274
- **Classes:** `rounded-xl border border-slate-200 bg-white p-4`
- **Padding:** p-4
- **Radius:** rounded-xl
- **Shadow:** none
- **Border:** border-slate-200

---

### src/pages/ListLibrary.jsx

#### Card 1: Page Header
- **Line:** 40
- **Classes:** `rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200

#### Card 2: Section Container
- **Line:** 65
- **Classes:** `rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-md
- **Border:** ring-1 ring-slate-100

#### Card 3: List Card (Individual)
- **Line:** 74
- **Classes:** `rounded-xl border border-slate-100 bg-slate-50/60 p-5 transition hover:border-slate-200 hover:bg-white flex flex-col gap-3`
- **Padding:** p-5
- **Radius:** rounded-xl
- **Shadow:** none
- **Border:** border-slate-100

---

### src/pages/ListEditor.jsx

#### Card 1: Page Header
- **Line:** 259
- **Classes:** `rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200

#### Card 2: Section Container (List Details)
- **Line:** 269
- **Classes:** `rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-md
- **Border:** ring-1 ring-slate-100

#### Card 3: Alert Card (Error)
- **Line:** 279, 333
- **Classes:** `rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700`
- **Padding:** px-3 py-2
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-red-200

#### Card 4: Alert Card (Success)
- **Line:** 284, 338
- **Classes:** `rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700`
- **Padding:** px-3 py-2
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-emerald-200

#### Card 5: Section Container (Words)
- **Line:** 324, 458
- **Classes:** `rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-md
- **Border:** ring-1 ring-slate-100

#### Card 6: Word List Container
- **Line:** 399
- **Classes:** `rounded-lg border border-slate-200 bg-slate-50 p-4`
- **Padding:** p-4
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-slate-200

---

### src/pages/TypedTest.jsx

#### Card 1: Error Modal
- **Line:** 221
- **Classes:** `relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** none

#### Card 2: No Words Modal
- **Line:** 239
- **Classes:** `relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** none

#### Card 3: Progress Bar Container
- **Line:** 270
- **Classes:** `mb-6 flex items-center justify-between rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200

#### Card 4: Test Container
- **Line:** 283
- **Classes:** `space-y-4 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200

#### Card 5: Error Alert
- **Line:** 316
- **Classes:** `mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700`
- **Padding:** px-4 py-3
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-red-200

---

### src/pages/TakeTest.jsx

#### Card 1: Error Modal
- **Line:** 159
- **Classes:** `relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** none

#### Card 2: No Words Modal
- **Line:** 210
- **Classes:** `relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** none

#### Card 3: Question Card
- **Line:** 257
- **Classes:** `flex aspect-[2/1] flex-col items-center justify-center rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-xl`
- **Padding:** p-8
- **Radius:** rounded-3xl
- **Shadow:** shadow-xl
- **Border:** border-2 border-slate-200

#### Card 4: Option Button Card
- **Line:** 291
- **Classes:** `min-h-[80px] rounded-2xl border-2 p-4 text-left transition-all` (with conditional classes)
- **Padding:** p-4
- **Radius:** rounded-2xl
- **Shadow:** none (hover:shadow-md)
- **Border:** border-2 (color varies)

---

### src/pages/StudySession.jsx

#### Card 1: Error Modal
- **Line:** 105
- **Classes:** `relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** none

#### Card 2: Completion Modal
- **Line:** 120
- **Classes:** `relative z-10 w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-xl
- **Border:** ring-1 ring-slate-200

---

### src/pages/Login.jsx

#### Card 1: Login Form Container
- **Line:** 61
- **Classes:** `w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200

---

### src/pages/Signup.jsx

#### Card 1: Signup Form Container
- **Line:** 68
- **Classes:** `w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-8
- **Radius:** rounded-2xl
- **Shadow:** shadow-lg
- **Border:** ring-1 ring-slate-200

---

### src/components/Flashcard.jsx

#### Card 1: Flashcard Component
- **Line:** 45
- **Classes:** `relative mx-auto h-96 w-full max-w-2xl cursor-pointer select-none rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-2xl transition hover:shadow-blue-100`
- **Padding:** p-10
- **Radius:** rounded-3xl
- **Shadow:** shadow-2xl
- **Border:** border-slate-100

---

### src/components/CreateClassModal.jsx

#### Card 1: Modal Container
- **Line:** 36
- **Classes:** `w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-2xl
- **Border:** none

---

### src/components/ImportWordsModal.jsx

#### Card 1: Modal Container
- **Line:** 205
- **Classes:** `w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-2xl
- **Border:** none

---

### src/components/AssignListModal.jsx

#### Card 1: Modal Container
- **Line:** 32
- **Classes:** `w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-2xl
- **Border:** none

---

### src/components/modals/StudySelectionModal.jsx

#### Card 1: Modal Container
- **Line:** 33
- **Classes:** `w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl`
- **Padding:** p-6
- **Radius:** rounded-2xl
- **Shadow:** shadow-2xl
- **Border:** none

#### Card 2: List Item Card (surface-card)
- **Line:** 61
- **Classes:** `block surface-card p-4 transition hover:shadow-md`
- **Padding:** p-4
- **Radius:** rounded-xl (from CSS)
- **Shadow:** shadow-sm (from CSS, hover:shadow-md)
- **Border:** border-slate-300 (from CSS)

#### Card 3: Empty State Card
- **Line:** 49
- **Classes:** `rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center`
- **Padding:** p-8
- **Radius:** rounded-lg
- **Shadow:** none
- **Border:** border-dashed border-slate-300

---

### src/components/HeaderBar.jsx

#### Card 1: Classes Dropdown Menu
- **Line:** 104
- **Classes:** `absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden`
- **Padding:** internal padding
- **Radius:** rounded-xl
- **Shadow:** shadow-lg
- **Border:** border-slate-200

#### Card 2: Avatar Dropdown Menu
- **Line:** 166
- **Classes:** `absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden`
- **Padding:** internal padding
- **Radius:** rounded-xl
- **Shadow:** shadow-lg
- **Border:** border-slate-200

---

### src/components/ui/Card.jsx

#### Card Component Definition
- **Variants:** default, hoverable, hero, gradient, vitals
- **Sizes:** sm (rounded-xl p-4), md (rounded-2xl p-5), lg (rounded-3xl p-6), xl (rounded-3xl p-8)
- **Note:** This is a reusable component but not widely used yet

---

### src/index.css

#### .surface-card Utility Class
- **Line:** 152-158
- **Definition:**
  ```css
  .surface-card {
    background-color: rgb(255, 255, 255);
    border: 1px solid rgb(203, 213, 225); /* slate-300 */
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
    border-radius: 1rem; /* rounded-xl */
    transition: all 0.2s;
  }
  ```
- **Padding:** Not included (must be added separately)
- **Radius:** rounded-xl (1rem)
- **Shadow:** shadow-sm equivalent
- **Border:** border-slate-300

---

## Section 3: Pattern Analysis

### Page Section Cards (Large Containers)

**Common Pattern:**
- **Classes:** `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm`
- **Padding:** p-6 (most common), p-8 (headers)
- **Radius:** rounded-3xl (sections), rounded-2xl (headers)
- **Shadow:** shadow-sm (sections), shadow-lg (headers)
- **Border:** border-slate-200 (most common), ring-1 ring-slate-200 (some headers)

**Examples:**
- Dashboard section containers: `rounded-3xl p-6 shadow-sm`
- Page headers: `rounded-2xl p-8 shadow-lg ring-1 ring-slate-200`
- Section containers: `rounded-2xl p-6 shadow-md ring-1 ring-slate-100`

---

### Content Cards (List Items, Smaller Cards)

**Common Pattern:**
- **Classes:** `bg-white border border-slate-200 rounded-2xl p-5` (with hover effects)
- **Padding:** p-4, p-5
- **Radius:** rounded-2xl (most common), rounded-xl (some)
- **Shadow:** none (hover:shadow-md)
- **Border:** border-slate-200, border-slate-100

**Examples:**
- Class cards: `rounded-2xl border border-slate-200 bg-white p-5`
- List cards: `rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md`
- Assigned list cards: `rounded-xl border border-slate-100 bg-slate-50/60 p-4`

---

### Modal/Dialog Cards

**Common Pattern:**
- **Classes:** `rounded-2xl bg-white p-6 shadow-2xl` or `p-8 shadow-lg ring-1 ring-slate-200`
- **Padding:** p-6 (modals), p-8 (full-page modals)
- **Radius:** rounded-2xl (consistent)
- **Shadow:** shadow-2xl (modals), shadow-lg (full-page)
- **Border:** none (most modals), ring-1 ring-slate-200 (some)

**Examples:**
- Standard modals: `rounded-2xl bg-white p-6 shadow-2xl`
- Full-page modals: `rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200`
- Error/No words modals: `rounded-2xl bg-white p-8 text-center shadow-lg`

---

### Stat/Info Cards

**Common Pattern:**
- **Classes:** `bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md`
- **Padding:** p-4
- **Radius:** rounded-2xl
- **Shadow:** shadow-sm (hover:shadow-md)
- **Border:** border-slate-200

**Examples:**
- Vitals cards: `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md`
- Activity bar: `rounded-3xl border border-slate-200 bg-white shadow-sm`

---

### Alert/Status Cards

**Common Pattern:**
- **Classes:** `rounded-lg border border-{color}-200 bg-{color}-50 px-3 py-2`
- **Padding:** px-3 py-2
- **Radius:** rounded-lg (consistent)
- **Shadow:** none
- **Border:** border-red-200, border-emerald-200, border-amber-200

**Examples:**
- Error alerts: `rounded-lg border border-red-200 bg-red-50 px-3 py-2`
- Success alerts: `rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2`

---

### Empty State Cards

**Common Pattern:**
- **Classes:** `rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center`
- **Padding:** p-8
- **Radius:** rounded-lg, rounded-xl
- **Shadow:** none
- **Border:** border-dashed border-slate-300

**Examples:**
- Empty lists: `rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8`
- Empty classes: `rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8`

---

## Section 4: Inconsistencies Found

### Border Radius Variations

1. **rounded-lg** (0.5rem) - Used for:
   - Alert cards
   - Empty state cards
   - Small containers
   - Word list containers

2. **rounded-xl** (0.75rem) - Used for:
   - List cards (some)
   - Calendar popups
   - Dropdown menus
   - Join code displays
   - Settings cards
   - `.surface-card` utility class

3. **rounded-2xl** (1rem) - Used for:
   - Page headers
   - Section containers
   - Content cards (most common)
   - Modals
   - Flashcard containers

4. **rounded-3xl** (1.5rem) - Used for:
   - Large section containers
   - Activity bars
   - Filter toolboxes
   - Flashcard component

**Issue:** No clear hierarchy - same purpose cards use different radii

---

### Padding Variations

1. **px-3 py-2** - Alert cards
2. **p-4** - Small cards, list items, calendar popups
3. **p-5** - Content cards, list cards
4. **p-6** - Section containers, modals
5. **p-8** - Page headers, empty states, full-page modals
6. **p-10** - Flashcard component
7. **p-12** - Large surface-card usage

**Issue:** Padding doesn't always correlate with card size/purpose

---

### Shadow Variations

1. **none** - Many content cards (rely on hover)
2. **shadow-sm** - Section containers, activity bars
3. **shadow-md** - Section containers (some), hover states
4. **shadow-lg** - Page headers, modals, calendar popups
5. **shadow-xl** - Question cards, completion modals
6. **shadow-2xl** - Modals, flashcard component

**Issue:** Shadow intensity doesn't always match card importance

---

### Border Color Variations

1. **border-slate-100** - Subtle borders (assigned list cards)
2. **border-slate-200** - Standard borders (most common)
3. **border-slate-300** - Dashed borders (empty states, settings)
4. **ring-1 ring-slate-100** - Subtle ring (section containers)
5. **ring-1 ring-slate-200** - Standard ring (page headers)
6. **border-red-200, border-emerald-200** - Status colors

**Issue:** Mix of `border` and `ring` utilities for similar purposes

---

### Background Variations

1. **bg-white** - Standard (most common)
2. **bg-slate-50** - Empty states, subtle backgrounds
3. **bg-slate-50/60** - Semi-transparent (list cards)
4. **bg-red-50, bg-emerald-50** - Status backgrounds

**Issue:** Some cards use semi-transparent backgrounds inconsistently

---

## Section 5: Proposed Card Variants

Based on usage patterns, here are proposed standardized variants:

| Variant | Use Case | Proposed Styles |
|---------|----------|-----------------|
| **`section`** | Large page sections (My Classes, My Lists containers) | `bg-white border border-slate-200 rounded-3xl p-6 shadow-sm` |
| **`header`** | Page headers | `bg-white rounded-2xl p-8 shadow-lg ring-1 ring-slate-200` |
| **`content`** | List items, class cards, content cards | `bg-white border border-slate-200 rounded-2xl p-5 transition-all hover:shadow-md hover:border-brand-primary/30` |
| **`modal`** | Modal dialogs | `bg-white rounded-2xl p-6 shadow-2xl` |
| **`inset`** | Nested cards, subtle cards | `bg-slate-50/60 border border-slate-100 rounded-xl p-4` |
| **`interactive`** | Clickable cards (CardButton) | `bg-white border border-slate-200 rounded-2xl p-5 transition-all hover:shadow-md hover:border-brand-primary/30 active:scale-[0.99]` |
| **`alert-error`** | Error messages | `bg-red-50 border border-red-200 rounded-lg px-3 py-2` |
| **`alert-success`** | Success messages | `bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2` |
| **`empty`** | Empty states | `bg-slate-50 border border-dashed border-slate-300 rounded-lg p-8 text-center` |
| **`stat`** | Stat/info cards (vitals) | `bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow` |

### Size Variants

| Size | Padding | Radius | Use Case |
|------|---------|--------|----------|
| **sm** | p-4 | rounded-xl | Small cards, list items |
| **md** | p-5 | rounded-2xl | Standard content cards |
| **lg** | p-6 | rounded-3xl | Section containers |
| **xl** | p-8 | rounded-2xl | Page headers, modals |

### Recommendations

1. **Standardize on `border` utility** instead of mixing `border` and `ring`
2. **Use consistent radius hierarchy:** rounded-lg (alerts) → rounded-xl (small) → rounded-2xl (standard) → rounded-3xl (large sections)
3. **Standardize shadow levels:** none (content) → shadow-sm (sections) → shadow-lg (headers) → shadow-2xl (modals)
4. **Create Card component variants** matching these patterns
5. **Migrate `.surface-card` usage** to Card component or standardize its definition
6. **Use consistent padding scale:** p-4 (small) → p-5 (medium) → p-6 (large) → p-8 (extra large)

