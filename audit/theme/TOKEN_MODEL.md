# Semantic Token Model

This file defines the target architecture for theme colors. The purpose is to make light mode and dark mode map to the same semantic roles.

## Core Rule

Components should not ask for a color. Components should ask for a job.

Good:

```text
text-text-primary
bg-surface
border-border-default
bg-action-primary
```

Bad:

```text
text-gray-700
bg-blue-500
border-slate-200
```

## Token Layers

Use two conceptual layers.

### 1. Palette primitives

Palette primitives are raw colors. They are allowed inside theme definition files only.

Example:

```css
--palette-blue-600: #2563eb;
--palette-gray-950: #111827;
```

### 2. Semantic tokens

Semantic tokens are what components consume.

Example:

```css
--color-bg-app: var(--palette-gray-50);
--color-bg-surface: #ffffff;
--color-text-primary: var(--palette-gray-950);
--color-action-primary: var(--palette-blue-600);
```

## Required Token Families

### Background

```text
--color-bg-app
--color-bg-surface
--color-bg-elevated
--color-bg-subtle
--color-bg-inset
--color-bg-disabled
--color-bg-overlay
```

### Text

```text
--color-text-primary
--color-text-secondary
--color-text-muted
--color-text-disabled
--color-text-inverse
--color-text-link
```

### Border And Ring

```text
--color-border-default
--color-border-muted
--color-border-strong
--color-border-focus
--color-ring-focus
```

### Action

```text
--color-action-primary
--color-action-primary-hover
--color-action-primary-active
--color-action-primary-text
--color-action-secondary
--color-action-secondary-hover
--color-action-secondary-text
--color-action-danger
--color-action-danger-hover
--color-action-danger-text
```

### Status

```text
--color-status-success-bg
--color-status-success-border
--color-status-success-text
--color-status-warning-bg
--color-status-warning-border
--color-status-warning-text
--color-status-error-bg
--color-status-error-border
--color-status-error-text
--color-status-info-bg
--color-status-info-border
--color-status-info-text
```

### Form

```text
--color-input-bg
--color-input-border
--color-input-border-hover
--color-input-border-focus
--color-input-text
--color-input-placeholder
--color-input-disabled-bg
--color-input-disabled-text
```

### Navigation And Selection

```text
--color-nav-bg
--color-nav-text
--color-nav-text-active
--color-nav-hover-bg
--color-selected-bg
--color-selected-text
--color-selected-border
```

### Tables And Lists

```text
--color-row-bg
--color-row-hover-bg
--color-row-selected-bg
--color-row-border
--color-table-header-bg
--color-table-header-text
```

### Charts And Progress

Chart tokens may be semantic or ordered series tokens.

```text
--color-chart-series-1
--color-chart-series-2
--color-chart-series-3
--color-chart-series-4
--color-progress-track
--color-progress-fill
```

## Naming Rules

- Use role names, not color names.
- Do not include `light` or `dark` in semantic token names.
- Do not use one token for text and background.
- Do not use one token for disabled and muted.
- Do not use status colors for decoration.
- Do not use action colors for passive information.

## Collision Examples

Bad:

```text
--color-muted
Roles:
- muted text
- page background
- disabled button
- table hover
```

Split into:

```text
--color-text-muted
--color-bg-subtle
--color-bg-disabled
--color-row-hover-bg
```

Bad:

```text
--color-primary
Roles:
- brand text
- submit button
- selected tab
- focus ring
```

Split into:

```text
--color-brand
--color-action-primary
--color-selected-bg
--color-ring-focus
```

## Dark Mode Readiness Criteria

A token is ready for dark mode when:

- Its role is unambiguous.
- Its foreground/background pair is known.
- It has hover, active, disabled, and focus states if interactive.
- It is not used for unrelated visual jobs.
- It is represented in screenshots or contrast checks.

