/**
 * REALGRADE2 FINAL — Re-grade real student answers through the LIVE gradeTypedTest Firebase callable.
 *
 * Fixes: filters out empty-correctDefinition items (they cause INTERNAL error in the callable).
 *
 * Safety: READ-ONLY. Never writes to Firestore. Results go to findings files only.
 *
 * Run from /app: node scripts/realgrade2_final.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';

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

const BATCH_SIZE = 20;      // safe batch size
const MAX_WRONG_PAIRS = 500;
const MAX_CORRECT_PAIRS = 200;

function log(obj) {
  const entry = { ts: new Date().toISOString(), ...obj };
  appendFileSync(`${LOGS_DIR}/REALGRADE2.jsonl`, JSON.stringify(entry) + '\n');
  const msg = `[${entry.ts.slice(11,19)}] ${obj.phase||''} ${obj.msg||''} ${obj.error ? 'ERR:'+String(obj.error).slice(0,80) : ''}`;
  console.log(msg.trim());
}

function writeStatus(obj) {
  writeFileSync(`${LOGS_DIR}/REALGRADE2.status.json`, JSON.stringify({ ...obj, updatedAt: new Date().toISOString() }, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(LOGS_DIR, { recursive: true });

  log({ phase: 'START', msg: 'REALGRADE2_final beginning' });
  writeStatus({ label: 'REALGRADE2', phase: 'STARTING' });

  // ===== PHASE 1: Load & deduplicate =====
  log({ phase: 'PHASE_1', msg: 'Loading extracted_answers.json' });
  const extracted = JSON.parse(readFileSync(`${EVIDENCE_DIR}/extracted_answers.json`, 'utf8'));
  const allAnswers = extracted.answers;

  log({ phase: 'PHASE_1', msg: `Loaded ${allAnswers.length} answers, ${extracted.distinctStudents} students` });

  // Deduplicate
  const seenMap = new Map();
  for (const a of allAnswers) {
    if (!a.word || a.studentAnswer === null || a.studentAnswer === undefined) continue;
    const key = a.word.toLowerCase() + '|||' + (a.studentAnswer || '').toLowerCase();
    if (!seenMap.has(key)) seenMap.set(key, { ...a, occurrenceCount: 1 });
    else seenMap.get(key).occurrenceCount++;
  }
  const allDistinct = Array.from(seenMap.values());

  // Filter out empty-definition items (they cause INTERNAL error in the callable)
  // These are genuine data quality issues; we report them separately
  const emptyDefItems = allDistinct.filter(a => !a.correctDefinition || a.correctDefinition.trim().length === 0);
  const validDefItems = allDistinct.filter(a => a.correctDefinition && a.correctDefinition.trim().length > 0);

  const wrongPairs = validDefItems.filter(a => !a.storedIsCorrect);
  const correctPairs = validDefItems.filter(a => a.storedIsCorrect);
  const emptyDefWrong = emptyDefItems.filter(a => !a.storedIsCorrect);
  const emptyDefCorrect = emptyDefItems.filter(a => a.storedIsCorrect);

  log({
    phase: 'PHASE_1',
    msg: 'Deduplicated',
    totalDistinct: allDistinct.length,
    validDef: validDefItems.length,
    emptyDef: emptyDefItems.length,
    wrongPairs: wrongPairs.length,
    correctPairs: correctPairs.length,
  });

  // Select sample
  const wrongSample = wrongPairs
    .sort((a, b) => a.word.localeCompare(b.word))
    .slice(0, MAX_WRONG_PAIRS);

  const correctStep = Math.max(1, Math.floor(correctPairs.length / MAX_CORRECT_PAIRS));
  const correctSample = correctPairs
    .sort((a, b) => a.word.localeCompare(b.word))
    .filter((_, i) => i % correctStep === 0)
    .slice(0, MAX_CORRECT_PAIRS);

  const gradingSample = [...wrongSample, ...correctSample];
  log({ phase: 'PHASE_1', msg: `Sample: ${wrongSample.length} wrong + ${correctSample.length} correct = ${gradingSample.length} total` });
  writeStatus({ label: 'REALGRADE2', phase: 'PHASE_1_COMPLETE', totalToGrade: gradingSample.length });

  // ===== PHASE 2: Firebase auth + grading =====
  log({ phase: 'PHASE_2', msg: 'Initializing Firebase' });
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const functions = getFunctions(app, 'us-central1');

  await signInWithEmailAndPassword(auth, AUDIT_EMAIL, AUDIT_PASS);
  log({ phase: 'PHASE_2', msg: 'Auth SUCCESS' });

  const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', { timeout: 120000 });

  // Split into batches
  const batches = [];
  for (let i = 0; i < gradingSample.length; i += BATCH_SIZE) {
    batches.push(gradingSample.slice(i, i + BATCH_SIZE));
  }
  log({ phase: 'PHASE_2', msg: `${batches.length} batches of ≤${BATCH_SIZE}` });

  const results = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchStart = Date.now();

    const answers = batch.map((item, localIdx) => ({
      wordId: `b${batchIdx}_i${localIdx}`,
      word: item.word,
      correctDefinition: item.correctDefinition,
      studentResponse: item.studentAnswer,
    }));

    let callResult = null;
    let callError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await gradeTypedTest({ answers });
        callResult = response.data;
        break;
      } catch (err) {
        callError = `${err.code}: ${err.message}`;
        if (attempt < 2) await sleep(1500 * (attempt + 1));
      }
    }

    const batchLatency = Date.now() - batchStart;

    if (callResult && callResult.results) {
      const resultMap = {};
      for (const r of callResult.results) resultMap[r.wordId] = r;

      for (let localIdx = 0; localIdx < batch.length; localIdx++) {
        const item = batch[localIdx];
        const wordId = `b${batchIdx}_i${localIdx}`;
        const gr = resultMap[wordId];
        results.push({
          studentLabel: item.studentLabel,
          attemptId: item.attemptId,
          word: item.word,
          correctDefinition: item.correctDefinition,
          studentAnswer: item.studentAnswer,
          occurrenceCount: item.occurrenceCount,
          storedIsCorrect: item.storedIsCorrect,
          storedAiReasoning: item.storedAiReasoning,
          newIsCorrect: gr ? gr.isCorrect : null,
          newReasoning: gr ? (gr.reasoning || null) : null,
          error: gr ? null : (callError || 'no result'),
          batchIdx,
          batchLatencyMs: batchLatency,
        });
      }
      log({ phase: 'PHASE_2', msg: `Batch ${batchIdx+1}/${batches.length} OK`, latencyMs: batchLatency });
    } else {
      for (const item of batch) {
        results.push({
          studentLabel: item.studentLabel,
          attemptId: item.attemptId,
          word: item.word,
          correctDefinition: item.correctDefinition,
          studentAnswer: item.studentAnswer,
          occurrenceCount: item.occurrenceCount,
          storedIsCorrect: item.storedIsCorrect,
          storedAiReasoning: item.storedAiReasoning,
          newIsCorrect: null,
          newReasoning: null,
          error: callError || 'batch failed',
          batchIdx,
          batchLatencyMs: batchLatency,
        });
      }
      log({ phase: 'PHASE_2', msg: `Batch ${batchIdx+1}/${batches.length} FAILED`, error: callError });
    }

    writeStatus({ label: 'REALGRADE2', phase: 'GRADING', completedBatches: batchIdx+1, totalBatches: batches.length });
    if (batchIdx < batches.length - 1) await sleep(400);
  }

  log({ phase: 'PHASE_2', msg: `All batches done, ${results.length} results collected` });

  // ===== PHASE 3: Metrics =====
  const gradedOK = results.filter(r => r.newIsCorrect !== null && !r.error);
  const failedItems = results.filter(r => r.newIsCorrect === null || r.error);

  const oldCorrectNewCorrect = gradedOK.filter(r => r.storedIsCorrect === true && r.newIsCorrect === true);
  const oldCorrectNewWrong   = gradedOK.filter(r => r.storedIsCorrect === true && r.newIsCorrect === false);
  const oldWrongNewCorrect   = gradedOK.filter(r => r.storedIsCorrect === false && r.newIsCorrect === true);
  const oldWrongNewWrong     = gradedOK.filter(r => r.storedIsCorrect === false && r.newIsCorrect === false);

  const agreeCount = oldCorrectNewCorrect.length + oldWrongNewWrong.length;
  const agreeRate = gradedOK.length > 0 ? (agreeCount / gradedOK.length * 100).toFixed(1) : 'N/A';

  log({
    phase: 'PHASE_3',
    gradedOK: gradedOK.length,
    failed: failedItems.length,
    agreements: agreeCount,
    agreeRate: agreeRate + '%',
    oldCorrectNewWrong: oldCorrectNewWrong.length,
    oldWrongNewCorrect: oldWrongNewCorrect.length,
  });

  // Save comprehensive output
  const output = {
    gradedAt: new Date().toISOString(),
    scope: {
      totalAnswersInExport: allAnswers.length,
      distinctStudents: extracted.distinctStudents,
      dateRange: extracted.dateRange,
      allDistinctPairs: allDistinct.length,
      emptyDefPairsSkipped: emptyDefItems.length,
      emptyDefWrong: emptyDefWrong.length,
      emptyDefCorrect: emptyDefCorrect.length,
      validDefWrongPairs: wrongPairs.length,
      validDefCorrectPairs: correctPairs.length,
      wrongSampleGraded: wrongSample.length,
      correctSampleGraded: correctSample.length,
      totalGraded: gradingSample.length,
    },
    metrics: {
      successfullyGraded: gradedOK.length,
      failedToGrade: failedItems.length,
      agreements: agreeCount,
      agreementRate: agreeRate + '%',
      oldCorrectNewCorrect: oldCorrectNewCorrect.length,
      oldCorrectNewWrong: oldCorrectNewWrong.length,    // REGRESSIONS
      oldWrongNewCorrect: oldWrongNewCorrect.length,    // IMPROVEMENTS
      oldWrongNewWrong: oldWrongNewWrong.length,
    },
    emptyDefFinding: {
      description: 'Items with empty correctDefinition cause INTERNAL error in gradeTypedTest callable',
      totalAffected: emptyDefItems.length,
      wrongPairsAffected: emptyDefWrong.length,
      correctPairsAffected: emptyDefCorrect.length,
      sampleWords: emptyDefWrong.slice(0, 10).map(r => r.word),
    },
    regressions: oldCorrectNewWrong.map(r => ({
      word: r.word,
      correctDefinition: r.correctDefinition,
      studentAnswer: r.studentAnswer,
      storedAiReasoning: r.storedAiReasoning,
      newReasoning: r.newReasoning,
      occurrenceCount: r.occurrenceCount,
    })),
    improvements: oldWrongNewCorrect.map(r => ({
      word: r.word,
      correctDefinition: r.correctDefinition,
      studentAnswer: r.studentAnswer,
      storedAiReasoning: r.storedAiReasoning,
      occurrenceCount: r.occurrenceCount,
    })),
    results,
  };

  writeFileSync(`${EVIDENCE_DIR}/regrade_results_final.json`, JSON.stringify(output, null, 2));
  log({ phase: 'PHASE_3', msg: 'Saved regrade_results_final.json' });

  writeStatus({
    label: 'REALGRADE2',
    phase: 'COMPLETE',
    successfullyGraded: gradedOK.length,
    failedToGrade: failedItems.length,
    regressions: oldCorrectNewWrong.length,
    improvements: oldWrongNewCorrect.length,
  });

  // ===== PRINT SUMMARY =====
  console.log('\n=================================================');
  console.log('REALGRADE2 FINAL SUMMARY');
  console.log('=================================================');
  console.log(`Total real answers in export: ${allAnswers.length}`);
  console.log(`Distinct (word, answer) pairs: ${allDistinct.length}`);
  console.log(`  - Empty correctDefinition (skipped, INTERNAL error): ${emptyDefItems.length}`);
  console.log(`    - Were marked wrong: ${emptyDefWrong.length}`);
  console.log(`    - Were marked correct: ${emptyDefCorrect.length}`);
  console.log(`  - Valid definition pairs: ${validDefItems.length}`);
  console.log(`    - Stored wrong: ${wrongPairs.length}`);
  console.log(`    - Stored correct: ${correctPairs.length}`);
  console.log(`\nGrading sample: ${gradingSample.length} (${wrongSample.length} wrong + ${correctSample.length} correct)`);
  console.log(`Successfully graded: ${gradedOK.length}`);
  console.log(`Failed to grade: ${failedItems.length}`);
  console.log(`\nOLD→NEW agreement: ${agreeCount}/${gradedOK.length} (${agreeRate}%)`);
  console.log(`  REGRESSIONS (old=correct, new=WRONG): ${oldCorrectNewWrong.length}`);
  console.log(`  IMPROVEMENTS (old=wrong, new=CORRECT): ${oldWrongNewCorrect.length}`);
  console.log(`  Consistent wrong: ${oldWrongNewWrong.length}`);
  console.log(`  Consistent correct: ${oldCorrectNewCorrect.length}`);

  if (oldCorrectNewWrong.length > 0) {
    console.log('\n=== REGRESSIONS ===');
    oldCorrectNewWrong.forEach(r => {
      console.log(`  [${r.occurrenceCount}x] "${r.word}" | ans="${r.studentAnswer.slice(0,50)}" | def="${(r.correctDefinition||'').slice(0,50)}"`);
      console.log(`    new reason: "${(r.newReasoning||'').slice(0,100)}"`);
    });
  }

  if (oldWrongNewCorrect.length > 0) {
    console.log('\n=== TOP IMPROVEMENTS (old wrong → new correct) ===');
    oldWrongNewCorrect.slice(0, 15).forEach(r => {
      console.log(`  [${r.occurrenceCount}x] "${r.word}" | ans="${r.studentAnswer.slice(0,50)}" | oldReason="${(r.storedAiReasoning||'').slice(0,60)}"`);
    });
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  try {
    appendFileSync(`${LOGS_DIR}/REALGRADE2.jsonl`, JSON.stringify({ ts: new Date().toISOString(), phase: 'FATAL', error: String(err) }) + '\n');
    writeFileSync(`${LOGS_DIR}/REALGRADE2.status.json`, JSON.stringify({ label: 'REALGRADE2', phase: 'FATAL', error: String(err), updatedAt: new Date().toISOString() }, null, 2));
  } catch {}
  process.exit(1);
});
