/**
 * CS-2026-07-15: 김유림 (kyrpp12@gmail.com) — 승반 Adv B2→Adv A2; her real Ascent progress (Day 12,
 * twi 960) is under Inter A2 (TyBnqbcc) so Adv A2 (canonical per chat) shows "진도 확인 안 됨".
 * Carry: replicate HER OWN Inter A2 Ascent class_progress into Adv A2 (Nys1FfB9), change only classId;
 * clear Adv A2 Ascent session_state (rebuild → Day 13); pin primaryFocus → Adv A2/Ascent.
 * Copies her own doc (same student → programStartDate etc. are correctly hers). Non-demoting.
 * Inter A2 / Adv B2 left enrolled (drop is a separate destructive step — flagged, not done).
 *   node scripts/cs/fix-kimyurim-carry.mjs [--commit]
 */
import admin from 'firebase-admin'; import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db=admin.firestore(); const T=admin.firestore.Timestamp;
const COMMIT=process.argv.includes('--commit');
const uid='xePwBYI7zkXeLWvupHjJeNlCd3o2';
const ADVA2='Nys1FfB9Pkl1iyO5FYhx', ASC='dVliNv0p9jqZYp9rfLpN';
const srcRef=db.collection('users').doc(uid).collection('class_progress').doc(`TyBnqbcc3PZJzNzUhHek_${ASC}`);
const dstRef=db.collection('users').doc(uid).collection('class_progress').doc(`${ADVA2}_${ASC}`);
const src=(await srcRef.get()).data();
const dstExists=(await dstRef.get()).exists;
const ssRef=db.collection('users').doc(uid).collection('session_states').doc(`${ADVA2}_${ASC}`);
const ssExists=(await ssRef.get()).exists;

// build the carried doc: copy her own fields, override classId + note
const carried={ ...src, classId: ADVA2, listId: ASC,
  carryNote:`CS-2026-07-15: 승반 carry from Inter A2 (TyBnqbcc) — canonical Adv A2 per chat`, updatedAt: T.now() };
console.log(`김유림 carry → Adv A2`);
console.log(`  SRC Inter A2 Ascent: csd=${src.currentStudyDay} twi=${src.totalWordsIntroduced} interv=${src.interventionLevel} recentSessions=${(src.recentSessions||[]).length} programStart=${src.programStartDate}`);
console.log(`  DST Adv A2 Ascent exists=${dstExists} → SET csd=${carried.currentStudyDay} twi=${carried.totalWordsIntroduced} (mirror); clear ss(${ssExists}); pf→Adv A2/Ascent`);
if(COMMIT){
  await dstRef.set(carried,{merge:true});
  if(ssExists) await ssRef.delete();
  const u=(await db.collection('users').doc(uid).get()).data()?.settings||{};
  await db.collection('users').doc(uid).set({settings:{...u,primaryFocusListId:ASC,primaryFocusClassId:ADVA2}, csAdvanceNote:'CS-2026-07-15: 승반 carry to Adv A2 (canonical)'},{merge:true});
  console.log('  ✅ Adv A2 Ascent cp created (csd 12/twi 960), session cleared, pf pinned to Adv A2');
} else console.log('\n[DRY — add --commit]');
process.exit(0);
