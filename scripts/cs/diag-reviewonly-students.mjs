// READ-ONLY diagnostic: why is a student stuck seeing only review tests (no new words)?
// Classifies each class_progress as LIST-END (finished list) vs THROTTLE (low reviews → held) vs other.
// No writes. Usage: NODE_PATH=/app/node_modules node scripts/cs/diag-reviewonly-students.mjs [email ...]
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const auth = admin.auth();

const emails = process.argv.slice(2).filter((a) => a.includes('@'));
const targets = emails.length ? emails : ['lw711.kang@gmail.com', 'sihyun100510@gmail.com'];

const classes = await db.collection('classes').get();
const clsName = {}; classes.forEach((c) => (clsName[c.id] = c.data().name));
const sizeCache = new Map();
async function listSize(listId) {
  if (!listId) return null;
  if (!sizeCache.has(listId)) {
    try { sizeCache.set(listId, (await db.collection('lists').doc(listId).collection('words').count().get()).data().count); }
    catch { sizeCache.set(listId, null); }
  }
  return sizeCache.get(listId);
}
const f2 = (x) => (typeof x === 'number' ? x.toFixed(2) : x);

for (const email of targets) {
  let uid;
  try { uid = (await auth.getUserByEmail(email)).uid; } catch { console.log(`\n${email}: AUTH NOT FOUND`); continue; }
  const u = (await db.collection('users').doc(uid).get()).data() || {};
  console.log(`\n=== ${u?.profile?.displayName || '?'} / ${email} / ${uid.slice(0, 8)} ===`);
  console.log(`  primaryFocus: list=${(u?.settings?.primaryFocusListId || '-').slice(0, 8)} class=${(u?.settings?.primaryFocusClassId || '-').slice(0, 8)}`);
  const cps = await db.collection('users').doc(uid).collection('class_progress').get();
  if (cps.empty) { console.log('  (no class_progress)'); continue; }
  for (const cp of cps.docs) {
    const p = cp.data();
    const sz = await listSize(p.listId);
    const rev = (p.recentSessions || []).filter((s) => s.reviewScore !== null && s.reviewScore !== undefined).map((s) => s.reviewScore);
    const last3 = rev.slice(-3);
    const avg3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : null;
    const twi = p.totalWordsIntroduced ?? 0;
    const listEnd = sz != null && twi >= sz;
    const throttled = (avg3 != null && avg3 < 0.30) || p.reviewMode === true;
    // last few day summaries (new+review) to see if days are completing/advancing
    const days = (p.recentSessions || []).slice(-6).map((s) => `d${s.day ?? '?'}:nw${s.newWordScore != null ? f2(s.newWordScore) : '—'}/rv${s.reviewScore != null ? f2(s.reviewScore) : '—'}`);
    console.log(`  [${clsName[p.classId] || p.classId?.slice(0, 8)}] list=${(p.listId || '').slice(0, 8)} csd=${p.currentStudyDay} twi=${twi}/${sz ?? '?'} reviewMode=${p.reviewMode} interv=${p.interventionLevel}`);
    console.log(`     recent reviewScores(last6): [${rev.slice(-6).map(f2).join(', ')}]   last-3 avg=${avg3 != null ? avg3.toFixed(3) : 'n/a'}`);
    console.log(`     recent days: ${days.join('  ')}`);
    const verdict = listEnd ? 'LIST-END — finished this list; no new words remain → needs NEXT-LIST advance (pick next list / primaryFocus).'
      : throttled ? `THROTTLE — low reviews (avg ${avg3 != null ? avg3.toFixed(2) : '?'} <0.30 or reviewMode on) → system holds on review-only BY DESIGN. New words return when review avg climbs >~0.30–0.50, OR force new words on request.`
        : 'NEITHER list-end nor throttled by these signals → likely a genuine stuck-state (csd not advancing though days completed); inspect attempts.';
    console.log(`     >> ${verdict}`);
  }
}
process.exit(0);
