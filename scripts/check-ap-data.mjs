import { readFileSync } from 'fs'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const credPath = `${process.env.APPDATA || process.env.HOME + '/.config'}/firebase/dmchwang_gmail_com_application_default_credentials.json`
process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath

const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/\r$/, '')
})
const projectId = env.VITE_FIREBASE_PROJECT_ID
const app = initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)

console.log(`Project: ${projectId}\n`)

// 1. Check Auth accounts
console.log('=== AUTH ACCOUNTS ===')
for (const email of ['teacher@apboost.test', 'student@apboost.test']) {
  try {
    const user = await auth.getUserByEmail(email)
    console.log(`${email} -> uid: ${user.uid}, name: ${user.displayName}`)
  } catch (e) {
    console.log(`${email} -> NOT FOUND`)
  }
}

// Get UIDs
let teacherUid, studentUid
try { teacherUid = (await auth.getUserByEmail('teacher@apboost.test')).uid } catch(e) {}
try { studentUid = (await auth.getUserByEmail('student@apboost.test')).uid } catch(e) {}
console.log(`\nTeacher UID: ${teacherUid || 'MISSING'}`)
console.log(`Student UID: ${studentUid || 'MISSING'}`)

// 2. Check Firestore user profiles
console.log('\n=== USER PROFILES (Firestore) ===')
for (const uid of [teacherUid, studentUid].filter(Boolean)) {
  const doc = await db.doc(`users/${uid}`).get()
  if (doc.exists) {
    const d = doc.data()
    console.log(`${uid}: role=${d.role}, name=${d.displayName}, email=${d.email}`)
  } else {
    console.log(`${uid}: NO PROFILE`)
  }
}

// 3. Check classes
console.log('\n=== CLASSES ===')
const classesSnap = await db.collection('ap_classes').get()
console.log(`Total classes: ${classesSnap.size}`)
classesSnap.docs.forEach(doc => {
  const d = doc.data()
  const isTeacher = d.teacherId === teacherUid
  const hasStudent = d.studentIds?.includes(studentUid)
  console.log(`  ${doc.id}: "${d.name}" period=${d.period || 'N/A'}, teacherId=${d.teacherId} ${isTeacher ? '✓TEACHER' : '✗NOT-TEACHER'}, students=[${d.studentIds?.join(', ') || 'none'}] ${hasStudent ? '✓HAS-STUDENT' : '✗NO-STUDENT'}`)
})

// 4. Check tests
console.log('\n=== TESTS ===')
const testsSnap = await db.collection('ap_tests').get()
console.log(`Total tests: ${testsSnap.size}`)
testsSnap.docs.forEach(doc => {
  const d = doc.data()
  const isTeacher = d.createdBy === teacherUid
  const sectionSummary = d.sections?.map(s => `${s.sectionType}:${s.questionIds?.length || 0}q`).join(', ') || 'no sections'
  console.log(`  ${doc.id}: "${d.title}" published=${d.isPublished}, createdBy=${d.createdBy} ${isTeacher ? '✓TEACHER' : '✗NOT-TEACHER'}, sections=[${sectionSummary}]`)
})

// 5. Check assignments
console.log('\n=== ASSIGNMENTS ===')
const assignSnap = await db.collection('ap_assignments').get()
console.log(`Total assignments: ${assignSnap.size}`)
assignSnap.docs.forEach(doc => {
  const d = doc.data()
  const isTeacher = d.teacherId === teacherUid
  const hasStudent = d.studentIds?.includes(studentUid)
  console.log(`  ${doc.id}: testId=${d.testId}, classId=${d.classId}, teacherId=${d.teacherId} ${isTeacher ? '✓TEACHER' : '✗NOT-TEACHER'}, students=[${d.studentIds?.join(', ') || 'none'}] ${hasStudent ? '✓HAS-STUDENT' : '✗NO-STUDENT'}, status=${d.status || 'N/A'}`)
})

// 6. Check test results
console.log('\n=== TEST RESULTS ===')
const resultsSnap = await db.collection('ap_test_results').get()
console.log(`Total results: ${resultsSnap.size}`)
resultsSnap.docs.forEach(doc => {
  const d = doc.data()
  const isStudent = d.userId === studentUid
  console.log(`  ${doc.id}: userId=${d.userId} ${isStudent ? '✓STUDENT' : '✗OTHER'}, testId=${d.testId}, score=${d.score ?? d.mcqScore ?? 'N/A'}, status=${d.status || 'N/A'}`)
})

// 7. Check questions count
console.log('\n=== QUESTIONS ===')
const qSnap = await db.collection('ap_questions').get()
console.log(`Total questions: ${qSnap.size}`)
const byCreator = {}
qSnap.docs.forEach(doc => {
  const d = doc.data()
  byCreator[d.createdBy] = (byCreator[d.createdBy] || 0) + 1
})
Object.entries(byCreator).forEach(([k, v]) => {
  console.log(`  createdBy ${k}: ${v} questions ${k === teacherUid ? '✓TEACHER' : ''}`)
})

process.exit(0)
