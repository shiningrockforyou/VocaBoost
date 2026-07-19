/**
 * CS — Reconcile Inflated CSD (WRITE, has --dry)  [SUPPORT_RUNBOOK CS-2026-07-19d]
 *
 * Fixes runaway-inflated students whose currentStudyDay ran ahead of their real new-word progress
 * (empty/low-review runaway, pre-PR-3). The anchors + twi are already correct; only csd is wrong.
 * Sets csd to the DEPLOYED resolver's value — `reviewExists(anchorDay) ? anchorDay : anchorDay-1`
 * (foundation.js:912-946) — the same value the non-demoting resolver already knows but can't write down
 * (safeCSD = max(stored, anchor.csd)). Also clears the stale session_states doc for that list.
 *
 * SAFETY: per (uid,listId), only acts if csd is genuinely inflated (csd > anchorDay + 1) AND twi already
 * equals anchor.nwei+1 (so we never touch a student whose twi is off — that's a different repair). Backs up
 * the class_progress + session_states docs first. Never writes a value ABOVE the anchor.
 *
 * Usage:  node scripts/cs/reconcile-inflated-csd.mjs [--commit]   (default: dry-run)
 *   (operates on the hardcoded TARGETS list — the 5 surfaced by the corrected data-integrity-sweep 2026-07-19)
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const COMMIT = process.argv.includes('--commit');

// (uid-prefix, listId) surfaced by scripts/cs/data-integrity-sweep.mjs on 2026-07-19 (corrected detector).
const TARGETS = [
  ['kOWbnPCu', 'dVliNv0p9jqZYp9rfLpN'],
  ['C8P1fmyq', 'dVliNv0p9jqZYp9rfLpN'],
  ['erJVsQPW', 'RmNNkuLPectBlBPiLbAJ'],
  ['WwOuwekT', 'RmNNkuLPectBlBPiLbAJ'],
  ['OWyqVHxthkdeZh9sxZai816PndG2', 'RmNNkuLPectBlBPiLbAJ'],
];

async function resolveUid(pre) {
  if (pre.length >= 28) return pre;
  const q = await db.collection('users').orderBy('__name__').startAt(pre).endAt(pre + '').limit(1).get();
  return q.docs[0]?.id || null;
}

const backupDir = new URL('../../dsg-edits/inflated_csd_fix/', import.meta.url);
try { mkdirSync(backupDir, { recursive: true }); } catch {}
const summary = [];

for (const [pre, listId] of TARGETS) {
  const uid = await resolveUid(pre);
  if (!uid) { console.log(`  ${pre}: uid not resolved — SKIP`); continue; }
  const cps = await db.collection('users').doc(uid).collection('class_progress').get();
  const cpDoc = cps.docs.find(d => d.data().listId === listId);
  if (!cpDoc) { console.log(`  ${pre}: no class_progress for list — SKIP`); continue; }
  const cp = cpDoc.data();
  const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get()).docs.map(d => d.data());
  const newP = at.filter(a => a.sessionType === 'new' && a.passed === true).map(a => ({ d: a.studyDay ?? a.day, nwei: a.newWordEndIndex })).sort((x, y) => y.d - x.d);
  const anchor = newP[0] || { d: 0, nwei: -1 };
  const revDays = new Set(at.filter(a => a.sessionType === 'review').map(a => a.studyDay ?? a.day));
  const anchorDay = anchor.d;
  const correctCsd = anchorDay <= 1 ? Math.max(anchorDay, 1) : (revDays.has(anchorDay) ? anchorDay : anchorDay - 1);
  const anchorTwi = Number.isInteger(anchor.nwei) ? anchor.nwei + 1 : cp.totalWordsIntroduced;

  // SAFETY preconditions
  if (!(cp.currentStudyDay > anchorDay + 1)) { console.log(`  ${uid.slice(0,8)} [${listId.slice(0,8)}]: csd=${cp.currentStudyDay} not inflated vs anchorDay=${anchorDay} — SKIP`); continue; }
  if (cp.totalWordsIntroduced !== anchorTwi) { console.log(`  ${uid.slice(0,8)}: twi=${cp.totalWordsIntroduced} != anchor twi=${anchorTwi} — twi mismatch, SKIP (needs different repair)`); continue; }

  const sessRef = db.collection('users').doc(uid).collection('session_states').doc(`${cp.classId}_${listId}`);
  const sessSnap = await sessRef.get();
  const backup = { at: new Date().toISOString(), uid, listId, classId: cp.classId, commit: COMMIT,
    class_progress_before: cp, session_state_before: sessSnap.exists ? sessSnap.data() : null,
    anchorDay, correctCsd, anchorTwi };
  writeFileSync(new URL(`${uid.slice(0,8)}_${listId.slice(0,8)}_${COMMIT?'commit':'dry'}.json`, backupDir), JSON.stringify(backup, null, 2, (k,v)=>k==='lastUpdated'||k==='updatedAt'?'<ts>':v));

  console.log(`  ${COMMIT?'[COMMIT]':'[DRY]'} ${uid.slice(0,8)} [${listId.slice(0,8)}]: csd ${cp.currentStudyDay}->${correctCsd} (anchorDay=${anchorDay}, reviewExists=${revDays.has(anchorDay)}), twi=${cp.totalWordsIntroduced} kept, session ${sessSnap.exists?'cleared':'(none)'}`);
  summary.push({ uid: uid.slice(0,8), from: cp.currentStudyDay, to: correctCsd });
  if (COMMIT) {
    await cpDoc.ref.set({ currentStudyDay: correctCsd, updatedAt: admin.firestore.Timestamp.now(),
      csInflatedFix: `csd ${cp.currentStudyDay}->${correctCsd} anchor-reconcile (CS-2026-07-19d)` }, { merge: true });
    if (sessSnap.exists) await sessRef.delete();
  }
}
console.log(`\n${COMMIT ? '✅ COMMITTED' : 'ℹ️ DRY-RUN'} — ${summary.length} students reconciled: ${summary.map(s=>`${s.uid} ${s.from}→${s.to}`).join(', ')}`);
console.log('Re-run scripts/cs/data-integrity-sweep.mjs to confirm csdImplausible=0.');
process.exit(0);
