#!/usr/bin/env node
/**
 * One-shot repair for the 50 audit students seeded before the
 * enrollment-write-path bug was discovered.
 *
 * Bug: seed-audit-students.js originally wrote enrollment to a SUBCOLLECTION
 * (users/{uid}/enrolledClasses/{classId}) but the app reads enrollment from
 * a MAP on the user doc (userData.enrolledClasses). The audit students
 * succeeded at login but saw a "join your first class" empty state.
 *
 * This script patches each seeded student's user doc to add the map field
 * pointing at the right class. Safe to re-run.
 *
 * Usage:
 *   node scripts/repair-audit-enrollments.js              # dry run
 *   node scripts/repair-audit-enrollments.js --apply      # actually write
 */

import { readFileSync, existsSync } from 'fs'
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')

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

function initAdminApp() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ projectId, credential: applicationDefault() })
  }
  for (const path of ['./scripts/serviceAccountKey.json', './service-account.json']) {
    if (existsSync(path)) {
      const sa = JSON.parse(readFileSync(path, 'utf-8'))
      return initializeApp({ projectId, credential: cert(sa) })
    }
  }
  return initializeApp({ projectId, credential: applicationDefault() })
}

const app = initAdminApp()
const db = getFirestore(app)

const seeded = JSON.parse(readFileSync('audit/playwright/seeded_accounts.json', 'utf-8'))
console.log(`Loaded seeded_accounts.json: ${seeded.totalAccounts} accounts`)
console.log(`TOP class:  ${seeded.classes.TOP.id} ("${seeded.classes.TOP.name}")`)
console.log(`CORE class: ${seeded.classes.CORE.id} ("${seeded.classes.CORE.name}")`)
console.log(`Apply: ${APPLY ? 'YES' : 'NO (dry run; add --apply)'}\n`)

let repaired = 0
let alreadyOk = 0
let errors = 0

for (const account of seeded.accounts) {
  if (!account.uid) continue
  const classInfo = seeded.classes[account.targetClass]
  if (!classInfo) {
    console.error(`  ✗ ${account.email}: unknown targetClass ${account.targetClass}`)
    errors++
    continue
  }

  try {
    const userRef = db.doc(`users/${account.uid}`)
    const snap = await userRef.get()
    if (!snap.exists) {
      console.error(`  ✗ ${account.email}: user doc missing`)
      errors++
      continue
    }
    const data = snap.data()
    const enrolledMap = data.enrolledClasses || {}
    if (enrolledMap[classInfo.id]) {
      alreadyOk++
      console.log(`  = ${account.email}: already in map for ${account.targetClass}`)
      continue
    }

    if (!APPLY) {
      console.log(`  + ${account.email}: would add enrolledClasses.${classInfo.id} = { name: "${classInfo.name}" }`)
      repaired++
      continue
    }

    await userRef.set({
      enrolledClasses: {
        [classInfo.id]: {
          name: classInfo.name || null,
          joinedAt: FieldValue.serverTimestamp(),
        },
      },
    }, { merge: true })
    repaired++
    console.log(`  + ${account.email}: repaired ${account.targetClass}`)
  } catch (err) {
    console.error(`  ✗ ${account.email}: ${err.message}`)
    errors++
  }
}

console.log(`\nSummary: ${repaired} ${APPLY ? 'repaired' : 'would repair'}, ${alreadyOk} already correct, ${errors} errors`)
