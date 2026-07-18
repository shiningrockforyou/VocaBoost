/**
 * ============================================================================
 * deepfix P3 · FND-1 — Additive server surface (FIX_PLAN.md P3; inv_I6 §1.2)
 * ============================================================================
 * REVIEWED-DRAFT status (2026-07-13): built for Codex + verifier review, then
 * Task-6 sandbox testing. NOT deployed. Every callable in this module is
 * DORMANT behind the server flags below (all false) — calling a disabled
 * callable returns `failed-precondition` and touches nothing. No client code
 * routes to any of these until P4 (FND-2).
 *
 * What lives here (FIX_PLAN P3 change list):
 *   1. completeSession        — M3+M5: the transactional day-guard + server-derived
 *                               reviewOnlyDay/wordsIntroduced completion writer.
 *   2. resolveListProgress    — persist §5.2 [C6-1] resolver, TWO modes:
 *                               READ-ONLY (P3→P5) / WRITE-CAPABLE (P5 flips
 *                               LIST_PROGRESS_CANONICAL). F4-1: read-only mode
 *                               PRESERVES the legacy class_progress recon write.
 *   3. resetProgress          — M7: list-wide server wipe + reset-epoch stamp.
 *   9. advanceForChallenge    — F5-HIGH-2: the 3rd twi writer's day-advance
 *                               (db.js:2782-2846) moved server-side, clamped +
 *                               phase-gated. Full reviewChallenge migration = P10.
 *   6. validateAttemptAnchorShadow — M4 anchor validation, SHADOW/log-only,
 *                               called from writeAttemptTxn (index.js).
 *   5. deriveDayAnchorRange   — shared helper for the W2-upgraded marker
 *                               (markReviewComplete in index.js + the internal
 *                               marker in completeSession).
 *
 * Integration semantics are pinned to TODAY's client code — every ported rule
 * cites its source file:line (working tree of 2026-07-13). See
 * audit/deepfix/task3/P3_impl_notes.md for the per-piece trace + uncertainties.
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");

// ============================================================================
// SERVER FLAGS — ALL DORMANT (per the P3 ship rule: behind server flags /
// unused callables; deploys flip them per the I-5 G1 flag-assertion table).
// ============================================================================
// Gates the completeSession callable. Flipped at P4 together with the client
// SERVER_PROGRESS_WRITE routing flag (FIX_PLAN P4).
const SERVER_COMPLETE_SESSION_ENABLED = true;
// Gates the resolveListProgress callable. Flipped at P4 together with the
// client LIST_PROGRESS_PERSIST read-routing flag (FIX_PLAN P4).
const SERVER_RESOLVE_LIST_PROGRESS_ENABLED = true;
// Gates the resetProgress callable. Flipped at P4 together with the client
// SERVER_RESET_PROGRESS flag (v2 HIGH-3: reset must be fully cut over BEFORE
// P6 removes the owner attempt-delete rules branch).
const SERVER_RESET_PROGRESS_ENABLED = true;
// Gates the advanceForChallenge callable (3rd twi writer, v3 F5-HIGH-2).
// Flipped at P4 alongside SERVER_CHALLENGE_WRITE routing.
const SERVER_ADVANCE_FOR_CHALLENGE_ENABLED = true;
// THE P5-ONLY MODE SWITCH (v2 BLOCKER / v3 F4-4 — FIX_PLAN P3 change 2 + P5).
// false (P3→P5): resolveListProgress is READ-ONLY — it may create NO canonical
//   users/{uid}/list_progress doc on any load; completeSession/advanceForChallenge
//   write the LEGACY users/{uid}/class_progress/{classId}_{listId} doc exactly
//   as today's model does. The P4 acceptance asserts the list_progress
//   collection stays EMPTY until P5.
// true (flipped ONLY as part of P5's audited migration cutover, atomically with
//   the eager migration script): resolver becomes write-capable
//   (hydrate-on-miss for genuine stragglers) and the completion/challenge
//   writers target the canonical list_progress doc.
const LIST_PROGRESS_CANONICAL = false;
// M4 anchor validation, SHADOW (log-only `anchor_rejected`, never rejects).
// Dormant at merge per the P3 draft rule; the P3 DEPLOY intends to flip this
// true so the ≥14-day false-reject measurement can run (FIX_PLAN P3 acceptance:
// "M4 shadow false-reject rate ≈ 0 over ≥14 days"). Declared in the G1 table.
const ANCHOR_VALIDATION_SHADOW = true;
// M4 enforcement (clamp-or-reject). P6 (FND-4) ONLY, after the shadow soak is
// clean. Never flip before ANCHOR_VALIDATION_SHADOW has measured live traffic
// (the G1 lesson: never arm a rejection path without measuring what it would
// have rejected).
const ANCHOR_VALIDATION_ENFORCE = false;
// P9 · CYC — server-side global gate for finished-list lap cycling, mirroring the client
// build flag src/config/featureFlags.js CYCLING_ENABLED (the two-key gate: this AND the
// per-assignment `cyclingEnabled` field, resolved cross-class §3b). It makes the server
// allocation/M4-clamp legs LAP-AWARE (lap-modular clamp: a lap-2 day is NOT anchor-rejected
// and does not derive review-only via listComplete) — see resolveEffectiveCyclingServer()
// + the M4 / completeSession / advanceForChallenge legs. DORMANT at merge (per the P3 draft
// rule); flips true ONLY at P9 ship, together with the client flag, AFTER the P3–P6 foundation
// deploys + soaks (x/plan §3g HARD PREREQUISITE — cap removal must not run before server-auth twi).
// With this false, resolveEffectiveCyclingServer() short-circuits to not-cycling with NO read →
// every leg is byte-equivalent to today.
const CYCLING_ENABLED = false;
// deepfix P10 · OVR — gates the reviewChallenge callable (the full server port of the
// client db.js reviewChallenge answer-flip / score / challenges.history / study_states
// legs, under the I-10 §6 authz UNION). Flipped at the P10 cutover TOGETHER with the
// client SERVER_OVERRIDE routing flag (src/config/featureFlags.js), AFTER the P3–P6
// foundation deploys + soak. Disabled ⇒ the callable throws `failed-precondition` and
// touches nothing (dark on deploy, like every P3 callable). Flag-off ⇒ the client keeps
// today's hybrid path verbatim (byte-equivalent). DORMANT at merge per the P3 draft rule.
const SERVER_REVIEW_CHALLENGE_ENABLED = false;
// deepfix P10 · OVR — gates the overrideAttempt callable (the in-product manual-pass:
// a server-authorized teacher writes a VALID reconciliation anchor + advances the day,
// mirroring scripts/cs/manual-pass.mjs). Flipped at the P10 cutover with SERVER_OVERRIDE.
// Disabled ⇒ `failed-precondition`, no reads/writes. DORMANT at merge (P3 draft rule).
const SERVER_OVERRIDE_ENABLED = false;
// deepfix P10 · OVR part (c) — the SERVER half of the C-19 read-surface widening (David
// U1 = Option A `teacherIds` denormalization). Gates the ADDITIVE `teacherIds`-array
// write-stamp on the SERVER attempt-write paths (writeAttemptTxn [index.js],
// writeUpgradedReviewMarker, overrideAttempt, reviewChallenge). Mirrors the CLIENT flag
// TEACHER_IDS_READ (src/config/featureFlags.js) which gates the widened gradebook READ
// query + the client attempt-write stamp; the two flip TOGETHER at the P10c cutover.
// Disabled ⇒ computeTeacherIdsForAttempt() short-circuits to null with ZERO reads and NO
// `teacherIds` field is written ⇒ every server attempt doc is byte-identical to today.
// DORMANT at merge (P3 draft rule).
const TEACHER_IDS_WRITE_ENABLED = false;
// CS PR-2 · F3 — the ADDITIVE review-engagement stamp (answeredCount / engagedReview) on the
// server attempt writer (writeAttemptTxn, index.js). Mirrors computeTeacherIdsForAttempt's
// strict-dormancy idiom: DISABLED ⇒ computeReviewEngagementStamp() returns null with ZERO added
// fields ⇒ every attempt doc is byte-identical to today. The evidence downstream (PR-3's
// completion reader) consumes; NO grandfather here (PR-3 owns the deploy-time grandfather —
// Codex PR-1 HIGH-1). DORMANT at merge. Flips with the PR-2/PR-3 engagement-reader activation.
const REVIEW_ENGAGEMENT_STAMP_ENABLED = true;
// CS PR-2 · WI-4 (I6) — the server recovery/score clamp on writeAttemptTxn (index.js): dedupe
// scored rows by wordId + clamp correctCount∈[0,totalQuestions] / score∈[0,100], mirroring the
// client RECOVERY_GUARD intersect. A clamp only removes an IMPOSSIBLE output (the 4 historical
// >100% docs). DISABLED ⇒ the exact original unclamped correctCount/score expressions ⇒
// byte-identical to today. DORMANT at merge (kept reversible per the LOCAL-ONLY discipline).
const RECOVERY_SCORE_CLAMP_ENABLED = true;

// CS PR-3 · WI-1 — the SERVER mirror of the client FORCED_PATHWAY flag (binary throttle + hold-csd).
// When ON (and the completeSession callable itself is enabled — DOUBLE gate), completeSession: (a)
// derives a BINARY serverInterv via deriveThrottleModeServer (parity with the client
// initializeDailySession), (b) is the ONE owner of the persisted class_progress.reviewMode bit, and
// (c) HOLDS csd (OC-1 `review_recorded`) on a THROTTLE review-only day or a non-engaged (skip)
// review — recording the review WITHOUT advancing currentStudyDay/twi. DISABLED ⇒ serverInterv is
// the graduated calculateInterventionLevel, NO reviewMode field is written, and the hold branch is
// unreachable ⇒ every write is byte-identical to today. DORMANT at merge; flips with the PR-3
// activation, and is only reachable at all once SERVER_COMPLETE_SESSION_ENABLED (P4) is also true.
const FORCED_PATHWAY_ENABLED = true;
// Decision-#3 grandfather epoch (ms) — mirror of forcedPathway.FORCED_PATHWAY_GRANDFATHER_EPOCH_MS.
// A day's review with submittedAt before this counts as engaged in the completion reader (pre-deploy
// reviews stay engaged; only post-deploy skips are gated). NULL = no grandfather (set at flip).
const FORCED_PATHWAY_GRANDFATHER_EPOCH_MS = 1784333239063; // P4 server activation — MUST equal the client (src/utils/forcedPathway.js); fail-closed verifier enforces.

// CS PR-2 · OC-2 (I4 pairing mirror) — the STRICT V2 tiered pairing predicate is active on the
// SERVER whenever a path that can REACH getReviewForDayServer is enabled — i.e. the completion
// (SERVER_COMPLETE_SESSION_ENABLED) OR resolve (SERVER_RESOLVE_LIST_PROGRESS_ENABLED) callable.
// This reuses the EXISTING dormant flags that govern the completion/resolve path (no new
// independent switch); the two flip together at the P4 cutover per the G1 flag-assertion table.
// Both false today ⇒ getReviewForDayServer is unreachable dead code AND this derived gate is
// false ⇒ the legacy exact-range query + match run verbatim ⇒ byte-equivalent to today.
const REVIEW_PAIRING_V2_SERVER =
  SERVER_COMPLETE_SESSION_ENABLED || SERVER_RESOLVE_LIST_PROGRESS_ENABLED;

// Exported for the `version` provenance probe (index.js) so the I-5 G1
// flag-assertion table can assert these on every deploy.
const FOUNDATION_FLAGS = {
  SERVER_COMPLETE_SESSION_ENABLED,
  SERVER_RESOLVE_LIST_PROGRESS_ENABLED,
  SERVER_RESET_PROGRESS_ENABLED,
  SERVER_ADVANCE_FOR_CHALLENGE_ENABLED,
  LIST_PROGRESS_CANONICAL,
  ANCHOR_VALIDATION_SHADOW,
  ANCHOR_VALIDATION_ENFORCE,
  CYCLING_ENABLED,
  SERVER_REVIEW_CHALLENGE_ENABLED,
  SERVER_OVERRIDE_ENABLED,
  TEACHER_IDS_WRITE_ENABLED,
  REVIEW_ENGAGEMENT_STAMP_ENABLED,
  RECOVERY_SCORE_CLAMP_ENABLED,
  FORCED_PATHWAY_ENABLED,
};

// ============================================================================
// Constants ported from the client (sources cited; keep byte-parity or the
// server derivation drifts from the client preview — the F4-2 acceptance
// diff-checks them).
// ============================================================================
// studyTypes.js:292
const MAX_RECENT_SESSIONS = 10;
// studyAlgorithm.js:10-11 (intervention interpolation bounds)
const INTERVENTION_HIGH_SCORE = 0.75;
const INTERVENTION_LOW_SCORE = 0.30;
// studyAlgorithm.js:30-31,44 (pace defaults + dpw floor)
const DEFAULT_WEEKLY_PACE = 400;
const DEFAULT_STUDY_DAYS_PER_WEEK = 5;
const MIN_STUDY_DAYS_PER_WEEK = 2;
// db.js:2793 / functions assertCanWriteAttempt parity (threshold fallback)
const DEFAULT_PASS_THRESHOLD = 95;
// Streak day-boundary timezone. The CLIENT computes streaks in the student's
// LOCAL timezone (progressService.js:373-422 uses `new Date()`); Cloud
// Functions run UTC. The live cohort (26SM) is KST — a fixed +540min offset
// reproduces the student-local day boundary for them. FLAGGED in
// P3_impl_notes.md (uncertainty: multi-timezone cohorts would need a
// client-supplied tz or a per-user setting; streak is display-only).
const STREAK_TZ_OFFSET_MINUTES = 540;
// Anchor pagination (db.js:3273 PAGE=10) + review-pairing scan bounds
// (db.js:3426-3427 PAGE=25 / MAX_PAGES=40).
const ANCHOR_PAGE = 10;
const REVIEW_PAIR_PAGE = 25;
const REVIEW_PAIR_MAX_PAGES = 40;
// Post-anchor review-evidence scan bound (P5-amendment evidence, used by the
// CSD plausibility screen — FIX_PLAN §3 constraint 4 / v2 HIGH-5).
const REVIEW_EVIDENCE_PAGE = 100;
const REVIEW_EVIDENCE_MAX_PAGES = 20;
// studyTypes.js:220 implausibleStudyDayThreshold default slack
const CSD_SCREEN_SLACK = 7;

// Lazy Firestore handle: index.js calls admin.initializeApp() before requiring
// this module, but a lazy getter keeps the module safe to require standalone
// (emulator tests / node --check tooling).
let _db = null;
function getDb() {
  if (!_db) _db = admin.firestore();
  return _db;
}

// ============================================================================
// Shared plumbing
// ============================================================================

/**
 * Server-side twin of the client logSystemEvent (db.js:99-111): same doc shape
 * ({type, severity, ...data, timestamp}) so the existing dashboards/queries on
 * `system_logs` see server events uniformly. Never throws (logging must never
 * break the write path).
 */
async function logSystemEventServer(eventType, data, severity = "warning") {
  try {
    await getDb().collection("system_logs").add({
      type: eventType,
      severity,
      ...data,
      writtenBy: "cloud-function",
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn("system_logs write failed (non-fatal)", {eventType, error: err.message});
  }
}

/** progressService.js:33-35 — legacy progress doc id. */
function getProgressDocId(classId, listId) {
  return `${classId}_${listId}`;
}

/**
 * P9 · CYC — is finished-list cycling EFFECTIVELY active for this STUDENT+LIST
 * (x/plan §3b cross-class unlock, Codex P9-5)? The server MUST use the SAME predicate
 * as the client `deriveEffectiveCycling` (studyService.js) — cycling is unlocked iff ANY
 * of the student's enrolled classes assigns this list with `cyclingEnabled === true` —
 * or the launching class alone (the round-2 bug) disagrees with the client and rejects /
 * zeroes a valid cross-class cycling day. Mirrors the client's class set exactly: the
 * student's `users/{uid}.enrolledClasses` keys (the same source `fetchStudentClasses`
 * reads), each class doc's `assignments[listId].cyclingEnabled`.
 *
 * The global CYCLING_ENABLED short-circuit is FIRST → with the flag OFF this returns
 * not-cycling with NO Firestore read, preserving flag-off byte-equivalence + zero added
 * reads. Fails CLOSED (not cycling) on any read error — never breaks the write path.
 *
 * @param {string} studentId
 * @param {string} listId
 * @returns {Promise<{enabled:boolean, sourceClassId:string|null, sourceClassName:string|null}>}
 */
async function resolveEffectiveCyclingServer(studentId, listId) {
  if (!CYCLING_ENABLED) return {enabled: false, sourceClassId: null, sourceClassName: null};
  try {
    const userSnap = await getDb().collection("users").doc(studentId).get();
    const enrolled = userSnap.exists ? Object.keys(userSnap.data().enrolledClasses || {}) : [];
    if (enrolled.length === 0) return {enabled: false, sourceClassId: null, sourceClassName: null};
    const refs = enrolled.map((id) => getDb().collection("classes").doc(id));
    const snaps = await getDb().getAll(...refs);
    for (const cs of snaps) {
      if (!cs.exists) continue;
      const data = cs.data() || {};
      if (data.assignments?.[listId]?.cyclingEnabled === true) {
        return {enabled: true, sourceClassId: cs.id, sourceClassName: data.name ?? null};
      }
    }
    return {enabled: false, sourceClassId: null, sourceClassName: null};
  } catch (err) {
    logger.warn("resolveEffectiveCyclingServer failed; treating as not cycling", {studentId, error: err.message});
    return {enabled: false, sourceClassId: null, sourceClassName: null};
  }
}

/** Legacy (pre-P5) progress doc ref. */
function legacyProgressRef(uid, classId, listId) {
  return getDb().doc(`users/${uid}/class_progress/${getProgressDocId(classId, listId)}`);
}

/** Canonical (P5+) progress doc ref. */
function canonicalProgressRef(uid, listId) {
  return getDb().doc(`users/${uid}/list_progress/${listId}`);
}

/** The durable write target for the completion/challenge writers (P5 F4-4 flip). */
function durableProgressRef(uid, classId, listId) {
  return LIST_PROGRESS_CANONICAL
    ? canonicalProgressRef(uid, listId)
    : legacyProgressRef(uid, classId, listId);
}

function tsToMillis(v) {
  if (!v) return null;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  return null;
}

/**
 * Enrollment + assignment gate for the progress callables. Mirrors
 * assertCanWriteAttempt's enrollment/entitlement checks (index.js:295-341)
 * minus the attempt-shaped ctx requirements (these callables carry no
 * attemptDocId/testType). Returns {classData, assignment, teacherId}.
 */
async function assertEnrolledAssigned(uid, classId, listId) {
  if (!classId || typeof classId !== "string") {
    throw new HttpsError("invalid-argument", "classId is required");
  }
  if (!listId || typeof listId !== "string") {
    throw new HttpsError("invalid-argument", "listId is required");
  }
  const classSnap = await getDb().collection("classes").doc(classId).get();
  if (!classSnap.exists) throw new HttpsError("not-found", "Class not found");
  const classData = classSnap.data();
  const enrolled =
    Array.isArray(classData.studentIds) && classData.studentIds.includes(uid);
  if (!enrolled) {
    const userSnap = await getDb().collection("users").doc(uid).get();
    const ec = userSnap.exists ? (userSnap.data().enrolledClasses || {}) : {};
    if (!ec[classId]) {
      throw new HttpsError("permission-denied", "Student not enrolled in class");
    }
  }
  const assignments = classData.assignments || {};
  const assignment = assignments[listId] || null;
  const legacyAssigned =
    Array.isArray(classData.assignedLists) && classData.assignedLists.includes(listId);
  if (!assignment && !legacyAssigned) {
    throw new HttpsError("failed-precondition", "List is not assigned to this class");
  }
  return {classData, assignment, teacherId: classData.ownerTeacherId || null};
}

// ============================================================================
// Pure functions ported from the client (allocation / stats / streak).
// The F4-2 acceptance diff-checks the server derivation against the client
// predicate on live-shaped fixtures — keep these byte-faithful.
// ============================================================================

/** studyAlgorithm.js:66-98 — intervention from the last 3 review scores. */
function calculateInterventionLevel(recentSessions) {
  if (!Array.isArray(recentSessions) || recentSessions.length === 0) return 0.0;
  const validScores = recentSessions
    .filter((s) => s?.reviewScore !== null && s?.reviewScore !== undefined)
    .map((s) => s.reviewScore)
    .slice(-3);
  if (validScores.length < 3) return 0.0;
  const avgScore = validScores.reduce((sum, s) => sum + s, 0) / validScores.length;
  if (avgScore >= INTERVENTION_HIGH_SCORE) return 0.0;
  if (avgScore <= INTERVENTION_LOW_SCORE) return 1.0;
  const range = INTERVENTION_HIGH_SCORE - INTERVENTION_LOW_SCORE;
  return (INTERVENTION_HIGH_SCORE - avgScore) / range;
}

/**
 * Daily pace, exactly as the live session derives it:
 * DailySessionFlow.jsx:558 builds weeklyPace = assignment.pace * dpw, then
 * initializeDailySession (studyService.js:170-179) does
 * dailyPace = ceil((weeklyPace || 400) / max(2, dpw || 5)).
 */
function deriveDailyPace(assignment) {
  const dpw = Math.max(
    MIN_STUDY_DAYS_PER_WEEK,
    (assignment?.studyDaysPerWeek) || DEFAULT_STUDY_DAYS_PER_WEEK,
  );
  const weeklyPace =
    (assignment?.pace * (assignment?.studyDaysPerWeek || DEFAULT_STUDY_DAYS_PER_WEEK)) ||
    DEFAULT_WEEKLY_PACE;
  return {dailyPace: Math.ceil(weeklyPace / dpw), studyDaysPerWeek: dpw};
}

/** progressService.js:347-364 — rolling stats over recentSessions. */
function calculateProgressStats(sessions) {
  const newWordScores = sessions
    .filter((s) => s.newWordScore !== null && s.newWordScore !== undefined)
    .map((s) => s.newWordScore);
  const reviewScores = sessions
    .filter((s) => s.reviewScore !== null && s.reviewScore !== undefined)
    .map((s) => s.reviewScore);
  return {
    avgNewWordScore: newWordScores.length > 0 ?
      newWordScores.reduce((a, b) => a + b, 0) / newWordScores.length : null,
    avgReviewScore: reviewScores.length > 0 ?
      reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length : null,
  };
}

/**
 * progressService.js:373-422 — streak update, ported with a fixed timezone
 * offset (see STREAK_TZ_OFFSET_MINUTES note above). "Today"/"weekend" are
 * evaluated in the offset timezone instead of the server's UTC.
 */
function calculateUpdatedStreak(lastStudyDate, currentStreak, studyDaysPerWeek = 5) {
  const offsetMs = STREAK_TZ_OFFSET_MINUTES * 60 * 1000;
  // Local-day bucket: shift into the cohort tz, truncate to midnight, shift back.
  const toLocalMidnight = (ms) => {
    const shifted = new Date(ms + offsetMs);
    shifted.setUTCHours(0, 0, 0, 0);
    return shifted.getTime() - offsetMs;
  };
  const localDay = (ms) => new Date(ms + offsetMs).getUTCDay();
  const isWeekend = (ms) => {
    const d = localDay(ms);
    return d === 0 || d === 6;
  };
  const skipWeekends = studyDaysPerWeek <= 5;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const todayMs = toLocalMidnight(Date.now());
  const lastMs = tsToMillis(lastStudyDate);
  if (lastMs == null) return 1;
  const lastDayMs = toLocalMidnight(lastMs);

  if (lastDayMs === todayMs) return currentStreak || 1;

  let expectedPrev = todayMs - DAY_MS;
  if (skipWeekends) {
    while (isWeekend(expectedPrev)) expectedPrev -= DAY_MS;
  }
  if (lastDayMs === expectedPrev) return (currentStreak || 0) + 1;
  return 1;
}

/** studyTypes.js:142-151 — Monday-of-week programStartDate seed (offset tz). */
function mondayOfWeekTimestamp() {
  const offsetMs = STREAK_TZ_OFFSET_MINUTES * 60 * 1000;
  const now = new Date(Date.now() + offsetMs);
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setUTCDate(now.getUTCDate() + diff);
  now.setUTCHours(0, 0, 0, 0);
  return Timestamp.fromMillis(now.getTime() - offsetMs);
}

/** studyTypes.js:118-135 — default progress shape (server twin). */
function defaultProgressShape(classId, listId) {
  return {
    classId,
    listId,
    currentStudyDay: 0,
    totalWordsIntroduced: 0,
    interventionLevel: 0,
    recentSessions: [],
    stats: {avgNewWordScore: null, avgReviewScore: null},
    streakDays: 0,
    lastStudyDate: null,
    lastSessionAt: null,
  };
}

/**
 * studyTypes.js:215-232 — implausibleStudyDayThreshold (calendar/TWI ceilings
 * + slack), used OBSERVATIONALLY by the [C4-2] CSD screen below.
 */
function implausibleStudyDayThreshold({programStartDate, studyDaysPerWeek = 5, totalWordsIntroduced = 0, dailyPace, slack = CSD_SCREEN_SLACK}) {
  const startMs = tsToMillis(programStartDate);
  let calendarCeil = null;
  if (startMs != null) {
    const daysElapsed = Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000));
    if (daysElapsed >= 0) {
      // Conservative port of calculateExpectedStudyDay (studyTypes.js:159-196):
      // weekday-walk approximated as ceil(5/7) of elapsed days when weekends are
      // skipped — an upper bound is all this screen needs (observability only).
      calendarCeil = studyDaysPerWeek >= 7 ?
        daysElapsed + 1 :
        Math.max(1, Math.ceil(((daysElapsed + 1) * 5) / 7));
    } else {
      calendarCeil = 1;
    }
  }
  const twiCeil = (dailyPace && dailyPace > 0) ?
    Math.ceil((totalWordsIntroduced || 0) / dailyPace) : null;
  if (calendarCeil == null && twiCeil == null) return null;
  return Math.max(calendarCeil ?? 0, twiCeil ?? 0) + slack;
}

// ============================================================================
// Attempt queries (Admin-SDK ports of the db.js readers; discriminated
// statuses preserved — "errored lookups move nothing", db.js:3239-3246).
// All query shapes match EXISTING composite indexes (firestore.indexes.json):
//   (studentId,listId,sessionType,passed,newWordEndIndex DESC,submittedAt DESC)
//   (studentId,listId,sessionType,passed,studyDay DESC)
//   (studentId,listId,sessionType,studyDay,submittedAt DESC)
//   (studentId,listId,sessionType,submittedAt DESC)
//   (studentId,listId,submittedAt DESC)
// ============================================================================

/**
 * F-6: read the reset-epoch tombstone's `resetAt` for (uid, list). Pre-P5 the
 * tombstone lives in `users/{uid}/progress_meta/{listId}`; post-P5 it is stamped
 * on the canonical doc (resetProgress step 5 / F-3) — mirror durableProgressRef's
 * LIST_PROGRESS_CANONICAL switch. Returns a Timestamp or null (null on absent doc,
 * missing field, or read error → callers then apply NO filtering, i.e. today's
 * behaviour). The ONLY writer is the dormant resetProgress, so this is null for
 * ALL existing data.
 */
async function getResetAtServer(uid, listId) {
  try {
    const ref = LIST_PROGRESS_CANONICAL ?
      canonicalProgressRef(uid, listId) :
      getDb().doc(`users/${uid}/progress_meta/${listId}`);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const ra = snap.data().resetAt;
    return (ra && typeof ra.toMillis === "function") ? ra : null;
  } catch {
    return null; // tombstone read failure ⇒ no filtering (fall toward today's behaviour)
  }
}

/**
 * Port of getMostRecentPassedNewTest (db.js:3248-3333), list-scoped leg only
 * (the server is always list-scoped — LIST_SCOPED_RECON is ON in prod, F-9).
 * Returns {status:'found',attempt}|{status:'none'}|{status:'query-error',error}.
 */
async function getListAnchor(uid, listId) {
  try {
    const attempts = getDb().collection("attempts");
    // F-6: reset-epoch filter. When a reset stamped `resetAt` for (uid,list),
    // EXCLUDE attempts submitted before it — a stale in-flight attempt that lands
    // after a reset must NOT re-promote the anchor ("reset un-resets"). No tombstone
    // (resetAt null — true for ALL existing data, the writer is dormant) ⇒ notPreReset
    // is always true ⇒ selection is byte-equivalent to before.
    const resetAt = await getResetAtServer(uid, listId);
    const resetMs = resetAt ? resetAt.toMillis() : null;
    const notPreReset = (data) => resetMs == null ||
      (data.submittedAt && typeof data.submittedAt.toMillis === "function" &&
        data.submittedAt.toMillis() >= resetMs);
    let cursor = null;
    for (;;) {
      let q = attempts
        .where("studentId", "==", uid)
        .where("listId", "==", listId)
        .where("sessionType", "==", "new")
        .where("passed", "==", true)
        .where("newWordEndIndex", ">=", 0)
        .orderBy("newWordEndIndex", "desc")
        .orderBy("submittedAt", "desc")
        .limit(ANCHOR_PAGE);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;
      const validDoc = snap.docs.find((d) => {
        const data = d.data();
        const v = data.newWordEndIndex;
        return Number.isInteger(v) && v >= 0 && notPreReset(data);
      });
      if (validDoc) {
        return {status: "found", attempt: {id: validDoc.id, ...validDoc.data()}};
      }
      if (snap.docs.length < ANCHOR_PAGE) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
    // Sparse-index fallback (db.js:3308-3332): legacy anchors missing
    // newWordEndIndex — judged by the caller (hasValidData).
    const daySnap = await attempts
      .where("studentId", "==", uid)
      .where("listId", "==", listId)
      .where("sessionType", "==", "new")
      .where("passed", "==", true)
      .orderBy("studyDay", "desc")
      .limit(1)
      .get();
    if (daySnap.empty) return {status: "none"};
    const d = daySnap.docs[0];
    // F-6: a pre-reset straggler in the (limit-1) fallback ⇒ no valid post-reset
    // anchor here (conservative — preserves the reset). Byte-equivalent when
    // resetMs is null (notPreReset always true → returns the doc as before).
    if (!notPreReset(d.data())) return {status: "none"};
    return {status: "found", attempt: {id: d.id, ...d.data()}};
  } catch (err) {
    return {status: "query-error", error: {message: err?.message ?? String(err), code: err?.code ?? null}};
  }
}

// ============================================================================
// CS PR-2 · OC-2 (I4) — SERVER mirror of the census-LOCKED reader predicate.
// Byte-faithful port of src/utils/reviewPairing.js (isEngagedReview /
// reviewPairsWithAnchor): STRICT engagement (NO grandfather — that belongs to
// PR-3's completion reader, Codex PR-1 HIGH-1), tiered exact∨temporal /
// sameClass∧engaged legs. Reachable ONLY from getReviewForDayServer, which runs
// ONLY under the dormant completion/resolve callables ⇒ dead code until the P4
// flip (byte-equivalent today).
// ============================================================================

/** F9 engagement bar (src/utils/reviewPairing.js MIN_ENGAGED_ANSWER_RATIO). */
const MIN_ENGAGED_ANSWER_RATIO = 0.8;

/** Timestamp→epoch-ms with a 0 fallback (byte-faithful port of tsMillis(), reviewPairing.js:52-56). */
function pairMs(t) {
  return (t && typeof t.toMillis === "function")
    ? t.toMillis()
    : (t?.toDate ? t.toDate().getTime() : 0);
}

/**
 * OC-4 canonical cycle length (PR-2 verify HIGH fix) — the LIVE word-doc count of
 * lists/{listId}/words, the server mirror of the client getCycleLength (studyService.js) /
 * positions.length. NEVER lists.wordCount (§2 one-modulus correctness rule). Aggregate count;
 * returns 0 on ANY error ⇒ the OC-4 lap-reset guard (cycleLen > 0) then no-ops (fail-safe).
 */
async function getCanonicalCycleLengthServer(listId) {
  try {
    const agg = await getDb().collection("lists").doc(listId).collection("words").count().get();
    return agg.data().count || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * isEngagedReviewServer — F9 engagement over a STORED review attempt (STRICT, no grandfather).
 * Byte-faithful port of isEngagedReview (src/utils/reviewPairing.js:73-81).
 */
function isEngagedReviewServer(a) {
  if (!a || a.sessionType !== "review") return false;
  if (a.autoCompleted === true) return true;
  if (!Number.isInteger(a.totalQuestions) || a.totalQuestions === 0) return true;
  const answered = Array.isArray(a.answers)
    ? a.answers.filter((x) => String(x?.studentResponse ?? "").trim() !== "").length
    : (a.totalQuestions - (a.skipped ?? 0));
  return answered / a.totalQuestions >= MIN_ENGAGED_ANSWER_RATIO;
}

/**
 * reviewPairsWithAnchorServer — the census-LOCKED tiered predicate. Byte-faithful port of
 * reviewPairsWithAnchor (src/utils/reviewPairing.js:111-130). anchor =
 * {studyDay, classId, submittedAt, newWordStartIndex, newWordEndIndex}.
 */
function reviewPairsWithAnchorServer(review, anchor) {
  if (!review || !anchor) return false;
  if (review.sessionType !== "review" || review.studyDay !== anchor.studyDay) return false;
  const exact = review.newWordStartIndex === anchor.newWordStartIndex &&
    review.newWordEndIndex === anchor.newWordEndIndex;
  const sameClass = review.classId === anchor.classId;
  const temporal = pairMs(review.submittedAt) >= pairMs(anchor.submittedAt);
  const engaged = isEngagedReviewServer(review);
  // Tier 1 — exact positional proof (strict superset of the legacy exact+temporal predicate).
  if (exact && (temporal || sameClass)) return true;
  // Tiers 2/3 both require same-class AND engaged.
  if (!sameClass || !engaged) return false;
  // Tier 2 — post-anchor, same class, engaged (range drift).
  if (temporal) return true;
  // Tier 3 — pre-anchor inverted stub or null range, same class, engaged.
  return (review.newWordStartIndex === anchor.newWordStartIndex &&
      review.newWordEndIndex === anchor.newWordStartIndex - 1) ||
    (review.newWordStartIndex == null && review.newWordEndIndex == null);
}

/**
 * CS PR-2 · F3 — ADDITIVE review-engagement stamp for writeAttemptTxn (index.js). Mirrors the
 * computeTeacherIdsForAttempt dormancy idiom: returns null (⇒ NO fields written ⇒ byte-identical
 * attempt doc) when REVIEW_ENGAGEMENT_STAMP_ENABLED is false OR the attempt is not a review.
 * `answered` follows isEngagedReviewServer: count non-empty studentResponse rows, else fall back
 * to totalQuestions − skipped. NO grandfather here (PR-3's completion reader owns that).
 * @returns {{answeredCount:number, engagedReview:boolean}|null}
 */
function computeReviewEngagementStamp(ctx, attemptAnswers, totalQuestions, skipped) {
  if (!REVIEW_ENGAGEMENT_STAMP_ENABLED) return null;
  if (!ctx || ctx.sessionType !== "review") return null;
  const tq = Number.isInteger(totalQuestions) ? totalQuestions : 0;
  const answered = Array.isArray(attemptAnswers)
    ? attemptAnswers.filter((x) => String(x?.studentResponse ?? "").trim() !== "").length
    : Math.max(0, tq - (skipped ?? 0));
  // PR-2 verify MEDIUM: parity with isEngagedReviewServer — autoCompleted short-circuits engaged
  // (the tq===0 disjunct already captures the non-positive-integer carve-out via the guard above).
  const engagedReview = ctx.autoCompleted === true || tq === 0 || (answered / tq) >= MIN_ENGAGED_ANSWER_RATIO;
  return {answeredCount: answered, engagedReview};
}

// ============================================================================
// CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED) — SERVER binary-throttle + grandfathered
// completion-engagement helpers. Byte-faithful mirror of src/utils/forcedPathway.js. They CONSUME
// (never modify) isEngagedReviewServer / computeReviewEngagementStamp. Reachable ONLY from the
// hold-csd branch of completeSession, itself DOUBLE-gated (FORCED_PATHWAY_ENABLED && the dormant
// SERVER_COMPLETE_SESSION_ENABLED callable) ⇒ dead code today (byte-equivalent).
// ============================================================================

// Hysteresis bounds (David-locked 2026-07-16): enter review mode < 0.30, exit > 0.50, hold between.
const FORCED_PATHWAY_ENTER_THRESHOLD = 0.30;
const FORCED_PATHWAY_EXIT_THRESHOLD = 0.50;

/** Last-N non-null review-score average, or null for < N (mirror of reviewAvgLastN). */
function reviewAvgLastNServer(recentSessions, n = 3) {
  if (!Array.isArray(recentSessions) || recentSessions.length === 0) return null;
  const valid = recentSessions
    .filter((s) => s?.reviewScore !== null && s?.reviewScore !== undefined)
    .map((s) => s.reviewScore)
    .slice(-n);
  if (valid.length < n) return null;
  return valid.reduce((sum, x) => sum + x, 0) / valid.length;
}

/** Binary throttle with hysteresis (mirror of deriveThrottleMode). */
function deriveThrottleModeServer(recentSessions, priorMode = false) {
  const avg = reviewAvgLastNServer(recentSessions, 3);
  if (avg == null) return false;
  if (avg < FORCED_PATHWAY_ENTER_THRESHOLD) return true;
  if (avg > FORCED_PATHWAY_EXIT_THRESHOLD) return false;
  return priorMode === true;
}

/**
 * Grandfathered completion-engagement (mirror of isCompletionEngaged). GRANDFATHER (submittedAt
 * before the epoch) → engaged; else prefer the PR-2 stamp (engagedReview); else the STRICT
 * isEngagedReviewServer census predicate (consumed unmodified).
 */
function isCompletionEngagedServer(attempt, epochMs = FORCED_PATHWAY_GRANDFATHER_EPOCH_MS) {
  if (!attempt) return false;
  if (epochMs != null) {
    const ms = pairMs(attempt.submittedAt);
    if (ms > 0 && ms < epochMs) return true; // decision-#3 grandfather
  }
  if (typeof attempt.engagedReview === "boolean") return attempt.engagedReview; // PR-2 stamp
  return isEngagedReviewServer(attempt); // STRICT census predicate (fallback)
}

/**
 * The day's most-recent review attempt (for the F3 completion-engagement gate). Mirrors
 * dayReviewExists' query but returns the doc data. {error:true} on failure ⇒ the hold gate fails
 * OPEN (advance) so a query blip never strands a completion.
 */
async function getDayReviewForEngagement(uid, listId, studyDay) {
  try {
    const snap = await getDb().collection("attempts")
      .where("studentId", "==", uid)
      .where("listId", "==", listId)
      .where("sessionType", "==", "review")
      .where("studyDay", "==", studyDay)
      .orderBy("submittedAt", "desc")
      .limit(1)
      .get();
    return snap.empty ? null : {id: snap.docs[0].id, ...snap.docs[0].data()};
  } catch (err) {
    logger.warn("getDayReviewForEngagement query failed", {uid, listId, studyDay, error: err.message});
    return {error: true};
  }
}

/**
 * Port of getReviewForDay under LIST_SCOPED_RECON (db.js:3687-3814). Base lineage: anchor
 * submittedAt + integer range. OC-2 (REVIEW_PAIRING_V2_SERVER): additionally require
 * anchorClassId, DROP the `submittedAt >= anchor` query pre-narrow (the tiered predicate judges
 * temporality itself, incl. the pre-anchor legs), and judge each candidate by
 * reviewPairsWithAnchorServer — mirroring db.js:3702-3767. Flag-off ⇒ the exact original
 * lineage gate + `>=` query + exact-range match, verbatim (byte-equivalent).
 */
async function getReviewForDayServer(uid, listId, studyDay, pairing) {
  if (!(pairing?.anchorSubmittedAt &&
        Number.isInteger(pairing?.anchorNewWordStartIndex) &&
        Number.isInteger(pairing?.anchorNewWordEndIndex) &&
        // PR-2 verify LOW: this flag-off relaxation of anchorClassId is provably unreachable — both
        // callers are gated by the same flags that make REVIEW_PAIRING_V2_SERVER true, so when this
        // reader actually runs anchorClassId IS required (matches the client, db.js:3702).
        (!REVIEW_PAIRING_V2_SERVER || pairing?.anchorClassId))) {
    return {status: "query-error", error: {message: "missing anchor lineage", code: "invalid-pairing"}};
  }
  try {
    const attempts = getDb().collection("attempts");
    let cursor = null;
    for (let page = 0; page < REVIEW_PAIR_MAX_PAGES; page++) {
      let q = attempts
        .where("studentId", "==", uid)
        .where("listId", "==", listId)
        .where("sessionType", "==", "review")
        .where("studyDay", "==", studyDay);
      // OC-2: V2 drops the temporal pre-narrow (mirror of db.js:3717-3743). Flag-off keeps it.
      if (!REVIEW_PAIRING_V2_SERVER) q = q.where("submittedAt", ">=", pairing.anchorSubmittedAt);
      q = q.orderBy("submittedAt", "desc").limit(REVIEW_PAIR_PAGE);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) return {status: "none"};
      for (const d of snap.docs) {
        const data = d.data();
        // OC-2: the census-LOCKED tiered predicate replaces the exact-range match under V2
        // (mirror of reviewPairsWithAnchor). Flag-off ⇒ the exact-range if, verbatim.
        const paired = REVIEW_PAIRING_V2_SERVER
          ? reviewPairsWithAnchorServer(data, {
              studyDay,
              classId: pairing.anchorClassId,
              submittedAt: pairing.anchorSubmittedAt,
              newWordStartIndex: pairing.anchorNewWordStartIndex,
              newWordEndIndex: pairing.anchorNewWordEndIndex,
            })
          : (data.newWordStartIndex === pairing.anchorNewWordStartIndex &&
             data.newWordEndIndex === pairing.anchorNewWordEndIndex);
        // FIX-1 server mirror (PR-3 coupling HIGH): under FORCED_PATHWAY_ENABLED a post-epoch
        // NON-engaged (skip) review must NOT complete the day even on the exact tier — skip it and
        // keep scanning for a genuinely-engaged review (tri-symmetry with the client getReviewForDay).
        // Flag-off ⇒ `pairedComplete === paired` ⇒ `if (paired)` verbatim (byte-equivalent).
        const pairedComplete = FORCED_PATHWAY_ENABLED ? (paired && isCompletionEngagedServer(data)) : paired;
        if (pairedComplete) return {status: "found", attempt: {id: d.id, ...data}};
      }
      if (snap.docs.length < REVIEW_PAIR_PAGE) return {status: "none"};
      cursor = snap.docs[snap.docs.length - 1];
    }
    return {status: "query-error", error: {message: "candidate scan limit reached", code: "candidate-scan-limit"}};
  } catch (err) {
    return {status: "query-error", error: {message: err?.message ?? String(err), code: err?.code ?? null}};
  }
}

/**
 * The day's PASSED `new` attempt, list-wide, highest valid newWordEndIndex —
 * the twi-defining pick (mirrors studyService.js:258-262's anchor-on-twi
 * preference and determineStartingPhase's passed-first ordering,
 * studyService.js:77-81). Used for: the S8/#9 "already absorbed" reason-3
 * derivation, and the W2 marker's anchor range. Returns the attempt or null;
 * {error:true} on query failure (callers treat error as "unknown", never as
 * "none" for anything that moves state).
 */
async function getDayNewPass(uid, listId, studyDay) {
  try {
    const snap = await getDb().collection("attempts")
      .where("studentId", "==", uid)
      .where("listId", "==", listId)
      .where("sessionType", "==", "new")
      .where("studyDay", "==", studyDay)
      .orderBy("submittedAt", "desc")
      .limit(REVIEW_PAIR_PAGE)
      .get();
    const passes = snap.docs
      .map((d) => ({id: d.id, ...d.data()}))
      .filter((a) => a.passed === true && Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= 0);
    if (passes.length === 0) return null;
    passes.sort((a, b) => b.newWordEndIndex - a.newWordEndIndex);
    return passes[0];
  } catch (err) {
    logger.warn("getDayNewPass query failed", {uid, listId, studyDay, error: err.message});
    return {error: true};
  }
}

/** Any review attempt (incl. automarkers) for (uid, list, day)? null on error. */
async function dayReviewExists(uid, listId, studyDay) {
  try {
    const snap = await getDb().collection("attempts")
      .where("studentId", "==", uid)
      .where("listId", "==", listId)
      .where("sessionType", "==", "review")
      .where("studyDay", "==", studyDay)
      .orderBy("submittedAt", "desc")
      .limit(1)
      .get();
    return !snap.empty;
  } catch (err) {
    logger.warn("dayReviewExists query failed", {uid, listId, studyDay, error: err.message});
    return null; // unknown — callers must fail SAFE (skip the marker, log)
  }
}

/**
 * P5-amendment evidence (FIX_PLAN §3 constraint 4 / v2 HIGH-5): count DISTINCT
 * post-anchor review-attempt studyDays — the DURABLE ledger legitimizing
 * csd − anchorDay gaps accrued on review-only days. Capped one-per-studyDay.
 * Returns an integer count (0 on error — the screen then only FLAGS, below).
 */
async function countPostAnchorReviewDays(uid, listId, anchorSubmittedAt) {
  if (!anchorSubmittedAt) return 0;
  const days = new Set();
  try {
    const attempts = getDb().collection("attempts");
    let cursor = null;
    for (let page = 0; page < REVIEW_EVIDENCE_MAX_PAGES; page++) {
      let q = attempts
        .where("studentId", "==", uid)
        .where("listId", "==", listId)
        .where("sessionType", "==", "review")
        .where("submittedAt", ">", anchorSubmittedAt)
        .orderBy("submittedAt", "desc")
        .limit(REVIEW_EVIDENCE_PAGE);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      snap.docs.forEach((d) => {
        const data = d.data();
        // F-4: auto-completed review markers (client automarker + server W2 marker,
        // both `autoCompleted:true`) are server/client-minted "no review available"
        // stand-ins, NOT durable student review evidence — excluding them keeps the
        // CSD-plausibility screen from legitimising a pumped csd on marker-only days.
        // (Coordinate: the P5 migration's own review-evidence counter — stream C —
        // must apply the SAME exclusion, per FINAL_REVIEW_FINDINGS F-4.)
        if (data.autoCompleted === true) return;
        const sd = data.studyDay;
        if (Number.isInteger(sd)) days.add(sd);
      });
      if (snap.docs.length < REVIEW_EVIDENCE_PAGE) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
  } catch (err) {
    logger.warn("countPostAnchorReviewDays failed (evidence treated as 0)", {uid, listId, error: err.message});
  }
  return days.size;
}

// ============================================================================
// In-memory reconciliation (the resolver core) — semantics of
// progressService.js:130-246 (anchor→csd/twi, non-demoting CSD, TWI
// anchor-authoritative, query-error moves nothing), evaluated per source doc
// and as a merged cross-doc view (persist §8-lite for the READ-ONLY return).
// ============================================================================

/**
 * Anchor-derived (csd, twi) for the list — the two-query reconciliation
 * (progressService.js:135-195): anchor twi = nwei + 1; day-1 anchor → csd 1;
 * day-2+ → csd = anchorDay or anchorDay − 1 by exact-range review pairing.
 */
async function computeAnchorPosition(uid, listId) {
  const anchorResult = await getListAnchor(uid, listId);
  const anchorTest = anchorResult.status === "found" ? anchorResult.attempt : null;
  const hasValidData = anchorTest != null &&
    Number.isInteger(anchorTest.studyDay) && anchorTest.studyDay > 0 &&
    Number.isInteger(anchorTest.newWordEndIndex) && anchorTest.newWordEndIndex >= 0;

  let anchorStatus;
  if (anchorResult.status === "query-error") anchorStatus = "query-error";
  else if (anchorResult.status === "none") anchorStatus = "none";
  else anchorStatus = hasValidData ? "found" : "invalid-anchor";

  let anchorDay = 0;
  let twi = 0;
  let csd = 0;
  let reviewLookupFailed = false;
  if (anchorTest && anchorTest.newWordEndIndex != null && hasValidData) {
    anchorDay = anchorTest.studyDay;
    twi = anchorTest.newWordEndIndex + 1;
    if (anchorDay === 1) {
      csd = 1;
    } else {
      const reviewResult = await getReviewForDayServer(uid, listId, anchorDay, {
        anchorClassId: anchorTest.classId, // OC-2: same-class legs of the V2 predicate (additive; ignored flag-off)
        anchorSubmittedAt: anchorTest.submittedAt,
        anchorNewWordStartIndex: anchorTest.newWordStartIndex,
        anchorNewWordEndIndex: anchorTest.newWordEndIndex,
      });
      if (reviewResult.status === "query-error") reviewLookupFailed = true;
      csd = reviewResult.status === "found" ? anchorDay : anchorDay - 1;
    }
  }
  return {anchorStatus, anchorTest, hasValidData, anchorDay, twi, csd, reviewLookupFailed};
}

/**
 * Per-source-doc safe values, byte-parity with today's flag-ON semantics
 * (progressService.js:233-236): CSD non-demoting (max; pinned to stored on a
 * review-lookup error); TWI anchor-authoritative when the anchor is valid,
 * else max-protected.
 */
function safeValuesForDoc(stored, anchor) {
  const storedCSD = stored.currentStudyDay || 0;
  const storedTWI = stored.totalWordsIntroduced || 0;
  const safeCSD = anchor.reviewLookupFailed ? storedCSD : Math.max(storedCSD, anchor.csd);
  const safeTWI = anchor.hasValidData ? anchor.twi : Math.max(storedTWI, anchor.twi);
  return {safeCSD, safeTWI, storedCSD, storedTWI};
}

/**
 * [C4-2] CSD plausibility screen WITH the P5 amendment (review-attempt
 * evidence as PRIMARY, per-doc own-anchor baseline — FIX_PLAN P5 / §3
 * constraint 4). READ-ONLY mode uses it to FLAG candidates (log-only);
 * WRITE-CAPABLE hydration uses it to EXCLUDE a source CSD from the merge max
 * (quarantine, never zero).
 */
function csdScreen({storedCSD, anchorDay, reviewEvidenceDays, threshold}) {
  const anchorBaseline = anchorDay + reviewEvidenceDays + CSD_SCREEN_SLACK;
  const overAnchor = storedCSD > anchorBaseline;
  const overCalendar = threshold != null && storedCSD > threshold;
  // Implausible only when it exceeds the evidence-adjusted anchor baseline AND
  // (when computable) the calendar/TWI ceiling — conservative in both modes.
  return {
    implausible: overAnchor && (threshold == null ? true : overCalendar),
    anchorBaseline,
    threshold,
  };
}

// ============================================================================
// W2 — the UPGRADED review automarker (C-14/C-34 fix; FIX_PLAN P3 change 5)
// ============================================================================

/**
 * Derive the day's anchor range server-side (the marker must carry the EXACT
 * range of the day's twi-defining passed `new` attempt so exact-range pairing
 * — db.js:3449-3450 — recognizes it). Returns
 * {newWordStartIndex, newWordEndIndex, wordsIntroduced} (integers) or null
 * when the day has no valid passed new attempt (a pure review-only day: no
 * same-day anchor exists to pair against — the day survives via non-demoting
 * CSD, I-2 §1.2 last row — so a range-less marker is not a pairing loss there).
 */
async function deriveDayAnchorRange(uid, listId, dayNumber) {
  const dayNewPass = await getDayNewPass(uid, listId, dayNumber);
  if (!dayNewPass || dayNewPass.error) return null;
  const nwei = dayNewPass.newWordEndIndex;
  const nwsi = Number.isInteger(dayNewPass.newWordStartIndex) ? dayNewPass.newWordStartIndex : null;
  if (!Number.isInteger(nwei)) return null;
  return {
    newWordStartIndex: nwsi,
    newWordEndIndex: nwei,
    wordsIntroduced: (nwsi != null) ? (nwei - nwsi + 1) : null,
  };
}

/**
 * Write the W2-UPGRADED automarker attempt. Deterministic id (idempotent,
 * same id as the legacy client/server marker so P4's dual routes converge).
 * Upgrades over today's markReviewComplete (index.js:583-600):
 *   • testId is PARSEABLE — `vocaboost_test_{classId}_{listId}_review`
 *     (getTestId shape, testRecovery.js:20-22) → survives the gradebook parse
 *     (db.js:1976-1984 `^vocaboost_test_[^_]+_([^_]+)_`) — the C-34 leg.
 *   • newWordStartIndex/newWordEndIndex stamp the day's anchor range →
 *     satisfies exact-range pairing (db.js:3449-3450) — the C-14 leg.
 * `teacherId` comes from the caller's auth gate (marker rows stay
 * teacher-readable under firestore.rules:101-105).
 */
async function writeUpgradedReviewMarker(uid, classId, listId, dayNumber, teacherId) {
  const markerId = `${uid}_${classId}_${listId}_day${dayNumber}_review_automarker`;
  const ref = getDb().collection("attempts").doc(markerId);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data();
    if (data.studentId !== uid) {
      throw new HttpsError("permission-denied", "Marker belongs to another user");
    }
    // HIGH-1 (Codex): a pre-existing LEGACY marker (no parseable testId, no
    // range) is the exact C-14 defect — reporting success while the doc stays
    // unpairable. Detect the upgraded shape and, if absent, UPGRADE IN PLACE.
    const testIdOk = testIdMatchesList(data.testId, listId);
    const rangeOk = Number.isInteger(data.newWordStartIndex) && Number.isInteger(data.newWordEndIndex);
    if (testIdOk && rangeOk) {
      // Already carries the upgraded shape → true no-op (idempotent).
      return {success: true, alreadyWritten: true, upgraded: false, attemptId: markerId};
    }
    // Legacy/partial marker: derive the day's anchor range and merge the
    // upgraded fields in. Only fabricate what we can PROVE (never invent a range).
    const existingRange = await deriveDayAnchorRange(uid, listId, dayNumber);
    const updates = {};
    if (!testIdOk) updates.testId = `vocaboost_test_${classId}_${listId}_review`;
    if (!rangeOk && existingRange) {
      updates.newWordStartIndex = existingRange.newWordStartIndex ?? null;
      updates.newWordEndIndex = existingRange.newWordEndIndex ?? null;
    }
    if (!rangeOk && !existingRange) {
      // No same-day passed new anchor derivable (pure review-only day) — leave
      // the range null (a range-less marker on a day that DID have new words is
      // the C-14 signature; a pure review-only day legitimately has none).
      await logSystemEventServer("review_marker_anchor_missing", {
        userId: uid, classId, listId, dayNumber, existing: true,
      });
    }
    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
      return {success: true, upgraded: true, attemptId: markerId, anchorRange: existingRange ?? null};
    }
    // Nothing derivable to upgrade (range unknown, testId already fine) — no-op.
    return {success: true, alreadyWritten: true, upgraded: false, attemptId: markerId};
  }
  const range = await deriveDayAnchorRange(uid, listId, dayNumber);
  if (!range) {
    // No same-day passed new anchor (legit on pure review-only days). Keep the
    // marker (day completion must not break) but log — a RANGE-LESS marker on
    // a day that DID have new words would be the C-14 signature recurring.
    await logSystemEventServer("review_marker_anchor_missing", {
      userId: uid, classId, listId, dayNumber,
    });
  }
  // [deepfix P10 · OVR part (c)] Additive teacherIds denormalization (dormant unless
  // TEACHER_IDS_WRITE_ENABLED). Null when the flag is off ⇒ the field is omitted ⇒ the
  // marker doc is byte-identical to today.
  const teacherIds = await computeTeacherIdsForAttempt({studentId: uid, listId, stampTeacherId: teacherId});
  await ref.set({
    studentId: uid,
    teacherId: teacherId ?? null,
    ...(teacherIds ? {teacherIds} : {}),
    classId,
    listId,
    // C-34: parseable testId (new-format regex + resetStudentProgress's
    // parts[3]===listId parse, db.js:2985-2989).
    testId: `vocaboost_test_${classId}_${listId}_review`,
    studyDay: dayNumber,
    testType: "mcq",
    sessionType: "review",
    score: 100,
    passed: true,
    totalQuestions: 0,
    correctCount: 0,
    answers: [],
    autoCompleted: true,
    // C-14: the day's anchor range (exact-range pairing, db.js:3449-3450).
    newWordStartIndex: range?.newWordStartIndex ?? null,
    newWordEndIndex: range?.newWordEndIndex ?? null,
    wordsIntroduced: 0, // marker introduces nothing; the range is PAIRING lineage
    manualReviewNote: "Auto-completed: no review available — all segment words mastered (21-day rest).",
    submittedAt: FieldValue.serverTimestamp(),
    writtenBy: "cloud-function",
  });
  return {success: true, alreadyWritten: false, attemptId: markerId, anchorRange: range ?? null};
}

// ============================================================================
// M4 — server anchor validation, SHADOW (FIX_PLAN P3 change 6; I-6 §1.2 #4)
// ============================================================================

/**
 * Called from writeAttemptTxn (index.js) for sessionType==='new' writes.
 * Asserts (I-6 M4):
 *   newWordStartIndex === serverTwi
 *   newWordEndIndex   === nwsi + introducedCount − 1
 *   introducedCount   ≤ server allocation (clamped to wordsRemaining)
 *   studyDay          === serverCsd + 1
 * SHADOW mode (ANCHOR_VALIDATION_SHADOW, ANCHOR_VALIDATION_ENFORCE=false): LOG-ONLY
 * (`anchor_rejected` with shadow:true, enforced:false) — never throws, never blocks.
 * ENFORCE mode (F-2 / FIX_PLAN P6d, ANCHOR_VALIDATION_ENFORCE=true, flipped ONLY after
 * the ≥14-day shadow soak proves ≈0 false rejects): on a violation, logs
 * `anchor_rejected {enforced:true}` and REJECTS the write (throws) — the C-31 backstop
 * that was SPECIFIED but never wired (P3_impl_notes U9). The enforce throw is placed
 * OUTSIDE the read try/catch so it PROPAGATES to the caller (the catch swallows only our
 * OWN read errors → fail-open, never blocks a legit write on an infra hiccup). Returns a
 * `{violations:[…]}` verdict (the caller ignores it; the throw is the enforcement leg).
 * Both flags false (this dormant draft) ⇒ immediate no-op with ZERO reads ⇒ byte-identical.
 */
async function validateAttemptAnchorShadow(uid, ctx, classData) {
  if (!ANCHOR_VALIDATION_SHADOW && !ANCHOR_VALIDATION_ENFORCE) return {violations: []};
  if (!ctx || ctx.sessionType !== "new") return {violations: []};
  let detectedViolations = [];
  try {
    const assignment = classData?.assignments?.[ctx.listId] || null;
    // Server state: the same record the day-guard baselines on (legacy doc
    // pre-P5, canonical post-P5 — durableProgressRef tracks the F4-4 flip).
    const progSnap = await durableProgressRef(uid, ctx.classId, ctx.listId).get();
    const progress = progSnap.exists ? progSnap.data() : {};
    const serverTwi = progress.totalWordsIntroduced || 0;
    const serverCsd = progress.currentStudyDay || 0;
    const {dailyPace} = deriveDailyPace(assignment);
    // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED, M4 shadow parity): under the binary throttle derive the
    // M4 allowedIntroduced from the SAME {0,1} intervention the live allocator uses
    // (deriveThrottleModeServer over the persisted reviewMode), NOT the graduated
    // calculateInterventionLevel — else a binary review-mode day (allocNew 0) is scored against a
    // FRACTIONAL graduated allocation and flags a false `introduced_over_allocation`, polluting the M4
    // shadow soak once SHADOW is turned on concurrently with FORCED_PATHWAY. INERT today
    // (ANCHOR_VALIDATION_SHADOW/ENFORCE both false). Flag-off: calculateInterventionLevel verbatim
    // (byte-equivalent).
    const interv = FORCED_PATHWAY_ENABLED
      ? (deriveThrottleModeServer(progress.recentSessions || [], progress.reviewMode === true) ? 1 : 0)
      : calculateInterventionLevel(progress.recentSessions || []);
    const allocNew = Math.round(dailyPace * (1 - interv));
    let wordsRemaining = null;
    try {
      const listSnap = await getDb().collection("lists").doc(ctx.listId).get();
      wordsRemaining = listSnap.exists ?
        ((listSnap.data().wordCount || 0) - serverTwi) : null;
    } catch (_) {
      wordsRemaining = null; // unknown — skip the clamp leg, not the rest
    }
    // P9 · CYC (FIX_PLAN P9 integration point): on a cycling list the monotonic virtual twi
    // climbs past the list size, so `wordsRemaining` goes negative every lap and the plain
    // clamp would make allowedIntroduced 0 → `introduced_over_allocation` on EVERY lap-2 day.
    // Under cycling drop the wordsRemaining cap (lap-modular clamp = the paced allocation), so
    // `anchor_rejected` stays ≈0 on lap-2 days. All other M4 legs are lap-safe as-is: nwsi ===
    // serverTwi (virtual, monotonic), nwei === nwsi+count-1 (virtual range), studyDay ===
    // csd+1. Codex P9-5: use the EFFECTIVE (cross-class §3b) predicate — SAME as the client —
    // keyed on the STUDENT (uid) + list, not the launching class only, or a cross-class cycling
    // day (unlocked via another class) is falsely rejected. Flag-off ⇒ resolver short-circuits
    // (no read) ⇒ cycling false ⇒ today's exact clamp (byte-equivalent).
    const cycling = (await resolveEffectiveCyclingServer(uid, ctx.listId)).enabled;
    const allowedIntroduced = cycling ?
      Math.max(0, allocNew) :
      (wordsRemaining == null ?
        Math.max(0, allocNew) :
        Math.max(0, Math.min(allocNew, wordsRemaining)));

    const nwsi = ctx.newWordStartIndex;
    const nwei = ctx.newWordEndIndex;
    const introducedCount = Number.isInteger(ctx.wordsIntroduced) ?
      ctx.wordsIntroduced :
      ((Number.isInteger(nwsi) && Number.isInteger(nwei)) ? (nwei - nwsi + 1) : null);

    const violations = [];
    if (nwsi !== serverTwi) violations.push("nwsi_ne_server_twi");
    if (!(Number.isInteger(nwei) && Number.isInteger(nwsi) &&
          Number.isInteger(introducedCount) && nwei === nwsi + introducedCount - 1)) {
      violations.push("nwei_range_inconsistent");
    }
    if (!(Number.isInteger(introducedCount) && introducedCount <= allowedIntroduced)) {
      violations.push("introduced_over_allocation");
    }
    if (ctx.studyDay !== serverCsd + 1) violations.push("studyDay_ne_csd_plus_1");

    if (violations.length > 0) {
      logger.warn(ANCHOR_VALIDATION_ENFORCE ?
        "anchor_rejected (ENFORCED — write BLOCKED)" :
        "anchor_rejected (SHADOW — write NOT blocked)", {
        uid, classId: ctx.classId, listId: ctx.listId, attemptDocId: ctx.attemptDocId, violations,
      });
      await logSystemEventServer("anchor_rejected", {
        shadow: !ANCHOR_VALIDATION_ENFORCE,
        enforced: ANCHOR_VALIDATION_ENFORCE,
        userId: uid,
        classId: ctx.classId,
        listId: ctx.listId,
        attemptDocId: ctx.attemptDocId ?? null,
        testId: ctx.testId ?? null,
        violations,
        observed: {
          newWordStartIndex: nwsi ?? null,
          newWordEndIndex: nwei ?? null,
          wordsIntroduced: ctx.wordsIntroduced ?? null,
          studyDay: ctx.studyDay ?? null,
        },
        expected: {
          serverTwi, serverCsd, allocNew, wordsRemaining, allowedIntroduced,
        },
      });
    }
    detectedViolations = violations;
  } catch (err) {
    // Our OWN read/validation error must NEVER affect the live write path
    // (fail-open): swallow it and let the write proceed. Enforcement (below) is
    // therefore never triggered by an infra hiccup — only by a real violation.
    logger.warn("anchor shadow validation errored (non-fatal, write unaffected)", {
      uid, error: err.message,
    });
    return {violations: [], readError: true};
  }
  // F-2 (M4 ENFORCE — FIX_PLAN P6d; completes P3_impl_notes U9): once
  // ANCHOR_VALIDATION_ENFORCE is armed (P6, after the shadow soak), a real
  // violation REJECTS the write. Thrown OUTSIDE the try/catch so it propagates
  // (the catch is for our own read errors only). Dormant behind the flag ⇒ never
  // taken in this draft ⇒ byte-equivalent (shadow/log-only when only SHADOW is on).
  if (ANCHOR_VALIDATION_ENFORCE && detectedViolations.length > 0) {
    throw new HttpsError("failed-precondition",
      `Attempt anchor rejected by M4 enforcement (${detectedViolations.join(",")})`);
  }
  return {violations: detectedViolations};
}

// ============================================================================
// 1 · completeSession — M3+M5 (FIX_PLAN P3 change 1)
// ============================================================================

/**
 * completeSession({classId, listId, sessionContext})
 *
 * ONE Admin-SDK transaction over the durable progress doc:
 *   • transactional day-guard — semantics of progressService.js:441-452
 *     (expectedDay = storedCsd + 1), now atomic (closes persist [C3-2]);
 *   • server-side allocation recompute from ITS OWN state (recentSessions →
 *     intervention → allocation; list wordCount → wordsRemaining);
 *   • reviewOnlyDay derived replicating ALL THREE client predicate reasons
 *     (studyService.js:1329-1335; v3 F4-2):
 *       reason 1  allocation.newWords <= 0            → serverAllocNew <= 0
 *       reason 2  isListComplete === true             → wordsRemaining <= 0
 *       reason 3  startPhase === REVIEW_STUDY (#9/S8) → the day's passed `new`
 *                 attempt is ALREADY ABSORBED into stored twi
 *                 (dayNewPass.newWordEndIndex <= twi − 1 — the twi-defining
 *                 pick of studyService.js:258-262; prevents the F4-2
 *                 double-introduction above the anchor);
 *   • wordsIntroduced = reviewOnlyDay ? 0 : max(0, min(alloc, wordsRemaining))
 *     (clamp parity: studyService.js:1339-1342 — TWI exactly flat on
 *     review-only days, never negative);
 *   • recentSessions append (summary shape of createSessionSummary,
 *     studyTypes.js:266-287; null new-word score when no real new attempt
 *     exists — PLAN_review_only §3 / studyService.js:1405-1410);
 *   • csd+1, twi += wordsIntroduced, stats/streak (updateClassProgress parity,
 *     progressService.js:454-489).
 *
 * IDEMPOTENT against a committed-but-lost retry (FIX_PLAN P3 v3 MED): a retry
 * of the SAME completion (dayNumber === storedCsd AND the last recentSessions
 * entry is that day) returns the current state with status 'already_completed'
 * — exactly one advance. A genuine day-guard collision returns
 * 'day_guard_rejected', clears the session_states doc (clearSessionState
 * parity, studyService.js:624-655) and logs
 * `day_guard_rejected_session_cleared` WITH uid.
 *
 * On a review-only Day-2+ completion with NO review attempt for the day, the
 * W2-upgraded marker is written (I-6 §1.2 #1) so the day pairs + is
 * gradebook-visible.
 */
const completeSession = onCall({enforceAppCheck: false}, async (request) => {
  if (!SERVER_COMPLETE_SESSION_ENABLED) {
    throw new HttpsError("failed-precondition", "completeSession is not enabled (SERVER_COMPLETE_SESSION_ENABLED=false)");
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid;
  const {classId, listId, sessionContext} = request.data || {};
  const sc = sessionContext || {};
  const dayNumber = sc.dayNumber;
  if (!Number.isInteger(dayNumber) || dayNumber < 1) {
    throw new HttpsError("invalid-argument", "sessionContext.dayNumber must be an integer >= 1");
  }
  const {assignment, teacherId} = await assertEnrolledAssigned(uid, classId, listId);
  const {dailyPace, studyDaysPerWeek} = deriveDailyPace(assignment);

  // Server state read (list size) — outside the txn; list docs are static.
  let totalListWords = 0;
  try {
    const listSnap = await getDb().collection("lists").doc(listId).get();
    totalListWords = listSnap.exists ? (listSnap.data().wordCount || 0) : 0;
  } catch (err) {
    // Unknown list size must not fabricate isListComplete=true → fail the call
    // (retryable) rather than mis-derive review-only.
    throw new HttpsError("unavailable", `Could not read list metadata: ${err.message}`);
  }

  // Pre-queries (attempts are append-only; only influence wordsIntroduced /
  // the marker decision — never the day-guard, which is transactional below).
  const dayNewPass = await getDayNewPass(uid, listId, dayNumber);
  if (dayNewPass && dayNewPass.error) {
    // Reason-3 derivation would be UNKNOWN → completing could double-introduce
    // twi (the exact F4-2 hazard). Fail retryable; move nothing.
    throw new HttpsError("unavailable", "Could not verify the day's new-word attempt; please retry.");
  }

  // Sanitize client display fields (stats-only; the server owns csd/twi/
  // wordsIntroduced — scores feed avgs/intervention exactly as today).
  const clampScore = (v) => (typeof v === "number" && Number.isFinite(v)) ?
    Math.max(0, Math.min(1, v)) : null;
  const intOr0 = (v) => (Number.isInteger(v) && v >= 0) ? v : 0;

  const progressRef = durableProgressRef(uid, classId, listId);
  const now = Timestamp.now();

  // P9 · CYC (Codex P9-5): resolve the EFFECTIVE cross-class cycling capability ONCE as a
  // PRE-transaction read (§3b), keyed on the STUDENT+list — the SAME predicate the client used
  // to remove the cap — so the server's derivation agrees with the client instead of checking
  // only the launching class. Flag-off ⇒ short-circuit, no read (byte-equivalent).
  const cycling = (await resolveEffectiveCyclingServer(uid, listId)).enabled;
  // OC-4 (PR-2 verify HIGH): the lap MODULUS is the live word-doc count (getCycleLength /
  // positions.length), NEVER lists.wordCount. Fetched pre-transaction, only when cycling.
  const cycleModulus = cycling ? await getCanonicalCycleLengthServer(listId) : 0;

  // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED): pre-fetch the day's review for the F3 completion-
  // engagement gate (the server mirror of the client's threaded reviewAnswered — here read from the
  // STORED attempt's PR-2 engagedReview stamp). Only under the flag + Day-2+ (Day-1 has no review).
  // null / {error:true} ⇒ fpReviewEngaged=true ⇒ the hold gate fails OPEN (advance) so a query blip
  // never strands a completion. Flag-off ⇒ no read (byte-equivalent).
  const fpDayReview = (FORCED_PATHWAY_ENABLED && dayNumber >= 2)
    ? await getDayReviewForEngagement(uid, listId, dayNumber)
    : null;
  const fpReviewEngaged = !(fpDayReview && !fpDayReview.error)
    ? true
    : isCompletionEngagedServer(fpDayReview, FORCED_PATHWAY_GRANDFATHER_EPOCH_MS);

  const txnResult = await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(progressRef);
    const current = snap.exists ? snap.data() : defaultProgressShape(classId, listId);
    const currentCsd = current.currentStudyDay || 0;
    const currentTwi = current.totalWordsIntroduced || 0;

    // ── Transactional day-guard (progressService.js:441-452, now atomic) ──
    const expectedDay = currentCsd + 1;
    if (dayNumber !== expectedDay) {
      // Idempotency: duplicate retry of the SAME committed completion?
      const recent = current.recentSessions || [];
      const last = recent.length > 0 ? recent[recent.length - 1] : null;
      if (dayNumber === currentCsd && last && last.day === dayNumber) {
        return {status: "already_completed", current, currentCsd, currentTwi};
      }
      return {status: "day_guard_rejected", current, currentCsd, currentTwi};
    }

    // ── Server derivation (M5; F4-2 three-reason parity) ──
    // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED): BINARY serverInterv (parity with the client
    // initializeDailySession) — deriveThrottleModeServer with hysteresis over the persisted
    // reviewMode bit → {0,1}; allocNew is then 0 in review mode (reason-1 allocationZero ⟺ review
    // mode). Flag-off ⇒ the graduated calculateInterventionLevel value (byte-equivalent).
    const fpReviewMode = FORCED_PATHWAY_ENABLED
      ? deriveThrottleModeServer(current.recentSessions || [], current.reviewMode === true)
      : false;
    const serverInterv = FORCED_PATHWAY_ENABLED
      ? (fpReviewMode ? 1 : 0)
      : calculateInterventionLevel(current.recentSessions || []);
    const allocNew = Math.round(dailyPace * (1 - serverInterv)); // studyAlgorithm.js:107
    const wordsRemaining = totalListWords - currentTwi;          // studyService.js:234
    // P9 · CYC (§3f): under cycling the list NEVER completes (twi climbs past the list size
    // each lap) and the allocation cap is REMOVED — parity with studyService.js
    // initializeDailySession (isListComplete=false, newWordCount=max(0,allocNew)). `cycling`
    // is the EFFECTIVE cross-class result resolved pre-transaction above (Codex P9-5). Flag-off
    // ⇒ cycling false ⇒ today's exact `wordsRemaining <= 0` / `min(allocNew, wordsRemaining)`
    // (byte-equivalent).
    const isListComplete = cycling ? false : (wordsRemaining <= 0); // studyService.js:314
    const dayNewAbsorbed = !!dayNewPass &&
      Number.isInteger(dayNewPass.newWordEndIndex) &&
      dayNewPass.newWordEndIndex <= currentTwi - 1;              // reason 3 (S8/#9)
    const reviewOnlyReasons = {
      allocationZero: allocNew <= 0,        // reason 1 (S3 throttle)
      listComplete: isListComplete,         // reason 2 (S4/S5 list-end) — always false under cycling
      reviewStudyResume: dayNewAbsorbed,    // reason 3 (S8 #9-resume)
    };
    const reviewOnlyDay =
      reviewOnlyReasons.allocationZero ||
      reviewOnlyReasons.listComplete ||
      reviewOnlyReasons.reviewStudyResume;

    // ── F-4: EVIDENCE REQUIREMENT (do NOT advance csd/twi test-free) ──
    // A completion may advance the day ONLY with evidence: a day-N passed `new`
    // anchor (dayNewPass, list-wide under LIST_SCOPED_RECON) OR a server-verified
    // review-only reason (allocationZero / listComplete / reviewStudyResume,
    // computed above). A bare completeSession(csd+1) with neither is refused — it
    // would pump csd/twi with no anchor AND mint the review-markers the P5
    // CSD-plausibility screen trusts as durable evidence. The transactional
    // day-guard + idempotency legs above are untouched; this only gates the
    // actual advance. (dayNewPass.error was already rejected pre-txn.)
    const hasNewAnchor = !!dayNewPass && Number.isInteger(dayNewPass.newWordEndIndex);
    if (!hasNewAnchor && !reviewOnlyDay) {
      return {status: "no_evidence", current, currentCsd, currentTwi, reviewOnlyReasons};
    }

    const serverNewWordCount = cycling ? Math.max(0, allocNew) : Math.min(allocNew, wordsRemaining); // studyService.js:235
    const wordsIntroduced = reviewOnlyDay ? 0 : Math.max(0, serverNewWordCount); // clamp, :1339-1342

    // ── Summary (createSessionSummary shape, studyTypes.js:266-287) ──
    // newWordScore: literal null when no real new attempt exists (review-only
    // no-attempt day — studyService.js:1405-1410); an S8 resume day keeps its
    // real cross-class score (:1444-1449).
    let newWordScore = clampScore(sc.newWordScore);
    if (!dayNewPass && reviewOnlyDay) newWordScore = null;
    const reviewScore = clampScore(sc.reviewScore);
    const summary = {
      day: dayNumber,
      date: now, // Timestamp.now(): serverTimestamp() sentinels are illegal inside arrays
      newWordScore,
      reviewScore,
      segmentStartIndex: intOr0(sc.segmentStartIndex),
      segmentEndIndex: intOr0(sc.segmentEndIndex),
      wordsIntroduced,
      wordsReviewed: intOr0(sc.wordsReviewed),
      wordsTested: intOr0(sc.wordsTested),
    };
    // OC-4 (CS PR-2 · P9·CYC·U5 RESET mirror) — the ABSENT server-side cycling lap-boundary
    // intervention reset, mirroring progressService.js:585-605. When the virtual twi crosses
    // k·cycleLength (cycleLength = the canonical word-doc count — PR-2 verify HIGH fix) on a cycling list, DROP the prior lap's
    // recentSessions carry (clean slate for the next intervention calc) and ZERO the stored
    // interventionLevel (the finished list restarts at full pace). `cycling` is the EFFECTIVE
    // cross-class result resolved pre-transaction (Codex P9-5). Gated on it: CYCLING_ENABLED=false
    // ⇒ resolveEffectiveCyclingServer short-circuits ⇒ cycling=false ⇒ crossedLapBoundary=false ⇒
    // the carry + serverInterv survive verbatim (byte-equivalent to today).
    const cycleLen = cycleModulus; // OC-4 fix: canonical word-doc count (getCanonicalCycleLengthServer), NOT lists.wordCount
    const twiBefore = currentTwi;
    const twiAfter = currentTwi + wordsIntroduced;
    const crossedLapBoundary = cycling === true && cycleLen > 0 &&
      Math.floor(twiBefore / cycleLen) < Math.floor(twiAfter / cycleLen);
    const recentSessions = [...(crossedLapBoundary ? [] : (current.recentSessions || [])), summary].slice(-MAX_RECENT_SESSIONS);
    const stats = calculateProgressStats(recentSessions);
    const streakDays = calculateUpdatedStreak(current.lastStudyDate, current.streakDays || 0, studyDaysPerWeek);

    // ── CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED) HOLD-CSD (OC-1 `review_recorded`) ──
    // Record the review WITHOUT advancing csd/twi when: a THROTTLE review-only day (review mode drove
    // reason-1 allocationZero, and it is NEITHER the list-end NOR the #9-resume review-only case —
    // those still advance, NEED_TO_FIX #11 preserved), OR a Day-2+ NON-ENGAGED (skip) review (the F3
    // gate — kills the #16 runaway). Flag-off ⇒ fpHoldCsd false ⇒ the normal advance below runs
    // verbatim (byte-equivalent). Mirrors progressService.recordReviewOutcome.
    const fpThrottleReviewOnly = FORCED_PATHWAY_ENABLED &&
      reviewOnlyReasons.allocationZero &&
      !reviewOnlyReasons.listComplete &&
      !reviewOnlyReasons.reviewStudyResume;
    const fpHoldCsd = FORCED_PATHWAY_ENABLED &&
      (fpThrottleReviewOnly || (dayNumber >= 2 && !fpReviewEngaged));
    if (fpHoldCsd) {
      const heldReviewMode = deriveThrottleModeServer(recentSessions, current.reviewMode === true);
      const heldUpdates = {
        // NO currentStudyDay, NO totalWordsIntroduced — HELD (the whole point of hold-csd).
        reviewMode: heldReviewMode,
        recentSessions,
        stats,
        streakDays,
        lastStudyDate: now,
        lastSessionAt: now,
        updatedAt: now,
      };
      if (snap.exists) {
        tx.update(progressRef, heldUpdates);
      } else {
        tx.set(progressRef, {
          ...defaultProgressShape(classId, listId),
          ...heldUpdates,
          programStartDate: mondayOfWeekTimestamp(),
          createdAt: now,
        });
      }
      return {
        status: "review_recorded",
        currentCsd, currentTwi,
        reviewOnlyDay, reviewOnlyReasons, reviewMode: heldReviewMode,
        heldEngaged: fpReviewEngaged, throttleReviewOnly: fpThrottleReviewOnly,
      };
    }

    const updates = {
      currentStudyDay: currentCsd + 1,                       // progressService.js:466
      totalWordsIntroduced: currentTwi + wordsIntroduced,    // progressService.js:467
      // OC-4: a crossed lap boundary zeroes the stored intervention (progressService.js:605).
      // Flag-off ⇒ crossedLapBoundary=false ⇒ serverInterv (byte-equivalent).
      interventionLevel: crossedLapBoundary ? 0 : serverInterv, // parity: the session's own level (:468)
      recentSessions,
      stats,
      streakDays,
      lastStudyDate: now,
      lastSessionAt: now,
      updatedAt: now,
    };
    // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED): the completion writer is the ONE owner of the
    // persisted reviewMode bit — recompute on ADVANCE too (a crossed lap boundary's fresh recentSessions
    // slate → false, restarting full pace, in step with interventionLevel:0 above). Flag-off ⇒ no
    // reviewMode field written (byte-equivalent advance doc).
    if (FORCED_PATHWAY_ENABLED) {
      updates.reviewMode = deriveThrottleModeServer(recentSessions, current.reviewMode === true);
    }
    if (snap.exists) {
      tx.update(progressRef, updates);
    } else {
      tx.set(progressRef, {
        ...defaultProgressShape(classId, listId),
        ...updates,
        programStartDate: mondayOfWeekTimestamp(), // createClassProgress parity (studyTypes.js:240-251)
        createdAt: now,
      });
    }
    return {
      status: "completed",
      currentCsd, currentTwi,
      applied: updates,
      reviewOnlyDay, reviewOnlyReasons, wordsIntroduced, serverInterv,
      allocNew, wordsRemaining, newWordScore,
    };
  });

  // ── Post-transaction legs ──
  if (txnResult.status === "day_guard_rejected") {
    // clearSessionState parity (studyService.js:632-635: one retry) so the
    // stale in-flight session is rebuilt, never re-presented as success.
    const sessionRef = getDb().doc(`users/${uid}/session_states/${getProgressDocId(classId, listId)}`);
    let sessionCleared = false;
    for (let i = 0; i < 2 && !sessionCleared; i++) {
      try {
        await sessionRef.delete();
        sessionCleared = true;
      } catch (err) {
        logger.warn("day-guard session clear failed", {uid, attempt: i + 1, error: err.message});
      }
    }
    await logSystemEventServer(
      sessionCleared ? "day_guard_rejected_session_cleared" : "day_guard_session_clear_FAILED",
      {
        userId: uid, // WITH uid (FIX_PLAN P3 change 1)
        classId, listId,
        sessionDay: dayNumber,
        progressDay: txnResult.currentCsd,
        sessionCleared,
        source: "completeSession",
      },
      sessionCleared ? "warning" : "error",
    );
    return {status: "day_guard_rejected", dayGuardRejected: true, sessionCleared, progressDay: txnResult.currentCsd};
  }

  if (txnResult.status === "already_completed") {
    return {
      status: "already_completed",
      dayGuardRejected: false,
      progress: {id: progressRef.id, ...txnResult.current},
    };
  }

  // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED) hold-csd: the review was RECORDED but the day did NOT
  // advance (OC-1). Log it and return a success-shaped, non-advancing result — the student stays on
  // the review-mode day (throttle hold) or must retake (skip). No users/{uid}/sessions history write
  // and no W2 marker (csd unchanged ⇒ nothing to pair/mark). Only reachable under the double gate.
  if (txnResult.status === "review_recorded") {
    await logSystemEventServer("review_recorded", {
      userId: uid, classId, listId,
      sessionDay: dayNumber, progressDay: txnResult.currentCsd,
      reviewOnlyReasons: txnResult.reviewOnlyReasons,
      reviewMode: txnResult.reviewMode,
      throttleReviewOnly: txnResult.throttleReviewOnly,
      engaged: txnResult.heldEngaged,
      source: "completeSession",
    }, "info");
    return {
      status: "review_recorded",
      dayGuardRejected: false,
      advanced: false,
      reviewMode: txnResult.reviewMode,
      progressDay: txnResult.currentCsd,
    };
  }

  // F-4: evidence-gated non-advance. The day-guard passed (dayNumber === csd+1)
  // but there is no passed `new` anchor and no server-verified review-only reason
  // — refuse to advance (nothing was written in the txn). The session is NOT
  // cleared (unlike a day-guard collision): the student may simply need to pass
  // the day's test, so the in-flight session should survive for a genuine retry.
  if (txnResult.status === "no_evidence") {
    await logSystemEventServer("complete_session_no_evidence", {
      userId: uid, classId, listId,
      sessionDay: dayNumber,
      progressDay: txnResult.currentCsd,
      reasons: txnResult.reviewOnlyReasons,
      reason: "no passed-new anchor and no server-verified review-only reason",
      source: "completeSession",
    }, "warning");
    return {status: "no_evidence", dayGuardRejected: false, advanced: false, progressDay: txnResult.currentCsd};
  }

  // Runtime client-vs-server reviewOnlyDay mismatch tripwire (FIX_PLAN P4
  // "reviewonly_derivation_mismatch" — the server leg lives here so the log
  // starts the moment P4 routes traffic; client just sends its preview).
  if (typeof sc.clientReviewOnlyDay === "boolean" &&
      sc.clientReviewOnlyDay !== txnResult.reviewOnlyDay) {
    await logSystemEventServer("reviewonly_derivation_mismatch", {
      userId: uid, classId, listId, dayNumber,
      client: sc.clientReviewOnlyDay,
      server: txnResult.reviewOnlyDay,
      serverReasons: txnResult.reviewOnlyReasons,
      clientWordsIntroduced: sc.clientWordsIntroduced ?? null,
      serverWordsIntroduced: txnResult.wordsIntroduced,
    });
  }

  // W2 marker on a Day-2+ completion whose day does NOT already carry a
  // range-PAIRING review (I-6 §1.2 #1; deterministic id — converges with the
  // markReviewComplete route). HIGH-2 (Codex): the suppression predicate is
  // PAIRABILITY, not bare review existence — a same-day review from a DIFFERENT
  // class/pace/range does NOT pair to the day's anchor (db.js:3449-3450), so a
  // coarse existence check would suppress the only pairable marker and leave a
  // fresh/reset doc reconciling to anchorDay−1 (the phantom-loop, CONSOLIDATED
  // C-03 / :208-214).
  let markerWritten = false;
  if (dayNumber >= 2) {
    // Determine whether a PAIRING review already exists for the day.
    // dayNewPass (fetched pre-txn) is the day's anchor.
    let pairing;
    if (dayNewPass && Number.isInteger(dayNewPass.newWordEndIndex)) {
      pairing = await getReviewForDayServer(uid, listId, dayNumber, {
        anchorClassId: dayNewPass.classId, // OC-2: same-class legs of the V2 predicate (additive; ignored flag-off)
        anchorSubmittedAt: dayNewPass.submittedAt,
        anchorNewWordStartIndex: dayNewPass.newWordStartIndex,
        anchorNewWordEndIndex: dayNewPass.newWordEndIndex,
      });
    } else {
      // No same-day passed new anchor (pure review-only day, reason 1/2): there
      // is no range to pair against, so the coarse existence check is correct —
      // any review completes such a day (it survives via non-demoting CSD).
      const hasReview = await dayReviewExists(uid, listId, dayNumber);
      pairing = {status: hasReview === true ? "found" : (hasReview === false ? "none" : "query-error")};
    }
    // Suppress the marker ONLY on a proven pairing review ('found'). 'none' →
    // write/upgrade. 'query-error' → fail SAFE: write/upgrade the marker (we
    // NEVER silently suppress on an unverified lookup) + log.
    if (pairing.status !== "found") {
      if (pairing.status === "query-error") {
        await logSystemEventServer("review_marker_pairing_query_error", {
          userId: uid, classId, listId, dayNumber,
          error: pairing.error ?? null, decision: "write_marker_fail_safe",
        }, "warning");
      }
      try {
        const marker = await writeUpgradedReviewMarker(uid, classId, listId, dayNumber, teacherId);
        // Both a fresh write and an in-place UPGRADE count as "written".
        markerWritten = marker.alreadyWritten !== true;
      } catch (err) {
        // The completion itself committed; a marker failure must not fail the
        // call (the day survives in place via non-demoting CSD) — log it.
        logger.error("completeSession marker write failed", {uid, classId, listId, dayNumber, error: err.message});
        await logSystemEventServer("review_marker_write_failed", {
          userId: uid, classId, listId, dayNumber, error: err.message,
        }, "error");
      }
    }
  }

  return {
    status: "completed",
    dayGuardRejected: false,
    reviewOnlyDay: txnResult.reviewOnlyDay,
    reviewOnlyReasons: txnResult.reviewOnlyReasons,
    wordsIntroduced: txnResult.wordsIntroduced,
    markerWritten,
    progress: {
      id: progressRef.id,
      currentStudyDay: txnResult.applied.currentStudyDay,
      totalWordsIntroduced: txnResult.applied.totalWordsIntroduced,
      interventionLevel: txnResult.applied.interventionLevel,
      stats: txnResult.applied.stats,
      streakDays: txnResult.applied.streakDays,
    },
  };
});

// ============================================================================
// 2 · resolveListProgress — persist §5.2 [C6-1], TWO MODES (FIX_PLAN P3
//     change 2; v2 BLOCKER + v3 F4-1)
// ============================================================================

/**
 * resolveListProgress({listId, classId?})
 *
 * READ-ONLY mode (LIST_PROGRESS_CANONICAL=false, P3 → P5):
 *   1. Canonical `users/{uid}/list_progress/{listId}` exists → return it
 *      (mode 'canonical').
 *   2. Else reconcile IN MEMORY: enumerate ALL legacy class_progress docs for
 *      the list (including dropped classes — they carry a listId field),
 *      compute the list anchor + pairing, and build BOTH views:
 *        • `launch` — today's per-launching-class safe values
 *          (progressService.js:233-236 semantics against the LAUNCHING doc);
 *        • `merged` — the cross-doc view (max-safe CSD across sources under
 *          the [C4-2]+evidence screen; anchor-authoritative TWI) — the P5
 *          dry-run preview and the standing #12 tripwire.
 *   3. F4-1 (BLOCKER fix): when `classId` is supplied, PERFORM today's LEGACY
 *      entry-time reconciliation write on the launching class_progress doc —
 *      create-on-miss (progressService.js:114-127) + the recon update
 *      (:264-271) with the SAME per-doc semantics as today. This is what keeps
 *      the completion day-guard baseline current (its expectedDay reads that
 *      stored csd, :441-448). Withheld: ONLY the canonical-doc creation.
 *   4. Creates NO canonical doc on ANY load (the P4 acceptance asserts the
 *      list_progress collection stays empty until P5).
 *   5. Logs the resolution candidate {uid, listId, anchorStatus, applied,
 *      sources} on EVERY call — the #12 tripwire (FIX_PLAN §6.1 hedge a).
 *   Quarantine signatures are LOG-ONLY in this mode (`list_progress_quarantine_candidate`)
 *   — blocking study pre-P5 would be a live behavior change P3 forbids.
 *
 * WRITE-CAPABLE mode (LIST_PROGRESS_CANONICAL=true — flipped ONLY by P5's
 * migration cutover): canonical → hydrate-on-miss via the persist §5.2 [C4-4]
 * transactional algorithm (pre-query candidates outside the txn; re-read
 * destination + candidates BY REFERENCE inside; recompute the §8 merge from
 * the txn snapshots; create only if the destination is still absent) →
 * quarantine BLOCKS (mode 'quarantined' + `list_progress_quarantined` log) →
 * create-fresh only when NO legacy doc exists. Post-P5 the migration has
 * written canonical for everyone, so hydration only ever catches a genuine
 * straggler.
 */
const resolveListProgress = onCall({enforceAppCheck: false}, async (request) => {
  if (!SERVER_RESOLVE_LIST_PROGRESS_ENABLED) {
    throw new HttpsError("failed-precondition", "resolveListProgress is not enabled (SERVER_RESOLVE_LIST_PROGRESS_ENABLED=false)");
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid;
  const {listId, classId} = request.data || {};
  if (!listId || typeof listId !== "string") {
    throw new HttpsError("invalid-argument", "listId is required");
  }
  if (classId != null && typeof classId !== "string") {
    throw new HttpsError("invalid-argument", "classId must be a string when provided");
  }
  // When a launching classId is supplied (the F4-1 legacy-recon leg below may
  // CREATE that class's legacy doc on miss), gate on enrollment + assignment —
  // the same precondition the live entry path enforces before init
  // (DailySessionFlow.jsx:532-535 rejects an unassigned list before
  // getOrCreateClassProgress runs).
  if (classId) {
    await assertEnrolledAssigned(uid, classId, listId);
  }

  const db = getDb();
  const canonicalRef = canonicalProgressRef(uid, listId);

  // 1 · Canonical read (both modes prefer it).
  const canonicalSnap = await canonicalRef.get();
  if (canonicalSnap.exists) {
    const data = canonicalSnap.data();
    await logSystemEventServer("resolve_list_progress", {
      userId: uid, listId, mode: "canonical",
      anchorStatus: "n/a-canonical",
      applied: {csd: data.currentStudyDay ?? null, twi: data.totalWordsIntroduced ?? null},
      sources: ["canonical"],
    });
    return {mode: "canonical", csd: data.currentStudyDay ?? 0, twi: data.totalWordsIntroduced ?? 0, data};
  }

  // 2 · Enumerate ALL legacy docs for this list (incl. dropped classes —
  // class_progress docs carry `listId` in the body, studyTypes.js:240-251).
  const legacyQuery = await db.collection(`users/${uid}/class_progress`)
    .where("listId", "==", listId).get();
  const legacyDocs = legacyQuery.docs.map((d) => ({id: d.id, ref: d.ref, data: d.data()}));

  // 3 · Anchor + pairing (in memory; discriminated statuses preserved).
  const anchor = await computeAnchorPosition(uid, listId);

  // 4 · Per-source safe values + the [C4-2]+evidence CSD screen.
  const anchorSubmittedAt = anchor.anchorTest?.submittedAt ?? null;
  const reviewEvidenceDays = await countPostAnchorReviewDays(uid, listId, anchorSubmittedAt);
  const sources = [];
  const quarantineCandidates = [];
  let mergedCsd = anchor.reviewLookupFailed ? 0 : anchor.csd;
  let mergedTwi = anchor.twi; // anchor floor (authoritative when valid — pinned below)
  for (const doc of legacyDocs) {
    const safe = safeValuesForDoc(doc.data, anchor);
    const {dailyPace: srcPace, studyDaysPerWeek: srcDpw} = deriveDailyPace(null);
    const threshold = implausibleStudyDayThreshold({
      programStartDate: doc.data.programStartDate,
      studyDaysPerWeek: srcDpw,
      totalWordsIntroduced: doc.data.totalWordsIntroduced || 0,
      dailyPace: srcPace,
    });
    const screen = csdScreen({
      storedCSD: safe.storedCSD,
      anchorDay: anchor.anchorDay,
      reviewEvidenceDays,
      threshold,
    });
    // TWI screen (§8): a stored TWI above a VALID anchor is anchor-unbacked;
    // a nonzero TWI with NO valid anchor has no proof at all. Candidates only —
    // read-only mode never blocks (see header).
    // F-7: the second leg fires for ANY not-valid-anchor status (none OR
    // invalid-anchor OR query-error), aligning with the P5 migration's ANCHORLESS_TWI
    // rule (`!hasValidData && twi>0`). The old `=== 'none'` let an invalid-anchor
    // stored twi>0 canonicalise here while the migration would quarantine it — the
    // resolver was LOOSER than the migration (FINAL_REVIEW_FINDINGS F-7).
    const twiSuspect =
      (anchor.hasValidData && (doc.data.totalWordsIntroduced || 0) > anchor.twi) ||
      (!anchor.hasValidData && (doc.data.totalWordsIntroduced || 0) > 0);
    if (screen.implausible || twiSuspect) {
      quarantineCandidates.push({
        docId: doc.id,
        reasons: [
          ...(screen.implausible ? ["csd_implausible"] : []),
          ...(twiSuspect ? ["twi_anchor_unbacked"] : []),
        ],
        storedCSD: safe.storedCSD,
        storedTWI: safe.storedTWI,
        anchorDay: anchor.anchorDay,
        reviewEvidenceDays,
      });
    }
    // Merged view: screened max-safe CSD; TWI stays anchor-authoritative
    // (a suspect stored high NEVER raises the merged view).
    if (!screen.implausible && !anchor.reviewLookupFailed) {
      mergedCsd = Math.max(mergedCsd, safe.safeCSD);
    } else if (anchor.reviewLookupFailed) {
      mergedCsd = Math.max(mergedCsd, safe.storedCSD); // error → stored only
    }
    if (!anchor.hasValidData && !twiSuspect) {
      mergedTwi = Math.max(mergedTwi, safe.safeTWI);
    }
    sources.push({
      docId: doc.id, classId: doc.data.classId ?? null,
      storedCSD: safe.storedCSD, storedTWI: safe.storedTWI,
      safeCSD: safe.safeCSD, safeTWI: safe.safeTWI,
      screened: screen.implausible, twiSuspect,
    });
  }
  if (anchor.hasValidData) mergedTwi = anchor.twi; // TWI anchor-authoritative (progressService.js:236)

  // ── READ-ONLY mode (P3→P5) ──
  if (!LIST_PROGRESS_CANONICAL) {
    let launch = null;
    if (classId) {
      // F4-1: today's legacy entry-time reconciliation, per-launching-doc,
      // byte-parity semantics — create-on-miss + recon write of THAT doc's
      // safe values (progressService.js:114-127 + :264-271). This keeps the
      // day-guard baseline (progressService.js:441-448 / completeSession
      // above) current for the 36 LIVE-STRAND + dual-enroll populations.
      const launchRef = legacyProgressRef(uid, classId, listId);
      const launchDoc = legacyDocs.find((d) => d.id === getProgressDocId(classId, listId));
      const now = Timestamp.now();
      let launchData;
      if (!launchDoc) {
        launchData = {
          ...defaultProgressShape(classId, listId),
          programStartDate: mondayOfWeekTimestamp(),
          createdAt: now,
          updatedAt: now,
        };
        await launchRef.set(launchData); // create-on-miss (progressService.js:118-127)
      } else {
        launchData = launchDoc.data;
      }
      const safe = safeValuesForDoc(launchData, anchor);
      if (safe.safeCSD !== safe.storedCSD || safe.safeTWI !== safe.storedTWI) {
        await logSystemEventServer("csd_twi_reconciled", {
          userId: uid, classId, listId,
          stored: {csd: safe.storedCSD, twi: safe.storedTWI},
          calculated: {csd: anchor.csd, twi: anchor.twi},
          applied: {csd: safe.safeCSD, twi: safe.safeTWI},
          source: "resolveListProgress",
        });
        await launchRef.update({
          currentStudyDay: safe.safeCSD,
          totalWordsIntroduced: safe.safeTWI,
          updatedAt: Timestamp.now(),
        }); // the F4-1-preserved legacy recon write (progressService.js:264-271)
      }
      launch = {classId, csd: safe.safeCSD, twi: safe.safeTWI,
        data: {...launchData, currentStudyDay: safe.safeCSD, totalWordsIntroduced: safe.safeTWI}};
    }
    if (quarantineCandidates.length > 0) {
      await logSystemEventServer("list_progress_quarantine_candidate", {
        userId: uid, listId, candidates: quarantineCandidates, mode: "read-only",
      });
    }
    // Mode: 'legacy' when any legacy doc exists (including one just created on
    // miss for the launching class); 'none' = brand-new student, no doc at all.
    const roMode = (legacyDocs.length > 0 || launch) ? "legacy" : "none";
    // The #12 tripwire — EVERY resolution logs its candidate (FIX_PLAN §6.1).
    await logSystemEventServer("resolve_list_progress", {
      userId: uid, listId, mode: roMode,
      anchorStatus: anchor.anchorStatus,
      applied: launch ? {csd: launch.csd, twi: launch.twi} : {csd: mergedCsd, twi: mergedTwi},
      merged: {csd: mergedCsd, twi: mergedTwi},
      sources,
      reviewEvidenceDays,
      quarantineCandidateCount: quarantineCandidates.length,
    });
    return {
      mode: roMode,
      // Read-only contract: session paths consume the LAUNCH view (byte-parity
      // with today's per-class entry reconciliation → day-guard-consistent);
      // the MERGED view rides alongside for render/diagnosis (P5 preview).
      csd: launch ? launch.csd : mergedCsd,
      twi: launch ? launch.twi : mergedTwi,
      launch,
      merged: {csd: mergedCsd, twi: mergedTwi},
      anchorStatus: anchor.anchorStatus,
      sources,
      quarantineCandidates,
      canonicalWritten: false, // hard contract until P5
    };
  }

  // ── WRITE-CAPABLE mode (P5+ only) ──
  if (quarantineCandidates.length > 0) {
    // Runtime backstop (persist §5.2 quarantine contract): BLOCK, don't route.
    await logSystemEventServer("list_progress_quarantined", {
      userId: uid, listId, candidates: quarantineCandidates, mode: "write-capable",
    }, "error");
    return {mode: "quarantined", reasons: quarantineCandidates};
  }
  if (anchor.anchorStatus === "query-error") {
    // Errored lookups move nothing — never hydrate from unverified reads.
    throw new HttpsError("unavailable", "Anchor lookup failed; hydration aborted (retry).");
  }
  // Hydrate-on-miss ([C4-4] transactional algorithm) / create-fresh.
  const candidateRefs = legacyDocs.map((d) => d.ref);
  const hydrated = await db.runTransaction(async (tx) => {
    const dest = await tx.get(canonicalRef);
    if (dest.exists) return {created: false, data: dest.data()};
    // All reads before any write (txn rule); re-read every candidate BY
    // REFERENCE from the transaction ([C4-4] step 2).
    const snaps = candidateRefs.length > 0 ? await tx.getAll(...candidateRefs) : [];
    // Recompute the merge from TRANSACTIONAL snapshots (not the pre-query).
    let bestTwi = anchor.hasValidData ? anchor.twi : 0;
    let bestCsd = anchor.reviewLookupFailed ? 0 : anchor.csd;
    let winner = null;
    let minStart = null;
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data();
      const safe = safeValuesForDoc(d, anchor);
      if (!anchor.hasValidData) bestTwi = Math.max(bestTwi, safe.safeTWI);
      bestCsd = Math.max(bestCsd, anchor.reviewLookupFailed ? safe.storedCSD : safe.safeCSD);
      const startMs = tsToMillis(d.programStartDate);
      if (startMs != null) minStart = minStart == null ? startMs : Math.min(minStart, startMs);
      // Ancillary winner: max twi → max csd → newest lastSessionAt (§8).
      const better = !winner ||
        (safe.safeTWI > winner.safeTWI) ||
        (safe.safeTWI === winner.safeTWI && safe.safeCSD > winner.safeCSD) ||
        (safe.safeTWI === winner.safeTWI && safe.safeCSD === winner.safeCSD &&
          (tsToMillis(d.lastSessionAt) || 0) > (tsToMillis(winner.data.lastSessionAt) || 0));
      if (better) winner = {data: d, safeTWI: safe.safeTWI, safeCSD: safe.safeCSD};
    }
    const now = Timestamp.now();
    const canonicalDoc = {
      listId,
      lastActiveClassId: classId ?? winner?.data?.classId ?? null, // M1: classId → informational
      currentStudyDay: bestCsd,
      totalWordsIntroduced: bestTwi,
      interventionLevel: winner?.data?.interventionLevel ?? 0,
      recentSessions: winner?.data?.recentSessions ?? [],
      stats: winner?.data?.stats ?? {avgNewWordScore: null, avgReviewScore: null},
      streakDays: winner?.data?.streakDays ?? 0,
      lastStudyDate: winner?.data?.lastStudyDate ?? null,
      lastSessionAt: winner?.data?.lastSessionAt ?? null,
      programStartDate: minStart != null ?
        Timestamp.fromMillis(minStart) : mondayOfWeekTimestamp(),
      hydratedAt: now, // straggler hydration stamp (the migration script stamps migratedAt)
      createdAt: now,
      updatedAt: now,
    };
    tx.set(canonicalRef, canonicalDoc);
    // Stamp the consumed legacy sources (idempotency lineage; parallel to §8's
    // migratedAt — distinct field so the P5 script's own re-run guard is not
    // confused by hydration).
    for (const s of snaps) {
      if (s.exists) tx.update(s.ref, {hydratedAt: now});
    }
    return {created: true, data: canonicalDoc};
  });
  await logSystemEventServer("resolve_list_progress", {
    userId: uid, listId,
    mode: hydrated.created ? "hydrated" : "canonical",
    anchorStatus: anchor.anchorStatus,
    applied: {csd: hydrated.data.currentStudyDay, twi: hydrated.data.totalWordsIntroduced},
    sources,
    reviewEvidenceDays,
  });
  return {
    mode: "canonical",
    csd: hydrated.data.currentStudyDay,
    twi: hydrated.data.totalWordsIntroduced,
    data: hydrated.data,
    hydrated: hydrated.created,
  };
});

// ============================================================================
// 3 · resetProgress — M7 (FIX_PLAN P3 change 3; persist §5.3 [C5-5])
// ============================================================================

/** Batched deleter (≤500 ops per batch). */
async function deleteRefsBatched(refs) {
  const db = getDb();
  let deleted = 0;
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + 500)) batch.delete(ref);
    await batch.commit();
    deleted += Math.min(500, refs.length - i);
  }
  return deleted;
}

/** resetStudentProgress's testId→listId parse (db.js:2980-2992 + :1977-1984). */
function testIdMatchesList(testId, listId) {
  if (!testId || typeof testId !== "string") return false;
  const newFormat = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/);
  if (newFormat) return newFormat[1] === listId;
  const oldFormat = testId.match(/^(test|typed)_([^_]+)_/);
  if (oldFormat) return oldFormat[2] === listId;
  return false;
}

/**
 * resetProgress({listId}) — LIST-WIDE server wipe, per persist §5.3 order
 * ("attempts FIRST, all classes"), self-service (uid = caller; the client
 * `resetStudentProgress` was already self-only, db.js:2896-2900):
 *   1. attempts: every attempt for (uid, listId) — field query PLUS a
 *      testId-parse sweep for legacy docs missing the listId field
 *      (db.js:2966-2992's parse, now list-wide instead of class-scoped);
 *   2. session_states: every `{classId}_{listId}` doc (ALL classes);
 *   3. study_states where listId == listId;
 *   4. legacy class_progress docs for the list (ALL classes);
 *   5. reset-epoch stamp {resetEpoch+1, resetAt} — the [C3-3b] tombstone
 *      (anchor queries exclude pre-epoch attempts once consumers land).
 *      Pre-P5 the stamp lives in `users/{uid}/progress_meta/{listId}` so the
 *      `list_progress` collection PROVABLY stays empty until P5 (the P4
 *      acceptance assert); post-P5 it stamps the canonical doc. FLAGGED in
 *      impl notes (I-6 M7 says "stamp on list_progress"; the pre-P5 meta doc
 *      reconciles that with the v2-BLOCKER empty-collection guarantee).
 */
const resetProgress = onCall({enforceAppCheck: false}, async (request) => {
  if (!SERVER_RESET_PROGRESS_ENABLED) {
    throw new HttpsError("failed-precondition", "resetProgress is not enabled (SERVER_RESET_PROGRESS_ENABLED=false)");
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid;
  const {listId} = request.data || {};
  if (!listId || typeof listId !== "string") {
    throw new HttpsError("invalid-argument", "listId is required");
  }
  const db = getDb();
  const deleted = {attempts: 0, sessionStates: 0, studyStates: 0, classProgress: 0};

  // 1 · attempts FIRST (all classes).
  const byField = await db.collection("attempts")
    .where("studentId", "==", uid)
    .where("listId", "==", listId)
    .get();
  const attemptRefs = new Map(byField.docs.map((d) => [d.id, d.ref]));
  // Legacy sweep: attempts missing the listId field (older writers embedded it
  // only in testId — db.js:2967 comment). Full-history read per student is
  // bounded (hundreds of docs).
  const allMine = await db.collection("attempts").where("studentId", "==", uid).get();
  for (const d of allMine.docs) {
    if (attemptRefs.has(d.id)) continue;
    const data = d.data();
    if (data.listId === listId || (data.listId == null && testIdMatchesList(data.testId, listId))) {
      attemptRefs.set(d.id, d.ref);
    }
  }
  deleted.attempts = await deleteRefsBatched([...attemptRefs.values()]);

  // 2 · session_states for the list, ALL classes (docId = `{classId}_{listId}`,
  // sessionService.js:54-56; Firestore auto-ids contain no underscores so the
  // suffix match is exact).
  const sessionDocs = await db.collection(`users/${uid}/session_states`).listDocuments();
  const sessionRefs = sessionDocs.filter((ref) => ref.id.endsWith(`_${listId}`));
  deleted.sessionStates = await deleteRefsBatched(sessionRefs);

  // 3 · study_states (db.js:2930-2960 parity — field query on listId).
  const studyStates = await db.collection(`users/${uid}/study_states`)
    .where("listId", "==", listId).get();
  deleted.studyStates = await deleteRefsBatched(studyStates.docs.map((d) => d.ref));

  // 4 · legacy class_progress docs (ALL classes): field query ∪ id-suffix
  // sweep (very old docs could miss the listId body field).
  const progressByField = await db.collection(`users/${uid}/class_progress`)
    .where("listId", "==", listId).get();
  const progressRefs = new Map(progressByField.docs.map((d) => [d.id, d.ref]));
  const allProgressDocs = await db.collection(`users/${uid}/class_progress`).listDocuments();
  for (const ref of allProgressDocs) {
    if (ref.id.endsWith(`_${listId}`)) progressRefs.set(ref.id, ref);
  }
  deleted.classProgress = await deleteRefsBatched([...progressRefs.values()]);

  // 5 · Reset-epoch tombstone (M7 / [C3-3b]).
  const now = Timestamp.now();
  const epochStamp = {
    resetEpoch: FieldValue.increment(1),
    resetAt: now,
    resetBy: "resetProgress",
  };
  if (LIST_PROGRESS_CANONICAL) {
    // F-3: post-P5 the durable position IS the canonical doc — the SAME set that
    // stamps the epoch MUST also zero it, else the reset is a NO-OP that leaves
    // csd/twi/recentSessions intact AND (twi>0 with the wiped anchors) mints the
    // anchorless-twi>0 signature the P5 migration quarantines. Default-shape zeros
    // + a fresh programStartDate, merged onto the canonical doc.
    await canonicalProgressRef(uid, listId).set({
      ...epochStamp,
      listId,
      currentStudyDay: 0,
      totalWordsIntroduced: 0,
      interventionLevel: 0,
      recentSessions: [],
      stats: {avgNewWordScore: null, avgReviewScore: null},
      streakDays: 0,
      lastStudyDate: null,
      lastSessionAt: null,
      programStartDate: mondayOfWeekTimestamp(),
      updatedAt: now,
    }, {merge: true});
  } else {
    // Pre-P5 (legacy/dormant path — UNCHANGED): the epoch tombstone lives in
    // progress_meta so the list_progress collection provably stays empty until P5.
    await db.doc(`users/${uid}/progress_meta/${listId}`).set(epochStamp, {merge: true});
  }

  await logSystemEventServer("reset_progress_server", {
    userId: uid, listId, deleted,
  });
  return {success: true, deleted};
});

// ============================================================================
// deepfix P10 · OVR — shared primitives reused by advanceForChallenge (P4) +
//     the P10 reviewChallenge / overrideAttempt callables (FIX_PLAN P10; I-10).
// ============================================================================

/**
 * [deepfix P10 · OVR] The clamped + phase-gated challenge day-advance TRANSACTION —
 * the SINGLE twi-writer primitive. Extracted VERBATIM from advanceForChallenge's
 * inlined transaction (P4/F5-HIGH-2) so P10's reviewChallenge + overrideAttempt REUSE
 * it rather than re-implement the clamp / phase-gate (the plan §0/§1b: those legs are
 * ALREADY done here — do NOT rebuild them). Every caller resolves the same inputs
 * (assignment, EFFECTIVE cross-class `cycling`, list size) in its own pre-transaction
 * preamble and hands them in; the transaction body is identical for all three, so the
 * clamp (I-6 §3-row-8 fix) and the `phase==='new'` gate live in exactly one place.
 *
 * @param {object} p resolved inputs (all read pre-transaction by the caller)
 * @param {object} p.attempt   attempt data (uses .studyDay)
 * @param {object|null} p.assignment  classes/{classId}.assignments[listId] (for .pace)
 * @param {'new'|'review'} p.phase
 * @param {string} p.studentId
 * @param {string} p.classId
 * @param {string} p.listId
 * @param {number} p.newScore   post-acceptance score (0-100)
 * @param {number|null} p.totalListWords  list size for the clamp (null ⇒ fail-open)
 * @param {boolean} p.cycling   EFFECTIVE cross-class cycling (P9, resolved by caller)
 * @returns {Promise<object>} the advance-result object
 */
async function runChallengeDayAdvanceTxn({attempt, assignment, phase, studentId, classId, listId, newScore, totalListWords, cycling}) {
  const db = getDb();
  const progressRef = durableProgressRef(studentId, classId, listId);
  return db.runTransaction(async (tx) => {
    const progressSnap = await tx.get(progressRef);
    if (!progressSnap.exists) {
      // exists()-guard parity (db.js:2804). Post-P5 a missing canonical doc is
      // a straggler the resolver hydrates — surfaced by the log, owned by P10.
      return {advanced: false, reason: "no_progress_doc"};
    }
    const progress = progressSnap.data();
    const currentDay = progress.currentStudyDay || 0;
    const isFirstDay = currentDay === 0;
    // Stale-day guard (db.js:2809-2817): only the current day boundary advances.
    const attemptStudyDay = attempt.studyDay;
    const isCurrentBoundary = Number.isInteger(attemptStudyDay) && attemptStudyDay === currentDay + 1;
    if (!isCurrentBoundary) return {advanced: false, reason: "not_current_boundary", currentDay};

    const now = Timestamp.now();
    if (phase === "new" && !isFirstDay) {
      // Day 2+ new-word pass → advance to review-study; day NOT incremented
      // (db.js:2819-2829 parity, same session_states doc + fields).
      const sessionRef = getDb().doc(`users/${studentId}/session_states/${getProgressDocId(classId, listId)}`);
      tx.set(sessionRef, {
        phase: "review-study",
        newWordsTestPassed: true,
        newWordsTestScore: newScore / 100,
        lastUpdated: FieldValue.serverTimestamp(),
      }, {merge: true});
      return {advanced: true, action: "session_advanced_to_review", currentDay};
    }
    // Day-1 new pass OR review pass at the boundary → complete the day
    // (db.js:2830-2845), CLAMPED + PHASE-GATED per the plan.
    const interventionLevel = progress.interventionLevel || 0;
    const dailyPace = assignment?.pace || 20; // db.js:2837 parity (assignment pace is daily)
    const rawNewWordCount = Math.round(dailyPace * (1 - interventionLevel)); // db.js:2838
    const currentTwi = progress.totalWordsIntroduced || 0;
    // Clamp to wordsRemaining (the I-6 §3-row-8 fix). Unknown list size (read
    // failed) FAILS OPEN to the legacy unclamped-but-non-negative count — the
    // clamp is an improvement and must not become a new silent-zero failure mode.
    const wordsRemaining = totalListWords == null ? null : Math.max(0, totalListWords - currentTwi);
    // P9 · CYC: keep the challenge-accept advance CONSISTENT with the completeSession/M4
    // lap-modular clamp (the spec's "ensure lap-2 allocation/M4 is consistent"). Under
    // cycling the wordsRemaining cap is removed so a lap-2 challenge accept advances by the
    // full paced count (the counter is virtual/monotonic). The phase gate (twi only on
    // phase==='new') is UNCHANGED. `cycling` is the EFFECTIVE cross-class result resolved
    // pre-transaction by the caller (Codex P9-5). Flag-off ⇒ cycling false ⇒ today's exact clamp.
    const clamped = cycling ?
      Math.max(0, rawNewWordCount) :
      (wordsRemaining == null ?
        Math.max(0, rawNewWordCount) :
        Math.max(0, Math.min(rawNewWordCount, wordsRemaining)));
    const twiIncrement = phase === "new" ? clamped : 0; // phase gate (F5-HIGH-2)
    // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED): hold-guard the challenge advance — a review fail→pass
    // must NOT advance a THROTTLE-HELD day (reviewMode===true; the #16 runaway the hold-csd kills).
    // When held, SKIP the advance and return non-advancing (the corrected score already lives on the
    // attempt doc; the day stays put — mirror of the client db.js challenge-accept hold-guard). When it
    // DOES advance, this becomes a csd writer, so it must ALSO persist the reviewMode bit
    // (deriveThrottleModeServer over recentSessions — the one-owner invariant, mirror of the
    // completeSession advance writer). Flag-off: the guard/spread are inert → the unconditional
    // tx.update below runs with no reviewMode key (byte-equivalent to today).
    if (FORCED_PATHWAY_ENABLED && progress.reviewMode === true) {
      return {advanced: false, reason: "review_mode_hold", currentDay};
    }
    tx.update(progressRef, {
      currentStudyDay: currentDay + 1,
      totalWordsIntroduced: currentTwi + twiIncrement,
      ...(FORCED_PATHWAY_ENABLED ? {reviewMode: deriveThrottleModeServer(progress.recentSessions || [], progress.reviewMode === true)} : {}),
      lastSessionAt: now,
      updatedAt: now,
    });
    return {
      advanced: true, action: "day_completed",
      currentDay: currentDay + 1,
      twiIncrement, rawNewWordCount, clampedTo: wordsRemaining, phase,
    };
  });
}

/**
 * [deepfix P10 · OVR] The I-10 §6 authorization UNION, enforced server-side (the Admin
 * SDK bypasses Firestore rules). A caller may review / override an attempt IFF they are
 * a teacher AND EITHER
 *   (i)  the attempt's teacher-of-record STAMP  (attempt.teacherId === caller), OR
 *   (ii) the CURRENT-enrollment owner — they own a class the student is enrolled in NOW
 *        (the renameStudent pattern, index.js:1877-1893).
 * Leg (i) is the stamp model reviewChallenge / advanceForChallenge use today (db.js:2743,
 * foundation.js advanceForChallenge). Leg (ii) is renameStudent's enrollment-ownership
 * model. C-19 is precisely the disjunction neither implements ALONE — P10 unions them, so
 * teacher B can act on an A-stamped inherited attempt of a student promoted A→B. An
 * unrelated teacher matches NEITHER leg ⇒ permission-denied.
 *
 * @param {string} callerId  request.auth.uid
 * @param {object} attempt   attempt data (uses .teacherId, .studentId)
 * @returns {Promise<{via:'stamp'|'enrollment', classId?:string}>}
 */
async function assertOverrideAuthz(callerId, attempt) {
  const db = getDb();
  // Role gate (renameStudent parity, index.js:1864-1868).
  const callerSnap = await db.doc(`users/${callerId}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== "teacher") {
    throw new HttpsError("permission-denied", "Only teachers can review or override attempts.");
  }
  // Leg (i): teacher-of-record stamp.
  if (attempt.teacherId && attempt.teacherId === callerId) return {via: "stamp"};
  // Leg (ii): current-enrollment ownership (renameStudent pattern, index.js:1877-1893).
  const studentId = attempt.studentId;
  if (studentId) {
    const studentSnap = await db.doc(`users/${studentId}`).get();
    const enrolled = studentSnap.exists ? Object.keys(studentSnap.data().enrolledClasses || {}) : [];
    for (const classId of enrolled) {
      const classSnap = await db.doc(`classes/${classId}`).get();
      if (classSnap.exists && classSnap.data().ownerTeacherId === callerId) {
        return {via: "enrollment", classId};
      }
    }
  }
  throw new HttpsError(
    "permission-denied",
    "You are not authorized to act on this attempt (neither its teacher of record nor a current-enrollment owner).",
  );
}

/**
 * [deepfix P10 · OVR / Codex P10-1] STRICT target-bound authorization for the NO-attemptId
 * override path (the teacherId:null / ungradeable orphan — there is no loaded attempt to
 * bind to). Because overrideAttempt writes a reconciliation-AUTHORITATIVE anchor and the
 * Admin SDK bypasses rules, this binds authorization to the EXACT (studentId, classId,
 * listId) write target — NOT the "owns ANY enrolled class" union leg (that breadth is the
 * P10-1 hole for a caller-supplied target). Caller must be a teacher AND
 *   • own the SPECIFIC target class (classes/{classId}.ownerTeacherId === caller), AND
 *   • the student must be enrolled in THAT class (enrolledClasses[classId]), AND
 *   • that class must assign the target list (assignments[listId] exists).
 * Returns the loaded class doc so the caller can build the anchor without a second read.
 *
 * @param {string} callerId
 * @param {{studentId:string, classId:string, listId:string}} target
 * @returns {Promise<{via:'target', classData:object}>}
 */
async function assertOverrideTargetAuthz(callerId, {studentId, classId, listId}) {
  const db = getDb();
  // Role gate (renameStudent parity, index.js:1864-1868).
  const callerSnap = await db.doc(`users/${callerId}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== "teacher") {
    throw new HttpsError("permission-denied", "Only teachers can override attempts.");
  }
  // Caller must own the EXACT target class.
  const classSnap = await db.doc(`classes/${classId}`).get();
  if (!classSnap.exists) throw new HttpsError("not-found", "Target class not found.");
  const classData = classSnap.data() || {};
  if (classData.ownerTeacherId !== callerId) {
    throw new HttpsError("permission-denied", "You do not own the target class for this override.");
  }
  // Student must be enrolled in THAT class.
  const studentSnap = await db.doc(`users/${studentId}`).get();
  const enrolled = studentSnap.exists ? (studentSnap.data().enrolledClasses || {}) : {};
  if (!Object.prototype.hasOwnProperty.call(enrolled, classId)) {
    throw new HttpsError("permission-denied", "The student is not enrolled in the target class.");
  }
  // The class must assign the target list. F-12: accept the legacy `assignedLists`
  // array too, matching the sibling gates (assertEnrolledAssigned :291-293 and
  // computeTeacherIdsForAttempt :1889-1892 both admit assignedLists-only classes) —
  // otherwise a legitimate legacy-assigned target is wrongly rejected.
  const assignsList =
    (classData.assignments && classData.assignments[listId]) ||
    (Array.isArray(classData.assignedLists) && classData.assignedLists.includes(listId));
  if (!assignsList) {
    throw new HttpsError("invalid-argument", "The target class does not assign this list.");
  }
  return {via: "target", classData};
}

/**
 * [deepfix P10 · OVR part (c) / David U1 = Option A] Compute the additive `teacherIds`
 * denormalization array for an attempt — the SET the teacher gradebook `array-contains`
 * query should match (the C-19 read-surface widening). Definition, kept IN SYNC with the
 * client (db.js computeTeacherIdsClient) and the backfill migration
 * (scripts/cs/deepfix-migrate-attempts-teacherids.mjs):
 *
 *   teacherIds = { stampTeacherId (if set) }
 *              UNION { classes/{c}.ownerTeacherId : the student is CURRENTLY enrolled in c
 *                      AND c assigns the attempt's listId }
 *
 * i.e. the teacher-of-record STAMP unioned with the current-enrollment owners "for that
 * list". Deliberately LIST-SCOPED (owner of an enrolled class that ASSIGNS the list), which
 * is TIGHTER than the broad "owns ANY enrolled class" union of assertOverrideAuthz — see
 * P10c_impl_notes U1/U-membership for the narrowing rationale and the open question.
 *
 * STRICT DORMANCY: returns null immediately (ZERO reads) when TEACHER_IDS_WRITE_ENABLED is
 * false, so callers add NO `teacherIds` field ⇒ the written attempt doc is byte-identical to
 * today. Best-effort: any read error falls back to the stamp-only set and NEVER throws — the
 * field is additive/denormalized, never correctness-bearing for the attempt write.
 *
 * @param {{studentId:string, listId?:(string|null), stampTeacherId?:(string|null)}} p
 * @returns {Promise<(string[]|null)>} sorted unique ids, or null when the flag is off
 */
async function computeTeacherIdsForAttempt({studentId, listId, stampTeacherId}) {
  if (!TEACHER_IDS_WRITE_ENABLED) return null; // strict dormancy: no reads, no field written
  const db = getDb();
  const ids = new Set();
  if (stampTeacherId) ids.add(stampTeacherId);
  try {
    if (studentId) {
      const studentSnap = await db.doc(`users/${studentId}`).get();
      const enrolled = studentSnap.exists ?
        Object.keys(studentSnap.data().enrolledClasses || {}) : [];
      for (const classId of enrolled) {
        const classSnap = await db.doc(`classes/${classId}`).get();
        if (!classSnap.exists) continue;
        const c = classSnap.data() || {};
        const assignsList = listId != null && (
          (c.assignments && c.assignments[listId]) ||
          (Array.isArray(c.assignedLists) && c.assignedLists.includes(listId))
        );
        if (assignsList && c.ownerTeacherId) ids.add(c.ownerTeacherId);
      }
    }
  } catch (err) {
    logger.warn("computeTeacherIdsForAttempt read failed (stamp-only set used)",
      {studentId, listId, error: err.message});
  }
  return [...ids].sort();
}

// ============================================================================
// 9 · advanceForChallenge — the 3rd twi writer's day-advance, server-side
//     (FIX_PLAN P3 change 9; v3 F5-HIGH-2; I-6 §3 row 8)
// ============================================================================

/**
 * advanceForChallenge({attemptId, previousScore})
 *
 * Server port of the challenge-accept day-progression block inside the client
 * `reviewChallenge` (db.js:2769-2855): after a teacher acceptance flips an
 * attempt from below→at/above the pass threshold, progress the student's day.
 * Routed at P4 (the client keeps the score/study_state legs until P10 — this
 * callable owns ONLY the day-advance write target so nothing still writes the
 * client-hardcoded class_progress doc after P5, and nothing silently no-ops
 * after P7 deletes it).
 *
 * Deltas vs the client block, per the plan:
 *   • CLAMPED (I-6 §3-row-8 defect): newWordCount = round(pace·(1−interv))
 *     (db.js:2838 parity) is clamped to [0, wordsRemaining] — the client adds
 *     it UNCLAMPED (db.js:2840-2845).
 *   • PHASE-GATED (x/plan §3g review-pass hazard): the twi increment applies
 *     ONLY when the accepted attempt is phase 'new'. A review-pass boundary
 *     completion advances csd but leaves twi flat (semantic delta vs the
 *     client, which added the pace-derived count on the review branch too —
 *     FLAGGED in impl notes for reviewer adjudication; twi is anchor-
 *     authoritative at next entry either way).
 *   • Writes the record the foundation owns (legacy pre-P5, canonical post-P5
 *     via durableProgressRef) inside a transaction (atomic day-advance).
 * Authorization (P3 minimum — the C-19 union is P10's): caller must be a
 * teacher AND the attempt's teacher of record (attempt.teacherId — the same
 * surface today's rules gate the client update on, firestore.rules:114-118).
 */
const advanceForChallenge = onCall({enforceAppCheck: false}, async (request) => {
  if (!SERVER_ADVANCE_FOR_CHALLENGE_ENABLED) {
    throw new HttpsError("failed-precondition", "advanceForChallenge is not enabled (SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=false)");
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const callerId = request.auth.uid;
  const {attemptId, previousScore} = request.data || {};
  if (!attemptId || typeof attemptId !== "string") {
    throw new HttpsError("invalid-argument", "attemptId is required");
  }
  if (typeof previousScore !== "number" || !Number.isFinite(previousScore)) {
    throw new HttpsError("invalid-argument", "previousScore (the pre-acceptance score) is required");
  }
  const db = getDb();

  // Caller must be a teacher (renameStudent pattern, index.js:1851-1854).
  const callerSnap = await db.doc(`users/${callerId}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== "teacher") {
    throw new HttpsError("permission-denied", "Only teachers can advance a student for a challenge.");
  }
  const attemptSnap = await db.collection("attempts").doc(attemptId).get();
  if (!attemptSnap.exists) throw new HttpsError("not-found", "Attempt not found");
  const attempt = attemptSnap.data();
  if (attempt.teacherId !== callerId) {
    // P3 minimum: the teacher-of-record stamp (today's rules surface). The
    // I-10 §6 enrollment-union lands with P10's full reviewChallenge migration.
    throw new HttpsError("permission-denied", "You are not the teacher of record for this attempt.");
  }
  const studentId = attempt.studentId;
  const classId = attempt.classId;
  // listId: field-first, testId-parse fallback (db.js:2784 parity).
  let listId = attempt.listId ?? null;
  if (!listId && typeof attempt.testId === "string") {
    const parts = attempt.testId.split("_");
    listId = parts.length >= 4 ? parts[parts.length - 2] : null;
  }
  // phase: sessionType field-first ('new'|'review'), testId tail fallback
  // (db.js:2780 parses the testId tail).
  let phase = attempt.sessionType ?? null;
  if (phase !== "new" && phase !== "review") {
    const parts = (attempt.testId || "").split("_");
    const tail = parts[parts.length - 1];
    phase = (tail === "new" || tail === "review") ? tail : null;
  }
  if (!studentId || !classId || !listId || !phase) {
    return {advanced: false, reason: "attempt_not_day_progressable"};
  }

  // Threshold from the assignment (db.js:2788-2793 parity).
  const classSnap = await db.collection("classes").doc(classId).get();
  const assignment = classSnap.exists ? (classSnap.data().assignments?.[listId] ?? null) : null;
  const passThreshold = assignment?.passThreshold || DEFAULT_PASS_THRESHOLD;
  const newScore = attempt.score || 0;
  // Only a below→at/above transition progresses the day (db.js:2798).
  if (!(previousScore < passThreshold && newScore >= passThreshold)) {
    return {advanced: false, reason: "not_a_fail_to_pass_transition"};
  }

  // List size for the clamp (the M4-inherited fix).
  let totalListWords = null;
  try {
    const listSnap = await db.collection("lists").doc(listId).get();
    totalListWords = listSnap.exists ? (listSnap.data().wordCount || 0) : null;
  } catch (_) {
    totalListWords = null;
  }

  // P9 · CYC (Codex P9-5): EFFECTIVE cross-class cycling for the STUDENT+list, resolved
  // pre-transaction — the SAME predicate the client + completeSession + M4 use. Flag-off ⇒
  // short-circuit, no read (byte-equivalent).
  const cycling = (await resolveEffectiveCyclingServer(studentId, listId)).enabled;
  // [deepfix P10 · OVR] The clamped + phase-gated day-advance is now the shared
  // runChallengeDayAdvanceTxn primitive (extracted VERBATIM from the transaction that lived
  // inline here through P9), so P10's reviewChallenge + overrideAttempt REUSE the exact same
  // twi clamp + phase gate. Behaviour is byte-identical to the inlined transaction.
  const result = await runChallengeDayAdvanceTxn({
    attempt, assignment, phase, studentId, classId, listId, newScore, totalListWords, cycling,
  });

  await logSystemEventServer("challenge_day_advance", {
    teacherId: callerId, userId: studentId, classId, listId, attemptId,
    phase, previousScore, newScore, passThreshold,
    outcome: result,
  });
  return result;
});

// ============================================================================
// deepfix P10 · OVR (a)+(b) — reviewChallenge (server port) + overrideAttempt
//     (in-product manual-pass). FIX_PLAN P10; I-7/I-10; P10_IMPL_PLAN §1(a)(b).
//
// These FINISH the migration P4 began: advanceForChallenge (above) already owns
// the clamped + phase-gated DAY-ADVANCE; P10 moves the REMAINING reviewChallenge
// legs (answer-flip / score / challenges.history / study_states PASSED) server-side
// and adds the override path — BOTH under the I-10 §6 authz UNION
// (assertOverrideAuthz), BOTH reusing the shared runChallengeDayAdvanceTxn primitive
// (the clamp + phase gate are NOT re-implemented — plan §0/§1b). DORMANT: gated on
// SERVER_REVIEW_CHALLENGE_ENABLED / SERVER_OVERRIDE_ENABLED (false) ⇒ each throws
// `failed-precondition` and touches nothing until the P10 cutover.
// ============================================================================

/**
 * reviewChallenge({attemptId, wordId, accepted})
 *
 * Server port of the client `reviewChallenge` (db.js:2728-2944) — the FULL review, not
 * just the P4 day-advance sub-leg. Absorbs the legs the client still owns today:
 *   • answer-flip (db.js:2761-2773) — challengeStatus accepted/rejected + isCorrect.
 *   • score/passed recompute with the persisted-`totalQuestions` denominator, and the
 *     review-vs-new `newPassed` rule carried verbatim (db.js:2775-2801).
 *   • challenges.history update (db.js:2810-2830).
 *   • study_states PASSED write on accept (db.js:2832-2843) — the write that keeps the
 *     firestore.rules users-subcollection teacher branch alive; moving it here is the
 *     precondition for the §1(d) rules narrowing (NOT done in this draft).
 *   • day-advance (db.js:2845-2939) → the shared runChallengeDayAdvanceTxn (clamp +
 *     phase gate inherited from advanceForChallenge — plan §0).
 * Authz = the I-10 §6 UNION (assertOverrideAuthz), replacing the client's stamp-only
 * throw (db.js:2743). Idempotency: an already-reviewed challenge throws, matching the
 * client (db.js:2757-2759).
 *
 * NOTE (U3): today the client does the answer-flip THEN a nested day-advance callable —
 * two hops. This port preserves that two-hop shape server-side (the answer/score/history/
 * study_state writes, then the day-advance transaction) rather than folding everything
 * into ONE atomic transaction; the failure semantics therefore match today (an
 * answer-flip can commit even if the day-advance no-ops). See P10_impl_notes U3.
 */
const reviewChallenge = onCall({enforceAppCheck: false}, async (request) => {
  if (!SERVER_REVIEW_CHALLENGE_ENABLED) {
    throw new HttpsError("failed-precondition", "reviewChallenge is not enabled (SERVER_REVIEW_CHALLENGE_ENABLED=false)");
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const callerId = request.auth.uid;
  const {attemptId, wordId, accepted} = request.data || {};
  if (!attemptId || typeof attemptId !== "string") {
    throw new HttpsError("invalid-argument", "attemptId is required");
  }
  if (!wordId || typeof wordId !== "string") {
    throw new HttpsError("invalid-argument", "wordId is required");
  }
  if (typeof accepted !== "boolean") {
    throw new HttpsError("invalid-argument", "accepted (boolean) is required");
  }
  const db = getDb();
  const attemptRef = db.collection("attempts").doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw new HttpsError("not-found", "Attempt not found.");
  const attempt = attemptSnap.data();

  // AUTHZ = the I-10 §6 union (replaces the client's stamp-only throw db.js:2743).
  const authz = await assertOverrideAuthz(callerId, attempt);

  // Find the challenged answer (db.js:2747-2759).
  const answers = attempt.answers || [];
  const answerIndex = answers.findIndex((a) => a.wordId === wordId);
  if (answerIndex === -1) throw new HttpsError("not-found", "Answer not found in attempt.");
  const answer = answers[answerIndex];
  // Idempotency guard — already-reviewed throws today (db.js:2757-2759).
  if (answer.challengeStatus !== "pending") {
    throw new HttpsError("failed-precondition", "This challenge has already been reviewed.");
  }

  // Answer-flip (db.js:2761-2773).
  const updatedAnswers = [...answers];
  updatedAnswers[answerIndex] = {
    ...answer,
    challengeStatus: accepted ? "accepted" : "rejected",
    challengeReviewedBy: callerId,
    challengeReviewedAt: Timestamp.now(),
  };
  if (accepted) updatedAnswers[answerIndex].isCorrect = true;

  // Score/passed recompute with the PERSISTED totalQuestions denominator (db.js:2775-2801).
  const correctCount = updatedAnswers.filter((a) => a.isCorrect).length;
  const denom = attempt.totalQuestions || updatedAnswers.length;
  const newScore = denom > 0 ? Math.round((correctCount / denom) * 100) : 0;
  let passThreshold = DEFAULT_PASS_THRESHOLD; // db.js default 95
  if (attempt.classId && attempt.listId) {
    const classSnap = await db.collection("classes").doc(attempt.classId).get();
    const assignment = classSnap.exists ? (classSnap.data().assignments?.[attempt.listId] ?? null) : null;
    passThreshold = assignment?.passThreshold || DEFAULT_PASS_THRESHOLD;
  }
  const previousScore = attempt.score || 0;
  // review branch is always PASSED; new branch gates on threshold (db.js:2800-2801).
  const newPassed = attempt.sessionType === "review" ? true : newScore >= passThreshold;

  // Persist the attempt update (db.js:2804-2808).
  // [deepfix P10 · OVR part (c)] Additively RE-STAMP the teacherIds set so a teacher who acted
  // on an INHERITED (A-stamped) attempt persists in the read surface even if the attempt
  // pre-dates the backfill (dormant unless TEACHER_IDS_WRITE_ENABLED). arrayUnion is additive —
  // it never removes an existing member and creates the field if absent; null/empty ⇒ the
  // update payload is byte-identical to today. See P10c_impl_notes U-restamp.
  const reviewTeacherIds = await computeTeacherIdsForAttempt({studentId: attempt.studentId, listId: attempt.listId ?? null, stampTeacherId: attempt.teacherId});
  await attemptRef.update({
    answers: updatedAnswers, score: newScore, passed: newPassed,
    ...(reviewTeacherIds && reviewTeacherIds.length ?
      {teacherIds: FieldValue.arrayUnion(...reviewTeacherIds)} : {}),
  });

  // challenges.history + study_states PASSED (db.js:2810-2843).
  const studentId = attempt.studentId;
  let advanceResult = null;
  const studentRef = db.collection("users").doc(studentId);
  const studentSnap = await studentRef.get();
  if (studentSnap.exists) {
    const challengeHistory = studentSnap.data().challenges?.history || [];
    const updatedHistory = challengeHistory.map((entry) =>
      (entry.attemptId === attemptId && entry.wordId === wordId) ?
        {...entry, status: accepted ? "accepted" : "rejected"} :
        entry);
    await studentRef.update({"challenges.history": updatedHistory});

    if (accepted) {
      const studyStateRef = db.doc(`users/${studentId}/study_states/${wordId}`);
      await studyStateRef.set({
        status: "PASSED",
        lastTestedAt: FieldValue.serverTimestamp(),
      }, {merge: true});

      // Day-advance (db.js:2845-2939) → the SHARED clamped + phase-gated helper.
      // phase + listId derived from testId EXACTLY as the client did (db.js:2846-2852);
      // the day-advance threshold/pace come from the testId-list's assignment, re-fetched
      // as the client does (db.js:2872-2877 — may differ from the score-recompute list).
      const testId = attempt.testId || "";
      const testIdParts = testId.split("_");
      const phase = testIdParts[testIdParts.length - 1];
      if ((phase === "new" || phase === "review") && attempt.classId) {
        const listId = testIdParts.length >= 4 ? testIdParts[testIdParts.length - 2] : null;
        if (listId) {
          const classDoc = await db.collection("classes").doc(attempt.classId).get();
          const advAssignment = classDoc.exists ? (classDoc.data().assignments?.[listId] ?? null) : null;
          const advThreshold = advAssignment?.passThreshold || DEFAULT_PASS_THRESHOLD;
          // Only a below→at/above transition progresses the day (db.js:2882 parity).
          if (previousScore < advThreshold && newScore >= advThreshold) {
            let totalListWords = null;
            try {
              const listSnap = await db.collection("lists").doc(listId).get();
              totalListWords = listSnap.exists ? (listSnap.data().wordCount || 0) : null;
            } catch (_) {
              totalListWords = null;
            }
            const cycling = (await resolveEffectiveCyclingServer(studentId, listId)).enabled;
            advanceResult = await runChallengeDayAdvanceTxn({
              attempt, assignment: advAssignment, phase, studentId, classId: attempt.classId, listId,
              newScore, totalListWords, cycling,
            });
          }
        }
      }
    }
  }

  await logSystemEventServer("challenge_reviewed", {
    teacherId: callerId, userId: studentId, attemptId, wordId, accepted,
    previousScore, newScore, newPassed, authzVia: authz.via, advance: advanceResult,
  }, "info");
  return {success: true, score: newScore, passed: newPassed, advance: advanceResult};
});

/**
 * overrideAttempt({attemptId?, studentId, classId, listId, studyDay, score})
 *
 * The in-product manual-pass — a server-authorized teacher writes a VALID reconciliation
 * anchor (nwsi/nwei/wordsIntroduced/testId — the CLAUDE.md anchor rule) so the day
 * advances, exactly as CS does by hand with scripts/cs/manual-pass.mjs. This is the path
 * for the case with NO challengeable answer (grader false-negative on the whole attempt,
 * teacherId:null orphans) — a superset of reviewChallenge (§4).
 *
 * Semantics (U2): ALWAYS writes a FRESH valid-anchor `new` attempt at the deterministic
 * manual-pass docId (idempotent merge) — the manual-pass model — regardless of whether an
 * existing attempt is named. `attemptId` (optional) is used ONLY to authorize precisely
 * against the real attempt's stamp; the fresh anchor is still written. (Alternative:
 * repair an existing attempt in place — deferred, see P10_impl_notes U2.)
 *
 * Authz = the I-10 §6 UNION (assertOverrideAuthz). For the teacherId:null orphan (no real
 * attempt to stamp-match), leg (ii) current-enrollment ownership decides.
 * Audit-logs `teacher_override` with actor/target/before/after (§1(a)).
 */
const overrideAttempt = onCall({enforceAppCheck: false}, async (request) => {
  if (!SERVER_OVERRIDE_ENABLED) {
    throw new HttpsError("failed-precondition", "overrideAttempt is not enabled (SERVER_OVERRIDE_ENABLED=false)");
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const callerId = request.auth.uid;
  const {attemptId, studentId, classId, listId, studyDay, score} = request.data || {};
  // `score` is the ONLY unconditionally-required input (the pass decision). The write
  // TARGET (studentId/classId/listId/studyDay) is resolved + authorized per path below.
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    throw new HttpsError("invalid-argument", "score (0-100) is required");
  }
  const db = getDb();

  // [Codex P10-1] TARGET-BIND the authorization to the EXACT write target — the override
  // writes a reconciliation-AUTHORITATIVE anchor and the Admin SDK bypasses rules, so the
  // authorized subject MUST equal the written subject. Two paths:
  let tStudentId; let tClassId; let tListId; let tStudyDay;
  let priorAttempt = null;
  let authzVia;
  if (attemptId && typeof attemptId === "string") {
    // (1) attemptId path — RE-ANCHOR the loaded attempt's OWN day. The write target is
    //     derived FROM the loaded attempt, never from the request; any request target field
    //     that conflicts hard-rejects (no authorize-X-write-Y). Authz is then the
    //     reviewChallenge union applied to the loaded attempt (stamp OR current-enrollment),
    //     which Codex accepted as target-bound.
    const priorSnap = await db.collection("attempts").doc(attemptId).get();
    if (!priorSnap.exists) throw new HttpsError("not-found", "Attempt not found.");
    priorAttempt = priorSnap.data();
    tStudentId = priorAttempt.studentId;
    tClassId = priorAttempt.classId;
    tListId = priorAttempt.listId ?? null;
    if (!tListId && typeof priorAttempt.testId === "string") {
      const parts = priorAttempt.testId.split("_");
      tListId = parts.length >= 4 ? parts[parts.length - 2] : null;
    }
    tStudyDay = priorAttempt.studyDay;
    if (!tStudentId || !tClassId || !tListId || !Number.isInteger(tStudyDay)) {
      throw new HttpsError("invalid-argument", "Attempt is missing target fields (studentId/classId/listId/studyDay) — use the no-attemptId override path.");
    }
    if ((studentId && studentId !== tStudentId) ||
        (classId && classId !== tClassId) ||
        (listId && listId !== tListId) ||
        (Number.isInteger(studyDay) && studyDay !== tStudyDay)) {
      throw new HttpsError("invalid-argument", "Request target fields conflict with the attempt being overridden.");
    }
    authzVia = (await assertOverrideAuthz(callerId, priorAttempt)).via;
  } else {
    // (2) no-attemptId path (the teacherId:null / ungradeable orphan — the override's reason
    //     to exist). No loaded attempt to bind to, so authorize the EXACT supplied target
    //     with the STRICT dedicated check (own THIS class, student enrolled in THIS class,
    //     class assigns THIS list) — NOT the "owns any enrolled class" union leg (P10-1).
    if (!studentId || typeof studentId !== "string") {
      throw new HttpsError("invalid-argument", "studentId is required");
    }
    if (!classId || typeof classId !== "string") {
      throw new HttpsError("invalid-argument", "classId is required");
    }
    if (!listId || typeof listId !== "string") {
      throw new HttpsError("invalid-argument", "listId is required");
    }
    if (!Number.isInteger(studyDay) || studyDay < 1) {
      throw new HttpsError("invalid-argument", "studyDay (integer >= 1) is required");
    }
    tStudentId = studentId; tClassId = classId; tListId = listId; tStudyDay = studyDay;
    authzVia = (await assertOverrideTargetAuthz(callerId, {studentId: tStudentId, classId: tClassId, listId: tListId})).via;
  }

  // Build the VALID reconciliation anchor for the TARGET-BOUND (tStudentId/tClassId/tListId/
  // tStudyDay) subject — scripts/cs/manual-pass.mjs parity (payload field set verbatim).
  // Derive pace from the student's day-1 passed-new attempt for this class (else the 80/day
  // cohort default), exactly as the script does (manual-pass.mjs:37-40).
  const classSnap = await db.collection("classes").doc(tClassId).get();
  const classData = classSnap.exists ? (classSnap.data() || {}) : {};
  const assignment = classData.assignments?.[tListId] ?? null;
  const teacherId = classData.ownerTeacherId || null;
  // F-5: read list size + EFFECTIVE cross-class cycling ONCE, BEFORE deriving the
  // anchor range, so the anchor can be clamped to the list end (below) and the
  // same values feed the day-advance (reused, not re-read).
  let totalListWords = null;
  try {
    const listSnap = await db.collection("lists").doc(tListId).get();
    totalListWords = listSnap.exists ? (listSnap.data().wordCount || 0) : null;
  } catch (_) {
    totalListWords = null;
  }
  const cycling = (await resolveEffectiveCyclingServer(tStudentId, tListId)).enabled;
  const attemptsSnap = await db.collection("attempts").where("studentId", "==", tStudentId).get();
  const day1 = attemptsSnap.docs
    .map((d) => d.data())
    // F-5: match the target LIST as well as the class (deterministic — the old
    // class-only match could pick a day-1 anchor from a DIFFERENT list under the
    // same class and derive a wrong pace).
    .find((a) => a.sessionType === "new" && a.passed === true &&
      a.classId === tClassId && a.listId === tListId &&
      a.studyDay === 1 && Number.isInteger(a.newWordEndIndex));
  const pace = day1 ? day1.newWordEndIndex + 1 : 80;
  let newWordStartIndex = (tStudyDay - 1) * pace;
  let newWordEndIndex = tStudyDay * pace - 1;
  // F-5: NO forward-jump past the list size. On a NON-cycling list, clamp the
  // anchor's end to totalListWords−1 so the reconciliation twi (= nwei+1) can
  // never exceed the list (the "twi 400 on a 300-word list" forgery). Also clamp
  // the start so wordsIntroduced never goes negative when the whole segment is
  // past the list end. Under cycling the virtual index legitimately climbs past
  // the list each lap → do NOT clamp (parity with the M4/allocation lap logic).
  if (!cycling && Number.isInteger(totalListWords) && totalListWords > 0) {
    newWordEndIndex = Math.min(newWordEndIndex, totalListWords - 1);
    newWordStartIndex = Math.min(newWordStartIndex, newWordEndIndex);
  }
  // manual-pass.mjs:53 uses the assignment passThreshold with a 92 default (NOT the app's
  // 95 — flagged in P10_impl_notes U-note as a manual-pass parity carry).
  const passThreshold = assignment?.passThreshold ?? 92;
  const passed = score >= passThreshold;
  const docId = `${tStudentId}_${tClassId}_${tListId}_day${tStudyDay}_typed_new_manual`;
  // [deepfix P10 · OVR part (c)] Additive teacherIds denormalization on the fresh anchor
  // (dormant unless TEACHER_IDS_WRITE_ENABLED). Null ⇒ field omitted ⇒ byte-identical anchor.
  const anchorTeacherIds = await computeTeacherIdsForAttempt({studentId: tStudentId, listId: tListId, stampTeacherId: teacherId});
  const anchor = {
    studentId: tStudentId, classId: tClassId, listId: tListId, teacherId,
    ...(anchorTeacherIds ? {teacherIds: anchorTeacherIds} : {}),
    testId: `vocaboost_test_${tClassId}_${tListId}_new`,
    sessionType: "new", testType: "typed", studyDay: tStudyDay,
    score, passed, graded: true,
    newWordStartIndex, newWordEndIndex, wordsIntroduced: newWordEndIndex - newWordStartIndex + 1,
    isFirstDay: tStudyDay === 1, totalQuestions: 30, answers: [], skipped: 0,
    interventionLevel: 0, wordsReviewed: 0, segmentStartIndex: 0, segmentEndIndex: 0,
    credibility: 1, retention: 1,
    manualOverride: true,
    manualReviewNote: `Teacher override (${new Date().toISOString().slice(0, 10)}) — valid anchor written by overrideAttempt (in-product manual-pass, caller ${callerId})`,
    submittedAt: Timestamp.now(),
  };
  await db.collection("attempts").doc(docId).set(anchor, {merge: true});

  // Advance the day via the SAME clamped + phase-gated primitive reviewChallenge /
  // advanceForChallenge use (the anchor is a fresh 'new' pass). BEST-EFFORT: the helper's
  // current-boundary guard may no-op — the anchor still reconciles at next entry
  // (twi = newWordEndIndex + 1, the manual-pass behaviour), so the override never DEPENDS
  // on the day-advance succeeding.
  let advanceResult = null;
  if (passed) {
    // Reuse the list size + effective cycling resolved above (F-5) — same values,
    // no second read.
    advanceResult = await runChallengeDayAdvanceTxn({
      attempt: anchor, assignment, phase: "new", studentId: tStudentId, classId: tClassId, listId: tListId,
      newScore: score, totalListWords, cycling,
    });
  }

  // Audit-log the override (actor / target / before / after) — §1(a).
  await logSystemEventServer("teacher_override", {
    teacherId: callerId, userId: tStudentId, classId: tClassId, listId: tListId, studyDay: tStudyDay,
    attemptId: attemptId || null, docId, authzVia,
    before: priorAttempt ? {score: priorAttempt.score ?? null, passed: priorAttempt.passed ?? null} : null,
    after: {score, passed, newWordStartIndex, newWordEndIndex, pace},
    advance: advanceResult,
  }, "info");
  return {success: true, docId, passed, newWordStartIndex, newWordEndIndex, advance: advanceResult};
});

module.exports = {
  // callables (re-exported by index.js so they deploy as functions)
  completeSession,
  resolveListProgress,
  resetProgress,
  advanceForChallenge,
  // deepfix P10 · OVR — the override + full-review callables (DORMANT).
  reviewChallenge,
  overrideAttempt,
  // hooks/helpers consumed by index.js
  validateAttemptAnchorShadow,
  writeUpgradedReviewMarker,
  deriveDayAnchorRange,
  // CS PR-2 · F3 — the additive review-engagement stamp helper (dormant unless
  // REVIEW_ENGAGEMENT_STAMP_ENABLED); consumed by writeAttemptTxn in index.js.
  computeReviewEngagementStamp,
  // deepfix P10 · OVR part (c) — the teacherIds denormalization helper (dormant unless
  // TEACHER_IDS_WRITE_ENABLED); consumed by writeAttemptTxn in index.js.
  computeTeacherIdsForAttempt,
  FOUNDATION_FLAGS,
  // Codex P4-plan gate: expose the server grandfather epoch so the deployed `version` probe proves the
  // LIVE bundle's epoch (not just the tree) matches the client BEFORE the P4 client cutover push.
  FORCED_PATHWAY_GRANDFATHER_EPOCH_MS,
};
