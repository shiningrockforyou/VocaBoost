// CS class-change carry: replicate a student's OWN list progress into a target class (same list) so a
// class move doesn't reset them to Day 1. Computes the deployed reconciler's csd/twi from her real anchor
// (twi=nwei+1; csd=reviewExists(anchorDay)?anchorDay:anchorDay-1), copies HER OWN source-doc fields
// (recentSessions/programStartDate/reviewMode/interventionLevel/stats — no cross-student leak), clears the
// target session_state, pins primaryFocus. --dry default. Backs up.
//   NODE_PATH=/app/node_modules node scripts/cs/carry-progress.mjs <email> <targetClassId> <listId> [--commit]
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(); const auth = admin.auth();

const email = process.argv[2], targetClassId = process.argv[3], listId = process.argv[4];
const COMMIT = process.argv.includes('--commit');
if (!email || !targetClassId || !listId) { console.error('usage: carry-progress.mjs <email> <targetClassId> <listId> [--commit]'); process.exit(2); }

const uid = (await auth.getUserByEmail(email)).uid;
const u = (await db.collection('users').doc(uid).get()).data();
const clsN = {}; (await db.collection('classes').get()).forEach(c => (clsN[c.id] = c.data().name));

// list-scoped attempts (cross-class, student+list) — the reconcile authority
const at = (await db.collection('attempts').where('studentId', '==', uid).get()).docs.map(d => d.data()).filter(a => a.listId === listId);
const passedNew = at.filter(a => a.sessionType === 'new' && a.passed === true && Number.isInteger(a.newWordEndIndex))
  .sort((a, b) => b.newWordEndIndex - a.newWordEndIndex)[0];
if (!passedNew) { console.error('no passed-new anchor for this list — cannot carry'); process.exit(1); }
const anchorDay = passedNew.studyDay;
const twi = passedNew.newWordEndIndex + 1;
const reviewExists = at.some(a => a.sessionType === 'review' && a.studyDay === anchorDay);
const csd = reviewExists ? anchorDay : anchorDay - 1;

// her OWN source class_progress for this list (the one with real progress) — to copy personal fields
const cps = (await db.collection('users').doc(uid).collection('class_progress').get()).docs
  .map(d => ({ id: d.id, ...d.data() })).filter(p => p.listId === listId);
const source = cps.filter(p => p.classId !== targetClassId).sort((a, b) => (b.totalWordsIntroduced || 0) - (a.totalWordsIntroduced || 0))[0];
const targetDocId = `${targetClassId}_${listId}`;
const targetRef = db.collection('users').doc(uid).collection('class_progress').doc(targetDocId);
const targetExisting = (await targetRef.get()).data();

console.log(`student: ${u?.profile?.displayName} / ${email} / ${uid.slice(0, 8)}`);
console.log(`  anchor: day ${anchorDay} new passed (nwei ${passedNew.newWordEndIndex}) → twi=${twi}, reviewExists(d${anchorDay})=${reviewExists} → csd=${csd}`);
console.log(`  source: [${clsN[source?.classId] || source?.classId?.slice(0, 8)}] csd=${source?.currentStudyDay} twi=${source?.totalWordsIntroduced} (copy recentSessions/programStartDate/reviewMode/interv)`);
console.log(`  target: [${clsN[targetClassId] || targetClassId.slice(0, 8)}] ${targetDocId.slice(0, 24)} — ${targetExisting ? `EXISTS csd=${targetExisting.currentStudyDay}` : 'does NOT exist (→ shows Day 1)'}`);
console.log(`  WRITE target: csd=${csd} twi=${twi} → student lands on Day ${csd + 1} (${reviewExists ? 'new day' : 'day ' + anchorDay + ' review pending'})`);
console.log(`  + clear target session_state + pin primaryFocus → ${targetClassId.slice(0, 8)}/${listId.slice(0, 8)}`);

if (!COMMIT) { console.log('\n[DRY] no writes. add --commit.'); process.exit(0); }

mkdirSync('dsg-edits/carry_fix', { recursive: true });
writeFileSync(`dsg-edits/carry_fix/${uid.slice(0, 8)}_${targetClassId.slice(0, 8)}_pre.json`,
  JSON.stringify({ source, targetExisting, computed: { csd, twi, anchorDay } }, (k, v) => v?.toMillis ? v.toMillis() : v, 2));

const now = admin.firestore.Timestamp.now();
const payload = {
  classId: targetClassId, listId,
  currentStudyDay: csd, totalWordsIntroduced: twi,
  recentSessions: source?.recentSessions || [],
  interventionLevel: source?.interventionLevel ?? 0,
  ...(source?.reviewMode !== undefined ? { reviewMode: source.reviewMode } : {}),
  stats: source?.stats || {},
  streakDays: source?.streakDays ?? 0,
  programStartDate: source?.programStartDate || now,
  updatedAt: now,
  csFixNote: `CS-2026-07-23 class-change carry from ${clsN[source?.classId] || source?.classId} → target; anchor d${anchorDay} nwei ${passedNew.newWordEndIndex}.`,
};
if (!targetExisting) payload.createdAt = now;
await targetRef.set(payload, { merge: true });
// clear target session_state
await db.collection('users').doc(uid).collection('session_states').doc(targetDocId).delete().catch(() => {});
// pin focus
await db.collection('users').doc(uid).set({ settings: { primaryFocusListId: listId, primaryFocusClassId: targetClassId } }, { merge: true });

const v = (await targetRef.get()).data();
console.log(`\n✓ COMMITTED. target now: csd=${v.currentStudyDay} twi=${v.totalWordsIntroduced} → Day ${v.currentStudyDay + 1}. session cleared, focus pinned.`);
process.exit(0);
