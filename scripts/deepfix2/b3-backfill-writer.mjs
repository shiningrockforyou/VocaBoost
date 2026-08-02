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
import { readFileSync, writeFileSync, createWriteStream, existsSync, renameSync, mkdirSync, appendFileSync, createReadStream, openSync, writeSync, fsyncSync, closeSync, rmSync, linkSync } from "node:fs";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { computeStudentLabels } from "./b1-replay-lib.mjs";
import { loadVerifiedBaselineIndexed, loadDeltaLayer, resolveExpectedSource, assertLayerChainOrder, auditRoot, parseLedgerStrict, assessLease } from "./b-baseline.mjs";
import { applyChunkInTxn, CHUNK_SIZE } from "./b3-txn-core.mjs";

const KNOWN = new Set(["classAllowlist", "manifest", "runId", "execute", "allowSampleExecute", "deltaDir", "repairExtras", "appliedDelta", "resume"]);
const args = { appliedDelta: [] };
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  if (m[1] === "appliedDelta") args.appliedDelta.push(m[2]); else args[m[1]] = m[2] ?? true;
}
const need = k => { if (typeof args[k] !== "string" || !args[k]) { console.error(`--${k}=VALUE required`); process.exit(2); } return args[k]; };
const allowPath = need("classAllowlist"); const manifestPath = need("manifest"); const RUNID = need("runId");
if (!/^[A-Za-z0-9._-]{4,64}$/.test(RUNID)) { console.error("--runId must be 4-64 [A-Za-z0-9._-]"); process.exit(2); }
const EXECUTE = args.execute === true;
const RESUME = args.resume === true;
// TEST-ONLY crash-injection hooks [r64 — the carded A4 crash-injection lap needs DETERMINISTIC crash
// points; inert unless the env var is set; never set in any production runbook]
const CRASH_AT = process.env.FIRESTORE_EMULATOR_HOST ? (process.env.B3_CRASH_AT || null) : null; // r66: hooks are emulator-only
const crashPoint = name => { if (CRASH_AT === name) { console.error(`[TEST] B3_CRASH_AT=${name} — simulating crash`); process.exit(99); } };

let allow;
try { allow = JSON.parse(readFileSync(allowPath, "utf-8")); if (!Array.isArray(allow) || !allow.length || !allow.every(x => typeof x === "string" && x)) throw new Error("not a non-empty string array"); }
catch (e) { console.error(`FATAL: bad allowlist: ${e.message}`); process.exit(2); }

let original;
try { original = loadVerifiedBaselineIndexed(manifestPath); } catch (e) { console.error(`FATAL baseline: ${e.message}`); process.exit(2); }
if (EXECUTE && original.manifest.mode !== "full" && args.allowSampleExecute !== true) { console.error("FATAL: --execute requires a FULL original baseline (or --allowSampleExecute for the shadow rehearsal)"); process.exit(2); }
// r64 A2 THE MODE LAW [Codex r63 — the loaded chain was validated then DISCARDED; repair planning resolved
// against M0 and could overwrite M1/M2-correct labels before deleting extras]:
//   repair mode  = --repairExtras + ordered --appliedDelta (NO --deltaDir): the chain IS the resolver —
//                  every uid resolves against M0 + the full chain; extras deletion plans ride on TOP of
//                  chain-correct expected state (an unrelated repair can no longer move a chain-correct
//                  student).
//   delta mode   = --deltaDir (NO --repairExtras, NO --appliedDelta): scope + resolution = the one new
//                  layer (newest watermark wins for its uids; nobody else is written).
//   plain mode   = neither: M0 only.
if (args.repairExtras && args.deltaDir) { console.error("FATAL [r64 A2]: --repairExtras and --deltaDir are EXCLUSIVE — repair is its own invocation"); process.exit(2); }
if (!args.repairExtras && args.appliedDelta.length) { console.error("FATAL [r64 A2]: --appliedDelta is repair-mode resolution context only (delta mode's layer already wins per-uid resolution)"); process.exit(2); }
let deltaLayers = [];
if (args.deltaDir) {
  try { deltaLayers = [loadDeltaLayer(args.deltaDir, original.manifestSha256, original.manifest.watermark)]; }
  catch (e) { console.error(`FATAL delta: ${e.message}`); process.exit(2); }
}
let extrasRepair = null; let extrasRepairBinding = null; let extrasRepairReport = null; let repairRealityScan = null;
if (args.repairExtras) {
  try {
    const rep = JSON.parse(readFileSync(args.repairExtras, "utf-8"));
    if (rep.probe !== "b4-report" || !Array.isArray(rep.extrasList)) throw new Error("not a b4-report with extrasList");
    if (rep.diffsTruncated === true) throw new Error("the b4-report is TRUNCATED — a capped extrasList is not repair authority [r62p]");
    if (rep.postFlip) throw new Error("the b4-report is POST-FLIP — extras there include the live server's own writes; repairExtras is FORBIDDEN [r62p N2]");
    if (rep.extrasDeletionLaw !== "all-six-present") throw new Error("report lacks extrasDeletionLaw:'all-six-present' — deletion semantics must be report-encoded [r63 A3]");
    if (rep.ignoreLedger === true) throw new Error("the b4-report was produced with --ignoreLedger — forensic reports are NOT deletion authority [r64 panel-N4]");
    // r63 A3: exact tuples — unique nonempty (uid, wordId); fields ⊆ the six owned names
    const SIXSET = new Set(["reviewFailCount", "reviewLastFailedAt", "reviewLastCorrectAt", "reviewLastProvenAt", "reviewLastTestedAt", "reviewRestingUntil"]);
    const seenT = new Set();
    for (const ex of rep.extrasList) {
      if (typeof ex.uid !== "string" || !ex.uid || typeof ex.wordId !== "string" || !ex.wordId) throw new Error("extras tuple lacks nonempty uid/wordId");
      const k = `${ex.uid}|${ex.wordId}`;
      if (seenT.has(k)) throw new Error(`duplicate extras tuple ${k}`);
      seenT.add(k);
      if (!Array.isArray(ex.fields) || !ex.fields.every(f => SIXSET.has(f))) throw new Error(`extras tuple ${k}: fields not a subset of the six owned names`);
    }
    if (rep.originalManifestSha256) extrasRepairBinding = rep.originalManifestSha256; else throw new Error("report lacks originalManifestSha256");
    extrasRepairReport = rep;
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
  // r64 [panel N3]: the guard is the DURABLE flipped-once marker, not the kill-switch-resettable flag — a
  // post-flip enabled:false window must never re-admit B3 while the live server still owns the fields
  if (cfg.exists && (cfg.data().enabled === true || cfg.data().firstEnabledAt)) { console.error("FATAL [r62p N3/r64]: review_v2 has been ENABLED (enabled:true or firstEnabledAt set) — B3 is FORBIDDEN from the first flip onward (the one post-flip pass is B4 --postFlip, read-only)"); process.exit(2); }
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
if (extrasRepairBinding && extrasRepairBinding !== original.manifestSha256) { console.error("FATAL [r61]: the extras report is bound to a DIFFERENT baseline"); process.exit(2); }
// r63 A3 + r64 A2 [ORDER MATTERS — the chain must load BEFORE the scope checks, and it becomes THE
// resolver]: the report's "extra" judgment is only true relative to the EXACT applied-delta chain it
// verified against — a stale-M0 report could order deletion of a word a later layer made expected, and a
// validated-then-discarded chain let phase 1 resolve repair plans against M0 (overwriting chain-correct
// labels). The chain must equal report.appliedDeltas exactly, and it resolves EVERY plan this invocation
// makes.
if (extrasRepair) {
  const chainLayers = [];
  for (const dir of args.appliedDelta) {
    try { chainLayers.push(loadDeltaLayer(dir, original.manifestSha256, original.manifest.watermark)); }
    catch (e) { console.error(`FATAL [r63 A3] chain layer ${dir}: ${e.message}`); process.exit(2); }
  }
  try { assertLayerChainOrder(chainLayers); } catch (e) { console.error(`FATAL: ${e.message}`); process.exit(2); }
  const mine = chainLayers.map(L => L.base.manifestSha256);
  const theirs = Array.isArray(extrasRepairReport.appliedDeltas) ? extrasRepairReport.appliedDeltas : [];
  if (mine.length !== theirs.length || !mine.every((s, i) => s === theirs[i])) {
    console.error(`FATAL [r63 A3]: --appliedDelta chain (${mine.length} layers) ≠ the report's appliedDeltas (${theirs.length}) — pass the exact chain the report verified against`); process.exit(2);
  }
  deltaLayers = chainLayers; // r64 A2: the chain IS the resolver for every plan this invocation makes
  // r64 [shadowlaw] + r65 [B2]: report ↔ REALITY — the report's chain must cover every EXECUTE'd layer per
  // the ledger, and no intent may dangle (an in-flight/crashed EXECUTE). Runs TWICE: here (fast fail) and
  // again AFTER the execution lease is held (the scan-to-lease gap would otherwise re-admit the race).
  repairRealityScan = () => {
    // r66 [Codex A3]: repair consumes B4's OWN strict reducer — version/probe/outcome strictness, the
    // latest-attempt-clean law, dangling intents, unreported layers — one law, two consumers.
    const ledgerPath = new URL("applied-layers.jsonl", auditRoot());
    if (!existsSync(ledgerPath) && args.appliedDelta.length) { console.error("FATAL [r65p]: repair claims applied layers but no ledger exists — same absence law as B4"); process.exit(2); }
    if (!existsSync(ledgerPath)) return;
    let red;
    try { red = parseLedgerStrict(readFileSync(ledgerPath, "utf-8"), original.manifestSha256); }
    catch (e) { console.error(`FATAL [r66 ledger]: ${e.message}`); process.exit(2); }
    const reported = new Set(theirs);
    const problems = [...red.problems];
    for (const sha of red.appliedLayerShas) if (!reported.has(sha)) problems.push(`EXECUTE'd layer not in the report's appliedDeltas — the report predates reality; re-run B4 with the full chain`);
    if (problems.length) { console.error(`FATAL [r66 repair-reality]:\n - ${problems.join("\n - ")}`); process.exit(2); }
  };
  repairRealityScan();
}
// scope drift: fatal ONLY in plain mode — delta mode scopes to its layer; repair mode covers churn via
// the chain (uncovered enrollees resolve by live recompute; departures are B4's counted category) [r64]
{
  const covered = new Set(baseUids);
  for (const L of deltaLayers) for (const u of L.base.rows.keys()) covered.add(u);
  const missing = uids.filter(u => !covered.has(u));
  const extra = [...covered].filter(u => !students.has(u));
  if ((missing.length || extra.length) && !deltaLayers.length) {
    console.error(`FATAL [A6 scope drift]: ${missing.length} live uids missing from baseline; ${extra.length} baseline uids out of scope`); process.exit(2);
  }
  if (missing.length || extra.length) console.error(`NOTE [roster churn]: ${missing.length} uncovered enrollees (live-recompute resolution) / ${extra.length} departed-from-coverage`);
}
if (extrasRepair) { const off = extrasRepair.filter(e => !students.has(e.uid)); if (off.length) { console.error(`FATAL [r61]: ${off.length} extras rows outside the cohort scope`); process.exit(2); } }
if (args.deltaDir && deltaLayers.length) {
  // DELTA MODE ONLY [r64 — the repair chain must NOT collapse scope to its first layer]: run scope = the
  // NEW layer's uids still enrolled; departed ones are COUNTED + LISTED [r62 roster-churn law]
  const writable = new Set(uids);
  uids = deltaLayers[0].auth.uids.filter(u => writable.has(u) && deltaLayers[0].base.rows.has(u)).sort();
  for (const u of deltaLayers[0].auth.uids) if (!uids.includes(u)) deltaDroppedList.push(u);
  stats.deltaUidsDropped = deltaDroppedList.length;
  if (deltaDroppedList.length) console.error(`NOTE [roster churn]: ${deltaDroppedList.length} delta uids not writable (departed) — listed in the result`);
}
console.error(`B3 v4 [${RUNID}]: ${matched.length} classes → ${uids.length} students; EXECUTE=${EXECUTE}; delta=${deltaLayers.length}; repairExtras=${extrasRepair ? extrasRepair.length : 0}`);

const outDir = new URL("b3-runs/", auditRoot()); // r65: DEEPFIX_AUDIT_ROOT isolation
// r63 A4: DURABLE ledger appends — write + fsync + close per record, so a host crash cannot leave applied
// writes without ledger evidence past the intent record. HONEST BOUNDARY [r65p]: the parent DIRECTORY is
// not fsynced — the very first append's file CREATION can be lost in a host crash (writes then exist with
// no ledger and a plain B4 runs no ledger audit); the stage-2 crash-injection matrix covers this window,
// and the mitigation is the intent record being the FIRST append of any run (loss ⇒ loss of the whole file
// ⇒ the next EXECUTE recreates it; the value diff remains the backstop)
const LEDGER_URL = new URL("applied-layers.jsonl", auditRoot());
const ledgerAppend = obj => {
  const fd = openSync(LEDGER_URL, "a");
  writeSync(fd, JSON.stringify(obj) + "\n");
  fsyncSync(fd); closeSync(fd);
};
mkdirSync(outDir, { recursive: true });
const backupPath = new URL(`${RUNID}.preimage.jsonl`, outDir);
const journalPath = new URL(`${RUNID}.phase2.journal`, outDir);
if (existsSync(backupPath) && !RESUME) {
  // r63 A5: a backup WITHOUT a published manifest = phase 1 crashed pre-publication ⇒ NO writes ever ran
  // (EXECUTE requires the manifest first). The orphan is set aside and a fresh start is legal — the old
  // "fresh rejects AND resume rejects" dead end is gone.
  if (!existsSync(new URL(`${RUNID}.manifest.json`, outDir))) {
    const orphan = new URL(`${RUNID}.preimage.orphan-${Date.now()}.jsonl`, outDir);
    renameSync(backupPath, orphan);
    console.error(`NOTE [r63 A5]: orphan pre-image (no manifest — phase 1 never completed) set aside as ${orphan.pathname.split("/").pop()}; starting fresh`);
  } else { console.error(`FATAL [A5]: run ${RUNID} exists — runIds are single-use (use --resume to continue an interrupted EXECUTE)`); process.exit(2); }
}
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

// r65 [Codex r64 B2]: ONE EXCLUSIVE EXECUTION LEASE per original baseline — concurrent delta/repair runs
// would transact against different expected chains with last-write-wins docs. wx-created; stale (>2h)
// leases are taken over once; released after the completion record publishes.
let execLeaseUrl = null; let LEASE_TOKEN = null;
if (EXECUTE) {
  execLeaseUrl = new URL(`exec-${original.manifestSha256.slice(0, 16)}.lease`, outDir);
  LEASE_TOKEN = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const takeLease = () => { // r67: ATOMIC CONTENTFUL creation (tmp+link) — no wx-then-write gap for a
    // concurrent reader to parse an empty lease as unparseable-stale
    const tmp = new URL(`${execLeaseUrl.pathname.split("/").pop()}.tmp-${process.pid}`, outDir);
    const fd = openSync(tmp, "w"); writeSync(fd, JSON.stringify({ pid: process.pid, token: LEASE_TOKEN, runId: RUNID, at: Date.now() })); fsyncSync(fd); closeSync(fd);
    try { linkSync(tmp, execLeaseUrl); } finally { rmSync(tmp, { force: true }); }
  };
  try { takeLease(); }
  catch (e) {
    if (e.code !== "EEXIST") { console.error(`FATAL: execution lease: ${e.message}`); process.exit(2); }
    // r66 [panel D1/D2 — a LIVE holder was stealable at >2h, and rm+wx takeover was a TOCTOU]:
    // LIVENESS WINS: an alive (or unverifiable-EPERM) holder is NEVER stolen, at any age.
    // staleness = pid provably dead (ESRCH) ∨ (age>2h ∧ pid unverifiable/absent).
    // takeover = CLAIM-BY-RENAME (exactly one renamer wins; the loser's ENOENT is the race signal).
    let holder = null;
    try { holder = JSON.parse(readFileSync(execLeaseUrl, "utf-8")); } catch {}
    const probe = pid => { try { process.kill(pid, 0); return "alive"; } catch (ke) { return ke.code === "ESRCH" ? "dead" : "eperm"; } };
    let leaseMtime = null; try { const { statSync } = await import("node:fs"); leaseMtime = statSync(execLeaseUrl).mtimeMs; } catch {}
    const assessment = assessLease(holder, probe, Date.now(), 2 * 3600e3, leaseMtime); // r67/r68: the pure law
    if (!assessment.stale) { console.error(`FATAL [r65 B2/r67]: another B3 EXECUTE holds the execution lease (${assessment.reason}) — liveness/EPERM wins at ANY age`); process.exit(2); }
    const reaped = new URL(`exec-${original.manifestSha256.slice(0, 16)}.reaped-${process.pid}-${Date.now().toString(36)}`, outDir);
    try { renameSync(execLeaseUrl, reaped); } catch { console.error("FATAL: lease takeover raced (another claimant renamed first)"); process.exit(2); }
    // r68 [cutover NEW-4 — the ABA]: verify we reaped the EXACT lease we assessed; a live successor's
    // fresh lease renamed by mistake is RESTORED and we stand down.
    try {
      const got = JSON.parse(readFileSync(reaped, "utf-8"));
      if ((got.token ?? null) !== (holder?.token ?? null)) { renameSync(reaped, execLeaseUrl); console.error("FATAL [r68 ABA]: reaped a DIFFERENT (live successor) lease — restored, standing down"); process.exit(2); }
    } catch (e) { if (e.code !== "ENOENT") { console.error(`FATAL: reap verification: ${e.message}`); process.exit(2); } }
    console.error(`NOTE [r67]: stale execution lease (${assessment.reason}) — claimed by rename`);
    try { takeLease(); } catch { console.error("FATAL: lease takeover raced at re-create"); process.exit(2); }
  }
  if (repairRealityScan) repairRealityScan(); // r65 B2: re-check under the lease — no scan-to-lease gap
  // r66 [panel D3 — the M0-revert plain run]: an EXECUTE that is NEITHER delta NOR chain-resolved repair
  // must find ZERO EXECUTE'd layers for this original in the ledger — plain mode resolves against M0 only
  // and would revert every chain-correct label (loud only at the next B4; the harness called it illegal
  // while the CLI accepted it).
  // r68 [Codex r67 A1 — THE ADMISSION GATE, both halves]: EVERY EXECUTE consumes the strict reducer.
  //  - Any unresolved latest attempt (dangling intent, failed/skipped completion) that is NOT this run's
  //    own ⇒ REFUSED (delta and repair included — a later layer can never overtake a crashed run).
  //  - A RESUME must prove its authority was not OVERTAKEN: any applied completion from ANOTHER run
  //    positioned AFTER this run's intent ⇒ REFUSED (the r67 blanket exemption authorized an M1→M0 revert).
  if (EXECUTE && existsSync(LEDGER_URL)) {
    let red;
    try { red = parseLedgerStrict(readFileSync(LEDGER_URL, "utf-8"), original.manifestSha256); }
    catch (e) { console.error(`FATAL [r68 admission]: ${e.message}`); process.exit(2); }
    const foreignProblems = red.problems.filter(p => !p.startsWith(`${RUNID} `));
    if (foreignProblems.length) { console.error(`FATAL [r68 admission]: unresolved runs in the ledger — resolve them FIRST (resume or investigate):\n - ${foreignProblems.join("\n - ")}`); process.exit(2); }
    if (RESUME) {
      const ownIntentIdx = red.ordered.findIndex(r => r.runId === RUNID && r.probe === "b3-intent");
      if (ownIntentIdx >= 0) {
        const overtakenBy = red.ordered.filter((r, i) => i > ownIntentIdx && r.probe === "b3-applied" && r.runId !== RUNID && !r.cutoverAborted);
        if (overtakenBy.length) { console.error(`FATAL [r68 overtake]: this run's authority was OVERTAKEN by later applied run(s): ${[...new Set(overtakenBy.map(r => r.runId))].join(", ")} — a resume would revert their writes; the crashed run is SUPERSEDED (its unwritten remainder re-converges via the chain)`); process.exit(2); }
      }
    }
  }
  if (!args.deltaDir && !extrasRepair && !RESUME && existsSync(LEDGER_URL)) {
    // r67 [gate NEW-4, PRECISE]: the guard targets M0-REVERT hazards — applied delta layers, or DANGLING
    // DELTA intents (a crashed delta EXECUTE is as dangerous as an applied one). A RESUME is exempt (it IS
    // the crash-resolution path, bound to its published manifest); dangling PLAIN intents are the lease/
    // runId laws' concern, not a revert hazard.
    let red;
    try { red = parseLedgerStrict(readFileSync(LEDGER_URL, "utf-8"), original.manifestSha256); }
    catch (e) { console.error(`FATAL [r66]: ${e.message}`); process.exit(2); }
    const danglingDelta = [];
    for (const [runId, att] of red.latestAttempt) {
      const key = `${runId}#${att}`;
      if (!red.applieds.has(key) && red.intents.get(key)?.deltaManifestSha256) danglingDelta.push(runId);
    }
    if (red.appliedLayerShas.size || danglingDelta.length) {
      console.error(`FATAL [r66/r67 plain-guard]: delta history exists for this original (${red.appliedLayerShas.size} applied layer(s)${danglingDelta.length ? "; dangling DELTA intents: " + danglingDelta.join(", ") : ""}) — a PLAIN run would revert chain-correct labels to M0`); process.exit(2);
    }
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
// r63 A5: each resume ATTEMPT gets its own immutable pre-image + result files — the recorded hash verifies
// exactly one file; nothing is appended to or overwritten across attempts
let ATTEMPT = 0;
if (RESUME) {
  // r64 [Codex A4 + panel N5]: EXCLUSIVE attempt reservation — a wx-created lease can never be won twice,
  // so two concurrent resumes cannot share files; lease files persist forever (attempts never renumber)
  for (let cand = 1; ; cand++) {
    try { const fd = openSync(new URL(`${RUNID}.resume-${cand}.lease`, outDir), "wx"); writeSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); fsyncSync(fd); closeSync(fd); ATTEMPT = cand; break; }
    catch (e) { if (e.code !== "EEXIST") { console.error(`FATAL: lease acquisition: ${e.message}`); process.exit(2); } }
  }
}
const preResumePath = new URL(`${RUNID}.resume-${ATTEMPT}.preimage.jsonl`, outDir);
const preResume = RESUME ? createWriteStream(preResumePath, { flags: "wx" }) : null;
const preResumeHash = createHash("sha256");
if (preResume) preResume.on("error", e => { console.error(`FATAL: resume-preimage stream error: ${e.message}`); process.exit(2); });
const plansPath = new URL(RESUME ? `${RUNID}.resume-${ATTEMPT}.plans.jsonl` : `${RUNID}.plans.jsonl`, outDir); // r64: per-attempt immutable plan evidence
const plansTmp = new URL(RESUME ? `${RUNID}.resume-${ATTEMPT}.plans.jsonl.tmp` : `${RUNID}.plans.jsonl.tmp`, outDir);
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
  if (live.wordIdCollisions.length) { console.error(`FATAL [A8]: uid ${uid} cross-list wordId collision`); process.exit(8); } // r64: exit 8 (3 collided with driver skip semantics)
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
  // TEST-ONLY [r66, emulator-gated like the crash hooks]: inject the FLIP between admission and phase 2 —
  // the activation-barrier case needs the marker to appear after B3's guard read
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.B3_TEST_SET_MARKER === "pre-phase2") {
    await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: Timestamp.fromMillis(Date.now()) }, { merge: true });
    console.error("[TEST] marker injected pre-phase2");
  }
  // r63 A4: INTENT before the first write — a crash mid-phase-2 leaves intent-without-completion, which the
  // strict B4 ledger audit FATALs on (resume to a clean completion)
  crashPoint("pre-intent");
  ledgerAppend({ probe: "b3-intent", version: 1, runId: RUNID, originalManifestSha256: original.manifestSha256,
    deltaManifestSha256: deltaLayers.length ? deltaLayers[0].base.manifestSha256 : null, attempt: ATTEMPT, at: new Date().toISOString() });
  crashPoint("post-intent");
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
      // r66 [Codex A3 — THE ACTIVATION BARRIER]: the config doc joins EVERY chunk txn's read set — the
      // flip txn (writing firstEnabledAt) and in-flight B3 chunks serialize on FIRESTORE itself; a B3
      // admitted pre-marker aborts at its next chunk, not after the flip.
      configRef: db.doc("system_config/review_v2"),
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
        crashPoint("after-first-chunk"); // fires on the FIRST committed chunk (then exits — deterministic)
      } catch (e) {
        if (String(e.message).includes("RESET_LOCKED")) { lockedNow = true; break; }
        if (String(e.message).includes("EPOCH_DRIFT")) { driftedNow = true; break; }
        if (String(e.message).includes("FLIP_DURING_RUN")) {
          // r67 [Codex r66 A3 — the barrier's own success bricked the ledger]: publish the TERMINAL
          // cutover-aborted completion (the reducer accepts it; the aborted layer counts as NOT applied)
          // and exit 6 — the post-flip gate settles unwritten students via the tail/diffs law.
          // r68 [cutover NEW-3]: REAL counts, never fabricated zeros — pre-abort failures stay visible
          ledgerAppend({ probe: "b3-applied", version: 1, runId: RUNID, originalManifestSha256: original.manifestSha256,
            deltaManifestSha256: deltaLayers.length ? deltaLayers[0].base.manifestSha256 : null, deltaDir: args.deltaDir || null,
            students: uids.length, attempt: ATTEMPT, complete: true,
            outcome: { txnFailures: stats.txnFailures, skippedResetLocked: stats.skippedResetLocked, skippedEpochDrift: stats.skippedEpochDrift, cutoverAborted: true },
            at: new Date().toISOString() });
          stats.cutoverAborted = true;
          const cutFinal = { ...runManifest, finalStats: stats, resetLockedList, epochDriftSkippedList, cutoverAborted: true };
          const cutName = RESUME ? `${RUNID}.resume-${ATTEMPT}.result.json` : `${RUNID}.result.json`;
          writeFileSync(new URL(`${cutName}.tmp`, outDir), JSON.stringify(cutFinal, null, 2));
          renameSync(new URL(`${cutName}.tmp`, outDir), new URL(cutName, outDir));
          if (execLeaseUrl) { try { const cur = JSON.parse(readFileSync(execLeaseUrl, "utf-8")); if (cur.token === LEASE_TOKEN) rmSync(execLeaseUrl, { force: true }); } catch {} }
          console.error("CUTOVER [r67]: firstEnabledAt appeared MID-RUN — terminal cutover-aborted completion published; committed chunks are pre-flip by serialization; the post-flip gate settles the remainder (exit 6)");
          process.exit(6);
        }
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
const resultName = RESUME ? `${RUNID}.resume-${ATTEMPT}.result.json` : `${RUNID}.result.json`;
writeFileSync(new URL(`${resultName}.tmp`, outDir), JSON.stringify(final, null, 2));
renameSync(new URL(`${resultName}.tmp`, outDir), new URL(resultName, outDir));
// r62: the applied-layers LEDGER — every EXECUTE appends; the FINAL B4 audits that its --appliedDelta
// chain covers every EXECUTE'd delta layer for this original baseline (14_ §4).
if (EXECUTE) crashPoint("pre-complete");
if (EXECUTE) ledgerAppend({ probe: "b3-applied", version: 1, runId: RUNID, originalManifestSha256: original.manifestSha256,
  deltaManifestSha256: deltaLayers.length ? deltaLayers[0].base.manifestSha256 : null, deltaDir: args.deltaDir || null,
  students: uids.length, attempt: ATTEMPT, complete: true,
  outcome: { txnFailures: stats.txnFailures, skippedResetLocked: stats.skippedResetLocked, skippedEpochDrift: stats.skippedEpochDrift },
  at: new Date().toISOString() });
if (execLeaseUrl) { // r66: CONDITIONAL release — never delete a replacement holder's lease
  try { const cur = JSON.parse(readFileSync(execLeaseUrl, "utf-8")); if (cur.token === LEASE_TOKEN) rmSync(execLeaseUrl, { force: true }); }
  catch {}
}
console.log(JSON.stringify({ runId: RUNID, execute: EXECUTE, ...stats }, null, 2));
if (stats.txnFailures > 0) process.exit(4);
if (stats.skippedResetLocked + stats.skippedEpochDrift > 0) process.exit(5); // r61/r62p: skipped students are VISIBLE failure, never silent green
