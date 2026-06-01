# Color Inventory Template

Copy this file to:

```text
audit/theme/reports/color-inventory.md
```

## Summary

```text
Audit date:
Auditor:
Scope:
Excluded paths:
Total color usages:
Tokenized usages:
Raw Tailwind usages:
Literal CSS values:
Inline style values:
SVG literal values:
Unknown role count:
```

## Classification Key

```text
TOKENIZED
RAW_TAILWIND
LITERAL_VALUE
INLINE_STYLE
SVG_LITERAL
STATUS_MAP
UNKNOWN
```

## Inventory Table

| ID | File | Line | Usage | Classification | Current Role | Recommended Token | Notes |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| C001 | `src/...` | 1 | `bg-surface` | TOKENIZED | surface background | `--color-bg-surface` | OK |
| C002 | `src/...` | 1 | `text-gray-500` | RAW_TAILWIND | muted helper text | `--color-text-muted` | migrate |

## Raw Tailwind Offenders

| Class | Count | Files | Current Roles | Recommended Action |
| --- | ---: | --- | --- | --- |
| `text-gray-500` | 0 | - | - | - |

## Literal Value Offenders

| Value | Count | Files | Current Roles | Recommended Action |
| --- | ---: | --- | --- | --- |
| `#000000` | 0 | - | - | - |

## Semantic Collisions

| Token/Class/Value | Current Roles | Risk | Recommended Split |
| --- | --- | --- | --- |
| `bg-muted` | page bg, disabled bg, hover bg | MEDIUM | `bg-app`, `bg-disabled`, `row-hover-bg` |

## Unknowns

List any usages whose role cannot be safely inferred from static code alone.

| ID | File | Line | Usage | Why Unknown | How To Resolve |
| --- | --- | ---: | --- | --- | --- |

