# apBoost Implementation Plans

This folder contains detailed phase-by-phase implementation plans for the apBoost feature.

## Workflow

For each phase:

1. **Read the spec** - Open `ap_boost_spec_plan.md` for context
2. **Read the phase plan** - Open the relevant `phaseX-*.md` file
3. **Implement** - Follow the steps in order, checking verification items
4. **Log changes** - Add entries to `change_action_log_ap.md`

## Phase Overview

| Phase | File | Goal | Dependencies |
|-------|------|------|--------------|
| 1 | [phase1-foundation.md](phase1-foundation.md) | Basic MCQ test-taking flow | None |
| 2 | [phase2-session-resilience.md](phase2-session-resilience.md) | Offline support, duplicate tabs | Phase 1 |
| 3 | [phase3-frq-support.md](phase3-frq-support.md) | FRQ typed mode, teacher grading | Phase 1-2 |
| 4 | [phase4-tools.md](phase4-tools.md) | Highlighter, strikethrough, line reader | Phase 1-3 |
| 5 | [phase5-teacher-flow.md](phase5-teacher-flow.md) | Test creation, class management | Phase 1-4 |
| 6 | [phase6-frq-handwritten.md](phase6-frq-handwritten.md) | Handwritten FRQ submission | Phase 1-5 |
| 7 | [phase7-analytics.md](phase7-analytics.md) | Performance dashboards, PDF exports | Phase 1-6 |

## Each Phase Plan Includes

- **Prerequisites** - What to read before starting
- **Steps** - Ordered implementation steps
- **Code samples** - Interfaces, props, function signatures
- **Verification checklist** - What to test after completing

## Key Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Spec | `/ap_boost_spec_plan.md` | Full specification with data model, UI wireframes |
| Plan | `/.claude/plans/squishy-giggling-pearl.md` | Implementation plan with detailed specs |
| Change Log | `/change_action_log_ap.md` | Track all changes |

## Starting Phase 1

```bash
# 1. Create folder structure
mkdir -p src/apBoost/{pages,components,services,hooks,utils}

# 2. Create placeholder files per phase1-foundation.md Step 1.1

# 3. Add routes (Step 1.2)

# 4. Continue with remaining steps...
```

## Notes

- **Always verify** each step before moving to the next
- **Log changes** after completing significant work
- **Don't skip phases** - each builds on the previous
- Seed test data is required for Phase 1 testing
