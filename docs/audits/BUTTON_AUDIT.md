# Button Audit Report

**Date:** Generated from comprehensive codebase scan  
**Scope:** All button-like elements in `src/pages/`, `src/components/`, and `src/components/ui/`

---

## Section 1: UI Component Definitions

### `src/components/ui/Button.jsx`

**Variants:**
- `primary` - Orange CTA (bg-brand-accent, white text, shadow-brand-accent/30)
- `primary-blue` - Blue Primary (bg-brand-primary, white text, shadow-lg)
- `secondary` - Outlined (border-brand-primary, white bg, text-brand-primary)
- `ghost` - Ghost (white bg, border-slate-200, text-brand-primary)
- `outline` - Outline (border-slate-300, white bg, text-slate-700)
- `danger` - Danger (bg-red-600, white text)

**Sizes:**
- `sm` - h-8 px-3 text-xs gap-1.5
- `md` - h-10 px-4 text-sm gap-2
- `lg` - h-12 px-4 text-sm gap-2 (default)
- `xl` - h-14 px-6 text-base gap-2

**Base Classes:**
- `inline-flex items-center justify-center rounded-xl transition-all active:scale-95`
- `disabled:opacity-50 disabled:cursor-not-allowed`

---

### `src/components/ui/IconButton.jsx`

**Variants:**
- `default` - text-slate-400 hover:text-brand-primary hover:bg-blue-50
- `danger` - text-slate-400 hover:text-red-600 hover:bg-red-50
- `ghost` - text-slate-500 hover:text-slate-700 hover:bg-slate-100

**Sizes:**
- `sm` - h-8 w-8
- `md` - h-10 w-10 (default)
- `lg` - h-12 w-12

**Base Classes:**
- `inline-flex items-center justify-center rounded-lg transition-colors`
- `disabled:opacity-50 disabled:cursor-not-allowed`

---

### `src/components/ui/NavButton.jsx`

**Props:**
- `to` - React Router path
- `icon` - Lucide icon component
- `active` - boolean (default: false)
- `children` - button text

**Active State:**
- Active: `bg-brand-primary text-white hover:bg-brand-primary/90`
- Inactive: `bg-white border border-slate-200 text-brand-primary hover:bg-slate-50`

**Base Classes:**
- `h-12 flex items-center gap-2 px-5 rounded-xl shadow-sm font-heading font-bold transition-colors`

---

## Section 2: Button Usage by File

### `src/pages/Dashboard.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 351 | `<button>` | Create New Class | Inline | `h-12 flex items-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-brand-accent-hover transition-colors` |
| 367 | `<button>` | Refresh classes | Inline | `h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-primary hover:bg-blue-50 transition-colors` |
| 411 | `<button>` | Delete class | Inline | `h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60` |
| 425 | `<Link>` | Open Class | Inline | `h-10 inline-flex items-center gap-1 rounded-xl bg-blue-50 px-4 text-sm font-bold text-brand-primary hover:bg-blue-100 transition-colors` |
| 451 | `<Link>` | View All Lists | Inline | `h-12 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors` |
| 458 | `<Link>` | Create New List | Inline | `h-12 flex items-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-brand-accent-hover transition-colors` |
| 496 | `<button>` | Delete list | Inline | `h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60` |
| 512 | `<Link>` | Edit List | Inline | `h-10 inline-flex items-center gap-1 rounded-xl bg-blue-50 px-4 text-sm font-bold text-brand-primary hover:bg-blue-100 transition-colors` |
| 519 | `<button>` | Download PDF | Inline | `h-10 inline-flex items-center gap-1.5 rounded-xl border border-brand-primary bg-white px-3 text-sm font-semibold text-brand-primary transition hover:bg-blue-50 disabled:opacity-60` |
| 864 | `<button>` | Study Now (student) | Inline | `w-full h-14 flex items-center justify-center gap-2 rounded-xl px-6 text-base font-bold border-none shadow-sm transition hover:bg-white/90` (dynamic colors) |
| 890 | `<button>` | Take Test (student) | Inline | `w-full h-14 flex items-center justify-center gap-2 rounded-xl bg-transparent text-white font-bold border-2 border-white hover:bg-white/20 transition-all active:scale-95` |
| 1097 | `<button>` | Join Class (form) | Inline | `h-12 flex items-center justify-center rounded-xl bg-brand-primary px-6 text-sm font-semibold text-white transition hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 disabled:opacity-60` |
| 1133 | `<button>` | Join (form) | Inline | `h-12 flex items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 disabled:opacity-60` |
| 1235 | `<Link>` | Study Now (student list) | Inline | `h-12 flex items-center justify-center gap-2 rounded-xl bg-brand-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-accent-hover shadow-brand-accent/30` |
| 1249 | `<Link>` | Take Test (student list) | Inline | `h-12 flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-heading font-bold text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all active:scale-95` |
| 1257 | `<Link>` | Typed Test (student list) | Inline | `h-12 flex items-center justify-center gap-2 rounded-xl border border-brand-primary bg-white px-4 text-sm font-heading font-bold text-brand-primary hover:bg-blue-50 shadow-sm transition-all active:scale-95` |
| 1267 | `<button>` | Download PDF (student) | Inline | `h-12 flex items-center justify-center gap-1.5 rounded-xl border border-brand-primary bg-white px-4 text-sm font-semibold text-brand-primary transition hover:bg-blue-50 disabled:opacity-60` |

---

### `src/pages/ClassDetail.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 306 | `<button>` | Class switcher toggle | Inline | `flex items-center gap-2 text-3xl font-heading font-bold text-slate-900 hover:text-brand-primary transition-colors` |
| 334 | `<button>` | Tab: Assigned Lists | Inline | `px-4 py-2 text-sm font-semibold transition` (dynamic border-b-2) |
| 425 | `<button>` | Tab: Students | Inline | `px-4 py-2 text-sm font-semibold transition` (dynamic border-b-2) |
| 436 | `<button>` | Tab: Gradebook | Inline | `px-4 py-2 text-sm font-semibold transition` (dynamic border-b-2) |
| 414 | `<button>` | Assign List | Inline | `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60` |
| 457 | `<button>` | Settings (gear icon) | Inline | `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600` |
| 489 | `<button>` | Edit word | Inline | `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600` |
| 536 | `<button>` | Delete word | Inline | `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600` |
| 557 | `<button>` | Save Settings | Inline | `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60` |
| 594 | `<button>` | Cancel Settings | Inline | `rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 661 | `<button>` | Close Settings | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 683 | `<Button>` | Open Gradebook | Component | `variant="primary-blue" size="lg"` |
| 711 | `<button>` | Close Settings | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 780 | `<button>` | Close Settings | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 788 | `<button>` | Close Settings | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |

---

### `src/pages/Gradebook.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 509 | `<button>` | Category filter button | Inline | `h-10 px-4 rounded-xl border font-medium transition-colors` (dynamic active state) |
| 529 | `<button>` | Category filter button (locked) | Inline | `h-10 px-4 rounded-xl border font-medium transition-colors` (dynamic active state) |
| 596 | `<button>` | Add Filter | Inline | `h-10 px-4 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accent-hover transition-colors` |
| 620 | `<button>` | Remove tag (X) | Inline | `hover:opacity-70 transition-opacity` |
| 657 | `<button>` | Check All | Inline | `h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors` |
| 671 | `<button>` | Uncheck All | Inline | `h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors` |
| 691 | `<button>` | Export | Inline | `h-10 bg-brand-accent text-white rounded-xl font-bold px-4 transition hover:bg-brand-accent-hover` |
| 826 | `<button>` | View Details | Inline | `text-sm font-semibold text-brand-primary hover:text-brand-accent transition-colors` |
| 867 | `<button>` | Previous page | Inline | `h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors` |
| 879 | `<button>` | Next page | Inline | `h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors` |
| 924 | `<button>` | Close drawer | Inline | `h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors` |
| 1053 | `<button>` | Accept challenge | Inline | `flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition` |
| 1069 | `<button>` | Reject challenge | Inline | `flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition` |
| 1122 | `<button>` | Challenge (student) | Inline | `text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded transition` |
| 1187 | `<button>` | Cancel challenge | Inline | `flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 1198 | `<button>` | Submit challenge | Inline | `flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700` |

---

### `src/pages/ListEditor.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 309 | `<button>` | Create/Save List | Inline | `rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60` |
| 427 | `<button>` | Add/Update Word | Inline | `flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60` |
| 441 | `<button>` | Cancel Edit | Inline | `flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 449 | `<button>` | Import Words | Inline | `flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 491 | `<button>` | Edit word | Inline | `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600` |
| 512 | `<button>` | Delete word | Inline | `rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600` |

---

### `src/pages/ListLibrary.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 50 | `<button>` | Create New List | Inline | `h-12 flex items-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-brand-accent-hover transition-colors` |

---

### `src/pages/TakeTest.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 161 | `<button>` | Try Again | Inline | `mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700` |
| 168 | `<button>` | Go Back | Inline | `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 220 | `<button>` | Go Back | Inline | `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 258 | `<button>` | Quit to Dashboard | Inline | `rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60` |
| 281 | `<button>` | Play Audio | Inline | `mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-60` |
| 302 | `<button>` | MCQ option | Inline | `min-h-[80px] rounded-2xl border-2 p-4 text-left transition-all` (dynamic selected state) |

---

### `src/pages/TypedTest.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 223 | `<button>` | Try Again | Inline | `mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700` |
| 230 | `<button>` | Go Back | Inline | `mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 249 | `<button>` | Go Back | Inline | `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 288 | `<button>` | Submit Test | Inline | `rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50` |

---

### `src/pages/Login.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 104 | `<button>` | Continue (submit) | Inline | `w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70` |
| 119 | `<button>` | Continue with Google | Inline | `w-full flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:cursor-not-allowed disabled:opacity-70` |

---

### `src/pages/Signup.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 154 | `<button>` | Create Account (submit) | Inline | `w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-70` |
| 169 | `<button>` | Continue with Google | Inline | `w-full flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:cursor-not-allowed disabled:opacity-70` |

---

### `src/pages/StudySession.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 107 | `<button>` | Go Back | Inline | `mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 154 | `<button>` | Back to Dashboard | Inline | `mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700` |
| 201 | `<button>` | Again | Inline | `flex-1 rounded-2xl bg-red-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-red-100 transition hover:bg-red-600 disabled:opacity-60` |
| 209 | `<button>` | Hard | Inline | `flex-1 rounded-2xl bg-amber-400 px-6 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-100 transition hover:bg-amber-500 disabled:opacity-60` |
| 217 | `<button>` | Easy | Inline | `flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 disabled:opacity-60` |

---

### `src/components/HeaderBar.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 78 | `<NavButton>` | Dashboard | Component | `to="/" icon={Home} active={location.pathname === '/'}` |
| 85 | `<button>` | Classes dropdown toggle | Inline | `h-12 flex items-center gap-2 px-5 rounded-xl shadow-sm font-heading font-bold transition-colors` (dynamic active state) |
| 134 | `<NavButton>` | Gradebook | Component | `to={gradebookPath} icon={ClipboardList} active={isOnGradebook}` |
| 144 | `<NavButton>` | Lists | Component | `to="/lists" icon={BookOpen} active={isOnLists}` |
| 155 | `<button>` | Avatar dropdown | Inline | `h-12 w-12 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-brand-primary transition-colors` |
| 195 | `<button>` | Sign Out | Inline | `w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors` |

---

### `src/components/TestResults.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 175 | `<Button>` | Challenge | Component | `variant="secondary" size="md"` |
| 205 | `<Button>` | Back to Dashboard | Component | `variant="primary" size="lg"` |
| 218 | `<IconButton>` | Close modal | Component | `variant="ghost" size="sm"` |
| 267 | `<Button>` | Cancel challenge | Component | `variant="outline" size="lg" className="flex-1"` |
| 278 | `<Button>` | Submit challenge | Component | `variant="primary-blue" size="lg" className="flex-1"` |

---

### `src/components/AssignListModal.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 36 | `<button>` | Close modal | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 108 | `<button>` | Cancel | Inline | `flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 115 | `<button>` | Assign List | Inline | `flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60` |

---

### `src/components/CreateClassModal.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 40 | `<button>` | Close modal | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 69 | `<button>` | Cancel | Inline | `flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 76 | `<button>` | Create Class | Inline | `flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60` |

---

### `src/components/ImportWordsModal.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 211 | `<button>` | Close modal | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 238 | `<button>` | Download Template | Inline | `rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 298 | `<button>` | Cancel | Inline | `flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |
| 305 | `<button>` | Import Words | Inline | `flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition` (dynamic disabled state) |

---

### `src/components/modals/StudySelectionModal.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 41 | `<button>` | Close modal | Inline | `rounded-full p-1 text-slate-500 transition hover:bg-slate-100` |
| 111 | `<button>` | Cancel | Inline | `h-12 flex items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |

---

### `src/components/Flashcard.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 146 | `<button>` | Play Audio | Inline | `inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60` |

---

### `src/components/CollapsibleCard.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 51 | `<button>` | Show More/Less | Inline | `rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50` |

---

### `src/components/ui/Modal.jsx`

| Line | Element | Purpose | Styling Method | Classes/Variant |
|------|---------|---------|----------------|-----------------|
| 36 | `<IconButton>` | Close modal | Component | `variant="ghost" size="sm"` |

---

## Section 3: Pattern Analysis

### Primary CTA (Main Actions)
**Pattern:** Orange accent (`bg-brand-accent`) or Blue primary (`bg-brand-primary`)
- **Examples:**
  - Create New Class (`Dashboard.jsx:351`)
  - Create New List (`Dashboard.jsx:458`, `ListLibrary.jsx:50`)
  - Study Now (`Dashboard.jsx:1235`)
  - Submit Test (`TypedTest.jsx:288`)
  - Join Class (`Dashboard.jsx:1097`)

**Inconsistencies:**
- Some use `font-bold`, others use `font-semibold`
- Heights vary: `h-12`, `h-14`
- Some have `shadow-sm`, others `shadow-lg`

---

### Secondary CTA (Alternative Actions)
**Pattern:** Outlined with brand-primary border or blue-50 background
- **Examples:**
  - Typed Test (`Dashboard.jsx:1257`)
  - View All Lists (`Dashboard.jsx:451`)
  - Open Class (`Dashboard.jsx:425`)
  - Edit List (`Dashboard.jsx:512`)

**Inconsistencies:**
- Border colors: `border-brand-primary`, `border-slate-300`
- Backgrounds: `bg-white`, `bg-blue-50`
- Heights: `h-10`, `h-12`

---

### Outlined/Ghost (Low-Emphasis)
**Pattern:** White background with border, or minimal styling
- **Examples:**
  - Cancel buttons (multiple modals)
  - Go Back (`TakeTest.jsx:168`, `TypedTest.jsx:230`)
  - Manage Lists (`ClassDetail.jsx:392`)

**Inconsistencies:**
- Border colors: `border-slate-200`, `border-slate-300`
- Padding: `px-4 py-2`, `px-3 py-2`
- Heights: `h-10`, `h-12`, `h-8`

---

### Danger (Destructive Actions)
**Pattern:** Red background or red hover states
- **Examples:**
  - Delete class/list (`Dashboard.jsx:411`, `Dashboard.jsx:496`)
  - Reject challenge (`Gradebook.jsx:1069`)
  - Again button (`StudySession.jsx:201`)

**Inconsistencies:**
- Some use `bg-red-600`, others `bg-red-500`
- Icon buttons use `hover:text-red-600 hover:bg-red-50`
- Heights: `h-8 w-8`, `h-10 w-10`

---

### Success (Positive Actions)
**Pattern:** Green/emerald backgrounds
- **Examples:**
  - Accept challenge (`Gradebook.jsx:1053`)
  - Easy button (`StudySession.jsx:217`)
  - Add Word (`ListEditor.jsx:427`)

**Inconsistencies:**
- Colors: `bg-green-600`, `bg-emerald-500`, `bg-emerald-600`
- Heights vary significantly

---

### Tab/Toggle
**Pattern:** Border-bottom active state
- **Examples:**
  - ClassDetail tabs (`ClassDetail.jsx:414`, `425`, `436`)
  - Category filters (`Gradebook.jsx:509`)

**Consistency:** ✅ Generally consistent

---

### Icon-Only
**Pattern:** Square icon buttons with hover states
- **Examples:**
  - Refresh (`Dashboard.jsx:367`)
  - Delete (`Dashboard.jsx:411`)
  - Close modals (multiple)
  - Edit/Delete word (`ListEditor.jsx:491`, `512`)

**Inconsistencies:**
- Sizes: `h-8 w-8`, `h-10 w-10`, `h-12 w-12`
- Border radius: `rounded-lg`, `rounded-full`
- Some use `IconButton` component, others inline

---

### Navigation
**Pattern:** NavButton component or Link elements
- **Examples:**
  - HeaderBar navigation (`HeaderBar.jsx:78`, `134`, `144`)
  - Dashboard links (`Dashboard.jsx:425`, `451`, `458`)

**Consistency:** ✅ NavButton component is consistent

---

### Inline/Link (Text-Style Actions)
**Pattern:** Text links or minimal button styling
- **Examples:**
  - View Details (`Gradebook.jsx:826`)
  - Challenge (`Gradebook.jsx:1122`)

**Inconsistencies:**
- Some are `<button>`, others could be `<Link>`
- Styling varies significantly

---

## Section 4: Inconsistencies Found

### Height Variations
- **Primary CTAs:** `h-12` (most common), `h-14` (student Study Now)
- **Secondary:** `h-10`, `h-12`
- **Icon buttons:** `h-8 w-8`, `h-10 w-10`, `h-12 w-12`
- **Recommendation:** Standardize to `h-12` for primary/secondary, `h-10` for icon buttons

---

### Border Radius Variations
- **Most buttons:** `rounded-xl` (12px)
- **Some buttons:** `rounded-lg` (8px) - especially in modals
- **Icon buttons:** `rounded-lg` (IconButton component)
- **Special cases:** `rounded-2xl` (StudySession buttons), `rounded-full` (close buttons)
- **Recommendation:** Use `rounded-xl` for standard buttons, `rounded-lg` for icon buttons, `rounded-full` for close buttons

---

### Border Color Variations
- **Outlined buttons:** `border-slate-200`, `border-slate-300`, `border-brand-primary`
- **Recommendation:** Standardize to `border-slate-200` for ghost/outline, `border-brand-primary` for secondary CTAs

---

### Padding Variations
- **Primary:** `px-4 py-2`, `px-5 py-2`, `px-6 py-2`, `px-4 py-3`
- **Icon buttons:** Square (w-8 h-8, w-10 h-10, w-12 w-12)
- **Recommendation:** Standardize to `px-4 py-2` for standard buttons, `px-5` for larger CTAs

---

### Font Weight Variations
- **Primary CTAs:** `font-bold`, `font-semibold`
- **Secondary:** `font-semibold`, `font-bold`
- **Recommendation:** Use `font-bold` for primary CTAs, `font-semibold` for secondary

---

### Color Variations for Same Purpose
- **Danger:** `bg-red-500`, `bg-red-600`, `hover:text-red-600`
- **Success:** `bg-green-600`, `bg-emerald-500`, `bg-emerald-600`
- **Primary Blue:** `bg-blue-600`, `bg-brand-primary`
- **Recommendation:** Standardize danger to `bg-red-600`, success to `bg-emerald-600`, primary to `bg-brand-primary`

---

### Component vs Inline Usage
- **Many buttons** that could use `Button` component are inline
- **Icon buttons** inconsistently use `IconButton` component
- **Examples:**
  - `Dashboard.jsx` has 17+ inline buttons that could use `Button`
  - `ClassDetail.jsx` has 15+ inline buttons
  - `Gradebook.jsx` has 20+ inline buttons

---

## Section 5: Recommendations

### 1. Buttons That Should Use `Button` Component

**High Priority:**
- All primary CTAs in `Dashboard.jsx` (Create Class, Create List, Study Now, Take Test)
- All form submit buttons (`Login.jsx`, `Signup.jsx`, `ListEditor.jsx`)
- All modal action buttons (`AssignListModal.jsx`, `CreateClassModal.jsx`, `ImportWordsModal.jsx`)
- Challenge action buttons in `Gradebook.jsx` (Accept/Reject)

**Medium Priority:**
- Secondary actions (Cancel, Go Back, View Details)
- Tab buttons in `ClassDetail.jsx` (could use custom variant)

**Low Priority:**
- Icon-only buttons (already have `IconButton` component)
- Special purpose buttons (StudySession flashcard buttons)

---

### 2. Missing Variants That Should Be Added to `Button`

**Suggested Additions:**
- `success` variant - `bg-emerald-600 text-white hover:bg-emerald-700` (for Accept, Add Word)
- `warning` variant - `bg-amber-500 text-slate-900 hover:bg-amber-600` (for Hard button)
- `tab` variant - For tab buttons with border-bottom active state
- `link` variant - Text-style button for View Details, Challenge links

---

### 3. Proposed Standardization Rules

**Rule 1: Height Standards**
- Primary CTAs: `h-12` (48px)
- Secondary CTAs: `h-12` (48px)
- Icon buttons: `h-10 w-10` (40px)
- Small actions: `h-10` (40px)

**Rule 2: Border Radius Standards**
- Standard buttons: `rounded-xl` (12px)
- Icon buttons: `rounded-lg` (8px)
- Close buttons: `rounded-full` (circular)
- Special cases: `rounded-2xl` (16px) for hero buttons

**Rule 3: Color Standards**
- Primary CTA: `bg-brand-accent` (orange) or `bg-brand-primary` (blue)
- Secondary CTA: `border-brand-primary` with `bg-white` or `bg-blue-50`
- Danger: `bg-red-600` or `hover:text-red-600 hover:bg-red-50`
- Success: `bg-emerald-600`
- Warning: `bg-amber-500`

**Rule 4: Font Weight Standards**
- Primary CTAs: `font-bold`
- Secondary CTAs: `font-semibold`
- Text links: `font-semibold`

**Rule 5: Padding Standards**
- Standard buttons: `px-4 py-2` (16px horizontal, 8px vertical)
- Large CTAs: `px-5 py-2` or `px-6 py-2`
- Icon buttons: Square dimensions matching height

**Rule 6: Component Usage**
- Use `Button` component for all standard buttons
- Use `IconButton` component for all icon-only buttons
- Use `NavButton` component for navigation buttons
- Reserve inline styling only for special cases (StudySession flashcard buttons, dynamic color buttons)

**Rule 7: Border Standards**
- Ghost/Outline: `border-slate-200`
- Secondary CTA: `border-brand-primary`
- Disabled: `border-slate-300` with reduced opacity

---

### 4. Migration Priority

**Phase 1 (High Impact, Low Effort):**
1. Replace all primary CTA buttons with `Button variant="primary"` or `variant="primary-blue"`
2. Replace all form submit buttons with `Button`
3. Replace all modal action buttons with `Button`

**Phase 2 (Medium Impact, Medium Effort):**
1. Replace secondary action buttons with `Button variant="secondary"` or `variant="outline"`
2. Replace icon buttons with `IconButton` component
3. Add missing variants (`success`, `warning`, `link`)

**Phase 3 (Low Impact, High Effort):**
1. Standardize all inline button styles
2. Create custom variants for special cases (tabs, flashcard buttons)
3. Audit and update all hover/active states

---

## Summary

**Total Buttons Found:** ~150+ button-like elements across the codebase

**Component Usage:**
- `Button` component: ~5 instances
- `IconButton` component: ~3 instances
- `NavButton` component: ~3 instances
- Inline buttons: ~140+ instances

**Key Findings:**
1. **Low component adoption** - Only ~7% of buttons use UI components
2. **High inconsistency** - Significant variation in heights, colors, padding, border radius
3. **Missing variants** - Need `success`, `warning`, `link`, `tab` variants
4. **Opportunity for standardization** - Most buttons can be migrated to `Button` component

**Estimated Migration Effort:**
- Phase 1: ~40 buttons, 4-6 hours
- Phase 2: ~60 buttons, 8-10 hours
- Phase 3: ~50 buttons, 6-8 hours
- **Total: ~18-24 hours** for complete standardization

