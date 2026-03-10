/**
 * Export AI comparison disagreements to Excel for independent evaluation.
 *
 * Run with: node scripts/export-comparison-excel.js
 *
 * Output: ai_comparison_for_review.xlsx
 */

import { readFileSync } from 'fs';
import ExcelJS from 'exceljs';

async function main() {
  const report = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8'));
  const benchmark = JSON.parse(readFileSync('./ai_grading_benchmark.json', 'utf8'));

  // Build lookup: attemptId+wordId -> { correctDefinition, koreanDefinition }
  const defMap = new Map();
  for (const attempt of benchmark) {
    const msgContent = attempt.messages[1]?.content || '';
    // Parse word lines from the prompt
    const lines = msgContent.split('\n').filter(l => l.startsWith('wordId:'));
    for (const line of lines) {
      const wordIdMatch = line.match(/^wordId:\s*(\S+)/);
      const englishMatch = line.match(/English:\s*(.+?)\s*\|/);
      const koreanMatch = line.match(/Korean:\s*(.+?)\s*\|/);
      if (wordIdMatch) {
        defMap.set(`${attempt.attemptId}:${wordIdMatch[1]}`, {
          english: englishMatch?.[1]?.trim() || '',
          korean: koreanMatch?.[1]?.trim() || '',
        });
      }
    }
  }

  const wb = new ExcelJS.Workbook();

  function addSheet(name, items) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Word', key: 'word', width: 18 },
      { header: 'Correct Definition (EN)', key: 'english', width: 40 },
      { header: 'Correct Definition (KO)', key: 'korean', width: 30 },
      { header: 'Student Response', key: 'studentResponse', width: 40 },
      { header: 'GPT-4o-mini', key: 'gptVerdict', width: 12 },
      { header: 'GPT Reasoning', key: 'gptReasoning', width: 40 },
      { header: 'Haiku', key: 'haikuVerdict', width: 12 },
      { header: 'Haiku Reasoning', key: 'haikuReasoning', width: 40 },
      { header: 'Challenge Status', key: 'challengeStatus', width: 15 },
      { header: 'Challenge Note', key: 'challengeNote', width: 30 },
      { header: 'Your Verdict (O/X)', key: 'yourVerdict', width: 18 },
    ];

    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const defs = defMap.get(`${item.attemptId}:${item.wordId}`) || {};
      ws.addRow({
        num: i + 1,
        word: item.word,
        english: defs.english || '',
        korean: defs.korean || '',
        studentResponse: item.studentResponse,
        gptVerdict: item.gpt.isCorrect ? 'O' : 'X',
        gptReasoning: item.gpt.reasoning || '',
        haikuVerdict: item.haiku.isCorrect ? 'O' : 'X',
        haikuReasoning: item.haiku.reasoning || '',
        challengeStatus: item.challengeStatus || '',
        challengeNote: item.challengeNote || '',
        yourVerdict: '',
      });
    }

    // Light conditional formatting for verdict columns
    ws.getColumn('gptVerdict').eachCell((cell, rowNum) => {
      if (rowNum === 1) return;
      cell.font = { bold: true, color: { argb: cell.value === 'O' ? 'FF2E7D32' : 'FFC62828' } };
    });
    ws.getColumn('haikuVerdict').eachCell((cell, rowNum) => {
      if (rowNum === 1) return;
      cell.font = { bold: true, color: { argb: cell.value === 'O' ? 'FF2E7D32' : 'FFC62828' } };
    });
  }

  // Sheet 1: Haiku O, GPT X (896 cases — main concern)
  addSheet('Haiku O - GPT X', report.haikuO_noGroundTruth);

  // Sheet 2: Haiku X, GPT O (255 cases — Haiku stricter)
  addSheet('Haiku X - GPT O', report.haikuStricter);

  // Sheet 3: Both wrong (0 currently but included for completeness)
  if (report.bothWrong.length > 0) {
    addSheet('Both Wrong', report.bothWrong);
  }

  // Summary sheet
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 45 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  summary.getRow(1).font = { bold: true };
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

  const s = report.summary;
  const rows = [
    ['Total answers compared', s.totalCompared],
    ['Skipped (blank/missing)', s.skipped],
    ['Agreement rate (%)', s.agreementRate],
    ['', ''],
    ['--- Agreement ---', ''],
    ['Both correct (O/O)', s.agreeCorrect],
    ['Both incorrect (X/X)', s.agreeIncorrect],
    ['Both wrong (challenge approved)', s.bothWrong],
    ['', ''],
    ['--- Disagreements ---', ''],
    ['Haiku O, GPT X (challenge approved = Haiku right)', s.haikuRight],
    ['Haiku O, GPT X (no ground truth)', s.haikuO_noGroundTruth],
    ['Haiku X, GPT O (Haiku stricter)', s.haikuStricter],
  ];
  for (const [metric, count] of rows) {
    summary.addRow({ metric, count });
  }

  // Move summary to first position
  wb.removeWorksheet(summary.id);
  const summaryNew = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF4472C4' } } });
  summaryNew.columns = summary.columns;
  summaryNew.getRow(1).font = { bold: true };
  summaryNew.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  for (const [metric, count] of rows) {
    summaryNew.addRow({ metric, count });
  }

  await wb.xlsx.writeFile('./ai_comparison_for_review.xlsx');
  console.log('Exported ai_comparison_for_review.xlsx');
  console.log(`  Sheet "Haiku O - GPT X": ${report.haikuO_noGroundTruth.length} rows`);
  console.log(`  Sheet "Haiku X - GPT O": ${report.haikuStricter.length} rows`);
  console.log(`  Sheet "Summary": stats overview`);
}

main().catch(err => { console.error(err); process.exit(1); });
