#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — rules-matrix.mjs: THE 10-CASE EMULATOR MATRIX (17_ §7b step 3)
 * ============================================================================
 * Runs the frozen case list (firestore.review_v2.rules:111-126) against the
 * MERGED artifact audit/deepfix/task3/live_baseline/firestore.merged.rules —
 * never against the spec fragment, never against the repo's firestore.rules.
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
 * Run (from /app; scratch dir carries its own firebase.json so /app's
 * firebase.json → firestore.rules P10 draft is never loaded):
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
  catch (e) { fail++; failures.push(`DENY-expected ALLOWED: ${name}`); }
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

// ── CASE 10: pool-forgery inertness — legacy pool fields still owner-writable ─
await ok("10 owner writes status/masteredAt still pass (composition ignores them — server half rides DF2-10's unit matrix)", s1.doc("users/student1/study_states/w_plain").update({ status: "learning", masteredAt: 999 }));

await env.cleanup();

console.log(`\nRULES MATRIX [rules sha256 ${createHash("sha256").update(readFileSync(RULES_PATH, "utf8")).digest("hex").slice(0, 16)}]: ${pass}/${pass + fail} green`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
