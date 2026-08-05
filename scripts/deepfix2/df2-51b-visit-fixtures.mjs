#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-b VISIT LIFECYCLE — PURE fixtures (no Firebase, no network, no browser)
 * ============================================================================
 * Exercises the REAL `src/services/restudyVisit.js` with an injected
 * `mintVisitFn` and an injected/faked `sessionStorage`, proving the client-side
 * laws of the fold ledger (brief `_ledgers/df2-51b-visit-BRIEF.md`):
 *
 *   SCOPE                the storage key mirrors composeKeyScope's shape and
 *                         ADDS resetEpoch (the one deliberate delta).
 *   MINT-ON-FIRST-COMPOSE-ONLY   `peekVisitId` never mints; `getOrMintVisit`
 *                         mints on a cache miss and returns the CACHED id on
 *                         every subsequent call for the same scope — zero
 *                         extra network calls.
 *   SCOPE ISOLATION       a different day/list/class/resetEpoch each mint a
 *                         DIFFERENT id (never reuse across a reset).
 *   STALE/CORRUPT         a malformed/foreign/old-schema stored value is
 *                         discarded rather than used, and self-heals.
 *   COMPLETED             `noteVisitCompleted` discards ONLY on
 *                         `visitHalf.completedVisit === true` (a lone
 *                         `recorded:true` must NOT discard the visit the
 *                         other half still needs) and closes the re-mint
 *                         guard.
 *   LEAVE                 `noteVisitLeft` unconditionally discards + closes
 *                         the re-mint guard.
 *   REMINT-ON-REFUSAL     re-mints EXACTLY ONCE on visit_invalid /
 *                         reset_epoch_mismatch / reset_in_progress, then
 *                         SURRENDERS on a second such refusal — never loops.
 *                         A non-invalidating status is IGNORED (state
 *                         untouched). Discard-before-remint and
 *                         mark-before-mint (fail-closed) ordering proven.
 *   STORAGE DEGRADES      a THROWING storage never throws out of
 *                         peek/mint/discard/remint — falls back safely.
 *   REFUSAL COPY          every blocked/surrendered outcome carries a
 *                         non-empty reason; VISIT_INVALID gets its OWN line
 *                         (absent from reviewV2Compose.js's shared register);
 *                         shared statuses reuse that register VERBATIM.
 *   NOT-SERVING / THROWN  config_hold/review_v2_dark (data) and the thrown
 *                         trio (class_not_found/not_enrolled/list_not_assigned)
 *                         map to 'unavailable', never 'legacy' (restudy has
 *                         no legacy fallback) and never an uncaught throw.
 *   VALIDATE               a malformed handle never reaches the network or
 *                         mutates storage.
 *   PURITY                 the module imports only the two established
 *                         service wrappers — no react/firebase/firestore.
 *
 * Run: node scripts/deepfix2/df2-51b-visit-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51b-visit-pure.json
 * (DF2_51B_VISIT_PURE_RECEIPT redirects the receipt — the mutant driver uses
 * it so a mutant run can never clobber the canonical receipt, same audit-fixed
 * idiom as cutover-a/b and df2-11.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  visitScopeKey,
  visitRemintGuardScope,
  peekVisitId,
  discardVisit,
  visitRemintUsed,
  markVisitRemintUsed,
  clearVisitRemintGuard,
  noteVisitCompleted,
  noteVisitLeft,
  getOrMintVisit,
  isVisitInvalidatingStatus,
  remintVisitOnRefusal,
} from "../../src/services/restudyVisit.js";
import { RV2, ReviewV2Error } from "../../src/services/reviewV2Client.js";
import { refusalReasonText } from "../../src/services/reviewV2Compose.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

/** Per-test fake sessionStorage (one per simulated TAB/scope). */
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    _dump: () => Object.fromEntries(m),
  };
}

/** A storage whose every op throws — proves the degrade law. */
function throwingStorage() {
  return {
    getItem: () => { throw new Error("storage unavailable"); },
    setItem: () => { throw new Error("storage unavailable"); },
    removeItem: () => { throw new Error("storage unavailable"); },
  };
}

const T = { uid: "u1", classId: "c1", listId: "l1", day: 3, resetEpoch: 0 };

/** A fake mintVisitFn that mints a fresh incrementing id per call and records
 *  every call it saw. */
function fakeMinter(prefix = "v") {
  const calls = [];
  let n = 0;
  const fn = async (args) => { calls.push(args); n += 1; return { status: RV2.VISIT_MINTED, visitId: `${prefix}${n}`, path: `users/x/restudy_visits/${prefix}${n}` }; };
  return { fn, calls };
}

// ===========================================================================
CASE("SCOPE — visitScopeKey mirrors composeKeyScope's shape and ADDS resetEpoch");
{
  check("shape", visitScopeKey(T), "rv2visit.u1.c1.l1.d3.e0");
  check("guard scope shape (separate key, same tuple)", visitRemintGuardScope(T), "rv2vru.u1.c1.l1.d3.e0");
  checkTrue("visit scope and guard scope are DIFFERENT storage keys",
    visitScopeKey(T) !== visitRemintGuardScope(T));
  check("resetEpoch changes the scope", visitScopeKey({ ...T, resetEpoch: 1 }), "rv2visit.u1.c1.l1.d3.e1");
  checkTrue("resetEpoch:0 and resetEpoch:1 scopes differ",
    visitScopeKey(T) !== visitScopeKey({ ...T, resetEpoch: 1 }));
}

// ===========================================================================
CASE("MINT-ON-FIRST-COMPOSE-ONLY — peek never mints; getOrMintVisit mints once, then caches");
{
  const storage = fakeStorage();
  const { fn, calls } = fakeMinter();
  // "Browsing" — a mere read must never mint. `mintVisitFn` is passed into
  // peek's deps too (a real caller might have one in scope, e.g. reusing the
  // same deps object as a nearby getOrMintVisit call) — peekVisitId's REAL
  // signature ignores it; this is what catches a mutant that reads it anyway.
  check("peek on an empty scope is null", peekVisitId(T, { storage, mintVisitFn: fn }), null);
  check("browsing never called the minter", calls.length, 0);
  // First compose — mints.
  const first = await getOrMintVisit(T, { storage, mintVisitFn: fn });
  check("first getOrMintVisit mints", first, { outcome: "minted", visitId: "v1" });
  check("exactly one mint call", calls.length, 1);
  check("mint call payload is EXACTLY {classId, listId, day} — no uid, no resetEpoch smuggled",
    Object.keys(calls[0]).sort(), ["classId", "day", "listId"]);
  // peek now sees it, still without minting.
  check("peek now returns the minted id", peekVisitId(T, { storage, mintVisitFn: fn }), "v1");
  check("peek still never mints", calls.length, 1);
  // Second, third compose in the SAME scope — cached, zero more mints.
  const second = await getOrMintVisit(T, { storage, mintVisitFn: fn });
  check("second call returns the CACHED id", second, { outcome: "cached", visitId: "v1" });
  const third = await getOrMintVisit(T, { storage, mintVisitFn: fn });
  check("third call also cached", third, { outcome: "cached", visitId: "v1" });
  check("still exactly ONE mint call total (same scope reuses one visit)", calls.length, 1);
}

// ===========================================================================
CASE("SCOPE ISOLATION — a different day/list/class/resetEpoch each mint a DIFFERENT id");
{
  const storage = fakeStorage();
  const { fn, calls } = fakeMinter();
  const base = await getOrMintVisit(T, { storage, mintVisitFn: fn });
  const byDay = await getOrMintVisit({ ...T, day: 4 }, { storage, mintVisitFn: fn });
  const byList = await getOrMintVisit({ ...T, listId: "l2" }, { storage, mintVisitFn: fn });
  const byClass = await getOrMintVisit({ ...T, classId: "c2" }, { storage, mintVisitFn: fn });
  const byEpoch = await getOrMintVisit({ ...T, resetEpoch: 1 }, { storage, mintVisitFn: fn });
  const ids = [base, byDay, byList, byClass, byEpoch].map((r) => r.visitId);
  check("all five outcomes are fresh mints", [base, byDay, byList, byClass, byEpoch].map((r) => r.outcome),
    ["minted", "minted", "minted", "minted", "minted"]);
  check("all five ids are DISTINCT", new Set(ids).size, 5);
  check("exactly 5 mint calls (one per distinct scope)", calls.length, 5);
  // Re-asking the ORIGINAL scope still returns the ORIGINAL cached id — the
  // other scopes never clobbered it.
  const again = await getOrMintVisit(T, { storage, mintVisitFn: fn });
  check("original scope still cached at its own id", again, { outcome: "cached", visitId: base.visitId });
  check("no extra mint call for the re-ask", calls.length, 5);
}

// ===========================================================================
CASE("STALE/CORRUPT — a malformed stored value is discarded, not used, and self-heals");
{
  const scope = visitScopeKey(T);
  const cases = [
    ["not json at all", "not-json{{{"],
    ["json but not an object", "\"just-a-string\""],
    ["missing visitId", JSON.stringify({ schemaVersion: 1, uid: "u1", classId: "c1", listId: "l1", day: 3, resetEpoch: 0 })],
    ["wrong tuple (foreign classId)", JSON.stringify({ schemaVersion: 1, visitId: "foreign", uid: "u1", classId: "OTHER", listId: "l1", day: 3, resetEpoch: 0 })],
    ["wrong resetEpoch (stale pre-reset visit)", JSON.stringify({ schemaVersion: 1, visitId: "stale", uid: "u1", classId: "c1", listId: "l1", day: 3, resetEpoch: 999 })],
    ["old schemaVersion", JSON.stringify({ schemaVersion: 0, visitId: "old", uid: "u1", classId: "c1", listId: "l1", day: 3, resetEpoch: 0 })],
    ["empty string", ""],
  ];
  for (const [label, raw] of cases) {
    const storage = fakeStorage();
    storage.setItem(scope, raw);
    check(`${label} ⇒ peek discards (null)`, peekVisitId(T, { storage }), null);
    check(`${label} ⇒ self-healed out of storage`, storage.getItem(scope), null);
  }
  // A genuinely well-formed envelope from a DIFFERENT scope key never leaks
  // into this one (defense-in-depth even though the key itself already
  // isolates it).
  const storage2 = fakeStorage();
  storage2.setItem(scope, JSON.stringify({ schemaVersion: 1, visitId: "v9", uid: "u1", classId: "c1", listId: "l1", day: 3, resetEpoch: 0 }));
  check("a well-formed matching envelope IS used", peekVisitId(T, { storage: storage2 }), "v9");
  // And a mint is skipped entirely when the cache is good.
  const { fn, calls } = fakeMinter();
  const res = await getOrMintVisit(T, { storage: storage2, mintVisitFn: fn });
  check("good cache ⇒ no mint call", [res, calls.length], [{ outcome: "cached", visitId: "v9" }, 0]);
}

// ===========================================================================
CASE("COMPLETED — noteVisitCompleted clears ONLY on completedVisit:true; also clears the re-mint guard");
{
  const storage = fakeStorage();
  const { fn } = fakeMinter();
  await getOrMintVisit(T, { storage, mintVisitFn: fn });
  check("visit stored before the trigger", peekVisitId(T, { storage }), "v1");
  const guardScope = visitRemintGuardScope(T);
  markVisitRemintUsed(guardScope, { storage });
  check("guard pre-set for the test", visitRemintUsed(guardScope, { storage }), true);

  // A lone half (recorded:true, completedVisit:false) must NOT discard.
  const half1 = noteVisitCompleted(T, { recorded: true, completedVisit: false }, { storage });
  check("one half alone does not discard", half1, { discarded: false });
  check("visit survives one half", peekVisitId(T, { storage }), "v1");
  check("guard untouched by a non-completing half", visitRemintUsed(guardScope, { storage }), true);

  // A malformed/absent visitHalf is inert.
  check("null visitHalf does not discard", noteVisitCompleted(T, null, { storage }), { discarded: false });
  check("visit still survives", peekVisitId(T, { storage }), "v1");

  // BOTH halves — completedVisit:true — discards AND closes the guard.
  const done = noteVisitCompleted(T, { recorded: true, completedVisit: true }, { storage });
  check("completedVisit:true discards", done, { discarded: true });
  check("visit gone", peekVisitId(T, { storage }), null);
  check("re-mint guard closed by completion", visitRemintUsed(guardScope, { storage }), false);

  // A DIFFERENT scope's visit is untouched.
  const storage2 = fakeStorage();
  await getOrMintVisit({ ...T, day: 5 }, { storage: storage2, mintVisitFn: fn });
  noteVisitCompleted(T, { completedVisit: true }, { storage: storage2 }); // wrong scope's args
  check("completing scope T never touches day-5's storage key",
    peekVisitId({ ...T, day: 5 }, { storage: storage2 }), "v2");
}

// ===========================================================================
CASE("LEAVE — noteVisitLeft unconditionally discards + clears the re-mint guard");
{
  const storage = fakeStorage();
  const { fn } = fakeMinter();
  await getOrMintVisit(T, { storage, mintVisitFn: fn });
  const guardScope = visitRemintGuardScope(T);
  markVisitRemintUsed(guardScope, { storage });
  check("visit + guard set up", [peekVisitId(T, { storage }), visitRemintUsed(guardScope, { storage })], ["v1", true]);
  noteVisitLeft(T, { storage });
  check("leave discards the visit unconditionally", peekVisitId(T, { storage }), null);
  check("leave closes the re-mint guard", visitRemintUsed(guardScope, { storage }), false);
  // Idempotent on an already-empty scope.
  checkTrue("leaving twice does not throw", (() => { noteVisitLeft(T, { storage }); return true; })());
}

// ===========================================================================
CASE("REMINT-ON-REFUSAL — re-mints EXACTLY once per the three eligible statuses, then SURRENDERS; never loops");
{
  for (const status of [RV2.VISIT_INVALID, RV2.RESET_EPOCH_MISMATCH, RV2.RESET_IN_PROGRESS]) {
    checkTrue(`${status} is classified visit-invalidating`, isVisitInvalidatingStatus(status));
    const storage = fakeStorage();
    const { fn, calls } = fakeMinter("r");
    await getOrMintVisit(T, { storage, mintVisitFn: fn });
    check(`${status} :: visit minted before the refusal`, peekVisitId(T, { storage }), "r1");

    // FIRST refusal ⇒ discard-then-remint (exactly one remedial mint call).
    const first = await remintVisitOnRefusal({ ...T, refusalStatus: status }, { storage, mintVisitFn: fn });
    check(`${status} :: first refusal reminted`, first, { outcome: "reminted", visitId: "r2" });
    check(`${status} :: exactly ONE remedial mint call`, calls.length, 2); // 1 original + 1 remedial
    check(`${status} :: the NEW visit is stored`, peekVisitId(T, { storage }), "r2");
    check(`${status} :: guard now used`, visitRemintUsed(visitRemintGuardScope(T), { storage }), true);

    // SECOND refusal in the SAME scope ⇒ surrender — NO further mint call.
    const second = await remintVisitOnRefusal({ ...T, refusalStatus: status }, { storage, mintVisitFn: fn });
    check(`${status} :: second refusal surrenders`, second.outcome, "surrendered");
    checkTrue(`${status} :: surrender carries a non-empty reason`, typeof second.reason === "string" && second.reason.length > 0);
    check(`${status} :: NO second remedial mint call`, calls.length, 2);
    check(`${status} :: the (now-known-bad) visit is discarded on surrender too`, peekVisitId(T, { storage }), null);

    // A THIRD attempt is still bounded — never loops regardless of how many
    // times the caller re-invokes it.
    const third = await remintVisitOnRefusal({ ...T, refusalStatus: status }, { storage, mintVisitFn: fn });
    check(`${status} :: a third call is STILL surrendered (never loops)`, third.outcome, "surrendered");
    check(`${status} :: still exactly 2 mint calls total`, calls.length, 2);
  }

  // A non-invalidating status is IGNORED — no discard, no guard touch, no mint.
  {
    const storage = fakeStorage();
    const { fn, calls } = fakeMinter();
    await getOrMintVisit(T, { storage, mintVisitFn: fn });
    for (const other of ["day_guard_rejected", "config_hold", "review_v2_dark", "some_future_status", null, undefined]) {
      const res = await remintVisitOnRefusal({ ...T, refusalStatus: other }, { storage, mintVisitFn: fn });
      check(`${other} ⇒ ignored`, res, { outcome: "ignored", status: other ?? null });
    }
    check("the stored visit SURVIVES every ignored status (never discarded)", peekVisitId(T, { storage }), "v1");
    check("no mint call beyond the original", calls.length, 1);
    checkTrue("the guard was never marked", !visitRemintUsed(visitRemintGuardScope(T), { storage }));
  }

  // Discard-before-remint: even if the remedial mint ITSELF then refuses, the
  // stale visit is already gone (never handed out again) and the guard is
  // already set (fail-closed — no infinite retry even across process restarts
  // that would otherwise re-read a not-yet-marked guard).
  {
    const storage = fakeStorage();
    const { fn } = fakeMinter();
    await getOrMintVisit(T, { storage, mintVisitFn: fn });
    const refusingMint = async () => ({ status: "day_guard_rejected", expectedMax: 2 });
    const res = await remintVisitOnRefusal({ ...T, refusalStatus: RV2.VISIT_INVALID }, { storage, mintVisitFn: refusingMint });
    check("a refusing remedial mint surfaces its OWN status", [res.outcome, res.status], ["blocked", "day_guard_rejected"]);
    checkTrue("carries a rendered reason", typeof res.reason === "string" && res.reason.length > 0);
    check("the stale visit is gone regardless (discard-before-remint)", peekVisitId(T, { storage }), null);
    check("the guard is set even though the remedial mint itself failed (fail-closed)",
      visitRemintUsed(visitRemintGuardScope(T), { storage }), true);
    // A second attempt is now bounded too — the guard does not care WHY the
    // first repair failed.
    const second = await remintVisitOnRefusal({ ...T, refusalStatus: RV2.VISIT_INVALID }, { storage, mintVisitFn: fn });
    check("second attempt after a failed repair still surrenders", second.outcome, "surrendered");
  }

  // Malformed handle ⇒ blocked, storage/network untouched.
  {
    const storage = fakeStorage();
    let calls = 0;
    const res = await remintVisitOnRefusal({ ...T, uid: "", refusalStatus: RV2.VISIT_INVALID },
      { storage, mintVisitFn: async () => { calls++; return { status: RV2.VISIT_MINTED, visitId: "x" }; } });
    check("malformed handle ⇒ blocked malformed_request", [res.outcome, res.status], ["blocked", "malformed_request"]);
    check("network never called", calls, 0);
    check("storage untouched", Object.keys(storage._dump()).length, 0);
  }
}

// ===========================================================================
// Each probe below is individually try/caught: a THROW is the exact defect
// under test, so it must land as a RED check, not an uncaught crash that
// would abort the rest of this suite (and hide every later CASE's coverage
// — the M5 mutant showed this in dry-run: a bare crash still "kills" the
// mutant via a non-zero exit code, but only by accident, and only reports
// the ONE case that happened to run first).
function safely(fn) {
  try { return { threw: false, value: fn() }; } catch { return { threw: true, value: undefined }; }
}
async function safelyAsync(fn) {
  try { return { threw: false, value: await fn() }; } catch { return { threw: true, value: undefined }; }
}

CASE("STORAGE DEGRADES — a throwing storage never throws out of peek/mint/discard/remint");
{
  const storage = throwingStorage();
  const peeked = safely(() => peekVisitId(T, { storage }));
  check("peek on a throwing storage does not throw", peeked.threw, false);
  check("peek on a throwing storage returns null", peeked.value, null);

  const minted = await safelyAsync(() => getOrMintVisit(T, { storage, mintVisitFn: async () => ({ status: RV2.VISIT_MINTED, visitId: "deg1" }) }));
  check("getOrMintVisit on a throwing storage does not throw", minted.threw, false);
  check("it still mints (network unaffected by a dead cache)", minted.value, { outcome: "minted", visitId: "deg1" });

  const discarded = safely(() => { discardVisit(T, { storage }); return true; });
  check("discardVisit on a throwing storage does not throw", discarded.threw, false);

  const left = safely(() => { noteVisitLeft(T, { storage }); return true; });
  check("noteVisitLeft on a throwing storage does not throw", left.threw, false);

  const completed = safely(() => noteVisitCompleted(T, { completedVisit: true }, { storage }));
  check("noteVisitCompleted on a throwing storage does not throw", completed.threw, false);
  check("...and still reports the completion (storage failure ≠ silent no-op)", completed.value, { discarded: true });

  const reminted = await safelyAsync(() => remintVisitOnRefusal({ ...T, refusalStatus: RV2.VISIT_INVALID },
    { storage, mintVisitFn: async () => ({ status: RV2.VISIT_MINTED, visitId: "deg2" }) }));
  check("remintVisitOnRefusal on a throwing storage does not throw", reminted.threw, false);

  // Without persistence, every call is independently a fresh mint (degraded,
  // not broken — the feature is unavailable to CACHE, never unavailable to
  // use).
  const again = await safelyAsync(() => getOrMintVisit(T, { storage, mintVisitFn: async () => ({ status: RV2.VISIT_MINTED, visitId: "again" }) }));
  check("degraded mode still round-trips the network correctly each time, does not throw", again.threw, false);
  check("...and mints again (no persistence to hit a cache with)", again.value?.outcome, "minted");
}

// ===========================================================================
CASE("REFUSAL COPY — every blocked/surrendered outcome carries a reason; VISIT_INVALID has its OWN line; shared statuses reuse reviewV2Compose.js VERBATIM");
{
  for (const status of [RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH, RV2.DAY_GUARD_REJECTED, RV2.CLIENT_VERSION_STALE]) {
    const storage = fakeStorage();
    const res = await getOrMintVisit(T, { storage, mintVisitFn: async () => ({ status }) });
    check(`${status} ⇒ blocked with the SHARED reviewV2Compose.js copy`, res, { outcome: "blocked", status, reason: refusalReasonText(status) });
  }
  // VISIT_INVALID is not a mint-time status in practice (it is a SUBMIT-time
  // refusal against an already-minted visit), but the reason function must
  // still resolve it to its OWN line, not the generic — proven directly via
  // the surrender path (CASE REMINT-ON-REFUSAL already exercises this
  // end-to-end); here we pin the actual STRING so a future edit cannot
  // silently swap it for the generic without turning this red.
  {
    const storage = fakeStorage();
    const { fn } = fakeMinter();
    await getOrMintVisit(T, { storage, mintVisitFn: fn });
    markVisitRemintUsed(visitRemintGuardScope(T), { storage });
    const res = await remintVisitOnRefusal({ ...T, refusalStatus: RV2.VISIT_INVALID }, { storage, mintVisitFn: fn });
    // Defensive reads (never `.includes` on a possibly-undefined field): a
    // mutant that breaks the once-guard (M2) would otherwise CRASH this case
    // instead of turning it red, hiding every case that runs after it.
    check("second refusal actually surrendered (precondition for the copy check below)", res.outcome, "surrendered");
    check("surrendered reason is the dedicated copy, not the generic",
      String(res.reason ?? "").includes("재응시를 준비하지 못했습니다"), true);
    checkTrue("surrendered reason differs from the generic 'cannot start' line",
      String(res.reason ?? "") !== "지금은 재응시를 시작할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. " +
        "(This retest can't start right now — reload the page and try again.)");
  }
  // Unknown/malformed mint response ⇒ blocked with a NON-EMPTY generic reason.
  for (const bad of [{ status: "some_future_status_v9" }, null, undefined, {}, { data: 1 }]) {
    const storage = fakeStorage();
    const res = await getOrMintVisit(T, { storage, mintVisitFn: async () => bad });
    check(`malformed/unknown ${JSON.stringify(bad)} ⇒ blocked`, res.outcome, "blocked");
    checkTrue("carries a non-empty reason", typeof res.reason === "string" && res.reason.length > 0);
  }
}

// ===========================================================================
CASE("NOT-SERVING / THROWN — config_hold/review_v2_dark (data) and the thrown trio (both code forms) ⇒ 'unavailable', never a throw, never 'legacy'");
{
  for (const status of ["config_hold", "review_v2_dark"]) {
    const storage = fakeStorage();
    const res = await getOrMintVisit(T, { storage, mintVisitFn: async () => ({ status }) });
    check(`${status} (data) ⇒ unavailable`, res, { outcome: "unavailable", via: "status", status });
  }
  // The in-txn re-check race (ledger V7 finding): class_not_found/
  // not_enrolled/list_not_assigned CAN also arrive as DATA (not just thrown)
  // — isNotServing must still catch them.
  for (const status of ["class_not_found", "not_enrolled", "list_not_assigned"]) {
    const storage = fakeStorage();
    const res = await getOrMintVisit(T, { storage, mintVisitFn: async () => ({ status }) });
    check(`${status} (data, in-txn race) ⇒ unavailable too`, res, { outcome: "unavailable", via: "status", status });
  }
  const legacyCodes = [
    "not-found", "permission-denied", "failed-precondition",
    "functions/not-found", "functions/permission-denied", "functions/failed-precondition",
  ];
  for (const code of legacyCodes) {
    const storage = fakeStorage();
    const res = await getOrMintVisit(T, { storage, mintVisitFn: async () => { throw new ReviewV2Error(code, `thrown ${code}`); } });
    check(`thrown ${code} ⇒ unavailable (never 'legacy' — restudy has none)`, res, { outcome: "unavailable", via: "error", code });
  }
  for (const code of ["internal", "unauthenticated", "invalid-argument", "unavailable", "deadline-exceeded"]) {
    const storage = fakeStorage();
    const res = await getOrMintVisit(T, { storage, mintVisitFn: async () => { throw new ReviewV2Error(code, `thrown ${code}`); } });
    check(`thrown ${code} ⇒ blocked with a reason (not silently swallowed)`, res.outcome, "blocked");
    checkTrue(`thrown ${code} carries a reason`, typeof res.reason === "string" && res.reason.length > 0);
  }
  const storage = fakeStorage();
  const bare = await getOrMintVisit(T, { storage, mintVisitFn: async () => { throw new Error("boom"); } });
  check("a bare Error ⇒ blocked with a reason, never an uncaught throw", [bare.outcome, typeof bare.reason], ["blocked", "string"]);
}

// ===========================================================================
CASE("VALIDATE — a malformed handle never reaches the network or mutates storage");
{
  const badArgs = [
    { ...T, day: 0 }, { ...T, day: 1.5 }, { ...T, day: -1 },
    { ...T, resetEpoch: -1 }, { ...T, resetEpoch: 1.5 },
    { ...T, uid: "" }, { ...T, classId: "" }, { ...T, listId: "" },
    { ...T, uid: undefined }, { ...T, classId: null },
  ];
  for (const args of badArgs) {
    const storage = fakeStorage();
    let calls = 0;
    const res = await getOrMintVisit(args, { storage, mintVisitFn: async () => { calls++; return { status: RV2.VISIT_MINTED, visitId: "x" }; } });
    const tag = JSON.stringify({ u: args.uid, c: args.classId, l: args.listId, d: args.day, e: args.resetEpoch });
    check(`${tag} ⇒ blocked malformed_request`, [res.outcome, res.status], ["blocked", "malformed_request"]);
    check(`${tag} network never called`, calls, 0);
    check(`${tag} storage untouched (no junk scopes)`, Object.keys(storage._dump()).length, 0);
  }
}

// ===========================================================================
// PURITY — no react/firebase/firestore import; only the two established
// service wrappers (grepped against the SOURCE BYTES, not accepted on faith —
// same discipline the C2 static cases use elsewhere in this program).
// ===========================================================================
CASE("PURITY — the module imports ONLY reviewV2Client.js + reviewV2Compose.js");
{
  const src = readFileSync(new URL("../../src/services/restudyVisit.js", import.meta.url), "utf8");
  const importLines = src.split("\n").filter((l) => l.trim().startsWith("import "));
  check("exactly two import statements", importLines.length, 2);
  checkTrue("imports reviewV2Client.js", importLines.some((l) => l.includes("./reviewV2Client.js")));
  checkTrue("imports reviewV2Compose.js", importLines.some((l) => l.includes("./reviewV2Compose.js")));
  // Strip comments before scanning CODE for forbidden tokens — a false
  // positive on this module's OWN documentation prose is a known trap
  // (dashboard-df2-33-fixtures.mjs hit exactly this; 51-a's brief names it).
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, "");    // line comments
  checkTrue("no react import", !/from ['"]react/.test(codeOnly));
  checkTrue("no firebase import", !/from ['"]firebase/.test(codeOnly));
  checkTrue("no direct firestore/db.js import", !/from ['"].*(firestore|db\.js)/.test(codeOnly));
  checkTrue("no getDoc/onSnapshot/collection( call anywhere in CODE (no Firestore reads in this fold)",
    !/\b(getDoc|onSnapshot|collection\()\b/.test(codeOnly));
  // The comment-strip itself must not have eaten the two real import lines —
  // guards against the regex being SO broad it silently defeats the case.
  checkTrue("import lines survive the comment strip", codeOnly.includes("from './reviewV2Client.js'") &&
    codeOnly.includes("from './reviewV2Compose.js'"));
}

// ===========================================================================
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
const evidencePath = process.env.DF2_51B_VISIT_PURE_RECEIPT
  ? new URL(`file://${process.env.DF2_51B_VISIT_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/df2-51b-visit-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(evidencePath, JSON.stringify({
  kind: "df2-51b-visit-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/restudyVisit.js": sha16("../../src/services/restudyVisit.js"),
    "src/services/reviewV2Client.js": sha16("../../src/services/reviewV2Client.js"),
    "src/services/reviewV2Compose.js": sha16("../../src/services/reviewV2Compose.js"),
    "scripts/deepfix2/df2-51b-visit-fixtures.mjs": sha16("./df2-51b-visit-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndf2-51b-visit PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
