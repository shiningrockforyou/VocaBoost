/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const OpenAI = require("openai");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Define secret for OpenAI API key
const openaiApiKey = defineSecret("OPENAI_API_KEY");

/**
 * Cloud Function to grade typed vocabulary definitions using OpenAI GPT-4o-mini
 * 
 * @param {Object} data - Request data containing answers array
 * @param {Object} context - Request context (includes auth)
 * @returns {Promise<Object>} Grading results with isCorrect and reasoning
 */
exports.gradeTypedTest = onCall(
  {
    secrets: [openaiApiKey],
    enforceAppCheck: false,
  },
  async (request) => {
    // Validate authentication
    if (!request.auth) {
      throw new Error("Unauthenticated - Authentication required");
    }

    const {answers} = request.data;

    // Validate input
    if (!Array.isArray(answers)) {
      throw new Error("Invalid input: answers must be an array");
    }

    if (answers.length === 0) {
      throw new Error("Invalid input: answers array cannot be empty");
    }

    if (answers.length > 100) {
      throw new Error("Invalid input: maximum 100 answers per request");
    }

    // Validate answer structure
    for (const answer of answers) {
      if (!answer.wordId || !answer.word || !answer.correctDefinition || answer.studentResponse === undefined) {
        throw new Error("Invalid input: each answer must have wordId, word, correctDefinition, and studentResponse");
      }
    }

    try {
      // Separate blank and non-blank answers
      const blankAnswers = answers.filter(
        (a) => !a.studentResponse || a.studentResponse.trim() === "",
      );
      const answersToGrade = answers.filter(
        (a) => a.studentResponse && a.studentResponse.trim() !== "",
      );

      // Auto-mark blank answers as incorrect
      const blankResults = blankAnswers.map((a) => ({
        wordId: a.wordId,
        isCorrect: false,
        reasoning: "No answer provided",
      }));

      logger.info(
        `Grading ${answersToGrade.length} answers, ${blankAnswers.length} blank for user ${request.auth.uid}`,
      );

      // If all answers are blank, skip OpenAI call and return all as incorrect
      if (answersToGrade.length === 0) {
        return {
          results: blankResults,
        };
      }

      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: openaiApiKey.value(),
      });

      // Build prompt
      let prompt = `You are grading vocabulary definitions. Grade each answer as correct or incorrect.

GRADING RULES:
#1 Be LENIENT - accept any response showing the student understands the core meaning
#2 Definition does not have to be exact, but it should not be an incorrect idea.
#3 Spelling or grammar mistakes do not matter.
#4 When in doubt, mark CORRECT - we prefer false positives over false negatives.
#5 It can be in either Korean, English, or a mix.
#6 The answer cannot be self-referencing. So that means the response is wrong if it uses the word to define itself.
#7 Provide an explanation and include it as "reasoning" in the JSON output if you said it was wrong. This should be written as if you are speaking to the student directly.

OUTPUT FORMAT:
Return a JSON array with one object per word:
[
  {"wordId": "abc123", "isCorrect": true},
  {"wordId": "def456", "isCorrect": false, "reasoning": "Describes a different concept"}
]

WORDS TO GRADE:
`;

      // Append each non-blank word to the prompt
      for (const answer of answersToGrade) {
        prompt += `\nwordId: ${answer.wordId} | Word: ${answer.word} | Correct: ${answer.correctDefinition} | Student: ${answer.studentResponse}`;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a lenient vocabulary grading assistant. Return only valid JSON arrays. Do not include any text before or after the JSON array.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
      });

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error("OpenAI returned empty response");
      }

      // Parse JSON response - try to extract JSON array from response
      let parsedResponse;
      try {
        // Try to find JSON array in the response (may have markdown code blocks)
        const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the whole response
          parsedResponse = JSON.parse(responseContent);
        }
      } catch (parseError) {
        logger.error("Failed to parse OpenAI response", {responseContent, parseError});
        throw new Error("Failed to parse grading results");
      }

      // Extract results array (handle both direct array and object with results key)
      let results;
      if (Array.isArray(parsedResponse)) {
        results = parsedResponse;
      } else if (parsedResponse.results && Array.isArray(parsedResponse.results)) {
        results = parsedResponse.results;
      } else {
        // Try to find any array in the response
        const arrayKeys = Object.keys(parsedResponse).filter((key) =>
          Array.isArray(parsedResponse[key])
        );
        if (arrayKeys.length > 0) {
          results = parsedResponse[arrayKeys[0]];
        } else {
          throw new Error("OpenAI response does not contain a results array");
        }
      }

      // Map results by wordId to handle AI response length mismatches
      const resultsMap = new Map(
        (Array.isArray(results) ? results : []).map((r) => [r.wordId, r]),
      );

      // Build AI results for non-blank answers
      const aiResults = answersToGrade.map((answer) => {
        const result = resultsMap.get(answer.wordId);
        if (result && typeof result.isCorrect === "boolean") {
          return {
            wordId: answer.wordId,
            isCorrect: result.isCorrect,
            reasoning: result.reasoning || "",
          };
        }

        // If AI missed this word, mark incorrect with a helpful message
        return {
          wordId: answer.wordId,
          isCorrect: false,
          reasoning: "Unable to grade - please challenge if you believe this is correct",
        };
      });

      // Combine AI results with blank results
      const combinedResults = [...aiResults, ...blankResults];

      // Normalize results by wordId to ensure correct order (matching original answers array)
      const resultsMapFinal = new Map(
        combinedResults.map((r) => [r.wordId, r]),
      );

      // Build final results in the same order as the incoming answers
      const finalResults = answers.map((answer) => {
        const result = resultsMapFinal.get(answer.wordId);
        if (result) {
          return result;
        }

        // Fallback (should not happen, but handle gracefully)
        return {
          wordId: answer.wordId,
          isCorrect: false,
          reasoning: "Unable to grade - please challenge if you believe this is correct",
        };
      });

      // Post-grading validation - override obvious AI mistakes
      const validatedResults = finalResults.map((result) => {
        const originalAnswer = answers.find((a) => a.wordId === result.wordId);
        if (!originalAnswer) return result;

        const response = (originalAnswer.studentResponse || "").trim().toLowerCase();
        const word = (originalAnswer.word || "").trim().toLowerCase();

        // Rule 1: Blank or whitespace-only should always be incorrect
        if (!response) {
          return { ...result, isCorrect: false, reasoning: "No answer provided" };
        }

        // Rule 2: Just repeating the word (exact or very close) should be incorrect
        if (
          response === word ||
          response === word + "s" ||
          response === word + "ed" ||
          response === word + "ing"
        ) {
          return {
            ...result,
            isCorrect: false,
            reasoning: "Simply repeated the word without definition",
          };
        }

        // Rule 3: Very short response (1-2 chars) is likely wrong unless it's a valid translation
        if (response.length <= 2 && result.isCorrect) {
          // Keep correct only if it looks like a CJK character (Chinese/Japanese/Korean)
          const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(
            response,
          );
          if (!hasCJK) {
            return {
              ...result,
              isCorrect: false,
              reasoning: "Response too short to be a valid definition",
            };
          }
        }

        return result;
      });

      // Log any overrides for monitoring
      const overrideCount = validatedResults.filter(
        (r, i) => r.isCorrect !== finalResults[i]?.isCorrect,
      ).length;
      if (overrideCount > 0) {
        logger.info(`Validation overrode ${overrideCount} AI decisions`);
      }

      logger.info(`Successfully graded ${validatedResults.length} answers (normalized)`);

      return {
        results: validatedResults,
      };
    } catch (error) {
      logger.error("Error grading typed test", {
        error: error.message,
        stack: error.stack,
        userId: request.auth?.uid,
      });

      // Re-throw known errors
      if (error.message.includes("Unauthenticated") || error.message.includes("Invalid input")) {
        throw error;
      }

      // Return generic error for unknown errors
      throw new Error(`Failed to grade test: ${error.message}`);
    }
  }
);
