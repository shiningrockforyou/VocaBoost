/**
 * lsr_deepfix_d35_tier1.mjs — D3.5 TIER-1 emulator recovery harness (fast pre-filter over the 156).
 * Extends the proven lsr_deepfix_p4cert.mjs pattern: seed each recovery family's PRE-FIX broken state in the
 * emulator at the PINNED PROD flag posture (M-B), drive completeSession, and judge PASS/FAIL/INVALID_PRECONDITION
 * against the CS-corrected expected recovery (M1 hysteresis, M2 list-end reason-split). Self-seeding + self-judging.
 * PIN: run on the tree == 0ddbb34 (hash-verify by runner), NO flag_on flip. Sandbox ids only.
 *   node audit/playwright/lsr_deepfix_d35_tier1.mjs <runId>   (child of firebase emulators:exec)
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectEmulator, adb, makeStudent, assertSandboxTarget, SANDBOX_CLASS_PREFIX, SANDBOX_LIST_PREFIX, cleanId, callFn, countLogs } from './lsr_deepfix_emu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const RUN_ID = (process.argv[2] || `d35t1_${Date.now()}`).replace(/[^A-Za-z0-9_.-]/g, '');
const CLEAN = cleanId(RUN_ID);
const EPOCH = 1784333239063;
const CERT_SHA = '0ddbb34';
const Ts = admin.firestore.Timestamp;
const nowMs = Date.now();

const emu = detectEmulator();
if (!emu.ok) { console.error('[d35t1] emulator not detected: ' + emu.reason); process.exit(1); }

// ── PROD flag posture pin (M-B: incl RECOVERY_SCORE_CLAMP + REVIEW_ENGAGEMENT_STAMP); mismatch => INVALID_PRECONDITION ──
const fnd = readFileSync(resolve(REPO, 'functions/foundation.js'), 'utf8');
const flag = (n) => { const m = fnd.match(new RegExp(`(?:export\\s+)?const\\s+${n}\\s*=\\s*(true|false)\\b`)); return m ? m[1] === 'true' : null; };
const epochSrc = (() => { const m = fnd.match(/FORCED_PATHWAY_GRANDFATHER_EPOCH_MS\s*=\s*(-?\d+|null)/); return m ? (m[1] === 'null' ? null : Number(m[1])) : undefined; })();
const posture = { FORCED_PATHWAY_ENABLED: flag('FORCED_PATHWAY_ENABLED'), epoch: epochSrc, SERVER_COMPLETE_SESSION_ENABLED: flag('SERVER_COMPLETE_SESSION_ENABLED'), SERVER_RESOLVE_LIST_PROGRESS_ENABLED: flag('SERVER_RESOLVE_LIST_PROGRESS_ENABLED'), SERVER_RESET_PROGRESS_ENABLED: flag('SERVER_RESET_PROGRESS_ENABLED'), SERVER_ADVANCE_FOR_CHALLENGE_ENABLED: flag('SERVER_ADVANCE_FOR_CHALLENGE_ENABLED'), ANCHOR_VALIDATION_SHADOW: flag('ANCHOR_VALIDATION_SHADOW'), RECOVERY_SCORE_CLAMP_ENABLED: flag('RECOVERY_SCORE_CLAMP_ENABLED'), REVIEW_ENGAGEMENT_STAMP_ENABLED: flag('REVIEW_ENGAGEMENT_STAMP_ENABLED'), LIST_PROGRESS_CANONICAL: flag('LIST_PROGRESS_CANONICAL'), ANCHOR_VALIDATION_ENFORCE: flag('ANCHOR_VALIDATION_ENFORCE'), CYCLING_ENABLED: flag('CYCLING_ENABLED') };
const postureOk = posture.FORCED_PATHWAY_ENABLED === true && posture.epoch === EPOCH && posture.SERVER_COMPLETE_SESSION_ENABLED === true && posture.SERVER_RESOLVE_LIST_PROGRESS_ENABLED === true && posture.SERVER_RESET_PROGRESS_ENABLED === true && posture.SERVER_ADVANCE_FOR_CHALLENGE_ENABLED === true && posture.ANCHOR_VALIDATION_SHADOW === true && posture.RECOVERY_SCORE_CLAMP_ENABLED === true && posture.REVIEW_ENGAGEMENT_STAMP_ENABLED === true && posture.LIST_PROGRESS_CANONICAL === false && posture.ANCHOR_VALIDATION_ENFORCE === false;

console.log(`\n=== D3.5 TIER-1 RECOVERY (${RUN_ID}) — pinned ${CERT_SHA} — posture ok=${postureOk} ===\n`);

const results = [];
const record = (id, family, verdict, why) => { results.push({ id, family, verdict, why }); console.log(`  ${verdict === 'PASS' ? '✅' : verdict === 'FAIL' ? '❌' : '⚠️'} ${id} ${verdict} — ${why}`); };
if (!postureOk) { record('POSTURE', 'pin', 'INVALID_PRECONDITION', 'flag posture != prod (M-B pin): ' + JSON.stringify(posture)); finish(); }

const TEACHER = await makeStudent(`lsr_d35t_teacher_${RUN_ID}@vocaboost.test`);
await adb().doc(`users/${TEACHER.uid}`).set({ role: 'teacher', displayName: 'D35T', email: TEACHER.email });

async function fx(tag, { csd = 0, twi = 0, wordCount = 500, recentSessions = [], reviewMode, interventionLevel = 0 } = {}) {
  const student = await makeStudent(`lsr_d35t_${tag}_${RUN_ID}@vocaboost.test`);
  const classId = `${SANDBOX_CLASS_PREFIX}${CLEAN}${tag}`; const listId = `${SANDBOX_LIST_PREFIX}${CLEAN}${tag}`;
  assertSandboxTarget({ classId, listId });
  await adb().doc(`classes/${classId}`).set({ name: `25WT ${tag}`, ownerTeacherId: TEACHER.uid, studentIds: [student.uid], assignments: { [listId]: { pace: 20, studyDaysPerWeek: 5, passThreshold: 90 } } });
  await adb().doc(`lists/${listId}`).set({ wordCount, title: `list ${tag}` });
  await adb().doc(`users/${student.uid}`).set({ role: 'student', enrolledClasses: { [classId]: true }, email: student.email });
  const cp = { classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi, recentSessions, interventionLevel, stats: {}, streakDays: 0, programStartDate: Ts.now() };
  if (reviewMode !== undefined) cp.reviewMode = reviewMode;
  await adb().doc(`users/${student.uid}/class_progress/${classId}_${listId}`).set(cp);
  return { student, classId, listId };
}
async function seedAtt(f, { studyDay, sessionType = 'new', passed = true, nwsi = null, nwei = null, score = 100, submittedAt = null, engagedReview, docId }) {
  const id = docId || `${f.student.uid}_${f.classId}_${f.listId}_d${studyDay}_${sessionType}_${Math.random().toString(36).slice(2, 6)}`;
  const d = { studentId: f.student.uid, classId: f.classId, listId: f.listId, teacherId: TEACHER.uid, testId: `vocaboost_test_${f.classId}_${f.listId}_${sessionType}`, sessionType, testType: 'mcq', studyDay, passed, score, newWordStartIndex: nwsi, newWordEndIndex: nwei, submittedAt: submittedAt || Ts.now(), writtenBy: 'seed' };
  if (engagedReview !== undefined) d.engagedReview = engagedReview;
  await adb().doc(`attempts/${id}`).set(d); return id;
}
const cpOf = (f) => adb().doc(`users/${f.student.uid}/class_progress/${f.classId}_${f.listId}`).get().then((s) => s.exists ? s.data() : null);
const complete = (f, sc) => callFn('completeSession', { classId: f.classId, listId: f.listId, sessionContext: sc }, f.student.idToken);

// ── A1 — throttle deadlock: good reviews escape (M1: still held after 1st; reviewMode exits after 2nd) ──
try {
  const f = await fx('a1', { csd: 5, twi: 400, wordCount: 500, recentSessions: [{ reviewScore: 0.23 }, { reviewScore: 0.17 }, { reviewScore: 0.23 }], reviewMode: true, interventionLevel: 1 });
  const r1 = await complete(f, { dayNumber: 6, reviewScore: 1.0 });     // 1st good review
  const cp1 = await cpOf(f);
  const r2 = await complete(f, { dayNumber: 6, reviewScore: 1.0 });     // 2nd good review
  const cp2 = await cpOf(f);
  const held1 = r1.result?.status === 'review_recorded' && cp1?.currentStudyDay === 5;      // still held after 1st (M1)
  const escaped = cp2?.reviewMode === false;                                                 // throttle EXITED after 2nd good review
  if (!held1) record('A1-throttle-escape', 'throttle', 'FAIL', `1st good review did not hold (M1): status=${r1.result?.status} csd=${cp1?.currentStudyDay}`);
  else if (!escaped) record('A1-throttle-escape', 'throttle', 'FAIL', `throttle did NOT exit after 2nd good review: reviewMode=${cp2?.reviewMode}`);
  else record('A1-throttle-escape', 'throttle', 'PASS', `1st review held (csd flat @5), throttle EXITED after 2nd (reviewMode=false) → next day allocates → escape`);
} catch (e) { record('A1-throttle-escape', 'throttle', 'INVALID_PRECONDITION', 'exception: ' + String(e).slice(0, 120)); }

// ── A2 — skip runaway: submit empty review 3× → HELD each time, csd flat (the headline fix) ──
try {
  const f = await fx('a2', { csd: 5, twi: 400, wordCount: 500, recentSessions: [{ reviewScore: 0.1 }, { reviewScore: 0.1 }, { reviewScore: 0.1 }], reviewMode: true, interventionLevel: 1 });
  let allHeld = true, csds = [];
  for (let i = 0; i < 3; i++) { const r = await complete(f, { dayNumber: 6, reviewScore: 0.0 }); const cp = await cpOf(f); csds.push(cp?.currentStudyDay); if (!(r.result?.status === 'review_recorded' && cp?.currentStudyDay === 5)) allHeld = false; }
  record('A2-skip-runaway', 'throttle', allHeld ? 'PASS' : 'FAIL', allHeld ? `held all 3 empty reviews, csd flat @5 (no runaway)` : `runaway: csds=${JSON.stringify(csds)}`);
} catch (e) { record('A2-skip-runaway', 'throttle', 'INVALID_PRECONDITION', 'exception: ' + String(e).slice(0, 120)); }

// ── A3 — off-by-one: day-N new+review both passed (review-first), csd stuck at N-1 → completeSession reconciles to N ──
try {
  const f = await fx('a3', { csd: 1, twi: 20, wordCount: 500, recentSessions: [] });
  const reviewFirst = Ts.fromMillis(nowMs - 60_000);   // review submitted BEFORE the new anchor (the off-by-one trigger)
  await seedAtt(f, { studyDay: 2, sessionType: 'review', passed: true, submittedAt: reviewFirst, engagedReview: true }); // engaged → pairs (V2)
  await seedAtt(f, { studyDay: 2, sessionType: 'new', passed: true, nwsi: 20, nwei: 39, submittedAt: Ts.fromMillis(nowMs - 30_000) });
  const r = await complete(f, { dayNumber: 2, newWordScore: 0.95, reviewScore: 0.9 });
  const cp = await cpOf(f);
  if (r.result?.status === 'completed' && cp?.currentStudyDay === 2) record('A3-off-by-one', 'csd', 'PASS', `day completed, csd reconciled 1→2 (review-first anchor paired via V2)`);
  else record('A3-off-by-one', 'csd', r.result?.status === 'review_recorded' ? 'FAIL' : 'INVALID_PRECONDITION', `expected advance to csd=2, got status=${r.result?.status} csd=${cp?.currentStudyDay}`);
} catch (e) { record('A3-off-by-one', 'csd', 'INVALID_PRECONDITION', 'exception: ' + String(e).slice(0, 120)); }

// ── A6 — list-end (twi=listSize, csd=20), Day-21 review-only. M2: engaged→advances (0 new words); skip→held ──
try {
  const f = await fx('a6', { csd: 20, twi: 100, wordCount: 100, recentSessions: [] });   // finished list
  await seedAtt(f, { studyDay: 21, sessionType: 'review', passed: true, engagedReview: true });
  const r = await complete(f, { dayNumber: 21, reviewScore: 0.9 });
  const cp = await cpOf(f);
  const engagedAdvances = r.result?.status === 'completed' && cp?.currentStudyDay === 21 && cp?.totalWordsIntroduced === 100; // 0 new words, no deadlock error
  // skip arm on a 2nd list-end student
  const g = await fx('a6skip', { csd: 20, twi: 100, wordCount: 100, recentSessions: [] });
  await seedAtt(g, { studyDay: 21, sessionType: 'review', passed: true, engagedReview: false, submittedAt: Ts.now() }); // non-engaged (skipped) review present → F3 hold
  const rs = await complete(g, { dayNumber: 21, reviewScore: 0.0 });   // skipped/non-engaged review → held (M2: only skip/throttle holds on list-end)
  const cpg = await cpOf(g); const skipHeld = rs.result?.status === 'review_recorded' && cpg?.currentStudyDay === 20;
  if (engagedAdvances && skipHeld) record('A6-list-end', 'list-end', 'PASS', `engaged→completes+advances (csd 20→21, twi flat 100, no deadlock error); skip→held @20`);
  else record('A6-list-end', 'list-end', (r.errorStatus || rs.errorStatus) ? 'FAIL' : 'INVALID_PRECONDITION', `engagedAdvances=${engagedAdvances}(status=${r.result?.status} csd=${cp?.currentStudyDay}) skipHeld=${skipHeld}(status=${rs.result?.status} csd=${cpg?.currentStudyDay})`);
} catch (e) { record('A6-list-end', 'list-end', 'INVALID_PRECONDITION', 'exception: ' + String(e).slice(0, 120)); }

function finish() {
  const summary = { total: results.length, pass: results.filter(r => r.verdict === 'PASS').length, fail: results.filter(r => r.verdict === 'FAIL').length, invalid: results.filter(r => r.verdict === 'INVALID_PRECONDITION').length };
  const out = { tool: 'lsr_deepfix_d35_tier1.mjs', runId: RUN_ID, tier: 1, certifiedSha: CERT_SHA, pinnedPosture: posture, postureMatchesProd: postureOk, ranAt: new Date().toISOString(), results, summary, verdict: summary.fail === 0 && postureOk ? (summary.invalid === 0 ? 'ALL-PASS' : 'PASS-with-INVALID') : 'FAIL' };
  writeFileSync(resolve(HERE, 'findings', `deepfix_d35_tier1_${RUN_ID}.json`), JSON.stringify(out, null, 2));
  console.log(`\n=== TIER-1 ${out.verdict} — pass ${summary.pass}/${summary.total} (fail ${summary.fail}, invalid ${summary.invalid}) ===`);
  process.exit(summary.fail === 0 ? 0 : 1);
}
finish();
