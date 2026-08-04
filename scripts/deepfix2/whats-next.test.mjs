#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — whats-next.test.mjs: proves the [>]/[~] queue-marker fix
 * ============================================================================
 * Covers (brief: save-state-marker-BRIEF.md Task 1):
 *   1. a [>] item is reported IN FLIGHT, never READY, never BLOCKED
 *   2. an after:<claimed-id> row reads "waiting ... (in flight)", never
 *      "unknown dependency"
 *   3. a [~] item is reported CARDED, never READY, never BLOCKED, and
 *      after:<carded-id> reads "waiting ... (carded)", never "unknown"
 *   4. a plain [ ] item with a resolved blocker still reads READY (unchanged)
 *   5. exit-10 (the "start something" signal) fires ONLY when a [ ] item is
 *      genuinely ready — never merely because something is in flight/carded
 *   6. PARITY: for [ ]/[x]-only content, the widened parser matches
 *      byte-identical fields to the original `[ x]`-only regex (the brief's
 *      hard constraint: "if widening the regex would change behavior for
 *      existing [ ]/[x] rows, STOP and report")
 *   7. the REAL docs/plans/deepfix2/WORK_QUEUE.md still parses with the same
 *      [ ]/[x] row set before and after the widen (no live row lost) — this
 *      is the before/after row-count proof the brief asks for directly
 *
 * Usage: node scripts/deepfix2/whats-next.test.mjs
 * Exit: 0 all assertions passed · 1 at least one failed.
 */

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { parseQueue, resolveBlocker, classify, exitCodeFor } from "./whats-next.mjs";

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
  }
}

const noHeld = () => null; // no baton ever blocks, for these fixtures
const noCodexBaton = null;

// ---------------------------------------------------------------------------
// Fixture A — one row of every state, and every after: target shape.
// ---------------------------------------------------------------------------
const FIXTURE_A = `
# synthetic queue for whats-next.test.mjs
Format (one per line, parsed):  \`- [ ] <id> | <what> | blocker: <token>\`

- [x] dep-done | Finished dependency | blocker: none
- [ ] dep-unstarted | Not started, no blocker | blocker: none
- [>] dep-claimed | Claimed dependency | blocker: none
- [~] dep-carded | Carded dependency | blocker: none
- [ ] ready-plain | Nothing blocking | blocker: none
- [ ] waits-on-done | Depends on a done item | blocker: after:dep-done
- [ ] waits-on-unstarted | Depends on an unstarted item | blocker: after:dep-unstarted
- [ ] waits-on-claimed | Depends on a claimed item | blocker: after:dep-claimed
- [ ] waits-on-carded | Depends on a carded item | blocker: after:dep-carded
- [ ] waits-on-unknown | Depends on a nonexistent id | blocker: after:ghost-id
- [ ] david-item | Needs a human decision | blocker: david:some-choice
- [x] already-done | A second done row | blocker: none
- [>] claimed-with-blocker | Claimed; its own blocker must be ignored | blocker: david:whatever
- [~] carded-with-after | Carded; its own blocker must be ignored | blocker: after:dep-unstarted
`;

const itemsA = parseQueue(FIXTURE_A);
const { ready: readyA, blocked: blockedA, inFlight: inFlightA, carded: cardedA } =
  classify(itemsA, noHeld, noCodexBaton);
const byIdA = Object.fromEntries(
  [...readyA, ...blockedA, ...inFlightA, ...cardedA].map((i) => [i.id, i])
);

console.log("=== Fixture A: one row of every state/dependency shape ===");

test("parseQueue captures all 14 rows, including [>] and [~] (previously silently dropped)", () => {
  assert.equal(itemsA.length, 14);
});

test("[>] item is classified IN FLIGHT, never READY, never BLOCKED", () => {
  assert.ok(inFlightA.some((i) => i.id === "dep-claimed"));
  assert.ok(!readyA.some((i) => i.id === "dep-claimed"));
  assert.ok(!blockedA.some((i) => i.id === "dep-claimed"));
});

test("[>] item is IN FLIGHT regardless of its own blocker token", () => {
  assert.ok(inFlightA.some((i) => i.id === "claimed-with-blocker"));
});

test("[~] item is classified CARDED, never READY, never BLOCKED", () => {
  assert.ok(cardedA.some((i) => i.id === "dep-carded"));
  assert.ok(!readyA.some((i) => i.id === "dep-carded"));
  assert.ok(!blockedA.some((i) => i.id === "dep-carded"));
});

test("[~] item is CARDED regardless of its own blocker token", () => {
  assert.ok(cardedA.some((i) => i.id === "carded-with-after"));
});

test('after:<claimed-id> reads "waiting on ... (in flight)", never "unknown"', () => {
  const row = byIdA["waits-on-claimed"];
  assert.equal(row.why, "waiting on dep-claimed (in flight)");
  assert.ok(!/unknown/i.test(row.why));
});

test('after:<carded-id> reads "waiting on ... (carded)", never "unknown"', () => {
  const row = byIdA["waits-on-carded"];
  assert.equal(row.why, "waiting on dep-carded (carded)");
  assert.ok(!/unknown/i.test(row.why));
});

test('after:<unstarted-id> is unchanged: "waiting on <id>" with no suffix', () => {
  const row = byIdA["waits-on-unstarted"];
  assert.equal(row.why, "waiting on dep-unstarted");
});

test("after:<done-id> still resolves to READY (dependency satisfied, unchanged)", () => {
  assert.ok(readyA.some((i) => i.id === "waits-on-done"));
});

test('after:<unknown-id> still reads "unknown dependency <id>" (unchanged)', () => {
  const row = byIdA["waits-on-unknown"];
  assert.equal(row.why, "unknown dependency ghost-id");
});

test("a plain unblocked [ ] item still reads READY", () => {
  assert.ok(readyA.some((i) => i.id === "ready-plain"));
  assert.ok(readyA.some((i) => i.id === "dep-unstarted"));
});

test("david:<what> is unchanged", () => {
  const row = byIdA["david-item"];
  assert.equal(row.why, "David's decision (some-choice)");
});

test("[x] rows never appear in ready/blocked/inFlight/carded (unchanged)", () => {
  const allIds = [...readyA, ...blockedA, ...inFlightA, ...cardedA].map((i) => i.id);
  assert.ok(!allIds.includes("dep-done"));
  assert.ok(!allIds.includes("already-done"));
});

test("exit-10 fires when a [ ] item is genuinely ready", () => {
  assert.equal(exitCodeFor(readyA), 10);
});

test("classify() buckets partition the open items exactly once (fixture A)", () => {
  const doneCount = itemsA.filter((i) => i.done).length;
  const openCount = itemsA.length - doneCount;
  assert.equal(readyA.length + blockedA.length + inFlightA.length + cardedA.length, openCount);
});

// ---------------------------------------------------------------------------
// Fixture B — ONLY in-flight/carded work exists; no [ ] item is ready.
// Proves [>]/[~] never make the turn read "start something" even though the
// queue is visibly not idle (this is the exact bug: a second session must
// not see a green light just because nothing UNSTARTED is blocked).
// ---------------------------------------------------------------------------
console.log("\n=== Fixture B: only in-flight/carded work, no [ ] item ===");

const FIXTURE_B = `
- [>] only-claimed | Being worked, nothing else pending | blocker: none
- [~] only-carded | Parked, nothing else pending | blocker: none
`;
const itemsB = parseQueue(FIXTURE_B);
const { ready: readyB, blocked: blockedB, inFlight: inFlightB, carded: cardedB } =
  classify(itemsB, noHeld, noCodexBaton);

test("exit-10 does NOT fire when only [>]/[~] items are open (no [ ] ready)", () => {
  assert.equal(readyB.length, 0);
  assert.equal(blockedB.length, 0);
  assert.equal(inFlightB.length, 1);
  assert.equal(cardedB.length, 1);
  assert.equal(exitCodeFor(readyB), 0);
});

// ---------------------------------------------------------------------------
// PARITY — for [ ]/[x]-only content, the widened parser must produce
// byte-identical fields to the ORIGINAL `[ x]`-only regex. Hard constraint
// from the brief: "if widening the regex would change behavior for existing
// [ ]/[x] rows, STOP and report — parity is required."
// ---------------------------------------------------------------------------
console.log("\n=== PARITY: original [ x]-only regex vs. widened parseQueue ===");

const ORIGINAL_REGEX = /^- \[([ x])\] (\S+) \| (.+?) \| blocker: (\S+)$/;
function parseWithOriginalRegex(text) {
  const items = [];
  for (const line of text.split("\n")) {
    const m = line.match(ORIGINAL_REGEX);
    if (m) items.push({ done: m[1] === "x", id: m[2], what: m[3], blocker: m[4] });
  }
  return items;
}

test("PARITY (synthetic): restricted to [ ]/[x] rows, old regex and new parser agree exactly", () => {
  const onlyPlainRows = FIXTURE_A.split("\n")
    .filter((l) => /^- \[[ x]\]/.test(l))
    .join("\n");
  const oldItems = parseWithOriginalRegex(onlyPlainRows);
  const newItems = parseQueue(onlyPlainRows);
  assert.deepEqual(
    newItems.map((i) => i.id).sort(),
    oldItems.map((i) => i.id).sort()
  );
  const newById = Object.fromEntries(newItems.map((i) => [i.id, i]));
  for (const oldItem of oldItems) {
    const ni = newById[oldItem.id];
    assert.equal(ni.done, oldItem.done, `done mismatch for ${oldItem.id}`);
    assert.equal(ni.what, oldItem.what, `what mismatch for ${oldItem.id}`);
    assert.equal(ni.blocker, oldItem.blocker, `blocker mismatch for ${oldItem.id}`);
  }
});

// ---------------------------------------------------------------------------
// REAL FILE — docs/plans/deepfix2/WORK_QUEUE.md must parse with the SAME
// [ ]/[x] row set before and after the widen. This is the artifact the brief
// asks to prove directly (before/after row-count), not just a synthetic
// stand-in.
// ---------------------------------------------------------------------------
console.log("\n=== REAL docs/plans/deepfix2/WORK_QUEUE.md ===");

const QUEUE_PATH = "/app/docs/plans/deepfix2/WORK_QUEUE.md";
const realText = readFileSync(QUEUE_PATH, "utf8");
const realLines = realText.split("\n");
// Any single-char state marker — the widest possible candidate-row count,
// used only to size the "still unparsed" diagnostic below.
const ANY_STATE_BULLET = /^- \[.\]/;
// Duplicated literally for the diagnostic only (which lines are STILL
// unparsed after the widen) — no assertion below depends on this copy;
// every assertion uses the real, imported parseQueue.
const NEW_REGEX_FOR_DIAGNOSTIC_ONLY = /^- \[([ x>~])\] (\S+) \| (.+?) \| blocker: (\S+)$/;

const allBulletLines = realLines.filter((l) => ANY_STATE_BULLET.test(l));
const oldItemsReal = parseWithOriginalRegex(realText);
const newItemsReal = parseQueue(realText);

test("REAL WORK_QUEUE.md: every id the OLD regex found is still found (no row lost)", () => {
  const oldIds = oldItemsReal.map((i) => i.id);
  const newIds = new Set(newItemsReal.map((i) => i.id));
  const lost = oldIds.filter((id) => !newIds.has(id));
  assert.deepEqual(lost, []);
});

test("REAL WORK_QUEUE.md: every OLD-matched row's parsed fields are IDENTICAL under the new parser", () => {
  const newById = Object.fromEntries(newItemsReal.map((i) => [i.id, i]));
  for (const oldItem of oldItemsReal) {
    const ni = newById[oldItem.id];
    assert.ok(ni, `id ${oldItem.id} missing from new parse`);
    assert.equal(ni.done, oldItem.done, `done mismatch for ${oldItem.id}`);
    assert.equal(ni.what, oldItem.what, `what mismatch for ${oldItem.id}`);
    assert.equal(ni.blocker, oldItem.blocker, `blocker mismatch for ${oldItem.id}`);
  }
});

test("REAL WORK_QUEUE.md: NEW parser matches at least as many rows as the OLD regex", () => {
  assert.ok(newItemsReal.length >= oldItemsReal.length);
});

test("REAL WORK_QUEUE.md: classify() buckets partition the open items exactly once", () => {
  const { ready, blocked, inFlight, carded } = classify(newItemsReal, () => null, null);
  const doneCount = newItemsReal.filter((i) => i.done).length;
  const openCount = newItemsReal.length - doneCount;
  assert.equal(ready.length + blocked.length + inFlight.length + carded.length, openCount);
});

console.log("\n--- REAL WORK_QUEUE.md parse counts (derived, not hand-typed) ---");
console.log(`  total bullet-marker lines (any single-char state): ${allBulletLines.length}`);
console.log(`  BEFORE — matched by the ORIGINAL [ x]-only regex:  ${oldItemsReal.length}`);
console.log(`  AFTER  — matched by the NEW [ x>~] parseQueue:     ${newItemsReal.length}`);
const stillUnparsedReal = allBulletLines.filter((l) => !NEW_REGEX_FOR_DIAGNOSTIC_ONLY.test(l));
if (stillUnparsedReal.length) {
  console.log(
    `  still unparsed after the widen (${stillUnparsedReal.length}) — pre-existing row-SHAPE defect ` +
      `unrelated to the state-char fix (id field isn't a single token before the first " | "); fixing ` +
      `WORK_QUEUE.md content is outside this task's scope (only its :6 format line was authorized):`
  );
  stillUnparsedReal.forEach((l) => console.log(`    ${JSON.stringify(l.slice(0, 100))}`));
} else {
  console.log("  0 still unparsed.");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
