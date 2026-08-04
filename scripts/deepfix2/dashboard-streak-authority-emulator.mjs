#!/usr/bin/env node
/**
 * ============================================================================
 * DASHBOARD-STREAK-AUTHORITY (NTF-25) — EMULATOR fixtures: the account-wide
 * read (A2/C3/C5) against a REAL, rules-enforced Firestore emulator
 * ============================================================================
 * The unit under test is `src/services/streakCredits.js` (`fetchCreditDocs` +
 * `fetchAccountStreak`) — the module Dashboard.jsx calls behind
 * `REVIEW_V2_CLIENT` at its progress-loading effect. This file proves what
 * the pure fixtures (`dashboard-streak-authority-fixtures.mjs`) cannot: REAL
 * seeded `streak_credits` docs, REAL enforced rules (`/app/firestore.rules`
 * — the actual deploy-path file, same one ledger V3 cites at :239), a REAL
 * signed-in (emulator) user, and the REAL `deriveAccountStreak` consuming
 * REAL Firestore-round-tripped document IDs.
 *
 * WHY NOT `@firebase/rules-unit-testing` (the rules-matrix.mjs precedent):
 * TRIED FIRST, rejected on a REPRODUCED failure, not a shortcut. It lives
 * only under `~/fbtools/node_modules` (a SEPARATE `firebase` install,
 * 12.17.0, from `/app/node_modules`'s 12.6.0 — `run-rules-matrix.sh`'s own
 * comment: "resolves @firebase/rules-unit-testing via a node_modules symlink
 * — ESM ignores NODE_PATH"). Passing its `RulesTestContext.firestore()`
 * (built from the fbtools copy) into THIS repo's own `collection()`/`query()`
 * (the /app copy `streakCredits.js` uses) throws immediately:
 *   `FirebaseError: Expected first argument to collection() to be a
 *   CollectionReference, a DocumentReference or FirebaseFirestore`
 * (reproduced live, 2026-08-04). Vendoring a version-matched
 * `@firebase/rules-unit-testing` into `/app/node_modules` would fix it but is
 * a package.json/lockfile change outside this client-only fold's scope.
 * INSTEAD: this file builds its OWN client connection from
 * `/app/node_modules`'s OWN `firebase/app` + `firebase/firestore` +
 * `firebase/auth` — the SAME package instance `streakCredits.js` uses in
 * production, so there is no cross-package hazard. Auth (for the rules'
 * `isOwner(userId)`) comes from a REAL signed-in emulator user
 * (`createUserWithEmailAndPassword`, one fresh account per case). Seeding
 * (`streak_credits` is server-owned — a client write is DENIED by the very
 * rules this suite runs under, see WRITE-DENIED below) uses the Admin SDK
 * via `fold-harness.mjs#connectEmulator` — a wholly separate CJS require
 * tree (`functions/node_modules`); only plain data crosses that boundary,
 * never a live SDK object, so it does not share the hazard above.
 *
 * A SECOND, NARROWER ENVIRONMENT GAP — FOUND LIVE, NOT ASSUMED: the
 * Firestore EMULATOR (this repo's pinned `~/fbtools` firebase-tools
 * 15.25.1) refuses `orderBy(documentId(), 'desc')` outright:
 *   `FirebaseError: Firestore does not support descending key scans`
 *   (code 'failed-precondition' — reproduced live, 2026-08-04, isolated to
 *   the ORDER DIRECTION: the identical query with 'asc' succeeds).
 * This is a LOCAL EMULATOR limitation, not a production one — descending
 * `documentId()` ordering (the standard "N most recent by doc id" pattern,
 * required here because `limit()` must keep the MOST RECENT credits, not
 * the oldest) is valid, supported Firestore. Production code correctly
 * keeps `orderBy(documentId(), 'desc')` (`streakCredits.js`); rewriting it
 * to ascending+limit would return the OLDEST N credits instead of the most
 * recent N — wrong, not an equivalent workaround. So: `fetchCreditDocs`
 * ITSELF cannot be invoked against this local emulator at all (any call
 * throws, regardless of what a case wants to assert). This file therefore
 * verifies the DESC clause STATICALLY (source-text anchor, this file's own
 * QS-DESC-STATIC case — a 1-line `limit(...)`/`orderBy(...)` call is
 * low-risk to confirm by inspection) and drives the E2E cases through
 * `fetchAccountStreak`'s injectable `fetchDocsFn` with a test-supplied
 * fetcher that issues the SAME real ascending query (which the emulator
 * DOES support) and reverses it — exercising REAL Firestore + REAL auth +
 * REAL rules + the REAL `fetchAccountStreak` contract (drop classId/listId,
 * call the derivation) and the REAL `deriveAccountStreak`, substituting only
 * the ORDER DIRECTION of the doc-fetch sub-step. `fetchCreditDocs`'s own
 * `limitCount` threading is likewise confirmed by inspection (QS-DESC-STATIC)
 * plus a live ascending-equivalent LIMIT check (QS-LIMIT) against the same
 * collection shape.
 *
 * CASES:
 *   QS-DESC-STATIC  source-text anchor: `streakCredits.js` calls
 *                   `orderBy(documentId(), 'desc')` and `limit(limitCount)` —
 *                   proves what cannot be executed against this emulator.
 *   QS-COLLATION    seeded out of insertion order, read back ASCENDING (the
 *                   emulator-supported direction) ⇒ docId string order IS
 *                   chronological order (V2's "lexicographic=chronological").
 *   QS-LIMIT        5 seeded ⇒ an ascending query with limit:2 returns
 *                   exactly 2 docs (limit() bounds the read against this
 *                   collection shape).
 *   E2E-FRESH       a real 5-day account-wide streak (spanning a weekend)
 *                   seeded + read (real Firestore, reversed to DESC in the
 *                   test fetcher) + derived through the REAL
 *                   `fetchAccountStreak`/`deriveAccountStreak`.
 *   E2E-TWOLIST     the C5 target: 3 real credits tagged with TWO DIFFERENT
 *                   (classId,listId) pairs, interleaved across a weekend gap
 *                   ⇒ ONE account-wide 3-day number through the REAL
 *                   pipeline (not a hand-fed date array).
 *   READ-ONLY       (V5/C3 behavioral half — the structural half, "this
 *                   file imports no write verb", is in the pure fixtures)
 *                   the `streak_credits` doc COUNT is unchanged after
 *                   `fetchAccountStreak` runs.
 *   WRITE-DENIED    (bonus, pins the EXISTING rules envelope V3 relies on,
 *                   unaffected by the desc/dual-package gaps above — a
 *                   plain client `setDoc`) an owner's direct write to
 *                   `streak_credits` is rejected (server-owned).
 *
 * RUNBOOK (adapted from cutover-c-complete-emulator.mjs's — needs BOTH
 * firestore and auth; runs UNMODIFIED from its real location, no scratch-dir
 * copy, no @firebase/rules-unit-testing symlink):
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore,auth \
 *     --project "$(node -p "require('./scripts/serviceAccountKey.json').project_id")" \
 *     "node scripts/deepfix2/dashboard-streak-authority-emulator.mjs"
 * Evidence: docs/plans/deepfix2/evidence/dashboard-streak-authority-emulator.json
 */

import { readFileSync } from "node:fs";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, collection, query, orderBy, limit,
  getDocs, documentId, setDoc, doc,
} from "firebase/firestore";

import {
  requireEmulatorEnv, connectEmulator, createCaseRunner, sha16, writeReceipt, finalizeRun,
} from "./lib/fold-harness.mjs";

requireEmulatorEnv();

// ---- the REAL client module under test (this repo's OWN firebase copy) ---
import { fetchAccountStreak } from "../../src/services/streakCredits.js";

// ---- admin side (seeding only — streak_credits is server-owned) -----------
const { db: adminDb, Timestamp, fft, PROJECT } = connectEmulator();

// ---- client side: OUR OWN /app/node_modules firebase copy, not fbtools ---
const clientApp = initializeClientApp({ apiKey: "demo-api-key", projectId: PROJECT });
const auth = getAuth(clientApp);
const clientDb = getFirestore(clientApp);
const authHostPort = (process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099").split(":");
const firestoreHostPort = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
connectAuthEmulator(auth, `http://${authHostPort[0]}:${authHostPort[1]}`, { disableWarnings: true });
connectFirestoreEmulator(clientDb, firestoreHostPort[0], Number(firestoreHostPort[1]));

const { CASE, check, checkTrue, stats } = createCaseRunner();

let caseSeq = 0;
/** A fresh, distinct, REAL emulator-signed-in uid per case (no bypass). */
async function freshSignedInUid() {
  caseSeq += 1;
  const email = `dsa-case-${caseSeq}-${Date.now()}@test.local`;
  const cred = await createUserWithEmailAndPassword(auth, email, "password123!");
  return cred.user.uid;
}

/** Seed one streak_credits doc via ADMIN (bypasses rules — the frozen write
 *  shape, completion.js:745-748). */
async function seedCredit(uid, kstDate, { classId = "c1", listId = "l1", dayNumber = 1, resetEpoch = 0 } = {}) {
  await adminDb.doc(`users/${uid}/streak_credits/${kstDate}`).set({
    classId, listId, dayNumber, resetEpoch, createdAt: Timestamp.now(),
  });
}

const creditCount = async (uid) => (await adminDb.collection(`users/${uid}/streak_credits`).get()).size;

/** The emulator-safe substitute for `fetchCreditDocs`: the SAME collection
 *  path, but ASCENDING (the emulator-supported direction), reversed in JS to
 *  hand `fetchAccountStreak` the SAME descending shape `fetchCreditDocs`
 *  would have produced against real Firestore. Exercises real auth/rules; the
 *  ONLY substitution is the order direction (see the header — DESC itself is
 *  confirmed by QS-DESC-STATIC below, not executable against this emulator). */
async function ascendingRealFetch(db, uid) {
  const ref = collection(db, `users/${uid}/streak_credits`);
  const q = query(ref, orderBy(documentId(), "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
}

// ===========================================================================
CASE("QS-DESC-STATIC — the production query IS descending + limited (source anchor)");
{
  const src = readFileSync(new URL("../../src/services/streakCredits.js", import.meta.url), "utf8");
  checkTrue("orderBy(documentId(), 'desc') present", src.includes("orderBy(documentId(), 'desc')"));
  checkTrue("limit(limitCount) present", src.includes("limit(limitCount)"));
  checkTrue("no where()/classId/listId filter on the query (account-wide)",
    !/query\([^)]*where/.test(src));
}

CASE("QS-COLLATION — KST docId string order IS chronological order (ascending, emulator-supported)");
{
  const uid = await freshSignedInUid();
  await seedCredit(uid, "2026-07-20");
  await seedCredit(uid, "2026-08-04");
  await seedCredit(uid, "2026-07-31");
  const snap = await getDocs(query(collection(clientDb, `users/${uid}/streak_credits`), orderBy(documentId(), "asc")));
  check("ascending docIds === chronological order", snap.docs.map((d) => d.id),
    ["2026-07-20", "2026-07-31", "2026-08-04"]);
}

CASE("QS-LIMIT — limit() bounds the read against this collection shape");
{
  const uid = await freshSignedInUid();
  for (const d of ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"]) {
    await seedCredit(uid, d);
  }
  const snap = await getDocs(query(collection(clientDb, `users/${uid}/streak_credits`), orderBy(documentId(), "asc"), limit(2)));
  check("limit:2 returns exactly 2 docs", snap.docs.length, 2);
}

CASE("E2E-FRESH — a real 5-day account-wide streak, spanning a weekend, through the REAL pipeline");
{
  const uid = await freshSignedInUid();
  // Wed 7/29, Thu 7/30, Fri 7/31, [Sat/Sun skip], Mon 8/3, Tue 8/4 (= "now").
  for (const d of ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-03", "2026-08-04"]) {
    await seedCredit(uid, d);
  }
  const streak = await fetchAccountStreak(clientDb, uid, {
    now: new Date("2026-08-04T03:00:00Z"), fetchDocsFn: ascendingRealFetch,
  });
  check("E2E fresh streak = 5", streak, 5);
}

CASE("E2E-TWOLIST — credits from TWO different (classId,listId) pairs ⇒ ONE account-wide number");
{
  const uid = await freshSignedInUid();
  // Fri 7/31 under list A, Mon 8/3 under list B, Tue 8/4 (today) under list A —
  // one continuous 3-day account-wide streak spanning BOTH a weekend gap and a
  // list switch. This is the case C5's mutant (filter by classId/listId) breaks.
  await seedCredit(uid, "2026-07-31", { classId: "cA", listId: "lA" });
  await seedCredit(uid, "2026-08-03", { classId: "cB", listId: "lB" });
  await seedCredit(uid, "2026-08-04", { classId: "cA", listId: "lA" });
  const streak = await fetchAccountStreak(clientDb, uid, {
    now: new Date("2026-08-04T03:00:00Z"), fetchDocsFn: ascendingRealFetch,
  });
  check("two-list E2E streak = 3 (account-wide, not per-list)", streak, 3);
}

CASE("READ-ONLY (V5/C3 behavioral) — fetchAccountStreak never writes");
{
  const uid = await freshSignedInUid();
  await seedCredit(uid, "2026-08-04");
  await seedCredit(uid, "2026-08-03");
  const before = await creditCount(uid);
  await fetchAccountStreak(clientDb, uid, {
    now: new Date("2026-08-04T03:00:00Z"), fetchDocsFn: ascendingRealFetch,
  });
  const after = await creditCount(uid);
  check("streak_credits doc count unchanged by the read", after, before);
}

CASE("WRITE-DENIED (bonus, pins the EXISTING rules envelope V3 relies on)");
{
  const uid = await freshSignedInUid();
  let denied = false;
  try {
    await setDoc(doc(collection(clientDb, `users/${uid}/streak_credits`), "2026-08-04"), {
      classId: "c1", listId: "l1", dayNumber: 1, resetEpoch: 0, createdAt: new Date(),
    });
  } catch (err) {
    denied = err?.code === "permission-denied";
  }
  checkTrue("owner client write to streak_credits is denied (server-owned)", denied);
}

// ===========================================================================
const { total, failed, reds } = stats();
writeReceipt(
  new URL("../../docs/plans/deepfix2/evidence/dashboard-streak-authority-emulator.json", import.meta.url).pathname,
  {
    kind: "dashboard-streak-authority-emulator",
    pass: failed === 0,
    total, failed, reds,
    notes: {
      emulatorGap: "Firestore emulator (firebase-tools 15.25.1) throws " +
        "'Firestore does not support descending key scans' on orderBy(documentId(),'desc') " +
        "(code failed-precondition) — production-valid, emulator-unsupported. fetchCreditDocs " +
        "itself cannot be invoked against this emulator; its DESC clause is confirmed by " +
        "QS-DESC-STATIC (source anchor) instead of live execution.",
    },
    sourceShas: {
      "src/services/streakCredits.js": sha16(new URL("../../src/services/streakCredits.js", import.meta.url).pathname),
      "src/utils/streakAuthority.js": sha16(new URL("../../src/utils/streakAuthority.js", import.meta.url).pathname),
      "scripts/deepfix2/dashboard-streak-authority-emulator.mjs": sha16(new URL(import.meta.url).pathname),
    },
    at: new Date().toISOString(),
  },
);
console.log(`\ndashboard-streak-authority EMULATOR: ${total} checks, ${failed} failures — evidence written`);
await finalizeRun(fft, failed);
