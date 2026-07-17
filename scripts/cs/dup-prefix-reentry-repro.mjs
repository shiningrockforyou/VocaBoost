// dup-prefix-reentry-repro.mjs — SANDBOX repro of the PRE-FIX (pre CS-2026-07-17 relief) state for the
// "click start → loading → auto-completion (re-entry modal)" bug. Duplicates real affected students into
// obviously-renamed sandbox copies, restoring the PRE-FIX class_progress from the relief backups
// (inflated csd + interv 1.0 + skip-0 recentSessions) and reconstructing the STALE session_state that
// triggers the re-entry path (phase=complete + reviewTestScore=0). study_states + attempts copied as-is
// (relief didn't touch them). READ real 26SM (read-only) + backups; WRITE only NEW sandbox docs.
//   node scripts/cs/dup-prefix-reentry-repro.mjs [--commit]
import { readFileSync, readdirSync } from 'fs';
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(); const { FieldValue } = admin.firestore;
const COMMIT = process.argv.includes('--commit');
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password;
const SANDBOX_TEACHER = 'lsr_teacher_02@vocaboost.test';
const BDIR = '/app/scripts/cs/backups_throttle_relief/';
const RUN = 'repro';
const TARGETS = [
  { email: 'bagjuha477@gmail.com', tag: 'a', label: '박주하 runaway-skipper' },
  { email: 'wisdomram11@gmail.com', tag: 'b', label: 'wisdomram11 big-runaway' },
  { email: 'emily1004enfj@gmail.com', tag: 'c', label: '이서현 genuine-low' },
];
const files = readdirSync(BDIR);
const teacherUid = (await admin.auth().getUserByEmail(SANDBOX_TEACHER)).uid;
async function copyColl(srcQ, destColl, mutate) {
  const snap = await srcQ.get(); let n = 0, batch = db.batch(), inB = 0;
  for (const d of snap.docs) { const { ref, data } = mutate(d); if (COMMIT) { batch.set(destColl.doc(ref), data); if (++inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; } } n++; }
  if (COMMIT && inB) await batch.commit(); return n;
}
console.log(`\n▶ dup-prefix-reentry-repro — ${COMMIT ? 'COMMIT' : 'DRY-RUN'} — ${TARGETS.length} targets\n`);
const out = [];
for (const t of TARGETS) {
  const q = await db.collection('users').where('email', '==', t.email).limit(1).get();
  const realUid = q.docs[0].id;
  const bf = files.find(f => f.startsWith(realUid + '_'));
  const backup = JSON.parse(readFileSync(BDIR + bf, 'utf8'));           // { before: {currentStudyDay, interventionLevel, recentSessions, stats} }
  const docId = bf.replace(realUid + '_', '').replace('.json', '');      // realClassId_listId
  const realClassId = docId.slice(0, 20), listId = docId.slice(21);
  const realUser = (await db.collection('users').doc(realUid).get()).data();
  const realClass = (await db.collection('classes').doc(realClassId).get()).data();
  const curProg = (await db.collection('users').doc(realUid).collection('class_progress').doc(docId).get()).data();
  // PRE-FIX class_progress = current doc (twi/programStartDate untouched by relief) with csd/interv/recentSessions/stats restored from backup
  const preProg = { ...curProg, currentStudyDay: backup.before.currentStudyDay, interventionLevel: backup.before.interventionLevel, recentSessions: backup.before.recentSessions, stats: backup.before.stats };

  const dupClassId = `DUP_${RUN}_${realClassId}`;
  const dupClassName = `25WT DUP REPRO ${realClass.name}`;
  const joinCode = ('DR' + Math.abs([...dupClassId].reduce((h, c) => (h << 5) - h + c.charCodeAt(0) | 0, 0)).toString(36).toUpperCase()).slice(0, 6);
  const email = `dup_${RUN}_${t.tag}@vocaboost.test`;
  let uid;
  try { uid = (await admin.auth().getUserByEmail(email)).uid; } catch { uid = COMMIT ? (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid : `DRY_${t.tag}`; }

  // re-scope primaryFocus (settings) from real class → dup class (keep list)
  const settings = JSON.parse(JSON.stringify(realUser.settings || {}));
  const pf = settings.primaryFocus || {};
  for (const k of Object.keys(pf)) { if (typeof pf[k] === 'string' && pf[k] === realClassId) pf[k] = dupClassId; }
  if (settings.primaryFocus) settings.primaryFocus = { ...pf };

  // reconstructed STALE session_state = the re-entry TRIGGER (phase complete + reviewTestScore 0, from an empty submit)
  const staleSession = {
    phase: 'complete', currentStudyDay: preProg.currentStudyDay,
    newWordsTestPassed: false, newWordsTestScore: null,
    reviewTestScore: 0, reviewTestAttempts: 1,
    newWordsDismissedIds: [], reviewDismissedIds: [], lastUpdated: FieldValue.serverTimestamp(),
  };

  console.log(`[${t.tag}] ${t.label} → ${email} | realClass=${realClass.name} list=${listId.slice(0,8)} | PRE-FIX csd=${preProg.currentStudyDay} twi=${preProg.totalWordsIntroduced} interv=${preProg.interventionLevel}`);
  console.log(`      primaryFocus=${JSON.stringify(settings.primaryFocus)} | staleSession phase=complete reviewTestScore=0`);

  if (COMMIT) {
    await db.collection('users').doc(uid).set({
      role: 'student', email, profile: { ...(realUser.profile || {}), displayName: `⧉DUP ${realUser.profile?.displayName || t.tag}` },
      stats: realUser.stats || {}, challenges: realUser.challenges || {}, settings,
      enrolledClasses: { [dupClassId]: { name: dupClassName, joinedAt: FieldValue.serverTimestamp() } }, createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('users').doc(uid).collection('class_progress').doc(`${dupClassId}_${listId}`).set({ ...preProg, classId: dupClassId, listId, updatedAt: FieldValue.serverTimestamp() });
    await db.collection('users').doc(uid).collection('session_states').doc(`${dupClassId}_${listId}`).set(staleSession);
    const ssN = await copyColl(db.collection('users').doc(realUid).collection('study_states').where('listId', '==', listId), db.collection('users').doc(uid).collection('study_states'), d => ({ ref: d.id, data: d.data() }));
    const atN = await copyColl(db.collection('attempts').where('studentId', '==', realUid).where('listId', '==', listId), db.collection('attempts'), d => { const a = d.data(); return { ref: db.collection('attempts').doc().id, data: { ...a, studentId: uid, classId: dupClassId, teacherId: teacherUid } }; });
    await db.collection('classes').doc(dupClassId).set({
      name: dupClassName, ownerTeacherId: teacherUid, joinCode, assignedLists: realClass.assignedLists || [listId], assignments: realClass.assignments || {},
      mandatoryLists: realClass.mandatoryLists || [], settings: realClass.settings || {}, studentIds: [uid], studentCount: 1, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`      ✅ committed: study_states=${ssN} attempts=${atN} class=${dupClassId} joinCode=${joinCode}`);
  }
  out.push(email);
}
console.log(`\n${COMMIT ? '✅ COMMITTED' : 'ℹ️ DRY-RUN'}. Repro accounts (password in .lsr_secret.json): ${out.join(', ')}`);
process.exit(0);
