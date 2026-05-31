# B28 — Teacher-Side Audit (scope)

**Why:** The entire B00–B27 audit was student-facing. The teacher/enrollment surface is untested, and Codex already found 3 real bugs in it (#1 phantom enrollment, #2 challenge non-atomicity, #4 Dashboard hooks). This batch covers that blind spot.

**Env:** prod https://vocaboostone.netlify.app (vocaboost-879c2). Need a TEACHER account (seed or identify one — check users_export.json for `isTeacher`/role; audit_state.json teacher seeds `9OcxdnYCCGZYOrzfs09pUTUoDOR2` appears as teacherId on attempts). Playwright own headless chromium, fresh context per scenario, client-side SPA nav (no deep-link goto). Admin SDK READ-ONLY for verification. NO FABRICATION. NO destructive teacher actions (don't delete real classes/students; create throwaway test class if needed and clean up, or read-only inspect).

## Scenarios

### T1 — Enrollment integrity (Codex #1, HIGH)
- Student joins a class via join code. Verify ALL THREE writes land consistently: `classes/{id}/members/{uid}`, `classes/{id}.studentIds`+`studentCount`, `users/{uid}.enrolledClasses`.
- **Repro the phantom-enrollment bug:** as a normal (non-owner) student, the class `update` writing `studentIds`+`studentCount` should be REJECTED by firestore.rules:55 (`hasOnly(['studentCount'])`). Confirm whether the member doc gets created but the class update fails → student in members but not in studentIds (phantom). Capture the exact rules-rejection.
- Leave-class / re-join: state stays consistent? Orphan member docs?
- Teacher roster view: does it count phantom-enrolled students correctly?

### T2 — Challenge submit → teacher review (Codex #2, HIGH)
- Student challenges a graded-wrong answer (submitChallenge): writes to `users/{uid}.challenges.history` + `attempts/{id}.answers[]`. Simulate/observe a partial failure → inconsistent state?
- Teacher reviews/approves (reviewChallenge): multiple writes (attempt answer, study_state, class_progress day-advance) with no transaction. Check consistency.
- **Stale-day guard:** the challenge-approval path increments `currentStudyDay` (db.js:2731) guarded only by score threshold, not by expectedDay. Try to make it double-advance or advance from a stale day. Compare to the `expectedDay` guard in updateClassProgress.
- Does an approved challenge correctly flip the answer to correct, bump score, and (if it crosses the pass threshold) advance the day exactly once?

### T3 — Teacher gradebook & analytics (untested)
- Gradebook loads, filters (by class/list/name/date), pagination, per-student attempt drill-down. Korean text renders. Numbers match Firestore.
- Analytics/dashboards: do aggregates match underlying attempts? Any crash/empty-state issues.

### T4 — Teacher Dashboard hook-order (Codex #4, HIGH)
- Load the teacher Dashboard in various states (no classes, 1 class, many; mid-load) and watch the browser console for React errors / blank renders caused by the conditional useMemo/useState (Dashboard.jsx 902/989/1107/1159/1239/1287/1288). Confirm whether the hook-order violations actually manifest as runtime instability vs just lint noise.

### T5 — Teacher class/list management
- Create class, create/assign list, set assignment config (pace, studyDaysPerWeek, testMode, passThreshold). Verify writes. Edit/unassign. (Use throwaway data; clean up.)

## Outputs
- findings/findings_B28_teacher.md (scenario table + severity + repro steps), evidence under findings/evidence/B28/, logs agent_logs/B28*.jsonl+.status.json.
- Cross-reference Codex #1/#2/#4 — confirm/deny each behaviorally with concrete repro.

## Severity guide
Phantom enrollment / inconsistent challenge state / wrong gradebook numbers / day double-advance = HIGH/BLOCKER. Dashboard runtime crash = HIGH. Cosmetic = LOW.
