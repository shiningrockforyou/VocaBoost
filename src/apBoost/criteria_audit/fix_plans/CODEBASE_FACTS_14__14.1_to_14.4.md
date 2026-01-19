# CODEBASE_FACTS__14__14.1_to_14.4.md

**Generated:** 2026-01-14
**Chunk ID:** 14__14.1_to_14.4
**Scope:** UI component imports, modal refactoring, service imports normalization, design token consistency, ThemeContext usage

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### UI Components Index
- **File:** `src/components/ui/index.js:1-10`
- **Exports:**
  - **Buttons:** `Button`, `IconButton`, `NavButton`, `TabButton`, `LinkButton`, `CardButton`, `TagButton`
  - **Other:** `Badge`, `Card`, `Input`, `Textarea`, `Select`, `Modal`

```javascript
// src/components/ui/index.js:1-10
// Buttons
export { Button, IconButton, NavButton, TabButton, LinkButton, CardButton, TagButton } from './buttons'

// Other UI components
export { default as Badge } from './Badge'
export { default as Card } from './Card.jsx'
export { default as Input } from './Input'
export { default as Textarea } from './Textarea'
export { default as Select } from './Select'
export { default as Modal } from './Modal'
```

### Button Variants Index
- **File:** `src/components/ui/buttons/index.js:1-7`
```javascript
export { default as Button } from './Button.jsx'
export { default as IconButton } from './IconButton.jsx'
export { default as NavButton } from './NavButton.jsx'
export { default as TabButton } from './TabButton.jsx'
export { default as LinkButton } from './LinkButton.jsx'
export { default as CardButton } from './CardButton.jsx'
export { default as TagButton } from './TagButton.jsx'
```

### Canonical Button Component
- **File:** `src/components/ui/buttons/Button.jsx:1-148`
- **Props:** `variant`, `size`, `to`, `href`, `disabled`, `className`, `children`, `...props`
- **Supported Variants (lines 23-72):**
  - `primary` - Orange CTA (bg-brand-accent)
  - `primary-blue` - Blue CTA (bg-brand-primary)
  - `secondary` - Outlined blue
  - `outline` - Gray outlined
  - `ghost` - Minimal styling
  - `danger` - Red destructive (bg-btn-danger)
  - `success` - Green positive (bg-btn-success)
  - `warning` - Yellow warning (bg-btn-warning)
- **Supported Sizes (lines 74-79):**
  - `sm` - h-8 px-3 text-xs
  - `md` - h-10 px-4 text-sm
  - `lg` - h-12 px-4 text-sm (default)
  - `xl` - h-14 px-6 text-base
- **Renders as:** `<Link>` if `to` prop, `<a>` if `href` prop, `<button>` otherwise

**Evidence excerpt (lines 23-35):**
```javascript
const variants = {
  primary: `
    bg-brand-accent text-white font-bold
    shadow-lg shadow-brand-accent/30
    hover:bg-brand-accent-hover hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-accent/40
    active:translate-y-0 active:scale-95 active:shadow-md
  `,
  'primary-blue': `
    bg-brand-primary text-white font-bold
    shadow-lg shadow-brand-primary/20
    hover:bg-brand-primary/90 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-primary/30
    active:translate-y-0 active:scale-95 active:shadow-md
  `,
```

### Canonical Modal Component
- **File:** `src/components/ui/Modal.jsx:1-64`
- **Props:** `isOpen`, `onClose`, `title`, `size`, `children`, `showCloseButton`
- **Supported Sizes (lines 5-11):** `sm`, `md` (default), `lg`, `xl`, `2xl`
- **Features:**
  - ✅ ESC-to-close (lines 22-30)
  - ✅ Backdrop click to close (line 37)
  - ❌ No explicit focus trapping
  - ❌ No portal (renders in place)
  - ❌ No scroll locking

**Evidence excerpt (lines 13-37):**
```javascript
const Modal = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  showCloseButton = true,
}) => {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop - click to close */}
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
```

### Canonical db.js Exports
- **File:** `src/services/db.js`
- **Imports from:** `'../firebase'` for `db` and `auth` (line 23)
- **Key exports:**
  - `logSystemEvent` (line 88)
  - `withRetry` (line 109)
  - Various domain-specific functions (user profiles, word lists, etc.)

**Evidence - logSystemEvent (lines 88-100):**
```javascript
export async function logSystemEvent(eventType, data, severity = 'warning') {
  try {
    await addDoc(collection(db, 'system_logs'), {
      type: eventType,
      severity,
      ...data,
      timestamp: serverTimestamp()
    })
  } catch (err) {
    // Don't let logging failure break the app
    console.error('Failed to write system log:', err)
  }
}
```

**Evidence - withRetry (lines 109-168):**
```javascript
export async function withRetry(fn, options = {}, loggingContext = {}) {
  const { maxRetries = 3, totalTimeoutMs = 15000 } = options
  const startTime = Date.now()
  const errorCodes = []
  let lastError

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check total timeout
    if (Date.now() - startTime > totalTimeoutMs) {
      break
    }
    try {
      const result = await fn()
      // Log if retries were needed (anomaly)
      if (attempt > 0) {
        logSystemEvent('attempt_retry_succeeded', {...})
      }
      return result
    } catch (error) {
      // ... retry logic with exponential backoff
    }
  }
  // All retries failed - log and throw
  logSystemEvent('attempt_write_failed', {...}, 'error')
  throw new Error(`Operation failed after ${maxRetries} retries: ${lastError?.message}`)
}
```

### ThemeContext Source
- **File:** `src/contexts/ThemeContext.jsx:1-166`
- **Exports:** `ThemeProvider` (line 59), `useTheme` (line 159)
- **Context values:** `theme`, `setTheme`, `isDark`, `toggleTheme`, `roundness`, `borderWeight`, etc.

---

## 2) Write Paths

**Found: Yes**

### apBoost Service Files - Import Patterns

| Service File | Import Source | Line |
|-------------|---------------|------|
| `apAnalyticsService.js` | `../../firebase` | 5 |
| `apGradingService.js` | `../../firebase` | 5 |
| `apQuestionService.js` | `../../firebase` | 5 |
| `apScoringService.js` | `../../firebase` | 11 |
| `apSessionService.js` | `../../firebase` | 13 |
| `apStorageService.js` | `../../firebase` (storage only) | 5 |
| `apTeacherService.js` | `../../firebase` | 5 |
| `apTestService.js` | `../../firebase` | 10 |

### Firestore Operations by Service

#### apSessionService.js
- **Write ops:** `setDoc`, `updateDoc`
- **Evidence (lines 69, 6-7):**
```javascript
import { setDoc, updateDoc, ... } from 'firebase/firestore'
// ...
await setDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), sessionData)
```

#### apTeacherService.js
- **Write ops:** `addDoc`, `updateDoc`, `deleteDoc`
- **Evidence (lines 11-15):**
```javascript
import { addDoc, updateDoc, deleteDoc, ... } from 'firebase/firestore'
```

#### apQuestionService.js
- **Write ops:** `addDoc`, `updateDoc`, `deleteDoc`
- **Evidence (lines 11-13):**
```javascript
import { addDoc, updateDoc, deleteDoc, ... } from 'firebase/firestore'
```

#### apGradingService.js
- **Write ops:** `updateDoc`
- **Evidence (line 11):**
```javascript
import { updateDoc, ... } from 'firebase/firestore'
```

#### apScoringService.js
- **Write ops:** `setDoc`
- **Evidence (lines 4-5):**
```javascript
import { setDoc, ... } from 'firebase/firestore'
```

#### apAnalyticsService.js
- **Write ops:** None (read-only service)
- **Evidence:** No write operations imported (lines 6-13)

#### apTestService.js
- **Write ops:** None (read-only service)
- **Evidence:** Only `getDoc`, `getDocs`, `query`, `where`, `orderBy` imported (lines 1-9)

#### apStorageService.js
- **Special case:** Uses Firebase Storage only, NOT Firestore
- **Imports `storage` from firebase (line 5)**
- **Evidence:**
```javascript
import { storage } from '../../firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
```

---

## 3) Offline/Resilience Mechanics

**Found: Yes (but NOT used in apBoost)**

### withRetry Function
- **Location:** `src/services/db.js:109-168`
- **Used by:** `src/services/progressService.js` (NOT apBoost)
- **NOT imported by any apBoost service**

**Evidence - existing usage in progressService.js (line 15):**
```javascript
import { getRecentAttemptsForClassList, logSystemEvent } from './db';
```

**Evidence - NOT used in apBoost:**
Grep search for `withRetry` in `src/apBoost/services/` returned NO matches.

### logSystemEvent Function
- **Location:** `src/services/db.js:88-100`
- **Used by:** `progressService.js`, `studyService.js` (NOT apBoost)
- **NOT imported by any apBoost service**

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Modal Entry Points

| Modal Component | Rendered In | Line |
|----------------|-------------|------|
| `DuplicateTabModal` | `APTestSession.jsx` | 363, 396 |
| `QuestionDetailModal` | `APExamAnalytics.jsx` | 383 |
| `AssignTestModal` | `APAssignTest.jsx` | 95 |

**Evidence - DuplicateTabModal rendering (APTestSession.jsx:7, 363):**
```javascript
import DuplicateTabModal from '../components/DuplicateTabModal'
// ...
<DuplicateTabModal
  onTakeControl={handleTakeControl}
  onGoToDashboard={() => navigate('/ap')}
/>
```

**Evidence - QuestionDetailModal rendering (APExamAnalytics.jsx:8, 383):**
```javascript
import QuestionDetailModal from '../components/analytics/QuestionDetailModal'
// ...
<QuestionDetailModal
  question={selectedQuestion}
  questionNumber={selectedQuestionNumber}
  distribution={selectedDistribution}
  totalResponses={totalStudents}
  onClose={() => setSelectedQuestion(null)}
/>
```

**Evidence - AssignTestModal rendering (APAssignTest.jsx:5, 95):**
```javascript
import AssignTestModal from '../components/teacher/AssignTestModal'
// ...
<AssignTestModal
  test={test}
  teacherId={user.uid}
  onClose={() => navigate(-1)}
  onSuccess={() => navigate('/ap/teacher')}
/>
```

### High-Button-Count Components

| Component | Button Count | File |
|-----------|-------------|------|
| `GradingPanel.jsx` | ~15+ inline buttons | `src/apBoost/components/grading/GradingPanel.jsx` |
| `QuestionNavigator.jsx` | ~6 inline buttons | `src/apBoost/components/QuestionNavigator.jsx` |
| `AssignTestModal.jsx` | 4 buttons | `src/apBoost/components/teacher/AssignTestModal.jsx` |

**Evidence - GradingPanel inline buttons (lines 54-100):**
```javascript
<button
  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
  disabled={currentIndex === 0}
  className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover disabled:opacity-50"
>
  Prev
</button>
```

### performanceColors.js Usage

| File | Import | Usage |
|------|--------|-------|
| `StudentResultsTable.jsx:3` | `getAPScoreColor, getAPScoreTextColor` | AP score badge colors |
| `PerformanceGrid.jsx:2` | `PERFORMANCE_THRESHOLDS` | Legend display |
| `FRQCard.jsx:1` | `getPerformanceColor, getPerformanceInfo` | Progress bar colors |
| `MCQDetailedView.jsx:1` | `getPerformanceColor` | Question status colors |
| `MCQSquare.jsx:1` | `getPerformanceColor` | Grid square colors |

**Evidence - MCQSquare.jsx (lines 1, 12):**
```javascript
import { getPerformanceColor } from '../../utils/performanceColors'
// ...
const colorClass = getPerformanceColor(percentage)
```

---

## 5) Must-Answer Questions

### Q1: Does `src/components/ui/index.js` exist and what does it export?

**Answer: Yes**

**File:** `src/components/ui/index.js:1-10`

**Exports:**
- **Buttons (re-exported from `./buttons`):** `Button`, `IconButton`, `NavButton`, `TabButton`, `LinkButton`, `CardButton`, `TagButton`
- **Direct exports:** `Badge`, `Card`, `Input`, `Textarea`, `Select`, `Modal`

---

### Q2: Where is the canonical Button component and what props does it accept?

**Answer: Found**

**File:** `src/components/ui/buttons/Button.jsx:1-148`

**Props (lines 81-90):**
- `variant` (default: `'primary'`)
- `size` (default: `'lg'`)
- `to` (renders as `<Link>`)
- `href` (renders as `<a>`)
- `disabled` (default: `false`)
- `className` (default: `''`)
- `children`
- `...props` (spread to underlying element)

**Variants (lines 23-72):** `primary`, `primary-blue`, `secondary`, `outline`, `ghost`, `danger`, `success`, `warning`

**Sizes (lines 74-79):** `sm`, `md`, `lg`, `xl`

---

### Q3: Where is the canonical Modal component and what is its API?

**Answer: Found**

**File:** `src/components/ui/Modal.jsx:1-64`

**Props (lines 13-20):**
- `isOpen` - boolean, controls visibility
- `onClose` - callback for close action
- `title` - optional modal title
- `size` - `'sm'` | `'md'` (default) | `'lg'` | `'xl'` | `'2xl'`
- `children` - modal content
- `showCloseButton` - boolean (default: `true`)

**Feature Support:**
- ✅ ESC-to-close (lines 22-30)
- ✅ Backdrop click (line 37)
- ❌ Focus trapping - NOT FOUND
- ❌ Portals - NOT FOUND (renders in place)
- ❌ Scroll locking - NOT FOUND

**Evidence (lines 37, 22-24):**
```javascript
<div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
// ...
const handleKeyDown = (e) => {
  if (e.key === 'Escape') onClose()
}
```

---

### Q4: For each targeted modal file, what is the current structure?

#### DuplicateTabModal.jsx
**File:** `src/apBoost/components/DuplicateTabModal.jsx:1-52`

**Structure:**
- Custom backdrop: `<div className="absolute inset-0 bg-black/50" />` (line 9)
- Container: `<div className="relative bg-surface rounded-[--radius-card]...">` (line 12)
- **Buttons (lines 36-48):**
  1. "Go to Dashboard" - outline style with inline classes
  2. "Use This Tab" - primary style with inline classes

**Evidence (lines 36-47):**
```jsx
<button
  onClick={onGoToDashboard}
  className="px-6 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover transition-colors"
>
  Go to Dashboard
</button>
<button
  onClick={onTakeControl}
  className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
>
  Use This Tab
</button>
```

#### QuestionDetailModal.jsx
**File:** `src/apBoost/components/analytics/QuestionDetailModal.jsx:1-166`

**Structure:**
- Custom backdrop with onClick: `<div className="absolute inset-0 bg-black/50" onClick={onClose} />` (lines 62-65)
- Container: `<div className="relative bg-surface rounded-[--radius-card]...">` (line 68)
- ESC key handler implemented (lines 43-52)
- **Buttons (lines 74-79):** 1 close button (× character) with inline classes
- **Raw Tailwind colors in ResponseBar (lines 6-30):** `bg-green-50`, `bg-red-50`, `text-green-700`, `text-red-700`, `bg-green-500`, `bg-red-400`, `bg-white`

**Evidence (lines 8, 11, 22-24):**
```jsx
<div className={`p-3 rounded-[--radius-input] ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
// ...
<span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
// ...
<div className="h-4 bg-white rounded-full overflow-hidden">
  <div className={`h-full transition-all ${isCorrect ? 'bg-green-500' : 'bg-red-400'}`}
```

#### AssignTestModal.jsx
**File:** `src/apBoost/components/teacher/AssignTestModal.jsx:1-268`

**Structure:**
- Custom backdrop with onClick: `<div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />` (lines 140-143)
- Container: `<div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface...">` (line 146)
- NO ESC handler
- **Buttons (lines 152-262):**
  1. Close button (X) - inline text button (lines 152-157)
  2. Cancel button - ghost style (lines 251-255)
  3. Assign button - primary style (lines 257-262)

**Evidence (lines 251-262):**
```jsx
<button
  onClick={onClose}
  className="px-4 py-2 text-text-secondary hover:text-text-primary"
>
  Cancel
</button>
<button
  onClick={handleAssign}
  disabled={saving || selectedClassIds.size === 0}
  className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
>
  {saving ? 'Assigning...' : `Assign to ${totalStudents} students`}
</button>
```

---

### Q5: In QuestionNavigator.jsx, is there any modal-like structure?

**Answer: Yes**

**File:** `src/apBoost/components/QuestionNavigator.jsx:1-248`

**Modal structure (lines 141-233):**
- Slide-up modal triggered by `isModalOpen` state (line 79)
- Custom backdrop: `<div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />` (lines 144-147)
- Container: `<div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg]...">` (line 150)
- NO ESC handler
- **Buttons:**
  - Close button (✕) - inline text (lines 156-160)
  - Back/Next buttons - inline classes (lines 101-137)
  - "Go to Review Screen" button - primary style (lines 223-230)

**Evidence (lines 141-150):**
```jsx
{isModalOpen && (
  <div className="fixed inset-0 z-50">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/50"
      onClick={() => setIsModalOpen(false)}
    />
    {/* Modal */}
    <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up max-h-[70vh] overflow-auto">
```

---

### Q6: Confirm whether apBoost already imports from components/ui

**Answer: NO - NOT FOUND**

**Search performed:** Grep for `from.*components/ui` in `src/apBoost`

**Result:** No apBoost source files (`.jsx`/`.js`) import from `components/ui`. All matches are in audit/documentation markdown files only.

**Evidence:** All button styling and modal structure in apBoost uses inline Tailwind classes rather than shared UI components.

---

### Q7: Does `src/services/db.js` export `db`, `auth`, `withRetry`, and `logSystemEvent`?

**Answer: Partial**

**File:** `src/services/db.js`

| Export | Status | Line |
|--------|--------|------|
| `db` | **NOT directly exported** - imported from `../firebase` (line 23) | N/A |
| `auth` | **NOT directly exported** - imported from `../firebase` (line 23) | N/A |
| `withRetry` | ✅ Exported | 109 |
| `logSystemEvent` | ✅ Exported | 88 |

**Evidence (line 23):**
```javascript
import { db, auth } from '../firebase'
```

**Note:** `db` and `auth` are NOT re-exported from `db.js`. They must be imported directly from `src/firebase.js`.

**firebase.js exports (lines 41-44):**
```javascript
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
```

---

### Q8: For the 8 apBoost service files, what do they import and what Firestore ops do they use?

| Service | Import Source | Firestore Ops |
|---------|---------------|---------------|
| `apAnalyticsService.js` | `../../firebase` | `getDoc`, `getDocs`, `query`, `where` |
| `apGradingService.js` | `../../firebase` | `getDoc`, `getDocs`, `updateDoc`, `query`, `where`, `orderBy` |
| `apQuestionService.js` | `../../firebase` | `getDoc`, `getDocs`, `addDoc`, `updateDoc`, `deleteDoc`, `query`, `where`, `orderBy`, `limit` |
| `apScoringService.js` | `../../firebase` | `getDoc`, `setDoc`, `getDocs`, `query`, `where` |
| `apSessionService.js` | `../../firebase` | `getDoc`, `getDocs`, `setDoc`, `updateDoc`, `query`, `where` |
| `apStorageService.js` | `../../firebase` | **Storage only** (no Firestore) |
| `apTeacherService.js` | `../../firebase` | `getDoc`, `getDocs`, `addDoc`, `updateDoc`, `deleteDoc`, `query`, `where`, `orderBy` |
| `apTestService.js` | `../../firebase` | `getDoc`, `getDocs`, `query`, `where`, `orderBy` |

**Evidence - all services import from `../../firebase`:**
```
apAnalyticsService.js:5:import { db } from '../../firebase'
apScoringService.js:11:import { db } from '../../firebase'
apGradingService.js:5:import { db } from '../../firebase'
apTestService.js:10:import { db } from '../../firebase'
apSessionService.js:13:import { db } from '../../firebase'
apTeacherService.js:5:import { db } from '../../firebase'
apStorageService.js:5:import { storage } from '../../firebase'
apQuestionService.js:5:import { db } from '../../firebase'
```

---

### Q9: In apStorageService.js, does it use `db` at all, or only `storage`?

**Answer: Storage only**

**File:** `src/apBoost/services/apStorageService.js:1-283`

**Imports (lines 5-12):**
```javascript
import { storage } from '../../firebase'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage'
```

**Confirmation:** No Firestore imports (`db`, `collection`, `doc`, etc.) are present. The service exclusively uses Firebase Storage for file operations.

**Conclusion:** The plan's decision to "keep firebase import for storage" is correct and grounded.

---

### Q10: Where is performanceColors.js used?

**Answer: Found in 5 files**

| File | Import | Usage Pattern |
|------|--------|---------------|
| `StudentResultsTable.jsx:3` | `getAPScoreColor`, `getAPScoreTextColor` | `className={bgColor}` (line 26) |
| `PerformanceGrid.jsx:2` | `PERFORMANCE_THRESHOLDS` | Legend mapping |
| `FRQCard.jsx:1` | `getPerformanceColor`, `getPerformanceInfo` | `colorClass = getPerformanceColor(percentage)` (line 7) |
| `MCQDetailedView.jsx:1` | `getPerformanceColor` | `colorClass = getPerformanceColor(percentage)` (line 40) |
| `MCQSquare.jsx:1` | `getPerformanceColor` | `colorClass = getPerformanceColor(percentage)` (line 12) |

**Evidence - MCQSquare.jsx (lines 1, 12):**
```javascript
import { getPerformanceColor } from '../../utils/performanceColors'
// ...
const colorClass = getPerformanceColor(percentage)
```

**Evidence - StudentResultsTable.jsx (lines 3, 26):**
```javascript
import { getAPScoreColor, getAPScoreTextColor } from '../../utils/performanceColors'
// ...
const bgColor = getAPScoreColor(score)
```

---

### Q11: Where in index.css are design tokens defined?

**Answer: Found**

**File:** `src/index.css`

**Structure:**
| Block | Lines | Content |
|-------|-------|---------|
| `:root` | 7-128 | CSS custom properties (raw RGB values) |
| `.dark` | 131-? | Dark theme overrides |
| `@theme` | 306-433 | Tailwind theme configuration (semantic tokens) |

**Key token sections in `:root` (lines 7-128):**
- Background colors (lines 10-14): `--color-bg-base`, `--color-bg-surface`, `--color-bg-muted`, `--color-bg-inset`
- Border colors (lines 16-19): `--border-default-rgb`, `--border-strong-rgb`, `--border-muted-rgb`
- Text colors (lines 21-26): `--text-primary-rgb`, `--text-secondary-rgb`, `--text-muted-rgb`, `--text-faint-rgb`
- Semantic states (lines 40-76): SUCCESS, ERROR, WARNING, INFO
- Button colors (lines 86-93): `--btn-danger-rgb`, `--btn-success-rgb`, `--btn-warning-rgb`
- Radius tokens (lines 104-119)
- Shadow tokens (lines 121-127)

**Key token sections in `@theme` (lines 306-433):**
- Semantic color tokens (lines 325-433)
- Radius tokens (lines 357-365)
- Shadow tokens (lines 372-377)

**Where to add performance tokens:** New tokens should be added to both `:root` (raw RGB values) and `@theme` (semantic mappings), following the existing pattern.

**Evidence - @theme block start (lines 306-315):**
```css
@theme {
  --font-heading: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-body: 'Pretendard', system-ui, -apple-system, sans-serif;

  /* 1. BRAND COLORS */
  --color-brand-primary: #1B3A94;   /* Royal Navy */
  --color-brand-accent: #F97316;    /* Ember Orange */
  --color-brand-accent-hover: #EA580C;
  --color-brand-text: #1B3A94;
```

---

### Q12: Where is ThemeProvider applied and how is `.dark` class toggled?

**Answer: Found**

#### ThemeProvider Location
**File:** `src/App.jsx:5, 25, 160`
```javascript
import { ThemeProvider } from './contexts/ThemeContext.jsx'
// ...
<ThemeProvider>
  {/* entire app */}
</ThemeProvider>
```

#### Dark Class Toggle Mechanism
**File:** `src/contexts/ThemeContext.jsx:76-87`
```javascript
// Apply theme (light/dark)
useEffect(() => {
  const root = document.documentElement

  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  localStorage.setItem('vocaboost-theme', theme)
}, [theme])
```

#### apBoost useTheme Usage
**Answer: NOT FOUND**

**Evidence:** Grep search for `useTheme` in `src/apBoost` returned NO matches in source files.

apBoost components rely on CSS variables that respond to the `.dark` class toggle via `ThemeProvider` wrapping in `App.jsx`. They do NOT actively call `useTheme()`.

**Existing useTheme() usage outside apBoost:**
- `src/pages/Settings.jsx:4, 16` - for theme toggle UI
- `src/components/HeaderBar.jsx:5, 15` - for `isDark` check

---

## Summary

### Key Findings

1. **UI Components:** Shared Button and Modal exist in `src/components/ui/` with comprehensive APIs. apBoost does NOT currently import from this location.

2. **Modal Patterns:** All 3 targeted modals plus QuestionNavigator use custom backdrop/container patterns. QuestionDetailModal has ESC support; others do not.

3. **Service Imports:** All 8 apBoost services import `db` from `../../firebase` directly, NOT from `../../services/db.js`. This is consistent but differs from the plan's expectation.

4. **withRetry/logSystemEvent:** These utilities exist in `db.js` but are NOT used by any apBoost service.

5. **apStorageService:** Correctly uses only `storage` from firebase (no `db`).

6. **performanceColors:** Uses raw Tailwind colors (`bg-green-500`, `text-gray-900`, etc.) in 5 analytics components.

7. **ThemeContext:** apBoost benefits from ThemeProvider wrapping but does NOT actively use `useTheme()`.

8. **Design Token Location:** Tokens are defined in `:root` (lines 7-128) and `@theme` (lines 306-433) in `src/index.css`.
