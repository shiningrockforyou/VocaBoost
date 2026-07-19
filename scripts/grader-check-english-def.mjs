#!/usr/bin/env node
/*
 * Grader DIAGNOSTIC — "correct English definition must be CORRECT" (David-decided 2026-07-19).
 *
 * These are 윤여진's REAL wrongly-marked answers (uid 31WgOWbh, read-only pull): the student typed a correct
 * English definition — often the verbatim answer key — and the live grader rejected it as "you've restated the
 * English definition, translate to Korean." That is the "정답과 똑같이 써도 오답" permanent-fail deadlock.
 *
 * PURPOSE: run against the CURRENTLY DEPLOYED prompt (functions/index.js @ 0992f5f) to CONFIRM the bug persists
 * (expected: the "should be correct" rows FAIL now). Then it doubles as the regression gate for the real fix:
 * once the prompt is corrected, every row here must pass.
 *
 * NOTE ON FIDELITY: the stored attempt rows carry `correctAnswer` (English) + `studentResponse` but not the word's
 * Korean gloss, so `korean` is "N/A" here. Production passes the real koreanDefinition; this isolates the
 * English-definition-acceptance behavior, which is what David's decision turns on. A rejection here regardless of
 * the Korean field confirms the bug.
 *
 * Usage (key never in chat):
 *   ANTHROPIC_API_KEY="$(firebase functions:secrets:access ANTHROPIC_API_KEY)" node scripts/grader-check-english-def.mjs
 *   RUNS=5 to repeat each case.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(REPO, "functions") + "/");
const Anthropic = require("@anthropic-ai/sdk").default;

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("ERROR: set ANTHROPIC_API_KEY (e.g. `firebase functions:secrets:access ANTHROPIC_API_KEY`)."); process.exit(2); }
const RUNS = Number(process.env.RUNS || 3);
const MODEL = "claude-haiku-4-5-20251001";
const PROMPT_FILE = process.env.PROMPT_FILE || resolve(REPO, "functions", "index.js");

const SRC = readFileSync(PROMPT_FILE, "utf8");
const m = SRC.match(/const systemMessage = `([\s\S]*?)`;/);
if (!m) { console.error(`ERROR: could not extract systemMessage from ${PROMPT_FILE}.`); process.exit(2); }
const SYSTEM = m[1];

// 윤여진's REAL cases. expect:true = correct English definition that MUST be accepted (David's decision).
const FIXTURE = [
  // --- correct English definitions (were wrongly rejected as "restated, translate to Korean") ---
  { word: "proletariat", english: "the class of wage-earning workers who lack ownership of the means of production", student: "the class of wage-earning workers who lack ownership of the means of production", expect: true, why: "verbatim correct definition" },
  { word: "gimmick", english: "a trick or device intended to attract attention rather than provide genuine merit", student: "a trick or device intended to attract attention rather than provide genuine merit", expect: true, why: "verbatim correct definition" },
  { word: "idiom", english: "a phrase whose meaning cannot be inferred from the literal meanings of its words", student: "a phrase whose meaning cannot be inferred from the literal meanings of its words", expect: true, why: "verbatim correct definition" },
  { word: "remorse", english: "deep regret or guilt for a past wrong or harmful action", student: "deep regret or guilt for a past wrong or harmful action", expect: true, why: "verbatim correct definition" },
  { word: "curmudgeon", english: "a bad-tempered, cantankerous person, typically older and prone to complaint", student: "a bad-tempered, cantankerous person, typically older and prone to complaint", expect: true, why: "verbatim correct definition" },
  { word: "profane", english: "not relating to religion; secular; treating sacred things with disrespect", student: "not relating to religion; secular; treating sacred things with disrespect", expect: true, why: "verbatim correct definition" },
  { word: "osmosis", english: "passage of a solvent through a semipermeable membrane from lower to higher concentration; the gradual, often unconscious assimilation of ideas", student: "passage of a solvent through a semipermeable membrane from lower to higher concentration", expect: true, why: "correct (partial) definition" },
  { word: "conjure", english: "to summon or make appear as if by magic; to call vividly to mind", student: "to call vividly to mind", expect: true, why: "correct partial definition — prompt says partials are CORRECT" },
  { word: "proteges", english: "a person guided and supported in their career by an older, more influential figure", student: "a person guided and supported in their career by an older influential figure", expect: true, why: "correct definition, trivial wording diff" },
  { word: "diminutive", english: "extremely or remarkably small in size", student: "extremely or remarkably small in size", expect: true, why: "verbatim correct definition" },
  // --- controls: must STAY wrong (guard against over-loosening into accept-anything) ---
  { word: "ambiguity", english: "the quality of being open to more than one interpretation; uncertainty of meaning", student: "no idea", expect: false, why: "control: no understanding" },
  { word: "take issue with", english: "to disagree with or challenge a claim, argument, or position", korean: "이의를 제기하다", student: "잇따라 발생하다", expect: false, why: "control: 'occur in succession' — wrong meaning" },
  { word: "discredit", english: "to harm the reputation or credibility of someone or something", korean: "신용을 떨어뜨리다", student: "빗장을 풀어 열다", expect: false, why: "control: 'unbolt a door' — unrelated" },
];

const client = new Anthropic({ apiKey: KEY });
async function gradeOnce(c) {
  const words = [{ wordId: "w1", word: c.word, english: c.english, korean: c.korean || "N/A", student: c.student }];
  const userMessage = `Grade exactly 1 words. Return exactly 1 results.\n\n<words>\n${JSON.stringify(words, null, 2)}\n</words>`;
  const resp = await client.messages.create({ model: MODEL, max_tokens: 1024, temperature: 0.1, system: SYSTEM, messages: [{ role: "user", content: userMessage }] });
  const txt = resp.content[0]?.text || "";
  const mm = txt.match(/\[[\s\S]*\]/);
  return JSON.parse(mm ? mm[0] : txt)[0]?.isCorrect === true;
}
(async () => {
  console.log(`Grader English-def diagnostic — model=${MODEL} temp=0.1 runs=${RUNS} source=${PROMPT_FILE}`);
  console.log(`system prompt: ${SYSTEM.length} chars\n`);
  let falseReject = 0, falseAccept = 0;
  for (const c of FIXTURE) {
    const got = [];
    for (let i = 0; i < RUNS; i++) { try { got.push(await gradeOnce(c)); } catch (e) { console.error(`  ${c.word} run${i + 1} err: ${e.message}`); got.push(null); } }
    const allPass = got.every((g) => g === c.expect);
    if (!allPass) { if (c.expect) falseReject++; else falseAccept++; }
    const mark = allPass ? "OK  " : (c.expect ? "REJECTED(bug)" : "FALSE-ACCEPT");
    console.log(`  [${mark}] ${c.word} expect=${c.expect} got=[${got.join(",")}] — ${c.why}`);
  }
  console.log(`\nfalseRejections(correct defs marked wrong)=${falseReject}  falseAccepts=${falseAccept}`);
  console.log(falseReject > 0 ? `>> BUG CONFIRMED on the current prompt: ${falseReject} correct English definitions still rejected.`
                              : `>> Current prompt already accepts correct English definitions (no fix needed for this pattern).`);
  process.exit(0);
})();
