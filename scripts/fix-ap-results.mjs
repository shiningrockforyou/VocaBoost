import { readFileSync } from 'fs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credPath = `${process.env.APPDATA || process.env.HOME + '/.config'}/firebase/dmchwang_gmail_com_application_default_credentials.json`
process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath

const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/\r$/, '')
})

const app = initializeApp({ projectId: env.VITE_FIREBASE_PROJECT_ID })
const db = getFirestore(app)

const snap = await db.collection('ap_test_results').get()
console.log(`Found ${snap.size} test results. Deleting all...\n`)

const batch = db.batch()
snap.docs.forEach(doc => {
  console.log(`  DELETE ${doc.id} (userId=${doc.data().userId})`)
  batch.delete(doc.ref)
})
await batch.commit()

console.log(`\nDone. Deleted ${snap.size} results.`)
process.exit(0)
