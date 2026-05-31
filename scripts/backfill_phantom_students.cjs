/**
 * Backfill phantom-enrolled students into class.studentIds.
 *
 * Bug: joinClass() updates studentIds + studentCount together, but the
 * firestore rule only allowed studentCount for non-owners, so the studentIds
 * write was rejected -> students exist in classes/{id}/members/ but are missing
 * from classes/{id}.studentIds ("phantom" enrollment).
 *
 * This script reconciles studentIds to the union of (current studentIds U member
 * doc IDs). It NEVER removes anyone. studentCount is set to the final array size.
 *
 * Usage:
 *   node scripts/backfill_phantom_students.cjs            # DRY RUN (reads only)
 *   node scripts/backfill_phantom_students.cjs --execute  # writes the fix
 *
 * Idempotent: safe to re-run; arrayUnion semantics mean no duplicates.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const EXECUTE = process.argv.includes('--execute');

(async () => {
  const mode = EXECUTE ? 'EXECUTE (writing)' : 'DRY RUN (read-only)';
  console.log(`\n=== Phantom-student backfill — ${mode} ===\n`);

  const classesSnap = await db.collection('classes').get();
  let totalMissing = 0;
  let classesToFix = 0;
  const report = [];

  for (const classDoc of classesSnap.docs) {
    const data = classDoc.data();
    const currentIds = Array.isArray(data.studentIds) ? data.studentIds : [];
    const currentCount = typeof data.studentCount === 'number' ? data.studentCount : null;

    const membersSnap = await db.collection('classes').doc(classDoc.id).collection('members').get();
    const memberIds = membersSnap.docs.map(d => d.id);

    const currentSet = new Set(currentIds);
    const missing = memberIds.filter(id => !currentSet.has(id));
    // conservative union: keep everything already in studentIds, add missing members
    const finalSet = new Set([...currentIds, ...memberIds]);
    const finalIds = [...finalSet];

    const needsFix = missing.length > 0 || currentCount !== finalIds.length;
    if (needsFix) { classesToFix++; totalMissing += missing.length; }

    report.push({
      classId: classDoc.id,
      name: data.name || '(unnamed)',
      ownerTeacherId: data.ownerTeacherId || null,
      studentIdsCount: currentIds.length,
      studentCount: currentCount,
      memberCount: memberIds.length,
      missingFromStudentIds: missing.length,
      finalStudentIdsCount: finalIds.length,
      needsFix,
    });

    if (needsFix && EXECUTE) {
      await classDoc.ref.update({
        studentIds: finalIds,
        studentCount: finalIds.length,
        phantomBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.table(report.map(r => ({
    class: r.name,
    studentIds: r.studentIdsCount,
    studentCount: r.studentCount,
    members: r.memberCount,
    missing: r.missingFromStudentIds,
    '->finalIds': r.finalStudentIdsCount,
    fix: r.needsFix ? 'YES' : '-',
  })));

  console.log(`\nClasses scanned: ${classesSnap.size}`);
  console.log(`Classes needing fix: ${classesToFix}`);
  console.log(`Total phantom students to restore: ${totalMissing}`);
  console.log(EXECUTE
    ? '\n✅ EXECUTED — studentIds/studentCount updated for the classes above.'
    : '\n(DRY RUN — no writes. Re-run with --execute to apply.)');

  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
