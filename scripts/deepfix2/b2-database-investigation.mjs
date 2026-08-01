// b2-database-investigation.mjs — READ-ONLY (Track B stage B2, 14_TRACK_B_BACKFILL_PIPELINE.md §1).
// Measures the shapes/volumes the backfill parser+writer must handle. NO WRITES. Cost-aware:
// count() aggregations for volumes; bounded per-student samples for shapes (NEED_TO_FIX #17 discipline).
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/b2-database-investigation.mjs [classNameRegex=26SM] [sampleStudents=30]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "node:fs";

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const filter = new RegExp(process.argv[2] || "26SM");
const SAMPLE_N = parseInt(process.argv[3] || "30", 10);
const ATT_CAP = 300, SS_CAP = 500;

// ---- cohort enumeration (same pattern as graduation-validity-probe) ----
const cs = await db.collection("classes").get();
const students = new Map();
cs.forEach(d => {
  const c = d.data();
  if (filter.test(c.name || "")) (c.studentIds || []).forEach(uid => {
    if (!students.has(uid)) students.set(uid, []);
    students.get(uid).push(c.name);
  });
});
const uids = [...students.keys()];
console.error(`cohort: ${uids.length} students (${filter}); sampling ${Math.min(SAMPLE_N, uids.length)}`);

// deterministic spread sample (no Math.random — reproducible)
const step = Math.max(1, Math.floor(uids.length / SAMPLE_N));
const sample = uids.filter((_, i) => i % step === 0).slice(0, SAMPLE_N);

// ---- volumes (aggregation counts — cheap) ----
const vol = { scope: "attempts/studyStates counts are GLOBAL (unfiltered) — cohort sizing must NOT use them raw [panel fix]" };
vol.cohortStudents = uids.length;
vol.attemptsTotalGlobal = (await db.collection("attempts").count().get()).data().count;
try {
  vol.studyStatesTotalGlobal = (await db.collectionGroup("study_states").count().get()).data().count;
} catch (e) { vol.studyStatesTotalGlobal = `AGG_FAILED: ${e.code || e.message}`; }

// ---- shape accumulators ----
const acc = {
  attempts: { n: 0, byType: {}, scoreUnit: { pct0to100: 0, frac0to1: 0, over100: 0, missing: 0, nonNumeric: 0 },
    fields: {}, rowsKey: { answers: 0, rows: 0, none: 0 }, rowShape: {}, resetEpoch: { present: 0, absent: 0 },
    blankCoverage: { rowsEqTotal: 0, rowsLtTotal: 0, rowsGtTotal: 0, noTotal: 0 },
    dupSignatures: 0, excludable: { nonFinite: 0, over100: 0, numGtDen: 0, scoreRowsDisagree: 0 },
    perStudentCount: [] },
  studyStates: { n: 0, fields: {}, statusEnum: {}, reviewLabelCollisions: 0, masteredAtPresent: 0,
    perStudentCount: [] },
  orphanPreEpochAttempts: 0, epochCheckedStudents: 0,
};
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

for (const uid of sample) {
  // attempts (top-level, by studentId)
  const asnap = await db.collection("attempts").where("studentId", "==", uid).limit(ATT_CAP).get();
  acc.attempts.perStudentCount.push(asnap.size);
  const sigs = new Set();
  for (const d of asnap.docs) {
    const a = d.data(); acc.attempts.n++;
    bump(acc.attempts.byType, a.sessionType || a.type || "UNSET");
    Object.keys(a).forEach(k => bump(acc.attempts.fields, k));
    const s = a.score ?? a.scorePercent;
    if (s === undefined || s === null) bump(acc.attempts.scoreUnit, "missing");
    else if (typeof s !== "number" || !Number.isFinite(s)) { bump(acc.attempts.scoreUnit, "nonNumeric"); acc.attempts.excludable.nonFinite++; }
    else if (s > 100) { bump(acc.attempts.scoreUnit, "over100"); acc.attempts.excludable.over100++; }
    else if (s <= 1 && s > 0) bump(acc.attempts.scoreUnit, "frac0to1");
    else bump(acc.attempts.scoreUnit, "pct0to100");
    const rows = Array.isArray(a.answers) ? a.answers : Array.isArray(a.rows) ? a.rows : null;
    bump(acc.attempts.rowsKey, Array.isArray(a.answers) ? "answers" : Array.isArray(a.rows) ? "rows" : "none");
    if (rows && rows[0]) Object.keys(rows[0]).forEach(k => bump(acc.attempts.rowShape, k));
    bump(acc.attempts.resetEpoch, a.resetEpoch !== undefined ? "present" : "absent");
    const tq = a.totalQuestions;
    if (typeof tq !== "number") bump(acc.attempts.blankCoverage, "noTotal");
    else if (!rows) bump(acc.attempts.blankCoverage, "noTotal");
    else if (rows.length === tq) bump(acc.attempts.blankCoverage, "rowsEqTotal");
    else if (rows.length < tq) bump(acc.attempts.blankCoverage, "rowsLtTotal");
    else bump(acc.attempts.blankCoverage, "rowsGtTotal");
    if (rows && typeof s === "number" && typeof tq === "number" && tq > 0) {
      const correct = rows.filter(r => r && r.isCorrect === true).length;
      if (correct > tq) acc.attempts.excludable.numGtDen++;
      const recomputed = (correct / tq) * 100;
      const stored = s <= 1 ? s * 100 : s;
      if (rows.length === tq && Math.abs(recomputed - stored) > 2) acc.attempts.excludable.scoreRowsDisagree++;
    }
    const sig = `${a.listId}|${a.dayNumber ?? a.studyDay}|${a.sessionType}|${a.submittedAt?.toMillis?.()}`;
    if (sigs.has(sig)) acc.attempts.dupSignatures++; else sigs.add(sig);
  }
  // live-write cadence (14_ §1.6): recency histogram from this student's sampled attempts
  for (const d of asnap.docs) {
    const t = d.data().submittedAt?.toMillis?.();
    if (t) { const age = Math.floor((Date.now() - t) / 86400e3);
      const b = age <= 1 ? "d1" : age <= 7 ? "d7" : age <= 30 ? "d30" : "older";
      acc.writeCadence = acc.writeCadence || {}; acc.writeCadence[b] = (acc.writeCadence[b] || 0) + 1; }
  }
  // study_states (subcollection)
  const ssnap = await db.collection("users").doc(uid).collection("study_states").limit(SS_CAP).get();
  acc.studyStates.perStudentCount.push(ssnap.size);
  for (const d of ssnap.docs) {
    const w = d.data(); acc.studyStates.n++;
    Object.keys(w).forEach(k => bump(acc.studyStates.fields, k));
    if (w.status) bump(acc.studyStates.statusEnum, String(w.status));
    if (w.masteredAt) acc.studyStates.masteredAtPresent++;
    if (["reviewFailCount", "reviewLastFailedAt", "reviewLastCorrectAt", "reviewLastProvenAt", "reviewLastTestedAt", "reviewRestingUntil"].some(k => k in w))
      acc.studyStates.reviewLabelCollisions++;
  }
  // reset hygiene [r53-B1 FIX]: the REAL per-list tombstones are users/{uid}/progress_meta/{listId}
  // and users/{uid}/list_progress/{listId} with {resetEpoch, resetAt} (foundation.js:496-532, 2047-2140).
  const metaSnap = await db.collection("users").doc(uid).collection("progress_meta").get();
  const lpSnap = await db.collection("users").doc(uid).collection("list_progress").get();
  const resetAtByList = new Map();
  for (const snap of [metaSnap, lpSnap]) for (const d of snap.docs) {
    const v = d.data(); const at = v.resetAt?.toMillis?.();
    if (at) resetAtByList.set(d.id, Math.max(at, resetAtByList.get(d.id) || 0));
    if (v.resetEpoch !== undefined) acc.epochMarkersSeen = (acc.epochMarkersSeen || 0) + 1;
  }
  if (resetAtByList.size) {
    acc.epochCheckedStudents++;
    for (const d of asnap.docs) {
      const a = d.data(); const t = a.submittedAt?.toMillis?.();
      const cut = resetAtByList.get(a.listId);
      if (t && cut && t < cut) acc.orphanPreEpochAttempts++;
    }
  }
  process.stderr.write(".");
}
console.error("");

const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const out = {
  probe: "b2-database-investigation", version: 2, cohortFilter: String(filter),
  sampledStudents: sample.length, caps: { ATT_CAP, SS_CAP, note: `per-student samples truncated at these caps` }, volumes: vol,
  attempts: { ...acc.attempts, medianPerStudent: med(acc.attempts.perStudentCount) },
  studyStates: { ...acc.studyStates, medianPerStudent: med(acc.studyStates.perStudentCount) },
  resetHygiene: { epochCheckedStudents: acc.epochCheckedStudents, epochMarkersSeen: acc.epochMarkersSeen || 0, orphanPreEpochAttempts: acc.orphanPreEpochAttempts, note: "tombstones = progress_meta/{listId} + list_progress/{listId} {resetEpoch,resetAt} [r53-B1]" },
  writeCadence: { ...(acc.writeCadence || {}), note: "from the UNORDERED per-student sample query — valid only while under ATT_CAP (this run stayed under); order by submittedAt before trusting a capped run [r55]" },
};
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/b2-database-investigation.json", import.meta.url),
  JSON.stringify(out, null, 2));
console.log(JSON.stringify({ volumes: vol, attemptsSampled: acc.attempts.n, scoreUnit: acc.attempts.scoreUnit,
  rowsKey: acc.attempts.rowsKey, blankCoverage: acc.attempts.blankCoverage, excludable: acc.attempts.excludable,
  resetEpochOnAttempts: acc.attempts.resetEpoch, labelCollisions: acc.studyStates.reviewLabelCollisions,
  orphanPreEpochAttempts: acc.orphanPreEpochAttempts }, null, 2));
