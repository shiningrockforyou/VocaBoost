/**
 * Rules-unit tests for the attempts write lockdown (W3) — PLAN_attempt_write_lockdown.md.
 *
 * These prove the SECURITY CORE that Playwright can't: a direct-API attacker cannot forge a grade.
 *
 * IMPORTANT: W3 is STAGED (docs/plans/W3_attempts_lockdown.rules.md), NOT yet in the live
 * `firestore.rules`. This test loads `firestore.rules` as-is, so:
 *   - Run it BEFORE applying W3 → the "denied" cases will FAIL (current rules still allow them).
 *     That failure is the correct signal that the lockdown is not yet applied.
 *   - Run it AFTER applying the W3 block → all cases pass. (This is the gate to validate W3 before deploy.)
 *
 * Setup:
 *   npm i -D @firebase/rules-unit-testing
 *   firebase emulators:exec --only firestore "node --test firestore-tests/attempts_lockdown.rules.test.js"
 */
import { readFileSync } from "node:fs";
import { test, before, after, beforeEach } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, setDoc, updateDoc, deleteDoc, getDoc,
} from "firebase/firestore";

const STU = "student_1";
const STU2 = "student_2";
const TEACHER = "teacher_1";
const OTHER_TEACHER = "teacher_2";
const ATTEMPT_ID = "attempt_1";

let testEnv;

function attemptDoc(overrides = {}) {
  return {
    studentId: STU,
    teacherId: TEACHER,
    classId: "class_1",
    listId: "list_1",
    testType: "typed",
    sessionType: "new",
    score: 50,
    passed: false,
    answers: [{ wordId: "w1", isCorrect: false, studentResponse: "x" }],
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "vocaboost-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed with rules bypassed: the attempt + the teacher's user doc (isTeacher() reads users/{uid}.role).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "attempts", ATTEMPT_ID), attemptDoc());
    await setDoc(doc(db, "users", TEACHER), { role: "teacher" });
    await setDoc(doc(db, "users", OTHER_TEACHER), { role: "teacher" });
    await setDoc(doc(db, "users", STU), { role: "student" });
  });
});

const asStudent = () => testEnv.authenticatedContext(STU).firestore();
const asStudent2 = () => testEnv.authenticatedContext(STU2).firestore();
const asTeacher = () => testEnv.authenticatedContext(TEACHER).firestore();
const asOtherTeacher = () => testEnv.authenticatedContext(OTHER_TEACHER).firestore();

// --- CREATE: server-only (create:false) ---
test("student CANNOT create an attempt (even with own studentId / passed:true)", async () => {
  const db = asStudent();
  await assertFails(setDoc(doc(db, "attempts", "forged_create"),
    attemptDoc({ passed: true, score: 100 })));
});

// --- UPDATE: student answers-branch removed ---
test("student CANNOT update answers (forge isCorrect)", async () => {
  const db = asStudent();
  await assertFails(updateDoc(doc(db, "attempts", ATTEMPT_ID), {
    answers: [{ wordId: "w1", isCorrect: true, studentResponse: "x" }],
  }));
});

test("student CANNOT update score/passed directly", async () => {
  const db = asStudent();
  await assertFails(updateDoc(doc(db, "attempts", ATTEMPT_ID), { score: 100, passed: true }));
});

// --- UPDATE: teacher-of-record allowed; others denied ---
test("teacher-of-record CAN update the attempt", async () => {
  const db = asTeacher();
  await assertSucceeds(updateDoc(doc(db, "attempts", ATTEMPT_ID), { score: 80, passed: true }));
});

test("a different teacher (not teacherId of record) CANNOT update", async () => {
  const db = asOtherTeacher();
  await assertFails(updateDoc(doc(db, "attempts", ATTEMPT_ID), { score: 80 }));
});

// --- DELETE: student reset still allowed ---
test("student CAN delete their own attempt (progress reset)", async () => {
  const db = asStudent();
  await assertSucceeds(deleteDoc(doc(db, "attempts", ATTEMPT_ID)));
});

test("a different student CANNOT delete someone else's attempt", async () => {
  const db = asStudent2();
  await assertFails(deleteDoc(doc(db, "attempts", ATTEMPT_ID)));
});

// --- READ: own / teacher-of-record allowed; other student denied ---
test("student reads their own attempt; teacher-of-record reads it; other student cannot", async () => {
  await assertSucceeds(getDoc(doc(asStudent(), "attempts", ATTEMPT_ID)));
  await assertSucceeds(getDoc(doc(asTeacher(), "attempts", ATTEMPT_ID)));
  await assertFails(getDoc(doc(asStudent2(), "attempts", ATTEMPT_ID)));
});
