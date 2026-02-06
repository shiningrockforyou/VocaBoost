/**
 * Advance a student's progress in a class by inserting synthetic attempts.
 * This is needed when a student transfers from CORE to TOP class on the same list.
 *
 * The reconciliation algorithm will pick up these attempts and set CSD/TWI accordingly.
 *
 * Run: node scripts/advance-student-to-day.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── CONFIGURATION ───────────────────────────────────────────
const TARGET_CLASS_NAME = '25WT 2차 TOP OFFLINE';
const STUDENT_EMAIL = 'love0609m@gmail.com';
const TARGET_DAY = 10;        // CSD to set (student's next session will be TARGET_DAY + 1)
const WORDS_PER_DAY = 80;     // TOP class pacing
// ─────────────────────────────────────────────────────────────

async function advanceStudent() {
  // Step 1: Look up class
  console.log('─'.repeat(70));
  console.log('STEP 1: Looking up IDs');
  console.log('─'.repeat(70));

  const classesSnap = await db.collection('classes')
    .where('name', '==', TARGET_CLASS_NAME)
    .get();

  if (classesSnap.empty) {
    console.error(`Class not found: "${TARGET_CLASS_NAME}"`);
    process.exit(1);
  }

  // If multiple classes share the same name, pick the one with assignments
  let classDoc;
  if (classesSnap.size > 1) {
    console.log(`  Found ${classesSnap.size} classes named "${TARGET_CLASS_NAME}", selecting the one with assignments...`);
    classDoc = classesSnap.docs.find(d => Object.keys(d.data().assignments || {}).length > 0);
    if (!classDoc) {
      console.error('None of the matching classes have assignments');
      process.exit(1);
    }
  } else {
    classDoc = classesSnap.docs[0];
  }

  const classId = classDoc.id;
  const classData = classDoc.data();
  const teacherId = classData.ownerTeacherId;
  const assignments = classData.assignments || {};

  console.log(`  Class: "${TARGET_CLASS_NAME}"`);
  console.log(`  classId: ${classId}`);
  console.log(`  teacherId: ${teacherId}`);

  // Get listId from assignments
  const listIds = Object.keys(assignments);
  if (listIds.length === 0) {
    console.error('No lists assigned to this class');
    process.exit(1);
  }

  console.log(`\n  Assigned lists (${listIds.length}):`);
  for (const lid of listIds) {
    const listDoc = await db.collection('lists').doc(lid).get();
    const title = listDoc.exists ? listDoc.data().title : 'Unknown';
    const pace = assignments[lid]?.pace || 'N/A';
    console.log(`    - ${title} (listId: ${lid}, pace: ${pace})`);
  }

  // Use the first list (or the only one)
  const listId = listIds[0];
  const listDoc = await db.collection('lists').doc(listId).get();
  const listTitle = listDoc.exists ? listDoc.data().title : 'Unknown';

  console.log(`\n  Using listId: ${listId} ("${listTitle}")`);

  // Look up student
  const usersSnap = await db.collection('users')
    .where('email', '==', STUDENT_EMAIL)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    console.error(`Student not found: ${STUDENT_EMAIL}`);
    process.exit(1);
  }

  const userId = usersSnap.docs[0].id;
  const displayName = usersSnap.docs[0].data().profile?.displayName || STUDENT_EMAIL;

  console.log(`\n  Student: ${displayName} (${STUDENT_EMAIL})`);
  console.log(`  userId: ${userId}`);

  // Check existing attempts for this class+list (query by studentId only, filter in code)
  const existingSnap = await db.collection('attempts')
    .where('studentId', '==', userId)
    .orderBy('submittedAt', 'desc')
    .limit(30)
    .get();

  const classAttempts = existingSnap.docs.filter(d => d.data().classId === classId);
  console.log(`\n  Existing attempts for this class: ${classAttempts.length}`);
  if (classAttempts.length > 0) {
    classAttempts.forEach(doc => {
      const d = doc.data();
      console.log(`    Day ${d.studyDay} ${d.sessionType} | nwei: ${d.newWordEndIndex} | passed: ${d.passed}`);
    });
  }

  // Summary
  const newWordStartIndex = (TARGET_DAY - 1) * WORDS_PER_DAY;
  const newWordEndIndex = TARGET_DAY * WORDS_PER_DAY - 1;

  console.log('\n' + '─'.repeat(70));
  console.log('PLAN:');
  console.log('─'.repeat(70));
  console.log(`  Insert NEW test attempt:    Day ${TARGET_DAY}, nwei: ${newWordEndIndex}`);
  console.log(`  Insert REVIEW test attempt: Day ${TARGET_DAY}`);
  console.log(`  Delete class_progress doc:  ${classId}_${listId}`);
  console.log(`  Delete session_states doc:  ${classId}_${listId}`);
  console.log(`\n  Expected result after reconciliation:`);
  console.log(`    CSD = ${TARGET_DAY}`);
  console.log(`    TWI = ${newWordEndIndex + 1}`);
  console.log(`    Next session = Day ${TARGET_DAY + 1} (words ${newWordEndIndex + 1}-${newWordEndIndex + WORDS_PER_DAY})`);

  // Step 2: Insert synthetic attempts
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 2: Inserting synthetic attempts');
  console.log('─'.repeat(70));

  const now = admin.firestore.Timestamp.now();

  const newTestAttempt = {
    studentId: userId,
    classId: classId,
    listId: listId,
    teacherId: teacherId,
    sessionType: 'new',
    studyDay: TARGET_DAY,
    newWordStartIndex: newWordStartIndex,
    newWordEndIndex: newWordEndIndex,
    passed: true,
    score: 100,
    graded: true,
    testType: 'typed',
    totalQuestions: 1,
    skipped: 0,
    answers: [],
    credibility: 1,
    retention: 1,
    isFirstDay: false,
    interventionLevel: 0,
    wordsIntroduced: WORDS_PER_DAY,
    wordsReviewed: 0,
    listTitle: listTitle,
    submittedAt: now
  };

  const reviewTestAttempt = {
    studentId: userId,
    classId: classId,
    listId: listId,
    teacherId: teacherId,
    sessionType: 'review',
    studyDay: TARGET_DAY,
    newWordStartIndex: newWordStartIndex,
    newWordEndIndex: newWordEndIndex,
    segmentStartIndex: 0,
    segmentEndIndex: newWordEndIndex,
    passed: true,
    score: 100,
    graded: true,
    testType: 'typed',
    totalQuestions: 1,
    skipped: 0,
    answers: [],
    credibility: 1,
    retention: 1,
    isFirstDay: false,
    interventionLevel: 0,
    wordsIntroduced: 0,
    wordsReviewed: WORDS_PER_DAY,
    listTitle: listTitle,
    submittedAt: now
  };

  const newRef = await db.collection('attempts').add(newTestAttempt);
  console.log(`  Created NEW test attempt: ${newRef.id}`);

  const reviewRef = await db.collection('attempts').add(reviewTestAttempt);
  console.log(`  Created REVIEW test attempt: ${reviewRef.id}`);

  // Step 3: Reset existing progress
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 3: Resetting existing progress');
  console.log('─'.repeat(70));

  const progressDocId = `${classId}_${listId}`;

  const progressRef = db.collection('users').doc(userId).collection('class_progress').doc(progressDocId);
  const progressSnap = await progressRef.get();
  if (progressSnap.exists) {
    await progressRef.delete();
    console.log(`  Deleted class_progress/${progressDocId}`);
  } else {
    console.log(`  No class_progress/${progressDocId} to delete`);
  }

  const sessionRef = db.collection('users').doc(userId).collection('session_states').doc(progressDocId);
  const sessionSnap = await sessionRef.get();
  if (sessionSnap.exists) {
    await sessionRef.delete();
    console.log(`  Deleted session_states/${progressDocId}`);
  } else {
    console.log(`  No session_states/${progressDocId} to delete`);
  }

  // Done
  console.log('\n' + '─'.repeat(70));
  console.log('DONE');
  console.log('─'.repeat(70));
  console.log(`  Student "${displayName}" is now set up for Day ${TARGET_DAY + 1}.`);
  console.log(`  Next session will introduce words ${newWordEndIndex + 1}-${newWordEndIndex + WORDS_PER_DAY}.`);
  console.log(`\n  Verify with: node scripts/check-progress-vs-reconciliation.js ${STUDENT_EMAIL}`);
}

advanceStudent().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
