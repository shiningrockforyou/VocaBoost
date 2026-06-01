# Theme Audit Findings

Copy this file to:

```text
audit/theme/findings.md
```

## Summary

```text
Audit date:
Scope:
Build checked:
Lint checked:
Screenshots checked:
Contrast checked:
Overall dark-mode readiness:
```

Readiness values:

```text
READY
READY_WITH_MINOR_FIXES
NOT_READY_TOKEN_COLLISIONS
NOT_READY_CONTRAST_RISKS
NOT_READY_RAW_COLOR_DRIFT
```

## Findings

### F01 - Finding Title

**Severity:** HIGH | MEDIUM | LOW

**Category:** token collision | raw color | contrast | component variant | screenshot | accessibility | deployment | process

**Affected files/components:**

```text
src/...
```

**Current behavior:**

Describe what the code currently does.

**Why this matters for dark mode:**

Explain how this causes unreadable UI, weak hierarchy, inconsistent status meaning, or ugly color mapping.

**Recommended fix:**

Describe the semantic-token or component-variant change.

**Verification:**

```text
contrast pair:
screenshot route:
viewport:
expected result:
```

## Open Questions

| Question | Owner | Needed Before Implementation? |
| --- | --- | --- |
| - | - | - |

## Migration Priorities

1. HIGH findings that affect readability or user action.
2. Semantic token collisions.
3. Raw colors in shared components.
4. Raw colors in page-only components.
5. Cosmetic cleanup.

