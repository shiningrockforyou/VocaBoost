#!/usr/bin/env node
/**
 * Cleanup all audit student accounts created by seed-audit-students.js.
 *
 * Matches by Firestore `auditAccount: true` field — NOT by email prefix —
 * so renames don't break cleanup. Cascades through Auth, user docs,
 * subcollections, attempts, and class membership decrement.
 *
 * Usage:
 *   node scripts/cleanup-audit-students.js                  # DRY RUN
 *   node scripts/cleanup-audit-students.js --apply          # actually delete
 *   node scripts/cleanup-audit-students.js --apply --keep-attempts
 *       (preserve attempts docs for forensic review; delete users only)
 *
 * Safety:
 *   - DRY RUN by default. Prints exact UIDs and docs that would be touched.
 *   - Only operates on Firestore users where auditAccount === true.
 *     If a real student has that field set, that's a bug — but we cannot
 *     accidentally delete a real student whose doc doesn't have the marker.
 *   - Refuses to delete more than 100 accounts in one run as a guardrail.
 */

import { readFileSync, existsSync, unlinkSync } from 'fs'
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const KEEP_ATTEMPTS = args.includes('--keep-attempts')
const SAFETY_CAP = 100  // refuse to delete more than this in one run

// --- Env / project ---
if (!existsSync('.env')) {
  console.error('Missing .env')
  process.exit(1)
}
const env = {}
readFileSync('.env', 'utf-8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/\r$/, '')
})
const projectId = env.VITE_FIREBASE_PROJECT_ID

// --- Credentials (same priority as seed script) ---
function initAdminApp() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ projectId, credential: applicationDefault() })
  }
  if (existsSync('./service-account.json')) {
    const sa = JSON.parse(readFileSync('./service-account.json', 'utf-8'))
    return initializeApp({ projectId, credential: cert(sa) })
  }
  const home = process.env.HOME || process.env.USERPROFILE
  const legacyPath = `${home}/.config/firebase/dmchwang_gmail_com_application_default_credentials.json`
  if (existsSync(legacyPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = legacyPath
    return initializeApp({ projectId, credential: applicationDefault() })
  }
  return initializeApp({ projectId, credential: applicationDefault() })
}

const app = initAdminApp()
const auth = getAuth(app)
const db = getFirestore(app)

// --- Find audit users ---
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Audit student cleanup`)
console.log(`  Project:        ${projectId}`)
console.log(`  Apply:          ${APPLY ? 'YES — will delete from Firebase' : 'NO (dry run; add --apply)'}`)
console.log(`  Keep attempts:  ${KEEP_ATTEMPTS}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

console.log('\nQuerying users where auditAccount === true ...')
const auditUsersSnap = await db.collection('users').where('auditAccount', '==', true).get()
console.log(`Found ${auditUsersSnap.size} audit user docs.`)

if (auditUsersSnap.size > SAFETY_CAP) {
  console.error(`Refusing to delete ${auditUsersSnap.size} > ${SAFETY_CAP}. Audit cap is in place to prevent runaway cleanup.`)
  console.error('If you really mean this, edit SAFETY_CAP in the script and rerun.')
  process.exit(1)
}

if (auditUsersSnap.empty) {
  console.log('Nothing to clean up. Exiting.')
  process.exit(0)
}

// --- Inspect what cleanup would touch ---
const targets = []
for (const userDoc of auditUsersSnap.docs) {
  const uid = userDoc.id
  const data = userDoc.data()
  const enrolledClassesSnap = await db.collection(`users/${uid}/enrolledClasses`).get()
  const studyStatesSnap = await db.collection(`users/${uid}/study_states`).get()
  const classProgressSnap = await db.collection(`users/${uid}/class_progress`).get()
  const attemptsSnap = await db.collection('attempts').where('studentId', '==', uid).get()
  targets.push({
    uid,
    email: data.email,
    displayName: data.displayName,
    persona: data.auditPersona,
    targetClass: data.auditTargetClass,
    enrolledClasses: enrolledClassesSnap.docs.map(d => d.id),
    studyStatesCount: studyStatesSnap.size,
    classProgressCount: classProgressSnap.size,
    attemptsCount: attemptsSnap.size,
  })
}

console.log('\nWhat would be deleted:')
console.log(`  Auth users:                 ${targets.length}`)
console.log(`  Firestore user docs:        ${targets.length}`)
console.log(`  enrolledClasses subdocs:    ${targets.reduce((s, t) => s + t.enrolledClasses.length, 0)}`)
console.log(`  study_states subdocs:       ${targets.reduce((s, t) => s + t.studyStatesCount, 0)}`)
console.log(`  class_progress subdocs:     ${targets.reduce((s, t) => s + t.classProgressCount, 0)}`)
console.log(`  attempts:                   ${KEEP_ATTEMPTS ? 0 : targets.reduce((s, t) => s + t.attemptsCount, 0)} ${KEEP_ATTEMPTS ? '(KEPT)' : ''}`)
console.log(`  class member subdocs:       ${targets.reduce((s, t) => s + t.enrolledClasses.length, 0)}`)
console.log(`  studentCount decrements:    one per enrollment (signed sum)`)

console.log('\nSample (first 5):')
for (const t of targets.slice(0, 5)) {
  console.log(`  ${t.uid.slice(0, 8)}... ${t.email}  persona=${t.persona}  enrolledIn=${t.enrolledClasses.join(',')}  attempts=${t.attemptsCount}`)
}

if (!APPLY) {
  console.log('\nAdd --apply to actually delete.')
  process.exit(0)
}

// --- Apply cleanup ---
console.log('\nApplying cleanup ...')
let usersDeleted = 0
let attemptsDeleted = 0
let errors = 0

for (const t of targets) {
  try {
    // 1) Delete attempts (unless --keep-attempts)
    if (!KEEP_ATTEMPTS) {
      const attemptsSnap = await db.collection('attempts').where('studentId', '==', t.uid).get()
      const batch = db.batch()
      attemptsSnap.docs.forEach(doc => batch.delete(doc.ref))
      if (!attemptsSnap.empty) {
        await batch.commit()
        attemptsDeleted += attemptsSnap.size
      }
    }

    // 2) Delete user subcollections (enrolledClasses, study_states, class_progress, sessions)
    for (const sub of ['enrolledClasses', 'study_states', 'class_progress', 'sessions']) {
      const snap = await db.collection(`users/${t.uid}/${sub}`).get()
      if (snap.empty) continue
      const batch = db.batch()
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    // 3) Remove from each class's members subcollection + decrement studentCount + remove from studentIds
    for (const classId of t.enrolledClasses) {
      const classRef = db.doc(`classes/${classId}`)
      const memberRef = classRef.collection('members').doc(t.uid)
      if ((await memberRef.get()).exists) {
        await memberRef.delete()
      }
      await classRef.update({
        studentIds: FieldValue.arrayRemove(t.uid),
        studentCount: FieldValue.increment(-1),
      }).catch(err => {
        console.warn(`    (class ${classId} update: ${err.message})`)
      })
    }

    // 4) Delete user doc
    await db.doc(`users/${t.uid}`).delete()

    // 5) Delete Auth user (last — so if any of above fails we still have a recoverable identity)
    await auth.deleteUser(t.uid).catch(err => {
      // If user already deleted, ignore
      if (err.code !== 'auth/user-not-found') throw err
    })

    usersDeleted++
    console.log(`  ✓ ${t.email}`)
  } catch (err) {
    console.error(`  ✗ ${t.email}: ${err.message}`)
    errors++
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Done. ${usersDeleted} users deleted, ${attemptsDeleted} attempts deleted, ${errors} errors.`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// --- Remove output file if everything succeeded ---
if (errors === 0 && existsSync('audit/playwright/seeded_accounts.json')) {
  unlinkSync('audit/playwright/seeded_accounts.json')
  console.log('Removed audit/playwright/seeded_accounts.json')
}
