/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage (1) — THE REVIEW-PASS GATE (config resolver)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69: Codex YES +
 * panel unanimous). Sources: 15_H6 §7 (the config schema + THE STAMPING
 * PREDICATE [R2-48] + minClientVersion fence [contract (5), r55 predicate]),
 * 02_ DF2-10 (1) (ONE versioned helper; per-request snapshot; cold start ⇒
 * HOLD, mint nothing [r48]; kill-switch label law R2-32 scoped by R2-48).
 *
 * DARK BY CONSTRUCTION: `system_config/review_v2` deploys `enabled:false`,
 * `firstEnabledAt:null`, `rehearsalClassIds:[]` — every consumer of this
 * resolver behaves exactly as today until the R2-48 two-field flip.
 *
 * THE ONE RESOLVER LAW: every review_v2 server entrypoint calls
 * `resolveReviewConfig` ONCE per request, stamps `{gateEffectiveEnabled,
 * configVersion}` into anything it mints, and lets THAT snapshot govern the
 * request through completion (mid-request config edits never mix postures —
 * contract (2)/(7)).
 */

"use strict";

const CONFIG_DOC_PATH = "system_config/review_v2";

/** Frozen defaults (15_ §7) — used ONLY for absent optional fields; an absent
 *  DOC is a cold start and resolves to HOLD, never to defaults [r48]. */
const DEFAULTS = Object.freeze({
  threshold: 92,
  queueSize: 60,
  testSize: 30,
});

/**
 * Resolve the effective review_v2 posture for one request.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{classId: string, listId: string, uid?: string,
 *   txn?: FirebaseFirestore.Transaction}} ctx
 *   When `txn` is supplied the config doc joins the transaction's READ SET —
 *   this is the ACTIVATION BARRIER pattern (14_ §4): the flip txn and any
 *   in-flight transactional consumer serialize on Firestore itself.
 *   When `uid` is supplied the result adds `{classExists, assignmentExists,
 *   enrolled}` from the same class read (no extra I/O) — callable-layer
 *   authorization facts, never posture inputs.
 * @returns {Promise<{
 *   readStatus: "ok"|"hold",
 *   enabled: boolean,
 *   firstEnabledAt: FirebaseFirestore.Timestamp|null,
 *   rehearsalClass: boolean,
 *   stampingEligible: boolean,
 *   gateEffectiveEnabled: boolean,
 *   assignmentGateEnabled: boolean,
 *   reviewTestType: "mcq"|"typed",
 *   threshold: number, queueSize: number, testSize: number,
 *   configVersion: number, minClientVersion: number|null,
 * }>}
 *
 * readStatus "hold": the config could not be read or is absent/malformed —
 * the caller MUST refuse the request without minting anything (r48 cold-start
 * law). Never treat "hold" as gate-OFF: OFF is a POSTURE, hold is an OUTAGE.
 */
async function resolveReviewConfig(db, ctx) {
  const { classId, listId, uid, txn } = ctx;
  let cfgSnap;
  let classSnap;
  try {
    const cfgRef = db.doc(CONFIG_DOC_PATH);
    const classRef = db.collection("classes").doc(classId);
    if (txn) {
      [cfgSnap, classSnap] = await Promise.all([txn.get(cfgRef), txn.get(classRef)]);
    } else {
      [cfgSnap, classSnap] = await Promise.all([cfgRef.get(), classRef.get()]);
    }
  } catch (err) {
    // Inside a transaction the error MUST propagate: runTransaction's retry
    // loop handles ABORTED/contention; swallowing it into "hold" would poison
    // the txn and misreport a transient as an outage. Hold is for the
    // non-transactional per-request snapshot path only.
    if (txn) throw err;
    return holdResult(`config read failed: ${err.message}`);
  }
  if (!cfgSnap.exists) return holdResult("config doc absent (cold start)");
  const cfg = cfgSnap.data();
  if (typeof cfg.enabled !== "boolean" || !Number.isInteger(cfg.configVersion)) {
    return holdResult("config doc malformed");
  }

  const rehearsalIds = Array.isArray(cfg.rehearsalClassIds) ? cfg.rehearsalClassIds : [];
  const rehearsalClass = rehearsalIds.includes(classId);
  const firstEnabledAt = cfg.firstEnabledAt ?? null;

  // THE STAMPING PREDICATE [R2-48]: label writers stamp iff the durable marker
  // exists ∨ this class rehearses. This is WRITER ELIGIBILITY — the per-field
  // ON/OFF posture (R2-32, scoped post-activation) layers on top of it.
  const stampingEligible = firstEnabledAt != null || rehearsalClass;

  // Gate posture: global-then-assignment (R2-38/r50-H4). A rehearsal class is
  // gate-ON while globally dark (15_ §7 — the ONLY 25WT ON-path pre-flip).
  const globallyOn = cfg.enabled === true || rehearsalClass;
  let assignmentGate = true; // default true; missing/null ⇒ true (frozen)
  let asg = null;
  if (classSnap.exists) {
    asg = (classSnap.data().assignments || {})[listId] || null;
    if (asg && asg.reviewGateEnabled === false) assignmentGate = false;
  }
  const gateEffectiveEnabled = globallyOn && assignmentGate;

  // Authorization facts (uid-supplied calls only) — same read, zero extra I/O.
  const authFacts = uid === undefined ? {} : {
    classExists: classSnap.exists,
    assignmentExists: asg !== null,
    enrolled: classSnap.exists &&
      Array.isArray(classSnap.data().studentIds) &&
      classSnap.data().studentIds.includes(uid),
  };

  const num = (v, dflt, lo, hi) =>
    Number.isInteger(v) && v >= lo && v <= hi ? v : dflt;
  const threshold = num(asg?.reviewPassThreshold, num(cfg.threshold, DEFAULTS.threshold, 1, 100), 1, 100);
  const queueSize = num(asg?.reviewQueueSize, num(cfg.queueSize, DEFAULTS.queueSize, 1, 500), 1, 500);
  const testSize = num(asg?.reviewTestSize, num(cfg.testSize, DEFAULTS.testSize, 1, 500), 1, 500);
  // Modality law (10_ §2.2): `assignment.reviewTestType ∥ 'mcq'` — the closed
  // enum; any other value falls to the default (never a third modality).
  const reviewTestType = asg?.reviewTestType === "typed" ? "typed" : "mcq";

  return {
    ...authFacts,
    readStatus: "ok",
    enabled: cfg.enabled === true,
    firstEnabledAt,
    rehearsalClass,
    stampingEligible,
    gateEffectiveEnabled,
    // The assignment-level flag alone (default true) — queue snapshots record
    // it (H6 §2) separately from the global-and-assignment effective gate.
    assignmentGateEnabled: assignmentGate,
    reviewTestType,
    threshold,
    queueSize,
    testSize,
    configVersion: cfg.configVersion,
    minClientVersion: Number.isInteger(cfg.minClientVersion) ? cfg.minClientVersion : null,
  };
}

function holdResult(reason) {
  return {
    readStatus: "hold",
    holdReason: reason,
    enabled: false,
    firstEnabledAt: null,
    rehearsalClass: false,
    stampingEligible: false,
    gateEffectiveEnabled: false,
    assignmentGateEnabled: true,
    reviewTestType: "mcq",
    threshold: DEFAULTS.threshold,
    queueSize: DEFAULTS.queueSize,
    testSize: DEFAULTS.testSize,
    configVersion: -1,
    minClientVersion: null,
  };
}

/**
 * Contract (5) client-version fence — THE EXACT r55 predicate: missing or
 * malformed values REFUSE (a naive `undefined < min` is false). Callable
 * traffic only; direct-Firestore authority is closed by §10, not by this.
 * @returns {null | {status: "client_version_stale", minClientVersion: number}}
 */
function checkClientVersion(config, clientContractVersion) {
  if (config.minClientVersion == null) return null; // fence not armed
  if (
    !Number.isSafeInteger(clientContractVersion) ||
    clientContractVersion < config.minClientVersion
  ) {
    return { status: "client_version_stale", minClientVersion: config.minClientVersion };
  }
  return null;
}

module.exports = { resolveReviewConfig, checkClientVersion, CONFIG_DOC_PATH, DEFAULTS };
