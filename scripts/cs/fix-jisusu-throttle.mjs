/**
 * CS-2026-07-14: 정지수 (jisusophia@gmail.com, SAT Adv A2, Ascent) — #11 THROTTLE review-only deadlock.
 * interv→1.0 (last-3 reviews [0.23,0.17,0.23]) → Day 6 newWords=0 → review-only → completion gate blocks →
 * csd frozen at 5, she re-took Day-6 review 10× (best 97%). Manual application of the (undeployed) #11 fix:
 * COMPLETE her frozen Day-6 review-only using her BEST real Day-6 review (0.97) → csd 5→6, interv recovers →
 * Day 7 gets ~28 new words. Same as Junseo (CS-2026-07-13c). Derived/verified value; no fabricated attempt.
 *   node scripts/cs/fix-jisusu-throttle.mjs [--commit]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const T = admin.firestore.Timestamp;
const COMMIT = process.argv.includes('--commit');

const uid = 'eGBgVXlIekahvOS98nUHNOOaFrs1';
const CP = 'Nys1FfB9Pkl1iyO5FYhx_dVliNv0p9jqZYp9rfLpN';
const ref = db.collection('users').doc(uid).collection('class_progress').doc(CP);
const ssRef = db.collection('users').doc(uid).collection('session_states').doc(CP);
const cur = (await ref.get()).data();

const recent = [...(cur.recentSessions || [])];
// frozen Day-6 review-only completion, best real Day-6 review = 0.97 (score 97, 30 Qs). Review-only → wordsIntroduced 0.
const day6 = { day: 6, newWordScore: null, reviewScore: 0.97, segmentStartIndex: 320, segmentEndIndex: 399,
  wordsIntroduced: 0, wordsReviewed: 30, wordsTested: 30, date: new Date() };
const newRecent = [...recent, day6].slice(-10);
const revs = newRecent.map(s => s.reviewScore).filter(x => x != null).slice(-3);
const avg = revs.reduce((a,b)=>a+b,0)/(revs.length||1);
const interv = revs.length < 3 ? 0 : Math.min(1, Math.max(0, (0.75 - avg) / 0.45));
const ssExists = (await ssRef.get()).exists;

console.log(`정지수 ${uid}`);
console.log(`  current: csd=${cur.currentStudyDay} twi=${cur.totalWordsIntroduced} interv(stored)=${cur.interventionLevel} recent=${recent.length}`);
console.log(`  → COMPLETE Day-6 review-only: csd 5→6, append {day6 review=0.97}, last3rev=${JSON.stringify(revs.map(r=>+r.toFixed(2)))} → interv ${interv.toFixed(2)}`);
console.log(`     Day-7 newWords = round(80*(1-${interv.toFixed(2)})) = ${Math.round(80*(1-interv))}; clear session_state(${ssExists})`);
console.log(`  twi stays 400 (review-only day introduces no new words). Anchor (passed-new Day 5) untouched.`);

if (COMMIT) {
  await ref.set({ currentStudyDay: 6, recentSessions: newRecent, interventionLevel: interv,
    csdFixNote: 'CS-2026-07-14: #11 throttle deadlock — manually completed frozen Day-6 review-only (best real review 0.97); interv recovered', updatedAt: T.now() }, { merge: true });
  if (ssExists) await ssRef.delete();
  console.log('  ✅ csd=6, recentSessions appended, interv set, session_state cleared');
} else {
  console.log('\n[DRY RUN — re-run with --commit]');
}
process.exit(0);
