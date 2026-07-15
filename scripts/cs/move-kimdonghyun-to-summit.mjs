/**
 * CS-2026-07-13: move 김동현 (kimdongdongsuper1@gmail.com) to SUMMIT — he finished Ascent (1600)
 * and is frozen on the #11 list-end review-only wall. His Adv B2 class has SUMMIT assigned.
 * Sets settings.primaryFocus{ListId,ClassId} → SUMMIT. Config-only; does NOT touch Ascent progress/attempts.
 *   node scripts/cs/move-kimdonghyun-to-summit.mjs            # DRY (default)
 *   node scripts/cs/move-kimdonghyun-to-summit.mjs --commit   # WRITE
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const COMMIT = process.argv.includes('--commit');

const CLASS = 'qIrJTbwlDOnCKLaTYoz4';   // 26SM SAT Adv B2
const SUMMIT = 'AObYOowhLoOOHx9wW2Sq';  // 26SM VZIP 3K (Summit, 800)
const ASC = 'dVliNv0p9jqZYp9rfLpN';

const u = await auth.getUserByEmail('kimdongdongsuper1@gmail.com'); const uid = u.uid;
const userDoc = await db.collection('users').doc(uid).get();
const settings = userDoc.data()?.settings || {};

// verify SUMMIT is assigned to his class
const cls = (await db.collection('classes').doc(CLASS).get()).data();
const hasSummit = !!(cls.assignments||{})[SUMMIT];
const summitCp = await db.collection('users').doc(uid).collection('class_progress').doc(`${CLASS}_${SUMMIT}`).get();

console.log(`김동현 ${uid}`);
console.log(`  class "${cls.name}" has SUMMIT assigned: ${hasSummit}`);
console.log(`  current settings.primaryFocusListId=${settings.primaryFocusListId} primaryFocusClassId=${settings.primaryFocusClassId}`);
console.log(`  current SUMMIT progress: ${summitCp.exists?`csd=${summitCp.data().currentStudyDay} twi=${summitCp.data().totalWordsIntroduced}`:'(none — will start fresh at Day 1)'}`);
console.log(`  → SET primaryFocus → SUMMIT (${SUMMIT}) in class ${CLASS}`);

if (!hasSummit) { console.log('  !! ABORT: SUMMIT not assigned to this class'); process.exit(1); }

if (COMMIT) {
  await db.collection('users').doc(uid).set({
    settings: { ...settings, primaryFocusListId: SUMMIT, primaryFocusClassId: CLASS },
    csSummitMoveNote: 'CS-2026-07-13: finished Ascent, moved to SUMMIT (frozen on #11 list-end wall)',
  }, { merge: true });
  console.log('  ✅ primaryFocus set to SUMMIT. (Ascent progress 1600/finished left intact.)');
}
console.log(COMMIT ? '\n[COMMITTED]' : '\n[DRY RUN — re-run with --commit]');
process.exit(0);
