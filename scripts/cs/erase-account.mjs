// CS: fully erase a student account (undo enrollment + delete Firestore user doc & subcollections + delete
// Firebase Auth identity) so they can sign up fresh. Backs up first. --dry default; --commit to delete.
//   NODE_PATH=/app/node_modules node scripts/cs/erase-account.mjs <email> [--commit]
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const FV = admin.firestore.FieldValue;

const email = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!email) { console.error('usage: erase-account.mjs <email> [--commit]'); process.exit(2); }

let uid; try { uid = (await auth.getUserByEmail(email)).uid; } catch (e) { console.log(`AUTH: ${email} not found (${e.code}) — nothing to erase.`); process.exit(0); }
const userSnap = await db.collection('users').doc(uid).get();
const urec = userSnap.exists ? userSnap.data() : null;
const enrolled = Object.keys(urec?.enrolledClasses || {});
const SUBS = ['class_progress', 'session_states', 'study_states', 'list_progress', 'progress_meta'];

console.log(`account: ${urec?.profile?.displayName || '?'} / ${email} / uid ${uid.slice(0, 8)}`);
console.log(`  users doc exists: ${userSnap.exists} | role=${urec?.role || '-'} | enrolledClasses=[${enrolled.map((c) => c.slice(0, 8)).join(',')}]`);
const subCounts = {};
for (const s of SUBS) subCounts[s] = (await db.collection('users').doc(uid).collection(s).count().get()).data().count;
console.log(`  subcollections: ${SUBS.map((s) => `${s}=${subCounts[s]}`).join(' ')}`);

// membership across all classes (not just enrolledClasses — belt & suspenders)
const memberOf = [];
const classesSnap = await db.collection('classes').get();
for (const c of classesSnap.docs) { if ((c.data().studentIds || []).includes(uid)) memberOf.push({ id: c.id, name: c.data().name }); }
console.log(`  in studentIds of: ${memberOf.map((m) => `${m.name} (${m.id.slice(0, 8)})`).join(', ') || 'none'}`);

console.log('\nWILL DELETE:');
memberOf.forEach((m) => console.log(`  - classes/${m.id.slice(0, 8)}: studentIds −= ${uid.slice(0, 8)}, studentCount −1, members/${uid.slice(0, 8)}`));
SUBS.forEach((s) => subCounts[s] && console.log(`  - users/${uid.slice(0, 8)}/${s} (${subCounts[s]} docs)`));
console.log(`  - users/${uid.slice(0, 8)} (user doc)`);
console.log(`  - Firebase Auth identity ${uid.slice(0, 8)} (${email})`);

if (!COMMIT) { console.log('\n[DRY] no deletes. add --commit to erase.'); process.exit(0); }

mkdirSync('dsg-edits/erase_account', { recursive: true });
const backup = { email, uid, userDoc: urec, memberOf, subCounts };
for (const s of SUBS) { if (subCounts[s]) backup[s] = (await db.collection('users').doc(uid).collection(s).get()).docs.map((d) => ({ id: d.id, data: d.data() })); }
writeFileSync(`dsg-edits/erase_account/${uid.slice(0, 8)}_${Date.now ? 'backup' : 'backup'}.json`, JSON.stringify(backup, (k, v) => v?.toMillis ? v.toMillis() : v, 2));

for (const m of memberOf) {
  await db.collection('classes').doc(m.id).update({ studentIds: FV.arrayRemove(uid), studentCount: FV.increment(-1) });
  await db.collection('classes').doc(m.id).collection('members').doc(uid).delete().catch(() => {});
}
for (const s of SUBS) { const snap = await db.collection('users').doc(uid).collection(s).get(); for (const d of snap.docs) await d.ref.delete(); }
await db.collection('users').doc(uid).delete();
await auth.deleteUser(uid);

console.log('\n✓ ERASED. Verify:');
console.log('  users doc exists:', (await db.collection('users').doc(uid).get()).exists);
let authGone = false; try { await auth.getUserByEmail(email); } catch { authGone = true; }
console.log('  auth identity gone:', authGone);
for (const m of memberOf) console.log(`  still in ${m.name} studentIds:`, ((await db.collection('classes').doc(m.id).get()).data().studentIds || []).includes(uid));
process.exit(0);
