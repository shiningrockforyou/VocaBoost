# B20 — Responsive Viewports

**Priority:** P3
**Estimated duration:** 30–60 minutes
**Depends on:** B00.
**Personas:** all.

## Goal

Layout works on the three primary viewports.

## Viewports

- **Mobile:** 375 × 812 (iPhone 13).
- **Tablet:** 768 × 1024 (iPad).
- **Desktop:** 1440 × 900.

## Scenarios

For each of these pages, screenshot at all three viewports and verify:
- Nothing horizontally overflows.
- Tappable targets ≥ 44px on mobile.
- Text not truncated to unreadability.
- Critical CTAs (Submit, Start) always visible without scroll.

### Pages

S01 — Landing / Login
S02 — Signup
S03 — Student Dashboard
S04 — Teacher Dashboard
S05 — Daily Session — NEW_WORDS card
S06 — Daily Session — REVIEW_STUDY card
S07 — MCQ Test
S08 — Typed Test
S09 — Blind Spot Test
S10 — Test Results screen
S11 — List Editor
S12 — Gradebook
S13 — Challenge dispute modal
S14 — Class roster

### Scenarios beyond pure layout

S15 — Mobile: Bottom-sheet modals don't cover critical content.
S16 — Mobile: SessionProgressSheet drawer accessible from a hamburger or icon.
S17 — Tablet: split-view doesn't crash anything.
S18 — Desktop: extra horizontal space used wisely (multi-column where applicable).

## Severity reminder

Horizontal overflow on mobile = MEDIUM. Cut-off CTAs = HIGH. Crashes = BLOCKER.
