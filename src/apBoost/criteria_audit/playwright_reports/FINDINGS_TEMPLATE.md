# Batch [BX] Findings: [Batch Name]

**Agent:** Sonnet 4.6
**Date:** [date]
**Status:** [COMPLETE / PARTIAL / BLOCKED]
**Scenarios Covered:** [S-XX, S-XX, ...]

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** [viewports tested]
- **Auth:** [account type used]

---

## Scenario Results

### [S-XX]: [Scenario Name]
- **Status:** PASS / FAIL / PARTIAL / SKIP
- **Evidence:** [screenshot description or DOM observation]
- **Notes:** [any observations]

[Repeat for each scenario]

---

## Findings

### Blockers
> Issues that break core functionality. Must fix before release.

#### [FINDING-BX-001]: [Short title]
- **Severity:** Blocker
- **Scenario:** [S-XX]
- **Criteria Reference:** [section X.X from criteria audit]
- **What Happened:** [exact description of what went wrong]
- **Expected:** [what should have happened per acceptance criteria]
- **Screenshot/Evidence:** [description]
- **File(s) to Fix:** [exact file paths]
- **How to Fix:** [specific, actionable fix instructions]
- **Acceptance Test:** [how to verify the fix works]

---

### High-Priority
> Significant issues that violate acceptance criteria.

#### [FINDING-BX-002]: [Short title]
- **Severity:** High-Priority
- **Scenario:** [S-XX]
- **Criteria Reference:** [section X.X]
- **What Happened:** [description]
- **Expected:** [description]
- **File(s) to Fix:** [paths]
- **How to Fix:** [instructions]
- **Acceptance Test:** [verification]

---

### Medium-Priority
> Polish issues, partial implementations, or P3 criteria gaps.

#### [FINDING-BX-003]: [Short title]
- **Severity:** Medium-Priority
- **Scenario:** [S-XX]
- **Criteria Reference:** [section X.X]
- **What Happened:** [description]
- **Expected:** [description]
- **Suggested Fix:** [instructions]

---

### Nitpicks
> Minor aesthetic or UX observations.

- **Nit:** [description]

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| [route] | [message] | [error/warning] |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | X |
| PASS | X |
| FAIL | X |
| PARTIAL | X |
| SKIP | X |
| Blockers Found | X |
| High-Priority Found | X |
| Medium-Priority Found | X |
| Nitpicks | X |
