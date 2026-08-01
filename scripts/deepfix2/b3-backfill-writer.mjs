// b3-backfill-writer.mjs — THE BACKFILL WRITER (Track B stage B3; 14_ §3; r57 closure) — v1.
// Writes the expected label state (from the B1 baseline / live recompute) onto study_states. DRY-RUN DEFAULT.
//
// LAWS:
//  - WRITE SET: the FIVE backfill fields ONLY — reviewFailCount, reviewLastFailedAt, reviewLastCorrectAt,
//    reviewLastProvenAt, reviewLastTestedAt (null ⇒ field OMITTED, never written null). `reviewRestingUntil`
//    is NOT written by default [r57 contention: the masteredAt seed launders client authority — B3 ships
//    conservative; `--seedRru` exists behind an explicit flag pending the r59/David ruling]. NOTHING else on
//    the doc is ever touched (merge-set of exactly these fields).
//  - SOURCE: the manifest-verified B1 baseline (JSONL hash-checked). Students flagged by the baseline
//    (mutationRisk any-nonzero) OR whose tombstone epoch/resetAt drifted from the baseline snapshot are
//    RECOMPUTED LIVE via the SHARED replay lib (b1-replay-lib.mjs — one law, zero drift) at write time;
//    recomputed students are listed in the run manifest [the r56/r57 mutation-closure protocol].
//  - PRE-IMAGE BACKUP: before any write, every to-be-touched study_states doc's CURRENT full content is
//    exported to the run's backup JSONL (gitignored dir). No backup record ⇒ no write.
//  - RESUMABLE + IDEMPOTENT: a durable cursor file records the last completed uid; recompute-and-overwrite
//    semantics make replay safe; a SECOND full pass must produce zero writes (verified by B4/A-audit).
//  - SCOPE: requires --classAllowlist (exact class doc ids — the reviewed census artifact for 26SM, or the
//    SHADOW allowlist for the shadow cohort; the two are asserted DISJOINT if both files exist).
//  - EXECUTE GATE: writes require --execute; dry-run prints/records everything it WOULD write.
//
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/b3-backfill-writer.mjs \
//          --classAllowlist=FILE --baseline=DIR [--execute] [--seedRru] [--resume]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, createWriteStream, existsSync, renameSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { computeStudentLabels, EXCL_KEYS } from "./b1-replay-lib.mjs";

const KNOWN = new Set(["classAllowlist", "baseline", "execute", "seedRru", "resume"]);
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  return [m[1], m[2] ?? true];
}));
const need = (k, type = "string") => {
  if (typeof args[k] !== type || (type === "string" && !args[k])) { console.error(`--${k}=${type === "string" ? "VALUE" : ""} is required`); process.exit(2); }
  return args[k];
};
const allowPath = need("classAllowlist");
const baseDir = need("baseline");
const EXECUTE = args.execute === true;
const SEED_RRU = args.seedRru === true;

let allow;
try { allow = JSON.parse(readFileSync(allowPath, "utf-8")); if (!Array.isArray(allow) || !allow.length || !allow.every(x => typeof x === "string" && x)) throw new Error("not a non-empty string array"); }
catch (e) { console.error(`FATAL: bad allowlist: ${e.message}`); process.exit(2); }

// baseline: manifest-verified
const bmode = existsSync(`${baseDir}/b1-manifest-full.json`) ? "full" : "sample";
const manifest = JSON.parse(readFileSync(`${baseDir}/b1-manifest-${bmode}.json`, "utf-8"));
const jsonlPath = `${baseDir}/b1-expected-labels-${manifest.mode}.jsonl`;
const jsonlRaw = readFileSync(jsonlPath);
if (createHash("sha256").update(jsonlRaw).digest("hex") !== manifest.jsonlSha256) { console.error("FATAL: baseline JSONL hash mismatch vs manifest"); process.exit(2); }
const baseline = new Map();
for (const ln of jsonlRaw.toString().split("\n")) { if (!ln) continue; const row = JSON.parse(ln); baseline.set(row.uid, row); }
console.error(`baseline: ${baseline.size} students (mode=${manifest.mode}, watermark=${manifest.watermark})`);

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

// scope from the allowlist (exact ids)
const cs = await db.collection("classes").get();
const students = new Set(); const matched = [];
cs.forEach(d => { if (allow.includes(d.id)) { matched.push(d.id); (d.data().studentIds || []).forEach(u => students.add(u)); } });
if (matched.length !== allow.length) { console.error(`FATAL: allowlist ${allow.length} classes, matched ${matched.length}`); process.exit(2); }
const uids = [...students].sort();
console.error(`scope: ${matched.length} classes -> ${uids.length} students; EXECUTE=${EXECUTE} SEED_RRU=${SEED_RRU}`);

const outDir = new URL("../../audit/deepfix/trackB_baselines/b3-runs/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const runId = `b3-${manifest.watermark}-${EXECUTE ? "exec" : "dry"}`;
const cursorPath = new URL(`${runId}.cursor`, outDir);
const doneUids = new Set(args.resume === true && existsSync(cursorPath) ? readFileSync(cursorPath, "utf-8").split("\n").filter(Boolean) : []);
const backup = createWriteStream(new URL(`${runId}.preimage.jsonl`, outDir), { flags: "a" });
const plan = createWriteStream(new URL(`${runId}.writeplan.jsonl`, outDir), { flags: "a" });

const FIELDS = ["reviewFailCount", "reviewLastFailedAt", "reviewLastCorrectAt", "reviewLastProvenAt", "reviewLastTestedAt"];
const stats = { students: 0, recomputedLive: 0, fromBaseline: 0, skippedEpochDrift: 0, docsPlanned: 0, docsWritten: 0, fieldsOmittedNull: 0, rruWrites: 0, notInBaseline: 0 };
const recomputedList = [], epochDriftList = [];
const counters = { bump: () => {}, note: () => {} }; // per-student recompute counters not aggregated here

for (const uid of uids) {
  if (doneUids.has(uid)) continue;
  const base = baseline.get(uid);
  let row = base;
  if (!base) { stats.notInBaseline++; recomputedList.push(uid); row = null; }
  // epoch-drift check vs the CURRENT tombstones
  let drifted = false;
  if (base) {
    const cur = {};
    for (const coll of ["progress_meta", "list_progress"]) {
      const snap = await db.collection("users").doc(uid).collection(coll).get();
      for (const d of snap.docs) {
        const v = d.data(); const c = cur[d.id] || { resetEpoch: 0, resetAt: null };
        cur[d.id] = { resetEpoch: Math.max(c.resetEpoch, v.resetEpoch ?? 0), resetAt: Math.max(c.resetAt ?? 0, v.resetAt?.toMillis?.() ?? 0) || null };
      }
    }
    for (const [listId, e] of Object.entries(base.epochByList || {}))
      if ((cur[listId]?.resetEpoch ?? 0) !== e.resetEpoch || (cur[listId]?.resetAt ?? null) !== e.resetAt) { drifted = true; break; }
  }
  const flagged = base && (base.mutationRisk?.pendingChallenges || base.mutationRisk?.adjudicatedAtOrAfterWatermark || base.mutationRisk?.challengeTsUnknown || base.mutationRisk?.challengedAttemptIdsTruncated);
  if (!row || drifted || flagged) {
    const fresh = await computeStudentLabels(db, uid, manifest.watermark, counters);
    row = { uid, epochByList: fresh.epochByList, mutationRisk: fresh.mutationRisk, words: fresh.wordsOut };
    stats.recomputedLive++;
    if (drifted) { stats.skippedEpochDrift++; epochDriftList.push(uid); }
    else recomputedList.push(uid);
  } else stats.fromBaseline++;
  // plan + write per word
  const byDoc = row.words; // key = listId|wordId → study_states/{wordId} (docId = wordId)
  const writes = [];
  for (const [k, w] of Object.entries(byDoc)) {
    const wordId = k.split("|")[1];
    const update = {};
    update.reviewFailCount = w.fc;
    if (w.lf !== null) update.reviewLastFailedAt = Timestamp.fromMillis(w.lf); else stats.fieldsOmittedNull++;
    if (w.lc !== null) update.reviewLastCorrectAt = Timestamp.fromMillis(w.lc); else stats.fieldsOmittedNull++;
    if (w.lp !== null) update.reviewLastProvenAt = Timestamp.fromMillis(w.lp); else stats.fieldsOmittedNull++;
    if (w.rlt !== null) update.reviewLastTestedAt = Timestamp.fromMillis(w.rlt); else stats.fieldsOmittedNull++;
    if (SEED_RRU && w.rru !== null) { update.reviewRestingUntil = Timestamp.fromMillis(w.rru); stats.rruWrites++; }
    writes.push({ wordId, update });
  }
  stats.docsPlanned += writes.length;
  // pre-image backup (batched reads)
  const refs = writes.map(w => db.collection("users").doc(uid).collection("study_states").doc(w.wordId));
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = await db.getAll(...refs.slice(i, i + 300));
    for (const doc of chunk) backup.write(JSON.stringify({ uid, path: doc.ref.path, exists: doc.exists, data: doc.exists ? doc.data() : null }) + "\n");
  }
  for (const w of writes) plan.write(JSON.stringify({ uid, wordId: w.wordId, fields: Object.keys(w.update) }) + "\n");
  if (EXECUTE) {
    const bw = db.bulkWriter();
    for (const w of writes) bw.set(db.collection("users").doc(uid).collection("study_states").doc(w.wordId), w.update, { merge: true });
    await bw.close();
    stats.docsWritten += writes.length;
  }
  stats.students++;
  writeFileSync(cursorPath, [...doneUids, uid].join("\n") + "\n"); doneUids.add(uid);
  process.stderr.write(".");
}
console.error("");
await new Promise(r => backup.end(r)); await new Promise(r => plan.end(r));
const runManifest = { runId, mode: EXECUTE ? "EXECUTE" : "DRY", baselineWatermark: manifest.watermark, allowlistClasses: matched.length,
  seedRru: SEED_RRU, stats, recomputedList, epochDriftList, at: Date.now() };
const mt = new URL(`${runId}.manifest.json.tmp`, outDir);
writeFileSync(mt, JSON.stringify(runManifest, null, 2)); renameSync(mt, new URL(`${runId}.manifest.json`, outDir));
console.log(JSON.stringify({ runId, ...stats }, null, 2));
