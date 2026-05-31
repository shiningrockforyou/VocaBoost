import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';
const listId = 'aRGjnGXdU4aupiS8SlXR';

// The CSD might be derived from attempts or stored as a subcollection or nested in a stats doc
// Let's check what collections exist under the users doc
const userSubcols = await db.collection('users').doc(uid).listCollections();
console.log('User subcollections:', userSubcols.map(c => c.id));

// Check if CSD is computed from attempts (the system log "applied" suggests it wrote somewhere)
// The most likely place is a stats doc in classes collection
const classesStats = await db.collection('classes').doc(classId).collection('stats').doc(uid).get();
console.log('classes/stats/uid exists:', classesStats.exists);
if (classesStats.exists) console.log(JSON.stringify(classesStats.data(), null, 2));

// Check if it's in a 'progress' subcollection under lists
const listSubcols = await db.collection('lists').doc(listId).listCollections();
console.log('List subcollections:', listSubcols.map(c => c.id));

// Check most recent attempt to understand the app's expected CSD location
// Maybe the app reads CSD directly from attempts count
const attemptsSnap = await db.collection('attempts').where('studentId', '==', uid).where('classId', '==', classId).get();
console.log('\nTotal attempts for student+class:', attemptsSnap.size);
attemptsSnap.docs.forEach(d => {
  const data = d.data();
  console.log('  studyDay:', data.studyDay, 'passed:', data.passed, 'isFirstDay:', data.isFirstDay, 'score:', data.score, '/', data.totalQuestions);
});

// Also check if there's a 'progress' document in a different pattern
// Maybe stored as users/{uid}/progress/{classId}
const userProgressDoc = await db.collection('users').doc(uid).collection('progress').doc(classId).get();
console.log('\nusers/progress/classId exists:', userProgressDoc.exists);

// How about users/{uid}/class_data/{classId}?
const userClassData = await db.collection('users').doc(uid).collection('class_data').doc(classId).get();
console.log('users/class_data/classId exists:', userClassData.exists);
process.exit(0);
