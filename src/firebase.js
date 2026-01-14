import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Validate that all required environment variables are present
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missingVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName]
)

if (missingVars.length > 0) {
  console.error(
    'Missing required Firebase environment variables:',
    missingVars.join(', ')
  )
  console.error(
    'Please ensure your .env file exists and contains all required variables.'
  )
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

// Connect to Firebase Emulators in simulation mode
// Only activates when VITE_USE_EMULATOR=true in .env.local
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
    connectStorageEmulator(storage, 'localhost', 9199)
    console.log('🔧 Firebase Emulators connected (Firestore: 8080, Auth: 9099, Storage: 9199)')
  } catch (error) {
    // Emulators may already be connected (hot reload)
    console.warn('Firebase emulator connection skipped:', error.message)
  }
}

export default app


