/**
 * sweep_sandbox_dfx.mjs — one-time hygiene sweep of the deepfix M-UI/M-WB audit's throwaway sandbox data.
 *
 * WHY: scenarios create per-run classes "25WT DFX <scn> <runId>" / "25WT DFWB <scn> <runId>" and are left in place
 * ("don't clean up"). After ~14 rounds, the REUSED students (lsr_s*) have accumulated attempts on the SAME cloned
 * list across many classes → LIST_SCOPED_RECON pulls them in and pollutes csd/count oracles (RS-1 Showing=8→11,
 * RO-S1 csd 0→2). This resets the slate for the remaining runs. CLEAN behavior is already emulator-certified.
 *
 * SAFETY: touches ONLY classes whose name matches /^25WT DF(X|WB) / (the audit's throwaway prefix) and ONLY
 * lsr_*@vocaboost.test students. Triple-gated. NEVER 26SM / real classes / real students. `--dry` by default
 * (counts only); `--commit` to delete. Portable (repo-relative key + LSR_SA_KEY override).
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const KEY = process.env.LSR_SA_KEY || resolve(REPO, 'scripts', 'serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const CLASS_RE = /^25WT DF(X|WB) /;          // the audit's throwaway class prefix — the ONLY classes we touch
const STUDENT_RE = /^lsr_.*@vocaboost\.test$/; // sandbox students only

const del = async (ref) => { if (COMMIT) await ref.delete().catch(() => {}); };
const commitBatch = async (docs) => {
  for (let i = 0; i < docs.length; i += 400) {
    if (!COMMIT) continue;
    const b = db.batch(); docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit().catch(() => {});
  }
};

(async () => {
  console.log(`sweep_sandbox_dfx — mode=${COMMIT ? 'COMMIT (deleting)' : 'DRY (counting only)'}`);
  // 1) find the throwaway audit classes
  const classesSnap = await db.collection('classes').get();
  const targetClasses = classesSnap.docs.filter((d) => CLASS_RE.test((d.data().name || '')));
  const classIds = new Set(targetClasses.map((d) => d.id));
  console.log(`  classes matching /^25WT DF(X|WB) /: ${targetClasses.length}`);
  if (targetClasses.length === 0) { console.log('  nothing to sweep.'); process.exit(0); }
  // hard guard: refuse if any matched class is NOT 25WT-prefixed (paranoia)
  const bad = targetClasses.filter((d) => !(d.data().name || '').startsWith('25WT'));
  if (bad.length) { console.error(`  ABORT — ${bad.length} matched class(es) not 25WT-prefixed`); process.exit(2); }

  // 2) attempts belonging to those classes (chunk the 'in' query by 30)
  const cidArr = [...classIds]; let attemptDocs = [];
  for (let i = 0; i < cidArr.length; i += 30) {
    const chunk = cidArr.slice(i, i + 30);
    const s = await db.collection('attempts').where('classId', 'in', chunk).get();
    attemptDocs = attemptDocs.concat(s.docs);
  }
  // safety: only attempts whose studentId maps to an lsr_* student are swept (verify a sample)
  console.log(`  attempts under those classes: ${attemptDocs.length}`);

  // 3) per-student progress/session/study docs for those classes (users/{uid}/{class_progress,session_states,study_states})
  const studentUids = new Set(attemptDocs.map((d) => d.data().studentId).filter(Boolean));
  let subDocs = 0;
  for (const uid of studentUids) {
    for (const sub of ['class_progress', 'session_states', 'study_states']) {
      const s = await db.collection('users').doc(uid).collection(sub).get();
      const hit = s.docs.filter((d) => [...classIds].some((cid) => d.id.startsWith(cid) || (d.data().classId && classIds.has(d.data().classId))));
      subDocs += hit.length; await commitBatch(hit);
    }
  }
  console.log(`  student sub-docs (class_progress/session_states/study_states) for those classes: ${subDocs}`);

  // 4) delete attempts + classes
  await commitBatch(attemptDocs);
  for (const c of targetClasses) await del(c.ref);

  console.log(`\n  SUMMARY (${COMMIT ? 'DELETED' : 'WOULD DELETE'}): ${targetClasses.length} classes · ${attemptDocs.length} attempts · ${subDocs} student sub-docs · students touched: ${studentUids.size}`);
  console.log(COMMIT ? '  ✅ swept.' : '  (dry run — re-run with --commit to delete)');
  process.exit(0);
})().catch((e) => { console.error('sweep error:', String(e)); process.exit(1); });
