// b4-verify.mjs — EXPECTED-vs-ACTUAL VERIFIER + DELTA DETECTOR (Track B stage B4) — v4 (r62 panel closure).
// READ-ONLY. FULL A6 binding (verified baseline, exact version, sane watermark; classesMatched MANDATORY ≡
// allowlist; uid-set ≡ scope fatal) · the DELTA CHAIN (--appliedDelta layers resolved per-uid at their own
// watermarks; rosterAdded = covered by NEITHER original NOR any layer [r62p D2 — original-only made every
// post-baseline joiner a permanent non-PASS loop]) · corrupt-typed values are DIFFS · extras enumerated per
// doc via six orderBy sweeps, CAPPED at 5,000 rows with a truncation flag (a truncated report is never PASS
// and B3 refuses it for --repairExtras) · A8 collision abort · verdict PASS iff zeroDiff AND no delta AND
// untruncated. Emits: the b4-report + a MATERIALIZED delta layer dir that B1 --deltaAuth → B3 --deltaDir
// consume (the --uids path is DEAD [r62p]).
// --postFlip=FLIP_TS_MS [r62p N2 — THE ONE POST-FLIP RECONCILIATION]: expected recomputes at boundary=flipTs
// (the pre-flip tail absorbed); any doc carrying a label timestamp ≥ flipTs is LIVE-PROGRESSED — its diffs/
// extra status are informational, never PASS-blocking (the live server owns those writes now); delta flags
// become informational (no further layers exist — B3 is FORBIDDEN post-flip); PASS = zero non-live diffs ∧
// untruncated. The report records postFlip; B3 refuses --repairExtras against a postFlip report.
// Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/b4-verify.mjs \
//   --classAllowlist=FILE --manifest=ORIGINAL_MANIFEST [--appliedDelta=DIR]... [--postFlip=MS] [--allowSampleVerify]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeStudentLabels } from "./b1-replay-lib.mjs";
import { loadVerifiedBaselineIndexed, loadDeltaLayer, resolveExpectedSource, isRosterAdded, isFieldLiveExempt, assertLayerChainOrder } from "./b-baseline.mjs";

const argv = process.argv.slice(2);
const KNOWN = new Set(["classAllowlist", "manifest", "appliedDelta", "ignoreLedger", "postFlip", "allowSampleVerify"]);
const args = { appliedDelta: [] };
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  if (m[1] === "appliedDelta") args.appliedDelta.push(m[2]); else args[m[1]] = m[2] ?? true;
}
const need = k => { if (typeof args[k] !== "string" || !args[k]) { console.error(`--${k}=VALUE required`); process.exit(2); } return args[k]; };
const allowPath = need("classAllowlist"); const manifestPath = need("manifest");
let POSTFLIP = null;
if (args.postFlip !== undefined) {
  if (!/^[1-9]\d{9,}$/.test(String(args.postFlip))) { console.error("--postFlip must be epoch ms"); process.exit(2); }
  POSTFLIP = parseInt(args.postFlip, 10);
  if (POSTFLIP > Date.now() + 300e3) { console.error("--postFlip is in the future"); process.exit(2); }
}

let allow;
try { allow = JSON.parse(readFileSync(allowPath, "utf-8")); if (!Array.isArray(allow) || !allow.length || !allow.every(x => typeof x === "string" && x)) throw new Error("not a non-empty string array"); }
catch (e) { console.error(`FATAL: bad allowlist: ${e.message}`); process.exit(2); }
let original;
try { original = loadVerifiedBaselineIndexed(manifestPath); } catch (e) { console.error(`FATAL baseline: ${e.message}`); process.exit(2); }
if (original.manifest.mode !== "full" && args.allowSampleVerify !== true) { console.error("FATAL: B4 requires a FULL original baseline (--allowSampleVerify for the shadow/reduced rehearsal) [r62p]"); process.exit(2); }
const deltaLayers = [];
for (const dir of args.appliedDelta) {
  try { deltaLayers.push(loadDeltaLayer(dir, original.manifestSha256, original.manifest.watermark)); }
  catch (e) { console.error(`FATAL delta layer ${dir}: ${e.message}`); process.exit(2); }
}
try { assertLayerChainOrder(deltaLayers); } catch (e) { console.error(`FATAL: ${e.message}`); process.exit(2); }
// r62 LEDGER AUDIT: every B3 EXECUTE appended its layer to applied-layers.jsonl. The FINAL B4 must be
// invoked with the FULL chain — a ledgered EXECUTE'd delta layer missing from --appliedDelta means this
// verdict would ignore state the writer applied ⇒ FATAL (override only with --ignoreLedger for forensics).
{
  const ledgerPath = new URL("../../audit/deepfix/trackB_baselines/applied-layers.jsonl", import.meta.url);
  if (existsSync(ledgerPath) && args.ignoreLedger !== true) {
    // r63 A4: STRICT — the ledger is mandatory audit authority; any invalid non-blank line, any intent
    // without its applied record, and any latest-applied with failures/skips is FATAL (not skipped)
    const intents = new Map(); const applieds = new Map(); const have = new Set(deltaLayers.map(L => L.base.manifestSha256));
    const lines = readFileSync(ledgerPath, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]; if (!ln.trim()) continue;
      let e; try { e = JSON.parse(ln); } catch { console.error(`FATAL [r63 ledger]: malformed line ${i + 1}`); process.exit(2); }
      if (e.probe === "b3-intent") { if (e.originalManifestSha256 === original.manifestSha256) intents.set(e.runId, e); }
      else if (e.probe === "b3-applied") { if (e.originalManifestSha256 === original.manifestSha256) applieds.set(e.runId, e); } // latest wins per runId
      else { console.error(`FATAL [r63 ledger]: unknown probe '${e.probe}' line ${i + 1}`); process.exit(2); }
    }
    const problems = [];
    for (const [runId] of intents) if (!applieds.has(runId)) problems.push(`${runId}: intent without completion (crash mid-run? resume it)`);
    const missing = [];
    for (const [runId, e] of applieds) {
      const o = e.outcome || {};
      if ((o.txnFailures || 0) + (o.skippedResetLocked || 0) + (o.skippedEpochDrift || 0) > 0) problems.push(`${runId}: latest completion has failures/skips — resume to a clean completion`);
      if (e.deltaManifestSha256 && !have.has(e.deltaManifestSha256)) missing.push(runId);
    }
    if (missing.length) problems.push(`EXECUTE'd delta layers not in --appliedDelta: ${missing.join(", ")}`);
    if (problems.length) { console.error(`FATAL [r63 ledger]:\n - ${problems.join("\n - ")}`); process.exit(2); }
  }
}

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const cs = await db.collection("classes").get();
const students = new Set(); let matchedN = 0;
cs.forEach(d => { if (allow.includes(d.id)) { matchedN++; (d.data().studentIds || []).forEach(u => students.add(u)); } });
if (matchedN !== allow.length) { console.error(`FATAL: allowlist ${allow.length}, matched ${matchedN}`); process.exit(2); }
if (!Array.isArray(original.manifest.classesMatched)) { console.error("FATAL [A6, r62p]: manifest lacks classesMatched — the truthy-guard bypass is closed; the scope binding is MANDATORY"); process.exit(2); }
{
  const mset = new Set(original.manifest.classesMatched.map(c => c.id ?? c));
  if (!(mset.size === allow.length && allow.every(id => mset.has(id)))) { console.error("FATAL [A6]: manifest.classesMatched ≠ allowlist"); process.exit(2); }
}
const uids = [...students].sort();
const baseUids = new Set(original.rows.keys());
// r62 ROSTER-CHURN LAW: churn is a COUNTED, delta-feeding category — never a permanent brick.
//  - rosterAdded (live, not in the original baseline): verified via live recompute AND flagged as a delta
//    reason so the next layer baselines them properly.
//  - departed (baseline, no longer enrolled): verify-SKIPPED, counted + listed (their docs are unreachable
//    behavior-wise; cleanup/retention is the reset/退-flow's concern, not the backfill's).
const rosterAdded = new Set(uids.filter(u => isRosterAdded(u, original, deltaLayers))); // r62p D2: layer-covered joiners are NOT re-flagged
// r63 A6: departures from the UNION of the original + every applied layer — a layer-only joiner who later
// departs must be counted, not vanish
const knownUids = new Set(baseUids);
for (const L of deltaLayers) for (const u of L.base.rows.keys()) knownUids.add(u);
const departedUids = [...knownUids].filter(u => !students.has(u));
console.error(`B4 v3: ${matchedN} classes -> ${uids.length} students; deltas=${deltaLayers.length}; original watermark=${original.manifest.watermark}`);

const FIELD_MAP = { fc: "reviewFailCount", lf: "reviewLastFailedAt", lc: "reviewLastCorrectAt", lp: "reviewLastProvenAt", rlt: "reviewLastTestedAt" };
const SIX = [...Object.values(FIELD_MAP), "reviewRestingUntil"];
const stats = { students: 0, zeroDiff: 0, withDiffs: 0, totalDiffs: 0, extraLabelDocs: 0, recomputedTargets: 0,
  deltaNewAttempts: 0, deltaAdjudication: 0, deltaEpoch: 0, corruptTyped: 0,
  liveAttempts: 0, liveExemptFields: 0, liveNewWordDocs: 0 };
const diffsOut = []; const extrasList = []; let truncated = false;
const deltaSet = new Map();
const addDelta = (uid, reason) => { if (!deltaSet.has(uid)) deltaSet.set(uid, []); const a = deltaSet.get(uid); if (!a.includes(reason)) a.push(reason); };
const readCur = (cur, field) => {
  if (!cur || !(field in cur)) return { v: null, corrupt: false };
  const raw = cur[field];
  if (field === "reviewFailCount") return typeof raw === "number" && Number.isInteger(raw) ? { v: raw, corrupt: false } : { v: "CORRUPT", corrupt: true };
  const ms = raw?.toMillis?.();
  return typeof ms === "number" ? { v: ms, corrupt: false } : { v: "CORRUPT", corrupt: true };
};

for (const uid of uids) {
  if (rosterAdded.has(uid)) { addDelta(uid, "rosterAdded"); stats.rosterAdded = (stats.rosterAdded || 0) + 1; }
  const src = resolveExpectedSource(uid, original, deltaLayers);
  // r62p N2: under --postFlip, expected recomputes at boundary=flipTs — the pre-flip tail (attempts between
  // the last layer watermark and the flip) is absorbed into expected; attempts AT/after the flip are the
  // live server's era, never a delta.
  const boundary = POSTFLIP ?? src.watermark;
  const live = await computeStudentLabels(db, uid, boundary, {});
  if (live.wordIdCollisions.length) { console.error(`FATAL [A8]: uid ${uid} cross-list wordId collision`); process.exit(3); }
  const drifted = src.row && JSON.stringify(live.epochByList) !== JSON.stringify(src.row.epochByList);
  const digestChanged = src.row && src.row.challengeDigest !== live.challengeDigest;
  let expected;
  if (!src.row || drifted || digestChanged || POSTFLIP) { expected = live.wordsOut; stats.recomputedTargets++; }
  else expected = src.row.words;
  if (drifted) { addDelta(uid, "epochDrift"); stats.deltaEpoch++; }
  if (digestChanged) { addDelta(uid, "adjudicationChanged"); stats.deltaAdjudication++; }
  const asnap = await db.collection("attempts").where("studentId", "==", uid).get();
  for (const d of asnap.docs) {
    const t = d.data().submittedAt?.toMillis?.();
    if (typeof t !== "number" || t < boundary) continue;
    if (POSTFLIP) { stats.liveAttempts++; continue; }
    addDelta(uid, "newAttempts"); stats.deltaNewAttempts++; break;
  }
  const wordIds = [...new Set(Object.keys(expected).map(k => k.split("|")[1]))];
  const expectedWids = new Set(wordIds);
  const actualByWordId = new Map();
  const refs = wordIds.map(w => db.collection("users").doc(uid).collection("study_states").doc(w));
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = await db.getAll(...refs.slice(i, i + 300));
    for (const doc of chunk) actualByWordId.set(doc.id, doc.exists ? doc.data() : null);
  }
  // r63 A2: PER-FIELD live exemption [replaces the doc-wide isLiveDoc skip — one fresh stamp must never
  // hide a stale/corrupt UNTOUCHED field]. A mismatched field is exempt ONLY if that field itself proves
  // post-flip ownership (isFieldLiveExempt, shared law in b-baseline.mjs); corrupt-typed NEVER exempt.
  let myDiffs = 0, myExtra = 0;
  for (const [k, w] of Object.entries(expected)) {
    const wordId = k.split("|")[1];
    const cur = actualByWordId.get(wordId);
    const want = { fc: w.fc, lf: w.lf, lc: w.lc, lp: w.lp, rlt: w.rlt };
    for (const [short, field] of Object.entries(FIELD_MAP)) {
      const exp = want[short];
      const { v: act, corrupt } = readCur(cur, field);
      if (corrupt) { stats.corruptTyped++; myDiffs++; if (diffsOut.length < 2000) diffsOut.push({ uid, wordId, field, expected: exp, actual: "CORRUPT_TYPE" }); else truncated = true; continue; }
      const match = exp === null ? act === null : act === exp;
      if (!match) {
        if (POSTFLIP && isFieldLiveExempt(field, cur, POSTFLIP)) { stats.liveExemptFields++; continue; }
        myDiffs++; if (diffsOut.length < 2000) diffsOut.push({ uid, wordId, field, expected: exp, actual: act }); else truncated = true;
      }
    }
    const { v: rruAct, corrupt: rruCorrupt } = readCur(cur, "reviewRestingUntil");
    if (rruAct !== null) {
      if (!rruCorrupt && POSTFLIP && isFieldLiveExempt("reviewRestingUntil", cur, POSTFLIP)) { stats.liveExemptFields++; }
      else { myDiffs++; if (diffsOut.length < 2000) diffsOut.push({ uid, wordId, field: "reviewRestingUntil", expected: null, actual: rruCorrupt ? "CORRUPT_TYPE" : rruAct }); else truncated = true; }
    }
  }
  const extraDocs = new Map();
  for (const f of SIX) {
    const es = await db.collection("users").doc(uid).collection("study_states").orderBy(f).select().get();
    for (const d of es.docs) if (!expectedWids.has(d.id)) { if (!extraDocs.has(d.id)) extraDocs.set(d.id, []); extraDocs.get(d.id).push(f); }
  }
  if (POSTFLIP && extraDocs.size) {
    // live-era extras (post-flip intake/graduation on words outside expected) are the server's own writes —
    // but ONLY when EVERY present owned field on the doc proves live ownership [r63 A2: one fresh field
    // must not excuse a doc that also carries stale label residue]
    const exRefs = [...extraDocs.keys()].map(w => db.collection("users").doc(uid).collection("study_states").doc(w));
    for (let i = 0; i < exRefs.length; i += 300) {
      const chunk = await db.getAll(...exRefs.slice(i, i + 300));
      for (const doc of chunk) {
        if (!doc.exists) continue;
        const d = doc.data();
        const present = SIX.filter(f => f in d);
        if (present.length && present.every(f => isFieldLiveExempt(f, d, POSTFLIP))) { extraDocs.delete(doc.id); stats.liveNewWordDocs++; }
      }
    }
  }
  for (const [wid, fields] of extraDocs) {
    myExtra++;
    if (extrasList.length < 5000) extrasList.push({ uid, wordId: wid, fields }); else truncated = true;
  }
  stats.totalDiffs += myDiffs + myExtra; stats.extraLabelDocs += myExtra;
  if (myDiffs + myExtra === 0) stats.zeroDiff++; else stats.withDiffs++;
  stats.students++;
  process.stderr.write(".");
}
console.error("");
const outDir = new URL("../../audit/deepfix/trackB_baselines/b4-runs/", import.meta.url);
mkdirSync(outDir, { recursive: true });
stats.departedSkipped = departedUids.length;
const deltaList = [...deltaSet.entries()].map(([uid, reasons]) => ({ uid, reasons }));
const runId = `b4-${original.manifest.watermark}-${Date.now()}`;
// r62p N2: post-flip there are no further layers (B3 FORBIDDEN) — deltaList is informational; PASS = zero
// non-live diffs ∧ untruncated. Pre-flip verdict law unchanged.
const verdict = POSTFLIP
  ? ((stats.totalDiffs === 0 && !truncated) ? "PASS" : "DIFFS")
  : ((stats.totalDiffs === 0 && deltaList.length === 0 && !truncated) ? "PASS"
    : (stats.totalDiffs === 0 && deltaList.length ? "ZERO-DIFF-BUT-DELTA-OUTSTANDING"
      : (deltaList.length ? "DIFFS-WITH-ACTIONABLE-DELTA" : "DIFFS")));
const report = { probe: "b4-report", version: 4, runId, originalManifestSha256: original.manifestSha256,
  appliedDeltas: deltaLayers.map(L => L.base.manifestSha256),
  extrasDeletionLaw: "all-six-present", // r63 A3: the deletion semantics are IN the report schema B3 validates
  postFlip: POSTFLIP, verdict,
  diffsTruncated: truncated, stats, deltaList, departedUids, diffs: diffsOut, extrasList };
writeFileSync(new URL(`${runId}.json.tmp`, outDir), JSON.stringify(report, null, 2));
renameSync(new URL(`${runId}.json.tmp`, outDir), new URL(`${runId}.json`, outDir));
if (deltaList.length && !POSTFLIP) {
  // r61: MATERIALIZE the complete delta layer dir — canonical filenames, zero manual surgery [r62p: the
  // NEXT hop is B1 --deltaAuth (the --uids path is DEAD — no parent hashes); the dir path is printed on a
  // parseable line the cycle driver consumes]
  const layerDir = new URL(`${runId}-delta/`, outDir);
  mkdirSync(layerDir, { recursive: true });
  const auth = { probe: "b4-delta", version: 2, uids: deltaList.map(d => d.uid), reasons: deltaList,
    baselineManifestSha256: original.manifestSha256, emittedByRun: runId };
  writeFileSync(new URL("delta-auth.json.tmp", layerDir), JSON.stringify(auth, null, 2));
  renameSync(new URL("delta-auth.json.tmp", layerDir), new URL("delta-auth.json", layerDir));
  writeFileSync(new URL("uids.json.tmp", layerDir), JSON.stringify(auth.uids, null, 2));
  renameSync(new URL("uids.json.tmp", layerDir), new URL("uids.json", layerDir));
  const layerPath = fileURLToPath(layerDir);
  console.log(`MATERIALIZED_DELTA_DIR=${layerPath}`);
  console.error(`delta layer materialized: ${layerPath} (next: b1 --full --classAllowlist=<ALLOW> --deltaAuth=<dir>/delta-auth.json --outDir=<dir>, then b3 --deltaDir=<dir> --execute, then b4 --appliedDelta=<dir>)`);
}
// r61/r63: FAIL-CLOSED exits — a pipeline can never stay green on a non-PASS.
// 5 = DIFFS with NO actionable delta (structural — STOP and investigate)
// 6 = zero-diff, delta outstanding (actionable — the driver runs the next lap)
// 7 = DIFFS *AND* an actionable materialized delta [r63 A1 — roster-added and in-place-adjudication
//     students NORMALLY present as diffs+delta; the lap re-baselines them and the next B4 re-verifies;
//     stopping here made the driver reject the exact cases the chain exists to converge]
console.log(JSON.stringify({ runId, verdict: report.verdict, stats, deltaStudents: deltaSet.size, extras: extrasList.length, truncated }, null, 2));
if (report.verdict === "DIFFS-WITH-ACTIONABLE-DELTA") process.exit(7);
if (report.verdict === "DIFFS") process.exit(5);
if (report.verdict === "ZERO-DIFF-BUT-DELTA-OUTSTANDING") process.exit(6);
if (report.verdict !== "PASS") { console.error(`FATAL: unmapped verdict ${report.verdict}`); process.exit(2); } // belt-and-suspenders: only PASS exits 0
