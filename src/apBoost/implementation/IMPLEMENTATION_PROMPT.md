# apBoost Implementation Prompt

> **Copy this prompt to start a new Claude Code session for implementation.**

---

## Prompt

```
I need you to implement the apBoost feature for this project. Follow this process exactly:

## Step 1: Read and Understand

First, read these files in order:
1. `src/apBoost/implementation/README.md` - Overview and workflow
2. `ap_boost_spec_plan.md` - Full specification (data model, UI, session management)
3. `src/apBoost/implementation/phase1-foundation.md` - Phase 1 detailed plan

## Step 2: Create Comprehensive Todo List

Based on the phase file, create an EXTENSIVE todo list using TodoWrite. Break down EVERY step into granular, actionable items. For Phase 1, your todo list should include items like:

- Create folder structure (src/apBoost/pages, components, services, hooks, utils)
- Create routes.jsx with route definitions
- Create index.js with exports
- Integrate routes into main App.jsx
- Create APHeader.jsx component
- Create APDashboard.jsx page
- Create TestCard.jsx subcomponent
- Create apTestService.js with getAvailableTests function
- Create apTestService.js with getTestWithQuestions function
- ... (continue for ALL items in the phase file)

Each todo should be specific enough that completing it is unambiguous.

## Step 3: Implement Each Step

For EACH todo item:
1. Mark it as `in_progress`
2. Read any referenced files or existing code patterns in the codebase
3. Implement the feature following the spec exactly
4. Verify it works (check for errors, test if possible)
5. Mark it as `completed`
6. Move to the next item

IMPORTANT: Only have ONE todo in_progress at a time. Complete it fully before starting the next.

## Step 4: Phase Verification

After completing ALL todos for a phase:
1. Go through the "Verification Checklist" at the bottom of the phase file
2. Test each checkbox item manually or by running code
3. If any fail, create new todos to fix them
4. Only proceed to next phase when ALL verifications pass

## Step 5: Move to Next Phase

Once Phase 1 is verified:
1. Read the next phase file (e.g., phase2-session-resilience.md)
2. Create a NEW todo list for that phase
3. Repeat Steps 3-4

Continue until all phases are complete.

## Rules

1. **Always log changes** - After completing significant work, add entries to `change_action_log_ap.md`
2. **Follow the spec exactly** - Refer to `ap_boost_spec_plan.md` for UI wireframes, data structures, behavior
3. **Use existing patterns** - Look at how the existing vocaBoost code handles similar things (auth, Firestore, etc.)
4. **Don't skip steps** - Each phase builds on the previous
5. **Test as you go** - Don't wait until the end to find issues
6. **Keep todos updated** - The todo list should always reflect current progress

## File References

| Document | Path | Purpose |
|----------|------|---------|
| Spec | `ap_boost_spec_plan.md` | Full specification |
| Phase 1 | `src/apBoost/implementation/phase1-foundation.md` | MCQ test-taking |
| Phase 2 | `src/apBoost/implementation/phase2-session-resilience.md` | Offline/resilience |
| Phase 3 | `src/apBoost/implementation/phase3-frq-support.md` | FRQ support |
| Phase 4 | `src/apBoost/implementation/phase4-tools.md` | Annotation tools |
| Phase 5 | `src/apBoost/implementation/phase5-teacher-flow.md` | Teacher features |
| Phase 6 | `src/apBoost/implementation/phase6-frq-handwritten.md` | Handwritten FRQ |
| Phase 7 | `src/apBoost/implementation/phase7-analytics.md` | Analytics dashboard |
| Change Log | `change_action_log_ap.md` | Track all changes |

## Start Now

Begin by reading the README, then the spec, then Phase 1. Create your initial todo list and start implementing. Ask me if you have any questions about requirements.
```

---

## Alternative: Single-Phase Prompt

If you want to run one phase at a time:

```
Implement Phase [X] of apBoost.

1. Read `src/apBoost/implementation/README.md`
2. Read `ap_boost_spec_plan.md` (sections relevant to this phase)
3. Read `src/apBoost/implementation/phase[X]-[name].md`

Create a comprehensive todo list from the phase file, then implement each step:
- Mark todo as in_progress
- Implement
- Verify
- Mark as completed
- Move to next

After all todos complete, run through the Verification Checklist at the bottom of the phase file. Fix any issues. Log changes to `change_action_log_ap.md`.
```

---

## Tips for Best Results

### Starting a Fresh Session
If context gets long, start a new session with:
```
Continue implementing apBoost. I completed Phase [X].
Read the phase files to see what's done, then continue with Phase [X+1].
Check `change_action_log_ap.md` for recent changes.
```

### If Claude Gets Stuck
```
Read `src/apBoost/implementation/phase[X]-[name].md` again.
Look at the current step [Y]. What specific code needs to be written?
Check the spec file for the exact requirements.
```

### Verifying Progress
```
Read through all phase files (1-7) and compare to the actual code in src/apBoost/.
Create a todo list of anything that's missing or incomplete.
Then implement those items.
```

---

## Phase Dependencies

```
Phase 1: Foundation (MVP)
    ↓
Phase 2: Session Resilience
    ↓
Phase 3: FRQ Support
    ↓
Phase 4: Tools
    ↓
Phase 5: Teacher Flow
    ↓
Phase 6: FRQ Handwritten
    ↓
Phase 7: Analytics
```

Each phase assumes the previous phases are complete and working.
