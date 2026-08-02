// b3-backfill-writer.mjs — THE BACKFILL WRITER (Track B stage B3) — v4 (the r61/r62 closure rebuild).
//
// LAWS:
//  - WRITE SET: the FIVE label fields (reviewFailCount/reviewLastFailedAt/reviewLastCorrectAt/
//    reviewLastProvenAt/reviewLastTestedAt). rru is LIVE-ONLY — no path here writes it, ever.
//  - CONVERGENT + REPAIRING [A3/A4 + r60]: reads current values; writes EXACT diffs; expected-null AND
//    corrupt-typed values ⇒ FieldValue.delete()/set (a present-but-non-Timestamp value is CORRUPT_TYPE,
//    never treated as null); already-equal ⇒ no write (`verifiedEqual`).
//  - BOUNDED MEMORY [r62]: the ORIGINAL baseline is loaded as an OFFSET INDEX (rows parsed per uid off
//    disk, never 947 word-maps in RAM); phase 1 STREAMS both pre-images AND the write plan to disk
//    (incremental hashes); phase 2 consumes the plan file line-by-line. Delta layers stay eager (small).
//  - STREAMED, DURABLE, JOURNALED [A5 + r60 #4]: phase 1 publishes pre-images + the plan file + the
//    immutable run manifest BEFORE any write; phase 2 JOURNALS per-student outcomes ({uid, ok}); --resume
//    binds to the published run manifest (mode + baseline) and skips only ok:true journal lines.
//  - TRANSACTIONAL WRITES [r62 — H6 §9 THE LETTER]: each student's writes run in chunked TRANSACTIONS
//    that FIRST read both tombstone collections + the chunk's target docs (all reads before writes), then
//    RE-DIFF against the txn-read state (recompute-or-abort — a stale phase-1 plan is never re-forced
//    [r61]) and write. A reset fencing mid-flight aborts via serializable isolation ⇒ skippedResetLocked.
//    Residual honesty: chunks already COMMITTED before a reset began stay written — the reset wipe + the
//    post-flip reconciliation pass (14_ §4) absorb that tail; documented in 15_ §9.
//  - THE DELTA CHAIN [r60 #1 + r62]: --deltaDir consumes a delta LAYER verified against the ORIGINAL
//    (parent hashes + watermark>original + roster-churn law); departed delta uids are COUNTED
//    (deltaUidsDropped), never silent. Every EXECUTE appends to the applied-layers LEDGER that the final
//    B4 audits.
//  - EXTRAS REPAIR [r60 #3]: --repairExtras=B4-REPORT deletes the six authoritative fields on the
//    report's extra-label docs (sha+scope-bound [r61]).
//  - BINDING [A6]: verified baseline (probe/version/mode/hashes) + classesMatched ≡ allowlist + uid-set ≡
//    live scope (fatal without a delta layer); --execute requires mode 'full' on the original (or
//    --allowSampleExecute for the SHADOW rehearsal).
//
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/b3-backfill-writer.mjs \
//   --classAllowlist=FILE --manifest=ORIGINAL_MANIFEST --runId=ID [--execute] [--allowSampleExecute]
//   [--deltaDir=DIR] [--repairExtras=B4_REPORT] [--resume]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, createWriteStream, existsSync, renameSync, mkdirSync, appendFileSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { computeStudentLabels } from "./b1-replay-lib.mjs";
import { loadVerifiedBaselineIndexed, loadDeltaLayer, resolveExpectedSource } from "./b-baseline.mjs";
import { applyChunkInTxn, CHUNK_SIZE } from "./b3-txn-core.mjs";

const KNOWN = new Set(["classAllowlist", "manifest", "runId", "execute", "allowSampleExecute", "deltaDir", "repairExtras", "resume"]);
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  return [m[1], m[2] ?? true];
}));
const need = k => { if (typeof args[k] !== "string" || !args[k]) { console.error(`--${k}=VALUE required`); process.exit(2); } return args[k]; };
const allowPath = need("classAllowlist"); const manifestPath = need("manifest"); const RUNID = need("runId");
if (!/^[A-Za-z0-9._-]{4,64}$/.test(RUNID)) { console.error("--runId must be 4-64 [A-Za-z0-9._-]"); process.exit(2); }
const EXECUTE = args.execute === true;
const RESUME = args.resume === true;

let allow;
try { allow = JSON.parse(readFileSync(allowPath, "utf-8")); if (!Array.isArray(allow) || !allow.length || !allow.every(x => typeof x === "string" && x)) throw new Error("not a non-empty string array"); }
catch (e) { console.error(`FATAL: bad allowlist: ${e.message}`); process.exit(2); }

let original;
try { original = loadVerifiedBaselineIndexed(manifestPath); } catch (e) { console.error(`FATAL baseline: ${e.message}`); process.exit(2); }
if (EXECUTE && original.manifest.mode !== "full" && args.allowSampleExecute !== true) { console.error("FATAL: --execute requires a FULL original baseline (or --allowSampleExecute for the shadow rehearsal)"); process.exit(2); }
let deltaLayers = [];
if (args.deltaDir) {
  try { deltaLayers = [loadDeltaLayer(args.deltaDir, original.manifestSha256, original.manifest.watermark)]; }
  catch (e) { console.error(`FATAL delta: ${e.message}`); process.exit(2); }
}
let extrasRepair = null; let extrasRepairBinding = null;
if (args.repairExtras) {
  try {
    const rep = JSON.parse(readFileSync(args.repairExtras, "utf-8"));
    if (rep.probe !== "b4-report" || !Array.isArray(rep.extrasList)) throw new Error("not a b4-report with extrasList");
    if (rep.diffsTruncated === true) throw new Error("the b4-report is TRUNCATED — a capped extrasList is not repair authority [r62p]");
    if (rep.postFlip) throw new Error("the b4-report is POST-FLIP — extras there include the live server's own writes; repairExtras is FORBIDDEN [r62p N2]");
    if (rep.originalManifestSha256) extrasRepairBinding = rep.originalManifestSha256; else throw new Error("report lacks originalManifestSha256");
    args._repairExtrasSha256 = createHash("sha256").update(readFileSync(args.repairExtras)).digest("hex");
    extrasRepair = rep.extrasList; // [{uid, wordId, fields:[...]}] — scope-checked after the cohort loads [r61]
  } catch (e) { console.error(`FATAL repairExtras: ${e.message}`); process.exit(2); }
}

const FIELD_MAP = { fc: "reviewFailCount", lf: "reviewLastFailedAt", lc: "reviewLastCorrectAt", lp: "reviewLastProvenAt", rlt: "reviewLastTestedAt" };
const ALL_FIELDS = [...Object.values(FIELD_MAP), "reviewRestingUntil"];
const stats = { students: 0, deltaUidsDropped: 0, fromBaseline: 0, recomputedDigestChanged: 0, recomputedEpochDrift: 0, notInBaseline: 0,
  docsExamined: 0, docsWritten: 0, docsVerifiedEqual: 0, fieldSets: 0, fieldDeletes: 0, corruptRepairs: 0,
  txnFailures: 0, skippedResetLocked: 0, skippedEpochDrift: 0, resumedCommitted: 0, extrasRepaired: 0, plannedWrites: 0 };
const digestChangedList = [], epochDriftList = [], resetLockedList = [], epochDriftSkippedList = [], deltaDroppedList = [];

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

// r62p N3: B3 NEVER runs post-flip — after activation the live server owns the label fields and a B3 pass
// could overwrite fresher live stamps with phase-1 values. Hard config check, no override flag.
{
  const cfg = await db.doc("system_config/review_v2").get();
  if (cfg.exists && cfg.data().enabled === true) { console.error("FATAL [r62p N3]: system_config/review_v2.enabled is TRUE — B3 is FORBIDDEN post-flip (the one post-flip pass is B4 --postFlip, read-only)"); process.exit(2); }
}
const cs = await db.collection("classes").get();
const students = new Set(); const matched = [];
cs.forEach(d => { if (allow.includes(d.id)) { matched.push(d.id); (d.data().studentIds || []).forEach(u => students.add(u)); } });
if (matched.length !== allow.length) { console.error(`FATAL: allowlist ${allow.length} classes, matched ${matched.length}`); process.exit(2); }
if (!Array.isArray(original.manifest.classesMatched)) { console.error("FATAL [A6, r62p]: manifest lacks classesMatched — the truthy-guard bypass is closed"); process.exit(2); }
{
  const mset = new Set(original.manifest.classesMatched.map(c => c.id ?? c));
  if (!(mset.size === allow.length && allow.every(id => mset.has(id)))) { console.error("FATAL [A6]: manifest.classesMatched ≠ allowlist"); process.exit(2); }
}
let uids = [...students].sort();
const baseUids = new Set(original.rows.keys());
const missing = uids.filter(u => !baseUids.has(u));
const extra = [...baseUids].filter(u => !students.has(u));
if ((missing.length || extra.length) && !deltaLayers.length) {
  console.error(`FATAL [A6 scope drift]: ${missing.length} live uids missing from baseline; ${extra.length} baseline uids out of scope`); process.exit(2);
}
if (extrasRepairBinding && extrasRepairBinding !== original.manifestSha256) { console.error("FATAL [r61]: the extras report is bound to a DIFFERENT baseline"); process.exit(2); }
if (extrasRepair) { const off = extrasRepair.filter(e => !students.has(e.uid)); if (off.length) { console.error(`FATAL [r61]: ${off.length} extras rows outside the cohort scope`); process.exit(2); } }
if (deltaLayers.length) {
  // delta run scope = the delta uids still enrolled; departed ones are COUNTED + LISTED [r62 roster-churn law]
  const writable = new Set(uids);
  uids = deltaLayers[0].auth.uids.filter(u => writable.has(u) && deltaLayers[0].base.rows.has(u)).sort();
  for (const u of deltaLayers[0].auth.uids) if (!uids.includes(u)) deltaDroppedList.push(u);
  stats.deltaUidsDropped = deltaDroppedList.length;
  if (deltaDroppedList.length) console.error(`NOTE [roster churn]: ${deltaDroppedList.length} delta uids not writable (departed) — listed in the result`);
}
console.error(`B3 v4 [${RUNID}]: ${matched.length} classes → ${uids.length} students; EXECUTE=${EXECUTE}; delta=${deltaLayers.length}; repairExtras=${extrasRepair ? extrasRepair.length : 0}`);

const outDir = new URL("../../audit/deepfix/trackB_baselines/b3-runs/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const backupPath = new URL(`${RUNID}.preimage.jsonl`, outDir);
const journalPath = new URL(`${RUNID}.phase2.journal`, outDir);
if (existsSync(backupPath) && !RESUME) { console.error(`FATAL [A5]: run ${RUNID} exists — runIds are single-use (use --resume to continue an interrupted EXECUTE)`); process.exit(2); }
const committed = new Set();
if (RESUME) {
  // r61: resume BINDS to the published run manifest — same mode, same baseline, same plan authority
  const rmPath = new URL(`${RUNID}.manifest.json`, outDir);
  if (!existsSync(rmPath)) { console.error("FATAL: --resume without a published run manifest"); process.exit(2); }
  const rm = JSON.parse(readFileSync(rmPath, "utf-8"));
  if (rm.mode !== (EXECUTE ? "EXECUTE" : "DRY")) { console.error(`FATAL: resume mode ${EXECUTE ? "EXECUTE" : "DRY"} ≠ the run's published mode ${rm.mode}`); process.exit(2); }
  if (rm.originalManifestSha256 !== original.manifestSha256) { console.error("FATAL: resume against a DIFFERENT baseline"); process.exit(2); }
  // r62: resume binds EVERY input hash, not just the original
  if ((rm.deltaLayer ?? null) !== (deltaLayers.length ? deltaLayers[0].base.manifestSha256 : null)) { console.error("FATAL: resume with a DIFFERENT delta layer than the published run"); process.exit(2); }
  if ((rm.repairExtrasSha256 ?? null) !== (args._repairExtrasSha256 ?? null)) { console.error("FATAL: resume with a DIFFERENT extras report than the published run"); process.exit(2); }
  if (existsSync(journalPath)) for (const ln of readFileSync(journalPath, "utf-8").split("\n")) {
    if (!ln) continue; try { const e = JSON.parse(ln); if (e.ok) committed.add(e.uid); } catch {}
  }
}

// ---- PHASE 0+1 (combined per student, FULLY STREAMED): resolve expected → read targets → stream
// pre-images → stream the write plan (one JSONL line per student; extras as their own lines).
const preTmp = new URL(`${RUNID}.preimage.jsonl.tmp`, outDir);
const preStream = RESUME && existsSync(backupPath) ? null : createWriteStream(preTmp);
const preHash = createHash("sha256");
// r62p: a RESUME regenerates plans from live state — docs that entered expected since the first run would
// otherwise be written with no pre-image. Every resume examination is captured to a SIDE pre-image file
// (append-mode; sha recorded in the RESULT — the run manifest stays immutable).
const preResumePath = new URL(`${RUNID}.preimage.resume.jsonl`, outDir);
const preResume = RESUME ? createWriteStream(preResumePath, { flags: "a" }) : null;
const preResumeHash = createHash("sha256");
if (preResume) preResume.on("error", e => { console.error(`FATAL: resume-preimage stream error: ${e.message}`); process.exit(2); });
const plansPath = new URL(RESUME ? `${RUNID}.plans.resume.jsonl` : `${RUNID}.plans.jsonl`, outDir);
const plansTmp = new URL(`${RUNID}.plans.jsonl.tmp`, outDir);
const planStream = createWriteStream(plansTmp);
const streamFatal = which => e => { console.error(`FATAL: ${which} stream error: ${e.message}`); process.exit(2); };
planStream.on("error", streamFatal("plan"));
if (preStream) preStream.on("error", streamFatal("preimage"));
const planHash = createHash("sha256");
const swrite = (stream, line) => new Promise(r => { stream.write(line) ? r() : stream.once("drain", r); }); // backpressure [r62]
const emitPlan = obj => { const line = JSON.stringify(obj) + "\n"; planHash.update(line); return swrite(planStream, line); };
const readCurrent = (cur, field) => {
  if (!cur || !(field in cur)) return { v: null, corrupt: false };
  const raw = cur[field];
  if (field === "reviewFailCount") return typeof raw === "number" && Number.isInteger(raw) ? { v: raw, corrupt: false } : { v: "CORRUPT", corrupt: true };
  const ms = raw?.toMillis?.();
  return typeof ms === "number" ? { v: ms, corrupt: false } : { v: "CORRUPT", corrupt: true };
};
for (const uid of uids) {
  if (committed.has(uid)) { stats.resumedCommitted++; continue; }
  const src = resolveExpectedSource(uid, original, deltaLayers);
  const live = await computeStudentLabels(db, uid, src.watermark, {});
  if (live.wordIdCollisions.length) { console.error(`FATAL [A8]: uid ${uid} cross-list wordId collision`); process.exit(3); }
  let expected;
  if (!src.row) { expected = live.wordsOut; stats.notInBaseline++; }
  else if (JSON.stringify(live.epochByList) !== JSON.stringify(src.row.epochByList)) { expected = live.wordsOut; stats.recomputedEpochDrift++; epochDriftList.push(uid); }
  else if (src.row.challengeDigest !== live.challengeDigest) { expected = live.wordsOut; stats.recomputedDigestChanged++; digestChangedList.push(uid); }
  else { expected = src.row.words; stats.fromBaseline++; }
  const byWordId = new Map(Object.entries(expected).map(([k, w]) => [k.split("|")[1], w]));
  const refs = [...byWordId.keys()].map(wid => db.collection("users").doc(uid).collection("study_states").doc(wid));
  const plan = [];
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = await db.getAll(...refs.slice(i, i + 300));
    for (const doc of chunk) {
      const cur = doc.exists ? doc.data() : null;
      const preLine = JSON.stringify({ uid, path: doc.ref.path, exists: doc.exists, data: cur, updateTimeMs: doc.updateTime?.toMillis?.() ?? null }) + "\n";
      if (preStream) { preHash.update(preLine); await swrite(preStream, preLine); }
      if (preResume) { preResumeHash.update(preLine); await swrite(preResume, preLine); }
      const w = byWordId.get(doc.id);
      stats.docsExamined++;
      const sets = {}; const deletes = [];
      const want = { fc: w.fc, lf: w.lf, lc: w.lc, lp: w.lp, rlt: w.rlt };
      for (const [short, field] of Object.entries(FIELD_MAP)) {
        const exp = want[short];
        const { v: act, corrupt } = readCurrent(cur, field);
        if (corrupt) { stats.corruptRepairs++; if (exp === null) deletes.push(field); else sets[field] = exp; continue; }
        if (short === "fc") { if (act !== exp) sets[field] = exp; }
        else if (exp === null) { if (act !== null) deletes.push(field); }
        else if (act !== exp) sets[field] = exp; // plan stores MILLIS; Timestamps materialize at write time
      }
      if (Object.keys(sets).length || deletes.length) plan.push({ wordId: doc.id, sets, deletes });
      else stats.docsVerifiedEqual++;
    }
  }
  stats.plannedWrites += plan.length;
  await emitPlan({ uid, plan, epochByList: live.epochByList });
  process.stderr.write(".");
}
// extras repair plans — separate lines, journaled per item
if (extrasRepair) for (const ex of extrasRepair) {
  if (committed.has(`EXTRA:${ex.uid}:${ex.wordId}`)) { stats.resumedCommitted++; continue; }
  const ref = db.collection("users").doc(ex.uid).collection("study_states").doc(ex.wordId);
  const doc = await ref.get();
  const exLine = JSON.stringify({ uid: ex.uid, path: ref.path, exists: doc.exists, data: doc.exists ? doc.data() : null, updateTimeMs: doc.updateTime?.toMillis?.() ?? null, extra: true }) + "\n";
  if (preStream) { preHash.update(exLine); await swrite(preStream, exLine); }
  if (preResume) { preResumeHash.update(exLine); await swrite(preResume, exLine); }
  if (!doc.exists) continue;
  const deletes = ALL_FIELDS.filter(f => f in doc.data());
  if (deletes.length) { stats.plannedWrites++; await emitPlan({ uid: ex.uid, plan: [{ wordId: ex.wordId, sets: {}, deletes }], extra: true }); }
}
console.error("");
await new Promise(r => planStream.end(r));
renameSync(plansTmp, plansPath);
if (preStream) {
  await new Promise(r => preStream.end(r));
  renameSync(preTmp, backupPath);
}
const runManifest = { probe: "b3-run", version: 4, runId: RUNID, mode: EXECUTE ? "EXECUTE" : "DRY",
  originalManifestSha256: original.manifestSha256, deltaLayer: deltaLayers.length ? deltaLayers[0].base.manifestSha256 : null,
  deltaDir: args.deltaDir || null, repairExtrasSha256: args._repairExtrasSha256 ?? null,
  watermarks: { original: original.manifest.watermark, delta: deltaLayers.length ? deltaLayers[0].base.manifest.watermark : null },
  allowlistClasses: matched.length, students: uids.length,
  preimageSha256: preStream ? preHash.digest("hex") : "RESUMED-EXISTING",
  plansFile: fileURLToPath(plansPath), writeplanSha256: planHash.digest("hex"),
  digestChangedList, epochDriftList, deltaDroppedList, phase1Stats: { ...stats } };
if (!RESUME) {
  writeFileSync(new URL(`${RUNID}.manifest.json.tmp`, outDir), JSON.stringify(runManifest, null, 2));
  renameSync(new URL(`${RUNID}.manifest.json.tmp`, outDir), new URL(`${RUNID}.manifest.json`, outDir));
}
console.error(`phase 1 durable: ${stats.docsExamined} docs examined, ${stats.plannedWrites} planned writes`);

// ---- PHASE 2: chunked TRANSACTIONS per student (tombstone reads + target reads FIRST, then re-diffed
// writes), streamed off the plan file, journaled ----
if (EXECUTE) {
  const rl = createInterface({ input: createReadStream(plansPath), crlfDelay: Infinity });
  for await (const ln of rl) {
    if (!ln) continue;
    const entry = JSON.parse(ln);
    const { uid, plan } = entry;
    const journalKey = entry.extra ? `EXTRA:${uid}:${plan[0].wordId}` : uid;
    if (committed.has(journalKey)) { stats.resumedCommitted++; continue; }
    if (!plan.length) { appendFileSync(journalPath, JSON.stringify({ uid: journalKey, ok: true, noop: true }) + "\n"); continue; }
    const ctxBase = {
      tombstoneQueries: [db.collection("users").doc(uid).collection("progress_meta"), db.collection("users").doc(uid).collection("list_progress")],
      targetRef: w => db.collection("users").doc(uid).collection("study_states").doc(w),
      expectedEpochByList: entry.epochByList || {},
      Timestamp, FieldValue, readCurrent,
    };
    let lockedNow = false, driftedNow = false; const failures = [];
    for (let i = 0; i < plan.length && !lockedNow && !driftedNow; i += CHUNK_SIZE) {
      const chunk = plan.slice(i, i + CHUNK_SIZE);
      try {
        // THE LAW lives in b3-txn-core.mjs (fixture-tested); counts land AFTER commit — SDK retries
        // re-execute the callback and must never inflate the audited result [r62p NEW-3]
        const out = await db.runTransaction(txn => applyChunkInTxn(txn, { ...ctxBase, chunk }));
        stats.docsWritten += out.written; stats.fieldSets += out.fieldSets;
        stats.fieldDeletes += out.fieldDeletes; stats.docsVerifiedEqual += out.verifiedEqual;
      } catch (e) {
        if (String(e.message).includes("RESET_LOCKED")) { lockedNow = true; break; }
        if (String(e.message).includes("EPOCH_DRIFT")) { driftedNow = true; break; }
        failures.push(`${uid}@chunk${i}:${e.code ?? e.message}`);
      }
    }
    // no journal line for skipped students — resume retries them [r61]
    if (lockedNow) { stats.skippedResetLocked++; resetLockedList.push(uid); continue; }
    if (driftedNow) { stats.skippedEpochDrift++; epochDriftSkippedList.push(uid); continue; } // r62p: a COMPLETED reset between phases aborts too
    const ok = failures.length === 0;
    if (!ok) stats.txnFailures += failures.length;
    if (ok && entry.extra) stats.extrasRepaired++;
    appendFileSync(journalPath, JSON.stringify({ uid: journalKey, ok, failures: failures.length ? failures : undefined }) + "\n");
    process.stderr.write("+");
  }
  console.error("");
}
stats.students = uids.length;
if (preResume) await new Promise(r => preResume.end(r));
const final = { ...runManifest, finalStats: stats, resetLockedList, epochDriftSkippedList,
  resumePreimageSha256: RESUME ? preResumeHash.digest("hex") : null };
// r62p: a resume writes its OWN result file — the original run's audit record is never clobbered
const resultName = RESUME ? `${RUNID}.result.resume.json` : `${RUNID}.result.json`;
writeFileSync(new URL(`${resultName}.tmp`, outDir), JSON.stringify(final, null, 2));
renameSync(new URL(`${resultName}.tmp`, outDir), new URL(resultName, outDir));
// r62: the applied-layers LEDGER — every EXECUTE appends; the FINAL B4 audits that its --appliedDelta
// chain covers every EXECUTE'd delta layer for this original baseline (14_ §4).
if (EXECUTE) appendFileSync(new URL("../../audit/deepfix/trackB_baselines/applied-layers.jsonl", import.meta.url),
  JSON.stringify({ probe: "b3-applied", runId: RUNID, originalManifestSha256: original.manifestSha256,
    deltaManifestSha256: deltaLayers.length ? deltaLayers[0].base.manifestSha256 : null, deltaDir: args.deltaDir || null,
    students: uids.length, txnFailures: stats.txnFailures, skippedResetLocked: stats.skippedResetLocked, at: new Date().toISOString() }) + "\n");
console.log(JSON.stringify({ runId: RUNID, execute: EXECUTE, ...stats }, null, 2));
if (stats.txnFailures > 0) process.exit(4);
if (stats.skippedResetLocked + stats.skippedEpochDrift > 0) process.exit(5); // r61/r62p: skipped students are VISIBLE failure, never silent green
