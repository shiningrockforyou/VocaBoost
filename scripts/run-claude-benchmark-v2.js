/**
 * Run AI grading benchmark against Claude Haiku with the NEW prompt (v2).
 *
 * Parses word data from the old benchmark messages and sends using
 * the refactored few-shot prompt architecture.
 *
 * Run with: ANTHROPIC_API_KEY=sk-... node scripts/run-claude-benchmark-v2.js
 *
 * Output: claude_benchmark_results_v2.json in project root
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: Set ANTHROPIC_API_KEY environment variable.');
  process.exit(1);
}

const MODEL = 'claude-haiku-4-5-20251001';
const OUTPUT_FILE = './claude_benchmark_results_v2.json';

const client = new Anthropic({ apiKey: API_KEY });

const SYSTEM_MESSAGE = `You are a lenient vocabulary grading assistant for Korean ESL students. Students are tested on English vocabulary words and may answer in Korean, English, or a mix.

<rules>
Default to CORRECT. Mark WRONG only if one of these is true:
1. Self-referencing: the response uses the target word or a direct transliteration to define itself
2. Irrelevant or contradictory: the response has nothing to do with the word's meaning
3. Reversed meaning: the response describes the opposite direction (e.g., "to like" for "likable")

Everything else is CORRECT — including partial definitions, different parts of speech, Korean near-synonyms, answers with typos, and answers matching the provided Korean definition.
</rules>

<examples>
Word: formidable | English: inspiring fear or respect | Korean: 굳세다
Student: 굳세다
→ CORRECT (matches the Korean definition provided)

Word: impoverish | English: to make poor | Korean: 가난하게 하다
Student: 가난한
→ CORRECT (adjective form instead of verb — student clearly knows the meaning)

Word: dynamic | English: factor that controls, influences a process of growth, change, interaction, or activity | Korean: 변화, 상호작용 등에 영향을 주는 요소
Student: 변화
→ CORRECT (partial but captures a core element of the definition)

Word: projected | English: estimated or forecast | Korean: 예상된
Student: 예상되다ㅠ예ㅛㅏㅇ괸
→ CORRECT (typing errors but intent is clearly 예상되다)

Word: placate | English: to make someone less angry or hostile | Korean: 달래다
Student: make something less angry
→ CORRECT (imprecise but demonstrates understanding)

Word: renaissance | English: a rebirth or revival | Korean: 부활, 신생, 부흥
Student: 르네상스
→ WRONG — {"reasoning": "You wrote the transliterated name rather than the meaning. Renaissance means a rebirth or revival."}

Word: appalling | English: inspiring shock, horror, disgust | Korean: 충격적인
Student: 질리는
→ WRONG — {"reasoning": "질리는 means tiresome or boring, but appalling means inspiring shock or horror — these are different emotions."}

Word: enigmatic | English: mysterious, puzzling | Korean: 신비한
Student: 암호화된
→ WRONG — {"reasoning": "암호화된 means encrypted, which is different from enigmatic (mysterious/puzzling)."}
</examples>

<output_format>
Return ONLY a JSON array. No markdown, no commentary, no text outside the array.

For correct answers:
{"wordId": "...", "isCorrect": true}

For incorrect answers, include reasoning addressed to the student in 1-2 sentences:
{"wordId": "...", "isCorrect": false, "reasoning": "..."}

Do not include "reasoning" for correct answers.
</output_format>`;

/**
 * Parse pipe-delimited word lines from the old benchmark user message.
 */
function parseWordsFromMessage(userMsg) {
  const lines = userMsg.split('\n').filter(l => l.startsWith('wordId:'));
  return lines.map(line => {
    const wordIdMatch = line.match(/^wordId:\s*(\S+)/);
    const wordMatch = line.match(/\|\s*Word:\s*(.+?)\s*\|/);
    const englishMatch = line.match(/\|\s*English:\s*(.+?)\s*\|/);
    const koreanMatch = line.match(/\|\s*Korean:\s*(.+?)\s*\|/);
    const studentMatch = line.match(/\|\s*Student:\s*(.+)$/);
    return {
      wordId: wordIdMatch?.[1] || '',
      word: wordMatch?.[1]?.trim() || '',
      english: englishMatch?.[1]?.trim() || '',
      korean: koreanMatch?.[1]?.trim() || 'N/A',
      student: studentMatch?.[1]?.trim() || '',
    };
  });
}

/**
 * Check if a response is blank.
 */
function isBlankResponse(response) {
  if (!response) return true;
  const trimmed = response.trim();
  if (trimmed === '') return true;
  if (/^[?.!,\-]+$/.test(trimmed)) return true;
  return false;
}

/**
 * Check if a response is self-referencing.
 */
function isSelfReferencing(studentResponse, word) {
  const response = (studentResponse || '').trim().toLowerCase();
  const w = (word || '').trim().toLowerCase();
  if (!response || !w) return false;
  return (
    response === w ||
    response === w + 's' ||
    response === w + 'ed' ||
    response === w + 'ing' ||
    response === w + 'ly'
  );
}

async function gradeAttempt(words) {
  // Pre-filter blanks and self-refs
  const blankResults = [];
  const selfRefResults = [];
  const toGrade = [];

  for (const w of words) {
    if (isBlankResponse(w.student)) {
      blankResults.push({ wordId: w.wordId, isCorrect: false, reasoning: 'No answer provided' });
    } else if (isSelfReferencing(w.student, w.word)) {
      selfRefResults.push({ wordId: w.wordId, isCorrect: false, reasoning: 'You wrote the word itself rather than its meaning. Try defining what the word means.' });
    } else {
      toGrade.push(w);
    }
  }

  if (toGrade.length === 0) {
    return { results: [...blankResults, ...selfRefResults] };
  }

  const userMessage = `Grade exactly ${toGrade.length} words. Return exactly ${toGrade.length} results.\n\n<words>\n${JSON.stringify(toGrade, null, 2)}\n</words>`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.1,
    system: SYSTEM_MESSAGE,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '';

  let parsed;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      parsed = JSON.parse(text);
    }
  } catch {
    return { raw: text, error: 'Failed to parse JSON', results: [...blankResults, ...selfRefResults] };
  }

  const aiResults = Array.isArray(parsed) ? parsed
    : parsed?.results && Array.isArray(parsed.results) ? parsed.results
    : [];

  return { results: [...aiResults, ...blankResults, ...selfRefResults] };
}

async function main() {
  const benchmark = JSON.parse(readFileSync('./ai_grading_benchmark.json', 'utf8'));
  console.log(`Loaded ${benchmark.length} attempts from benchmark.\n`);

  // Resume support
  let output = [];
  const completed = new Set();
  if (existsSync(OUTPUT_FILE)) {
    output = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'));
    for (const entry of output) {
      completed.add(entry.attemptId);
    }
    console.log(`Resuming: ${completed.size} attempts already completed.\n`);
  }

  let processed = completed.size;
  let errors = 0;

  for (const attempt of benchmark) {
    if (completed.has(attempt.attemptId)) continue;

    processed++;
    const label = `[${processed}/${benchmark.length}]`;

    const startTime = Date.now();
    try {
      const userMsg = attempt.messages.find(m => m.role === 'user')?.content || '';
      const words = parseWordsFromMessage(userMsg);

      const claudeResult = await gradeAttempt(words);

      output.push({
        attemptId: attempt.attemptId,
        studentId: attempt.studentId,
        sessionType: attempt.sessionType,
        studyDay: attempt.studyDay,
        score: attempt.score,
        classId: attempt.classId,
        listId: attempt.listId,
        blanksAutoIncorrect: attempt.blanksAutoIncorrect,
        currentAIResults: attempt.currentAIResults,
        claudeResults: claudeResult.results,
        claudeError: claudeResult.error || null,
      });

      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const resultCount = claudeResult.results.length;
      const errorNote = claudeResult.error ? ` (ERROR: ${claudeResult.error})` : '';
      console.log(`${label} ${attempt.attemptId} - ${resultCount} results graded in ${elapsed}s${errorNote}`);
    } catch (err) {
      errors++;
      console.error(`${label} ${attempt.attemptId} - API ERROR: ${err.message}`);

      output.push({
        attemptId: attempt.attemptId,
        studentId: attempt.studentId,
        sessionType: attempt.sessionType,
        studyDay: attempt.studyDay,
        score: attempt.score,
        classId: attempt.classId,
        listId: attempt.listId,
        blanksAutoIncorrect: attempt.blanksAutoIncorrect,
        currentAIResults: attempt.currentAIResults,
        claudeResults: [],
        claudeError: err.message,
      });
      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

      if (err.status === 429) {
        console.log('  Rate limited, waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
      }
    }
  }

  console.log(`\nDone! ${processed} attempts processed, ${errors} errors.`);
  console.log(`Results saved to ${OUTPUT_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
