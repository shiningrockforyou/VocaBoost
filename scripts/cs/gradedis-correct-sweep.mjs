#!/usr/bin/env node
/**
 * ============================================================================
 * CS — gradedis-correct-sweep.mjs: READ-ONLY quantification of whether the
 *      client-writable `answers[].gradedIsCorrect` ever disagrees with a
 *      recomputation / a server-written grading record.
 * ============================================================================
 * WHY (David, 2026-08-05): NEED_TO_FIX.md "#NN — GATE-4 BACKFILL TRUSTS A
 * CLIENT-WRITABLE FIELD (`answers[].gradedIsCorrect`)". The GATE-4 backfill
 * consumes that boolean as grading authority (scripts/deepfix2/b1-replay-lib.mjs:99
 * `if (typeof r.gradedIsCorrect === "boolean") gradedOk = r.gradedIsCorrect;`),
 * and the live attempts rule lets a student rewrite their own `answers` array
 * wholesale (`hasOnly(['answers'])` constrains WHICH top-level key changes, not
 * what goes inside it; Firestore rules cannot inspect array elements). Before
 * choosing option 1 (ignore the field) vs option 2 (cross-check it), quantify
 * the population. This is NEED_TO_FIX option 3, "read-only sweep first".
 *
 * ---------------------------------------------------------------------------
 * READ-ONLY — LAW, NOT A PREFERENCE
 * ---------------------------------------------------------------------------
 * The ONLY Firestore APIs reached from this file are `.get()` on a
 * collection / document / query reference, plus the pure query builders
 * `.where()` / `.limit()` / `.orderBy()` and `.count().get()`. There is no
 * writer, no deleter, no transaction and no batch anywhere in this file — not
 * even a dormant one.
 *
 * The proof is a grep for every mutating Firestore verb that returns ZERO
 * matches against this file — see the runbook entry CS-2026-08-05 for the exact
 * command and its recorded output. To keep that proof a clean one-liner this
 * file avoids those verb tokens even in pure-JS uses: counters are plain objects
 * and `push`-ed arrays rather than Map/Set, because a JS `Map` mutator shares a
 * name with a Firestore one and would muddy the signal.
 *
 * The only bytes this script writes anywhere are to the LOCAL FILESYSTEM: the
 * evidence JSON at --out.
 *
 * ---------------------------------------------------------------------------
 * DATA MODEL — DISCOVERED EMPIRICALLY 2026-08-05 (6 students / 328 attempts /
 * 9,650 answer rows in the live 26SM cohort, project vocaboost-879c2)
 * ---------------------------------------------------------------------------
 * attempts/{attemptDocId}: docId = `${uid}_${testId}_${nonce}` (client-derived,
 *   src/pages/TypedTest.jsx:833, src/pages/MCQTest.jsx:725). Fields observed:
 *   studentId, testId, classId, listId, teacherId, testType ('mcq'|'typed'),
 *   sessionType ('new'|'review'), studyDay, score, graded, answers[], skipped,
 *   totalQuestions, credibility, retention, submittedAt, passed, plus flattened
 *   session context. Server-written attempts additionally carry writtenBy /
 *   gradedAt / correctnessSource.
 *
 * answers[] row — MCQ (src/pages/MCQTest.jsx:601 builds it, written verbatim by
 *   src/services/db.js submitTestAttempt:1348 `answers: answeredWords`):
 *     { wordId, word, correctAnswer, studentResponse, isCorrect }
 *   `correctAnswer` = the tested word's definition; `studentResponse` = the
 *   DEFINITION TEXT of the option the student clicked. So MCQ correctness is
 *   recomputable deterministically as a string compare — and this script
 *   compares against the CANONICAL definition read from lists/{listId}/words/
 *   {wordId}.definition (server/teacher-owned), never against the row's own
 *   `correctAnswer`, which lives inside the same client-writable array.
 *
 * answers[] row — TYPED (functions/index.js buildTypedAttemptAnswers:884 and
 *   src/services/db.js submitTypedTestAttempt:1457):
 *     { wordId, word, correctAnswer, studentResponse, isCorrect, aiReasoning,
 *       challengeStatus, challengeNote, challengeReviewedBy, challengeReviewedAt }
 *   Typed correctness is an AI verdict — NOT recomputable offline, and this
 *   script calls no AI. It is corroborated instead (below).
 *
 * `gradedIsCorrect` is NOT written at grade time on either path. It is born at
 *   the FIRST challenge adjudication, copied from the then-current `isCorrect`
 *   only where absent (functions/foundation.js:2066 applyChallengeAdjudication,
 *   the copy at :2069-2070; client mirror src/services/db.js:2951-2952). So it
 *   is the PRE-adjudication grade preimage, and on an ACCEPTED challenge it
 *   legitimately disagrees with the post-flip `isCorrect`.
 *
 * SERVER-WRITTEN GRADING RECORD — `grading_jobs/{jobKey}` (global collection;
 *   17,017 docs live). jobKey === the attempt's own docId: the client sends
 *   gradeContext.attemptDocId (TypedTest.jsx:833-836) and the callable keys the
 *   job off exactly that (functions/index.js:1185-1186), then the SAME id is
 *   reused for the attempt write (TypedTest.jsx:1003, 1200). Shape:
 *     { uid, status:'claimed'|'graded', leaseId, leaseExpiresAt, attemptCount,
 *       version, createdAt, updatedAt, gradedAt,
 *       payload: { results: [{wordId, isCorrect, reasoning}], gradeToken,
 *                  gradeTokenCreatedAt } }
 *   `payload` is written ONLY by persistGradingJobResult (functions/index.js:1102;
 *   the claim side is claimOrRecoverGradingJob at :1051) under an Admin-SDK
 *   transaction — students cannot write it (no client rule grants
 *   grading_jobs). It is therefore an independent server-side witness of
 *   what the AI actually returned for that exact attempt. Verified empirically:
 *   25 typed attempts probed -> 20 keyed straight onto a `graded` job with a
 *   matching `uid`; 15 MCQ attempts probed -> 0 jobs (MCQ is never AI-graded).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCRIPT DECIDES, PER ANSWER ROW
 * ---------------------------------------------------------------------------
 * gradedOk (the value GATE 4 would consume, b1-replay-lib.mjs:99 semantics):
 *     typeof gradedIsCorrect === 'boolean' ? gradedIsCorrect : isCorrect
 * MCQ  -> recompute norm(studentResponse) === norm(canonical definition);
 *         compare to gradedOk.
 * TYPED-> look up grading_jobs/{attemptDocId}.payload.results[wordId].isCorrect;
 *         compare to gradedOk. No AI is called. Rows without such a witness are
 *         reported as UNCORROBORATED, never as clean.
 * A disagreement that an ACCEPTED challenge explains (legacy accept: isCorrect
 * was flipped to true and no preimage was recorded, so gradedOk is the flipped
 * value) is counted in its own bucket, not as a discrepancy.
 * A disagreement on an attempt carrying `manualOverride:true` is a RECORDED CS /
 * teacher grade correction (see SUPPORT_RUNBOOK). It is still counted in the raw
 * mismatch total AND annotated as `mismatchWithManualOverrideMarker`, so it can
 * never hide a real one — but it does not set the exit status. That class is
 * decision-relevant in its own right: a recompute-only backfill would silently
 * revert those corrections.
 *
 * ---------------------------------------------------------------------------
 * LIMITS — state these when quoting the numbers
 * ---------------------------------------------------------------------------
 *  - MCQ recomputation is a string compare of definition text. If a list holds
 *    two words with the SAME normalized definition, a distractor is textually
 *    indistinguishable from the key; those rows are counted separately as
 *    `ambiguousDefinitionCollision` and are NOT proof of anything.
 *  - Typed rows with no grading job (pre-Phase-1 attempts, cleaned-up jobs,
 *    engine-path attempts) are UNCORROBORATED. Absence of a mismatch there is
 *    absence of evidence, not evidence of absence.
 *  - This measures DISAGREEMENT, not tampering. A forger who edits
 *    gradedIsCorrect AND studentResponse together stays self-consistent on the
 *    MCQ leg; only the typed leg's server witness resists that, and only where
 *    a job exists.
 *
 * Usage:
 *   NODE_PATH=/app/node_modules node scripts/cs/gradedis-correct-sweep.mjs \
 *     [classNameRegex=26SM] [--students=N] [--max-per-student=N] [--out=PATH]
 *   --students=N        process only the first N cohort students (smoke runs)
 *   --max-per-student=N deterministic cap: newest N attempts per student by
 *                       submittedAt desc (0 = no cap). Reported in the JSON.
 * Exit: 0 = no UNEXPLAINED discrepancy · 1 = unexplained discrepancies found.
 *       BOTH are DATA results, not a crash — a nonzero exit here means "read the
 *       samples", not "the script broke". A crash exits 2 via an uncaught throw.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const flagOf = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const filter = new RegExp(positional[0] || "26SM", "i");
const MAX_STUDENTS = Number(flagOf("students", "0")) || 0;
const MAX_PER_STUDENT = Number(flagOf("max-per-student", "0")) || 0;
const OUT = flagOf("out", "/app/docs/plans/deepfix2/evidence/gradedis-correct-sweep.json");
const KEY_PATH = process.env.LSR_SA_KEY || "/app/scripts/serviceAccountKey.json";

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const t0 = Date.now();
const reads = { classes: 0, attempts: 0, gradingJobs: 0, listWordDocs: 0 };
const uid8 = (u) => String(u || "").slice(0, 8);
const norm = (s) => String(s ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

// ---------------------------------------------------------------- cohort
// Same selection law as scripts/cs/data-integrity-sweep.mjs + impossible-results-sweep.mjs:
// class name regex, MINUS the sandbox families — one live class is literally named
// "25WT DUP THROTTLE 26SM SAT Final B", so a bare /26SM/ pulls synthetic data in.
const classSnap = await db.collection("classes").get();
reads.classes += classSnap.size;
const classNameById = {};     // EVERY class, so a cohort student's out-of-cohort attempt still names its class
const classInCohort = {};
const uidSeen = {};
let classesMatched = 0;
let classesSandboxExcluded = 0;
classSnap.forEach((d) => {
  const c = d.data();
  const name = c.name || "";
  classNameById[d.id] = name;
  if (!filter.test(name)) return;
  if (/25WT|DUP[_ ]/i.test(name)) { classesSandboxExcluded += 1; return; }
  classesMatched += 1;
  classInCohort[d.id] = true;
  (c.studentIds || []).forEach((u) => { uidSeen[u] = true; });
});
let students = Object.keys(uidSeen);
const cohortStudents = students.length;
if (MAX_STUDENTS > 0) students = students.slice(0, MAX_STUDENTS);
console.log(`[gic-sweep] project=${key.project_id} cohort=/${filter.source}/i classes=${classesMatched} (sandbox excluded=${classesSandboxExcluded}) students=${cohortStudents}${MAX_STUDENTS ? ` (processing first ${students.length})` : ""}`);

// ------------------------------------------------- canonical list-word cache
// lists/{listId}/words/{wordId}.definition is the TEACHER/SERVER-owned answer key.
// It is the anchor for the MCQ recomputation — deliberately NOT the row's own
// `correctAnswer`, which sits inside the same client-writable `answers` array.
const listDefs = {};        // listId -> { wordId: normalizedDefinition }
const listDefsRaw = {};     // listId -> { wordId: rawDefinition }  (for the strict-vs-normalized split)
const listDefFreq = {};     // listId -> { normalizedDefinition: howManyWordsHaveIt }
const listLoadFailed = {};
async function loadList(listId) {
  if (!listId) return null;
  if (listDefs[listId] !== undefined) return listDefs[listId];
  try {
    const ws = await db.collection("lists").doc(listId).collection("words").get();
    reads.listWordDocs += ws.size;
    const defs = {};
    const raw = {};
    const freq = {};
    ws.forEach((w) => {
      const d = w.data().definition;
      const n = norm(d);
      defs[w.id] = n;
      raw[w.id] = String(d ?? "");
      if (n !== "") freq[n] = (freq[n] || 0) + 1;
    });
    listDefs[listId] = defs;
    listDefsRaw[listId] = raw;
    listDefFreq[listId] = freq;
  } catch (e) {
    listLoadFailed[listId] = String(e && e.message);
    listDefs[listId] = null;
    listDefFreq[listId] = {};
  }
  return listDefs[listId];
}

// ---------------------------------------------------------------- counters
const T = {
  attemptsScanned: 0,
  attemptsSkippedByCap: 0,
  attemptsNoAnswersArray: 0,
  answerRows: 0,
  rowsWithGradedIsCorrect: 0,
  rowsWithoutGradedIsCorrect: 0,
  rowsMcq: 0,
  rowsTyped: 0,
  rowsOtherTestType: 0,
  rowsChallengePending: 0,
  rowsChallengeAccepted: 0,
  rowsChallengeRejected: 0,
  // GATE-4 relevant: an ACCEPTED row with no preimage is the R2-49 "legacy accepted"
  // class b1-replay-lib reconstructs as graded-WRONG. Count it explicitly.
  rowsAcceptedWithoutPreimage: 0,
  attemptsWithManualOverride: 0,
  // gradedIsCorrect vs the row's live isCorrect (independent of any recomputation)
  preimageAgreesWithIsCorrect: 0,
  preimageDisagreesWithIsCorrect: 0,
  preimageDisagreesWithoutAcceptedChallenge: 0,
};
const MCQ = {
  recomputed: 0,
  match: 0,
  mismatch: 0,
  // SUBSET of `mismatch`: the attempt carries manualOverride:true — a CS/teacher grade
  // correction, i.e. a divergence that is CORRECT and would be DESTROYED by a
  // recompute-only backfill. Counted inside `mismatch`, never instead of it.
  mismatchWithManualOverrideMarker: 0,
  mismatchUnexplained: 0,
  mismatchAdjudicationExplained: 0,
  ambiguousDefinitionCollision: 0,
  matchedOnlyAfterNormalization: 0,
  blankResponse: 0,
  unresolvableWord: 0,
  noListId: 0,
  noStudentResponseField: 0,
  storedCorrectAnswerDrift: 0,
};
const TYPED = {
  corroboratedMatch: 0,
  corroboratedMismatch: 0,
  // SUBSET of `corroboratedMismatch` — see the MCQ note above.
  mismatchWithManualOverrideMarker: 0,
  mismatchUnexplained: 0,
  mismatchAdjudicationExplained: 0,
  uncorroborated: 0,
  uncorroboratedNoJobDoc: 0,
  uncorroboratedJobNotGraded: 0,
  uncorroboratedWordAbsentFromJob: 0,
  attemptsWithJob: 0,
  attemptsWithoutJob: 0,
};
// Is "uncorroborated" a TIME boundary (attempts predating the grading-job cache) or a
// scattered gap? The submittedAt envelope of each population answers that.
const typedSpan = { withJobMin: null, withJobMax: null, withoutJobMin: null, withoutJobMax: null };
const typedMonths = { withJob: {}, withoutJob: {} };   // 'YYYY-MM' -> attempt count
function spanNote(withJob, ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const lo = withJob ? "withJobMin" : "withoutJobMin";
  const hi = withJob ? "withJobMax" : "withoutJobMax";
  if (typedSpan[lo] === null || ms < typedSpan[lo]) typedSpan[lo] = ms;
  if (typedSpan[hi] === null || ms > typedSpan[hi]) typedSpan[hi] = ms;
  const bucket = withJob ? typedMonths.withJob : typedMonths.withoutJob;
  const m = new Date(ms).toISOString().slice(0, 7);
  bucket[m] = (bucket[m] || 0) + 1;
}
const perClass = {};        // classId -> counters
const perStudent = {};      // uid8 -> discrepancy counters
const samples = { mcqMismatch: [], typedCorroboratedMismatch: [], preimageDisagreesNoAccept: [] };
const SAMPLE_CAP = 25;

function classBucket(classId) {
  const k = classId || "no_class";
  if (perClass[k] === undefined) {
    perClass[k] = {
      className: classNameById[k] !== undefined ? classNameById[k] : (k === "no_class" ? "(no class)" : "(class doc absent)"),
      // false = a cohort student ALSO has attempts in a class outside the regex; those
      // attempts are still scanned (the field is per-student, not per-class) and reported here.
      inCohortRegex: classInCohort[k] === true,
      attempts: 0, rows: 0, rowsWithGradedIsCorrect: 0,
      mcqRows: 0, mcqMismatch: 0, mcqMismatchAdjudicationExplained: 0,
      typedRows: 0, typedCorroboratedMatch: 0, typedCorroboratedMismatch: 0, typedUncorroborated: 0,
    };
  }
  return perClass[k];
}
function studentBucket(u) {
  const k = uid8(u);
  if (perStudent[k] === undefined) {
    perStudent[k] = { mcqMismatch: 0, typedCorroboratedMismatch: 0, preimageDisagreesNoAccept: 0, rowsWithGradedIsCorrect: 0 };
  }
  return perStudent[k];
}

// ---------------------------------------------------------------- main scan
let processed = 0;
for (const uid of students) {
  processed += 1;
  const aSnap = await db.collection("attempts").where("studentId", "==", uid).get();
  reads.attempts += aSnap.size;

  let docs = aSnap.docs;
  if (MAX_PER_STUDENT > 0 && docs.length > MAX_PER_STUDENT) {
    const ms = (d) => {
      const s = d.data().submittedAt;
      return s && typeof s.toMillis === "function" ? s.toMillis() : 0;
    };
    docs = docs.slice().sort((x, y) => ms(y) - ms(x)).slice(0, MAX_PER_STUDENT);
    T.attemptsSkippedByCap += aSnap.size - docs.length;
  }

  // Server-side grading witnesses for this student, fetched once. `uid` is a real
  // field on every grading job (functions/index.js:1052-1088), so this is a single
  // indexed query per student instead of one point-read per typed attempt.
  const typedDocs = docs.filter((d) => d.data().testType === "typed");
  const jobs = {};        // attemptDocId -> { status, byWord: {wordId: isCorrect} }
  if (typedDocs.length > 0) {
    const jSnap = await db.collection("grading_jobs").where("uid", "==", uid).get();
    reads.gradingJobs += jSnap.size;
    jSnap.forEach((j) => {
      const data = j.data();
      const byWord = {};
      const results = data.payload && Array.isArray(data.payload.results) ? data.payload.results : [];
      for (const r of results) {
        if (r && typeof r.wordId === "string" && typeof r.isCorrect === "boolean") byWord[r.wordId] = r.isCorrect;
      }
      jobs[j.id] = { status: data.status || null, byWord, resultCount: results.length };
    });
  }

  for (const doc of docs) {
    const a = doc.data();
    T.attemptsScanned += 1;
    const cb = classBucket(a.classId);
    cb.attempts += 1;
    const rows = Array.isArray(a.answers) ? a.answers : null;
    if (rows === null) { T.attemptsNoAnswersArray += 1; continue; }

    const testType = a.testType === "typed" ? "typed" : (a.testType === "mcq" ? "mcq" : String(a.testType ?? "(absent)"));
    const job = testType === "typed" ? (jobs[doc.id] || null) : null;
    if (testType === "typed") {
      const ms = a.submittedAt && typeof a.submittedAt.toMillis === "function" ? a.submittedAt.toMillis() : NaN;
      if (job !== null && job.status === "graded" && job.resultCount > 0) { TYPED.attemptsWithJob += 1; spanNote(true, ms); }
      else { TYPED.attemptsWithoutJob += 1; spanNote(false, ms); }
    }
    const defs = testType === "mcq" ? await loadList(a.listId) : null;
    // A CS/teacher grade correction (scripts/cs/*, SUPPORT_RUNBOOK) deliberately rewrites
    // row.isCorrect and leaves the original grading witness untouched. That divergence is
    // CORRECT — and a recompute-only backfill would silently revert it. Annotate, never absorb.
    const manualOverride = a.manualOverride === true;
    if (manualOverride) T.attemptsWithManualOverride += 1;

    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      T.answerRows += 1;
      cb.rows += 1;
      const sb = studentBucket(uid);

      const hasPreimage = typeof r.gradedIsCorrect === "boolean";
      const storedIsCorrect = r.isCorrect === true;
      const gradedOk = hasPreimage ? r.gradedIsCorrect : storedIsCorrect;
      const st = typeof r.challengeStatus === "string" ? r.challengeStatus : null;
      if (st === "pending") T.rowsChallengePending += 1;
      else if (st === "accepted") {
        T.rowsChallengeAccepted += 1;
        if (!hasPreimage) T.rowsAcceptedWithoutPreimage += 1;
      } else if (st === "rejected") T.rowsChallengeRejected += 1;

      if (hasPreimage) {
        T.rowsWithGradedIsCorrect += 1;
        cb.rowsWithGradedIsCorrect += 1;
        sb.rowsWithGradedIsCorrect += 1;
        if (r.gradedIsCorrect === storedIsCorrect) T.preimageAgreesWithIsCorrect += 1;
        else {
          T.preimageDisagreesWithIsCorrect += 1;
          if (st !== "accepted") {
            // The ONLY writer that makes preimage != isCorrect is an ACCEPTED challenge.
            T.preimageDisagreesWithoutAcceptedChallenge += 1;
            sb.preimageDisagreesNoAccept += 1;
            if (samples.preimageDisagreesNoAccept.length < SAMPLE_CAP) {
              samples.preimageDisagreesNoAccept.push({
                uid8: uid8(uid), classId: a.classId || null, testType,
                sessionType: a.sessionType ?? null, studyDay: a.studyDay ?? null,
                wordId: r.wordId || null, isCorrect: storedIsCorrect,
                gradedIsCorrect: r.gradedIsCorrect, challengeStatus: st,
              });
            }
          }
        }
      } else {
        T.rowsWithoutGradedIsCorrect += 1;
      }
      // A legacy ACCEPTED row with no preimage: isCorrect was flipped to true by the
      // adjudicator, so `gradedOk` is the post-flip value and disagreeing with the
      // grade-time recomputation/witness is EXPECTED, not a discrepancy.
      const legacyAcceptedFlip = st === "accepted" && !hasPreimage;

      // ---------------------------------------------------------- MCQ leg
      if (testType === "mcq") {
        T.rowsMcq += 1;
        cb.mcqRows += 1;
        if (!a.listId) { MCQ.noListId += 1; continue; }
        if (defs === null) { MCQ.unresolvableWord += 1; continue; }
        const canonical = defs[r.wordId];
        if (canonical === undefined || canonical === "") { MCQ.unresolvableWord += 1; continue; }
        if (r.studentResponse === undefined) { MCQ.noStudentResponseField += 1; continue; }
        const respRaw = String(r.studentResponse ?? "");
        const resp = norm(respRaw);
        if (resp === "") { MCQ.blankResponse += 1; }
        const recomputed = resp !== "" && resp === canonical;
        // How load-bearing is the normalization? Count rows that are correct ONLY because
        // of it (raw text differs, normalized text matches the canonical definition).
        if (recomputed && respRaw.trim() !== String((listDefsRaw[a.listId] || {})[r.wordId] ?? "").trim()) MCQ.matchedOnlyAfterNormalization += 1;
        if (norm(r.correctAnswer) !== canonical) MCQ.storedCorrectAnswerDrift += 1;
        MCQ.recomputed += 1;
        if (recomputed === gradedOk) { MCQ.match += 1; continue; }
        if (legacyAcceptedFlip && recomputed === false && gradedOk === true) {
          MCQ.mismatchAdjudicationExplained += 1;
          cb.mcqMismatchAdjudicationExplained += 1;
          continue;
        }
        const collision = (listDefFreq[a.listId] || {})[resp];
        if (collision !== undefined && collision > 1) MCQ.ambiguousDefinitionCollision += 1;
        MCQ.mismatch += 1;
        if (manualOverride) MCQ.mismatchWithManualOverrideMarker += 1; else MCQ.mismatchUnexplained += 1;
        cb.mcqMismatch += 1;
        sb.mcqMismatch += 1;
        if (samples.mcqMismatch.length < SAMPLE_CAP) {
          samples.mcqMismatch.push({
            uid8: uid8(uid), classId: a.classId || null, listId: a.listId || null,
            sessionType: a.sessionType ?? null, studyDay: a.studyDay ?? null,
            wordId: r.wordId || null, storedIsCorrect, gradedIsCorrect: hasPreimage ? r.gradedIsCorrect : null,
            gradedOk, recomputed, challengeStatus: st, attemptManualOverride: manualOverride,
            definitionCollisionCount: collision === undefined ? 0 : collision,
            blankResponse: resp === "",
          });
        }
        continue;
      }

      // -------------------------------------------------------- TYPED leg
      if (testType === "typed") {
        T.rowsTyped += 1;
        cb.typedRows += 1;
        if (job === null) {
          TYPED.uncorroborated += 1; TYPED.uncorroboratedNoJobDoc += 1; cb.typedUncorroborated += 1; continue;
        }
        if (job.status !== "graded" || job.resultCount === 0) {
          TYPED.uncorroborated += 1; TYPED.uncorroboratedJobNotGraded += 1; cb.typedUncorroborated += 1; continue;
        }
        const witness = job.byWord[r.wordId];
        if (typeof witness !== "boolean") {
          TYPED.uncorroborated += 1; TYPED.uncorroboratedWordAbsentFromJob += 1; cb.typedUncorroborated += 1; continue;
        }
        if (witness === gradedOk) { TYPED.corroboratedMatch += 1; cb.typedCorroboratedMatch += 1; continue; }
        if (legacyAcceptedFlip && witness === false && gradedOk === true) {
          TYPED.mismatchAdjudicationExplained += 1; continue;
        }
        TYPED.corroboratedMismatch += 1;
        if (manualOverride) TYPED.mismatchWithManualOverrideMarker += 1; else TYPED.mismatchUnexplained += 1;
        cb.typedCorroboratedMismatch += 1;
        sb.typedCorroboratedMismatch += 1;
        if (samples.typedCorroboratedMismatch.length < SAMPLE_CAP) {
          samples.typedCorroboratedMismatch.push({
            uid8: uid8(uid), classId: a.classId || null, listId: a.listId || null,
            sessionType: a.sessionType ?? null, studyDay: a.studyDay ?? null,
            wordId: r.wordId || null, storedIsCorrect, gradedIsCorrect: hasPreimage ? r.gradedIsCorrect : null,
            gradedOk, serverWitness: witness, challengeStatus: st, attemptManualOverride: manualOverride,
          });
        }
        continue;
      }

      T.rowsOtherTestType += 1;
    }
  }

  if (processed % 50 === 0 || processed === students.length) {
    const el = (Date.now() - t0) / 1000;
    const eta = processed === 0 ? 0 : (el / processed) * (students.length - processed);
    console.log(`[gic-sweep]   ${processed}/${students.length} students · ${T.attemptsScanned} attempts · ${T.answerRows} rows · ${el.toFixed(0)}s elapsed · ~${eta.toFixed(0)}s left`);
  }
}

// ---------------------------------------------------------------- output
const elapsedSec = (Date.now() - t0) / 1000;
reads.total = reads.classes + reads.attempts + reads.gradingJobs + reads.listWordDocs;

// Only students who actually have a discrepancy stay in the per-student map.
const perStudentDiscrepancies = {};
for (const k of Object.keys(perStudent)) {
  const v = perStudent[k];
  if (v.mcqMismatch > 0 || v.typedCorroboratedMismatch > 0 || v.preimageDisagreesNoAccept > 0) perStudentDiscrepancies[k] = v;
}
const studentsWithPreimage = Object.keys(perStudent).filter((k) => perStudent[k].rowsWithGradedIsCorrect > 0).length;

const headline = {
  mcqMismatches: MCQ.mismatch,
  mcqMismatchesUnexplained: MCQ.mismatchUnexplained,
  typedCorroboratedMismatches: TYPED.corroboratedMismatch,
  typedCorroboratedMismatchesUnexplained: TYPED.mismatchUnexplained,
  mismatchesOnAManualOverrideAttempt: MCQ.mismatchWithManualOverrideMarker + TYPED.mismatchWithManualOverrideMarker,
  typedUncorroborated: TYPED.uncorroborated,
  rowsWithGradedIsCorrect: T.rowsWithGradedIsCorrect,
  rowsWithoutGradedIsCorrect: T.rowsWithoutGradedIsCorrect,
  preimageDisagreesWithoutAcceptedChallenge: T.preimageDisagreesWithoutAcceptedChallenge,
};
// Exit status keys off DISCREPANCIES NOBODY DOCUMENTED. A mismatch on a manualOverride
// attempt is a recorded CS grade correction (SUPPORT_RUNBOOK), still reported in full above.
const findings = MCQ.mismatchUnexplained + TYPED.mismatchUnexplained + T.preimageDisagreesWithoutAcceptedChallenge;

const evidence = {
  script: "scripts/cs/gradedis-correct-sweep.mjs",
  mode: "READ-ONLY (no write/delete/transaction/batch API is reachable from this file)",
  purpose: "Quantify whether stored answers[].gradedIsCorrect / isCorrect ever disagree with a deterministic recomputation (MCQ) or the server-written grading witness (typed), before GATE-4 backfill picks how to treat the field. NEED_TO_FIX '#NN GATE-4 BACKFILL TRUSTS A CLIENT-WRITABLE FIELD' option 3.",
  generatedAt: new Date().toISOString(),
  projectId: key.project_id,
  cohortRegex: filter.source,
  cohort: { classesMatched, classesSandboxExcluded, students: cohortStudents, studentsProcessed: students.length },
  caps: {
    maxStudents: MAX_STUDENTS, maxPerStudent: MAX_PER_STUDENT,
    applied: MAX_STUDENTS > 0 || MAX_PER_STUDENT > 0,
    attemptsSkippedByCap: T.attemptsSkippedByCap,
    note: MAX_STUDENTS > 0 || MAX_PER_STUDENT > 0
      ? "CAPPED RUN — not the full cohort. Re-run with no --students/--max-per-student for the complete scan."
      : "No cap applied: every attempt of every cohort student was scanned.",
  },
  runtimeSeconds: Number(elapsedSec.toFixed(1)),
  firestoreDocumentReads: reads,
  headline,
  totals: T,
  mcq: MCQ,
  typed: TYPED,
  typedAttemptSubmittedAtEnvelope: {
    withGradedJob: {
      earliest: typedSpan.withJobMin === null ? null : new Date(typedSpan.withJobMin).toISOString(),
      latest: typedSpan.withJobMax === null ? null : new Date(typedSpan.withJobMax).toISOString(),
    },
    withoutGradedJob: {
      earliest: typedSpan.withoutJobMin === null ? null : new Date(typedSpan.withoutJobMin).toISOString(),
      latest: typedSpan.withoutJobMax === null ? null : new Date(typedSpan.withoutJobMax).toISOString(),
    },
    attemptsByMonth: typedMonths,
    interpretation: "If the without-job population dies off where the with-job population begins, uncorroborated typed rows are a DEPLOY-DATE artefact (attempts predating the grading-job cache), not a scattered gap. Read attemptsByMonth, not just the min/max, because a small post-boundary tail can hide inside a wide envelope.",
  },
  gradedIsCorrectPopulation: {
    rowsWithField: T.rowsWithGradedIsCorrect,
    rowsWithoutField: T.rowsWithoutGradedIsCorrect,
    shareWithField: T.answerRows === 0 ? 0 : Number((T.rowsWithGradedIsCorrect / T.answerRows).toFixed(8)),
    studentsWithAtLeastOne: studentsWithPreimage,
    agreesWithIsCorrect: T.preimageAgreesWithIsCorrect,
    disagreesWithIsCorrect: T.preimageDisagreesWithIsCorrect,
    disagreesWithoutAcceptedChallenge: T.preimageDisagreesWithoutAcceptedChallenge,
  },
  perClass,
  perStudentDiscrepancies,
  samples,
  listWordLoadFailures: listLoadFailed,
  limitations: [
    "MCQ recomputation is a normalized string compare between the stored studentResponse (the clicked option's definition text) and the CANONICAL lists/{listId}/words/{wordId}.definition. Where a list holds two words with the same normalized definition, a distractor is textually identical to the key; those rows are counted as ambiguousDefinitionCollision.",
    "Typed rows are corroborated ONLY against grading_jobs/{attemptDocId}.payload.results (server-written, Admin-SDK only). No AI was called. Rows with no such witness are reported as uncorroborated — absence of evidence, not evidence of absence.",
    "This measures DISAGREEMENT, not tampering. A forger who rewrote studentResponse and gradedIsCorrect together stays self-consistent on the MCQ leg.",
    "gradedIsCorrect is written only by challenge adjudication (functions/foundation.js applyChallengeAdjudication / src/services/db.js reviewChallenge), so its absence on a row is the NORMAL state, not a defect.",
    "`manualOverride:true` is a LABEL on the attempt, not a cryptographic proof. It is used here only to ANNOTATE a mismatch, never to hide one — the raw mismatch total is reported alongside. scripts/cs/impossible-results-sweep.mjs separately checks for the marker WITHOUT provenance (overriddenBy/manualReviewNote/teacherId) and found zero in this cohort.",
    "No PII is recorded: uids are truncated to 8 chars and no answer text, word text or definition text is written to this file.",
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(evidence, null, 2) + "\n");

const pad = (n, w) => String(n).padStart(w);
console.log(`\n=== gradedIsCorrect DISCREPANCY SWEEP — /${filter.source}/i — READ-ONLY ===`);
console.log(`students ${students.length}/${cohortStudents} · attempts ${T.attemptsScanned} · answer rows ${T.answerRows} · ${elapsedSec.toFixed(1)}s · ${reads.total} doc reads`);
console.log(`\n  gradedIsCorrect FIELD POPULATION`);
console.log(`    ${pad(T.rowsWithGradedIsCorrect, 8)}  rows carry gradedIsCorrect   (${(T.answerRows ? (100 * T.rowsWithGradedIsCorrect / T.answerRows) : 0).toFixed(4)}% of rows, ${studentsWithPreimage} student(s))`);
console.log(`    ${pad(T.rowsWithoutGradedIsCorrect, 8)}  rows do NOT carry it`);
console.log(`    ${pad(T.preimageAgreesWithIsCorrect, 8)}  preimage == isCorrect`);
console.log(`    ${pad(T.preimageDisagreesWithIsCorrect, 8)}  preimage != isCorrect (expected on an ACCEPTED challenge)`);
console.log(`    ${pad(T.preimageDisagreesWithoutAcceptedChallenge, 8)}  preimage != isCorrect with NO accepted challenge  <-- impossible for a correct writer`);
console.log(`    ${pad(T.rowsChallengeAccepted, 8)}  accepted-challenge rows (${T.rowsAcceptedWithoutPreimage} of them carry NO preimage = the R2-49 legacy class)`);
console.log(`\n  MCQ — deterministic recomputation (${T.rowsMcq} rows)`);
console.log(`    ${pad(MCQ.recomputed, 8)}  recomputable rows`);
console.log(`    ${pad(MCQ.match, 8)}  match`);
console.log(`    ${pad(MCQ.mismatch, 8)}  MISMATCH  (${MCQ.mismatchWithManualOverrideMarker} on a manualOverride attempt = recorded CS grade fix · ${MCQ.mismatchUnexplained} UNEXPLAINED · ${MCQ.ambiguousDefinitionCollision} on a duplicate-definition collision)`);
console.log(`    ${pad(MCQ.mismatchAdjudicationExplained, 8)}  mismatch explained by a legacy accepted challenge`);
console.log(`    ${pad(MCQ.unresolvableWord + MCQ.noListId + MCQ.noStudentResponseField, 8)}  not recomputable (no listId ${MCQ.noListId} · word unresolvable ${MCQ.unresolvableWord} · no studentResponse ${MCQ.noStudentResponseField})`);
console.log(`    ${pad(MCQ.storedCorrectAnswerDrift, 8)}  stored row.correctAnswer differs from the canonical list definition`);
console.log(`\n  TYPED — corroborated against grading_jobs (${T.rowsTyped} rows)`);
console.log(`    ${pad(TYPED.corroboratedMatch, 8)}  corroborated-match`);
console.log(`    ${pad(TYPED.corroboratedMismatch, 8)}  corroborated-MISMATCH  (${TYPED.mismatchWithManualOverrideMarker} on a manualOverride attempt = recorded CS grade fix · ${TYPED.mismatchUnexplained} UNEXPLAINED)`);
console.log(`    ${pad(TYPED.mismatchAdjudicationExplained, 8)}  mismatch explained by a legacy accepted challenge`);
console.log(`    ${pad(TYPED.uncorroborated, 8)}  uncorroborated (no job ${TYPED.uncorroboratedNoJobDoc} · job not graded ${TYPED.uncorroboratedJobNotGraded} · word absent from job ${TYPED.uncorroboratedWordAbsentFromJob})`);
console.log(`    attempts with a graded job ${TYPED.attemptsWithJob} · without ${TYPED.attemptsWithoutJob}`);

const classRows = Object.keys(perClass).map((k) => [k, perClass[k]]).sort((x, y) => y[1].rows - x[1].rows);
console.log(`\n  TYPED attempts by month (withJob / withoutJob) — is "uncorroborated" a deploy boundary?`);
const allMonths = Object.keys(Object.assign({}, typedMonths.withJob, typedMonths.withoutJob)).sort();
for (const m of allMonths) console.log(`    ${m}   ${pad(typedMonths.withJob[m] || 0, 6)} / ${pad(typedMonths.withoutJob[m] || 0, 6)}`);
console.log(`\n  PER CLASS (in-cohort? · classId · name · attempts · rows · gIC rows · mcqMis · typedMis · typedUncorr)`);
for (const [cid, v] of classRows) {
  console.log(`    ${v.inCohortRegex ? "  " : "* "}${cid.slice(0, 20).padEnd(20)} ${String(v.className).slice(0, 26).padEnd(26)} ${pad(v.attempts, 6)} ${pad(v.rows, 7)} ${pad(v.rowsWithGradedIsCorrect, 6)} ${pad(v.mcqMismatch, 7)} ${pad(v.typedCorroboratedMismatch, 8)} ${pad(v.typedUncorroborated, 10)}`);
}
console.log(`    (* = a class outside /${filter.source}/i that a cohort student also has attempts in — scanned because the field is per-student)`);
console.log(`\n  students with >=1 discrepancy of any kind: ${Object.keys(perStudentDiscrepancies).length} · attempts carrying manualOverride: ${T.attemptsWithManualOverride}`);
console.log(`\n[gic-sweep] evidence -> ${OUT}`);
console.log(`[gic-sweep] ${findings === 0
  ? "NO UNEXPLAINED discrepancy (MCQ recompute + typed server witness + preimage-vs-isCorrect all consistent; every mismatch found sits on a manualOverride attempt = a recorded CS grade fix)"
  : `${findings} UNEXPLAINED discrepancy row(s) — see samples in the evidence file`}`);
process.exit(findings === 0 ? 0 : 1);
