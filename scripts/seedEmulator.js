/**
 * Seed Script for Firebase Emulator
 *
 * Creates test data for simulation testing:
 * - Test teacher and student users
 * - A class with student enrolled
 * - Two word lists (3200 and 500 words)
 * - Assignment settings
 *
 * Usage:
 *   1. Start emulator: firebase emulators:start
 *   2. Run seed: npm run seed
 */

import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Connect to emulators via environment variables
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

// Initialize Firebase Admin (no credentials needed for emulator)
const app = initializeApp({ projectId: 'vocaboost-879c2' })
const auth = getAuth(app)
const db = getFirestore(app)

console.log('🔧 Connected to Firebase Emulators (Admin SDK)')

// Test user credentials
const TEACHER = {
  email: 'teacher@test.com',
  password: 'test123',
  displayName: 'Test Teacher'
}

const STUDENT = {
  email: 'student@test.com',
  password: 'test123',
  displayName: 'Test Student'
}

// Word generation helpers
const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb']
const PREFIXES = ['pre', 'un', 'dis', 'mis', 're', 'over', 'under', 'out', 'sub', 'super']
const ROOTS = ['duct', 'ject', 'port', 'scrib', 'spec', 'vert', 'voc', 'cred', 'dict', 'fac', 'fer', 'graph', 'log', 'mit', 'pend', 'rupt', 'struct', 'tract', 'vid', 'vol']
const SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'ity', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'al', 'ly', 'er', 'or', 'ist', 'ism']

function generateWord(index) {
  const prefix = PREFIXES[index % PREFIXES.length]
  const root = ROOTS[index % ROOTS.length]
  const suffix = SUFFIXES[index % SUFFIXES.length]

  // Create varied word patterns
  let wordText
  if (index % 4 === 0) {
    wordText = `${prefix}${root}`
  } else if (index % 4 === 1) {
    wordText = `${root}${suffix}`
  } else if (index % 4 === 2) {
    wordText = `${prefix}${root}${suffix}`
  } else {
    wordText = `${root}${suffix}s`
  }

  const pos = PARTS_OF_SPEECH[index % PARTS_OF_SPEECH.length]

  return {
    word: wordText,
    definition: `Definition for ${wordText} (word #${index + 1}): A ${pos} meaning something related to ${root}.`,
    partOfSpeech: pos,
    sampleSentence: `The ${wordText} was used in a sentence to demonstrate its meaning.`,
    definitions: {
      ko: `${wordText}의 한국어 정의 #${index + 1}`
    },
    wordIndex: index,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
}

async function createUser(userData) {
  try {
    // Create user in Auth emulator
    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      displayName: userData.displayName
    })

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: userData.email,
      displayName: userData.displayName,
      role: userData.email.includes('teacher') ? 'teacher' : 'student',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    console.log(`✅ Created user: ${userData.email} (${userRecord.uid})`)
    return userRecord
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log(`ℹ️  User already exists: ${userData.email}`)
      // Get existing user
      const existingUser = await auth.getUserByEmail(userData.email)
      return existingUser
    }
    throw error
  }
}

async function createWordList(listId, title, wordCount, ownerId) {
  console.log(`📝 Creating list "${title}" with ${wordCount} words...`)

  // Create list document
  await db.collection('lists').doc(listId).set({
    title,
    description: `Test list with ${wordCount} words for simulation testing`,
    ownerId,
    wordCount,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })

  // Create words in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500
  let created = 0

  while (created < wordCount) {
    const batch = db.batch()
    const batchEnd = Math.min(created + BATCH_SIZE, wordCount)

    for (let i = created; i < batchEnd; i++) {
      const wordData = generateWord(i)
      const wordRef = db.collection('lists').doc(listId).collection('words').doc()
      batch.set(wordRef, wordData)
    }

    await batch.commit()
    created = batchEnd
    console.log(`   ... ${created}/${wordCount} words created`)
  }

  console.log(`✅ Created list: ${title}`)
  return listId
}

async function createClass(classId, teacherId, studentId, listIds) {
  console.log(`🏫 Creating class...`)

  // Build assignments object
  const assignments = {}
  for (const listId of listIds) {
    assignments[listId] = {
      assignedAt: Timestamp.now(),
      pace: 80, // 80 words per day
      studyDaysPerWeek: 5,
      passThreshold: 95,
      testSizeNew: 15,
      testSizeReview: 30,
      testOptionsCount: 4,
      testMode: 'mcq',
      weeklyPace: 400 // 80 * 5 days
    }
  }

  // Create class document
  await db.collection('classes').doc(classId).set({
    name: 'Simulation Test Class',
    description: 'Class for automated simulation testing',
    teacherId,
    joinCode: 'TEST123',
    assignments,
    assignedLists: listIds,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  })

  // Add student as member
  await db.collection('classes').doc(classId).collection('members').doc(studentId).set({
    joinedAt: Timestamp.now(),
    role: 'student'
  })

  // Update student's enrolledClasses map (matches app's expected structure)
  await db.collection('users').doc(studentId).set({
    enrolledClasses: {
      [classId]: {
        joinedAt: Timestamp.now()
      }
    }
  }, { merge: true })

  console.log(`✅ Created class with ${listIds.length} assigned lists`)
  return classId
}

async function main() {
  console.log('\n🚀 Starting seed process...\n')

  try {
    // Create users
    const teacher = await createUser(TEACHER)
    const student = await createUser(STUDENT)

    // Create word lists
    const list1Id = 'sim-list-3200'
    const list2Id = 'sim-list-500'

    await createWordList(list1Id, 'SAT Vocabulary (3200 words)', 3200, teacher.uid)
    await createWordList(list2Id, 'Core Vocabulary (500 words)', 500, teacher.uid)

    // Create class with assignments
    await createClass('sim-class-001', teacher.uid, student.uid, [list1Id, list2Id])

    console.log('\n✅ Seed completed successfully!\n')
    console.log('📋 Login credentials:')
    console.log(`   Teacher: ${TEACHER.email} / ${TEACHER.password}`)
    console.log(`   Student: ${STUDENT.email} / ${STUDENT.password}`)
    console.log('\n🎮 Start your app and login as student to begin simulation.\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  }
}

main()
