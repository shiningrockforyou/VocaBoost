/**
 * Compare student's stored progress values with what reconciliation would calculate
 * Run: node scripts/check-progress-vs-reconciliation.js <email>
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/check-progress-vs-reconciliation.js <email>');
  process.exit(1);
}

async function checkStudent() {
  // Find user
  const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (usersSnap.empty) {
    console.log(`NOT FOUND: ${email}`);
    process.exit(1);
  }
  const userId = usersSnap.docs[0].id;
  const displayName = usersSnap.docs[0].data().profile?.displayName || email;

  console.log(`\n=== ${displayName} (${email}) ===`);
  console.log(`userId: ${userId}\n`);

  // Get all class_progress documents for this user
  const progressSnap = await db.collection('users').doc(userId).collection('class_progress').get();

  if (progressSnap.empty) {
    console.log('No progress documents found.');
    return;
  }

  for (const progressDoc of progressSnap.docs) {
    const progress = progressDoc.data();
    const [classId, listId] = progressDoc.id.split('_');

    console.log('─'.repeat(90));
    console.log(`Progress Doc: ${progressDoc.id}`);
    console.log('─'.repeat(90));

    // Get class and list names
    const classDoc = await db.collection('classes').doc(classId).get();
    const listDoc = await db.collection('lists').doc(listId).get();
    const className = classDoc.exists ? classDoc.data().name : 'Unknown';
    const listName = listDoc.exists ? listDoc.data().title : 'Unknown';

    console.log(`Class: ${className}`);
    console.log(`List: ${listName}\n`);

    // Current stored values (intervention)
    console.log('STORED VALUES (Intervention):');
    console.log(`  currentStudyDay (CSD): ${progress.currentStudyDay}`);
    console.log(`  totalWordsIntroduced (TWI): ${progress.totalWordsIntroduced}`);
    console.log(`  lastSessionType: ${progress.lastSessionType || 'N/A'}`);
    console.log(`  updatedAt: ${progress.updatedAt?.toDate?.().toLocaleString('ko-KR') || 'N/A'}`);

    // Get attempts for this class/list
    const attemptsSnap = await db.collection('attempts')
      .where('studentId', '==', userId)
      .where('classId', '==', classId)
      .orderBy('submittedAt', 'desc')
      .limit(15)
      .get();

    console.log(`\nATTEMPTS (${attemptsSnap.size}):`);

    if (attemptsSnap.empty) {
      console.log('  (no attempts found)');
      continue;
    }

    // Display attempts
    attemptsSnap.docs.forEach(doc => {
      const d = doc.data();
      const typeStr = (d.sessionType || 'unknown').padEnd(6);
      const nwei = d.newWordEndIndex !== undefined ? String(d.newWordEndIndex).padStart(4) : 'NULL';
      const passed = d.passed !== undefined ? String(d.passed).padStart(5) : '  N/A';
      console.log(`  Day ${String(d.studyDay).padStart(2)} ${typeStr} | nwei: ${nwei} | passed: ${passed}`);
    });

    // Calculate what reconciliation WOULD produce
    let anchorDay = 0;
    let anchorNWEI = null;
    let anchorPassed = null;

    for (const doc of attemptsSnap.docs) {
      const d = doc.data();
      if (d.sessionType === 'new' && d.newWordEndIndex != null) {
        if (d.studyDay > anchorDay) {
          anchorDay = d.studyDay;
          anchorNWEI = d.newWordEndIndex;
          anchorPassed = d.passed;
        }
      }
    }

    console.log('\nRECONCILIATION CALCULATION:');

    if (anchorDay === 0) {
      console.log('  Anchor: NONE (no valid new test)');
      console.log('  Would set: CSD=0, TWI=0');
    } else {
      const twi = anchorNWEI + 1;
      let csd;
      if (anchorDay === 1) {
        csd = anchorPassed === true ? 1 : 0;
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

      console.log(`  Anchor: Day ${anchorDay} new (nwei: ${anchorNWEI})`);
      console.log(`  Would set: CSD=${csd}, TWI=${twi}`);
      if (orphans.length > 0) {
        console.log(`  Orphans to delete: ${orphans.length}`);
      }

      // Compare
      console.log('\nCOMPARISON:');
      const csdMatch = progress.currentStudyDay === csd;
      const twiMatch = progress.totalWordsIntroduced === twi;
      console.log(`  CSD: stored=${progress.currentStudyDay} vs calculated=${csd} ${csdMatch ? '✓' : '❌ MISMATCH'}`);
      console.log(`  TWI: stored=${progress.totalWordsIntroduced} vs calculated=${twi} ${twiMatch ? '✓' : '❌ MISMATCH'}`);

      if (csdMatch && twiMatch) {
        console.log('\n  ✅ Stored values MATCH reconciliation calculation');
      } else {
        console.log('\n  ⚠️  Stored values will be UPDATED by reconciliation');
      }
    }
  }
}

checkStudent().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
