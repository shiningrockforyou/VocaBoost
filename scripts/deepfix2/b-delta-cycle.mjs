// b-delta-cycle.mjs — THE ONE ATOMIC DELTA CYCLE, cross-platform [r63 A1 — replaces b-delta-cycle.sh:
// the bash driver resolved to WSL under Windows PowerShell, hard-coded /app/node_modules, force-parsed
// argv[4] as MAX, and stopped on the actionable DIFFS+delta outcome].
//
// One convergence lap (14_ §4): B4 verify → on ACTIONABLE outcome (exit 6 zero-diff+delta, or exit 7
// diffs+materialized-delta [roster-added / in-place-adjudication students NORMALLY present as diffs]) →
// B1 --deltaAuth → B3 --deltaDir --execute → repeat with --appliedDelta. Machine-checked continue
// condition: the exact MATERIALIZED_DELTA_DIR line B4 printed, and its delta-auth.json must exist.
// Exit 5 (diffs with NO delta = structural) stops. PASS stops at 0.
//
// Usage: node scripts/deepfix2/b-delta-cycle.mjs --allow=FILE --manifest=FILE --prefix=RUNID
//        [--maxCycles=3] [--appliedDelta=DIR]...
// Exits [r64 — disjoint namespace]: 0 PASS · 5 structural DIFFS · 4 B3 write failures · 3 B3 skipped
//        students (recovery: `b3 --resume --runId=<the printed runId> --deltaDir=<the printed layer>
//        --classAllowlist --manifest --execute`, then re-invoke THIS driver with a FRESH --prefix passing
//        every printed applied layer) · 8 = A8 cross-list wordId collision (STRUCTURAL DATA HAZARD — stop
//        and investigate; never rerun blindly) · 9 cycles exhausted (re-invoke: fresh --prefix + the
//        printed applied chain) · 2 binding/config failure.
// runId collision law [r64]: every invocation stamps a nonce into its runIds — B3's runIds stay
// single-use without manual prefix bookkeeping.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

// [r70 C6] --receipt=PATH: on FINAL PASS, write THE micro-lap receipt — the
// ONE schema the flip script validates (kind/stages/checks/failures/project/
// runId/contentTimestamp/sourceShas). The flip rehearsal consumes a REAL
// receipt from a REAL chain run; success JSON is never synthesized.
const KNOWN = new Set(["allow", "manifest", "prefix", "maxCycles", "appliedDelta", "receipt"]);
const args = { appliedDelta: [] };
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (!m || !KNOWN.has(m[1])) { console.error(`Unrecognized arg: ${a}`); process.exit(2); }
  if (m[1] === "appliedDelta") args.appliedDelta.push(m[2]); else args[m[1]] = m[2];
}
for (const k of ["allow", "manifest", "prefix"]) if (!args[k]) { console.error(`--${k}=VALUE required`); process.exit(2); }
const MAX = args.maxCycles ? parseInt(args.maxCycles, 10) : 3;
if (!Number.isInteger(MAX) || MAX < 1 || MAX > 20) { console.error("--maxCycles must be 1-20"); process.exit(2); }

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = { ...process.env, NODE_PATH: join(repoRoot, "node_modules") };
const run = (script, extra) => {
  const r = spawnSync(process.execPath, [join(repoRoot, "scripts", "deepfix2", script), ...extra],
    { cwd: repoRoot, env, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  process.stderr.write(r.stderr ?? "");
  process.stdout.write(r.stdout ?? "");
  if (r.error) { console.error(`FATAL: ${script} spawn failed: ${r.error.message}`); process.exit(2); }
  return { code: r.status ?? 2, stdout: r.stdout ?? "" };
};

const NONCE = Date.now().toString(36);
const applied = [...args.appliedDelta];
const printChain = () => { if (applied.length) console.error(`APPLIED CHAIN (pass each on re-invocation): ${applied.map(d => `--appliedDelta=${d}`).join(" ")}`); };
const stagesRun = [];
const writeReceipt = (b4stdout, cycle) => {
  if (!args.receipt) return;
  const sm = b4stdout.match(/"students":\s*(\d+)/);
  const checks = sm ? parseInt(sm[1], 10) : 0;
  const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
  const HERE = dirname(fileURLToPath(import.meta.url));
  const sourceShas = {};
  for (const f of ["b1-expected-labels.mjs", "b1-replay-lib.mjs", "b3-backfill-writer.mjs",
    "b3-txn-core.mjs", "b4-verify.mjs", "b-baseline.mjs", "b-delta-cycle.mjs"]) {
    sourceShas[f] = createHash("sha256").update(readFileSync(join(HERE, f))).digest("hex").slice(0, 16);
  }
  writeFileSync(args.receipt, JSON.stringify({
    kind: "trackB-micro-lap",
    version: 1,
    stages: stagesRun.slice(),
    cycles: cycle,
    checks,
    failures: 0, // exit-0 PASS by construction
    projectId: key.project_id,
    runId: `${args.prefix}-${NONCE}`,
    contentTimestamp: new Date().toISOString(),
    sourceShas,
  }, null, 2));
  console.error(`=== receipt written: ${args.receipt} ===`);
};
for (let cycle = 1; cycle <= MAX; cycle++) {
  console.error(`=== cycle ${cycle}: B4 verify ===`);
  stagesRun.push("B4");
  const b4 = run("b4-verify.mjs", [`--classAllowlist=${args.allow}`, `--manifest=${args.manifest}`,
    ...applied.map(d => `--appliedDelta=${d}`)]);
  if (b4.code === 0) { writeReceipt(b4.stdout, cycle); console.error(`=== FINAL PASS (cycle ${cycle}) ===`); process.exit(0); }
  if (b4.code !== 6 && b4.code !== 7) { printChain(); console.error(`=== B4 exit ${b4.code} (not actionable${b4.code === 8 ? " — A8 STRUCTURAL DATA HAZARD, investigate before ANY rerun" : ""}) — stopping ===`); process.exit(b4.code); }
  const mm = b4.stdout.match(/^MATERIALIZED_DELTA_DIR=(.+)$/m);
  const layer = mm ? mm[1].trim().replace(/[\\/]+$/, "") : null;
  if (!layer || !existsSync(join(layer, "delta-auth.json"))) {
    console.error(`FATAL: B4 exited ${b4.code} but printed no usable MATERIALIZED_DELTA_DIR`); process.exit(2);
  }
  console.error(`=== cycle ${cycle}: B1 --deltaAuth over ${layer} ===`);
  stagesRun.push("B1");
  const b1 = run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${args.allow}`,
    `--deltaAuth=${join(layer, "delta-auth.json")}`, `--outDir=${layer}`]);
  if (b1.code !== 0) { console.error(`=== B1 exit ${b1.code} — stopping ===`); process.exit(b1.code || 2); }
  console.error(`=== cycle ${cycle}: B3 EXECUTE --deltaDir=${layer} ===`);
  stagesRun.push("B3");
  const b3 = run("b3-backfill-writer.mjs", [`--classAllowlist=${args.allow}`, `--manifest=${args.manifest}`,
    `--runId=${args.prefix}-${NONCE}-c${cycle}`, `--deltaDir=${layer}`, "--execute"]);
  if (b3.code === 4) { printChain(); console.error(`=== B3 write failures — stopping (exit 4); recovery: b3 --resume --runId=${args.prefix}-${NONCE}-c${cycle} --deltaDir=${layer} ... then fresh-prefix driver with the chain above + this layer ===`); process.exit(4); }
  if (b3.code === 5) { printChain(); console.error(`=== B3 skipped students (reset-locked/epoch-drift) — stopping (exit 3); recovery: b3 --resume --runId=${args.prefix}-${NONCE}-c${cycle} --deltaDir=${layer} ... when quiet, then fresh-prefix driver with the chain above + this layer ===`); process.exit(3); }
  if (b3.code !== 0) { printChain(); console.error(`=== B3 exit ${b3.code} — stopping ===`); process.exit(b3.code || 2); }
  applied.push(layer);
}
printChain();
console.error(`=== cycles exhausted (${MAX}) without PASS — still converging or churn-bound; re-invoke with a fresh --prefix + the printed chain ===`);
process.exit(9); // r64: distinct from B4's exit 7 (actionable-delta)
