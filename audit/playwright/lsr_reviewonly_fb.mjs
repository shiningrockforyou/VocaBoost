/**
 * lsr_reviewonly_fb.mjs — Admin-SDK DATA layer for the review-only Phase-1 acceptance audit.
 * (design: docs/plans/PLAN_reviewonly_playwright_audit.md v2, Codex GO)
 *
 * SAFETY (Lens B): "local-only isolates the CODE, not the DATA" — the Admin SDK hits the SAME prod Firebase
 * regardless of the browser BASE. So EVERY seed WRITE here is gated on a verified SANDBOX TRIPLE
 * {uid of an lsr_*@vocaboost.test student, a 25WT-prefixed class, its cloned list}. Reads are strictly .get().
 * NEVER 26SM / real students. This module is NOT imported by lsr_ui.mjs (that module forbids Admin SDK).
 *
 * ASSUMPTIONS TO VERIFY on first run (flagged in the build manifest):
 *   A1. study_states doc id == wordId (studyService.js:697,340). seedAllMasteredTerminal needs the list's
 *       wordIds — getListWordIds() reads them; the words-collection path is a best guess (see below).
 *   A2. WORD_STATUS.MASTERED string value == 'MASTERED' (studyTypes.js). Verify against the enum.
 *   A3. seedFix9Anchor: a passed 'new' attempt + no review attempt for the day → determineStartingPhase returns
 *       REVIEW_STUDY on re-entry (studyService.js:94). Confirm the day/attempt shape yields startPhase REVIEW_STUDY.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo-relative (this file lives at <repo>/audit/playwright/) + env override → portable across WSL + native Windows.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEY = process.env.LSR_SA_KEY || resolve(REPO, 'scripts', 'serviceAccountKey.json');
const SANDBOX_STUDENT_RE = /^lsr_.*@vocaboost\.test$/;
const SANDBOX_CLASS_PREFIX = '25WT';

let _db = null;
export function db() {
  if (_db) return _db;
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))) });
  }
  _db = admin.firestore();
  return _db;
}
export const getDocId = (classId, listId) => `${classId}_${listId}`;
export const now = () => admin.firestore.Timestamp.now();
export const tsPlusDays = (d) => admin.firestore.Timestamp.fromMillis(Date.now() + d * 24 * 3600 * 1000);

export async function uidByEmail(email) {
  // Return null ONLY for a genuinely-missing account (auth/user-not-found). Re-throw any other error
  // (uninitialized admin, permission, network) so infra failures can't masquerade as "no uid" — the
  // silent blanket-catch masked a missing admin.initializeApp() across M-NET r20/r21/r22 (winclaude_022).
  try { return (await admin.auth().getUserByEmail(email)).uid; }
  catch (e) { if (e && e.code === 'auth/user-not-found') return null; throw e; }
}

// Authoritative list size = the `lists/{listId}.wordCount` the app itself reads (studyService.js:231),
// NOT TIER_SIZE (the cloned audit lists are tier "legacy", absent from that map). Used for list-end seeds.
export async function readListWordCount(listId) {
  const s = await db().collection('lists').doc(listId).get();
  const n = s.exists ? (s.data().wordCount || 0) : 0;
  if (!n) throw new Error(`[readListWordCount] list ${listId} has no wordCount — INVALID`);
  return n;
}

// ── FAIL-CLOSED SANDBOX GUARD — call before ANY seed write ────────────────────────────────────────────────
// Verifies the {student email, className, classId, listId} are all sandbox. Throws (INVALID) otherwise.
// className is resolved from the classes doc so a caller can't spoof it.
export async function assertSandboxTriple({ email, uid, classId, listId }) {
  if (!email || !SANDBOX_STUDENT_RE.test(email)) throw new Error(`[SANDBOX GUARD] student "${email}" is not lsr_*@vocaboost.test — REFUSING (INVALID)`);
  if (!uid) throw new Error(`[SANDBOX GUARD] no uid for "${email}" — REFUSING`);
  if (!classId || !listId) throw new Error(`[SANDBOX GUARD] missing classId/listId — REFUSING`);
  const cd = await db().collection('classes').doc(classId).get();
  if (!cd.exists) throw new Error(`[SANDBOX GUARD] class ${classId} not found — REFUSING`);
  const name = cd.data().name || '';
  if (!name.startsWith(SANDBOX_CLASS_PREFIX)) throw new Error(`[SANDBOX GUARD] class "${name}" is not ${SANDBOX_CLASS_PREFIX}-prefixed — REFUSING (never 26SM)`);
  const assigned = (cd.data().assignments || {})[listId];
  if (!assigned) throw new Error(`[SANDBOX GUARD] list ${listId} not assigned to class ${classId} — REFUSING`);
  return { className: name };
}

// ── READ-ONLY ORACLES (.get() only) ───────────────────────────────────────────────────────────────────────
export async function readProgress(uid, classId, listId) {
  const s = await db().collection('users').doc(uid).collection('class_progress').doc(getDocId(classId, listId)).get();
  if (!s.exists) return { exists: false, csd: 0, twi: 0, recentSessions: [], interventionLevel: 0, stats: null };
  const d = s.data();
  return {
    exists: true,
    csd: d.currentStudyDay || 0,
    twi: d.totalWordsIntroduced || 0,
    recentSessions: d.recentSessions || [],
    interventionLevel: d.interventionLevel ?? 0,
    stats: d.stats || null,
  };
}
export async function readSessionsCount(uid) {
  const s = await db().collection('users').doc(uid).collection('sessions').get();
  return s.size;
}
export async function readSessionState(uid, classId, listId) {
  const s = await db().collection('users').doc(uid).collection('session_states').doc(getDocId(classId, listId)).get();
  return s.exists ? s.data() : null;
}
export async function readAttempts(uid, classId, listId) {
  const att = await db().collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get();
  const mine = att.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.classId === classId);
  return {
    all: mine,
    newAttempts: mine.filter((a) => a.sessionType === 'new').length,
    reviewAttempts: mine.filter((a) => a.sessionType === 'review').length,
    newPassed: mine.filter((a) => a.sessionType === 'new' && a.passed === true).length,
  };
}
// Read system_logs of given types for this uid since a ms timestamp (for the pre-verifier + RA8).
export async function readSystemLogsSince(uid, sinceMs, types) {
  const out = {};
  for (const t of types) {
    try {
      const snap = await db().collection('system_logs').where('type', '==', t).get();
      out[t] = snap.docs.map((d) => d.data()).filter((x) => x.userId === uid && (!sinceMs || (x.timestamp?._seconds || 0) * 1000 >= sinceMs)).length;
    } catch { out[t] = null; }
  }
  return out;
}

// A composite state snapshot for RA6 before/after + manifest binding (Codex RAD-6).
export async function snapshotState(uid, classId, listId) {
  const p = await readProgress(uid, classId, listId);
  const sessions = await readSessionsCount(uid);
  const snap = { csd: p.csd, twi: p.twi, recentLen: p.recentSessions.length, sessions };
  snap.hash = `csd${snap.csd}|twi${snap.twi}|rs${snap.recentLen}|se${snap.sessions}`;
  return snap;
}

// ── SEEDS (each asserts the sandbox triple BEFORE writing) ────────────────────────────────────────────────
const progRef = (uid, classId, listId) => db().collection('users').doc(uid).collection('class_progress').doc(getDocId(classId, listId));

// Pin intervention=1.0 deterministically (design RA1/RA2, Codex RAD-5): three recentSessions with reviewScore
// 0.25 (avg ≤0.30 → calculateInterventionLevel returns 1.0, studyAlgorithm.js:66-91) and newWordScore null.
export async function seedInterventionWindow({ email, uid, classId, listId, csd = 4, twi }, guardCtx) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const rs = [1, 2, 3].map((day) => ({
    day, date: now(), newWordScore: null, reviewScore: 0.25,
    segmentStartIndex: 0, segmentEndIndex: 0, wordsIntroduced: 0, wordsReviewed: 0, wordsTested: 0,
  }));
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: csd, ...(twi != null ? { totalWordsIntroduced: twi } : {}),
    interventionLevel: 1.0, recentSessions: rs,
    stats: { avgNewWordScore: null, avgReviewScore: 0.25 },
    programStartDate: now(), updatedAt: now(),
  }, { merge: true });
  return { recentSessions: rs.length };
}

// List-end fixture (design RA5/RA5b): totalWordsIntroduced = twi (=listSize for RA5, >listSize for RA5b),
// LOW csd (avoid csd_implausible), attempts LEFT EMPTY (clean no-attempt seed is preserved by reconciliation —
// safeTWI = Math.max(storedTWI,twi), progressService.js:236; does NOT trip csd_anchor_invalid).
export async function seedListEnd({ email, uid, classId, listId, twi, csd = 2 }, guardCtx) {
  await assertSandboxTriple({ email, uid, classId, listId });
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi,
    interventionLevel: 0, programStartDate: now(), updatedAt: now(),
  }, { merge: true });
  return { twi, csd };
}

// All-mastered terminal (design RA6): seedListEnd + every introduced word's study_state MASTERED with
// returnAt = now+21d (else returnMasteredWords flips them back → non-empty segment → wrong branch, Lens C MED5).
export async function seedAllMasteredTerminal({ email, uid, classId, listId, twi, csd = 2, wordIds }, guardCtx) {
  await assertSandboxTriple({ email, uid, classId, listId });
  await seedListEnd({ email, uid, classId, listId, twi, csd });
  if (!wordIds || !wordIds.length) throw new Error('[seedAllMasteredTerminal] no wordIds — cannot seed MASTERED study_states (INVALID)');
  const batch = db().batch();
  const rt = tsPlusDays(21);
  wordIds.forEach((wid, i) => {
    const ref = db().collection('users').doc(uid).collection('study_states').doc(wid);
    batch.set(ref, {
      status: 'MASTERED', listId, wordIndex: i, introducedOnDay: 1,      // A2: verify WORD_STATUS.MASTERED string
      masteredAt: now(), returnAt: rt,
      timesTestedTotal: 3, timesCorrectTotal: 3, lastTestResult: 'correct',
    }, { merge: true });
  });
  await batch.commit();
  return { mastered: wordIds.length, returnAt: '+21d' };
}

// Fix-#9 review-resume anchor (design RA9): a VALID position-bearing passed 'new' attempt for `studyDay`
// (mirrors scripts/cs/manual-pass.mjs) so re-entry yields startPhase REVIEW_STUDY with a genuine passing score.
export async function seedFix9Anchor({ email, uid, classId, listId, studyDay = 2, pace = 40, score = 97, passThreshold = 92 }, guardCtx) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const c = (await db().collection('classes').doc(classId).get()).data() || {};
  const thr = c.assignments?.[listId]?.passThreshold ?? passThreshold;
  const teacherId = c.ownerTeacherId || null;
  const newWordStartIndex = (studyDay - 1) * pace;
  const newWordEndIndex = studyDay * pace - 1;
  const twi = newWordEndIndex + 1;
  const docId = `${uid}_${classId}_${listId}_day${studyDay}_typed_new_reviewonlyaudit`;
  await db().collection('attempts').doc(docId).set({
    studentId: uid, classId, listId, teacherId,
    testId: `vocaboost_test_${classId}_${listId}_new`,
    sessionType: 'new', testType: 'typed', studyDay,
    score, passed: score >= thr, graded: true,
    newWordStartIndex, newWordEndIndex, wordsIntroduced: newWordEndIndex - newWordStartIndex + 1,   // VALID anchor
    isFirstDay: studyDay === 1, totalQuestions: 30, answers: [], skipped: 0,
    interventionLevel: 0, wordsReviewed: 0, segmentStartIndex: 0, segmentEndIndex: 0,
    manualOverride: false,
    manualReviewNote: `review-only audit RA9 anchor (${new Date().toISOString().slice(0, 10)})`,
    submittedAt: now(),
  }, { merge: true });
  // Ensure class_progress reflects the introduced range so startPhase logic sees the passed-new day.
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: studyDay, totalWordsIntroduced: twi,
    interventionLevel: 0, programStartDate: now(), updatedAt: now(),
  }, { merge: true });
  return { studyDay, twi, realScore01: score / 100, newWordEndIndex };
}

// A1: read the list's word ids (for seedAllMasteredTerminal). PATH IS AN ASSUMPTION — verify on first run.
// Tries the two plausible shapes: lists/{listId}/words subcollection, then a top-level `words` where listId==.
export async function getListWordIds(listId, { limit = 0 } = {}) {
  let ids = [];
  try {
    const sub = await db().collection('lists').doc(listId).collection('words').get();
    ids = sub.docs.map((d) => d.id);
  } catch { /* try top-level */ }
  if (!ids.length) {
    try {
      const top = await db().collection('words').where('listId', '==', listId).get();
      ids = top.docs.map((d) => d.id);
    } catch { /* */ }
  }
  if (!ids.length) throw new Error(`[getListWordIds] could not resolve word ids for list ${listId} (ASSUMPTION A1 — confirm the words collection path) — INVALID`);
  return limit ? ids.slice(0, limit) : ids;
}

// ── PRE-VERIFIER (design §4; Codex RAD-3 safety net) ──────────────────────────────────────────────────────
// After seeding, confirm the intended state WOULD result and no reconciliation anomaly was logged. Returns
// {ok, reason}. Caller treats !ok as INVALID (not FAIL, not PASS). `expected` = {isListComplete?, listSize?}.
export async function preVerify(uid, classId, listId, expected, sinceMs) {
  const p = await readProgress(uid, classId, listId);
  const problems = [];
  if (expected.isListComplete === true) {
    const remaining = (expected.listSize ?? 0) - p.twi;
    if (!(remaining <= 0)) problems.push(`expected isListComplete but wordsRemaining=${remaining} (twi=${p.twi}, listSize=${expected.listSize})`);
  }
  if (expected.isListComplete === false && expected.listSize != null) {
    const remaining = expected.listSize - p.twi;
    if (remaining <= 0) problems.push(`expected !isListComplete but wordsRemaining=${remaining}`);
  }
  const logs = await readSystemLogsSince(uid, sinceMs, ['csd_anchor_invalid', 'csd_implausible']);
  if (logs.csd_anchor_invalid) problems.push(`csd_anchor_invalid logged ×${logs.csd_anchor_invalid}`);
  if (logs.csd_implausible) problems.push(`csd_implausible logged ×${logs.csd_implausible}`);
  return { ok: problems.length === 0, reason: problems.join('; '), progress: p };
}

// ── RESET (guarded, sandbox-only) — deterministic clean slate for a {student,class,list} before a scenario.
// Deletes are the ONLY writes besides seeds; both are gated on assertSandboxTriple. Scoped to THIS triple only.
export async function resetStudentState({ email, uid, classId, listId }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const u = db().collection('users').doc(uid);
  await u.collection('class_progress').doc(getDocId(classId, listId)).delete().catch(() => {});
  await u.collection('session_states').doc(getDocId(classId, listId)).delete().catch(() => {});
  // attempts + study_states for THIS list only
  const att = await db().collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get();
  const b1 = db().batch(); att.docs.filter((d) => d.data().classId === classId).forEach((d) => b1.delete(d.ref)); await b1.commit().catch(() => {});
  const ss = await u.collection('study_states').where('listId', '==', listId).get();
  const b2 = db().batch(); ss.docs.forEach((d) => b2.delete(d.ref)); await b2.commit().catch(() => {});
  // sessions are keyed loosely; delete this list's completed-session records for a clean RA6 count baseline.
  const se = await u.collection('sessions').where('listId', '==', listId).get();
  const b3 = db().batch(); se.docs.filter((d) => (d.data().classId === classId)).forEach((d) => b3.delete(d.ref)); await b3.commit().catch(() => {});
  return { reset: true };
}

export const SANDBOX = { SANDBOX_STUDENT_RE, SANDBOX_CLASS_PREFIX };
