# Fix Plan: Sections 1.10 to 1.12

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_1.10_to_1.12_criteria_audit.md

## Executive Summary
- Total Issues: 3
- Partial Implementations: 3
- Missing Features: 0
- Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: Submit Progress Modal Missing (Section 1.10)

### Audit Finding
- **Status:** Partial
- **Criterion:** State `submitting` - Shows submit progress modal
- **Current State:** The `isSubmitting` state is tracked (line 81 in APTestSession.jsx) and used to disable UI elements, but there is NO dedicated "submit progress modal" component showing sync progress.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestSession.jsx` (lines 81, 182-192, 436) - isSubmitting state, handleSubmit function, disabled prop usage
  - `src/apBoost/hooks/useTestSession.js` (lines 32, 396-421) - isSubmitting state management, submitTest function
  - `src/apBoost/components/ReviewScreen.jsx` (lines 138-144) - Button shows "Submitting..." text but no modal
  - `src/apBoost/components/DuplicateTabModal.jsx` - Reference modal pattern to follow

- **Current Implementation:**
  - `isSubmitting` boolean state in useTestSession hook (line 32)
  - submitTest() function sets isSubmitting=true, pauses timer, flushes queue, creates result (lines 396-421)
  - APTestSession passes isSubmitting to disable UI elements (line 436)
  - ReviewScreen shows spinner text "Submitting..." in button (lines 138-144)

- **Gap:** No modal component exists to show submission progress. The acceptance criteria specifies:
  - Show "Syncing your answers..." modal with progress
  - Aggressive flush retry every 2s
  - On failure for 30s+: show "Unable to sync" modal with "Keep Trying" button

- **Dependencies:**
  - useTestSession hook provides: isSubmitting, queueLength, isSyncing
  - useOfflineQueue hook provides: flushQueue, queueLength, isFlushing
  - Modal should be shown when isSubmitting=true in APTestSession.jsx

### Fix Plan

#### Step 1: Create SubmitProgressModal component
**File:** `src/apBoost/components/SubmitProgressModal.jsx`
**Action:** Create new file
**Details:**
- Follow the same pattern as DuplicateTabModal.jsx (fixed inset, z-50, centered)
- Accept props: `isVisible`, `queueLength`, `isSyncing`, `isError`, `onRetry`
- Show spinner/progress animation during sync
- Display "Syncing your answers..." message
- Show queue items remaining count: "Syncing X items..."
- After 30s of failure, show "Unable to sync" with "Keep Trying" button
- Use design tokens: bg-surface, rounded-[--radius-card], shadow-theme-xl
- Reference: `src/apBoost/components/DuplicateTabModal.jsx` for modal structure

**Code pattern to follow:**
```jsx
// From DuplicateTabModal.jsx (lines 5-52)
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/50" />
  <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
    {/* Content */}
  </div>
</div>
```

#### Step 2: Add submit state tracking
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add `submitError` state to track submission failures
- Add `submitStartTime` ref to track elapsed time
- Add logic to detect 30s+ failure condition
- Expose: submitError, retrySubmit in return object

#### Step 3: Integrate modal into APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Import SubmitProgressModal
- Add conditional render when isSubmitting=true (after line 400)
- Pass required props: isSubmitting, queueLength, isSyncing, submitError, onRetry

### Verification Steps
1. Start a test and add some answers
2. Go offline (disable network)
3. Click submit - modal should appear showing "Syncing..."
4. Wait 30+ seconds - modal should show "Unable to sync" with retry button
5. Go online and click "Keep Trying" - should sync and complete

### Potential Risks
- Modal blocking submission completion visibility - ensure modal handles success state properly
- Race condition between modal display and navigation to results - ensure modal closes before navigate

---

## Issue 2: Menu Button Missing in Header (Section 1.10)

### Audit Finding
- **Status:** Partial
- **Criterion:** Header shows - Section X of Y, section type, timer, menu button
- **Current State:** Header at lines 403-411 in APTestSession.jsx shows Section info and TestTimer, but NO menu button [≡] is present.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestSession.jsx` (lines 403-411) - Test session header
  - `src/apBoost/components/APHeader.jsx` - Separate header component (not used in test session)
  - `src/apBoost/components/QuestionNavigator.jsx` (lines 141-234) - Reference for slide-up menu pattern

- **Current Implementation:**
  - Header is inline JSX in APTestSession.jsx (lines 403-411)
  - Contains: section indicator, section title, TestTimer
  - No menu button or dropdown exists

- **Gap:** Missing hamburger menu button [≡] that provides access to:
  - Settings (optional)
  - Help/instructions
  - Exit to dashboard (with confirmation)
  - Navigation options

- **Dependencies:**
  - Could use existing modal/dropdown patterns from QuestionNavigator

### Fix Plan

#### Step 1: Create TestSessionMenu component
**File:** `src/apBoost/components/TestSessionMenu.jsx`
**Action:** Create new file
**Details:**
- Create a slide-out or dropdown menu component
- Toggle button: [≡] hamburger icon
- Menu items:
  - "Test Instructions" - shows/hides InstructionScreen as modal
  - "Go to Question..." - opens QuestionNavigator
  - "Exit Test" - confirmation then navigate to /ap
- Use slide-up pattern from QuestionNavigator.jsx (lines 141-234)
- Use design tokens: bg-surface, border-border-default

**Code pattern to follow:**
```jsx
// From QuestionNavigator.jsx modal pattern (lines 141-162)
{isModalOpen && (
  <div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up">
      {/* Menu content */}
    </div>
  </div>
)}
```

#### Step 2: Add menu button to header
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify header section (lines 403-411)
**Details:**
- Import TestSessionMenu component
- Add hamburger button before section indicator
- Button styling: text-text-secondary hover:text-text-primary
- Icon: ≡ or use a hamburger icon component

**Current code (lines 403-411):**
```jsx
<header className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <span className="text-text-secondary text-sm">
      Section {position.sectionIndex + 1} of {test?.sections?.length || 1}:{' '}
      {currentSection?.title || 'Multiple Choice'}
    </span>
  </div>
  <TestTimer timeRemaining={timeRemaining} />
</header>
```

**Updated code:**
```jsx
<header className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <TestSessionMenu
      onGoToQuestion={...}
      onExit={handleCancel}
    />
    <span className="text-text-secondary text-sm">
      Section {position.sectionIndex + 1} of {test?.sections?.length || 1}:{' '}
      {currentSection?.title || 'Multiple Choice'}
    </span>
  </div>
  <TestTimer timeRemaining={timeRemaining} />
</header>
```

### Verification Steps
1. Navigate to test session
2. Verify hamburger button [≡] appears in header left side
3. Click button - menu should open
4. Click each menu item and verify functionality
5. Click backdrop - menu should close
6. Verify menu doesn't interfere with test timer

### Potential Risks
- Menu z-index conflicts with other modals (DuplicateTabModal, QuestionNavigator) - use z-50 consistently
- Exit without confirmation could cause data loss - add confirmation dialog

---

## Issue 3: ToolsToolbar Not Floating (Section 1.12)

### Audit Finding
- **Status:** Partial
- **Criterion:** Floating toolbar for tool controls
- **Current State:** The toolbar is implemented but is NOT "floating" (no absolute/fixed positioning). It's rendered inline within PassageDisplay.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/tools/ToolsToolbar.jsx` (lines 96-169) - Toolbar component
  - `src/apBoost/components/tools/PassageDisplay.jsx` (lines 57-73) - Where toolbar is rendered
  - `src/apBoost/components/FRQQuestionDisplay.jsx` (line 106) - Has lg:sticky lg:top-4 pattern

- **Current Implementation:**
  - ToolsToolbar renders with `className="flex items-center gap-2 flex-wrap"` (line 97)
  - PassageDisplay embeds it in: `<div className="shrink-0 pb-3 mb-3 border-b border-border-default">` (line 61)
  - No position:fixed, position:absolute, or position:sticky applied

- **Gap:** Toolbar should remain visible when scrolling long passages. Current inline implementation scrolls away with content.

- **Dependencies:**
  - PassageDisplay is the parent component that controls toolbar placement
  - Toolbar appears only for text stimuli (line 60: `showToolbar && isText`)

### Fix Plan

#### Step 1: Make toolbar sticky in PassageDisplay
**File:** `src/apBoost/components/tools/PassageDisplay.jsx`
**Action:** Modify toolbar wrapper (lines 60-73)
**Details:**
- Add `sticky top-0 z-10` to toolbar wrapper
- Add background color to prevent content showing through
- Adjust padding/margin for visual separation when stuck

**Current code (lines 57-73):**
```jsx
<div className="flex flex-col h-full">
  {/* Toolbar */}
  {showToolbar && isText && (
    <div className="shrink-0 pb-3 mb-3 border-b border-border-default">
      <ToolsToolbar ... />
    </div>
  )}
  {/* Content area */}
  <div className="flex-1 overflow-auto relative" ref={contentRef}>
```

**Updated code:**
```jsx
<div className="flex flex-col h-full">
  {/* Content area with sticky toolbar inside */}
  <div className="flex-1 overflow-auto relative" ref={contentRef}>
    {/* Sticky Toolbar */}
    {showToolbar && isText && (
      <div className="sticky top-0 z-10 bg-surface pb-3 mb-3 border-b border-border-default">
        <ToolsToolbar ... />
      </div>
    )}
```

**Important:** Move toolbar INSIDE the scrollable container for sticky to work properly.

#### Step 2: Alternative - Fixed floating toolbar
**File:** `src/apBoost/components/tools/PassageDisplay.jsx`
**Action:** Alternative approach if sticky doesn't work well
**Details:**
- Use position:fixed with calculated position based on passage container
- Position toolbar at top of passage area
- Use portal if needed to escape stacking contexts

**Pattern reference (from GradingPanel.jsx line 376):**
```jsx
<div className="fixed inset-y-0 right-0 w-full max-w-2xl ...">
```

However, sticky approach is preferred as it's simpler and works within the normal document flow.

### Verification Steps
1. Navigate to a question with a long text passage (HORIZONTAL format)
2. Scroll down in the passage area
3. Verify toolbar remains visible at top of passage
4. Verify toolbar doesn't overlap inappropriately with header
5. Test on mobile viewport - ensure toolbar still works

### Potential Risks
- Sticky may not work if parent has overflow:hidden - verified PassageDisplay uses overflow-auto on content area
- Background color needed to prevent text bleeding through - add bg-surface to sticky element
- Z-index conflicts with other elements - use z-10 for toolbar

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 3: ToolsToolbar Floating** - Lowest risk, self-contained CSS change, no new components
2. **Issue 2: Menu Button** - Medium complexity, new component but follows existing patterns
3. **Issue 1: Submit Progress Modal** - Highest complexity, requires hook modifications and new component with error handling logic

## Cross-Cutting Concerns

### Modal z-index hierarchy
All modals should use consistent z-index values:
- z-40: Backdrop overlays
- z-50: Modal content
- z-10: Sticky toolbar (lower, within content area)

### Design tokens to use
All new components should use these design tokens:
- `bg-surface` for backgrounds
- `rounded-[--radius-card]` for card-like modals
- `shadow-theme-xl` for elevated modals
- `border-border-default` for borders
- `text-text-primary`, `text-text-secondary`, `text-text-muted` for text

## Notes for Implementer

1. **Modal animation:** Both QuestionNavigator and potential new modals use `animate-slide-up`. Consider creating a shared animation utility or CSS class.

2. **Submit flow timeout:** The 30-second failure detection should use a ref (not state) to track start time to avoid re-render cycles.

3. **Toolbar sticky vs fixed:** Prefer sticky positioning as it's simpler. Only use fixed if sticky doesn't work due to parent overflow constraints.

4. **Menu button exit confirmation:** When implementing "Exit Test" in the menu, add a confirmation dialog to prevent accidental exits. Reference the existing pattern in the codebase.

5. **Testing considerations:**
   - Test submit modal with slow/offline network
   - Test toolbar sticky behavior with very long passages
   - Test menu on mobile viewports

## Files to Create
1. `src/apBoost/components/SubmitProgressModal.jsx`
2. `src/apBoost/components/TestSessionMenu.jsx`

## Files to Modify
1. `src/apBoost/pages/APTestSession.jsx` - Add menu button, integrate submit modal
2. `src/apBoost/hooks/useTestSession.js` - Add submit error tracking
3. `src/apBoost/components/tools/PassageDisplay.jsx` - Make toolbar sticky
