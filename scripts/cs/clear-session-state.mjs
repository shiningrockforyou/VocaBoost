// Clear a student's stale `session_states` doc so the next load rebuilds the day from scratch.
//
// WHEN: the durable session doc is pinning a student into a phase that no longer matches reality —
// e.g. the CS-2026-07-27 "throttle-EXIT stranded" case (a day built review-only, the throttle then
// exits mid-day, and the stale `phase=review-study` keeps re-serving a review the completion gate
// now refuses). Routing is attempt-authoritative (DailySessionFlow.jsx:822), so a clean rebuild is
// self-healing: the student is routed by what their attempts actually show.
//
// GUARD (the one that matters): REFUSE when the session claims `newWordsTestPassed:true` but no
// passed `new` attempt exists for that day — that is the LOST-SAVE family (CS-2026-07-20b), where
// the session doc is the ONLY record of a pass the write dropped. Clearing it destroys evidence;
// use `manual-pass.mjs` to restore the anchor instead.
//
//   NODE_PATH=/app/node_modules node scripts/cs/clear-session-state.mjs <email> <classId> <listId> [--commit]
//
// Dry-run by default. Backs the doc up to dsg-edits/session_clear/<uid>_<listId>_pre.json.
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(), auth = admin.auth();

const [email, classId, listId] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const COMMIT = process.argv.includes('--commit');
if (!email || !classId || !listId) { console.error('usage: clear-session-state.mjs <email> <classId> <listId> [--commit]'); process.exit(1); }

const uid = (await auth.getUserByEmail(email)).uid;
const ref = db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`);
const snap = await ref.get();
if (!snap.exists) { console.error(`NO session_state ${classId}_${listId} for ${email} — nothing to clear.`); process.exit(1); }
const ss = snap.data();
const day = ss.currentStudyDay;
console.log(`${email} uid=${uid}\n  session ${ref.id}: day=${day} phase=${ss.phase} newWordsTestPassed=${ss.newWordsTestPassed} newWordsTestScore=${ss.newWordsTestScore ?? '-'}`);

// Evidence check against the durable attempts.
const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get())
  .docs.map(d => d.data()).filter(a => a.studyDay === day);
const passedNew = at.filter(a => a.sessionType === 'new' && a.passed === true);
const reviews = at.filter(a => a.sessionType === 'review');
console.log(`  day-${day} attempts: ${passedNew.length} passed new · ${reviews.length} review (scores [${reviews.map(r => r.score).join(',')}])`);

if (ss.newWordsTestPassed === true && passedNew.length === 0) {
  console.error(`\n  ✗ REFUSED — session claims newWordsTestPassed:true but NO passed day-${day} \`new\` attempt exists.`);
  console.error(`    This is the LOST-SAVE signature: the session doc is the only record of that pass.`);
  console.error(`    Use: scripts/cs/manual-pass.mjs ${email} ${classId} ${listId} ${day} <score>`);
  process.exit(2);
}

const dir = '/app/dsg-edits/session_clear';
mkdirSync(dir, { recursive: true });
const backup = `${dir}/${uid.slice(0, 8)}_${listId.slice(0, 8)}_pre.json`;
writeFileSync(backup, JSON.stringify({ path: ref.path, id: ref.id, data: ss }, null, 2));
console.log(`  backup → ${backup}`);

if (!COMMIT) { console.log('\n  DRY RUN — re-run with --commit to delete.'); process.exit(0); }
await ref.delete();
console.log(`  ✓ DELETED ${ref.path}`);
console.log(`  verify: exists=${(await ref.get()).exists}`);
process.exit(0);
