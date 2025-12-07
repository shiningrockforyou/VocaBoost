# VocaBoost UI/Dashboard Design Specification

**Version:** 2.0  
**Last Updated:** Current  
**Purpose:** Complete design system and dashboard architecture for senior developer onboarding

---

## 1. Project Overview

**VocaBoost** is a vocabulary learning platform built with React 19.2, Tailwind CSS 4.0, and Firebase. The application features a sophisticated dashboard system with a "Command Deck" layout for students and a class management interface for teachers.

### Tech Stack
- **Frontend Framework:** React 19.2 with Vite
- **Styling:** Tailwind CSS 4.0 (using `@theme` syntax, no `tailwind.config.js`)
- **Backend:** Firebase (Firestore, Auth, Cloud Functions)
- **Fonts:** Plus Jakarta Sans (Google Fonts) + Pretendard (local files)
- **State Management:** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)

---

## 2. Design System: "Academic Glass" / "Navy & Ember"

### 2.1 Color Palette

**Brand Colors:**
- **Primary (Royal Navy):** `#1B3A94` - Used for primary actions, headers, focus cards
- **Accent (Ember Orange):** `#F97316` - Used for "Study" actions, highlights
- **Accent Hover:** `#EA580C` - Darker orange for hover states

**Backgrounds:**
- **App Background (Light):** `#F1F5F9` (Slate-100) - Slightly grey to make white cards pop
- **App Background (Dark):** `#020617` (Slate-950) - For dark mode

**Semantic Colors:**
- **Action Primary:** Maps to `brand-accent` (Orange)
- **Action Hover:** Maps to `brand-accent-hover`

### 2.2 Typography System

**Font Families:**
- **Headings:** `Plus Jakarta Sans` (Google Fonts) - Bold, modern, academic
- **Body:** `Pretendard` (Local font files) - Clean, readable Korean/English support

**Font Utilities:**
- `.font-heading` - Applies Plus Jakarta Sans
- `.font-body` - Applies Pretendard

**Typography Scale:**
- Hero Numbers: `text-6xl md:text-7xl` (Focus Card)
- Large Headings: `text-4xl md:text-5xl` (List titles)
- Section Headings: `text-3xl` (Welcome, Card titles)
- Card Headings: `text-xl` (Panel headers)
- Body: `text-base` (Default)
- Small: `text-sm`, `text-xs` (Labels, metadata)

### 2.3 Border Radius Hierarchy ("Step-Down Radius")

**Critical Design Rule:** Nested elements must use smaller radius than containers.

- **Containers/Cards:** `rounded-2xl` (16px) - All `.surface-card` elements
- **Inner Elements (Buttons/Inputs):** `rounded-xl` (12px) - All buttons, inputs, nested cards
- **Tiny Elements:** `rounded-md` (6px) - MasterySquares, small badges

**Why:** Prevents "pinched corner" effect where nested elements feel too round for their container.

### 2.4 Surface Cards

**Utility Class:** `.surface-card`

```css
.surface-card {
  background-color: rgb(255, 255, 255); /* Solid white, no transparency */
  border: 1px solid rgb(203, 213, 225); /* slate-300 */
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  border-radius: 1rem; /* rounded-2xl */
  transition: all 0.2s;
}
```

**Key Characteristics:**
- Solid white background (no glassmorphism/transparency)
- Sharp borders (`slate-300`) for contrast against grey background
- Subtle shadow for depth
- Consistent `rounded-2xl` radius

---

## 3. Dashboard Architecture

### 3.1 Role-Based Dashboards

**Important:** The application uses **separate dashboard implementations** for teachers and students, controlled by role-based conditional rendering in `src/pages/Dashboard.jsx`.

- **Teacher Dashboard:** Class and list management interface (lines 335-655)
- **Student Dashboard:** "Command Deck" layout with progress tracking (lines 839-1438)

**No shared card components** - each role uses inline JSX for their specific UI needs.

### 3.2 Student Dashboard: "Command Deck" Layout

The Student Dashboard uses a **12-column grid** with the following hierarchy:

```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo + Logout Button                            │
├─────────────────────────────────────────────────────────┤
│ Error Banner (if error)                                  │
├─────────────────────────────────────────────────────────┤
│ Panic Mode Warning (if retention < 60%)                 │
├─────────────────────────────────────────────────────────┤
│ Welcome Header + Gradebook Link                          │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────────────┬──────────────────────────────┐ │
│ │ Panel A: Focus Card  │ Right Column (Flex Column)   │ │
│ │ (lg:col-span-6)      │ ┌──────────┬──────────────┐   │ │
│ │                      │ │ Panel C  │ Panel B      │   │ │
│ │                      │ │ Launchpad│ Vitals       │   │ │
│ │                      │ │ (Smart)  │ (3 Cards)    │   │ │
│ │                      │ └──────────┴──────────────┘   │ │
│ │                      │ ┌──────────────────────────┐   │ │
│ │                      │ │ Panel D: Activity Bar     │   │ │
│ │                      │ │ (7-Day Bar Chart)         │   │ │
│ │                      │ └──────────────────────────┘   │ │
│ └──────────────────────┴──────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ My Classes Section (Col-span-12)                        │
│   - Join Class Form (if classes exist)                  │
│   - Class List with Nested Vocabulary Lists             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Panel A: Focus Card (Weekly Goals Tracker)

**Purpose:** Primary visual focus showing weekly goal progress

**Location:** `src/pages/Dashboard.jsx` (lines ~763-820)

**Visual Design:**
- **Background:** Solid Navy (`bg-brand-primary`)
- **Text:** White with opacity variations
- **Layout:** Vertically centered (`flex flex-col justify-center`)

**Content Structure:**
1. **Header Section:**
   - Title: "Weekly Goals" (`text-xl font-bold text-white`)
   - Divider: `border-b border-white/20 pb-4 mb-4`

2. **List Title:**
   - Size: `text-4xl md:text-5xl font-bold text-white`
   - Shows: `getPrimaryFocus.title` or "No Active List"

3. **Hero Numbers:**
   - Current Progress: `text-6xl md:text-7xl` (massive)
   - Separator: `/` (`text-3xl text-white/40`)
   - Weekly Goal: `text-3xl text-white/60`
   - Unit: "words" (`text-base text-white/60`)

4. **Progress Labels:**
   - Flex row: `justify-between text-sm text-white/70`
   - Left: "Progress"
   - Right: "{remaining} words remaining"

5. **Progress Bar:**
   - Height: `h-6` (24px - thick)
   - Track: `bg-black/20 rounded-full`
   - Fill: `bg-gradient-to-r from-brand-accent to-orange-400`
   - Internal Label: Shows percentage inside bar if > 10%

**Key Variables:**
- `primaryFocusWeeklyGoal`: Calculated as `getPrimaryFocus.pace * 7`
- `primaryFocusProgress`: From `getPrimaryFocus?.stats?.wordsLearned`
- `primaryFocusPercent`: `(progress / weeklyGoal) * 100`

### 3.3 Panel B: The Vitals

**Purpose:** Display key statistics (Words Mastered, Retention Rate, Current Streak)

**Location:** `src/pages/Dashboard.jsx` (lines ~820-910)

**Visual Design:**
- **Card:** `.surface-card` with `p-4` (compressed padding)
- **Layout:** Vertical stack (`space-y-4`)
- **Height:** `min-h-[280px]` with `h-full` to match right column

**Stat Structure (Each):**
- Icon Container: `w-14 h-14 rounded-lg bg-brand-primary/10` (or `bg-brand-accent/10` for streak)
- Icon: `w-7 h-7` SVG
- Label: `text-xs text-slate-500`
- Value: `text-2xl font-bold text-brand-primary` (or `text-brand-accent` for streak)

**Data Sources:**
- Words Mastered: `user?.stats?.totalWordsLearned ?? 0`
- Retention Rate: `user?.stats?.retention ?? null` (converted to percentage)
- Current Streak: `user?.stats?.streakDays ?? 0`

### 3.4 Panel C: The Launchpad (Smart CTA)

**Purpose:** Dynamic action buttons that adapt based on student progress status

**Location:** `src/pages/Dashboard.jsx` (lines ~951-1025)

**Visual Design:**
- **Card:** Gradient background that changes based on progress status
- **Layout:** `min-h-[280px] flex flex-col justify-center` with constrained button width
- **Dynamic Colors:**
  - **Behind:** `bg-gradient-to-br from-rose-500 to-orange-600` (red/orange)
  - **On Track:** `bg-gradient-to-br from-blue-500 to-brand-primary` (blue/navy)
  - **Ahead:** `bg-gradient-to-br from-emerald-500 to-teal-600` (green/teal)

**Smart Status Calculation:**
- Compares `primaryFocusProgress` vs `expectedProgress` (based on day of week)
- Delta threshold: `-5` (behind) / `+5` (ahead) / otherwise (on track)
- `expectedProgress = (primaryFocusWeeklyGoal / 7) * currentDayOfWeek`

**Content:**
- **Dynamic Header:** Changes based on status
  - Behind: "Let's catch up!" + word count behind
  - On Track: "Right on track!" + encouragement
  - Ahead: "Wow, you're flying!" + word count ahead
- **Button Container:** `max-w-[240px] mx-auto w-full space-y-3`

**Buttons:**
1. **Study Now** (Primary):
   - Background: White (`bg-white`)
   - Text color: Changes based on status (rose-600 / brand-primary / emerald-600)
   - `h-14 rounded-xl`
   - Opens `StudySelectionModal`

2. **Take Test** (Secondary):
   - Background: Transparent (`bg-transparent`)
   - Border: `border-2 border-white`
   - Text: White
   - `h-14 rounded-xl`
   - Opens `StudySelectionModal` with `mode='test'`

**Button Text Truncation:**
- All button text wrapped in `<span className="truncate whitespace-nowrap max-w-full">`
- Icons use `flex-shrink-0` to prevent shrinking

### 3.5 Panel D: The Activity Bar (7-Day Rhythm)

**Purpose:** Visual bar chart showing word activity for the last 7 days

**Location:** `src/pages/Dashboard.jsx` (lines ~1112-1171)

**Visual Design:**
- **Card:** `.surface-card` with `h-28` (fixed height, 112px)
- **Layout:** Horizontal flex (`flex flex-row items-center justify-between gap-6 px-6`)
- **Border Radius:** `rounded-3xl` (larger than standard cards)

**Content Structure:**
- **Left Side:** Label with icon
  - Icon: `<Activity size={24} className="text-brand-primary" />`
  - Text: "7-DAY RHYTHM" (`text-sm font-bold uppercase tracking-wider text-slate-500`)
  - Container: `flex items-center gap-2 whitespace-nowrap shrink-0`

- **Right Side:** Bar chart
  - Container: `flex-1 flex items-end justify-between gap-2 h-16 relative`
  - 7 bars representing yesterday through 7 days ago (left to right)

**Bar Calculation:**
- Data source: `dailyActivity` array (calculated from `userAttempts`)
- Each bar shows: `wordCount / dailyPace` as percentage
- Height: `Math.max(10, heightPercent)%` for non-zero, `4px` minimum for zero
- Colors: `bg-[#1B3A94]` (active) / `bg-slate-200` (no activity)
- Hover tooltip: Shows date, word count, and daily pace

**Data Structure:**
```javascript
dailyActivity = [
  {
    date: Date,
    formattedDate: "Mon, Oct 24",
    wordCount: number,
    dailyPace: number
  },
  // ... 7 days total
]
```

### 3.6 My Classes Section

**Purpose:** List of enrolled classes with assigned vocabulary lists

**Location:** `src/pages/Dashboard.jsx` (lines ~1175-1420)

**Visual Design:**
- **Container:** `.surface-card p-6`
- **Layout:** Vertical list with nested structure

**Empty State:**
- Shows when `studentClasses.length === 0`
- Large centered form with class code input
- Input: `text-2xl font-bold tracking-[0.4em]` (uppercase, wide letter spacing)
- Join button: `bg-brand-primary`

**Class List Structure:**
- **Class Card:** `.surface-card p-5` (one per class)
- **Class Header:**
  - Class name: `text-lg font-bold`
  - Join date: `text-sm text-slate-500`
  - Assigned lists count: `text-sm font-medium text-brand-primary`

- **Nested List Items:** Each assigned vocabulary list within a class
  - **List Card:** `rounded-xl border border-slate-300 bg-white px-4 py-3`
  - **List Header:**
    - Title: `text-sm font-semibold`
    - Due badge: `bg-amber-100 text-amber-800` (if `list.stats.due > 0`)
    - Metadata: `text-xs text-slate-500` (word count, assignment info)
  
  - **Progress Bar:**
    - Container: `h-12 rounded-xl bg-slate-200 flex items-center overflow-hidden`
    - Fill: `bg-brand-primary rounded-xl transition-all duration-1000 ease-out`
    - Width: Calculated from `(wordsLearned / totalWords) * 100`
    - Internal label: Shows percentage if bar width > 15%
    - External label: Shows percentage if bar width <= 15%
    - Labels: `{wordsLearned} learned` / `{totalWords} total`

  - **Action Buttons:**
    - **Study Now:** `h-12 rounded-xl bg-brand-accent text-white` (Orange)
    - **Take Test:** `h-12 rounded-xl bg-brand-primary text-white` (Navy, only if wordCount > 10)
    - **Download PDF:** `h-12 rounded-xl border border-brand-primary bg-white text-brand-primary` (Outline)

**Join Class Form (when classes exist):**
- Compact form at top of section
- Input: `text-xl font-bold tracking-[0.4em]`
- Join button: `bg-brand-primary`

**Key Pattern:** All buttons use `h-12` and `rounded-xl` for consistency.

### 3.7 Teacher Dashboard

**Purpose:** Class and vocabulary list management interface

**Location:** `src/pages/Dashboard.jsx` (lines 335-655)

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo + Logout Button                            │
├─────────────────────────────────────────────────────────┤
│ Error Banner (if error)                                  │
├─────────────────────────────────────────────────────────┤
│ Welcome Header + Create Class Button                     │
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ My Classes Section (Col-span-12)                    │ │
│ │   - Grid of class cards (md:grid-cols-2)            │ │
│ │   - Each card: name, join code, delete button       │ │
│ └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ My Vocabulary Lists Section (Col-span-12)            │ │
│ │   - Grid of list cards (md:grid-cols-2)             │ │
│ │   - Each card: title, description, word count       │ │
│ │   - Edit link + PDF download + Delete button       │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Class Cards:**
- **Card:** `rounded-2xl border border-slate-300 bg-white p-5`
- **Content:**
  - Class name: `text-lg font-bold`
  - Join code: `font-semibold tracking-wide`
  - Student count: Placeholder (not implemented)
  - Delete button: `border-red-200 bg-white text-red-600`
  - Link: `text-brand-primary` → `/classes/{classId}`

**List Cards:**
- **Card:** `rounded-2xl border border-slate-300 bg-white p-5`
- **Content:**
  - Title: `text-lg font-bold`
  - Description: `text-sm text-slate-500 line-clamp-2`
  - Word count badge: `bg-slate-200 text-slate-700`
  - Delete button: Small red outline button
  - Actions: Edit link + PDF download button
  - Link: `text-brand-primary` → `/lists/{listId}`

**Components Used:**
- `CreateClassModal` - Modal for creating new classes
- `LoadingSpinner` - Loading states

---

## 4. Component Library

### 4.1 MasterySquares Component

**Location:** `src/components/MasterySquares.jsx`

**Status:** ⚠️ **Imported but currently unused** in Dashboard.jsx

**Purpose:** Visual activity/progress indicator (available for future use)

**Modes:**
1. **Streak Mode:** Pass `streak` prop (number)
   - Colors last N days green, others grey
   - Grid: `grid grid-cols-7 gap-1.5`

2. **Activity Mode:** Pass `data` prop (array of 7 numbers/booleans)
   - Green = activity, Grey = no activity
   - Grid: `grid grid-cols-7 gap-1.5`

3. **Progress Mode** (Legacy): Pass `total` and `mastered` props
   - Horizontal bars showing mastery percentage
   - Layout: `flex w-full items-center gap-1`

**Props:**
- `streak`: Number (0-7) - Number of consecutive days
- `data`: Array of 7 numbers/booleans - Daily activity data
- `total`: Number - Total words (legacy)
- `mastered`: Number - Mastered words (legacy)
- `small`: Boolean - Use smaller squares (`w-3 h-3` vs `aspect-square`)

**Styling:**
- Grid: `grid grid-cols-7 gap-1.5` (or `gap-1` if small)
- Squares: `rounded-md` (small radius for tiny elements)
- Colors: `bg-emerald-500` (active) / `bg-slate-200` (inactive)

**Note:** The Activity Bar (Panel D) uses a custom bar chart implementation instead of this component.

### 4.2 CollapsibleCard Component

**Location:** `src/components/CollapsibleCard.jsx`

**Status:** ⚠️ **Imported but currently unused** in Dashboard.jsx

**Purpose:** Expandable card component with fade effect (available for future use)

**Props:**
- `title`: String - Card title
- `children`: ReactNode - Card content
- `minHeight`: String - Minimum height class (default: `'h-64'`)

**Features:**
- Auto-detects content overflow
- Shows "Show More" button when content exceeds min height
- Fade gradient at bottom when collapsed
- Smooth expand/collapse animation

### 4.3 StudySelectionModal Component

**Location:** `src/components/modals/StudySelectionModal.jsx`

**Purpose:** Modal for selecting a vocabulary list to study/test

**Props:**
- `isOpen`: Boolean
- `onClose`: Function
- `classes`: Array of class objects with `assignedListDetails`
- `mode`: 'study' | 'test' (default: 'study')

**Behavior:**
- Collects all available lists from all enrolled classes
- Displays list cards with stats (words learned, due count)
- Navigates to `/study/{listId}` or `/test/{listId}` on selection

---

## 5. Special UI Elements

### 5.1 Panic Mode Warning

**Location:** `src/pages/Dashboard.jsx` (lines ~861-873)

**Purpose:** Alert banner when student retention drops below 60%

**Visual Design:**
- **Container:** `rounded-xl border-2 border-red-300 bg-red-50 p-4`
- **Layout:** Flex row with icon and text
- **Icon:** `text-xl` emoji (⚠️)
- **Content:**
  - Title: `font-semibold text-red-900` - "Panic Mode Active"
  - Description: `text-sm text-red-700` - Encouragement message

**Condition:** `userStats?.retention < 0.6`

### 5.2 Welcome Header

**Location:** `src/pages/Dashboard.jsx` (lines ~875-890)

**Layout:**
- Flex row: `flex flex-col md:flex-row md:items-end md:justify-between gap-4`
- **Left:** Welcome message
  - Heading: `text-3xl font-heading font-bold text-brand-primary`
  - Subtitle: `text-base text-slate-500`
- **Right:** Gradebook link
  - Button: `h-12 flex items-center gap-2 px-5 bg-white border border-slate-200 rounded-xl`
  - Icon: `<BookOpen size={20} />`
  - Text: "Gradebook"
  - Link: `/gradebook`

---

## 6. Button Standards

### 5.1 Fixed Height Rule

**All buttons must have fixed heights to prevent vertical growth:**

- **Primary Actions (Launchpad):** `h-14` (56px)
- **Secondary Actions (List items):** `h-12` (48px)
- **Small Actions:** `h-10` (40px)

### 5.2 Text Truncation

**All button text must truncate instead of wrapping:**

```jsx
<button className="h-12 flex items-center justify-center gap-2 rounded-xl ...">
  <svg className="h-5 w-5 flex-shrink-0">...</svg>
  <span className="truncate whitespace-nowrap max-w-full">Button Text</span>
</button>
```

**Pattern:**
- Button container: `flex items-center justify-center`
- Icon: `flex-shrink-0` (prevents icon from shrinking)
- Text: Wrapped in `<span>` with `truncate whitespace-nowrap max-w-full`

### 5.3 Color Coding

**Action Language:**
- **Study Actions:** Orange (`bg-brand-accent`) - "Study Now", "Start Study Session"
- **Test Actions:** Navy (`bg-brand-primary`) - "Take Test"
- **Secondary Actions:** White with border (`border border-slate-300 bg-white`)

---

## 7. Spacing & Layout Rules

### 6.1 Vertical Compression

**Right Column (Panels B, C, D):**
- Gap between panels: `gap-4` (reduced from `gap-6` for tighter layout)

**Panel Padding:**
- Panel B (Vitals): `p-4` (compressed)
- Panel C (Launchpad): `py-4 px-6` (compressed vertical)
- Panel D (Activity Bar): `px-6` (horizontal only, fixed height)

### 6.2 Grid System

**Main Grid:**
- Container: `grid grid-cols-12 gap-6`
- Left Column: `col-span-12 lg:col-span-6`
- Right Column: `col-span-12 lg:col-span-6 flex flex-col gap-4 h-full`

**Right Column Internal:**
- Top Row: `grid grid-cols-2 gap-6 flex-1` (Vitals + Launchpad)
- Bottom Row: `shrink-0` (Activity Bar)

---

## 8. Data Flow & State Management

### 8.1 User Data

**Source:** `user` object from `useAuth()` hook

**Structure:**
```javascript
user = {
  uid: string,
  email: string,
  stats: {
    totalWordsLearned: number,
    retention: number (0.0-1.0),
    streakDays: number
  },
  settings: {
    weeklyGoal: number
  }
}
```

### 8.2 Dashboard Stats

**Source:** `fetchDashboardStats(user.uid)` from `services/db`

**Returns:**
```javascript
{
  masteryCount: number,
  weeklyProgress: number,
  retention: number
}
```

### 8.3 Primary Focus Calculation

**Logic:** `getPrimaryFocus` (useMemo, lines ~659-717)
- Finds most recently assigned list from enrolled classes
- Prioritizes by `assignedAt` timestamp from class `assignments` map
- Falls back to first available list if no timestamp
- Calculates weekly goal: `list.pace * 7` (default pace: 7 words/day)
- Gets progress: `list.stats?.wordsLearned || 0`

### 8.4 Daily Activity Calculation

**Logic:** `dailyActivity` (useMemo, lines ~727-799)
- Source: `userAttempts` array from `fetchUserAttempts(user.uid)`
- Creates 7-day window: yesterday through 7 days ago
- Aggregates word counts per day from test attempts
- Formats dates: "Mon, Oct 24" format
- Includes `dailyPace` from primary focus (or default: 20)

### 8.5 Smart CTA Status Calculation

**Logic:** `smartCTAStatus` (useMemo, lines ~820-832)
- Calculates `expectedProgress = (weeklyGoal / 7) * currentDayOfWeek`
- Calculates `delta = primaryFocusProgress - expectedProgress`
- Status thresholds:
  - `delta < -5` → `'behind'` (red/orange gradient)
  - `delta > 5` → `'ahead'` (green/teal gradient)
  - Otherwise → `'onTrack'` (blue/navy gradient)
- Debug override: `DEBUG_STATUS` constant (set to `null` in production)

---

## 9. File Structure

```
src/
├── pages/
│   └── Dashboard.jsx          # Main dashboard (1200+ lines)
├── components/
│   ├── MasterySquares.jsx     # Activity/progress visualization
│   ├── MasteryBars.jsx         # Legacy 4x7 grid component (unused)
│   ├── CreateClassModal.jsx    # Teacher: Create class modal
│   ├── LoadingSpinner.jsx      # Loading state component
│   ├── CollapsibleCard.jsx     # Expandable card component
│   └── modals/
│       └── StudySelectionModal.jsx  # Study/test list selection
├── contexts/
│   └── AuthContext.jsx         # Firebase auth wrapper
├── services/
│   └── db.js                   # Firestore data fetching functions
├── firebase.js                 # Firebase initialization
└── index.css                   # Tailwind theme + utility classes
```

---

## 10. Key Implementation Patterns

### 10.1 Conditional Rendering

**Role-Based Views:**
```javascript
const { user } = useAuth()
const isTeacher = user?.role === 'teacher'

// Different JSX for teacher vs student
{isTeacher ? <TeacherDashboard /> : <StudentDashboard />}
```

### 10.2 Data Safety

**Always use optional chaining and defaults:**
```javascript
const wordsMastered = user?.stats?.totalWordsLearned ?? 0
const retentionPercent = retentionRate !== null 
  ? Math.round(retentionRate * 100) 
  : null
```

### 10.3 Modal Management

**State Pattern:**
```javascript
const [studyModalOpen, setStudyModalOpen] = useState(false)
const [testModalOpen, setTestModalOpen] = useState(false)

// Pass classes data to modal
<StudySelectionModal 
  isOpen={studyModalOpen} 
  onClose={() => setStudyModalOpen(false)}
  classes={studentClasses}
  mode="study"
/>
```

---

## 11. Current State & Next Steps

### ✅ Completed
- Design system implementation (colors, typography, spacing)
- Command Deck layout (4-panel structure)
- Focus Card with hero typography and real progress calculation
- Vitals panel with real user stats (Words Mastered, Retention, Streak)
- Smart Launchpad with dynamic status (behind/onTrack/ahead)
- Activity Bar with real 7-day bar chart and hover tooltips
- Button standardization (heights, truncation, radius)
- List view with real progress bars (calculated from stats)
- Teacher dashboard (separate implementation)
- Panic Mode warning banner
- Gradebook link in header
- Join class functionality
- Real data integration (dashboard stats, user attempts, class data)

### 🔄 In Progress / TODO
- **Teacher Dashboard:** Student count display not implemented
- **Responsive Breakpoints:** Some mobile optimizations needed
- **Dark Mode:** CSS variables defined but not fully implemented
- **Error States:** Need better error handling UI for edge cases
- **Component Cleanup:** `MasterySquares` and `CollapsibleCard` imported but unused

### 🎯 Recommended Next Steps for Developer

1. **Component Cleanup:**
   - Remove unused imports (`MasterySquares`, `CollapsibleCard`) or implement them
   - Consider extracting reusable card components for teacher/student dashboards

2. **Teacher Dashboard Enhancements:**
   - Implement student count display in class cards
   - Add class statistics/analytics
   - Improve list management UI

3. **Student Dashboard Enhancements:**
   - Add empty state animations
   - Enhance Activity Bar with more detailed tooltips
   - Add sorting/filtering to class list view

4. **Accessibility:**
   - Add ARIA labels to buttons and interactive elements
   - Ensure keyboard navigation for all modals
   - Test screen reader compatibility
   - Add focus indicators

5. **Performance:**
   - Optimize re-renders with `useMemo`/`useCallback` (already partially done)
   - Consider virtualizing long class/lists
   - Add error boundaries
   - Implement loading skeletons instead of spinners

6. **Data Enhancements:**
   - Add caching for frequently accessed data
   - Implement optimistic updates for better UX
   - Add data refresh indicators

---

## 12. Design Tokens Reference

**Quick Reference for Common Values:**

```css
/* Colors */
--color-brand-primary: #1B3A94    /* Navy */
--color-brand-accent: #F97316     /* Orange */
--color-bg-app-light: #F1F5F9     /* Slate-100 */

/* Typography */
--font-heading: 'Plus Jakarta Sans'
--font-body: 'Pretendard'

/* Spacing */
gap-4: 1rem (16px)  /* Between panels */
gap-6: 1.5rem (24px) /* Main grid gap */
p-4: 1rem (16px)     /* Compressed padding */
p-6: 1.5rem (24px)   /* Standard padding */
p-8: 2rem (32px)     /* Focus card padding */

/* Border Radius */
rounded-md: 0.375rem (6px)   /* Tiny elements */
rounded-xl: 0.75rem (12px)    /* Buttons/inputs */
rounded-2xl: 1rem (16px)      /* Cards/containers */

/* Heights */
h-10: 2.5rem (40px)  /* Small buttons */
h-12: 3rem (48px)    /* Standard buttons */
h-14: 3.5rem (56px)  /* Primary buttons */
h-24: 6rem (96px)    /* Activity bar */
```

---

## 13. Common Pitfalls to Avoid

1. **Don't mix radius sizes:** Buttons inside cards must use `rounded-xl`, not `rounded-2xl`
2. **Don't forget truncation:** All button text must have truncation wrapper
3. **Don't use transparency:** Cards are solid white, not glassmorphism
4. **Don't hardcode heights:** Use fixed heights (`h-12`, `h-14`) not `py-*` alone
5. **Don't skip optional chaining:** Always use `user?.stats?.property ?? defaultValue`
6. **Don't break the grid:** Right column must use `flex flex-col` with `h-full` for height matching
7. **Don't mix teacher/student components:** They use separate implementations, no shared card components
8. **Don't forget Panic Mode:** Always check retention < 0.6 and show warning banner
9. **Don't hardcode progress:** All progress bars use real calculations from `list.stats`
10. **Don't forget hover states:** Activity Bar bars need hover tooltips with date and word count

---

**End of Specification**

For questions or clarifications, refer to:
- `src/pages/Dashboard.jsx` - Main implementation
- `src/index.css` - Design system definitions
- `vocaboost_tech_spec.md` - Full technical specification

