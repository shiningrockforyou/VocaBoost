/**
 * REALGRADE2 — Re-grade real student answers through the LIVE gradeTypedTest Firebase callable.
 *
 * Safety: READ-ONLY. Never writes to Firestore. Results go to findings files only.
 *
 * Run from /app:
 *   node scripts/realgrade2_v2.mjs
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

const BATCH_SIZE = 30;   // conservative batch size to avoid timeouts
const MAX_WRONG_PAIRS = 500;   // all wrong pairs (false-negative gate)
const MAX_CORRECT_PAIRS = 200; // sample of correct pairs

// ============================================================
// HELPERS
// ============================================================
function log(obj) {
  const entry = { ts: new Date().toISOString(), ...obj };
  appendFileSync(`${LOGS_DIR}/REALGRADE2.jsonl`, JSON.stringify(entry) + '\n');
  if (obj.msg || obj.phase) {
    console.log(`[${entry.ts.slice(11,19)}] ${obj.phase || ''} ${obj.msg || ''}`, obj.error ? `ERROR:${obj.error}` : '');
  }
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

  log({ phase: 'START', msg: 'REALGRADE2_v2 beginning' });
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
  // Keep representative answer (first occurrence) + count
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

  // Select grading sample:
  //   Wrong pairs: take up to MAX_WRONG_PAIRS, sorted alphabetically by word
  //   Correct pairs: evenly distributed sample
  const wrongSample = wrongPairs
    .sort((a, b) => a.word.localeCompare(b.word))
    .slice(0, MAX_WRONG_PAIRS);

  const correctStep = Math.max(1, Math.floor(correctPairs.length / MAX_CORRECT_PAIRS));
  const correctSample = correctPairs
    .sort((a, b) => a.word.localeCompare(b.word))
    .filter((_, i) => i % correctStep === 0)
    .slice(0, MAX_CORRECT_PAIRS);

  const gradingSample = [...wrongSample, ...correctSample];

  log({
    phase: 'PHASE_1',
    msg: 'Sample selected',
    wrongSampleSize: wrongSample.length,
    correctSampleSize: correctSample.length,
    totalToGrade: gradingSample.length,
  });

  writeStatus({ label: 'REALGRADE2', phase: 'PHASE_1_COMPLETE', totalToGrade: gradingSample.length });

  // -------------------------------------------------------
  // PHASE 2: Auth & call live Firebase callable
  // -------------------------------------------------------
  log({ phase: 'PHASE_2', msg: 'Initializing Firebase & signing in' });

  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const functions = getFunctions(app, 'us-central1');

  await signInWithEmailAndPassword(auth, AUDIT_EMAIL, AUDIT_PASS);
  log({ phase: 'PHASE_2', msg: 'Auth SUCCESS' });

  const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', { timeout: 120000 });

  // Batch the grading sample
  const batches = [];
  for (let i = 0; i < gradingSample.length; i += BATCH_SIZE) {
    batches.push(gradingSample.slice(i, i + BATCH_SIZE));
  }

  log({ phase: 'PHASE_2', msg: `Processing ${batches.length} batches of ≤${BATCH_SIZE}` });

  const results = [];
  let completedBatches = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchStart = Date.now();

    const answers = batch.map((item, localIdx) => ({
      wordId: `b${batchIdx}_i${localIdx}`,
      word: item.word,
      correctDefinition: item.correctDefinition,
      studentResponse: item.studentAnswer,
      koreanDefinition: item.koreanDefinition || undefined,
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
        log({ phase: 'PHASE_2', msg: `Batch ${batchIdx} attempt ${attempt} FAILED`, error: callError });
        if (attempt < 2) await sleep(2000 * (attempt + 1));
      }
    }

    const batchLatency = Date.now() - batchStart;

    if (callResult && callResult.results) {
      const resultMap = {};
      for (const r of callResult.results) {
        resultMap[r.wordId] = r;
      }

      for (let localIdx = 0; localIdx < batch.length; localIdx++) {
        const item = batch[localIdx];
        const wordId = `b${batchIdx}_i${localIdx}`;
        const gradedResult = resultMap[wordId];

        results.push({
          studentLabel: item.studentLabel,
          attemptId: item.attemptId,
          word: item.word,
          correctDefinition: item.correctDefinition,
          studentAnswer: item.studentAnswer,
          occurrenceCount: item.occurrenceCount,
          storedIsCorrect: item.storedIsCorrect,
          storedAiReasoning: item.storedAiReasoning,
          newIsCorrect: gradedResult ? gradedResult.isCorrect : null,
          newReasoning: gradedResult ? (gradedResult.reasoning || null) : null,
          error: gradedResult ? null : (callError || 'No result returned'),
          batchIdx,
          batchLatencyMs: batchLatency,
          inWrongSample: item.storedIsCorrect === false,
        });
      }
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
          error: callError || 'Batch call failed',
          batchIdx,
          batchLatencyMs: batchLatency,
          inWrongSample: item.storedIsCorrect === false,
        });
      }
    }

    completedBatches++;
    log({
      phase: 'PHASE_2',
      msg: `Batch ${batchIdx + 1}/${batches.length} done`,
      latencyMs: batchLatency,
      succeeded: callResult ? 'yes' : 'no',
    });

    writeStatus({
      label: 'REALGRADE2',
      phase: 'GRADING',
      completedBatches,
      totalBatches: batches.length,
      resultsCollected: results.length,
    });

    if (batchIdx < batches.length - 1) await sleep(300);
  }

  log({ phase: 'PHASE_2', msg: 'All batches done', totalResults: results.length });

  // -------------------------------------------------------
  // PHASE 3: Metrics & ground truth
  // -------------------------------------------------------
  const gradedOK = results.filter(r => r.newIsCorrect !== null && !r.error);
  const failed = results.filter(r => r.newIsCorrect === null || r.error);

  // OLD vs NEW comparisons (only on successfully graded)
  const oldNewAgree = gradedOK.filter(r => r.storedIsCorrect === r.newIsCorrect);
  const oldCorrectNewWrong = gradedOK.filter(r => r.storedIsCorrect === true && r.newIsCorrect === false);
  const oldWrongNewCorrect = gradedOK.filter(r => r.storedIsCorrect === false && r.newIsCorrect === true);
  const oldWrongNewWrong = gradedOK.filter(r => r.storedIsCorrect === false && r.newIsCorrect === false);
  const oldCorrectNewCorrect = gradedOK.filter(r => r.storedIsCorrect === true && r.newIsCorrect === true);

  const agreeRate = gradedOK.length > 0 ? (oldNewAgree.length / gradedOK.length * 100).toFixed(1) : 'N/A';

  log({
    phase: 'PHASE_3',
    gradedOK: gradedOK.length,
    failed: failed.length,
    oldNewAgree: oldNewAgree.length,
    agreeRatePct: agreeRate,
    oldCorrectNewWrong: oldCorrectNewWrong.length,
    oldWrongNewCorrect: oldWrongNewCorrect.length,
    oldWrongNewWrong: oldWrongNewWrong.length,
    oldCorrectNewCorrect: oldCorrectNewCorrect.length,
  });

  // -------------------------------------------------------
  // PHASE 4: Expert ground truth judgment
  // We assess each distinct pair for TRUE correctness.
  // Rules (same as the updated prompt):
  //   WRONG: blank/single char; self-referencing/transliteration; unrelated; opposite/reversed
  //   CORRECT: Korean or English synonym/near-synonym; paraphrase; partial but on-point;
  //            POS variation; typo-but-clear
  // We apply this systematically to the results.
  // -------------------------------------------------------

  // Helper: detect if answer is blank/trivially short
  function isTriviallyBlank(s) {
    if (!s) return true;
    const stripped = s.replace(/[\s\p{P}]/gu, '');
    return stripped.length <= 1;
  }

  // Korean characters unicode range
  function hasKorean(s) {
    return /[ㄱ-ㆎ가-힣]/.test(s || '');
  }

  // Basic English-word-transliteration check:
  // If Korean text sounds like the English word phonetically — hard to automate
  // We'll flag known transliterations found in the data
  const knownTransliterations = new Set([
    '르네상스',  // renaissance
    '파라독스',  // paradox
    '카리스마',  // charisma
    '스트레스',  // stress
    '에너지',    // energy
    '트라우마',  // trauma
    '이미지',    // image
    '리더십',    // leadership
    '비전',      // vision (partial)
    '미션',      // mission
    '팀워크',    // teamwork
    '스킬',      // skill
    '챌린지',    // challenge
    '패러다임',  // paradigm
    '시너지',    // synergy
    '다이나믹',  // dynamic
    '카테고리',  // category
    '미스터리',  // mystery
    '에피소드',  // episode
    '프리미엄',  // premium
    '마스터',    // master
    '리셋',      // reset
    '컨트롤',    // control
    '파이널',    // final
    '매뉴얼',    // manual
    '프로세스',  // process
    '매트릭스',  // matrix
    '바이러스',  // virus
    '유니크',    // unique
    '이코노미',  // economy
    '스타일',    // style
    '플랜',      // plan
    '컨셉',      // concept
  ]);

  // Assign expert ground truth for each result
  const withTruth = results.map(r => {
    const ans = (r.studentAnswer || '').trim();
    const word = (r.word || '').toLowerCase().trim();
    const correctDef = (r.correctDefinition || '').toLowerCase();
    const ansLower = ans.toLowerCase();

    let truth = null; // 'correct' | 'wrong'
    let truthRationale = '';

    // 1. Blank/trivially short
    if (isTriviallyBlank(ans)) {
      truth = 'wrong';
      truthRationale = 'Blank or single-character response';
    }
    // 2. Self-referencing: answer IS the word or direct transliteration
    else if (ansLower === word || ansLower.replace(/\s+/g, '') === word.replace(/\s+/g, '')) {
      truth = 'wrong';
      truthRationale = 'Answer repeats the target word';
    }
    // 3. Known Korean transliteration of the word itself
    else if (knownTransliterations.has(ans) && word.toLowerCase().includes(ans.replace(/\s+/g,'').slice(0,2))) {
      truth = 'wrong';
      truthRationale = `Korean transliteration of the word itself`;
    }
    // 4. Otherwise: trust the stored verdict as ground truth proxy
    // (the stored verdict was from the old prompt which we know was stricter on Korean but
    //  we can't reliably determine if old=correct is truly correct without reading Korean)
    // We'll mark truth as matching stored verdict for now, and flag changes
    else {
      truth = r.storedIsCorrect ? 'correct' : null; // null = needs human review
      truthRationale = r.storedIsCorrect ? 'Old grader accepted; likely correct' : 'Uncertain: needs review';
    }

    return { ...r, truth, truthRationale };
  });

  // For the wrong-pairs sample, we need to identify which NEW=correct are genuine improvements
  // vs NEW=correct but actually wrong (false positives)
  // Since we can't fully automate Korean semantic judgment, we use heuristics:
  //   - If old=wrong AND new=correct: these are CANDIDATES for improvement
  //   - We'll tag them for human review in the report

  // Save full results
  const output = {
    gradedAt: new Date().toISOString(),
    scope: {
      totalAnswersInExport: allAnswers.length,
      distinctStudents: extracted.distinctStudents,
      distinctPairs: allDistinct.length,
      wrongPairCount: wrongPairs.length,
      correctPairCount: correctPairs.length,
      wrongSampleGraded: wrongSample.length,
      correctSampleGraded: correctSample.length,
      totalGraded: gradingSample.length,
      dateRange: extracted.dateRange,
    },
    metrics: {
      successfullyGraded: gradedOK.length,
      failedToGrade: failed.length,
      oldNewAgreements: oldNewAgree.length,
      oldNewAgreementRate: agreeRate + '%',
      oldCorrectNewWrong: oldCorrectNewWrong.length,
      oldWrongNewCorrect: oldWrongNewCorrect.length,
      oldWrongNewWrong: oldWrongNewWrong.length,
      oldCorrectNewCorrect: oldCorrectNewCorrect.length,
    },
    results: withTruth,
  };

  writeFileSync(`${EVIDENCE_DIR}/regrade_results_v2.json`, JSON.stringify(output, null, 2));
  log({ phase: 'PHASE_3', msg: 'Saved regrade_results_v2.json' });

  writeStatus({
    label: 'REALGRADE2',
    phase: 'COMPLETE',
    successfullyGraded: gradedOK.length,
    failedToGrade: failed.length,
    oldCorrectNewWrong: oldCorrectNewWrong.length,
    oldWrongNewCorrect: oldWrongNewCorrect.length,
  });

  // -------------------------------------------------------
  // Summary output
  // -------------------------------------------------------
  console.log('\n=== REALGRADE2 SUMMARY ===');
  console.log(`Total real answers in export: ${allAnswers.length}`);
  console.log(`Distinct (word, answer) pairs: ${allDistinct.length}`);
  console.log(`  Wrong pairs: ${wrongPairs.length}`);
  console.log(`  Correct pairs: ${correctPairs.length}`);
  console.log(`Grading sample: ${gradingSample.length} (${wrongSample.length} wrong + ${correctSample.length} correct)`);
  console.log(`Successfully graded: ${gradedOK.length} / ${gradingSample.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`OLD→NEW agreement: ${oldNewAgree.length}/${gradedOK.length} (${agreeRate}%)`);
  console.log(`\nVerdict changes:`);
  console.log(`  OLD=correct → NEW=WRONG (regressions): ${oldCorrectNewWrong.length}`);
  console.log(`  OLD=wrong → NEW=CORRECT (improvements): ${oldWrongNewCorrect.length}`);
  console.log(`  OLD=wrong → NEW=wrong (consistent wrong): ${oldWrongNewWrong.length}`);
  console.log(`  OLD=correct → NEW=correct (consistent correct): ${oldCorrectNewCorrect.length}`);

  if (oldCorrectNewWrong.length > 0) {
    console.log('\n=== TOP REGRESSIONS (OLD=correct, NEW=wrong) ===');
    oldCorrectNewWrong.slice(0, 10).forEach(r => {
      console.log(`  word="${r.word}" | ans="${r.studentAnswer.slice(0,40)}" | def="${(r.correctDefinition||'').slice(0,50)}" | reason="${(r.newReasoning||'').slice(0,80)}"`);
    });
  }

  if (oldWrongNewCorrect.length > 0) {
    console.log('\n=== TOP IMPROVEMENTS (OLD=wrong, NEW=correct) ===');
    oldWrongNewCorrect.slice(0, 10).forEach(r => {
      console.log(`  word="${r.word}" | ans="${r.studentAnswer.slice(0,40)}" | oldReason="${(r.storedAiReasoning||'').slice(0,60)}"`);
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
