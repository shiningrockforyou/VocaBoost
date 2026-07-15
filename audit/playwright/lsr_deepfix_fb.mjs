/**
 * lsr_deepfix_fb.mjs — Admin-SDK DATA layer for the deepfix M-UI audit (RO + RS blocks).
 *
 * EXTENDS lsr_reviewonly_fb.mjs: RE-EXPORTS its fail-closed sandbox guard, its existing RO-block
 * seeds, its read-only oracles, preVerify, snapshotState and resetStudentState UNCHANGED
 * (`export * from`), and ADDS the §3 seed helpers the new RO-S* and RS-* scenarios need. Same
 * discipline: every seed WRITE goes through `assertSandboxTriple` FIRST (lsr_*@vocaboost.test
 * student + 25WT-prefixed class + its cloned list). Reads are strictly `.get()`. NEVER 26SM.
 *
 * Design oracle: audit/deepfix/task4/AUDIT_DESIGN.md §1.B (RO), §1.C (RS), §3 (seed + pre-verify).
 * CLAUDE.md rule: an anchor-bearing (passed `new`) attempt MUST carry the FULL valid anchor
 * (newWordStartIndex/newWordEndIndex/wordsIntroduced/testId). The gradebook-visibility fixtures
 * below are written as `review`/`manual` attempts (NOT reconciliation anchors) precisely so they
 * are exempt from that rule and cannot forge an invalid anchor; there are NO deliberately-forged
 * anchor fixtures in THIS module (those live in the M-CALL/M-MIG/M-RULES modules, per §3).
 *
 * NEW-vs-REUSE (AUDIT_DESIGN §7): reused = assertSandboxTriple, seedInterventionWindow, seedListEnd,
 * seedAllMasteredTerminal, seedFix9Anchor, getListWordIds, preVerify, snapshotState, readProgress,
 * readAttempts, readSessionState, readSystemLogsSince, resetStudentState. New here = seedDeepGradebook
 * (RS-1), seedTestIdlessAttempt (RS-2), seedAssignedListsEmpty (RS-3), seedDriftedAssignment (RS-4),
 * bumpStudyDay (RO-S10 collision), + read helpers readClassDoc / readMember.
 */
import admin from 'firebase-admin';
import { db, now, tsPlusDays, getDocId, assertSandboxTriple, readProgress } from './lsr_reviewonly_fb.mjs';

// Re-export the whole reviewonly data layer (guards + RO seeds + oracles + preVerify + reset).
export * from './lsr_reviewonly_fb.mjs';

const isoDay = () => new Date().toISOString().slice(0, 10);
const tsAt = (ms) => admin.firestore.Timestamp.fromMillis(ms);
const FieldValue = admin.firestore.FieldValue;
// Local class_progress ref (the reviewonly module keeps its own private one; we mirror it here).
const progRef = (uid, classId, listId) => db().collection('users').doc(uid).collection('class_progress').doc(getDocId(classId, listId));

// ── extra read-only oracles (design §1.C pre-verify) ─────────────────────────────────────────────────────────
export async function readClassDoc(classId) {
  const s = await db().collection('classes').doc(classId).get();
  return s.exists ? s.data() : null;
}
export async function readMember(classId, uid) {
  const s = await db().collection('classes').doc(classId).collection('members').doc(uid).get();
  return s.exists ? s.data() : null;
}

// Build one gradebook-visibility attempt row. Written as a NON-anchor attempt (sessionType
// 'review'/'manual') so it renders in the teacher gradebook WITHOUT being a CSD/TWI reconciliation
// anchor (CLAUDE.md rule) — no invalid-anchor hazard. Stamps BOTH teacherId (today's base predicate)
// and teacherIds[] (the P10 array-contains predicate) so the fixture is visible under either flag.
function gradebookAttempt({ uid, classId, listId, teacherId, submittedAt, score = 88, sessionType = 'review', tag, withTestId = true }) {
  return {
    studentId: uid, classId, listId,
    teacherId, teacherIds: teacherId ? [teacherId] : [],
    ...(withTestId ? { testId: `vocaboost_test_${classId}_${listId}_${sessionType}` } : {}),
    sessionType, testType: 'typed',
    score, passed: true, graded: true,
    totalQuestions: 30, correctAnswers: Math.round((30 * score) / 100), skipped: 0, answers: [],
    submittedAt,
    manualReviewNote: `deepfix ${tag} fixture (${isoDay()})`,
  };
}

// ── RS-1 · seedDeepGradebook (the 이지후 >50-attempts-deep shape) ─────────────────────────────────────────────
// C-33: prove the gradebook Name filter is SERVER-side. `target` ranks DEEP (its attempts are OLDER
// than `aheadCount` filler attempts, so unfiltered they land on page 2+); a Name filter must still
// surface them on page 1. Sets the target's member displayName to a distinctive TOKEN so the
// server-side studentId push (name→id map) resolves it. `target`/`filler` = {email, uid}; both must be
// DISTINCT sandbox students (else the filter can't isolate the deep student).
export async function seedDeepGradebook({ target, filler, classId, listId, aheadCount = 55, targetCount = 3, displayToken }) {
  await assertSandboxTriple({ email: target.email, uid: target.uid, classId, listId });
  await assertSandboxTriple({ email: filler.email, uid: filler.uid, classId, listId });
  if (target.uid === filler.uid) throw new Error('[seedDeepGradebook] target and filler are the same student — need TWO distinct sandbox students (INVALID)');
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const teacherId = cd.ownerTeacherId || null;
  if (!teacherId) throw new Error(`[seedDeepGradebook] class ${classId} has no ownerTeacherId — gradebook base predicate cannot match (INVALID)`);
  const token = displayToken || `LSRDEEP${classId.slice(-4).toUpperCase()}`;

  // 1) distinctive member displayName for the TARGET (the name→id resolution the server filter uses).
  await db().collection('classes').doc(classId).collection('members').doc(target.uid)
    .set({ displayName: token, email: target.email }, { merge: true });

  // 2) filler: aheadCount NEWER attempts → they fill page 1, pushing the target off it.
  const baseNew = Date.now();
  let batch = db().batch();
  let n = 0;
  for (let i = 0; i < aheadCount; i++) {
    const ref = db().collection('attempts').doc(`audit_deepgb_${classId}_${listId}_filler_${i}`);
    batch.set(ref, gradebookAttempt({ uid: filler.uid, classId, listId, teacherId, submittedAt: tsAt(baseNew + i * 1000), score: 80, tag: 'RS-1' }));
    if (++n % 400 === 0) { await batch.commit(); batch = db().batch(); }
  }
  await batch.commit();

  // 3) target: targetCount OLDER attempts (deep — before all filler on submittedAt-desc).
  const baseOld = Date.now() - 45 * 24 * 3600 * 1000;
  const tb = db().batch();
  for (let i = 0; i < targetCount; i++) {
    const ref = db().collection('attempts').doc(`audit_deepgb_${classId}_${listId}_target_${i}`);
    tb.set(ref, gradebookAttempt({ uid: target.uid, classId, listId, teacherId, submittedAt: tsAt(baseOld + i * 1000), score: 88, tag: 'RS-1' }));
  }
  await tb.commit();
  return { token, aheadCount, targetCount, teacherId };
}

// ── RS-2 · seedTestIdlessAttempt (C-34: field-first listId, testId-less row still visible) ───────────────────
// An automarker/manual attempt with NO testId but WITH listId. The gradebook must resolve the list
// field-first (`attemptData.listId ?? parsedListId`, db.js:1564 region) and render the row with the
// list title. Also sets a distinctive member displayName token so the Name filter can isolate it.
export async function seedTestIdlessAttempt({ email, uid, classId, listId, sessionType = 'review', displayToken }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const teacherId = cd.ownerTeacherId || null;
  if (!teacherId) throw new Error(`[seedTestIdlessAttempt] class ${classId} has no ownerTeacherId (INVALID)`);
  const token = displayToken || `LSRIDLESS${classId.slice(-4).toUpperCase()}`;
  await db().collection('classes').doc(classId).collection('members').doc(uid)
    .set({ displayName: token, email }, { merge: true });
  const docId = `audit_testidless_${uid}_${classId}_${listId}`;
  // withTestId:false → the C-34 condition (row must survive the parse on attemptData.listId alone).
  await db().collection('attempts').doc(docId).set(
    gradebookAttempt({ uid, classId, listId, teacherId, submittedAt: now(), score: 100, sessionType, tag: 'RS-2', withTestId: false }),
  );
  return { docId, token, teacherId };
}

// ── RS-3 · seedAssignedListsEmpty (C-35: assignedLists:[] + populated assignments) ───────────────────────────
// Force the split-brain shape: the legacy `assignedLists` array is EMPTY ([] is truthy — the pre-fix
// `assignedLists || Object.keys(assignments)` never falls back), while `assignments` still carries the
// list. getAssignedListIds' length-check must fall back to Object.keys(assignments) so the list renders
// on BOTH the student and teacher surfaces. Run AFTER provisioning (which populates assignedLists).
export async function seedAssignedListsEmpty({ email, uid, classId, listId }) {
  await assertSandboxTriple({ email, uid, classId, listId }); // asserts assignments[listId] present
  await db().collection('classes').doc(classId).set({ assignedLists: [] }, { merge: true });
  return { assignedLists: [] };
}

// ── RS-4 · seedDriftedAssignment (C-23: 90-tier + UNDEFINED retakeThreshold) ─────────────────────────────────
// The class assignment carries passThreshold:90 and NO retakeThreshold field (the drift). A genuine
// score in [90,95) must DISPLAY as pass via the stored serverPassed verdict (TypedTest.jsx:1385) —
// the client's 0.95 default (TypedTest.jsx:87) must NOT invent a fail. FieldValue.delete() guarantees
// the undefined-threshold state even if provisioning wrote one.
export async function seedDriftedAssignment({ email, uid, classId, listId, passThreshold = 90 }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  await db().collection('classes').doc(classId).update({
    [`assignments.${listId}.passThreshold`]: passThreshold,
    [`assignments.${listId}.retakeThreshold`]: admin.firestore.FieldValue.delete(),
  });
  return { passThreshold, retakeThreshold: undefined };
}

// ── RO-S10 · bumpStudyDay (mid-session concurrent-completion collision, sandbox) ──────────────────────────────
// Simulate "another device already completed today": advance the canonical currentStudyDay by `by`
// while a session is mid-test. On submit the day-guard must REBUILD (never a false success), and csd
// must advance EXACTLY ONCE (this bump), not twice. Read-then-set (not blind increment) so the return
// pins the exact expected post value for the oracle.
export async function bumpStudyDay({ email, uid, classId, listId, by = 1 }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cur = await readProgress(uid, classId, listId);
  const to = cur.csd + by;
  await db().collection('users').doc(uid).collection('class_progress').doc(getDocId(classId, listId))
    .set({ currentStudyDay: to, updatedAt: now() }, { merge: true });
  return { from: cur.csd, to };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CHUNK-2 SEEDS — CUT (P4 client cutover) · CA (P8 CONT-A) · CY (P9 CYC) · OV (P10 OVR).
// SAME discipline as chunk 1: assertSandboxTriple FIRST on EVERY write (lsr_*@vocaboost.test + 25WT class + its
// assigned clone); reads are strictly .get(); NEVER 26SM. Anchor-bearing (passed-'new') attempts ALWAYS carry
// the FULL valid anchor (newWordStartIndex/newWordEndIndex/wordsIntroduced/testId — scripts/cs/manual-pass.mjs
// parity); the deliberately-special fixtures (seedPermafail, applyOverrideAnchor, seedImpossiblePhaseT,
// seedPendingChallenge, seedInheritedAttempt) are LABELED in-doc via manualReviewNote and confined to their
// scenario's student. Design oracle: AUDIT_DESIGN §1.E (CUT), §1.I (CA), §1.J (CY), §1.K (OV); §3 seed+pre-verify.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

// A FULL valid reconciliation anchor attempt (manual-pass parity). Shared by the anchor-bearing chunk-2 seeds
// so none of them can ever emit an invalid anchor (nwei == nwsi + wordsIntroduced - 1, testId present).
function validAnchorAttempt({ uid, classId, listId, teacherId, studyDay, pace, score, passThreshold, extra = {} }) {
  const newWordStartIndex = (studyDay - 1) * pace;
  const newWordEndIndex = studyDay * pace - 1;
  return {
    studentId: uid, classId, listId, teacherId, teacherIds: teacherId ? [teacherId] : [],
    testId: `vocaboost_test_${classId}_${listId}_new`,
    sessionType: 'new', testType: 'typed', studyDay,
    score, passed: score >= passThreshold, graded: true,
    newWordStartIndex, newWordEndIndex, wordsIntroduced: newWordEndIndex - newWordStartIndex + 1, // VALID anchor
    isFirstDay: studyDay === 1, totalQuestions: 30, answers: [], skipped: 0,
    interventionLevel: 0, wordsReviewed: 0, segmentStartIndex: 0, segmentEndIndex: 0,
    manualOverride: false, submittedAt: now(), ...extra,
  };
}

// ── extra read-only oracles for the chunk-2 pre-verifiers/oracles ─────────────────────────────────────────────
export async function readAssignment(classId, listId) {
  const cd = await readClassDoc(classId);
  return cd?.assignments?.[listId] || null;
}
export async function readUserSettings(uid) {
  const s = await db().collection('users').doc(uid).get();
  return s.exists ? (s.data().settings || {}) : {};
}
export async function readAttemptDoc(docId) {
  const s = await db().collection('attempts').doc(docId).get();
  return s.exists ? { id: s.id, ...s.data() } : null;
}
export async function readStudyStates(uid, listId) {
  const s = await db().collection('users').doc(uid).collection('study_states').where('listId', '==', listId).get();
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Guarded member-displayName token write (so a teacher gradebook/Students row is findable by a distinctive token).
export async function seedMemberToken({ email, uid, classId, listId, token }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  await db().collection('classes').doc(classId).collection('members').doc(uid).set({ displayName: token, email }, { merge: true });
  return { token };
}
// Guarded primaryFocus write/clear (CA-3 pin, CA-4 clear-then-recency). focusListId=null clears the pin.
export async function setPrimaryFocus({ email, uid, classId, listId, focusListId = null }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  await db().collection('users').doc(uid).set(
    { settings: { primaryFocusListId: focusListId, primaryFocusClassId: focusListId ? classId : null } }, { merge: true });
  return { focusListId };
}

// ── CA-1/CA-2/CA-6 · seedNextListLink — link a FINISHED list to `nextListId` on the LAUNCHING class ────────────
// C-13/§2.1: set assignments[listId].nextListId AND assign nextListId to the class (so the link is non-dangling
// and DailySessionFlow's classAssignedListIds guard passes). PURE config — writes NO progress record for the
// finished list. The caller separately seeds the finished-list terminal state on `listId` (seedAllMasteredTerminal
// or seedListEnd). Returns { nextListId, nextListTitle } for the button-copy oracle.
export async function seedNextListLink({ email, uid, classId, listId, nextListId }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  if (!nextListId || nextListId === listId) throw new Error('[seedNextListLink] need a DISTINCT nextListId (INVALID)');
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const primary = (cd.assignments || {})[listId] || {};
  // Clone the primary assignment as a valid session-init target for the next list; no onward link, no cycling.
  const nextAssignment = { ...primary, nextListId: null, cyclingEnabled: false, assignedAt: now() };
  await db().collection('classes').doc(classId).update({
    [`assignments.${nextListId}`]: nextAssignment,
    [`assignments.${listId}.nextListId`]: nextListId,
    assignedLists: FieldValue.arrayUnion(listId, nextListId),
  });
  await assertSandboxTriple({ email, uid, classId, listId: nextListId }); // now assigned → guard confirms sandbox
  const nl = await db().collection('lists').doc(nextListId).get();
  return { nextListId, nextListTitle: nl.exists ? (nl.data().title || null) : null };
}

// ── CA-3 · seedPinnedFinished — pin a FINISHED list as primary focus so the PIN branch must YIELD it ──────────
// F6-5: users/{uid}.settings.{primaryFocusListId,primaryFocusClassId} on a finished, next-linked list. Composes
// seedNextListLink. getPrimaryFocus's PIN branch must resolve PAST the finished link to nextListId (read-only,
// the pin itself is not rewritten by the derivation). Caller seeds the finished terminal state on `listId`.
export async function seedPinnedFinished({ email, uid, classId, listId, nextListId }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const link = await seedNextListLink({ email, uid, classId, listId, nextListId });
  await db().collection('users').doc(uid).set(
    { settings: { primaryFocusListId: listId, primaryFocusClassId: classId } }, { merge: true });
  return { ...link, pinnedListId: listId };
}

// ── CY-1/2/7 · seedCyclingAssignment — the per-assignment cycling gate (owner-teacher-only in-product) ─────────
// P9 TWO-KEY gate half #2: assignments[listId].cyclingEnabled === true (the GLOBAL CYCLING_ENABLED flag is the
// build-time half). Optionally also links nextListId (CY-7: the yield must be gated OFF for a cycling list even
// though a link exists). Caller seeds the finished terminal state on `listId`.
export async function seedCyclingAssignment({ email, uid, classId, listId, nextListId = null }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const update = { [`assignments.${listId}.cyclingEnabled`]: true };
  if (nextListId) {
    // reuse the link seed's non-dangling assignment write for the yield-gating oracle
    await seedNextListLink({ email, uid, classId, listId, nextListId });
  }
  await db().collection('classes').doc(classId).update(update);
  return { cyclingEnabled: true, nextListId };
}

// ── OV-1 · seedPermafail (LABELED) — a stuck student: a FAILED 'new' attempt, day NOT advanced ────────────────
// A failed 'new' attempt is NOT a reconciliation anchor (passed:false), so it is exempt from the passed-'new'
// anchor rule; wordsIntroduced:0 and the range fields are cosmetic. currentStudyDay is held at studyDay-1 (the
// student cannot pass the gate). The OVERRIDE that unsticks them (writing a VALID anchor + advancing) is the
// M-CALL / CS-6 leg; applyOverrideAnchor below stands in for it for the E2E unstick corollary.
export async function seedPermafail({ email, uid, classId, listId, studyDay = 2, pace = 3, score = 40 }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const teacherId = cd.ownerTeacherId || null;
  const newWordStartIndex = (studyDay - 1) * pace;
  const newWordEndIndex = studyDay * pace - 1;
  const docId = `audit_permafail_${uid}_${classId}_${listId}_day${studyDay}`;
  await db().collection('attempts').doc(docId).set({
    studentId: uid, classId, listId, teacherId, teacherIds: teacherId ? [teacherId] : [],
    testId: `vocaboost_test_${classId}_${listId}_new`,
    sessionType: 'new', testType: 'typed', studyDay,
    score, passed: false, graded: true,                     // FAILED — not an anchor
    newWordStartIndex, newWordEndIndex, wordsIntroduced: 0, // cosmetic only (not an anchor)
    isFirstDay: studyDay === 1, totalQuestions: 30, answers: [], skipped: 0,
    manualOverride: false, manualReviewNote: `deepfix OV-1 permafail fixture (${isoDay()})`, submittedAt: now(),
  });
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: studyDay - 1, totalWordsIntroduced: newWordStartIndex,
    interventionLevel: 0, programStartDate: now(), updatedAt: now(),
  }, { merge: true });
  return { studyDay, docId, teacherId, newWordStartIndex, newWordEndIndex };
}

// ── OV-1 (E2E unstick leg) · applyOverrideAnchor (LABELED) — STANDS IN for the P10 overrideAttempt callable ────
// Writes a VALID reconciliation anchor (manual-pass parity) + advances the day. The callable ITSELF (I-10 §6
// authz UNION + server derivation + audit-log row) is CS-6 / OV-1-CALL and is NOT exercised here; this seed
// certifies ONLY the unstick corollary (a valid override anchor advances the day / clears the gate).
export async function applyOverrideAnchor({ email, uid, classId, listId, studyDay = 2, pace = 3, score = 100, passThreshold = 92 }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const teacherId = cd.ownerTeacherId || null;
  const thr = cd.assignments?.[listId]?.passThreshold ?? passThreshold;
  const att = validAnchorAttempt({ uid, classId, listId, teacherId, studyDay, pace, score, passThreshold: thr,
    extra: { manualOverride: true, overriddenBy: teacherId, manualReviewNote: `deepfix OV-1 override anchor (${isoDay()})` } });
  const docId = `audit_override_${uid}_${classId}_${listId}_day${studyDay}`;
  await db().collection('attempts').doc(docId).set(att);
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: studyDay, totalWordsIntroduced: att.newWordEndIndex + 1, updatedAt: now(),
  }, { merge: true });
  return { studyDay, docId, twi: att.newWordEndIndex + 1, newWordEndIndex: att.newWordEndIndex };
}

// ── CUT-7 · seedImpossiblePhaseT (LABELED) — day-1-with-passed-new impossible state, STALE csd 0 ──────────────
// studyService.determineStartingPhase logs `impossible_phase_detected` on `dayNumber===1 && newTest.passed`.
// Writes a VALID passed-day-1 anchor but leaves currentStudyDay STALE at 0. The reconciled read (the
// resolveListProgress resolver under SERVER_PROGRESS_WRITE) must render the RECONCILED day (2) and emit NO event.
export async function seedImpossiblePhaseT({ email, uid, classId, listId, pace = 3, score = 100, passThreshold = 92 }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const teacherId = cd.ownerTeacherId || null;
  const thr = cd.assignments?.[listId]?.passThreshold ?? passThreshold;
  const att = validAnchorAttempt({ uid, classId, listId, teacherId, studyDay: 1, pace, score, passThreshold: thr,
    extra: { manualReviewNote: `deepfix CUT-7 impossible-phase fixture (stale csd=0 with passed day-1) (${isoDay()})` } });
  const docId = `audit_impossible_${uid}_${classId}_${listId}_day1`;
  await db().collection('attempts').doc(docId).set(att);
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: 0, totalWordsIntroduced: 0, // STALE — the "impossible" precondition
    interventionLevel: 0, programStartDate: now(), updatedAt: now(),
  }, { merge: true });
  return { studyDay: 1, docId, reconciledCsd: 1, reconciledTwi: att.newWordEndIndex + 1 };
}

// ── CUT-8 · seedS7MidSessionMastered — the C-14/S7 path (new words pass, then the review pool EMPTIES) ────────
// A day whose NEW words pass (VALID anchor) with every introduced word MASTERED → the empty-review automarker
// fires. Under SERVER_REVIEW_MARKER (flag-on) the marker is written SERVER-side with a real range + parseable
// testId (CS-5 shape) and pairs; the day carries to a fresh progress doc (no anchorDay−1 phantom). Needs the
// list's wordIds (assumption A1). The marker WRITE itself needs the flag-on functions env (Codex).
export async function seedS7MidSessionMastered({ email, uid, classId, listId, studyDay = 2, pace = 3, wordIds, score = 100, passThreshold = 92 }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  if (!wordIds || !wordIds.length) throw new Error('[seedS7MidSessionMastered] no wordIds (assumption A1) — INVALID');
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const teacherId = cd.ownerTeacherId || null;
  const thr = cd.assignments?.[listId]?.passThreshold ?? passThreshold;
  const att = validAnchorAttempt({ uid, classId, listId, teacherId, studyDay, pace, score, passThreshold: thr,
    extra: { manualReviewNote: `deepfix CUT-8 S7 mid-session-mastered fixture (${isoDay()})` } });
  const docId = `audit_s7_${uid}_${classId}_${listId}_day${studyDay}`;
  await db().collection('attempts').doc(docId).set(att);
  const introducedThrough = att.newWordEndIndex + 1;
  await progRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: studyDay, totalWordsIntroduced: introducedThrough,
    interventionLevel: 0, programStartDate: now(), updatedAt: now(),
  }, { merge: true });
  // Master every introduced word → the review pool empties → the automarker path is taken on entry.
  const range = wordIds.slice(0, introducedThrough);
  const batch = db().batch();
  const rt = tsPlusDays(21);
  range.forEach((wid, i) => {
    batch.set(db().collection('users').doc(uid).collection('study_states').doc(wid), {
      status: 'MASTERED', listId, wordIndex: i, introducedOnDay: 1, masteredAt: now(), returnAt: rt,
      timesTestedTotal: 3, timesCorrectTotal: 3, lastTestResult: 'correct',
    }, { merge: true });
  });
  await batch.commit();
  return { studyDay, docId, introducedThrough };
}

// ── CUT-4 / OV-4 · seedPendingChallenge (LABELED) — a gradebook attempt carrying a PENDING challenge ──────────
// One answer marked incorrect + challengeStatus:'pending' so `/teacher/gradebook` (challengeMode="review") shows
// the "Challenge Pending" panel + "Accept ✓". `variant:'new'` → a passed-'new' attempt near list end (accept
// must advance the day, twi CLAMPED to wordsRemaining); `variant:'review'` → a 'review' attempt (accept must NOT
// bump twi — the nwei:null hazard). `exTeacherId` (OV-4 orphaned): stamp teacherId to an EX-teacher +
// teacherIds:[ex, owner] so the CURRENT owner inherits the actionable challenge. Distinctive member token → Name
// filter isolates the row. The 'new' variant carries the FULL valid anchor.
export async function seedPendingChallenge({ email, uid, classId, listId, variant = 'new', studyDay = 2, pace = 3, listSize, wordIds, exTeacherId = null, displayToken }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const owner = cd.ownerTeacherId || null;
  if (!owner) throw new Error('[seedPendingChallenge] class has no ownerTeacherId (INVALID)');
  const stampTeacher = exTeacherId || owner;
  const teacherIds = Array.from(new Set([stampTeacher, owner].filter(Boolean)));
  const token = displayToken || `LSRCHAL${classId.slice(-4).toUpperCase()}`;
  await db().collection('classes').doc(classId).collection('members').doc(uid).set({ displayName: token, email }, { merge: true });
  const wid = (wordIds && wordIds[0]) || `word_${listId}_0`;
  const answers = [{
    wordId: wid, word: 'audit-challenge-word', correctAnswer: 'audit-correct',
    studentAnswer: 'audit-student', studentResponse: 'audit-student',
    isCorrect: false, challengeStatus: 'pending', challengeNote: `deepfix ${variant} challenge (${isoDay()})`,
  }];
  const base = {
    studentId: uid, classId, listId, teacherId: stampTeacher, teacherIds,
    testId: `vocaboost_test_${classId}_${listId}_${variant}`, testType: 'typed', graded: true,
    totalQuestions: 30, skipped: 0, answers, submittedAt: now(),
    manualReviewNote: `deepfix ${exTeacherId ? 'OV-4' : 'CUT-4'} pending-challenge fixture (${isoDay()})`,
  };
  let att;
  if (variant === 'new') {
    const nwsi = (studyDay - 1) * pace, nwei = studyDay * pace - 1;
    att = { ...base, sessionType: 'new', studyDay, score: 97, passed: true,
      newWordStartIndex: nwsi, newWordEndIndex: nwei, wordsIntroduced: nwei - nwsi + 1, isFirstDay: studyDay === 1 };
    // NEAR LIST END: twi = listSize-1 so an accept-driven +pace advance must CLAMP at listSize.
    const twi = Math.max(0, (listSize || nwei + 1) - 1);
    await progRef(uid, classId, listId).set({ classId, listId, currentStudyDay: studyDay, totalWordsIntroduced: twi, interventionLevel: 0, programStartDate: now(), updatedAt: now() }, { merge: true });
  } else {
    att = { ...base, sessionType: 'review', studyDay, score: 80, passed: true };
    await progRef(uid, classId, listId).set({ classId, listId, currentStudyDay: studyDay, totalWordsIntroduced: (listSize || 100), interventionLevel: 0, programStartDate: now(), updatedAt: now() }, { merge: true });
  }
  const docId = `audit_pendchal_${uid}_${classId}_${listId}_${variant}`;
  await db().collection('attempts').doc(docId).set(att);
  return { docId, token, wordId: wid, variant, stampTeacher, owner, teacherIds };
}

// ── OV-5 · seedInheritedAttempt (LABELED) — an A-stamped attempt the CURRENT owner (teacher B) must inherit ────
// teacherId:exTeacherId (the ex-teacher stamp) with teacherIds:[ex, owner] denormalized (the P10c reindex), so
// the owner's `/teacher/gradebook` (TEACHER_IDS_READ array-contains query) must SHOW it and the Name filter must
// resolve the (possibly ex-roster) student. Written as a NON-anchor 'review'/'manual' attempt (exempt from the
// passed-'new' anchor rule). Distinctive member token for the filter.
export async function seedInheritedAttempt({ email, uid, classId, listId, exTeacherId, displayToken, sessionType = 'review' }) {
  await assertSandboxTriple({ email, uid, classId, listId });
  const cd = (await db().collection('classes').doc(classId).get()).data() || {};
  const owner = cd.ownerTeacherId || null;
  if (!owner) throw new Error('[seedInheritedAttempt] class has no ownerTeacherId (INVALID)');
  if (!exTeacherId) throw new Error('[seedInheritedAttempt] need an exTeacherId (the A-stamp) (INVALID)');
  const token = displayToken || `LSRINH${classId.slice(-4).toUpperCase()}`;
  await db().collection('classes').doc(classId).collection('members').doc(uid).set({ displayName: token, email }, { merge: true });
  const docId = `audit_inherited_${uid}_${classId}_${listId}`;
  await db().collection('attempts').doc(docId).set({
    studentId: uid, classId, listId, teacherId: exTeacherId, teacherIds: [exTeacherId, owner],
    testId: `vocaboost_test_${classId}_${listId}_${sessionType}`,
    sessionType, testType: 'typed', score: 88, passed: true, graded: true,
    totalQuestions: 30, correctAnswers: 26, skipped: 0, answers: [], submittedAt: now(),
    manualReviewNote: `deepfix OV-5 inherited-attempt fixture (${isoDay()})`,
  });
  return { docId, token, exTeacherId, owner };
}
