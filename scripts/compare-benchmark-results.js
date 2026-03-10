/**
 * Compare Claude Haiku vs GPT-4o-mini grading results.
 *
 * Reads claude_benchmark_results.json and produces:
 *   - ai_comparison_report.json (full detailed report)
 *   - Console summary stats
 *
 * Run with: node scripts/compare-benchmark-results.js
 */

import { readFileSync, writeFileSync } from 'fs';

const CUTOFF_DATE = '2026-01-01T00:00:00.000Z';

function main() {
  const allResults = JSON.parse(readFileSync('./claude_benchmark_results.json', 'utf8'));

  // submittedAt lives in the benchmark file, not the results — join by attemptId
  const benchmarkData = JSON.parse(readFileSync('./ai_grading_benchmark.json', 'utf8'));
  const dateMap = new Map();
  for (const b of benchmarkData) {
    dateMap.set(b.attemptId, b.submittedAt);
  }

  const results = allResults.filter(a => {
    const date = dateMap.get(a.attemptId);
    return date && date >= CUTOFF_DATE;
  });
  console.log(`Loaded ${allResults.length} attempts, ${results.length} from Jan 1 onward.\n`);

  // Buckets
  const agreeCorrect = [];      // Both O
  const agreeIncorrect = [];    // Both X, no approved challenge
  const bothWrong = [];         // Both X, but challenge approved (both AIs wrong)
  const haikuRight = [];        // Haiku O, 4o-mini X, challenge approved
  const haikuO_noGround = [];   // Haiku O, 4o-mini X, no ground truth
  const haikuStricter = [];     // Haiku X, 4o-mini O
  const skipped = [];           // Blanks or missing Claude result

  let totalCompared = 0;

  for (const attempt of results) {
    // Build Claude results map for this attempt
    const claudeMap = new Map();
    for (const cr of (attempt.claudeResults || [])) {
      if (cr.wordId) claudeMap.set(cr.wordId, cr);
    }

    for (const current of attempt.currentAIResults) {
      // Skip blanks — auto-marked, never sent to AI
      if (!current.studentResponse || current.studentResponse.trim() === '') {
        skipped.push({ attemptId: attempt.attemptId, wordId: current.wordId, reason: 'blank' });
        continue;
      }

      const claude = claudeMap.get(current.wordId);
      if (!claude) {
        skipped.push({ attemptId: attempt.attemptId, wordId: current.wordId, reason: 'missing_claude_result' });
        continue;
      }

      totalCompared++;

      const gptCorrect = current.isCorrect;
      const haikuCorrect = claude.isCorrect;
      const challengeApproved = current.challengeStatus === 'approved';

      const detail = {
        attemptId: attempt.attemptId,
        wordId: current.wordId,
        word: current.word,
        studentResponse: current.studentResponse,
        gpt: { isCorrect: gptCorrect, reasoning: current.reasoning },
        haiku: { isCorrect: haikuCorrect, reasoning: claude.reasoning || null },
        challengeStatus: current.challengeStatus || null,
        challengeNote: current.challengeNote || null,
      };

      if (gptCorrect && haikuCorrect) {
        agreeCorrect.push(detail);
      } else if (!gptCorrect && !haikuCorrect) {
        if (challengeApproved) {
          bothWrong.push(detail);
        } else {
          agreeIncorrect.push(detail);
        }
      } else if (haikuCorrect && !gptCorrect) {
        if (challengeApproved) {
          haikuRight.push(detail);
        } else {
          haikuO_noGround.push(detail);
        }
      } else if (!haikuCorrect && gptCorrect) {
        haikuStricter.push(detail);
      }
    }
  }

  // Summary
  const totalDisagreements = haikuRight.length + haikuO_noGround.length + haikuStricter.length;
  const agreementRate = ((agreeCorrect.length + agreeIncorrect.length) / totalCompared * 100).toFixed(2);

  console.log('=== COMPARISON SUMMARY ===\n');
  console.log(`Total answers compared:    ${totalCompared}`);
  console.log(`Skipped (blank/missing):   ${skipped.length}`);
  console.log('');
  console.log(`Agreement rate:            ${agreementRate}%`);
  console.log(`Total disagreements:       ${totalDisagreements}`);
  console.log('');
  console.log('--- Agreement ---');
  console.log(`Both correct (O/O):        ${agreeCorrect.length}`);
  console.log(`Both incorrect (X/X):      ${agreeIncorrect.length}`);
  console.log(`Both wrong (X/X, challenge approved): ${bothWrong.length}`);
  console.log('');
  console.log('--- Disagreements ---');
  console.log(`Haiku O, GPT X (challenge approved = Haiku right): ${haikuRight.length}`);
  console.log(`Haiku O, GPT X (no ground truth):                  ${haikuO_noGround.length}`);
  console.log(`Haiku X, GPT O (Haiku stricter):                   ${haikuStricter.length}`);

  // Write full report
  const report = {
    summary: {
      totalCompared,
      skipped: skipped.length,
      agreementRate: parseFloat(agreementRate),
      agreeCorrect: agreeCorrect.length,
      agreeIncorrect: agreeIncorrect.length,
      bothWrong: bothWrong.length,
      haikuRight: haikuRight.length,
      haikuO_noGroundTruth: haikuO_noGround.length,
      haikuStricter: haikuStricter.length,
    },
    bothWrong,
    haikuRight,
    haikuO_noGroundTruth: haikuO_noGround,
    haikuStricter,
  };

  writeFileSync('./ai_comparison_report.json', JSON.stringify(report, null, 2));
  console.log('\nFull report saved to ai_comparison_report.json');
}

main();
