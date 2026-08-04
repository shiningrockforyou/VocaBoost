#!/usr/bin/env node
/**
 * ============================================================================
 * FOLD-HARNESS — shared emulator-fixture scaffolding for the DEEPFIX2 folds
 * ============================================================================
 * Extracted (behavior-preserving) from the three committed emulator test
 * files — cutover-a-compose-emulator.mjs, cutover-b-submit-emulator.mjs,
 * namespace-reservation-emulator.mjs — after an independent review measured
 * the genuinely-shared surface at ~100-200 lines/file: Firestore-emulator
 * connect/teardown, the review-v2 seed idioms the two cutover folds share
 * VERBATIM (cutover-b's own header called that block "cloned from
 * cutover-a-compose-emulator.mjs"), the receipt + sourceShas writer, and the
 * case-runner loop (CASE/check/checkTrue). Each fold's CASES — the seeded
 * scenarios and their assertions, most of each file — stay in the fold's own
 * file UNCHANGED; only the scaffolding around them moved here.
 *
 * Every export is either byte-identical logic lifted verbatim from >=2 of the
 * three fold files, or a thin, behavior-preserving parameterization of an
 * OBSERVED, DOCUMENTED difference between them (see the comment on each
 * export: `verbose`, `trailingNewline`, which extra function modules a fold
 * requires afterward). Nothing here is fold-specific CASE/business logic.
 *
 * Declined-on-purpose (found identical or near-identical, left in the fold
 * files — see the refactor report for the full reasoning): cutover-a/b's
 * composeSessionAs/callAs request-invoking shims (fold-specific wiring to the
 * DIFFERENT callable each fold drives, and the two folds already disagree on
 * its shape); cutover-a's referenceSweep/range (support only the ROT/TIME
 * CASEs' assertions); namespace-reservation's seed()/ctxFor/etc. (no
 * counterpart in the other two folds at all).
 * ============================================================================
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

/** These fixtures run ONLY against the Firestore emulator — the identical
 *  guard at the top of all three fold files. */
export function requireEmulatorEnv() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — this fixture runs ONLY against the emulator");
    process.exit(2);
  }
}

/** Connect admin + Firestore + firebase-functions-test, pinned to
 *  functions/node_modules (the "lap law": index.js owns admin.initializeApp).
 *  Identical in all three fold files up to which extra functions/ modules
 *  each fold requires afterward — that stays in the fold file via the
 *  returned `fnRequire`. `Timestamp` and `indexModule` are returned for the
 *  folds that use them (cutover-a/b use Timestamp via createSeedHelpers;
 *  namespace-reservation uses indexModule directly); a fold that doesn't
 *  need one simply doesn't destructure it.
 *  Also returns `wipeEmulator` already bound to PROJECT, so every fold's
 *  existing `await wipeEmulator();` call site is untouched. */
export function connectEmulator() {
  const fnRequire = createRequire("/app/functions/index.js");
  const { initializeApp, cert, getApps } = fnRequire("firebase-admin/app");
  const { getFirestore, Timestamp } = fnRequire("firebase-admin/firestore");
  const key = JSON.parse(readFileSync("/app/scripts/serviceAccountKey.json"));
  const PROJECT = key.project_id;
  const indexModule = fnRequire("/app/functions/index.js"); // index.js owns admin.initializeApp (lap law)
  if (getApps().length === 0) initializeApp({ credential: cert(key) });
  const db = getFirestore();
  const fft = fnRequire("firebase-functions-test")({ projectId: PROJECT });
  const wrap = (c) => fft.wrap(c);
  const wipeEmulator = async () => {
    const host = process.env.FIRESTORE_EMULATOR_HOST;
    const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
    if (!res.ok) throw new Error(`emulator wipe failed: ${res.status}`);
  };
  return { fnRequire, key, PROJECT, indexModule, db, Timestamp, fft, wrap, wipeEmulator };
}

/** The review-v2 seed idioms shared VERBATIM by cutover-a-compose and
 *  cutover-b-submit (NOT used by namespace-reservation, whose seed shape is
 *  its own — see its own seed() in that file). `foundation` is the fold's own
 *  functions/foundation.js require (obtained via connectEmulator's
 *  `fnRequire`) — kept in the fold file since it is a fold-selected
 *  functions/ module, not connect scaffolding; passed in here only because
 *  seedProgress calls foundation.durableProgressRef(). */
export function createSeedHelpers({ db, Timestamp, foundation }) {
  const CONFIG_PATH = "system_config/review_v2";
  async function seedConfig(overrides = {}) {
    await db.doc(CONFIG_PATH).set({
      enabled: false, threshold: 92, queueSize: 60, testSize: 30,
      configVersion: 1, minClientVersion: null,
      rehearsalClassIds: [], firstEnabledAt: null,
      ...overrides,
    });
  }
  async function seedClass(classId, { listId = "L1", students = [], asg = {} } = {}) {
    await db.collection("classes").doc(classId).set({
      studentIds: students,
      assignments: { [listId]: { name: "seed", pace: 1, studyDaysPerWeek: 5, ...asg } },
    });
  }
  async function seedWords(listId, count) {
    const batch = db.batch();
    for (let i = 0; i < count; i++) {
      batch.set(db.collection("lists").doc(listId).collection("words").doc(`w${i}`),
        { word: `word${i}`, definition: `def${i}`, position: i });
    }
    await batch.commit();
  }
  async function seedProgress(uid, classId, listId, { csd, twi }) {
    await foundation.durableProgressRef(uid, classId, listId).set({
      classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }
  return { CONFIG_PATH, seedConfig, seedClass, seedWords, seedProgress };
}

/** Fake sessionStorage-shaped store — identical in cutover-a-compose and
 *  cutover-b-submit (both drive client modules that take a `storage` dep;
 *  namespace-reservation calls callables directly and has no counterpart). */
export function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** The case-runner: total/failed/reds counters + CASE/check/checkTrue.
 *  Identical across all three EXCEPT namespace-reservation additionally logs
 *  "ok" on a passing check (cutover-a/b do not) — preserved via `verbose`
 *  rather than silently unified either way. `fail(message)` exists for
 *  namespace-reservation's top-level try/catch around its case drivers,
 *  which records a FATAL failure outside of any single check() call (moves
 *  `failed++; reds.push(...)` behind a name instead of a raw closure
 *  variable); cutover-a/b have no such catch and never call it. */
export function createCaseRunner({ verbose = false } = {}) {
  let total = 0; let failed = 0; const reds = []; let caseName = "";
  const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
  const check = (name, got, want) => {
    total++;
    const g = JSON.stringify(got); const w = JSON.stringify(want);
    if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
    else if (verbose) console.log(`  ok ${name}`);
  };
  const checkTrue = (name, v) => check(name, Boolean(v), true);
  const fail = (message) => { failed++; reds.push(message); };
  const stats = () => ({ total, failed, reds });
  return { CASE, check, checkTrue, fail, stats };
}

/** sha256 of an absolute file path, first 16 hex chars — the exact algorithm
 *  all three folds already use (cutover-a/b via a local `sha16` const;
 *  namespace-reservation via two inline createHash calls of the same shape).
 *  Takes an ABSOLUTE path (not import.meta.url-relative): a relative-URL
 *  sha16 defined IN THIS lib would resolve relative to lib/, one directory
 *  deeper than the fold files it replaces — callers pass /app/... paths, as
 *  namespace-reservation's original inline hashing already did. */
export const sha16 = (absPath) => createHash("sha256").update(readFileSync(absPath)).digest("hex").slice(0, 16);

/** mkdir -p the standard evidence dir, then JSON.stringify + write the
 *  receipt to `outPath` (which may point elsewhere via a fold's own env-var
 *  redirect for the mutant driver — mkdir-ing the standard dir regardless
 *  matches the pre-existing behavior of cutover-b/namespace-reservation).
 *  `trailingNewline` defaults to false (cutover-a/b's existing behavior);
 *  namespace-reservation passes true (it already appended "\n"). */
export function writeReceipt(outPath, receipt, { trailingNewline = false } = {}) {
  mkdirSync(new URL("../../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
  writeFileSync(outPath, JSON.stringify(receipt, null, 2) + (trailingNewline ? "\n" : ""));
}

/** await fft.cleanup?.(); process.exit(failed ? 1 : 0); — the identical tail
 *  in all three fold files. */
export async function finalizeRun(fft, failed) {
  await fft.cleanup?.();
  process.exit(failed ? 1 : 0);
}
