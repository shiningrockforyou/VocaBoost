# apBoost Acceptance Criteria Audit Prompt

> Copy and paste this entire prompt into multiple Claude Code agent windows to run parallel audits.

---

## CRITICAL: READ-ONLY AUDIT
**DO NOT modify any code files under any circumstances. This is a READ-ONLY audit. You are only reading code and writing audit report files.**

## Your Task
Audit the apBoost codebase against the acceptance criteria document and produce a detailed audit report.

## Step 1: Check Existing Audit Files
First, check what audit files already exist:
```
ls src/apBoost/criteria_audit/
```

If the directory doesn't exist, create it:
```
mkdir -p src/apBoost/criteria_audit
```

## Step 2: Determine Which Section to Audit
Based on existing files, pick the FIRST unclaimed section chunk from this list:

| Chunk | Sections | Description | Priority |
|-------|----------|-------------|----------|
| 1 | 1.1-1.4 | Timed Sections, Flagging, Highlighter, Strikethrough | High |
| 2 | 1.5-1.9 | Line Reader, Section Locking, Session Persistence, Instructions, Dashboard | High |
| 3 | 1.10-1.12 | APTestSession, PassageDisplay, ToolsToolbar | High |
| 4 | 2.1-2.3 | Question Types (MCQ, MCQ_MULTI, FRQ) | High |
| 5 | 2.3.1-2.4 | FRQ Sub-Question Nav, FRQTextInput, SAQ, DBQ | High |
| 6 | 3.1-3.4 | Data Model (ap_tests, ap_stimuli, ap_questions, ap_session_state) | Medium |
| 7 | 3.5-3.8 | Data Model (ap_test_results, ap_classes, ap_assignments, indexes) | Medium |
| 8 | 4.1-4.5 | Scoring System | Medium |
| 9 | 5.1-5.5 | Session State (Sync, Queue, Write Flow, Retry, Heartbeat) | High |
| 10 | 5.6-5.8 | Duplicate Tab, Timer Behavior, Submit Flow | High |
| 11 | 5.9-5.12 | Resume, Conflict Resolution, Data Loss, Edge Cases | High |
| 12 | 6.1-6.7 | Error Handling | Medium |
| 13 | 7.1-7.7 | UI/UX | Medium |
| 14 | 8.1-8.6 | FRQ Submission & Grading | High |
| 15 | 9.1-9.4 | Report Card | Medium |
| 16 | 10.1-10.9 | Exam Analytics Dashboard | Medium |
| 17 | 11.1-11.5 | Teacher Flow Pages | Medium |
| 18 | 12.1-12.3, 13.1-13.2 | User Roles, Routes | Low |
| 19 | 14.1-14.4 | Architecture & Integration | Low |
| 20 | 16.1-16.6 | Components List | Low |
| 21 | 17.1-17.6 | Hooks (Detailed) | High |
| 22 | 18.1-18.8 | Services (Detailed) | Medium |
| 23 | 19.1-19.10 | Utilities (Detailed) | Medium |
| 24 | 20.1-20.3 | Seed Data, Phase Verification (1-4) | Low |
| 25 | 20.4-20.7 | Phase Verification (5-7) | Low |

**File naming convention:** `section_X.X_to_X.X_criteria_audit.md`
Example: `section_1.1_to_1.4_criteria_audit.md`

If a file like `section_1.1_to_1.4_criteria_audit.md` exists, that chunk is CLAIMED. Move to the next unclaimed chunk.

## Step 3: IMMEDIATELY CLAIM YOUR CHUNK
**IMPORTANT: Do this BEFORE reading criteria or auditing code!**

Create your audit file RIGHT NOW with a placeholder to claim the chunk:

```markdown
# Acceptance Criteria Audit: Sections X.X to X.X

**Audited by:** Claude Agent
**Date:** [Current Date]
**Status:** IN PROGRESS - DO NOT CLAIM

Audit in progress... Results will be added shortly.
```

Write this file to: `src/apBoost/criteria_audit/section_X.X_to_X.X_criteria_audit.md`

This prevents other agents from claiming the same chunk.

## Step 4: Read the Acceptance Criteria
Now read the acceptance criteria document:
```
docs/ap_boost_acceptance_criteria.md
```

Extract ONLY the criteria for your assigned section chunk.

## Step 5: Audit the Codebase
For each criterion in your section:
1. Search the codebase in `src/apBoost/` for relevant implementations
2. Check if the criterion is: ✅ Implemented, ⚠️ Partial, ❌ Missing, or ❓ Unable to verify
3. Note the specific file(s) and line numbers where you found evidence
4. Add notes about any issues or discrepancies

**Key directories to search:**
- `src/apBoost/pages/` - Page components
- `src/apBoost/components/` - UI components
- `src/apBoost/hooks/` - Custom hooks
- `src/apBoost/services/` - Firebase/backend services
- `src/apBoost/utils/` - Utility functions

## Step 6: Update the Audit Report
Replace your placeholder file with the full audit results:

```markdown
# Acceptance Criteria Audit: Sections X.X to X.X

**Audited by:** Claude Agent
**Date:** [Current Date]
**Status:** COMPLETE

## Summary
- Total Criteria: [count]
- ✅ Implemented: [count]
- ⚠️ Partial: [count]
- ❌ Missing: [count]
- ❓ Unable to Verify: [count]

---

## Section X.X: [Section Title]

### Criterion: [Criterion text from acceptance doc]
- **Status:** ✅/⚠️/❌/❓
- **Evidence:** [File path and line numbers]
- **Notes:** [Any relevant observations]

### Criterion: [Next criterion...]
...

---

## Recommendations
[List any patterns of missing features or suggested improvements]
```

## REMINDERS
1. **DO NOT MODIFY ANY CODE FILES** - Read only!
2. **CLAIM YOUR CHUNK IMMEDIATELY** - Create placeholder file before auditing!
3. Be thorough - check multiple files for each criterion
4. Use grep/search to find relevant code
5. Include specific line numbers in your evidence
6. If a feature seems partially implemented, mark it ⚠️ and explain what's missing
7. If you can't find evidence either way, mark it ❓

## Start Now
1. Check existing audit files
2. Pick the next unclaimed chunk
3. **IMMEDIATELY create placeholder file to claim it**
4. Read the criteria for that chunk
5. Audit the codebase
6. Update your report with full results

Good luck!
