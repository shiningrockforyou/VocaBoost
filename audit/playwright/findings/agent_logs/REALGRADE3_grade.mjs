/**
 * REALGRADE3 - Grading Phase
 * Re-grades all distinct (word, studentResponse) pairs using gradeTypedTest callable
 * KEY FIX: uses correctDefinition field (not correctAnswer)
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyDzxmgrpNgUDOkZXJiMIgTU-MOuUA7WCy8",
  authDomain: "vocaboost-879c2.firebaseapp.com",
  projectId: "vocaboost-879c2",
  storageBucket: "vocaboost-879c2.firebasestorage.app",
  messagingSenderId: "340529006626",
  appId: "1:340529006626:web:5cffc6b4c159584be5227b",
};

const LOG_PATH = '/app/audit/playwright/findings/agent_logs/REALGRADE3.jsonl';
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/REALGRADE3.status.json';
const RESULTS_PATH = '/app/audit/playwright/findings/evidence/REAL_GRADING/regrade_results_v3.json';

const log = (msg, extra = {}) => {
  const entry = { ts: new Date().toISOString(), msg, ...extra };
  const line = JSON.stringify(entry);
  console.log(line);
  appendFileSync(LOG_PATH, line + '\n');
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const BATCH_SIZE = 50; // Conservative, function supports up to 100

async function main() {
  log("REALGRADE3 grading start");

  // Load extracted answers
  const extracted = JSON.parse(readFileSync('/app/audit/playwright/findings/evidence/REAL_GRADING/extracted_answers_v3.json', 'utf8'));
  const allPairs = extracted.distinctPairs;

  log("pairs loaded", {
    total: allPairs.length,
    oldCorrect: allPairs.filter(p => p.oldVerdict_majority).length,
    oldIncorrect: allPairs.filter(p => !p.oldVerdict_majority).length
  });

  // Sampling strategy:
  // For old-incorrect: grade all non-blank (up to 500), plus 50 blank
  // For old-correct: grade sample of 300 (to check false positives)
  const incorrect = allPairs.filter(p => !p.oldVerdict_majority);
  const correct = allPairs.filter(p => p.oldVerdict_majority);

  const nonBlankIncorrect = incorrect.filter(p => p.studentResponse && p.studentResponse.trim().length > 0);
  const blankIncorrect = incorrect.filter(p => !p.studentResponse || p.studentResponse.trim().length === 0);

  // Sample selection
  const incorrectSample = [
    ...nonBlankIncorrect.slice(0, 450),
    ...blankIncorrect.slice(0, 50)
  ];

  // For correct: shuffle-ish sample (take from various positions)
  const correctSample = [];
  const step = Math.max(1, Math.floor(correct.length / 300));
  for (let i = 0; i < correct.length && correctSample.length < 300; i += step) {
    correctSample.push(correct[i]);
  }

  const toGrade = [...incorrectSample, ...correctSample];

  log("sample selected", {
    incorrectSample: incorrectSample.length,
    correctSample: correctSample.length,
    total: toGrade.length
  });

  // Assign unique synthetic wordIds (pairId already unique, use as wordId)
  // Map synthetic wordId -> pairId for lookup
  const syntheticToReal = new Map();
  const gradingPayload = toGrade.map((pair, idx) => {
    const syntheticId = pair.pairId; // already unique (p0, p1, ...)
    syntheticToReal.set(syntheticId, pair);
    return {
      wordId: syntheticId,
      word: pair.word,
      correctDefinition: pair.correctDefinition, // CORRECT FIELD NAME
      studentResponse: pair.studentResponse || '',
    };
  });

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const functions = getFunctions(app);

  // Authenticate
  log("authenticating", { account: "audit_careful_01_top@vocaboost.test" });
  try {
    await signInWithEmailAndPassword(auth, "audit_careful_01_top@vocaboost.test", "AuditPass2026!");
    log("auth SUCCESS");
  } catch (err) {
    log("auth FAILED", { error: err.message, code: err.code });
    process.exit(1);
  }

  const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', { timeout: 120000 });

  // Batch and call
  const numBatches = Math.ceil(gradingPayload.length / BATCH_SIZE);
  log("batching", { totalItems: gradingPayload.length, batchSize: BATCH_SIZE, numBatches });

  const allResults = new Map(); // pairId -> { isCorrect, reasoning }
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE;
    const batchItems = gradingPayload.slice(start, start + BATCH_SIZE);

    const t0 = Date.now();
    try {
      const result = await gradeTypedTest({ answers: batchItems });
      const latencyMs = Date.now() - t0;
      const results = result.data.results || [];

      results.forEach(r => {
        allResults.set(r.wordId, { isCorrect: r.isCorrect, reasoning: r.reasoning || '' });
      });

      totalSucceeded += results.length;
      log(`batch ${batchIdx + 1}/${numBatches} SUCCESS`, {
        batchSize: batchItems.length,
        resultsReturned: results.length,
        latencyMs
      });
    } catch (err) {
      const latencyMs = Date.now() - t0;
      totalFailed += batchItems.length;
      log(`batch ${batchIdx + 1}/${numBatches} FAILED`, {
        error: err.message,
        code: err.code,
        details: err.details,
        latencyMs,
        firstItem: batchItems[0]?.wordId
      });
    }

    // Small delay between batches to avoid overwhelming the function
    if (batchIdx < numBatches - 1) {
      await sleep(200);
    }
  }

  log("grading complete", { totalSucceeded, totalFailed });

  // Build results array with old vs new comparison
  const regradeResults = toGrade.map(pair => {
    const newResult = allResults.get(pair.pairId);
    return {
      pairId: pair.pairId,
      word: pair.word,
      studentResponse: pair.studentResponse,
      correctDefinition: pair.correctDefinition,
      oldVerdict: pair.oldVerdict_majority,
      newVerdict: newResult ? newResult.isCorrect : null,
      newReasoning: newResult ? newResult.reasoning : null,
      graded: !!newResult,
      occurrences: pair.occurrences,
      uniqueStudents: pair.uniqueStudentCount,
      hasConflictingOldVerdicts: pair.hasConflictingOldVerdicts
    };
  });

  // Save results
  writeFileSync(RESULTS_PATH, JSON.stringify({
    meta: {
      gradedAt: new Date().toISOString(),
      totalToGrade: toGrade.length,
      totalSucceeded,
      totalFailed,
      batchSize: BATCH_SIZE
    },
    results: regradeResults
  }, null, 2));

  log("regrade_results_v3.json written", { path: RESULTS_PATH });

  // Quick stats
  const graded = regradeResults.filter(r => r.graded);
  const oldCorrectNewCorrect = graded.filter(r => r.oldVerdict && r.newVerdict).length;
  const oldCorrectNewWrong = graded.filter(r => r.oldVerdict && !r.newVerdict).length;
  const oldWrongNewCorrect = graded.filter(r => !r.oldVerdict && r.newVerdict).length;
  const oldWrongNewWrong = graded.filter(r => !r.oldVerdict && !r.newVerdict).length;

  log("agreement stats", {
    graded: graded.length,
    oldCorrectNewCorrect,
    oldCorrectNewWrong_FN_candidates: oldCorrectNewWrong,
    oldWrongNewCorrect_FP_candidates: oldWrongNewCorrect,
    oldWrongNewWrong
  });

  // Save preliminary status
  writeFileSync(STATUS_PATH, JSON.stringify({
    label: "REALGRADE3",
    phase: "GRADED_PENDING_EVAL",
    gradedAt: new Date().toISOString(),
    totalToGrade: toGrade.length,
    totalSucceeded,
    totalFailed,
    agreementStats: { oldCorrectNewCorrect, oldCorrectNewWrong, oldWrongNewCorrect, oldWrongNewWrong }
  }, null, 2));

  log("status written");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
