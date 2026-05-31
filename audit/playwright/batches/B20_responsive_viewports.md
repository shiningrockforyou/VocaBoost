# B20 — Responsive Viewports

**Priority:** P3
**Estimated duration:** 30–60 minutes
**Depends on:** B00.
**Personas:** all (focus on `phone` for mobile, baseline `careful` for tablet/desktop).

## Goal

Layout works on the three primary viewports. Nothing critical hidden, no horizontal overflow, no broken touch targets.

## Viewports

- **Mobile:** 375 × 812 (iPhone 13).
- **Tablet:** 768 × 1024 (iPad).
- **Desktop:** 1440 × 900.

## Page-coverage checklist (apply to each S below)

For each page in S01–S14, screenshot at all three viewports and verify:
- Nothing horizontally overflows.
- Tappable targets ≥ 44px on mobile.
- Text not truncated to unreadability.
- Critical CTAs (Submit, Start) always visible without scroll.

## Scenarios

### S01 — Landing / Login (3 viewports)
Capture: mobile, tablet, desktop screenshots of `/login`.

### S02 — Signup (3 viewports)
Capture screenshots of `/signup`.

### S03 — Student Dashboard (3 viewports)
Log in as `careful`, capture dashboard at each viewport.

### S04 — Teacher Dashboard (3 viewports)
Log in as `teacher` (Veterans proxy), capture dashboard at each viewport.

### S05 — Daily Session — NEW_WORDS card (3 viewports)
Begin a session, capture the NEW_WORDS flashcard view at each viewport.

### S06 — Daily Session — REVIEW_STUDY card (3 viewports)
Continue to REVIEW_STUDY phase, capture at each viewport.

### S07 — MCQ Test (3 viewports)
Launch an MCQ test, capture the question screen at each viewport.

### S08 — Typed Test (3 viewports)
Launch a typed test, capture the prompt + input UI at each viewport.

### S09 — Blind Spot Test (3 viewports)
Launch a blind-spot test, capture at each viewport.

### S10 — Test Results screen (3 viewports)
Submit a test, capture the results screen at each viewport.

### S11 — List Editor (3 viewports)
As teacher, open a list editor, capture each viewport.

### S12 — Gradebook (3 viewports)
As teacher, open gradebook, capture at each viewport.

### S13 — Challenge dispute modal (3 viewports)
As student on a results screen, open the dispute modal, capture at each viewport.

### S14 — Class roster (3 viewports)
As teacher, open class roster page, capture at each viewport.

## Scenarios beyond pure layout

### S15 — Mobile: bottom-sheet modals don't cover critical content
Trigger every modal/drawer at mobile viewport, verify CTA / answer area not occluded.

### S16 — Mobile: SessionProgressSheet drawer accessible
At mobile viewport, drawer must be reachable from a hamburger or icon — not just hover-only on desktop.

### S17 — Tablet: split-view doesn't crash anything
Simulate iPad split-view (resize window mid-session). No crashes; layout reflows.

### S18 — Desktop: extra horizontal space used wisely
At 1440px, columns expand sensibly; no centered narrow strip wasting screen real estate.

## Severity reminder

Horizontal overflow on mobile = MEDIUM. Cut-off CTAs = HIGH. Crashes = BLOCKER.
