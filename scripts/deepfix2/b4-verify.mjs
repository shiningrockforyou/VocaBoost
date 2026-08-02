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
import { loadVerifiedBaselineIndexed, loadDeltaLayer, resolveExpectedSource, isRosterAdded, isFieldLiveExempt, assertLayerChainOrder, auditRoot, parseLedgerStrict } from "./b-baseline.mjs";

const argv = process.argv.slice(2);
const KNOWN = new Set(["classAllowlist", "manifest", "appliedDelta", "ignoreLedger", "postFlip", "allowSampleVerify"]);
const args = { appliedDelta: [] };
for (const a of argv) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  if (m[1] === "appliedDelta") args.appliedDelta.push(m[2]); else args[m[1]] = m[2] ?? true;
}
const need = k => { if (typeof args[k] !== "string" || !args[k]) { console.error(`--${k}=VALUE required`); process.exit(2); } return args[k]; };
const allowPath = need("classAllowlist"); const manifestPath = need("manifest");
let POSTFLIP = null; let CUTOFF = null;
if (args.postFlip !== undefined) {
  if (!/^[1-9]\d{9,}$/.test(String(args.postFlip))) { console.error("--postFlip must be epoch ms"); process.exit(2); }
  POSTFLIP = parseInt(args.postFlip, 10);
  if (POSTFLIP > Date.now() + 300e3) { console.error("--postFlip is in the future"); process.exit(2); }
  CUTOFF = Date.now(); // r64 A1: the captured cutoff — fc verifies against a replay THROUGH this instant
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
  const ledgerPath = new URL("applied-layers.jsonl", auditRoot());
  // r64 [Codex A3]: an ABSENT ledger is fail-closed whenever this run claims applied layers — strict
  // parsing never made an optional file mandatory
  if (!existsSync(ledgerPath) && args.appliedDelta.length && args.ignoreLedger !== true) {
    console.error("FATAL [r64 ledger]: --appliedDelta given but no ledger exists — layers cannot have been EXECUTE'd through B3 on this checkout (--ignoreLedger = forensics only)"); process.exit(2);
  }
  if (existsSync(ledgerPath) && args.ignoreLedger !== true) {
    // r66: THE ONE STRICT REDUCER (shared with B3's repair scan — b-baseline.parseLedgerStrict)
    let red;
    try { red = parseLedgerStrict(readFileSync(ledgerPath, "utf-8"), original.manifestSha256); }
    catch (e) { console.error(`FATAL [r63 ledger]: ${e.message}`); process.exit(2); }
    const have = new Set(deltaLayers.map(L => L.base.manifestSha256));
    const problems = [...red.problems];
    const missing = [...red.appliedLayerShas].filter(sha => !have.has(sha));
    if (missing.length) problems.push(`EXECUTE'd delta layers not in --appliedDelta: ${missing.length} layer(s)`);
    if (problems.length) { console.error(`FATAL [r63 ledger]:\n - ${problems.join("\n - ")}`); process.exit(2); }
  }
}

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
// r65 [Codex r64 A1]: --postFlip is CROSS-CHECKED against the durable marker — a caller-selected boundary
// was authority (a typo'd earlier boundary exempted wrong pre-activation values as live). The marker is
// the era truth; the arg must EQUAL it exactly.
let MARKER_DOC = null;
if (POSTFLIP) {
  const cfg = await db.doc("system_config/review_v2").get();
  const fe = cfg.exists ? cfg.data().firstEnabledAt : null;
  const feMs = fe?.toMillis?.();
  if (typeof feMs !== "number" || !Number.isFinite(feMs)) { console.error("FATAL [r65 A1]: --postFlip requires a valid system_config/review_v2.firstEnabledAt marker (missing/malformed)"); process.exit(2); }
  if (feMs !== POSTFLIP) { console.error(`FATAL [r65 A1]: --postFlip=${POSTFLIP} ≠ the durable marker ${feMs} — the marker is the only era authority`); process.exit(2); }
  MARKER_DOC = { firstEnabledAt: feMs, configUpdateTimeMs: cfg.updateTime?.toMillis?.() ?? null, enabled: cfg.data().enabled === true };
}
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
for (const L of deltaLayers) {
  for (const u of L.base.rows.keys()) knownUids.add(u);
  for (const u of L.auth.uids) knownUids.add(u); // r64 [Codex B1]: an all-departed layer carries its uids ONLY in auth/departedUids — they must still count as departed
}
const departedUids = [...knownUids].filter(u => !students.has(u));
console.error(`B4 v4: ${matchedN} classes -> ${uids.length} students; deltas=${deltaLayers.length}; original watermark=${original.manifest.watermark}`);

const FIELD_MAP = { fc: "reviewFailCount", lf: "reviewLastFailedAt", lc: "reviewLastCorrectAt", lp: "reviewLastProvenAt", rlt: "reviewLastTestedAt" };
const SIX = [...Object.values(FIELD_MAP), "reviewRestingUntil"];
const stats = { students: 0, zeroDiff: 0, withDiffs: 0, totalDiffs: 0, extraLabelDocs: 0, recomputedTargets: 0,
  deltaNewAttempts: 0, deltaAdjudication: 0, deltaEpoch: 0, corruptTyped: 0,
  liveAttempts: 0, liveExemptFields: 0, liveNewWordDocs: 0 };
const diffsOut = []; const extrasList = []; const reportUncovered = []; const reportTail = []; let truncated = false;
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
  if (live.wordIdCollisions.length) { console.error(`FATAL [A8]: uid ${uid} cross-list wordId collision`); process.exit(8); } // r64: exit 8 (the old 3 collided with the driver skip semantics)
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
  // r63 A2 + r64 A1 + r65 [Codex r64 A2/A3/A4 — three reproduced false-greens, one false-red]:
  //  - PER-FIELD live exemption (timestamp fields exempt only when the field ITSELF ≥ flipTs);
  //  - reviewFailCount verifies through the captured CUTOFF replay, never via a partner timestamp;
  //  - NO whole-word adjudication skip (under the adjudication law fc/lf are grading-time and lc/lp
  //    live-stamped — the per-field rules suffice; rejected/unknown statuses change nothing);
  //  - NO !src.row student skip (`covered by no layer` never proves post-flip re-enrollment — an uncovered
  //    PRE-flip joiner is exactly the roster tail this gate exists to catch; uncovered uids are LISTED and
  //    their diffs BLOCK);
  //  - the comparison UNIVERSE runs THROUGH THE CUTOFF (a word first presented post-flip is replay-known:
  //    fc exact vs cutoff, timestamp expectations = flip-boundary value or null — never generic extras).
  let flipRowsRef = null;
  if (POSTFLIP) {
    if (!src.row) { stats.uncoveredAtGate = (stats.uncoveredAtGate || 0) + 1; reportUncovered.push(uid); }
    const c = await computeStudentLabels(db, uid, CUTOFF, {});
    const flipRows = expected; // boundary=flip recompute (forced above)
    flipRowsRef = flipRows;
    expected = {};
    for (const [k, cw] of Object.entries(c.wordsOut)) {
      const f = flipRows[k];
      expected[k] = { fc: cw.fc, lf: f?.lf ?? null, lc: f?.lc ?? null, lp: f?.lp ?? null, rlt: f?.rlt ?? null };
    }
  }
  const wordIds = [...new Set(Object.keys(expected).map(k => k.split("|")[1]))];
  const expectedWids = new Set(wordIds);
  const actualByWordId = new Map();
  const refs = wordIds.map(w => db.collection("users").doc(uid).collection("study_states").doc(w));
  for (let i = 0; i < refs.length; i += 300) {
    const chunk = await db.getAll(...refs.slice(i, i + 300));
    for (const doc of chunk) actualByWordId.set(doc.id, doc.exists ? doc.data() : null);
  }
  let myDiffs = 0, myExtra = 0;
  for (const [k, w] of Object.entries(expected)) {
    const wordId = k.split("|")[1];
    const cur = actualByWordId.get(wordId);
    const want = { fc: w.fc, lf: w.lf, lc: w.lc, lp: w.lp, rlt: w.rlt };
    for (const [short, field] of Object.entries(FIELD_MAP)) {
      const exp = want[short]; // under POSTFLIP, fc is ALREADY the through-cutoff value (universe law above)
      const { v: act, corrupt } = readCur(cur, field);
      // r66: a POST-FLIP-CREATED word (absent from the flip universe) with zero fails legitimately has NO
      // fc field — the live writer only writes fc on a fail; expected 0 ≡ absent for those words ONLY
      if (POSTFLIP && short === "fc" && exp === 0 && act === null && !corrupt && !flipRowsRef?.[k]) { continue; }
      if (corrupt) { stats.corruptTyped++; myDiffs++; if (diffsOut.length < 2000) diffsOut.push({ uid, wordId, field, expected: exp, actual: "CORRUPT_TYPE" }); else truncated = true; continue; }
      const match = exp === null ? act === null : act === exp;
      if (!match) {
        if (POSTFLIP && short !== "fc" && isFieldLiveExempt(field, cur, POSTFLIP)) { stats.liveExemptFields++; continue; }
        // r65p [panel custody N4 — the pre-flip TAIL]: events between the last layer watermark and the flip
        // have no writer (B3 done, live writers not yet stamping). Disk ≡ the LAYER expectation while the
        // flip-boundary expectation moved ⇒ the divergence IS the tail: classified + counted + published,
        // never silent, informational (disposition: the final pre-flip micro-lap bounds it to minutes and
        // live use re-stamps; mixed tail+post-flip fc cases intentionally still BLOCK).
        if (POSTFLIP && src.row) {
          const lay = src.row.words?.[k]?.[short] ?? null;
          // r66 [gate NEW-A + Codex A2 — value coincidence is NOT provenance]: tail additionally requires
          // the FLIP-BOUNDARY expectation to have MOVED off the layer expectation (replay is deterministic,
          // so movement can ONLY come from events in (layerWatermark, flip) — provenance by construction).
          // A lost POST-flip stamp leaves flip ≡ layer ⇒ NOT tail ⇒ falls through to the fc fence/diff.
          const flipVal = (POSTFLIP ? (flipRowsRef?.[k]?.[short] ?? null) : null);
          const moved = (flipVal ?? null) !== (lay ?? null);
          if (moved && (lay ?? null) === (act ?? null)) {
            stats.preFlipTail = (stats.preFlipTail || 0) + 1;
            if (reportTail.length < 500) reportTail.push({ uid, wordId, field }); else stats.preFlipTailTruncated = true;
            continue;
          }
        }
        if (POSTFLIP && short === "fc") {
          // concurrent-attempt fence: one fresh replay + re-read, then judge
          const c2 = await computeStudentLabels(db, uid, Date.now(), {});
          const fresh = await db.collection("users").doc(uid).collection("study_states").doc(wordId).get();
          const { v: act2 } = readCur(fresh.exists ? fresh.data() : null, field);
          const exp2 = c2.wordsOut[k] ? c2.wordsOut[k].fc : null;
          if ((exp2 ?? null) === (act2 ?? null)) { stats.fcRetriedClean = (stats.fcRetriedClean || 0) + 1; continue; }
        }
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
const outDir = new URL("b4-runs/", auditRoot()); // r65: DEEPFIX_AUDIT_ROOT isolation
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
  ignoreLedger: args.ignoreLedger === true, // r64 [panel N4]: forensic provenance is report-visible; B3 refuses it
  postFlip: POSTFLIP, marker: MARKER_DOC, uncoveredAtGate: reportUncovered, preFlipTail: reportTail, verdict,
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
