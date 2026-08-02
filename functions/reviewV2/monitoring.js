/**
 * ============================================================================
 * DEEPFIX2 · DF2-14 named deliverable — MONITORING: the ops_metrics sink +
 * THE EVALUATOR API + generation-bound quarantine (H6 §6c + 16_ r62/r63/r64)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Sources:
 * 15_H6 §6c (ops_metrics = the SERVER-ONLY operational sink — never
 * system_logs, which any authenticated client can create), 16_ §3 (the shadow
 * registry + GENERATION/CACHE law [r62] + GENERATION-BOUND CLASSIFICATION
 * [r63] + THE WINDOW ARTIFACT + quarantine-as-published-signal [r64]),
 * DF2-14's evaluator API card (`evaluateThresholds({scope,dryRun})` +
 * `getShadowRegistryGeneration` diagnostic; signal set WSL-owned, numbers
 * from B1 baselines).
 *
 * DARK BY CONSTRUCTION: no caller until the index.js wiring; the evaluator
 * is an admin/ops surface, never client-reachable.
 *
 * THE LAWS ENCODED HERE
 *  - THE SINK: every monitoring/abort signal writes `ops_metrics/{autoId}`
 *    via `recordOpsMetric` (Admin SDK only; client write DENIED by the rules
 *    artifact; teacher read). EVERY row is stamped `{registryGeneration,
 *    shadow}` from the writer's CACHED registry view [r63] — a stale
 *    instance cannot emit a production-classified shadow metric BY
 *    CONSTRUCTION, because consumers quarantine on the stamp, not on trust.
 *  - THE REGISTRY [r61/r62]: top-level `shadow_registry/{n}` docs (≤500 ids
 *    each, field `ids` — field name minted HERE, the stage-3.5 driver must
 *    match); doc `0` carries the `generation` counter bumped by every
 *    registry write. Server instances cache the uid-set keyed by generation
 *    with a ≤60s re-read; staleness ≤TTL is safe BY SCHEDULE (membership
 *    changes only outside run windows). Absent registry ⇒ empty set,
 *    generation 0 (a window then quarantines such writers' rows — correct:
 *    a writer with no registry view during a window IS stale).
 *  - THE WINDOW ARTIFACT [r64]: `shadow_registry/window` `{generation,
 *    startedAt, runId}` — its existence DEFINES an audit window; its
 *    `generation` IS the registered generation. WINDOWS NEVER SPAN THE FLIP
 *    (the flip choreography asserts absence — enforced there, not here).
 *  - QUARANTINE [r64, the EXACT predicate]: during a window, EVERY consumer
 *    (both evaluator scopes AND baseline computations) quarantines rows
 *    whose `registryGeneration` is MISSING, NON-INTEGER, < G, or > G —
 *    `undefined < G` is false, so the missing check is explicit.
 *    Quarantined rows are indeterminate: never classified, never
 *    alert-feeding, never baseline-feeding. `quarantinedRowCount` is ITSELF
 *    a published per-window signal with its own alert threshold (a stamping
 *    bug must not blackhole production monitoring silently).
 *  - SCOPES: `production` consumes only non-quarantined `shadow !== true`
 *    rows and may alert (alert ROUTING is the caller's — the R2-18 abort
 *    decision is David/WSL, never this module's); `shadowAudit` consumes
 *    only window-generation `shadow === true` rows and REQUIRES
 *    `dryRun:true` (side-effect-free by contract).
 *  - THRESHOLDS: the signal names ship here; the NUMBERS are caller-supplied
 *    (B1-baseline-derived, WSL-owned) — never hardcoded.
 */

"use strict";

const {Timestamp, FieldValue} = require("firebase-admin/firestore");

const OPS_METRICS_COLLECTION = "ops_metrics";
const REGISTRY_COLLECTION = "shadow_registry";
const WINDOW_DOC_PATH = "shadow_registry/window";
const REGISTRY_REREAD_TTL_MS = 60000;

/** The R2-18/DF2-14 signal vocabulary (types are frozen names; thresholds
 *  are caller-supplied numbers from B1 baselines). */
const SIGNAL_TYPES = Object.freeze([
  "composition_fallback",
  "priority_saturation_day",
  "wall_rate",
  "force_pass",
  "label_write_failure",
  "score_drop",
  "rerun_graduation",
  "reset_reconciliation",
  "grading_quarantine",
  "csd_anchor_invalid",
  "quarantined_row_count",
  "cursor_repaired",
  "list_words_malformed",
]);

// Module-level registry cache (per warm instance — the r62 cache law).
let _cache = {set: new Set(), generation: 0, fetchedAtMs: -Infinity};

/** Read the full shadow registry fresh: uid set + generation. */
async function loadShadowRegistry(db) {
  const snap = await db.collection(REGISTRY_COLLECTION).get();
  const set = new Set();
  let generation = 0;
  for (const doc of snap.docs) {
    if (doc.id === "window") continue;
    const d = doc.data();
    if (doc.id === "0" && Number.isInteger(d.generation)) generation = d.generation;
    if (Array.isArray(d.ids)) for (const u of d.ids) if (typeof u === "string") set.add(u);
  }
  return {set, generation};
}

/** The cached registry view (≤60s re-read [r62]). Writers stamp rows from
 *  THIS — never from a fresh read (the stamp must reflect what the writer's
 *  classification actually used). */
async function getShadowRegistryView(db, nowMs = Date.now()) {
  if (nowMs - _cache.fetchedAtMs > REGISTRY_REREAD_TTL_MS) {
    const fresh = await loadShadowRegistry(db);
    _cache = {...fresh, fetchedAtMs: nowMs};
  }
  return _cache;
}

/** Test hook: drop the warm-instance cache (emulator staleness injection). */
function _resetRegistryCacheForTests() {
  _cache = {set: new Set(), generation: 0, fetchedAtMs: -Infinity};
}

/** DIAGNOSTIC ONLY [r63 — no proof burden]: the registry generation by a
 *  fresh read of doc 0. */
async function getShadowRegistryGeneration(db) {
  const snap = await db.doc(`${REGISTRY_COLLECTION}/0`).get();
  const g = snap.exists ? snap.data().generation : null;
  return Number.isInteger(g) ? g : 0;
}

/** The window artifact, or null when no audit window is open. */
async function getAuditWindow(db) {
  const snap = await db.doc(WINDOW_DOC_PATH).get();
  if (!snap.exists) return null;
  const d = snap.data();
  return {
    generation: Number.isInteger(d.generation) ? d.generation : null,
    startedAt: d.startedAt ?? null,
    runId: typeof d.runId === "string" ? d.runId : null,
  };
}

/** THE QUARANTINE PREDICATE [r64, exact]: during a G window a row is
 *  quarantined iff its stamp is missing, non-integer, < G, or > G. */
function isQuarantined(row, windowGeneration) {
  const g = row?.registryGeneration;
  if (!Number.isInteger(g)) return true; // missing/non-integer — explicit
  return g < windowGeneration || g > windowGeneration;
}

/**
 * THE ops_metrics writer (§6c). Every server-side monitoring signal goes
 * through here so the [r63] stamp law is unforgettable.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{type: string, uid?: string|null, classId?: string|null,
 *   listId?: string|null, payload?: object, nowMs?: number}} args — `type`
 *   should be a SIGNAL_TYPES member (unknown types are recorded but flagged
 *   `unknownType:true` so vocabulary drift is visible, never silent).
 * @returns {Promise<{id: string, shadow: boolean, registryGeneration: number}>}
 */
async function recordOpsMetric(db, {type, uid = null, classId = null, listId = null, payload = {}, nowMs = Date.now()}) {
  if (typeof type !== "string" || type.length === 0) {
    throw new TypeError("recordOpsMetric: type required");
  }
  const view = await getShadowRegistryView(db, nowMs);
  const shadow = uid != null && view.set.has(uid);
  const row = {
    type,
    ...(SIGNAL_TYPES.includes(type) ? {} : {unknownType: true}),
    uid, classId, listId,
    shadow,
    registryGeneration: view.generation,
    payload,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(OPS_METRICS_COLLECTION).add(row);
  return {id: ref.id, shadow, registryGeneration: view.generation};
}

/** Pure row-partition law shared by every consumer (fixture-facing).
 *  Returns each row tagged with its disposition for the given scope.
 *  FAIL-CLOSED [r70 C7/M-3]: a PRESENT-but-malformed window (non-integer
 *  generation) quarantines EVERYTHING — the protection that keeps stale
 *  shadow rows out of production classification must never be silently
 *  disabled by a corrupt artifact. */
function classifyRows(rows, {scope, window}) {
  const out = {consumed: [], quarantined: [], excluded: []};
  const windowMalformed = window !== null && window !== undefined &&
    (!Number.isInteger(window.generation) ||
     !(window.startedAt && typeof window.startedAt.toMillis === "function") ||
     typeof window.runId !== "string" || window.runId.length === 0);
  for (const row of rows) {
    if (windowMalformed) {
      out.quarantined.push(row);
      continue;
    }
    if (window && isQuarantined(row, window.generation)) {
      out.quarantined.push(row);
      continue;
    }
    if (scope === "production") {
      if (row.shadow !== true) out.consumed.push(row);
      else out.excluded.push(row);
    } else { // shadowAudit
      if (window && row.shadow === true && row.registryGeneration === window.generation) {
        out.consumed.push(row);
      } else {
        out.excluded.push(row);
      }
    }
  }
  return out;
}

/**
 * THE EVALUATOR [DF2-14 named deliverable]. Reads the ops_metrics window,
 * partitions per the quarantine + scope laws, aggregates by signal type,
 * compares against caller-supplied thresholds.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{scope: "production"|"shadowAudit", dryRun: boolean,
 *   thresholds?: Object<string, {max: number}>, windowMs?: number,
 *   nowMs?: number}} args — `thresholds` maps signal type → max count per
 *   evaluation window (WSL-owned B1-derived numbers). `shadowAudit` REQUIRES
 *   dryRun:true and an open audit window.
 * @returns {Promise<object>} `{status:"ok", scope, dryRun, windowGeneration,
 *   consumedRowCount, quarantinedRowCount, excludedRowCount, countsByType,
 *   breaches: [{type, count, max}]}` — or `{status:"no_audit_window"}` /
 *   `{status:"invalid_scope"}` typed refusals. When NOT dryRun and a window
 *   is open, publishes `quarantined_row_count` to ops_metrics [r64].
 */
async function evaluateThresholds(db, {scope, dryRun, thresholds = {}, windowMs = 24 * 3600000, nowMs = Date.now()}) {
  if (scope !== "production" && scope !== "shadowAudit") {
    return {status: "invalid_scope"};
  }
  if (scope === "shadowAudit" && dryRun !== true) {
    // Side-effect-free by contract — a non-dry shadow evaluation is refused,
    // never silently downgraded.
    return {status: "invalid_scope", reason: "shadowAudit requires dryRun:true"};
  }
  const window = await getAuditWindow(db);
  if (scope === "shadowAudit" && window === null) {
    return {status: "no_audit_window"};
  }
  // FAIL CLOSED [r70 C7, r72-completed]: a present window must be WHOLLY
  // well-formed — integer generation AND a real startedAt AND a runId. Any
  // corrupt leg refuses the audit outright; production classification
  // quarantines everything via classifyRows.
  const windowMalformed = window !== null && (
    !Number.isInteger(window.generation) ||
    !(window.startedAt && typeof window.startedAt.toMillis === "function") ||
    typeof window.runId !== "string" || window.runId.length === 0);
  if (scope === "shadowAudit" && windowMalformed) {
    return {status: "window_malformed"};
  }

  // WINDOW-BOUNDED EVALUATION [r70 C7]: when a valid window is open, rows
  // are consumed only from its startedAt — prior same-generation rows never
  // feed the current audit.
  let cutoffMs = nowMs - windowMs;
  const startedAtMs = window?.startedAt?.toMillis ? window.startedAt.toMillis() : null;
  if (window && Number.isInteger(window.generation) && startedAtMs !== null) {
    cutoffMs = Math.max(cutoffMs, startedAtMs);
  }
  const cutoff = Timestamp.fromMillis(cutoffMs);
  const snap = await db.collection(OPS_METRICS_COLLECTION)
      .where("createdAt", ">=", cutoff)
      .get();
  const rows = snap.docs.map((d) => d.data());
  const {consumed, quarantined, excluded} = classifyRows(rows, {scope, window});

  const countsByType = {};
  for (const row of consumed) {
    countsByType[row.type] = (countsByType[row.type] ?? 0) + 1;
  }
  const breaches = [];
  for (const [type, rule] of Object.entries(thresholds)) {
    const count = countsByType[type] ?? 0;
    if (Number.isFinite(rule?.max) && count > rule.max) {
      breaches.push({type, count, max: rule.max});
    }
  }

  if (!dryRun && window) {
    // The published quarantine signal [r64] — stamped like every other row.
    await recordOpsMetric(db, {
      type: "quarantined_row_count",
      payload: {count: quarantined.length, windowRunId: window.runId, scope},
      nowMs,
    });
  }

  return {
    status: "ok",
    scope,
    dryRun: dryRun === true,
    windowGeneration: window?.generation ?? null,
    consumedRowCount: consumed.length,
    quarantinedRowCount: quarantined.length,
    excludedRowCount: excluded.length,
    countsByType,
    breaches,
  };
}

module.exports = {
  recordOpsMetric,
  evaluateThresholds,
  getShadowRegistryGeneration,
  getAuditWindow,
  getShadowRegistryView,
  loadShadowRegistry,
  // Pure/fixture-facing surface:
  classifyRows,
  isQuarantined,
  SIGNAL_TYPES,
  OPS_METRICS_COLLECTION,
  WINDOW_DOC_PATH,
  _resetRegistryCacheForTests,
};
