/**
 * Firestore helpers for the audit:
 * 1. Read-only snapshots via Admin SDK (for "before/after" verification).
 * 2. Route patterns for network fault injection against the Firebase Web SDK.
 *
 * Cardinality of Firebase Web SDK transport:
 * - Listen channel:   POST/GET firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel
 *                     (long-poll / streaming reads)
 * - Write batches:    POST firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel
 * - REST commits:     POST firestore.googleapis.com/v1/projects/<id>/databases/(default)/documents:commit
 * - Auth:             securetoken.googleapis.com, identitytoolkit.googleapis.com
 * - Functions calls:  region.cloudfunctions.net or *.run.app
 *
 * Capture a HAR of one happy submit (B02 S01) to confirm which transport this build uses
 * before relying on a specific pattern.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'

const SA_PATHS = ['./scripts/serviceAccountKey.json', './service-account.json']

let _admin = null
function admin() {
  if (_admin) return _admin
  if (getApps().length === 0) {
    const saPath = SA_PATHS.find(existsSync)
    if (!saPath) throw new Error('Service account JSON not found at ./scripts/serviceAccountKey.json')
    const sa = JSON.parse(readFileSync(saPath, 'utf-8'))
    initializeApp({ credential: cert(sa) })
  }
  _admin = getFirestore()
  return _admin
}

/**
 * Snapshot a single doc. Returns the data + a wall-clock timestamp.
 */
export async function snapshotDoc(path) {
  const db = admin()
  const snap = await db.doc(path).get()
  return {
    path,
    exists: snap.exists,
    data: snap.exists ? snap.data() : null,
    capturedAt: new Date().toISOString(),
  }
}

/**
 * Snapshot every doc in a collection group filtered by a single where clause.
 */
export async function snapshotCollectionWhere(collectionGroup, field, op, value) {
  const db = admin()
  const snap = await db.collectionGroup(collectionGroup).where(field, op, value).get()
  return {
    collectionGroup,
    filter: { field, op, value },
    capturedAt: new Date().toISOString(),
    docs: snap.docs.map(d => ({ id: d.id, path: d.ref.path, data: d.data() })),
  }
}

/**
 * Common snapshot bundles for a single student's full state.
 * One call returns everything a B22 day-N verification needs.
 */
export async function snapshotStudentState(uid) {
  const [user, enrolledClasses, studyStates, classProgress, sessionStates, attempts] = await Promise.all([
    snapshotDoc(`users/${uid}`),
    admin().collection(`users/${uid}/enrolledClasses`).get().then(s => s.docs.map(d => ({ id: d.id, data: d.data() }))),
    admin().collection(`users/${uid}/study_states`).get().then(s => s.docs.map(d => ({ id: d.id, data: d.data() }))),
    admin().collection(`users/${uid}/class_progress`).get().then(s => s.docs.map(d => ({ id: d.id, data: d.data() }))),
    admin().collection(`users/${uid}/session_states`).get().then(s => s.docs.map(d => ({ id: d.id, data: d.data() }))).catch(() => []),
    admin().collection('attempts').where('studentId', '==', uid).get().then(s => s.docs.map(d => ({ id: d.id, data: d.data() }))),
  ])
  return {
    uid,
    capturedAt: new Date().toISOString(),
    user,
    enrolledClasses,
    studyStates,
    classProgress,
    sessionStates,
    attempts,
  }
}

/**
 * Diff two snapshots from snapshotStudentState. Returns a list of changes.
 */
export function diffStudentSnapshots(before, after) {
  const changes = []
  const cmp = (label, b, a) => {
    if (JSON.stringify(b) !== JSON.stringify(a)) changes.push({ field: label, before: b, after: a })
  }
  cmp('user.enrolledClasses', before.user?.data?.enrolledClasses, after.user?.data?.enrolledClasses)
  cmp('user.stats', before.user?.data?.stats, after.user?.data?.stats)
  cmp('enrolledClasses.count', before.enrolledClasses?.length, after.enrolledClasses?.length)
  cmp('studyStates.count', before.studyStates?.length, after.studyStates?.length)
  cmp('classProgress.count', before.classProgress?.length, after.classProgress?.length)
  cmp('attempts.count', before.attempts?.length, after.attempts?.length)
  return changes
}

// =============================================================================
// Network route patterns for Playwright route().
// All assume the page reaches Firebase via *.googleapis.com (default Firebase SDK).
// =============================================================================

const FIRESTORE_WRITE_PATTERNS = [
  '**/google.firestore.v1.Firestore/Write/**',
  '**/google.firestore.v1.Firestore/Commit/**',
  '**/firestore.googleapis.com/**/Write/**',
  '**/firestore.googleapis.com/**/documents:commit',
]

const FIRESTORE_LISTEN_PATTERNS = [
  '**/google.firestore.v1.Firestore/Listen/**',
  '**/firestore.googleapis.com/**/Listen/**',
]

const CLOUD_FUNCTION_PATTERNS = [
  '**/*.cloudfunctions.net/**',
  '**/*.run.app/**',
]

/**
 * Route handler that fails the first N requests matching, then succeeds.
 * Use to test withRetry behavior end-to-end.
 */
export function routeFailFirestoreWritesNTimes(context, n = 1, status = 503) {
  let remaining = n
  return Promise.all(FIRESTORE_WRITE_PATTERNS.map(p =>
    context.route(p, route => {
      if (remaining > 0) {
        remaining--
        return route.fulfill({ status, body: JSON.stringify({ error: 'simulated' }) })
      }
      route.continue()
    })
  ))
}

/**
 * Route handler that stalls Firestore writes forever (no response).
 * Use to test timeout / "stuck UI" behavior.
 */
export function routeStallFirestoreWrites(context) {
  return Promise.all(FIRESTORE_WRITE_PATTERNS.map(p =>
    context.route(p, () => { /* never resolve */ })
  ))
}

/**
 * Route handler that returns 500 on EVERY Firestore write.
 * Use to test the "all retries exhausted" path.
 */
export function routeFailAllFirestoreWrites(context, status = 500) {
  return Promise.all(FIRESTORE_WRITE_PATTERNS.map(p =>
    context.route(p, route => route.fulfill({ status }))
  ))
}

/**
 * Route handler that stalls Cloud Functions (AI grading endpoint).
 * Use for B03 / B26 grading-timeout scenarios.
 */
export function routeStallCloudFunctions(context) {
  return Promise.all(CLOUD_FUNCTION_PATTERNS.map(p =>
    context.route(p, () => { /* never resolve */ })
  ))
}

/**
 * Route handler that adds artificial latency to every Firestore call.
 * Use for "slow 3G" scenarios.
 */
export function routeLatencyFirestore(context, delayMs = 800) {
  return Promise.all([...FIRESTORE_WRITE_PATTERNS, ...FIRESTORE_LISTEN_PATTERNS].map(p =>
    context.route(p, route => setTimeout(() => route.continue(), delayMs))
  ))
}

/**
 * Disable service workers — needed when testing against the live site
 * so route handlers actually intercept traffic.
 * Call BEFORE page.goto().
 */
export async function disableServiceWorkers(context) {
  await context.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
    }
  })
}

// =============================================================================
// HAR endpoint discovery (use once per audit run to confirm patterns)
// =============================================================================

/**
 * Record a HAR during a happy-path submit and print every endpoint touched.
 * Run this once at the start of an audit to confirm FIRESTORE_WRITE_PATTERNS still match.
 */
export async function logFirebaseEndpoints(page) {
  const requests = []
  page.on('request', req => {
    const url = req.url()
    if (url.includes('firestore.googleapis.com') ||
        url.includes('cloudfunctions.net') ||
        url.includes('identitytoolkit.googleapis.com')) {
      requests.push({ method: req.method(), url })
    }
  })
  return requests  // caller logs at end
}
