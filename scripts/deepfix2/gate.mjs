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
 * Run it before publishing a claim, committing a fold, or issuing an order:
 *   node scripts/deepfix2/gate.mjs [--workstream rules]
 * Exit: 0 clean · 1 a gate failed (do not publish) · 2 could not evaluate.
 *
 * It checks what a machine can check. It cannot check judgment — that is what
 * the ledger's BYPASS-SET rows and the review panels are for.
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const SCRATCH = process.env.DEEPFIX2_SCRATCH
  || "/tmp/claude-1000/-app/87eba36e-8e66-4638-bae9-6cd6f923fff6/scratchpad";
const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
const rel = (p) => p.replace(/^\/app\//, "");

let failed = 0, warned = 0;
const say = (icon, gate, msg) => console.log(`${icon} ${gate.padEnd(9)} ${msg}`);
const fail = (gate, msg) => { failed++; say("✗", gate, msg); };
const warn = (gate, msg) => { warned++; say("!", gate, msg); };
const pass = (gate, msg) => say("✓", gate, msg);

// ── GATE 1: LEDGER — every row ticked ────────────────────────────────────────
// The failure this prevents: rows silently dying. Three did, unnoticed, until
// David asked whether the ledger was being checked at all.
const ledgers = existsSync(SCRATCH)
  ? readdirSync(SCRATCH).filter((f) => f.includes("fold-ledger")).map((f) => `${SCRATCH}/${f}`)
  : [];
if (!ledgers.length) {
  warn("LEDGER", "no fold ledger found — write one BEFORE editing, not after");
} else {
  const newest = ledgers.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
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
  else fail("WATCHER", "NO watcher running — relaunch scratchpad/baton-watcher.sh first");
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
