/**
 * M-CALL — `lsr_deepfix_callable.mjs`
 * ============================================================================
 * Authenticated callable probes for the deepfix foundation server surface, run
 * against the FIREBASE EMULATOR (functions+firestore+auth) on Codex's Windows env
 * per the CONFIRMED model in
 *   docs/plans/loop/codex_reviews/codex_deepfix_task6_emulator_probe_001.md
 * and the scenario oracles in audit/deepfix/task4/AUDIT_DESIGN.md §1.D (CS-1..11),
 * §1.J (CY-3), §1.K (OV-1..3).
 *
 * HOW CODEX RUNS IT (flag-on → emulators:exec → restore — see CODEX_RUNBOOK.md):
 *   node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --exec \
 *     "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost \
 *        \"node audit/playwright/lsr_deepfix_callable.mjs <runId>\""
 *   (CI=true FIREBASE_CLI_DISABLE_UPDATE_CHECK=true NO_UPDATE_NOTIFIER=1; sequential.)
 *
 * The matrix runs as the CHILD of emulators:exec, so FIRESTORE_EMULATOR_HOST /
 * FIREBASE_AUTH_EMULATOR_HOST are already set and the functions emulator is live.
 * It SEEDS with the Admin SDK, INVOKES callables with callable-protocol JSON +
 * Auth-emulator bearer tokens, and asserts the response/side-effect oracles.
 *
 * FAIL-CLOSED: refuses to run unless FIRESTORE_EMULATOR_HOST is set (INVALID, never
 * prod). Sandbox identities only. Nonzero exit on any FAIL/INVALID/emulator-not-detected.
 * ============================================================================
 */
import admin from 'firebase-admin';
import {
  detectEmulator, EMU_PROJECT, Matrix, adb, makeStudent,
  assertSandboxTarget, SANDBOX_CLASS_PREFIX, SANDBOX_LIST_PREFIX, cleanId,
  callFn, countLogs, readFlagState, pass, fail, skip, expect,
} from './lsr_deepfix_emu.mjs';

const RUN_ID = (process.argv[2] || `${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '');
const CLEAN = cleanId(RUN_ID); // underscore-free slug for id components (testId-parse safe)
const T = () => admin.firestore.Timestamp.now();
const nowMs = Date.now();

// ── Emulator-presence guard (fail-closed) ──
const emu = detectEmulator();
if (!emu.ok) {
  const m = new Matrix({ matrix: 'call', runId: RUN_ID, emu });
  m.record({ id: 'PREFLIGHT', scenario: 'emulator detected', expected: 'FIRESTORE_EMULATOR_HOST set (emulator)', actual: emu.reason, verdict: 'INVALID', evidence: emu.reason });
  m.finish();
  process.exit(1);
}

console.log(`\n=== M-CALL (${RUN_ID}) — emulator ${emu.project} firestore=${emu.firestoreHost} functions=${emu.cfHost} ===\n`);
const M = new Matrix({ matrix: 'call', runId: RUN_ID, emu });

// ── Flag-on preflight: the callables are DORMANT behind server flags; if the flag-on
//    helper was not applied they all throw `failed-precondition` (noise, not signal). ──
const FL = readFlagState();
const REQUIRED = [
  'SERVER_COMPLETE_SESSION_ENABLED', 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED',
  'SERVER_RESET_PROGRESS_ENABLED', 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED',
  'LIST_PROGRESS_CANONICAL', 'ANCHOR_VALIDATION_ENFORCE',
  'SERVER_REVIEW_CHALLENGE_ENABLED', 'SERVER_OVERRIDE_ENABLED',
];
const offFlags = REQUIRED.filter((k) => FL[k] !== true);
if (offFlags.length > 0) {
  M.record({
    id: 'PREFLIGHT', scenario: 'flag-on state applied',
    expected: `${REQUIRED.join(', ')} all true`,
    actual: `OFF: ${offFlags.join(', ')}`,
    verdict: 'INVALID',
    evidence: 'Run under `lsr_deepfix_flag_on.mjs --matrix=call --exec "..."` so the emulator loads the flag-ON functions.',
  });
  M.finish();
  process.exit(1);
}

// ── Shared teacher identity (authenticated + role:'teacher' USER DOC — the callables
//    authorize on the doc field, NOT the rules claim). ──
const TEACHER = await makeStudent(`lsr_teacher_${RUN_ID}@vocaboost.test`);
await adb().doc(`users/${TEACHER.uid}`).set({ role: 'teacher', displayName: 'LSR Teacher', email: TEACHER.email });

// ── Seed helpers (Admin SDK; every id is sandbox-shaped) ──
async function fixture(tag, opts = {}) {
  const { csd = 0, twi = 0, wordCount = 100, recentSessions = [], cyclingEnabled = false, canonical = true, ownerTeacherId = TEACHER.uid } = opts;
  const student = await makeStudent(`lsr_${tag}_${RUN_ID}@vocaboost.test`);
  const classId = `${SANDBOX_CLASS_PREFIX}${CLEAN}${tag}`;
  const listId = `${SANDBOX_LIST_PREFIX}${CLEAN}${tag}`;
  assertSandboxTarget({ classId, listId });
  const assignment = { pace: 20, studyDaysPerWeek: 5, passThreshold: 90, ...(cyclingEnabled ? { cyclingEnabled: true } : {}) };
  await adb().doc(`classes/${classId}`).set({ name: `25WT ${tag}`, ownerTeacherId, studentIds: [student.uid], assignments: { [listId]: assignment } });
  await adb().doc(`lists/${listId}`).set({ wordCount, title: `list ${tag}` });
  await adb().doc(`users/${student.uid}`).set({ role: 'student', enrolledClasses: { [classId]: true }, email: student.email });
  if (canonical) {
    await adb().doc(`users/${student.uid}/list_progress/${listId}`).set({
      listId, currentStudyDay: csd, totalWordsIntroduced: twi, recentSessions,
      interventionLevel: 0, stats: { avgNewWordScore: null, avgReviewScore: null },
      streakDays: 0, lastStudyDate: null, lastSessionAt: null, programStartDate: T(),
    });
  }
  return { student, classId, listId, assignment };
}

async function seedAttempt(f, { uid, studyDay, sessionType = 'new', passed = true, nwsi = null, nwei = null, testType = 'mcq', score = 100, teacherId = TEACHER.uid, docId, extra = {} }) {
  const id = docId || `${uid}_${f.classId}_${f.listId}_day${studyDay}_${sessionType}`;
  await adb().doc(`attempts/${id}`).set({
    studentId: uid, classId: f.classId, listId: f.listId, teacherId,
    testId: `vocaboost_test_${f.classId}_${f.listId}_${sessionType}`,
    sessionType, testType, studyDay, passed, score,
    newWordStartIndex: nwsi, newWordEndIndex: nwei,
    submittedAt: T(), writtenBy: 'seed', ...extra,
  });
  return id;
}
const readCanonical = (uid, listId) => adb().doc(`users/${uid}/list_progress/${listId}`).get().then((s) => (s.exists ? s.data() : null));

// ════════════════════════════════════════════════════════════════════════════
// CS-1 — completeSession happy path (P3 c1): csd+1, twi+=wordsIntroduced, recentSessions
// ════════════════════════════════════════════════════════════════════════════
await M.run('CS-1', 'completeSession happy path → canonical csd+1/twi+=alloc/recentSessions', async () => {
  const f = await fixture('cs1', { csd: 0, twi: 0, wordCount: 100 });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 1, nwsi: 0, nwei: 19 });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 1, newWordScore: 0.95, reviewScore: 0.9, segmentStartIndex: 0, segmentEndIndex: 19, wordsTested: 20 } }, f.student.idToken);
  if (!r.ok) return fail('HTTP 200 completed', `HTTP ${r.httpStatus} ${r.errorStatus}`, r.raw);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = r.result?.status === 'completed' && doc?.currentStudyDay === 1 && doc?.totalWordsIntroduced === 20 && (doc?.recentSessions?.length === 1);
  return expect(ok, 'status=completed, csd=1, twi=20, recentSessions=1', `status=${r.result?.status} csd=${doc?.currentStudyDay} twi=${doc?.totalWordsIntroduced} rs=${doc?.recentSessions?.length}`, `wordsIntroduced=${r.result?.wordsIntroduced}`);
});

// CS-1e — F-4 evidence gate: day-guard passes but NO anchor + NO review-only reason ⇒ no_evidence
await M.run('CS-1e', 'completeSession no_evidence block (F-4): no anchor, not review-only ⇒ refuse to advance', async () => {
  const f = await fixture('cs1e', { csd: 0, twi: 0, wordCount: 100 }); // alloc>0, not list-complete, no day-1 anchor
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 1 } }, f.student.idToken);
  const doc = await readCanonical(f.student.uid, f.listId);
  const logged = (await countLogs('complete_session_no_evidence', nowMs, (d) => d.userId === f.student.uid)).count >= 1;
  const ok = r.ok && r.result?.status === 'no_evidence' && r.result?.advanced === false && doc?.currentStudyDay === 0 && logged;
  return expect(ok, 'status=no_evidence, advanced=false, csd unchanged=0, log complete_session_no_evidence', `status=${r.result?.status} advanced=${r.result?.advanced} csd=${doc?.currentStudyDay} log=${logged}`);
});

// CS-2 — transactional day-guard reject (P3 c1): a stale/collision completion advances NOTHING + logs
await M.run('CS-2', 'completeSession day-guard reject: stale day ⇒ no advance + day_guard_rejected_session_cleared(uid)', async () => {
  const f = await fixture('cs2', { csd: 2, twi: 40, wordCount: 100, recentSessions: [{ day: 2 }] });
  await adb().doc(`users/${f.student.uid}/session_states/${f.classId}_${f.listId}`).set({ phase: 'new' });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 4 } }, f.student.idToken); // expectedDay=3, not idempotent
  const doc = await readCanonical(f.student.uid, f.listId);
  const logged = (await countLogs('day_guard_rejected_session_cleared', nowMs, (d) => d.userId === f.student.uid)).count >= 1;
  const sess = await adb().doc(`users/${f.student.uid}/session_states/${f.classId}_${f.listId}`).get();
  const ok = r.ok && r.result?.dayGuardRejected === true && doc?.currentStudyDay === 2 && doc?.totalWordsIntroduced === 40 && logged && !sess.exists;
  return expect(ok, 'dayGuardRejected=true, csd stays 2, session cleared, log(uid)', `rejected=${r.result?.dayGuardRejected} csd=${doc?.currentStudyDay} log=${logged} sessionCleared=${!sess.exists}`);
});

// CS-3 — idempotent duplicate retry (P3 c1 v3-MED): replay SAME completion ⇒ already_completed, no 2nd +1
await M.run('CS-3', 'completeSession idempotent retry: replay committed completion ⇒ already_completed, exactly one +1', async () => {
  const f = await fixture('cs3', { csd: 0, twi: 0, wordCount: 100 });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 1, nwsi: 0, nwei: 19 });
  const sc = { dayNumber: 1, newWordScore: 0.95, segmentEndIndex: 19, wordsTested: 20 };
  const r1 = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: sc }, f.student.idToken);
  const r2 = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: sc }, f.student.idToken);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = r1.result?.status === 'completed' && r2.result?.status === 'already_completed' && doc?.currentStudyDay === 1 && doc?.totalWordsIntroduced === 20;
  return expect(ok, 'r1=completed, r2=already_completed, csd=1 (not 2), twi=20 (not 40)', `r1=${r1.result?.status} r2=${r2.result?.status} csd=${doc?.currentStudyDay} twi=${doc?.totalWordsIntroduced}`);
});

// CS-4 — server reviewOnlyDay replicates ALL THREE client reasons; twi flat; wordsIntroduced==0
await M.run('CS-4a', 'reviewOnlyDay reason1 allocationZero (S3 throttle) ⇒ twi flat, wordsIntroduced=0', async () => {
  const f = await fixture('cs4a', { csd: 3, twi: 40, wordCount: 500, recentSessions: [{ reviewScore: 0.2 }, { reviewScore: 0.2 }, { reviewScore: 0.2 }] });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 4, reviewScore: 0.3 } }, f.student.idToken);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = r.ok && r.result?.reviewOnlyDay === true && r.result?.reviewOnlyReasons?.allocationZero === true && r.result?.wordsIntroduced === 0 && doc?.totalWordsIntroduced === 40;
  return expect(ok, 'reviewOnlyDay=true allocationZero=true wordsIntroduced=0 twi=40(flat)', `reviewOnly=${r.result?.reviewOnlyDay} reasons=${JSON.stringify(r.result?.reviewOnlyReasons)} wi=${r.result?.wordsIntroduced} twi=${doc?.totalWordsIntroduced}`);
});
await M.run('CS-4b', 'reviewOnlyDay reason2 listComplete (S4/S5 list-end) ⇒ twi flat, wordsIntroduced=0', async () => {
  const f = await fixture('cs4b', { csd: 5, twi: 100, wordCount: 100 });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 6, reviewScore: 0.8 } }, f.student.idToken);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = r.ok && r.result?.reviewOnlyReasons?.listComplete === true && r.result?.wordsIntroduced === 0 && doc?.totalWordsIntroduced === 100;
  return expect(ok, 'listComplete=true wordsIntroduced=0 twi=100(flat)', `reasons=${JSON.stringify(r.result?.reviewOnlyReasons)} wi=${r.result?.wordsIntroduced} twi=${doc?.totalWordsIntroduced}`);
});
await M.run('CS-4c', 'reviewOnlyDay reason3 reviewStudyResume (S8/#9 already-absorbed) ⇒ twi flat, wordsIntroduced=0', async () => {
  const f = await fixture('cs4c', { csd: 5, twi: 40, wordCount: 500 });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 6, nwsi: 20, nwei: 30 }); // nwei 30 <= twi-1 (39) ⇒ absorbed
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 6, newWordScore: 0.9 } }, f.student.idToken);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = r.ok && r.result?.reviewOnlyReasons?.reviewStudyResume === true && r.result?.wordsIntroduced === 0 && doc?.totalWordsIntroduced === 40;
  return expect(ok, 'reviewStudyResume=true wordsIntroduced=0 twi=40(flat)', `reasons=${JSON.stringify(r.result?.reviewOnlyReasons)} wi=${r.result?.wordsIntroduced} twi=${doc?.totalWordsIntroduced}`);
});

// CS-5 — W2 markReviewComplete UPGRADED shape: parseable testId + integer day-anchor range (pairs)
await M.run('CS-5', 'markReviewComplete W2 upgraded: parseable testId + integer nwsi/nwei == day anchor (pairable)', async () => {
  const f = await fixture('cs5', { csd: 1, twi: 20, wordCount: 100 });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 2, nwsi: 20, nwei: 39 }); // day-2 anchor range
  const r = await callFn('markReviewComplete', { classId: f.classId, listId: f.listId, dayNumber: 2 }, f.student.idToken);
  if (!r.ok) return fail('HTTP 200 marker written', `HTTP ${r.httpStatus} ${r.errorStatus}`, r.raw);
  const markerId = `${f.student.uid}_${f.classId}_${f.listId}_day2_review_automarker`;
  const doc = (await adb().doc(`attempts/${markerId}`).get()).data();
  const testIdOk = doc?.testId === `vocaboost_test_${f.classId}_${f.listId}_review`;
  const rangeOk = doc?.newWordStartIndex === 20 && doc?.newWordEndIndex === 39; // == the day anchor (pairable)
  const shapeOk = doc?.autoCompleted === true && doc?.writtenBy === 'cloud-function' && doc?.sessionType === 'review';
  return expect(testIdOk && rangeOk && shapeOk, 'testId parseable + nwsi/nwei==(20,39) + autoCompleted server marker', `testId=${doc?.testId} range=(${doc?.newWordStartIndex},${doc?.newWordEndIndex}) writtenBy=${doc?.writtenBy}`);
});

// CS-6 — M4 anchor validation ENFORCING (P6d): forged anchor ⇒ reject; valid anchor ⇒ silent pass (via submitVocabAttempt MCQ new)
await M.run('CS-6f', 'M4 ENFORCE forged anchor (nwsi≠serverTwi) ⇒ failed-precondition reject + anchor_rejected{enforced}(uid)', async () => {
  const f = await fixture('cs6f', { csd: 0, twi: 0, wordCount: 500 });
  const docId = `${f.student.uid}_${f.classId}_${f.listId}_forged`;
  const ctx = { studentId: f.student.uid, classId: f.classId, listId: f.listId, testId: `vocaboost_test_${f.classId}_${f.listId}_new`, studyDay: 1, sessionType: 'new', testType: 'mcq', attemptDocId: docId, totalQuestions: 1, newWordStartIndex: 999, newWordEndIndex: 1020, wordsIntroduced: 22 };
  const r = await callFn('submitVocabAttempt', { context: ctx, attemptAnswers: [{ wordId: 'w1', correct: true }] }, f.student.idToken);
  const rejected = r.httpStatus === 400 && r.errorStatus === 'FAILED_PRECONDITION';
  const logged = (await countLogs('anchor_rejected', nowMs, (d) => d.enforced === true && d.userId === f.student.uid && d.attemptDocId === docId)).count >= 1;
  const notWritten = !(await adb().doc(`attempts/${docId}`).get()).exists;
  return expect(rejected && logged && notWritten, 'HTTP 400 FAILED_PRECONDITION + anchor_rejected{enforced:true,uid} + attempt NOT written', `status=${r.httpStatus}/${r.errorStatus} log=${logged} notWritten=${notWritten}`);
});
await M.run('CS-6v', 'M4 ENFORCE valid anchor (nwsi==serverTwi, in-allocation) ⇒ silent pass (write lands, no anchor_rejected)', async () => {
  const f = await fixture('cs6v', { csd: 0, twi: 0, wordCount: 100 });
  const docId = `${f.student.uid}_${f.classId}_${f.listId}_valid`;
  const ctx = { studentId: f.student.uid, classId: f.classId, listId: f.listId, testId: `vocaboost_test_${f.classId}_${f.listId}_new`, studyDay: 1, sessionType: 'new', testType: 'mcq', attemptDocId: docId, totalQuestions: 20, newWordStartIndex: 0, newWordEndIndex: 19, wordsIntroduced: 20 };
  const answers = Array.from({ length: 20 }, (_, i) => ({ wordId: `w${i}`, correct: true }));
  const r = await callFn('submitVocabAttempt', { context: ctx, attemptAnswers: answers }, f.student.idToken);
  const rejected = (await countLogs('anchor_rejected', nowMs, (d) => d.userId === f.student.uid && d.attemptDocId === docId)).count;
  const written = (await adb().doc(`attempts/${docId}`).get()).exists;
  return expect(r.ok && written && rejected === 0, 'HTTP 200 + attempt written + zero anchor_rejected (false-reject 0)', `ok=${r.ok} written=${written} anchor_rejected=${rejected}`);
});

// CS-7 — nonce F2 (gradeTypedTest attemptDocId) — SECRET-BACKED, DEFERRED (needs emulator ANTHROPIC_API_KEY + GRADE_TOKEN_SECRET)
await M.run('CS-7', 'nonce F2 gradeTypedTest attemptDocId in grade return + cached job', async () => {
  const haveSecrets = !!process.env.GRADE_TOKEN_SECRET && !!process.env.ANTHROPIC_API_KEY;
  if (!haveSecrets) return skip('response.attemptDocId === bindCtx docId', 'DEFERRED: gradeTypedTest is secret-backed (ANTHROPIC_API_KEY + GRADE_TOKEN_SECRET). Provide the emulator secrets/env to realize CS-7.');
  const f = await fixture('cs7', { csd: 0, twi: 0, wordCount: 100 });
  const docId = `${f.student.uid}_${f.classId}_${f.listId}_typed1`;
  const r = await callFn('gradeTypedTest', { context: { studentId: f.student.uid, classId: f.classId, listId: f.listId, attemptDocId: docId, testId: `vocaboost_test_${f.classId}_${f.listId}_new`, testType: 'typed', sessionType: 'new', studyDay: 1, totalQuestions: 1 }, answers: [{ wordId: 'w1', userAnswer: 'a', correctAnswer: 'a' }] }, f.student.idToken);
  return expect(r.ok && r.result?.attemptDocId === docId, 'grade return carries attemptDocId', `attemptDocId=${r.result?.attemptDocId}`);
});

// CS-8 — resolveListProgress end-state contract: canonical-first / straggler hydrate / quarantine block
await M.run('CS-8a', 'resolveListProgress canonical-first: existing canonical ⇒ mode=canonical, its csd/twi', async () => {
  const f = await fixture('cs8a', { csd: 4, twi: 60, wordCount: 100 }); // canonical seeded
  const r = await callFn('resolveListProgress', { listId: f.listId }, f.student.idToken);
  const ok = r.ok && r.result?.mode === 'canonical' && r.result?.csd === 4 && r.result?.twi === 60;
  return expect(ok, 'mode=canonical, csd=4, twi=60', `mode=${r.result?.mode} csd=${r.result?.csd} twi=${r.result?.twi}`);
});
await M.run('CS-8b', 'resolveListProgress straggler hydrate: legacy-only + valid anchor ⇒ create canonical (mode=canonical, hydrated)', async () => {
  const f = await fixture('cs8b', { canonical: false, wordCount: 100 });
  await adb().doc(`users/${f.student.uid}/class_progress/${f.classId}_${f.listId}`).set({ classId: f.classId, listId: f.listId, currentStudyDay: 2, totalWordsIntroduced: 20, programStartDate: T() });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 1, nwsi: 0, nwei: 19 }); // valid anchor ⇒ no quarantine
  const before = await readCanonical(f.student.uid, f.listId);
  const r = await callFn('resolveListProgress', { listId: f.listId, classId: f.classId }, f.student.idToken);
  const after = await readCanonical(f.student.uid, f.listId);
  const ok = r.ok && r.result?.mode === 'canonical' && r.result?.hydrated === true && before === null && after !== null && after.totalWordsIntroduced === 20;
  return expect(ok, 'mode=canonical hydrated=true; canonical created (twi=20)', `mode=${r.result?.mode} hydrated=${r.result?.hydrated} canonBefore=${before !== null} canonAfter=${after !== null} twi=${after?.totalWordsIntroduced}`);
});
await M.run('CS-8c', 'resolveListProgress quarantine: anchorless forged-high-twi ⇒ mode=quarantined + list_progress_quarantined', async () => {
  const f = await fixture('cs8c', { canonical: false, wordCount: 100 });
  await adb().doc(`users/${f.student.uid}/class_progress/${f.classId}_${f.listId}`).set({ classId: f.classId, listId: f.listId, currentStudyDay: 9, totalWordsIntroduced: 400, programStartDate: T() }); // no valid anchor
  const r = await callFn('resolveListProgress', { listId: f.listId }, f.student.idToken);
  const logged = (await countLogs('list_progress_quarantined', nowMs, (d) => d.userId === f.student.uid)).count >= 1;
  const notCreated = (await readCanonical(f.student.uid, f.listId)) === null;
  return expect(r.ok && r.result?.mode === 'quarantined' && logged && notCreated, 'mode=quarantined + list_progress_quarantined log + NO canonical created', `mode=${r.result?.mode} log=${logged} canonAbsent=${notCreated}`);
});

// CS-9 — resetProgress epoch + canonical zero (F-3): attempts/session_states wiped, canonical zeroed + epoch stamped
await M.run('CS-9', 'resetProgress: attempts wiped (all classes), session_states cleared, canonical zeroed + resetEpoch/resetAt', async () => {
  const f = await fixture('cs9', { csd: 5, twi: 100, wordCount: 100, recentSessions: [{ day: 5 }] });
  const classB = `${SANDBOX_CLASS_PREFIX}${CLEAN}cs9b`;
  await seedAttempt(f, { uid: f.student.uid, studyDay: 1, nwsi: 0, nwei: 19, docId: `${f.student.uid}_${f.classId}_${f.listId}_a1` });
  await adb().doc(`attempts/${f.student.uid}_${classB}_${f.listId}_a2`).set({ studentId: f.student.uid, classId: classB, listId: f.listId, sessionType: 'new', passed: true, studyDay: 2, newWordEndIndex: 39, submittedAt: T() });
  await adb().doc(`users/${f.student.uid}/session_states/${f.classId}_${f.listId}`).set({ phase: 'new' });
  await adb().doc(`users/${f.student.uid}/session_states/${classB}_${f.listId}`).set({ phase: 'review' });
  const r = await callFn('resetProgress', { listId: f.listId }, f.student.idToken);
  if (!r.ok) return fail('HTTP 200 reset', `HTTP ${r.httpStatus} ${r.errorStatus}`, r.raw);
  const attemptsLeft = (await adb().collection('attempts').where('studentId', '==', f.student.uid).where('listId', '==', f.listId).get()).size;
  const sessLeft = (await adb().collection(`users/${f.student.uid}/session_states`).listDocuments()).filter((d) => d.id.endsWith(`_${f.listId}`)).length;
  const canon = await readCanonical(f.student.uid, f.listId);
  const zeroed = canon?.currentStudyDay === 0 && canon?.totalWordsIntroduced === 0 && (canon?.recentSessions?.length ?? 0) === 0;
  const stamped = canon?.resetAt != null && (canon?.resetEpoch ?? 0) >= 1;
  const ok = r.result?.deleted?.attempts >= 2 && attemptsLeft === 0 && sessLeft === 0 && zeroed && stamped;
  return expect(ok, 'attempts=0(both classes), session_states cleared, canonical zeroed + epoch stamped', `deleted=${JSON.stringify(r.result?.deleted)} attemptsLeft=${attemptsLeft} sessLeft=${sessLeft} zeroed=${zeroed} stamped=${stamped}`);
});

// CS-10 — grading-job 7-transition recovery suite — DEFERRED (Web-SDK + prod-targeted + secret-backed; not emulator-runnable per Codex)
await M.run('CS-10', 'grading-job recovery suite (dsg-edits/srv_validate/grading_job_tests.mjs)', async () => {
  return skip('7-transition recovery suite green + typed smoke', 'DEFERRED: grading_job_tests.mjs uses the WEB SDK (Codex: hangs in the Node emulator shell), targets the LIVE prod project, and needs GRADE_TOKEN_SECRET/ANTHROPIC_API_KEY. Run it against the deployed functions per the CS-10 note, not under the emulator.');
});

// CS-11 — reviewonly_derivation_mismatch tripwire: disagreeing preview emits; agreeing does not
await M.run('CS-11m', 'derivation-mismatch: client reviewOnlyDay disagrees with server ⇒ reviewonly_derivation_mismatch(uid)', async () => {
  const f = await fixture('cs11m', { csd: 0, twi: 0, wordCount: 100 });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 1, nwsi: 0, nwei: 19 }); // normal day ⇒ server reviewOnlyDay=false
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 1, newWordScore: 0.9, clientReviewOnlyDay: true, clientWordsIntroduced: 0 } }, f.student.idToken);
  const logged = (await countLogs('reviewonly_derivation_mismatch', nowMs, (d) => d.userId === f.student.uid && d.server === false && d.client === true)).count >= 1;
  return expect(r.ok && r.result?.status === 'completed' && logged, 'completed + reviewonly_derivation_mismatch{client:true,server:false}', `status=${r.result?.status} log=${logged}`);
});
await M.run('CS-11a', 'derivation-agree: client reviewOnlyDay matches server ⇒ NO reviewonly_derivation_mismatch', async () => {
  const f = await fixture('cs11a', { csd: 0, twi: 0, wordCount: 100 });
  await seedAttempt(f, { uid: f.student.uid, studyDay: 1, nwsi: 0, nwei: 19 });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 1, newWordScore: 0.9, clientReviewOnlyDay: false } }, f.student.idToken);
  const logged = (await countLogs('reviewonly_derivation_mismatch', nowMs, (d) => d.userId === f.student.uid)).count;
  return expect(r.ok && r.result?.status === 'completed' && logged === 0, 'completed + zero mismatch events', `status=${r.result?.status} mismatchLogs=${logged}`);
});

// ════════════════════════════════════════════════════════════════════════════
// OV — P10 override + reviewChallenge (§1.K)
// ════════════════════════════════════════════════════════════════════════════
// OV-1 — overrideAttempt (in-product manual-pass): no-attemptId path writes a VALID anchor + advances
await M.run('OV-1', 'overrideAttempt writes a FULL VALID anchor (nwsi/nwei/wordsIntroduced/testId) + day advances', async () => {
  const f = await fixture('ov1', { csd: 1, twi: 20, wordCount: 500 });
  const r = await callFn('overrideAttempt', { studentId: f.student.uid, classId: f.classId, listId: f.listId, studyDay: 2, score: 100 }, TEACHER.idToken);
  if (!r.ok) return fail('HTTP 200 override', `HTTP ${r.httpStatus} ${r.errorStatus}`, r.raw);
  const anchor = (await adb().doc(`attempts/${r.result.docId}`).get()).data();
  const anchorOk = Number.isInteger(anchor?.newWordStartIndex) && Number.isInteger(anchor?.newWordEndIndex) && anchor?.testId === `vocaboost_test_${f.classId}_${f.listId}_new` && anchor?.passed === true && Number.isInteger(anchor?.wordsIntroduced);
  const logged = (await countLogs('teacher_override', nowMs, (d) => d.userId === f.student.uid && d.teacherId === TEACHER.uid)).count >= 1;
  return expect(anchorOk && r.result?.passed && logged, 'valid anchor written (manual-pass parity) + teacher_override audit log', `anchorFields=(${anchor?.newWordStartIndex},${anchor?.newWordEndIndex}) testId=${anchor?.testId} passed=${r.result?.passed} log=${logged}`);
});
// OV-2 — override authz UNION: stamp-owner ∪ current-enrollment owner ALLOWED; unrelated DENIED
await M.run('OV-2', 'override authz union: stamp(A)=allow, enrollment(B)=allow, outsider(C)=permission-denied', async () => {
  const A = TEACHER; // stamp owner
  const B = await makeStudent(`lsr_ov2b_${RUN_ID}@vocaboost.test`); await adb().doc(`users/${B.uid}`).set({ role: 'teacher', email: B.email });
  const C = await makeStudent(`lsr_ov2c_${RUN_ID}@vocaboost.test`); await adb().doc(`users/${C.uid}`).set({ role: 'teacher', email: C.email });
  // classA owned by A (the attempt's class + stamp); classB owned by B (current enrollment)
  const f = await fixture('ov2', { csd: 1, twi: 20, wordCount: 500, ownerTeacherId: A.uid });
  const classB = `${SANDBOX_CLASS_PREFIX}${CLEAN}ov2B`;
  await adb().doc(`classes/${classB}`).set({ name: '25WT ov2B', ownerTeacherId: B.uid, studentIds: [f.student.uid], assignments: { [f.listId]: { pace: 20, passThreshold: 90 } } });
  await adb().doc(`users/${f.student.uid}`).set({ role: 'student', enrolledClasses: { [f.classId]: true, [classB]: true }, email: f.student.email });
  const attemptId = await seedAttempt(f, { uid: f.student.uid, studyDay: 2, nwsi: 20, nwei: 39, teacherId: A.uid, docId: `${f.student.uid}_${f.classId}_${f.listId}_ov2attempt` });
  const rA = await callFn('overrideAttempt', { attemptId, score: 100 }, A.idToken);
  const rB = await callFn('overrideAttempt', { attemptId, score: 100 }, B.idToken);
  const rC = await callFn('overrideAttempt', { attemptId, score: 100 }, C.idToken);
  const ok = rA.ok && rB.ok && rC.httpStatus === 403 && rC.errorStatus === 'PERMISSION_DENIED';
  return expect(ok, 'A allow / B allow / C denied(403 PERMISSION_DENIED)', `A=${rA.httpStatus} B=${rB.httpStatus} C=${rC.httpStatus}/${rC.errorStatus}`);
});
// OV-3 — reviewChallenge: twi CLAMPED to wordsRemaining (new phase); review-phase accept ⇒ twi unchanged
await M.run('OV-3c', 'reviewChallenge new-phase accept near list-end (Day-1 completion): twi CLAMPED at listTotal (not unclamped)', async () => {
  // Day-1 new pass ⇒ the day-COMPLETION branch (where the I-6 §3-row-8 clamp lives). csd:0 ⇒ isFirstDay.
  const f = await fixture('ov3c', { csd: 0, twi: 95, wordCount: 100 }); // wordsRemaining=5, pace=20 ⇒ clamp to 5
  await adb().doc(`users/${f.student.uid}`).set({ role: 'student', enrolledClasses: { [f.classId]: true }, challenges: { history: [] }, email: f.student.email });
  const attemptId = await seedAttempt(f, { uid: f.student.uid, studyDay: 1, sessionType: 'new', passed: false, score: 0, nwsi: 95, nwei: 99, testType: 'mcq', extra: { totalQuestions: 1, answers: [{ wordId: 'wX', challengeStatus: 'pending', isCorrect: false }] } });
  const r = await callFn('reviewChallenge', { attemptId, wordId: 'wX', accepted: true }, TEACHER.idToken);
  if (!r.ok) return fail('HTTP 200 reviewChallenge', `HTTP ${r.httpStatus} ${r.errorStatus}`, r.raw);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = r.result?.advance?.twiIncrement === 5 && doc?.totalWordsIntroduced === 100; // clamped 95+5=100, not 95+20=115
  return expect(ok, 'twiIncrement clamped to 5 ⇒ twi=100 (list end), not 115', `twiIncrement=${r.result?.advance?.twiIncrement} twi=${doc?.totalWordsIntroduced}`);
});
await M.run('OV-3p', 'reviewChallenge review-phase accept: phase gate ⇒ twi UNCHANGED (nwei:null hazard closed)', async () => {
  const f = await fixture('ov3p', { csd: 1, twi: 40, wordCount: 100 });
  await adb().doc(`users/${f.student.uid}`).set({ role: 'student', enrolledClasses: { [f.classId]: true }, challenges: { history: [] }, email: f.student.email });
  const attemptId = await seedAttempt(f, { uid: f.student.uid, studyDay: 2, sessionType: 'review', passed: false, score: 0, testType: 'mcq', extra: { totalQuestions: 1, answers: [{ wordId: 'wR', challengeStatus: 'pending', isCorrect: false }] } });
  const r = await callFn('reviewChallenge', { attemptId, wordId: 'wR', accepted: true }, TEACHER.idToken);
  if (!r.ok) return fail('HTTP 200 reviewChallenge', `HTTP ${r.httpStatus} ${r.errorStatus}`, r.raw);
  const doc = await readCanonical(f.student.uid, f.listId);
  const ok = (r.result?.advance == null || r.result?.advance?.twiIncrement === 0) && doc?.totalWordsIntroduced === 40;
  return expect(ok, 'review-phase twiIncrement=0 ⇒ twi=40 (unchanged)', `advance=${JSON.stringify(r.result?.advance)} twi=${doc?.totalWordsIntroduced}`);
});

// ════════════════════════════════════════════════════════════════════════════
// CY-3 — lap-aware M4 (§1.J): a lap-2 day (virtual twi > listTotal) is NOT anchor-rejected
// ════════════════════════════════════════════════════════════════════════════
await M.run('CY-3', 'lap-aware M4: under cycling, a lap-2 anchor (twi>listTotal) is NOT rejected (anchor_rejected=0)', async () => {
  if (FL.CYCLING_ENABLED_SERVER !== true) return skip('lap-2 anchor accepted', 'CYCLING_ENABLED (server) is OFF in this flag-set — enable it in the flag-on map to realize CY-3.');
  const f = await fixture('cy3', { csd: 5, twi: 100, wordCount: 100, cyclingEnabled: true }); // at lap boundary; wordsRemaining would be 0 w/o cycling
  const docId = `${f.student.uid}_${f.classId}_${f.listId}_lap2`;
  const ctx = { studentId: f.student.uid, classId: f.classId, listId: f.listId, testId: `vocaboost_test_${f.classId}_${f.listId}_new`, studyDay: 6, sessionType: 'new', testType: 'mcq', attemptDocId: docId, totalQuestions: 20, newWordStartIndex: 100, newWordEndIndex: 119, wordsIntroduced: 20 };
  const answers = Array.from({ length: 20 }, (_, i) => ({ wordId: `l2w${i}`, correct: true }));
  const r = await callFn('submitVocabAttempt', { context: ctx, attemptAnswers: answers }, f.student.idToken);
  const rejected = (await countLogs('anchor_rejected', nowMs, (d) => d.userId === f.student.uid && d.attemptDocId === docId)).count;
  const written = (await adb().doc(`attempts/${docId}`).get()).exists;
  return expect(r.ok && written && rejected === 0, 'HTTP 200 + written + anchor_rejected=0 (lap-modular clamp)', `ok=${r.ok} written=${written} anchor_rejected=${rejected}`);
});

// ── Finish + fail-closed exit ──
const { clean } = M.finish();
process.exit(clean ? 0 : 1);
