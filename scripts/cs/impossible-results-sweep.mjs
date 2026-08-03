#!/usr/bin/env node
/**
 * ============================================================================
 * CS — impossible-results-sweep.mjs: READ-ONLY scan for attempts that cannot be
 * ============================================================================
 * WHY: the rules panel (r5) established that `answers[].gradedIsCorrect` — the
 * §6b append-only grading preimage the GATE-4 backfill consumes as authority
 * (b1-replay-lib.mjs:99) — is client-rewritable: the attempts update rule
 * constrains WHICH top-level key changes (`hasOnly(['answers'])`), not what goes
 * inside the array, and Firestore rules cannot inspect array elements. David's
 * call (2026-08-03): assume no student has exploited it, but surface-pass for
 * IMPOSSIBLE results.
 *
 * This looks for arithmetic and provenance states that a correct server could
 * not have produced. It does NOT prove absence of tampering — a careful forger
 * keeps the arithmetic consistent. It proves the CHEAP cases are absent, which
 * is what a surface pass is for. State that limit when reporting.
 *
 * READ-ONLY: opens no transaction and writes nothing.
 *
 * TRIAGE LEARNED ON THE FIRST RUN (2026-08-03, 971 students / 35,639 attempts) —
 * three of the eight checks were WRONG about legitimate production shapes before
 * being corrected against real documents, so read results with these in mind:
 *   - `review` attempts store passed:true regardless of score, and a no-score
 *     review day stores score 0 with zero rows. Only `new` matters for threshold.
 *   - the challenge adjudication record is per-ROW (`challengeStatus`), NOT
 *     `challenges.history` (empty on real attempts).
 *   - `gradedIsCorrect` DISAGREEING with `isCorrect` is the point (it preserves
 *     the pre-adjudication grade); agreement on an accepted challenge is the
 *     odd case.
 *   - classes named like "25WT DUP THROTTLE 26SM …" are SANDBOX data that a bare
 *     /26SM/ filter pulls in; they are excluded here.
 *   - attempts with `studyDay: null` in a prep class are out-of-daily-flow tests
 *     whose stored score legitimately differs by a few points from a naive
 *     correct/total recomputation.
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/impossible-results-sweep.mjs [classNameRegex=26SM]
 * Exit: 0 clean · 1 findings (investigate before GATE 4) · 2 error.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const key = JSON.parse(readFileSync("/app/scripts/serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const filter = new RegExp(process.argv[2] || "26SM", "i");

const cs = await db.collection("classes").get();
const uids = new Set();
cs.forEach((d) => {
  const c = d.data();
  const name = c.name || "";
  // 25WT is the audit SANDBOX and DUP_* are throttle-test duplicates; one such
  // class is literally named "25WT DUP THROTTLE 26SM SAT Final B", so a bare
  // /26SM/ match pulls synthetic data into a real-cohort sweep.
  const sandbox = /25WT|DUP[_ ]/i.test(name);
  if (filter.test(name) && !sandbox) (c.studentIds || []).forEach((u) => uids.add(u));
});
console.log(`[sweep] cohort /${filter.source}/i → ${uids.size} distinct students`);

const F = {
  preimage_disagrees_no_challenge: [],  // gradedIsCorrect flips isCorrect with no adjudication record
  preimage_without_challenge: [],       // preimage present on an answer never challenged
  score_mismatch: [],                   // stored score ≠ recomputed from rows
  passed_below_threshold: [],           // passed:true with a score no threshold would pass
  rows_exceed_total: [],                // more answer rows than totalQuestions
  negative_or_absurd: [],               // negative / >100 score, negative counts
  manual_shaped_docid_no_marker: [],    // `_manual` id without manualOverride (the r5 synonym)
  marker_without_provenance: [],        // manualOverride:true but no overriddenBy/manualReviewNote
};
let scanned = 0, withPreimage = 0;

for (const uid of uids) {
  const snap = await db.collection("attempts").where("studentId", "==", uid).get();
  for (const doc of snap.docs) {
    const a = doc.data();
    scanned++;
    const rows = Array.isArray(a.answers) ? a.answers : [];
    const tq = Number.isInteger(a.totalQuestions) ? a.totalQuestions : null;
    const ref = { id: doc.id, studentId: uid, classId: a.classId ?? null, studyDay: a.studyDay ?? null };

    // The preimage: present only where an adjudication actually happened.
    // VERIFIED against production shapes: the adjudication record is per-ROW
    // (`challengeStatus: "accepted"`), NOT `a.challenges.history` — that map is
    // empty on real attempts. And a preimage that DISAGREES with isCorrect is
    // the entire point: gradedIsCorrect preserves the ORIGINAL grade while
    // isCorrect is flipped on acceptance. So disagreement WITH an adjudication
    // is correct; the impossible state is a preimage with NO adjudication at all.
    for (const r of rows) {
      if (typeof r?.gradedIsCorrect !== "boolean") continue;
      withPreimage++;
      const adjudicated = typeof r.challengeStatus === "string" && r.challengeStatus.length > 0;
      if (!adjudicated) {
        F.preimage_without_challenge.push({ ...ref, wordId: r.wordId ?? null,
          isCorrect: r.isCorrect ?? null, gradedIsCorrect: r.gradedIsCorrect });
      }
      // A preimage identical to isCorrect on an ACCEPTED challenge is odd:
      // acceptance should have flipped isCorrect away from the original.
      if (adjudicated && r.challengeStatus === "accepted" && r.gradedIsCorrect === r.isCorrect) {
        F.preimage_disagrees_no_challenge.push({ ...ref, wordId: r.wordId ?? null,
          note: "accepted challenge but preimage == isCorrect (no flip recorded)" });
      }
    }

    // Arithmetic that a correct server cannot produce.
    if (typeof a.score === "number" && (a.score < 0 || a.score > 100)) {
      F.negative_or_absurd.push({ ...ref, score: a.score });
    }
    if (tq !== null && rows.length > tq) F.rows_exceed_total.push({ ...ref, rows: rows.length, totalQuestions: tq });
    if (tq !== null && tq > 0 && rows.length > 0 && typeof a.score === "number") {
      const correct = rows.filter((r) => r.isCorrect === true).length;
      const recomputed = Math.round((correct / tq) * 100);
      // Legacy writers store the FULL denominator with partial rows (skips), so
      // a shortfall is legitimate; only a mismatch that skips cannot explain is odd.
      const skipped = Number.isInteger(a.skipped) ? a.skipped : (tq - rows.length);
      if (Math.abs(recomputed - a.score) > 1 && skipped === tq - rows.length) {
        F.score_mismatch.push({ ...ref, stored: a.score, recomputed, correct, totalQuestions: tq, rows: rows.length });
      }
    }
    // VERIFIED against production: `review` attempts store passed:true regardless
    // of score (the review leg does not gate on the threshold), and a no-score
    // review day legitimately stores score 0 with zero rows. Only a `new` test
    // passing below any configured threshold is impossible without an override.
    if (a.sessionType === "new" && a.passed === true && typeof a.score === "number"
        && a.score < 50 && a.manualOverride !== true) {
      F.passed_below_threshold.push({ ...ref, score: a.score, sessionType: a.sessionType });
    }

    // The r5 synonym: docId shape vs the field it stands in for.
    const manualShaped = /_manual\b|manual$/.test(doc.id);
    if (manualShaped && a.manualOverride !== true) F.manual_shaped_docid_no_marker.push(ref);
    if (a.manualOverride === true && !a.overriddenBy && !a.manualReviewNote && !a.teacherId) {
      F.marker_without_provenance.push(ref);
    }
  }
}

const total = Object.values(F).reduce((n, v) => n + v.length, 0);
console.log(`[sweep] scanned ${scanned} attempts · ${withPreimage} answer rows carry a gradedIsCorrect preimage\n`);
for (const [k, v] of Object.entries(F)) {
  console.log(`  ${v.length === 0 ? "clean" : String(v.length).padStart(5)}  ${k}`);
}
writeFileSync("/app/audit/deepfix/task3/live_baseline/impossible-results-sweep-receipt.json",
  JSON.stringify({
    projectId: key.project_id, cohort: filter.source, students: uids.size,
    attemptsScanned: scanned, answerRowsWithPreimage: withPreimage,
    counts: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.length])),
    // Samples only, and doc ids embed uids — keep this receipt uid-free.
    samples: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.slice(0, 5).map((x) => ({
      classId: x.classId, studyDay: x.studyDay, ...(x.score !== undefined ? { score: x.score } : {}),
      ...(x.stored !== undefined ? { stored: x.stored, recomputed: x.recomputed } : {}),
    }))])),
    limitation: "A surface pass. It finds arithmetic/provenance states a correct server could not produce; it does NOT prove absence of tampering — a forger who keeps the arithmetic self-consistent is invisible to it.",
  }, null, 2) + "\n");
console.log(`\n[sweep] ${total === 0
  ? "NO IMPOSSIBLE RESULTS FOUND — the cheap forgery signatures are absent (not a proof of no tampering)"
  : `${total} finding(s) — investigate before GATE 4`}`);
process.exit(total === 0 ? 0 : 1);
