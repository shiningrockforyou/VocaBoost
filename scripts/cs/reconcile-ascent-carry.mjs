/**
 * Ascent cross-class carry reconcile (CS-2026-07-13). Fixes 3 ADV[한] students whose Ascent
 * progress didn't carry from their prior class. Writes ONLY derived/verified csd/twi (the anchor
 * already exists in their real attempts — NO fabricated anchor) + clears the stale ADV session_state.
 *
 *   node scripts/cs/reconcile-ascent-carry.mjs            # DRY (default) — prints the plan, no writes
 *   node scripts/cs/reconcile-ascent-carry.mjs --commit   # WRITE
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const COMMIT = process.argv.includes('--commit');

const ASC = 'dVliNv0p9jqZYp9rfLpN';
const ADV_HAN = 'OBtxUKiBpHe7SwAGxWP0'; // 26SM 미주 SAT Adv. [한국어 혼용]
const cn = {}; (await db.collection('classes').get()).forEach(d => cn[d.id] = d.data().name?.replace('26SM ',''));
const t = (x) => x?.toDate?.().toISOString?.().slice(0,16) || '—';

const TARGETS = ['lisayiyeon@gmail.com', 'yuhyejun37@gmail.com', 'luckyjiu1004@gmail.com'];

for (const email of TARGETS) {
  const u = await auth.getUserByEmail(email); const uid = u.uid;
  // derive anchor from real attempts (list-scoped)
  const at = (await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  const ascAll = at.filter(a => a.listId===ASC);
  const passedNew = ascAll.filter(a => a.sessionType==='new' && a.passed===true && Number.isInteger(a.newWordEndIndex));
  const anchor = passedNew.reduce((m,a)=> a.newWordEndIndex > m.newWordEndIndex ? a : m, passedNew[0]);
  const anchorDay = anchor.studyDay;
  const twi = anchor.newWordEndIndex + 1;
  const reviewOnAnchorDay = ascAll.some(a => a.sessionType==='review' && a.studyDay===anchorDay);
  const csd = anchorDay <= 1 ? 1 : (reviewOnAnchorDay ? anchorDay : anchorDay - 1);

  // current ADV[한] state
  const cpRef = db.collection('users').doc(uid).collection('class_progress').doc(`${ADV_HAN}_${ASC}`);
  const cp = await cpRef.get();
  const ssRef = db.collection('users').doc(uid).collection('session_states').doc(`${ADV_HAN}_${ASC}`);
  const ss = await ssRef.get();

  console.log(`\n=== ${u.displayName} (${email}) ${uid} ===`);
  console.log(`  anchor: nwei=${anchor.newWordEndIndex} day=${anchorDay} class=${cn[anchor.classId]} passed=${anchor.passed} manual=${anchor.manualOverride||false}  reviewOnDay${anchorDay}=${reviewOnAnchorDay}`);
  console.log(`  DERIVED TARGET -> csd=${csd} twi=${twi}`);
  console.log(`  current ADV[한] class_progress: ${cp.exists?`csd=${cp.data().currentStudyDay} twi=${cp.data().totalWordsIntroduced}`:'(none)'}`);
  console.log(`  current ADV[한] session_state: ${ss.exists?`phase=${ss.data().phase} (will CLEAR)`:'(none)'}`);

  if (COMMIT) {
    await cpRef.set({
      classId: ADV_HAN, listId: ASC,
      currentStudyDay: csd, totalWordsIntroduced: twi,
      csdCarryFixedAt: admin.firestore.Timestamp.now(),
      csdCarryFixNote: `CS-2026-07-13 cross-class Ascent carry reconcile (anchor nwei=${anchor.newWordEndIndex}, from ${cn[anchor.classId]})`,
      updatedAt: admin.firestore.Timestamp.now(),
    }, { merge: true });
    if (ss.exists) await ssRef.delete(); // clear stale session so it rebuilds at the reconciled day
    console.log(`  ✅ WROTE csd=${csd} twi=${twi}${ss.exists?' + cleared session_state':''}`);
  }
}
console.log(`\n${COMMIT ? '[COMMITTED]' : '[DRY RUN — no writes. Re-run with --commit to write.]'}`);
process.exit(0);
