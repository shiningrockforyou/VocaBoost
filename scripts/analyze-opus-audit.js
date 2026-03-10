/**
 * Analyze Opus 4.6 audit results against GPT-4o-mini and Haiku verdicts.
 *
 * Run with: node scripts/analyze-opus-audit.js
 */

import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('./ai_comparison_completed_opus_4.6_verified.xlsx');

  const report = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8'));

  // Process each disagreement sheet
  for (const sheetName of ['Haiku O - GPT X', 'Haiku X - GPT O']) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      console.log(`Sheet "${sheetName}" not found, skipping.`);
      continue;
    }

    // Find column indices from header row
    const headers = {};
    ws.getRow(1).eachCell((cell, colNum) => {
      headers[cell.value?.toString().trim()] = colNum;
    });

    const verdictCol = headers['Your Verdict (O/X)'] || headers['Verdict'] || headers['Your Verdict'];
    if (!verdictCol) {
      console.log(`\nSheet "${sheetName}": Could not find verdict column.`);
      console.log('Available columns:', Object.keys(headers).join(', '));
      continue;
    }

    let total = 0;
    let opusO = 0;
    let opusX = 0;
    let empty = 0;

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const verdict = row.getCell(verdictCol).value?.toString().trim().toUpperCase();
      if (!verdict) { empty++; return; }
      total++;
      if (verdict === 'O') opusO++;
      else if (verdict === 'X') opusX++;
    });

    console.log(`\n=== ${sheetName} ===`);
    console.log(`Total evaluated: ${total} (${empty} empty)`);
    console.log(`Opus says O: ${opusO}`);
    console.log(`Opus says X: ${opusX}`);

    if (sheetName === 'Haiku O - GPT X') {
      // In this sheet: Haiku said O, GPT said X
      // Opus O = agrees with Haiku (GPT was wrong)
      // Opus X = agrees with GPT (Haiku was too lenient)
      console.log('');
      console.log(`Opus agrees with Haiku (student was correct):  ${opusO} (${(opusO/total*100).toFixed(1)}%)`);
      console.log(`Opus agrees with GPT (student was incorrect):  ${opusX} (${(opusX/total*100).toFixed(1)}%)`);
      console.log('');
      console.log(`=> GPT-4o-mini was WRONG on ${opusO} out of ${total} cases`);
      console.log(`=> Haiku was WRONG on ${opusX} out of ${total} cases`);
    } else if (sheetName === 'Haiku X - GPT O') {
      // In this sheet: Haiku said X, GPT said O
      // Opus O = agrees with GPT (Haiku was too strict)
      // Opus X = agrees with Haiku (GPT was too lenient)
      console.log('');
      console.log(`Opus agrees with GPT (student was correct):    ${opusO} (${(opusO/total*100).toFixed(1)}%)`);
      console.log(`Opus agrees with Haiku (student was incorrect): ${opusX} (${(opusX/total*100).toFixed(1)}%)`);
      console.log('');
      console.log(`=> GPT-4o-mini was WRONG on ${opusX} out of ${total} cases`);
      console.log(`=> Haiku was WRONG on ${opusO} out of ${total} cases`);
    }
  }

  // Overall summary
  console.log('\n========================================');
  console.log('=== OVERALL: WHO GRADED BETTER? ===');
  console.log('========================================');

  // Re-read to compute totals
  let gptWrongTotal = 0;
  let haikuWrongTotal = 0;
  let totalEvaluated = 0;

  for (const sheetName of ['Haiku O - GPT X', 'Haiku X - GPT O']) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const headers = {};
    ws.getRow(1).eachCell((cell, colNum) => {
      headers[cell.value?.toString().trim()] = colNum;
    });
    const verdictCol = headers['Your Verdict (O/X)'] || headers['Verdict'] || headers['Your Verdict'];
    if (!verdictCol) continue;

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const verdict = row.getCell(verdictCol).value?.toString().trim().toUpperCase();
      if (!verdict) return;
      totalEvaluated++;

      if (sheetName === 'Haiku O - GPT X') {
        if (verdict === 'O') gptWrongTotal++;   // GPT said X, should be O
        else haikuWrongTotal++;                  // Haiku said O, should be X
      } else {
        if (verdict === 'X') gptWrongTotal++;   // GPT said O, should be X
        else haikuWrongTotal++;                  // Haiku said X, should be O
      }
    });
  }

  const s = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8')).summary;
  const totalAnswers = s.totalCompared;

  console.log(`\nTotal disagreement cases evaluated by Opus: ${totalEvaluated}`);
  console.log(`Total answers in dataset: ${totalAnswers}`);
  console.log('');
  console.log(`GPT-4o-mini errors (per Opus):   ${gptWrongTotal} out of ${totalAnswers} total (${(gptWrongTotal/totalAnswers*100).toFixed(2)}% error rate)`);
  console.log(`Haiku errors (per Opus):          ${haikuWrongTotal} out of ${totalAnswers} total (${(haikuWrongTotal/totalAnswers*100).toFixed(2)}% error rate)`);
  console.log('');
  if (gptWrongTotal < haikuWrongTotal) {
    console.log('WINNER: GPT-4o-mini made fewer errors.');
  } else if (haikuWrongTotal < gptWrongTotal) {
    console.log('WINNER: Claude Haiku made fewer errors.');
  } else {
    console.log('TIE: Both made the same number of errors.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
