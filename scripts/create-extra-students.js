/**
 * Create 2 additional student accounts for parallel audit runs.
 * Usage: node scripts/create-extra-students.js
 *
 * Creates student2@apboost.test and student3@apboost.test,
 * adds Firestore profiles, and enrolls them in both seed classes
 * so they have access to all 3 tests.
 */

import { readFileSync } from 'fs'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
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
const auth = getAuth(app)
const db = getFirestore(app)

const NEW_STUDENTS = [
  {
    email: 'student2@apboost.test',
    password: 'Student123!',
    displayName: 'Brian Kim',
  },
  {
    email: 'student3@apboost.test',
    password: 'Student123!',
    displayName: 'Carmen Lopez',
  },
]

const CLASS_IDS = ['class_econ_p1', 'class_calc_p3']
const ASSIGN_IDS = ['assign_micro_p1', 'assign_macro_p1', 'assign_calc_p3']

async function createOrGetUser(account) {
  try {
    const existing = await auth.getUserByEmail(account.email)
    console.log(`  Already exists: ${account.email} (uid: ${existing.uid})`)
    return existing.uid
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email: account.email,
        password: account.password,
        displayName: account.displayName,
        emailVerified: true,
      })
      console.log(`  Created: ${account.email} (uid: ${user.uid})`)
      return user.uid
    }
    throw err
  }
}

async function main() {
  console.log('\n--- Creating Extra Student Accounts ---')

  const newUids = []

  for (const student of NEW_STUDENTS) {
    const uid = await createOrGetUser(student)
    newUids.push(uid)

    // Create Firestore user profile
    await db.doc(`users/${uid}`).set({
      displayName: student.displayName,
      email: student.email,
      role: 'student',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(`  Profile created for ${student.email}`)
  }

  // Enroll in classes
  console.log('\n--- Enrolling in Classes ---')
  for (const classId of CLASS_IDS) {
    await db.doc(`ap_classes/${classId}`).update({
      studentIds: FieldValue.arrayUnion(...newUids),
    })
    console.log(`  Added to ${classId}`)
  }

  // Enroll in assignments
  console.log('\n--- Adding to Assignments ---')
  for (const assignId of ASSIGN_IDS) {
    await db.doc(`ap_assignments/${assignId}`).update({
      studentIds: FieldValue.arrayUnion(...newUids),
    })
    console.log(`  Added to ${assignId}`)
  }

  console.log('\n=== DONE ===')
  console.log('\nNew student accounts:')
  for (let i = 0; i < NEW_STUDENTS.length; i++) {
    console.log(`  ${NEW_STUDENTS[i].email} / ${NEW_STUDENTS[i].password} (uid: ${newUids[i]})`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
