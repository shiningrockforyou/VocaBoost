#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — gate.mjs: THE PRE-PUBLISH GATE (execution discipline, mechanized)
 * ============================================================================
 * WHY THIS EXISTS: across four review rounds, every discipline rule that stayed
 * ADVISORY decayed (unticked ledgers, stale numbers, unfrozen artifacts), while
 * every rule that FAILED CLOSED held (an edit's assert, a stale mutant anchor,
 * the executor's read-before-deploy refusal). This converts the advisory half
 * into gates.
 *
 * TWO MODES:
 *   node scripts/deepfix2/gate.mjs --plan   BEFORE editing — validates the PLAN
 *   node scripts/deepfix2/gate.mjs          BEFORE publishing — validates the WORK
 *
 * --plan exists because the worst defect this program produced came from a plan
 * that was itself incomplete: a ledger row said "split the write into
 * create/update" and never mentioned delete, so a faithful execution still
 * shipped a false "closed" claim. Validating output could never catch that —
 * only validating the plan can (Anthropic's plan-validate-execute pattern).
 * Exit: 0 clean · 1 a gate failed (do not proceed) · 2 could not evaluate.
 *
 * It checks what a machine can check. It cannot check judgment — that is what
 * the ledger's BYPASS-SET rows and the review panels are for.
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// SCRATCH resolution (2026-08-03): a hardcoded per-session path outlived its
// session once — the ledger lookup silently searched a wiped directory. Env
// override, else the newest live session scratchpad, else /tmp.
const SCRATCH = process.env.DEEPFIX2_SCRATCH
  || (() => { try {
        return execFileSync("bash", ["-lc", "ls -td /tmp/claude-*/-app/*/scratchpad 2>/dev/null | head -1"],
          { encoding: "utf8" }).trim() || "/tmp";
      } catch { return "/tmp"; } })();
const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
const rel = (p) => p.replace(/^\/app\//, "");

const CLOSED_MARK = /CLOSED BY CONVERGENCE|SUPERSEDED|VERIFY PASS COMPLETE/;
/** The ACTIVE ledger: newest by mtime, skipping ones already closed out.
 *  (mtime alone lied once — closing four old ledgers made them the "newest".) */
function activeLedgers() {
  const explicit = process.argv.find((a) => a.endsWith(".md") && existsSync(a));
  if (explicit) return [explicit];
  if (!existsSync(SCRATCH)) return [];
  return readdirSync(SCRATCH)
    .filter((f) => f.includes("fold-ledger"))
    .map((f) => `${SCRATCH}/${f}`)
    .filter((f) => !CLOSED_MARK.test(readFileSync(f, "utf8").slice(0, 400)))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

const PLAN_MODE = process.argv.includes("--plan");
let failed = 0, warned = 0;
const say = (icon, gate, msg) => console.log(`${icon} ${gate.padEnd(9)} ${msg}`);
const fail = (gate, msg) => { failed++; say("✗", gate, msg); };
const warn = (gate, msg) => { warned++; say("!", gate, msg); };
const pass = (gate, msg) => say("✓", gate, msg);

// ── PLAN MODE: validate the ledger BEFORE any edit ───────────────────────────
if (PLAN_MODE) {
  const found = activeLedgers();
  if (!found.length) {
    fail("PLAN", "no fold ledger — copy scripts/deepfix2/FOLD_LEDGER_TEMPLATE.md and fill it BEFORE editing");
  } else {
    const path = found[0];
    const body = readFileSync(path, "utf8");
    const name = path.split("/").pop();

    // Split into row blocks so each row can be judged with its own detail lines.
    const rows = [];
    let cur = null;
    for (const line of body.split("\n")) {
      const m = line.match(/^\[[ x~!]\] ([A-Z]+\d+[a-z]?)\s*(.*)$/);
      if (m) { cur = { id: m[1], text: m[2], detail: [] }; rows.push(cur); }
      else if (cur && /^\s+\S/.test(line)) cur.detail.push(line);
    }
    if (!rows.length) fail("PLAN", `${name}: no ledger rows found`);
    else pass("PLAN", `${name}: ${rows.length} rows`);

    // Only DELTA rows (groups A/B — the ones that actually change a guard) owe a
    // bypass set. Verify rows and doc-repair rows merely mention guards.
    const CLOSER = /(guard|clos|denie?[sd]|immutab|unwritable|erasure|forge|protect|lock)/i;
    const HASBYPASS = /(bypass set|delete-then-recreate|set-merge|set-with-merge)/i;
    const naked = rows.filter((r) => {
      if (!/^[AB]\d/.test(r.id)) return false;
      const blob = [r.text, ...r.detail].join(" ");
      return CLOSER.test(blob) && !HASBYPASS.test(blob);
    });
    if (naked.length) {
      fail("PLAN", `row(s) claim a closure with NO bypass set enumerated: ${naked.map((r) => r.id).join(" ")}` +
        " — list create/update/delete/set-merge/overwrite/delete-then-recreate/batch/transaction and fixture each");
    } else if (rows.length) {
      pass("PLAN", "every closure row enumerates a bypass set");
    }

    // Verify-before-edit rows must exist and point at something checkable.
    const vRows = rows.filter((r) => /^V\d/.test(r.id));
    if (!vRows.length) fail("PLAN", "no GROUP V rows — every 'this is inert / nothing writes this' assumption must be verified in code FIRST");
    else pass("PLAN", `${vRows.length} verify-before-edit row(s)`);

    // Fixture demand: any delta row should name a case/fixture/mutant.
    const deltas = rows.filter((r) => /^[AB]\d/.test(r.id));
    const unfixtured = deltas.filter((r) => !/(fixture|case|mutant|matrix)/i.test([r.text, ...r.detail].join(" ")));
    if (unfixtured.length) warn("PLAN", `delta row(s) name no fixture: ${unfixtured.map((r) => r.id).join(" ")}`);
    else if (deltas.length) pass("PLAN", `${deltas.length} delta row(s) each name a fixture`);

    if (!/## CLOSE/i.test(body)) warn("PLAN", "no CLOSE section — add it so the fold has a definition of done");
  }
  console.log(`\n${failed ? "PLAN REJECTED — fix the plan before editing" : "PLAN ACCEPTED — proceed to edits"}` +
    ` (${failed} failure(s), ${warned} warning(s))`);
  process.exit(failed ? 1 : 0);
}

// ── GATE 1: LEDGER — every row ticked ────────────────────────────────────────
// The failure this prevents: rows silently dying. Three did, unnoticed, until
// David asked whether the ledger was being checked at all.
const ledgers = activeLedgers();
if (!ledgers.length) {
  warn("LEDGER", "no fold ledger found — write one BEFORE editing, not after");
} else {
  const newest = ledgers[0];
  const body = readFileSync(newest, "utf8");
  const open = [...body.matchAll(/^\[ \] (\S+)/gm)].map((m) => m[1]);
  const total = (body.match(/^\[[x !]\] /gm) || []).length + open.length;
  if (open.length) {
    fail("LEDGER", `${open.length}/${total} rows UNTICKED in ${newest.split("/").pop()}: ${open.join(" ")}`);
  } else {
    pass("LEDGER", `${total} rows, all ticked (${newest.split("/").pop()})`);
  }
  if (!/BYPASS SET|bypass set/i.test(body)) {
    warn("LEDGER", "no BYPASS-SET row — any closure claim needs create/update/delete/recreate/batch fixtured");
  }
}

// ── GATE 2: FREEZE — evidence must post-date the last artifact edit ───────────
// The failure this prevents: publishing a sha/score for bytes that no longer
// exist (r3 caught exactly this after I edited mid-panel).
const ART = "/app/audit/deepfix/task3/live_baseline/firestore.merged.rules";
const EVID = "/app/audit/deepfix/task3/live_baseline/rules-mutants-report.json";
if (existsSync(ART) && existsSync(EVID)) {
  const aM = statSync(ART).mtimeMs, eM = statSync(EVID).mtimeMs;
  if (aM > eM) {
    fail("FREEZE", `artifact edited AFTER the last evidence run (${new Date(aM).toISOString()} > ` +
      `${new Date(eM).toISOString()}) — re-run rules-mutants.mjs before publishing`);
  } else {
    pass("FREEZE", "evidence post-dates the last artifact edit");
  }
  const ev = JSON.parse(readFileSync(EVID, "utf8"));
  const actual = sha16(ART);
  if (ev?.canonical?.rulesSha16 !== actual) {
    fail("FREEZE", `evidence certifies rules sha ${ev?.canonical?.rulesSha16} but the file is ${actual}`);
  } else {
    pass("FREEZE", `evidence sha matches the artifact (${actual})`);
  }
  // THE INSTRUMENT, not just the specimen [audit F-gate, 2026-08-03]. This gate
  // checked only the ARTIFACT sha, so when a fold added 18 cases to the matrix
  // the evidence file kept certifying a matrix hash that no longer existed and
  // the gate still printed "every published score matches". A score is only
  // reproducible if the HARNESS that produced it is also the one in the tree.
  const MATRIX = "/app/scripts/deepfix2/rules-matrix.mjs";
  if (existsSync(MATRIX) && ev?.matrixSha16) {
    const mNow = sha16(MATRIX);
    if (ev.matrixSha16 !== mNow) {
      fail("FREEZE", `evidence was produced by matrix ${ev.matrixSha16} but the tree has ${mNow} — ` +
        "re-run rules-mutants.mjs; every score in the receipt is stale");
    } else {
      pass("FREEZE", `evidence matrix matches the tree (${mNow})`);
    }
  }
}

// ── GATE 3: NUMBERS — no hand-typed score may contradict the evidence ────────
// The failure this prevents: stale totals. Published three rounds running —
// once INSIDE the paragraph claiming the previous stale total was fixed.
const RECEIPT = "/app/audit/deepfix/task3/live_baseline/rules-matrix-receipt.json";
if (existsSync(EVID) && existsSync(RECEIPT)) {
  const ev = JSON.parse(readFileSync(EVID, "utf8"));
  const legit = new Set();
  const add = (p, t) => { if (p != null && t != null) legit.add(`${p}/${t}`); };
  add(ev.canonical?.pass, ev.canonical?.total);
  for (const m of ev.mutants || []) add(m.pass, m.total);
  for (const w of ev.wholeFile || []) add(w.pass, w.total);
  // "N/N mutants killed" is a COUNT derived from the evidence, not a test score —
  // legitimate, and it was being reported as a stale number.
  const nm = (ev.mutants || []).length;
  if (nm) { add(nm, nm); add((ev.mutants || []).filter((m) => m.killed).length, nm); }
  const docs = [RECEIPT, "/app/docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md"];
  let bad = [];
  for (const d of docs) {
    if (!existsSync(d)) continue;
    const text = readFileSync(d, "utf8");
    // A score-shaped pair counts only when its context is talking about a
    // score. Excludes file:line refs (`MCQTest.jsx:685/699`) and config
    // triples (`92/60/30`), which are not claims about test results.
    for (const m of text.matchAll(/\b(\d{2,4})\/(\d{2,4})\b/g)) {
      const pair = `${m[1]}/${m[2]}`;
      if (legit.has(pair)) continue;
      const ctx = text.slice(Math.max(0, m.index - 90), m.index + 90);
      const isScoreClaim = /(matrix|mutant|green|cases|scores?\b|passed)/i.test(ctx);
      const isPathRef = /\.(js|jsx|mjs|ts)x?:\d/.test(ctx) || /\/\d{2,4}\//.test(text.slice(m.index, m.index + 12));
      if (isScoreClaim && !isPathRef) bad.push(`${rel(d)}: ${pair}`);
    }
  }
  if (bad.length) {
    fail("NUMBERS", `score(s) not present in the evidence file — re-derive: ${[...new Set(bad)].join(" · ")}`);
  } else {
    pass("NUMBERS", `every published score matches ${rel(EVID)}`);
  }
}

// ── GATE 4: CLAIMS — strong words need an evidence pointer nearby ────────────
// The failure this prevents: "closed / verified / inert / no-op" asserted from
// intent. Heuristic, so it WARNS: it lists claims for me to re-justify.
const CLAIM_WORDS = /\b(fully closed|is closed|now closed|forge-proof|cannot be|impossible|guaranteed|no-op|disarmed|every clause is pinned)\b/gi;
const EVIDENCE_NEAR = /(matrix|mutant|case [A-Z0-9-]|fixture|:\d+|sha16|VERIFIED|verified)/i;
for (const d of [ART, RECEIPT, "/app/docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md"]) {
  if (!existsSync(d)) continue;
  const lines = readFileSync(d, "utf8").split("\n");
  const naked = [];
  lines.forEach((line, i) => {
    if (CLAIM_WORDS.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 3), i + 4).join(" ");
      if (!EVIDENCE_NEAR.test(ctx)) naked.push(`${rel(d)}:${i + 1}`);
    }
    CLAIM_WORDS.lastIndex = 0;
  });
  if (naked.length) warn("CLAIMS", `strong claim with no nearby evidence pointer: ${naked.slice(0, 5).join(" · ")}`);
}
if (!warned) pass("CLAIMS", "no unsupported strong claims found");

// ── GATE 3b: EVIDENCE — every receipt must bind the tree AND report success ──
// The failure this prevents (independent audit, 2026-08-04): gates 2 and 3 hardcode
// the RULES artifact paths, so they never looked at docs/plans/deepfix2/evidence/*.
// A fold shipped with a published "117/0" whose own evidence file said
// `pass:false, failed:1` and carried a MUTANT's source sha — because the mutant
// driver runs the fixture last and the fixture writes its receipt unconditionally,
// so whichever ran last won. The claim happened to be true; the artifact did not
// support it, and a green NUMBERS on that fold was a pass about a DIFFERENT fold's
// numbers. Two checks, both cheap: a receipt must say it passed, and its recorded
// source hashes must be the bytes now in the tree.
try {
  const EVID_DIR = "/app/docs/plans/deepfix2/evidence";
  if (existsSync(EVID_DIR)) {
    const bad = [];
    for (const f of readdirSync(EVID_DIR).filter((x) => x.endsWith(".json"))) {
      const full = `${EVID_DIR}/${f}`;
      let d; try { d = JSON.parse(readFileSync(full, "utf8")); } catch { bad.push(`${f}: unparseable`); continue; }
      if (d.pass === false || (typeof d.failed === "number" && d.failed > 0)) {
        bad.push(`${f}: reports FAILURE (pass=${d.pass}, failed=${d.failed})`);
      }
      for (const [src, rec] of Object.entries(d.sourceShas ?? {})) {
        const cand = [`/app/${src}`, `/app/scripts/deepfix2/${src}`,
          `/app/functions/reviewV2/${src}`, `/app/functions/${src}`, `/app/src/services/${src}`]
          .find((c) => existsSync(c));
        if (!cand) continue;                       // path moved; not this gate's business
        if (sha16(cand) !== rec) bad.push(`${f}: certifies ${src} @ ${rec} but the tree is ${sha16(cand)}`);
      }
    }
    if (bad.length) fail("EVIDENCE", `receipt(s) do not support their claim — re-run the producer: ${bad.slice(0, 4).join(" · ")}`);
    else pass("EVIDENCE", "every fold receipt reports success and binds the current tree");
  }
} catch (e) { warn("EVIDENCE", `could not scan fold evidence (${e.message})`); }

// ── GATE 4b: MUTANT RESIDUE — never commit a deliberately broken guard ───────
// The near-miss this prevents (2026-08-03, during a "save state"): the typed-seam
// mutation suite edits source files IN PLACE and restores them at the end, so
// while it runs the working tree legitimately contains a REVERTED security guard.
// `git status` shows an innocent one-line diff. Staging everything at that moment
// commits the mutant — a silent hole that every test would then be tuned around.
// The suite restores and self-verifies, so this only fires mid-run or after a
// hard kill, which are exactly the two moments a human would not think to check.
try {
  const scan = execFileSync("bash", ["-lc",
    "grep -rln '\\[MUTANT' /app/functions /app/src 2>/dev/null | head -20"], { encoding: "utf8" }).trim();
  if (scan) {
    fail("MUTANT", `source file(s) still carry a MUTANT marker — a mutation run is in flight or died ` +
      `mid-run. DO NOT COMMIT; let it restore, or restore from its backup dir: ${scan.split("\n").join(" ")}`);
  } else {
    pass("MUTANT", "no mutant residue in functions/ or src/");
  }
} catch { warn("MUTANT", "could not scan for mutant residue"); }

// ── GATE 5: BATON — never touch git while an executor holds the turn ──────────
// The failure this prevents: index-lock collisions and racing an executor's push.
try {
  const win = JSON.parse(readFileSync("/app/docs/plans/loop/win/baton.json", "utf8"));
  const codex = JSON.parse(readFileSync("/app/docs/plans/loop/baton.json", "utf8"));
  const held = [];
  if (win.turnOwner !== "claude") held.push(`win(${win.turnOwner}, rev ${win.revision})`);
  if (codex.turnOwner !== "claude") held.push(`codex(${codex.turnOwner}, rev ${codex.revision})`);
  if (held.length) warn("BATON", `an executor holds the turn: ${held.join(" ")} — NO git commands, and do not edit its review target`);
  else pass("BATON", "both batons idle with claude — git is safe");
} catch { warn("BATON", "could not read a baton file"); }

// ── GATE 6: WATCHER — one must be alive ──────────────────────────────────────
// The failure this prevents: a returned baton sitting unnoticed.
try {
  const out = execFileSync("bash", ["-lc", "pgrep -af baton-watcher | grep -v defunct | wc -l"], { encoding: "utf8" }).trim();
  if (Number(out) > 0) pass("WATCHER", `${out} watcher process(es) alive`);
  else fail("WATCHER", "NO watcher running — run: bash scripts/deepfix2/session-start.sh (relaunches scripts/deepfix2/baton-watcher.sh)");
} catch { warn("WATCHER", "could not check watcher processes"); }

// ── GATE 7: LOG — a code/deploy change needs a dated row today ────────────────
try {
  const log = readFileSync("/app/change_action_log.md", "utf8");
  const today = new Date(statSync("/app/change_action_log.md").mtimeMs).toISOString().slice(0, 10);
  if (log.includes(`| ${today} |`)) pass("LOG", `change_action_log has a ${today} row`);
  else warn("LOG", `no row dated ${today} — log the change before publishing`);
} catch { warn("LOG", "could not read change_action_log.md"); }

console.log(`\n${failed ? "GATE FAILED" : warned ? "GATE PASSED WITH WARNINGS" : "GATE CLEAN"} — ` +
  `${failed} failure(s), ${warned} warning(s)`);
process.exit(failed ? 1 : 0);
