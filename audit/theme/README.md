# vocaBoost Theme Audit

Systematic color, CSS, and theme-token audit for vocaBoost. This audit exists to make dark mode implementation predictable by finding inconsistent color attribution before new dark-mode values are assigned.

This is documentation and audit output only. Do not import files from this directory into app source.

## Goals

- Inventory every place color enters the app.
- Separate raw color usage from semantic token usage.
- Identify tokens doing multiple unrelated jobs.
- Define a stable semantic token model for light and dark themes.
- Verify contrast, hierarchy, focus states, disabled states, status states, and screenshots before dark mode ships.
- Prevent future raw-color drift after migration.

## Non-goals

- Do not redesign the product during the audit.
- Do not choose dark-mode colors before the current color responsibilities are mapped.
- Do not audit `src/apBoost` unless explicitly requested.
- Do not put audit artifacts in `public/`.

## Directory Layout

```text
audit/theme/
├── README.md                    # overview and reading order
├── START_HERE.md                # exact execution protocol
├── WORKFLOW.md                  # full audit phases and acceptance gates
├── TOKEN_MODEL.md               # semantic token architecture and naming rules
├── COLOR_INVENTORY_TEMPLATE.md  # inventory table template
├── FINDINGS_TEMPLATE.md         # finding format
├── SCREENSHOT_MATRIX.md         # routes/states to capture
├── DEPLOY_VISIBILITY.md         # what is and is not deployed
├── reports/                     # generated summaries, gitignored if desired
└── screenshots/                 # generated screenshots, gitignored if desired
```

## Reading Order

1. `START_HERE.md`
2. `WORKFLOW.md`
3. `TOKEN_MODEL.md`
4. `COLOR_INVENTORY_TEMPLATE.md`
5. `SCREENSHOT_MATRIX.md`
6. `FINDINGS_TEMPLATE.md`
7. `DEPLOY_VISIBILITY.md`

## Output Files

Expected outputs after the audit:

```text
audit/theme/reports/color-inventory.md
audit/theme/reports/raw-color-offenders.md
audit/theme/reports/token-collisions.md
audit/theme/reports/contrast-risks.md
audit/theme/reports/dark-mode-readiness.md
audit/theme/reports/migration-plan.md
audit/theme/findings.md
```

Screenshots should go under:

```text
audit/theme/screenshots/light/
audit/theme/screenshots/dark/
audit/theme/screenshots/compare/
```

## Deployment Rule

Only `public/` and built/imported app assets should be considered deploy-visible. Keep audit reports, screenshots, scripts, and generated data under `audit/theme/`, `scripts/`, or `tools/`, never under `public/`.

