/**
 * Find students by partial name match
 * Run: node scripts/find-students-by-name.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const searchNames = ['민서홍', '서홍', 'seohong', '김수린', '수린', 'surin', '김동현', '동현', 'donghyeon', '이지민', '지민', 'jimin'];

async function findStudents() {
  console.log('Searching for students...\n');

  const usersSnap = await db.collection('users').get();

  console.log(`Total users in database: ${usersSnap.size}\n`);

  const matches = [];

  usersSnap.docs.forEach(doc => {
    const data = doc.data();
    const displayName = data.profile?.displayName || data.displayName || '';
    const email = data.email || '';

    const nameMatch = searchNames.some(search =>
      displayName.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase())
    );

    if (nameMatch) {
      matches.push({
        id: doc.id,
        displayName,
        email
      });
    }
  });

  console.log(`Found ${matches.length} matching users:\n`);
  matches.forEach(m => {
    console.log(`  ${m.displayName.padEnd(20)} | ${m.email.padEnd(35)} | ${m.id}`);
  });
}

findStudents().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
