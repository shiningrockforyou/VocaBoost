// dup-current-bridgetop.mjs — dup the 3 Bridge TOP students at their CURRENT (live) state into sandbox,
// to reproduce "only review test → refresh → can't access". Copies profile/settings/class_progress/
// session_states/study_states/attempts AS-IS (re-scoped to a dup class). READ real; WRITE sandbox only.
//   node scripts/cs/dup-current-bridgetop.mjs [--commit]
import { readFileSync } from 'fs'; import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(); const { FieldValue } = admin.firestore;
const COMMIT = process.argv.includes('--commit');
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password;
const teacherUid = (await admin.auth().getUserByEmail('lsr_teacher_02@vocaboost.test')).uid;
const REALCLASS = 'JFCtimk25DPR333XzJHU';
const dupClassId = `DUP_bt_${REALCLASS}`;
const realClass = (await db.collection('classes').doc(REALCLASS).get()).data();
const TARGETS = [
  { email: 'huiyun091@gmail.com', tag: 'h' }, { email: 'annette.han@pcakorea.org', tag: 'j' }, { email: 'aaronjo0927@gmail.com', tag: 'z' },
];
async function copyColl(srcQ, destColl, mutate) { const snap = await srcQ.get(); let n = 0, b = db.batch(), i = 0; for (const d of snap.docs) { const { ref, data } = mutate(d); if (COMMIT) { b.set(destColl.doc(ref), data); if (++i >= 400) { await b.commit(); b = db.batch(); i = 0; } } n++; } if (COMMIT && i) await b.commit(); return n; }
const dupUids = [], out = [];
console.log(`\n▶ dup-current-bridgetop — ${COMMIT ? 'COMMIT' : 'DRY-RUN'}\n`);
for (const t of TARGETS) {
  const q = await db.collection('users').where('email', '==', t.email).limit(1).get();
  const realUid = q.docs[0].id; const realUser = q.docs[0].data();
  const email = `dup_bt_${t.tag}@vocaboost.test`;
  let uid; try { uid = (await admin.auth().getUserByEmail(email)).uid; } catch { uid = COMMIT ? (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid : `DRY_${t.tag}`; }
  dupUids.push(uid);
  // settings — re-scope any primaryFocusClassId → dup class
  const settings = JSON.parse(JSON.stringify(realUser.settings || {}));
  if (settings.primaryFocusClassId === REALCLASS) settings.primaryFocusClassId = dupClassId;
  const cps = (await db.collection('users').doc(realUid).collection('class_progress').get()).docs.filter(d => d.data().classId === REALCLASS || d.id.startsWith(REALCLASS));
  console.log(`[${t.tag}] ${t.email} → ${email} | ${cps.length} progress docs | settings.primaryFocusList=${(settings.primaryFocusListId||'(empty)')}`);
  if (COMMIT) {
    await db.collection('users').doc(uid).set({ role: 'student', email, profile: { ...(realUser.profile || {}), displayName: `⧉DUP ${realUser.profile?.displayName || t.tag}` }, stats: realUser.stats || {}, challenges: realUser.challenges || {}, settings, enrolledClasses: { [dupClassId]: { name: `25WT DUP BT ${realClass.name}`, joinedAt: FieldValue.serverTimestamp() } }, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    for (const c of cps) { const p = c.data(); const listId = c.id.slice(REALCLASS.length + 1);
      await db.collection('users').doc(uid).collection('class_progress').doc(`${dupClassId}_${listId}`).set({ ...p, classId: dupClassId, listId, updatedAt: FieldValue.serverTimestamp() });
      const ss = (await db.collection('users').doc(realUid).collection('session_states').doc(c.id).get());
      if (ss.exists) await db.collection('users').doc(uid).collection('session_states').doc(`${dupClassId}_${listId}`).set(ss.data());
      const sN = await copyColl(db.collection('users').doc(realUid).collection('study_states').where('listId', '==', listId), db.collection('users').doc(uid).collection('study_states'), d => ({ ref: d.id, data: d.data() }));
      const aN = await copyColl(db.collection('attempts').where('studentId', '==', realUid).where('listId', '==', listId), db.collection('attempts'), d => { const a = d.data(); return { ref: db.collection('attempts').doc().id, data: { ...a, studentId: uid, classId: dupClassId, teacherId: teacherUid } }; });
      console.log(`      list ${listId.slice(0,8)}: csd=${p.currentStudyDay} twi=${p.totalWordsIntroduced} interv=${p.interventionLevel} sessionState=${ss.exists?ss.data().phase:'none'} · study_states=${sN} attempts=${aN}`);
    }
  }
  out.push(`${email} (${t.email.split('@')[0]})`);
}
if (COMMIT) await db.collection('classes').doc(dupClassId).set({ name: `25WT DUP BT ${realClass.name}`, ownerTeacherId: teacherUid, joinCode: 'DUPBT1', assignedLists: realClass.assignedLists || [], assignments: realClass.assignments || {}, mandatoryLists: realClass.mandatoryLists || [], settings: realClass.settings || {}, studentIds: dupUids, studentCount: dupUids.length, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
console.log(`\n${COMMIT ? '✅ COMMITTED' : 'DRY-RUN'} class=${dupClassId} · ${out.join(', ')}`);
process.exit(0);
