#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-A COMPOSE — PURE client fixtures (no Firebase, no network)
 * ============================================================================
 * Exercises the REAL `src/services/reviewV2Compose.js` (the module the session
 * pages call behind REVIEW_V2_CLIENT) with injected compose functions and
 * storage, proving the client-side laws of the fold ledger:
 *
 *   C1/ORDER  the envelope returns presentedWordIds / queueWordIds VERBATIM —
 *             same members, SAME ORDER (V3: served order = rendered order).
 *             This is also the assertion that kills mutant M-C4 (test set
 *             sourced from the queue instead of presentedWordIds).
 *   C3        one case per DATA-channel refusal status: config_hold and
 *             review_v2_dark → 'legacy'; every authority refusal → 'blocked'
 *             with a NON-EMPTY rendered reason; an UNKNOWN status → 'blocked'
 *             with the generic reason (never a blank screen, never legacy).
 *   C8        one case per THROWN-channel refusal: not-found /
 *             permission-denied / failed-precondition (bare AND 'functions/'-
 *             prefixed, as the web SDK surfaces both) → 'legacy'; any other
 *             thrown code → 'blocked' with a reason.
 *   C9(unit)  key persistence: the same scope recovers the SAME composeKey
 *             (reload ⇒ server replay); freshKey mints a NEW one (deliberate
 *             retake ⇒ new presentation). Kills mutant M-C5 (stale key reused
 *             on a retake).
 *   V5 edge   compose_key_reused / invalid_compose_key DISCARD the stored key
 *             (the next deliberate entry mints fresh — no silent auto-loop).
 *   F3/F6     the testConfig BOUNDARY (Opus audit fold): the object handed to
 *             the pages, built through the REAL buildTestConfig, carries the
 *             FULL distractor pool (never the presented subset) with the
 *             presented order verbatim. Kills M-F3.
 *   F2        the REVIEW word-range label is NULLED flag-on (the segment is
 *             dead — V1.3); the NEW-test range passes through. Kills M-F2.
 *   F4        a server-composed typed set is NEVER truncated (60⇒60, 120⇒120
 *             — no hidden cap at any size). Kills M-F4.
 *   F5        an invalid logicalDay is an OBSERVABLE legacy outcome on BOTH
 *             surfaces (via:'invalid_day' + log), the engine is never asked,
 *             and no storage scope is minted. Kills M-F5.
 *
 * Run: node scripts/deepfix2/cutover-a-compose-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/cutover-a-compose-pure.json
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  composeReviewSessionV2,
  composeNewTestV2,
  composeKeyScope,
  getOrCreateComposeKey,
  discardComposeKey,
  classifyThrownRefusal,
  refusalReasonText,
  rv2DistractorPool,
  rv2ServedTypedWords,
  rv2TestConfigOverride,
} from "../../src/services/reviewV2Compose.js";
import { ReviewV2Error, RV2 } from "../../src/services/reviewV2Client.js";

// The REAL buildTestConfig (src/utils/testConfig.js) — the boundary the F
// cases certify. Its `./studyAlgorithm` specifier is extensionless
// (Vite-style), which node ESM cannot resolve, so the ON-DISK BYTES are
// loaded with only that specifier absolutized. The bytes are asserted below,
// so a drifted testConfig.js fails loudly instead of silently testing a copy.
const TESTCONFIG_URL = new URL("../../src/utils/testConfig.js", import.meta.url);
const STUDYALGO_HREF = new URL("../../src/utils/studyAlgorithm.js", import.meta.url).href;
const tcSrc = readFileSync(TESTCONFIG_URL, "utf8");
if (!tcSrc.includes("originalWordPool: wordPool")) {
  console.error("FATAL: testConfig.js drifted — the 'originalWordPool: wordPool' contract line is gone; re-anchor the F cases");
  process.exit(2);
}
const { buildTestConfig } = await import(
  "data:text/javascript;base64," +
  Buffer.from(tcSrc.replaceAll("'./studyAlgorithm'", `'${STUDYALGO_HREF}'`)).toString("base64")
);

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

/** Per-test fake sessionStorage. */
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    _dump: () => Object.fromEntries(m),
  };
}

const IDS = { uid: "u1", classId: "c1", listId: "l1", logicalDay: 2 };

/** A canonical successful composeSession payload. Queue order ≠ presented
 *  order BY CONSTRUCTION so sourcing the test set from the queue (M-C4) is
 *  detectable, and the presented set is a strict subset in a shuffled order. */
const QUEUE_IDS = ["w0", "w1", "w2", "w3", "w4", "w5"];
const PRESENTED_IDS = ["w4", "w1", "w5", "w2"]; // shuffled subset — NOT queue order
function composedSessionResult() {
  return {
    status: "composed",
    queue: {
      queueId: "c1_l1_d2_e0",
      orderedQueueWordIds: [...QUEUE_IDS],
      snapshot: { threshold: 92, queueSize: 6, testSize: 4, reviewTestType: "mcq" },
      logicalDay: 2,
      resetEpoch: 0,
    },
    presentation: {
      presentationId: "c1_l1_d2_e0_p1",
      presentedWordIds: [...PRESENTED_IDS],
      testType: "mcq",
      compositionVersion: "lrt-v1",
    },
    gatePosture: { effectiveEnabled: true, threshold: 92, configVersion: 1, source: "compose" },
  };
}
const NEW_PRESENTED = ["w9", "w10", "w11"]; // canonical order (new-day path)
function composedNewResult() {
  return {
    status: "composed",
    presentation: {
      presentationId: "c1_l1_d2_e0_n1",
      presentedWordIds: [...NEW_PRESENTED],
      testType: "mcq",
      compositionVersion: "new-day",
      rangeStartIndex: 9, rangeEndIndex: 11,
    },
    gatePosture: { effectiveEnabled: true, threshold: 92, configVersion: 1, source: "new-compose" },
  };
}

// ===========================================================================
CASE("ORDER — the envelope is VERBATIM: members AND order of both sets (kills M-C4)");
{
  const storage = fakeStorage();
  const seen = [];
  const res = await composeReviewSessionV2(IDS, {
    storage,
    composeSessionFn: async (req) => { seen.push(req); return composedSessionResult(); },
  });
  check("outcome", res.outcome, "composed");
  check("presentationId", res.presentationId, "c1_l1_d2_e0_p1");
  // THE C4-killing assertion: the TEST set is presentedWordIds — exact
  // membership AND exact order, and it is NOT the queue set/order.
  check("presented verbatim", res.presentedWordIds, PRESENTED_IDS);
  check("queue verbatim", res.queueWordIds, QUEUE_IDS);
  checkTrue("presented differs from queue (fixture is able to tell them apart)",
    JSON.stringify(res.presentedWordIds) !== JSON.stringify(res.queueWordIds));
  check("testType", res.testType, "mcq");
  check("resetEpoch", res.resetEpoch, 0);
  check("request carried classId/listId/logicalDay",
    [seen[0].classId, seen[0].listId, seen[0].logicalDay], ["c1", "l1", 2]);
  checkTrue("request carried a token-law composeKey", /^[A-Za-z0-9._-]{8,128}$/.test(seen[0].composeKey));
}

CASE("ORDER — composeNewTestV2 envelope verbatim (other path)");
{
  const storage = fakeStorage();
  const res = await composeNewTestV2(IDS, {
    storage,
    composeNewTestFn: async () => composedNewResult(),
  });
  check("outcome", res.outcome, "composed");
  check("presented verbatim", res.presentedWordIds, NEW_PRESENTED);
  check("range", [res.rangeStartIndex, res.rangeEndIndex], [9, 11]);
  check("presentationId family", res.presentationId, "c1_l1_d2_e0_n1");
}

// ===========================================================================
CASE("C9/V5 — key persistence: same scope ⇒ SAME key (reload/replay); freshKey ⇒ NEW key (kills M-C5)");
{
  const storage = fakeStorage();
  const keys = [];
  const deps = { storage, composeSessionFn: async ({ composeKey }) => { keys.push(composeKey); return composedSessionResult(); } };
  await composeReviewSessionV2(IDS, deps);                          // first compose
  await composeReviewSessionV2(IDS, deps);                          // "reload" — same scope
  check("reload reuses the persisted key", keys[1], keys[0]);
  await composeReviewSessionV2({ ...IDS, freshKey: true }, deps);   // deliberate retake
  checkTrue("retake mints a NEW key", keys[2] !== keys[0]);         // M-C5 goes green here if freshKey is ignored
  await composeReviewSessionV2(IDS, deps);                          // after retake: the NEW key is now the persisted one
  check("post-retake persists the retake key", keys[3], keys[2]);
  // Scopes are independent: the new-test kind has its own key.
  const nkeys = [];
  await composeNewTestV2(IDS, { storage, composeNewTestFn: async ({ composeKey }) => { nkeys.push(composeKey); return composedNewResult(); } });
  checkTrue("review and new kinds have distinct keys", nkeys[0] !== keys[2]);
  // Direct primitive checks.
  const scope = composeKeyScope({ ...IDS, kind: "review" });
  check("scope shape", scope, "rv2ck.u1.c1.l1.d2.review");
  const k1 = getOrCreateComposeKey(scope, { storage });
  check("getOrCreate recovers the persisted key", k1, keys[2]);
  discardComposeKey(scope, { storage });
  const k2 = getOrCreateComposeKey(scope, { storage });
  checkTrue("discard forces a fresh mint", k2 !== k1);
  // A malformed stored value is discarded and re-minted (token law).
  storage.setItem(scope, "not valid!!");
  const k3 = getOrCreateComposeKey(scope, { storage });
  checkTrue("malformed stored key re-minted", /^[A-Za-z0-9._-]{8,128}$/.test(k3) && k3 !== "not valid!!");
}

// ===========================================================================
CASE("C3 — DATA-channel refusals: not-serving pair ⇒ legacy; authority refusals ⇒ blocked with a reason");
{
  const legacyStatuses = ["config_hold", "review_v2_dark"];
  for (const status of legacyStatuses) {
    const res = await composeReviewSessionV2(IDS, {
      storage: fakeStorage(), composeSessionFn: async () => ({ status }),
    });
    check(`${status} ⇒ legacy`, [res.outcome, res.status], ["legacy", status]);
  }
  const blockedStatuses = [
    RV2.CLIENT_VERSION_STALE, RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH,
    RV2.QUEUE_INVALID, RV2.EMPTY_POOL, RV2.LIST_END, RV2.DAY_GUARD_REJECTED,
    RV2.PRESENTATION_INVALID, RV2.LIST_WORDS_MALFORMED, RV2.NO_EVIDENCE,
    RV2.VISIT_INVALID, RV2.REUSE_ANCHOR_MISMATCH, RV2.GRADE_UNUSABLE,
  ];
  for (const status of blockedStatuses) {
    const res = await composeReviewSessionV2(IDS, {
      storage: fakeStorage(), composeSessionFn: async () => ({ status }),
    });
    check(`${status} ⇒ blocked`, res.outcome, "blocked");
    checkTrue(`${status} carries a rendered reason`, typeof res.reason === "string" && res.reason.length > 0);
  }
  // The UNKNOWN-status law: a future status this client does not know must
  // render the GENERIC reason — never blank, never a silent legacy fallback.
  const unknown = await composeReviewSessionV2(IDS, {
    storage: fakeStorage(), composeSessionFn: async () => ({ status: "some_future_status_v9" }),
  });
  check("unknown status ⇒ blocked", unknown.outcome, "blocked");
  check("unknown status ⇒ the generic reason", unknown.reason, refusalReasonText("some_future_status_v9"));
  checkTrue("generic reason is non-empty", unknown.reason.length > 0);
  // Malformed / empty responses fail closed as blocked-with-reason.
  for (const bad of [null, undefined, {}, { status: "composed" }, { status: "composed", presentation: {}, queue: {} }]) {
    const res = await composeReviewSessionV2(IDS, {
      storage: fakeStorage(), composeSessionFn: async () => bad,
    });
    check(`malformed ${JSON.stringify(bad)} ⇒ blocked`, res.outcome, "blocked");
    checkTrue("malformed carries a reason", typeof res.reason === "string" && res.reason.length > 0);
  }
}

// ===========================================================================
CASE("V5 — compose_key_reused / invalid_compose_key: BLOCK and DISCARD the dead key");
{
  for (const status of [RV2.COMPOSE_KEY_REUSED, RV2.INVALID_COMPOSE_KEY]) {
    const storage = fakeStorage();
    const keys = [];
    const deps = { storage, composeSessionFn: async ({ composeKey }) => { keys.push(composeKey); return { status }; } };
    const res = await composeReviewSessionV2(IDS, deps);
    check(`${status} ⇒ blocked`, res.outcome, "blocked");
    checkTrue(`${status} reason rendered`, typeof res.reason === "string" && res.reason.length > 0);
    const scope = composeKeyScope({ ...IDS, kind: "review" });
    check(`${status} discarded the stored key`, storage.getItem(scope), null);
    // The NEXT deliberate entry mints a fresh key (no silent auto-retry loop:
    // exactly ONE compose call happened above).
    check("exactly one compose call (no auto-retry loop)", keys.length, 1);
    deps.composeSessionFn = async ({ composeKey }) => { keys.push(composeKey); return composedSessionResult(); };
    const next = await composeReviewSessionV2(IDS, deps);
    check("next deliberate entry composes", next.outcome, "composed");
    checkTrue("next entry used a FRESH key", keys[1] !== keys[0]);
  }
}

// ===========================================================================
CASE("C8 — THROWN channel: the not-serving trio ⇒ legacy (both code forms); other throws ⇒ blocked with reason");
{
  const legacyCodes = [
    "not-found", "permission-denied", "failed-precondition",
    "functions/not-found", "functions/permission-denied", "functions/failed-precondition",
  ];
  for (const code of legacyCodes) {
    const res = await composeReviewSessionV2(IDS, {
      storage: fakeStorage(),
      composeSessionFn: async () => { throw new ReviewV2Error(code, `thrown ${code}`); },
    });
    check(`thrown ${code} ⇒ legacy`, [res.outcome, res.code], ["legacy", code]);
    check(`classifyThrownRefusal(${code})`, classifyThrownRefusal(new ReviewV2Error(code, "x")), "legacy");
  }
  const blockedCodes = ["internal", "unauthenticated", "invalid-argument", "unavailable", "deadline-exceeded", "functions/internal"];
  for (const code of blockedCodes) {
    const res = await composeReviewSessionV2(IDS, {
      storage: fakeStorage(),
      composeSessionFn: async () => { throw new ReviewV2Error(code, `thrown ${code}`); },
    });
    check(`thrown ${code} ⇒ blocked`, res.outcome, "blocked");
    checkTrue(`thrown ${code} carries a reason`, typeof res.reason === "string" && res.reason.length > 0);
    check(`classifyThrownRefusal(${code}) is null`, classifyThrownRefusal(new ReviewV2Error(code, "x")), null);
  }
  // A code-less throw (programming error) still renders a reason.
  const bare = await composeReviewSessionV2(IDS, {
    storage: fakeStorage(), composeSessionFn: async () => { throw new Error("boom"); },
  });
  check("bare Error ⇒ blocked", bare.outcome, "blocked");
  checkTrue("bare Error carries a reason", typeof bare.reason === "string" && bare.reason.length > 0);
  // The same trio routes composeNewTestV2 to legacy (other path).
  const newLeg = await composeNewTestV2(IDS, {
    storage: fakeStorage(),
    composeNewTestFn: async () => { throw new ReviewV2Error("failed-precondition", "list not assigned"); },
  });
  check("new-test thrown failed-precondition ⇒ legacy", newLeg.outcome, "legacy");
}

// ===========================================================================
CASE("C3/new — composeNewTestV2 refusal parity (data channel)");
{
  for (const [status, want] of [
    ["review_v2_dark", "legacy"], ["config_hold", "legacy"],
    ["day_guard_rejected", "blocked"], ["list_end", "blocked"], ["compose_key_reused", "blocked"],
    ["totally_unknown_status", "blocked"],
  ]) {
    const res = await composeNewTestV2(IDS, {
      storage: fakeStorage(), composeNewTestFn: async () => ({ status }),
    });
    check(`new-test ${status} ⇒ ${want}`, res.outcome, want);
    if (want === "blocked") checkTrue(`new-test ${status} reason`, typeof res.reason === "string" && res.reason.length > 0);
  }
}

// ===========================================================================
// OPUS AUDIT FOLD (2026-08-04) — the testConfig BOUNDARY: what the pages hand
// to MCQTest/TypedTest flag-on, built through the REAL buildTestConfig.
// ===========================================================================
const W = (id) => ({ id, word: `word-${id}`, definition: `def-${id}` });
const SERVED = ["w4", "w1", "w5"].map(W);                        // engine order — NOT sorted, NOT queue order
const QUEUE_POOL = ["w0", "w1", "w2", "w3", "w4", "w5"].map(W);  // the day queue — the full flag-on universe

CASE("F3/F6 — boundary: FULL distractor pool, presented order verbatim (kills M-F3)");
{
  const cfg = rv2TestConfigOverride({
    baseConfig: buildTestConfig({
      assignment: { testOptionsCount: 4, passThreshold: 95, reviewTestSizeMax: 60 },
      wordPool: rv2DistractorPool({ words: SERVED, poolWords: QUEUE_POOL }),
      testType: "review",
      sessionContext: { dayNumber: 5, wordRangeStart: 21, wordRangeEnd: 30 },
    }),
    testPhase: "review",
    rv2: { presentationId: "p1", testType: "mcq", logicalDay: 5, resetEpoch: 0,
           words: SERVED, poolWords: QUEUE_POOL },
  });
  check("wordsToTest is the presentation VERBATIM (members AND order)",
    cfg.wordsToTest.map((w) => w.id), ["w4", "w1", "w5"]);
  // THE M-F3-killing assertion: a 3-word presentation still draws distractors
  // from the FULL day universe, exactly as legacy passes the full wordPool.
  check("originalWordPool contains the WHOLE day queue",
    [...cfg.originalWordPool.map((w) => w.id)].sort(), ["w0", "w1", "w2", "w3", "w4", "w5"]);
  checkTrue("pool is STRICTLY larger than the presented set",
    cfg.originalWordPool.length > cfg.wordsToTest.length);
  const poolIds = new Set(cfg.originalWordPool.map((w) => w.id));
  checkTrue("legacy invariant: wordsToTest ⊆ originalWordPool",
    cfg.wordsToTest.every((w) => poolIds.has(w.id)));
  // The concrete harm F3 named: a 3-word engine test rendered 3-option
  // questions (2 distractors). With the full pool, 4 options are possible
  // for EVERY presented word at optionsCount 4.
  checkTrue("4-option questions possible for every presented word",
    cfg.wordsToTest.every((w) =>
      cfg.originalWordPool.filter((o) => o.id !== w.id).length >= cfg.testOptionsCount - 1));
  check("pool has no duplicates",
    cfg.originalWordPool.length, new Set(cfg.originalWordPool.map((w) => w.id)).size);
  check("rv2 handle for the SUBMIT fold", cfg.rv2,
    { presentationId: "p1", testType: "mcq", logicalDay: 5, resetEpoch: 0, source: "composeSession" });
  check("input SERVED not mutated", SERVED.map((w) => w.id), ["w4", "w1", "w5"]);
  // rv2DistractorPool unit legs.
  check("pool order = presented first (verbatim), then queue remainder",
    rv2DistractorPool({ words: SERVED, poolWords: QUEUE_POOL }).map((w) => w.id),
    ["w4", "w1", "w5", "w0", "w2", "w3"]);
  check("missing poolWords ⇒ presented alone (degraded, never broken)",
    rv2DistractorPool({ words: SERVED }).map((w) => w.id), ["w4", "w1", "w5"]);
  check("non-array poolWords tolerated",
    rv2DistractorPool({ words: SERVED, poolWords: null }).map((w) => w.id), ["w4", "w1", "w5"]);
}

CASE("F2 — REVIEW range label NULLED (dead segment); NEW range passes through (kills M-F2)");
{
  const mk = (testPhase) => rv2TestConfigOverride({
    baseConfig: buildTestConfig({
      assignment: { testOptionsCount: 4 },
      wordPool: QUEUE_POOL,
      testType: testPhase,
      sessionContext: { dayNumber: 5, wordRangeStart: 21, wordRangeEnd: 30 },
    }),
    testPhase,
    rv2: { presentationId: "p", testType: "mcq", logicalDay: 5, resetEpoch: 0,
           words: SERVED, poolWords: QUEUE_POOL },
  });
  const review = mk("review");
  // THE M-F2-killing assertions: the dead segment range must NOT survive to
  // the review page ("Words #21–30" would describe a set that no longer exists).
  check("review wordRangeStart is null", review.wordRangeStart, null);
  check("review wordRangeEnd is null", review.wordRangeEnd, null);
  // null, not undefined: the keys survive JSON (sessionStorage blob shape stable).
  const jsonRoundTrip = JSON.parse(JSON.stringify(review));
  check("keys survive JSON as null", ["wordRangeStart" in jsonRoundTrip, jsonRoundTrip.wordRangeStart], [true, null]);
  // Both consumers (SessionProgressSheet:152, SessionSteps:106) gate the whole
  // line on `start && end` — falsy hides it, so the header reads "Day N" honestly.
  checkTrue("falsy ⇒ the 'Words #a–b' line is hidden by both consumers",
    !(review.wordRangeStart && review.wordRangeEnd));
  const freshNew = mk("new");
  check("NEW-test range passes through untouched (V1.3: new indices stay meaningful)",
    [freshNew.wordRangeStart, freshNew.wordRangeEnd], [21, 30]);
  check("NEW-test source", freshNew.rv2.source, "composeNewTest");
}

CASE("F4 — a server-composed typed set is NEVER truncated (kills M-F4)");
{
  const sixty = Array.from({ length: 60 }, (_, i) => W(`t${i}`));
  const served60 = rv2ServedTypedWords(sixty);
  // THE M-F4-killing assertion: 60 served ⇒ 60 rendered. The old cap (50)
  // made the engine-derived denominator unreachable: 50/60 = 83% < 95%.
  check("60 served ⇒ 60 rendered", served60.length, 60);
  check("order verbatim", served60.map((w) => w.id), sixty.map((w) => w.id));
  checkTrue("defensive copy (not the same array)", served60 !== sixty);
  // No hidden cap at ANY size — a bigger silent cap recreates the bug at a
  // new number (the F4 decision: the ENGINE is the sizer).
  check("120 served ⇒ 120 rendered (no cap at any size)",
    rv2ServedTypedWords(Array.from({ length: 120 }, (_, i) => W(`u${i}`))).length, 120);
  check("empty tolerated", rv2ServedTypedWords([]).length, 0);
}

CASE("F5 — invalid logicalDay: OBSERVABLE legacy on BOTH surfaces, engine never asked (kills M-F5)");
{
  const badDays = [undefined, null, 0, -1, 1.5, "3", NaN];
  for (const day of badDays) {
    for (const [label, fn, depKey, payload] of [
      ["review", composeReviewSessionV2, "composeSessionFn", composedSessionResult],
      ["new", composeNewTestV2, "composeNewTestFn", composedNewResult],
    ]) {
      const storage = fakeStorage();
      const logs = [];
      let composeCalls = 0;
      const res = await fn(
        { uid: "u1", classId: "c1", listId: "l1", logicalDay: day },
        { storage, [depKey]: async () => { composeCalls++; return payload(); },
          logInvalidDay: (...a) => logs.push(a) },
      );
      const tag = `${label}/${String(day)}`;
      check(`${tag} ⇒ legacy`, res.outcome, "legacy");
      // THE M-F5-killing assertions: the fallback NAMES itself and LOGS —
      // a silent legacy slide (the original bug) fails both.
      check(`${tag} via invalid_day`, res.via, "invalid_day");
      check(`${tag} logged exactly once`, logs.length, 1);
      check(`${tag} engine never asked`, composeCalls, 0);
      check(`${tag} no storage scope minted`, Object.keys(storage._dump()).length, 0);
    }
  }
  // Boundary: day 1 is VALID and composes.
  const ok = await composeReviewSessionV2(
    { uid: "u1", classId: "c1", listId: "l1", logicalDay: 1 },
    { storage: fakeStorage(), composeSessionFn: async () => composedSessionResult() },
  );
  check("day 1 composes (boundary)", ok.outcome, "composed");
  // The guard runs BEFORE freshKey discard/mint — storage untouched even then.
  const st = fakeStorage();
  await composeReviewSessionV2(
    { uid: "u1", classId: "c1", listId: "l1", logicalDay: undefined, freshKey: true },
    { storage: st, composeSessionFn: async () => composedSessionResult(), logInvalidDay: () => {} },
  );
  check("freshKey + invalid day leaves storage untouched (guard runs first)",
    Object.keys(st._dump()).length, 0);
}

// ===========================================================================
// RECEIPT PATH IS OVERRIDABLE [independent audit F1, structurally fixed 2026-08-04].
// The mutant driver runs THIS fixture with a mutant applied, and this write used to
// be unconditional — so whichever ran last won, and a mutants-last run left the pure
// receipt saying `pass:false` with a MUTANT's source sha while the published claim
// said 117/0. The claim was true; the artifact contradicted it. Re-running in a
// lucky order is a WORKAROUND, not a fix: it leaves the landmine armed for the next
// person. The driver now redirects this to a temp path, so a mutant run can never
// overwrite the canonical receipt regardless of order.
const evidencePath = process.env.CUTOVER_A_PURE_RECEIPT
  ? new URL(`file://${process.env.CUTOVER_A_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/cutover-a-compose-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "cutover-a-compose-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/reviewV2Compose.js": sha16("../../src/services/reviewV2Compose.js"),
    "src/services/reviewV2Client.js": sha16("../../src/services/reviewV2Client.js"),
    // The F cases (Opus audit fold) run the REAL buildTestConfig — bind it.
    "src/utils/testConfig.js": sha16("../../src/utils/testConfig.js"),
    "src/utils/studyAlgorithm.js": sha16("../../src/utils/studyAlgorithm.js"),
    "scripts/deepfix2/cutover-a-compose-fixtures.mjs": sha16("./cutover-a-compose-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ncutover-a-compose PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
