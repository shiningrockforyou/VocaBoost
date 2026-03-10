/**
 * Build a benchmark dataset for AI grading accuracy comparison.
 *
 * Produces the EXACT prompts (system + user) that were sent to OpenAI,
 * grouped per attempt, so you can feed them to a different model and
 * compare results against the current AI's grades.
 *
 * Run with: node scripts/build-ai-benchmark.js
 *
 * Output: ai_grading_benchmark.json in project root
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ── Exact prompts from functions/index.js ──────────────────────────

const SYSTEM_MESSAGE = "You are a lenient vocabulary grading assistant. Return only valid JSON arrays. Do not include any text before or after the JSON array.";

const PROMPT_HEADER = `You are grading vocabulary definitions. Grade each answer as correct or incorrect.

GRADING RULES:
#1 Be LENIENT. If it FEELS like the student knows the word, mark it correct.
#2 Use the given English and Korean definitions as guidelines.
#3 CLOSE ENOUGH is GOOD ENOUGH to be CORRECT.
#4 Spelling or grammar errors DO NOT MATTER and CANNOT MAKE AN ANSWER INCORRECT.
#5 When in doubt, mark CORRECT - we prefer false positives over false negatives.
#6 Answers can be in either Korean, English, or a mix.
#7 A question is INCORRECT ONLY IF:
      - The answer is self-referencing. So that means the response is wrong if it uses the word to define itself.
      OR
      - It is completely irrelevant or contradictory to the word's definition.
      OR
      - The answer describes the reverse meaning (e.g., "able to like" vs "able to be liked")
#8 Provide an explanation and include it as "reasoning" in the JSON output if you said it was wrong. This should be written as if you are speaking to the student directly.

OUTPUT FORMAT:
Return a JSON array with one object per word:
[
  {"wordId": "abc123", "isCorrect": true},
  {"wordId": "def456", "isCorrect": false, "reasoning": "Describes a different concept"}
]

WORDS TO GRADE:
`;

function buildWordLine(answer, koreanDef) {
  return `wordId: ${answer.wordId} | Word: ${answer.word} | English: ${answer.correctAnswer} | Korean: ${koreanDef || 'N/A'} | Student: ${answer.studentResponse}`;
}

// ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load exported attempts
  const attempts = JSON.parse(readFileSync('./typed_test_answers_export.json', 'utf8'));
  console.log(`Loaded ${attempts.length} typed test attempts.`);

  // 2. Collect unique listId -> Set<wordId> pairs
  const listWordMap = new Map();
  let totalAnswers = 0;

  for (const attempt of attempts) {
    if (!attempt.listId) continue;
    for (const answer of attempt.answers) {
      if (!answer.wordId) continue;
      if (!listWordMap.has(attempt.listId)) {
        listWordMap.set(attempt.listId, new Set());
      }
      listWordMap.get(attempt.listId).add(answer.wordId);
      totalAnswers++;
    }
  }

  console.log(`Found ${totalAnswers} total answers across ${listWordMap.size} lists.`);

  // 3. Batch-fetch Korean definitions from Firestore
  const koreanDefs = new Map(); // "listId:wordId" -> koreanDefinition

  let listsProcessed = 0;
  for (const [listId, wordIds] of listWordMap.entries()) {
    const wordIdArray = [...wordIds];
    const batchSize = 100;
    for (let i = 0; i < wordIdArray.length; i += batchSize) {
      const batch = wordIdArray.slice(i, i + batchSize);
      const refs = batch.map(wid => db.doc(`lists/${listId}/words/${wid}`));
      const docs = await db.getAll(...refs);

      for (const doc of docs) {
        if (doc.exists) {
          const ko = doc.data().definitions?.ko || '';
          koreanDefs.set(`${listId}:${doc.id}`, ko);
        }
      }
    }

    listsProcessed++;
    if (listsProcessed % 20 === 0) {
      console.log(`  Fetched definitions for ${listsProcessed}/${listWordMap.size} lists...`);
    }
  }

  console.log(`Fetched Korean definitions for ${koreanDefs.size} words.`);

  // 4. Build benchmark: one entry per attempt with exact prompt + current AI results
  const benchmark = [];

  for (const attempt of attempts) {
    if (!attempt.listId || attempt.answers.length === 0) continue;

    // Separate blank vs non-blank (same logic as Cloud Function)
    const blankAnswers = attempt.answers.filter(
      a => !a.studentResponse || a.studentResponse.trim() === ''
    );
    const answersToGrade = attempt.answers.filter(
      a => a.studentResponse && a.studentResponse.trim() !== ''
    );

    // Build the exact user prompt for non-blank answers
    let userPrompt = PROMPT_HEADER;
    for (const answer of answersToGrade) {
      const ko = koreanDefs.get(`${attempt.listId}:${answer.wordId}`) || '';
      userPrompt += '\n' + buildWordLine(answer, ko);
    }

    benchmark.push({
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      sessionType: attempt.sessionType,
      studyDay: attempt.studyDay,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      submittedAt: attempt.submittedAt,
      classId: attempt.classId,
      listId: attempt.listId,

      // Exact messages array to send to any OpenAI-compatible API
      messages: [
        { role: "system", content: SYSTEM_MESSAGE },
        { role: "user", content: userPrompt },
      ],

      // Number of blank answers auto-marked incorrect (not sent to AI)
      blanksAutoIncorrect: blankAnswers.length,

      // Current AI's grades as baseline for comparison
      currentAIResults: attempt.answers.map(a => ({
        wordId: a.wordId,
        word: a.word,
        studentResponse: a.studentResponse,
        isCorrect: a.isCorrect,
        reasoning: a.aiReasoning,
        challengeStatus: a.challengeStatus,
        challengeNote: a.challengeNote,
      })),
    });
  }

  const totalGradedAnswers = benchmark.reduce(
    (sum, b) => sum + b.currentAIResults.filter(r => r.studentResponse?.trim()).length, 0
  );

  writeFileSync('./ai_grading_benchmark.json', JSON.stringify(benchmark, null, 2));
  console.log(`\nExported benchmark:`);
  console.log(`  ${benchmark.length} attempts`);
  console.log(`  ${totalGradedAnswers} non-blank answers (sent to AI)`);
  console.log(`  -> ai_grading_benchmark.json`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
