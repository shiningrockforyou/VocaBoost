/**
 * Persona expansion — per-tier wordmap builder (Admin SDK, READ-ONLY on lists; writes a local JSON artifact).
 * David 2026-07-12 / PX-6: build a wordmap for each tier list (Base Camp / Ascent / Summit) from each word
 * doc's `definition` field, so the harness can type a canonical answer the server grades against (the server
 * backfills `correctDefinition` from the SAME `lists/{listId}/words/{wordId}.definition` via
 * resolveAnswerDefinitions). Keys match the harness lookup EXACTLY: norm(bareWord(word)).
 *
 * Output: audit/playwright/lsr_tier_wordmaps.json = { builtAt, tiers: { base|ascent|summit: {
 *   srcId, wordCount, map: { [normKey]: { def, ko, word, position } } } } }
 *
 * Asserts (Phase-A data gate — NON-grader half of PX-6):
 *   - every word doc yields a non-empty `def`  (no blank answers → no all-blank submission)
 *   - no two words in a tier collide on the same normKey (would make one word unanswerable)
 * The LIVE grader-PASS half of PX-6 (does a typed `definition` actually score PASS?) is asserted in the
 * first smoke run of the segment runner, BEFORE the full fleet.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_build_wordmaps.mjs
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();

// Same key functions as lsr_ui.mjs (norm + bareWord) — keep in sync.
const norm = (w) => (w || '').toLowerCase().trim();
const bareWord = (w) => (w || '').split(/[\r\n]/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim();

// Tier source list IDs come from teacher_01's clones (all teachers' clones are byte-identical copies of the
// same source, so one map per tier serves every teacher). Resolve from lsr_lists.json.
const lists = JSON.parse(readFileSync('/app/audit/playwright/lsr_lists.json', 'utf8'));
const t01 = lists.teachers['lsr_teacher_01@vocaboost.test'].lists;
const TIERS = ['base', 'ascent', 'summit'].map((tier) => {
  const l = t01.find((x) => x.tier === tier);
  if (!l?.newId) { console.error(`no ${tier} clone in lsr_lists.json`); process.exit(1); }
  return { tier, id: l.newId };
});

const tiersOut = {};
let anyFail = false;
for (const { tier, id } of TIERS) {
  const words = await db.collection('lists').doc(id).collection('words').get();
  const map = {};
  const collisions = [];
  let blank = 0;
  for (const w of words.docs) {
    const d = w.data();
    const key = norm(bareWord(d.word));
    // Korean lives in definitions.ko (NOT a flat koreanDefinition field — my first build missed it → the
    // harness answered in verbatim ENGLISH, which the AI grader intermittently rejects as "restated word-for-
    // word", failing ~half of 30-word tests). Prefer definitions.ko so the harness answers in Korean (the
    // grader's stated preference → demonstrates understanding, not copying).
    const def = (d.definition || d.definitions?.en || '').trim();
    const ko = (d.definitions?.ko || d.koreanDefinition || '').trim();
    if (!def && !ko) { blank++; continue; }
    if (map[key] && map[key].word !== d.word) collisions.push(`${key} (${map[key].word} / ${d.word})`);
    map[key] = { def, ko, word: d.word, position: d.position };
  }
  const entries = Object.keys(map).length;
  const ok = blank === 0 && collisions.length === 0 && entries > 0;
  if (!ok) anyFail = true;
  tiersOut[tier] = { srcId: id, wordCount: words.size, entries, blank, collisions: collisions.slice(0, 10), map };
  console.log(`${ok ? '✅' : '❌'} ${tier} (${id.slice(0, 8)}): ${words.size} words → ${entries} entries | blank=${blank} | collisions=${collisions.length}${collisions.length ? ' [' + collisions.slice(0, 5).join('; ') + ']' : ''}`);
}

// Strip the bulky `map` from the console summary but keep it in the file.
writeFileSync('/app/audit/playwright/lsr_tier_wordmaps.json', JSON.stringify({ builtAt: new Date().toISOString(), tiers: tiersOut }, null, 2));
console.log('\n→ audit/playwright/lsr_tier_wordmaps.json');
console.log(anyFail ? '❌ DATA GATE FAILED (blank defs or key collisions) — fix before fleet' : '✅ data gate PASS (100% non-blank, no collisions). Live grader-PASS gate → smoke run.');
process.exit(anyFail ? 1 : 0);
