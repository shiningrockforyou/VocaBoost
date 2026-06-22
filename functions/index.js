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
const Anthropic = require("@anthropic-ai/sdk").default;
const {buildTestResult} = require("./scoring");

admin.initializeApp();
const db = admin.firestore();

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
async function writeAttemptTxn(uid, ctx, attemptAnswers, auth) {
  // Validate shape + ownership + enrollment + list entitlement. submitVocabAttempt already
  // authorized (before sanitize) and passes the result through to avoid a duplicate read;
  // any other caller (or none) falls back to authorizing here. Self-contained either way.
  const {passThreshold, teacherId} = auth || await assertCanWriteAttempt(uid, ctx);

  // Score against TOTAL questions presented, not answered (§Codex).
  const correctCount = attemptAnswers.filter((a) => a.isCorrect ?? a.correct).length;
  const totalQuestions = ctx.totalQuestions ?? attemptAnswers.length;
  const skipped = Math.max(0, totalQuestions - attemptAnswers.length);
  const scoreFraction = totalQuestions > 0 ? correctCount / totalQuestions : 0;
  const score = Math.round(scoreFraction * 100); // 0-100
  const passed = ctx.sessionType === "review" ? true : score >= passThreshold;

  // Refuse to write an invalid new-word anchor (CS-2026-06-21): a passed `new`
  // attempt is the CSD/TWI reconciliation anchor (twi = newWordEndIndex + 1).
  if (
    ctx.sessionType === "new" &&
    !(Number.isInteger(ctx.newWordEndIndex) && ctx.newWordEndIndex >= 0)
  ) {
    throw new HttpsError("invalid-argument", "Missing/invalid newWordEndIndex for a new-word attempt");
  }

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
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
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
exports.submitVocabAttempt = onCall({enforceAppCheck: false}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const {context, attemptAnswers} = request.data || {};
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
  // Backfill canonical correctAnswer for a client carrying an OLD thin recovery marker
  // (would otherwise write correctAnswer: undefined); coalesce all fields to non-undefined.
  // Protects typed AND mcq (shared write path).
  const rows = await sanitizeStoredRows(context.listId, attemptAnswers);
  // Pass the auth result through so writeAttemptTxn doesn't re-authorize (saves a duplicate
  // class-doc + orphan read per write).
  const r = await writeAttemptTxn(uid, context, rows, auth);
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
async function resolveAnswerDefinitions(listId, answers) {
  if (!listId) return answers;
  const ids = [...new Set(answers.map((a) => a.wordId).filter(Boolean))];
  if (ids.length === 0) return answers;
  const refs = ids.map((id) =>
    db.collection("lists").doc(listId).collection("words").doc(id));
  const byId = new Map();
  (await db.getAll(...refs)).forEach((s) => {
    if (s.exists) byId.set(s.id, s.data());
  });
  return answers.map((a) => {
    const w = byId.get(a.wordId);
    if (!w) return a; // unresolved → keep client fallback
    return {
      ...a,
      word: a.word || w.word,
      correctDefinition: w.definition ?? a.correctDefinition,
      koreanDefinition: (w.definitions && w.definitions.ko) ?? a.koreanDefinition,
    };
  });
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
async function sanitizeStoredRows(listId, rows) {
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
  return rows.map((a) => {
    const w = byId.get(a.wordId);
    return {
      ...a,
      word: a.word || (w && w.word) || "",
      correctAnswer: a.correctAnswer || (w && w.definition) || "",
      studentResponse: a.studentResponse || "",
      isCorrect: a.isCorrect ?? a.correct ?? false,
      aiReasoning: a.aiReasoning ?? a.reasoning ?? "",
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
exports.gradeTypedTest = onCall(
  {
    secrets: [anthropicApiKey],
    enforceAppCheck: false,
  },
  async (request) => {
    // Validate authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const {answers, writeContext} = request.data;
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

    // Server-authoritative answer key: resolve canonical definitions from Firestore by
    // (listId, wordId) — but only for a list this caller is entitled to (anti-oracle gate).
    // On denial / missing context, fall back to client-supplied values so a legit student is
    // never blocked. `gradeAnswers` is the single canonical array for ALL downstream use.
    const listId = request.data.listId || writeContext?.listId || null;
    const classId = request.data.classId || writeContext?.classId || null;
    const mayResolve = await callerMayResolveList(uid, classId, listId);
    const gradeAnswers = mayResolve
      ? await resolveAnswerDefinitions(listId, answers)
      : answers;

    // Persist the graded attempt server-side when writeContext is supplied, else
    // return grade-only (backward-compatible). On write failure, return the grade
    // (NOT discarded/re-billed) plus the full rows so the client retries the
    // write only — never re-grading.
    const finishGrading = async (gradeResults) => {
      if (!writeContext) return {results: gradeResults};
      const attemptAnswers = buildTypedAttemptAnswers(gradeAnswers, gradeResults);
      try {
        const r = await writeAttemptTxn(uid, writeContext, attemptAnswers);
        return {
          results: gradeResults,
          score: r.score,
          passed: r.passed,
          attemptId: r.attemptId,
          attemptWritten: r.attemptWritten ?? true,
          alreadyWritten: r.alreadyWritten ?? false,
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
1. Self-referencing: the response uses the target word or a direct transliteration to define itself
2. Irrelevant or contradictory: the response has nothing to do with the word's meaning
3. Reversed meaning: the response describes the opposite direction (e.g., "to like" for "likable")

Everything else is CORRECT — including partial definitions, different parts of speech, Korean near-synonyms, answers with typos, and answers matching the provided Korean definition.
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

Word: renaissance | English: a rebirth or revival | Korean: 부활, 신생, 부흥
Student: 르네상스
→ WRONG — {"reasoning": "You wrote the transliterated name rather than the meaning. Renaissance means a rebirth or revival."}

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

        // Rule 2: Just repeating the word (exact or very close) should be incorrect
        if (
          response === word ||
          response === word + "s" ||
          response === word + "ed" ||
          response === word + "ing"
        ) {
          return {
            ...result,
            isCorrect: false,
            reasoning: "Simply repeated the word without definition",
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
        lastHeartbeat: admin.firestore.FieldValue.serverTimestamp(),
        lastAction: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
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
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      result.completedAt = admin.firestore.FieldValue.serverTimestamp();
      result.gradedAt = null;
      result.isLateSubmission = isLateSubmission;

      // 7. Write result + complete session atomically
      tx.set(resultRef, result);
      tx.update(sessionRef, {
        status: "COMPLETED",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    const now = admin.firestore.Timestamp.now();
    const staleThreshold = new admin.firestore.Timestamp(
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
