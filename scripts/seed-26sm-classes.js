#!/usr/bin/env node
/**
 * Seed 28 26SM SAT classes into vocaboost-879c2 and assign the right
 * vocab list to each based on the two-tier mapping:
 *
 *   - "Base Camp" classes (Inter / Bridge / Core / 미주 Inter / 유라시아 Core)
 *     → assigned to "26SM VZIP 3K (Base Camp, 1200)"  (1200-word list)
 *     → defaults: pace 60, testSizeNew 25, passThreshold 90  (CORE-style)
 *
 *   - "Ascent" classes (Adv / Final / Top / 미주 Adv / 유라시아 Top)
 *     → assigned to "26SM VZIP 3K (Ascent, 1600)"  (1600-word list)
 *     → defaults: pace 80, testSizeNew 30, passThreshold 92  (TOP-style)
 *
 * Weekend-only classes ("[주말]") get studyDaysPerWeek=2; all others default
 * to studyDaysPerWeek=5. Owner is veterans@vocaboost.com.
 *
 * Usage:
 *   node scripts/seed-26sm-classes.js            # DRY RUN
 *   node scripts/seed-26sm-classes.js --apply    # actually create
 *   node scripts/seed-26sm-classes.js --apply --skip-existing
 *
 * Idempotency: existing classes are detected by exact name match; the
 * default behavior errors on collision. Pass --skip-existing to continue.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const SKIP_EXISTING = args.includes('--skip-existing')
const OUTPUT_PATH = 'audit/playwright/seeded_26sm_classes.json'

// --- Init ---
if (!existsSync('./scripts/serviceAccountKey.json')) {
  console.error('Missing ./scripts/serviceAccountKey.json'); process.exit(1)
}
const sa = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf-8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()
const auth = getAuth()

const OWNER_EMAIL = 'veterans@vocaboost.com'

// --- The 28 classes to create (in user-specified order) ---
const CLASSES = [
  { name: '26SM SAT Inter A1',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter A2',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter A3',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter B1',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter B2',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter B3',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter B4',                  tier: 'BASE_CAMP' },
  { name: '26SM SAT Inter E [English only]',    tier: 'BASE_CAMP' },
  { name: '26SM SAT Adv A1',                    tier: 'ASCENT' },
  { name: '26SM SAT Adv A2',                    tier: 'ASCENT' },
  { name: '26SM SAT Adv B1',                    tier: 'ASCENT' },
  { name: '26SM SAT Adv B2',                    tier: 'ASCENT' },
  { name: '26SM SAT Adv E [English only]',      tier: 'ASCENT' },
  { name: '26SM SAT Final A',                   tier: 'ASCENT' },
  { name: '26SM SAT Final B',                   tier: 'ASCENT' },
  { name: '26SM SAT Bridge (TOP)',              tier: 'BASE_CAMP' },
  { name: '26SM SAT Bridge (CORE)',             tier: 'BASE_CAMP' },
  { name: '26SM [온] Sat Adv. O',               tier: 'ASCENT' },
  { name: '26SM 미주 SAT Bridge',                tier: 'BASE_CAMP' },
  { name: '26SM 미주 SAT Inter.',                tier: 'BASE_CAMP' },
  { name: '26SM 유라시아 SAT Core',              tier: 'BASE_CAMP' },
  { name: '26SM 미주 SAT Adv.',                  tier: 'ASCENT' },
  { name: '26SM 유라시아 SAT Top',               tier: 'ASCENT' },
  { name: '26SM 미주 SAT Final',                 tier: 'ASCENT' },
  { name: '26SM 미주 SAT Inter. [한국어 혼용]',  tier: 'BASE_CAMP' },
  { name: '26SM [주말] SAT Core',                tier: 'BASE_CAMP' },
  { name: '26SM 미주 SAT Adv. [한국어 혼용]',    tier: 'ASCENT' },
  { name: '26SM [주말] SAT Top',                 tier: 'ASCENT' },
]

// --- Per-tier assignment settings (matched to existing TOP/CORE class defaults) ---
const TIER_DEFAULTS = {
  BASE_CAMP: {
    listTitle: '26SM VZIP 3K (Base Camp, 1200)',
    pace: 60,
    testSizeNew: 25,
    passThreshold: 90,
  },
  ASCENT: {
    listTitle: '26SM VZIP 3K (Ascent, 1600)',
    pace: 80,
    testSizeNew: 30,
    passThreshold: 92,
  },
}

// Common assignment defaults shared by both tiers
const COMMON_ASSIGNMENT = {
  testMode: 'typed',
  testOptionsCount: 4,
  reviewTestType: 'mcq',
  reviewTestSizeMin: 20,
  reviewTestSizeMax: 30,
}

// --- joinCode generation ---
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // skip I/O/0/1 to avoid confusion
function generateJoinCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return s
}

async function main() {
  // Resolve owner UID
  const owner = await auth.getUserByEmail(OWNER_EMAIL)
  console.log(`Owner: ${OWNER_EMAIL} → ${owner.uid} (${owner.displayName})`)

  // Resolve list IDs by title
  const listsSnap = await db.collection('lists').get()
  const listByTitle = {}
  for (const d of listsSnap.docs) {
    listByTitle[d.data().title] = { id: d.id, ...d.data() }
  }
  for (const tier of Object.values(TIER_DEFAULTS)) {
    if (!listByTitle[tier.listTitle]) {
      console.error(`✗ List not found: "${tier.listTitle}"`)
      process.exit(1)
    }
  }
  console.log(`Base Camp list:  ${listByTitle[TIER_DEFAULTS.BASE_CAMP.listTitle].id} (${listByTitle[TIER_DEFAULTS.BASE_CAMP.listTitle].wordCount} words)`)
  console.log(`Ascent list:     ${listByTitle[TIER_DEFAULTS.ASCENT.listTitle].id} (${listByTitle[TIER_DEFAULTS.ASCENT.listTitle].wordCount} words)`)

  // Collect existing joinCodes and class names
  const existingClassesSnap = await db.collection('classes').get()
  const existingCodes = new Set()
  const existingNames = new Map()  // name -> id
  for (const d of existingClassesSnap.docs) {
    if (d.data().joinCode) existingCodes.add(d.data().joinCode)
    if (d.data().name) existingNames.set(d.data().name, d.id)
  }

  console.log(`\nPlan: ${CLASSES.length} classes`)
  console.log(`Existing joinCodes in db: ${existingCodes.size}`)
  console.log(`Apply: ${APPLY ? 'YES' : 'NO (dry run; add --apply)'}\n`)

  const results = []
  let created = 0, skipped = 0, errors = 0

  for (const cls of CLASSES) {
    const tier = TIER_DEFAULTS[cls.tier]
    const list = listByTitle[tier.listTitle]
    const isWeekend = cls.name.includes('[주말]')
    const studyDaysPerWeek = isWeekend ? 2 : 5

    // Generate a unique joinCode
    let joinCode
    do { joinCode = generateJoinCode() } while (existingCodes.has(joinCode))
    existingCodes.add(joinCode)

    const assignment = {
      ...COMMON_ASSIGNMENT,
      pace: tier.pace,
      testSizeNew: tier.testSizeNew,
      passThreshold: tier.passThreshold,
      studyDaysPerWeek,
      assignedAt: APPLY ? Timestamp.now() : 'serverTimestamp',
    }

    // Check collision
    if (existingNames.has(cls.name)) {
      if (SKIP_EXISTING) {
        console.log(`  SKIP    "${cls.name}" already exists (${existingNames.get(cls.name)})`)
        results.push({ ...cls, joinCode: null, listId: list.id, skipped: true, existingId: existingNames.get(cls.name) })
        skipped++
        continue
      }
      console.error(`  ✗ "${cls.name}" already exists. Pass --skip-existing to skip.`)
      errors++
      continue
    }

    if (!APPLY) {
      console.log(`  [DRY]   "${cls.name}"  → list=${list.id.slice(0,8)}  pace=${tier.pace}  size=${tier.testSizeNew}  threshold=${tier.passThreshold}  days/wk=${studyDaysPerWeek}  joinCode=${joinCode}`)
      results.push({ ...cls, joinCode, listId: list.id, listTitle: list.title, assignment, willCreate: true })
      created++
      continue
    }

    try {
      const classDoc = {
        name: cls.name,
        joinCode,
        ownerTeacherId: owner.uid,
        studentIds: [],
        studentCount: 0,
        assignedLists: [list.id],
        mandatoryLists: [],
        assignments: { [list.id]: assignment },
        settings: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
      const ref = await db.collection('classes').add(classDoc)
      console.log(`  CREATED "${cls.name}"  id=${ref.id}  code=${joinCode}  list=${list.title.slice(0,30)}...`)
      results.push({ ...cls, id: ref.id, joinCode, listId: list.id, listTitle: list.title, assignment })
      created++
    } catch (e) {
      console.error(`  ✗ "${cls.name}": ${e.message}`)
      results.push({ ...cls, error: e.message })
      errors++
    }
  }

  console.log(`\nSummary: ${created} ${APPLY ? 'created' : 'would create'}, ${skipped} skipped, ${errors} errors`)

  if (APPLY) {
    writeFileSync(OUTPUT_PATH, JSON.stringify({
      seededAt: new Date().toISOString(),
      ownerEmail: OWNER_EMAIL,
      ownerUid: owner.uid,
      lists: {
        baseCamp: listByTitle[TIER_DEFAULTS.BASE_CAMP.listTitle],
        ascent: listByTitle[TIER_DEFAULTS.ASCENT.listTitle],
      },
      tierDefaults: TIER_DEFAULTS,
      commonAssignment: COMMON_ASSIGNMENT,
      classes: results,
    }, null, 2))
    console.log(`Output: ${OUTPUT_PATH}`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
