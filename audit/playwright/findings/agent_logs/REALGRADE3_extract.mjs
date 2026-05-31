/**
 * REALGRADE3 - Data Extraction Phase
 * Extract and deduplicate real student answers from typed_test_answers_export.json
 */
import { readFileSync, writeFileSync } from 'fs';

const log = (msg, extra = {}) => {
  const entry = { ts: new Date().toISOString(), msg, ...extra };
  console.log(JSON.stringify(entry));
};

log("REALGRADE3 extraction start");

// Load data
const allAttempts = JSON.parse(readFileSync('/app/typed_test_answers_export.json', 'utf8'));
const allUsers = JSON.parse(readFileSync('/app/users_export.json', 'utf8'));

// Build user map
const userMap = new Map();
allUsers.forEach(u => { userMap.set(u.userId, u); });

log("data loaded", {
  totalAttempts: allAttempts.length,
  totalUsers: allUsers.length
});

// Identify real students (in users_export and NOT test/audit accounts)
const testEmailPatterns = ['@vocaboost.test', 'audit', 'seeded'];
const realStudentIds = new Set();
const excludedStudentIds = new Set();

allUsers.forEach(u => {
  const email = (u.email || '').toLowerCase();
  const isTest = testEmailPatterns.some(p => email.includes(p));
  if (isTest) {
    excludedStudentIds.add(u.userId);
  } else if (u.role === 'student') {
    realStudentIds.add(u.userId);
  }
  // Skip teachers
});

// Note: students NOT in users_export are ambiguous;
// The instructions say "cross-check /app/users_export.json" and exclude audit/test accounts
// Students not in users_export cannot be verified as real; we'll include them
// as the export may be incomplete, but flag them
const unknownStudentIds = new Set();
allAttempts.forEach(d => {
  if (!userMap.has(d.studentId) && !excludedStudentIds.has(d.studentId)) {
    unknownStudentIds.add(d.studentId);
  }
});

log("student classification", {
  realStudents: realStudentIds.size,
  excludedTest: excludedStudentIds.size,
  unknownNotInUsersExport: unknownStudentIds.size
});

// Flatten all answers from real students
// Include unknown students (not in users_export) - likely real students whose profiles
// weren't captured in the export
const allAnswers = [];
let totalAttempts = 0;
const realStudentAttemptCounts = new Map();
const dateRange = { min: null, max: null };

allAttempts.forEach(attempt => {
  const isRealOrUnknown = realStudentIds.has(attempt.studentId) ||
                          unknownStudentIds.has(attempt.studentId);
  const isExcluded = excludedStudentIds.has(attempt.studentId);

  if (!isRealOrUnknown || isExcluded) return;

  totalAttempts++;
  realStudentAttemptCounts.set(attempt.studentId,
    (realStudentAttemptCounts.get(attempt.studentId) || 0) + 1);

  const submittedAt = attempt.submittedAt;
  if (submittedAt) {
    if (!dateRange.min || submittedAt < dateRange.min) dateRange.min = submittedAt;
    if (!dateRange.max || submittedAt > dateRange.max) dateRange.max = submittedAt;
  }

  if (!attempt.answers) return;

  attempt.answers.forEach(ans => {
    // Map correctAnswer -> correctDefinition (THE KEY FIX)
    allAnswers.push({
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      submittedAt: attempt.submittedAt,
      wordId: ans.wordId,
      word: ans.word,
      correctDefinition: ans.correctAnswer,  // MAP: correctAnswer -> correctDefinition
      studentResponse: ans.studentResponse,
      isCorrect_old: ans.isCorrect,
      aiReasoning_old: ans.aiReasoning || '',
      isRealStudent: realStudentIds.has(attempt.studentId)
    });
  });
});

log("answers extracted", {
  totalAnswers: allAnswers.length,
  totalStudents: realStudentAttemptCounts.size,
  totalAttempts,
  dateRange
});

// Deduplicate to distinct (word, studentResponse) pairs
// Keep correctDefinition, old verdict, occurrence info
const pairMap = new Map(); // key: `${word}|||${studentResponse}`

allAnswers.forEach(ans => {
  // Normalize: trim whitespace
  const word = (ans.word || '').toLowerCase().trim();
  const response = (ans.studentResponse || '').trim();
  const key = `${word}|||${response}`;

  if (!pairMap.has(key)) {
    pairMap.set(key, {
      word: ans.word,
      studentResponse: ans.studentResponse,
      correctDefinition: ans.correctDefinition,
      occurrences: 0,
      oldVerdicts: [],
      studentIds: new Set(),
      wordIds: new Set(),
    });
  }

  const pair = pairMap.get(key);
  pair.occurrences++;
  pair.oldVerdicts.push(ans.isCorrect_old);
  pair.studentIds.add(ans.studentId);
  pair.wordIds.add(ans.wordId);
});

// Build deduplicated list
const distinctPairs = [];
let pairIdx = 0;
let conflictingVerdictCount = 0;

pairMap.forEach((pair, key) => {
  const trueCount = pair.oldVerdicts.filter(v => v === true).length;
  const falseCount = pair.oldVerdicts.filter(v => v === false).length;
  const hasConflict = trueCount > 0 && falseCount > 0;
  if (hasConflict) conflictingVerdictCount++;

  // Majority vote for old verdict
  const oldVerdict_majority = trueCount >= falseCount;

  distinctPairs.push({
    pairId: `p${pairIdx++}`,
    word: pair.word,
    studentResponse: pair.studentResponse,
    correctDefinition: pair.correctDefinition,
    occurrences: pair.occurrences,
    oldVerdict_majority,
    oldVerdict_trueCount: trueCount,
    oldVerdict_falseCount: falseCount,
    hasConflictingOldVerdicts: hasConflict,
    uniqueStudentCount: pair.studentIds.size,
    wordIdSample: Array.from(pair.wordIds)[0]
  });
});

log("deduplication complete", {
  totalDistinctPairs: distinctPairs.length,
  oldCorrectPairs: distinctPairs.filter(p => p.oldVerdict_majority).length,
  oldIncorrectPairs: distinctPairs.filter(p => !p.oldVerdict_majority).length,
  conflictingVerdictPairs: conflictingVerdictCount
});

// Save extracted answers
const outputPath = '/app/audit/playwright/findings/evidence/REAL_GRADING/extracted_answers_v3.json';
writeFileSync(outputPath, JSON.stringify({
  meta: {
    extractedAt: new Date().toISOString(),
    totalAnswers: allAnswers.length,
    totalDistinctPairs: distinctPairs.length,
    realStudents: realStudentIds.size,
    unknownStudents: unknownStudentIds.size,
    totalStudents: realStudentAttemptCounts.size,
    totalAttempts,
    dateRange,
    note: "correctAnswer field mapped to correctDefinition for gradeTypedTest callable"
  },
  distinctPairs
}, null, 2));

log("extracted_answers_v3.json written", { path: outputPath, pairs: distinctPairs.length });
