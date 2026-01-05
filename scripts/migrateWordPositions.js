/**
 * Migration Script: Add position field to existing words
 *
 * This script assigns a `position` field to all existing word documents
 * based on their current `createdAt` order. Run this ONCE before deploying
 * the position-based refactor.
 *
 * Usage:
 *   node scripts/migrateWordPositions.js
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

// Firestore batch limit
const BATCH_LIMIT = 500

async function migrateWordPositions() {
  console.log('Starting word position migration...\n')

  try {
    // Get all lists
    const listsSnap = await db.collection('lists').get()
    console.log(`Found ${listsSnap.docs.length} lists to process\n`)

    let totalWordsMigrated = 0
    let listsProcessed = 0

    for (const listDoc of listsSnap.docs) {
      const listId = listDoc.id
      const listData = listDoc.data()
      console.log(`Processing list: "${listData.title || listId}"`)

      // Get words ordered by createdAt (current order)
      const wordsSnap = await db
        .collection('lists')
        .doc(listId)
        .collection('words')
        .orderBy('createdAt', 'asc')
        .get()

      if (wordsSnap.docs.length === 0) {
        console.log('  No words to migrate\n')
        continue
      }

      // Process in batches to avoid Firestore limits
      let wordsMigrated = 0
      for (let i = 0; i < wordsSnap.docs.length; i += BATCH_LIMIT) {
        const batch = db.batch()
        const chunk = wordsSnap.docs.slice(i, i + BATCH_LIMIT)

        chunk.forEach((wordDoc, chunkIndex) => {
          const position = i + chunkIndex // Global position in list
          const wordRef = db
            .collection('lists')
            .doc(listId)
            .collection('words')
            .doc(wordDoc.id)
          batch.update(wordRef, { position: position })
        })

        await batch.commit()
        wordsMigrated += chunk.length
      }

      console.log(`  Migrated ${wordsMigrated} words (positions 0-${wordsMigrated - 1})\n`)
      totalWordsMigrated += wordsMigrated
      listsProcessed++
    }

    console.log('='.repeat(50))
    console.log('Migration complete!')
    console.log(`  Lists processed: ${listsProcessed}`)
    console.log(`  Words migrated: ${totalWordsMigrated}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrateWordPositions()
