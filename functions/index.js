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
      throw new Error("Unauthenticated - Authentication required");
    }

    const {answers} = request.data;

    // Validate input
    if (!Array.isArray(answers)) {
      throw new Error("Invalid input: answers must be an array");
    }

    if (answers.length === 0) {
      throw new Error("Invalid input: answers array cannot be empty");
    }

    if (answers.length > 100) {
      throw new Error("Invalid input: maximum 100 answers per request");
    }

    // Validate answer structure
    for (const answer of answers) {
      if (!answer.wordId || !answer.word || !answer.correctDefinition || answer.studentResponse === undefined) {
        throw new Error("Invalid input: each answer must have wordId, word, correctDefinition, and studentResponse");
      }
    }

    try {
      // Separate into blank, self-referencing, and answers to grade
      const blankAnswers = answers.filter(
        (a) => isBlankResponse(a.studentResponse),
      );
      const nonBlank = answers.filter(
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

      // If no answers need AI grading, skip API call
      if (answersToGrade.length === 0) {
        return {
          results: [...blankResults, ...selfRefResults],
        };
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

      // Combine AI results with pre-filtered results
      const combinedResults = [...aiResults, ...blankResults, ...selfRefResults];

      // Normalize results by wordId to ensure correct order (matching original answers array)
      const resultsMapFinal = new Map(
        combinedResults.map((r) => [r.wordId, r]),
      );

      // Build final results in the same order as the incoming answers
      const finalResults = answers.map((answer) => {
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
        const originalAnswer = answers.find((a) => a.wordId === result.wordId);
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

      return {
        results: validatedResults,
      };
    } catch (error) {
      logger.error("Error grading typed test", {
        error: error.message,
        stack: error.stack,
        userId: request.auth?.uid,
      });

      // Re-throw known errors
      if (error.message.includes("Unauthenticated") || error.message.includes("Invalid input")) {
        throw error;
      }

      // Return generic error for unknown errors
      throw new Error(`Failed to grade test: ${error.message}`);
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
