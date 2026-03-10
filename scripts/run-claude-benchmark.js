/**
 * Run AI grading benchmark against Claude Haiku.
 *
 * Sends each attempt's prompt (one by one) to Claude, parses the response,
 * and saves results alongside the current GPT-4o-mini grades for comparison.
 *
 * Run with: ANTHROPIC_API_KEY=sk-... node scripts/run-claude-benchmark.js
 *
 * Output: claude_benchmark_results.json in project root
 *
 * Resumes from where it left off if interrupted (reads existing output file).
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Error: Set ANTHROPIC_API_KEY environment variable.');
  process.exit(1);
}

const MODEL = 'claude-haiku-4-5-20251001';
const OUTPUT_FILE = './claude_benchmark_results.json';

const client = new Anthropic({ apiKey: API_KEY });

async function gradeAttempt(messages) {
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsg = messages.find(m => m.role === 'user')?.content || '';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.1,
    system: systemMsg,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = response.content[0]?.text || '';

  // Parse JSON array from response (same logic as Cloud Function)
  let parsed;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      parsed = JSON.parse(text);
    }
  } catch {
    return { raw: text, error: 'Failed to parse JSON', results: [] };
  }

  const results = Array.isArray(parsed) ? parsed
    : parsed?.results && Array.isArray(parsed.results) ? parsed.results
    : [];

  return { results };
}

async function main() {
  const benchmark = JSON.parse(readFileSync('./ai_grading_benchmark.json', 'utf8'));
  console.log(`Loaded ${benchmark.length} attempts from benchmark.\n`);

  // Resume support: load existing results
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

    try {
      const claudeResult = await gradeAttempt(attempt.messages);

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

      // Save after every attempt (resume-safe)
      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

      const resultCount = claudeResult.results.length;
      const errorNote = claudeResult.error ? ` (ERROR: ${claudeResult.error})` : '';
      console.log(`${label} ${attempt.attemptId} - ${resultCount} results graded${errorNote}`);
    } catch (err) {
      errors++;
      console.error(`${label} ${attempt.attemptId} - API ERROR: ${err.message}`);

      // Save a record of the failure too
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

      // If rate limited, wait and continue
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
