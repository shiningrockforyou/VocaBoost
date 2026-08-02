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
// Exits: 0 PASS · 5 structural DIFFS · 4 B3 write failures · 3 B3 skipped students (reset/epoch — rerun
//        with --resume when quiet) · 7 cycles exhausted · 2 binding/config failure.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KNOWN = new Set(["allow", "manifest", "prefix", "maxCycles", "appliedDelta"]);
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

const applied = [...args.appliedDelta];
for (let cycle = 1; cycle <= MAX; cycle++) {
  console.error(`=== cycle ${cycle}: B4 verify ===`);
  const b4 = run("b4-verify.mjs", [`--classAllowlist=${args.allow}`, `--manifest=${args.manifest}`,
    ...applied.map(d => `--appliedDelta=${d}`)]);
  if (b4.code === 0) { console.error(`=== FINAL PASS (cycle ${cycle}) ===`); process.exit(0); }
  if (b4.code !== 6 && b4.code !== 7) { console.error(`=== B4 exit ${b4.code} (not actionable) — stopping ===`); process.exit(b4.code); }
  const mm = b4.stdout.match(/^MATERIALIZED_DELTA_DIR=(.+)$/m);
  const layer = mm ? mm[1].trim().replace(/[\\/]+$/, "") : null;
  if (!layer || !existsSync(join(layer, "delta-auth.json"))) {
    console.error(`FATAL: B4 exited ${b4.code} but printed no usable MATERIALIZED_DELTA_DIR`); process.exit(2);
  }
  console.error(`=== cycle ${cycle}: B1 --deltaAuth over ${layer} ===`);
  const b1 = run("b1-expected-labels.mjs", ["--full", `--classAllowlist=${args.allow}`,
    `--deltaAuth=${join(layer, "delta-auth.json")}`, `--outDir=${layer}`]);
  if (b1.code !== 0) { console.error(`=== B1 exit ${b1.code} — stopping ===`); process.exit(b1.code || 2); }
  console.error(`=== cycle ${cycle}: B3 EXECUTE --deltaDir=${layer} ===`);
  const b3 = run("b3-backfill-writer.mjs", [`--classAllowlist=${args.allow}`, `--manifest=${args.manifest}`,
    `--runId=${args.prefix}-c${cycle}`, `--deltaDir=${layer}`, "--execute"]);
  if (b3.code === 4) { console.error("=== B3 write failures — stopping (exit 4) ==="); process.exit(4); }
  if (b3.code === 5) { console.error("=== B3 skipped students (reset-locked/epoch-drift) — stopping (exit 3); rerun with --resume when quiet ==="); process.exit(3); }
  if (b3.code !== 0) { console.error(`=== B3 exit ${b3.code} — stopping ===`); process.exit(b3.code || 2); }
  applied.push(layer);
}
console.error(`=== cycles exhausted (${MAX}) without PASS — still converging or churn-bound ===`);
process.exit(7);
