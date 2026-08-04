#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-D REFUSALS — PURE fixtures (no Firebase, no network, no emulator)
 * ============================================================================
 * Proves the three deltas of the cutover-d-refusals-fold-ledger.md GROUP A
 * rows against the REAL bytes of the touched modules/pages — the same
 * "static source-text anchor" idiom cutover-b/c's own C2/STATIC + C6/CALL-
 * SITE cases established (grep-shaped `.includes()`/regex checks against the
 * real page source, since this repo has no React test runner — WSL cannot
 * run vite; see CLAUDE.md "UI FOLDS").
 *
 *   A1/C1  THE RECOMPOSE STATE-COLLISION FIX. On a SUCCESSFUL grade_unusable
 *          swap, MCQTest.jsx/TypedTest.jsx must NOT call `setError(out.reason)`
 *          (that state also gates the full-page "Something went wrong"
 *          interstitial — the exact bug V2 found) — they must render through
 *          each page's OWN pre-existing non-blocking treatment instead
 *          (MCQTest: submitError inline banner; TypedTest: gradingError
 *          kind:'transient'), whose own retry calls handleSubmit directly.
 *          Also verifies (against the REAL reviewV2Submit.js/reviewV2Compose.js,
 *          unmodified by this fold) that a `recomposed` outcome's `.compose`
 *          shape actually carries what the page code dereferences
 *          (testType/presentedWordIds/presentationId/logicalDay/resetEpoch),
 *          and that the interstitial GATE + its OWN "Try Again" (loadTestWords)
 *          + the swap-FAILURE catch + the "blocked" (2nd+ unusable) branch are
 *          all BYTE-UNCHANGED (bypass rows 2-4: fresh-word-set retry / no loop
 *          / a genuine hard error still full-page-blocks).
 *   A2/C2  THE reuse_anchor_mismatch COVERAGE GAP. `refusalReasonText` (the
 *          REAL reviewV2Compose.js) must return a SPECIFIC (non-generic)
 *          reason for RV2.REUSE_ANCHOR_MISMATCH, while an unknown/retired
 *          status (TYPED_MODALITY_DEFERRED — frozen-but-dead, per that file's
 *          own header) still falls through to the SAME generic text.
 *   A3/C5  TOKENIZATION. Grep-style: none of the six touched refusal render
 *          blocks (3 in MCQTest.jsx, 3 in TypedTest.jsx) contain a raw
 *          Tailwind red-/gray-/blue-/yellow- utility, a raw `bg-white`, or a
 *          raw `rounded-lg`, in EITHER the light or `dark:` form — extracted
 *          by unique start/end anchor pairs (verified singular before
 *          slicing, so a drifted anchor fails LOUD, never silently no-ops).
 *   D1     the "fold 51d owns the final copy" phrase is gone from all three
 *          adapter headers, replaced by the register decision.
 *   FLAGS  REVIEW_V2_CLIENT still ships false (untouched by this fold).
 *
 * Run: node scripts/deepfix2/cutover-d-refusals-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/cutover-d-refusals-pure.json
 * (CUTOVER_D_PURE_RECEIPT env redirects the receipt — the mutant driver uses
 * it so a mutant run can never clobber the canonical receipt.)
 */

import { readFileSync } from "node:fs";
import { createCaseRunner, sha16, writeReceipt, fakeStorage } from "./lib/fold-harness.mjs";

import { submitAttemptV2 } from "../../src/services/reviewV2Submit.js";
import { refusalReasonText } from "../../src/services/reviewV2Compose.js";
import { RV2 } from "../../src/services/reviewV2Client.js";

const { CASE, check, checkTrue, stats } = createCaseRunner();

const readSrc = (p) => readFileSync(p, "utf8");
const MCQ_PATH = "/app/src/pages/MCQTest.jsx";
const TYPED_PATH = "/app/src/pages/TypedTest.jsx";
const COMPOSE_PATH = "/app/src/services/reviewV2Compose.js";
const SUBMIT_PATH = "/app/src/services/reviewV2Submit.js";
const COMPLETE_PATH = "/app/src/services/reviewV2Complete.js";
const FLAGS_PATH = "/app/src/config/featureFlags.js";

const mcqSrc = readSrc(MCQ_PATH);
const typedSrc = readSrc(TYPED_PATH);
const composeSrc = readSrc(COMPOSE_PATH);
const submitSrc = readSrc(SUBMIT_PATH);
const completeSrc = readSrc(COMPLETE_PATH);
const flagsSrc = readSrc(FLAGS_PATH);

/** Slice `src` between two anchor strings, asserting EACH occurs exactly
 *  once first (a drifted/duplicated anchor fails the case loudly instead of
 *  silently slicing the wrong region or returning ''). */
function sliceBetween(name, src, startAnchor, endAnchor) {
  const startCount = src.split(startAnchor).length - 1;
  const endCount = src.split(endAnchor).length - 1;
  checkTrue(`${name}: start anchor occurs exactly once`, startCount === 1);
  checkTrue(`${name}: end anchor occurs exactly once`, endCount === 1);
  if (startCount !== 1 || endCount !== 1) return "";
  const s = src.indexOf(startAnchor);
  const e = src.indexOf(endAnchor, s + startAnchor.length);
  checkTrue(`${name}: end anchor found after start anchor`, e > s);
  if (e <= s) return "";
  return src.slice(s, e + endAnchor.length);
}

// ===========================================================================
CASE("A1/C1 — MCQTest.jsx: the recompose-success render is non-blocking, not `error`");
{
  checkTrue("the OLD buggy anchor is GONE (setError right after the fresh-question swap)",
    !mcqSrc.includes("generateQuestions(freshWords, null, freshPool)\n                setError(out.reason)"));
  checkTrue("the NEW anchor is present: the swap SUCCESS path calls setSubmitError, not setError",
    mcqSrc.includes("generateQuestions(freshWords, null, freshPool)") &&
    mcqSrc.includes("setSubmitError(out.reason)\n              } catch (swapErr) {"));
  check("ZERO occurrences of setError(out.reason) remain in the whole file",
    (mcqSrc.match(/setError\(out\.reason\)/g) || []).length, 0);
  // Bypass row 4 (a genuine hard error still full-page-blocks) — the gate and
  // its own retry are UNCHANGED.
  checkTrue("the full-page interstitial gate is untouched",
    mcqSrc.includes("if (error && !showResults) {"));
  checkTrue("the interstitial's own Try Again still calls loadTestWords (untouched)",
    mcqSrc.includes('<Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">'));
  // Bypass row 2 (a submit after the banner's retry uses the fresh set) — the
  // banner's retry is wired to handleSubmit directly (untouched), and the
  // state that feeds a subsequent submit (testWords/originalWords/the
  // sessionStorage blob) is set BEFORE the render-state line, in program
  // order, in the same try block.
  checkTrue("the submitError banner's retry calls handleSubmit directly",
    mcqSrc.includes("<Button\n                onClick={handleSubmit}\n                disabled={submitting}\n                className=\"mt-3 w-full\"\n                variant=\"primary\"\n              >"));
  const swapBlock = sliceBetween("MCQ swap-success ordering", mcqSrc,
    "} else if (out.outcome === 'recomposed') {", "setSubmitError(out.reason)\n              } catch (swapErr) {");
  if (swapBlock) {
    const iWords = swapBlock.indexOf("generateQuestions(freshWords, null, freshPool)");
    const iBlob = swapBlock.indexOf("updateRv2PresentationInBlob({");
    const iReason = swapBlock.indexOf("setSubmitError(out.reason)");
    checkTrue("program order: blob update, then fresh testWords, then the render-state line",
      iBlob > -1 && iWords > iBlob && iReason > iWords);
  }
  // Bypass row 3 (a SECOND unusable does not loop) — the sibling "blocked"
  // branch (recompose-once already exhausted) stays its OWN pre-existing
  // non-blocking treatment, untouched by this fold.
  checkTrue("the 'blocked' (2nd+ unusable, or any other block-with-reason) branch is untouched",
    mcqSrc.includes(
      "            } else {\n" +
      "              // blocked: render the reason; answers stay in state + localStorage,\n" +
      "              // and a re-submit of the SAME presentation is replay-safe.\n" +
      "              logSystemEvent('rv2_submit_blocked', {\n" +
      "                classId: classIdParam, listId, testType: 'mcq',\n" +
      "                status: out.status ?? null,\n" +
      "              }, 'error')\n" +
      "              setSubmitError(out.reason)\n" +
      "              setSubmitting(false)"
    ));
  // The swap ITSELF failing (freshWords fetch throws) is a DIFFERENT case
  // (the blob may be poisoned) and stays submitError too — untouched text.
  checkTrue("the swap-FAILURE catch block is untouched",
    mcqSrc.includes(
      "              } catch (swapErr) {\n" +
      "                console.error('[RV2] recompose swap failed:', swapErr)\n" +
      "                setSubmitError(out.reason)\n" +
      "              }\n" +
      "              setSubmitting(false)\n" +
      "              return"
    ));
}

CASE("A1/C1 — TypedTest.jsx: the recompose-success render is non-blocking, not `error`");
{
  checkTrue("the OLD buggy anchor is GONE (setError right after inputRefs resize)",
    !typedSrc.includes("inputRefs.current = new Array(servedV2.length)\n                setError(out.reason)"));
  checkTrue("the NEW anchor is present: the swap SUCCESS path sets gradingErrorKind('transient') + setGradingError, not setError",
    typedSrc.includes("inputRefs.current = new Array(servedV2.length)") &&
    typedSrc.includes("setGradingErrorKind('transient')\n                setGradingError(out.reason)\n              } catch (swapErr) {"));
  check("ZERO occurrences of setError(out.reason) remain in the whole file",
    (typedSrc.match(/setError\(out\.reason\)/g) || []).length, 0);
  checkTrue("the full-page interstitial gate is untouched",
    typedSrc.includes("if (error && !showResults) {"));
  checkTrue("the interstitial's own Try Again still calls loadTestWords (untouched)",
    typedSrc.includes('<Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">'));
  checkTrue("the transient gradingError modal's retry calls handleRetryGrading -> handleSubmit",
    typedSrc.includes("const handleRetryGrading = () => {\n    setGradingError(null)\n    handleSubmit() // Retry with preserved state\n  }") &&
    typedSrc.includes("onClick={handleRetryGrading}"));
  const swapBlock = sliceBetween("TYPED swap-success ordering", typedSrc,
    "} else if (out.outcome === 'recomposed') {", "setGradingError(out.reason)\n              } catch (swapErr) {");
  if (swapBlock) {
    const iWords = swapBlock.indexOf("setWords(servedV2)");
    const iBlob = swapBlock.indexOf("updateRv2PresentationInBlob({");
    const iKind = swapBlock.indexOf("setGradingErrorKind('transient')");
    checkTrue("program order: blob update, then fresh words, then the render-state lines",
      iBlob > -1 && iWords > iBlob && iKind > iWords);
  }
  // Contrast: the swap ITSELF failing stays 'deterministic' (Reload Page) —
  // untouched, and must remain DIFFERENT from the success leg's 'transient'.
  checkTrue("the swap-FAILURE catch block is untouched (stays 'deterministic')",
    typedSrc.includes(
      "              } catch (swapErr) {\n" +
      "                // The fresh test could not be prepared: the blob still holds the\n" +
      "                // poisoned presentation, so a blind resubmit would refuse again\n" +
      "                // (bounded — the once-guard is set). Reload rebuilds cleanly.\n" +
      "                console.error('[RV2] recompose swap failed:', swapErr)\n" +
      "                setGradingErrorKind('deterministic')\n" +
      "                setGradingError(out.reason)\n" +
      "              }\n" +
      "              setIsSubmitting(false)\n" +
      "              return"
    ));
  checkTrue("the 'blocked' (2nd+ unusable / any other block-with-reason) branch is untouched",
    typedSrc.includes(
      "              logSystemEvent('rv2_submit_blocked', {\n" +
      "                classId: classIdParam, listId, testType: 'typed',\n" +
      "                status: out.status ?? null,\n" +
      "              }, 'error')\n" +
      "              pendingSaveRef.current = doWriteAndFinalize\n" +
      "              setSubmitError(out.reason)\n" +
      "              setIsSubmitting(false)"
    ));
}

// ===========================================================================
CASE("A1 — cross-check against the REAL (unmodified) adapters: a recomposed outcome's shape is what the page code dereferences");
{
  const storage = fakeStorage();
  // The RAW server/callable shape composeReviewSessionV2 itself decodes
  // (reviewV2Compose.js composeReviewSessionV2's `if (result?.status ===
  // RV2.COMPOSED)` branch) — NOT the already-translated {outcome:'composed',
  // ...} envelope that function returns. Stubbing the wrong shape here would
  // silently prove nothing (composeReviewSessionV2 would see status!=='composed'
  // and refuse) — this constant is deliberately RAW to catch that mistake.
  const rawComposeResponse = {
    status: "composed",
    presentation: { presentationId: "pres-fresh-1", testType: "mcq", presentedWordIds: ["w1", "w2", "w3"] },
    queue: { orderedQueueWordIds: ["w1", "w2", "w3", "w4"], resetEpoch: 2 },
  };
  const out = await submitAttemptV2(
    { uid: "u1", classId: "C1", listId: "L1", logicalDay: 5, kind: "review", presentationId: "pres-stale-1", answers: [] },
    {
      storage,
      submitFn: async () => ({ status: "grade_unusable" }),
      composeSessionFn: async () => rawComposeResponse,
    }
  );
  check("outcome is 'recomposed'", out.outcome, "recomposed");
  checkTrue("reason is a non-empty string (the page renders it verbatim)",
    typeof out.reason === "string" && out.reason.length > 0);
  checkTrue("reason does not silently repeat the generic-looking submit copy (it names 'this test')",
    out.reason.includes("이 시험") || out.reason.toLowerCase().includes("fresh test"));
  // Every field the page's swap branch dereferences (out.compose.testType /
  // .presentedWordIds / .presentationId / .logicalDay / .resetEpoch):
  check("compose.testType", out.compose?.testType, "mcq");
  check("compose.presentedWordIds", out.compose?.presentedWordIds, ["w1", "w2", "w3"]);
  check("compose.presentationId", out.compose?.presentationId, "pres-fresh-1");
  check("compose.logicalDay", out.compose?.logicalDay, 5);
  check("compose.resetEpoch", out.compose?.resetEpoch, 2);
}

// ===========================================================================
CASE("A2/C2 — reuse_anchor_mismatch gets a SPECIFIC reason; unknown/retired still falls to the SAME generic (the catch-all is not broken)");
{
  const generic = refusalReasonText("a-status-this-client-has-never-heard-of");
  checkTrue("the generic reason is a non-empty string", typeof generic === "string" && generic.length > 0);
  const retired = refusalReasonText(RV2.TYPED_MODALITY_DEFERRED); // frozen-but-dead per reviewV2Client.js's own header
  check("a RETIRED status still falls to the generic (the catch-all is not broken)", retired, generic);
  const specific = refusalReasonText(RV2.REUSE_ANCHOR_MISMATCH);
  checkTrue("reuse_anchor_mismatch is a non-empty string", typeof specific === "string" && specific.length > 0);
  checkTrue("reuse_anchor_mismatch is SPECIFIC — it differs from the generic reason", specific !== generic);
  checkTrue("reuse_anchor_mismatch copy is student-safe — never names the internal mechanism",
    !/anchorNwei|generation|cross-class|reuse/i.test(specific));
  checkTrue("reuse_anchor_mismatch copy follows this file's own two-step register (reload; tell your teacher if it repeats)",
    /새로고침/.test(specific) && /선생님/.test(specific));
  // Every OTHER known REFUSAL_REASONS key still resolves to something OTHER
  // than the generic (regression: the new entry must not have clobbered an
  // existing one via a stray duplicate key).
  const siblings = [
    RV2.CLIENT_VERSION_STALE, RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH,
    RV2.COMPOSE_KEY_REUSED, RV2.INVALID_COMPOSE_KEY, RV2.QUEUE_INVALID,
    RV2.EMPTY_POOL, RV2.LIST_END, RV2.DAY_GUARD_REJECTED,
    RV2.PRESENTATION_INVALID, RV2.LIST_WORDS_MALFORMED,
  ];
  for (const status of siblings) {
    checkTrue(`sibling ${status} still resolves to its own specific reason (not the generic)`,
      refusalReasonText(status) !== generic);
  }
  check("the census is now 12 specific reasons (11 pre-existing + this fold's 1)", siblings.length + 1, 12);
}

// ===========================================================================
CASE("A3/C5 — grep-assert: NO raw Tailwind red-/gray-/blue-/yellow-/white/rounded-lg remains in the six touched refusal blocks");
{
  const RAW_RE = /\b(?:bg|text|border)-(?:red|gray|blue|yellow)-\d{2,3}\b|\bdark:[a-z-]*(?:red|gray|blue|yellow)-\d{2,3}\b|\bbg-white\b|\brounded-lg\b/;

  const mcqInlineBanners = sliceBetween("MCQ error+submitError banners", mcqSrc,
    "        {error && (\n          <div className=\"px-4 pb-4\">",
    "                {submitting ? 'Saving...' : 'Try Again'}\n              </Button>\n            </div>\n          </div>\n        )}");
  const mcqOverlaySubmitError = sliceBetween("MCQ submitting-overlay submitError", mcqSrc,
    "              {submitError && (\n                <div className=\"mt-4 p-4 bg-error border border-border-error rounded-alert\">",
    "                    Retry Submission\n                  </button>\n                </div>\n              )}");
  const typedInlineError = sliceBetween("TYPED inline error", typedSrc,
    "          {error && (\n            <div className=\"mt-6 rounded-alert",
    "              {error}\n            </div>\n          )}");
  const typedSubmitErrorModal = sliceBetween("TYPED submitError modal", typedSrc,
    "      {submitError && !isSubmitting && (", "                Retry Save\n              </button>\n            </div>\n          </div>\n        </div>\n      )}");
  const typedGradingErrorModal = sliceBetween("TYPED gradingError modal", typedSrc,
    "      {gradingError && !isSubmitting && (",
    "                  Try Again\n                </button>\n              )}\n            </div>\n          </div>\n        </div>\n      )}");

  const blocks = {
    "MCQ error+submitError banners": mcqInlineBanners,
    "MCQ submitting-overlay submitError": mcqOverlaySubmitError,
    "TYPED inline error": typedInlineError,
    "TYPED submitError modal": typedSubmitErrorModal,
    "TYPED gradingError modal": typedGradingErrorModal,
  };
  for (const [name, block] of Object.entries(blocks)) {
    checkTrue(`${name}: block was sliced (non-empty)`, block.length > 0);
    checkTrue(`${name}: no raw Tailwind color/white/rounded-lg utility remains`, !RAW_RE.test(block));
  }

  // Positive control: the SAME regex, run over a KNOWN-still-raw region (the
  // isSubmitting "Grading Your Test.../Connection Issue" overlay — explicitly
  // OUT of the ledger's V3 scope, left untouched on purpose) DOES fire. This
  // proves RAW_RE actually detects raw Tailwind rather than vacuously passing.
  const typedOutOfScopeOverlay = sliceBetween("TYPED isSubmitting overlay (out of A3 scope, must stay raw)", typedSrc,
    "      {/* Submission Overlay */}\n      {isSubmitting && (", "                </>\n              )}\n            </div>\n          </div>\n        </div>\n      )}");
  checkTrue("positive control: the out-of-scope overlay still trips the raw-Tailwind regex (proves the regex works)",
    typedOutOfScopeOverlay.length > 0 && RAW_RE.test(typedOutOfScopeOverlay));
}

// ===========================================================================
CASE("D1 — the copy-register decision replaces 'fold 51d owns the final copy' at all three adapters");
{
  for (const [name, src] of [["reviewV2Compose.js", composeSrc], ["reviewV2Submit.js", submitSrc], ["reviewV2Complete.js", completeSrc]]) {
    checkTrue(`${name}: the stale 'fold 51d owns the final copy' phrase is GONE`, !src.includes("fold 51d owns the final copy"));
    checkTrue(`${name}: the register decision is recorded (separate from DF2-07)`,
      /SEPARATE REGISTER from DF2-07/.test(src));
    checkTrue(`${name}: cites the D1/cutover-d decision`, /cutover-d D1|D1\)/.test(src));
  }
}

// ===========================================================================
CASE("FLAGS — REVIEW_V2_CLIENT still ships false (untouched by this fold)");
{
  checkTrue("REVIEW_V2_CLIENT = false", flagsSrc.includes("export const REVIEW_V2_CLIENT = false;"));
  check("exactly one assignment of REVIEW_V2_CLIENT", (flagsSrc.match(/export const REVIEW_V2_CLIENT = /g) || []).length, 1);
}

// ===========================================================================
const { total, failed, reds } = stats();
const evidencePath = process.env.CUTOVER_D_PURE_RECEIPT
  || "/app/docs/plans/deepfix2/evidence/cutover-d-refusals-pure.json";
writeReceipt(evidencePath, {
  kind: "cutover-d-refusals-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/reviewV2Compose.js": sha16(COMPOSE_PATH),
    "src/services/reviewV2Submit.js": sha16(SUBMIT_PATH),
    "src/services/reviewV2Complete.js": sha16(COMPLETE_PATH),
    "src/services/reviewV2Client.js": sha16("/app/src/services/reviewV2Client.js"),
    "src/pages/MCQTest.jsx": sha16(MCQ_PATH),
    "src/pages/TypedTest.jsx": sha16(TYPED_PATH),
    "src/config/featureFlags.js": sha16(FLAGS_PATH),
    "scripts/deepfix2/cutover-d-refusals-fixtures.mjs": sha16("/app/scripts/deepfix2/cutover-d-refusals-fixtures.mjs"),
  },
  at: new Date().toISOString(),
});
console.log(`\ncutover-d-refusals PURE: ${total} checks, ${failed} failures — evidence written to ${evidencePath}`);
process.exit(failed ? 1 : 0);
