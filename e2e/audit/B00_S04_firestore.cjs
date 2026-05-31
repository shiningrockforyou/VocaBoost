/**
 * S04: Capture canonical word lists from Firestore for TOP and CORE classes.
 * Run from /app: node e2e/audit/B00_S04_firestore.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const fs = require('fs')

const sa = require('/app/scripts/serviceAccountKey.json')
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const TOP_CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const CORE_CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B00'

async function getClassLists(classId, label) {
  const result = { classId, label, lists: [] }
  const listPaths = ['lists', 'word_lists', 'vocabLists']

  for (const collName of listPaths) {
    try {
      const snap1 = await db.collection(collName).where('classId', '==', classId).get()
      const snap2 = await db.collection(collName).where('classIds', 'array-contains', classId).get()

      // Deduplicate by doc id
      const docMap = new Map()
      for (const d of [...snap1.docs, ...snap2.docs]) docMap.set(d.id, d)
      const docs = [...docMap.values()]

      if (docs.length > 0) {
        console.log(`Found ${docs.length} lists in '${collName}' for ${label}`)

        for (const doc of docs) {
          const listData = { id: doc.id, ...doc.data(), words: [] }
          delete listData.words // will repopulate below

          // Try words subcollection (ordered by position)
          let wordsSnap
          try {
            wordsSnap = await db.collection(collName).doc(doc.id).collection('words').orderBy('position').get()
          } catch (e) {
            wordsSnap = await db.collection(collName).doc(doc.id).collection('words').get()
          }

          if (!wordsSnap.empty) {
            listData.words = wordsSnap.docs.map(w => ({ id: w.id, ...w.data() }))
          } else {
            // Try 'items' subcollection
            const itemsSnap = await db.collection(collName).doc(doc.id).collection('items').get()
            if (!itemsSnap.empty) {
              listData.words = itemsSnap.docs.map(w => ({ id: w.id, ...w.data() }))
            }
          }

          console.log(`  List "${listData.title || doc.id}": ${listData.words.length} words`)
          result.lists.push(listData)
        }
        break // found in this collection
      }
    } catch (e) {
      // collection might not exist, skip
      console.log(`  Collection '${collName}' query error: ${e.message}`)
    }
  }

  return result
}

async function main() {
  console.log('=== S04: Firestore List Capture ===')

  // First, enumerate all lists to understand structure
  console.log('\nEnumerating all lists...')
  const allListsSnap = await db.collection('lists').limit(30).get()
  console.log(`Total lists in 'lists' collection: ${allListsSnap.size}`)

  const allLists = allListsSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    classIds: d.data().classIds,
    classId: d.data().classId,
    wordCount: d.data().wordCount,
    pace: d.data().pace,
    studyDaysPerWeek: d.data().studyDaysPerWeek,
    retakeThreshold: d.data().retakeThreshold,
  }))

  console.log('All lists:')
  allLists.forEach(l => console.log(`  [${l.id}] "${l.title}" classIds=${JSON.stringify(l.classIds)} wordCount=${l.wordCount}`))

  // Find which lists are assigned to TOP and CORE classes
  const topLists = allLists.filter(l =>
    (Array.isArray(l.classIds) && l.classIds.includes(TOP_CLASS_ID)) ||
    l.classId === TOP_CLASS_ID
  )
  const coreLists = allLists.filter(l =>
    (Array.isArray(l.classIds) && l.classIds.includes(CORE_CLASS_ID)) ||
    l.classId === CORE_CLASS_ID
  )

  console.log(`\nTOP class lists: ${topLists.length}`)
  console.log(`CORE class lists: ${coreLists.length}`)

  // Get words for TOP active list
  let topActiveList = null
  let coreActiveList = null

  if (topLists.length > 0) {
    const topDoc = topLists[0]
    console.log(`\nFetching words for TOP list: "${topDoc.title}" (${topDoc.id})`)

    // Try words subcollection
    let wordsSnap
    try {
      wordsSnap = await db.collection('lists').doc(topDoc.id).collection('words').orderBy('position').limit(50).get()
    } catch (e) {
      wordsSnap = await db.collection('lists').doc(topDoc.id).collection('words').limit(50).get()
    }

    console.log(`  Words found: ${wordsSnap.size}`)

    if (!wordsSnap.empty) {
      const words = wordsSnap.docs.map(w => ({ id: w.id, ...w.data() }))
      // Log first few for inspection
      words.slice(0, 3).forEach(w => console.log(`  Sample word: ${JSON.stringify({ word: w.word, definition_en: w.definition_en, definition_ko: w.definition_ko })}`))

      topActiveList = {
        id: topDoc.id,
        title: topDoc.title,
        wordCount: topDoc.wordCount || words.length,
        classIds: [TOP_CLASS_ID],
        pace: topDoc.pace,
        studyDaysPerWeek: topDoc.studyDaysPerWeek,
        retakeThreshold: topDoc.retakeThreshold,
        words: words.slice(0, 50), // capture up to 50 words
      }
    }
  }

  if (coreLists.length > 0) {
    const coreDoc = coreLists[0]
    console.log(`\nFetching words for CORE list: "${coreDoc.title}" (${coreDoc.id})`)

    let wordsSnap
    try {
      wordsSnap = await db.collection('lists').doc(coreDoc.id).collection('words').orderBy('position').limit(50).get()
    } catch (e) {
      wordsSnap = await db.collection('lists').doc(coreDoc.id).collection('words').limit(50).get()
    }

    console.log(`  Words found: ${wordsSnap.size}`)

    if (!wordsSnap.empty) {
      const words = wordsSnap.docs.map(w => ({ id: w.id, ...w.data() }))
      words.slice(0, 3).forEach(w => console.log(`  Sample word: ${JSON.stringify({ word: w.word, definition_en: w.definition_en, definition_ko: w.definition_ko })}`))

      coreActiveList = {
        id: coreDoc.id,
        title: coreDoc.title,
        wordCount: coreDoc.wordCount || words.length,
        classIds: [CORE_CLASS_ID],
        pace: coreDoc.pace,
        studyDaysPerWeek: coreDoc.studyDaysPerWeek,
        retakeThreshold: coreDoc.retakeThreshold,
        words: words.slice(0, 50),
      }
    }
  }

  // If no class-scoped lists found, try using the class doc itself to find assigned lists
  if (!topActiveList || !coreActiveList) {
    console.log('\nNo class-scoped lists found. Checking class docs for assigned list references...')

    const topClassDoc = await db.collection('classes').doc(TOP_CLASS_ID).get()
    const coreClassDoc = await db.collection('classes').doc(CORE_CLASS_ID).get()

    if (topClassDoc.exists) {
      const data = topClassDoc.data()
      console.log(`TOP class doc keys: ${Object.keys(data).join(', ')}`)
      console.log(`TOP class listId(s): ${data.listId || data.listIds || 'none'}`)
    }
    if (coreClassDoc.exists) {
      const data = coreClassDoc.data()
      console.log(`CORE class doc keys: ${Object.keys(data).join(', ')}`)
      console.log(`CORE class listId(s): ${data.listId || data.listIds || 'none'}`)
    }
  }

  // Save the evidence
  const evidence = {
    allListsSample: allLists,
    topActiveList,
    coreActiveList,
    topClassId: TOP_CLASS_ID,
    coreClassId: CORE_CLASS_ID,
  }

  fs.writeFileSync(
    `${EVIDENCE_DIR}/B00_S04_firestore_lists.json`,
    JSON.stringify(evidence, null, 2)
  )
  console.log(`\nEvidence written to ${EVIDENCE_DIR}/B00_S04_firestore_lists.json`)

  console.log(`\nSUMMARY:`)
  console.log(`  TOP active list: ${topActiveList ? topActiveList.title + ' (' + topActiveList.words.length + ' words)' : 'NOT FOUND'}`)
  console.log(`  CORE active list: ${coreActiveList ? coreActiveList.title + ' (' + coreActiveList.words.length + ' words)' : 'NOT FOUND'}`)

  return { topActiveList, coreActiveList, allLists }
}

main().then(result => {
  fs.writeFileSync('/app/e2e/audit/B00_S04_result.json', JSON.stringify(result, null, 2))
  process.exit(0)
}).catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
