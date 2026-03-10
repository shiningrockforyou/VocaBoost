/**
 * Extract all cases where Haiku was wrong (per Opus audit) for pattern analysis.
 *
 * Run with: node scripts/extract-haiku-errors.js
 */

import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'fs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('./ai_comparison_evaluated_unbiased_run_by_opus_4.6.xlsx');
  const report = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8'));

  // Build lookup maps with full detail
  const haikuO_gptX = new Map();
  for (const item of report.haikuO_noGroundTruth) {
    haikuO_gptX.set(item.word + '|||' + item.studentResponse, item);
  }
  const haikuX_gptO = new Map();
  for (const item of report.haikuStricter) {
    haikuX_gptO.set(item.word + '|||' + item.studentResponse, item);
  }

  const ws = wb.getWorksheet('Results');
  const haikuTooLenient = [];
  const haikuTooStrict = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const word = row.getCell(2).value ? row.getCell(2).value.toString().trim() : '';
    const correctEN = row.getCell(3).value ? row.getCell(3).value.toString().trim() : '';
    const correctKO = row.getCell(4).value ? row.getCell(4).value.toString().trim() : '';
    const studentResponse = row.getCell(5).value ? row.getCell(5).value.toString().trim() : '';
    const verdict = row.getCell(6).value ? row.getCell(6).value.toString().trim().toUpperCase() : '';
    if (!word || !verdict) return;

    const key = word + '|||' + studentResponse;

    if (haikuO_gptX.has(key) && verdict === 'X') {
      const orig = haikuO_gptX.get(key);
      haikuTooLenient.push({
        word,
        correctEN,
        correctKO,
        studentResponse,
        haikuReasoning: orig.haiku ? orig.haiku.reasoning || '' : '',
        gptReasoning: orig.gpt ? orig.gpt.reasoning || '' : '',
      });
    } else if (haikuX_gptO.has(key) && verdict === 'O') {
      const orig = haikuX_gptO.get(key);
      haikuTooStrict.push({
        word,
        correctEN,
        correctKO,
        studentResponse,
        haikuReasoning: orig.haiku ? orig.haiku.reasoning || '' : '',
        gptReasoning: orig.gpt ? orig.gpt.reasoning || '' : '',
      });
    }
  });

  console.log('=== HAIKU TOO LENIENT (' + haikuTooLenient.length + ' cases) ===');
  console.log('Haiku said O, but answer was actually X\n');
  for (let i = 0; i < haikuTooLenient.length; i++) {
    const c = haikuTooLenient[i];
    console.log((i + 1) + '. ' + c.word);
    console.log('   Def (EN): ' + c.correctEN);
    console.log('   Def (KO): ' + c.correctKO);
    console.log('   Student:  ' + c.studentResponse);
    console.log('   Haiku:    ' + (c.haikuReasoning || '(marked correct, no reasoning)'));
    console.log('   GPT:      ' + c.gptReasoning);
    console.log('');
  }

  console.log('\n=== HAIKU TOO STRICT (' + haikuTooStrict.length + ' cases) ===');
  console.log('Haiku said X, but answer was actually O\n');
  for (let i = 0; i < haikuTooStrict.length; i++) {
    const c = haikuTooStrict[i];
    console.log((i + 1) + '. ' + c.word);
    console.log('   Def (EN): ' + c.correctEN);
    console.log('   Def (KO): ' + c.correctKO);
    console.log('   Student:  ' + c.studentResponse);
    console.log('   Haiku:    ' + c.haikuReasoning);
    console.log('');
  }

  // Save to JSON for further analysis
  writeFileSync('./haiku_errors_detail.json', JSON.stringify({
    tooLenient: haikuTooLenient,
    tooStrict: haikuTooStrict,
  }, null, 2));
  console.log('Saved to haiku_errors_detail.json');
}

main().catch(err => { console.error(err); process.exit(1); });
