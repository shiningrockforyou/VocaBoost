# DEEPFIX2 — THE SHADOW-COHORT AUDIT (16_, v1 2026-08-02 — David-ordered; stage 3.5 of DF2-14)

> **What this is:** a full-fidelity clone of the real cohort's data under namespaced identities, executed
> against the deployed dark system — the missing third testing leg (B1 = computed shadow · 25WT = real flow on
> synthetic history · **this = real-shaped history under real execution, at scale, zero consequence**).
> Position: dark deploy → 25WT flow rehearsal → **SHADOW-COHORT AUDIT** → David's 26SM backfill go → the flip.
> Convergence: 3-Fable + Codex r58 (this plan). Execution: WSL scripts + WinClaude (deploys/Playwright).
> **David's permission set is asked VIA WINCLAUDE (r69) — answers recorded there.**
> **v2 (same day): the 3-Fable convergence folded — 30 findings incl. one BLOCKER (verbatim joinCode cloning
> would let a REAL student join a shadow class). v3 (same day): the Codex r58 closure gate folded — opaque
> identities, field-level minimization, token auth, sessions/*, snapshot fences, scenario partitions,
> write-wrapper containment, cleanup v3, fail-closed acceptance, the full test matrices. Permissions Q1-Q7+A
> are ANSWERED (§7); WinClaude items B-E pending → r70.**

## 1. Clone scope (per student; 947 from the reviewed allowlist census)

| Data | Cloned? | Notes |
|---|---|---|
| `users/{uid}` root | YES — **PII REDACTED (full inventory [panel]): displayName, email, `profile.avatarUrl` (Google photo URL), `profile.school`, `gradYear`/`gradMonth`, and any other identity field → the SHADOW-{n} identity**; `enrolledClasses` → shadow class ids; `challenges.history[].attemptId` → the mapped shadow attempt ids | uid → **`zx{22-char run-random}` [r58: `shadow_{origUid}` was pseudonymization — the real uid lived in every path; opaque ids + ONE gitignored mapping file (readers: WSL + WinClaude only; deleted with the run) sever linkability; the NEUTRAL `zx` prefix keeps prefix-guards working while encoding NOTHING]** |
| `users/{uid}/study_states/*` | YES (full) | the behavioral substrate |
| `users/{uid}/list_progress/*` + `class_progress/*` + `progress_meta/*` | YES | classId FIELDS rewritten **+ COMPOSITE DOC IDS remapped: `class_progress`/`session_states` docIds are `{classId}_{listId}` (foundation:237) — rebuilt from the mapped shadow classId [panel: un-remapped ids would silently orphan all per-class progress]** |
| `users/{uid}/session_states/*` | YES | in-flight state realism; docIds remapped as above |
| `users/{uid}/sessions/*` (completed-session HISTORY — studyService:931/1087) | YES [r58 — was MISSING; the completion/wall flows read+write this surface] | minimized per the allowlist; new session docs join the cleanup discovery set |
| `attempts` (top-level, by studentId) | YES | rewritten: `studentId`/`classId`/`teacherId`/`teacherIds`/`testId` (re-derived from the mapped classId) **+ `answers[].challengeReviewedBy` (a real teacher uid nested in rows — → audit teacher) + `manualReviewNote` (embeds a caller uid in free text — STRIPPED) [panel]**; attempt docIds prefixed and the map retained so `challenges.history[].attemptId` on the user root remaps to the shadow attempt ids [panel] |
| `grading_jobs` | NO | transient; recovery is tested by NEW jobs in walkthroughs |
| `classes` (the 33 allowlist classes) | YES → shadow classes | **docId = `shdw{origId}` (UNDERSCORE-FREE — the testId parser `[^_]+` and `{classId}_{listId}` composites require it [panel]); name = `SHDW-{n}` — NEVER containing "26SM" or the original name (regex-tool pollution [panel]); `ownerTeacherId` = the audit teacher (the REAL ownership field — teacher dashboards query it, force-pass authz checks it; ~~teacherIds~~ was wrong [panel]); `joinCode` = REGENERATED unique (BLOCKER fix: verbatim codes would enroll real students into shadow classes via joinClass's limit(1) match; sweep asserts zero code collision with ANY real class); `studentIds` = shadow uids; assignments verbatim** |
| `classes/{id}/members/*` | YES (was MISSING [panel]) | the roster source for every teacher surface (gradebook/progress enumerate members); cloned under shadow ids with displayName/email REDACTED to the SHADOW-{n} identity |
| `lists`/`words` | NO (shared read-only reference) | |
| Firebase Auth | shadow users created (opaque `zx…` uids, redacted emails, **NO PASSWORDS — short-lived Admin-minted CUSTOM TOKENS only [r58; supersedes the password design David approved — strictly fewer credentials]**; the ~30 Playwright accounts get unique high-entropy passwords minted per run) — ALL 947 | callable/Playwright auth |

**Data-minimization law [r58, v3]:** cloning is ALLOWLIST-only per collection (an explicit output schema per
doc type — never "verbatim except..."); FREE TEXT is never copied: typed answer text, challenge
questions/reasons/responses, notes → type/length-preserving SYNTHETIC values (the replay needs only
`isCorrect` booleans; grading-recovery tests use NEW submissions); manifests/reports carry NO raw source
payloads. **Field-rewrite law (fail-closed, v2):** the clone script carries an explicit FIELD MAP of every
uid/classId-bearing location per collection — scanning covers **field values, NESTED ARRAY elements
(answers[].challengeReviewedBy), STRING EMBEDDINGS (substring scan for real uids/classIds in free text —
manualReviewNote), DOC IDS, and MAP KEYS ({classId}_{listId} composites) [panel]**; any real-id hit outside
the map ⇒ the doc is FLAGGED and not written (manifest-published). Sweeps compare EXACT-MATCH id sets, never
substrings (shadow ids may contain original ids by construction).

## 2. Isolation laws (do-no-harm — each one ASSERTED by the integrity sweep)

1. **Namespace**: every created docId/uid carries the `shadow_`/`SHADOW ` prefix; the sweep proves (a) no
   shadow doc references a real uid/classId, (b) no REAL doc was touched (write-audit by manifest diff).
2. **Teacher invisibility**: shadow classes belong to the audit teacher only; verified by executing the real
   teacher-surface queries for 3 real teachers → zero shadow rows.
3. **Gate isolation**: shadow class ids → `rehearsalClassIds` (with 25WT); the real-class assertion (no real id
   ever in that list) runs before AND after; the flip choreography's "list empty" assertion is unchanged.
4. **Backfill mutual exclusion**: B3-on-26SM uses the real allowlist; B3-on-shadow uses a SHADOW allowlist;
   each run asserts its targets are disjoint from the other's.
5. **Metrics hygiene**: all shadow-driven `ops_metrics`/logs carry `shadow:true`; baseline computations filter
   them (the monitoring-pipeline audit READS them deliberately — §4-I).
6. **AI-grading cap**: shadow typed submissions are metered under a hard cap (David sets it — Q4); MCQ carries
   the bulk of walkthroughs.
7. **Cleanup (v2 — covers SYSTEM-created docs [panel]):** the manifest records every CLONE-created path, but
   the audits make the deployed backend create MORE (queues, presentations, completions, visits, credits,
   grading jobs, metrics rows for shadow users — ids NOT all shadow-prefixed). Cleanup = manifest-listed docs
   + PER-COLLECTION SWEEPS keyed on the shadow uid/class id sets (attempts by studentId ∈ shadow set; each
   users/shadow_*/subcollection; jobs by uid; metrics by shadow tag) + Auth deletion GUARDED by an exact
   `shadow_` uid-prefix check per account. Post-cleanup: an INDEPENDENT sweep (not the manifest — a
   fresh per-collection query for shadow-set references, both directions [panel: the manifest is
   self-referential]) proves zero residue. Retention = David's Q5.
8. **Config-doc law [panel]:** every `system_config/review_v2` touch (rehearsalClassIds setup/teardown) goes
   through ONE guarded script that never writes `enabled`, asserts `enabled === false` before AND after, and
   records pre/post images. The GLOBAL kill switch is NEVER exercised by this audit — drill E uses
   shadow-class-scoped `reviewGateEnabled` + rehearsalClassIds removal only.
9. **Off-peak + rate law [panel]:** clone/sweeps/probe run in the KST off-peak window; BulkWriter default
   throttling; the concurrency probe capped at 100 parallel; Firestore usage monitored during (the live 26SM
   cohort shares the project — co-tenancy is Q7's consent).
10. **Auth hygiene [panel]:** per-account RANDOM passwords (stored only in the gitignored manifest — no shared
   password); deletion path guarded as in law 7; the AUDIT TEACHER account is provisioned the same way and
   named in the manifest.
11. **Metrics tagging mechanism [panel]:** the dark build's ops_metrics writers stamp
   `shadow: uid.startsWith('shadow_')` (one line, specced into H6 §6c); consumers filter on it — tagging is
   code, not convention.
12. **AI cap enforcement [panel]:** the walkthrough driver counts BEFORE dispatch and hard-stops at the cap
   (MCQ is the default modality; typed only in the capped sample); the meter audit (§4-I) cross-checks the
   count after.

## 2b. Scenario partitions + state law [r58: one mutable cohort made later audits run on earlier audits' leavings]

Audit A (the backfill dress rehearsal) applies to ALL 947 — its output IS the launch-state substrate and is
re-fidelity-checked before anything else runs. B (the compose sweep) is read-mostly and runs against post-A
state (deterministic; queue docs it creates are audit artifacts). The DESTRUCTIVE batteries run on **DISJOINT
frozen student partitions** (C walkthroughs ~30 · D concurrency ~100 · E kill-drill ~20 · F reset-drill ~3 ·
G dual-enrollment cases · J/K/L strata — the partition manifest is frozen pre-run, hash-recorded), so no
battery consumes another's mutations; a post-clone EXPORT of the shadow set enables restore-and-rerun of any
single battery without recloning.

## 3. Execution pipeline (each step gated on the previous; all scripted, dry-run-first)

**SNAPSHOT LAW [r58 — the source cohort keeps changing]: the clone reads per-student with a
digest-fence — read → digest → re-read → digest-equal or RETRY (×3, then flag+skip); ONE run watermark stamps
every copied doc; the clone-fidelity gate runs B1-on-shadow at THE ORIGINAL BASELINE'S watermark (B1
`--watermark`); a flagged-student count above 2% ABORTS the clone.** **WRITE-WRAPPER CONTAINMENT [r58 — the
manifest is self-referential]: every clone/audit write passes an in-process guard (target id ∈ the run's
shadow set AND collection ∈ the allowed set) BEFORE the write; violations hard-stop the run; containment
evidence = the guard log + pre/post digests of shared reference surfaces (`lists/**`) + the real-doc
spot-hash set.** **Pre-clone sizing** (per-student count() aggregations — B2's capped medians are NOT usable for sizing
[panel]) → `shadow-clone.mjs` (dry-run manifest → --execute; off-peak) → `shadow-integrity-sweep.mjs` (§2) →
**clone-fidelity gate**: B1 run against the shadow cohort **with `--watermark=<the original baseline's
watermark>` and `--outDir` (small B1 additions, owned in §5 [panel])** must equal the real baseline modulo the
id map (mapped-digest byte-diff) → **audit A (needs ONLY Admin SDK — runs BEFORE/parallel with the dark
deploy [panel])** → dark deploy → audits B-I (need the deployed backend; B/D/E/F/H drive callables via
**Admin-minted CUSTOM TOKENS exchanged through signInWithCustomToken [panel — callables hard-require
per-student auth]**) → the report → cleanup per Q5.

## 4. The audit battery

- **A. BACKFILL DRESS REHEARSAL (the crown jewel):** B3 `--execute` against ALL 947 shadow students → diff
  every written label byte-for-byte vs the (mapped) B1 baseline → **then run B3 AGAIN: second pass must write
  ZERO changes (idempotency at scale)**. Gate [r58 — fail-CLOSED]: exact equality except a PREDECLARED,
  machine-evaluated exception set (expected ids + counts, owner-approved in advance); ANY undeclared
  divergence = FAIL. No post-hoc rationalization.
- **B. LAUNCH-DAY SWEEP:** for every shadow student × enrolled list, invoke the real compose path (deployed
  dark backend, rehearsal-gated): day-queue + test composition succeeds; the fixture invariants re-asserted on
  LIVE output (membership/tiling/prefix/effectiveTestSize); stats captured (saturation %, priority counts,
  pool sizes, underflow usage, compose latency) and reconciled against H8's baselines (tolerance bands stated
  in the report, not pass/fail — R2-47).
- **C. BEHAVIORAL WALKTHROUGHS (Playwright, stratified ~30 accounts):** strata = high/mid/low band ·
  priority-saturated · list-end · resting-heavy · DUAL-ENROLLED (real R2-36/38 cases) · reset-history. Flows:
  wall→retake→pass→graduation · restudy/pips/bookmark · grading-outage recovery (kill mid-grade) · force-pass
  live-dissolve (audit teacher) · gradebook toggle.
- **D. CONCURRENCY PROBE:** ~100 shadow accounts driven in parallel (Admin-SDK harness): simultaneous compose
  (counter allocator + composeKey under contention) · racing completions (exactly-once: one winner,
  `already_completed` losers) · dual-enrollment races on the shared logical day.
- **E. KILL-SWITCH DRILL:** mid-session shadow-scope disable → OFF-parity + labels-keep-writing law observed →
  re-enable resumes in place (R2-32 live).
- **F. RESET DRILL:** the new locked reset on 3 shadow students (fence → op rejections → stale-only deletes →
  reconcile → owner-clear) + one TAKEOVER case (simulated crash mid-cleanup).
- **G. CROSS-CLASS LAW:** cloned real dual-enrollments exercise R2-36/38 (mixed posture via per-assignment
  `reviewGateEnabled` on one shadow class) — evidence consumption + audit records verified.
- **H. REPLAY/IDEMPOTENCY:** compose replay with the same composeKey (same presentation returned) + mismatched
  fingerprint refusal + attempt-submit idempotent retry.
- **I. MONITORING PIPELINE:** the shadow run's `ops_metrics` stream is consumed by the real
  threshold-computation path (filtered `shadow:true`) — proves the monitoring/abort tooling works BEFORE the
  real soak depends on it.
- **J. STREAK CREDITING [panel]:** multi-day advances on shadow accounts assert the `streak_credits` law
  (one credit per KST date; Fri→Mon continuity; weekday gap breaks; idempotent concurrent completions).
- **K. LIST-END + NEXT-LIST [panel]:** a shadow student at list end exercises the R2-39 law live —
  zero-new-words day advances on the review test alone (no phantom day), the end screen offers `nextListId`.
- **L. FENCES [panel]:** the `minClientVersion` refusal (`client_version_stale`), grading-job 12h expiry
  redaction, and the per-assignment `reviewGateEnabled` OFF label law — each exercised once on shadow.
- **M. AUTHORITY/RULES NEGATIVES [r58 — client-SDK/REST, never Admin]:** a shadow student cannot write the six
  labels or any server-only collection, cannot read another shadow/real student; a real student/teacher/
  unrelated teacher cannot access shadow state (query AND direct-doc); the audit teacher cannot mutate real
  rows.
- **N. VERSION/CONFIG MATRIX [r58]:** stale/malformed/missing `clientContractVersion` · old-bundle forced
  refresh · mid-day global/per-assignment edits (snapshot immutability) · rehearsal-list CAS · cold-start HOLD.
- **O. DURABLE-JOB MATRIX [r58]:** missing-uid quarantine · 12h expiry/redaction · lease takeover · AI cap
  under concurrency · write-only recovery · reset racing claim AND finalize · no re-billing on retry.
- **P. EVIDENCE-KIND LIVE CHECKS [r58]:** first_day_new_only · standard · gate_off_autopass ·
  list_end_review_only · gate_off_list_end · underflow day · forced fallback · priority saturation ·
  cross-class source posture BOTH directions — each produced live on shadow and its completion record verified.
- **Q-audit. FINAL CLEANUP + EXCLUSION GATE [r58 — a first-class battery item]:** production
  monitors/thresholds provably ignored shadow data; no real/shared doc changed (guard log + digests);
  config restored (CAS-verified); every audit credential revoked; cleanup re-run = zero-op; the two delayed
  zero-residue sweeps pass.
- **CONCURRENCY REALISM [r58]:** battery D drives the DEPLOYED CALLABLE boundary with real tokens (never
  direct Admin calls — those bypass the very authz/validation being certified) and contends on the SAME
  uid/list/day/counter with same-key AND different-key barriers.

## 5. Deliverables

`shadow-clone.mjs` · `shadow-integrity-sweep.mjs` · `shadow-audit-driver.mjs` (B/D/E/F/H) · Playwright specs
(C/G) · `shadow-cleanup.mjs` — all under `scripts/deepfix2/`; manifests + reports under the gitignored
`audit/deepfix/trackB_baselines/shadow/`. THE REPORT: per-audit verdicts + stats vs baselines + every
divergence — a named input to David's backfill-go decision.

## 6. Cost + limits (honest)

One-time ~1.5-2M doc writes + similar reads (≈ $5-10 Firestore) · AI grading ≤ cap (Q4) · NOT covered even
here: 947 real humans' simultaneous load pattern + human behavior (stays with soak + kill switch).

## 7. David's permission set — **ANSWERED (WinClaude r69, verbatim on record): Q1 YES-REDACTED · Q2 YES all
947 + audit teacher · Q3 DARK DEPLOY CONFIRMED · Q4 CAP = 300 · Q5 AUTO-DELETE · Q6 HOSTING CONFIRMED
(conditions binding) · Q7 CO-TENANCY YES, FULL 947 (re-affirmed after the exposure was restated) · A =
system_config writes NARROWED-APPROVED (the §2.8 guarded script only; `enabled` + the global kill switch stay
forbidden). PENDING: WinClaude's B-E standing-authority items → the r70 consolidated round.**

- **Q1** Clone real student data into namespaced shadow copies WITH PII redaction — the FULL inventory:
  displayName, email, avatar/photo URL, school, graduation fields, any identity field (recommended) — approve?
- **Q2** Create 947 shadow Firebase-Auth users + ONE audit-teacher account (per-account random passwords in the
  gitignored manifest; all deleted at cleanup) — approve? [the battery REQUIRES all 947 — B sweeps every
  student; D needs 100 parallel]
- **Q3** CONFIRM the dark deploy (functions+rules+indexes, all `enabled:false`) — granted in-session; formal
  record here. The audits cannot run without it.
- **Q4** AI-grading cap for shadow typed tests — default 200 calls; set a number.
- **Q5** Shadow-data retention: auto-delete right after the report (recommended) vs hold until your review.
- **Q6** CONFIRM conditional hosting deploy (only after OFF-parity + old-bundle checks green) — granted
  in-session; formal record.
- **Q7 [panel]** CO-TENANCY consent: the clone (~1.5-2M writes), the 947-student sweep, and the 100-account
  concurrency probe run against the SAME production project serving the live cohort — off-peak + throttled +
  usage-monitored per §2.9. Approve running them against production co-tenancy? [yes / restrict to a smaller
  clone N / no]
