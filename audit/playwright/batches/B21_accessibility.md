# B21 — Accessibility (WCAG 2.1 AA)

**Priority:** P3
**Estimated duration:** 45–90 minutes
**Depends on:** B00.
**Personas:** all.

## Goal

Keyboard-only navigation works. Screen readers can complete the critical student flow. Contrast meets AA. Forms are properly labelled.

## Tools

- Playwright's `page.accessibility.snapshot()` for a11y tree.
- Manual keyboard navigation.
- Optional: axe-core integration (`@axe-core/playwright`).

## Scenarios

### S01 — Keyboard-only login

1. From / login URL, Tab through inputs.
2. Type credentials. Submit via Enter.
3. Verify focus order is logical.

### S02 — Keyboard-only dashboard

1. After login, Tab through dashboard.
2. Every CTA reachable. Visible focus indicator.

### S03 — Keyboard-only MCQ test

1. Tab to first option of Q1.
2. Space/Enter to select.
3. Tab through; complete and submit.

### S04 — Keyboard-only Typed test

1. Tab to first input. Type. Tab to next.
2. Submit via Tab to Submit + Enter.

### S05 — Screen reader audit (accessibility tree)

1. For each page in B20, snapshot `page.accessibility.snapshot()`.
2. Verify every interactive element has a `name`.
3. No unlabeled buttons / inputs.

### S06 — Form errors announced

1. Submit a form with errors.
2. Verify error messages have `role="alert"` or live-region attributes.

### S07 — Color contrast

1. Use axe-core or manual color-contrast check on each page.
2. Verify all text/background meet AA (4.5:1 for normal, 3:1 for large).

### S08 — ARIA usage

1. Modals have `role="dialog"` + `aria-modal="true"` + a label.
2. Drawers similar.
3. Tabbed interfaces use `role="tablist"`, `role="tab"`.

### S09 — Focus trap in modals

1. Open a modal. Tab through.
2. Verify focus stays within modal; doesn't escape to page behind.

### S10 — Focus restoration after modal close

1. Open a modal. Close.
2. Focus returns to the trigger button.

### S11 — Skip-to-content link

If present, verify functional. If not, MEDIUM finding for student-rollout.

### S12 — Reduced motion

1. Emulate `prefers-reduced-motion: reduce`.
2. Verify animations are minimized.

### S13 — Screen reader narration of test results

1. Take a test, reach results screen.
2. Verify a screen reader would announce "X correct of Y, Z percent" clearly.

## Severity reminder

Critical-flow keyboard inaccessibility = HIGH. Contrast failures = MEDIUM. Missing skip-link = LOW.
