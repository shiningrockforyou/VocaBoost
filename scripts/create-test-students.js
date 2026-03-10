/**
 * Create student accounts for B13/B14 behavioral testing.
 * Usage: node scripts/create-test-students.js
 *
 * Creates student4 through student11 with Firestore profiles,
 * enrolled in both seed classes and all assignments.
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

const STUDENTS = [
  { email: 'student4@apboost.test',  password: 'Student123!', displayName: 'Diana Park' },
  { email: 'student5@apboost.test',  password: 'Student123!', displayName: 'Ethan Chen' },
  { email: 'student6@apboost.test',  password: 'Student123!', displayName: 'Fatima Ali' },
  { email: 'student7@apboost.test',  password: 'Student123!', displayName: 'George Martinez' },
  { email: 'student8@apboost.test',  password: 'Student123!', displayName: 'Hannah Lee' },
  { email: 'student9@apboost.test',  password: 'Student123!', displayName: 'Isaac Nguyen' },
  { email: 'student10@apboost.test', password: 'Student123!', displayName: 'Julia Brown' },
  { email: 'student11@apboost.test', password: 'Student123!', displayName: 'Kevin Patel' },
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
  console.log('\n--- Creating Behavioral Test Student Accounts ---')

  const uids = []

  for (const student of STUDENTS) {
    const uid = await createOrGetUser(student)
    uids.push(uid)

    await db.doc(`users/${uid}`).set({
      displayName: student.displayName,
      email: student.email,
      role: 'student',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(`  Profile: ${student.displayName}`)
  }

  console.log('\n--- Enrolling in Classes ---')
  for (const classId of CLASS_IDS) {
    await db.doc(`ap_classes/${classId}`).update({
      studentIds: FieldValue.arrayUnion(...uids),
    })
    console.log(`  Added 8 students to ${classId}`)
  }

  console.log('\n--- Adding to Assignments ---')
  for (const assignId of ASSIGN_IDS) {
    await db.doc(`ap_assignments/${assignId}`).update({
      studentIds: FieldValue.arrayUnion(...uids),
    })
    console.log(`  Added 8 students to ${assignId}`)
  }

  console.log('\n=== DONE ===\n')
  console.log('| # | Email | Display Name | UID |')
  console.log('|---|-------|-------------|-----|')
  for (let i = 0; i < STUDENTS.length; i++) {
    console.log(`| ${i + 4} | ${STUDENTS[i].email} | ${STUDENTS[i].displayName} | ${uids[i]} |`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
