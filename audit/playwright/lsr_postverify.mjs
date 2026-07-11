/**
 * LSR acceptance — READ-ONLY post-verifier + FINAL combined verdict (Admin, separate
 * process, AFTER all browsers close).
 *
 * Codex blocker (2026-07-05): lsr_snapshot.mjs reads seeded_accounts/audit_ and never reads
 * the acceptance manifest, so TA2's "progress preserved" was never actually verified. This
 * process consumes lsr_accept_manifest.json, resolves the EXACT uid/classId/listId, asserts
 * CSD/TWI are preserved, and combines with the acceptance matrix + browser anomalies into a
 * single authoritative verdict with a nonzero exit on any failure. NEVER writes anything.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_postverify.mjs
 */
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const AUD = '/app/audit/playwright';
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

const manifest = rd(`${AUD}/lsr_accept_manifest.json`);
const matrix = rd(`${AUD}/lsr_accept_matrix.json`);
const ROSTER = JSON.parse(readFileSync(`${AUD}/lsr_accounts.json`, 'utf8')).accounts;
const uidOf = (email) => ROSTER.find((a) => a.email === email)?.uid;

if (!manifest || !matrix) { console.error('missing lsr_accept_manifest.json or lsr_accept_matrix.json — run lsr_accept.mjs first'); process.exit(2); }

// Codex #3: BIND + validate artifacts before trusting any PASS. An empty manifest + a stale/
// partial passing matrix must NOT yield FINAL PASS.
const EXPECTED = ['TA1', 'TA2', 'M1', 'M3', 'M5'];
let bindFail = 0;
console.log('=== artifact binding ===');
if (manifest.run !== matrix.run) { console.error(`✗ manifest.run(${manifest.run}) != matrix.run(${matrix.run}) — artifacts from different runs`); bindFail++; }
else console.log(`✓ manifest + matrix bound to the same run ${matrix.run}`);
const ran = new Set((matrix.results || []).map((r) => r.id));
const missing = EXPECTED.filter((id) => !ran.has(id));
if (missing.length) { console.error(`✗ incomplete run — missing scenarios: ${missing.join(', ')}`); bindFail++; }
else console.log(`✓ all expected scenarios present: ${EXPECTED.join(', ')}`);
const ta2items = (manifest.items || []).filter((i) => i.scenario === 'TA2');
if (ta2items.length !== 1) { console.error(`✗ expected exactly 1 TA2 manifest item, got ${ta2items.length}`); bindFail++; }
else console.log('✓ exactly one TA2 manifest item');
const pfAgeH = manifest.preflightGeneratedAt ? (Date.now() - Date.parse(manifest.preflightGeneratedAt)) / 3.6e6 : null;
if (pfAgeH == null || !Number.isFinite(pfAgeH)) { console.error('✗ no preflight timestamp bound to the run'); bindFail++; }
else console.log(`✓ preflight allowlist recorded (age at run ${pfAgeH.toFixed(1)}h)`);

let failures = 0;
console.log('\n=== TA2 progress-preservation (read-only) ===');
for (const item of manifest.items || []) {
  const uid = uidOf(item.student);
  if (!uid) { console.error(`✗ ${item.scenario}: unknown student ${item.student}`); failures++; continue; }
  const cq = await db.collection('classes').where('name', '==', item.className).limit(1).get();
  if (cq.empty) { console.error(`✗ ${item.scenario}: class "${item.className}" not found`); failures++; continue; }
  const classId = cq.docs[0].id;
  const u = db.collection('users').doc(uid);
  // Codex #4: require the EXACT authoritative doc (class_progress/{classId}_{listId}, flag OFF).
  // Do NOT fall back to list_progress — a deleted class-progress doc must FAIL, not pass. Report
  // list_progress only as a diagnostic.
  const cpDoc = await u.collection('class_progress').doc(`${classId}_${item.listId}`).get();
  const lpDoc = await u.collection('list_progress').doc(item.listId).get();
  if (!cpDoc.exists) { console.error(`✗ ${item.scenario}: MISSING authoritative class_progress/${classId}_${item.listId} — F03 REGRESSION (progress destroyed). [diagnostic: list_progress exists=${lpDoc.exists}]`); failures++; continue; }
  const d = cpDoc.data();
  const csd = d.currentStudyDay || 0;
  const twi = d.totalWordsIntroduced || 0;
  const ok = csd >= (item.studiedDays || 1) && twi > 0;
  console.log(`${ok ? '✓' : '✗'} ${item.scenario}: ${item.student} class_progress/${classId}_${item.listId} — CSD=${csd} TWI=${twi} (expected CSD>=${item.studiedDays || 1}, TWI>0) [list_progress diag: ${lpDoc.exists ? 'present' : 'absent'}]`);
  if (!ok) failures++;
}

// Combine with the acceptance matrix + browser anomalies for ONE final verdict.
console.log('\n=== combined verdict ===');
let mFail = 0, mInvalid = 0, anomalies = 0;
if (matrix) {
  mFail = (matrix.results || []).filter((r) => r.status === 'FAIL').length;
  mInvalid = (matrix.results || []).filter((r) => r.status === 'INVALID').length;
  anomalies = matrix.anomalies || 0;
  console.log(`acceptance matrix: ${matrix.pass || 0} PASS · ${mFail} FAIL · ${mInvalid} INVALID · ${anomalies} fatal browser anomalies`);
} else {
  console.error('⚠ no lsr_accept_matrix.json — cannot confirm scenario outcomes');
}
const totalFail = failures + mFail + mInvalid + anomalies + bindFail;
console.log(`artifact-binding failures: ${bindFail} · post-verify CSD/TWI failures: ${failures}`);
console.log(`\n${totalFail === 0 ? '✅ FINAL: PASS — F02/F03 acceptance verified (bound artifacts + UI matrix + read-only progress).' : `❌ FINAL: FAIL — ${totalFail} problem(s); NOT verified.`}\n`);
process.exit(totalFail === 0 ? 0 : 1);
