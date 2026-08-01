// b4-verify.mjs — EXPECTED-vs-ACTUAL VERIFIER + DELTA DETECTOR (Track B stage B4; 14_ §4; r57 closure) — v1.
// READ-ONLY. Two duties:
//  1. VERIFY: for every student in scope, read the ACTUAL study_states label fields and diff them against the
//     EXPECTED state (the manifest-verified B1 baseline, or a live recompute via the SHARED lib for flagged/
//     drifted students — the same decision rule as B3, so the comparison target equals what B3 wrote).
//     Output: byte-level per-field diffs, per-student verdicts, cohort verdict (ZERO-DIFF or the miss list).
//  2. DELTA SWEEP: identify students needing re-baseline before activation — (a) any attempt with
//     submittedAt >= the baseline watermark (per-attempt scan, index-free), (b) any mutationRisk flag,
//     (c) any tombstone epoch/resetAt drift. UNION, deduplicated, published as the delta list the activation
//     barrier consumes (rerun B1→B3 for exactly these students at cutover) [the r56/r57 mutation protocol].
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/b4-verify.mjs --classAllowlist=FILE --baseline=DIR [--checkRru]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { computeStudentLabels } from "./b1-replay-lib.mjs";

const KNOWN = new Set(["classAllowlist", "baseline", "checkRru"]);
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  return [m[1], m[2] ?? true];
}));
const need = k => { if (typeof args[k] !== "string" || !args[k]) { console.error(`--${k}=VALUE required`); process.exit(2); } return args[k]; };
const allowPath = need("classAllowlist"); const baseDir = need("baseline");
const CHECK_RRU = args.checkRru === true;

let allow;
try { allow = JSON.parse(readFileSync(allowPath, "utf-8")); if (!Array.isArray(allow) || !allow.length) throw new Error("empty"); }
catch (e) { console.error(`FATAL: bad allowlist: ${e.message}`); process.exit(2); }
const mode = existsSync(`${baseDir}/b1-manifest-full.json`) ? "full" : "sample";
const manifest = JSON.parse(readFileSync(`${baseDir}/b1-manifest-${mode}.json`, "utf-8"));
const jsonlRaw = readFileSync(`${baseDir}/b1-expected-labels-${mode}.jsonl`);
if (createHash("sha256").update(jsonlRaw).digest("hex") !== manifest.jsonlSha256) { console.error("FATAL: baseline hash mismatch"); process.exit(2); }
const baseline = new Map();
for (const ln of jsonlRaw.toString().split("\n")) { if (!ln) continue; const r = JSON.parse(ln); baseline.set(r.uid, r); }

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const cs = await db.collection("classes").get();
const students = new Set(); let matchedN = 0;
cs.forEach(d => { if (allow.includes(d.id)) { matchedN++; (d.data().studentIds || []).forEach(u => students.add(u)); } });
if (matchedN !== allow.length) { console.error(`FATAL: allowlist ${allow.length}, matched ${matchedN}`); process.exit(2); }
const uids = [...students].sort();
console.error(`B4 verify: ${matchedN} classes -> ${uids.length} students; watermark ${manifest.watermark}`);

const FIELD_MAP = { fc: "reviewFailCount", lf: "reviewLastFailedAt", lc: "reviewLastCorrectAt", lp: "reviewLastProvenAt", rlt: "reviewLastTestedAt" };
const stats = { students: 0, zeroDiff: 0, withDiffs: 0, totalDiffs: 0, recomputedTargets: 0, deltaNewAttempts: 0, deltaMutation: 0, deltaEpoch: 0 };
const diffsOut = []; const deltaSet = new Map(); // uid -> reasons[]
const addDelta = (uid, reason) => { if (!deltaSet.has(uid)) deltaSet.set(uid, []); const a = deltaSet.get(uid); if (!a.includes(reason)) a.push(reason); };

for (const uid of uids) {
  const base = baseline.get(uid);
  // tombstone drift + expected-target decision (the SAME rule as B3)
  const cur = {};
  for (const coll of ["progress_meta", "list_progress"]) {
    const snap = await db.collection("users").doc(uid).collection(coll).get();
    for (const d of snap.docs) {
      const v = d.data(); const c = cur[d.id] || { resetEpoch: 0, resetAt: null };
      cur[d.id] = { resetEpoch: Math.max(c.resetEpoch, v.resetEpoch ?? 0), resetAt: Math.max(c.resetAt ?? 0, v.resetAt?.toMillis?.() ?? 0) || null };
    }
  }
  let drifted = false;
  if (base) for (const [listId, e] of Object.entries(base.epochByList || {}))
    if ((cur[listId]?.resetEpoch ?? 0) !== e.resetEpoch || (cur[listId]?.resetAt ?? null) !== e.resetAt) { drifted = true; break; }
  const flagged = base && (base.mutationRisk?.pendingChallenges || base.mutationRisk?.adjudicatedAtOrAfterWatermark || base.mutationRisk?.challengeTsUnknown || base.mutationRisk?.challengedAttemptIdsTruncated);
  let expected;
  if (!base || drifted || flagged) { expected = (await computeStudentLabels(db, uid, manifest.watermark, {})).wordsOut; stats.recomputedTargets++; }
  else expected = base.words;
  if (drifted) { addDelta(uid, "epochDrift"); stats.deltaEpoch++; }
  if (flagged) { addDelta(uid, "mutationRisk"); stats.deltaMutation++; }
  // delta (a): post-watermark attempts (per-attempt scan, same index-free pattern as B1)
  const asnap = await db.collection("attempts").where("studentId", "==", uid).get();
  for (const d of asnap.docs) {
    const t = d.data().submittedAt?.toMillis?.();
    if (typeof t === "number" && t >= manifest.watermark) { addDelta(uid, "newAttempts"); stats.deltaNewAttempts++; break; }
  }
  // actual-vs-expected
  const wordIds = [...new Set(Object.keys(expected).map(k => k.split("|")[1]))];
  const actualByWordId = new Map();
  const refs = wordIds.map(w => db.collection("users").doc(uid).collection("study_states").doc(w));
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = await db.getAll(...refs.slice(i, i + 300));
    for (const doc of chunk) actualByWordId.set(doc.id, doc.exists ? doc.data() : null);
  }
  let myDiffs = 0;
  for (const [k, w] of Object.entries(expected)) {
    const wordId = k.split("|")[1];
    const actual = actualByWordId.get(wordId);
    for (const [short, field] of Object.entries(FIELD_MAP)) {
      const exp = short === "fc" ? w.fc : w[short];
      const act = actual ? (short === "fc" ? actual[field] : (actual[field]?.toMillis?.() ?? null)) : null;
      const expNorm = short === "fc" ? exp : exp; // fc int; others ms|null
      const match = short === "fc" ? act === expNorm : (exp === null ? (act === null || act === undefined) : act === exp);
      if (!match) { myDiffs++; if (diffsOut.length < 2000) diffsOut.push({ uid, wordId, field, expected: exp, actual: act ?? null }); }
    }
    if (CHECK_RRU) {
      const act = actual ? (actual.reviewRestingUntil?.toMillis?.() ?? null) : null;
      const match = w.rru === null ? (act === null || act === undefined) : act === w.rru;
      if (!match) { myDiffs++; if (diffsOut.length < 2000) diffsOut.push({ uid, wordId, field: "reviewRestingUntil", expected: w.rru, actual: act ?? null }); }
    }
  }
  stats.totalDiffs += myDiffs;
  if (myDiffs === 0) stats.zeroDiff++; else stats.withDiffs++;
  stats.students++;
  process.stderr.write(".");
}
console.error("");
const outDir = new URL("../../audit/deepfix/trackB_baselines/b4-runs/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const report = { runId: `b4-${manifest.watermark}-${Date.now()}`, baselineWatermark: manifest.watermark, mode,
  verdict: stats.totalDiffs === 0 ? "ZERO-DIFF" : "DIFFS", stats,
  deltaList: [...deltaSet.entries()].map(([uid, reasons]) => ({ uid, reasons })),
  diffs: diffsOut };
const t = new URL(`${report.runId}.json.tmp`, outDir);
writeFileSync(t, JSON.stringify(report, null, 2)); renameSync(t, new URL(`${report.runId}.json`, outDir));
console.log(JSON.stringify({ verdict: report.verdict, stats, deltaStudents: deltaSet.size }, null, 2));
