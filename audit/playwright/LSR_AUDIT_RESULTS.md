# LSR Audit — Consolidated Results & Save-State (2026-07-05)

Audit of the **LIST_SCOPED_RECON Phase 1** deployment (`PLAN_list_progress_persist.md` v3.7) + the
teacher-concurrent / adversarial extension. **Flag is currently OFF in production** (this is Run-L /
flag-off territory + teacher-move mechanics). All interaction UI-only per
`docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md`; Admin SDK read-only verification + sandbox
provisioning only. Sandbox = 25WT (`lsr_*` accounts), never 26SM.

---

## 1. FINDINGS (source of truth — most severe first)

### F02 — [CONFIRMED · HIGH · known-bug §7-H3] Teacher list-ADD silently flips a mid-progress student's default list
Repro of **박시은 CS-2026-06-24b / -06-28b**, nice-to-haves #3b. Scenario **TA1** (teacher+student concurrent,
flag-off). Student had real progress on "LSR TOP Vocab" in a class; **teacher assigned a 2nd list while the
student was on the dashboard** → on reload the default focus flipped TOP → CORE (Day 1 of the new list).
UI-observed: `List: LSR TOP Vocab` → `List: LSR CORE Vocab`. **Underlying TOP progress persists (data intact)**;
only the default selection flips. Root cause: `getPrimaryFocus` (Dashboard.jsx:1037) prefers most-recently-
assigned, ignoring progress. Full block: `findings/B_LIST_PROGRESS_PHASE1_ORCH_TA1_2026-07-05.md`.

### F03 — [CONFIRMED · HIGH · known-bug nice-to-haves #1] Teacher list-UNASSIGN strands a mid-progress student
Repro of **박한별** (nice-to-haves #1/#2). Scenario **TA2**. Student mid-progress on a list; **teacher
unassigned it** (accepting the "…Student progress is saved." confirm) → student can no longer reach the list
(`stranded: true`). Progress docs persist (unassign deletes nothing) but the list is no longer offered.
Misleading confirm wording. Full block: `findings/B_LIST_PROGRESS_PHASE1_ORCH_TA2_2026-07-05.md`.

### F01 — [CONFIRMED · HIGH · NTF#5] New teacher-created classes ship WITHOUT `newWordRetakeThreshold`
All 4 LSR classes created via the live teacher UI have `newWordRetakeThreshold: MISSING` → the client gate
falls back to 0.95, so a genuine 92–94% pass DISPLAYS as fail (김나연/김호형). Live evidence the durable NTF#5
fix is still needed; every class created since 2026-07-03 is exposed. In
`findings/B_LIST_PROGRESS_PHASE1_PREP_2026-07-05.md` (F01).

### CANDIDATE-1 — [UNVERIFIED · investigate] Intermittent phantom membership on join
Scenario **TE1** precondition. Student joined a class → `enrolledClasses` got the class but the class's
`studentIds` stayed empty (student NOT a real member) → session shows **"List not assigned to this class."**
`firestore.rules:57-60` explicitly warns of this exact phantom-member race (studentCount/studentIds must be
written together). Intermittent (s17/s18 joined fine; s22 did not). **Could be a real product bug OR an
artifact of the admin reset racing the join — NOT yet isolated.** Next step if pursued: reproduce with a
fresh student + no admin reset, check whether joinClass (db.js) writes studentIds atomically.

### TE1 mechanic (not a bug) — teacher removeStudent works; removed student loses list access
`removeStudent` primitive validated; post-removal the student can't reach the list. "Progress not destroyed"
assertion pending (s22 had no progress due to CANDIDATE-1). `removeStudentFromClass` deletes no progress by
code — to be confirmed on a clean run.

---

## 2. WHAT'S BUILT (infrastructure — all reusable)

**Accounts (32):** `lsr_teacher_01`, `lsr_teacher_02`, `lsr_s01`–`lsr_s30` (pw `AuditPass2026!`). Roster:
`audit/playwright/lsr_accounts.json`. User docs byte-match signup shape.

**Lists (admin-cloned from the private 25WT2 lists, owned by lsr_teacher_01):**
`LSR TOP Vocab (audit clone)` = `EQ0Dc9rb7gvoerflHlnz` (3381 words) · `LSR CORE Vocab (audit clone)` =
`aDVcq3MoCvVYPTpb83IU` (3380). `audit/playwright/lsr_lists.json`.

**Classes (7):** persona classes `25WT LSR-A/B TYPED` (pace 80/100) + `25WT LSR-A/B MCQ` (pace 80/100), all
TOP/thr 92/tsN 30; **isolated** teacher-wave classes `25WT LSR-TCH-A/B/C` (pace 80/100/60, TOP). Join codes in
`audit/playwright/lsr_prep_state.json`.

**Student personas (Run L/S) — 13, all built** (11 fully, s04/s13 near-complete): dual-enroll, move,
same-day-join, stale-session (typed+MCQ), P-PAIR mixed history. Built through realistic interleaved timelines
(study in A → then join B mid-course). Roster mapping: `audit/playwright/lsr_personas.json` (proposed).

**Answer key:** `audit/playwright/wordmap.json` rebuilt from the lists' own definitions (careful answers =
100%). Covers the "(old English)" archaic words the stale file lacked.

**Scripts (all `audit/playwright/`):**
- `lsr_provision.mjs` / `lsr_clone_lists.mjs` — account + list provisioning (admin, pre-audit only).
- `lsr_ui.mjs` — UI-only primitives: login, join (inline ABC123 form), switchClass (FocusControl),
  skipToTest (Session-menu kebab), typed driver, **MCQ driver** (auto-advance, def-text choices,
  "Submit Test (N/M)"), studyOneDay (mode-aware), findings collector + native-dialog auto-accept.
- `lsr_teacher.mjs` — teacher primitives: assignList (`^assign list$` — NOT the "Unassign list" trash),
  unassignList (`title="Unassign list"`), editSettings (`title="Edit Settings"`), removeStudent
  (Students tab per-row `Remove`), openGradebook, createClass.
- `lsr_prep.mjs` — student persona builder (--teacher/--configure/--fixmode/--scenarios).
- `lsr_orchestrate.mjs` — multi-actor engine (teacher + N students interleaved, ‖ via Promise.all);
  per-scenario admin reset (isolated classes + students); read-only pre/post snapshots.
- `lsr_snapshot.mjs` — Run-L/S read-only pre/post + EXT assertions.
- `lsr_runL.mjs` / `lsr_runS.mjs` — the policy-doc Run L (flag-off) / Run S (flag-on) suites.

**Docs:** batch spec `batches/B_LIST_PROGRESS_PHASE1_UI.md` (CS-log traceability matrix + mandatory findings
protocol); teacher catalog `SCENARIO_CATALOG_teacher_concurrent.md` (30+ scenarios, 7 categories, P1/P2/P3).

---

## 3. VALIDATION STATUS

**Proven end-to-end:** login, join, class-switch, typed test, MCQ test, skip-to-test, day-advance
verification, teacher assignList/unassignList/removeStudent, multi-actor orchestration, per-scenario reset,
read-only snapshots.

**Teacher-wave scenarios run:** TA1 ✅ (F02), TA2 ✅ (F03), TE1 ✅ (mechanic + CANDIDATE-1). Encoded but not
yet run: TA5, TS1, TS2, TE2, MS1, AD2, XC3 (+ Waves T-2/T-3 designed only).

**Open bottleneck:** precondition study intermittently fails via CANDIDATE-1 (phantom membership →
"List not assigned"). Fix before more scenarios: harden join (verify true `studentIds` membership + retry),
or use unique fresh students without admin enrollment-reset.

---

## 4. NOT YET DONE
- **Run L (flag-off regression, policy doc §6):** scripts ready, NOT executed. This is what actually gates
  enabling the flag — the student personas for it are built.
- **Run S (flag-on):** blocked on an owner deploy of a `LIST_SCOPED_RECON=true` build + the 7 indexes Enabled.
- Teacher Waves T-2/T-3 (P2/P3): designed, not built.
- Formal triage of CANDIDATE-1; confirm TE1 progress-persist on a clean run.

---

## 5. DECISION PENDING (for David)
Direction from here: (A) grind the full teacher wave (3-5 hr, fights the precondition flakiness), (B) stop
teacher-wave at the 3 findings and finalize **Run L** (gates the flag), or (C) harden join → run the
Phase-1-core subset (TA5/TE2/XC3) → write up (~1-2 hr). See the turn where this was raised.
