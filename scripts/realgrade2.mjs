/**
 * REALGRADE2 — Re-grade real student answers through the LIVE gradeTypedTest Firebase callable.
 *
 * Safety: READ-ONLY. Never writes to Firestore. Results go to findings files only.
 *
 * Run from /app:
 *   node scripts/realgrade2.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';

// ============================================================
// CONFIG
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDzxmgrpNgUDOkZXJiMIgTU-MOuUA7WCy8',
  authDomain: 'vocaboost-879c2.firebaseapp.com',
  projectId: 'vocaboost-879c2',
  storageBucket: 'vocaboost-879c2.firebasestorage.app',
  messagingSenderId: '340529006626',
  appId: '1:340529006626:web:5cffc6b4c159584be5227b',
};

const AUDIT_EMAIL = 'audit_careful_01_top@vocaboost.test';
const AUDIT_PASS = 'AuditPass2026!';

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/REAL_GRADING';
const LOGS_DIR = '/app/audit/playwright/findings/agent_logs';

const BATCH_SIZE = 100;  // callable max
const MAX_WRONG_PAIRS = 500;  // all wrong pairs (false-negative gate)
const MAX_CORRECT_PAIRS = 300; // sample of correct pairs

// ============================================================
// HELPERS
// ============================================================
function log(obj) {
  const entry = { ts: new Date().toISOString(), ...obj };
  appendFileSync(`${LOGS_DIR}/REALGRADE2.jsonl`, JSON.stringify(entry) + '\n');
  console.log('[LOG]', JSON.stringify(obj).slice(0, 200));
}

function writeStatus(obj) {
  writeFileSync(`${LOGS_DIR}/REALGRADE2.status.json`, JSON.stringify({ ...obj, updatedAt: new Date().toISOString() }, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// MAIN
// ============================================================
async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(LOGS_DIR, { recursive: true });

  log({ phase: 'START', msg: 'REALGRADE2 beginning' });
  writeStatus({ label: 'REALGRADE2', phase: 'STARTING' });

  // -------------------------------------------------------
  // PHASE 1: Load & deduplicate real student answers
  // -------------------------------------------------------
  log({ phase: 'PHASE_1', msg: 'Loading extracted_answers.json' });

  const extracted = JSON.parse(readFileSync(`${EVIDENCE_DIR}/extracted_answers.json`, 'utf8'));
  const allAnswers = extracted.answers;

  log({
    phase: 'PHASE_1',
    msg: 'Loaded',
    totalAnswers: allAnswers.length,
    distinctStudents: extracted.distinctStudents,
    dateRange: extracted.dateRange,
  });

  // Deduplicate by (word.toLowerCase(), studentAnswer.toLowerCase())
  const seenMap = new Map();
  for (const a of allAnswers) {
    if (!a.word || a.studentAnswer === null || a.studentAnswer === undefined) continue;
    const key = a.word.toLowerCase() + '|||' + (a.studentAnswer || '').toLowerCase();
    if (!seenMap.has(key)) {
      seenMap.set(key, { ...a, occurrenceCount: 1 });
    } else {
      seenMap.get(key).occurrenceCount++;
    }
  }
  const allDistinct = Array.from(seenMap.values());

  const wrongPairs = allDistinct.filter(a => !a.storedIsCorrect);
  const correctPairs = allDistinct.filter(a => a.storedIsCorrect);

  log({
    phase: 'PHASE_1',
    msg: 'Deduplicated',
    totalDistinct: allDistinct.length,
    distinctWrong: wrongPairs.length,
    distinctCorrect: correctPairs.length,
  });

  // Select grading sample: all wrong pairs (capped) + sample of correct pairs
  // Sort wrong pairs by word for reproducibility
  const wrongSample = wrongPairs
    .sort((a, b) => a.word.localeCompare(b.word))
    .slice(0, MAX_WRONG_PAIRS);

  // For correct pairs: sample spread across the distribution
  const correctStep = Math.max(1, Math.floor(correctPairs.length / MAX_CORRECT_PAIRS));
  const correctSample = correctPairs
    .sort((a, b) => a.word.localeCompare(b.word))
    .filter((_, i) => i % correctStep === 0)
    .slice(0, MAX_CORRECT_PAIRS);

  const gradingSample = [...wrongSample, ...correctSample];

  log({
    phase: 'PHASE_1',
    msg: 'Grading sample selected',
    wrongSampleSize: wrongSample.length,
    correctSampleSize: correctSample.length,
    totalToGrade: gradingSample.length,
  });

  writeStatus({ label: 'REALGRADE2', phase: 'PHASE_1_COMPLETE', totalToGrade: gradingSample.length });

  // -------------------------------------------------------
  // PHASE 2: Authenticate + call live Firebase callable
  // -------------------------------------------------------
  log({ phase: 'PHASE_2', msg: 'Initializing Firebase' });

  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const functions = getFunctions(app, 'us-central1');

  log({ phase: 'PHASE_2', msg: 'Signing in as audit user', email: AUDIT_EMAIL });

  try {
    await signInWithEmailAndPassword(auth, AUDIT_EMAIL, AUDIT_PASS);
    log({ phase: 'PHASE_2', msg: 'Auth SUCCESS' });
  } catch (authErr) {
    log({ phase: 'PHASE_2', msg: 'Auth FAILED', error: String(authErr) });
    writeStatus({ label: 'REALGRADE2', phase: 'AUTH_FAILED', error: String(authErr) });
    throw authErr;
  }

  const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', { timeout: 120000 });

  // Build batches of 100 with generated wordIds for matching
  const results = [];
  const batches = [];
  for (let i = 0; i < gradingSample.length; i += BATCH_SIZE) {
    batches.push(gradingSample.slice(i, i + BATCH_SIZE));
  }

  log({ phase: 'PHASE_2', msg: `Processing ${batches.length} batches of up to ${BATCH_SIZE}` });
  writeStatus({ label: 'REALGRADE2', phase: 'GRADING', totalBatches: batches.length, completedBatches: 0 });

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchStart = Date.now();

    // Build payload — callable expects correctDefinition + studentResponse
    const answers = batch.map((item, idx) => ({
      wordId: `batch${batchIdx}_item${idx}`,
      word: item.word,
      correctDefinition: item.correctDefinition,
      studentResponse: item.studentAnswer,  // field name mapping
      koreanDefinition: item.koreanDefinition || undefined,
    }));

    log({ phase: 'PHASE_2', msg: `Calling batch ${batchIdx + 1}/${batches.length}`, batchSize: answers.length });

    let callResult = null;
    let callError = null;

    try {
      const response = await gradeTypedTest({ answers });
      callResult = response.data;
    } catch (err) {
      callError = String(err);
      log({ phase: 'PHASE_2', msg: `Batch ${batchIdx} FAILED`, error: callError });
    }

    const batchLatency = Date.now() - batchStart;

    if (callResult && callResult.results) {
      // Map results back by wordId
      const resultMap = {};
      for (const r of callResult.results) {
        resultMap[r.wordId] = r;
      }

      for (let idx = 0; idx < batch.length; idx++) {
        const item = batch[idx];
        const wordId = `batch${batchIdx}_item${idx}`;
        const gradedResult = resultMap[wordId];

        results.push({
          ...item,
          newIsCorrect: gradedResult ? gradedResult.isCorrect : null,
          newReasoning: gradedResult ? (gradedResult.reasoning || null) : null,
          error: gradedResult ? null : (callError || 'No result returned'),
          batchIdx,
          batchLatencyMs: batchLatency,
        });
      }
    } else {
      // Entire batch failed
      for (const item of batch) {
        results.push({
          ...item,
          newIsCorrect: null,
          newReasoning: null,
          error: callError || 'Batch call failed',
          batchIdx,
          batchLatencyMs: batchLatency,
        });
      }
    }

    log({ phase: 'PHASE_2', msg: `Batch ${batchIdx + 1} done`, latencyMs: batchLatency, failed: callError ? 'yes' : 'no' });
    writeStatus({
      label: 'REALGRADE2',
      phase: 'GRADING',
      totalBatches: batches.length,
      completedBatches: batchIdx + 1,
      resultsCollected: results.length,
    });

    // Small delay between batches to avoid rate limiting
    if (batchIdx < batches.length - 1) {
      await sleep(500);
    }
  }

  log({ phase: 'PHASE_2', msg: 'All batches complete', totalResults: results.length });

  // -------------------------------------------------------
  // PHASE 3: Analysis + Ground Truth + Metrics
  // -------------------------------------------------------
  log({ phase: 'PHASE_3', msg: 'Computing metrics' });

  const gradedSuccessfully = results.filter(r => r.newIsCorrect !== null && !r.error);
  const failedToGrade = results.filter(r => r.newIsCorrect === null || r.error);

  log({ phase: 'PHASE_3', gradedSuccessfully: gradedSuccessfully.length, failedToGrade: failedToGrade.length });

  // OLD vs NEW agreement
  const oldNewAgreements = gradedSuccessfully.filter(r => r.storedIsCorrect === r.newIsCorrect);
  const oldNewDisagreements = gradedSuccessfully.filter(r => r.storedIsCorrect !== r.newIsCorrect);

  // OLD=correct → NEW=wrong (regression risk for already-rostered students)
  const oldCorrectNewWrong = gradedSuccessfully.filter(r => r.storedIsCorrect === true && r.newIsCorrect === false);
  // OLD=wrong → NEW=correct (improvement: grader now accepts what it used to reject)
  const oldWrongNewCorrect = gradedSuccessfully.filter(r => r.storedIsCorrect === false && r.newIsCorrect === true);

  log({
    phase: 'PHASE_3',
    oldNewAgreement: oldNewAgreements.length,
    oldNewDisagreement: oldNewDisagreements.length,
    oldCorrectNewWrong: oldCorrectNewWrong.length,
    oldWrongNewCorrect: oldWrongNewCorrect.length,
  });

  // -------------------------------------------------------
  // PHASE 3b: My Ground Truth Judgments
  // For each answer in our sample, assign truth label
  // We'll embed this in the output for transparency
  // Truth logic:
  //   - If blank/single char/punct only → WRONG
  //   - If student answer = just the word itself (self-referencing) → WRONG
  //   - If student answer is a transliteration of the English word → WRONG
  //   - If student answer is semantically related (Korean or English, paraphrase, synonym, partial) → CORRECT
  //   - If student answer is clearly unrelated/opposite → WRONG
  // -------------------------------------------------------

  // Save regrade results (full data)
  const regradeOutput = {
    gradedAt: new Date().toISOString(),
    totalAnswersInExport: allAnswers.length,
    distinctStudents: extracted.distinctStudents,
    distinctPairs: allDistinct.length,
    wrongPairCount: wrongPairs.length,
    correctPairCount: correctPairs.length,
    wrongSampleSize: wrongSample.length,
    correctSampleSize: correctSample.length,
    totalGraded: gradingSample.length,
    successfullyGraded: gradedSuccessfully.length,
    failedToGrade: failedToGrade.length,
    oldNewAgreements: oldNewAgreements.length,
    oldNewDisagreements: oldNewDisagreements.length,
    oldCorrectNewWrong: oldCorrectNewWrong.length,
    oldWrongNewCorrect: oldWrongNewCorrect.length,
    results,
  };

  writeFileSync(`${EVIDENCE_DIR}/regrade_results_v2.json`, JSON.stringify(regradeOutput, null, 2));
  log({ phase: 'PHASE_3', msg: 'Saved regrade_results_v2.json' });

  writeStatus({
    label: 'REALGRADE2',
    phase: 'COMPLETE',
    totalGraded: gradingSample.length,
    successfullyGraded: gradedSuccessfully.length,
    failedToGrade: failedToGrade.length,
    oldCorrectNewWrong: oldCorrectNewWrong.length,
    oldWrongNewCorrect: oldWrongNewCorrect.length,
  });

  console.log('\n=== REALGRADE2 COMPLETE ===');
  console.log('Total answers in export:', allAnswers.length);
  console.log('Distinct (word, answer) pairs:', allDistinct.length);
  console.log('Wrong pairs (grading priority):', wrongPairs.length);
  console.log('Correct pairs:', correctPairs.length);
  console.log('Grading sample (wrong + correct):', gradingSample.length);
  console.log('Successfully graded:', gradedSuccessfully.length);
  console.log('Failed to grade:', failedToGrade.length);
  console.log('OLD→NEW agreements:', oldNewAgreements.length, `(${(oldNewAgreements.length/gradedSuccessfully.length*100).toFixed(1)}%)`);
  console.log('OLD correct → NEW wrong (regression):', oldCorrectNewWrong.length);
  console.log('OLD wrong → NEW correct (improvement):', oldWrongNewCorrect.length);

  // Print first few regressions for immediate visibility
  if (oldCorrectNewWrong.length > 0) {
    console.log('\n=== REGRESSIONS (OLD=correct, NEW=wrong) ===');
    oldCorrectNewWrong.slice(0, 5).forEach(r => {
      console.log(`  word=${r.word} | answer="${r.studentAnswer}" | correctDef="${(r.correctDefinition||'').slice(0,50)}" | newReasoning="${(r.newReasoning||'').slice(0,100)}"`);
    });
  }

  // Print first few improvements
  if (oldWrongNewCorrect.length > 0) {
    console.log('\n=== IMPROVEMENTS (OLD=wrong, NEW=correct) ===');
    oldWrongNewCorrect.slice(0, 5).forEach(r => {
      console.log(`  word=${r.word} | answer="${r.studentAnswer}" | correctDef="${(r.correctDefinition||'').slice(0,50)}"`);
    });
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  appendFileSync(`${LOGS_DIR}/REALGRADE2.jsonl`, JSON.stringify({ ts: new Date().toISOString(), phase: 'FATAL', error: String(err) }) + '\n');
  writeFileSync(`${LOGS_DIR}/REALGRADE2.status.json`, JSON.stringify({ label: 'REALGRADE2', phase: 'FATAL', error: String(err), updatedAt: new Date().toISOString() }, null, 2));
  process.exit(1);
});
