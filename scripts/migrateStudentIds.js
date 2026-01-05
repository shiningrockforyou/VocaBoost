/**
 * Migration Script: Populate studentIds[] array on existing classes
 *
 * This script reads the members subcollection for each class and populates
 * the studentIds array field. Run this ONCE after deploying the studentIds
 * feature.
 *
 * Usage:
 *   node scripts/migrateStudentIds.js
 *
 * Prerequisites:
 *   - Service account key at scripts/serviceAccountKey.json
 *   - Download from: Firebase Console → Project Settings → Service Accounts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load service account
const serviceAccountPath = join(__dirname, 'serviceAccountKey.json')
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (error) {
  console.error('ERROR: Could not load service account key.')
  console.error(`Expected file at: ${serviceAccountPath}`)
  console.error('\nTo get this file:')
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts')
  console.error('2. Click "Generate new private key"')
  console.error('3. Save the downloaded file as scripts/serviceAccountKey.json')
  process.exit(1)
}

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
})
const db = getFirestore(app)

console.log(`Connected to Firebase project: ${serviceAccount.project_id}\n`)

async function migrateStudentIds() {
  console.log('Starting studentIds migration...\n')

  try {
    // Get all classes
    const classesSnap = await db.collection('classes').get()
    console.log(`Found ${classesSnap.docs.length} classes to process\n`)

    let classesUpdated = 0
    let totalStudents = 0

    for (const classDoc of classesSnap.docs) {
      const classId = classDoc.id
      const classData = classDoc.data()
      console.log(`Processing class: "${classData.name || classId}"`)

      // Get all members from subcollection
      const membersSnap = await db
        .collection('classes')
        .doc(classId)
        .collection('members')
        .get()

      const studentIds = membersSnap.docs.map(doc => doc.id)

      if (studentIds.length === 0) {
        console.log('  No members found\n')
        continue
      }

      // Update class with studentIds array
      await db.collection('classes').doc(classId).update({
        studentIds: studentIds,
        studentCount: studentIds.length
      })

      console.log(`  Added ${studentIds.length} student IDs\n`)
      classesUpdated++
      totalStudents += studentIds.length
    }

    console.log('='.repeat(50))
    console.log('Migration complete!')
    console.log(`  Classes updated: ${classesUpdated}`)
    console.log(`  Total students mapped: ${totalStudents}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrateStudentIds()
