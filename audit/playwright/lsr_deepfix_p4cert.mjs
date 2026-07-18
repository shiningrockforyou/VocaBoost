/**
 * lsr_deepfix_p4cert.mjs — P4/D3 BEHAVIORAL CERTIFICATION (approach-1), Codex-GO'd r28.
 * ============================================================================
 * Certifies the forced-pathway SERVER hold-csd branch that the live cutover activated
 * (client 6bffe1c -> functions 0ddbb34). Emulator ONLY, PINNED to 0ddbb34, PROD flag posture
 * (FORCED_PATHWAY_ENABLED=true, epoch 1784333239063, 7 D2 flags true, LIST_PROGRESS_CANONICAL=false,
 * ANCHOR_VALIDATION_ENFORCE=false). Runs on the tree's own functions (== 0ddbb34) — NO flag_on flip
 * (the tree already IS the prod posture). CSD/TWI asserted on users/{uid}/class_progress/{classId}_{listId}.
 *   node audit/playwright/lsr_deepfix_p4cert.mjs <runId>  (as child of firebase emulators:exec)
 * ============================================================================
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectEmulator, adb, makeStudent, assertSandboxTarget,
  SANDBOX_CLASS_PREFIX, SANDBOX_LIST_PREFIX, cleanId, callFn, countLogs,
} from './lsr_deepfix_emu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const RUN_ID = (process.argv[2] || `p4cert_${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '');
const CLEAN = cleanId(RUN_ID);
const EPOCH = 1784333239063;
const CERT_SHA = '0ddbb34';
const Ts = admin.firestore.Timestamp;
const nowMs = Date.now();
const preEpochTs = Ts.fromMillis(EPOCH - 3600_000);   // 1h before epoch (grandfathered)
const postEpochTs = () => Ts.now();                    // current time >> epoch (post-epoch)

// ── emulator guard ──
const emu = detectEmulator();
if (!emu.ok) { console.error('[p4cert] INVALID — emulator not detected: ' + emu.reason); process.exit(1); }

// ── PIN + posture from the loaded source (the tree == 0ddbb34, hash-verified by the runner) ──
const fnd = readFileSync(resolve(REPO, 'functions/foundation.js'), 'utf8');
const idx = readFileSync(resolve(REPO, 'functions/index.js'), 'utf8');
const flag = (t, n) => { const m = t.match(new RegExp(`(?:export\\s+)?const\\s+${n}\\s*=\\s*(true|false)\\b`)); return m ? m[1] === 'true' : null; };
const epochSrc = (() => { const m = fnd.match(/FORCED_PATHWAY_GRANDFATHER_EPOCH_MS\s*=\s*(-?\d+|null)/); return m ? (m[1] === 'null' ? null : Number(m[1])) : undefined; })();
const posture = {
  FORCED_PATHWAY_ENABLED: flag(fnd, 'FORCED_PATHWAY_ENABLED'),
  epoch: epochSrc,
  SERVER_COMPLETE_SESSION_ENABLED: flag(fnd, 'SERVER_COMPLETE_SESSION_ENABLED'),
  SERVER_RESOLVE_LIST_PROGRESS_ENABLED: flag(fnd, 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED'),
  SERVER_RESET_PROGRESS_ENABLED: flag(fnd, 'SERVER_RESET_PROGRESS_ENABLED'),
  SERVER_ADVANCE_FOR_CHALLENGE_ENABLED: flag(fnd, 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED'),
  ANCHOR_VALIDATION_SHADOW: flag(fnd, 'ANCHOR_VALIDATION_SHADOW'),
  REVIEW_ENGAGEMENT_STAMP_ENABLED: flag(fnd, 'REVIEW_ENGAGEMENT_STAMP_ENABLED'),
  RECOVERY_SCORE_CLAMP_ENABLED: flag(fnd, 'RECOVERY_SCORE_CLAMP_ENABLED'),
  LIST_PROGRESS_CANONICAL: flag(fnd, 'LIST_PROGRESS_CANONICAL'),
  ANCHOR_VALIDATION_ENFORCE: flag(fnd, 'ANCHOR_VALIDATION_ENFORCE'),
  CYCLING_ENABLED: flag(fnd, 'CYCLING_ENABLED'),
  SERVER_OVERRIDE_ENABLED: flag(fnd, 'SERVER_OVERRIDE_ENABLED'),
  GRADE_TOKEN_ENFORCED: flag(idx, 'GRADE_TOKEN_ENFORCED'),
};
const postureExpected =
  posture.FORCED_PATHWAY_ENABLED === true && posture.epoch === EPOCH &&
  posture.SERVER_COMPLETE_SESSION_ENABLED === true && posture.SERVER_RESOLVE_LIST_PROGRESS_ENABLED === true &&
  posture.SERVER_RESET_PROGRESS_ENABLED === true && posture.SERVER_ADVANCE_FOR_CHALLENGE_ENABLED === true &&
  posture.ANCHOR_VALIDATION_SHADOW === true && posture.REVIEW_ENGAGEMENT_STAMP_ENABLED === true &&
  posture.RECOVERY_SCORE_CLAMP_ENABLED === true &&
  posture.LIST_PROGRESS_CANONICAL === false && posture.ANCHOR_VALIDATION_ENFORCE === false;

console.log(`\n=== P4 BEHAVIORAL CERT (${RUN_ID}) — pinned ${CERT_SHA} — emulator ${emu.project} ===`);
console.log('posture ok=' + postureExpected + ' ' + JSON.stringify(posture) + '\n');

// ── result tracking ──
const results = [];
const uids = [];
const check = (id, desc, cond, want, got) => {
  const verdict = cond ? 'PASS' : 'FAIL';
  results.push({ id, desc, verdict, want, got });
  console.log(`  ${cond ? '✅' : '❌'} ${id} ${verdict} — want[${want}] got[${got}]`);
  return cond;
};

const TEACHER = await makeStudent(`lsr_p4c_teacher_${RUN_ID}@vocaboost.test`);
await adb().doc(`users/${TEACHER.uid}`).set({ role: 'teacher', displayName: 'P4C Teacher', email: TEACHER.email });

// ── seed a class_progress (CANONICAL=false durable target) fixture ──
async function cpFixture(tag, { csd = 0, twi = 0, wordCount = 500, recentSessions = [], reviewMode = undefined } = {}) {
  const student = await makeStudent(`lsr_p4c_${tag}_${RUN_ID}@vocaboost.test`);
  uids.push(student.uid);
  const classId = `${SANDBOX_CLASS_PREFIX}${CLEAN}${tag}`;
  const listId = `${SANDBOX_LIST_PREFIX}${CLEAN}${tag}`;
  assertSandboxTarget({ classId, listId });
  const assignment = { pace: 20, studyDaysPerWeek: 5, passThreshold: 90 };
  await adb().doc(`classes/${classId}`).set({ name: `25WT ${tag}`, ownerTeacherId: TEACHER.uid, studentIds: [student.uid], assignments: { [listId]: assignment } });
  await adb().doc(`lists/${listId}`).set({ wordCount, title: `list ${tag}` });
  await adb().doc(`users/${student.uid}`).set({ role: 'student', enrolledClasses: { [classId]: true }, email: student.email });
  const cp = { classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi, recentSessions, interventionLevel: 0, stats: {}, streakDays: 0, lastStudyDate: null, lastSessionAt: null, programStartDate: Ts.now() };
  if (reviewMode !== undefined) cp.reviewMode = reviewMode;
  await adb().doc(`users/${student.uid}/class_progress/${classId}_${listId}`).set(cp);
  return { student, classId, listId };
}
async function seedAttempt(f, { studyDay, sessionType = 'new', passed = true, nwsi = null, nwei = null, score = 100, submittedAt = null, engagedReview = undefined, docId, testType = 'mcq' }) {
  const id = docId || `${f.student.uid}_${f.classId}_${f.listId}_d${studyDay}_${sessionType}`;
  const d = { studentId: f.student.uid, classId: f.classId, listId: f.listId, teacherId: TEACHER.uid, testId: `vocaboost_test_${f.classId}_${f.listId}_${sessionType}`, sessionType, testType, studyDay, passed, score, newWordStartIndex: nwsi, newWordEndIndex: nwei, submittedAt: submittedAt || Ts.now(), writtenBy: 'seed' };
  if (engagedReview !== undefined) d.engagedReview = engagedReview;
  await adb().doc(`attempts/${id}`).set(d);
  return id;
}
const readCp = (f) => adb().doc(`users/${f.student.uid}/class_progress/${f.classId}_${f.listId}`).get().then((s) => s.exists ? s.data() : null);

// ════════════════════════════════════════════════════════════════════════════
// #1 NORMAL COMPLETION (advance) + #5a (no day-guard on a legit completion)
// ════════════════════════════════════════════════════════════════════════════
{
  const f = await cpFixture('a1', { csd: 0, twi: 0, wordCount: 100 });
  await seedAttempt(f, { studyDay: 1, sessionType: 'new', passed: true, nwsi: 0, nwei: 19 });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 1, newWordScore: 0.95, reviewScore: 0.9, segmentStartIndex: 0, segmentEndIndex: 19, wordsTested: 20 } }, f.student.idToken);
  const cp = await readCp(f);
  const clearLogs = (await countLogs('day_guard_rejected_session_cleared', nowMs, (d) => d.userId === f.student.uid)).count + (await countLogs('day_guard_session_clear_FAILED', nowMs, (d) => d.userId === f.student.uid)).count;
  check('1-normal-advance', 'normal completion advances csd+1/twi to anchor on class_progress', r.ok && r.result?.status === 'completed' && cp?.currentStudyDay === 1 && cp?.totalWordsIntroduced === 20, 'status=completed csd=1 twi=20', `status=${r.result?.status} csd=${cp?.currentStudyDay} twi=${cp?.totalWordsIntroduced}`);
  check('5a-normal-not-dayguard', 'normal completion is NOT day_guard_rejected + no clear logs', r.result?.dayGuardRejected !== true && clearLogs === 0, 'dayGuardRejected!=true, clearLogs=0', `dayGuardRejected=${r.result?.dayGuardRejected} clearLogs=${clearLogs}`);
}

// ════════════════════════════════════════════════════════════════════════════
// #2a POST-EPOCH NON-ENGAGED, NORMAL ALLOC → HOLD (review_recorded, no advance)
// ════════════════════════════════════════════════════════════════════════════
{
  const f = await cpFixture('a2a', { csd: 1, twi: 20, wordCount: 500, recentSessions: [] });
  await seedAttempt(f, { studyDay: 2, sessionType: 'new', passed: true, nwsi: 20, nwei: 39 }); // fresh anchor (not absorbed) => evidence
  await seedAttempt(f, { studyDay: 2, sessionType: 'review', passed: true, submittedAt: postEpochTs(), engagedReview: false }); // post-epoch NON-engaged
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 2, newWordScore: 0.9, reviewScore: 0.8 } }, f.student.idToken);
  const cp = await readCp(f);
  const logged = (await countLogs('review_recorded', nowMs, (d) => d.userId === f.student.uid)).count >= 1;
  check('2a-postepoch-nonengaged-HOLD', 'post-epoch non-engaged normal-alloc HOLDS (review_recorded, csd/twi flat, log)', r.ok && r.result?.status === 'review_recorded' && r.result?.advanced === false && cp?.currentStudyDay === 1 && cp?.totalWordsIntroduced === 20 && logged, 'status=review_recorded advanced=false csd=1 twi=20 log=true', `status=${r.result?.status} advanced=${r.result?.advanced} csd=${cp?.currentStudyDay} twi=${cp?.totalWordsIntroduced} log=${logged}`);
}

// ════════════════════════════════════════════════════════════════════════════
// #2b PRE-EPOCH GRANDFATHERED, normal alloc → ADVANCE EXACTLY ONCE (hold must NOT fire)
// ════════════════════════════════════════════════════════════════════════════
{
  const f = await cpFixture('a2b', { csd: 1, twi: 20, wordCount: 500, recentSessions: [] });
  await seedAttempt(f, { studyDay: 2, sessionType: 'new', passed: true, nwsi: 20, nwei: 39 });
  await seedAttempt(f, { studyDay: 2, sessionType: 'review', passed: true, submittedAt: preEpochTs, engagedReview: false }); // PRE-epoch => grandfathered engaged
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 2, newWordScore: 0.9, reviewScore: 0.8 } }, f.student.idToken);
  const cp = await readCp(f);
  check('2b-preepoch-grandfathered-ADVANCE', 'pre-epoch grandfathered review => hold does NOT fire, advances exactly once (csd 1->2)', r.ok && r.result?.status === 'completed' && cp?.currentStudyDay === 2, 'status=completed csd=2 (advanced once)', `status=${r.result?.status} csd=${cp?.currentStudyDay} twi=${cp?.totalWordsIntroduced}`);
}

// ════════════════════════════════════════════════════════════════════════════
// #2c THROTTLE review-only → HOLD (both post- and pre-epoch) + #3 reviewMode persisted
// ════════════════════════════════════════════════════════════════════════════
{
  // 2c-post: throttle via low-reviewScore recentSessions (avg 0.1 < 0.30 enter-threshold), post-epoch review present
  const f = await cpFixture('a2cpost', { csd: 2, twi: 40, wordCount: 500, recentSessions: [{ reviewScore: 0.1 }, { reviewScore: 0.1 }, { reviewScore: 0.1 }] });
  await seedAttempt(f, { studyDay: 3, sessionType: 'review', passed: true, submittedAt: postEpochTs(), engagedReview: true }); // even engaged: throttle overrides
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 3, reviewScore: 0.2 } }, f.student.idToken);
  const cp = await readCp(f);
  const logged = (await countLogs('review_recorded', nowMs, (d) => d.userId === f.student.uid)).count >= 1;
  check('2c-post-throttle-HOLD', 'post-epoch throttle review-only HOLDS (review_recorded, csd/twi flat)', r.ok && r.result?.status === 'review_recorded' && cp?.currentStudyDay === 2 && cp?.totalWordsIntroduced === 40 && logged, 'status=review_recorded csd=2 twi=40 log=true', `status=${r.result?.status} csd=${cp?.currentStudyDay} twi=${cp?.totalWordsIntroduced} log=${logged}`);
  check('3-reviewMode-persisted', 'reviewMode bit written true on the held throttle day (r/w)', cp?.reviewMode === true && r.result?.reviewMode === true, 'class_progress.reviewMode=true + result.reviewMode=true', `cp.reviewMode=${cp?.reviewMode} result.reviewMode=${r.result?.reviewMode}`);

  // 2c-pre: same throttle but the day review is PRE-epoch (grandfathered engaged) — throttle STILL holds (grandfather-independent)
  const g = await cpFixture('a2cpre', { csd: 2, twi: 40, wordCount: 500, recentSessions: [{ reviewScore: 0.1 }, { reviewScore: 0.1 }, { reviewScore: 0.1 }] });
  await seedAttempt(g, { studyDay: 3, sessionType: 'review', passed: true, submittedAt: preEpochTs, engagedReview: false });
  const rg = await callFn('completeSession', { classId: g.classId, listId: g.listId, sessionContext: { dayNumber: 3, reviewScore: 0.2 } }, g.student.idToken);
  const cpg = await readCp(g);
  check('2c-pre-throttle-HOLD', 'pre-epoch (grandfathered) throttle review-only STILL HOLDS (throttle independent of grandfather)', rg.ok && rg.result?.status === 'review_recorded' && cpg?.currentStudyDay === 2 && cpg?.totalWordsIntroduced === 40, 'status=review_recorded csd=2 twi=40', `status=${rg.result?.status} csd=${cpg?.currentStudyDay} twi=${cpg?.totalWordsIntroduced}`);
}

// ════════════════════════════════════════════════════════════════════════════
// #4 CHALLENGE CANNOT BYPASS THE HOLD (advanceForChallenge on a reviewMode-held day)
// ════════════════════════════════════════════════════════════════════════════
{
  const f = await cpFixture('a4', { csd: 2, twi: 40, wordCount: 500, reviewMode: true, recentSessions: [{ reviewScore: 0.1 }, { reviewScore: 0.1 }, { reviewScore: 0.1 }] });
  // review-phase challenge at the current boundary (studyDay === csd+1 === 3), fail->pass transition
  const attemptId = await seedAttempt(f, { studyDay: 3, sessionType: 'review', passed: true, score: 100, docId: `${f.student.uid}_${f.classId}_${f.listId}_chal` });
  const r = await callFn('advanceForChallenge', { attemptId, previousScore: 0 }, TEACHER.idToken);
  const cp = await readCp(f);
  check('4-challenge-cannot-bypass', 'advanceForChallenge on a held (reviewMode) day does NOT advance; persisted csd unchanged', r.ok && r.result?.advanced === false && cp?.currentStudyDay === 2, "advanced=false (review_mode_hold) + csd unchanged=2", `advanced=${r.result?.advanced} reason=${r.result?.reason} csd=${cp?.currentStudyDay}`);
}

// ════════════════════════════════════════════════════════════════════════════
// #5b STALE-DAY day-guard: rejected, csd/twi unchanged, session cleared, EXACTLY ONE clear/FAILED log
// ════════════════════════════════════════════════════════════════════════════
{
  const f = await cpFixture('a5b', { csd: 2, twi: 40, wordCount: 500, recentSessions: [{ day: 2 }] });
  await adb().doc(`users/${f.student.uid}/session_states/${f.classId}_${f.listId}`).set({ phase: 'new' });
  const r = await callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: { dayNumber: 4 } }, f.student.idToken); // expectedDay=3, not idempotent
  const cp = await readCp(f);
  const cleared = (await countLogs('day_guard_rejected_session_cleared', nowMs, (d) => d.userId === f.student.uid)).count;
  const failed = (await countLogs('day_guard_session_clear_FAILED', nowMs, (d) => d.userId === f.student.uid)).count;
  const sess = await adb().doc(`users/${f.student.uid}/session_states/${f.classId}_${f.listId}`).get();
  check('5b-stale-dayguard', 'stale day => day_guard_rejected, csd/twi unchanged, session cleared, exactly one clear/FAILED log', r.ok && r.result?.dayGuardRejected === true && cp?.currentStudyDay === 2 && cp?.totalWordsIntroduced === 40 && !sess.exists && (cleared + failed) === 1, 'dayGuardRejected=true csd=2 twi=40 sessionCleared=true clearLogs=1', `dayGuardRejected=${r.result?.dayGuardRejected} csd=${cp?.currentStudyDay} twi=${cp?.totalWordsIntroduced} sessExists=${sess.exists} cleared=${cleared} failed=${failed}`);
}

// ════════════════════════════════════════════════════════════════════════════
// #6 NO CANONICAL WRITES — zero users/{uid}/list_progress for every test uid during the run
// ════════════════════════════════════════════════════════════════════════════
{
  let canonicalCount = 0; const offenders = [];
  for (const uid of uids) {
    const n = (await adb().collection(`users/${uid}/list_progress`).get()).size;
    canonicalCount += n; if (n > 0) offenders.push(`${uid.slice(0, 8)}:${n}`);
  }
  check('6-no-canonical-writes', 'ZERO users/{uid}/list_progress docs across all test uids (LIST_PROGRESS_CANONICAL=false)', canonicalCount === 0, 'canonical list_progress = 0', `count=${canonicalCount}${offenders.length ? ' offenders=' + offenders.join(',') : ''} uids=${uids.length}`);
}

// ── verdict + artifact ──
const allPass = postureExpected && results.length > 0 && results.every((r) => r.verdict === 'PASS');
const cert = {
  tool: 'lsr_deepfix_p4cert.mjs', runId: RUN_ID, certifiedSha: CERT_SHA,
  ranAt: new Date().toISOString(), emulator: { project: emu.project, firestore: emu.firestoreHost, functions: emu.cfHost },
  pinnedPosture: posture, postureMatchesProd: postureExpected, grandfatherEpochMs: EPOCH,
  assertions: results,
  summary: { total: results.length, pass: results.filter((r) => r.verdict === 'PASS').length, fail: results.filter((r) => r.verdict === 'FAIL').length },
  verdict: allPass ? 'CERTIFIED' : 'FAILED',
};
const outPath = resolve(HERE, 'findings', `deepfix_p4_behavioral_cert_${CERT_SHA}.json`);
writeFileSync(outPath, JSON.stringify(cert, null, 2));
console.log(`\n=== P4 CERT ${cert.verdict} — ${cert.summary.pass}/${cert.summary.total} PASS (posture ok=${postureExpected}) ===`);
console.log(`artifact: ${outPath}`);
process.exit(allPass ? 0 : 1);
