/**
 * B_LIST_PROGRESS_PHASE1_UI — read-only Admin snapshot (policy §2, §4).
 * Runs strictly BEFORE any audit browser opens (--pre) and strictly AFTER all close
 * (--post). NEVER creates/updates/deletes/resets anything. Exits when done.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_snapshot.mjs --pre  [emailPrefix,...]
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_snapshot.mjs --post [emailPrefix,...]
 *
 * --pre also: classifies seeded personas for the batch's persona plan and searches
 * (read-only) for natural P-PAIR / P-ORPHAN / P-SPARSE candidates.
 * --post also: diffs vs the latest --pre and runs the EXT-4/5/6 assertions
 * (anchor-field completeness; session coherence; zero orphan deletions; TWI never
 * regressed; new-type system_logs inventory).
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, readdirSync } from 'fs';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const AUD = '/app/audit/playwright';
const SEEDED = JSON.parse(readFileSync(`${AUD}/seeded_accounts.json`, 'utf8')).accounts || [];
const mode = process.argv[2];
if (!['--pre', '--post'].includes(mode)) { console.error('usage: lsr_snapshot.mjs --pre|--post [emailPrefix,...]'); process.exit(2); }
const prefixes = (process.argv[3] || 'audit_').split(',');
const personas = SEEDED.filter((a) => a.created && prefixes.some((p) => a.email.startsWith(p)));
console.log(`${mode} snapshot — ${personas.length} personas (${prefixes.join(',')})`);

const NEW_LOG_TYPES = ['orphaned_attempt_flagged', 'day_guard_rejected_session_cleared', 'day_guard_session_clear_FAILED', 'list_progress_quarantined'];
const validAnchor = (a) => Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= 0 && Number.isInteger(a.newWordStartIndex) && !!a.testId;

async function snapPersona(uid) {
  const u = db.collection('users').doc(uid);
  const [cp, ss, lp, at] = await Promise.all([
    u.collection('class_progress').get(),
    u.collection('session_states').get(),
    u.collection('list_progress').get(),
    db.collection('attempts').where('studentId', '==', uid).get(),
  ]);
  return {
    class_progress: cp.docs.map((d) => ({ id: d.id, classId: d.data().classId, listId: d.data().listId, csd: d.data().currentStudyDay || 0, twi: d.data().totalWordsIntroduced || 0 })),
    session_states: ss.docs.map((d) => ({ id: d.id, phase: d.data().phase, newWordsTestPassed: d.data().newWordsTestPassed ?? null, classId: d.data().classId })),
    list_progress: lp.docs.map((d) => ({ id: d.id, ...d.data() })),
    attempts: at.docs.map((d) => {
      const a = d.data();
      return { id: d.id, classId: a.classId, listId: a.listId, sessionType: a.sessionType, studyDay: a.studyDay, passed: a.passed ?? null, score: a.score ?? null, nwsi: a.newWordStartIndex ?? null, nwei: a.newWordEndIndex ?? null, testId: a.testId ?? null, ms: a.submittedAt?.toMillis?.() || 0 };
    }).sort((x, y) => y.ms - x.ms),
  };
}

const snap = { mode, at: new Date().toISOString(), personas: {} };
for (const p of personas) snap.personas[p.email] = { uid: p.uid, ...(await snapPersona(p.uid)) };

// system_logs inventory (new types + orphan deletions), global — small collections.
snap.logs = {};
for (const t of [...NEW_LOG_TYPES, 'orphaned_attempt_deleted', 'csd_anchor_invalid', 'csd_twi_reconciled']) {
  const s = await db.collection('system_logs').where('type', '==', t).get();
  snap.logs[t] = s.docs.map((d) => ({ id: d.id, userId: d.data().userId, ts: d.data().timestamp?.toMillis?.() || d.data().deletedAt?.toMillis?.() || 0 }));
}

if (mode === '--pre') {
  // Persona classification for the batch persona plan.
  snap.classification = Object.fromEntries(Object.entries(snap.personas).map(([email, s]) => {
    const lists = {}; s.class_progress.forEach((c) => { (lists[c.listId] = lists[c.listId] || []).push(c); });
    const dual = Object.values(lists).some((v) => v.length > 1);
    const started = s.class_progress.some((c) => c.csd > 0);
    return [email, { docs: s.class_progress.length, dual, started, suggested: !started ? 'P-L1/disposable' : dual ? 'P-L2/P-DUAL candidate' : 'progressed-single' }];
  }));
  // Natural-candidate search (read-only) for P-PAIR / P-ORPHAN / P-SPARSE.
  snap.naturalCandidates = { sparse: [], orphan: [] };
  for (const [email, s] of Object.entries(snap.personas)) {
    const passedNew = s.attempts.filter((a) => a.sessionType === 'new' && a.passed === true);
    if (passedNew.some((a) => !validAnchor(a))) snap.naturalCandidates.sparse.push(email);
    const maxAnchorDay = Math.max(0, ...passedNew.filter(validAnchor).map((a) => a.studyDay || 0));
    if (s.attempts.some((a) => a.sessionType === 'review' && (a.studyDay || 0) > maxAnchorDay)) snap.naturalCandidates.orphan.push(email);
  }
  console.log('classification:', JSON.stringify(snap.classification, null, 1).slice(0, 1500));
  console.log('natural candidates:', JSON.stringify(snap.naturalCandidates));
}

const out = `${AUD}/findings/lsr_snapshot_${mode.replace('--', '')}_${Date.now()}.json`;
writeFileSync(out, JSON.stringify(snap, null, 2));
console.log(`snapshot → ${out}`);

if (mode === '--post') {
  const pres = readdirSync(`${AUD}/findings`).filter((f) => f.startsWith('lsr_snapshot_pre_')).sort();
  if (!pres.length) { console.error('no --pre snapshot found to diff against'); process.exit(1); }
  const pre = JSON.parse(readFileSync(`${AUD}/findings/${pres[pres.length - 1]}`, 'utf8'));
  const problems = [];
  for (const [email, post] of Object.entries(snap.personas)) {
    const before = pre.personas[email]; if (!before) continue;
    // TWI must never regress (policy §11).
    const maxTwi = (s) => Math.max(0, ...s.class_progress.map((c) => c.twi));
    if (maxTwi(post) < maxTwi(before)) problems.push(`${email}: TWI regressed ${maxTwi(before)}→${maxTwi(post)}`);
    // EXT-6: no review attempt deleted.
    const postIds = new Set(post.attempts.map((a) => a.id));
    before.attempts.filter((a) => a.sessionType === 'review').forEach((a) => { if (!postIds.has(a.id)) problems.push(`${email}: review attempt ${a.id} DELETED (EXT-6)`); });
    // EXT-4: every NEW attempt created during the run carries a valid anchor.
    const beforeIds = new Set(before.attempts.map((a) => a.id));
    post.attempts.filter((a) => a.sessionType === 'new' && !beforeIds.has(a.id)).forEach((a) => {
      if (!validAnchor(a)) problems.push(`${email}: new attempt ${a.id} INVALID ANCHOR (EXT-4) nwsi=${a.nwsi} nwei=${a.nwei} testId=${!!a.testId}`);
    });
    // EXT-5: session coherence (손지우 class).
    post.session_states.forEach((s) => {
      if (s.phase === 'review-study' && s.newWordsTestPassed === false) problems.push(`${email}: IMPOSSIBLE session state ${s.id} (EXT-5)`);
    });
    // Flag-off runs: list_progress must stay empty (caller knows which run this is —
    // report count; Run L treats >0 as failure).
    if (post.list_progress.length) problems.push(`${email}: list_progress docs present: ${post.list_progress.length} (FAIL for Run L; expected for later phases only)`);
  }
  // New-type logs delta (Run L: any new entries = failure; Run S: expected types allowed).
  for (const t of NEW_LOG_TYPES) {
    const preIds = new Set((pre.logs[t] || []).map((l) => l.id));
    const delta = (snap.logs[t] || []).filter((l) => !preIds.has(l.id));
    if (delta.length) problems.push(`system_logs ${t}: +${delta.length} during run (FAIL for Run L; evaluate against case expectations for Run S)`);
  }
  const preDel = new Set((pre.logs.orphaned_attempt_deleted || []).map((l) => l.id));
  const delDelta = (snap.logs.orphaned_attempt_deleted || []).filter((l) => !preDel.has(l.id));
  if (delDelta.length) problems.push(`orphaned_attempt_deleted: +${delDelta.length} during run — VIOLATION for Run S (flag-on must be log-only [C5-2]); for Run L this is LEGACY-EXPECTED behavior on orphan-shaped accounts — triage, do not auto-fail`);

  console.log(problems.length ? `\n❌ POST-DIFF PROBLEMS (${problems.length}):` : '\n✅ POST-DIFF CLEAN');
  problems.forEach((p) => console.log('  - ' + p));
  writeFileSync(`${AUD}/findings/lsr_postdiff_${Date.now()}.json`, JSON.stringify({ problems }, null, 2));
  process.exit(problems.length ? 1 : 0);
}
process.exit(0);
