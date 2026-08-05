#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-b VISIT LIFECYCLE — MUTANTS: break the REAL module, expect RED
 * ============================================================================
 * Applies each mutant to `src/services/restudyVisit.js` IN PLACE (with a
 * [MUTANT marker so gate.mjs's residue scan fails closed if this run dies),
 * runs the pure fixture suite, and requires it to EXIT NON-ZERO. Restores the
 * original bytes afterwards and verifies sha-equality — same discipline as
 * cutover-a-compose-mutants.mjs / df2-11-teacher-review-settings-mutants.mjs.
 * Pure-only: this fold makes no Firestore/emulator calls, so there is no
 * server-side leg (unlike cutover-b, which needed one for its docId law).
 *
 *   M1-DROP-RESETEPOCH        the scope key drops resetEpoch — a reset could
 *                             resurrect a stale visit. Killed by CASE "SCOPE
 *                             ISOLATION"'s resetEpoch sub-case (+ CASE
 *                             "SCOPE"'s direct shape assertions).
 *   M2-UNLIMITED-REMINT       the re-mint-once guard check is disabled —
 *                             EVERY visit-invalidating refusal re-mints, the
 *                             looping-client defect the brief exists to
 *                             prevent. Killed by CASE "REMINT-ON-REFUSAL"'s
 *                             "second refusal surrenders" assertions (×3
 *                             statuses).
 *   M3-CACHE-SURVIVES-COMPLETION   `noteVisitCompleted` stops discarding —
 *                             a completed visit's id would still be handed
 *                             out on the next getOrMintVisit, resurrecting a
 *                             visit the server already flipped `completed`
 *                             on. Killed by CASE "COMPLETED"'s
 *                             "completedVisit:true discards" assertion.
 *   M4-ACCEPT-CORRUPT         the stored-envelope validation is skipped — any
 *                             JSON blob (wrong tuple, old schema, missing
 *                             visitId) is trusted. Killed by CASE
 *                             "STALE/CORRUPT".
 *   M5-STORAGE-THROWS         the try/catch around a storage read is removed
 *                             — a throwing storage (private mode / quota)
 *                             propagates instead of degrading. Killed by CASE
 *                             "STORAGE DEGRADES".
 *   M6-PEEK-MINTS             `peekVisitId` mints on a miss instead of
 *                             staying read-only — a mere "browse" render
 *                             would mint a visit doc per page view. Killed by
 *                             CASE "MINT-ON-FIRST-COMPOSE-ONLY"'s "browsing
 *                             never called the minter" assertion.
 *
 * Run: node scripts/deepfix2/df2-51b-visit-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51b-visit-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const TARGET = fileURLToPath(new URL("../../src/services/restudyVisit.js", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./df2-51b-visit-fixtures.mjs", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M1-DROP-RESETEPOCH",
    clause: "resetEpoch IS part of the visit scope — a reset must not resurrect a stale visit",
    find: `export function visitScopeKey({ uid, classId, listId, day, resetEpoch }) {
  return \`rv2visit.\${uid}.\${classId}.\${listId}.d\${day}.e\${resetEpoch}\`
}`,
    replace: `export function visitScopeKey({ uid, classId, listId, day, resetEpoch }) { // eslint-disable-line no-unused-vars
  // [MUTANT M1] resetEpoch dropped from the scope key
  return \`rv2visit.\${uid}.\${classId}.\${listId}.d\${day}\`
}`,
  },
  {
    id: "M2-UNLIMITED-REMINT",
    clause: "re-mint EXACTLY ONCE on a visit-invalidating refusal, then surrender — never loop",
    find: `  if (visitRemintUsed(guardScope, { storage: store })) {
    return { outcome: 'surrendered', status: refusalStatus, reason: REASON_VISIT_SURRENDERED }
  }`,
    replace: `  // [MUTANT M2] the once-guard is disabled — every refusal re-mints
  if (false && visitRemintUsed(guardScope, { storage: store })) {
    return { outcome: 'surrendered', status: refusalStatus, reason: REASON_VISIT_SURRENDERED }
  }`,
  },
  {
    id: "M3-CACHE-SURVIVES-COMPLETION",
    clause: "noteVisitCompleted discards on completedVisit:true (a stale id must not survive a completed visit)",
    find: `export function noteVisitCompleted({ uid, classId, listId, day, resetEpoch }, visitHalf, { storage } = {}) {
  if (!visitHalf || visitHalf.completedVisit !== true) return { discarded: false }
  const store = storage ?? defaultStorage()
  discardVisit({ uid, classId, listId, day, resetEpoch }, { storage: store })
  clearVisitRemintGuard(visitRemintGuardScope({ uid, classId, listId, day, resetEpoch }), { storage: store })
  return { discarded: true }
}`,
    replace: `export function noteVisitCompleted({ uid, classId, listId, day, resetEpoch }, visitHalf, { storage } = {}) {
  // [MUTANT M3] completion no longer discards — a cached id survives past
  // the server's own completed:true flip.
  if (!visitHalf || visitHalf.completedVisit !== true) return { discarded: false }
  return { discarded: false }
}`,
  },
  {
    id: "M4-ACCEPT-CORRUPT",
    clause: "a stale/corrupt/foreign stored envelope is discarded rather than used",
    find: `  const ok = parsed && typeof parsed === 'object' &&
    parsed.schemaVersion === SCHEMA_VERSION &&
    typeof parsed.visitId === 'string' && parsed.visitId.length > 0 &&
    parsed.uid === uid && parsed.classId === classId && parsed.listId === listId &&
    parsed.day === day && parsed.resetEpoch === resetEpoch`,
    replace: `  // [MUTANT M4] envelope validation skipped — any parsed JSON is trusted
  const ok = parsed && typeof parsed === 'object'`,
  },
  {
    id: "M5-STORAGE-THROWS",
    clause: "a throwing storage degrades the feature, never throws into a caller",
    find: `function readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch }) {
  let raw = null
  try { raw = store.getItem(scope) } catch { return null }`,
    replace: `function readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch }) {
  // [MUTANT M5] the try/catch around the storage read is removed
  let raw = store.getItem(scope)`,
  },
  {
    id: "M6-PEEK-MINTS",
    clause: "peekVisitId NEVER mints — a browse render must stay side-effect-free",
    find: `export function peekVisitId({ uid, classId, listId, day, resetEpoch }, { storage } = {}) {
  const store = storage ?? defaultStorage()
  const scope = visitScopeKey({ uid, classId, listId, day, resetEpoch })
  const env = readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch })
  return env ? env.visitId : null
}`,
    replace: `export function peekVisitId({ uid, classId, listId, day, resetEpoch }, deps = {}) {
  // [MUTANT M6] a miss now mints — "browsing" is no longer side-effect-free
  const store = deps.storage ?? defaultStorage()
  const scope = visitScopeKey({ uid, classId, listId, day, resetEpoch })
  const env = readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch })
  if (env) return env.visitId
  const mintFn = deps.mintVisitFn
  if (mintFn) mintFn({ classId, listId, day })
  return null
}`,
  },
];

const original = readFileSync(TARGET, "utf8");
const originalSha = sha(original);
const results = [];
let bad = 0;

for (const m of MUTANTS) {
  if (!original.includes(m.find)) {
    console.error(`FATAL: mutant ${m.id} anchor not found — the module drifted; re-anchor the mutant`);
    process.exit(2);
  }
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(TARGET, mutated);
  // Redirect the fixture's receipt so a mutant run can NEVER clobber the
  // canonical pure evidence (the audit-fixed idiom every prior fold uses).
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DF2_51B_VISIT_PURE_RECEIPT: `${tmpdir()}/df2-51b-visit-pure-mutant-run.json` },
  });
  writeFileSync(TARGET, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(TARGET, "utf8")) === originalSha;
  const summary = ((run.stdout || "").match(/PURE: (\d+) checks, (\d+) failures/) || []).slice(1);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, killed,
    fixtureExit: run.status,
    checks: summary[0] ? Number(summary[0]) : null,
    failures: summary[1] ? Number(summary[1]) : null,
    restoredOk,
  });
  if (!killed) { bad++; console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`); }
  else console.log(`✓ ${m.id} killed (fixture exit ${run.status}, ${summary[1] ?? "?"} red check(s))`);
  if (!restoredOk) { bad++; console.error(`✗ ${m.id} RESTORE FAILED — module bytes differ from original`); }
}

// Final belt: the tree must carry no mutant residue.
if (readFileSync(TARGET, "utf8").includes("[MUTANT")) {
  bad++;
  console.error("✗ MUTANT residue left in the module — restore failed");
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/df2-51b-visit-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "df2-51b-visit-mutants",
    pass: bad === 0,
    mutants: results,
    targetSha16: originalSha.slice(0, 16),
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndf2-51b-visit MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
