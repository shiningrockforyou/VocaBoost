/**
 * Create Firebase Auth accounts for seed data users.
 * Usage: node scripts/create-auth-accounts.js
 *
 * Creates a teacher and student account with email/password auth,
 * then re-seeds Firestore data with the real UIDs.
 */

import { readFileSync } from 'fs'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
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

// --- Accounts to create ---
const ACCOUNTS = [
  {
    email: 'teacher@apboost.test',
    password: 'Teacher123!',
    displayName: 'Ms. Thompson',
    role: 'teacher',
  },
  {
    email: 'student@apboost.test',
    password: 'Student123!',
    displayName: 'Alex Johnson',
    role: 'student',
  },
]

async function createOrGetUser(account) {
  try {
    // Check if user already exists
    const existing = await auth.getUserByEmail(account.email)
    console.log(`  Already exists: ${account.email} (uid: ${existing.uid})`)
    return existing.uid
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Create new user
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
  console.log('\n--- Creating Auth Accounts ---')

  const uids = {}
  for (const account of ACCOUNTS) {
    const uid = await createOrGetUser(account)
    uids[account.role] = uid

    // Create/update Firestore user profile
    await db.doc(`users/${uid}`).set({
      displayName: account.displayName,
      email: account.email,
      role: account.role,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  const teacherUid = uids.teacher
  const studentUid = uids.student

  console.log('\n--- Updating Seed Data ---')

  // Update tests to be owned by real teacher
  const testIds = ['test_micro_full_1', 'test_macro_full_1', 'test_calc_ab_full_1']
  for (const testId of testIds) {
    await db.doc(`ap_tests/${testId}`).update({ createdBy: teacherUid })
  }
  console.log('  Updated 3 tests -> teacher:', teacherUid)

  // Update classes
  const classIds = ['class_econ_p1', 'class_calc_p3']
  for (const classId of classIds) {
    const classDoc = await db.doc(`ap_classes/${classId}`).get()
    const data = classDoc.data()
    const studentIds = (data?.studentIds || []).map(id =>
      id === 'student_seed_001' ? studentUid : id
    )
    await db.doc(`ap_classes/${classId}`).update({
      teacherId: teacherUid,
      studentIds,
    })
  }
  console.log('  Updated 2 classes -> teacher + student')

  // Update assignments
  const assignIds = ['assign_micro_p1', 'assign_macro_p1', 'assign_calc_p3']
  for (const assignId of assignIds) {
    const assignDoc = await db.doc(`ap_assignments/${assignId}`).get()
    const data = assignDoc.data()
    const studentIds = (data?.studentIds || []).map(id =>
      id === 'student_seed_001' ? studentUid : id
    )
    await db.doc(`ap_assignments/${assignId}`).update({
      teacherId: teacherUid,
      studentIds,
    })
  }
  console.log('  Updated 3 assignments')

  // Update test results for student_seed_001 -> real student uid
  const resultIds = ['result_micro_student_seed_001', 'result_macro_student_seed_001', 'result_calc_student_seed_001']
  for (const resultId of resultIds) {
    const doc = await db.doc(`ap_test_results/${resultId}`).get()
    if (doc.exists) {
      const data = doc.data()
      // Create new result with real uid, delete old one
      const prefix = resultId.split('student_seed_001')[0]  // e.g. "result_micro_"
      await db.doc(`ap_test_results/${prefix}${studentUid}`).set({
        ...data,
        userId: studentUid,
        studentEmail: 'student@apboost.test',
      })
      await db.doc(`ap_test_results/${resultId}`).delete()
    }
  }
  console.log('  Updated test results for student')

  // Update questions createdBy
  const collections = ['ap_questions']
  for (const col of collections) {
    const snapshot = await db.collection(col).where('createdBy', '==', 'teacher_seed_001').get()
    const batch = db.batch()
    snapshot.docs.forEach(doc => batch.update(doc.ref, { createdBy: teacherUid }))
    if (snapshot.size > 0) {
      await batch.commit()
      console.log(`  Updated ${snapshot.size} questions -> teacher`)
    }
  }

  console.log('\n=== DONE ===')
  console.log('\nLogin credentials:')
  console.log('  Teacher: teacher@apboost.test / Teacher123!')
  console.log('  Student: student@apboost.test / Student123!')
  console.log(`\n  Teacher UID: ${teacherUid}`)
  console.log(`  Student UID: ${studentUid}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
