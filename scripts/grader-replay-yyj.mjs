#!/usr/bin/env node
/*
 * Grader REPLAY — 윤여진's real English-definition rejections, sent EXACTLY as functions/index.js sends them.
 *
 * Fidelity (verified against functions/index.js gradeTypedTest):
 *  - inputs are the SERVER-CANONICAL answer key (english=word.definition, korean=word.definitions.ko) resolved
 *    from lists/{listId}/words/{wordId} — reconstructed read-only into scripts/fixtures/yyj_grader_input.json.
 *  - wordsJson row shape { wordId, word, english, korean: korean||"N/A", student } — identical to index.js:1256.
 *  - one batched call (like a real test), userMessage template identical, model=claude-haiku-4-5-20251001,
 *    temperature=0.1, max_tokens=4096.
 *  - system prompt EXTRACTED live from functions/index.js (tests exactly what is deployed, 0992f5f).
 *
 * PURPOSE: confirm whether the CURRENTLY DEPLOYED prompt still rejects these correct English definitions
 * (David decided 2026-07-19: a correct English definition MUST be graded CORRECT). Expected now: rejections
 * persist (my Korean-only fix didn't target this). Doubles as the regression gate for the real fix.
 *
 * Usage (key never in chat):
 *   ANTHROPIC_API_KEY="$(firebase functions:secrets:access ANTHROPIC_API_KEY)" node scripts/grader-replay-yyj.mjs
 *   RUNS=3 to repeat the batch.
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
const PROMPT_FILE = resolve(REPO, "functions", "index.js");

const SRC = readFileSync(PROMPT_FILE, "utf8");
const pm = SRC.match(/const systemMessage = `([\s\S]*?)`;/);
if (!pm) { console.error("ERROR: could not extract systemMessage from functions/index.js"); process.exit(2); }
const SYSTEM = pm[1];

const fx = JSON.parse(readFileSync(resolve(REPO, "scripts", "fixtures", "yyj_grader_input.json"), "utf8"));
// target rows: correct English definitions → MUST be CORRECT
const targets = fx.words.map((w) => ({ ...w, expect: true }));
// a few of 윤여진's genuinely-WRONG answers as controls (must stay wrong → proves the grader still discriminates)
const controls = [
  { wordId: "c1", word: "discredit", english: "to harm the reputation or credibility of someone or something", korean: "신용을 떨어뜨리다", student: "빗장을 풀어 열다", expect: false },
  { wordId: "c2", word: "obstruct", english: "to block or hinder passage, movement, or progress", korean: "가로막다", student: "이동", expect: false },
  { wordId: "c3", word: "take issue with", english: "to disagree with or challenge a claim, argument, or position", korean: "이의를 제기하다", student: "잇따라 발생하다", expect: false },
];
const ALL = [...targets, ...controls];

// build wordsJson EXACTLY like index.js:1256, and the userMessage EXACTLY like index.js
function toWordsJson(rows) {
  return rows.map((a) => ({ wordId: a.wordId, word: a.word, english: a.english, korean: a.korean || "N/A", student: a.student }));
}
const client = new Anthropic({ apiKey: KEY });
async function gradeBatch(rows) {
  const wordsJson = toWordsJson(rows);
  const userMessage = `Grade exactly ${wordsJson.length} words. Return exactly ${wordsJson.length} results.\n\n<words>\n${JSON.stringify(wordsJson, null, 2)}\n</words>`;
  const resp = await client.messages.create({ model: MODEL, max_tokens: 4096, temperature: 0.1, system: SYSTEM, messages: [{ role: "user", content: userMessage }] });
  const txt = resp.content[0]?.text || "";
  const mm = txt.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(mm ? mm[0] : txt);
  const byId = new Map(arr.map((r) => [r.wordId, r.isCorrect === true]));
  return rows.map((r) => byId.get(r.wordId));
}

(async () => {
  console.log(`Grader REPLAY — 윤여진 (${fx.uid}) — model=${MODEL} temp=0.1 max_tokens=4096 batch=${ALL.length} runs=${RUNS}`);
  console.log(`prompt: ${SYSTEM.length} chars from ${PROMPT_FILE} (deployed 0992f5f)\n`);
  const results = ALL.map(() => []);
  for (let r = 0; r < RUNS; r++) {
    try { const got = await gradeBatch(ALL); got.forEach((g, i) => results[i].push(g)); }
    catch (e) { console.error(`run ${r + 1} error: ${e.message}`); ALL.forEach((_, i) => results[i].push(null)); }
  }
  let falseReject = 0, falseAccept = 0;
  console.log("  --- correct English definitions (MUST be CORRECT) ---");
  ALL.forEach((row, i) => {
    const got = results[i];
    const ok = got.every((g) => g === row.expect);
    if (!ok) { if (row.expect) falseReject++; else falseAccept++; }
    if (row.expect === false && i === targets.length) console.log("  --- controls (MUST stay WRONG) ---");
    const mark = ok ? (row.expect ? "OK-correct" : "OK-wrong  ") : (row.expect ? "REJECTED(bug)" : "FALSE-ACCEPT");
    console.log(`   [${mark}] ${row.word}  got=[${got.join(",")}]  student="${String(row.student).trim().slice(0, 60)}"`);
  });
  console.log(`\n  correct-defs rejected (bug): ${falseReject}/${targets.length}   controls broken: ${falseAccept}/${controls.length}`);
  console.log(falseReject > 0
    ? `>> BUG CONFIRMED on deployed prompt 0992f5f: ${falseReject} correct English definitions still rejected. A prompt fix is required.`
    : `>> Deployed prompt already accepts correct English definitions — no further fix needed for this pattern.`);
  process.exit(0);
})();
