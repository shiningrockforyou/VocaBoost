// READ-ONLY diagnostic: student entered a join code but "can't get in to take a test."
// Checks account existence, enrollment (studentIds + enrolledClasses), assignedLists (empty = NEED_TO_FIX #7
// hides all lists), class assignments, and class_progress. No writes.
// Usage: NODE_PATH=/app/node_modules node scripts/cs/diag-enrollment.mjs <email> [classNameHint]
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const auth = admin.auth();

const email = process.argv[2] || '05372@eis.ac.th';
const hint = process.argv[3] || 'Adv E';

let uid = null, urec = null;
try { uid = (await auth.getUserByEmail(email)).uid; }
catch (e) { console.log(`AUTH: ${email} — NOT FOUND (${e.code}). The account may not exist, or he signed up with a different email.`); }

if (uid) {
  urec = (await db.collection('users').doc(uid).get()).data() || null;
  console.log(`USER: ${urec?.profile?.displayName || '?'} / ${email} / uid ${uid.slice(0, 8)} / role=${urec?.role || urec?.profile?.role || '?'}`);
  const ec = urec?.enrolledClasses || {};
  console.log(`enrolledClasses: ${Object.keys(ec).length}`);
  for (const [cid, v] of Object.entries(ec)) {
    let cn = '?'; try { cn = (await db.collection('classes').doc(cid).get()).data()?.name; } catch {}
    const al = v?.assignedLists;
    const flag = Array.isArray(al) && al.length === 0 ? '  ← EMPTY assignedLists (NEED_TO_FIX #7: hides ALL lists → "no lists / can\'t start a test")' : '';
    console.log(`  - ${cn} (${cid.slice(0, 8)}): assignedLists=${Array.isArray(al) ? `[${al.length}]` : JSON.stringify(al)}${flag}`);
  }
}

const classes = await db.collection('classes').get();
const matches = classes.docs.filter((d) => new RegExp(hint, 'i').test(d.data().name || ''));
console.log(`\nclasses matching "${hint}": ${matches.length}`);
for (const c of matches) {
  const cd = c.data();
  const inRoster = uid ? (cd.studentIds || []).includes(uid) : null;
  const assigns = cd.assignments ? Object.keys(cd.assignments) : [];
  console.log(`  [${cd.name}] ${c.id.slice(0, 8)} · studentIds=${(cd.studentIds || []).length} · assignments(lists)=${assigns.length} · joinCode=${cd.joinCode || cd.code || cd.classCode || '?'}`);
  if (uid) console.log(`     김지훈 in this class's studentIds? ${inRoster ? 'YES' : 'NO — not actually enrolled here'}`);
}

if (uid) {
  const cps = await db.collection('users').doc(uid).collection('class_progress').get();
  console.log(`\nclass_progress docs: ${cps.size}`);
  cps.forEach((d) => { const p = d.data(); console.log(`  ${d.id.slice(0, 20)} csd=${p.currentStudyDay} twi=${p.totalWordsIntroduced} listId=${(p.listId || '').slice(0, 8)}`); });
}
process.exit(0);
