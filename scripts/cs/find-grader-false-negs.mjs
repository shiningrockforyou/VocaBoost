// READ-ONLY diagnostic: find a student's wrongly-graded (isCorrect:false) answers, categorized by
// Korean-response (grader false-negative — the calibration bug) vs English/other (may be correctly wrong,
// e.g. the deterministic restating-the-word filter). No writes. Usage:
//   NODE_PATH=/app/node_modules node scripts/cs/find-grader-false-negs.mjs [name=윤여진]
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();

const NAME = process.argv[2] || '윤여진';
const hasHangul = (s) => /[가-힣]/.test(String(s || ''));

// 1. resolve the student(s) by displayName
const usersSnap = await db.collection('users').get();
const matches = [];
usersSnap.forEach((d) => {
  const u = d.data();
  const dn = u?.profile?.displayName || u?.displayName || '';
  if (dn.includes(NAME)) matches.push({ uid: d.id, name: dn, email: u?.email || '?' });
});
console.log(`users matching "${NAME}": ${matches.length}`);
matches.forEach((m) => console.log(`  ${m.uid.slice(0, 8)}  ${m.name}  ${m.email}`));
if (!matches.length) { console.log('no match — try a partial name'); process.exit(0); }

// 2. pull attempts, extract wrongly-marked non-empty answers
for (const m of matches) {
  const at = (await db.collection('attempts').where('studentId', '==', m.uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`\n=== ${m.name} (${m.uid.slice(0, 8)}) — ${at.length} attempts ===`);
  const firstWithAnswers = at.find((a) => Array.isArray(a.answers) && a.answers.length);
  if (firstWithAnswers) console.log('  sample answer schema keys:', Object.keys(firstWithAnswers.answers[0] || {}).join(', '));
  const wrong = [];
  for (const a of at) {
    if (!Array.isArray(a.answers)) continue;
    for (const ans of a.answers) {
      if (ans?.isCorrect === false && String(ans?.studentResponse || '').trim() !== '') {
        wrong.push({
          sessionType: a.sessionType, listId: a.listId,
          word: ans.word, correctAnswer: ans.correctAnswer, student: ans.studentResponse,
          aiReasoning: ans.aiReasoning || '', challengeStatus: ans.challengeStatus || '',
          challengeNote: ans.challengeNote || '', kr: hasHangul(ans.studentResponse),
        });
      }
    }
  }
  const koreanWrong = wrong.filter((w) => w.kr);
  const englishWrong = wrong.filter((w) => !w.kr);
  // quantify the two failure modes
  const norm = (s) => String(s || '').toLowerCase().replace(/^[\s①②③④⑤]+/, '').replace(/[\s.;]+/g, ' ').trim();
  const restatedReject = wrong.filter((w) => /restat/i.test(w.aiReasoning));
  const verbatimCopyWrong = wrong.filter((w) => { const s = norm(w.student), c = norm(w.correctAnswer); return c && (s === c || (c.includes(s) && s.length > 15) || (s.includes(c) && c.length > 15)); });
  console.log(`  wrongly-marked (non-empty): ${wrong.length}  [Korean-response: ${koreanWrong.length} | English/other: ${englishWrong.length}]`);
  console.log(`  >> "restated the definition" rejections : ${restatedReject.length}`);
  console.log(`  >> answer marked wrong that MATCHES the answer key (정답과 똑같이 써도 오답): ${verbatimCopyWrong.length}`);
  const show = (w) => console.log(`   [${w.sessionType}] ${w.word}\n       correctAnswer="${w.correctAnswer}"\n       STUDENT      ="${w.student}"\n       aiReasoning  ="${w.aiReasoning}"  challenge=${w.challengeStatus||'-'}`);
  console.log('\n  ===== KOREAN-response wrong =====');
  koreanWrong.slice(0, 50).forEach(show);
  console.log('\n  ===== ENGLISH/other wrong =====');
  englishWrong.slice(0, 30).forEach(show);
}
process.exit(0);
