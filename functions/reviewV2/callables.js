/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — CALLABLES: the dormant review_v2 server
 * surface (wiring layer over the engine modules)
 * ============================================================================
 * r70 FOLD (the double-NO lived HERE): day/universe authority moved INTO the
 * engine transactions (progress.js — the callable never names its epoch OR
 * its universe and its `logicalDay` is bound to the server frontier in-txn);
 * completion evidence is fully bound (completion.js C1); serving authority
 * re-enforced inside every minting txn (config.js C3); the live NEW-word
 * route exists (C4 — every graded test stamps); protocol statuses surface
 * UNIFORMLY as `{status}` data (C5/L-3 — HttpsError is reserved for
 * auth/args/not-found/permission); malformed canonical word data is a typed
 * refusal + ops signal (C5/M-7); the contract-named monitoring signals are
 * emitted (C7: composition_fallback · priority_saturation_day ·
 * rerun_graduation · cursor_repaired).
 *
 * DARK BY CONSTRUCTION: the serving gate is THE STAMPING PREDICATE [R2-48] —
 * `system_config/review_v2` deploys `{enabled:false, firstEnabledAt:null,
 * rehearsalClassIds:[]}`, so every call refuses `review_v2_dark` until the
 * flip (pre-flip, `rehearsalClassIds` members only — the 25WT rehearsal).
 * Serving ≡ stamping (R2-41); post-flip kill windows stay served under the
 * R2-32 per-field law.
 *
 * DERIVATIONS (r70-adjudicated): universe/tuple/frontier from progress truth
 * (csd/twi — CC-2) · rerun review over the FULL current introduced range
 * (R2-41(h) as ruled by both lanes) · live new-day range = [twi, twi+pace)
 * with `deriveDailyPace` (the day's anchor; stamped on the attempt for
 * anchor continuity) · MCQ server verdict vs canonical `definition` (client
 * verdicts never trusted); TYPED review is graded OUTSIDE the txn through the
 * LIVE grading job — claim → grade → persist → write, keyed on
 * `rv2_{uid}_{presentationId}` (DF2-12 · 18_TYPED_LEG_DESIGN §4; the concurrent
 * submit gets `grading_in_progress` as DATA with zero writes) · attempt docId
 * = `rv2_{uid}_{presentationId}` (1:1 with a composed presentation, idempotent
 * replay returns the NORMALIZED envelope with zero writes [C5] — and, for
 * typed, zero grader calls).
 *
 * [D3 TRUTH REPAIR — rv2-docid-collision fold] Both ids read
 * `rv2_{presentationId}` until this fold, and this header called that "1:1
 * with a composed presentation". THAT WAS TRUE PER USER AND FALSE GLOBALLY,
 * which was the whole defect: `presentationId` carries no uid (it does not
 * need one — presentations live under `users/{uid}/`) while `attempts` and
 * `grading_jobs` are TOP-LEVEL and `seq` counts PER USER, so every student in
 * the same class+list+day+epoch derived the SAME id. The first student's
 * attempt landed and the second was refused (NEED_TO_FIX 18). The derivation
 * now carries the uid — composer.js `engineDocId`, called by BOTH legs.
 */

"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");

const {resolveReviewConfig, checkClientVersion, assertServableInTxn} = require("./config");
const {composeDayQueue, queueDocId, engineDocId, effectiveResetEpoch, resetLockActive} = require("./composer");
const {composePresentation} = require("./presentations");
const {stampLabelsInTxn} = require("./stamping");
const {completeDay, graduateRerunInTxn} = require("./completion");
const {mintRestudyVisit, recordRerunHalfInTxn} = require("./visits");
const {evaluateThresholds, recordOpsMetric} = require("./monitoring");
const {readProgressTruth} = require("./progress");
const {resolveTypedGrade} = require("./typedGrading");

// [DF2-12 · 18_ §4] The typed leg delegates to `gradeTypedTest`, which reads
// ANTHROPIC_API_KEY from the process env — so the submit callable must carry
// the same secret binding or the grader has no key at runtime. `defineSecret`
// de-dupes by name (params registerParam), so this is the SAME param object
// index.js declares, not a second one. GRADE_TOKEN_SECRET is deliberately NOT
// bound: the engine grades with no binding context, so no gradeToken is ever
// minted (see typedGrading.js `defaultGrade`).
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

function getDb() {
  return admin.firestore();
}

// [r74 C8a] EMULATOR-ONLY test hook (same gating pattern as B3's crash
// hooks): lets the lap mutate authority BETWEEN a callable's preflight and
// its final transaction, proving the txn-level checks fire through the
// PUBLIC boundary. Inert in production by construction.
const _testHooks = {afterPreflight: null};
async function _runAfterPreflightHook() {
  if (process.env.FIRESTORE_EMULATOR_HOST && typeof _testHooks.afterPreflight === "function") {
    const fn = _testHooks.afterPreflight;
    _testHooks.afterPreflight = null; // one-shot
    await fn();
  }
}

// ---------------------------------------------------------------------------
// Shared fences (HttpsError ONLY for auth/args/not-found/permission — every
// protocol refusal returns as {status} data [r70 C5])
// ---------------------------------------------------------------------------

function requireAuth(request) {
  const uid = request.auth?.uid;
  if (typeof uid !== "string" || uid.length === 0) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  return uid;
}

function requireStrings(data, names) {
  for (const k of names) {
    if (typeof data?.[k] !== "string" || data[k].length === 0) {
      throw new HttpsError("invalid-argument", `${k} required`);
    }
  }
}

/**
 * [A4] IS THIS STORED DOCUMENT AN ENGINE ATTEMPT FOR THIS UID + PRESENTATION?
 *
 * The submit callable addresses its attempt by the DERIVED id
 * `rv2_{uid}_{presentationId}` (composer.js `engineDocId`), which is neither
 * secret nor server-owned: the live ruleset lets a student create a plain
 * `attempts/{anything}` document, and the client can derive the same id — its
 * own uid is the least secret thing it knows. So the existence of a document
 * there is not evidence of anything — provenance must come from the CONTENT.
 * The uid in the id is a NAMESPACE, not a fence [rv2-docid-collision A1]: it
 * stops two students colliding, it does not stop anyone writing there.
 *
 * The engine's own write (the WRITES block below) always stamps all five:
 * `studentId`, `presentationId`, an integer `resetEpoch` (THE engine/legacy
 * discriminator, completion.js:340), the complete frozen `gatePosture` shape
 * (15_ §4), and `engineResult`. Three of those are in the rules artifact's
 * `engineStampKeys()`, so a client cannot forge them on create or add them on
 * update — the rules and this check are the two halves of one fence, and this
 * half holds even where rules do not apply (Admin SDK, a pre-lockdown
 * document, or a future rules regression).
 */
function isEngineAttemptFor(stored, {uid, presentationId}) {
  if (!stored || typeof stored !== "object") return false;
  if (stored.studentId !== uid) return false;
  if (typeof presentationId !== "string" || presentationId.length === 0) return false;
  if (stored.presentationId !== presentationId) return false;
  if (!Number.isInteger(stored.resetEpoch)) return false;
  const gp = stored.gatePosture;
  const postureComplete = Boolean(gp) && typeof gp === "object" &&
    typeof gp.effectiveEnabled === "boolean" &&
    Number.isInteger(gp.configVersion) && gp.configVersion >= 1 &&
    Number.isInteger(gp.threshold) && gp.threshold >= 1 && gp.threshold <= 100 &&
    typeof gp.source === "string" && gp.source.length > 0;
  if (!postureComplete) return false;
  if (!stored.engineResult || typeof stored.engineResult !== "object") return false;
  return true;
}

/** Preflight gate: authorization (throws) + protocol posture (returns a
 *  refusal object or null). Binding posture checks re-run in every txn. */
async function resolveAndGate(db, {uid, classId, listId, clientContractVersion}) {
  const config = await resolveReviewConfig(db, {classId, listId, uid});
  if (config.readStatus === "hold") {
    return {refusal: {status: "config_hold", holdReason: config.holdReason}};
  }
  if (!config.classExists) throw new HttpsError("not-found", "class not found");
  if (!config.enrolled) throw new HttpsError("permission-denied", "not enrolled");
  if (!config.assignmentExists) throw new HttpsError("failed-precondition", "list not assigned");
  const stale = checkClientVersion(config, clientContractVersion);
  if (stale) return {refusal: stale};
  if (config.stampingEligible !== true) {
    return {refusal: {status: "review_v2_dark"}};
  }
  return {config};
}

/** Server-derived resetEpoch (§9 tombstone reduction) — courtesy preflight;
 *  every engine txn re-checks bindingly. */
async function deriveEpoch(db, uid, listId) {
  const [pm, lp] = await db.getAll(
      db.doc(`users/${uid}/progress_meta/${listId}`),
      db.doc(`users/${uid}/list_progress/${listId}`));
  const pmData = pm.exists ? pm.data() : null;
  const lpData = lp.exists ? lp.data() : null;
  if (resetLockActive(pmData, lpData)) {
    return {refusal: {status: "reset_in_progress"}};
  }
  return {resetEpoch: effectiveResetEpoch(pmData, lpData)};
}

/** Fire-and-forget ops emission — monitoring can never fail a request. */
function emitOps(db, event) {
  recordOpsMetric(db, event).catch(() => {});
}

/** Awaited (still swallow-on-error) — refusal paths use this so the signal
 *  is durably landed before the client can retry into the same defect. */
async function emitOpsAwait(db, event) {
  await recordOpsMetric(db, event).catch(() => {});
}

/** Canonical list order [r55] with the M-7 law: any word doc whose
 *  `position` is missing/non-integer, or a duplicate position, makes the
 *  list unusable for composition — typed refusal + ops signal, never a
 *  silent drop or an `internal`. */
async function loadCanonicalWordsStrict(db, listId) {
  const snap = await db.collection("lists").doc(listId).collection("words").get();
  const words = [];
  for (const d of snap.docs) {
    const pos = d.data().position;
    if (!Number.isInteger(pos) || pos < 0) {
      return {refusal: {status: "list_words_malformed", wordId: d.id}};
    }
    words.push({wordId: d.id, wordIndex: pos});
  }
  words.sort((a, b) => a.wordIndex - b.wordIndex);
  let positionGap = null;
  for (let i = 1; i < words.length; i++) {
    if (words[i].wordIndex === words[i - 1].wordIndex) {
      return {refusal: {status: "list_words_malformed", wordId: words[i].wordId, duplicatePosition: words[i].wordIndex}};
    }
    // [r72 N-1] positions with GAPS stay servable (the engine is ordinal),
    // but the divergence from the positional CS anchor law (twi = nwei+1)
    // must SURFACE — a warning signal, never a refusal.
    if (positionGap === null && words[i].wordIndex !== words[i - 1].wordIndex + 1) {
      positionGap = {afterWordId: words[i - 1].wordId, expected: words[i - 1].wordIndex + 1, got: words[i].wordIndex};
    }
  }
  return {words, positionGap};
}

// ---------------------------------------------------------------------------
// 1. Compose the live review session (queue + presentation claim)
// ---------------------------------------------------------------------------

const reviewV2ComposeSession = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId", "composeKey"]);
  if (!Number.isInteger(d.logicalDay) || d.logicalDay < 1) {
    throw new HttpsError("invalid-argument", "logicalDay must be an integer ≥ 1");
  }
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  await _runAfterPreflightHook(); // [r74 C8a] emulator-only race injection
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }
  if (canonical.words.length === 0) {
    throw new HttpsError("failed-precondition", "list has no words");
  }
  if (canonical.positionGap) { // [L-7] awaited like every list_words_malformed emission
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: {warning: "positionGap", ...canonical.positionGap}});
  }

  const q = await composeDayQueue(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    canonicalWords: canonical.words,
    clientContractVersion: d.clientContractVersion,
  });
  if (q.status !== "created" && q.status !== "exists") return q;
  if (q.status === "created" && q.cursorRepaired) {
    emitOps(db, {type: "cursor_repaired", uid, classId: d.classId, listId: d.listId,
      payload: {logicalDay: d.logicalDay}});
  }

  const wordIndexByWordId = {};
  for (const w of canonical.words) wordIndexByWordId[w.wordId] = w.wordIndex;
  const p = await composePresentation(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    composeKey: d.composeKey, mode: "live-review",
    wordIndexByWordId,
    clientContractVersion: d.clientContractVersion,
  });
  if (p.status !== "created" && p.status !== "replayed") return p;

  if (p.status === "created") {
    if (p.fallbackUsed) {
      // §6c duty (post-txn — selection is not correctness-critical, R2-42).
      emitOps(db, {type: "composition_fallback", uid, classId: d.classId, listId: d.listId,
        payload: {presentationId: p.presentationId, fallbackSeed: p.fallbackSeed}});
    }
    // PRIORITY SATURATION [R2-46/C7]: the whole test is failed words.
    if (Number.isInteger(p.priorityCount) && Number.isInteger(p.effectiveTestSize) &&
        p.priorityCount >= p.effectiveTestSize) {
      emitOps(db, {type: "priority_saturation_day", uid, classId: d.classId, listId: d.listId,
        payload: {logicalDay: d.logicalDay, priorityCount: p.priorityCount,
          effectiveTestSize: p.effectiveTestSize}});
    }
  }

  return {
    status: "composed",
    queue: {
      queueId: q.queueId,
      orderedQueueWordIds: q.queue.orderedQueueWordIds,
      snapshot: q.queue.snapshot,
      logicalDay: d.logicalDay,
      resetEpoch: epoch.resetEpoch,
    },
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
    },
    gatePosture: {
      effectiveEnabled: q.config.gateEffectiveEnabled,
      threshold: q.config.threshold,
      configVersion: q.config.configVersion,
      source: "compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 2. Compose the live NEW-word test (r70 C4 — every graded test stamps, so
//    the live-new leg needs a server presentation + denominator too)
// ---------------------------------------------------------------------------

const reviewV2ComposeNewTest = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId", "composeKey"]);
  if (!Number.isInteger(d.logicalDay) || d.logicalDay < 1) {
    throw new HttpsError("invalid-argument", "logicalDay must be an integer ≥ 1");
  }
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }
  if (canonical.positionGap) { // [r74 O2a/L-7] the warn reaches EVERY load, AWAITED
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: {warning: "positionGap", ...canonical.positionGap}});
  }

  // The day's range = [twi, twi + dailyPace) over canonical order. The
  // frontier binds THREE times: this preflight (cheap early refusal), the
  // claim txn (bindFrontier), and the submit txn [r72 C2] — the mint
  // boundary is never crossable with a stale day.
  const truth = await readProgressTruth(db, {uid, classId: d.classId, listId: d.listId});
  if (d.logicalDay !== truth.frontierDay) {
    return {status: "day_guard_rejected", expectedDay: truth.frontierDay};
  }
  const foundation = require("../foundation");
  const {dailyPace} = foundation.deriveDailyPace(gate.config.assignmentRaw ?? {});
  // ORDINAL slice [r72 M-A]: twi is a COUNT — the day's words are the next
  // `dailyPace` words AFTER the first twi, gap-tolerant.
  const dayWords = canonical.words.slice(truth.twi, truth.twi + Math.max(1, dailyPace));
  if (dayWords.length === 0) {
    return {status: "list_end", twi: truth.twi};
  }
  const rangeStartIndex = dayWords[0].wordIndex;
  const rangeEndIndex = dayWords[dayWords.length - 1].wordIndex;

  const p = await composePresentation(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    composeKey: d.composeKey, mode: "new-day", kind: "live",
    presentedWordIds: dayWords.map((w) => w.wordId),
    poolWordIds: dayWords.map((w) => w.wordId),
    rangeStartIndex, rangeEndIndex,
    bindFrontier: true, // [r72 C2] the claim txn re-reads progress and re-binds
    testType: gate.config.reviewTestType === "typed" ? "typed" : "mcq",
    clientContractVersion: d.clientContractVersion,
  });
  if (p.status !== "created" && p.status !== "replayed") return p;
  return {
    status: "composed",
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
      rangeStartIndex, rangeEndIndex,
    },
    gatePosture: {
      effectiveEnabled: gate.config.gateEffectiveEnabled,
      threshold: gate.config.threshold,
      configVersion: gate.config.configVersion,
      source: "new-compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 3. Compose a rerun presentation (restudy halves — review or new)
// ---------------------------------------------------------------------------

const reviewV2ComposeRerun = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId", "composeKey", "visitId", "half"]);
  if (!Number.isInteger(d.visitedDay) || d.visitedDay < 1) {
    throw new HttpsError("invalid-argument", "visitedDay must be an integer ≥ 1");
  }
  if (d.half !== "review" && d.half !== "new") {
    throw new HttpsError("invalid-argument", "half must be 'review'|'new'");
  }
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }
  if (canonical.positionGap) { // [r74 O2a/L-7] the warn reaches EVERY load, AWAITED
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: {warning: "positionGap", ...canonical.positionGap}});
  }

  let p;
  if (d.half === "review") {
    // Pool = the FULL currently-introduced range, sliced INSIDE the claim
    // txn from its own progress read [r70 C2]; visit binding in-txn [C4].
    p = await composePresentation(db, {
      uid, classId: d.classId, listId: d.listId,
      logicalDay: d.visitedDay, resetEpoch: epoch.resetEpoch,
      composeKey: d.composeKey, mode: "rerun-review",
      canonicalWords: canonical.words,
      testSize: gate.config.testSize,
      testType: gate.config.reviewTestType,
      visitId: d.visitId,
      clientContractVersion: d.clientContractVersion,
    });
  } else {
    // Rerun NEW half: the visited day's own HISTORICAL anchor range (the
    // day completed, so its passed new anchor exists by construction).
    const foundation = require("../foundation");
    const a = await foundation.deriveDayAnchorRange(uid, d.listId, d.visitedDay);
    if (!a || !Number.isInteger(a.newWordEndIndex) || !Number.isInteger(a.newWordStartIndex)) {
      return {status: "no_evidence", reason: "visited day has no new-word anchor"};
    }
    const dayWords = canonical.words
        .filter((w) => w.wordIndex >= a.newWordStartIndex && w.wordIndex <= a.newWordEndIndex)
        .map((w) => w.wordId);
    if (dayWords.length === 0) return {status: "empty_pool"};
    p = await composePresentation(db, {
      uid, classId: d.classId, listId: d.listId,
      logicalDay: d.visitedDay, resetEpoch: epoch.resetEpoch,
      composeKey: d.composeKey, mode: "new-day", kind: "rerun",
      presentedWordIds: dayWords, poolWordIds: dayWords,
      testType: gate.config.reviewTestType,
      visitId: d.visitId,
      clientContractVersion: d.clientContractVersion,
    });
  }
  if (p.status !== "created" && p.status !== "replayed") return p;
  return {
    status: "composed",
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
      visitId: d.visitId,
    },
    gatePosture: {
      effectiveEnabled: gate.config.gateEffectiveEnabled,
      threshold: gate.config.threshold,
      configVersion: gate.config.configVersion,
      source: "rerun-compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 4. Submit a review-engine attempt — THE attempt txn: drift rule + MCQ
//    server verdict + COMPLETE-ROWS + stamps (+ rerun graduation/visit half)
// ---------------------------------------------------------------------------

const reviewV2SubmitAttempt = onCall({enforceAppCheck: false, secrets: [anthropicApiKey]}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["presentationId"]);
  if (!Array.isArray(d.answers)) {
    throw new HttpsError("invalid-argument", "answers array required");
  }
  for (const a of d.answers) {
    if (typeof a?.wordId !== "string" || a.wordId.length === 0 ||
        typeof (a.studentResponse ?? "") !== "string") {
      throw new HttpsError("invalid-argument", "each answer needs {wordId, studentResponse}");
    }
  }

  // Pre-reads OUTSIDE the txn: presentation identity → gate on its class.
  // Every binding check re-runs inside the txn.
  const presRef = db.doc(`users/${uid}/review_presentations/${d.presentationId}`);
  const preSnap = await presRef.get();
  if (!preSnap.exists) throw new HttpsError("not-found", "presentation not found");
  const pres = preSnap.data();
  if (pres.uid !== uid) throw new HttpsError("permission-denied", "not yours");
  const gate = await resolveAndGate(db, {
    uid, classId: pres.classId, listId: pres.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;

  // Answer-sheet validation + the canonical answer key — SHARED by BOTH
  // modalities [DF2-12]: typed grades the SAME presented set under the SAME
  // drift rule, and its rows must be shaped identically to MCQ's [18_ §5.2].
  const presentedSet = new Set(pres.presentedWordIds);
  const submitted = new Map();
  for (const a of d.answers) {
    if (!presentedSet.has(a.wordId)) {
      throw new HttpsError("invalid-argument", "answer for unpresented word (drift rule)");
    }
    if (submitted.has(a.wordId)) {
      throw new HttpsError("invalid-argument", "duplicate answer row");
    }
    submitted.set(a.wordId, String(a.studentResponse ?? ""));
  }
  const wordRefs = pres.presentedWordIds.map((id) =>
    db.collection("lists").doc(pres.listId).collection("words").doc(id));
  const wordSnaps = await db.getAll(...wordRefs);
  const keyByWordId = new Map();
  const wordMetaById = new Map(); // typed: the grader needs word + definitions
  wordSnaps.forEach((s) => {
    if (!s.exists) return;
    keyByWordId.set(s.id, s.data().definition ?? null);
    wordMetaById.set(s.id, s.data());
  });

  // [rv2-docid-collision A1] `attempts` is a GLOBAL collection and
  // `presentationId` carries no uid, so the derived id acquires the scope the
  // presentation had by path. MUST stay the same derivation as
  // typedGrading.js's `jobKey` — one function, called twice.
  const attemptId = engineDocId(uid, d.presentationId);
  const attemptRef = db.collection("attempts").doc(attemptId);
  const pmRef = db.doc(`users/${uid}/progress_meta/${pres.listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${pres.listId}`);

  let rows;
  let correctnessSource = null;
  let gradeSkippedForReplay = false;
  if (pres.testType === "typed") {
    // ---- THE TYPED LEG [DF2-12 · 18_ §4] --------------------------------
    // REPLAY FIRST [§5.4 + §6]: an already-written attempt is returned by the
    // txn below as the NORMALIZED envelope. Short-circuit here so a replay
    // performs ZERO writes AND never touches the grading job — a claim on a
    // vanished/expired job would otherwise re-grade and charge the AI twice.
    const preAttempt = await attemptRef.get();
    if (preAttempt.exists) {
      rows = [];
      gradeSkippedForReplay = true;
    } else {
      const graded = await resolveTypedGrade(db, {
        uid, classId: pres.classId, listId: pres.listId,
        presentationId: d.presentationId,
        presentedWordIds: pres.presentedWordIds,
        submitted, wordMetaById,
        // [ai-metering-build A4] THE SPEND-CAP DISCRIMINATOR, supplied HERE
        // because this is the only layer that knows the session shape. It is
        // the SERVER-authored fingerprint (presentations.js writes `kind` from
        // its own `mode`; a client cannot set it), read from the same pre-txn
        // presentation snapshot the typed grade already runs against. Strict
        // equality: absent, malformed or "live" ⇒ false ⇒ LIVE ⇒ the meter can
        // never refuse it. Only the optional restudy rerun is cappable.
        isRetest: pres.requestFingerprint?.kind === "rerun",
      });
      if (graded.refusal) return graded.refusal; // DATA, zero attempt writes
      rows = graded.rows;
    }
    // The write path's provenance marker [18_ §4(4)]: this grade came from
    // the server-side AI grader, never from a client verdict.
    correctnessSource = "server-ai";
  } else {
    // MCQ answer key: canonical definitions (never the client's).
    // COMPLETE-ROWS [r64]: one row per PRESENTED word; absent/empty ⇒ blank.
    rows = pres.presentedWordIds.map((wordId) => {
      const resp = (submitted.get(wordId) ?? "").trim();
      const key = keyByWordId.get(wordId);
      const blank = resp === "";
      const isCorrect = !blank && key != null && resp === String(key).trim();
      return {
        wordId,
        studentResponse: submitted.get(wordId) ?? "",
        correctDefinition: key,
        isCorrect,
        ...(blank ? {blank: true} : {}),
      };
    });
  }
  const totalQuestions = rows.length;
  const correctCount = rows.filter((r) => r.isCorrect).length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // [r74 C8a] the same emulator-only one-shot race hook as compose (:241),
  // here so the lap can alter state BETWEEN the submit pre-reads and the txn
  // (e.g. the attempt vanishing after the replay pre-read — the
  // `gradeSkippedForReplay` refusal below). Inert in production by
  // construction (env-gated).
  await _runAfterPreflightHook();
  const result = await db.runTransaction(async (txn) => {
    // ---- READS (the activation barrier: config joins THIS txn) ----------
    const txnConfig = await resolveReviewConfig(db, {classId: pres.classId, listId: pres.listId, uid, txn});
    const [pm, lp, aSnap, pSnap] = await txn.getAll(pmRef, lpRef, attemptRef, presRef);
    // Serving authority AT TXN TIME [r70 C3] — an eligibility/fence edit
    // between preflight and commit mints NOTHING.
    const refusal = assertServableInTxn(txnConfig, d.clientContractVersion);
    if (refusal) return refusal;
    if (aSnap.exists) {
      // [A4 · Codex r78 follow-up] PROVENANCE IS NEVER INFERRED FROM THE
      // DOCUMENT NAME. `attempts` create is open to the owning student in the
      // live ruleset (rules-matrix 9-a1 / A21) and `rv2_{uid}_{presentationId}`
      // is an id the client can derive itself (reviewV2Client.js:173 + its own
      // uid — the uid scoping is a namespace, not a fence), so "a doc
      // exists at this id" proved nothing — yet this early return handed back
      // its `score`/`passed`/`engineResult` as an engine replay. A replay is
      // now served ONLY for a fully-stamped ENGINE attempt belonging to THIS
      // uid and claiming THIS presentation; anything else fails CLOSED as
      // DATA with ZERO writes. Fixtures: lap CASE TR (pre-seeded · legacy
      // shaped · wrong presentation · foreign uid · the legitimate replay).
      // [NAMESPACE RESERVED — 2026-08-04, NTF 19+22 fold] The squat ROUTES
      // into this id space are now closed at their mouths: firestore.rules
      // denies client create/update/delete at `rv2_`-named attempt ids (G1)
      // and the live callables refuse client-supplied `rv2_` attemptDocIds
      // (functions/index.js assertNotEngineReservedDocId — G2/G3). This
      // provenance check STAYS — it is the consumer-side half of the fence,
      // and it holds where the mouth guards do not apply (Admin SDK writes,
      // documents predating the guards, a future rules regression).
      const stored = aSnap.data();
      if (!isEngineAttemptFor(stored, {uid, presentationId: d.presentationId})) {
        return {status: "presentation_invalid",
          reason: "attempt identity occupied by a non-engine document"};
      }
      const storedRows = Array.isArray(stored.answers) ? stored.answers : [];
      const er = stored.engineResult ?? {};
      return {
        status: "attempt_written",
        replayed: true,
        attemptId,
        score: stored.score,
        passed: stored.passed,
        totalQuestions: stored.totalQuestions,
        correctCount: storedRows.filter((r) => r?.isCorrect === true).length,
        stamped: er.stamped ?? null,
        stampSkipped: er.stampSkipped ?? null,
        rerunGraduated: er.rerunGraduated ?? [],
        visitHalf: er.visitHalf ?? null,
        gatePosture: stored.gatePosture ?? null,
      };
    }
    if (gradeSkippedForReplay) {
      // The pre-read saw a stored attempt, so the typed grade was skipped —
      // and now the doc is gone. Mint NOTHING from an empty answer sheet;
      // `grading_in_progress` is the retryable typed status, and the retry
      // grades from scratch (or from the still-cached job).
      return {status: "grading_in_progress"};
    }
    const pmData = pm.exists ? pm.data() : null;
    const lpData = lp.exists ? lp.data() : null;
    if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== pres.resetEpoch) {
      return {status: "reset_epoch_mismatch", currentEpoch};
    }
    if (!pSnap.exists) throw new Error("presentation vanished");
    const p = pSnap.data();
    // [r74 L-6] the session-shape booleans derive from the IN-TXN snapshot
    // (the pre-read `pres` was preflight courtesy only).
    const isRerunTxn = p.requestFingerprint?.kind === "rerun";
    const isNewSessionTxn = p.requestFingerprint?.sessionType === "new";
    const isReviewTypeTxn = p.requestFingerprint?.sessionType === "review";

    // Threshold: the day's pinned queue snapshot for live review (FAIL-
    // CLOSED [r70 C5]: a queueRef with a missing/malformed queue refuses —
    // never silently falls to current config); current config for reruns
    // and new tests (not day-pinned).
    let threshold = txnConfig.threshold;
    let queueId = null;
    // [r73] a presentation without a well-formed fingerprint is CORRUPT —
    // engine claims always write one; refuse rather than mint a
    // mis-typed attempt around the queue/frontier guards.
    if (p.requestFingerprint?.sessionType !== "review" && p.requestFingerprint?.sessionType !== "new") {
      return {status: "presentation_invalid", reason: "fingerprint missing or malformed"};
    }
    // [r72 C5] a LIVE REVIEW without its queue is never servable — the fence
    // below is REQUIRED for it, optional legs stay only for new/rerun.
    if (isReviewTypeTxn && !isRerunTxn && !p.queueRef) {
      return {status: "queue_invalid", reason: "live review requires a queue"};
    }
    // [r72 C2] the live-new MINT re-binds the frontier in ITS txn — a stale
    // unclaimed presentation (pre-advance) can never cross into an attempt.
    if (isNewSessionTxn && !isRerunTxn) {
      const {readProgressTruthInTxn} = require("./progress");
      const truth = await readProgressTruthInTxn(txn, db, {uid, classId: p.classId, listId: p.listId});
      if (p.logicalDay !== truth.frontierDay) {
        return {status: "day_guard_rejected", expectedDay: truth.frontierDay};
      }
    }
    if (p.queueRef) {
      // FULL QUEUE FENCE [r72 C5 — fail-closed on every leg]: canonical
      // path, queue identity, queue↔presentation pool hash, presented
      // membership, threshold bounds.
      queueId = queueDocId(p.classId, p.listId, p.logicalDay, p.resetEpoch);
      if (p.queueRef !== `users/${uid}/review_queues/${queueId}`) {
        return {status: "queue_invalid", reason: "non-canonical queueRef"};
      }
      const qSnap = await txn.get(db.doc(p.queueRef));
      if (!qSnap.exists) return {status: "queue_invalid", reason: "queue missing"};
      const q = qSnap.data();
      if (q.uid !== uid || q.classId !== p.classId || q.listId !== p.listId ||
          q.logicalDay !== p.logicalDay || q.resetEpoch !== p.resetEpoch) {
        return {status: "queue_invalid", reason: "queue identity mismatch"};
      }
      if (q.poolHash !== p.poolHash) {
        return {status: "queue_invalid", reason: "pool-hash mismatch"};
      }
      const qSet = new Set(q.orderedQueueWordIds);
      if (!p.presentedWordIds.every((w) => qSet.has(w))) {
        return {status: "queue_invalid", reason: "presented not a queue subset"};
      }
      const th = q.snapshot?.threshold;
      if (!Number.isInteger(th) || th < 1 || th > 100) {
        return {status: "queue_invalid", reason: "snapshot threshold malformed"};
      }
      threshold = th;
    }
    const passed = score >= threshold;

    // Rerun visit binding [r70 C4]: the half binds to ITS visit — read +
    // tuple-verified in-txn; missing/mismatched ⇒ typed, mints nothing.
    let visitSnap = null;
    if (isRerunTxn) {
      if (typeof p.visitId !== "string" || p.visitId.length === 0) {
        return {status: "visit_invalid", reason: "rerun presentation lacks visitId"};
      }
      visitSnap = await txn.get(db.doc(`users/${uid}/restudy_visits/${p.visitId}`));
      if (!visitSnap.exists) return {status: "visit_invalid", reason: "visit missing"};
      const v = visitSnap.data();
      if (v.uid !== uid || v.classId !== p.classId || v.listId !== p.listId ||
          v.day !== p.logicalDay || v.resetEpoch !== p.resetEpoch) {
        return {status: "visit_invalid", reason: "visit tuple mismatch"};
      }
    }

    // ---- WRITES ----------------------------------------------------------
    const attempt = {
      studentId: uid,
      classId: p.classId,
      listId: p.listId,
      testId: `vocaboost_test_${p.classId}_${p.listId}_${isNewSessionTxn ? "new" : "review"}`,
      studyDay: p.logicalDay,
      sessionType: isNewSessionTxn ? "new" : "review",
      testType: p.testType,
      ...(isRerunTxn ? {type: "retest", visitId: p.visitId ?? null} : {}),
      // Live new-day attempts carry the day's anchor range (continuity for
      // deriveDayAnchorRange/completion twi advance); rerun halves stay
      // range-less (legacy readers blind to them) [r70 C4/L-8].
      ...(isNewSessionTxn && !isRerunTxn &&
          Number.isInteger(p.rangeStartIndex) && Number.isInteger(p.rangeEndIndex)
        ? {newWordStartIndex: p.rangeStartIndex, newWordEndIndex: p.rangeEndIndex}
        : {}),
      score,
      passed,
      totalQuestions,
      answers: rows,
      // G2 provenance [18_ §4(4)]: 'server-ai' on the typed leg (the rows'
      // isCorrect came from the server-side AI grader); omitted for MCQ,
      // whose verdict is server-computed against the canonical definition.
      ...(correctnessSource ? {correctnessSource} : {}),
      presentationId: d.presentationId,
      queueId,
      resetEpoch: p.resetEpoch,
      gatePosture: {
        effectiveEnabled: txnConfig.gateEffectiveEnabled,
        threshold,
        configVersion: txnConfig.configVersion,
        source: "reviewV2SubmitAttempt",
      },
      submittedAt: FieldValue.serverTimestamp(),
    };

    const stamps = stampLabelsInTxn(txn, db, {
      uid, config: txnConfig, rows,
      presentedWordIds: p.presentedWordIds,
      isReviewType: isReviewTypeTxn, isPassing: passed,
    });

    let rerunGraduated = [];
    let visitHalf = null;
    if (isRerunTxn && passed) {
      if (isReviewTypeTxn) {
        const g = graduateRerunInTxn(txn, db, {
          uid, config: txnConfig,
          rows: rows.map((r) => ({wordId: r.wordId, isCorrect: r.isCorrect})),
          nowMs: Date.now(),
        });
        rerunGraduated = g.graduated;
      }
      visitHalf = recordRerunHalfInTxn(txn, db, {
        uid, visitSnap,
        half: isReviewTypeTxn ? "review" : "new",
        attemptId,
      });
    }

    // [r72 C5] the engine facts persist ON the attempt so a replay returns
    // the SAME semantic envelope as the first commit — never a hard-coded
    // null/[] substitute.
    attempt.engineResult = {
      stamped: stamps.stamped, stampSkipped: stamps.skipped,
      rerunGraduated, visitHalf,
    };
    txn.create(attemptRef, attempt);
    txn.update(presRef, {"serverClaim.attemptDocId": attemptId});

    return {
      status: "attempt_written",
      replayed: false,
      attemptId, score, passed, totalQuestions, correctCount,
      stamped: stamps.stamped, stampSkipped: stamps.skipped,
      rerunGraduated, visitHalf,
      gatePosture: attempt.gatePosture,
    };
  });

  if (result.status === "attempt_written" && !result.replayed &&
      Array.isArray(result.rerunGraduated) && result.rerunGraduated.length > 0) {
    // RERUN-GRADUATION volume [R2-41(g)/C7] — from the successful txn.
    emitOps(db, {type: "rerun_graduation", uid, classId: pres.classId, listId: pres.listId,
      payload: {attemptId: result.attemptId, count: result.rerunGraduated.length}});
  }
  return result;
});

// ---------------------------------------------------------------------------
// 5. Complete the shared logical day (the §3b CAS + graduation + streak +
//    THE CANONICAL ADVANCE — one transaction, completion.js C1)
// ---------------------------------------------------------------------------

const reviewV2CompleteDay = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId"]);
  if (!Number.isInteger(d.logicalDay) || d.logicalDay < 1) {
    throw new HttpsError("invalid-argument", "logicalDay must be an integer ≥ 1");
  }
  const consumedAttemptId = typeof d.consumedAttemptId === "string" && d.consumedAttemptId.length > 0
    ? d.consumedAttemptId : null;
  const consumedAttemptClassId = typeof d.consumedAttemptClassId === "string" && d.consumedAttemptClassId.length > 0
    ? d.consumedAttemptClassId : null;
  const newTestAttemptId = typeof d.newTestAttemptId === "string" && d.newTestAttemptId.length > 0
    ? d.newTestAttemptId : null;

  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }
  if (canonical.positionGap) { // [r74 O2a/L-7] the warn reaches EVERY load, AWAITED
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: {warning: "positionGap", ...canonical.positionGap}});
  }

  return completeDay(db, {
    uid, winningClassId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    consumedAttemptId, consumedAttemptClassId, newTestAttemptId,
    canonicalWordCount: canonical.words.length,
    clientContractVersion: d.clientContractVersion,
  });
});

// ---------------------------------------------------------------------------
// 6. Mint a restudy visit (R2-40 — a §9-fenced txn, day ≤ csd)
// ---------------------------------------------------------------------------

const reviewV2MintVisit = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId"]);
  if (!Number.isInteger(d.day) || d.day < 1) {
    throw new HttpsError("invalid-argument", "day must be an integer ≥ 1");
  }
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  return mintRestudyVisit(db, {
    uid, classId: d.classId, listId: d.listId, day: d.day,
    resetEpoch: epoch.resetEpoch,
    clientContractVersion: d.clientContractVersion,
  });
});

// ---------------------------------------------------------------------------
// 7. The evaluator (ADMIN-ONLY — ops surface, R2-18 signals)
// ---------------------------------------------------------------------------

const reviewV2EvaluateThresholds = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  requireAuth(request);
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "admin only");
  }
  const d = request.data ?? {};
  return evaluateThresholds(db, {
    scope: d.scope,
    dryRun: d.dryRun !== false, // default DRY — explicit false to publish
    thresholds: typeof d.thresholds === "object" && d.thresholds !== null ? d.thresholds : {},
    windowMs: Number.isFinite(d.windowMs) ? d.windowMs : undefined,
  });
});

module.exports = {
  loadCanonicalWordsStrict, // test-facing [r73 — the N-1 gap fixture]
  isEngineAttemptFor, // test-facing [A4 — the replay-provenance predicate]
  _testHooks, // emulator-only [r74 C8a]
  reviewV2ComposeSession,
  reviewV2ComposeNewTest,
  reviewV2ComposeRerun,
  reviewV2SubmitAttempt,
  reviewV2CompleteDay,
  reviewV2MintVisit,
  reviewV2EvaluateThresholds,
};
