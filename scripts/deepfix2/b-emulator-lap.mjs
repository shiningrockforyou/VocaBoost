// b-emulator-lap.mjs — THE TRACK-B EMULATOR SMOKE LAP [the David-ratified card, scope r64 = the Codex-r63
// closure set]. Runs the REAL CLIs (B1/B3/B4 + the b-delta-cycle.mjs driver) against the FIRESTORE
// EMULATOR — execution evidence for exactly the CLI-glue stratum no fixture covers.
//
// REQUIRED CASES (02_ DF2-14 card): (a) new-attempt/zero-current-diff lap · (b) roster-added WITH diffs
// (exit-7) · (c) in-place adjudication WITH diffs · (d) mixed structural diff = FINAL failure · (e)
// all-delta-uids-departed · A4 crash injection (pre-intent / post-intent / after-first-chunk /
// pre-complete) · one --postFlip lap incl. post-flip adjudication · one resume lap · the A3 stale-report
// negative.
//
// Isolation: EMULATOR ONLY — asserts FIRESTORE_EMULATOR_HOST before any write; every case starts from a
// wiped emulator project. The ledger/artifact dirs are redirected to a scratch sandbox via cwd-relative
// paths staying inside the repo's gitignored audit tree.
//
// RUNBOOK (WSL — /app/node_modules is Windows-locked for npm, and the box has no system Java):
//   one-time: curl Temurin-21 JRE → ~/jre (userspace) · npm install firebase-tools --prefix ~/fbtools
//   run:  PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
//         PATH=$HOME/jre/<jdk-dir>/bin:$PATH NODE_PATH=/app/node_modules \
//           ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
//           "NODE_PATH=/app/node_modules node scripts/deepfix2/b-emulator-lap.mjs"
// Exit 0 = every case green; nonzero = the first red case.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — this lap runs ONLY against the emulator"); process.exit(2); }
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const key = JSON.parse(readFileSync(join(repoRoot, "scripts", "serviceAccountKey.json"), "utf-8"));
const PROJECT = key.project_id;
initializeApp({ credential: cert(key) });
const db = getFirestore();

let checks = 0, failures = 0;
const ok = (cond, label, r = null) => { checks++; if (cond) console.error(`  ✓ ${label}`); else { failures++; console.error(`  ✗ FAIL: ${label}`); if (r) console.error(`    └─ ${r.out.split("\n").filter(Boolean).slice(-6).join("\n    └─ ")}`); } };

// ---------- harness [r65 A6: FULLY ISOLATED — DEEPFIX_AUDIT_ROOT redirects every CLI artifact path;
// the shared audit/deepfix/trackB_baselines forensic chain is NEVER touched] ----------
const lapRoot = join(repoRoot, "audit", "deepfix", "emulator-lap-root");
// r65p [panel — PROVEN concurrent-lap contamination]: ONE lap at a time. wx lock with pid-liveness.
const lapLock = join(repoRoot, "audit", "deepfix", "emulator-lap.lock");
try {
  const { openSync: o, writeSync: w, closeSync: c } = await import("node:fs");
  try { const fd = o(lapLock, "wx"); w(fd, JSON.stringify({ pid: process.pid, at: Date.now() })); c(fd); }
  catch (e) {
    if (e.code !== "EEXIST") throw e;
    let stale = true;
    try { const L = JSON.parse(readFileSync(lapLock, "utf-8")); try { process.kill(L.pid, 0); stale = false; } catch (ke) { stale = ke.code === "ESRCH"; } } catch {}
    if (!stale) { console.error("FATAL: another emulator lap is RUNNING (concurrent laps contaminate each other — proven r64 panel)"); process.exit(2); }
    // r67: claim-by-rename (one winner) — the rm+wx TOCTOU dies here too
    const reaped = lapLock + `.reaped-${process.pid}`;
    try { const { renameSync: rn } = await import("node:fs"); rn(lapLock, reaped); } catch { console.error("FATAL: lap-lock takeover raced"); process.exit(2); }
    const fd = o(lapLock, "wx"); w(fd, JSON.stringify({ pid: process.pid, at: Date.now() })); c(fd);
  }
} catch (e) { console.error(`FATAL: lap lock: ${e.message}`); process.exit(2); }
process.on("exit", () => { try { rmSync(lapLock, { force: true }); } catch {} });
rmSync(lapRoot, { recursive: true, force: true });
mkdirSync(lapRoot, { recursive: true });
const allowPath = join(lapRoot, "allowlist.json");
writeFileSync(allowPath, JSON.stringify(["cls-em-1"]));
const ledgerPath = join(lapRoot, "applied-layers.jsonl");
const b4runs = join(lapRoot, "b4-runs");
const wipeArtifacts = () => {
  for (const f of readdirSync(lapRoot)) if (f !== "allowlist.json") rmSync(join(lapRoot, f), { recursive: true, force: true });
};
const wipeEmulator = async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`emulator wipe failed: ${res.status}`);
};
const run = (script, extra, env = {}) => {
  const r = spawnSync(process.execPath, [join(repoRoot, "scripts", "deepfix2", script), ...extra],
    { cwd: repoRoot, env: { ...process.env, DEEPFIX_AUDIT_ROOT: lapRoot, ...env }, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? ""), stdout: r.stdout ?? "" };
};
const TS = ms => Timestamp.fromMillis(ms);
const DAY = 86400e3;
const BASE = Date.parse("2026-06-01T00:00:00Z");
const attAbsT = (id, uid, tMs, type, rows, score) => db.collection("attempts").doc(id).set({
  studentId: uid, classId: "cls-em-1", listId: "L1", sessionType: type, submittedAt: TS(tMs),
  graded: true, score, totalQuestions: rows.length, dayNumber: 1,
  answers: rows.map(([w, c]) => ({ wordId: w, isCorrect: c })),
});
const att = (id, uid, dayOff, type, rows, score) => attAbsT(id, uid, BASE + dayOff * DAY, type, rows, score);
// a TRULY-post-watermark attempt = stamped NOW (the original watermark was minted when B1 ran, seconds ago)
const attNow = (id, uid, type, rows, score) => attAbsT(id, uid, Date.now(), type, rows, score);
const seedCohort = async (uids = ["emA", "emB", "emC"]) => {
  await db.collection("classes").doc("cls-em-1").set({ name: "EMU LAP", studentIds: uids });
  await att("a1", "emA", 1, "new", [["w1", true], ["w2", true]], 100);
  await att("a2", "emA", 2, "review", [["w1", true], ["w2", false]], 50);
  await att("b1", "emB", 1, "new", [["w1", true], ["w3", true]], 100);
  await att("b2", "emB", 3, "review", [["w3", false]], 0);
  await att("c1", "emC", 1, "new", [["w2", true]], 100);
};
const freshManifest = () => join(lapRoot, "b1-manifest-full.json");
const b1full = () => run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${allowPath}`]);
const b3exec = (runId, extra = []) => run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, `--runId=${runId}`, "--execute", ...extra]);
const b4 = (extra = []) => run("b4-verify.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, ...extra]);
const driver = (prefix, extra = []) => run("b-delta-cycle.mjs", [`--allow=${allowPath}`, `--manifest=${freshManifest()}`, `--prefix=${prefix}`, ...extra]);
const resetCase = async () => { await wipeEmulator(); wipeArtifacts(); await seedCohort(); };
const layerDirsOf = out => [...out.matchAll(/^MATERIALIZED_DELTA_DIR=(.+)$/gm)].map(m => m[1].trim());

// ================= CASE 0: baseline full chain — B1 → B3 → B4 PASS =================
console.error("== CASE 0: baseline B1→B3→B4 ==");
await resetCase();
{
  const r1 = b1full(); ok(r1.code === 0, `B1 --full exits 0 (got ${r1.code})`, r1);
  const r3 = b3exec("lap0"); ok(r3.code === 0, `B3 EXECUTE exits 0 (got ${r3.code})`, r3);
  const r4 = b4(); ok(r4.code === 0 && r4.out.includes('"verdict": "PASS"'), `B4 PASS exit 0 (got ${r4.code})`, r4);
}

// ================= CASE (a): new attempt, zero current diff → exit 6 → driver lap → PASS =================
console.error("== CASE a: new-attempt/zero-diff lap ==");
{
  await attNow("b9", "emB", "review", [["w3", true], ["w1", true]], 100); // GENUINELY post-watermark (t = now > W0)
  const r4 = b4(); ok(r4.code === 6, `B4 exits 6 zero-diff+delta (got ${r4.code})`);
  const d = driver("lapA"); ok(d.code === 0, `driver converges to PASS (got ${d.code})`);
}

// ================= CASE (b): roster-added WITH diffs → exit 7 → driver → PASS =================
console.error("== CASE b: roster-added exit-7 lap ==");
{
  await db.collection("classes").doc("cls-em-1").update({ studentIds: ["emA", "emB", "emC", "emD"] });
  await att("d1", "emD", 2, "new", [["w1", true], ["w4", false]], 50); // history, no labels on disk ⇒ diffs
  // case (a)'s applied layer must be passed — read it from the ledger
  const chain = existsSync(ledgerPath) ? [...readFileSync(ledgerPath, "utf-8").matchAll(/"deltaDir":"([^"]+)"/g)].map(m => m[1]).filter(Boolean) : [];
  const r4b = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(r4b.code === 7, `B4 exits 7 DIFFS-WITH-ACTIONABLE-DELTA (got ${r4b.code})`);
  const d = driver("lapB", chain.map(c => `--appliedDelta=${c}`));
  ok(d.code === 0, `driver converges roster-added to PASS (got ${d.code})`);
}

// ================= CASE (c): in-place adjudication WITH diffs → driver → PASS =================
console.error("== CASE c: in-place adjudication lap ==");
{
  const a2 = db.collection("attempts").doc("a2");
  const cur = (await a2.get()).data();
  const rows = cur.answers.map(r => r.wordId === "w2" ? { ...r, isCorrect: true, challengeStatus: "accepted", challengeReviewedAt: TS(BASE + 45 * DAY) } : r);
  await a2.update({ answers: rows, score: 100 }); // digest changes; submittedAt stays pre-watermark
  const chain = existsSync(ledgerPath) ? [...readFileSync(ledgerPath, "utf-8").matchAll(/"deltaDir":"([^"]+)"/g)].map(m => m[1]).filter(Boolean) : [];
  const r4 = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(r4.code === 7, `B4 exit 7 (diffs+delta) on adjudication (got ${r4.code})`, r4); // r66: pinned (was 6||7)
  const d = driver("lapC", chain.map(c => `--appliedDelta=${c}`));
  ok(d.code === 0, `driver converges adjudication to PASS (got ${d.code})`);
}

// ================= CASE (d): mixed structural diff stays a FINAL failure =================
console.error("== CASE d: structural diff = final failure ==");
{
  await db.collection("users").doc("emA").collection("study_states").doc("w1").set({ reviewFailCount: 77 }, { merge: true });
  const chain = existsSync(ledgerPath) ? [...readFileSync(ledgerPath, "utf-8").matchAll(/"deltaDir":"([^"]+)"/g)].map(m => m[1]).filter(Boolean) : [];
  const r4 = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(r4.code === 5, `B4 exits 5 structural DIFFS-no-delta (got ${r4.code})`, r4);
  const d = driver("lapD", chain.map(c => `--appliedDelta=${c}`));
  ok(d.code === 5, `driver STOPS on structural (got ${d.code})`);
  // heal via a delta-less B3 re-run is illegal (plain mode + layers) — heal by hand-reverting the corruption
  // (emA/w1 was never failed: the correct fc is 0)
  await db.collection("users").doc("emA").collection("study_states").doc("w1").update({ reviewFailCount: 0 });
  const r4c = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(r4c.code === 0, `B4 PASS after correction (got ${r4c.code})`);
}

// ================= CASE (e): ALL delta uids departed → empty layer → converges =================
console.error("== CASE e: all-departed convergence ==");
await resetCase();
{
  b1full(); b3exec("lapE0");
  await attNow("b9e", "emB", "review", [["w3", true]], 100); // emB becomes delta WHILE ENROLLED...
  const r4 = b4(); ok(r4.code === 6 || r4.code === 7, `B4 flags emB's delta (got ${r4.code})`, r4);
  const layers = layerDirsOf(r4.stdout);
  ok(layers.length === 1, "B4 materialized the layer");
  if (layers.length === 1) {
    await db.collection("classes").doc("cls-em-1").update({ studentIds: ["emA", "emC"] }); // ...THEN departs
    const r1 = run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${allowPath}`, `--deltaAuth=${join(layers[0], "delta-auth.json")}`, `--outDir=${layers[0]}`]);
    ok(r1.code === 0 && r1.out.includes("ALL delta uids departed"), `B1 emits the empty excused layer (got ${r1.code})`, r1);
    const r3 = b3exec("lapE1", [`--deltaDir=${layers[0]}`]); ok(r3.code === 0, `B3 no-op delta run exits 0 (got ${r3.code})`, r3);
    const r4b = b4([`--appliedDelta=${layers[0]}`]);
    ok(r4b.code === 0, `B4 PASS — departed counted, chain converged (got ${r4b.code})`, r4b);
    ok(r4b.out.includes('"departedSkipped": 1'), "departed uid is COUNTED");
  }
}

// ================= CRASH INJECTION (A4): the four points =================
console.error("== CRASH: pre-intent ==");
await resetCase();
{
  b1full();
  const r = b3exec("crash0", []), rr = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash1", "--execute"], { B3_CRASH_AT: "pre-intent" });
  ok(rr.code === 99, `crash fired pre-intent (got ${rr.code})`);
  ok(!existsSync(ledgerPath) || !readFileSync(ledgerPath, "utf-8").includes("crash1"), "no ledger record before intent — rerun is legal");
}
console.error("== CRASH: post-intent (intent-without-completion ⇒ B4 FATAL ⇒ resume heals) ==");
{
  const rr = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash2", "--execute"], { B3_CRASH_AT: "post-intent" });
  ok(rr.code === 99, `crash fired post-intent (got ${rr.code})`);
  const r4 = b4(); ok(r4.code === 2 && r4.out.includes("intent without completion"), `B4 FATALs on the dangling intent (got ${r4.code})`);
  const res = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash2", "--execute", "--resume"]);
  ok(res.code === 0, `resume completes cleanly (got ${res.code})`);
  const r4b = b4(); ok(r4b.code === 0, `B4 PASS after resume (got ${r4b.code})`);
}
console.error("== CRASH: after-first-chunk + pre-complete ==");
await resetCase();
{
  b1full();
  const rr = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash3", "--execute"], { B3_CRASH_AT: "after-first-chunk" });
  ok(rr.code === 99, `crash fired after first committed chunk (got ${rr.code})`);
  const r4 = b4(); ok(r4.code === 2 && r4.out.includes("intent without completion"), "B4 FATALs (committed chunk, no completion)");
  const res = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash3", "--execute", "--resume"]);
  ok(res.code === 0, `resume after chunk-crash exits 0 (got ${res.code})`);
  const rr2 = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash4", "--execute"], { B3_CRASH_AT: "pre-complete" });
  ok(rr2.code === 99, `crash fired pre-complete (got ${rr2.code})`);
  const res2 = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=crash4", "--execute", "--resume"]);
  ok(res2.code === 0, "resume heals the pre-complete crash");
  const r4c = b4(); ok(r4c.code === 0, `B4 PASS after both heals (got ${r4c.code})`);
}

// ================= POST-FLIP LAP (per-field law + adjudication + B3 guard) =================
console.error("== POSTFLIP lap ==");
await resetCase();
{
  const rb1 = b1full(); ok(rb1.code === 0, `[pf] B1 exits 0 (got ${rb1.code})`, rb1);
  const rb3 = b3exec("pflap0"); ok(rb3.code === 0, `[pf] B3 pf0 exits 0 (got ${rb3.code})`, rb3);
  console.error(`    [pf b3 stats] ${(rb3.stdout.match(/"plannedWrites": \d+|"docsWritten": \d+|"students": \d+/g) || []).join(" ")}`);
  const FLIP = BASE + 50 * DAY;
  await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: TS(FLIP) });
  // live-era simulation: a post-flip fail on emB/w3 — the live writer increments fc + stamps lf ≥ flip
  await att("pfb", "emB", 51, "review", [["w3", false]], 0);
  await db.collection("users").doc("emB").collection("study_states").doc("w3").set(
    { reviewFailCount: 2, reviewLastFailedAt: TS(BASE + 51 * DAY), reviewLastTestedAt: TS(BASE + 51 * DAY) }, { merge: true });
  const g = b3exec("pfGuard");
  ok(g.code === 2 && g.out.includes("FORBIDDEN"), `B3 guard refuses post-flip (got ${g.code})`);
  const r4 = b4([`--postFlip=${FLIP}`]);
  ok(r4.code === 0, `B4 --postFlip PASS with live-progressed fields (got ${r4.code})`, r4);
  if (r4.code !== 0) console.error("    [diag] " + (r4.stdout.split("\n").filter(l => l.includes("diffs") || l.includes("verdict") || l.includes("stats")).slice(0, 3).join(" | ")));
  ok(r4.out.includes('"liveExemptFields"') && !r4.out.includes('"liveExemptFields": 0,'), "live fields were exempted per-field");
  if (failures) { try {
    const rep = readdirSync(b4runs).filter(f => f.endsWith(".json")).sort().pop();
    const R = JSON.parse(readFileSync(join(b4runs, rep), "utf-8"));
    console.error(`    [diag report] verdict=${R.verdict} totalDiffs=${R.stats?.totalDiffs} extras=${R.stats?.extraLabelDocs} diffs=${JSON.stringify((R.diffs || []).slice(0, 6))}`);
  } catch (e) { console.error(`    [diag report] unavailable: ${e.message}`); } }
  // the kill-switch window: enabled=false but firstEnabledAt stands — B3 STILL refused
  await db.doc("system_config/review_v2").update({ enabled: false });
  const g2 = b3exec("pfGuard2");
  ok(g2.code === 2 && g2.out.includes("FORBIDDEN"), "durable marker blocks B3 in a kill-switch OFF window");
}

// ================= POST-FLIP ADVERSARIAL MATRIX [r65 — Codex r64 A1-A4 reproduced cases] =================
console.error("== POSTFLIP adversarial matrix ==");
await resetCase();
{
  b1full(); b3exec("pfm0");
  const FLIP = Date.now() - 60e3; // a flip one minute ago — post-flip events land between FLIP and cutoff
  await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: TS(FLIP) });
  // [A1] forged boundary: --postFlip ≠ the durable marker ⇒ FATAL 2 (never authority)
  const rWrong = b4([`--postFlip=${FLIP - 2}`]);
  ok(rWrong.code === 2 && rWrong.out.includes("marker"), `A1: forged boundary REFUSED (got ${rWrong.code})`, rWrong);
  // [A1] wrong pre-flip value at the TRUE boundary ⇒ DIFFS
  await db.collection("users").doc("emA").collection("study_states").doc("w1").set({ reviewLastCorrectAt: TS(FLIP - 1) }, { merge: true });
  const rTrue = b4([`--postFlip=${FLIP}`]);
  ok(rTrue.code === 5, `A1: wrong pre-flip value at the true boundary = DIFFS (got ${rTrue.code})`, rTrue);
  await db.collection("users").doc("emA").collection("study_states").doc("w1").update({ reviewLastCorrectAt: TS(BASE + 2 * DAY) }); // heal (a2 day-2 is the LATER correct)
  // [A2] REJECTED challenge + corrupt fc ⇒ DIFFS (no word skip)
  {
    const a2ref = db.collection("attempts").doc("a2");
    const a2cur = (await a2ref.get()).data();
    const rows = a2cur.answers.map(r => r.wordId === "w2" ? { ...r, challengeStatus: "rejected", challengeReviewedAt: TS(FLIP + 1000) } : r);
    await a2ref.update({ answers: rows });
    await db.collection("users").doc("emA").collection("study_states").doc("w2").set({ reviewFailCount: "CORRUPT" }, { merge: true });
    const r = b4([`--postFlip=${FLIP}`]);
    ok(r.code === 5, `A2: rejected challenge cannot hide corrupt fc (got ${r.code})`, r);
    await db.collection("users").doc("emA").collection("study_states").doc("w2").update({ reviewFailCount: 1 }); // heal
  }
  // [A2/card, r66 REALITY SHAPE] legacy accepted: isCorrect FLIPPED in place + score RECOMPUTED (the
  // production writers' actual behavior) — reconstruction keeps the fail; the mint is exempt ⇒ PASS
  {
    const a2ref = db.collection("attempts").doc("a2");
    const a2cur = (await a2ref.get()).data();
    const rows = a2cur.answers.map(r => r.wordId === "w2" ? { ...r, isCorrect: true, challengeStatus: "accepted", challengeReviewedAt: TS(FLIP + 2000) } : r);
    await a2ref.update({ answers: rows, score: 100 }); // the accept writer's recompute (2/2 effective)
    await db.collection("users").doc("emA").collection("study_states").doc("w2").set({ reviewLastCorrectAt: TS(FLIP + 2000) }, { merge: true }); // the live accept txn's mint
    const r = b4([`--postFlip=${FLIP}`]);
    ok(r.code === 0, `A2-reality: legacy accepted (flipped+recomputed) — fail reconstructed, mint exempt, PASS (got ${r.code})`, r);
    // Codex r65's exact corruption: fc 1→0 behind the acceptance ⇒ must BLOCK (movement conjunct: flip ≡ layer)
    await db.collection("users").doc("emA").collection("study_states").doc("w2").update({ reviewFailCount: 0 });
    const rC = b4([`--postFlip=${FLIP}`]);
    ok(rC.code === 5, `A2-reality: corrupt fc behind the acceptance BLOCKS (got ${rC.code})`, rC);
    await db.collection("users").doc("emA").collection("study_states").doc("w2").update({ reviewFailCount: 1 }); // heal
  }
  // [A4] a VALID post-flip new-word failure with exact live labels ⇒ PASS (through-cutoff universe)
  {
    await attAbsT("pfm-new", "emB", Date.now() - 30e3, "review", [["w9", false]], 0);
    await db.collection("users").doc("emB").collection("study_states").doc("w9").set(
      { reviewFailCount: 1, reviewLastFailedAt: TS(Date.now() - 30e3), reviewLastTestedAt: TS(Date.now() - 30e3) });
    const r = b4([`--postFlip=${FLIP}`]);
    ok(r.code === 0, `A4: valid post-flip new-word failure PASSES (got ${r.code})`, r);
  }
  // [A3] an UNCOVERED pre-flip joiner (history before the flip, no labels) ⇒ DIFFS + listed
  {
    await db.collection("classes").doc("cls-em-1").update({ studentIds: ["emA", "emB", "emC", "emE"] });
    await attAbsT("pfm-join", "emE", FLIP - 3600e3, "new", [["w1", false]], 0); // pre-flip history
    const r = b4([`--postFlip=${FLIP}`]);
    ok(r.code === 5, `A3: uncovered pre-flip joiner BLOCKS (got ${r.code})`, r);
    const repFile = readdirSync(b4runs).filter(f => f.endsWith(".json")).sort().pop();
    const rep = JSON.parse(readFileSync(join(b4runs, repFile), "utf-8"));
    ok(Array.isArray(rep.uncoveredAtGate) && rep.uncoveredAtGate.includes("emE"), "A3: uncovered uid LISTED in the report for operator disposition");
  }
}

// ================= STALE-REPORT NEGATIVE (A3 reality audit) =================
console.error("== STALE-REPORT negative ==");
await resetCase();
{
  const rb1 = b1full(); ok(rb1.code === 0, `[sr] B1 exits 0 (got ${rb1.code})`, rb1);
  const rb3 = b3exec("srlap0"); ok(rb3.code === 0, `[sr] B3 sr0 exits 0 (got ${rb3.code})`, rb3);
  console.error(`    [sr b3 stats] ${(rb3.stdout.match(/"plannedWrites": \d+|"docsWritten": \d+|"students": \d+/g) || []).join(" ")}`);
  const r4 = b4(); ok(r4.code === 0, `clean PASS baseline (got ${r4.code})`, r4);
  const reportFile = readdirSync(b4runs).filter(f => f.endsWith(".json") && !f.includes("delta")).sort().pop();
  // now a delta layer gets EXECUTE'd (new attempt → lap)
  await attNow("srb", "emB", "review", [["w3", true]], 100);
  const d = driver("srLap"); ok(d.code === 0, `delta lap converges (got ${d.code})`, d);
  // the OLD report (appliedDeltas:[]) must be REFUSED as repair authority
  const rep = join(b4runs, reportFile);
  const rr = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=srRepair", "--execute", `--repairExtras=${rep}`]);
  ok(rr.code === 2 && rr.out.includes("predates reality"), `stale report REFUSED pre-write (got ${rr.code})`, rr);
}

// ================= r66 CASES: tail provenance · lease liveness · plain guard · cutover · torn ledger =====
console.error("== r66: TRUE TAIL vs LOST POST-FLIP STAMP ==");
await resetCase();
{
  b1full(); b3exec("r66tail");
  await attNow("tailA", "emB", "review", [["w3", true]], 100); // lands AFTER W0, BEFORE the flip = TRUE TAIL
  const FLIP2 = Date.now() + 500;
  await new Promise(r => setTimeout(r, 600));
  await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: TS(FLIP2) });
  const rT = b4([`--postFlip=${FLIP2}`]);
  ok(rT.code === 0 && rT.out.includes('"preFlipTail"'), `true tail: classified + PASS (got ${rT.code})`, rT);
  await attAbsT("lostB", "emB", Date.now(), "review", [["w1", false]], 0); // AFTER the flip, stamp LOST (no disk write)
  const rL = b4([`--postFlip=${FLIP2}`]);
  ok(rL.code === 5, `LOST post-flip stamp BLOCKS (movement conjunct: flip ≡ layer) (got ${rL.code})`, rL);
}
console.error("== r66: NEW-WORD matrix (correct / mixed+blank) ==");
{
  const FLIP2 = (await db.doc("system_config/review_v2").get()).data().firstEnabledAt.toMillis();
  await db.collection("attempts").doc("lostB").delete(); // clear the blocker
  await attAbsT("nwC", "emC", Date.now(), "review", [["w6", true]], 100); // post-flip correct-only new word
  await db.collection("users").doc("emC").collection("study_states").doc("w6").set(
    { reviewLastCorrectAt: TS(Date.now()), reviewLastProvenAt: TS(Date.now()), reviewLastTestedAt: TS(Date.now()) });
  await attAbsT("nwM", "emC", Date.now(), "review", [["w7", true], ["w8", false], ["w9", false]], 33); // mixed + blank-style fail
  await db.collection("users").doc("emC").collection("study_states").doc("w7").set({ reviewLastCorrectAt: TS(Date.now()), reviewLastTestedAt: TS(Date.now()) });
  await db.collection("users").doc("emC").collection("study_states").doc("w8").set({ reviewFailCount: 1, reviewLastFailedAt: TS(Date.now()), reviewLastTestedAt: TS(Date.now()) });
  await db.collection("users").doc("emC").collection("study_states").doc("w9").set({ reviewFailCount: 1, reviewLastFailedAt: TS(Date.now()), reviewLastTestedAt: TS(Date.now()) });
  const r = b4([`--postFlip=${FLIP2}`]);
  ok(r.code === 0, `new-word correct/mixed matrix PASSES with exact live labels (got ${r.code})`, r);
}
console.error("== r66: LIVE lease refusal + plain guard + cutover + torn ledger ==");
await resetCase();
{
  b1full();
  // LIVE-holder lease at 3h age: liveness must WIN (the r65 steal is dead)
  const shaPrefix = createHash("sha256").update(readFileSync(freshManifest())).digest("hex").slice(0, 16);
  const leaseDir = join(lapRoot, "b3-runs");
  mkdirSync(leaseDir, { recursive: true });
  const leasePath = join(leaseDir, `exec-${shaPrefix}.lease`);
  writeFileSync(leasePath, JSON.stringify({ pid: process.pid, token: "live-holder", at: Date.now() - 3 * 3600e3 }));
  const rSteal = b3exec("r66steal");
  ok(rSteal.code === 2 && rSteal.out.includes("wins at ANY age"), `LIVE >2h lease REFUSED (got ${rSteal.code})`, rSteal);
  rmSync(leasePath, { force: true });
  const r0 = b3exec("r66base"); ok(r0.code === 0, `baseline B3 after lease cleanup (got ${r0.code})`, r0);
  // plain guard: after a delta lap, a PLAIN execute must FATAL
  await attNow("pgB", "emB", "review", [["w3", true]], 100);
  const d = driver("r66pg"); ok(d.code === 0, `delta lap for the plain-guard setup (got ${d.code})`, d);
  const rPlain = b3exec("r66plain");
  ok(rPlain.code === 2 && rPlain.out.includes("plain-guard"), `PLAIN execute after EXECUTE'd layers FATALS (got ${rPlain.code})`, rPlain);
  // cutover: marker lands between admission and phase 2 ⇒ the chunk txn barrier fires
  const chain = existsSync(ledgerPath) ? [...readFileSync(ledgerPath, "utf-8").matchAll(/"deltaDir":"([^"]+)"/g)].map(m => m[1]).filter(Boolean) : [];
  await attNow("cvB", "emB", "review", [["w1", true]], 100);
  const r4c = b4(chain.map(c => `--appliedDelta=${c}`));
  const layer = layerDirsOf(r4c.stdout)[0];
  ok(!!layer, `cutover setup: layer materialized (b4 ${r4c.code})`, r4c);
  if (layer) {
    const r1c = run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${allowPath}`, `--deltaAuth=${join(layer, "delta-auth.json")}`, `--outDir=${layer}`]);
    ok(r1c.code === 0, `cutover setup: delta B1 (got ${r1c.code})`, r1c);
    const rCut = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=r66cut", `--deltaDir=${layer}`, "--execute"], { B3_TEST_SET_MARKER: "pre-phase2" });
    ok(rCut.code === 6 && rCut.out.includes("CUTOVER"), `CUTOVER: mid-run flip → terminal cutover-aborted completion, exit 6 (got ${rCut.code})`, rCut);
    // r67 [Codex A3]: the sequence must run THROUGH the final gate — the reducer settles the aborted
    // intent and the tail law absorbs the unapplied layer's students (nonfatal, publishable verdict)
    const feMs = (await db.doc("system_config/review_v2").get()).data().firstEnabledAt.toMillis();
    const rFinal = b4(chain.map(c => `--appliedDelta=${c}`).concat([`--postFlip=${feMs}`]));
    ok(rFinal.code === 0 || rFinal.code === 5, `post-cutover FINAL gate runs to a verdict, never ledger-FATAL (got ${rFinal.code})`, rFinal);
    ok(rFinal.code === 0, `post-cutover gate PASSES — the aborted layer's students settle as published tail (got ${rFinal.code})`, rFinal);
    await db.doc("system_config/review_v2").delete(); // clear the injected marker for the torn case
  }
  // torn completion: a half-written ledger line must FATAL B4
  appendFileSync(ledgerPath, '{"probe":"b3-applied","version":1,"runId":"torn","attempt":0,"orig');
  const rTorn = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(rTorn.code === 2 && rTorn.out.includes("malformed"), `TORN completion record FATALS (got ${rTorn.code})`, rTorn);
}

// ================= r68: THE SEVEN-STEP OVERTAKE (Codex r67 A1's exact sequence) =================
console.error("== r68: overtake law ==");
await resetCase();
{
  b1full(); const r0 = b3exec("ovtM0"); ok(r0.code === 0, `M0 clean (got ${r0.code})`, r0);
  // Codex's sequence: the layer materializes FIRST (step 2), THEN the plain run crashes (step 3)
  await attNow("ovtB", "emB", "review", [["w3", true]], 100);
  const r4 = b4(); const layer = layerDirsOf(r4.stdout)[0];
  ok(!!layer && (r4.code === 6 || r4.code === 7), `delta layer materialized (b4 ${r4.code})`, r4);
  const r1 = run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${allowPath}`, `--deltaAuth=${join(layer, "delta-auth.json")}`, `--outDir=${layer}`]);
  ok(r1.code === 0, `delta B1 (got ${r1.code})`, r1);
  const rc = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=ovtP", "--execute"], { B3_CRASH_AT: "post-intent" });
  ok(rc.code === 99, `plain run crashes post-intent (got ${rc.code})`, rc);
  if (!layer) throw new Error("overtake setup failed — no layer");
  const rRef = b3exec("ovtM1", [`--deltaDir=${layer}`]);
  ok(rRef.code === 2 && rRef.out.includes("unresolved runs"), `delta ADMISSION REFUSED while ovtP dangles (got ${rRef.code})`, rRef);
  const rRes = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=ovtP", "--execute", "--resume"]);
  ok(rRes.code === 0, `ovtP resumed cleanly BEFORE any layer (got ${rRes.code})`, rRes);
  const rM1 = b3exec("ovtM1b", [`--deltaDir=${layer}`]);
  ok(rM1.code === 0, `delta EXECUTES after resolution (got ${rM1.code})`, rM1);
  const rStale = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=ovtP", "--execute", "--resume"]);
  ok(rStale.code === 2 && rStale.out.includes("OVERTAKEN"), `a stale resume AFTER the layer is REFUSED (got ${rStale.code})`, rStale);
  const rFinal = b4([`--appliedDelta=${layer}`]);
  ok(rFinal.code === 0, `final B4 PASS (got ${rFinal.code})`, rFinal);
}
// ================= r69: REPAIR-CRASH RESUME (Codex r68 A1) =================
console.error("== r69: repair crash-resume ==");
await resetCase();
{
  b1full(); b3exec("rcr0");
  const r4a = b4(); ok(r4a.code === 0, `clean baseline (got ${r4a.code})`, r4a);
  const repFileA = readdirSync(b4runs).filter(f => f.endsWith(".json")).sort().pop();
  await db.collection("users").doc("emA").collection("study_states").doc("zzz-rx").set({ reviewFailCount: 4, reviewLastFailedAt: TS(BASE + 4 * DAY) });
  const r4b = b4(); ok(r4b.code === 5, `extra detected (got ${r4b.code})`, r4b);
  const repFile = readdirSync(b4runs).filter(f => f.endsWith(".json") && f !== repFileA).sort().pop();
  const rc = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=rcrep", "--execute", `--repairExtras=${join(b4runs, repFile)}`], { B3_CRASH_AT: "post-intent" });
  ok(rc.code === 99, `repair run crashes post-intent (got ${rc.code})`, rc);
  const rRes = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=rcrep", "--execute", `--repairExtras=${join(b4runs, repFile)}`, "--resume"]);
  ok(rRes.code === 0, `the crashed REPAIR resumes cleanly — its own intent never bricks it (got ${rRes.code})`, rRes);
  const gone = !(await db.collection("users").doc("emA").collection("study_states").doc("zzz-rx").get()).data()?.reviewFailCount;
  ok(gone, "the extra is deleted by the resumed repair");
  const r4c = b4(); ok(r4c.code === 0, `final B4 PASS (got ${r4c.code})`, r4c);
}
// ================= r69: PRE-INTENT OVERTAKE (Codex r68 A2's exact sequence) =================
console.error("== r69: pre-intent overtake fence ==");
await resetCase();
{
  b1full(); b3exec("pioM0");
  const rc = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=pioP", "--execute"], { B3_CRASH_AT: "pre-intent" });
  ok(rc.code === 99, `plain run crashes PRE-intent (durable manifest, no ledger position) (got ${rc.code})`, rc);
  await attNow("pioB", "emB", "review", [["w3", true]], 100);
  const r4 = b4(); const layer = layerDirsOf(r4.stdout)[0];
  ok(!!layer, `layer materialized (b4 ${r4.code})`, r4);
  const r1 = run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${allowPath}`, `--deltaAuth=${join(layer, "delta-auth.json")}`, `--outDir=${layer}`]);
  const rM1 = b3exec("pioM1", [`--deltaDir=${layer}`]);
  ok(r1.code === 0 && rM1.code === 0, `M1 executes (no dangling record blocks it) (got ${r1.code}/${rM1.code})`, rM1);
  const rStale = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=pioP", "--execute", "--resume"]);
  ok(rStale.code === 2 && rStale.out.includes("pre-intent"), `the anchorless stale resume is REFUSED via the manifest snapshot fence (got ${rStale.code})`, rStale);
  const rF = b4([`--appliedDelta=${layer}`]);
  ok(rF.code === 0, `final B4 PASS (got ${rF.code})`, rF);
}
// ================= r69: MIXED-(d) — structural diff COEXISTING with an actionable delta =================
console.error("== r69: mixed structural+delta ==");
await resetCase();
{
  b1full(); b3exec("mixd0");
  await db.collection("users").doc("emA").collection("study_states").doc("w1").set({ reviewFailCount: 55 }, { merge: true }); // structural corruption
  await attNow("mixdB", "emB", "review", [["w3", true]], 100); // AND an actionable delta
  const r4 = b4();
  ok(r4.code === 7, `mixed presents as DIFFS-WITH-ACTIONABLE-DELTA (got ${r4.code})`, r4);
  const d = driver("mixdLap");
  ok(d.code === 5, `the driver processes the delta then STOPS on the surviving structural diff (got ${d.code})`, d);
  await db.collection("users").doc("emA").collection("study_states").doc("w1").update({ reviewFailCount: 0 });
  const chain = existsSync(ledgerPath) ? [...readFileSync(ledgerPath, "utf-8").matchAll(/"deltaDir":"([^"]+)"/g)].map(m => m[1]).filter(Boolean) : [];
  const rF = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(rF.code === 0, `PASS after correction (got ${rF.code})`, rF);
}
// ================= r69: ORPHAN AT THE GATE (crash post-intent → flip → published orphan settlement) =====
console.error("== r69: flip-orphan gate settlement ==");
await resetCase();
{
  b1full(); b3exec("orph0");
  const rc = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=orphP", "--execute"], { B3_CRASH_AT: "post-intent" });
  ok(rc.code === 99, `run crashes post-intent (got ${rc.code})`, rc);
  const FLIPO = Date.now();
  await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: TS(FLIPO) });
  const r = b4([`--postFlip=${FLIPO}`]);
  ok(r.code === 0 && r.out.includes("flip-orphaned"), `the dangling run is a PUBLISHED orphan; the gate reaches a verdict (got ${r.code})`, r);
}

// ================= r68: MIXED-SAME-FIELD (tail event + lost post-flip event ⇒ BLOCKS) =================
console.error("== r68: mixed-same-field quiet-fail ==");
await resetCase();
{
  b1full(); b3exec("mixf0");
  await attNow("mixT", "emB", "review", [["w3", false]], 0); // TAIL fail (post-layer, pre-flip): flip fc 1→2
  const FLIPM = Date.now() + 400;
  await new Promise(r => setTimeout(r, 500));
  await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: TS(FLIPM) });
  await attAbsT("mixL", "emB", Date.now(), "review", [["w3", false]], 0); // POST-flip fail, stamp LOST: cutoff 3
  const r = b4([`--postFlip=${FLIPM}`]);
  ok(r.code === 5, `tail event CANNOT excuse the lost post-flip event on the SAME field (got ${r.code})`, r);
  await db.collection("users").doc("emB").collection("study_states").doc("w3").set(
    { reviewFailCount: 3, reviewLastFailedAt: TS(Date.now()), reviewLastTestedAt: TS(Date.now()) }, { merge: true });
  const r2 = b4([`--postFlip=${FLIPM}`]);
  ok(r2.code === 0, `exact live labels settle it — remaining tail classified, PASS (got ${r2.code})`, r2);
}

// ================= r67: THE SIBLING-PROOF NEGATIVE (Codex r66 A2's exact reproduction) =================
console.error("== r67: sibling-proof as-of-boundary negative ==");
await resetCase();
{
  const rb1 = b1full(); const rb3 = b3exec("sib0");
  ok(rb1.code === 0 && rb3.code === 0, `sibling setup B1/B3 (got ${rb1.code}/${rb3.code})`, rb3);
  ok(rb1.out.includes("adjudicationCensus"), "R2-49 census PUBLISHED in B1's output");
  const FLIP3 = Date.now() - 30e3;
  await db.doc("system_config/review_v2").set({ enabled: true, firstEnabledAt: TS(FLIP3) });
  // post-flip accept of a2/w2 + the writer's score recompute to 100
  const a2ref = db.collection("attempts").doc("a2");
  const a2cur = (await a2ref.get()).data();
  const rows = a2cur.answers.map(r => r.wordId === "w2" ? { ...r, isCorrect: true, challengeStatus: "accepted", challengeReviewedAt: TS(Date.now()) } : r);
  await a2ref.update({ answers: rows, score: 100 });
  // Codex's corruption: w1.lp day1 → day2 (only valid if the day-2 attempt were passing as-of — it is NOT)
  await db.collection("users").doc("emA").collection("study_states").doc("w1").update({ reviewLastProvenAt: TS(BASE + 2 * DAY) });
  const r = b4([`--postFlip=${FLIP3}`]);
  ok(r.code === 5, `sibling-proof corruption BLOCKS (as-of passing holds) (got ${r.code})`, r);
}

// ================= VALID REPAIR [r65p — panel lap-lens: the mode-law resolver swap must EXECUTE] =========
console.error("== VALID repair: chain-resolved, unrelated extra deleted, U byte-equal ==");
await resetCase();
{
  b1full(); b3exec("vrep0");
  await attNow("vrB", "emB", "review", [["w3", true], ["w1", true]], 100); // M1 changes emB
  const d = driver("vrLap"); ok(d.code === 0, `delta lap (M1) converges (got ${d.code})`, d);
  const chain = existsSync(ledgerPath) ? [...readFileSync(ledgerPath, "utf-8").matchAll(/"deltaDir":"([^"]+)"/g)].map(m => m[1]).filter(Boolean) : [];
  const before = (await db.collection("users").doc("emB").collection("study_states").doc("w3").get()).data();
  await db.collection("users").doc("emA").collection("study_states").doc("zzz-extra").set({ reviewFailCount: 9, reviewLastFailedAt: TS(BASE + 9 * DAY) }); // the unrelated extra
  const r4 = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(r4.code === 5, `B4 reports the extra as structural (got ${r4.code})`, r4);
  const repFile = readdirSync(b4runs).filter(f => f.endsWith(".json")).sort().pop();
  const rr = run("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${freshManifest()}`, "--runId=vrepair", "--execute",
    `--repairExtras=${join(b4runs, repFile)}`, ...chain.map(c => `--appliedDelta=${c}`)]);
  ok(rr.code === 0, `VALID repair executes (chain-resolved) (got ${rr.code})`, rr);
  const gone = !(await db.collection("users").doc("emA").collection("study_states").doc("zzz-extra").get()).data()?.reviewFailCount;
  ok(gone, "the extra's owned fields are deleted");
  const after = (await db.collection("users").doc("emB").collection("study_states").doc("w3").get()).data();
  ok(JSON.stringify(before) === JSON.stringify(after), "U (emB/w3, M1-correct) is BYTE-EQUAL after the unrelated repair — no M0 regression");
  const r4b = b4(chain.map(c => `--appliedDelta=${c}`));
  ok(r4b.code === 0, `B4 PASS after repair (got ${r4b.code})`, r4b);
}

console.error(`\n== EMULATOR LAP: ${checks} checks, ${failures} failures ==`);
// r65 A6: SOURCE-BOUND evidence — git head, per-script hashes, tool versions, not only {checks, failures}
const { execSync } = await import("node:child_process");
const sha = f => createHash("sha256").update(readFileSync(join(repoRoot, "scripts", "deepfix2", f))).digest("hex").slice(0, 16);
let gitHead = "unknown"; try { gitHead = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf-8" }).trim(); } catch {}
const evPath = failures
  ? join(repoRoot, "audit", "deepfix", "emulator-lap-root", "RED-lap-result.json") // r67: red runs never overwrite the tracked evidence
  : join(repoRoot, "docs", "plans", "deepfix2", "evidence", "emulator-lap-result.json");
writeFileSync(evPath,
  JSON.stringify({ probe: "b-emulator-lap", version: 2, at: new Date().toISOString(), checks, failures,
    gitHead, node: process.version,
    scriptSha16: Object.fromEntries(["b-baseline.mjs", "b1-replay-lib.mjs", "b1-expected-labels.mjs", "b3-backfill-writer.mjs", "b3-txn-core.mjs", "b4-verify.mjs", "b-delta-cycle.mjs", "b-emulator-lap.mjs"].map(f => [f, sha(f)])),
    isolatedRoot: "audit/deepfix/emulator-lap-root (DEEPFIX_AUDIT_ROOT; shared chain untouched)" }, null, 2));
process.exit(failures ? 1 : 0);
