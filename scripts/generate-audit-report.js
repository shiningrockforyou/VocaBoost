/**
 * Generate the comprehensive Excel companion for the audit report.
 * Run with: node scripts/generate-audit-report.js
 */

import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';

async function main() {
  const report = JSON.parse(readFileSync('./ai_comparison_report.json', 'utf8'));
  const haikuErrors = JSON.parse(readFileSync('./haiku_errors_detail.json', 'utf8'));
  const data = JSON.parse(readFileSync('./report_data.json', 'utf8'));
  const benchmark = JSON.parse(readFileSync('./ai_grading_benchmark.json', 'utf8'));

  // Build definition lookup from benchmark
  const defMap = new Map();
  for (const attempt of benchmark) {
    const msgContent = attempt.messages[1]?.content || '';
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

  const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } } };
  const subHeaderStyle = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } } };

  // ── Sheet 1: Executive Summary ──
  const sumWs = wb.addWorksheet('Executive Summary');
  sumWs.columns = [
    { header: 'Metric', key: 'metric', width: 50 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  sumWs.getRow(1).font = headerStyle.font;
  sumWs.getRow(1).fill = headerStyle.fill;

  const sumRows = [
    ['DATASET', ''],
    ['Date range', `${data.dateRange.earliest?.slice(0,10)} to ${data.dateRange.latest?.slice(0,10)}`],
    ['Total typed test attempts (all)', data.datasetSize.totalAttempts],
    ['Benchmark attempts (with listId)', data.datasetSize.benchmarkAttempts],
    ['Total individual answers compared', data.summary.totalCompared],
    ['Skipped (blank / missing Claude result)', data.summary.skipped],
    ['Unique students', data.datasetSize.uniqueStudents],
    ['Unique word lists', data.datasetSize.uniqueLists],
    ['Avg answers per attempt', data.datasetSize.avgAnswersPerAttempt],
    ['Avg score (%)', data.scoreStats.avgScore],
    ['Median score (%)', data.scoreStats.medianScore],
    ['', ''],
    ['AGREEMENT', ''],
    ['Agreement rate', `${data.summary.agreementRate}%`],
    ['Both correct (O/O)', data.summary.agreeCorrect],
    ['Both incorrect (X/X)', data.summary.agreeIncorrect],
    ['Both wrong (challenge-proven)', data.summary.bothWrong],
    ['', ''],
    ['DISAGREEMENTS', ''],
    ['Total disagreements', data.summary.haikuO_noGroundTruth + data.summary.haikuStricter],
    ['Haiku O, GPT X (GPT too strict)', data.summary.haikuO_noGroundTruth],
    ['Haiku X, GPT O (Haiku too strict)', data.summary.haikuStricter],
    ['', ''],
    ['OPUS 4.6 AUDIT (Unbiased Run)', ''],
    ['GPT-4o-mini total errors', 793],
    ['GPT-4o-mini error rate', '3.55%'],
    ['Claude Haiku total errors', 214],
    ['Claude Haiku error rate', '0.96%'],
    ['GPT/Haiku error ratio', '3.7x'],
  ];
  for (const [m, v] of sumRows) {
    const row = sumWs.addRow({ metric: m, value: v });
    if (m === 'DATASET' || m === 'AGREEMENT' || m === 'DISAGREEMENTS' || m.startsWith('OPUS')) {
      row.font = subHeaderStyle.font;
      row.fill = subHeaderStyle.fill;
    }
  }

  // ── Sheet 2: All Disagreements (Haiku O, GPT X) ──
  function addDisagreementSheet(name, items) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Word', key: 'word', width: 18 },
      { header: 'Correct Def (EN)', key: 'english', width: 40 },
      { header: 'Correct Def (KO)', key: 'korean', width: 30 },
      { header: 'Student Response', key: 'studentResponse', width: 40 },
      { header: 'GPT-4o-mini', key: 'gpt', width: 10 },
      { header: 'GPT Reasoning', key: 'gptReasoning', width: 45 },
      { header: 'Haiku', key: 'haiku', width: 10 },
      { header: 'Haiku Reasoning', key: 'haikuReasoning', width: 45 },
      { header: 'Challenge Status', key: 'challenge', width: 14 },
      { header: 'Challenge Note', key: 'challengeNote', width: 30 },
    ];
    ws.getRow(1).font = headerStyle.font;
    ws.getRow(1).fill = headerStyle.fill;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const defs = defMap.get(`${item.attemptId}:${item.wordId}`) || {};
      ws.addRow({
        num: i + 1,
        word: item.word,
        english: defs.english || '',
        korean: defs.korean || '',
        studentResponse: item.studentResponse,
        gpt: item.gpt.isCorrect ? 'O' : 'X',
        gptReasoning: item.gpt.reasoning || '',
        haiku: item.haiku.isCorrect ? 'O' : 'X',
        haikuReasoning: item.haiku.reasoning || '',
        challenge: item.challengeStatus || '',
        challengeNote: item.challengeNote || '',
      });
    }
  }

  addDisagreementSheet('GPT X - Haiku O (896)', report.haikuO_noGroundTruth);
  addDisagreementSheet('Haiku X - GPT O (255)', report.haikuStricter);

  // ── Sheet 3: Haiku Too Lenient (22 cases) ──
  const lenWs = wb.addWorksheet('Haiku Too Lenient (22)');
  lenWs.columns = [
    { header: '#', key: 'num', width: 5 },
    { header: 'Word', key: 'word', width: 18 },
    { header: 'Correct Def (EN)', key: 'english', width: 40 },
    { header: 'Correct Def (KO)', key: 'korean', width: 30 },
    { header: 'Student Response', key: 'studentResponse', width: 20 },
    { header: 'Issue', key: 'issue', width: 30 },
    { header: 'GPT Reasoning', key: 'gptReasoning', width: 45 },
  ];
  lenWs.getRow(1).font = headerStyle.font;
  lenWs.getRow(1).fill = headerStyle.fill;

  for (let i = 0; i < haikuErrors.tooLenient.length; i++) {
    const c = haikuErrors.tooLenient[i];
    lenWs.addRow({
      num: i + 1,
      word: c.word,
      english: c.correctEN,
      korean: c.correctKO,
      studentResponse: c.studentResponse,
      issue: c.studentResponse === '?' ? 'Question mark — blank filter bug' : 'Incorrect semantic match',
      gptReasoning: c.gptReasoning || '',
    });
  }

  // ── Sheet 4: Haiku Too Strict (sample with patterns) ──
  const strictWs = wb.addWorksheet('Haiku Too Strict (192)');
  strictWs.columns = [
    { header: '#', key: 'num', width: 5 },
    { header: 'Word', key: 'word', width: 18 },
    { header: 'Correct Def (EN)', key: 'english', width: 40 },
    { header: 'Correct Def (KO)', key: 'korean', width: 30 },
    { header: 'Student Response', key: 'studentResponse', width: 35 },
    { header: 'Haiku Reasoning', key: 'haikuReasoning', width: 55 },
    { header: 'Error Pattern', key: 'pattern', width: 25 },
  ];
  strictWs.getRow(1).font = headerStyle.font;
  strictWs.getRow(1).fill = headerStyle.fill;

  for (let i = 0; i < haikuErrors.tooStrict.length; i++) {
    const c = haikuErrors.tooStrict[i];
    const r = (c.haikuReasoning || '').toLowerCase();
    let pattern = 'Other';
    if (r.includes('too narrow') || r.includes('too general') || r.includes('too vague')) pattern = 'Too narrow/partial';
    else if (r.includes('noun') || r.includes('verb') || r.includes('adjective')) pattern = 'Part-of-speech mismatch';
    else if (r.includes('korean definition') || r.includes('provided definition')) pattern = 'Rejected KO definition';
    else if (r.includes('proper noun') || r.includes('historical') || r.includes('source material')) pattern = 'Self-referencing name';
    else if (r.includes('unclear') || r.includes('typing') || r.includes('garbled')) pattern = 'Typo rejection';
    else if (r.includes('reverse')) pattern = 'Reverse meaning';

    // Check if student matched a KO definition part
    const ko = (c.correctKO || '').trim();
    const resp = (c.studentResponse || '').trim();
    if (ko && resp) {
      const koParts = ko.split(/[,;]/).map(p => p.trim());
      for (const part of koParts) {
        if (part === resp || (part.length > 2 && (part.includes(resp) || resp.includes(part)))) {
          pattern = 'Matched KO definition';
          break;
        }
      }
    }

    strictWs.addRow({
      num: i + 1,
      word: c.word,
      english: c.correctEN,
      korean: c.correctKO,
      studentResponse: c.studentResponse,
      haikuReasoning: c.haikuReasoning || '',
      pattern,
    });
  }

  // ── Sheet 5: Top Disagreement Words ──
  const wordsWs = wb.addWorksheet('Top Disagreement Words');
  wordsWs.columns = [
    { header: 'Rank', key: 'rank', width: 6 },
    { header: 'Word (GPT too strict)', key: 'wordGPT', width: 22 },
    { header: 'Count', key: 'countGPT', width: 8 },
    { header: '', key: 'gap', width: 3 },
    { header: 'Word (Haiku too strict)', key: 'wordHaiku', width: 22 },
    { header: 'Count', key: 'countHaiku', width: 8 },
  ];
  wordsWs.getRow(1).font = headerStyle.font;
  wordsWs.getRow(1).fill = headerStyle.fill;

  const maxWords = Math.max(data.topDisagreementWords.haikuO_gptX.length, data.topDisagreementWords.haikuX_gptO.length);
  for (let i = 0; i < maxWords; i++) {
    const gpt = data.topDisagreementWords.haikuO_gptX[i] || ['', ''];
    const haiku = data.topDisagreementWords.haikuX_gptO[i] || ['', ''];
    wordsWs.addRow({
      rank: i + 1,
      wordGPT: gpt[0],
      countGPT: gpt[1],
      gap: '',
      wordHaiku: haiku[0],
      countHaiku: haiku[1],
    });
  }

  // ── Sheet 6: GPT Reasoning Categories ──
  const catWs = wb.addWorksheet('Error Categories');
  catWs.columns = [
    { header: 'GPT Reason (when wrong)', key: 'gptCat', width: 30 },
    { header: 'Count', key: 'gptCount', width: 10 },
    { header: '', key: 'gap', width: 3 },
    { header: 'Haiku Reason (when wrong)', key: 'haikuCat', width: 30 },
    { header: 'Count', key: 'haikuCount', width: 10 },
  ];
  catWs.getRow(1).font = headerStyle.font;
  catWs.getRow(1).fill = headerStyle.fill;

  const gptCats = Object.entries(data.gptReasonCategories).sort((a, b) => b[1] - a[1]);
  const haikuCats = Object.entries(data.haikuReasonCategories).sort((a, b) => b[1] - a[1]);
  const maxCats = Math.max(gptCats.length, haikuCats.length);
  for (let i = 0; i < maxCats; i++) {
    catWs.addRow({
      gptCat: gptCats[i]?.[0] || '',
      gptCount: gptCats[i]?.[1] || '',
      gap: '',
      haikuCat: haikuCats[i]?.[0] || '',
      haikuCount: haikuCats[i]?.[1] || '',
    });
  }

  await wb.xlsx.writeFile('./AI_Grading_Audit_Report_Data.xlsx');
  console.log('Generated AI_Grading_Audit_Report_Data.xlsx');
}

main().catch(err => { console.error(err); process.exit(1); });
