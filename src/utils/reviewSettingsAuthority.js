/**
 * ============================================================================
 * DF2-11 · reviewSettingsAuthority — PURE client validation for the teacher
 * review-settings group (no Firebase, no React; node-loadable so a fixture can
 * import it — the same pure-extraction seam streakAuthority.js used).
 * ============================================================================
 * This is the CLIENT-side UX guard for the per-assignment review-v2 overrides
 * the SERVER already reads (functions/reviewV2/config.js:163-192). It MIRRORS
 * that contract but is NOT the authority: the server re-validates every field
 * (present-but-malformed ⇒ HOLD; absent/null ⇒ frozen default), so this exists
 * only to keep a malformed value from ever reaching the write.
 *
 * FLAG SCOPE: the two db.js writers call these helpers INSIDE their
 * `REVIEW_V2_CLIENT` gate (assignListToClass / updateAssignmentSettings). With
 * the flag OFF nothing here runs and the writers keep today's reviewTestSizeMin/
 * Max exactly (byte-identical). The four keys below are the genuinely-NEW
 * fields; `reviewTestType` is a pre-existing assignment field and keeps its own
 * (unchanged) handling in db.js.
 *
 * Mirror of config.js (the authority):
 *   reviewPassThreshold  int [1,100]   default 92   — REJECT out-of-range
 *   reviewQueueSize      int [1,500]   default 60   — REJECT out-of-range
 *   reviewTestSize       int [1,500]   default 30   — REJECT out-of-range
 *   reviewGateEnabled    boolean       default true — COERCE to a real boolean
 *   reviewTestType       mcq|typed     default mcq  — DEFAULT anything else
 * (config.js treats a present non-boolean gate / bad int as HOLD; coercing the
 * gate and defaulting the type here guarantees the server never HOLDs on them.)
 */

// Frozen client defaults — the SAME numbers as config.js DEFAULTS (:28-32) plus
// the two the server defaults implicitly (gate true, type mcq). Kept DISTINCT
// from the new-word passThreshold default (95): reviewPassThreshold is 92.
export const REVIEW_SETTINGS_DEFAULTS = Object.freeze({
  reviewPassThreshold: 92,
  reviewQueueSize: 60,
  reviewTestSize: 30,
  reviewGateEnabled: true,
  reviewTestType: 'mcq',
})

// Integer ranges, mirroring config.js intOk(v, lo, hi).
const INT_RANGES = Object.freeze({
  reviewPassThreshold: [1, 100],
  reviewQueueSize: [1, 500],
  reviewTestSize: [1, 500],
})

const FIELD_LABELS = Object.freeze({
  reviewPassThreshold: 'Review Pass Threshold',
  reviewQueueSize: 'Review Queue Size',
  reviewTestSize: 'Review Test Size',
})

// The four genuinely-new keys the writers persist behind REVIEW_V2_CLIENT.
// (reviewTestType is a pre-existing field — handled in db.js as today.)
export const NEW_REVIEW_WRITE_FIELDS = Object.freeze([
  'reviewPassThreshold',
  'reviewQueueSize',
  'reviewTestSize',
  'reviewGateEnabled',
])

/**
 * Validate/normalize ONE review field, mirroring config.js:163-192.
 * - the three ints REJECT (throw) when not an integer in range (config.js HOLD)
 * - reviewGateEnabled COERCES to a real boolean (`=== true`)
 * - reviewTestType DEFAULTS to 'mcq' for anything but 'typed' (modality law)
 * @param {'reviewPassThreshold'|'reviewQueueSize'|'reviewTestSize'|'reviewGateEnabled'|'reviewTestType'} field
 * @param {*} value
 * @returns {number|boolean|string}
 */
export function validateReviewField(field, value) {
  if (field === 'reviewGateEnabled') {
    return value === true
  }
  if (field === 'reviewTestType') {
    return value === 'typed' ? 'typed' : 'mcq'
  }
  const range = INT_RANGES[field]
  if (!range) throw new Error(`Unknown review field: ${field}`)
  const [lo, hi] = range
  const n = Number(value)
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`${FIELD_LABELS[field]} must be a whole number between ${lo} and ${hi}.`)
  }
  return n
}

/**
 * FULL review-settings object for assignListToClass (initial assign): every new
 * key present — absent inputs take the frozen default, present inputs are
 * validated. Never emits reviewTestSizeMin/Max (that is the flag-OFF branch in
 * db.js). reviewTestType is written by the writer's own (existing) line.
 * @param {object} [input]
 * @returns {{reviewPassThreshold:number,reviewQueueSize:number,reviewTestSize:number,reviewGateEnabled:boolean}}
 */
export function assignReviewSettings(input = {}) {
  const src = input == null ? {} : input
  const out = {}
  for (const f of NEW_REVIEW_WRITE_FIELDS) {
    out[f] = src[f] === undefined
      ? REVIEW_SETTINGS_DEFAULTS[f]
      : validateReviewField(f, src[f])
  }
  return out
}

/**
 * SPARSE review-settings patch for updateAssignmentSettings: only the new keys
 * actually present in `settings`, each validated. Absent keys are omitted so
 * the writer leaves them untouched (server keeps its frozen default). Never
 * emits reviewTestSizeMin/Max.
 * @param {object} [settings]
 * @returns {object} a subset of the four new keys
 */
export function patchReviewSettings(settings = {}) {
  const src = settings == null ? {} : settings
  const patch = {}
  for (const f of NEW_REVIEW_WRITE_FIELDS) {
    if (src[f] !== undefined) {
      patch[f] = validateReviewField(f, src[f])
    }
  }
  return patch
}
