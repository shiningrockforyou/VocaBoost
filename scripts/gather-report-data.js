/**
 * Gather all stats for the comprehensive audit report.
 * Run with: node scripts/gather-report-data.js
 */

import { readFileSync, writeFileSync } from 'fs';

const report = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8'));
const benchmark = JSON.parse(readFileSync('./ai_grading_benchmark.json', 'utf8'));
const haikuErrors = JSON.parse(readFileSync('./haiku_errors_detail.json', 'utf8'));
const attempts = JSON.parse(readFileSync('./typed_test_answers_export.json', 'utf8'));
const claudeResults = JSON.parse(readFileSync('./claude_benchmark_results.json', 'utf8'));

const s = report.summary;
const hogx = report.haikuO_noGroundTruth;
const hxgo = report.haikuStricter;

// 1. Challenge status breakdown
const hogx_challenge = { none: 0, pending: 0, rejected: 0, approved: 0 };
for (const c of hogx) hogx_challenge[c.challengeStatus || 'none']++;

const hxgo_challenge = { none: 0, pending: 0, rejected: 0, approved: 0 };
for (const c of hxgo) hxgo_challenge[c.challengeStatus || 'none']++;

// 2. Top disagreement words
const wordFreqHOGX = {};
for (const c of hogx) wordFreqHOGX[c.word] = (wordFreqHOGX[c.word] || 0) + 1;
const topWordsHOGX = Object.entries(wordFreqHOGX).sort((a, b) => b[1] - a[1]).slice(0, 25);

const wordFreqHXGO = {};
for (const c of hxgo) wordFreqHXGO[c.word] = (wordFreqHXGO[c.word] || 0) + 1;
const topWordsHXGO = Object.entries(wordFreqHXGO).sort((a, b) => b[1] - a[1]).slice(0, 25);

// 3. Attempt-level stats
const scores = attempts.filter(a => a.score != null).map(a => a.score);
const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
const medianScore = scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)];

const sessionTypes = { new: 0, review: 0, other: 0 };
for (const a of attempts) {
  if (a.sessionType === 'new') sessionTypes.new++;
  else if (a.sessionType === 'review') sessionTypes.review++;
  else sessionTypes.other++;
}

// 4. Date range
const dates = benchmark.map(b => b.submittedAt).filter(Boolean).sort();

// 5. Haiku error patterns
const tooLenient = haikuErrors.tooLenient;
const tooStrict = haikuErrors.tooStrict;

const questionMarkCount = tooLenient.filter(c => c.studentResponse === '?').length;

// Korean def matching in too-strict
let koDefMatchExact = 0;
let koDefMatchPartial = 0;
for (const c of tooStrict) {
  const ko = (c.correctKO || '').trim();
  const resp = (c.studentResponse || '').trim();
  if (!ko || !resp) continue;
  if (ko === resp) { koDefMatchExact++; continue; }
  const koParts = ko.split(/[,;]/);
  for (const part of koParts) {
    if (part.trim() === resp) { koDefMatchExact++; break; }
    if (part.trim().includes(resp) || resp.includes(part.trim())) { koDefMatchPartial++; break; }
  }
}

// 6. Per-answer language analysis in disagreements
let koreanResponses = 0;
let englishResponses = 0;
let mixedResponses = 0;
const hasCJK = (s) => /[\uac00-\ud7af\u4e00-\u9fff]/.test(s);
const hasLatin = (s) => /[a-zA-Z]/.test(s);
for (const c of [...hogx, ...hxgo]) {
  const r = c.studentResponse || '';
  const cjk = hasCJK(r);
  const lat = hasLatin(r);
  if (cjk && lat) mixedResponses++;
  else if (cjk) koreanResponses++;
  else englishResponses++;
}

// 7. Unique students and lists
const uniqueStudents = new Set(attempts.map(a => a.studentId)).size;
const uniqueLists = new Set(attempts.filter(a => a.listId).map(a => a.listId)).size;

// 8. Answers per attempt distribution
const answersPerAttempt = attempts.map(a => a.answers.length);
const avgAnswers = (answersPerAttempt.reduce((a, b) => a + b, 0) / answersPerAttempt.length).toFixed(1);

// 9. GPT reasoning categories (from disagreements where GPT said X)
const gptReasons = {};
for (const c of hogx) {
  const r = (c.gpt.reasoning || '').toLowerCase();
  let cat = 'other';
  if (r.includes('missing') || r.includes('no answer')) cat = 'missing_answer';
  else if (r.includes('different concept') || r.includes('different meaning')) cat = 'different_concept';
  else if (r.includes('too short') || r.includes('response too short')) cat = 'too_short';
  else if (r.includes('self-referenc')) cat = 'self_referencing';
  else if (r.includes('reverse')) cat = 'reverse_meaning';
  else if (r.includes('unable to grade')) cat = 'unable_to_grade';
  else if (r.includes('irrelevant') || r.includes('contradictory')) cat = 'irrelevant';
  else if (r.includes('vague') || r.includes('too general')) cat = 'too_vague';
  gptReasons[cat] = (gptReasons[cat] || 0) + 1;
}

// 10. Haiku reasoning categories (from disagreements where Haiku said X)
const haikuReasons = {};
for (const c of hxgo) {
  const r = (c.haiku.reasoning || '').toLowerCase();
  let cat = 'other';
  if (r.includes('too narrow') || r.includes('too general') || r.includes('too vague')) cat = 'too_narrow';
  else if (r.includes('noun') || r.includes('verb') || r.includes('adjective') || r.includes('part-of-speech')) cat = 'part_of_speech';
  else if (r.includes('different concept') || r.includes('different meaning')) cat = 'different_concept';
  else if (r.includes('reverse')) cat = 'reverse_meaning';
  else if (r.includes('self-referenc') || r.includes('proper noun') || r.includes('historical')) cat = 'self_referencing';
  else if (r.includes('missing') || r.includes('unclear')) cat = 'unclear_response';
  else if (r.includes('korean definition') || r.includes('provided definition')) cat = 'rejected_ko_def';
  haikuReasons[cat] = (haikuReasons[cat] || 0) + 1;
}

const output = {
  summary: s,
  dateRange: { earliest: dates[0], latest: dates[dates.length - 1] },
  datasetSize: {
    totalAttempts: attempts.length,
    benchmarkAttempts: benchmark.length,
    totalAnswersCompared: s.totalCompared,
    skipped: s.skipped,
    uniqueStudents,
    uniqueLists,
    avgAnswersPerAttempt: avgAnswers,
  },
  scoreStats: { avgScore, medianScore },
  sessionTypes,
  challengeBreakdown: { hogx: hogx_challenge, hxgo: hxgo_challenge },
  topDisagreementWords: { haikuO_gptX: topWordsHOGX, haikuX_gptO: topWordsHXGO },
  responseLanguage: { korean: koreanResponses, english: englishResponses, mixed: mixedResponses },
  haikuErrorPatterns: {
    tooLenient: { total: tooLenient.length, questionMark: questionMarkCount },
    tooStrict: { total: tooStrict.length, koDefMatchExact, koDefMatchPartial },
  },
  gptReasonCategories: gptReasons,
  haikuReasonCategories: haikuReasons,
};

writeFileSync('./report_data.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
