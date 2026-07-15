/**
 * CS-2026-07-13c: unstick 2 students.
 *   Kaila (kailachung2008) — cross-class csd UNDERCOUNT: Final Ascent csd=2 but Day 3 is complete → set csd=3 (non-demoting, sticks).
 *   Junseo (junseogim728) — #11 throttle deadlock (interv=1.0 → newWordCount=0 → review gate blocks). Manually COMPLETE his
 *     frozen day-5 review-only day (csd 4→5) with his best real day-5 review (0.70) → interv drops to ~0.78 → day 6 gets ~18 new words.
 *     This is a MANUAL application of the (undeployed) Phase-1 #11 fix. TEMPORARY: he stays review-heavy until his reviews improve.
 *   node scripts/cs/fix-kaila-junseo.mjs [--commit]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const COMMIT = process.argv.includes('--commit');
const T = admin.firestore.Timestamp;

// ---- Kaila ----
{
  const u = await auth.getUserByEmail('kailachung2008@gmail.com'); const uid = u.uid;
  const ref = db.collection('users').doc(uid).collection('class_progress').doc('EcLMtUCc6uI1JJDcKuNI_dVliNv0p9jqZYp9rfLpN');
  const cur = (await ref.get()).data();
  console.log(`\nKaila ${uid}`);
  console.log(`  Final Ascent current: csd=${cur.currentStudyDay} twi=${cur.totalWordsIntroduced}  → SET csd=3 (Day 3 complete; non-demoting so it sticks)`);
  if (COMMIT) {
    await ref.set({ currentStudyDay: 3, csdFixNote: 'CS-2026-07-13c: cross-class csd undercount (review-pairing failed) — corrected 2→3', updatedAt: T.now() }, { merge: true });
    console.log('  ✅ set csd=3');
  }
}

// ---- Junseo ----
{
  const u = await auth.getUserByEmail('junseogim728@gmail.com'); const uid = u.uid;
  const ref = db.collection('users').doc(uid).collection('class_progress').doc('sO7jN85mL5ZsaBY1BbGm_RmNNkuLPectBlBPiLbAJ');
  const cur = (await ref.get()).data();
  const recent = [...(cur.recentSessions || [])];
  const day5 = { day: 5, date: new Date(), newWordScore: null, reviewScore: 0.70, segmentStartIndex: 240, segmentEndIndex: 319, wordsIntroduced: 0, wordsReviewed: 39, wordsTested: 39 };
  const newRecent = [...recent, day5].slice(-10);
  const revs = newRecent.map(s => s.reviewScore).filter(x => x != null).slice(-3);
  const avg = revs.reduce((a,b)=>a+b,0)/(revs.length||1);
  const interv = revs.length < 3 ? 0 : Math.min(1, Math.max(0, (0.75 - avg) / 0.45));
  const ssRef = db.collection('users').doc(uid).collection('session_states').doc('sO7jN85mL5ZsaBY1BbGm_RmNNkuLPectBlBPiLbAJ');
  const ssExists = (await ssRef.get()).exists;
  console.log(`\nJunseo ${uid}`);
  console.log(`  BaseCamp current: csd=${cur.currentStudyDay} twi=${cur.totalWordsIntroduced} recent=${recent.length}`);
  console.log(`  → COMPLETE day-5 review-only: csd 4→5, append {day5 review=0.70}, interv → ${interv.toFixed(2)} (day6 newWords=round(80*${(1-interv).toFixed(2)})=${Math.round(80*(1-interv))}), clear session_state(${ssExists})`);
  if (COMMIT) {
    await ref.set({ currentStudyDay: 5, recentSessions: newRecent, interventionLevel: interv,
      csdFixNote: 'CS-2026-07-13c: #11 throttle deadlock — manually completed frozen day-5 review-only (review 0.70); interv recovered', updatedAt: T.now() }, { merge: true });
    if (ssExists) await ssRef.delete();
    console.log('  ✅ csd=5, recentSessions appended, interv set, session cleared');
  }
}
console.log(`\n${COMMIT ? '[COMMITTED]' : '[DRY RUN — re-run with --commit]'}`);
process.exit(0);
