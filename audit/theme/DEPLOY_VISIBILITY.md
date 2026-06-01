# Deploy Visibility Rules

This file defines where audit assets may live and whether they can become visible in production.

## Safe For Internal Audit Artifacts

These paths are not normally deployed by Vite/Netlify unless explicitly copied or imported:

```text
audit/theme/
audit/playwright/
scripts/
tools/
e2e/
*.md
```

Use these for:

```text
reports
screenshots
raw inventories
temporary JSON
audit scripts
notes
findings
```

## Deploy-Visible Or Bundle-Relevant Paths

These paths can affect production:

```text
public/
src/
index.html
vite.config.js
package.json
package-lock.json
```

Rules:

- Anything in `public/` is served as-is.
- Anything imported by `src/` can enter the production bundle.
- `dist/` is generated production output.
- Do not place audit reports, screenshots, raw color inventories, or private notes in `public/`.

## Theme Source Files

Actual theme implementation files should live in source, for example:

```text
src/styles/tokens.css
src/styles/theme.css
src/contexts/ThemeContext.jsx
```

Only implementation files belong in `src/`. Audit evidence belongs in `audit/theme/`.

## Recommended Git Policy

Commit:

```text
audit/theme/*.md
audit/theme/reports/*.md when useful for review
scripts/theme-audit*.mjs if created
```

Usually do not commit:

```text
audit/theme/screenshots/**/*.png
large generated JSON inventories
temporary contrast dumps
```

If screenshots are needed for review, commit only selected evidence screenshots or store them outside the repo.

