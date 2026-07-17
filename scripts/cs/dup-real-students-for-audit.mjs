// dup-real-students-for-audit.mjs — duplicate REAL #11-stuck students into obviously-renamed SANDBOX copies
// so the deployed #11 fix can be verified on AUTHENTIC stuck data (real progress/study_states/attempts), then
// run through the live app. READ real 26SM; WRITE only NEW docs (fresh uid, new class, dup attempts). Never
// touches a real student/class/list. Reuses the real LIST (read-only reference — words are not mutated).
//
//   node scripts/cs/dup-real-students-for-audit.mjs [--commit]   (dry-run unless --commit)
//
// Emits the copies' emails + dup classId so the audit can target them.
import { readFileSync } from 'fs';
import admin from 'firebase-admin';
const KEY = process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const COMMIT = process.argv.includes('--commit');
const PASS = (() => { try { return JSON.parse(readFileSync(new URL('../../audit/playwright/.lsr_secret.json', import.meta.url), 'utf8')).password; } catch { return process.env.LSR_AUDIT_PW; } })();
const SANDBOX_TEACHER = 'lsr_teacher_02@vocaboost.test';
const RUN = 'dup1';

// Real #11-stuck students to duplicate (LIST-END wall on 26SM SAT Adv A1). uid/classId/listId are REAL (read-only).
const TARGETS = [
  { uid: 'm4Q19Kk4f6XMJzF10TPthxEtEad2', classId: '6F0PX2E3gXetiI0Yw275', listId: 'dVliNv0p9jqZYp9rfLpN', tag: 'a' },
  { uid: 'IF6n76XEsVdYXBxSoVD6Kj2jIsr2', classId: '6F0PX2E3gXetiI0Yw275', listId: 'dVliNv0p9jqZYp9rfLpN', tag: 'b' },
  { uid: '0jjLJCJqkeeOTe4SH6EPEP2Zfav1', classId: '6F0PX2E3gXetiI0Yw275', listId: 'dVliNv0p9jqZYp9rfLpN', tag: 'c' },
  { uid: '8ksPH5VLblgueeoPqnLUv1wlFpW2', classId: '6F0PX2E3gXetiI0Yw275', listId: 'dVliNv0p9jqZYp9rfLpN', tag: 'd' },
];

const log = (...a) => console.log(...a);
async function copyCollectionDocs(srcQuery, destColl, mutate) {
  const snap = await srcQuery.get();
  let n = 0, batch = db.batch(), inBatch = 0;
  for (const d of snap.docs) {
    const { ref, data } = mutate(d);
    if (COMMIT) { batch.set(destColl.doc(ref), data); if (++inBatch >= 450) { await batch.commit(); batch = db.batch(); inBatch = 0; } }
    n++;
  }
  if (COMMIT && inBatch) await batch.commit();
  return n;
}

log(`\n▶ dup-real-students-for-audit — ${COMMIT ? 'COMMIT (writing)' : 'DRY-RUN (no writes)'} — ${TARGETS.length} targets\n`);
const teacherUid = (await admin.auth().getUserByEmail(SANDBOX_TEACHER)).uid;

// Group by real class → one dup class per real class (mirrors the real "one class, many students" setup).
const byClass = {};
for (const t of TARGETS) (byClass[t.classId] ||= []).push(t);
const out = [];

for (const [realClassId, members] of Object.entries(byClass)) {
  const realClass = (await db.collection('classes').doc(realClassId).get()).data();
  const dupClassId = `DUP_${RUN}_${realClassId}`;
  const dupClassName = `25WT DUP ${realClass.name}`; // OBVIOUS rename, 25WT sandbox namespace
  const joinCode = ('DUP' + Math.abs(hashStr(dupClassId)).toString(36).toUpperCase()).slice(0, 6);
  const dupStudents = [];

  for (const t of members) {
    const realUser = (await db.collection('users').doc(t.uid).get()).data();
    const email = `dup_${RUN}_${t.tag}@vocaboost.test`;
    // fresh Auth account (obvious test email) — or reuse if this dup already exists
    let uid;
    try { uid = (await admin.auth().getUserByEmail(email)).uid; }
    catch { uid = COMMIT ? (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid : `DRYUID_${t.tag}`; }
    dupStudents.push(uid);

    // 1) user profile — OBVIOUS rename
    const dupProfile = { ...(realUser.profile || {}), displayName: `⧉DUP ${realUser.profile?.displayName || t.tag}` };
    if (COMMIT) await db.collection('users').doc(uid).set({
      role: 'student', email, profile: dupProfile, stats: realUser.stats || {}, challenges: realUser.challenges || {},
      enrolledClasses: { [dupClassId]: { name: dupClassName, joinedAt: FieldValue.serverTimestamp() } },
      settings: realUser.settings || {}, createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2) class_progress (re-scoped to dupClass + real list) — the STUCK state (csd, twi, intervention, recentSessions)
    const realProg = (await db.collection('users').doc(t.uid).collection('class_progress').doc(`${realClassId}_${t.listId}`).get()).data();
    if (COMMIT) await db.collection('users').doc(uid).collection('class_progress').doc(`${dupClassId}_${t.listId}`).set({
      ...realProg, classId: dupClassId, listId: t.listId, updatedAt: FieldValue.serverTimestamp(),
    });

    // 3) study_states (user-scoped, keyed by wordId — reuse real list ⇒ same wordIds copy 1:1)
    const ssN = await copyCollectionDocs(
      db.collection('users').doc(t.uid).collection('study_states').where('listId', '==', t.listId),
      db.collection('users').doc(uid).collection('study_states'),
      (d) => ({ ref: d.id, data: d.data() })
    );

    // 4) attempts (rewrite studentId/classId/teacherId → dup; preserves newWordEndIndex anchor + fields)
    const attN = await copyCollectionDocs(
      db.collection('attempts').where('studentId', '==', t.uid).where('listId', '==', t.listId),
      db.collection('attempts'),
      (d) => { const a = d.data(); return { ref: db.collection('attempts').doc().id, data: { ...a, studentId: uid, classId: dupClassId, teacherId: teacherUid } }; }
    );
    log(`  [${t.tag}] ${realUser.profile?.displayName} → ${email}  csd=${realProg.currentStudyDay} twi=${realProg.totalWordsIntroduced} · study_states=${ssN} attempts=${attN}`);
    out.push(email);
  }

  // dup CLASS — copy settings/assignments (real list assignment), OBVIOUS rename, SANDBOX owner, enroll dup students
  if (COMMIT) await db.collection('classes').doc(dupClassId).set({
    name: dupClassName, ownerTeacherId: teacherUid, joinCode,
    assignedLists: realClass.assignedLists || [members[0].listId], assignments: realClass.assignments || {},
    mandatoryLists: realClass.mandatoryLists || [], settings: realClass.settings || {},
    studentIds: dupStudents, studentCount: dupStudents.length, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  log(`  → dup class "${dupClassName}" (${dupClassId}) joinCode=${joinCode} · ${dupStudents.length} students\n`);
}

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
log(`${COMMIT ? '✅ COMMITTED' : 'ℹ️  DRY-RUN complete — re-run with --commit to write'}. Copies: ${out.join(', ')}`);
process.exit(0);
