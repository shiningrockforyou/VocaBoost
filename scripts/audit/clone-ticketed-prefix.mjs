/**
 * scripts/audit/clone-ticketed-prefix.mjs — D3.5 Part-A2 seeder: clone a REAL ticketed 26SM student into a 25WT
 * SANDBOX copy reverted to a documented PRE-FIX state, with the HARDENED guard on every write.
 *
 * READ real 26SM (read-only) · WRITE only fresh sandbox docs · assert every write through SandboxGuard (fail-closed).
 * Extends scripts/cs/dup-real-students-for-audit.mjs with: (1) the hardened guard, (2) FULL id-rewrite incl. testId +
 * teacherIds[] (the base `...a` spread leaked both — critic S2), (3) 25WT underscore-free class ids (not DUP_… — S-C),
 * (4) per-student M9 provenance (backup-dir | entry-reconstruction | snapshot-derivation; SYNTHETIC_FROM_TICKET), and
 * (5) a per-run SAFETY ARTIFACT (S6).
 *
 *   NODE_PATH=/app/node_modules node scripts/audit/clone-ticketed-prefix.mjs [--commit] [--manifest=<path>]
 *   (dry-run unless --commit; dry-run resolves everything + asserts the guard but writes nothing.)
 */
import { readFileSync, writeFileSync } from 'fs';
import admin from 'firebase-admin';
import { SandboxGuard, mintSandboxClassId, cleanId, SANDBOX_TEACHER_EMAIL } from './sandbox-guard.mjs';

const KEY = process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const COMMIT = process.argv.includes('--commit');
const RUN = 'a2r1';
const PASS = process.env.LSR_AUDIT_PW || (() => { try { return JSON.parse(readFileSync(new URL('../../audit/playwright/.lsr_secret.json', import.meta.url), 'utf8')).password; } catch { return 'AuditPass2026!'; } })();
const manifestArg = (process.argv.find(a => a.startsWith('--manifest=')) || '').split('=')[1];
const log = (...a) => console.log(...a);

/**
 * Manifest = the M9 provenance record per student. `pre` overlays the class_progress before-state.
 * provenance: 'backup' (per-family backup `before`) | 'entry' (SYNTHETIC_FROM_TICKET from a CS entry) | 'snapshot'.
 * Default demo manifest = the throttle-deadlock A1 family (authentic-cp backups exist for these).
 */
const DEFAULT_MANIFEST = [
  // 정지수 — A1 deadlock is SYNTHETIC_FROM_TICKET (her relief backup is a DIFFERENT 07-17 state); numbers from CS-07-14.
  { tag: 'jisu_a1', family: 'throttle-deadlock', provenance: 'entry', maxStudyDay: 5,  // A1 = finished days 1-5, throttle-held on Day 6 → keep the anchor at day 5 (else attempts→day-10 anchor reconciles csd past the pre-fix state)
    real: { uid: 'eGBgVXlIekahvOS98nUHNOOaFrs1', classId: 'Nys1FfB9Pkl1iyO5FYhx', listId: 'dVliNv0p9jqZYp9rfLpN' },
    pre: { currentStudyDay: 5, totalWordsIntroduced: 400, interventionLevel: 1.0,
           recentSessions: [ { day: 3, reviewScore: 0.23 }, { day: 4, reviewScore: 0.17 }, { day: 5, reviewScore: 0.23 } ] },
    expect: 'A1: held on review-only day; escape on 2nd good review (≥0.70)' },
];

function loadManifest() {
  if (manifestArg) return JSON.parse(readFileSync(manifestArg, 'utf8'));
  return DEFAULT_MANIFEST;
}

/** Rewrite a testId that encodes the real classId/listId → the sandbox class (keep phase; underscore-safe). */
function rewriteTestId(testId, realClassId, sandboxClassId) {
  if (typeof testId !== 'string') return testId;
  return testId.split(realClassId).join(sandboxClassId); // sandbox ids are alnum → testId parse stays clean
}

async function main() {
  const manifest = loadManifest();
  const guard = new SandboxGuard(RUN);
  log(`\n▶ clone-ticketed-prefix — ${COMMIT ? 'COMMIT (writing sandbox)' : 'DRY-RUN (guard-asserts, no writes)'} — ${manifest.length} students\n`);

  // sandbox teacher (must already exist as an Auth identity; pin it)
  let teacherUid;
  try { teacherUid = (await admin.auth().getUserByEmail(SANDBOX_TEACHER_EMAIL)).uid; }
  catch { teacherUid = COMMIT ? (await admin.auth().createUser({ email: SANDBOX_TEACHER_EMAIL, password: PASS, emailVerified: true })).uid : 'DRYTEACHER'; }
  guard.registerUid(teacherUid);

  const roster = [];
  const classCache = {};   // realClassId → sandbox classId (one sandbox class per real class)

  for (const m of manifest) {
    const { real, pre, tag } = m;
    // 1) mint the sandbox class — one DEDICATED class PER STUDENT TAG (deterministic, collision-free across runs).
    // (Was `${RUN}${classCache.length+1}` — a per-run counter that reset every invocation, so separate --commit runs
    // all restarted at 25WTa2r11 and crammed unrelated students into shared classes. Per-tag ⇒ each student gets its
    // own class + its own testId, faithfully mirroring its real class's assignments/settings in isolation.)
    if (!classCache[tag]) {
      const realClass = (await db.collection('classes').doc(real.classId).get()).data() || {};
      const scls = mintSandboxClassId(RUN, cleanId(tag));   // 25WT<run><tag>, underscore-free, unique per student
      guard.registerClass(scls);
      const classDoc = {
        name: `25WT AUDIT ${cleanId(tag)} ${String(realClass.name || '').slice(0, 20)}`,
        ownerTeacherId: teacherUid,                       // TEACHER PIN (never a real teacher)
        joinCode: (RUN + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 6),
        assignedLists: realClass.assignedLists || [real.listId],
        assignments: realClass.assignments || {},
        settings: realClass.settings || {},
        studentIds: [], studentCount: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      };
      guard.assertWrite({ docPath: `classes/${scls}`, uid: teacherUid, classId: scls });
      if (COMMIT) await db.collection('classes').doc(scls).set(classDoc);
      classCache[tag] = scls;
      log(`  · sandbox class ${scls} (join ${classDoc.joinCode}) ← real ${real.classId} [tag ${tag}]`);
    }
    const scls = classCache[tag];

    // 2) mint the sandbox student
    const email = `lsr_a2_${cleanId(tag)}@vocaboost.test`;
    let uid;
    try { uid = (await admin.auth().getUserByEmail(email)).uid; }
    catch { uid = COMMIT ? (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid : `DRYUID_${cleanId(tag)}`; }
    guard.registerUid(uid);

    // 2b) IDEMPOTENT CLEAN — delete this sandbox student's prior docs so a re-seed can't leave stale attempts/anchor
    // (uid is guard-registered above ⇒ sandbox-only; deletes only its own attempts + subcollections).
    if (COMMIT) {
      const prior = await db.collection('attempts').where('studentId', '==', uid).get();
      for (const d of prior.docs) { guard.assertWrite({ docPath: `attempts/${d.id}`, uid }); await d.ref.delete(); }
      for (const sub of ['class_progress', 'study_states', 'list_progress', 'session_states']) {
        const s = await db.collection('users').doc(uid).collection(sub).get();
        let b = db.batch(), n = 0;
        for (const d of s.docs) { b.delete(d.ref); if (++n >= 400) { await b.commit(); b = db.batch(); n = 0; } }
        if (n) await b.commit();
      }
    }

    // 3) read the REAL docs (read-only)
    const realUser = (await db.collection('users').doc(real.uid).get()).data() || {};
    const realProg = (await db.collection('users').doc(real.uid).collection('class_progress').doc(`${real.classId}_${real.listId}`).get()).data() || {};

    // 4) user profile (obvious rename)
    const userDoc = {
      role: 'student', email,
      profile: { ...(realUser.profile || {}), displayName: `⧉A2 ${realUser.profile?.displayName || tag}` },
      stats: realUser.stats || {}, challenges: realUser.challenges || {},
      enrolledClasses: { [scls]: { name: `25WT AUDIT ${cleanId(tag)}`, joinedAt: FieldValue.serverTimestamp() } },
      settings: realUser.settings || {}, createdAt: FieldValue.serverTimestamp(),
    };
    guard.assertWrite({ docPath: `users/${uid}`, uid });
    if (COMMIT) await db.collection('users').doc(uid).set(userDoc, { merge: true });

    // 5) class_progress = the real progress with the PRE-FIX overlay applied (the broken state).
    // cloneEverything:true (live-ticket verbatim clones) → copy ALL cp docs under the real class (all lists), re-keyed.
    if (m.cloneEverything) {
      const allCp = await db.collection('users').doc(real.uid).collection('class_progress').get();
      for (const d of allCp.docs) {
        if (!d.id.startsWith(real.classId)) continue;               // this class's docs only
        const newId = d.id.split(real.classId).join(scls);
        const pd = { ...d.data(), ...(d.id === `${real.classId}_${real.listId}` ? pre : {}), classId: scls,
                     csProvenance: m.provenance, csExpect: m.expect, updatedAt: FieldValue.serverTimestamp() };
        guard.assertWrite({ docPath: `users/${uid}/class_progress/${newId}`, uid, classId: scls });
        if (COMMIT) await db.collection('users').doc(uid).collection('class_progress').doc(newId).set(pd);
      }
    } else {
      const progDoc = { ...realProg, ...pre, classId: scls, listId: real.listId,
                        csProvenance: m.provenance, csExpect: m.expect, updatedAt: FieldValue.serverTimestamp() };
      guard.assertWrite({ docPath: `users/${uid}/class_progress/${scls}_${real.listId}`, uid, classId: scls });
      if (COMMIT) await db.collection('users').doc(uid).collection('class_progress').doc(`${scls}_${real.listId}`).set(progDoc);
    }

    // 6) study_states (user+list scoped; real list reused read-only ⇒ copy 1:1, no id rewrite needed)
    let ssN = 0;
    const ssSnap = m.cloneEverything
      ? await db.collection('users').doc(real.uid).collection('study_states').get()
      : await db.collection('users').doc(real.uid).collection('study_states').where('listId', '==', real.listId).get();
    let batch = db.batch(), inB = 0;
    for (const d of ssSnap.docs) {
      guard.assertWrite({ docPath: `users/${uid}/study_states/${d.id}`, uid });
      if (COMMIT) { batch.set(db.collection('users').doc(uid).collection('study_states').doc(d.id), d.data()); if (++inB >= 400) { await batch.commit(); batch = db.batch(); inB = 0; } }
      ssN++;
    }
    if (COMMIT && inB) await batch.commit();

    // 6b) session_states — the ACTIVE-session doc ("everything connected to the student"). THREE modes per manifest:
    //   sessionMode 'reconstructed' (sessionOverlay present): CREATE the documented pre-fix session from the overlay
    //     (real schema fields; do NOT clone the real CURRENT session — it is post-fix). For session-corruption families
    //     (lost-save impossible state, re-entry) and best-effort reconstructions (throttle review-loop).
    //   sessionMode 'clone' (keepSession:true): copy the real session re-keyed to the sandbox class (rare — only when
    //     the real current session IS the pre-fix state).
    //   sessionMode 'none' (default): no session doc — faithful when the backup records session_state_existed:false
    //     (5/7 of the csd family) or when the app-rebuilt session is the honest reproduction.
    let ssessN = 0, sessionProvenance = 'none';
    if (m.sessionOverlay) {
      sessionProvenance = 'reconstructed-from-entry';
      const sessDoc = { classId: scls, listId: real.listId,
        newWordsDismissedIds: [], reviewDismissedIds: [], reviewTestAttempts: 0, reviewTestScore: null,
        newWordsTestPassed: false, newWordsTestScore: null,
        ...m.sessionOverlay, lastUpdated: FieldValue.serverTimestamp() };
      const sid = `${scls}_${real.listId}`;
      guard.assertWrite({ docPath: `users/${uid}/session_states/${sid}`, uid, classId: scls });
      if (COMMIT) await db.collection('users').doc(uid).collection('session_states').doc(sid).set(sessDoc);
      ssessN = 1;
    } else if (m.keepSession === true) {
      sessionProvenance = 'cloned-real';
      const realSess = await db.collection('users').doc(real.uid).collection('session_states').get();
      for (const d of realSess.docs) {
        const s = d.data();
        const newDocId = String(d.id).split(real.classId).join(scls);
        const rewrittenSess = { ...s, classId: scls,
          ...(s.testId ? { testId: rewriteTestId(s.testId, real.classId, scls) } : {}) };
        guard.assertWrite({ docPath: `users/${uid}/session_states/${newDocId}`, uid, classId: scls });
        if (COMMIT) await db.collection('users').doc(uid).collection('session_states').doc(newDocId).set(rewrittenSess);
        ssessN++;
      }
    } else if (m.sessionAbsentVerified) {
      sessionProvenance = 'absent-per-backup';   // documented: session_state_existed:false at the pre-fix moment
    }

    // 7) attempts — FULL id-rewrite: studentId, classId, teacherId, teacherIds[], testId (S2: base leaked testId+teacherIds)
    let attN = 0;
    const attSnap = m.cloneEverything
      ? await db.collection('attempts').where('studentId', '==', real.uid).get()
      : await db.collection('attempts').where('studentId', '==', real.uid).where('listId', '==', real.listId).get();
    for (const d of attSnap.docs) {
      const a = d.data();
      if (m.maxStudyDay != null && (a.studyDay ?? a.day ?? 0) > m.maxStudyDay) continue;   // seed-fidelity: keep the reconciliation anchor aligned to the pre-fix csd
      const rewritten = { ...a, studentId: uid, classId: scls, teacherId: teacherUid,
        testId: rewriteTestId(a.testId, real.classId, scls) };
      if (Array.isArray(a.teacherIds)) rewritten.teacherIds = [teacherUid];   // S-D: strip real teacher uids
      else delete rewritten.teacherIds;                                       // absent/undefined → never write undefined (Firestore rejects)                    // S2: rewrite the class-encoding testId
      const newId = db.collection('attempts').doc().id;
      guard.assertWrite({ docPath: `attempts/${newId}`, uid, classId: scls });
      if (COMMIT) await db.collection('attempts').doc(newId).set(rewritten);
      attN++;
    }

    roster.push({ tag, family: m.family, email, uid, sandboxClassId: scls, listId: real.listId, provenance: m.provenance, expect: m.expect,
                  sessionProvenance, seededCsd: pre?.currentStudyDay, seededTwi: pre?.totalWordsIntroduced, study_states: ssN, session_states: ssessN, attempts: attN });
    log(`  [${tag}] ${email} (${m.provenance}) → class_progress csd=${pre?.currentStudyDay ?? realProg.currentStudyDay} · study_states=${ssN} session_states=${ssessN} attempts=${attN}`);
  }

  const artifact = guard.safetyArtifact();
  const outPath = '/app/audit/playwright/findings/a2_clone_roster.json';
  // MERGE into the existing roster (by tag) — a commit must never clobber prior waves' ledger entries.
  let mergedRoster = roster;
  try {
    const prior = JSON.parse(readFileSync(outPath, 'utf8')).roster || [];
    const newTags = new Set(roster.map(e => e.tag));
    mergedRoster = [...prior.filter(e => !newTags.has(e.tag)), ...roster];
  } catch {}
  const result = { runId: RUN, at: new Date().toISOString(), committed: COMMIT, roster: mergedRoster, lastRunSafety: artifact };
  if (COMMIT) writeFileSync(outPath, JSON.stringify(result, null, 2));
  log(`\n── SAFETY ARTIFACT (S6) ──`);
  log(`  writes asserted: ${artifact.writeCount} · sandbox uids: ${artifact.sandboxUids} · writesToNonSandbox: ${artifact.writesToNonSandbox} · ALL-SANDBOX: ${artifact.allSandbox}`);
  if (!artifact.allSandbox) { log('  ✗ ABORT: a non-sandbox write was asserted — guard should have thrown earlier.'); process.exit(1); }
  log(`${COMMIT ? `✅ COMMITTED — roster → ${outPath}` : 'ℹ️  DRY-RUN OK (guard clean, 0 writes) — re-run with --commit'}. Students: ${roster.map(r => r.email).join(', ')}`);
  process.exit(0);
}
main().catch(e => { console.error('CLONE ERROR:', e.message); process.exit(1); });
