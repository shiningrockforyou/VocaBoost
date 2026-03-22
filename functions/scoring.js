/**
 * Server-side scoring logic for AP Boost
 * Moved from client-side apScoringService.js to Cloud Functions
 */

const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
};

const SECTION_TYPE = {
  MCQ: 'MCQ',
  FRQ: 'FRQ',
  MIXED: 'MIXED',
};

const DEFAULT_SCORE_RANGES = {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 },
};

/**
 * Calculate score for MCQ_MULTI question
 */
function calculateMCQMultiScore(studentAnswer, correctAnswers, partialCredit = false) {
  let studentSet = [];
  if (Array.isArray(studentAnswer)) {
    studentSet = [...new Set(studentAnswer)].sort();
  } else if (typeof studentAnswer === "string" && studentAnswer) {
    studentSet = [studentAnswer];
  }

  const correctSet = [...new Set(correctAnswers)].sort();
  if (correctSet.length === 0) return 0;

  const correctSelected = studentSet.filter((a) => correctSet.includes(a)).length;
  const incorrectSelected = studentSet.filter((a) => !correctSet.includes(a)).length;
  const totalCorrect = correctSet.length;

  if (partialCredit) {
    const raw = (correctSelected - incorrectSelected) / totalCorrect;
    return Math.max(0, raw);
  } else {
    const isExactMatch =
      studentSet.length === correctSet.length &&
      studentSet.every((a, i) => a === correctSet[i]);
    return isExactMatch ? 1 : 0;
  }
}

/**
 * Calculate MCQ score for a section
 */
function calculateMCQScore(answers, questions, section) {
  let correct = 0;
  let total = 0;

  for (const questionId of section.questionIds || []) {
    const question = questions[questionId];
    if (!question) continue;

    total++;
    const studentAnswer = answers[questionId];
    const correctAnswers = question.correctAnswers || [];

    if (question.questionType === QUESTION_TYPE.MCQ_MULTI) {
      const score = calculateMCQMultiScore(
        studentAnswer,
        correctAnswers,
        question.partialCredit ?? false,
      );
      correct += score;
    } else {
      if (correctAnswers.includes(studentAnswer)) {
        correct++;
      }
    }
  }

  const multiplier = section.mcqMultiplier || 1;
  const points = correct * multiplier;

  return {correct, total, points};
}

/**
 * Convert percentage to AP score (1-5)
 */
function calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES) {
  if (percentage >= scoreRanges.ap5.min) return 5;
  if (percentage >= scoreRanges.ap4.min) return 4;
  if (percentage >= scoreRanges.ap3.min) return 3;
  if (percentage >= scoreRanges.ap2.min) return 2;
  return 1;
}

/**
 * Build complete test result from session, test, and questions
 * Server-side equivalent of client createTestResult
 */
function buildTestResult(session, test, questions, frqData = null) {
  const answers = session.answers || {};
  const sectionScores = {};
  let totalScore = 0;
  let maxScore = 0;
  const mcqResults = [];

  // Calculate scores for each section
  for (let i = 0; i < test.sections.length; i++) {
    const section = test.sections[i];

    if (section.sectionType === SECTION_TYPE.MCQ) {
      const result = calculateMCQScore(answers, questions, section);
      sectionScores[i] = result;
      totalScore += result.points;
      maxScore += result.total * (section.mcqMultiplier || 1);

      // Build MCQ results for report card
      for (const questionId of section.questionIds || []) {
        const question = questions[questionId];
        if (!question) continue;

        const studentAnswer = answers[questionId] || null;
        const correctAnswers = question.correctAnswers || [];

        let isCorrect;
        let score = 0;
        if (question.questionType === QUESTION_TYPE.MCQ_MULTI) {
          score = calculateMCQMultiScore(
            studentAnswer,
            correctAnswers,
            question.partialCredit ?? false,
          );
          isCorrect = score === 1;
        } else {
          isCorrect = correctAnswers.includes(studentAnswer);
          score = isCorrect ? 1 : 0;
        }

        mcqResults.push({
          questionId,
          studentAnswer,
          correctAnswer: correctAnswers.length > 1 ?
            correctAnswers.slice().sort().join(", ") :
            correctAnswers[0] || "N/A",
          correct: isCorrect,
          score,
          questionType: question.questionType || QUESTION_TYPE.MCQ,
          questionDomain: question.questionDomain || null,
          questionTopic: question.questionTopic || null,
        });
      }
    }
  }

  // Calculate FRQ max points with multipliers
  let frqMaxPoints = 0;
  for (const section of test.sections) {
    if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
      for (const questionId of section.questionIds || []) {
        const question = questions[questionId];
        if (!question) continue;

        const isFRQType = question.questionType === QUESTION_TYPE.FRQ ||
                         question.questionType === QUESTION_TYPE.SAQ ||
                         question.questionType === QUESTION_TYPE.DBQ;
        if (!isFRQType) continue;

        const multiplier = section.frqMultipliers?.[questionId] || 1;
        const questionMaxPoints = (question.subQuestions || []).reduce(
          (sum, sq) => sum + (sq.maxPoints || sq.points || 0),
          0,
        );
        frqMaxPoints += questionMaxPoints * multiplier;
      }
    }
  }

  // Calculate percentage and AP score
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const apScore = calculateAPScore(percentage, test.scoreRanges);

  // Determine grading status
  const hasFRQ = test.sections.some((s) =>
    s.sectionType === SECTION_TYPE.FRQ || s.sectionType === SECTION_TYPE.MIXED,
  );
  const gradingStatus = hasFRQ ? "PENDING" : "NOT_NEEDED";

  // Build FRQ answers (ordered by section definition)
  const frqAnswers = {};
  for (const section of test.sections) {
    if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
      for (const qId of section.questionIds || []) {
        const q = questions[qId];
        if (q && (q.questionType === QUESTION_TYPE.FRQ ||
                  q.questionType === QUESTION_TYPE.SAQ ||
                  q.questionType === QUESTION_TYPE.DBQ)) {
          if (answers[qId] !== undefined) {
            frqAnswers[qId] = answers[qId];
          }
        }
      }
    }
  }

  return {
    userId: session.userId,
    testId: session.testId,
    classId: session.classId || null,
    assignmentId: session.assignmentId || null,
    attemptNumber: session.attemptNumber,
    isFirstAttempt: session.attemptNumber === 1,
    sessionId: session.id || null,
    answers,
    score: totalScore,
    maxScore,
    percentage,
    apScore,
    sectionScores,
    mcqResults,
    // FRQ submission data
    frqSubmissionType: frqData?.frqSubmissionType || null,
    frqUploadedFiles: frqData?.frqUploadedFiles || null,
    frqUploadUrl: frqData?.frqUploadedFiles?.[0]?.url || null,
    flaggedQuestions: session.flaggedQuestions || [],
    frqAnswers,
    frqMaxPoints,
    frqScore: null,
    annotatedPdfUrl: null,
    frqGradedPdfUrl: null,
    frqGrades: null,
    gradingStatus,
    teacherId: test.createdBy || null,
    startedAt: session.startedAt,
    // completedAt and gradedAt set by caller with serverTimestamp
  };
}

module.exports = {
  calculateMCQMultiScore,
  calculateMCQScore,
  calculateAPScore,
  buildTestResult,
  QUESTION_TYPE,
  SECTION_TYPE,
  DEFAULT_SCORE_RANGES,
};
