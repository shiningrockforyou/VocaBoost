// Feature flags (Phase-1 staged rollouts).
//
// SERVER_ATTEMPT_WRITE: route the durable `attempts` write through the
// `submitVocabAttempt` Cloud Function (server-side, transactional, idempotent)
// instead of the client writing to Firestore after grading. Fixes the
// "graded but the write never reached Firestore" class of lost attempts.
// Phase-1 rollout: server fn deployed + E2E-validated 2026-06-22; flipped ON
// during a quiet window for live client→function validation. Roll back to false
// + redeploy if grading/attempt issues appear. See PLAN_server_side_attempt_write_v2.md.
export const SERVER_ATTEMPT_WRITE = true;

// SERVER_CHALLENGE_WRITE: route challenge submission through the `submitChallenge`
// Cloud Function (server-side, transactional, token-checked) instead of the client
// writing `users/{uid}.challenges.history` + `attempts.answers` directly. That client
// write is the path that lets a student forge `answers[].isCorrect` (reviewChallenge then
// launders it into a passing score) — closing it is the point. Rollout
// (PLAN_attempt_write_lockdown.md W1): deploy the fn first → flip ON + rebuild → validate →
// then W3 rules remove the student `answers`-update branch. Roll back = flip false + rebuild
// (old client path still permitted until W3 rules deploy). Default OFF until fn is live + validated.
// [deepfix P4 · FND-2] Flips TRUE at the P4 DEPLOY-time cutover (David) — AFTER the P3 functions
// deploy + soak, together with the server-side flag flips (FOUNDATION_FLAGS in
// functions/foundation.js). Deliberately NOT flipped in this working tree (dormant-draft pattern).
export const SERVER_CHALLENGE_WRITE = false;

// SERVER_REVIEW_MARKER: write the empty-review "automarker" attempt via the
// `markReviewComplete` Cloud Function instead of a client `setDoc` (DailySessionFlow).
// Required before W3 sets attempts `create:false` — otherwise the client marker write
// (the only remaining live client attempt-create) would be denied and Day-2+ completion
// would break. Rollout (PLAN_attempt_write_lockdown.md W2): deploy fn first → flip ON +
// rebuild → validate Day-2+ empty-review completion → then W3 rules. Default OFF until live.
// [deepfix P4 · FND-2] Flips TRUE at the P4 DEPLOY-time cutover (David) — AFTER the P3 functions
// deploy + soak (the upgraded W2 marker lives in `markReviewComplete`, functions/index.js →
// foundation.writeUpgradedReviewMarker). Deliberately NOT flipped in this working tree.
export const SERVER_REVIEW_MARKER = false;

// LIST_SCOPED_RECON: Phase 1 of PLAN_list_progress_persist.md (v3.7) — make the CSD/TWI
// reconciliation + anchor readers STUDENT+LIST scoped instead of class-scoped, so a
// student's progress anchor resolves across every class they've taken the list in
// (fixes the class-change day-reset cluster; auto-carries position at session entry).
// Flag-on changes (§5.1): anchor = greatest valid newWordEndIndex (submittedAt tie-break,
// studyDay-ordered fallback for legacy anchors missing the field); review paired to the
// anchor's OWN class + temporal lineage; CSD becomes NON-DEMOTING (max) — day = session
// count; orphan-review cleanup goes LOG-ONLY; Day-2+ gate accepts a same-day passed new
// attempt list-wide only if position-consistent. Requires the 6 new attempts composite
// indexes (firestore.indexes.json) deployed FIRST — flag-on without them = query-error
// fallbacks everywhere. Flag-off = byte-equivalent legacy (class-scoped) behavior.
export const LIST_SCOPED_RECON = true;

// CONTINUATION_LINKS (FIX_PLAN Phase P8 · CONT-A): David's list-continuation feature —
// per-class list SEQUENCE (`nextListId` on classes/{classId}.assignments[listId]), a
// finished-list choice terminal ("Advance to {nextList} →"), and finished-list focus-yield
// on the Dashboard (a FINISHED list — twi >= listTotal — yields primary focus to its linked
// nextListId; handles BOTH the explicit-pin branch and the recency branch of getPrimaryFocus,
// C-13/F6-5). "Advance" is PURE navigation + config read: the next list starts through the
// EXISTING initializeDailySession create-on-miss path on a DIFFERENT listId; NO code behind
// this flag writes the finished list's totalWordsIntroduced/currentStudyDay or alters
// allocation (the §2.1 falsifier — if any such write appears, CONT-A re-gates behind P6).
// "Start over" (cycling, P9) is NOT part of this flag and renders only once that capability
// is live. Default OFF; with the flag off — or `nextListId` unset — behavior is today's
// exactly (static P1 finished terminal, no yield, no teacher selector).
export const CONTINUATION_LINKS = false;

// SERVER_PROGRESS_WRITE (deepfix P4 · FND-2): route the durable session-completion write
// through the `completeSession` Cloud Function (transactional day-guard, server-derived
// reviewOnlyDay/wordsIntroduced — functions/foundation.js) instead of the client
// updateClassProgress write, AND route progress hydration/render reads through the READ-ONLY
// `resolveListProgress` callable (server performs today's entry-time reconciliation — the F4-1
// leg — and returns the launch view; render paths consume the resolver's in-memory
// reconciliation with NO write). Completion still targets the LEGACY class_progress doc until
// P5 flips LIST_PROGRESS_CANONICAL server-side — no data migration is implied by this flag.
// DEPLOY ORDER (critical): the P3 functions deploy MUST be live (server flags
// SERVER_COMPLETE_SESSION_ENABLED / SERVER_RESOLVE_LIST_PROGRESS_ENABLED flipped) BEFORE this
// flips true — flag-on against a dark server throws `failed-precondition` on every completion.
// Flips TRUE only at the P4 DEPLOY-time cutover (David), after the P3 soak. Roll back = flip
// false + rebuild (callables keep working idle; legacy client path untouched).
// Default OFF — flag-off behavior is byte-equivalent to today (Run-L discipline).
export const SERVER_PROGRESS_WRITE = false;

// CYCLING_ENABLED (deepfix P9 · CYC — per-student list cycling / "start over"): the GLOBAL
// build-time hard gate for finished-list lap cycling (x/plan v5). When a list is finished
// (twi === totalListWords) the allocation cap is REMOVED so the student keeps introducing
// words on a monotonic VIRTUAL index (twi climbs past cycleLength; the physical word is
// fetched by wrapping the LOOKUP — positions[i mod cycleLength] — never the counter, so
// reconciliation stays byte-identical, x/plan §2/§3a). Cap removal is what re-activates
// progress-forgery, so cycling MUST NOT run until the server-authoritative-twi FOUNDATION
// (P3–P6) is deployed and soaked (x/plan §3g HARD PREREQUISITE / FIX_PLAN P9 gate).
//
// TWO-KEY GATE (deliberate deviation from x/plan's "per-assignment only" — recorded as an
// uncertainty for Codex, P9_impl_notes U1): a cycling code path executes ONLY when BOTH
//   (1) this GLOBAL flag is true, AND
//   (2) the per-assignment `classes/{classId}.assignments[listId].cyclingEnabled === true`
//       (owner-teacher-only write, db.js updateAssignmentSettings).
// The global flag enforces §3g's prerequisite IN CODE — cap removal literally cannot run in
// this working tree until the flag flips at ship (after the foundation deploys) — and gives
// byte-equivalent dormancy: with CYCLING_ENABLED === false EVERY touched path short-circuits
// to today's exact behavior (the `&&` never reaches the per-assignment read). Default OFF —
// flag-off behavior is byte-equivalent to today (verified by diff + the M-STATIC harness).
export const CYCLING_ENABLED = false;

// SERVER_RESET_PROGRESS (deepfix P4 · FND-2, v2 HIGH-3 / F6-3): route student progress reset
// through the `resetProgress` Cloud Function (self-service, LIST-WIDE across all classes,
// attempts-first ordering, reset-epoch tombstone — functions/foundation.js) instead of the
// client batch-delete in db.js `resetStudentProgress`. REQUIRED before P6 removes the
// attempts owner-delete rules branch (firestore.rules `allow delete: resource.data.studentId
// == request.auth.uid`) — with the flag ON, no LIVE client path deletes attempt docs, so the
// P6 rules cutover cannot break reset ([C5-5]: server-move and owner-delete-removal ship as
// the two halves of one change; this flag is the client half).
// DEPLOY ORDER: P3 functions deploy (SERVER_RESET_PROGRESS_ENABLED) must be live first.
// Flips TRUE only at the P4 DEPLOY-time cutover (David). Roll back = flip false + rebuild
// (the client-delete fallback stays legal until the P6 rules deploy).
// Default OFF — flag-off behavior is byte-equivalent to today.
export const SERVER_RESET_PROGRESS = false;

// SERVER_OVERRIDE (deepfix P10 · OVR — teacher override + challenge redesign, FIX_PLAN
// P10 (a)+(b) / I-7 / I-10): the CLIENT gate for the P10 override + full server-side
// reviewChallenge migration. Two things ride this flag:
//   (1) client `reviewChallenge` (db.js) routes the WHOLE review to the server
//       `reviewChallenge` callable (functions/foundation.js) — finishing the migration P4
//       began (P4 already routed only the day-advance under SERVER_CHALLENGE_WRITE). The
//       callable applies the I-10 §6 authz UNION (attempt teacher-of-record OR current-
//       enrollment owner) and moves the answer-flip / score / challenges.history /
//       study_states legs server-side.
//   (2) the teacher `overrideAttempt` entry point (db.js) — the in-product manual-pass:
//       write a VALID reconciliation anchor + advance the day for an ungradeable /
//       teacherId:null / inherited attempt (superset of reviewChallenge).
// DEPLOY ORDER (critical): the P10 functions deploy MUST be live (server flags
// SERVER_REVIEW_CHALLENGE_ENABLED / SERVER_OVERRIDE_ENABLED flipped) BEFORE this flips
// true — flag-on against a dark server throws `failed-precondition`. Flips TRUE only at the
// P10 DEPLOY-time cutover (David), after the P3–P6 foundation soak. Roll back = flip false
// + rebuild (the client hybrid path stays legal). NOTE (P10 draft): parts (c) read-surface
// widening + (d) rules narrowing are NOT in this flag's dormant draft — held pending owner
// decisions (P10_impl_notes); the Gradebook override BUTTON is deferred to (c)'s release
// (an orphaned attempt is not yet VISIBLE to attach the action to). Default OFF —
// flag-off behavior is byte-equivalent to today (Run-L discipline).
export const SERVER_OVERRIDE = false;

// TEACHER_IDS_READ (deepfix P10 · OVR part (c) — the C-19 read-surface WIDENING, FIX_PLAN
// P10 read-surface leg / I-10 §3-4; David decision U1 = Option A `teacherIds`-array
// denormalization + reindex). The CLIENT gate for the "a promoted student's old-teacher-
// stamped attempts must show in the new teacher's gradebook" fix. Three CLIENT things ride
// this flag (all byte-equivalent when OFF):
//   (1) the teacher gradebook query (db.js queryTeacherAttempts) widens from the base
//       `where('teacherId','==',uid)` equality to `where('teacherIds','array-contains',uid)`
//       so an inherited (A-stamped) attempt of a student now enrolled with teacher B is
//       VISIBLE to B. The already-shipped C-33 studentId server-filter + class filter +
//       pagination are preserved, and the <=30 DNF disjunction budget is UNCHANGED
//       (array-contains contributes a factor of 1 — see P10c_impl_notes disjunction-budget).
//   (2) the ex-roster name filter (db.js getTeacherData) resolves student names against a
//       UNION roster (current members plus students appearing on the teacher's inherited
//       attempts) so a promoted student's name no longer hard-empty-returns the gradebook.
//   (3) the CLIENT attempt-write stamp (db.js submitTestAttempt / submitTypedTestAttempt)
//       writes the additive `teacherIds` array on NEW attempts. (The SERVER write paths are
//       gated by the mirrored server flag TEACHER_IDS_WRITE_ENABLED in
//       functions/foundation.js FOUNDATION_FLAGS — the two flip TOGETHER at the P10c cutover.)
// DEPLOY ORDER (critical, mirrors the C-33 index precedent): the NEW `teacherIds` composite
// indexes (firestore.indexes.json) must be `--only firestore:indexes` deployed AND the one-
// time `--dry`->`--commit` backfill (scripts/cs/deepfix-migrate-attempts-teacherids.mjs) run
// BEFORE this flips true — a flag-on array-contains query without the index (or against
// un-backfilled attempts) returns a query-error / empty. The additive attempts READ-rule
// clause (firestore.rules — a teacher listed in `teacherIds` may read) IS in this (c) draft
// [Codex P10c-1] and MUST be deployed before this flips (I-10 §4 query-vs-rules same-release);
// only the rules NARROWING stays in part (d). Flips TRUE only at the P10c cutover (David),
// after the P3-P10(a/b)
// foundation soak. Roll back = flip false + rebuild (the `teacherId==` path is still legal;
// the denormalized field is additive and harmless when unread). Default OFF — flag-off
// behavior is byte-equivalent to today (Run-L discipline). DORMANT at merge (P3 draft rule).
export const TEACHER_IDS_READ = false;
