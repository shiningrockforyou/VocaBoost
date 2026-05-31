#!/usr/bin/env node
/**
 * Update the assignment settings for the 28 26SM SAT classes.
 *
 * Reclassifies based on the user's corrected tier definitions:
 *   BRIDGE     — pace 60, Base Camp list
 *   INT/CORE   — pace 80, Base Camp list
 *   ADV        — pace 80, Ascent list   (includes "Top" classes)
 *   FINAL      — pace 100, Ascent list
 *
 * For all classes:
 *   testMode = typed (AI-graded)
 *   reviewTestType = mcq with testOptionsCount = 6
 *
 * Keeps existing class ids, names, joinCodes, ownerTeacherId, studentIds intact.
 * Only updates the assignments map.
 *
 * Usage:
 *   node scripts/update-26sm-classes.js            # DRY RUN
 *   node scripts/update-26sm-classes.js --apply    # actually write
 */

import { readFileSync, existsSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')

if (!existsSync('./scripts/serviceAccountKey.json')) { console.error('Missing service account'); process.exit(1) }
const sa = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf-8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

// --- Tier classification ---
// Match the human-readable name → tier.
const TIER_BY_NAME = {
  // BRIDGE — pace 60
  '26SM SAT Bridge (TOP)':                  'BRIDGE',
  '26SM SAT Bridge (CORE)':                 'BRIDGE',
  '26SM 미주 SAT Bridge':                    'BRIDGE',

  // INT/CORE — pace 80, Base Camp
  '26SM SAT Inter A1':                      'INT_CORE',
  '26SM SAT Inter A2':                      'INT_CORE',
  '26SM SAT Inter A3':                      'INT_CORE',
  '26SM SAT Inter B1':                      'INT_CORE',
  '26SM SAT Inter B2':                      'INT_CORE',
  '26SM SAT Inter B3':                      'INT_CORE',
  '26SM SAT Inter B4':                      'INT_CORE',
  '26SM SAT Inter E [English only]':        'INT_CORE',
  '26SM 미주 SAT Inter.':                    'INT_CORE',
  '26SM 미주 SAT Inter. [한국어 혼용]':      'INT_CORE',
  '26SM 유라시아 SAT Core':                  'INT_CORE',
  '26SM [주말] SAT Core':                    'INT_CORE',

  // ADV — pace 80, Ascent  (includes "Top" classes)
  '26SM SAT Adv A1':                        'ADV',
  '26SM SAT Adv A2':                        'ADV',
  '26SM SAT Adv B1':                        'ADV',
  '26SM SAT Adv B2':                        'ADV',
  '26SM SAT Adv E [English only]':          'ADV',
  '26SM [온] Sat Adv. O':                   'ADV',
  '26SM 미주 SAT Adv.':                      'ADV',
  '26SM 미주 SAT Adv. [한국어 혼용]':        'ADV',
  '26SM 유라시아 SAT Top':                   'ADV',
  '26SM [주말] SAT Top':                     'ADV',

  // FINAL — pace 100, Ascent
  '26SM SAT Final A':                       'FINAL',
  '26SM SAT Final B':                       'FINAL',
  '26SM 미주 SAT Final':                     'FINAL',
}

const TIER_DEFAULTS = {
  BRIDGE:    { pace: 60,  testSizeNew: 25, passThreshold: 90, listTitle: '26SM VZIP 3K (Base Camp, 1200)' },
  INT_CORE:  { pace: 80,  testSizeNew: 30, passThreshold: 92, listTitle: '26SM VZIP 3K (Base Camp, 1200)' },
  ADV:       { pace: 80,  testSizeNew: 30, passThreshold: 92, listTitle: '26SM VZIP 3K (Ascent, 1600)' },
  FINAL:     { pace: 100, testSizeNew: 35, passThreshold: 92, listTitle: '26SM VZIP 3K (Ascent, 1600)' },
}

// Common assignment overrides applied to ALL tiers
const COMMON = {
  testMode: 'typed',           // current day's test is AI-graded typed
  reviewTestType: 'mcq',       // review test is MCQ
  testOptionsCount: 6,         // 6 choices (changed from 4)
  reviewTestSizeMin: 20,
  reviewTestSizeMax: 30,
}

async function main() {
  // Resolve list IDs
  const listsSnap = await db.collection('lists').get()
  const listByTitle = {}
  for (const d of listsSnap.docs) listByTitle[d.data().title] = { id: d.id, ...d.data() }

  // Find all 28 classes (the seeded JSON has the IDs but we also fall back to name lookup)
  const seededPath = 'audit/playwright/seeded_26sm_classes.json'
  let knownIds = []
  if (existsSync(seededPath)) {
    const seeded = JSON.parse(readFileSync(seededPath, 'utf-8'))
    knownIds = seeded.classes.map(c => c.id).filter(Boolean)
  }

  console.log(`Apply: ${APPLY ? 'YES — will mutate Firebase' : 'NO (dry run; add --apply)'}\n`)

  // Counts by tier (for the summary line at the end)
  const tierCounts = { BRIDGE: 0, INT_CORE: 0, ADV: 0, FINAL: 0, UNKNOWN: 0 }
  let updated = 0
  let errors = 0
  let skipped = 0

  for (const [name, tier] of Object.entries(TIER_BY_NAME)) {
    tierCounts[tier]++

    // Look up the class by name
    const snap = await db.collection('classes').where('name', '==', name).get()
    if (snap.empty) {
      console.error(`  ✗ Class not found: "${name}"`)
      errors++
      continue
    }
    if (snap.size > 1) {
      console.error(`  ✗ Multiple classes named "${name}" (${snap.size}). Skipping for safety.`)
      skipped++
      continue
    }

    const classDoc = snap.docs[0]
    const def = TIER_DEFAULTS[tier]
    const list = listByTitle[def.listTitle]
    if (!list) {
      console.error(`  ✗ List "${def.listTitle}" not found for class "${name}"`)
      errors++
      continue
    }

    // Build the new assignment for this class's list.
    // Preserve any existing assignedAt so we don't lose the historical anchor.
    const existing = classDoc.data().assignments?.[list.id] || {}
    const newAssignment = {
      ...existing,
      pace: def.pace,
      testSizeNew: def.testSizeNew,
      passThreshold: def.passThreshold,
      testMode: COMMON.testMode,
      reviewTestType: COMMON.reviewTestType,
      testOptionsCount: COMMON.testOptionsCount,
      reviewTestSizeMin: COMMON.reviewTestSizeMin,
      reviewTestSizeMax: COMMON.reviewTestSizeMax,
      // studyDaysPerWeek: preserve whatever was set at seed time (2 for [주말], 5 otherwise)
      studyDaysPerWeek: existing.studyDaysPerWeek ?? (name.includes('[주말]') ? 2 : 5),
      assignedAt: existing.assignedAt || Timestamp.now(),
    }

    const summary = `[${tier.padEnd(8)}] "${name}"  → pace=${def.pace} size=${def.testSizeNew} threshold=${def.passThreshold} opts=6 days/wk=${newAssignment.studyDaysPerWeek}`

    if (!APPLY) {
      console.log(`  DRY  ${summary}`)
      continue
    }

    try {
      // We re-write the entire assignments map for this list id (single write).
      await classDoc.ref.update({
        assignedLists: Array.from(new Set([...(classDoc.data().assignedLists || []), list.id])),
        [`assignments.${list.id}`]: newAssignment,
        updatedAt: Timestamp.now(),
      })
      console.log(`  OK   ${summary}`)
      updated++
    } catch (e) {
      console.error(`  ✗ "${name}": ${e.message}`)
      errors++
    }
  }

  console.log(`\nTier counts: BRIDGE=${tierCounts.BRIDGE} INT_CORE=${tierCounts.INT_CORE} ADV=${tierCounts.ADV} FINAL=${tierCounts.FINAL}`)
  console.log(`Summary: ${updated} ${APPLY ? 'updated' : 'would update'}, ${skipped} skipped, ${errors} errors`)
  if (!APPLY) console.log(`Add --apply to actually update.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
