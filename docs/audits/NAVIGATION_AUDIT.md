# Navigation Audit Report

**Generated:** 2026-01-04
**Application:** VocaBoost

---

## Table of Contents

1. [Router Configuration](#1-router-configuration)
2. [Page-by-Page Navigation Audit](#2-page-by-page-navigation-audit)
   - [Dashboard.jsx](#dashboardjsx)
   - [ClassDetail.jsx](#classdetailjsx)
   - [DailySessionFlow.jsx](#dailysessionflowjsx)
   - [MCQTest.jsx](#mcqtestjsx)
   - [TypedTest.jsx](#typedtestjsx)
   - [Settings.jsx](#settingsjsx)
   - [BlindSpotCheck.jsx](#blindspotcheckjsx)
   - [ListLibrary.jsx](#listlibraryjsx)
   - [ListEditor.jsx](#listeditorjsx)
   - [Gradebook.jsx](#gradebookjsx)
   - [Login.jsx](#loginjsx)
   - [Signup.jsx](#signupjsx)
3. [Shared Navigation Components](#3-shared-navigation-components)
4. [Navigation Flow Diagrams](#4-navigation-flow-diagrams)
5. [Summary Statistics](#5-summary-statistics)

---

## 1. Router Configuration

**File:** `src/App.jsx`

All routes are wrapped in `<PrivateRoute>` (requires authentication). Teacher-only routes additionally use `<TeacherRoute>`.

| Route Pattern | Component | Access Level | Description |
|---------------|-----------|--------------|-------------|
| `/` | Dashboard | Private (All) | Main landing page |
| `/login` | Login | Public | Authentication page |
| `/signup` | Signup | Public | User registration |
| `/lists` | ListLibrary | Teacher Only | List management |
| `/lists/new` | ListEditor (create mode) | Teacher Only | Create new list |
| `/lists/:listId` | ListEditor | Teacher Only | Edit existing list |
| `/classes/:classId` | ClassDetail | Teacher Only | Class management |
| `/session/:classId/:listId` | DailySessionFlow | Private (All) | Study session orchestrator |
| `/blindspots/:classId/:listId` | BlindSpotCheck | Private (All) | Blind spot review |
| `/mcqtest/:classId/:listId` | MCQTest | Private (All) | Multiple choice test |
| `/typedtest/:classId/:listId` | TypedTest | Private (All) | Typed answer test |
| `/gradebook` | Gradebook (student) | Private (All) | Student grades view |
| `/teacher/gradebook` | Gradebook (teacher) | Teacher Only | Teacher grades view |
| `/settings` | Settings | Private (All) | User settings |
| `*` (catch-all) | Redirect to `/` | - | Unknown routes redirect home |

---

## 2. Page-by-Page Navigation Audit

### Dashboard.jsx

#### Teacher View - Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 687 | Button | onClick | Opens modal | "Create New Class" |
| 709 | CardButton | `to` prop | `/classes/{classId}` | Class name card |
| 767 | Button | `to` prop | `/lists` | "View All Lists" |
| 771 | Button | `to` prop | `/lists/new` | "Create New List" |
| 793 | CardButton | `to` prop | `/lists/{listId}` | List title card |

#### Student View - Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 1420 | Button | onClick | Opens StudyModal | "Practice More" |
| 1439 | Button | onClick | Opens StudyModal | "Start Session" (main launchpad) |
| 1796 | Button | onClick → navigate() | `/session/{classId}/{listId}` | "Start Session" (per list) |
| 1804-1812 | Link | `to` prop | `/blindspots/{classId}/{listId}` | "Blind Spots" |
| 1820-1834 | Button | onClick | Opens PDF modal | "Today" (PDF button) |
| 1855-1868 | Button | onClick | Triggers PDF download | "Full" (PDF button) |
| 1999-2002 | Button | onClick → navigate() | `/session/{classId}/{listId}` | "Study Again" (re-entry modal) |
| 2010-2016 | Button | onClick | `/` after state clear | "Move to Next Day" |

#### Automatic Redirects (useEffect)

| Line | Condition | Action |
|------|-----------|--------|
| 612-634 | `shouldShowReEntryModal(sessionState)` returns true | Shows re-entry modal instead of direct navigation |

---

### ClassDetail.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 417 | Button | onClick → navigate(-1) | Previous page (history back) | "Go Back" (error state) |
| 480 | Button | onClick → navigate() | `/classes/{classId}` | Class name (switcher dropdown) |
| 501 | Button | `to` prop | `/lists` | "Manage Lists" |
| 539 | Button | onClick | Opens AssignModal | "Assign List" |
| 757 | Link | `to` prop | `/teacher/gradebook?classId={classId}` | "Open Gradebook" |
| 738 | Button | onClick | Clipboard copy (no nav) | "Copy" (join code) |

---

### DailySessionFlow.jsx

#### Navigation Buttons & Phase Transitions

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 628 | navigate() | Programmatic | `/session/{classId}/{listId}` | Navigate after state check |
| 739-743 | Button | onClick → goToNewWordTest() | Navigates via navigateToTest() | "Take Test" (study phase) |
| 749-751 | Button | onClick | Phase change to REVIEW | "Continue" (after new word test) |
| 877-888 | Button | onClick → goToReviewTest() | Navigates via navigateToTest() | "Take Test" (review phase) |
| 919-940 | navigate() | Programmatic | `/mcqtest/{classId}/{listId}` OR `/typedtest/{classId}/{listId}` | Test navigation |
| 935-951 | Button | onClick → handleGoToStudy() | returnPath | "Study" (from test results) |
| 1140 | navigate() | Programmatic | `/` | "Back to Dashboard" (error) |
| 1232 | navigate() | Programmatic | `/` | After quit confirmation |
| 1267 | navigate() | Programmatic | `/` | "Back to Dashboard" (error modal) |
| 1467 | Button | onClick → navigate() | `/` | "Dashboard" (complete screen) |
| 1472-1476 | Button | onClick | Modal OR window.location.reload() | "Next Session" |
| 1593-1613 | Modal buttons | onClick | `/` OR reload | "Start Next Session" / "Maybe Later" |

#### Automatic Redirects (useEffect)

| Line | Condition | Action |
|------|-----------|--------|
| 556-588 | `wasInTestPhase(localState)` && not intentional exit | Navigate directly to `/mcqtest` or `/typedtest` |
| 944-991 | `location.state?.goToStudy` is true | Restore state, set phase to STUDY |
| 994-1044 | `location.state?.testCompleted` is true | Handle results, move to next phase |

#### Modal Buttons

| Line | Modal | Button | Action |
|------|-------|--------|--------|
| 1419-1425 | "Ready for Test?" | "Start Test" | Calls goToNewWordTest() or handleFinishReviewStudy() |
| 1527 | "Re-entry" | "Retry Review Test" | handleReEntryRetake() → REVIEW_STUDY phase |
| 1528 | "Re-entry" | "Move On to Next Day" | handleReEntryMoveOn() → navigate('/') |
| 1540 | "Move On" | "Complete & Move On" | handleMoveToNextDay() → navigate('/') |
| 1550 | "Complete Mode" | "Switch to Complete" | Phase change only |
| 1559 | "Fast Mode" | "Switch to Fast" | Phase change only |

---

### MCQTest.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 505-514 | Button | onClick → handleFinish() | returnPath or `/` | "Return to Dashboard" (passed test) |
| 519-532 | Button | onClick → handleGoToStudy() | returnPath with state | "Study" (failed test) |
| 529-532 | Button | onClick → handleQuitConfirm() | returnPath or `/` | "Quit" (confirmation modal) |
| 649 | Button | onClick → handleFinish() | returnPath or `/` | "Return to Dashboard" (excellent score) |
| 773 | Button | onClick → handleFinish() | returnPath or `/` | "Continue" (good score) |
| 781 | Button | onClick → handleRetake() | Stays on page (retake) | "Review Again" (good score) |
| 794 | Button | onClick → handleRetake() | Stays on page (retake) | "Retake Test" (needs-work) |
| 807 | Button | onClick → handleRetake() | Stays on page (retake) | "Retake Test" (critical) |
| 902 | Button | onClick | Opens quit modal | "Quit" |

#### Automatic Redirects (useEffect)

| Line | Condition | Action |
|------|-----------|--------|
| 298-314 | Saved test state exists && not intentional exit | Show recovery modal |

---

### TypedTest.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 640-650 | Button | onClick → handleBackToSession() | returnPath or `/` | "Return to Dashboard" (passed) |
| 655-661 | Button | onClick → handleGoToStudy() | returnPath with state | "Study" (failed) |
| 456 | Button | onClick → handleQuitConfirm() | returnPath or `/` | "Quit" (confirmation) |
| 611 | Button | onClick → navigate(-1) | History back | "Go Back" (error) |
| 626 | Button | onClick → navigate(-1) | History back | "Go Back" (no content) |
| 715 | Button | onClick → handleBackToSession() | returnPath or `/` | "Return to Dashboard" (excellent) |
| 839 | Button | onClick → handleBackToSession() | returnPath or `/` | "Continue" (good score) |
| 847 | Button | onClick → handleRetake() | Stays on page | "Review Again" |
| 860 | Button | onClick → handleRetake() | Stays on page | "Retake Test" (needs-work) |
| 873 | Button | onClick → handleRetake() | Stays on page | "Retake Test" (critical) |
| 951 | Button | onClick | Opens quit modal | "Quit test" |

#### Automatic Redirects (useEffect)

| Line | Condition | Action |
|------|-----------|--------|
| 165-195 | Valid recovery state exists | Show recovery prompt |

---

### Settings.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 119-126 | Button | onClick → navigate(-1) | History back | "Back" |
| 141 | Button | onClick → resetToDefaults() | Theme reset (no nav) | "Reset" (theme) |
| 341 | Button | onClick → handleResetClick() | Opens modal 1 | "Reset Progress" |
| 394 | Button | onClick | Opens modal 2 | "Continue" (modal 1) |
| 448 | Button | onClick → handleFinalReset() | Resets DB, clears UI | "Reset Progress" (final) |

#### Modal Buttons

| Line | Modal | Button | Action |
|------|-------|--------|--------|
| 370 | Modal 1 | X (close) | closeModals() |
| 388 | Modal 1 | "Cancel" | closeModals() |
| 394 | Modal 1 | "Continue" | Shows modal 2 |
| 417 | Modal 2 | X (close) | closeModals() |
| 442 | Modal 2 | "Cancel" | closeModals() |
| 448 | Modal 2 | "Reset Progress" | Database reset |

---

### BlindSpotCheck.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 54 | CardButton | onClick → navigate() | `/blindspots/{classId}/{listId}` | Card navigation |
| 157 | Button | onClick → navigate() | `/` | "Back to Dashboard" |
| 202 | Button | onClick → navigate() | `/` | "Back to Dashboard" |
| 240 | Button | onClick → navigate() | `/` | "Back to Dashboard" |
| 309 | Button | onClick → navigate() | `/` | "Back to Dashboard" |

---

### ListLibrary.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| - | Link/Button | `to` prop | `/lists/new` | "Create New List" |
| - | CardButton | `to` prop | `/lists/{listId}` | List title cards |

---

### ListEditor.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 118 | navigate() | Programmatic | `/lists/{newList.id}` | After list creation |
| - | Button | onClick → navigate(-1) | History back | "Cancel" / "Back" |

---

### Gradebook.jsx

#### Navigation Buttons

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| - | Back button | onClick → navigate(-1) | History back | "Back" |

---

### Login.jsx

#### Navigation Buttons & Redirects

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 13, 32 | navigate() | Programmatic | `/` | After successful login |
| - | Link | `to` prop | `/signup` | "Sign up" link |

---

### Signup.jsx

#### Navigation Buttons & Redirects

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 39, 54 | navigate() | Programmatic | `/` | After successful signup |
| - | Link | `to` prop | `/login` | "Log in" link |

---

## 3. Shared Navigation Components

### HeaderBar.jsx

Global navigation header present on most authenticated pages.

| Line | Element | Type | Destination | Visibility |
|------|---------|------|-------------|------------|
| 75 | Logo | Link | `/` | Always |
| 86 | NavButton | `to` prop | `/` | Always |
| 120 | Dropdown Links | Link | `/classes/{classId}` | Teacher only |
| 143 | NavButton | `to` prop | `/gradebook` (student) OR `/teacher/gradebook` (teacher) | Always |
| 153 | NavButton | `to` prop | `/lists` | Teacher only |
| 165 | Button | onClick | Opens help modal | Student only |
| 196 | Link | `to` prop | `/profile` | **NOT IMPLEMENTED - redirects to /** |
| 204 | Link | `to` prop | `/settings` | Dropdown menu |
| 217 | Button | onClick → logout | `/login` (via auth) | Dropdown menu |

### SessionHeader.jsx

Sticky header for study/test sessions.

| Line | Element | Type | Action |
|------|---------|------|--------|
| 32 | Back Button | onClick | Calls `onBack` callback |
| 54 | Step Indicator | onClick | Calls `onStepClick` callback |

### BackButton.jsx

Reusable back button component.

| Line | Element | Type | Destination |
|------|---------|------|-------------|
| 6 | Link | `to` prop | `/` (hardcoded to Dashboard) |

### Button Component (buttons/Button.jsx)

Multipurpose button supporting navigation:
- `to` prop → renders as `<Link>` (internal navigation)
- `href` prop → renders as `<a>` (external link)
- Neither → renders as `<button>` (onClick handler)

### CardButton Component (buttons/CardButton.jsx)

Makes card elements clickable:
- `to` prop → renders as `<Link>`
- Otherwise → renders as `<div>` with onClick

### NavButton Component (buttons/NavButton.jsx)

Header navigation buttons using React Router `<Link>`.

### LinkButton Component (buttons/LinkButton.jsx)

Inline text-style buttons with optional `to` prop for navigation.

---

## 4. Navigation Flow Diagrams

### Authentication Flow
```
Login Page ──────────────────────────► Dashboard (/)
     │                                      ▲
     │                                      │
     └──► Signup Page ──────────────────────┘
```

### Student Study Flow
```
Dashboard (/)
     │
     ├──► Start Session ──► DailySessionFlow (/session/{classId}/{listId})
     │                              │
     │                              ├──► MCQTest (/mcqtest/{classId}/{listId})
     │                              │         │
     │                              │         └──► Back to Session OR Dashboard
     │                              │
     │                              ├──► TypedTest (/typedtest/{classId}/{listId})
     │                              │         │
     │                              │         └──► Back to Session OR Dashboard
     │                              │
     │                              └──► Complete ──► Dashboard (/)
     │
     └──► Blind Spots ──► BlindSpotCheck (/blindspots/{classId}/{listId})
                                │
                                └──► Dashboard (/)
```

### Teacher Flow
```
Dashboard (/)
     │
     ├──► Classes ──► ClassDetail (/classes/{classId})
     │                      │
     │                      ├──► Gradebook (/teacher/gradebook?classId={classId})
     │                      │
     │                      └──► Assign List (modal)
     │
     ├──► Lists ──► ListLibrary (/lists)
     │                   │
     │                   ├──► Create List (/lists/new) ──► ListEditor
     │                   │                                      │
     │                   │                                      └──► /lists/{newListId}
     │                   │
     │                   └──► Edit List (/lists/{listId}) ──► ListEditor
     │
     └──► Gradebook (/teacher/gradebook)
```

### Settings Flow
```
Any Page
     │
     └──► Settings (/settings)
               │
               ├──► Back (history -1)
               │
               └──► Reset Progress (modal flow)
```

---

## 5. Summary Statistics

### Total Navigation Elements by Type

| Type | Count |
|------|-------|
| Direct `navigate()` calls | 22 |
| Router `<Link>` / `to` props | 8 |
| Modal triggers (no navigation) | 14 |
| State-based phase changes | 12 |
| useEffect conditional redirects | 5 |
| Route guard redirects | 2 |
| History back `navigate(-1)` | 3 |
| `window.location.reload()` | 2 |
| **TOTAL** | **68** |

### Most Common Destinations

| Destination | Occurrences |
|-------------|-------------|
| `/` (Dashboard) | 14 |
| `/session/{classId}/{listId}` | 4 |
| `/blindspots/{classId}/{listId}` | 4 |
| `/classes/{classId}` | 3 |
| `/mcqtest/{classId}/{listId}` | 2 |
| `/typedtest/{classId}/{listId}` | 2 |
| `/lists` | 2 |
| `/login` | 2 |
| `/teacher/gradebook` | 1 |
| `/lists/new` | 1 |
| `/settings` | 1 |

### Navigation by Page

| Page | Buttons | Redirects | Modals |
|------|---------|-----------|--------|
| Dashboard.jsx | 10 | 1 | 3 |
| DailySessionFlow.jsx | 12 | 3 | 6 |
| MCQTest.jsx | 8 | 1 | 1 |
| TypedTest.jsx | 9 | 1 | 1 |
| ClassDetail.jsx | 6 | 0 | 1 |
| Settings.jsx | 5 | 0 | 2 |
| BlindSpotCheck.jsx | 5 | 0 | 0 |

---

## Additional Components (Second Pass)

### BlindSpotsCard.jsx

A reusable card component for displaying blind spot status with navigation.

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 54 | handleStartTest() | navigate() | `/blindspots/{classId}/{listId}` | Called by buttons |
| 103-109 | Button | onClick → handleStartTest() | `/blindspots/{classId}/{listId}` | "Check" (compact mode) |
| 153-160 | Button | onClick → handleStartTest() | `/blindspots/{classId}/{listId}` | "Check Blind Spots" (full mode) |

### StudySelectionModal.jsx

Modal for selecting a list to study/test.

| Line | Element | Type | Destination | Label/Action |
|------|---------|------|-------------|--------------|
| 73-106 | Link | `to` prop | `/{mode}/{list.id}?classId={classId}` | List selection card |

**Note:** The `mode` parameter can be "study" or "test", generating paths like `/study/{listId}` or `/test/{listId}`. **These routes are NOT defined in App.jsx** - see Issues section.

### PrivateRoute.jsx (Route Guard)

Automatic redirects for unauthenticated users.

| Line | Condition | Destination | Action |
|------|-----------|-------------|--------|
| 16 | `!user` (not authenticated) | `/login` | Redirect to login page |

### TeacherRoute.jsx (Route Guard)

Automatic redirects for non-teacher users.

| Line | Condition | Destination | Action |
|------|-----------|-------------|--------|
| 16 | `user?.role !== 'teacher'` | `/` | Redirect to dashboard |

---

## Issues Found

### 1. Dead Route Reference - Profile
**Location:** `HeaderBar.jsx` line 196
**Issue:** Link to `/profile` route which is NOT defined in App.jsx
**Result:** Clicking "Profile" redirects to `/` due to catch-all route

### 2. Dead Route Reference - Study/Test Modal
**Location:** `StudySelectionModal.jsx` line 75
**Issue:** Modal generates links to `/{mode}/{listId}` where mode is "study" or "test"
**Generated paths:** `/study/{listId}` and `/test/{listId}`
**Result:** These routes are NOT defined in App.jsx - they redirect to `/` via catch-all
**Note:** This modal appears to be legacy code that may not be actively used

### 3. Hardcoded BackButton
**Location:** `BackButton.jsx` line 6
**Issue:** BackButton component always navigates to `/` instead of using history
**Impact:** May not provide expected behavior in deeply nested navigation

---

## Audit Methodology

This audit was performed by:
1. Analyzing all route definitions in `App.jsx`
2. Searching for `navigate()` calls across all page files
3. Identifying all `<Link>` and `to` prop usage
4. Examining `useEffect` hooks for conditional redirects
5. Reviewing modal components for navigation triggers
6. Analyzing shared navigation components (HeaderBar, Button, etc.)

**Files Analyzed:**
- `src/App.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/ClassDetail.jsx`
- `src/pages/DailySessionFlow.jsx`
- `src/pages/MCQTest.jsx`
- `src/pages/TypedTest.jsx`
- `src/pages/Settings.jsx`
- `src/pages/BlindSpotCheck.jsx`
- `src/pages/Login.jsx`
- `src/pages/Signup.jsx`
- `src/pages/ListLibrary.jsx`
- `src/pages/ListEditor.jsx`
- `src/pages/Gradebook.jsx`
- `src/components/HeaderBar.jsx`
- `src/components/SessionHeader.jsx`
- `src/components/BackButton.jsx`
- `src/components/BlindSpotsCard.jsx`
- `src/components/PrivateRoute.jsx`
- `src/components/TeacherRoute.jsx`
- `src/components/modals/StudySelectionModal.jsx`
- `src/components/ui/buttons/*.jsx`

---

*End of Navigation Audit Report*
