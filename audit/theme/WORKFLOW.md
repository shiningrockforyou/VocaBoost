# Theme Audit Workflow

This workflow is intentionally sequential. Do not skip token responsibility mapping and go straight to dark-mode colors.

## Phase 0 - Setup

Create audit output folders:

```bash
mkdir -p audit/theme/reports
mkdir -p audit/theme/screenshots/light
mkdir -p audit/theme/screenshots/dark
mkdir -p audit/theme/screenshots/compare
```

Confirm deploy visibility rules:

- `audit/theme/` is for internal audit artifacts.
- `public/` is deploy-visible and must not contain audit reports.
- `src/` changes affect the app when imported.

## Phase 1 - Source Inventory

Scan the main app for color sources.

Include:

```text
src/**/*.jsx
src/**/*.js
src/**/*.css
src/**/*.svg
index.html
public/*.svg
```

Exclude:

```text
src/apBoost/**
audit/**
node_modules/**
dist/**
functions/node_modules/**
```

Record each occurrence in `reports/color-inventory.md`.

Classify each occurrence:

```text
TOKENIZED       uses app semantic token/class
RAW_TAILWIND    uses direct palette utility such as bg-blue-500
LITERAL_VALUE   uses #hex, rgb(), hsl(), named colors
INLINE_STYLE    color appears inside style={...}
SVG_LITERAL     fill/stroke uses a literal color
STATUS_MAP      color selected by status/severity state
UNKNOWN         role cannot be inferred safely
```

## Phase 2 - Semantic Role Assignment

For each color usage, assign one semantic role.

Preferred role families:

```text
app background
surface background
elevated surface
subtle surface
primary text
secondary text
muted text
disabled text
default border
strong border
focus ring
primary action
secondary action
destructive action
success status
warning status
error status
info status
selected state
hover state
input background
input border
modal backdrop
chart series
PDF/export-only
brand asset
```

If one class/token/value maps to more than one unrelated role, log a token collision.

## Phase 3 - Token Collision Report

Write:

```text
audit/theme/reports/token-collisions.md
```

For each collision:

```text
Token/class/value:
Current roles:
Files:
Why this breaks dark mode:
Recommended split:
Severity:
```

Severity:

```text
HIGH     causes unreadable UI, broken hierarchy, or status confusion
MEDIUM   causes inconsistent visual hierarchy or ugly dark-mode mapping
LOW      cosmetic or isolated
```

## Phase 4 - Token Model Proposal

Use `TOKEN_MODEL.md` to define the target semantic token set.

Rules:

- Components should consume semantic tokens, not palette primitives.
- Palette primitives may exist, but should not be used directly in component JSX.
- A token should have one job.
- Do not encode light/dark in token names.

Good:

```text
--color-bg-app
--color-bg-surface
--color-text-primary
--color-action-primary
```

Bad:

```text
--light-gray
--dark-card
--blue-button
```

## Phase 5 - Contrast Risk Report

Write:

```text
audit/theme/reports/contrast-risks.md
```

Required pairs:

```text
text-primary on bg-app
text-primary on bg-surface
text-secondary on bg-surface
text-muted on bg-surface
text-disabled on bg-disabled
button-primary-text on button-primary-bg
button-secondary-text on button-secondary-bg
button-danger-text on button-danger-bg
status-success-text on status-success-bg
status-warning-text on status-warning-bg
status-error-text on status-error-bg
input-text on input-bg
input-placeholder on input-bg
focus-ring on bg-app
focus-ring on bg-surface
link-text on bg-surface
table-text on table-row-hover
selected-text on selected-bg
```

Targets:

```text
Normal text: 4.5:1 minimum
Large text: 3:1 minimum
Important body/UI text: prefer 7:1 where practical
Focus indicators: visibly distinct from surrounding colors
```

## Phase 6 - Screenshot Matrix

Use `SCREENSHOT_MATRIX.md`.

Capture light mode first. After dark-mode token values exist, capture dark mode in the same routes and viewport sizes.

Screenshots are evidence. They should show:

```text
default state
hover/focus state where practical
empty/loading/error state
modal/dropdown state
mobile and desktop viewport
```

## Phase 7 - Findings

Write:

```text
audit/theme/findings.md
```

Use `FINDINGS_TEMPLATE.md`.

Each finding must include:

```text
severity
affected files/components
current behavior
dark-mode risk
recommended fix
verification method
```

## Phase 8 - Migration Plan

Write:

```text
audit/theme/reports/migration-plan.md
```

Order work this way:

1. Fix token collisions.
2. Introduce missing semantic tokens.
3. Replace raw color utilities in high-impact components.
4. Define light-mode token values from current visual intent.
5. Define dark-mode token values.
6. Verify contrast and screenshots.
7. Add enforcement to prevent raw color drift.

## Done Criteria

The theme audit is complete when:

- `color-inventory.md` covers every main-app color source.
- `token-collisions.md` lists every multi-role token/value.
- `TOKEN_MODEL.md` has a proposed final token set.
- `contrast-risks.md` contains all required contrast pairs.
- `findings.md` ranks fixes by user-visible risk.
- `migration-plan.md` gives an ordered implementation path.

