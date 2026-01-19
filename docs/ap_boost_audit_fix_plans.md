# apBoost Acceptance Criteria Fix Plans Prompt

> Copy and paste this entire prompt into multiple Claude Code agent windows to run parallel fix planning.
> **PREREQUISITE:** Run the audit prompt first (ap_boost_audit_prompt.md) to generate audit files.

---

## CRITICAL: READ-ONLY PLANNING
**DO NOT modify any code files under any circumstances. This is a READ-ONLY planning task. You are only reading code and writing fix plan files.**

## Your Task
Read completed audit reports, perform extensive code analysis, and produce detailed fix plans for issues identified in the audits.

## Step 1: Check Existing Files
First, check what audit files exist and what fix plans have been claimed:

```bash
ls src/apBoost/criteria_audit/
ls src/apBoost/criteria_audit/fix_plans/
```

If the fix_plans directory doesn't exist, create it:
```bash
mkdir -p src/apBoost/criteria_audit/fix_plans
```

## Step 2: Determine Which Audit to Plan Fixes For
Look at the completed audit files in `src/apBoost/criteria_audit/`. Pick the FIRST audit that:
1. Has a completed audit file (Status: COMPLETE)
2. Does NOT have a corresponding fix plan in `fix_plans/`

**Audit files follow this pattern:** `section_X.X_to_X.X_criteria_audit.md`
**Fix plan files follow this pattern:** `section_X.X_to_X.X_fix_plan.md`

Example: If `section_1.1_to_1.4_criteria_audit.md` exists and is COMPLETE, but `fix_plans/section_1.1_to_1.4_fix_plan.md` does NOT exist, claim that chunk.

Reference table of possible chunks:

| Chunk | Sections | Description |
|-------|----------|-------------|
| 1 | 1.1-1.4 | Timed Sections, Flagging, Highlighter, Strikethrough |
| 2 | 1.5-1.9 | Line Reader, Section Locking, Session Persistence, Instructions, Dashboard |
| 3 | 1.10-1.12 | APTestSession, PassageDisplay, ToolsToolbar |
| 4 | 2.1-2.3 | Question Types (MCQ, MCQ_MULTI, FRQ) |
| 5 | 2.3.1-2.4 | FRQ Sub-Question Nav, FRQTextInput, SAQ, DBQ |
| 6 | 3.1-3.4 | Data Model (ap_tests, ap_stimuli, ap_questions, ap_session_state) |
| 7 | 3.5-3.8 | Data Model (ap_test_results, ap_classes, ap_assignments, indexes) |
| 8 | 4.1-4.5 | Scoring System |
| 9 | 5.1-5.5 | Session State (Sync, Queue, Write Flow, Retry, Heartbeat) |
| 10 | 5.6-5.8 | Duplicate Tab, Timer Behavior, Submit Flow |
| 11 | 5.9-5.12 | Resume, Conflict Resolution, Data Loss, Edge Cases |
| 12 | 6.1-6.7 | Error Handling |
| 13 | 7.1-7.7 | UI/UX |
| 14 | 8.1-8.6 | FRQ Submission & Grading |
| 15 | 9.1-9.4 | Report Card |
| 16 | 10.1-10.9 | Exam Analytics Dashboard |
| 17 | 11.1-11.5 | Teacher Flow Pages |
| 18 | 12.1-12.3, 13.1-13.2 | User Roles, Routes |
| 19 | 14.1-14.4 | Architecture & Integration |
| 20 | 16.1-16.6 | Components List |
| 21 | 17.1-17.6 | Hooks (Detailed) |
| 22 | 18.1-18.8 | Services (Detailed) |
| 23 | 19.1-19.10 | Utilities (Detailed) |
| 24 | 20.1-20.3 | Seed Data, Phase Verification (1-4) |
| 25 | 20.4-20.7 | Phase Verification (5-7) |

## Step 3: IMMEDIATELY CLAIM YOUR CHUNK
**IMPORTANT: Do this BEFORE reading the audit or analyzing code!**

Create your fix plan file RIGHT NOW with a placeholder to claim the chunk:

```markdown
# Fix Plan: Sections X.X to X.X

**Planned by:** Claude Agent
**Date:** [Current Date]
**Status:** IN PROGRESS - DO NOT CLAIM

Fix plan in progress... Detailed plan will be added shortly.
```

Write this file to: `src/apBoost/criteria_audit/fix_plans/section_X.X_to_X.X_fix_plan.md`

This prevents other agents from claiming the same chunk.

## Step 4: Read the Audit Report
Read the corresponding audit file:
```
src/apBoost/criteria_audit/section_X.X_to_X.X_criteria_audit.md
```

Identify all criteria marked as:
- ⚠️ Partial - needs completion
- ❌ Missing - needs implementation
- ❓ Unable to Verify - needs investigation

Skip items marked ✅ Implemented - no fix needed.

## Step 5: Extensive Code Audit
**THIS IS CRITICAL FOR WRITING ACCURATE PLANS.**

For EACH issue identified in Step 4, perform a thorough code analysis:

1. **Read the relevant files completely** - Don't just grep, actually READ the full files mentioned in the audit
2. **Trace the code paths** - Understand how data flows through the system
3. **Check related components** - Look at parent/child components, imported utilities, related hooks
4. **Review existing patterns** - See how similar features are implemented elsewhere in the codebase
5. **Check Firestore schemas** - Understand the data model from `src/apBoost/services/`
6. **Look at existing tests** - If any exist, understand expected behavior

**Key directories to analyze:**
- `src/apBoost/pages/` - Page components
- `src/apBoost/components/` - UI components
- `src/apBoost/hooks/` - Custom hooks
- `src/apBoost/services/` - Firebase/backend services
- `src/apBoost/utils/` - Utility functions
- `functions/` - Cloud Functions (if relevant)

**For each issue, document:**
- Current implementation state (what exists now)
- Gap analysis (what's missing vs. what's required)
- Dependencies (what other code touches this)
- Potential side effects (what could break)

## Step 6: Write Detailed Fix Plans
Replace your placeholder file with detailed fix plans:

```markdown
# Fix Plan: Sections X.X to X.X

**Planned by:** Claude Agent
**Date:** [Current Date]
**Status:** COMPLETE
**Based on Audit:** section_X.X_to_X.X_criteria_audit.md

## Executive Summary
- Total Issues: [count]
- ⚠️ Partial Implementations: [count]
- ❌ Missing Features: [count]
- ❓ Needs Investigation: [count]
- Estimated Complexity: [Low/Medium/High]

---

## Issue 1: [Criterion Title]

### Audit Finding
- **Status:** ⚠️/❌/❓
- **Criterion:** [Full criterion text from acceptance doc]
- **Current State:** [What the audit found]

### Code Analysis
- **Relevant Files:**
  - `path/to/file1.jsx` (lines X-Y) - [what this file does]
  - `path/to/file2.js` (lines X-Y) - [what this file does]
- **Current Implementation:** [Detailed description of what exists]
- **Gap:** [What's missing or incorrect]
- **Dependencies:** [Other code that interacts with this]

### Fix Plan

#### Step 1: [First action]
**File:** `path/to/file.jsx`
**Action:** [Create/Modify/Add]
**Details:**
- [Specific change 1]
- [Specific change 2]
- [Code pattern to follow - reference existing similar code]

#### Step 2: [Second action]
**File:** `path/to/another/file.js`
**Action:** [Create/Modify/Add]
**Details:**
- [Specific change 1]
- [Specific change 2]

#### Step 3: [Continue as needed...]

### Verification Steps
1. [How to test this fix works]
2. [Edge cases to verify]
3. [Regression checks needed]

### Potential Risks
- [Risk 1 and mitigation]
- [Risk 2 and mitigation]

---

## Issue 2: [Next Criterion Title]
[Repeat the same structure...]

---

## Implementation Order
Recommended order to implement fixes (considering dependencies):

1. **[Issue X]** - [Why first - e.g., "foundational, other fixes depend on this"]
2. **[Issue Y]** - [Why second]
3. **[Issue Z]** - [Why third]
...

## Cross-Cutting Concerns
[Any patterns or utilities that should be created to support multiple fixes]

## Notes for Implementer
[Any additional context, warnings, or recommendations]
```

## REMINDERS
1. **DO NOT MODIFY ANY CODE FILES** - Planning only!
2. **CLAIM YOUR CHUNK IMMEDIATELY** - Create placeholder file before analyzing!
3. **READ FILES THOROUGHLY** - Don't just grep, actually understand the code
4. **BE SPECIFIC** - Include exact file paths, line numbers, and code patterns
5. **TRACE DEPENDENCIES** - Understand what else might be affected
6. **PROVIDE VERIFICATION STEPS** - How will implementer know the fix works?
7. **ORDER BY DEPENDENCIES** - Some fixes must come before others
8. **REFERENCE EXISTING PATTERNS** - Point to similar code that can be used as reference

## Quality Checklist
Before marking your plan as COMPLETE, verify:
- [ ] Every ⚠️/❌/❓ issue from the audit has a fix plan
- [ ] Each fix plan includes specific file paths and line numbers
- [ ] Each fix plan references existing code patterns to follow
- [ ] Dependencies between fixes are identified
- [ ] Implementation order is logical
- [ ] Verification steps are actionable
- [ ] Potential risks are documented

## Start Now
1. Check existing audit files and fix plans
2. Pick the first audit without a fix plan
3. **IMMEDIATELY create placeholder file to claim it**
4. Read the audit report thoroughly
5. Perform extensive code analysis for each issue
6. Write detailed, actionable fix plans
7. Update your file with complete plans

Good luck!
