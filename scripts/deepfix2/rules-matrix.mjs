#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — rules-matrix.mjs: THE 10-CASE EMULATOR MATRIX (17_ §7b step 3)
 * ============================================================================
 * Runs the frozen case list (firestore.review_v2.rules:111-126) against the
 * MERGED artifact audit/deepfix/task3/live_baseline/firestore.merged.rules —
 * never against the spec fragment, never against the UNSHIPPED P10 draft
 * (docs/plans/UNSHIPPED_P10_CUTOVER.firestore.rules — moved off the deploy path).
 *
 * LIVE-BASE ADAPTATIONS (documented, per the spec's own CLAUSE 5 note (b) and
 * the "preserved AS FOUND in the live base" NOTE):
 *   - Case 7: the live base legally allows plain client attempt create /
 *     answers-only student update / teacher-of-record update. Only writes
 *     CARRYING the override/engine keys are denied. (The spec's line-121
 *     wording targets the repo end-state base where attempts are fully
 *     server-owned; here "deny client attempt writes" would fail case 9.)
 *   - Case 9: the base ships no test set, so the regression sweep is authored
 *     here — every pre-existing allow branch in the live ruleset asserted, and
 *     the base's own denials that DEEPFIX2 relies on staying denials.
 *
 * Run (from /app; the scratch dir carries its own firebase.json so /app's
 * firebase.json is never loaded):
 *   see scripts/deepfix2/run-rules-matrix.sh
 * Exit: 0 all green · 1 any case failed.
 *
 * ORDER COUPLING (mutation runs only): cases share one dataset, so a write that
 * was EXPECTED to be denied but succeeded (only possible when the rules under
 * test are wrong) can contaminate later cases. The canonical merged-artifact
 * run is immune: contamination requires a prior failure, and it has none.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import firebase from "firebase/compat/app";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

const RULES_PATH = process.env.RULES_PATH || "/app/audit/deepfix/task3/live_baseline/firestore.merged.rules";
const PROJECT_ID = "demo-rules-matrix";

const hostPort = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, port] = hostPort.split(":");

const NINE = [
  "review_queues", "review_presentations", "day_completions",
  "streak_credits", "restudy_completions", "restudy_visits",
  "review_counters", "review_cursors", "compose_keys",
];
const SIX_LABELS = [
  "reviewFailCount", "reviewLastFailedAt", "reviewLastCorrectAt",
  "reviewLastProvenAt", "reviewLastTestedAt", "reviewRestingUntil",
];
const OVERRIDE_KEYS = ["teacherEdited", "teacherEditedBy", "teacherEditedAt", "preOverride", "gatePosture"];

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules: readFileSync(RULES_PATH, "utf8"), host, port: Number(port) },
});

// ── Seed (rules-disabled): identities + fixtures every case leans on ─────────
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const b = db.batch();
  b.set(db.doc("users/student1"), { role: "student", displayName: "S1" });
  b.set(db.doc("users/student2"), { role: "student", displayName: "S2" });
  b.set(db.doc("users/teacher1"), { role: "teacher", displayName: "T1" });
  b.set(db.doc("users/teacher2"), { role: "teacher", displayName: "T2" });
  // study_states: one plain, one carrying a server label (erasure-guard target)
  b.set(db.doc("users/student1/study_states/w_plain"), { status: "learning", correctCount: 2 });
  b.set(db.doc("users/student1/study_states/w_labeled"), { status: "learning", reviewFailCount: 1 });
  // the nine server-owned subcollections: one doc each (read + update targets)
  for (const sub of NINE) b.set(db.doc(`users/student1/${sub}/seeded`), { server: true });
  // legacy progress records (must STAY writable)
  b.set(db.doc("users/student1/list_progress/c1_l1"), { twi: 10 });
  b.set(db.doc("users/student1/class_progress/c1_l1"), { csd: 3 });
  b.set(db.doc("users/student1/progress_meta/c1_l1"), { resetCount: 0 });
  // classes / lists graph
  b.set(db.doc("classes/c1"), { ownerTeacherId: "teacher1", studentCount: 1, studentIds: ["student1"], name: "C1" });
  b.set(db.doc("classes/c1/members/student1"), { joinedAt: 1 });
  b.set(db.doc("classes/c1/words/w1"), { word: "apple" });
  b.set(db.doc("lists/l1"), { ownerId: "teacher1", name: "L1" });
  b.set(db.doc("lists/l1/words/w1"), { word: "apple", position: 0 });
  // attempts: one owned by student1 under teacher1
  b.set(db.doc("attempts/a1"), {
    studentId: "student1", teacherId: "teacher1", score: 80, passed: false,
    answers: [{ wordId: "w1", isCorrect: false }], totalQuestions: 1,
  });
  // grading_jobs: owned by student1
  b.set(db.doc("grading_jobs/gj1"), { uid: "student1", status: "complete", rows: [] });
  // an attempt carrying the engine/override stamps (erasure-guard target)
  b.set(db.doc("attempts/a_stamped"), {
    studentId: "student1", teacherId: "teacher1", score: 100, passed: true,
    teacherEdited: true, teacherEditedBy: "teacher1",
    preOverride: { score: 80, passed: false },
    gatePosture: { effectiveEnabled: true, configVersion: 1, threshold: 92, source: "config" },
  });
  // a study_state carrying MULTIPLE labels + one for the third-party probes
  b.set(db.doc("users/student1/study_states/w_multi"), {
    status: "learning", reviewFailCount: 2, reviewLastProvenAt: 5, reviewRestingUntil: 9,
  });
  // the server-only reset/epoch fence (B2 guard targets)
  b.set(db.doc("users/student1/progress_meta/fenced"), { resetEpoch: 1, resetAt: 1000, resetInProgress: false });
  b.set(db.doc("users/student1/list_progress/fenced_lp"), { resetEpoch: 2, twi: 30 });
  b.set(db.doc("users/student1/study_states/w_fenced"), { status: "learning", resetEpoch: 1 });
  // an attempt carrying the marker the LIVE override writers actually stamp
  b.set(db.doc("attempts/a_manual"), {
    studentId: "student1", teacherId: "teacher1", score: 100, passed: true,
    manualOverride: true, manualReviewNote: "CS manual pass",
  });
  // system_config: the seeded dark doc
  b.set(db.doc("system_config/review_v2"), { enabled: false, threshold: 92, configVersion: 1 });
  // server-only sinks
  b.set(db.doc("ai_metering/m1"), { tokens: 10 });
  b.set(db.doc("ops_metrics/o1"), { kind: "composition_fallback" });
  b.set(db.doc("shadow_registry/chunk0"), { uids: [] });
  // system_logs: one row for read checks
  b.set(db.doc("system_logs/log1"), { event: "seed" });
  // apBoost fixtures
  b.set(db.doc("ap_tests/t1"), { name: "Macro" });
  b.set(db.doc("ap_questions/q1"), { text: "Q" });
  b.set(db.doc("ap_stimuli/st1"), { text: "S" });
  b.set(db.doc("ap_answer_keys/q1"), { answer: "A" });
  b.set(db.doc("ap_session_state/sess1"), { userId: "student1", answers: {}, status: "active" });
  b.set(db.doc("ap_test_results/r1"), { userId: "student1", teacherId: "teacher1", score: 3 });
  b.set(db.doc("ap_classes/apc1"), { ownerTeacherId: "teacher1" });
  b.set(db.doc("ap_assignments/apa1"), { classId: "apc1" });
  await b.commit();
});

const un = env.unauthenticatedContext().firestore();
const s1 = env.authenticatedContext("student1").firestore();
const s2 = env.authenticatedContext("student2").firestore();
const t1 = env.authenticatedContext("teacher1").firestore();
const t2 = env.authenticatedContext("teacher2").firestore();

let pass = 0, fail = 0;
const failures = [];
async function ok(name, p) {
  try { await assertSucceeds(p); pass++; }
  catch (e) { fail++; failures.push(`ALLOW-expected DENIED: ${name} :: ${e.message?.slice(0, 120)}`); }
}
async function deny(name, p) {
  try { await assertFails(p); pass++; }
  catch (e) {
    fail++;
    // assertFails ALSO rejects when the error is not PERMISSION_DENIED, so the
    // raw message is carried through — "wrong error" must not read as "allowed".
    failures.push(`DENY-expected FAILED: ${name} :: ${e.message?.slice(0, 140)}`);
  }
}

// ── CASE 1: plain study_states stay owner-CRUD; label-carrying delete denied ─
await ok("1a owner create plain study_state", s1.doc("users/student1/study_states/w_new").set({ status: "learning" }));
await ok("1b owner update plain study_state", s1.doc("users/student1/study_states/w_plain").update({ correctCount: 3 }));
await ok("1c owner delete PLAIN study_state", s1.doc("users/student1/study_states/w_new").delete());
await deny("1d owner delete LABEL-carrying study_state (erasure guard)", s1.doc("users/student1/study_states/w_labeled").delete());

// ── CASE 2: the six labels are client-immutable ──────────────────────────────
for (const f of SIX_LABELS) {
  await deny(`2a owner create study_state with ${f}`, s1.doc(`users/student1/study_states/new_${f}`).set({ status: "x", [f]: 1 }));
}
await deny("2b owner update touching reviewFailCount", s1.doc("users/student1/study_states/w_plain").update({ reviewFailCount: 9 }));
await deny("2c owner update touching reviewRestingUntil", s1.doc("users/student1/study_states/w_plain").update({ reviewRestingUntil: 1 }));

// ── CASE 3: legacy fields stay writable (inertness / cached-bundle proof) ────
await ok("3 owner update legacy lastTestedAt+status+masteredAt", s1.doc("users/student1/study_states/w_plain").update({ lastTestedAt: 123, status: "mastered", masteredAt: 456 }));

// ── CASE 4: the NINE server-owned subcollections — no client writes; reads keep the base branch ─
for (const sub of NINE) {
  await deny(`4a owner create ${sub}`, s1.doc(`users/student1/${sub}/forged`).set({ forged: true }));
  await deny(`4b owner update ${sub}`, s1.doc(`users/student1/${sub}/seeded`).update({ forged: true }));
  await deny(`4c owner delete ${sub}`, s1.doc(`users/student1/${sub}/seeded`).delete());
  await deny(`4d teacher write ${sub}`, t1.doc(`users/student1/${sub}/forged_t`).set({ forged: true }));
}
await ok("4e owner read review_queues", s1.doc("users/student1/review_queues/seeded").get());
await ok("4f teacher read review_queues", t1.doc("users/student1/review_queues/seeded").get());

// ── CASE 5 / 5b / 6: the new top-level surfaces ──────────────────────────────
await ok("5a authed (student) read system_config/review_v2", s1.doc("system_config/review_v2").get());
await deny("5b student write system_config/review_v2", s1.doc("system_config/review_v2").update({ enabled: true }));
await deny("5c teacher write system_config/review_v2", t1.doc("system_config/review_v2").update({ enabled: true }));
await ok("5b-1 teacher read ops_metrics", t1.doc("ops_metrics/o1").get());
await deny("5b-2 student read ops_metrics", s1.doc("ops_metrics/o1").get());
await deny("5b-3 teacher write ops_metrics", t1.doc("ops_metrics/o2").set({ kind: "x" }));
await ok("6a teacher read ai_metering", t1.doc("ai_metering/m1").get());
await deny("6b student read ai_metering", s1.doc("ai_metering/m1").get());
await deny("6c teacher write ai_metering", t1.doc("ai_metering/m1").update({ tokens: 0 }));
await deny("6d student read shadow_registry", s1.doc("shadow_registry/chunk0").get());
await deny("6e teacher read shadow_registry", t1.doc("shadow_registry/chunk0").get());
await deny("6f teacher write shadow_registry", t1.doc("shadow_registry/chunk1").set({ uids: [] }));

// ── CASE 7 (live-base form): override/engine keys are unforgeable on the LIVE write branches ─
for (const k of OVERRIDE_KEYS) {
  await deny(`7a student create attempt carrying ${k}`, s1.doc(`attempts/forge_${k}`).set({ studentId: "student1", [k]: true }));
}
await deny("7b teacher-of-record update adding teacherEdited", t1.doc("attempts/a1").update({ teacherEdited: true }));
await deny("7c teacher-of-record update adding preOverride", t1.doc("attempts/a1").update({ preOverride: { score: 80 } }));
await deny("7d teacher-of-record update adding gatePosture", t1.doc("attempts/a1").update({ gatePosture: { effectiveEnabled: true } }));
await deny("7e student update adding teacherEdited (answers-only law)", s1.doc("attempts/a1").update({ teacherEdited: true }));

// ── CASE 8: grading_jobs posture unchanged ───────────────────────────────────
await ok("8a owner read own grading_job", s1.doc("grading_jobs/gj1").get());
await deny("8b other student read grading_job", s2.doc("grading_jobs/gj1").get());
await deny("8c owner write grading_job", s1.doc("grading_jobs/gj1").update({ status: "forged" }));
await deny("8d teacher create grading_job", t1.doc("grading_jobs/gj2").set({ uid: "x" }));

// ── CASE 9: REGRESSION SWEEP — every pre-existing allow still passes ─────────
// users
await ok("9-u1 any authed read a user doc", s2.doc("users/student1").get());
await ok("9-u2 owner write own user doc", s1.doc("users/student1").update({ displayName: "S1b" }));
await ok("9-u3 teacher challenges-only update on student user doc", t1.doc("users/student1").update({ challenges: { c1: true } }));
await deny("9-u4 teacher non-challenges update on student user doc (base's own denial)", t1.doc("users/student1").update({ displayName: "hax" }));
// legacy progress subcollections — THE writes the P6 list must NOT capture
await ok("9-p1 owner write list_progress", s1.doc("users/student1/list_progress/c1_l1").update({ twi: 11 }));
await ok("9-p2 owner write class_progress", s1.doc("users/student1/class_progress/c1_l1").update({ csd: 4 }));
await ok("9-p3 owner write progress_meta", s1.doc("users/student1/progress_meta/c1_l1").update({ resetCount: 1 }));
await ok("9-p4 owner CREATE class_progress (new pairing)", s1.doc("users/student1/class_progress/c2_l2").set({ csd: 0 }));
await ok("9-p5 owner DELETE progress record (reset path)", s1.doc("users/student1/class_progress/c2_l2").delete());
await ok("9-p6 teacher write student list_progress (live grant)", t1.doc("users/student1/list_progress/c1_l1").update({ twi: 12 }));
await ok("9-p7 teacher read student subcollection", t1.doc("users/student1/class_progress/c1_l1").get());
// collection-group class_progress
await ok("9-cg1 teacher collection-group read class_progress", t1.collectionGroup("class_progress").get());
await deny("9-cg2 student collection-group read class_progress", s2.collectionGroup("class_progress").get());
// classes
await ok("9-c1 authed read class", s2.doc("classes/c1").get());
await ok("9-c2 teacher create class", t2.doc("classes/c2").set({ ownerTeacherId: "teacher2", studentCount: 0, studentIds: [] }));
await ok("9-c3 owner-teacher update class", t1.doc("classes/c1").update({ name: "C1b" }));
await ok("9-c4 student self-enroll diff (studentCount+studentIds)", s2.doc("classes/c1").update({ studentCount: 2, studentIds: ["student1", "student2"] }));
await deny("9-c5 student other-field class update (base's own denial)", s2.doc("classes/c1").update({ name: "hax" }));
await ok("9-c6 member self create", s2.doc("classes/c1/members/student2").set({ joinedAt: 2 }));
await ok("9-c7 member self delete", s2.doc("classes/c1/members/student2").delete());
await ok("9-c8 class-owner delete member", t1.doc("classes/c1/members/student1").delete());
await ok("9-c9 class-owner write class word", t1.doc("classes/c1/words/w2").set({ word: "banana" }));
await deny("9-c10 student write class word (base's own denial)", s1.doc("classes/c1/words/w3").set({ word: "hax" }));
await ok("9-c11 owner-teacher delete class", t2.doc("classes/c2").delete());
// lists
await ok("9-l1 authed read list", s1.doc("lists/l1").get());
await ok("9-l2 teacher create list", t2.doc("lists/l2").set({ ownerId: "teacher2" }));
await ok("9-l3 list-owner update", t1.doc("lists/l1").update({ name: "L1b" }));
await ok("9-l4 list-owner word write", t1.doc("lists/l1/words/w2").set({ word: "b", position: 1 }));
await deny("9-l5 non-owner word write (base's own denial)", t2.doc("lists/l1/words/w3").set({ word: "c" }));
await ok("9-l6 list-owner delete", t2.doc("lists/l2").delete());
// attempts — the live client flow (load-bearing until DF2-46)
await ok("9-a1 student create plain attempt", s1.doc("attempts/a2").set({ studentId: "student1", teacherId: "teacher1", score: 90, passed: true, answers: [], totalQuestions: 0 }));
await ok("9-a2 student read own attempt", s1.doc("attempts/a1").get());
await ok("9-a3 attempt-teacher read", t1.doc("attempts/a1").get());
await deny("9-a4 other student read attempt (base's own denial)", s2.doc("attempts/a1").get());
await ok("9-a5 student answers-only update (submitChallenge)", s1.doc("attempts/a1").update({ answers: [{ wordId: "w1", isCorrect: false, challengeStatus: "pending" }] }));
await deny("9-a6 student score update (base's own denial)", s1.doc("attempts/a1").update({ score: 100 }));
await ok("9-a7 teacher-of-record plain update (challenge review)", t1.doc("attempts/a1").update({ answers: [{ wordId: "w1", isCorrect: true }], score: 100 }));
await deny("9-a8 non-record teacher update (base's own denial)", t2.doc("attempts/a1").update({ score: 0 }));
await ok("9-a9 student delete own attempt (reset path)", s1.doc("attempts/a2").delete());
// system_logs
await ok("9-s1 authed create system_log", s1.doc("system_logs/log2").set({ event: "client" }));
await ok("9-s2 teacher read system_log", t1.doc("system_logs/log1").get());
await deny("9-s3 student read system_log (base's own denial)", s1.doc("system_logs/log1").get());
// apBoost
await ok("9-ap1 authed read ap_test", s1.doc("ap_tests/t1").get());
await ok("9-ap2 teacher write ap_test", t1.doc("ap_tests/t1").update({ name: "Macro2" }));
await deny("9-ap3 student write ap_test (base's own denial)", s1.doc("ap_tests/t1").update({ name: "hax" }));
await ok("9-ap4 authed read ap_question", s1.doc("ap_questions/q1").get());
await ok("9-ap5 authed read ap_stimulus", s1.doc("ap_stimuli/st1").get());
await ok("9-ap6 teacher read ap_answer_key", t1.doc("ap_answer_keys/q1").get());
await deny("9-ap7 student read ap_answer_key (base's own denial)", s1.doc("ap_answer_keys/q1").get());
await ok("9-ap8 session owner safe-field update", s1.doc("ap_session_state/sess1").update({ answers: { q1: "A" }, lastAction: "answer" }));
await deny("9-ap9 session owner unsafe-field update (base's own denial)", s1.doc("ap_session_state/sess1").update({ score: 5 }));
await deny("9-ap10 client session create (base's own denial)", s1.doc("ap_session_state/sess2").set({ userId: "student1" }));
await ok("9-ap11 result owner read", s1.doc("ap_test_results/r1").get());
await deny("9-ap12 result other-student read (base's own denial)", s2.doc("ap_test_results/r1").get());
await deny("9-ap13 client result create (base's own denial)", s1.doc("ap_test_results/r2").set({ userId: "student1" }));
await ok("9-ap14 result grading update by its teacher", t1.doc("ap_test_results/r1").update({ score: 4 }));
await deny("9-ap15 result update by other teacher (base's own denial)", t2.doc("ap_test_results/r1").update({ score: 0 }));
await ok("9-ap16 authed read ap_class", s1.doc("ap_classes/apc1").get());
await ok("9-ap17 teacher write ap_assignment", t1.doc("ap_assignments/apa1").update({ due: 1 }));

// ── CASE 2d: label erasure via update (FieldValue.delete) is also blocked ────
await deny("2d owner update REMOVING reviewFailCount (erasure-via-update)", s1.doc("users/student1/study_states/w_labeled").update({ reviewFailCount: firebase.firestore.FieldValue.delete() }));

// ── CASE U: unauthenticated access — everything requires auth ────────────────
await deny("U1 unauth read user doc", un.doc("users/student1").get());
await deny("U2 unauth read class", un.doc("classes/c1").get());
await deny("U3 unauth read list", un.doc("lists/l1").get());
await deny("U4 unauth read system_config/review_v2", un.doc("system_config/review_v2").get());
await deny("U5 unauth create system_log", un.doc("system_logs/anon").set({ event: "x" }));
await deny("U6 unauth read ap_test", un.doc("ap_tests/t1").get());
await deny("U7 unauth read attempt", un.doc("attempts/a1").get());

// ── CASE 9x: base denials DEEPFIX2 relies on staying denials ─────────────────
await deny("9x1 non-owner teacher class update (not self-enroll shape)", t2.doc("classes/c1").update({ name: "hax" }));
await deny("9x2 student create list (base's own denial)", s1.doc("lists/lx").set({ ownerId: "student1" }));
await deny("9x3 non-owner list update (base's own denial)", t2.doc("lists/l1").update({ name: "hax" }));
await deny("9x4 student create class (base's own denial)", s1.doc("classes/cx").set({ ownerTeacherId: "student1" }));

// ── CASE 3b [panel S2]: THE POST-BACKFILL SHAPE — legacy writes on a doc that
//    CARRIES labels must still pass (after GATE 4 every 26SM doc is labeled, so
//    this is the shape every live client writer will hit).
await ok("3b owner merge-writes legacy fields on a LABEL-CARRYING study_state", s1.doc("users/student1/study_states/w_labeled").set({ status: "PASSED", lastTestedAt: 123, timesTestedTotal: 4 }, { merge: true }));
await ok("3c teacher merge-writes legacy fields on a LABEL-CARRYING study_state (reviewChallenge shape)", t1.doc("users/student1/study_states/w_labeled").set({ status: "PASSED", lastTestedAt: 456 }, { merge: true }));
await deny("3d full-overwrite set() (NO merge) on a labeled doc drops labels ⇒ DENY", s1.doc("users/student1/study_states/w_labeled").set({ status: "learning" }));
await deny("3e create carrying a label ALONGSIDE legacy fields", s1.doc("users/student1/study_states/w_mixed").set({ status: "learning", lastTestedAt: 1, reviewFailCount: 0 }));
await deny("3f update touching TWO labels at once", s1.doc("users/student1/study_states/w_multi").update({ reviewFailCount: 0, reviewRestingUntil: 0 }));
await deny("3g delete a MULTI-label doc", s1.doc("users/student1/study_states/w_multi").delete());
// [ledger C2] the legacy client reset path deletes a WHOLE LIST of study_states
// in one batch. A batch is atomic, so a mixed set (plain + labeled) must fail as
// a unit — this is the shape that breaks a >2-week-old cached tab after GATE 4.
await ok("3h seed a plain doc for the mixed-batch case", s1.doc("users/student1/study_states/w_batch_plain").set({ status: "learning" }));
await deny("3i MIXED BATCH delete (plain + labeled) fails as a unit", (() => {
  const batch = s1.batch();
  batch.delete(s1.doc("users/student1/study_states/w_batch_plain"));
  batch.delete(s1.doc("users/student1/study_states/w_labeled"));
  return batch.commit();
})());
await ok("3j the plain doc survived the refused batch (atomicity)", s1.doc("users/student1/study_states/w_batch_plain").get());

// ── CASE R [panel F1]: role is CREATE-ONLY — no self-elevation ──────────────
await deny("R1 student promotes self to teacher", s1.doc("users/student1").update({ role: "teacher" }));
await deny("R2 student promotes self via set-merge", s1.doc("users/student1").set({ role: "teacher" }, { merge: true }));
await deny("R3 teacher demotes another user (challenges-only branch)", t1.doc("users/student2").update({ role: "student", displayName: "x" }));
await ok("R4 owner updates OTHER user-doc fields (unchanged)", s1.doc("users/student1").update({ displayName: "S1c" }));
await ok("R5 owner write that RESTATES the same role value (seeder shape)", s1.doc("users/student1").set({ role: "student", displayName: "S1d" }, { merge: true }));
await deny("R6 student writes enrolledClasses→teacher role in one op", s1.doc("users/student1").update({ role: "teacher", enrolledClasses: { c1: true } }));
// [panel r2 BLOCKER] the delete-then-recreate bypass: with delete open, a
// student could drop their own user doc and recreate it as a teacher. Both
// halves are pinned, and the SECOND is the one that used to be unasserted.
await deny("R7 student DELETES own user doc (the bypass's first call)", s1.doc("users/student1").delete());
await deny("R8 third party deletes another user's doc", s2.doc("users/student1").delete());
await deny("R9 teacher deletes a student's user doc", t1.doc("users/student1").delete());
await ok("R10 a genuinely NEW account creates its own doc (signup, incl. the teacher radio)", env.authenticatedContext("newuser1").firestore().doc("users/newuser1").set({ role: "teacher", email: "n@x.com" }));
await deny("R11 create someone ELSE's user doc", s1.doc("users/victim").set({ role: "student" }));

// ── CASE E [panel F2/F3]: the server-only reset/epoch fence is unwritable ────
await deny("E1 owner writes resetAt to progress_meta (backfill-fence laundering)", s1.doc("users/student1/progress_meta/c1_l1").update({ resetAt: 999 }));
await deny("E2 owner bumps resetEpoch (forks the day_completions CAS namespace)", s1.doc("users/student1/progress_meta/fenced").update({ resetEpoch: 7 }));
await deny("E3 owner sets resetInProgress (engine self-DoS)", s1.doc("users/student1/progress_meta/fenced").update({ resetInProgress: true }));
await deny("E4 owner sets resetEpoch on list_progress (the other max() input)", s1.doc("users/student1/list_progress/c1_l1").update({ resetEpoch: 7 }));
await deny("E5 owner CREATES a progress doc pre-seeded with a reset fence", s1.doc("users/student1/progress_meta/forged").set({ resetEpoch: 9, resetAt: 1 }));
await ok("E6 owner writes NON-fence fields on the same doc (unchanged)", s1.doc("users/student1/progress_meta/fenced").update({ someLegacyField: 1 }));
// [panel r3 BLOCKER] guarding create+update alone left DELETE-then-recreate as a
// clean bypass. The whole set, not just the direct write:
await deny("E7 owner DELETES a fenced progress_meta doc", s1.doc("users/student1/progress_meta/fenced").delete());
await deny("E8 owner DELETES a fenced list_progress doc", s1.doc("users/student1/list_progress/fenced_lp").delete());
await deny("E9 TEACHER deletes another student's fenced doc", t1.doc("users/student1/progress_meta/fenced").delete());
await deny("E10 owner deletes a study_state carrying resetEpoch (no six-label)", s1.doc("users/student1/study_states/w_fenced").delete());
await ok("E11 the fenced doc still EXISTS after the refused deletes (the bypass is dead)", s1.doc("users/student1/progress_meta/fenced").get());
await ok("E12 deleting an UNFENCED progress doc still works (live reset path preserved)", s1.doc("users/student1/class_progress/c2_l2b").set({ csd: 0 }).then(() => s1.doc("users/student1/class_progress/c2_l2b").delete()));
// [panel r3 BLOCKER-2] the attempts guard now names the marker the LIVE writers stamp.
await deny("A3 student deletes an attempt carrying manualOverride (the real CS/override marker)", s1.doc("attempts/a_manual").delete());

// ── CASE A [panel F5]: attempts erasure guard ───────────────────────────────
await deny("A1 student deletes a STAMPED attempt (override/posture erasure)", s1.doc("attempts/a_stamped").delete());
await ok("A2 student deletes a PLAIN attempt (live reset path preserved)", s1.doc("attempts/a1").get().then(() => s1.doc("attempts/a2p").set({ studentId: "student1" })).then(() => s1.doc("attempts/a2p").delete()));

// ── CASE T [panel F9]: third-party student — the owner model's base denial ──
await deny("T1 other student reads student1's study_states", s2.doc("users/student1/study_states/w_plain").get());
await deny("T2 other student writes student1's study_states", s2.doc("users/student1/study_states/w_plain").update({ status: "hax" }));
await deny("T3 other student writes student1's class_progress", s2.doc("users/student1/class_progress/c1_l1").update({ csd: 99 }));
await deny("T4 other student reads student1's review_queues", s2.doc("users/student1/review_queues/seeded").get());

// ── CASE G [panel F9]: collection-group reads of the server subcollections ──
await deny("G1 collection-group read review_queues", s1.collectionGroup("review_queues").get());
await deny("G2 collection-group read day_completions", s1.collectionGroup("day_completions").get());
await deny("G3 collection-group read study_states", s1.collectionGroup("study_states").get());

// ── CASE N [panel F9]: unauth writes to the guarded surfaces ────────────────
await deny("N1 unauth create in a server subcollection", un.doc("users/student1/review_queues/anon").set({ x: 1 }));
await deny("N2 unauth create a label-carrying study_state", un.doc("users/student1/study_states/anon").set({ reviewFailCount: 0 }));

// ── CASE S [panel F9]: reads of the OTHER eight subcollections + literal-doc match ─
for (const sub of NINE.filter((x) => x !== "review_queues")) {
  await ok(`S-r owner reads ${sub}`, s1.doc(`users/student1/${sub}/seeded`).get());
}
await deny("S1 write to system_config/{not-review_v2} (literal-doc match)", s1.doc("system_config/other").set({ x: 1 }));
await deny("S2 read system_config/{not-review_v2}", s1.doc("system_config/other").get());
await deny("S3 write a subcollection under ai_metering", t1.doc("ai_metering/m1/sub/x").set({ x: 1 }));

// ── CASE 10: pool-forgery inertness — legacy pool fields still owner-writable ─
// DEFERRED-SURFACE ACKNOWLEDGEMENT (not an inertness proof) [panel F3]: the
// spec's claim that "composition reads only reviewRestingUntil/day_completions"
// is FALSE — progress.js:62-70 reads currentStudyDay/totalWordsIntroduced (the
// frontier + review-universe authority) from the client-writable durable
// progress doc. csd/twi therefore remain FORGEABLE by their owner; that is the
// live legacy posture and its closure is carded to P6/DF2-46, NOT to this file.
// (The reset/epoch half of that surface IS closed here — see CASE E.)
await ok("10a owner writes status/masteredAt still pass (legacy display fields)", s1.doc("users/student1/study_states/w_plain").update({ status: "learning", masteredAt: 999 }));
await ok("10b DEFERRED: owner still writes csd/twi (P6/DF2-46 closes this, not this ruleset)", s1.doc("users/student1/class_progress/c1_l1").update({ currentStudyDay: 7, totalWordsIntroduced: 70 }));

await env.cleanup();

console.log(`\nRULES MATRIX [rules sha256 ${createHash("sha256").update(readFileSync(RULES_PATH, "utf8")).digest("hex").slice(0, 16)}]: ${pass}/${pass + fail} green`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
