// CS enroll: manually enroll a student who can't self-join (e.g. incomplete signup → no users/{uid} doc,
// so app-side joinClass throws "User profile not found"). Faithfully replicates createUserDocument (db.js:223)
// + joinClass (db.js:1012): creates the user doc if missing, then members doc + studentIds/studentCount +
// enrolledClasses[classId]={name,joinedAt}. Lists resolve from the class (not per-user). --dry default.
//   NODE_PATH=/app/node_modules node scripts/cs/enroll-student.mjs <email> <JOINCODE> [--commit]
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const FV = admin.firestore.FieldValue;

const email = process.argv[2];
const joinCode = (process.argv[3] || '').trim().toUpperCase();
const COMMIT = process.argv.includes('--commit');
if (!email || !joinCode) { console.error('usage: enroll-student.mjs <email> <JOINCODE> [--commit]'); process.exit(2); }

const u = await auth.getUserByEmail(email);
const uid = u.uid;
const cs = await db.collection('classes').where('joinCode', '==', joinCode).limit(1).get();
if (cs.empty) { console.error(`no class for joinCode ${joinCode}`); process.exit(2); }
const classId = cs.docs[0].id; const classData = cs.docs[0].data();
const displayName = u.displayName || u.email || email;

const userRef = db.collection('users').doc(uid);
const userSnap = await userRef.get();
const alreadyMember = (classData.studentIds || []).includes(uid);

console.log(`student:  ${email} / ${uid.slice(0, 8)} / displayName="${displayName}" (google)`);
console.log(`class:    ${classData.name} (${classId.slice(0, 8)}) joinCode=${classData.joinCode}`);
console.log(`state:    user doc exists=${userSnap.exists} | already in studentIds=${alreadyMember}`);
const plan = [];
if (!userSnap.exists) plan.push(`CREATE users/${uid.slice(0, 8)} (role=student, profile.displayName="${displayName}", app defaults)`);
plan.push(`SET users/${uid.slice(0, 8)}.enrolledClasses[${classId.slice(0, 8)}] = {name, joinedAt}`);
plan.push(`SET classes/${classId.slice(0, 8)}/members/${uid.slice(0, 8)} = {joinedAt, displayName, email}`);
if (!alreadyMember) plan.push(`classes/${classId.slice(0, 8)}: studentIds += ${uid.slice(0, 8)}, studentCount +1`);
console.log('\nPLAN:'); plan.forEach((p) => console.log('  - ' + p));

if (!COMMIT) { console.log('\n[DRY] no writes. add --commit to apply.'); process.exit(0); }

mkdirSync('dsg-edits/enroll_fix', { recursive: true });
writeFileSync(`dsg-edits/enroll_fix/${classId}_${uid.slice(0, 8)}_pre.json`, JSON.stringify({ classId, uid, userDocExisted: userSnap.exists, studentCount: classData.studentCount, studentIds_len: (classData.studentIds || []).length }, null, 2));

if (!userSnap.exists) {
  await userRef.set({
    role: 'student',
    email: u.email || email,
    profile: { displayName, school: '', gradYear: null, gradMonth: null, calculatedGrade: null, avatarUrl: u.photoURL || '' },
    stats: { totalWordsLearned: 0 },
    settings: { weeklyGoal: 100, useUnifiedQueue: false, primaryFocusListId: null, primaryFocusClassId: null },
    challenges: { history: [] },
    enrolledClasses: {},
    createdAt: FV.serverTimestamp(),
    csEnrollNote: 'CS-2026-07-20: manual enroll — Google signup left no users doc; app joinClass threw "profile not found".',
  }, { merge: true });
}
await db.collection('classes').doc(classId).collection('members').doc(uid).set(
  { joinedAt: FV.serverTimestamp(), displayName, email: u.email || email }, { merge: true },
);
if (!alreadyMember) {
  await db.collection('classes').doc(classId).update({ studentCount: FV.increment(1), studentIds: FV.arrayUnion(uid) });
}
await userRef.set({ enrolledClasses: { [classId]: { name: classData.name, joinedAt: FV.serverTimestamp() } } }, { merge: true });

const v = (await userRef.get()).data();
const vc = (await db.collection('classes').doc(classId).get()).data();
console.log('\n✓ COMMITTED. Verify:');
console.log(`  user: role=${v.role} enrolledClasses=[${Object.keys(v.enrolledClasses || {}).map((k) => k.slice(0, 8)).join(',')}] displayName="${v.profile?.displayName}"`);
console.log(`  class: in studentIds=${(vc.studentIds || []).includes(uid)} studentCount=${vc.studentCount}`);
console.log(`  member doc: ${(await db.collection('classes').doc(classId).collection('members').doc(uid).get()).exists}`);
process.exit(0);
