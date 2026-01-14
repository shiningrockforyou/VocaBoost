/**
 * Script to export all users from Firestore to a flattened JSON file
 *
 * Run with: node scripts/export-users.js
 *
 * Output: users_export.json in project root
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  console.log('Fetching all users from Firestore...');

  // Fetch ALL users
  const snapshot = await db.collection('users').get();

  console.log(`Found ${snapshot.size} users. Processing...`);

  const users = snapshot.docs.map(doc => {
    const data = doc.data();
    const profile = data.profile || {};
    const stats = data.stats || {};
    const settings = data.settings || {};
    const challenges = data.challenges || {};
    const enrolledClasses = data.enrolledClasses || {};

    // Flatten all nested objects
    return {
      userId: doc.id,
      role: data.role ?? null,
      email: data.email ?? null,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,

      // Profile fields
      profile_displayName: profile.displayName ?? null,
      profile_school: profile.school ?? null,
      profile_gradYear: profile.gradYear ?? null,
      profile_gradMonth: profile.gradMonth ?? null,
      profile_calculatedGrade: profile.calculatedGrade ?? null,
      profile_avatarUrl: profile.avatarUrl ?? null,

      // Stats fields
      stats_totalWordsLearned: stats.totalWordsLearned ?? null,

      // Settings fields
      settings_weeklyGoal: settings.weeklyGoal ?? null,
      settings_useUnifiedQueue: settings.useUnifiedQueue ?? null,
      settings_primaryFocusListId: settings.primaryFocusListId ?? null,
      settings_primaryFocusClassId: settings.primaryFocusClassId ?? null,

      // Challenges - just count the history entries
      challenges_historyCount: Array.isArray(challenges.history) ? challenges.history.length : 0,

      // Enrolled classes - count and list of IDs
      enrolledClassesCount: Object.keys(enrolledClasses).length,
      enrolledClassIds: Object.keys(enrolledClasses),
    };
  });

  writeFileSync('./users_export.json', JSON.stringify(users, null, 2));
  console.log(`Exported ${users.length} users to users_export.json`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
