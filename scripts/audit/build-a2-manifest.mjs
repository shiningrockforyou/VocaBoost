/**
 * scripts/audit/build-a2-manifest.mjs — enumerate the pre-fix backup dirs → the Part-A2 clone manifest (READ-ONLY, local).
 * Encodes the r49 seed-fidelity lesson: `maxStudyDay` trims cloned attempts so the reconciliation anchor matches the
 * seeded csd (else a student who studied past the 07-15/16/17 backup reconciles forward off a later anchor).
 *
 *   node scripts/audit/build-a2-manifest.mjs [--out=<path>]   (default: audit/playwright/findings/a2_manifest.json)
 *
 * Family rules (from the CS record + the smoke):
 *  - backups_throttle / backups_throttle_relief → family 'throttle-deadlock' (interv=1.0 held AT csd) → maxStudyDay=csd.
 *  - backups_csd → family 'off-by-one' (completed csd+1, stuck at csd) → maxStudyDay=csd+1 (anchor at the completed day).
 *  - backups_reconcile ≡ throttle cohort (skip; dedup — same uids).
 * Dedup: throttle∩relief=54 (prefer the earlier 07-15 throttle-deadlock state); csd∩relief=1.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
const OUT = (process.argv.find(a => a.startsWith('--out=')) || '').split('=')[1] || '/app/audit/playwright/findings/a2_manifest.json';
const DIR = '/app/scripts/cs';

function readDir(name) {
  const out = [];
  for (const f of readdirSync(`${DIR}/${name}`)) {
    if (!f.endsWith('.json') || /manifest/i.test(f)) continue;
    try { out.push({ file: `${name}/${f}`, ...JSON.parse(readFileSync(`${DIR}/${name}/${f}`, 'utf8')) }); } catch {}
  }
  return out;
}
const splitCp = (cp) => { const [classId, listId] = String(cp || '').split('_'); return { classId, listId }; };

const manifest = [];
const seen = new Set();

// throttle-deadlock (authentic-cp pre-fix). recentSessions carry the low-review signal that drives the hold.
for (const b of readDir('backups_throttle')) {
  const { classId, listId } = splitCp(b.cp || b.cpDoc);
  if (!classId || !listId || seen.has(b.uid)) continue;
  seen.add(b.uid);
  const csd = b.before?.csd ?? b.before?.currentStudyDay;
  manifest.push({
    tag: `thr_${b.uid.slice(0, 6)}`, family: 'throttle-deadlock', provenance: 'backup', backupFile: b.file,
    real: { uid: b.uid, classId, listId }, email: b.email,
    maxStudyDay: csd,   // held AT csd → keep the anchor at day csd
    keepSession: false, // progress-family: the real CURRENT session is POST-fix → let the app rebuild the pre-fix session from class_progress (faithful; a cloned post-fix session would mismatch)
    pre: { currentStudyDay: csd, totalWordsIntroduced: b.before?.twi,
           interventionLevel: b.before?.interventionLevel ?? 1.0, recentSessions: b.before?.recentSessions },
    expect: 'A1: held on the throttle review-only day; escape on 2nd good review (≥0.70)',
  });
}

// off-by-one csd (completed the day but csd stuck one short)
for (const b of readDir('backups_csd')) {
  const { classId, listId } = splitCp(b.cp || b.cpDoc);
  if (!classId || !listId || seen.has(b.uid)) continue;
  seen.add(b.uid);
  const csd = b.before?.csd ?? b.before?.currentStudyDay;
  manifest.push({
    tag: `obo_${b.uid.slice(0, 6)}`, family: 'off-by-one', provenance: 'backup', backupFile: b.file,
    real: { uid: b.uid, classId, listId }, email: b.email,
    maxStudyDay: csd + 1,   // completed csd+1 → keep the anchor at the completed day so the V2 fix reconciles csd→csd+1
    keepSession: false,     // progress-family: app rebuilds the session from class_progress (faithful)
    pre: { currentStudyDay: csd, totalWordsIntroduced: b.before?.twi },
    expect: 'A3: reconciliation advances csd to the completed day (csd+1)',
  });
}

writeFileSync(OUT, JSON.stringify(manifest, null, 2));
const byFam = manifest.reduce((m, e) => ((m[e.family] = (m[e.family] || 0) + 1), m), {});
console.log(`built A2 manifest: ${manifest.length} students → ${OUT}`);
console.log(`  by family: ${JSON.stringify(byFam)}`);
console.log(`  (relief=146 + reconcile=58 not yet folded: relief needs its own runaway family + dedup vs throttle-54; add in a later pass)`);
process.exit(0);
