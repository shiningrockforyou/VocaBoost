/**
 * Check newWordEndIndex values for specific students
 * Run: node scripts/check-newWordEndIndex.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const students = [
  { name: 'jung-lee', email: 'jung-lee@naver.com' },
  { name: '정혜교', email: 'hyegyossi@gamil.com' },
  { name: '민서홍 Seohong Min', email: 'iju732476@gmail.com' },
  { name: '김수린', email: 'ginnyy9492@gmail.com' },
  { name: '김동현 Kimdonghyeon', email: 'staray0819@gmail.com' },
  { name: '이지민 Jimin Lee', email: 'jiminjjang2008@gmail.com' },
  { name: 'Jimin kim', email: 'cocoapple0420@gmail.com' },
  { name: 'Jimin Ban', email: 'banjimin23@gmail.com' }
];

async function checkStudents() {
  for (const student of students) {
    // Find user by email
    const usersSnap = await db.collection('users').where('email', '==', student.email).limit(1).get();
    if (usersSnap.empty) {
      console.log(`\n=== ${student.name} (${student.email}) - NOT FOUND ===`);
      continue;
    }
    const userId = usersSnap.docs[0].id;

    // Get attempts using studentId field (has existing index)
    const attemptsSnap = await db.collection('attempts')
      .where('studentId', '==', userId)
      .orderBy('submittedAt', 'desc')
      .limit(10)
      .get();

    console.log(`\n=== ${student.name} (${student.email}) ===`);
    console.log(`userId: ${userId}`);
    console.log(`Attempts (${attemptsSnap.size}):`);

    if (attemptsSnap.empty) {
      console.log('  (no attempts found)');
      continue;
    }

    attemptsSnap.docs.forEach(doc => {
      const d = doc.data();
      const typeStr = (d.sessionType || 'unknown').padEnd(6);
      const nwei = d.newWordEndIndex !== undefined ? d.newWordEndIndex : 'NULL';
      const passed = d.passed !== undefined ? d.passed : 'N/A';
      console.log(`  Day ${d.studyDay} ${typeStr} | newWordEndIndex: ${String(nwei).padStart(4)} | passed: ${String(passed).padStart(5)} | score: ${d.score}%`);
    });
  }
}

checkStudents().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
