/**
 * CS — Assign the (LAP2) Ascent + Summit lists to all 26SM Adv / Final / TOP classes.
 *
 * Adds assignments[lap2ListId] to each matched class, MIRRORING the props of that class's
 * existing ORIGINAL-tier assignment (pace/testSizeNew/thresholds), with a BACKDATED
 * assignedAt (1 day older than the class's oldest existing assignment) so the
 * newest-assigned default-focus fallback NEVER auto-picks the LAP2 list — no student is
 * bumped (CS-2026-07-13e pattern). Only ADDS assignments; never removes/edits existing ones.
 * Does NOT change any student's focus (that's a separate step).
 *
 * SAFE BY DEFAULT: --dry (default) writes NOTHING. --commit backs up each class doc to
 * scripts/cs/lap2_class_backups/<id>.json THEN writes. Idempotent: skips a class+list
 * already assigned.
 *
 *   node scripts/cs/assign-lap2-lists.mjs            # dry preview (READ-ONLY)
 *   node scripts/cs/assign-lap2-lists.mjs --commit   # assign
 */
import admin from 'firebase-admin';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

const COMMIT = process.argv.includes('--commit');
const NAME_FILTER = /26SM/i;
const BACKUP_DIR = '/app/scripts/cs/lap2_class_backups';

// The two LAP2 lists (created by create-lap2-lists.mjs) → the ORIGINAL tier they mirror.
const LAP2 = [
  { id: '7ybGZUS7S9CjjVMyK1hH', tier: 'Ascent', origin: 'dVliNv0p9jqZYp9rfLpN' },
  { id: 'alo8NR5sksoQ1eYOE9X6', tier: 'Summit', origin: 'AObYOowhLoOOHx9wW2Sq' },
];

// Bucket a class by name. Target = Adv OR Final OR TOP — but EXCLUDE Bridge classes
// (David 2026-07-13: "26SM SAT Bridge (TOP)" matched via (TOP) but is a Bridge class → drop).
function buckets(name) {
  if (/bridge|브릿지/i.test(name)) return []; // Bridge classes excluded entirely
  const b = [];
  if (/final/i.test(name)) b.push('final');
  if (/\badv\b|advanced|adv\./i.test(name)) b.push('adv');
  if (/top|탑/i.test(name)) b.push('top');
  return b;
}

console.log(`\n=== assign-lap2-lists — ${COMMIT ? 'COMMIT (writing)' : 'DRY (read-only preview)'} ===\n`);

const snap = await db.collection('classes').get();
const all = [];
snap.forEach((d) => { const c = d.data(); if (NAME_FILTER.test(c.name || '')) all.push({ id: d.id, name: c.name || '', assignments: c.assignments || {}, students: (c.studentIds || []).length }); });

const matched = all.filter((c) => buckets(c.name).length);
const excluded = all.filter((c) => !buckets(c.name).length);

console.log(`26SM classes: ${all.length} | matched (adv/fin/top): ${matched.length} | excluded: ${excluded.length}\n`);

if (COMMIT) mkdirSync(BACKUP_DIR, { recursive: true });
let sampleShown = false;
const plan = [];

for (const cls of matched) {
  const aKeys = Object.keys(cls.assignments);
  // oldest existing assignedAt → backdate below it
  const times = aKeys.map((k) => cls.assignments[k]?.assignedAt).filter(Boolean).map((t) => (t.toMillis ? t.toMillis() : Timestamp.fromDate(new Date(t)).toMillis()));
  const oldest = times.length ? Math.min(...times) : Timestamp.fromDate(new Date('2026-01-01')).toMillis();
  const backdated = Timestamp.fromMillis(oldest - 86400000);

  const adds = [];
  const updatePayload = {};
  for (const lap of LAP2) {
    if (cls.assignments[lap.id]) { adds.push(`${lap.tier}:ALREADY`); continue; }
    const srcAssign = cls.assignments[lap.origin];
    if (!srcAssign) { adds.push(`${lap.tier}:NO_ORIGIN_TO_MIRROR(skip)`); continue; }
    // mirror props, drop coupling fields, backdate
    const { assignedAt, nextListId, ...mirrored } = srcAssign; // eslint-disable-line no-unused-vars
    const newAssign = { ...mirrored, assignedAt: backdated, lapCopy: true };
    updatePayload[`assignments.${lap.id}`] = newAssign;
    adds.push(`${lap.tier}:ADD(mirror ${lap.origin.slice(0, 8)})`);
    if (!sampleShown) {
      console.log(`  sample new assignment (${cls.name} ← ${lap.tier}):`, JSON.stringify(newAssign, (k, v) => (v && v._seconds ? `<ts ${v._seconds}>` : v)));
      sampleShown = true;
    }
  }
  const willWrite = Object.keys(updatePayload).length > 0;
  plan.push({ id: cls.id, name: cls.name, buckets: buckets(cls.name).join('+'), students: cls.students, adds, willWrite });

  if (COMMIT && willWrite) {
    writeFileSync(`${BACKUP_DIR}/${cls.id}.json`, JSON.stringify({ id: cls.id, name: cls.name, assignments: cls.assignments }, null, 2));
    await db.collection('classes').doc(cls.id).update(updatePayload);
  }
}

console.log(`\n=== MATCHED classes (${matched.length}) ===`);
for (const p of plan) console.log(`  [${p.buckets}] ${p.name.slice(0, 40).padEnd(40)} ${p.id.slice(0, 8)} students=${String(p.students).padStart(3)} → ${p.adds.join(', ')}`);
console.log(`\n=== EXCLUDED 26SM classes (${excluded.length}) — NOT assigned ===`);
for (const c of excluded) console.log(`  ${c.name.slice(0, 48)}  (${c.id.slice(0, 8)})`);

const willWriteCount = plan.filter((p) => p.willWrite).length;
console.log(`\n${COMMIT ? 'WROTE' : 'WOULD WRITE'} to ${willWriteCount} class docs (${matched.length - willWriteCount} already-assigned/no-origin skipped).`);
if (!COMMIT) console.log('(DRY run — nothing written. Re-run with --commit to assign.)');
process.exit(0);
