#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — whats-next.mjs: "is anything runnable right now?" as a LOOKUP
 * ============================================================================
 * WHY: I kept writing "nothing else is blocked" and then ending the turn
 * anyway. Knowing what is runnable was a judgement each time, so it decayed —
 * the same way every advisory rule in this program decayed. This makes it a
 * query with an answer.
 *
 * Reads docs/plans/deepfix2/WORK_QUEUE.md, resolves each blocker against the
 * live baton state, and prints what can start NOW.
 *
 * Usage: node scripts/deepfix2/whats-next.mjs
 * Exit: 0 nothing runnable (genuinely blocked or all done) · 10 work IS runnable.
 *       Exit 10 means: do not end the turn — start the top item.
 *
 * Row states (2026-08-04 — `[ ]`/`[x]` unchanged; `[>]`/`[~]` added): a row
 * used to be dropped SILENTLY unless it was `[ ]` or `[x]` — a `[>]` (claimed)
 * row vanished from the parse entirely, so a second session saw no reason not
 * to re-start it, and any `after:<that-id>` row read "unknown dependency"
 * instead of "waiting". Both bugs from the same missing states:
 *   [ ] unstarted — eligible to be READY once its blocker resolves
 *   [x] done      — neither ready nor blocked; a valid `after:` target (done)
 *   [>] IN FLIGHT — claimed/being worked; NEVER ready; a valid `after:`
 *                   target ("waiting on <id> (in flight)")
 *   [~] CARDED    — parked/designed, not started; NEVER ready; a valid
 *                   `after:` target ("waiting on <id> (carded)")
 * The exit-10 "start something" signal is fed ONLY by `[ ]` items whose
 * blocker resolves — `[>]`/`[~]` can never make exit-10 fire.
 *
 * Parsing/resolution are exported (parseQueue/resolveBlocker/classify) so
 * whats-next.test.mjs can exercise them on a synthetic queue string without
 * triggering this file's side effects (real file reads, process.exit) —
 * those live only in main(), which runs only when this file is executed
 * directly, not when it's imported.
 */

import { readFileSync, existsSync } from "node:fs";

const QUEUE = "/app/docs/plans/deepfix2/WORK_QUEUE.md";

// One row: `- [STATE] id | what | blocker: token`. STATE was `[ x]` only;
// widened to `[ x>~]` so `[>]`/`[~]` rows are captured instead of silently
// dropped. Captures the raw state char (not just done/not-done) so callers
// can tell claimed/carded apart from plain-unstarted; `done` is kept as
// before (`state === "x"`) so nothing downstream has to change its check.
export function parseQueue(text) {
  const items = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^- \[([ x>~])\] (\S+) \| (.+?) \| blocker: (\S+)$/);
    if (m) items.push({ state: m[1], done: m[1] === "x", id: m[2], what: m[3], blocker: m[4] });
  }
  return items;
}

// What an `after:<id>` blocker resolves to, given the dependency item.
// Unchanged for `x` (satisfied) and ` ` (still waiting) deps; `>`/`~` deps
// are now nameable instead of falling through to "unknown dependency" in
// the caller (resolveBlocker never reaches that fallback for a KNOWN dep).
function depStatus(dep) {
  if (dep.state === "x") return null;
  if (dep.state === ">") return `waiting on ${dep.id} (in flight)`;
  if (dep.state === "~") return `waiting on ${dep.id} (carded)`;
  return `waiting on ${dep.id}`;
}

// heldBy(name) -> string|null describing whether a baton blocks; codexBaton
// is the parsed codex baton.json (or null) for the codex:YES check.
export function resolveBlocker(item, byId, heldBy, codexBaton) {
  const b = item.blocker;
  if (b === "none") return null;
  if (b === "codex" || b === "win") return heldBy(b);
  // `codex:YES` — a returned baton is NOT approval. The gate resolved only when
  // the VERDICT is YES; a NO leaves the item blocked no matter who holds the turn.
  // (Without this the queue reported "rules-deploy-order READY" minutes after
  // Codex returned NO — the exact false-green this program keeps producing.)
  if (b === "codex:YES") {
    const d = codexBaton?.codexDecision;
    if (d === "YES") return null;
    return d ? `Codex verdict is ${d} (round ${codexBaton?.round}) — fix and re-gate` : "Codex has not ruled yet";
  }
  if (b.startsWith("david:")) return `David's decision (${b.slice(6)})`;
  if (b.startsWith("after:")) {
    const dep = byId[b.slice(6)];
    if (!dep) return `unknown dependency ${b.slice(6)}`;
    return depStatus(dep);
  }
  return `unrecognized blocker ${b}`;
}

// Splits parsed items into ready / blocked / in-flight / carded.
// `[x]` items are dropped entirely (done — unchanged from before).
// `[>]`/`[~]` items NEVER become ready or blocked, regardless of their own
// blocker token — they get their own buckets and never feed ready.length
// (the exit-10 signal). `[ ]` items are classified exactly as before.
export function classify(items, heldBy, codexBaton) {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const open = items.filter((i) => i.state !== "x");
  const ready = [], blocked = [], inFlight = [], carded = [];
  for (const i of open) {
    if (i.state === ">") { inFlight.push(i); continue; }
    if (i.state === "~") { carded.push(i); continue; }
    const why = resolveBlocker(i, byId, heldBy, codexBaton);
    (why ? blocked : ready).push({ ...i, why });
  }
  return { ready, blocked, inFlight, carded };
}

// The exit-10 "start something" decision rule, exported so a test can assert
// it directly instead of spawning the script. `[>]`/`[~]` items never reach
// `ready` (see classify above), so they can never make this return 10.
export function exitCodeFor(ready) {
  return ready.length ? 10 : 0;
}

function main() {
  const batons = {};
  for (const [name, path] of [["codex", "/app/docs/plans/loop/baton.json"],
                              ["win", "/app/docs/plans/loop/win/baton.json"]]) {
    try { batons[name] = JSON.parse(readFileSync(path, "utf8")); } catch { batons[name] = null; }
  }
  const heldBy = (n) => batons[n] && batons[n].turnOwner !== "claude"
    ? `${n} baton is with ${batons[n].turnOwner} (round ${batons[n].round})` : null;

  const items = parseQueue(readFileSync(QUEUE, "utf8"));
  const { ready, blocked, inFlight, carded } = classify(items, heldBy, batons.codex);

  if (ready.length) {
    console.log(`READY NOW — ${ready.length} item(s). DO NOT END THE TURN; start the top one:\n`);
    ready.forEach((i, n) => console.log(`  ${n + 1}. ${i.id}\n     ${i.what}`));
  } else {
    console.log("NOTHING RUNNABLE — every open item is genuinely blocked.\n");
  }
  if (blocked.length) {
    console.log(`\nBlocked (${blocked.length}):`);
    blocked.forEach((i) => console.log(`  · ${i.id} — ${i.why}`));
  }
  if (inFlight.length) {
    console.log(`\nIN FLIGHT (${inFlight.length}) — claimed; not a re-start target:`);
    inFlight.forEach((i) => console.log(`  · ${i.id} — ${i.what}`));
  }
  if (carded.length) {
    console.log(`\nCARDED (${carded.length}) — parked; not a re-start target:`);
    carded.forEach((i) => console.log(`  · ${i.id} — ${i.what}`));
  }
  process.exit(exitCodeFor(ready));
}

// Run only when executed directly. Importing this module (whats-next.test.mjs
// does) must not read real files or call process.exit.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
