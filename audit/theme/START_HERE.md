# START HERE - Theme Audit

Follow this file exactly when starting a CSS, theme, or dark-mode audit.

## Scope

Audit the main vocaBoost application only:

```text
src/
public/
index.html
vite.config.js
tailwind/postcss/global CSS files if present
```

Exclude unless explicitly requested:

```text
src/apBoost/
apBoost/
audit/playwright/
audit/theme/
node_modules/
dist/
functions/node_modules/
```

## First Principle

Do not start by picking dark colors. Start by discovering what each existing color means.

A dark-mode attempt fails when a light-mode color is reused for unrelated jobs, for example:

```text
same gray = page background + disabled text + table hover + secondary button
```

Those responsibilities need separate semantic tokens before dark mode can look intentional.

## Execution Protocol

1. Create output directories:

   ```bash
   mkdir -p audit/theme/reports
   mkdir -p audit/theme/screenshots/light
   mkdir -p audit/theme/screenshots/dark
   mkdir -p audit/theme/screenshots/compare
   ```

2. Inventory color sources.

   Look for:

   ```text
   className color utilities
   CSS variables
   hardcoded hex/rgb/hsl values
   inline style colors
   SVG fill/stroke values
   component variant maps
   status color maps
   chart or PDF colors
   theme/localStorage code
   ```

3. Write the inventory to:

   ```text
   audit/theme/reports/color-inventory.md
   ```

   Use `COLOR_INVENTORY_TEMPLATE.md`.

4. Classify each usage:

   ```text
   TOKENIZED
   RAW_TAILWIND
   LITERAL_VALUE
   INLINE_STYLE
   SVG_LITERAL
   SEMANTIC_COLLISION
   UNKNOWN
   ```

5. Identify semantic collisions.

   A collision exists when one token/class/value is used for multiple unrelated jobs.

   Example:

   ```text
   bg-muted:
   - page background
   - disabled button
   - table hover
   - modal backdrop accent
   ```

6. Define or update the semantic token model using `TOKEN_MODEL.md`.

7. Run contrast checks for required foreground/background pairs.

8. Capture screenshots using `SCREENSHOT_MATRIX.md`.

9. Write findings using `FINDINGS_TEMPLATE.md`.

10. Produce a migration plan.

    The plan must order work as:

    ```text
    1. Token model cleanup
    2. Raw color migration
    3. Component variant cleanup
    4. Dark-mode token values
    5. Screenshot and contrast verification
    6. Enforcement rule
    ```

## Acceptance Gate

Dark mode is not ready to implement until all are true:

- Every recurring color usage has a documented semantic role.
- No high-impact component depends on raw Tailwind color utilities for theme-critical surfaces.
- Every token has one clear job.
- Required contrast pairs are listed and checked.
- Screenshot matrix covers student and teacher critical paths.
- The migration plan separates token cleanup from dark-mode value selection.

