/**
 * M-RULES — `lsr_deepfix_rules.mjs`
 * ============================================================================
 * Firestore SECURITY-RULES probes for the deepfix P6-cutoff + P10c/P10d rules,
 * run against the FIREBASE EMULATOR (firestore+auth) on Codex's Windows env per
 * the CONFIRMED model in
 *   docs/plans/loop/codex_reviews/codex_deepfix_task6_emulator_probe_001.md
 * and the oracles in audit/deepfix/task4/AUDIT_DESIGN.md §1.G (RUL-1..9) + §1.K (OV-6).
 *
 * The rules ENGINE only sees requests made AS a client identity (the Admin SDK
 * bypasses rules — useless for denial oracles). So, per Codex's model:
 *   1. Admin SDK SEEDS the fixtures (bypasses rules).
 *   2. Auth-emulator REST creates sandbox users → ID tokens (teachers get the
 *      P10d custom claim {role:'teacher'} via Admin, then re-sign-in).
 *   3. Firestore REST requests carry `Authorization: Bearer <token>` → we assert
 *      the EXACT status code (403 = denied forgery, 200 = allowed happy path).
 *
 * ARTIFACT UNDER TEST: the WORKING-TREE `firestore.rules` (the P10d END-STATE:
 * P6 cutoff + P10c teacherIds read clause + P10d claim/narrowings) — the default.
 * To probe an earlier STAGE, copy audit/deepfix/task3/firestore.p6.rules (or
 * .p10c.rules) over firestore.rules BEFORE `emulators:exec` (the emulator loads
 * firebase.json's "rules": "firestore.rules"); the manifest binds sha256(rules).
 *
 * HOW CODEX RUNS IT (flag-on → emulators:exec → restore — see CODEX_RUNBOOK.md):
 *   node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=rules --exec \
 *     "firebase emulators:exec --only firestore,auth --project demo-vocaboost \
 *        \"node audit/playwright/lsr_deepfix_rules.mjs <runId>\""
 *
 * FAIL-CLOSED: refuses to run unless FIRESTORE_EMULATOR_HOST is set (INVALID, never
 * prod). Sandbox identities only. Nonzero exit on any FAIL/INVALID/emulator-not-detected.
 * ============================================================================
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  detectEmulator, EMU_PROJECT, REPO, Matrix, adb, makeStudent, makeTeacher, signUp,
  assertSandboxTarget, SANDBOX_CLASS_PREFIX, SANDBOX_LIST_PREFIX, cleanId,
  restGet, restCreate, restUpdate, restDelete, pass, fail, expect,
} from './lsr_deepfix_emu.mjs';

const RUN_ID = (process.argv[2] || `${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '');
const CLEAN = cleanId(RUN_ID); // underscore-free slug for id components (testId-parse safe)
const T = () => admin.firestore.Timestamp.now();
const P = EMU_PROJECT;
const DENIED = 403; const OK = 200;

// ── Emulator-presence guard (fail-closed) ──
const emu = detectEmulator();
if (!emu.ok) {
  const m = new Matrix({ matrix: 'rules', runId: RUN_ID, emu });
  m.record({ id: 'PREFLIGHT', scenario: 'emulator detected', expected: 'FIRESTORE_EMULATOR_HOST set (emulator)', actual: emu.reason, verdict: 'INVALID', evidence: emu.reason });
  m.finish();
  process.exit(1);
}

console.log(`\n=== M-RULES (${RUN_ID}) — emulator ${emu.project} firestore=${emu.firestoreHost} auth=${emu.authHost} ===\n`);
const M = new Matrix({ matrix: 'rules', runId: RUN_ID, emu });

// ── Rules-artifact preflight: confirm the loaded firestore.rules IS a cutoff artifact
//    (P6 attempts create:false + P10d custom-claim isTeacher). A stale/pre-P6 rules file
//    ⇒ the denial oracles are meaningless ⇒ INVALID (never a false PASS). ──
const rulesText = existsSync(resolve(REPO, 'firestore.rules')) ? readFileSync(resolve(REPO, 'firestore.rules'), 'utf8') : '';
const hasCreateFalse = /match \/attempts\/\{attemptId\}[\s\S]*?allow create: if false;/.test(rulesText);
const hasClaimTeacher = /request\.auth\.token\.role == 'teacher'/.test(rulesText);
if (!hasCreateFalse || !hasClaimTeacher) {
  M.record({
    id: 'PREFLIGHT', scenario: 'rules artifact is the P6/P10d cutoff',
    expected: 'attempts create:false AND claim-based isTeacher()',
    actual: `createFalse=${hasCreateFalse} claimTeacher=${hasClaimTeacher}`,
    verdict: 'INVALID',
    evidence: 'firestore.rules is not the deepfix cutoff artifact — the emulator loaded a stale/pre-P6 ruleset (denial oracles would be meaningless).',
  });
  M.finish();
  process.exit(1);
}

// ── Shared sandbox identities ──
const student = await makeStudent(`lsr_rules_student_${RUN_ID}@vocaboost.test`);
const teacherA = await makeTeacher(`lsr_rules_teacherA_${RUN_ID}@vocaboost.test`); // stamp/owner, carries claim
const teacherOut = await makeTeacher(`lsr_rules_teacherOut_${RUN_ID}@vocaboost.test`); // unrelated teacher (claim, but no relation)
await adb().doc(`users/${student.uid}`).set({ role: 'student', email: student.email, displayName: 'Rules Student' });
await adb().doc(`users/${teacherA.uid}`).set({ role: 'teacher', email: teacherA.email });

const classId = `${SANDBOX_CLASS_PREFIX}${CLEAN}rules`;
const listId = `${SANDBOX_LIST_PREFIX}${CLEAN}rules`;
assertSandboxTarget({ classId, listId });
await adb().doc(`classes/${classId}`).set({ name: '25WT rules', ownerTeacherId: teacherA.uid, studentIds: [student.uid], assignments: { [listId]: { pace: 20, passThreshold: 90 } } });

// A seeded, owned attempt (studentId=student, teacherId=teacherA) for the update/delete/read probes.
const seededAttemptId = `${student.uid}_${classId}_${listId}_day1_new`;
await adb().doc(`attempts/${seededAttemptId}`).set({
  studentId: student.uid, teacherId: teacherA.uid, classId, listId,
  testId: `vocaboost_test_${classId}_${listId}_new`, sessionType: 'new', testType: 'mcq',
  studyDay: 1, passed: true, score: 100, newWordStartIndex: 0, newWordEndIndex: 19,
  answers: [{ wordId: 'w1', isCorrect: true }], submittedAt: T(), writtenBy: 'seed',
});

// ════════════════════════════════════════════════════════════════════════════
// RUL-1 — W3: student attempt create:false ⇒ forged attempt DENIED
// ════════════════════════════════════════════════════════════════════════════
await M.run('RUL-1', 'student direct attempt-create (forged passed:true,score:100) ⇒ PERMISSION_DENIED', async () => {
  const forgedId = `${student.uid}_${classId}_${listId}_forged`;
  const r = await restCreate(P, 'attempts', forgedId, { studentId: student.uid, classId, listId, passed: true, score: 100, newWordEndIndex: 999 }, student.idToken);
  return expect(r.status === DENIED, `HTTP ${DENIED}`, `HTTP ${r.status}`, 'attempts allow create: if false');
});

// RUL-2 — W3: student answers-update branch REMOVED ⇒ answers update DENIED
await M.run('RUL-2', 'student answers-update on OWN attempt ⇒ PERMISSION_DENIED (update:false)', async () => {
  const r = await restUpdate(P, `attempts/${seededAttemptId}`, { answers: [{ wordId: 'w1', isCorrect: true, challengeStatus: 'accepted' }] }, student.idToken);
  return expect(r.status === DENIED, `HTTP ${DENIED}`, `HTTP ${r.status}`, 'attempts allow update: if false');
});

// RUL-3 — Owner attempt-delete REMOVED (the C-31 anchor-erasure half) ⇒ delete DENIED
await M.run('RUL-3', 'owner attempt-delete ⇒ PERMISSION_DENIED (delete:false — C-31 anchor-erasure closed)', async () => {
  const r = await restDelete(P, `attempts/${seededAttemptId}`, student.idToken);
  return expect(r.status === DENIED, `HTTP ${DENIED}`, `HTTP ${r.status}`, 'attempts allow delete: if false');
});

// RUL-4 — Client progress writes DENIED for class_progress / list_progress / progress_meta (the forged-storedTWI half of C-31)
await M.run('RUL-4', 'client progress writes to class_progress + list_progress + progress_meta ⇒ all PERMISSION_DENIED', async () => {
  const cp = await restUpdate(P, `users/${student.uid}/class_progress/${classId}_${listId}`, { totalWordsIntroduced: 999, currentStudyDay: 99 }, student.idToken);
  const lp = await restUpdate(P, `users/${student.uid}/list_progress/${listId}`, { totalWordsIntroduced: 999, currentStudyDay: 99 }, student.idToken);
  const pm = await restUpdate(P, `users/${student.uid}/progress_meta/${listId}`, { resetEpoch: 99 }, student.idToken);
  const ok = cp.status === DENIED && lp.status === DENIED && pm.status === DENIED;
  return expect(ok, 'all three HTTP 403', `class_progress=${cp.status} list_progress=${lp.status} progress_meta=${pm.status}`, 'users subcollection write excludes the 3 progress collections');
});

// RUL-5 — M8 role split-by-op: owner UPDATE touching `role` DENIED; profile update (no role) ALLOWED
await M.run('RUL-5', 'M8 role split: role-update ⇒ DENIED; displayName-update (no role key) ⇒ ALLOWED', async () => {
  const roleUpd = await restUpdate(P, `users/${student.uid}`, { role: 'teacher' }, student.idToken);
  const profUpd = await restUpdate(P, `users/${student.uid}`, { displayName: 'Renamed OK' }, student.idToken);
  const ok = roleUpd.status === DENIED && profUpd.status === OK;
  return expect(ok, `role=${DENIED}, profile=${OK}`, `role=${roleUpd.status} profile=${profUpd.status}`, 'update: isOwner && !affectedKeys.hasAny([role,roleProvisioning])');
});

// RUL-6 — M8 create: self-create role:'teacher' DENIED; role:'student'/absent ALLOWED (fresh uids)
await M.run('RUL-6', 'self-create role:teacher ⇒ DENIED; role:student ⇒ ALLOWED (fresh sandbox uids)', async () => {
  const t = await signUp(`lsr_rul6_teacher_${RUN_ID}@vocaboost.test`);
  const s = await signUp(`lsr_rul6_student_${RUN_ID}@vocaboost.test`);
  const denyTeacher = await restCreate(P, 'users', t.uid, { role: 'teacher', email: t.email }, t.idToken);
  const allowStudent = await restCreate(P, 'users', s.uid, { role: 'student', email: s.email }, s.idToken);
  const ok = denyTeacher.status === DENIED && allowStudent.status === OK;
  return expect(ok, `teacher-create=${DENIED}, student-create=${OK}`, `teacher=${denyTeacher.status} student=${allowStudent.status}`, 'create: isOwner && (no role || role==student)');
});

// RUL-7 — Happy paths PASS: owner reads, teacher-of-record reads, teacher(claim) reads student progress subcollection
await M.run('RUL-7', 'happy reads: owner reads own attempt(200), teacher-of-record reads(200), teacher-claim reads list_progress(200)', async () => {
  // seed a student list_progress doc (server-owned; a teacher must be able to READ it)
  await adb().doc(`users/${student.uid}/list_progress/${listId}`).set({ listId, currentStudyDay: 3, totalWordsIntroduced: 40 });
  const stranger = await signUp(`lsr_rul7_other_${RUN_ID}@vocaboost.test`); // a different (non-teacher) student
  const ownerRead = await restGet(P, `attempts/${seededAttemptId}`, student.idToken);
  const teacherStampRead = await restGet(P, `attempts/${seededAttemptId}`, teacherA.idToken);
  const teacherProgressRead = await restGet(P, `users/${student.uid}/list_progress/${listId}`, teacherA.idToken); // via isTeacher() claim
  const strangerProgressRead = await restGet(P, `users/${student.uid}/list_progress/${listId}`, stranger.idToken);
  const ok = ownerRead.status === OK && teacherStampRead.status === OK && teacherProgressRead.status === OK && strangerProgressRead.status === DENIED;
  return expect(ok, 'owner=200, teacher-stamp=200, teacher-claim=200, stranger=403', `owner=${ownerRead.status} teacherStamp=${teacherStampRead.status} teacherClaim=${teacherProgressRead.status} stranger=${strangerProgressRead.status}`);
});

// RUL-8 — Signup persona (F4-3): self-select-Teacher signup DENIED; provisioning path yields a legit teacher (Admin-set, readable)
await M.run('RUL-8', 'signup: client self-select teacher ⇒ DENIED; provisioning (Admin) yields role:teacher (readable)', async () => {
  const su = await signUp(`lsr_rul8_signup_${RUN_ID}@vocaboost.test`);
  const selfTeacher = await restCreate(P, 'users', su.uid, { role: 'teacher', email: su.email }, su.idToken); // client self-select — DENIED
  // Provisioning path is Admin-SDK (bypasses rules); assert the provisioned teacher doc exists with role:teacher and is READABLE.
  const provUid = teacherA.uid; // provisioned above via Admin (role:teacher)
  const provRead = await restGet(P, `users/${provUid}`, student.idToken);
  const provDoc = (await adb().doc(`users/${provUid}`).get()).data();
  const ok = selfTeacher.status === DENIED && provRead.status === OK && provDoc?.role === 'teacher';
  return expect(ok, 'self-select=403; provisioned teacher role:teacher + readable(200)', `selfSelect=${selfTeacher.status} provRead=${provRead.status} provRole=${provDoc?.role}`);
});

// RUL-9 — M4 composite: a forged anchor attempt cannot enter by the CLIENT path (create denied). (Callable clamp = CS-6.)
await M.run('RUL-9', 'M4 composite (rules arm): forged-anchor client attempt-create ⇒ DENIED (callable-clamp arm = CS-6)', async () => {
  const forgedId = `${student.uid}_${classId}_${listId}_m4forged`;
  const r = await restCreate(P, 'attempts', forgedId, { studentId: student.uid, classId, listId, sessionType: 'new', passed: true, score: 100, newWordStartIndex: 999, newWordEndIndex: 1020, studyDay: 1 }, student.idToken);
  return expect(r.status === DENIED, `HTTP ${DENIED} (create denied)`, `HTTP ${r.status}`, 'RUL-1 create:false starves the forged anchor; CS-6 M4-clamps the callable path — composite closes both.');
});

// ════════════════════════════════════════════════════════════════════════════
// OV-6 — P10 rules narrowing: outsider-teacher subcollection write DENIED; teacherIds additive read ALLOWED
// ════════════════════════════════════════════════════════════════════════════
await M.run('OV-6w', 'P10d narrowing: outsider-teacher direct write to student study_states ⇒ DENIED (write narrowed isTeacher→isOwner)', async () => {
  const r = await restUpdate(P, `users/${student.uid}/study_states/wZ`, { status: 'PASSED' }, teacherOut.idToken);
  return expect(r.status === DENIED, `HTTP ${DENIED}`, `HTTP ${r.status}`, 'subcollection write: !(progress) && isOwner — teacher breadth dropped (P10d)');
});
await M.run('OV-6r', 'P10c additive read: teacher listed in attempt.teacherIds ⇒ READ ALLOWED; unrelated teacher ⇒ DENIED', async () => {
  const teacherB = await makeTeacher(`lsr_ov6_teacherB_${RUN_ID}@vocaboost.test`); // in teacherIds
  const inheritedId = `${student.uid}_${classId}_${listId}_inherited`;
  await adb().doc(`attempts/${inheritedId}`).set({
    studentId: student.uid, teacherId: teacherA.uid, teacherIds: [teacherA.uid, teacherB.uid], classId, listId,
    sessionType: 'new', passed: true, score: 100, newWordEndIndex: 39, submittedAt: T(), writtenBy: 'seed',
  });
  const inArray = await restGet(P, `attempts/${inheritedId}`, teacherB.idToken); // uid ∈ teacherIds ⇒ allow
  const unrelated = await restGet(P, `attempts/${inheritedId}`, teacherOut.idToken); // not stamp, not in teacherIds, not student
  const ok = inArray.status === OK && unrelated.status === DENIED;
  return expect(ok, 'teacherIds-member read=200, unrelated teacher read=403', `member=${inArray.status} unrelated=${unrelated.status}`, "attempts read: studentId== || teacherId== || (teacherIds in data && uid in teacherIds)");
});

// ── Finish + fail-closed exit ──
const { clean } = M.finish();
process.exit(clean ? 0 : 1);
