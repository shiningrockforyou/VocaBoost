/**
 * Script to fetch the last 3 test attempts for a student (or students) by email
 *
 * Run with: node scripts/get-student-attempts.js <email1> [email2] [email3] ...
 *
 * Example:
 *   node scripts/get-student-attempts.js student@example.com
 *   node scripts/get-student-attempts.js student1@example.com student2@example.com
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Look up a user by email and return their UID
 */
async function getUserByEmail(email) {
  const usersSnap = await db.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();

  if (usersSnap.empty) {
    return null;
  }

  const userDoc = usersSnap.docs[0];
  return {
    uid: userDoc.id,
    email: userDoc.data().email,
    displayName: userDoc.data().profile?.displayName || userDoc.data().email
  };
}

/**
 * Fetch the last N attempts for a student
 */
async function getLastAttempts(studentId, limit = 3) {
  const attemptsSnap = await db.collection('attempts')
    .where('studentId', '==', studentId)
    .orderBy('submittedAt', 'desc')
    .limit(limit)
    .get();

  if (attemptsSnap.empty) {
    return [];
  }

  const attempts = [];

  for (const doc of attemptsSnap.docs) {
    const data = doc.data();

    // Enrich with class name
    let className = 'Unknown Class';
    if (data.classId) {
      const classDoc = await db.collection('classes').doc(data.classId).get();
      if (classDoc.exists) {
        className = classDoc.data().name || className;
      }
    }

    // Enrich with list name (parse from testId)
    let listName = 'Unknown List';
    if (data.testId) {
      // testId format: "vocaboost_test_{classId}_{listId}_{testType}" or similar
      const parts = data.testId.split('_');
      // Try to find listId - it's typically after classId
      for (const part of parts) {
        if (part.length > 10) { // Firestore IDs are typically 20+ chars
          const listDoc = await db.collection('lists').doc(part).get();
          if (listDoc.exists) {
            listName = listDoc.data().title || listName;
            break;
          }
        }
      }
    }

    attempts.push({
      attemptId: doc.id,
      submittedAt: data.submittedAt?.toDate?.() || data.submittedAt,
      className,
      listName,
      testType: data.testType || 'unknown',
      sessionType: data.sessionType || null,
      studyDay: data.studyDay || null,
      score: data.score,
      totalQuestions: data.totalQuestions,
      skipped: data.skipped || 0,
      credibility: data.credibility,
      retention: data.retention,
      answers: data.answers || [],
      graded: data.graded,
      testId: data.testId,
      classId: data.classId,
      teacherId: data.teacherId
    });
  }

  return attempts;
}

/**
 * Format a single answer for display
 */
function formatAnswer(answer, index) {
  const status = answer.isCorrect ? '✓' : '✗';
  const correctDisplay = Array.isArray(answer.correctAnswer)
    ? answer.correctAnswer.join(' / ')
    : answer.correctAnswer;

  return `    ${index + 1}. ${status} "${answer.word}"
       Student answered: "${answer.studentAnswer || answer.studentResponse || '(no answer)'}"
       Correct answer: "${correctDisplay}"`;
}

/**
 * Format and display attempt details
 */
function displayAttempt(attempt, attemptNumber) {
  const dateStr = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleString()
    : 'Unknown date';

  const sessionInfo = attempt.sessionType
    ? `${attempt.sessionType} test (Day ${attempt.studyDay || '?'})`
    : attempt.testType;

  console.log(`
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ ATTEMPT #${attemptNumber}                                                                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  📅 Date:           ${dateStr}
  📚 Class:          ${attempt.className}
  📖 List:           ${attempt.listName}
  📝 Test Type:      ${sessionInfo}

  ── RESULTS ─────────────────────────────────────────────────────────────────

  🎯 Score:          ${attempt.score !== undefined ? attempt.score.toFixed(1) + '%' : 'N/A'}
  📊 Questions:      ${attempt.totalQuestions || 0}
  ⏭️  Skipped:        ${attempt.skipped || 0}
  🔍 Credibility:    ${attempt.credibility !== undefined ? (attempt.credibility * 100).toFixed(1) + '%' : 'N/A'}
  🧠 Retention:      ${attempt.retention !== undefined ? (attempt.retention * 100).toFixed(1) + '%' : 'N/A'}

  ── ANSWERS ─────────────────────────────────────────────────────────────────
`);

  if (attempt.answers && attempt.answers.length > 0) {
    attempt.answers.forEach((answer, i) => {
      console.log(formatAnswer(answer, i));
    });
  } else {
    console.log('    (No answer details available)');
  }

  console.log(`
  ── METADATA ────────────────────────────────────────────────────────────────

  Attempt ID:  ${attempt.attemptId}
  Test ID:     ${attempt.testId}
  Class ID:    ${attempt.classId}
  Teacher ID:  ${attempt.teacherId}
  Graded:      ${attempt.graded ? 'Yes' : 'No'}
`);
}

/**
 * Main function
 */
async function main() {
  const emails = process.argv.slice(2);

  if (emails.length === 0) {
    console.log(`
Usage: node scripts/get-student-attempts.js <email1> [email2] ...

Example:
  node scripts/get-student-attempts.js student@example.com
  node scripts/get-student-attempts.js alice@school.edu bob@school.edu
`);
    process.exit(1);
  }

  console.log(`\nFetching last 3 attempts for ${emails.length} student(s)...\n`);

  for (const email of emails) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  STUDENT: ${email}`);
    console.log(`${'═'.repeat(80)}`);

    // Look up user by email
    const user = await getUserByEmail(email);

    if (!user) {
      console.log(`\n  ❌ No user found with email: ${email}\n`);
      continue;
    }

    console.log(`\n  ✓ Found user: ${user.displayName} (UID: ${user.uid})`);

    // Get last 3 attempts
    const attempts = await getLastAttempts(user.uid, 3);

    if (attempts.length === 0) {
      console.log(`\n  ⚠️  No test attempts found for this student.\n`);
      continue;
    }

    console.log(`\n  Found ${attempts.length} attempt(s):`);

    attempts.forEach((attempt, index) => {
      displayAttempt(attempt, index + 1);
    });
  }

  console.log(`\n${'═'.repeat(80)}`);
  console.log('  Done!');
  console.log(`${'═'.repeat(80)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
