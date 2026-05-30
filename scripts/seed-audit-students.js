#!/usr/bin/env node
/**
 * Seed 50 audit student accounts into vocaboost-879c2.
 *
 * Creates Firebase Auth users, Firestore profiles, enrolls them in either
 * 25WT 2차 TOP OFFLINE or 25WT 2차 CORE OFFLINE, and writes
 * audit/playwright/seeded_accounts.json so the Playwright audit can log in.
 *
 * Usage:
 *   node scripts/seed-audit-students.js                # DRY RUN (no writes)
 *   node scripts/seed-audit-students.js --apply        # actually create
 *   node scripts/seed-audit-students.js --apply --only=TOP    # just TOP class
 *   node scripts/seed-audit-students.js --apply --only=CORE   # just CORE class
 *   node scripts/seed-audit-students.js --apply --resume      # skip existing
 *
 * Prereqs:
 *   - Firebase Admin SDK credentials. Either:
 *       * GOOGLE_APPLICATION_CREDENTIALS env var pointing at a service-account.json, OR
 *       * gcloud auth application-default login (writes ADC to ~/.config/gcloud/), OR
 *       * The legacy path ~/.config/firebase/<email>_application_default_credentials.json
 *   - .env with VITE_FIREBASE_PROJECT_ID set
 *
 * Safety:
 *   - Defaults to DRY RUN. Add --apply to actually mutate Firebase.
 *   - Will not seed if seeded_accounts.json already exists, unless --resume is given.
 *   - Every account gets `auditAccount: true` in its Firestore user doc so
 *     cleanup can safely find them later.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  buildAccountList,
  TOP_JOIN_CODE,
  CORE_JOIN_CODE,
} from './audit-personas.js'

// --- Arg parsing ---
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const RESUME = args.includes('--resume')
const ONLY = args.find(a => a.startsWith('--only='))?.split('=')[1]?.toUpperCase()
const OUTPUT_PATH = 'audit/playwright/seeded_accounts.json'

if (ONLY && !['TOP', 'CORE'].includes(ONLY)) {
  console.error(`Invalid --only=${ONLY}. Must be TOP or CORE.`)
  process.exit(1)
}

// --- Env / project ---
const envPath = '.env'
if (!existsSync(envPath)) {
  console.error('Missing .env. Cannot determine project id.')
  process.exit(1)
}
const env = {}
readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/\r$/, '')
})
const projectId = env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('VITE_FIREBASE_PROJECT_ID not set in .env')
  process.exit(1)
}

// --- Credentials ---
function initAdminApp() {
  // Priority: GOOGLE_APPLICATION_CREDENTIALS env > scripts/serviceAccountKey.json (repo convention)
  // > ./service-account.json > legacy ADC path > applicationDefault()
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ projectId, credential: applicationDefault() })
  }
  for (const path of ['./scripts/serviceAccountKey.json', './service-account.json']) {
    if (existsSync(path)) {
      const sa = JSON.parse(readFileSync(path, 'utf-8'))
      console.log(`Using service account: ${path} (${sa.client_email})`)
      return initializeApp({ projectId, credential: cert(sa) })
    }
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

// --- Resolve class IDs ---
async function resolveClassIds() {
  const classes = {}
  for (const [key, code] of [['TOP', TOP_JOIN_CODE], ['CORE', CORE_JOIN_CODE]]) {
    const snap = await db.collection('classes').where('joinCode', '==', code).get()
    if (snap.empty) {
      throw new Error(`No class found with joinCode=${code} (${key}). Verify the code matches Firestore.`)
    }
    classes[key] = { id: snap.docs[0].id, ...snap.docs[0].data() }
  }
  return classes
}

// --- Per-account operations ---
async function createOrGetAuthUser({ email, password, displayName }) {
  try {
    const existing = await auth.getUserByEmail(email)
    return { uid: existing.uid, created: false }
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err
    const user = await auth.createUser({ email, password, displayName, emailVerified: true })
    return { uid: user.uid, created: true }
  }
}

async function setUserProfile(uid, account) {
  await db.doc(`users/${uid}`).set({
    email: account.email,
    displayName: account.displayName,
    role: 'student',
    profile: { displayName: account.displayName, school: 'AuditPersonaTest', avatarUrl: '' },
    stats: { totalWordsLearned: 0 },
    challenges: { history: [] },
    settings: {
      weeklyGoal: 100,
      useUnifiedQueue: false,
      primaryFocusListId: null,
      primaryFocusClassId: null,
    },
    // Audit-only markers — cleanup script keys on these.
    auditAccount: true,
    auditPersona: account.personaId,
    auditTargetClass: account.targetClass,
    auditSeededAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

async function enrollInClass(uid, classDoc) {
  const classRef = db.doc(`classes/${classDoc.id}`)
  const memberRef = classRef.collection('members').doc(uid)

  const existing = await memberRef.get()
  if (existing.exists) {
    return { alreadyEnrolled: true }
  }

  await memberRef.set({
    studentId: uid,
    joinedAt: FieldValue.serverTimestamp(),
    auditAccount: true,
  })

  await classRef.update({
    studentIds: FieldValue.arrayUnion(uid),
    studentCount: FieldValue.increment(1),
  })

  await db.doc(`users/${uid}/enrolledClasses/${classDoc.id}`).set({
    classId: classDoc.id,
    className: classDoc.name || null,
    joinedAt: FieldValue.serverTimestamp(),
    auditAccount: true,
  })

  return { enrolled: true }
}

// --- Pre-check: existing output file ---
if (existsSync(OUTPUT_PATH) && APPLY && !RESUME) {
  console.error(`Refusing to overwrite ${OUTPUT_PATH}. Add --resume to skip already-seeded accounts.`)
  console.error('Or delete the file first if you want a fresh seed.')
  process.exit(1)
}

// --- Build & summarize ---
const accounts = buildAccountList().filter(a => !ONLY || a.targetClass === ONLY)
const topCount = accounts.filter(a => a.targetClass === 'TOP').length
const coreCount = accounts.filter(a => a.targetClass === 'CORE').length

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Audit student seed plan`)
console.log(`  Project:  ${projectId}`)
console.log(`  Total:    ${accounts.length} accounts (${topCount} TOP, ${coreCount} CORE)`)
console.log(`  Apply:    ${APPLY ? 'YES — will mutate Firebase' : 'NO (dry run; add --apply)'}`)
console.log(`  Resume:   ${RESUME}`)
console.log(`  Filter:   ${ONLY || 'both classes'}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// --- Dry run preview ---
if (!APPLY) {
  console.log('\nFirst 5 accounts (preview):')
  for (const a of accounts.slice(0, 5)) {
    console.log(`  ${a.email}  | ${a.personaLabel}  → ${a.targetClass}`)
  }
  console.log('\nLast 5:')
  for (const a of accounts.slice(-5)) {
    console.log(`  ${a.email}  | ${a.personaLabel}  → ${a.targetClass}`)
  }
  console.log('\nAdd --apply to actually create accounts.')
  process.exit(0)
}

// --- Apply ---
let classes
try {
  console.log('\nResolving class IDs from joinCodes...')
  classes = await resolveClassIds()
  console.log(`  TOP  → ${classes.TOP.id} ("${classes.TOP.name}")`)
  console.log(`  CORE → ${classes.CORE.id} ("${classes.CORE.name}")`)
} catch (err) {
  console.error(`\nFailed to resolve classes: ${err.message}`)
  console.error('Verify the joinCodes in scripts/audit-personas.js match the current Firestore docs.')
  process.exit(1)
}

const results = []
let created = 0, existing = 0, errors = 0

for (const account of accounts) {
  try {
    const { uid, created: wasCreated } = await createOrGetAuthUser(account)
    await setUserProfile(uid, account)
    const enrollment = await enrollInClass(uid, classes[account.targetClass])
    results.push({
      ...account,
      uid,
      created: wasCreated,
      enrollment,
    })
    if (wasCreated) created++; else existing++
    const tag = wasCreated ? 'CREATED' : 'EXISTS '
    console.log(`  ${tag} ${account.email}  → ${account.targetClass}/${classes[account.targetClass].id.slice(0, 8)}`)
  } catch (err) {
    console.error(`  ERROR   ${account.email}: ${err.message}`)
    results.push({ ...account, error: err.message })
    errors++
  }
}

// --- Output ---
mkdirSync('audit/playwright', { recursive: true })
const output = {
  version: 1,
  projectId,
  seededAt: new Date().toISOString(),
  totalAccounts: results.length,
  classes: {
    TOP: { id: classes.TOP.id, name: classes.TOP.name || null, joinCode: TOP_JOIN_CODE },
    CORE: { id: classes.CORE.id, name: classes.CORE.name || null, joinCode: CORE_JOIN_CODE },
  },
  accounts: results,
}
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Summary: ${created} created, ${existing} already existed, ${errors} errors`)
console.log(`Output:  ${OUTPUT_PATH}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('\nNext steps:')
console.log('  1. Inspect audit/playwright/seeded_accounts.json (gitignored).')
console.log('  2. Verify classes in the Veterans admin gradebook have 25 new "Audit ..." students each.')
console.log('  3. Run the Playwright audit (see audit/playwright/BATCH_ORCHESTRATION.md).')
console.log('  4. After the audit, run: node scripts/cleanup-audit-students.js --apply')
