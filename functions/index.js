/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {FieldValue, Timestamp} = require("firebase-admin/firestore");
const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk").default;
const {buildTestResult} = require("./scoring");

admin.initializeApp();
const db = admin.firestore();

// deepfix P3 · FND-1 (FIX_PLAN.md P3): the additive foundation server surface
// (completeSession / resolveListProgress / resetProgress / advanceForChallenge
// + the M4 shadow validator + the W2-upgraded marker helper). ALL of it is
// dormant behind server flags inside foundation.js (see FOUNDATION_FLAGS in
// the `version` probe below). Required AFTER initializeApp (it uses a lazy
// firestore handle either way).
const foundation = require("./foundation");

// Build provenance (deploy-provenance fix — see NEED_TO_FIX.md). buildInfo.json is stamped
// at deploy time by scripts/stamp-build.mjs (firebase.json predeploy). Logged on every cold
// start and exposed via the `version` callable so we can confirm WHICH commit + flags are
// actually live vs the repo — the 2026-06-29 grader incident (prod ran a stale artifact for
// months) was undetectable precisely because there was no live-version signal.
let BUILD_INFO = {sha: "unknown", shortSha: "unknown", branch: "unknown", dirty: null, builtAt: "unknown"};
try {
  BUILD_INFO = require("./buildInfo.json");
} catch (_) {
  // Not stamped (local emulator / direct run without predeploy) — leave defaults.
}
logger.info("cold start", {build: BUILD_INFO});

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Define secret for Anthropic API key
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// G2 (PLAN_server_authoritative_grading.md): HMAC secret binding an AI-graded typed result
// to its attempt, so the write-failed-after-grade retry (via submitVocabAttempt) can persist
// the SERVER-graded isCorrect without re-trusting client values. Set in Secret Manager.
const gradeTokenSecret = defineSecret("GRADE_TOKEN_SECRET");
// Enforcement is STAGED OFF: when false, submitVocabAttempt behaves exactly as today for typed
// (no rejection, no trusted marker) — the token mint/verify plumbing ships dormant. Flip true
// only after the fn + client token-threading are deployed + validated (own Codex pass first).
const GRADE_TOKEN_ENFORCED = false;  // deepfix P0 (G1 disarm, 2026-07-13): DISARMED to match LIVE prod, which
// runs false (F-9: recent 26SM attempts write correctnessSource:null ⇒ enforcement off). HEAD had carried `true`
// (committed 4b82a0a, BEFORE the 06-29 mass-save outage; prod's false was never committed back), so deploying
// functions as-is would RE-ARM the 06-29 outage — the localStorage-nonce → grade/save docId divergence
// (testRecovery.js:98-111) is still UNPATCHED. RE-ARM (→ true) ONLY in the same review as the validated nonce fix
// (FIX_PLAN.md P4 legs F1-F3: server-echoed attemptDocId + memoized nonce) + the F5 acceptance. See
// audit/deepfix/task2/FIX_PLAN.md P0 + inv_I5_deploy_gate.md.
// GRADE_TOKEN_MINT: gates whether gradeTypedTest actually mints tokens (touches GRADE_TOKEN_SECRET).
// Default OFF so deploying this code does NOT add a live-grading dependency on the secret (Codex):
// with both flags off, typed grading never calls gradeTokenSecret.value(), so a missing/misconfigured
// secret cannot break grading. Rollout: create GRADE_TOKEN_SECRET → flip GRADE_TOKEN_MINT (tokens flow,
// validate round-trip, still no enforcement/marker) → flip GRADE_TOKEN_ENFORCED (verify+stamp+overwrite).
// Enforcement implies minting (mintTokens = MINT || ENFORCED) so the two can't desync into rejection.
const GRADE_TOKEN_MINT = false;  // deepfix (2026-07-15): DISARMED to match LIVE prod — David disabled MINT.
// The tree carried `true` ("on for validation"); deploying that would RE-ENABLE minting on prod (adds a live
// gradeTokenSecret.value() dependency + an extra response field). With BOTH GRADE_TOKEN flags false, typed
// grading never touches GRADE_TOKEN_SECRET (fully dormant, byte-equivalent to prod). Flip true only per the
// documented rollout: create GRADE_TOKEN_SECRET → flip GRADE_TOKEN_MINT (validate round-trip) → flip ENFORCED.
const GRADE_TOKEN_VERSION = 1;

// ============================================================================
// GRADING RECOVERY SLICE (Phase 1a of PLAN_grading_idempotent_concurrency.md §3.2/§3.7)
// SCOPE: lost-response / same-attempt idempotency ONLY. NOT the full concurrency model.
//   - Keyed off the attemptDocId the client ALREADY sends (nonce identity) → it dedups
//     RETRIES of the SAME attempt, NOT two devices (different nonces still grade twice).
//   - NO attempt-identity change, NO side-effect move (both = Phase 2, which needs the
//     deterministic logical identity + immutable submissions + outcome pointer + W3 lockdown).
//   - Cross-device dedup ("multiple attempts shoved into the cloud") is explicitly Phase 2.
// Grading runs OUTSIDE any transaction; the job does a tiny claim + result-cache so a
// lost/duplicate grade call returns the cached grade instead of re-grading or surfacing a
// false "Grading Failed". Crash-safe via lease + fencing (claimed→graded, leaseId rotates
// on takeover; a superseded/expired worker is rejected and the caller throws `aborted`).
// ============================================================================
// Kill-switch: flip false + redeploy → byte-for-byte pre-Phase-1 behavior
// (same pattern as GRADE_TOKEN_*; the const IS the kill-switch). Default ON per
// owner direction — new path is live for all cohorts on deploy; validate
// immediately (Playwright) with rollback ready.
const GRADE_JOB_ENABLED = true;
// Lease MUST exceed the max grading duration (Recheck-5): a normal grade must
// finish + persist before its lease expires, else a non-stalled worker is
// fencing-rejected. gradeTypedTest grades in seconds; the client waits 120s.
// 180s gives generous headroom over any realistic AI latency.
const GRADE_JOB_LEASE_MS = 180000;
const GRADE_JOB_VERSION = 1;

/**
 * Canonical, normalized serialization of the signed grade artifact (G2). Order-independent
 * (rows sorted by wordId) so reordering can't break it; only the grade-bearing subset is signed
 * (display/gradebook fields like word/correctAnswer are server-reconstructed on retry, not signed).
 */
function canonicalGradeArtifact(a) {
  const rows = (a.rows || [])
    .map((r) => ({
      wordId: String(r.wordId ?? ""),
      studentResponse: (r.studentResponse ?? "").toString(),
      isCorrect: !!(r.isCorrect ?? r.correct),
      aiReasoning: (r.aiReasoning ?? r.reasoning ?? "").toString(),
    }))
    .sort((x, y) => (x.wordId < y.wordId ? -1 : x.wordId > y.wordId ? 1 : 0));
  return JSON.stringify({
    v: GRADE_TOKEN_VERSION,
    uid: a.uid,
    attemptDocId: a.attemptDocId,
    classId: a.classId ?? null,
    listId: a.listId ?? null,
    testId: a.testId ?? null,
    testType: a.testType ?? null,
    totalQuestions: a.totalQuestions ?? null,
    createdAt: a.createdAt,
    rows,
  });
}
function signGradeArtifact(secret, artifact) {
  return crypto.createHmac("sha256", secret).update(canonicalGradeArtifact(artifact)).digest("hex");
}
// Constant-time compare; returns true iff the presented token matches the recomputed one.
function verifyGradeToken(secret, artifact, presentedToken) {
  if (!presentedToken || typeof presentedToken !== "string") return false;
  const expected = signGradeArtifact(secret, artifact);
  const a = Buffer.from(expected);
  const b = Buffer.from(presentedToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Checks if a student response is effectively blank (no real answer).
 */
function isBlankResponse(response) {
  if (!response) return true;
  const trimmed = response.trim();
  if (trimmed === "") return true;
  if (/^[?.!,\-]+$/.test(trimmed)) return true;
  return false;
}

/**
 * Checks if a student response is self-referencing (just repeating the word).
 */
function isSelfReferencing(studentResponse, word) {
  const response = (studentResponse || "").trim().toLowerCase();
  const w = (word || "").trim().toLowerCase();
  if (!response || !w) return false;
  return (
    response === w ||
    response === w + "s" ||
    response === w + "ed" ||
    response === w + "ing" ||
    response === w + "ly"
  );
}

/**
 * True if `response` is merely an inflected/derived ENGLISH form of the target
 * `word` (run→running, candid→candidly, study→studied, big→bigger) — i.e. the
 * student rewrote the word itself in another form and supplied NO meaning, so it
 * is WRONG.
 *
 * Deliberately ASCII-only: a Korean/Chinese answer — even in a different part of
 * speech (impoverish→가난한 "poor") — is a real translated meaning, not an
 * inflection, and must NOT be caught here (the rubric keeps it CORRECT). Handles
 * the common spelling changes (consonant doubling, drop-e, y→i) so irregular
 * surface forms like run→running are still recognized.
 */
function isInflectionOfWord(studentResponse, word) {
  const r = (studentResponse || "").trim().toLowerCase();
  const w = (word || "").trim().toLowerCase();
  if (!r || !w || r === w) return false;
  // Only single-token Latin responses can be an English inflection of the word.
  if (!/^[a-z]+$/.test(r)) return false;
  if (r.length <= w.length) return false; // an inflection is longer than its stem

  const forms = new Set();
  const SUF = [
    "s", "es", "ed", "d", "ing", "ly", "er", "est", "ier", "iest",
    "ion", "ation", "ness", "ment", "ful", "less", "able", "ible", "ity",
  ];
  for (const suf of SUF) forms.add(w + suf);

  const last = w[w.length - 1];
  // Consonant doubling: run→running, big→bigger.
  if (w.length >= 2 && /[bcdfghjklmnpqrstvwxz]/.test(last)) {
    for (const suf of ["ing", "ed", "er", "est"]) forms.add(w + last + suf);
  }
  // Drop trailing 'e': make→making, use→used, large→larger.
  if (last === "e") {
    const stem = w.slice(0, -1);
    for (const suf of ["ing", "ed", "er", "est", "able", "ion", "ation", "y"]) {
      forms.add(stem + suf);
    }
  }
  // y→i: carry→carried/carries, happy→happier, lucky→luckily.
  if (last === "y") {
    const stem = w.slice(0, -1);
    for (const suf of ["ied", "ies", "ier", "iest", "ily", "iness"]) {
      forms.add(stem + suf);
    }
  }
  return forms.has(r);
}

// ============================================================================
// Server-side attempt write (Phase 1 — see PLAN_server_side_attempt_write_v2.md §13)
// Moves the durable `attempts` write into Cloud Functions so a grade is never
// lost when the client drops after grading. Backward-compatible: only engaged
// when the client passes `writeContext`.
// ============================================================================

/**
 * Normalize a stored attempt doc into the client API result shape.
 * Stored `answers` rows use `aiReasoning` (typed) / `correct` (mcq); the client
 * consumer (TestResults) expects `{ wordId, isCorrect, reasoning }`.
 */
function normalizeExistingAttempt(snap) {
  const d = snap.data();
  const rows = Array.isArray(d.answers) ? d.answers : [];
  return {
    results: rows.map((a) => ({
      wordId: a.wordId,
      isCorrect: a.isCorrect ?? a.correct ?? false,
      reasoning: a.aiReasoning ?? a.reasoning ?? "",
    })),
    score: d.score,
    passed: d.passed,
    attemptId: snap.id,
    alreadyWritten: true,
  };
}

/**
 * Ownership-checked existing-attempt lookup (§Codex). Guards the pre-AI /
 * idempotency return so a guessed attemptDocId can't leak another student's
 * attempt. Returns the snapshot if it belongs to this user + matches context,
 * null if absent, throws HttpsError on ownership/context mismatch.
 */
async function readExistingAttemptForContext(uid, ctx) {
  if (!ctx || !ctx.attemptDocId) return null;
  const snap = await db.collection("attempts").doc(ctx.attemptDocId).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (d.studentId !== uid) {
    throw new HttpsError("permission-denied", "Attempt belongs to another user");
  }
  if (
    (ctx.classId && d.classId && d.classId !== ctx.classId) ||
    (ctx.listId && d.listId && d.listId !== ctx.listId) ||
    (ctx.testType && d.testType && d.testType !== ctx.testType) ||
    (ctx.sessionType && d.sessionType && d.sessionType !== ctx.sessionType)
  ) {
    throw new HttpsError("failed-precondition", "Attempt id reused across a different context");
  }
  return snap;
}

/**
 * Authorize a student to write an attempt for (classId, listId): validates the
 * context shape, ownership, enrollment (class.studentIds OR users/{uid}.enrolledClasses),
 * and list entitlement using a THREE-STATE check — the list must be either assigned to
 * the class, OR (if unassigned) present in KNOWN_ORPHAN_WRITES, a static server-trusted
 * allowlist of confirmed orphan tuples (teacher unassigned a list mid-progress). Throws
 * HttpsError when the student is not enrolled or the list is neither assigned nor allow-
 * listed. We do NOT query client-writable evidence (class_progress / attempts) here: those
 * are forgeable by an enrolled student (firestore.rules), so a live query would let anyone
 * mint their own "orphan" proof. Factored out of writeAttemptTxn so callers can authorize
 * BEFORE issuing any other Admin-SDK reads (e.g. sanitizeStoredRows) — Admin SDK bypasses
 * Firestore rules, so gating reads behind this prevents forcing reads on arbitrary lists.
 * Returns { classData, passThreshold, teacherId, assigned, orphanReason } for reuse so
 * callers (writeAttemptTxn) can skip a duplicate authorization read.
 */
// Static, server-trusted allowlist of (uid|classId|listId) tuples permitted to write to a
// list their class no longer assigns. Built from a full-collection census of `attempts`
// (2026-06-23): exactly these students were mid-progress when their list was unassigned.
// Client-writable evidence is forgeable, so this hardcoded set is the ONLY orphan signal we
// trust. Remove entries once these students finish/are reassigned; replace with a
// server-owned assignment-history model long-term.
const KNOWN_ORPHAN_WRITES = new Set([
  "W3MUFXDbzogBuj4ZfbtkRHeO8PG2|teKHajONWBMe0YJSAeGl|7Is5UdS4P4a12vc6mSnp",
  "fc8sBxnzARfKWDMQevma1J3OjNq2|teKHajONWBMe0YJSAeGl|7Is5UdS4P4a12vc6mSnp",
]);

async function assertCanWriteAttempt(uid, ctx) {
  if (!ctx) throw new HttpsError("invalid-argument", "writeContext required");
  if (uid !== ctx.studentId) {
    throw new HttpsError("permission-denied", "uid does not match studentId");
  }
  for (const f of ["classId", "listId", "attemptDocId", "testType", "sessionType"]) {
    if (!ctx[f]) throw new HttpsError("invalid-argument", `writeContext.${f} required`);
  }
  const classSnap = await db.collection("classes").doc(ctx.classId).get();
  if (!classSnap.exists) throw new HttpsError("not-found", "Class not found");
  const classData = classSnap.data();
  const enrolled =
    (Array.isArray(classData.studentIds) && classData.studentIds.includes(uid));
  if (!enrolled) {
    const userSnap = await db.collection("users").doc(uid).get();
    const ec = userSnap.exists ? (userSnap.data().enrolledClasses || {}) : {};
    if (!ec[ctx.classId]) {
      throw new HttpsError("permission-denied", "Student not enrolled in class");
    }
  }
  // Three-state list authorization (Codex):
  //   assigned       → list is in the class's `assignments` map OR legacy `assignedLists`.
  //   known orphan   → NOT assigned, but the exact (uid|classId|listId) tuple is in the
  //                    static server-trusted KNOWN_ORPHAN_WRITES allowlist (teacher unassigned
  //                    the list mid-progress). NOT inferred from client-writable docs.
  //   neither        → rejected with failed-precondition BEFORE any sanitize/backfill reads.
  // This closes the "force reads / write for an arbitrary listId" path while not breaking the
  // confirmed orphaned students. Enrollment (checked above) still bounds who can write.
  const assignments = classData.assignments || {};
  const assignment = assignments[ctx.listId];
  const legacyAssigned =
    Array.isArray(classData.assignedLists) && classData.assignedLists.includes(ctx.listId);
  const assigned = !!assignment || legacyAssigned;

  let orphanReason = null;
  if (!assigned) {
    // Unassigned list: only a hardcoded, server-trusted allowlist entry passes (NOT a live
    // query — that evidence is client-forgeable). Everything else is rejected before reads.
    if (KNOWN_ORPHAN_WRITES.has(`${uid}|${ctx.classId}|${ctx.listId}`)) {
      orphanReason = "known_orphan_allowlist";
      logger.warn("unassigned_attempt_allowed", {
        uid, classId: ctx.classId, listId: ctx.listId, orphanReason,
      });
    } else {
      throw new HttpsError("failed-precondition", "List is not assigned to this class");
    }
  }

  const passThreshold = assignment?.passThreshold ?? 95; // 0-100
  if (!assignment) {
    // No assignment → threshold defaulted to 95. For a `new` test this can mark an orphan
    // failed if the original assignment threshold was lower (no server-side source for it).
    logger.warn("passThresholdFallback", {
      uid, classId: ctx.classId, listId: ctx.listId, passThreshold, orphanReason,
    });
  }
  const teacherId = classData.ownerTeacherId || null;
  return {classData, passThreshold, teacherId, assigned, orphanReason};
}

/**
 * CS PR-2 · WI-4 (I6) — drop duplicate wordId rows (first occurrence wins), the server analog
 * of the client RECOVERY_GUARD's intersect-with-membership. Rows without a wordId are kept as-is
 * (they cannot be de-duplicated and are not the >100% signature). Pure; used only under the
 * RECOVERY_SCORE_CLAMP_ENABLED gate.
 */
function dedupeByWordId(rows) {
  if (!Array.isArray(rows)) return rows;
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const id = r?.wordId;
    if (id != null) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(r);
  }
  return out;
}

/**
 * The single server-side attempt writer. Transactional + idempotent on the
 * client-supplied deterministic `ctx.attemptDocId`. Computes score server-side
 * against ctx.totalQuestions (NOT answered count — skipped count as incorrect),
 * applies the review-always-passes rule, echoes the client anchor, and refuses
 * to write an invalid new-word anchor.
 *
 * @param {string} uid
 * @param {Object} ctx - { studentId, classId, listId, testId, studyDay, sessionType,
 *   testType, attemptDocId, totalQuestions, newWordStartIndex, newWordEndIndex,
 *   wordsIntroduced, segment*, interventionLevel, isFirstDay, listTitle, wordsReviewed }
 * @param {Array} attemptAnswers - full answer rows (typed: isCorrect/aiReasoning; mcq: correct)
 */
async function writeAttemptTxn(uid, ctx, attemptAnswers, auth, opts) {
  // Validate shape + ownership + enrollment + list entitlement. submitVocabAttempt already
  // authorized (before sanitize) and passes the result through to avoid a duplicate read;
  // any other caller (or none) falls back to authorizing here. Self-contained either way.
  const authRes = auth || await assertCanWriteAttempt(uid, ctx);
  const {passThreshold, teacherId} = authRes;

  // deepfix P3 change 6 — M4 anchor validation (I-6 §1.2 #4): assert the client-echoed
  // anchor (newWordStartIndex/EndIndex/wordsIntroduced/studyDay) against SERVER state.
  // Covers both live writers (submitVocabAttempt + gradeTypedTest direct-write — F-9: 96%
  // of live attempts flow here). SHADOW (ANCHOR_VALIDATION_SHADOW): LOG-ONLY
  // (`anchor_rejected`, shadow:true); internally try/caught — can NEVER affect the write.
  // ENFORCE (F-2, ANCHOR_VALIDATION_ENFORCE — P6-only, after the ≥14-day shadow soak): a
  // real violation throws here (`anchor_rejected {enforced:true}`) and ABORTS the write
  // before the transaction below. Both flags false in this draft ⇒ this call is a no-op
  // (zero reads, never throws) ⇒ byte-identical to today.
  await foundation.validateAttemptAnchorShadow(uid, ctx, authRes.classData);

  // Score against TOTAL questions presented, not answered (§Codex).
  // CS PR-2 · WI-4 (I6 server clamp): stale MCQ/typed crash-recovery answers can carry
  // DUPLICATE or out-of-range wordId rows (no membership check on the client recovery path)
  // so correctCount exceeds totalQuestions → score > 100 (the 4 historical >100% gradebook
  // docs). Under RECOVERY_SCORE_CLAMP_ENABLED, mirror the client RECOVERY_GUARD: dedupe the
  // SCORED rows by wordId (an impossible duplicate can no longer inflate the numerator) and
  // clamp correctCount∈[0,totalQuestions] / score∈[0,100]. Flag-off ⇒ the exact original
  // unclamped expressions (byte-equivalent; a clamp only removes an impossible output).
  const RECOVERY_SCORE_CLAMP = foundation.FOUNDATION_FLAGS.RECOVERY_SCORE_CLAMP_ENABLED;
  const scoredRows = RECOVERY_SCORE_CLAMP ? dedupeByWordId(attemptAnswers) : attemptAnswers;
  const rawCorrect = scoredRows.filter((a) => a.isCorrect ?? a.correct).length;
  const totalQuestions = ctx.totalQuestions ?? attemptAnswers.length;
  const skipped = Math.max(0, totalQuestions - attemptAnswers.length);
  const correctCount = RECOVERY_SCORE_CLAMP ? Math.max(0, Math.min(rawCorrect, totalQuestions)) : rawCorrect;
  const scoreFraction = totalQuestions > 0 ? correctCount / totalQuestions : 0;
  const score = RECOVERY_SCORE_CLAMP ? Math.min(100, Math.round(scoreFraction * 100)) : Math.round(scoreFraction * 100); // 0-100
  const passed = ctx.sessionType === "review" ? true : score >= passThreshold;

  // Refuse to write an invalid new-word anchor (CS-2026-06-21): a passed `new`
  // attempt is the CSD/TWI reconciliation anchor (twi = newWordEndIndex + 1).
  if (
    ctx.sessionType === "new" &&
    !(Number.isInteger(ctx.newWordEndIndex) && ctx.newWordEndIndex >= 0)
  ) {
    throw new HttpsError("invalid-argument", "Missing/invalid newWordEndIndex for a new-word attempt");
  }

  // WRITER-API GUARD (G2 §8.4, Codex-Critical): the ONE true writer structurally refuses a TYPED
  // grade-bearing write that lacks server-graded provenance — so neither the gradeTypedTest direct-write
  // path (serverGraded=false) NOR submitVocabAttempt can persist a typed grade from unresolved/client
  // definitions once enforcement is live. MCQ is exempt (correctness authority is Phase E — no marker yet).
  if (
    GRADE_TOKEN_ENFORCED &&
    ctx.testType === "typed" &&
    opts?.correctnessSource !== "server-ai"
  ) {
    throw new HttpsError("permission-denied",
      "Typed grade write requires server-graded provenance (correctnessSource:'server-ai').");
  }

  // [deepfix P10 · OVR part (c)] Additive teacherIds denormalization (the C-19 read-surface
  // widening). Computed PRE-transaction — it is a denormalized/best-effort field, NOT a
  // transactional read. Null when TEACHER_IDS_WRITE_ENABLED is off (ZERO reads) ⇒ no field is
  // added below ⇒ the written attempt doc is byte-identical to today.
  const teacherIds = await foundation.computeTeacherIdsForAttempt(
    {studentId: uid, listId: ctx.listId, stampTeacherId: teacherId});

  // CS PR-2 · F3 — ADDITIVE review-engagement stamp (answeredCount / engagedReview) so PR-3's
  // completion reader can consume the evidence without re-deriving from answers[]. Null when
  // REVIEW_ENGAGEMENT_STAMP_ENABLED is off OR the attempt is not a review ⇒ no field added ⇒
  // the written doc is byte-identical to today. NO grandfather here (PR-3 owns that).
  const engagementStamp = foundation.computeReviewEngagementStamp(ctx, attemptAnswers, totalQuestions, skipped);

  const ref = db.collection("attempts").doc(ctx.attemptDocId);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data().studentId !== uid) {
        throw new HttpsError("permission-denied", "Attempt belongs to another user");
      }
      return normalizeExistingAttempt(existing); // idempotent no-op
    }
    const attemptData = {
      studentId: uid,
      testId: ctx.testId || null,
      testType: ctx.testType,
      sessionType: ctx.sessionType,
      studyDay: ctx.studyDay ?? null,
      score, // 0-100
      passed,
      graded: true,
      answers: attemptAnswers,
      totalQuestions,
      skipped,
      retention: scoreFraction,
      // credibility: deprecated server-side (no UI consumer — PLAN §13.4); echo if client sent one.
      credibility: ctx.credibility ?? null,
      classId: ctx.classId,
      listId: ctx.listId,
      teacherId,
      ...(teacherIds ? {teacherIds} : {}), // [P10c] additive; omitted when the flag is off
      ...(engagementStamp || {}), // [CS PR-2 · F3] additive engagement evidence; omitted when the flag is off / non-review
      // Echoed session context (anchor + display) — same fields db.js submit*Attempt flattens.
      isFirstDay: ctx.isFirstDay ?? null,
      listTitle: ctx.listTitle ?? null,
      segmentStartIndex: ctx.segmentStartIndex ?? null,
      segmentEndIndex: ctx.segmentEndIndex ?? null,
      interventionLevel: ctx.interventionLevel ?? null,
      wordsIntroduced: ctx.wordsIntroduced ?? null,
      wordsReviewed: ctx.wordsReviewed ?? null,
      newWordStartIndex: ctx.newWordStartIndex ?? null,
      newWordEndIndex: ctx.newWordEndIndex ?? null,
      // G2: provenance of the correctness in `answers[]`. SERVER-set only (never from ctx/client).
      // 'server-ai' = AI-graded by gradeTypedTest (trusted). null = client-computed (MCQ) or legacy —
      // downstream (override) treats null as untrusted. No 'server-mcq' until Phase E (MCQ stays client-
      // computed; selectedOptionId is forgeable — see PLAN_server_authoritative_grading.md §1).
      correctnessSource: opts?.correctnessSource ?? null,
      submittedAt: FieldValue.serverTimestamp(),
      gradedAt: FieldValue.serverTimestamp(),
      writtenBy: "cloud-function",
    };
    tx.set(ref, attemptData);
    return {attemptId: ctx.attemptDocId, score, passed, attemptWritten: true};
  });
}

/**
 * Shared write-only callable. Used by MCQ (graded client-side) and by the
 * typed write-retry (when gradeTypedTest returned attemptWritten:false).
 * `attemptAnswers` are the FULL stored rows so the doc is reconstructable
 * without re-grading.
 */
exports.submitVocabAttempt = onCall({enforceAppCheck: false, secrets: [gradeTokenSecret]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const {context, attemptAnswers, gradeToken, gradeTokenCreatedAt} = request.data || {};
  if (!Array.isArray(attemptAnswers)) {
    throw new HttpsError("invalid-argument", "attemptAnswers must be an array");
  }
  const uid = request.auth.uid;
  // Idempotency / ownership: if already written, return it (no duplicate).
  const existing = await readExistingAttemptForContext(uid, context);
  if (existing) return normalizeExistingAttempt(existing);
  // Authorize BEFORE sanitize so its Admin-SDK word reads stay post-authorization.
  // assertCanWriteAttempt rejects an unassigned list with no orphan evidence, so reaching
  // here means the caller is entitled (assigned OR proven orphan) — safe to backfill either
  // way (orphans are exactly the old-thin-marker recovery case worth backfilling).
  const auth = await assertCanWriteAttempt(uid, context);

  // G2 — typed correctness provenance. Verify the gradeToken minted by gradeTypedTest; valid ⇒ the
  // rows' isCorrect is server-authentic (AI-graded) → stamp correctnessSource:'server-ai' and
  // RECONSTRUCT display fields (overwrite word/correctAnswer from the list, ignore client values).
  // ENFORCEMENT is staged (GRADE_TOKEN_ENFORCED): when off, behaves as today (no rejection, no marker);
  // when on, a typed write without a valid token is rejected. MCQ is unaffected (no token, no marker —
  // client-computed correctness remains a named residual until Phase E).
  let correctnessSource = null;
  let tokenOk = false;
  const GRADE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // retry should be near-immediate; 24h is generous
  if (context?.testType === "typed" && gradeToken && Number.isFinite(gradeTokenCreatedAt)) {
    // Enforce a short TTL (Codex): createdAt is signed, but must also be fresh.
    const fresh = (Date.now() - gradeTokenCreatedAt) <= GRADE_TOKEN_TTL_MS &&
      gradeTokenCreatedAt <= Date.now() + 60000; // tolerate ~1m clock skew, reject future-dated
    if (fresh) {
      try {
        tokenOk = verifyGradeToken(gradeTokenSecret.value(), {
          uid,
          attemptDocId: context.attemptDocId,
          classId: context.classId ?? null,
          listId: context.listId ?? null,
          testId: context.testId ?? null,
          testType: "typed",
          totalQuestions: context.totalQuestions ?? null,
          createdAt: gradeTokenCreatedAt,
          rows: attemptAnswers,
        }, gradeToken);
      } catch (verifyErr) {
        // Secret/verify problem → treat as unverified (tokenOk stays false). With enforcement on this
        // rejects (safe); with it off it's a no-op. Never throws past here on a secret hiccup.
        logger.error("gradeToken verify failed", {uid, error: verifyErr.message});
        tokenOk = false;
      }
    }
    // Stamp the trusted marker ONLY when enforcement is live (Codex-Medium): don't create
    // server-ai markers before the W3 rules lockdown is deployed.
    if (tokenOk && GRADE_TOKEN_ENFORCED) correctnessSource = "server-ai";
  }
  if (GRADE_TOKEN_ENFORCED && context?.testType === "typed" && !tokenOk) {
    throw new HttpsError("permission-denied",
      "Typed attempt requires a valid, fresh server grade token (re-grade and retry).");
  }
  // Backfill canonical correctAnswer for a client carrying an OLD thin recovery marker
  // (would otherwise write correctAnswer: undefined); coalesce all fields to non-undefined.
  // Token-verified typed retry → OVERWRITE display fields from Firestore (authoritative, §8.1) — but only
  // once enforcement is live, so GRADE_TOKEN_ENFORCED=false is a TRUE no-op vs. today (Codex-Medium).
  const rows = await sanitizeStoredRows(context.listId, attemptAnswers,
    {overwrite: tokenOk && GRADE_TOKEN_ENFORCED});
  // Pass the auth result through so writeAttemptTxn doesn't re-authorize (saves a duplicate
  // class-doc + orphan read per write).
  const r = await writeAttemptTxn(uid, context, rows, auth, {correctnessSource});
  return {
    results: rows.map((a) => ({
      wordId: a.wordId,
      isCorrect: a.isCorrect ?? a.correct ?? false,
      reasoning: a.aiReasoning ?? a.reasoning ?? "",
    })),
    score: r.score,
    passed: r.passed,
    attemptId: r.attemptId,
    alreadyWritten: r.alreadyWritten ?? false,
  };
});

/**
 * markReviewComplete (server-side) — PLAN_attempt_write_lockdown.md W2.
 *
 * Writes the empty-review "automarker" attempt server-side (was a client setDoc at
 * DailySessionFlow.jsx:962). Needed so that, once W3 sets attempts `create: false`, the
 * day-completion marker (CSD reconciliation counts a Day-2+ day complete only when a day-N
 * review attempt exists) is still written. Deterministic id ⇒ idempotent (re-entry can't dup).
 */
exports.markReviewComplete = onCall({enforceAppCheck: false}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid;
  const {classId, listId, dayNumber} = request.data || {};
  if (!classId || typeof classId !== "string") {
    throw new HttpsError("invalid-argument", "classId is required");
  }
  if (!listId || typeof listId !== "string") {
    throw new HttpsError("invalid-argument", "listId is required");
  }
  if (!Number.isInteger(dayNumber) || dayNumber <= 1) {
    // Matches the client guard (markers only for Day 2+; Day 1 completes via the new test).
    throw new HttpsError("invalid-argument", "dayNumber must be an integer > 1");
  }
  const markerId = `${uid}_${classId}_${listId}_day${dayNumber}_review_automarker`;
  // Enrollment/entitlement (same gate as attempt writes). assertCanWriteAttempt requires a FULL ctx
  // (studentId + attemptDocId + testType + sessionType), not just {classId,listId} (Codex-Critical:
  // the partial ctx always threw invalid-argument). Provide the marker's full shape.
  const auth = await assertCanWriteAttempt(uid, {
    studentId: uid,
    classId,
    listId,
    attemptDocId: markerId,
    testType: "mcq",
    sessionType: "review",
  });
  // deepfix P3 change 5 — W2 UPGRADED (I-6 M6 / I-2 S7; the C-14/C-34 fix): the marker
  // write is delegated to the shared foundation writer, which stamps the day's anchor
  // range (newWordStartIndex/newWordEndIndex — derived SERVER-side from the day's
  // twi-defining passed `new` attempt, never client-echoed) so it satisfies exact-range
  // pairing (db.js:3449-3450), plus a PARSEABLE testId
  // (`vocaboost_test_{classId}_{listId}_review`) so it survives the gradebook testId
  // parse (db.js:1976-1984). Same deterministic markerId + idempotency + ownership
  // semantics as before; completeSession's internal marker path uses the SAME writer,
  // so the two routes converge on one doc. This callable stays traffic-dormant until
  // the client SERVER_REVIEW_MARKER flag flips at P4 (featureFlags.js:28 = false).
  return foundation.writeUpgradedReviewMarker(uid, classId, listId, dayNumber, auth.teacherId ?? null);
});

/**
 * Server port of the client `getAvailableChallengeTokens` (db.js:177) — count
 * ACTIVE rejections only (status==='rejected' && replenishAt in the future),
 * max 5 tokens. Keep byte-parity with the client or token semantics drift.
 */
function availableChallengeTokens(challengeHistory) {
  const now = Date.now();
  const activeRejections = (challengeHistory || []).filter(
    (h) => h.status === "rejected" && (h.replenishAt?.toMillis?.() ?? 0) > now,
  ).length;
  return Math.max(0, 5 - activeRejections);
}

/**
 * submitChallenge (server-side) — replaces the client-side db.js:submitChallenge.
 *
 * Purpose (PLAN_attempt_write_lockdown.md W1 / NEED_TO_FIX #1c): make the function the
 * ONLY writer of `attempts.answers` so a student can no longer forge `answers[].isCorrect`
 * via a direct Firestore write (which `reviewChallenge` would then launder into a passing
 * score). This callable touches ONLY the challenge metadata on one answer — never `isCorrect`.
 *
 * One Admin-SDK transaction over users/{uid}.challenges.history (append) + attempts/{id}.answers[i]
 * (set challengeStatus/challengeNote). All gates (ownership, token re-check, already-pending) are
 * INSIDE the txn so a retry can't double-append history. uid is request.auth.uid (server-trusted).
 */
exports.submitChallenge = onCall({enforceAppCheck: false}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid; // SERVER-trusted; never a client-supplied uid
  const {attemptId, wordId, note} = request.data || {};
  if (!attemptId || typeof attemptId !== "string") {
    throw new HttpsError("invalid-argument", "attemptId is required");
  }
  if (!wordId || typeof wordId !== "string") {
    throw new HttpsError("invalid-argument", "wordId is required");
  }
  const cleanNote = (typeof note === "string" ? note : "").slice(0, 1000);

  const attemptRef = db.collection("attempts").doc(attemptId);
  const userRef = db.collection("users").doc(uid);
  const REPLENISH_MS = 30 * 24 * 60 * 60 * 1000;

  return db.runTransaction(async (tx) => {
    // All reads first (transaction rule).
    const [attemptSnap, userSnap] = await Promise.all([tx.get(attemptRef), tx.get(userRef)]);
    if (!attemptSnap.exists) throw new HttpsError("not-found", "Attempt not found");
    if (!userSnap.exists) throw new HttpsError("not-found", "User not found");
    const attempt = attemptSnap.data();
    if (attempt.studentId !== uid) {
      throw new HttpsError("permission-denied", "This is not your attempt");
    }
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const idx = answers.findIndex((a) => a.wordId === wordId);
    if (idx === -1) throw new HttpsError("not-found", "Answer not found in attempt");
    // Idempotency: already pending → no-op success (a retry can't double-append history).
    if (answers[idx].challengeStatus === "pending") {
      return {success: true, alreadyPending: true};
    }
    // Server-side token re-check (matches client getAvailableChallengeTokens).
    const history = userSnap.data().challenges?.history || [];
    if (availableChallengeTokens(history) <= 0) {
      throw new HttpsError("failed-precondition", "No challenge tokens available");
    }
    const now = Timestamp.now();
    const replenishAt = Timestamp.fromMillis(now.toMillis() + REPLENISH_MS);
    // Write A: challenge metadata on the one answer ONLY (never isCorrect/score/passed).
    const updatedAnswers = answers.slice();
    updatedAnswers[idx] = {
      ...updatedAnswers[idx],
      challengeStatus: "pending",
      challengeNote: cleanNote || null,
    };
    tx.update(attemptRef, {answers: updatedAnswers});
    // Write B: append the challenge-history entry (same shape as the old client write).
    const entry = {attemptId, wordId, challengedAt: now, replenishAt, status: "pending"};
    tx.update(userRef, {"challenges.history": [...history, entry]});
    return {success: true, availableTokens: availableChallengeTokens(history) - 1};
  });
});

/**
 * Build the full typed attempt rows by merging the input answers (word,
 * correctDefinition, studentResponse) with grading results (isCorrect,
 * reasoning). Input `correctDefinition` → stored `correctAnswer`.
 */
function buildTypedAttemptAnswers(answers, gradeResults) {
  return answers.map((a) => {
    const g = gradeResults.find((r) => r.wordId === a.wordId) || {};
    return {
      wordId: a.wordId,
      // Coalesce every stored field to non-undefined: a softened/partial batch (or a
      // client that dropped definitions) must never write `undefined` into Firestore.
      word: a.word || "",
      correctAnswer: a.correctDefinition || "",
      studentResponse: a.studentResponse || "",
      isCorrect: g.isCorrect ?? false,
      aiReasoning: g.reasoning || "",
      challengeStatus: null,
      challengeNote: null,
      challengeReviewedBy: null,
      challengeReviewedAt: null,
    };
  });
}

/**
 * Server-authoritative answer key: resolve canonical `correctDefinition`/`koreanDefinition`
 * for each answer from Firestore by (listId, wordId). Fixes the "client thinned the word pool
 * (crash-recovery marker) → correctDefinition missing" malform AND removes the grading-integrity
 * hole of trusting a client-supplied answer key. Client values are fallback-only (unresolved
 * word / missing listId). One batched getAll(≤100 refs). Caller must authorize listId first.
 */
// Returns {answers, allResolved}. allResolved is true ONLY if every wordId was resolved from
// Firestore (so the correctDefinition is server-authoritative for ALL rows). Callers that mint a
// trust token (G2) require allResolved — an unresolved row keeps the client-supplied definition,
// which must NOT be certifiable (Codex: gradeToken could otherwise certify a forged answer key).
async function resolveAnswerDefinitions(listId, answers) {
  if (!listId) return {answers, allResolved: false};
  const ids = [...new Set(answers.map((a) => a.wordId).filter(Boolean))];
  if (ids.length === 0) return {answers, allResolved: false};
  const refs = ids.map((id) =>
    db.collection("lists").doc(listId).collection("words").doc(id));
  const byId = new Map();
  (await db.getAll(...refs)).forEach((s) => {
    if (s.exists) byId.set(s.id, s.data());
  });
  let allResolved = true;
  const resolved = answers.map((a) => {
    const w = byId.get(a.wordId);
    if (!w) {
      allResolved = false;
      return a; // unresolved → keep client fallback (NOT certifiable)
    }
    return {
      ...a,
      word: a.word || w.word,
      correctDefinition: w.definition ?? a.correctDefinition,
      koreanDefinition: (w.definitions && w.definitions.ko) ?? a.koreanDefinition,
    };
  });
  return {answers: resolved, allResolved};
}

/**
 * Authz gate for server-side definition resolution: only resolve canonical defs for a list
 * the caller is entitled to (enrolled in a class that assigns it), so gradeTypedTest cannot
 * become an answer-key oracle for arbitrary lists. Returns false on any miss; the caller then
 * skips resolution and grades against client-supplied values (parity with old behavior), so a
 * legit student is never blocked by a failed check.
 */
async function callerMayResolveList(uid, classId, listId) {
  if (!classId || !listId) return false;
  try {
    const classSnap = await db.collection("classes").doc(classId).get();
    if (!classSnap.exists) return false;
    const classData = classSnap.data();
    let enrolled =
      Array.isArray(classData.studentIds) && classData.studentIds.includes(uid);
    if (!enrolled) {
      const userSnap = await db.collection("users").doc(uid).get();
      const ec = userSnap.exists ? (userSnap.data().enrolledClasses || {}) : {};
      enrolled = !!ec[classId];
    }
    if (!enrolled) return false;
    // List must be assigned to the class (new assignments map OR legacy assignedLists).
    const assignments = classData.assignments || {};
    const legacyAssigned =
      Array.isArray(classData.assignedLists) && classData.assignedLists.includes(listId);
    return !!assignments[listId] || legacyAssigned;
  } catch (e) {
    logger.warn("callerMayResolveList check failed; skipping resolution", {
      uid, classId, listId, error: e.message,
    });
    return false;
  }
}

/**
 * Write-path resolution + sanitization. The live durable write (submitVocabAttempt) persists
 * client-built `attemptAnswers`, NOT buildTypedAttemptAnswers — so a client still carrying an OLD
 * thin recovery marker would write `correctAnswer: undefined`. Backfill the canonical definition
 * from Firestore when the client omitted it (backfill-when-missing, so valid MCQ option text is
 * preserved) and coalesce every field to non-undefined. Covers typed AND mcq (shared write path).
 * Caller MUST authorize first (assertCanWriteAttempt) — these are Admin-SDK reads.
 */
async function sanitizeStoredRows(listId, rows, opts) {
  // opts.overwrite (G2 typed-retry reconstruction): when true, OVERWRITE display/gradebook fields
  // (word, correctAnswer) from Firestore — don't trust client values. Default = backfill-when-missing
  // (the original behavior). The default `||` preserves a non-empty client value; overwrite mode
  // ignores it, so a tampered correctAnswer/word can't survive a token-verified retry.
  const overwrite = opts?.overwrite === true;
  const byId = new Map();
  if (listId) {
    const ids = [...new Set(rows.map((a) => a.wordId).filter(Boolean))];
    if (ids.length) {
      const refs = ids.map((id) =>
        db.collection("lists").doc(listId).collection("words").doc(id));
      (await db.getAll(...refs)).forEach((s) => {
        if (s.exists) byId.set(s.id, s.data());
      });
    }
  }
  // Overwrite mode (token-verified typed retry): every row MUST resolve from Firestore — do NOT
  // fall back to client word/correctAnswer (Codex). Reject if any wordId is unresolved.
  if (overwrite) {
    const missing = rows.map((a) => a.wordId).filter((id) => id && !byId.has(id));
    if (missing.length) {
      throw new HttpsError("failed-precondition",
        `Cannot reconstruct attempt: unresolved list words [${[...new Set(missing)].join(", ")}]`);
    }
  }
  return rows.map((a) => {
    const w = byId.get(a.wordId);
    return {
      ...a,
      // Overwrite mode: authoritative list values (w guaranteed present by the guard above).
      // Default mode: backfill-when-missing (preserve non-empty client value, e.g. MCQ option text).
      word: overwrite ? (w.word || "") : (a.word || (w && w.word) || ""),
      correctAnswer: overwrite ? (w.definition || "") : (a.correctAnswer || (w && w.definition) || ""),
      studentResponse: a.studentResponse || "",
      isCorrect: a.isCorrect ?? a.correct ?? false,
      aiReasoning: a.aiReasoning ?? a.reasoning ?? "",
      // Challenge metadata is NEVER client-set on attempt CREATE (Codex): only submitChallenge (W1)
      // / reviewChallenge add it later (with token + history). Normalize to null so a forged
      // `challengeStatus:'pending'` can't be injected at create time, bypassing that workflow.
      // (These override the client values spread by `...a` above; other unrecognized row fields are
      // inert — nothing reads them — but the challenge fields ARE read by reviewChallenge, so strip them.)
      challengeStatus: null,
      challengeNote: null,
      challengeReviewedBy: null,
      challengeReviewedAt: null,
    };
  });
}

/**
 * Cloud Function to grade typed vocabulary definitions using Claude Haiku
 *
 * @param {Object} data - Request data containing answers array
 * @param {Object} context - Request context (includes auth)
 * @returns {Promise<Object>} Grading results with isCorrect and reasoning
 */
/**
 * PHASE 1 job claim/recovery. Keyed off the client's EXISTING attemptDocId (nonce
 * identity) — NOT a new identity scheme. Tiny transaction; never wraps the AI call.
 * Returns one of:
 *   {action:'return_cached', payload}  — a prior grade for this exact attempt is cached → reuse it
 *   {action:'in_progress'}             — another live (unexpired) worker is grading → caller retries
 *   {action:'grade', leaseId}          — caller owns the lease; proceed to grade + persist
 * Crash-safe: a `claimed` job whose lease expired is taken over (re-graded). `graded`
 * is a durable cache. Ownership-checked (job.uid === uid).
 */
async function claimOrRecoverGradingJob(uid, jobKey) {
  const ref = db.collection("grading_jobs").doc(jobKey);
  const leaseId = crypto.randomUUID();
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const job = snap.data();
      if (job.uid && job.uid !== uid) {
        throw new HttpsError("permission-denied", "Grading job belongs to another user");
      }
      if (job.status === "graded" && job.payload) {
        return {action: "return_cached", payload: job.payload};
      }
      // status === 'claimed': live lease → in progress; expired lease → take over + re-grade.
      if (job.status === "claimed" && (job.leaseExpiresAt ?? 0) > now) {
        return {action: "in_progress"};
      }
      tx.set(ref, {
        uid, status: "claimed", leaseId,
        leaseExpiresAt: now + GRADE_JOB_LEASE_MS,
        attemptCount: (job.attemptCount ?? 0) + 1,
        version: GRADE_JOB_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      return {action: "grade", leaseId};
    }
    tx.set(ref, {
      uid, status: "claimed", leaseId,
      leaseExpiresAt: now + GRADE_JOB_LEASE_MS,
      attemptCount: 1,
      version: GRADE_JOB_VERSION,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {action: "grade", leaseId};
  });
}

/**
 * Persist a completed grade onto the job (claimed → graded), FENCED on leaseId + lease
 * expiry. Returns the OUTCOME so the caller can decide whether its grade is authoritative:
 *   'persisted'      — our grade is now the cached/canonical result.
 *   'already_graded' — another worker cached first; ours is NOT authoritative (use theirs).
 *   'superseded'     — our lease was taken over (leaseId rotated); ours is NOT authoritative.
 *   'lease_expired'  — our lease expired with no takeover yet; per policy we must NOT complete.
 *   'absent'         — job doc gone (e.g. reset/cleanup); no competitor, ours stands.
 *   'error'          — transaction error; treat as best-effort (ours stands, just uncached).
 * Codex blocker: the caller MUST reject (throw aborted) on superseded/lease_expired so a stale
 * worker never returns a grade the client then persists.
 */
async function persistGradingJobResult(uid, jobKey, leaseId, payload) {
  const ref = db.collection("grading_jobs").doc(jobKey);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return "absent"; // reset/cleanup removed it — no competitor
      const job = snap.data();
      if (job.status === "graded") return "already_graded"; // someone cached first → theirs wins
      // FENCING (plan Recheck-5): persist ONLY if our leaseId still matches (no takeover rotated
      // it) AND the lease is unexpired. `Date.now()` is Cloud-Functions (Google, NTP-synced)
      // server time, NOT a client clock; the 180s lease dwarfs inter-instance skew.
      if (job.leaseId !== leaseId) return "superseded";
      if ((job.leaseExpiresAt ?? 0) < Date.now()) return "lease_expired";
      tx.set(ref, {
        status: "graded", payload,
        gradedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      return "persisted";
    });
  } catch (err) {
    logger.warn("grading job result persist failed (grade still returned)", {uid, jobKey, error: err.message});
    return "error";
  }
}

exports.gradeTypedTest = onCall(
  {
    secrets: [anthropicApiKey, gradeTokenSecret],
    enforceAppCheck: false,
  },
  async (request) => {
    // Validate authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // `gradeContext` (G2): the attempt-binding context (attemptDocId + classId/listId/testId/
    // testType/totalQuestions) the client also sends to submitVocabAttempt. Used ONLY to mint a
    // gradeToken binding the AI grade to this attempt; gradeTypedTest does not write unless
    // `writeContext` is present (current client flow grades here, writes via submitVocabAttempt).
    const {answers, writeContext, gradeContext} = request.data;
    const uid = request.auth.uid;

    // Validate input
    if (!Array.isArray(answers)) {
      throw new HttpsError("invalid-argument", "answers must be an array");
    }

    if (answers.length === 0) {
      throw new HttpsError("invalid-argument", "answers array cannot be empty");
    }

    if (answers.length > 100) {
      throw new HttpsError("invalid-argument", "maximum 100 answers per request");
    }

    // PRE-AI idempotency (§12.2): if this attempt is already written, return it
    // BEFORE spending Anthropic tokens. Ownership-checked (§Codex).
    if (writeContext) {
      const existing = await readExistingAttemptForContext(uid, writeContext);
      if (existing) return normalizeExistingAttempt(existing);
    }

    // PHASE 1 — idempotent grading job (recovery). Keyed off the existing attemptDocId.
    // A prior grade for this exact attempt → return cached (no re-grade, no false failure).
    // Another live worker grading → tell the client to retry (it'll get the cache). Else we
    // own the lease and grade below, caching the result via finishGrading. Skipped entirely
    // when disabled or no attemptDocId (→ exact pre-Phase-1 behavior).
    const jobAttemptDocId = (writeContext || gradeContext || null)?.attemptDocId || null;
    const gradeJob = {enabled: GRADE_JOB_ENABLED && !!jobAttemptDocId, jobKey: jobAttemptDocId, leaseId: null};
    if (gradeJob.enabled) {
      const claim = await claimOrRecoverGradingJob(uid, gradeJob.jobKey);
      if (claim.action === "return_cached") return claim.payload;
      if (claim.action === "in_progress") {
        // Retryable: a concurrent call owns the live lease; the client retry will hit the cache.
        throw new HttpsError("aborted", "Grading already in progress for this test; please retry.");
      }
      gradeJob.leaseId = claim.leaseId;
    }

    // Server-authoritative answer key: resolve canonical definitions from Firestore by
    // (listId, wordId) — but only for a list this caller is entitled to (anti-oracle gate).
    // On denial / missing context, fall back to client-supplied values so a legit student is
    // never blocked. `gradeAnswers` is the single canonical array for ALL downstream use.
    // ONE canonical trusted context (Codex-High): when a binding context is present it is the SOLE
    // source of listId/classId for BOTH resolution and token binding, so a token can't certify a
    // different list than was actually graded (e.g. grade against A, bind to B). Top-level
    // listId/classId are only a fallback when there's no binding context (grade-only, no token).
    const bindCtx = writeContext || gradeContext || null;
    const listId = bindCtx?.listId ?? request.data.listId ?? null;
    const classId = bindCtx?.classId ?? request.data.classId ?? null;
    // If a binding context AND mismatching top-level values are both sent, refuse to certify.
    const ctxMismatch = !!bindCtx && (
      (request.data.listId && request.data.listId !== bindCtx.listId) ||
      (request.data.classId && request.data.classId !== bindCtx.classId)
    );
    const mayResolve = await callerMayResolveList(uid, classId, listId);
    const resolution = mayResolve
      ? await resolveAnswerDefinitions(listId, answers)
      : {answers, allResolved: false};
    const gradeAnswers = resolution.answers;
    // G2 trust gate (Codex): the grade is server-authoritative ONLY when the caller is entitled to the
    // list AND every wordId's definition came from Firestore AND the context is internally consistent.
    // Otherwise → NOT certifiable: no gradeToken, no server-ai marker.
    const serverGraded = mayResolve && resolution.allResolved && !ctxMismatch;

    // Persist the graded attempt server-side when writeContext is supplied, else
    // return grade-only (backward-compatible). On write failure, return the grade
    // (NOT discarded/re-billed) plus the full rows so the client retries the
    // write only — never re-grading.
    const finishGrading = async (gradeResults) => {
      const attemptAnswers = buildTypedAttemptAnswers(gradeAnswers, gradeResults);
      // G2: mint a gradeToken binding the SERVER-graded rows to this attempt, so a write-failed
      // retry (submitVocabAttempt) can persist server-authentic isCorrect without re-trusting the
      // client. Uses the SAME `bindCtx` that drove resolution (above) — its listId/classId are the
      // ones graded against, so the token can't certify a different list. Signs only the grade-bearing
      // subset (canonicalGradeArtifact).
      let gradeToken = null;
      let gradeTokenCreatedAt = null;
      // Mint ONLY when (a) minting is enabled (GRADE_TOKEN_MINT||ENFORCED — so deploy adds no secret
      // dependency to live grading until rollout) AND (b) serverGraded (Codex-Critical: a token certifies
      // the grade ran against Firestore-resolved definitions). Wrapped in try/catch so a secret/mint
      // problem NEVER breaks grading — the grade is returned regardless (token just absent).
      const mintTokens = GRADE_TOKEN_MINT || GRADE_TOKEN_ENFORCED;
      if (mintTokens && serverGraded && bindCtx && bindCtx.attemptDocId) {
        try {
          gradeTokenCreatedAt = Date.now();
          gradeToken = signGradeArtifact(gradeTokenSecret.value(), {
            uid,
            attemptDocId: bindCtx.attemptDocId,
            classId: bindCtx.classId ?? null,
            listId: bindCtx.listId ?? null,
            testId: bindCtx.testId ?? null,
            testType: bindCtx.testType || "typed",
            totalQuestions: bindCtx.totalQuestions ?? null,
            createdAt: gradeTokenCreatedAt,
            rows: attemptAnswers,
          });
        } catch (mintErr) {
          logger.error("gradeToken mint failed (grade preserved)", {uid, error: mintErr.message});
          gradeToken = null;
          gradeTokenCreatedAt = null;
        }
      }
      // Grade-only path (current client flow): return the grade + token; the client writes via
      // submitVocabAttempt, presenting the token (G2). PHASE 1: cache this payload on the job
      // (fenced) so a lost-response retry returns it instead of re-grading.
      if (!writeContext) {
        // deepfix P3 change 7 — nonce F2, server leg (inv_I5 §2): echo the attemptDocId
        // the token was MINTED against so the client's write leg can prefer the
        // server-bound identity over a re-derived local nonce (the 06-29 grade/save
        // docId-divergence class). Because `payload` is ALSO what
        // persistGradingJobResult caches on the grading job, the recovery paths
        // (getGradingStatus / pollForGrade) return the same echoed id. Additive —
        // today's client ignores the extra field; the consuming client legs (F1/F3)
        // ship at P4.
        const payload = {
          results: gradeResults,
          gradeToken,
          gradeTokenCreatedAt,
          attemptDocId: bindCtx?.attemptDocId ?? null,
        };
        if (gradeJob.enabled && gradeJob.leaseId) {
          const outcome = await persistGradingJobResult(uid, gradeJob.jobKey, gradeJob.leaseId, payload);
          // Fencing: a worker may return ITS grade only when the server CONFIRMED it is still
          // authoritative (outcome 'persisted'), or hand back the canonical grade another worker
          // cached ('already_graded'). Every other outcome is fail-CLOSED — we never established
          // authority, so we must NOT return this grade for the client to persist (Codex round 3).
          if (outcome === "already_graded") {
            const snap = await db.collection("grading_jobs").doc(gradeJob.jobKey).get();
            if (snap.exists && snap.data().payload?.results) return snap.data().payload;
            // cache vanished between persist + read → treat as not-authoritative below
            throw new HttpsError("aborted", "Grading result is being finalized; please retry.");
          }
          if (outcome === "superseded" || outcome === "lease_expired" || outcome === "absent") {
            // taken over / expired / job gone → not authoritative; client retries → winner's grade.
            throw new HttpsError("aborted", "Grading was superseded; please retry.");
          }
          if (outcome === "error") {
            // persist txn failed → authority unestablished; retryable so the client re-attempts.
            throw new HttpsError("unavailable", "Could not record the grade; please retry.");
          }
          // outcome === 'persisted' → ours is authoritative.
        }
        return payload;
      }
      try {
        // Direct-write path (writeContext present): server-ai provenance ONLY when serverGraded AND
        // the trust model is live (GRADE_TOKEN_ENFORCED) — no trusted marker before the W3 lockdown.
        const r = await writeAttemptTxn(uid, writeContext, attemptAnswers, undefined, {
          correctnessSource: (serverGraded && GRADE_TOKEN_ENFORCED) ? "server-ai" : null,
        });
        return {
          results: gradeResults,
          score: r.score,
          passed: r.passed,
          attemptId: r.attemptId,
          attemptWritten: r.attemptWritten ?? true,
          alreadyWritten: r.alreadyWritten ?? false,
          gradeToken,
          gradeTokenCreatedAt,
        };
      } catch (writeErr) {
        logger.error("Typed attempt write failed (grade preserved)", {
          uid, attemptDocId: writeContext.attemptDocId, error: writeErr.message,
        });
        return {
          results: gradeResults,
          attemptAnswers,
          attemptWritten: false,
          writeError: writeErr.message,
          gradeToken,
          gradeTokenCreatedAt,
        };
      }
    };

    // Validate answer structure AFTER server resolution. A row still missing required
    // fields here is genuinely unprocessable (resolution couldn't fill it). Soften the
    // old all-or-nothing throw: auto-mark the few unresolved rows wrong and grade the
    // rest; only throw if EVERY row is unprocessable (don't silently score 0).
    const malformed = gradeAnswers.filter(
      (a) => !a.wordId || !a.word || !a.correctDefinition || a.studentResponse === undefined,
    );
    if (malformed.length === gradeAnswers.length) {
      logger.error("Unresolvable grading payload (all answers malformed post-resolution)", {
        uid: request.auth.uid,
        totalAnswers: gradeAnswers.length,
        listId,
        resolved: mayResolve,
        wordIds: malformed.map((a) => a.wordId || "(no id)").join(", "),
      });
      throw new HttpsError(
        "invalid-argument",
        "Cannot grade: no resolvable word/definition data. " +
        "Please reload the test page and submit again.",
      );
    }
    const malformedIds = new Set(malformed.map((a) => a.wordId));
    if (malformed.length > 0) {
      logger.warn("Partial malformed grading payload — auto-marking unresolved words wrong", {
        uid: request.auth.uid,
        malformedCount: malformed.length,
        totalAnswers: gradeAnswers.length,
        listId,
        wordIds: malformed.map((a) => a.wordId || "(no id)").join(", "),
      });
    }
    const malformedResults = malformed.map((a) => ({
      wordId: a.wordId,
      isCorrect: false,
      reasoning: "Could not verify this word — please reload the test and retry.",
    }));

    try {
      // Grade only the well-formed rows; unresolved rows are auto-incorrect above.
      const gradeable = gradeAnswers.filter((a) => !malformedIds.has(a.wordId));
      // Separate into blank, self-referencing, and answers to grade
      const blankAnswers = gradeable.filter(
        (a) => isBlankResponse(a.studentResponse),
      );
      const nonBlank = gradeable.filter(
        (a) => !isBlankResponse(a.studentResponse),
      );
      const selfRefAnswers = nonBlank.filter(
        (a) => isSelfReferencing(a.studentResponse, a.word),
      );
      const answersToGrade = nonBlank.filter(
        (a) => !isSelfReferencing(a.studentResponse, a.word),
      );

      // Auto-mark blank answers as incorrect
      const blankResults = blankAnswers.map((a) => ({
        wordId: a.wordId,
        isCorrect: false,
        reasoning: "No answer provided",
      }));

      // Auto-mark self-referencing answers as incorrect
      const selfRefResults = selfRefAnswers.map((a) => ({
        wordId: a.wordId,
        isCorrect: false,
        reasoning: "You wrote the word itself rather than its meaning. Try defining what the word means.",
      }));

      logger.info(
        `Grading ${answersToGrade.length} answers, ${blankAnswers.length} blank, ${selfRefAnswers.length} self-ref for user ${request.auth.uid}`,
      );

      // If no answers need AI grading, skip API call (§12.1: still writes via finishGrading)
      if (answersToGrade.length === 0) {
        return finishGrading([...blankResults, ...selfRefResults, ...malformedResults]);
      }

      // Initialize Anthropic client
      const client = new Anthropic({
        apiKey: anthropicApiKey.value(),
      });

      // Build JSON input for the AI
      const wordsJson = answersToGrade.map((a) => ({
        wordId: a.wordId,
        word: a.word,
        english: a.correctDefinition,
        korean: a.koreanDefinition || "N/A",
        student: a.studentResponse,
      }));

      const systemMessage = `You are a lenient vocabulary grading assistant for Korean ESL students. Students are tested on English vocabulary words and may answer in Korean, English, or a mix.

<rules>
Default to CORRECT. Mark WRONG only if one of these is true:
1. Restating the word: the answer is the English target word itself, OR an inflected/derived English form of it (run→running, candid→candidly, impoverish→impoverishment). Rewriting the word in another form is not a meaning.
2. Sound-it-out transliteration: the answer is the English word spelled out in Korean letters when Korean does NOT actually use that as the word (grief→그리프, theme→띰). This adds no meaning.
   EXCEPTION — established loanwords: if the Korean transliteration IS the standard, most-commonly-used Korean word for the term, it is CORRECT (piano→피아노, computer→컴퓨터, repertoire→레파토리, bus→버스, energy→에너지). Test: would a Korean person actually use this Korean spelling in everyday life to mean this thing? If yes → CORRECT; if it is only an ad-hoc phonetic spelling no one really uses → WRONG.
3. Irrelevant or contradictory: the response has nothing to do with the word's meaning.
4. Reversed meaning: the response describes the opposite direction (e.g., "to like" for "likable").

Everything else is CORRECT — including partial definitions, a different part of speech expressed as a real translated word (impoverish→가난한 "poor"), Korean near-synonyms, answers with typos, and answers matching the provided Korean definition.
</rules>

<examples>
Word: formidable | English: inspiring fear or respect | Korean: 굳세다
Student: 굳세다
→ CORRECT (matches the Korean definition provided)

Word: impoverish | English: to make poor | Korean: 가난하게 하다
Student: 가난한
→ CORRECT (adjective form instead of verb — student clearly knows the meaning)

Word: dynamic | English: factor that controls, influences a process of growth, change, interaction, or activity | Korean: 변화, 상호작용 등에 영향을 주는 요소
Student: 변화
→ CORRECT (partial but captures a core element of the definition)

Word: projected | English: estimated or forecast | Korean: 예상된
Student: 예상되다ㅠ예ㅛㅏㅇ괸
→ CORRECT (typing errors but intent is clearly 예상되다)

Word: placate | English: to make someone less angry or hostile | Korean: 달래다
Student: make something less angry
→ CORRECT (imprecise but demonstrates understanding)

Word: piano | English: a large keyboard musical instrument | Korean: 피아노
Student: 피아노
→ CORRECT (피아노 is the standard, everyday Korean word for the instrument — an established loanword)

Word: repertoire | English: the set of pieces a performer is ready to perform | Korean: 레퍼토리, 연주 목록
Student: 레파토리
→ CORRECT (레퍼토리/레파토리 is the normal Korean word for this — an established loanword, minor spelling variant)

Word: grief | English: deep sorrow | Korean: 슬픔
Student: 그리프
→ WRONG — {"reasoning": "You sounded out the English word in Korean letters. No one says 그리프 — the Korean word for grief is 슬픔."}

Word: run | English: to move quickly on foot | Korean: 달리다
Student: running
→ WRONG — {"reasoning": "running is just another form of the word run, not its meaning. Write what it means, e.g. 달리다."}

Word: appalling | English: inspiring shock, horror, disgust | Korean: 충격적인
Student: 질리는
→ WRONG — {"reasoning": "질리는 means tiresome or boring, but appalling means inspiring shock or horror — these are different emotions."}

Word: enigmatic | English: mysterious, puzzling | Korean: 신비한
Student: 암호화된
→ WRONG — {"reasoning": "암호화된 means encrypted, which is different from enigmatic (mysterious/puzzling)."}
</examples>

<output_format>
Return ONLY a JSON array. No markdown, no commentary, no text outside the array.

For correct answers:
{"wordId": "...", "isCorrect": true}

For incorrect answers, include reasoning addressed to the student in 1-2 sentences:
{"wordId": "...", "isCorrect": false, "reasoning": "..."}

Do not include "reasoning" for correct answers.
</output_format>`;

      const userMessage = `Grade exactly ${wordsJson.length} words. Return exactly ${wordsJson.length} results.\n\n<words>\n${JSON.stringify(wordsJson, null, 2)}\n</words>`;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        temperature: 0.1,
        system: systemMessage,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      const responseContent = response.content[0]?.text;

      if (!responseContent) {
        throw new Error("Anthropic returned empty response");
      }

      // Parse JSON response - try to extract JSON array from response
      let parsedResponse;
      try {
        // Try to find JSON array in the response (may have markdown code blocks)
        const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the whole response
          parsedResponse = JSON.parse(responseContent);
        }
      } catch (parseError) {
        logger.error("Failed to parse AI response", {responseContent, parseError});
        throw new Error("Failed to parse grading results");
      }

      // Extract results array (handle both direct array and object with results key)
      let results;
      if (Array.isArray(parsedResponse)) {
        results = parsedResponse;
      } else if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
        results = parsedResponse.results;
      } else {
        // Try to find any array in the response
        const arrayKeys = Object.keys(parsedResponse).filter((key) =>
          Array.isArray(parsedResponse[key])
        );
        if (arrayKeys.length > 0) {
          results = parsedResponse[arrayKeys[0]];
        } else {
          throw new Error("AI response does not contain a results array");
        }
      }

      // Map results by wordId to handle AI response length mismatches
      const resultsMap = new Map(
        (Array.isArray(results) ? results : []).map((r) => [r.wordId, r]),
      );

      // Build AI results for non-blank answers
      const aiResults = answersToGrade.map((answer) => {
        const result = resultsMap.get(answer.wordId);
        if (result && typeof result.isCorrect === "boolean") {
          return {
            wordId: answer.wordId,
            isCorrect: result.isCorrect,
            reasoning: result.reasoning || "",
          };
        }

        // If AI missed this word, mark incorrect with a helpful message
        return {
          wordId: answer.wordId,
          isCorrect: false,
          reasoning: "Unable to grade - please challenge if you believe this is correct",
        };
      });

      // Combine AI results with pre-filtered results (incl. auto-incorrect malformed rows)
      const combinedResults = [
        ...aiResults, ...blankResults, ...selfRefResults, ...malformedResults,
      ];

      // Normalize results by wordId to ensure correct order (matching original answers array)
      const resultsMapFinal = new Map(
        combinedResults.map((r) => [r.wordId, r]),
      );

      // Build final results in the same order as the incoming answers
      const finalResults = gradeAnswers.map((answer) => {
        const result = resultsMapFinal.get(answer.wordId);
        if (result) {
          return result;
        }

        // Fallback (should not happen, but handle gracefully)
        return {
          wordId: answer.wordId,
          isCorrect: false,
          reasoning: "Unable to grade - please challenge if you believe this is correct",
        };
      });

      // Post-grading validation - override obvious AI mistakes
      const validatedResults = finalResults.map((result) => {
        const originalAnswer = gradeAnswers.find((a) => a.wordId === result.wordId);
        if (!originalAnswer) return result;

        const response = (originalAnswer.studentResponse || "").trim().toLowerCase();
        const word = (originalAnswer.word || "").trim().toLowerCase();

        // Rule 1: Blank or whitespace-only should always be incorrect
        if (!response) {
          return { ...result, isCorrect: false, reasoning: "No answer provided" };
        }

        // Rule 2: Just the word itself, or an inflected/derived English form of it
        // (run→running, candid→candidly) — no meaning supplied → incorrect.
        // ASCII-only by construction (isInflectionOfWord), so a Korean translation in
        // a different POS (impoverish→가난한) is NOT caught here.
        if (response === word || isInflectionOfWord(response, word)) {
          return {
            ...result,
            isCorrect: false,
            reasoning: "This is just the word itself in another form, not its meaning.",
          };
        }

        // Rule 3: Very short response (1-2 chars) is likely wrong unless it's a valid translation
        if (response.length <= 2 && result.isCorrect) {
          // Keep correct only if it looks like a CJK character (Chinese/Japanese/Korean)
          const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(
            response,
          );
          if (!hasCJK) {
            return {
              ...result,
              isCorrect: false,
              reasoning: "Response too short to be a valid definition",
            };
          }
        }

        return result;
      });

      // Log any overrides for monitoring
      const overrideCount = validatedResults.filter(
        (r, i) => r.isCorrect !== finalResults[i]?.isCorrect,
      ).length;
      if (overrideCount > 0) {
        logger.info(`Validation overrode ${overrideCount} AI decisions`);
      }

      logger.info(`Successfully graded ${validatedResults.length} answers (normalized)`);

      // validatedResults already spans ALL answers (built from answers.map over the
      // combined AI+blank+selfRef lookup above), so it IS the full final-results set (§12.1).
      return finishGrading(validatedResults);
    } catch (error) {
      logger.error("Error grading typed test", {
        error: error.message,
        stack: error.stack,
        userId: request.auth?.uid,
      });

      // Preserve structured errors (HttpsError from write/validation) so the client
      // sees a stable code instead of an opaque functions/internal.
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to grade test: ${error.message}`);
    }
  }
);

/**
 * PHASE 1 — owner-readable grading-job status channel (PLAN §3.7). Lets the client
 * recover a lost grade WITHOUT re-sending the answers payload / re-grading: poll by the
 * same attemptDocId it used to grade. Returns {status:'graded', payload} when the grade
 * is cached, {status:'in_progress'} while a live worker holds the lease, or
 * {status:'absent'} if no job exists (caller should (re)submit). Read-only; ownership-checked.
 */
exports.getGradingStatus = onCall({enforceAppCheck: false}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  // Kill-switch completeness (Codex #4): when jobs are disabled, the status channel is also
  // inert — never serves a previously-cached grade — so flipping the flag off is a TRUE
  // byte-for-byte rollback to pre-Phase-1 behavior.
  if (!GRADE_JOB_ENABLED) return {status: "absent"};
  const uid = request.auth.uid;
  const attemptDocId = request.data?.attemptDocId;
  if (!attemptDocId) throw new HttpsError("invalid-argument", "attemptDocId is required");
  const snap = await db.collection("grading_jobs").doc(attemptDocId).get();
  if (!snap.exists) return {status: "absent"};
  const job = snap.data();
  if (job.uid && job.uid !== uid) {
    throw new HttpsError("permission-denied", "Grading job belongs to another user");
  }
  if (job.status === "graded" && job.payload) return {status: "graded", payload: job.payload};
  if (job.status === "claimed" && (job.leaseExpiresAt ?? 0) > Date.now()) {
    return {status: "in_progress"};
  }
  // claimed-but-expired (worker crashed) → caller should re-submit to take over + re-grade.
  return {status: "stale"};
});

/**
 * Cloud Function to create or resume a test session.
 *
 * Fixes:
 * - Race condition: check-then-create without transaction
 * - Security: server-authoritative attempt counting (can't be manipulated)
 * - Attempt limits enforced server-side
 */
exports.createSession = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const {testId, assignmentId} = request.data;
    if (!testId) {
      throw new HttpsError("invalid-argument", "testId is required");
    }

    const userId = request.auth.uid;
    const firestore = admin.firestore();

    return firestore.runTransaction(async (tx) => {
      // 1. Check test exists and is accessible
      const testRef = firestore.doc(`ap_tests/${testId}`);
      const testSnap = await tx.get(testRef);
      if (!testSnap.exists) {
        throw new HttpsError("not-found", "Test not found");
      }
      const testData = testSnap.data();

      // 2. Verify access: test is published OR user is assigned
      let resolvedAssignmentId = assignmentId || null;
      if (!testData.isPublished) {
        const assignmentsQuery = firestore
          .collection("ap_assignments")
          .where("testId", "==", testId)
          .where("studentIds", "array-contains", userId);
        const assignmentsSnap = await tx.get(assignmentsQuery);
        if (assignmentsSnap.empty) {
          throw new HttpsError(
            "permission-denied",
            "You are not authorized to take this test",
          );
        }
        if (!resolvedAssignmentId) {
          resolvedAssignmentId = assignmentsSnap.docs[0].id;
        }
      }

      // 3. Check for existing active session (atomic — no race window)
      const sessionsQuery = firestore
        .collection("ap_session_state")
        .where("testId", "==", testId)
        .where("userId", "==", userId)
        .where("status", "in", ["IN_PROGRESS", "PAUSED"]);
      const existing = await tx.get(sessionsQuery);

      if (!existing.empty) {
        const existingDoc = existing.docs[0];
        return {id: existingDoc.id, ...existingDoc.data(), resumed: true};
      }

      // 4. Count prior attempts (server-authoritative)
      const resultsQuery = firestore
        .collection("ap_test_results")
        .where("testId", "==", testId)
        .where("userId", "==", userId);
      const attempts = await tx.get(resultsQuery);
      const attemptNumber = attempts.size + 1;

      // 5. Enforce attempt limits if configured
      const maxAttempts = testData.maxAttempts || Infinity;
      if (attemptNumber > maxAttempts) {
        throw new HttpsError(
          "resource-exhausted",
          `Maximum ${maxAttempts} attempts reached`,
        );
      }

      // 6. Create session atomically
      const sessionId = `${userId}_${testId}_${Date.now()}`;
      const sessionData = {
        userId,
        testId,
        assignmentId: resolvedAssignmentId,
        sessionToken:
          `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        status: "IN_PROGRESS",
        attemptNumber,
        currentSectionIndex: 0,
        currentQuestionIndex: 0,
        sectionTimeRemaining: {},
        answers: {},
        flaggedQuestions: [],
        annotations: {},
        strikethroughs: {},
        lastHeartbeat: FieldValue.serverTimestamp(),
        lastAction: FieldValue.serverTimestamp(),
        startedAt: FieldValue.serverTimestamp(),
        completedAt: null,
      };

      tx.set(
        firestore.doc(`ap_session_state/${sessionId}`),
        sessionData,
      );

      logger.info(`Session created: ${sessionId}`, {
        userId,
        testId,
        attemptNumber,
      });

      return {id: sessionId, ...sessionData, resumed: false};
    });
  },
);

/**
 * Cloud Function to submit a test — scores MCQs server-side,
 * creates the result document, and marks the session complete.
 *
 * Fixes:
 * - Race condition: client-side scoring (last-write-wins on result doc)
 * - Race condition: client-only submit dedup (double-submit)
 * - Security: students can no longer see answer keys or manipulate scores
 * - Timer: server validates elapsed time with 30s grace period
 */
exports.submitTest = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const {sessionId, frqData} = request.data;
    if (!sessionId) {
      throw new HttpsError("invalid-argument", "sessionId is required");
    }

    const userId = request.auth.uid;
    const firestore = admin.firestore();

    return firestore.runTransaction(async (tx) => {
      // 1. Load & validate session
      const sessionRef = firestore.doc(`ap_session_state/${sessionId}`);
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError("not-found", "Session not found");
      }
      const session = {id: sessionSnap.id, ...sessionSnap.data()};

      if (session.userId !== userId) {
        throw new HttpsError("permission-denied", "Not your session");
      }

      // 2. Idempotency: if result already exists, return it
      const resultId = `${userId}_${session.testId}_${session.attemptNumber}`;
      const resultRef = firestore.doc(`ap_test_results/${resultId}`);
      const existingResult = await tx.get(resultRef);

      if (existingResult.exists) {
        // Ensure session is marked complete
        if (session.status !== "COMPLETED") {
          tx.update(sessionRef, {
            status: "COMPLETED",
            completedAt: FieldValue.serverTimestamp(),
          });
        }
        return {resultId, alreadySubmitted: true};
      }

      if (session.status === "COMPLETED") {
        throw new HttpsError(
          "failed-precondition",
          "Session already completed but no result found",
        );
      }

      // 3. Load test
      const testRef = firestore.doc(`ap_tests/${session.testId}`);
      const testSnap = await tx.get(testRef);
      if (!testSnap.exists) {
        throw new HttpsError("not-found", "Test not found");
      }
      const test = testSnap.data();

      // 4. Load answer keys + question metadata in batch
      const allQuestionIds = test.sections.flatMap((s) => s.questionIds || []);
      if (allQuestionIds.length === 0) {
        throw new HttpsError("failed-precondition", "Test has no questions");
      }

      const answerKeyRefs = allQuestionIds.map(
        (qId) => firestore.doc(`ap_answer_keys/${qId}`),
      );
      const questionRefs = allQuestionIds.map(
        (qId) => firestore.doc(`ap_questions/${qId}`),
      );
      const allSnaps = await tx.getAll(...answerKeyRefs, ...questionRefs);

      // Split results back into answer keys and questions
      const answerKeySnaps = allSnaps.slice(0, allQuestionIds.length);
      const questionSnaps = allSnaps.slice(allQuestionIds.length);

      // Build questions map with answer keys merged in
      const questions = {};
      for (let i = 0; i < allQuestionIds.length; i++) {
        const qId = allQuestionIds[i];
        const qSnap = questionSnaps[i];
        const akSnap = answerKeySnaps[i];
        if (qSnap.exists) {
          questions[qId] = {
            ...qSnap.data(),
            correctAnswers: akSnap.exists ?
              (akSnap.data().correctAnswers || []) : [],
          };
        }
      }

      // 5. Timer validation (30s grace period)
      const startedMs = session.startedAt?.toMillis?.() || 0;
      const totalTimeLimitSec = test.sections.reduce(
        (sum, s) => sum + (s.timeLimit || 45) * 60,
        0,
      );
      const elapsedSec = startedMs > 0 ?
        (Date.now() - startedMs) / 1000 : 0;
      const GRACE_PERIOD = 30;
      const isLateSubmission = startedMs > 0 &&
        elapsedSec > totalTimeLimitSec + GRACE_PERIOD;

      // 6. Score server-side
      const result = buildTestResult(session, test, questions, frqData);

      // Add server-side fields
      result.completedAt = FieldValue.serverTimestamp();
      result.gradedAt = null;
      result.isLateSubmission = isLateSubmission;

      // 7. Write result + complete session atomically
      tx.set(resultRef, result);
      tx.update(sessionRef, {
        status: "COMPLETED",
        completedAt: FieldValue.serverTimestamp(),
      });

      logger.info(`Test submitted: ${resultId}`, {
        userId,
        testId: session.testId,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        isLateSubmission,
      });

      return {resultId, alreadySubmitted: false};
    });
  },
);

/**
 * Scheduled Cloud Function to pause stale test sessions.
 *
 * Runs every 60 seconds. Queries ap_session_state for sessions that are
 * IN_PROGRESS but have not sent a heartbeat in over 60 seconds. Sets their
 * status to PAUSED so that:
 *  - Cross-device resume works correctly (Firestore reflects reality)
 *  - Teacher dashboard accurately shows session states
 *  - No client cooperation is needed (handles crash, power loss, tab close)
 */
exports.pauseStaleSessions = onSchedule(
  {
    schedule: "every 1 minutes",
    timeoutSeconds: 30,
    maxInstances: 1,
  },
  async () => {
    const firestore = admin.firestore();
    const now = Timestamp.now();
    const staleThreshold = new Timestamp(
      now.seconds - 60,
      now.nanoseconds
    );

    try {
      const staleQuery = firestore
        .collection("ap_session_state")
        .where("status", "==", "IN_PROGRESS")
        .where("lastHeartbeat", "<", staleThreshold);

      const snapshot = await staleQuery.get();

      if (snapshot.empty) {
        return;
      }

      // Batch update all stale sessions (max 500 per batch)
      const batches = [];
      let batch = firestore.batch();
      let count = 0;

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "PAUSED",
          pausedAt: now,
          pausedBy: "server_heartbeat_check",
        });
        count++;

        if (count % 500 === 0) {
          batches.push(batch);
          batch = firestore.batch();
        }
      });

      if (count % 500 !== 0) {
        batches.push(batch);
      }

      await Promise.all(batches.map((b) => b.commit()));

      logger.info(`Paused ${count} stale session(s)`);
    } catch (error) {
      logger.error("pauseStaleSessions failed", {
        error: error.message,
        stack: error.stack,
      });
    }
  }
);

/**
 * Cloud Function to rename a student (teacher/TA action).
 *
 * Why a function: Firestore rules only let a teacher write the `challenges`
 * field on a user doc and don't let them update member docs. Rather than
 * broaden the rules (which would let any teacher rename any user), this
 * function runs server-side with the Admin SDK and verifies the caller is a
 * teacher who owns a class the target student is enrolled in.
 *
 * data: { studentId: string, newName: string }
 */
exports.renameStudent = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const callerId = request.auth.uid;
    const {studentId, newName} = request.data || {};

    if (!studentId || typeof studentId !== "string") {
      throw new HttpsError("invalid-argument", "studentId is required");
    }
    const name = (newName || "").trim();
    if (name.length < 1 || name.length > 60) {
      throw new HttpsError("invalid-argument", "Name must be 1–60 characters.");
    }

    const firestore = admin.firestore();

    // 1. Caller must be a teacher
    const callerSnap = await firestore.doc(`users/${callerId}`).get();
    if (!callerSnap.exists || callerSnap.data().role !== "teacher") {
      throw new HttpsError("permission-denied", "Only teachers can rename students.");
    }

    // 2. Target student must exist
    const studentRef = firestore.doc(`users/${studentId}`);
    const studentSnap = await studentRef.get();
    if (!studentSnap.exists) {
      throw new HttpsError("not-found", "Student not found.");
    }

    // 3. Caller must own at least one class the student is enrolled in
    const enrolled = Object.keys(studentSnap.data().enrolledClasses || {});
    let authorizedClass = false;
    const ownedEnrolled = [];
    for (const classId of enrolled) {
      const classSnap = await firestore.doc(`classes/${classId}`).get();
      if (classSnap.exists && classSnap.data().ownerTeacherId === callerId) {
        authorizedClass = true;
        ownedEnrolled.push(classId);
      }
    }
    if (!authorizedClass) {
      throw new HttpsError(
        "permission-denied",
        "You can only rename students in your own classes.",
      );
    }

    // 4. Write profile (source of truth) + denormalized member copies in
    //    every class the student is enrolled in (so all rosters stay in sync).
    const batch = firestore.batch();
    batch.set(studentRef, {profile: {displayName: name}}, {merge: true});
    for (const classId of enrolled) {
      batch.set(
        firestore.doc(`classes/${classId}/members/${studentId}`),
        {displayName: name},
        {merge: true},
      );
    }
    await batch.commit();

    logger.info(`Teacher ${callerId} renamed student ${studentId} to "${name}"`);
    return {success: true, name};
  },
);

// ============================================================================
// deepfix P6 · FND-4 (F4-3) — teacher provisioning (closes C-28/#1b).
//
// Why: the P6 rules deny `role:'teacher'` on user-doc CREATE and deny any
// owner UPDATE that touches `role` — which also removes the ONLY path a real
// teacher had (the Signup.jsx self-select radio WAS the C-28 hole). This
// callable is the replacement path (FIX_PLAN P6(b): "role changes to
// teacher/admin go through a callable / admin path only"): David mints a
// single-use invite code with scripts/cs/create-teacher-invite.mjs (Admin SDK
// writes teacher_invites/{sha256(code)} — clients can neither read nor write
// that collection), hands the code to the new teacher, and the teacher redeems
// it here (Signup.jsx invite field, or any later redemption surface). The
// Admin SDK write bypasses rules, so the role flip works under the lockdown.
//
// Design notes:
// - Invite lookup is a direct doc get on sha256(code) — no query, no plaintext
//   codes at rest, and an attacker probing codes gets uniform permission-denied.
// - Single-use + optional expiry + revocable (`revoked:true` via Admin SDK).
// - Transactional: consume-invite + role flip commit atomically; a retry after
//   success is idempotent (usedBy === caller → success, no second consume).
// - Stamps `roleProvisioning` provenance on the user doc; the P6 rules exclude
//   that field from owner updates, so provenance can't be forged post-hoc
//   (F-4c hygiene: any live teacher-role doc WITHOUT provenance predates P6 or
//   is suspect).
// - DORMANT (flag false) per the P3/P6 draft rule; flip WITH the P6 rules
//   deploy (precondition 1 in firestore.rules' header) via the G1 flag table.
// - The FULL role mechanism (custom claim vs doc-field-forever) is David's
//   decision 4 and gates P10, not P6 — this callable is compatible with both.
//   [deepfix P10 · OVR part (d)] RESOLVED: David U7 = Option A (custom auth claim).
//   The claim mint (admin.auth().setCustomUserClaims) is wired BELOW, gated
//   SEPARATELY by TEACHER_CLAIM_ENABLED (a P10-cutover flip, distinct from the P6
//   TEACHER_PROVISIONING_ENABLED gate) — the doc role stays for UI; the CLAIM is the
//   P10(d) rules source of truth (firestore.rules isTeacher() → request.auth.token.role).
// ============================================================================
// Gates provisionTeacher. Flip true in the SAME release train as the P6 rules
// deploy (the rules close self-select signup; this is the replacement path).
const TEACHER_PROVISIONING_ENABLED = false;
// [deepfix P10 · OVR part (d)] Gates the custom-claim role mint in provisionTeacher
// (David U7 = Option A). SEPARATE from TEACHER_PROVISIONING_ENABLED because the CLAIM is
// the P10(d) rules source of truth (firestore.rules isTeacher() → request.auth.token.role):
// it flips at the P10 cutover, AFTER the one-time claim backfill
// (scripts/cs/deepfix-backfill-teacher-claims.mjs) and BEFORE the rules narrowing deploys
// (firestore.rules header D1-D4). Flag-off ⇒ provisionTeacher behaves EXACTLY as P6
// (doc-role only, NO auth write) ⇒ byte-equivalent client behavior.
const TEACHER_CLAIM_ENABLED = false;

/** SHA-256 hex of a trimmed invite code (the teacher_invites docId scheme). */
function hashInviteCode(code) {
  return crypto.createHash("sha256").update(String(code).trim(), "utf8").digest("hex");
}

/**
 * provisionTeacher — redeem a single-use invite code; sets the CALLER's
 * users/{uid}.role to 'teacher' (self-service redemption; the invite itself is
 * the authorization, minted only via Admin SDK).
 *
 * data: { inviteCode: string }
 * returns: { success: true, role: 'teacher', alreadyProvisioned: boolean }
 */
exports.provisionTeacher = onCall({enforceAppCheck: false}, async (request) => {
  if (!TEACHER_PROVISIONING_ENABLED) {
    throw new HttpsError(
      "failed-precondition",
      "provisionTeacher is not enabled (TEACHER_PROVISIONING_ENABLED=false)",
    );
  }
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const uid = request.auth.uid;
  const {inviteCode} = request.data || {};
  if (!inviteCode || typeof inviteCode !== "string" || inviteCode.trim().length < 8) {
    throw new HttpsError("invalid-argument", "A valid invite code is required.");
  }

  const inviteId = hashInviteCode(inviteCode);
  const inviteRef = db.doc(`teacher_invites/${inviteId}`);
  const userRef = db.doc(`users/${uid}`);

  const outcome = await db.runTransaction(async (txn) => {
    const [inviteSnap, userSnap] = await Promise.all([txn.get(inviteRef), txn.get(userRef)]);

    if (!inviteSnap.exists) {
      // Uniform error for unknown/mistyped codes — no oracle for probing.
      throw new HttpsError("permission-denied", "Invalid invite code.");
    }
    const invite = inviteSnap.data();
    if (invite.revoked === true) {
      throw new HttpsError("permission-denied", "This invite code has been revoked.");
    }
    if (invite.usedBy && invite.usedBy !== uid) {
      throw new HttpsError("permission-denied", "This invite code has already been used.");
    }
    if (invite.expiresAt && invite.expiresAt.toMillis && invite.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError("permission-denied", "This invite code has expired.");
    }
    if (!userSnap.exists) {
      // Signup creates the user doc (as a student) BEFORE redemption; a missing
      // doc means the flow ran out of order — don't consume the invite.
      throw new HttpsError(
        "failed-precondition",
        "User profile not found — complete signup first, then redeem the invite.",
      );
    }

    const userData = userSnap.data() || {};
    // Idempotent success paths: retry after a committed redemption, or an
    // already-provisioned teacher pasting a code — never burn the invite twice.
    if (invite.usedBy === uid || userData.role === "teacher") {
      return {alreadyProvisioned: true};
    }

    const now = Timestamp.now();
    txn.update(inviteRef, {usedBy: uid, usedAt: now});
    txn.set(userRef, {
      role: "teacher",
      roleProvisioning: {
        via: "invite",
        inviteId,
        provisionedAt: now,
        invitedBy: invite.createdBy ?? null,
        note: invite.note ?? null,
      },
    }, {merge: true});
    return {alreadyProvisioned: false};
  });

  // [deepfix P10 · OVR part (d)] Mint the custom auth CLAIM (David U7 = Option A) so the
  // P10(d) rules (isTeacher() → request.auth.token.role) recognize this teacher. Gated by
  // TEACHER_CLAIM_ENABLED (a P10-cutover flip), SEPARATE from the P6 provisioning gate. Set on
  // BOTH the fresh AND the idempotent alreadyProvisioned path (setCustomUserClaims is idempotent
  // + cheap) so a retry repairs a doc-set-but-claim-missing state. Auth writes cannot join the
  // Firestore transaction, so this runs AFTER the commit. FAIL-CLOSED: on failure we throw so the
  // caller retries — the txn already committed the role doc + consumed the invite, so a retry
  // hits the idempotent alreadyProvisioned branch and re-attempts ONLY the claim (never re-burns
  // the invite). NOTE the promote→re-login lag (U7): the new claim reaches the caller's session
  // only after a token refresh (re-login or ~1h ID-token TTL) — surface it in the UX.
  if (TEACHER_CLAIM_ENABLED) {
    try {
      // MERGE (read-then-set) so any OTHER custom claim is preserved, not clobbered — matches the
      // backfill script's additive discipline (Codex P10d-2). One extra Auth read, only inside
      // this dormant flag block.
      const userRecord = await admin.auth().getUser(uid);
      await admin.auth().setCustomUserClaims(uid, {...(userRecord.customClaims || {}), role: "teacher"});
    } catch (err) {
      logger.error("provisionTeacher: setCustomUserClaims failed", {uid, error: err.message});
      throw new HttpsError(
        "internal",
        "Your teacher role was granted but the sign-in token could not be updated. Please redeem the code again to finish.",
      );
    }
  }

  // Audit trail (same uniform shape as foundation.js logSystemEventServer;
  // best-effort — the role flip has already committed).
  try {
    await db.collection("system_logs").add({
      type: "teacher_provisioned",
      severity: "info",
      uid,
      inviteId,
      alreadyProvisioned: outcome.alreadyProvisioned,
      writtenBy: "cloud-function",
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.warn("teacher_provisioned log write failed (non-fatal)", {error: err.message});
  }

  logger.info(`provisionTeacher: ${uid} provisioned via invite ${inviteId}`, {
    alreadyProvisioned: outcome.alreadyProvisioned,
  });
  return {success: true, role: "teacher", alreadyProvisioned: outcome.alreadyProvisioned};
});

// ============================================================================
// deepfix P3 · FND-1 — the foundation callables (FIX_PLAN.md P3 changes 1-3, 9).
// Defined in foundation.js; re-exported here so they deploy as functions.
// ALL DORMANT: each one is gated on its own server flag (false in this draft —
// see FOUNDATION_FLAGS in the version probe) and NO client code routes to any
// of them until P4 (FND-2). Disabled callable ⇒ `failed-precondition`, no
// reads, no writes.
// ============================================================================
exports.completeSession = foundation.completeSession;
exports.resolveListProgress = foundation.resolveListProgress;
exports.resetProgress = foundation.resetProgress;
exports.advanceForChallenge = foundation.advanceForChallenge;
// deepfix P10 · OVR (FIX_PLAN P10 (a)+(b)) — the override + full server-side
// reviewChallenge callables. DORMANT: gated on FOUNDATION_FLAGS
// SERVER_OVERRIDE_ENABLED / SERVER_REVIEW_CHALLENGE_ENABLED (false); the client
// routes to them only under SERVER_OVERRIDE (src/config/featureFlags.js). Their
// flags surface in the `version` probe via `...foundation.FOUNDATION_FLAGS` below.
exports.reviewChallenge = foundation.reviewChallenge;
exports.overrideAttempt = foundation.overrideAttempt;

// Deploy-provenance probe. After any deploy, call this and compare `sha` to
// `git rev-parse HEAD` in the repo you deployed from — they must match. Also reports the
// LIVE runtime flags so "is enforcement on right now?" is one call, not behavioural detective
// work (the 2026-06-29 confusion — repo said true, prod behaved as false — is exactly this).
exports.version = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  return {
    ...BUILD_INFO,
    flags: {
      GRADE_TOKEN_ENFORCED,
      GRADE_TOKEN_MINT,
      GRADE_JOB_ENABLED,
      GRADE_JOB_LEASE_MS,
      // deepfix P6 (F4-3): teacher provisioning — must be ON when the P6 rules
      // deploy lands (the rules close self-select teacher signup).
      TEACHER_PROVISIONING_ENABLED,
      // deepfix P10 · OVR part (d): custom-claim role mint (David U7 = Option A) — must be ON
      // (+ the claim backfill run) BEFORE the P10(d) rules narrowing deploys (isTeacher()→claim).
      TEACHER_CLAIM_ENABLED,
      // deepfix P3: the foundation-surface flags, so the I-5 G1 flag-assertion
      // table can assert the FULL server posture in one probe call.
      ...foundation.FOUNDATION_FLAGS,
      // Codex P4-plan gate: the DEPLOYED server grandfather epoch — proves the live bundle's epoch matches
      // the client (verified between the P4 functions redeploy and the client cutover push).
      FORCED_PATHWAY_GRANDFATHER_EPOCH_MS: foundation.FORCED_PATHWAY_GRANDFATHER_EPOCH_MS,
    },
    serverTime: new Date().toISOString(),
  };
});
