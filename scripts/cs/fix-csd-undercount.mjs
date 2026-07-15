/**
 * CS-2026-07-14b: fix the "completed Day D but csd frozen at D-1" OFF-BY-ONE undercount
 * (reconciliation review-pairing gap; same bug for 박혜린 cross-class + 문서윤/김건우/김우주 same-class).
 *
 * For each email: active (class,list) = most-recent attempt. Computes genuineDay = max studyDay with
 * BOTH a passed 'new' AND a passed 'review' on that list. SAFE off-by-one guard: only corrects when
 *   (a) genuineDay > csd  (undercount), (b) wordsRemaining > 0  (NOT list-end),
 *   (c) twi === anchorNwei+1  (twi already carried to the furthest → only csd lags),
 *   (d) genuineDay - csd <= 3  (small gap, not a class-move carry).
 * Sets currentStudyDay = genuineDay (non-demoting → sticks), backs up, clears the active session_state
 * (forces a clean rebuild to the corrected day). SKIPS anything failing the guard (reports why).
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/fix-csd-undercount.mjs <email> [<email> ...] [--commit]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth(); const T = admin.firestore.Timestamp;
const COMMIT = process.argv.includes('--commit');
const emails = process.argv.slice(2).filter(a => a.includes('@'));
mkdirSync('/app/scripts/cs/backups_csd', { recursive:true });

// pace lookup
const cs = await db.collection('classes').get();
const paceOf = {};
cs.forEach(d=>{const c=d.data(); for(const[lid,a]of Object.entries(c.assignments||{})) paceOf[`${d.id}_${lid}`]=a.pace||80;});

for (const email of emails) {
  let uid; try { uid = (await auth.getUserByEmail(email)).uid; } catch { console.log(`\n${email}: NOT FOUND`); continue; }
  const at = (await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  if (!at.length) { console.log(`\n${email}: no attempts`); continue; }
  const latest = at.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const listId = latest.listId, classId = latest.classId;
  const la = at.filter(a=>a.listId===listId);
  const passedNew = la.filter(a=>a.sessionType==='new'&&a.passed===true);
  const anchor = passedNew.reduce((m,a)=>(a.newWordEndIndex??-1)>(m.newWordEndIndex??-1)?a:m); // furthest
  const anchorNwei = anchor.newWordEndIndex ?? -1;
  const anchorDay = anchor.studyDay;
  const anchorReviewDone = la.some(a=>a.sessionType==='review'&&a.passed===true&&a.studyDay===anchorDay);

  const cpRef = db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`);
  const cpSnap = await cpRef.get();
  if (!cpSnap.exists) { console.log(`\n${email}: no class_progress for active ${classId.slice(0,8)}_${listId.slice(0,8)}`); continue; }
  const p = cpSnap.data(); const csd = p.currentStudyDay||0, twi = p.totalWordsIntroduced||0;
  const ls = await db.collection('lists').doc(listId).get(); const size = ls.exists?(ls.data().wordCount||0):0;
  const pace = paceOf[`${classId}_${listId}`] || 80;
  const wordsRemaining = size - twi;
  const expectedCsd = twi / pace;   // POSITION-SPACE target (pace-aware — avoids cross-pace studyDay artifacts)

  // guards — safe off-by-one only
  const g_cleanBoundary = Number.isInteger(expectedCsd);              // twi at a day boundary for this pace
  const g_undercount = expectedCsd > csd;                            // credited fewer days than words introduced
  const g_notListEnd = wordsRemaining > 0;
  const g_twiCarried = twi === anchorNwei + 1;                       // twi is exactly the furthest anchor
  const g_smallGap = (expectedCsd - csd) <= 2;                       // off-by-one/two, not a class-move carry
  const g_dayComplete = anchorReviewDone;                            // the last introduced day's review is done
  const ok = g_cleanBoundary && g_undercount && g_notListEnd && g_twiCarried && g_smallGap && g_dayComplete;
  const genuineDay = expectedCsd;
  console.log(`\n${email} [${p.classId?.slice(0,8)}_${listId.slice(0,8)}] pace=${pace} csd=${csd} twi=${twi}/${size} → expectedCsd=${expectedCsd} anchorNwei=${anchorNwei} anchorDay=${anchorDay} revDone=${anchorReviewDone}`);
  console.log(`  guards: cleanBoundary=${g_cleanBoundary} undercount=${g_undercount} notListEnd=${g_notListEnd} twiCarried=${g_twiCarried} gap<=2=${g_smallGap} dayComplete=${g_dayComplete} → ${ok?'FIX':'SKIP'}`);
  if (!ok) { console.log('  SKIP (not a clean off-by-one — cross-pace / carry / list-end / mid-day → needs review)'); continue; }

  const ssRef = db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`);
  const ssExists = (await ssRef.get()).exists;
  const backup = { email, uid, cpDoc:`${classId}_${listId}`, before:{csd, twi, currentStudyDay:p.currentStudyDay}, session_state_existed:ssExists };
  writeFileSync(`/app/scripts/cs/backups_csd/${uid}.json`, JSON.stringify(backup,null,2));
  console.log(`  → SET csd ${csd}→${genuineDay} (twi ${twi} unchanged), clear session_state(${ssExists})`);
  if (COMMIT) {
    await cpRef.set({ currentStudyDay: genuineDay,
      csdFixNote: `CS-2026-07-14b: off-by-one csd undercount (Day ${genuineDay} complete, review-pairing gap) — corrected ${csd}→${genuineDay}`,
      updatedAt: T.now() }, { merge: true });
    if (ssExists) await ssRef.delete();
    console.log(`  ✅ csd=${genuineDay}, session_state cleared`);
  }
}
console.log(`\n${COMMIT ? '[COMMITTED]' : '[DRY RUN — add --commit]'}`);
process.exit(0);
