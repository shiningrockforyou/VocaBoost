import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Check list structure
const listDoc = await db.collection('lists').doc('aRGjnGXdU4aupiS8SlXR').get();
if (listDoc.exists) {
  const data = listDoc.data();
  console.log('LIST KEYS:', JSON.stringify(Object.keys(data)));
  console.log('WORDS COUNT:', data.words?.length || 'no words field');
  console.log('DATA (first 500):', JSON.stringify(data).slice(0, 500));
} else {
  // Try different collection
  const vlistDoc = await db.collection('vocabulary_lists').doc('aRGjnGXdU4aupiS8SlXR').get();
  if (vlistDoc.exists) {
    console.log('Found in vocabulary_lists');
    console.log('KEYS:', JSON.stringify(Object.keys(vlistDoc.data())));
  } else {
    console.log('NOT FOUND in lists or vocabulary_lists');
    // Search other collections
    const collections = ['word_lists', 'vocab_lists', 'class_lists'];
    for (const col of collections) {
      const d = await db.collection(col).doc('aRGjnGXdU4aupiS8SlXR').get();
      if (d.exists) console.log('Found in', col);
    }
  }
}

// Also check class_progress for this student
const cpSnap = await db.collection('class_progress').where('studentId', '==', 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2').get();
console.log('CLASS PROGRESS DOCS:', cpSnap.size);
cpSnap.docs.forEach(d => console.log('CP:', JSON.stringify(d.data()).slice(0, 300)));

// Check latest attempt details
const latestAttempt = await db.collection('attempts').doc('pGqG1GT5Y3ZU5WT7e0smwqWQWdb2_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780261165859_odizkn6an').get();
if (latestAttempt.exists) {
  const d = latestAttempt.data();
  console.log('SCORE:', d.score, '/', d.totalQuestions);
  console.log('PASSED:', d.passed);
  console.log('STUDY DAY:', d.studyDay);
  console.log('ANSWERS (first 2):', JSON.stringify(d.answers?.slice(0, 2), null, 2));
}
process.exit(0);
