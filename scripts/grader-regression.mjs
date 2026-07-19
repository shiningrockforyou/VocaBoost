#!/usr/bin/env node
/*
 * Grader regression harness — Work Item B (2026-07-19).
 *
 * WHY: the deployed grader (functions/index.js, Haiku claude-haiku-4-5) was reported to mark
 * correct one-word Korean translations WRONG (자전적인←autobiographical, etc.). We hardened the
 * prompt (Rule 1 → English-only; Korean translation IS a meaning; + positive CS examples). This
 * script proves, against the REAL model, that (a) the known-correct Korean answers pass and
 * (b) the known-wrong controls still fail — BEFORE any redeploy. It EXTRACTS the live systemMessage
 * from functions/index.js so it always tests exactly what will ship (no drift).
 *
 * The key is a Firebase secret — never paste it into chat. Read it from the secret at run time:
 *   ANTHROPIC_API_KEY="$(firebase functions:secrets:access ANTHROPIC_API_KEY)" \
 *     node scripts/grader-regression.mjs
 *
 * Optional: RUNS=5 (default 3) repeats each case to catch nondeterminism at temperature 0.1.
 *   PROMPT_FILE=/path/to/other.js to point at a different source (e.g. a pre-fix checkout for a baseline).
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Path-portable (Linux/WSL + Windows): resolve everything relative to this script's repo, not a hardcoded root.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(REPO, "functions") + "/"); // load the SDK from functions/node_modules
const Anthropic = require("@anthropic-ai/sdk").default;

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error("ERROR: set ANTHROPIC_API_KEY (e.g. `firebase functions:secrets:access ANTHROPIC_API_KEY`).");
  process.exit(2);
}
const RUNS = Number(process.env.RUNS || 3);
const MODEL = "claude-haiku-4-5-20251001";
const PROMPT_FILE = process.env.PROMPT_FILE || resolve(REPO, "functions", "index.js");

// --- single source of truth: extract the live systemMessage template literal ---
const SRC = readFileSync(PROMPT_FILE, "utf8");
const m = SRC.match(/const systemMessage = `([\s\S]*?)`;/);
if (!m) {
  console.error(`ERROR: could not extract systemMessage from ${PROMPT_FILE}.`);
  process.exit(2);
}
const SYSTEM = m[1];
if (/\$\{/.test(SYSTEM)) {
  console.error("ERROR: extracted systemMessage contains ${...} interpolation — extractor needs updating.");
  process.exit(2);
}

// --- Codex r35 fixture: known-correct Korean + known-wrong controls ---
const FIXTURE = [
  { word: "autobiographical", english: "relating to one's own life", korean: "자전적인", student: "자전적인", expect: true,  why: "direct Korean meaning" },
  { word: "indifferent",      english: "having no interest or concern", korean: "무관심한", student: "무관심한", expect: true,  why: "direct Korean meaning" },
  { word: "dissonance",       english: "a lack of harmony among musical notes", korean: "불협화음", student: "불협화음", expect: true,  why: "direct Korean meaning" },
  { word: "dissonance",       english: "a lack of harmony among musical notes", korean: "불협화음", student: "불협화믐", expect: true,  why: "minor typo near 불협화음" },
  { word: "culminate",        english: "to reach the highest or climactic point", korean: "절정에 이르다", student: "요점", expect: false, why: "요점=main point ≠ climax (control)" },
  { word: "dispel",           english: "to drive away or make disappear", korean: "없애다", student: "express disapproval", expect: false, why: "confuses dispel with disapprove (control)" },
  { word: "piano",            english: "a large keyboard musical instrument", korean: "피아노", student: "피아노", expect: true,  why: "established loanword" },
  { word: "grief",            english: "deep sorrow", korean: "슬픔", student: "그리프", expect: false, why: "ad-hoc transliteration (control)" },
  { word: "run",              english: "to move quickly on foot", korean: "달리다", student: "running", expect: false, why: "English inflection (control)" },
];

const client = new Anthropic({ apiKey: KEY });

async function gradeOnce(c) {
  const words = [{ wordId: "w1", word: c.word, english: c.english, korean: c.korean || "N/A", student: c.student }];
  const userMessage = `Grade exactly 1 words. Return exactly 1 results.\n\n<words>\n${JSON.stringify(words, null, 2)}\n</words>`;
  const resp = await client.messages.create({
    model: MODEL, max_tokens: 1024, temperature: 0.1, system: SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });
  const txt = resp.content[0]?.text || "";
  const arrMatch = txt.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(arrMatch ? arrMatch[0] : txt);
  return arr[0]?.isCorrect === true;
}

(async () => {
  console.log(`Grader regression — model=${MODEL} temp=0.1 runs=${RUNS} source=${PROMPT_FILE}`);
  console.log(`system prompt: ${SYSTEM.length} chars extracted\n`);
  let falseReject = 0, falseAccept = 0, unstable = 0;
  for (const c of FIXTURE) {
    const got = [];
    for (let i = 0; i < RUNS; i++) {
      try { got.push(await gradeOnce(c)); }
      catch (e) { console.error(`  [${c.word}/${c.student}] run ${i + 1} error: ${e.message}`); got.push(null); }
    }
    const allPass = got.every((g) => g === c.expect);
    const stable = got.every((g) => g === got[0]);
    if (!stable) unstable++;
    if (!allPass) {
      if (c.expect === true) falseReject++; else falseAccept++;
    }
    const mark = allPass ? "PASS" : (c.expect ? "FALSE-REJECT" : "FALSE-ACCEPT");
    console.log(`  [${mark}] ${c.word} ← "${c.student}" expect=${c.expect} got=[${got.join(",")}] (${c.why})`);
  }
  console.log(`\nSummary: falseRejections=${falseReject} falseAccepts=${falseAccept} unstable=${unstable}`);
  const ok = falseReject === 0 && falseAccept === 0;
  console.log(ok ? "RESULT: PASS — safe to deploy (zero false-reject/accept)."
                 : "RESULT: FAIL — do NOT deploy; investigate the flagged rows.");
  process.exit(ok ? 0 : 1);
})();
