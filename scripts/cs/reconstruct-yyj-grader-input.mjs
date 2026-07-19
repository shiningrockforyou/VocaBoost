// READ-ONLY: reconstruct the EXACT grader model-input for 윤여진's English-definition false-negatives,
// faithful to production. The server (functions/index.js:761-792) resolves the answer key canonically from
// lists/{listId}/words/{wordId}: english = word.definition, korean = word.definitions.ko. The model then sees
// wordsJson = { wordId, word, english: correctDefinition, korean: koreanDefinition||"N/A", student }.
// This script joins each wrongly-marked English-def answer to its list word for the CANONICAL defs, and writes
// the exact per-word payloads (+ the recorded isCorrect/aiReasoning) to a JSON the replayer will send to Haiku.
// No writes. Usage: NODE_PATH=/app/node_modules node scripts/cs/reconstruct-yyj-grader-input.mjs
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();

const UID = '31WgOWbh0000'.slice(0, 0) || process.argv[2] || '31WgOWbh'; // 베트남-윤여진 (resolve full uid below)
const hasHangul = (s) => /[가-힣]/.test(String(s || ''));

// resolve the full uid by displayName (the short prefix is only for logging)
let fullUid = null, name = '';
const us = await db.collection('users').get();
us.forEach((d) => { const u = d.data(); const dn = u?.profile?.displayName || ''; if (dn.includes('윤여진')) { fullUid = d.id; name = dn; } });
if (!fullUid) { console.error('윤여진 not found'); process.exit(1); }
console.log(`student: ${name} (${fullUid})`);

const attempts = (await db.collection('attempts').where('studentId', '==', fullUid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

// word-list cache: lists/{listId}/words/{wordId} → canonical { word, definition (en), definitions.ko }
const wordCache = new Map();
async function canonWord(listId, wordId) {
  const key = `${listId}/${wordId}`;
  if (!wordCache.has(key)) {
    let w = null;
    try { const s = await db.collection('lists').doc(listId).collection('words').doc(wordId).get(); w = s.exists ? s.data() : null; } catch { w = null; }
    wordCache.set(key, w);
  }
  return wordCache.get(key);
}

// collect target rows: English response, isCorrect:false, aiReasoning ~ "restated the (English) definition"
const targets = [];
for (const a of attempts) {
  if (!Array.isArray(a.answers)) continue;
  for (const ans of a.answers) {
    const resp = String(ans?.studentResponse || '').trim();
    if (ans?.isCorrect === false && resp && !hasHangul(resp) && /restat/i.test(ans?.aiReasoning || '')) {
      const w = a.listId ? await canonWord(a.listId, ans.wordId) : null;
      targets.push({
        attemptId: a.id, listId: a.listId, sessionType: a.sessionType, wordId: ans.wordId,
        word: w?.word ?? ans.word,
        english: (w?.definition) ?? ans.correctAnswer,        // server-canonical english (fallback to stored)
        korean: (w?.definitions && w.definitions.ko) || 'N/A',// server-canonical korean (missing → N/A, as server does)
        student: ans.studentResponse,
        recorded_isCorrect: ans.isCorrect, recorded_aiReasoning: ans.aiReasoning || '',
        listWordResolved: !!w,
      });
    }
  }
}

console.log(`target English-def false-negatives: ${targets.length}  (list-word resolved: ${targets.filter(t => t.listWordResolved).length}/${targets.length})`);
// dedupe by word (same word rejected across retries → one representative, keep first)
const seen = new Set(); const uniq = [];
for (const t of targets) { if (!seen.has(t.word)) { seen.add(t.word); uniq.push(t); } }
console.log(`unique words: ${uniq.length}`);
uniq.slice(0, 40).forEach((t) => console.log(`  ${t.word}\n     EN(list) ="${t.english}"\n     KO(list) ="${t.korean}"\n     STUDENT  ="${t.student}"\n     recorded : isCorrect=${t.recorded_isCorrect}`));

mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });
const out = new URL('../fixtures/yyj_grader_input.json', import.meta.url);
writeFileSync(out, JSON.stringify({ student: name, uid: fullUid, generatedFrom: 'live 26SM read-only', words: uniq.map(({ wordId, word, english, korean, student, recorded_isCorrect, recorded_aiReasoning }) => ({ wordId, word, english, korean, student, recorded_isCorrect, recorded_aiReasoning })) }, null, 2));
console.log(`\nwrote exact payloads → scripts/fixtures/yyj_grader_input.json`);
process.exit(0);
