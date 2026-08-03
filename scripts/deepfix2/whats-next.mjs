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
 */

import { readFileSync, existsSync } from "node:fs";

const QUEUE = "/app/docs/plans/deepfix2/WORK_QUEUE.md";
const batons = {};
for (const [name, path] of [["codex", "/app/docs/plans/loop/baton.json"],
                            ["win", "/app/docs/plans/loop/win/baton.json"]]) {
  try { batons[name] = JSON.parse(readFileSync(path, "utf8")); } catch { batons[name] = null; }
}
const heldBy = (n) => batons[n] && batons[n].turnOwner !== "claude"
  ? `${n} baton is with ${batons[n].turnOwner} (round ${batons[n].round})` : null;

const items = [];
for (const line of readFileSync(QUEUE, "utf8").split("\n")) {
  const m = line.match(/^- \[([ x])\] (\S+) \| (.+?) \| blocker: (\S+)$/);
  if (m) items.push({ done: m[1] === "x", id: m[2], what: m[3], blocker: m[4] });
}
const byId = Object.fromEntries(items.map((i) => [i.id, i]));

function resolve(item) {
  const b = item.blocker;
  if (b === "none") return null;
  if (b === "codex" || b === "win") return heldBy(b);
  // `codex:YES` — a returned baton is NOT approval. The gate resolved only when
  // the VERDICT is YES; a NO leaves the item blocked no matter who holds the turn.
  // (Without this the queue reported "rules-deploy-order READY" minutes after
  // Codex returned NO — the exact false-green this program keeps producing.)
  if (b === "codex:YES") {
    const d = batons.codex?.codexDecision;
    if (d === "YES") return null;
    return d ? `Codex verdict is ${d} (round ${batons.codex?.round}) — fix and re-gate` : "Codex has not ruled yet";
  }
  if (b.startsWith("david:")) return `David's decision (${b.slice(6)})`;
  if (b.startsWith("after:")) {
    const dep = byId[b.slice(6)];
    if (!dep) return `unknown dependency ${b.slice(6)}`;
    return dep.done ? null : `waiting on ${dep.id}`;
  }
  return `unrecognized blocker ${b}`;
}

const open = items.filter((i) => !i.done);
const ready = [], blocked = [];
for (const i of open) { const r = resolve(i); (r ? blocked : ready).push({ ...i, why: r }); }

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
process.exit(ready.length ? 10 : 0);
