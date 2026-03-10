/**
 * Analyze the unbiased Opus 4.6 audit — single merged sheet.
 * Matches rows back to original disagreement type by word + studentResponse.
 *
 * Run with: node scripts/analyze-unbiased-audit.js
 */

import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('./ai_comparison_evaluated_unbiased_run_by_opus_4.6.xlsx');
  const report = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8'));

  // Build lookup sets from original report
  // Key: "word|||studentResponse" (using ||| to avoid collisions)
  const haikuO_gptX = new Set(); // Haiku said O, GPT said X
  const haikuX_gptO = new Set(); // Haiku said X, GPT said O

  for (const item of report.haikuO_noGroundTruth) {
    haikuO_gptX.add(`${item.word}|||${item.studentResponse}`);
  }
  for (const item of report.haikuStricter) {
    haikuX_gptO.add(`${item.word}|||${item.studentResponse}`);
  }

  const ws = wb.getWorksheet('Results');

  let totalEvaluated = 0;
  // Haiku O, GPT X cases
  let hogx_total = 0, hogx_opusO = 0, hogx_opusX = 0;
  // Haiku X, GPT O cases
  let hxgo_total = 0, hxgo_opusO = 0, hxgo_opusX = 0;
  let unmatched = 0;

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const word = row.getCell(2).value?.toString().trim();
    const studentResponse = row.getCell(5).value?.toString().trim();
    const verdict = row.getCell(6).value?.toString().trim().toUpperCase();
    if (!word || !verdict) return;

    const key = `${word}|||${studentResponse}`;
    totalEvaluated++;

    if (haikuO_gptX.has(key)) {
      hogx_total++;
      if (verdict === 'O') hogx_opusO++;
      else hogx_opusX++;
    } else if (haikuX_gptO.has(key)) {
      hxgo_total++;
      if (verdict === 'O') hxgo_opusO++;
      else hxgo_opusX++;
    } else {
      unmatched++;
    }
  });

  const totalAnswers = report.summary.totalCompared;

  console.log('=== UNBIASED OPUS 4.6 AUDIT RESULTS ===\n');
  console.log(`Total rows evaluated: ${totalEvaluated}`);
  console.log(`Matched to "Haiku O, GPT X": ${hogx_total}`);
  console.log(`Matched to "Haiku X, GPT O": ${hxgo_total}`);
  console.log(`Unmatched: ${unmatched}`);

  console.log('\n--- Haiku O, GPT X (${hogx_total} cases) ---');
  console.log(`  Opus says O (GPT was wrong):   ${hogx_opusO} (${hogx_total ? (hogx_opusO/hogx_total*100).toFixed(1) : 0}%)`);
  console.log(`  Opus says X (Haiku was wrong):  ${hogx_opusX} (${hogx_total ? (hogx_opusX/hogx_total*100).toFixed(1) : 0}%)`);

  console.log(`\n--- Haiku X, GPT O (${hxgo_total} cases) ---`);
  console.log(`  Opus says O (Haiku was wrong):  ${hxgo_opusO} (${hxgo_total ? (hxgo_opusO/hxgo_total*100).toFixed(1) : 0}%)`);
  console.log(`  Opus says X (GPT was wrong):    ${hxgo_opusX} (${hxgo_total ? (hxgo_opusX/hxgo_total*100).toFixed(1) : 0}%)`);

  // Total errors
  const gptErrors = hogx_opusO + hxgo_opusX;   // GPT wrong in both directions
  const haikuErrors = hogx_opusX + hxgo_opusO;  // Haiku wrong in both directions

  console.log('\n========================================');
  console.log('=== FINAL SCOREBOARD ===');
  console.log('========================================\n');
  console.log(`GPT-4o-mini errors:   ${gptErrors} / ${totalAnswers} (${(gptErrors/totalAnswers*100).toFixed(2)}% error rate)`);
  console.log(`Haiku errors:         ${haikuErrors} / ${totalAnswers} (${(haikuErrors/totalAnswers*100).toFixed(2)}% error rate)`);
  console.log('');
  console.log(`On disagreements only:`);
  console.log(`  GPT wrong:   ${gptErrors} / ${hogx_total + hxgo_total}`);
  console.log(`  Haiku wrong: ${haikuErrors} / ${hogx_total + hxgo_total}`);
  console.log('');
  if (gptErrors < haikuErrors) {
    console.log('RESULT: GPT-4o-mini is more accurate.');
  } else if (haikuErrors < gptErrors) {
    console.log('RESULT: Claude Haiku is more accurate.');
  } else {
    console.log('RESULT: Tie.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
