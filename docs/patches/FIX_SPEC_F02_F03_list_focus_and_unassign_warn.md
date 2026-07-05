# Fix Spec — F02 (getPrimaryFocus flip) + F03 (unassign warn)

Two independent, low-risk client-only fixes for recurring CS-ticket causes, surfaced + reproduced by the
LSR UI audit (2026-07-05). No backend, no rules, no data migration. Owner deploys client build.
Related: `NEED_TO_FIX.md` (getPrimaryFocus §7-H3), `scripts/cs/nice-to-haves.md` #1/#2/#3b.

---

## FIX 1 (F02) — Default-list fallback must prefer the list the student has progress on

### Goal
Adding a new list to a class (or any teacher assignment change) must **not** silently move a student who is
mid-progress on their current list onto a different (often newer/harder) list. The dashboard default should
stay on the list the student is actually studying until they explicitly pick another.

### Nature of the bug (root cause, code-grounded)
`getPrimaryFocus` (`src/pages/Dashboard.jsx`, useMemo ~L1006-1061) resolves the default (class, list) focus.
When the student has no saved `primaryFocusListId` (the common case — most students never explicitly pick),
it falls to **section 2** (L1037-1058): "most-recently-assigned list wins" (max `assignedAt`), **ignoring
which list the student has progress on**. So when a teacher assigns a newer list, its newer `assignedAt`
wins and the student is flipped to Day 1 of the new list. Reproduced live in audit scenario TA1
(focus went `List: LSR TOP Vocab` → `List: LSR CORE Vocab` the moment a 2nd list was assigned). The 3rd
CS cluster (박시은 CS-2026-06-24b/-06-28b) is this exact path.

### Scope of change
- **Primary:** `getPrimaryFocus` fallback, `src/pages/Dashboard.jsx` §2 (L1037-1058).
- **Secondary (for consistency on class-switch):** `pickPrimaryList` (L1083-1096) — same preference so
  switching INTO a class also lands on the progress-bearing list, not newest-assigned.
- **Progress fetch (L648-658):** record per-key load **status** (ok/error), not just data — see the
  readiness contract below. This is part of the change, not just `getPrimaryFocus`.
- Add `progressData` (+ the new status) to `getPrimaryFocus`'s dependency array (already in-scope state,
  keyed `${classId}_${listId}`, value carries `currentStudyDay`/`lastSessionAt`).

### Exact change
In the section-2 fallback, **before** the most-recently-assigned logic, pass 1: among all assigned lists
across the student's classes, select the one the student has **active progress** on
(`progressData[`${klass.id}_${list.id}`]?.currentStudyDay > 0`). If one or more qualify, rank them by
**[Codex-2 correction — recency, not depth; "highest day" lets an abandoned Day-50 list beat an actively
studied Day-5 list]:**
1. most recent `lastSessionAt` (fallback `updatedAt`) — DESC  ← "currently studying"
2. `currentStudyDay` — DESC
3. `assignedAt` — DESC
4. stable `${classId}_${listId}` — ASC (deterministic tie-break)

**[Codex round-3 — impl note] Normalize every timestamp to milliseconds before comparing** — these fields
arrive as Firestore `Timestamp` | `Date` | `null` (the codebase already uses the
`x?.toDate?.() ?? x` idiom). Convert to a number (`ts?.toMillis?.() ?? (ts instanceof Date ? ts.getTime() :
0)`) so the comparator never compares a `Timestamp` against a `Date` (NaN/unstable ordering). Treat missing
timestamps as `0` (oldest).

Only if **no** assigned list has progress, fall through to the **existing** most-recently-assigned logic
(unchanged) so brand-new students still get a sensible default.

`pickPrimaryList(klass)`: same ranking, restricted to that class's lists (needs `progressData` in scope),
else the current newest-assigned/first behavior.

### [Codex-1 correction — HIGH] Readiness contract: distinguish ERROR from "no doc", and gate on success
`progressDataLoading` is set **inside an effect** (`Dashboard.jsx:645`), so there is a render window where
classes have loaded but progress has not, during which `getPrimaryFocus` runs with **empty** `progressData`
and picks the newest list.

**[Codex round-2 — the load-bearing gap] The current fetch collapses two different outcomes to the same
value:** `Dashboard.jsx:652` returns `progress: null` for "loaded, no doc" and **`:655` returns
`progress: null` for a FAILED query too.** So a `progressReady` defined as "every key has an entry
(value-or-null)" goes **true even after a failed progress query** — and then the fallback can still select
the newly-assigned list, i.e. the exact failure F02 exists to prevent (a student whose progress query
transiently failed gets flipped). A value/null check is insufficient; readiness must be **success-based**.

Required:
- **Change the fetch (`Dashboard.jsx:648-658`) to record per-key STATUS separate from data:** return
  `{ key, progress, status: 'ok' }` on success (`progress` = doc **or** null) and `{ key, progress: null,
  status: 'error' }` in the catch. **[Codex round-3 — impl note] Store ONE atomic map keyed by the composite
  key, each entry `{ status: 'ok'|'error', data }` — a single state, one `setState`.** Do NOT keep `status`
  and `data` in separate React states; they can briefly diverge across renders and re-open the readiness
  window. Consumers reading `progressData[key].data` must be updated in the same change.
- **`progressReady` (synchronous useMemo over `studentClasses` + status) is true iff EVERY expected
  `${classId}_${listId}` key** (from `studentClasses[].assignedListDetails`) **loaded with `status:'ok'`.** A
  key still pending, or with `status:'error'`, ⇒ not ready.
- **On any `error` key:** show a retry/error state; do **NOT** auto-select a focus, expose the focus controls,
  or allow a session to start from a provisional focus. (Fail closed — never guess the focus off incomplete
  data.)
- **Gate on `progressReady`:** the progress-preferring auto-selection AND the render of the focus controls /
  hero list value / any "Start" affordance. Until ready, show the loading skeleton.

This eliminates the Day-1 flicker, the transient-error mis-selection, and any user action on a provisional
list. The memo-dependency + value/null check alone does none of it.

### Explicit non-goals / invariants
- Do **not** change the saved-preference path (§1, L1011-1035) — an explicit `primaryFocusListId` still wins.
- Multiple progress-bearing lists → most-recently-active (ranking above), never a no-progress list.
- New student, zero progress anywhere → behavior byte-identical to today (newest-assigned).

### Risk
Low-medium. Client-only, additive branch with the old path preserved. The load-bearing details: (a) the
success-based `progressReady` gate (error ≠ no-doc), and (b) gating render + session-start on it.
**[Codex round-2 wording correction]** The fallback focus is NOT auto-persisted on load — `getPrimaryFocus`
is a read-only useMemo; focus is persisted only by explicit user actions (`handleClassSelection` /
`handleListSelection`). So the risk is not "auto-save the wrong list" but: the wrong list **renders** and the
student **acts on it** (starts a session on it), or a subsequent **class selection persists** the
provisional resolution. The gate therefore blocks **render + session-start** until `progressReady`; it need
not intercept an auto-persist that doesn't exist.

### Acceptance (matches the audit repro)
Student with Day-N progress on list L in class C → teacher assigns a 2nd list M to C → on reload the default
focus **stays List L** (not M). New student with no progress → still defaults to newest-assigned. Verify no
Day-1 flicker before `progressData` resolves.

---

## FIX 2 (F03) — Honest unassign warning (WARN, do NOT block)

### Goal
A teacher unassigning a list that students are mid-progress on should make an **informed** decision. Today's
confirm is misleadingly reassuring, so teachers strand students without realizing. **Warn clearly; still
allow the action** (per David: warn-only, never block — unassign is a legitimate operation).

### Nature of the bug
`handleUnassignList` (`src/pages/ClassDetail.jsx` ~L387) shows:
`window.confirm('Remove this list from the class? Student progress is saved.')`. Technically true (progress
docs aren't deleted — audit confirmed) but **misleading**: unassigning makes the list **unreachable** for any
student mid-progress (the selector no longer offers it → they land on Day 1 of what's left). Reproduced live
as audit F03 (박한별, nice-to-haves #1): student stranded, list unreachable, progress intact-but-hidden.

### Scope of change
- `handleUnassignList`, `src/pages/ClassDetail.jsx` (~L387-401) — the confirm string only. Optionally a
  small count computed from **already-loaded** `studentProgressMap` (state at L144, populated L198-199 via
  `fetchStudentsProgressForClass`; per-student per-list `currentStudyDay` available).

### Exact change
Replace the confirm text with an honest warning. **[Codex-3 correction — do NOT claim finished students are
unaffected; they lose access too, just with less to lose]:**
> "Remove this list? Any student who has this list in their study plan will **lose access** to it until it's
> re-assigned. Their progress is preserved but hidden."

**Count: OMIT it (recommended).** [Codex-3] `currentStudyDay > 0` also counts finished students, the count
can render while `studentProgressMap` is still loading, and an uncertain/zero count is misleading. The honest
sentence alone meets the goal; a count adds loading-race + definition ambiguity to what should be a one-string
fix. **If a count is still wanted**, it must: (a) render only after `studentProgressMap` has fully loaded for
the class, (b) define "mid-progress" as `0 < totalWordsIntroduced < listWordCount` (position vs. list size,
not `csd>0`), and (c) never display an uncertain or zero count (hide the clause when N is 0 or unknown).
Keep it a single confirm with proceed/cancel — **no blocking, no gate.**

### Explicit non-goals
- Do **not** block or disable unassign (David: warn-only). Do **not** change `unassignListFromClass` — it
  correctly deletes no progress.
- Reachability after re-add is already restored; the default-selection side is Fix 1's domain.

### Risk
Trivial. One string (+ optional count from in-memory state). No logic/flow change.

### Acceptance
Unassigning a list with mid-progress students shows the honest warning (and optional count); proceeding still
works exactly as before; cancel aborts.

---

## Notes for the reviewer
- Fixes are independent — ship either/both. Fix 1 is the higher-value (prevents the silent flip that
  generated the most tickets); Fix 2 is near-zero-risk teacher UX.
- Both were de-scoped from LIST_SCOPED_RECON Phase 1 (§7-H3) and tracked in `scripts/cs/nice-to-haves.md`
  #1/#2/#3b; the audit is the live UI evidence they still reproduce.
- Suggested log targets on implementation: `change_action_log.md`; move the nice-to-haves items to Done.

---

## Codex round-1 corrections folded in (2026-07-05)
- **F02 readiness contract [HIGH]:** added a synchronous `progressReady` gate covering auto-selection,
  **persistence**, and focus-control render — a memo dependency alone leaves a render/persist window where the
  wrong list is chosen and can be saved. (This raises F02 from "low" to "low-medium" risk.)
- **F02 ranking [MED]:** rank progress-bearing lists by `lastSessionAt` (recency = "currently studying")
  before `currentStudyDay`, then `assignedAt`, then stable id — not "highest day" (an abandoned deep list
  must not win).
- **F03 count [LOW]:** OMIT the count (recommended) to avoid the load-race + `csd>0`-includes-finished
  ambiguity; if kept, gate on full load + define by position-vs-size + never show an uncertain/zero. Removed
  the false "already finished are unaffected" clause.

## Audit policy-compliance caveat (Codex, accepted)
The **findings F02/F03 are UI-observed and credible** — the bug-triggering teacher assign/unassign actions
and their student-visible outcomes all happened through the real UI. However, the audit's **setup** used
Admin SDK **mutation** beyond the strict read-only policy: account creation + list cloning (a David-authorized
deviation) AND class creation + per-scenario config/student resets (harness extension). Therefore the
campaign should **not** be labeled "fully policy-compliant."

**[Codex round-2] Remediation, aligned to the strict policy:** for future runs Admin SDK is **read-only,
period** — no account/class/persona creation and no resets via Admin. All personas and classes are either
**created through the UI** (teacher signup + class creation + student signup/join) or **already exist and are
verified read-only** before the audit begins. (Account-creation-via-Admin was a David-authorized shortcut for
this run; the policy-clean path is UI signup, accepting it is slower.) Documented in
`audit/playwright/LSR_AUDIT_RESULTS.md`.

## Codex round-2 corrections folded in (2026-07-05)
- **F02 readiness [HIGH blocker]:** the progress fetch (`Dashboard.jsx:652` vs `:655`) collapses "no doc" and
  "query FAILED" both to `null`, so a value/null `progressReady` goes true after a failed query and can still
  select the new list. Fixed: fetch records per-key `status` (ok/error) separate from data; `progressReady`
  requires EVERY key `status:'ok'`; any error → retry/error state, no auto-select / focus controls /
  session-start from a provisional focus. The fetch change is now in scope.
- **Persistence wording:** clarified the fallback focus is not auto-persisted — the risk is render + user
  action / class-selection persistence; gate render + session-start (not a nonexistent auto-save).
- **Audit remediation:** tightened to strict read-only Admin for future runs — personas/classes UI-created or
  pre-existing; account-creation-via-Admin noted as a David-authorized deviation for this run only.

## Codex round-3 — AUDIT-CLEAN (2026-07-05)
Verdict: implementation-ready. Two impl notes folded in: (1) one atomic per-key map `{status, data}` (not
separate status/data states that can diverge); (2) normalize Firestore timestamps to ms before ranking. All
prior findings resolved (success-based readiness, gated render/hero/session-start, recency ranking, accurate
persistence wording + F03 warning, strict read-only Admin going forward).
