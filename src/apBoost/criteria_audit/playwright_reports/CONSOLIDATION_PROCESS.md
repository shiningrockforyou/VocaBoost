# Audit Findings Consolidation Process

> How to consolidate findings from multiple B14-style audit agents into a single actionable fix plan.

---

## When to Run

After a batch of retest/audit agents complete (e.g., B14A-H or B14A-H retests), consolidate their findings before implementing fixes. This prevents duplicate work, conflicting fixes, and ensures nothing is missed.

---

## Step-by-Step Process

### 1. Gather All Findings Files

```bash
# Find all findings for the round
ls src/apBoost/criteria_audit/playwright_reports/findings_B14*_retest*.md
```

Check for EVERY agent that was run. Agents may have suffixes like `_retest`, `_retest_v2`, etc. Don't miss any — a missed file means missed findings (this happened with B14A-retest in the first consolidation pass).

### 2. Read Every Findings File

Read each file completely. Extract:
- **Finding ID** (e.g., `FINDING-B14A-RETEST-001`)
- **Severity** (Blocker / High / Medium / Nitpick)
- **Status** (PASS / FAIL / PARTIAL / BLOCKED)
- **File(s) to fix** and solution code
- **Verification steps**

### 3. Cross-Reference Against Previous Consolidation

Compare each finding against the prior consolidated fix plan (e.g., `findings_B14_consolidated_fixes.md`):

| Category | Action |
|----------|--------|
| Finding confirms a fix is PASS | Move to "Verified Fixed" table |
| Finding says fix is FAIL / NOT IMPLEMENTED | Keep in "Fix Now" section |
| Finding says fix is PARTIAL | Note what's done vs remaining |
| New finding not in prior plan | Add as new fix item |
| Finding matches a "Deferred" item | Keep deferred unless user says otherwise |

### 4. Deduplicate Across Agents

Multiple agents often flag the same issue independently (e.g., 4 agents all hit the `scheduleFlush` TDZ error). When this happens:
- **Merge into one fix item** with all source references listed
- **Use the most detailed solution** from whichever agent provided it
- **Note the frequency** — if 4/7 agents hit it, that's important context for prioritization

### 5. Verify Current Code State

Before writing the consolidation, **read the actual source files** to check what's already applied in the working tree. Agents test against whatever code was running when they ran — if fixes were applied after their run, the finding may already be resolved.

```bash
# Check key files for fix markers
grep -n "scheduleFlush" src/apBoost/hooks/useOfflineQueue.js
grep -n "onSessionQuery" src/apBoost/hooks/useTestSession.js
# etc.
```

This step caught that 5 of 10 RFIX items were already applied in the working tree during the B14 retest consolidation.

### 6. Classify Each Fix

Assign each fix an ID (e.g., `RFIX-1`) and categorize:

- **Verified Fixed** — confirmed working by retest agents
- **Deferred** — explicitly deferred per tracker/user decision
- **Fix Now — HIGH** — data integrity, crashes, session safety
- **Fix Now — MEDIUM** — UX, accessibility, polish

### 7. Write the Consolidated Doc

Use this structure (see `findings_B14_retest_consolidated_fixes.md` for a full example):

```markdown
# B14 Retest — Consolidated Fix Plan
> Generated [date] from findings [list of source files]

## Verified Fixed (Confirmed by Retest Agents)
| Original Fix | Description | Verified By | Status |

## Deferred (Not Fixing Now)
| Finding | Description | Reason |

## FIX NOW — High Priority
### RFIX-N: [Title]
**Sources:** [finding IDs from multiple agents]
**Root Cause:** [why it happens]
**Impact:** [what breaks]
**File:** [path]
**Solution:** [code block]
**Verify:** [acceptance test steps]

## FIX NOW — Medium Priority
[same format]

## Summary Table
| ID | Priority | Description | File(s) | Source Findings |

## Recommended Implementation Order
Phase 1 — ...
Phase 2 — ...

## Key Technical Notes
[gotchas, architectural constraints, things that burned us before]
```

### 8. Implement Fixes

Apply fixes in the recommended order. After implementing:
1. **Build check** — `npx vite build`
2. **Log changes** — update `change_action_log_ap.md`
3. **Commit immediately** — do NOT leave fixes uncommitted before running agents

### 9. Update Consolidation Doc

After implementing, update the consolidation doc to mark fixes as APPLIED. This creates a paper trail.

---

## Lessons Learned

1. **Always check ALL findings files** — glob for the pattern, don't assume you know which agents ran. Missing B14A-retest cost us a round of back-and-forth.

2. **Read current source before writing the plan** — agents may have tested against stale code. 5/10 fixes in the B14 retest round were already in the working tree.

3. **Commit fixes before running audit agents** — agents that make edits (intentionally or accidentally) can overwrite uncommitted fixes. This happened with B14D-retest agent, which reverted most of our FIX-1 through FIX-15 changes.

4. **Watch for architectural constraints** — e.g., `useBlocker` doesn't work with `BrowserRouter`. Multiple agents suggested `useBlocker`; the correct approach was `popstate` + `history.pushState`. Document these constraints in "Key Technical Notes".

5. **Note agent consensus** — when 4/7 agents independently flag the same issue, that's stronger signal than 1/7. Include frequency counts.

6. **Separate "not implemented" from "implemented but broken"** — these need different responses. "Not implemented" means apply the fix. "Implemented but broken" means debug the fix.
