/**
 * One-time backfill script to add teacherId and classId to legacy attempts
 * 
 * Run with: node scripts/backfillAttempts.js
 * 
 * Prerequisites:
 * - Firebase Admin SDK initialized
 * - Service account key file
 */

const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json') // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const db = admin.firestore()

async function backfillAttempts() {
  console.log('Starting backfill...')
  
  // Step 1: Build lookup maps
  console.log('Building lookup maps...')
  
  // Get all classes
  const classesSnap = await db.collection('classes').get()
  const classIdToTeacherId = new Map()
  const classIdToListIds = new Map()
  
  classesSnap.docs.forEach(doc => {
    const data = doc.data()
    classIdToTeacherId.set(doc.id, data.ownerTeacherId)
    classIdToListIds.set(doc.id, data.assignedLists || [])
  })
  
  console.log(`Found ${classesSnap.docs.length} classes`)
  
  // Build listId -> classId map (for legacy attempts that don't have classId)
  const listIdToClassId = new Map()
  classIdToListIds.forEach((listIds, classId) => {
    listIds.forEach(listId => {
      // If multiple classes have same list, first one wins (imperfect but reasonable)
      if (!listIdToClassId.has(listId)) {
        listIdToClassId.set(listId, classId)
      }
    })
  })
  
  console.log(`Mapped ${listIdToClassId.size} lists to classes`)
  
  // Step 2: Process attempts in batches
  console.log('Processing attempts...')
  
  let processed = 0
  let updated = 0
  let skipped = 0
  let noClassFound = 0
  
  const batchSize = 500
  let lastDoc = null
  
  while (true) {
    let query = db.collection('attempts')
      .orderBy('submittedAt', 'desc')
      .limit(batchSize)
    
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }
    
    const snap = await query.get()
    
    if (snap.docs.length === 0) break
    
    const writeBatch = db.batch()
    let batchCount = 0
    
    for (const doc of snap.docs) {
      processed++
      const data = doc.data()
      
      // Skip if already has teacherId
      if (data.teacherId) {
        skipped++
        continue
      }
      
      // Try to determine classId
      let classId = data.classId
      
      if (!classId) {
        // Extract listId from testId
        const testIdMatch = (data.testId || '').match(/^test_([^_]+)_/)
        if (testIdMatch) {
          const listId = testIdMatch[1]
          classId = listIdToClassId.get(listId)
        }
      }
      
      if (!classId) {
        noClassFound++
        // Set sentinel values
        writeBatch.update(doc.ref, {
          classId: 'no_class',
          teacherId: 'no_teacher'
        })
        batchCount++
        continue
      }
      
      // Get teacherId from classId
      const teacherId = classIdToTeacherId.get(classId)
      
      if (!teacherId) {
        noClassFound++
        writeBatch.update(doc.ref, {
          classId: classId,
          teacherId: 'no_teacher'
        })
        batchCount++
        continue
      }
      
      // Update with real values
      writeBatch.update(doc.ref, {
        classId: classId,
        teacherId: teacherId
      })
      batchCount++
      updated++
    }
    
    if (batchCount > 0) {
      await writeBatch.commit()
      console.log(`Processed ${processed}, updated ${updated}, skipped ${skipped}, no class: ${noClassFound}`)
    }
    
    lastDoc = snap.docs[snap.docs.length - 1]
  }
  
  console.log('=== BACKFILL COMPLETE ===')
  console.log(`Total processed: ${processed}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (already had teacherId): ${skipped}`)
  console.log(`No class found: ${noClassFound}`)
}

backfillAttempts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })