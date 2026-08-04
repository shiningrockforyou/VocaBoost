#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-C COMPLETE — PURE client fixtures (no Firebase, no network)
 * ============================================================================
 * Exercises the REAL `src/services/reviewV2Complete.js` (the module MCQTest /
 * TypedTest call behind REVIEW_V2_CLIENT, at the completeSessionFromTest call
 * sites) with an injected `completeDayFn`, proving the client-side laws of
 * the fold ledger:
 *
 *   V2/MAPPING  `rv2CompletionAttemptIds` — the attempt-id slot mapping is
 *               pure: kind='new' fills newTestAttemptId (consumed stays
 *               null·null); kind='review' fills consumedAttemptId +
 *               consumedAttemptClassId (the r57 null-IFF-null binding holds
 *               even on a malformed attemptId) and passes the CALLER-resolved
 *               dayNewTestAttemptId straight through (or null).
 *   A2/CENSUS   every completeDay status maps to its contracted outcome:
 *               terminal completed/already_completed (V3 — BOTH land on
 *               'completed', already_completed carries replayed:true and
 *               derives its payload from `.completion` when the top-level
 *               fields are absent) · config_hold/review_v2_dark/[in-txn race]
 *               class_not_found/not_enrolled/list_not_assigned ⇒ legacy as
 *               data · the thrown trio (bare + 'functions/'-prefixed) ⇒
 *               legacy via classifyThrownRefusal · client_version_stale ⇒
 *               blocked · no_evidence/day_guard_rejected/reset_in_progress/
 *               reset_epoch_mismatch/list_words_malformed ⇒ blocked with a
 *               rendered reason · unknown/malformed ⇒ blocked with the
 *               generic reason, never a blank screen · a non-legacy thrown
 *               error ⇒ blocked+retryable, never silently swallowed.
 *   GUARD       a malformed request (missing classId/listId, a bad
 *               logicalDay, or a violation of the r57 null-IFF-null binding)
 *               is refused CLIENT-SIDE — completeDayFn is NEVER called.
 *   C2/STATIC   FLAG-OFF PARITY, checked line by line against the page
 *               source bytes: the legacy completeSessionFromTest call + its
 *               exact argument block + its 3 status checks survive verbatim
 *               (now inside an `else` branch cutover-c added), REVIEW_V2_CLIENT
 *               ships false, and the new engine branch is gated on
 *               `rv2Handle && !rv2Fallback` — reducing flag-off to today by
 *               construction (rv2Handle is null; the branch never runs).
 *   C6          the page/call-site boundary: rv2CompletionAttemptIds itself
 *               (the extracted pure builder) PLUS anchor checks against the
 *               real MCQTest.jsx/TypedTest.jsx bytes proving the NEW wiring
 *               (kind derivation, the getNewWordAttemptForDay call shape, the
 *               rv2CompletionAttemptIds/completeDayV2 call shapes, the
 *               3-way outcome branch) is actually present at BOTH call
 *               sites — cutover-a's audit found defects hide when no fixture
 *               touches the pages themselves, not just the adapter.
 *   E1 CARVE    DailySessionFlow.jsx's empty-review auto-complete
 *               (`completeSession`, ~line 1727) imports NEITHER
 *               reviewV2Complete.js nor completeDayV2 — it has no attempt
 *               evidence (completeDay would refuse no_evidence), so it STAYS
 *               LEGACY, unrouted, exactly as the ledger requires.
 *
 * Run: node scripts/deepfix2/cutover-c-complete-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/cutover-c-complete-pure.json
 * (CUTOVER_C_PURE_RECEIPT env redirects the receipt — the mutant driver uses
 * it so a mutant run can never clobber the canonical receipt.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  rv2CompletionAttemptIds,
  completeDayV2,
} from "../../src/services/reviewV2Complete.js";
import { ReviewV2Error, RV2 } from "../../src/services/reviewV2Client.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

const IDS = { classId: "c1", listId: "l1", logicalDay: 2 };

// ===========================================================================
CASE("V2/MAPPING — rv2CompletionAttemptIds: the attempt-id slot mapping (pure)");
{
  check("kind='new' fills newTestAttemptId; consumed stays null·null",
    rv2CompletionAttemptIds({ kind: "new", attemptId: "rv2_u1_pNEW", classId: "c1" }),
    { consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: "rv2_u1_pNEW" });

  check("kind='new' ignores dayNewTestAttemptId (never a prior review this day)",
    rv2CompletionAttemptIds({ kind: "new", attemptId: "rv2_u1_pNEW", classId: "c1", dayNewTestAttemptId: "SHOULD_NOT_APPEAR" }),
    { consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: "rv2_u1_pNEW" });

  check("kind='review' fills consumedAttemptId + consumedAttemptClassId; newTestAttemptId passthrough",
    rv2CompletionAttemptIds({ kind: "review", attemptId: "rv2_u1_pREV", classId: "c1", dayNewTestAttemptId: "rv2_u1_pNEW" }),
    { consumedAttemptId: "rv2_u1_pREV", consumedAttemptClassId: "c1", newTestAttemptId: "rv2_u1_pNEW" });

  check("kind='review', review-only day (no dayNewTestAttemptId) ⇒ newTestAttemptId null",
    rv2CompletionAttemptIds({ kind: "review", attemptId: "rv2_u1_pREV", classId: "c1" }),
    { consumedAttemptId: "rv2_u1_pREV", consumedAttemptClassId: "c1", newTestAttemptId: null });

  check("r57 binding holds even on a malformed attemptId — consumedAttemptClassId follows to null",
    rv2CompletionAttemptIds({ kind: "review", attemptId: "", classId: "c1", dayNewTestAttemptId: "rv2_u1_pNEW" }),
    { consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: "rv2_u1_pNEW" });

  check("a non-string attemptId degrades to null, never a crash",
    rv2CompletionAttemptIds({ kind: "review", attemptId: 12345, classId: "c1" }),
    { consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: null });

  check("a malformed dayNewTestAttemptId (empty string) degrades to null",
    rv2CompletionAttemptIds({ kind: "review", attemptId: "rv2_u1_pREV", classId: "c1", dayNewTestAttemptId: "" }),
    { consumedAttemptId: "rv2_u1_pREV", consumedAttemptClassId: "c1", newTestAttemptId: null });
}

// ===========================================================================
CASE("A2/CENSUS — completed: the fresh winner's payload translates onto {sessionId,progress,graduated}");
{
  const seen = [];
  const res = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1", newTestAttemptId: "a2" },
    { completeDayFn: async (args) => { seen.push(args); return {
      status: "completed", completionId: "l1_d2_e0", evidenceKind: "standard",
      graduationCount: 3, graduatedWordIds: ["w1", "w2", "w3"], correctCount: 5,
      eligibleFillCount: 0, streakCredited: true, advancedToDay: 2, newTwi: 13,
    }; } }
  );
  check("exactly one completeDay call", seen.length, 1);
  check("request is EXACTLY the 6 completeDay fields",
    Object.keys(seen[0]).sort(),
    ["classId", "consumedAttemptClassId", "consumedAttemptId", "listId", "logicalDay", "newTestAttemptId"].sort());
  check("outcome", res.outcome, "completed");
  check("replayed false on a fresh win", res.replayed, false);
  check("sessionId is null — no legacy sessions-doc concept under the engine", res.sessionId, null);
  check("progress = {currentStudyDay: advancedToDay, totalWordsIntroduced: newTwi}",
    res.progress, { currentStudyDay: 2, totalWordsIntroduced: 13 });
  check("graduated = graduationCount", res.graduated, 3);
  check("streakCredited surfaced", res.streakCredited, true);
  check("evidenceKind surfaced", res.evidenceKind, "standard");
}

// ===========================================================================
CASE("A2/CENSUS — already_completed IS A TERMINAL SUCCESS (V3), never dayGuardRejected");
{
  const res = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1", newTestAttemptId: null },
    { completeDayFn: async () => ({
      status: "already_completed", completionId: "l1_d2_e0",
      completion: {
        logicalDay: 2, evidenceKind: "list_end_review_only",
        graduationCount: 1, completedTwi: 10,
      },
    }) }
  );
  checkTrue("NEVER dayGuardRejected-shaped — outcome is completed, not blocked", res.outcome === "completed");
  check("outcome", res.outcome, "completed");
  check("replayed true — the SAME shape cutover-b established for attempt_written{replayed:true}", res.replayed, true);
  check("payload derived from .completion when top-level fields are absent",
    [res.progress, res.graduated], [{ currentStudyDay: 2, totalWordsIntroduced: 10 }, 1]);
  check("streakCredited false — no NEW credit on a replay (the winner already credited it)", res.streakCredited, false);
  check("evidenceKind falls back to .completion.evidenceKind", res.evidenceKind, "list_end_review_only");

  // The H-B view-catch-up sub-variant carries viewAdvanced — same outward shape.
  const viewCatchup = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1", newTestAttemptId: null },
    { completeDayFn: async () => ({
      status: "already_completed", completionId: "l1_d2_e0", viewAdvanced: true,
      completion: { logicalDay: 2, evidenceKind: "standard", graduationCount: 0, completedTwi: 15 },
    }) }
  );
  check("viewAdvanced still lands on the SAME completed envelope",
    [viewCatchup.outcome, viewCatchup.replayed, viewCatchup.progress],
    ["completed", true, { currentStudyDay: 2, totalWordsIntroduced: 15 }]);
}

// ===========================================================================
CASE("A2/CENSUS — not-serving DATA statuses ⇒ legacy (config_hold/review_v2_dark/in-txn-race trio)");
{
  for (const status of [RV2.CONFIG_HOLD, RV2.REVIEW_V2_DARK, RV2.CLASS_NOT_FOUND, RV2.NOT_ENROLLED, RV2.LIST_NOT_ASSIGNED]) {
    const res = await completeDayV2(
      { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
      { completeDayFn: async () => ({ status }) }
    );
    check(`${status} ⇒ legacy via status`, [res.outcome, res.via, res.status], ["legacy", "status", status]);
  }
}

// ===========================================================================
CASE("A2/CENSUS — client_version_stale ⇒ blocked (force refresh), never a silent legacy fallback");
{
  const res = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
    { completeDayFn: async () => ({ status: RV2.CLIENT_VERSION_STALE, minClientVersion: 2 }) }
  );
  check("outcome", res.outcome, "blocked");
  check("status preserved", res.status, RV2.CLIENT_VERSION_STALE);
  checkTrue("reason rendered (shared reviewV2Compose.js copy)", res.reason.length > 0);
}

// ===========================================================================
CASE("A2/CENSUS — refusals as DATA: no_evidence/day_guard_rejected/reset_in_progress/reset_epoch_mismatch/list_words_malformed");
{
  const cases = [
    [RV2.NO_EVIDENCE, "consumed attempt not passing"],
    [RV2.DAY_GUARD_REJECTED, undefined],
    [RV2.RESET_IN_PROGRESS, undefined],
    [RV2.RESET_EPOCH_MISMATCH, undefined],
    [RV2.LIST_WORDS_MALFORMED, undefined],
  ];
  const seenReasons = new Set();
  for (const [status, reason] of cases) {
    const res = await completeDayV2(
      { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
      { completeDayFn: async () => ({ status, ...(reason ? { reason } : {}) }) }
    );
    check(`${status} ⇒ blocked`, res.outcome, "blocked");
    check(`${status} status preserved`, res.status, status);
    checkTrue(`${status} reason rendered`, typeof res.reason === "string" && res.reason.length > 0);
    seenReasons.add(res.reason);
  }
  check("every refusal in this set renders a DISTINCT reason (no accidental collapse)", seenReasons.size, cases.length);

  // no_evidence's copy matches the EXISTING completionNotApplied UX verbatim
  // (MCQTest.jsx/TypedTest.jsx today) — the SAME situation, not a new message.
  const mcqSrc = readFileSync(new URL("../../src/pages/MCQTest.jsx", import.meta.url), "utf8");
  const noEvidenceRes = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
    { completeDayFn: async () => ({ status: RV2.NO_EVIDENCE, reason: "x" }) }
  );
  // Re-escape the apostrophe the same way MCQTest.jsx's single-quoted JS
  // string literal does (\'), so comparing the DECODED runtime string against
  // the RAW source bytes doesn't spuriously fail on the escape character.
  checkTrue("no_evidence reason text matches the legacy completionNotApplied copy verbatim",
    mcqSrc.includes(noEvidenceRes.reason.replace(/'/g, "\\'")));
}

// ===========================================================================
CASE("A2/CENSUS — unknown/malformed status ⇒ blocked with the GENERIC reason, never a blank screen");
{
  const res = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
    { completeDayFn: async () => ({ status: "some_future_status_this_client_does_not_know" }) }
  );
  check("outcome", res.outcome, "blocked");
  check("unknown status preserved (never silently swallowed)", res.status, "some_future_status_this_client_does_not_know");
  checkTrue("generic reason rendered", res.reason.length > 0);

  const malformedRes = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
    { completeDayFn: async () => null }
  );
  check("null response ⇒ blocked malformed_response", [malformedRes.outcome, malformedRes.status], ["blocked", "malformed_response"]);
}

// ===========================================================================
CASE("THROWN — the trio (bare + 'functions/'-prefixed) ⇒ legacy via classifyThrownRefusal; anything else ⇒ blocked+retryable");
{
  for (const code of ["not-found", "permission-denied", "failed-precondition",
    "functions/not-found", "functions/permission-denied", "functions/failed-precondition"]) {
    const res = await completeDayV2(
      { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
      { completeDayFn: async () => { throw new ReviewV2Error(code, "nope"); } }
    );
    check(`thrown ${code} ⇒ legacy`, [res.outcome, res.via, res.code], ["legacy", "error", code]);
  }
  const teacherLike = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
    { completeDayFn: async () => { throw new ReviewV2Error("permission-denied", "not enrolled"); } }
  );
  check("a teacher/non-enrolled caller ⇒ legacy (mirrors cutover-b's SB-TEACHER)", teacherLike.outcome, "legacy");

  const genericThrow = await completeDayV2(
    { ...IDS, consumedAttemptId: "a1", consumedAttemptClassId: "c1" },
    { completeDayFn: async () => { throw new ReviewV2Error("internal", "server broke"); } }
  );
  check("a non-legacy thrown error ⇒ blocked, retryable, never silently swallowed",
    [genericThrow.outcome, genericThrow.code, genericThrow.retryable], ["blocked", "internal", true]);
  checkTrue("retryable reason rendered", genericThrow.reason.length > 0);
}

// ===========================================================================
CASE("GUARD — a malformed request is refused CLIENT-SIDE; completeDayFn is NEVER called");
{
  const malformed = [
    { classId: "", listId: "l1", logicalDay: 2 },
    { classId: "c1", listId: "", logicalDay: 2 },
    { classId: "c1", listId: "l1", logicalDay: 0 },
    { classId: "c1", listId: "l1", logicalDay: 1.5 },
    { classId: "c1", listId: "l1", logicalDay: 2, consumedAttemptId: "a1", consumedAttemptClassId: null }, // r57 violation
    { classId: "c1", listId: "l1", logicalDay: 2, consumedAttemptId: null, consumedAttemptClassId: "c1" }, // r57 violation
    { classId: "c1", listId: "l1", logicalDay: 2, consumedAttemptId: "", consumedAttemptClassId: "c1" },
    { classId: "c1", listId: "l1", logicalDay: 2, newTestAttemptId: "" },
  ];
  for (const args of malformed) {
    let calls = 0;
    const res = await completeDayV2(args, { completeDayFn: async () => { calls++; return { status: "completed" }; } });
    check(`malformed ${JSON.stringify(args)} ⇒ blocked malformed_request`, [res.outcome, res.status], ["blocked", "malformed_request"]);
    check("zero completeDay calls", calls, 0);
  }
}

// ===========================================================================
// C2 — FLAG-OFF PARITY, checked LINE BY LINE against the page source bytes
// (cutover-a/b's audit law: the static argument is checked, not accepted).
// ===========================================================================
const readSrc = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const mcqSrc = readSrc("../../src/pages/MCQTest.jsx");
const typedSrc = readSrc("../../src/pages/TypedTest.jsx");
const flagsSrc = readSrc("../../src/config/featureFlags.js");
const dsfSrc = readSrc("../../src/pages/DailySessionFlow.jsx");

CASE("C2/MCQ — the legacy completeSessionFromTest call + its 3 status checks are byte-identical (now inside an else)");
{
  const anchors = [
    // The gate: the SAME rv2Handle && !rv2Fallback test cutover-b's own
    // submit branch uses (line ~819) to skip the legacy write.
    "if (rv2Handle && !rv2Fallback) {",
    // The legacy call, byte-identical.
    "const completion = await completeSessionFromTest({",
    "userId: user.uid,\n                classId: classIdParam,\n                listId,\n                dayNumber: sessionContext.dayNumber,\n                isFirstDay: sessionContext.isFirstDay,\n                testType: currentTestType,",
    // The 3 status checks, exact message strings.
    "if (completion?.requiresNewWordRetake) {",
    "'이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다. (Day not complete — pass the new-word test first.)'",
    "if (completion?.requiresSessionRebuild) {",
    "if (completion?.completionNotApplied) {",
    "'아직 이 날을 완료할 수 없습니다. 답안은 저장되었어요. 새 단어 시험을 통과했는지 확인한 뒤 다시 시도하거나, 문제가 계속되면 페이지를 새로고침해 주세요. (This day can\\'t be completed yet — your answers are saved. Make sure the new-word test was passed, then retry; reload the page if this repeats.)'",
    "console.log('Session completed successfully from MCQTest')",
  ];
  anchors.forEach((a, i) => checkTrue(`MCQ anchor ${i + 1} present verbatim`, mcqSrc.includes(a)));
  check("exactly ONE completeSessionFromTest invocation site (the legacy one)",
    (mcqSrc.match(/completeSessionFromTest\(\{/g) || []).length, 1);
}

CASE("C2/TYPED — the legacy completeSessionFromTest call + its 3 status checks are byte-identical (now inside an else)");
{
  const anchors = [
    "if (rv2Handle && !rv2Fallback) {",
    "const completion = await completeSessionFromTest({",
    "if (completion?.requiresNewWordRetake) {",
    "'이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다.\\n(Day not complete — pass the new-word test first.)'",
    "if (completion?.requiresSessionRebuild) {",
    "if (completion?.completionNotApplied) {",
    "console.log('Session completed successfully from TypedTest')",
  ];
  anchors.forEach((a, i) => checkTrue(`TYPED anchor ${i + 1} present verbatim`, typedSrc.includes(a)));
  check("exactly ONE completeSessionFromTest invocation site (the legacy one)",
    (typedSrc.match(/completeSessionFromTest\(\{/g) || []).length, 1);
}

CASE("C2/FLAGS — REVIEW_V2_CLIENT ships FALSE (the gate at BOTH the submit and completion call sites)");
{
  checkTrue("REVIEW_V2_CLIENT = false", flagsSrc.includes("export const REVIEW_V2_CLIENT = false;"));
  check("exactly one assignment of REVIEW_V2_CLIENT", (flagsSrc.match(/export const REVIEW_V2_CLIENT = /g) || []).length, 1);
}

// ===========================================================================
// C6 — the page/call-site boundary: the NEW wiring is actually present, not
// only the adapter (cutover-a's audit law).
// ===========================================================================
CASE("C6/CALL-SITE — MCQTest.jsx: kind derivation, the id-resolution query, and the 3-way outcome branch");
{
  const anchors = [
    "const kind = rv2Handle.source === 'composeNewTest' ? 'new' : 'review'",
    "const dayNewAttempt = await getNewWordAttemptForDay(\n                  user.uid, classIdParam, listId, sessionContext.dayNumber,\n                  { listScope: LIST_SCOPED_RECON, expectedBase: sessionContext?.newWordStartIndex }\n                )",
    "const ids = rv2CompletionAttemptIds({\n                kind, attemptId: result?.id ?? null, classId: classIdParam, dayNewTestAttemptId\n              })",
    "const out = await completeDayV2({\n                classId: classIdParam, listId, logicalDay: sessionContext.dayNumber, ...ids\n              })",
    "if (out.outcome === 'completed') {",
    "} else if (out.outcome === 'legacy') {",
    "setSubmitError(out.reason)",
  ];
  anchors.forEach((a, i) => checkTrue(`MCQ call-site anchor ${i + 1} present verbatim`, mcqSrc.includes(a)));
  checkTrue("the import is present", mcqSrc.includes("import { rv2CompletionAttemptIds, completeDayV2 } from '../services/reviewV2Complete'"));
  check("exactly one completeDayV2 call site", (mcqSrc.match(/completeDayV2\(\{/g) || []).length, 1);
}

CASE("C6/CALL-SITE — TypedTest.jsx: kind derivation, the id-resolution query, and the 3-way outcome branch");
{
  const anchors = [
    "const kind = rv2Handle.source === 'composeNewTest' ? 'new' : 'review'",
    "const dayNewAttempt = await getNewWordAttemptForDay(",
    "const ids = rv2CompletionAttemptIds({",
    "const out = await completeDayV2({",
    "if (out.outcome === 'completed') {",
    "} else if (out.outcome === 'legacy') {",
    "setGradingError(out.reason)\n                setIsSubmitting(false)\n                return",
  ];
  anchors.forEach((a, i) => checkTrue(`TYPED call-site anchor ${i + 1} present verbatim`, typedSrc.includes(a)));
  checkTrue("the import is present", typedSrc.includes("import { rv2CompletionAttemptIds, completeDayV2 } from '../services/reviewV2Complete'"));
  check("exactly one completeDayV2 call site", (typedSrc.match(/completeDayV2\(\{/g) || []).length, 1);
}

// ===========================================================================
CASE("E1 CARVE — DailySessionFlow.jsx's empty-review auto-complete (completeSession) STAYS LEGACY, unrouted");
{
  checkTrue("DailySessionFlow.jsx never imports reviewV2Complete.js", !dsfSrc.includes("reviewV2Complete"));
  checkTrue("DailySessionFlow.jsx never calls completeDayV2", !dsfSrc.includes("completeDayV2"));
  checkTrue("its legacy recordSessionCompletion call survives verbatim",
    dsfSrc.includes("const result = await recordSessionCompletion(user.uid, summary)"));
}

// ===========================================================================
const evidencePath = process.env.CUTOVER_C_PURE_RECEIPT
  ? new URL(`file://${process.env.CUTOVER_C_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/cutover-c-complete-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "cutover-c-complete-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/reviewV2Complete.js": sha16("../../src/services/reviewV2Complete.js"),
    "src/services/reviewV2Client.js": sha16("../../src/services/reviewV2Client.js"),
    "src/services/reviewV2Compose.js": sha16("../../src/services/reviewV2Compose.js"),
    "src/pages/MCQTest.jsx": sha16("../../src/pages/MCQTest.jsx"),
    "src/pages/TypedTest.jsx": sha16("../../src/pages/TypedTest.jsx"),
    "src/pages/DailySessionFlow.jsx": sha16("../../src/pages/DailySessionFlow.jsx"),
    "src/config/featureFlags.js": sha16("../../src/config/featureFlags.js"),
    "scripts/deepfix2/cutover-c-complete-fixtures.mjs": sha16("./cutover-c-complete-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ncutover-c-complete PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
