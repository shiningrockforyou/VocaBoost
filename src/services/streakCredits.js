/**
 * ============================================================================
 * DASHBOARD-STREAK-AUTHORITY (NTF-25, A2) — the account-wide streak READ
 * ============================================================================
 * Behind `REVIEW_V2_CLIENT` (the CALLER gates — Dashboard.jsx `:1399` — this
 * module carries no flag, per the V6 doctrine established by cutover-a/b/c),
 * a DIRECT client Firestore query over `users/{uid}/streak_credits` — rules
 * already allow the read (`firestore.rules:239`, the generic owner-or-teacher
 * subcollection read; `streak_credits` is only write-restricted, :249-268) —
 * NO new callable, NO functions deploy (ledger V3).
 *
 * READ-ONLY (V5): the only Firestore verb this file imports or calls is
 * `getDocs`. It must NEVER import a write verb (`setDoc`/`updateDoc`/
 * `addDoc`/`deleteDoc`/`writeBatch`/`runTransaction`) — C3 pins this
 * structurally (grep this file's own import list) and behaviorally (an
 * emulator run asserts the credited doc count is unchanged after the read).
 *
 * `db` IS INJECTED, NEVER IMPORTED FROM `../firebase.js` HERE — mirroring
 * `reviewV2Client.js`'s posture (the network/Firestore edge is always a
 * parameter/indirection, never a module-level singleton): `../firebase.js`
 * calls `initializeApp()` off Vite's `import.meta.env`, which does not exist
 * under plain node, so a module that imports it cannot be loaded by a
 * plain-node fixture (`db.js`/`progressService.js` cannot either — see
 * `scripts/deepfix2/cutover-c-complete-emulator.mjs:22-30` for the estab-
 * lished precedent this follows). The production caller (Dashboard.jsx)
 * already imports `db` from `../firebase` for its other reads and passes it
 * in here unchanged.
 *
 * ACCOUNT-WIDE BY CONSTRUCTION (R2-21, do NOT narrow to one list — ledger
 * scope + C5's mutant): the query carries NO `classId`/`listId` filter — every
 * credit for this uid, any class/list. `classId`/`listId` are present on each
 * raw doc (the write shape, completion.js:745-748) but are deliberately
 * DROPPED before deriving (`fetchAccountStreak` maps to `d.id` only), so a
 * future edit cannot silently scope this to one list without visibly adding a
 * filter/narrowing at the call site.
 */

// Explicit .js extension on the sibling import: this module is loaded by the
// node-run fixture/emulator scripts (scripts/deepfix2/dashboard-streak-
// authority-*.mjs) as well as by Vite, and node ESM resolution requires the
// extension (Vite accepts both forms) — the same convention
// reviewV2Compose.js documents at its own top-of-file import.
import { collection, query, orderBy, limit, getDocs, documentId } from 'firebase/firestore'
import { deriveAccountStreak, ACCOUNT_STREAK_QUERY_LIMIT } from '../utils/streakAuthority.js'

/**
 * The raw read: `users/{uid}/streak_credits` ordered by `documentId()`
 * DESCENDING (docIds are KST `YYYY-MM-DD` strings, lexicographic ===
 * chronological), bounded by `limitCount`. Returns the doc data WITH its id
 * attached (`classId`/`listId`/`dayNumber`/`resetEpoch`/`createdAt` per the
 * frozen write shape) — exported separately from `fetchAccountStreak` so a
 * fixture can assert the ORDER/LIMIT directly, independent of the derivation.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} uid
 * @param {{limitCount?: number}} [opts]
 * @returns {Promise<Array<{id: string, classId: string, listId: string, dayNumber: number, resetEpoch: number, createdAt: unknown}>>}
 */
export async function fetchCreditDocs(db, uid, { limitCount = ACCOUNT_STREAK_QUERY_LIMIT } = {}) {
  const ref = collection(db, `users/${uid}/streak_credits`)
  const q = query(ref, orderBy(documentId(), 'desc'), limit(limitCount))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * The account-wide R2-21 streak for `uid`: read + derive. `fetchDocsFn` is
 * injectable (defaults to the real `fetchCreditDocs`) so a fixture can
 * substitute a fake reader without a live Firestore connection while still
 * exercising the SAME "drop classId/listId before deriving" contract this
 * function owns.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} uid
 * @param {{now?: Date, fetchDocsFn?: Function}} [opts]
 * @returns {Promise<number>}
 */
export async function fetchAccountStreak(db, uid, { now = new Date(), fetchDocsFn } = {}) {
  const run = fetchDocsFn ?? fetchCreditDocs
  const docs = await run(db, uid)
  // ACCOUNT-WIDE (C5): classId/listId are on `docs[i]` but intentionally
  // unread past this line — only the date (the doc id) reaches the walk.
  const creditDates = docs.map((d) => d.id)
  return deriveAccountStreak(creditDates, { now })
}
