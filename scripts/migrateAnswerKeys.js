/**
 * Migrate answer keys from ap_questions to ap_answer_keys collection.
 *
 * This script:
 * 1. Reads all ap_questions documents
 * 2. For each question with correctAnswers or explanation:
 *    - Creates ap_answer_keys/{questionId} with { correctAnswers, explanation }
 *    - Removes correctAnswers and explanation fields from ap_questions/{questionId}
 *
 * Idempotent: safe to run multiple times. Skips questions that have already
 * been migrated (no correctAnswers field on ap_questions).
 *
 * Usage: node scripts/migrateAnswerKeys.js
 */

import { readFileSync } from 'fs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// --- Init ---
const credPath = `${process.env.APPDATA || process.env.HOME + '/.config'}/firebase/dmchwang_gmail_com_application_default_credentials.json`
process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath

const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/\r$/, '')
})
const projectId = env.VITE_FIREBASE_PROJECT_ID
console.log('Firebase project:', projectId)

const app = initializeApp({ projectId })
const db = getFirestore(app)

// --- Migration ---
async function migrate() {
  const questionsSnap = await db.collection('ap_questions').get()
  console.log(`Found ${questionsSnap.size} questions`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const docSnap of questionsSnap.docs) {
    const data = docSnap.data()
    const questionId = docSnap.id

    // Skip if no correctAnswers field (already migrated or FRQ without answers)
    if (!data.correctAnswers && !data.explanation) {
      skipped++
      continue
    }

    try {
      // Check if answer key already exists
      const answerKeyRef = db.collection('ap_answer_keys').doc(questionId)
      const existing = await answerKeyRef.get()

      if (existing.exists) {
        console.log(`  [skip] ${questionId} — answer key already exists`)
        skipped++
        continue
      }

      // Create answer key document
      const answerKeyData = {
        correctAnswers: data.correctAnswers || [],
        explanation: data.explanation || '',
        migratedAt: FieldValue.serverTimestamp(),
      }

      await answerKeyRef.set(answerKeyData)

      // Remove correctAnswers and explanation from question document
      await docSnap.ref.update({
        correctAnswers: FieldValue.delete(),
        explanation: FieldValue.delete(),
      })

      console.log(`  [migrated] ${questionId} — ${(data.correctAnswers || []).length} answers`)
      migrated++
    } catch (err) {
      console.error(`  [error] ${questionId}:`, err.message)
      errors++
    }
  }

  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped, ${errors} errors`)
}

migrate().catch(console.error)
