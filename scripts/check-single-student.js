/**
 * Check newWordEndIndex for a single student
 * Run: node scripts/check-single-student.js <email>
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/check-single-student.js <email>');
  process.exit(1);
}

async function checkStudent() {
  const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (usersSnap.empty) {
    console.log(`NOT FOUND: ${email}`);
    process.exit(1);
  }
  const userId = usersSnap.docs[0].id;
  const displayName = usersSnap.docs[0].data().profile?.displayName || email;

  console.log(`\n=== ${displayName} (${email}) ===`);
  console.log(`userId: ${userId}\n`);

  const attemptsSnap = await db.collection('attempts')
    .where('studentId', '==', userId)
    .orderBy('submittedAt', 'desc')
    .limit(15)
    .get();

  console.log(`Attempts (${attemptsSnap.size}):`);
  console.log('─'.repeat(90));
  console.log('  Day  Type    | newWordEndIndex | passed | score | submittedAt');
  console.log('─'.repeat(90));

  attemptsSnap.docs.forEach(doc => {
    const d = doc.data();
    const typeStr = (d.sessionType || 'unknown').padEnd(6);
    const nwei = d.newWordEndIndex !== undefined ? String(d.newWordEndIndex).padStart(4) : 'NULL';
    const passed = d.passed !== undefined ? String(d.passed).padStart(5) : '  N/A';
    const score = d.score !== undefined ? String(d.score).padStart(3) + '%' : ' N/A';
    const date = d.submittedAt?.toDate?.().toLocaleString('ko-KR') || 'N/A';
    console.log(`  ${String(d.studyDay).padStart(3)}  ${typeStr} |            ${nwei} | ${passed} | ${score} | ${date}`);
  });

  // Calculate what reconciliation would produce
  // NOTE: Only considers PASSED new tests as anchors (matches new reconciliation logic)
  console.log('\n─'.repeat(90));
  console.log('RECONCILIATION ANALYSIS (only PASSED new tests):');
  console.log('─'.repeat(90));

  let anchorDay = 0;
  let anchorNWEI = null;

  for (const doc of attemptsSnap.docs) {
    const d = doc.data();
    // Only consider PASSED new tests as anchors
    if (d.sessionType === 'new' && d.newWordEndIndex != null && d.passed === true) {
      if (d.studyDay > anchorDay) {
        anchorDay = d.studyDay;
        anchorNWEI = d.newWordEndIndex;
      }
    }
  }

  if (anchorDay === 0) {
    console.log('  Anchor: NONE (no PASSED new test with newWordEndIndex)');
    console.log('  Result: CSD=0, TWI=0');
  } else {
    const twi = anchorNWEI + 1;
    let csd;
    if (anchorDay === 1) {
      // Day 1: CSD = 1 (since we only consider passed tests)
      csd = 1;
    } else {
      const hasReview = attemptsSnap.docs.some(doc => {
        const d = doc.data();
        return d.studyDay === anchorDay && d.sessionType === 'review';
      });
      csd = hasReview ? anchorDay : anchorDay - 1;
    }

    // Check for orphans
    const orphans = attemptsSnap.docs.filter(doc => {
      const d = doc.data();
      return d.sessionType === 'review' && d.studyDay > anchorDay;
    });

    console.log(`  Anchor: Day ${anchorDay} PASSED new (newWordEndIndex: ${anchorNWEI})`);
    console.log(`  TWI: ${twi}`);
    console.log(`  CSD: ${csd}`);
    if (orphans.length > 0) {
      console.log(`  Orphaned reviews: ${orphans.length} (will be deleted)`);
      orphans.forEach(doc => {
        const d = doc.data();
        console.log(`    - Day ${d.studyDay} review (${doc.id})`);
      });
    } else {
      console.log(`  Orphaned reviews: None`);
    }
  }
}

checkStudent().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
