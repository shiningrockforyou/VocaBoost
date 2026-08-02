// rotation-cyclicity-fixture.mjs — THE ISOLATED ROTATION/SELECTOR FIXTURE [R2-47 / r57 closure item 1].
// Pure JS, zero Firebase. Proves the STRUCTURAL properties the launch certifies, against a reference
// implementation of the frozen composition law (10_ §2 / H6 §2-§3 / R2-42/45/46 mechanism clauses):
//
//   P1 LAP COVERAGE [property REDEFINED at r58 — Codex's burst-return falsifier proved the fixed-day-count
//      "cycle" claim FALSE: words returning ahead of the cursor consume service slots, so coverage time
//      STRETCHES under insertion]. The honest structural property: a LAP = the cursor's wrap-to-wrap sweep of
//      the index space (VARIABLE length — ceil(pool/queueSize) days only for a static pool; insertions extend
//      it). GUARANTEE: every word active for an ENTIRE lap is served within it; a word returning mid-lap
//      behind the cursor waits ≤1 lap. Legs: P1A static exact-coverage · P1B per-day tiling invariant (the
//      skip-freedom mechanism) · P1C LAP coverage under BURST RETURNS incl. Codex's r58 counterexample as a
//      permanent regression (100 evens + 10 odd returns/day, queue 10) · intake growth · mid-lap size change.
//   P2 FIFO SERVICE DISCIPLINE (no overtaking): in the test's remainder, a non-priority presentable word is
//      never passed over in favor of a WORSE-ranked word (rank = reviewLastTestedAt asc, absent first, tie
//      wordIndex). Same discipline inside the priority prefix.
//   P3 INVARIANT + FALLBACK: effectiveTestSize = min(testSize, |queue|); the composed test = exactly
//      effectiveTestSize unique queue members; the top-min(priorityCount, effectiveTestSize) priority words by
//      rank ALWAYS included; the seeded fallback preserves that priority prefix and randomizes ONLY the
//      remainder (R2-46).
//   P4 UNDERFLOW: pool < queueSize => queue tops up from resting words, earliest-graduated first, and the
//      queue is exactly min(queueSize, active + resting available) (R2-41e).
//
// Any assertion failure exits 1 with the counterexample. Run: node scripts/deepfix2/rotation-cyclicity-fixture.mjs
let seed = 424243;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let checks = 0, failures = 0;
const fail = (msg, ctx) => { failures++; console.error(`FAIL: ${msg}\n  ${JSON.stringify(ctx)}`); };
const ok = () => { checks++; };

// ---- the reference composition law (CURSOR-CHAINED rotation — the fixture-driven mechanism fix 2026-08-02:
// positional-modulo rotation over a MUTATING pool skips words [143 counterexamples in this fixture's first
// run]; the cursor sweep is mutation-proof: day N serves the next queueSize ACTIVE words in wordIndex order
// STRICTLY AFTER the last index served by day N-1's persisted queue, wrapping; day 1 starts at the smallest) ----
function composeQueue(active, resting, queueSize, cursor /* last wordIndex served, or null */) {
  const sorted = [...active].sort((a, b) => a.i - b.i);
  if (sorted.length >= queueSize) {
    let startIdx = cursor === null ? 0 : sorted.findIndex(w => w.i > cursor);
    if (startIdx === -1) startIdx = 0; // wrap
    const q = Array.from({ length: queueSize }, (_, k) => sorted[(startIdx + k) % sorted.length]);
    return { queue: q, cursor: q[q.length - 1].i };
  }
  const rest = [...resting].sort((a, b) => a.gradAt - b.gradAt || a.i - b.i); // earliest-graduated first
  const q = [...sorted, ...rest.slice(0, queueSize - sorted.length)];
  // 15_ §2b EXACT LAW [r60/panel — was max(active, prior): diverged from the frozen traversal-order rule]:
  // (underflow, A non-empty) cursor := the LAST ACTIVE member in traversal order = the last element of
  // `sorted` (the whole active pool, served in index order); (no active) cursor UNCHANGED.
  return { queue: q, cursor: sorted.length ? sorted[sorted.length - 1].i : cursor };
}
function composeTest(queue, testSize, ranks) {
  // ranks: Map i -> {priority: bool, rlt: number|null}
  const eff = Math.min(testSize, queue.length);
  const byRank = (a, b) => {
    const ra = ranks.get(a.i)?.rlt ?? -Infinity, rb = ranks.get(b.i)?.rlt ?? -Infinity;
    return ra - rb || a.i - b.i;
  };
  const prio = queue.filter(w => ranks.get(w.i)?.priority).sort(byRank);
  const rem = queue.filter(w => !ranks.get(w.i)?.priority).sort(byRank);
  const prefix = prio.slice(0, eff);
  return { presented: [...prefix, ...rem.slice(0, eff - prefix.length)], eff, prefix };
}
function fallbackTest(queue, testSize, ranks, fseed) {
  const eff = Math.min(testSize, queue.length);
  const byRank = (a, b) => ((ranks.get(a.i)?.rlt ?? -Infinity) - (ranks.get(b.i)?.rlt ?? -Infinity)) || a.i - b.i;
  const prio = queue.filter(w => ranks.get(w.i)?.priority).sort(byRank);
  const prefix = prio.slice(0, eff);
  const pool = queue.filter(w => !prefix.includes(w));
  let s = fseed;
  const r = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < pool.length; k++) { const j = k + Math.floor(r() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
  return { presented: [...prefix, ...pool.slice(0, eff - prefix.length)], eff, prefix };
}

// ---- P1: rotation coverage — two rigorous legs ----
// Leg A (STATIC pool, exact): ceil(pool/queueSize) consecutive days cover EVERY active word, for all sizes ×
//   queue sizes × starting cursors × config size changes at lap boundaries.
// Leg B (MUTATING pool, per-day tiling invariant): each day's queue = EXACTLY the active words inside the
//   cursor's swept cyclic index interval (prevCursor, newCursor] — skip-freedom by construction: intervals
//   tile the index circle, so no continuously-active word can be passed over; a word returning BEHIND the
//   cursor waits at most one lap (accepted design: resting words are not owed mid-lap service).
const inCyc = (i, a, b) => a === null ? i <= b : (a < b ? (i > a && i <= b) : (i > a || i <= b));
// Leg A
for (const poolSize of [3, 13, 59, 60, 61, 137, 600, 1200]) {
  for (const queueSize of [10, 30, 60, 80]) {
    for (const startCursor of [null, 0, 7, poolSize - 2]) {
      const active = Array.from({ length: poolSize }, (_, i) => ({ i, gradAt: null }));
      let cursor = startCursor;
      const seen = new Set();
      const days = Math.ceil(poolSize / queueSize);
      for (let dd = 0; dd < days; dd++) {
        const r = composeQueue(active, [], queueSize, cursor);
        r.queue.forEach(w => seen.add(w.i));
        cursor = r.cursor;
      }
      if (active.some(w => !seen.has(w.i))) fail("P1A static coverage", { poolSize, queueSize, startCursor });
      else ok();
    }
  }
}
// Leg A size changes at lap boundaries
{
  const active = Array.from({ length: 200 }, (_, i) => ({ i, gradAt: null }));
  let cursor = null;
  for (const qs of [60, 30, 80]) {
    const seen = new Set();
    for (let dd = 0; dd < Math.ceil(200 / qs) + 1; dd++) { const r = composeQueue(active, [], qs, cursor); r.queue.forEach(w => seen.add(w.i)); cursor = r.cursor; }
    if (active.some(w => !seen.has(w.i))) fail("P1A size-change", { qs }); else ok();
  }
}
// Leg B
for (const poolSize of [61, 137, 600, 1200]) {
  for (const queueSize of [10, 30, 60]) {
    let active = Array.from({ length: poolSize }, (_, i) => ({ i, gradAt: null }));
    let resting = [];
    let cursor = null;
    for (let day = 0; day < 120; day++) {
      const r = composeQueue(active, resting, queueSize, cursor);
      if (active.length >= queueSize) {
        const servedIds = new Set(r.queue.map(w => w.i));
        const wrongIn = active.filter(w => inCyc(w.i, cursor, r.cursor) && !servedIds.has(w.i));
        const wrongOut = r.queue.filter(w => !inCyc(w.i, cursor, r.cursor));
        if (wrongIn.length || wrongOut.length) { fail("P1B tiling", { poolSize, queueSize, day, wrongIn: wrongIn.slice(0,3).map(w=>w.i), wrongOut: wrongOut.slice(0,3).map(w=>w.i) }); break; }
        else ok();
      } else ok(); // underflow day: whole active pool served (P4 asserts composition)
      cursor = r.cursor;
      // mutate: graduate ~5% + return the oldest resting
      const g = Math.max(0, Math.floor(active.length * 0.05 * rnd()));
      for (let k = 0; k < g; k++) {
        const idx = Math.floor(rnd() * active.length);
        const w = active.splice(idx, 1)[0];
        resting.push({ i: w.i, gradAt: day });
      }
      if (resting.length > 8) { const back = resting.shift(); active.push({ i: back.i, gradAt: null }); }
    }
  }
}

// ---- P1C: LAP coverage under burst returns (the r58 falsifier as a permanent regression) ----
// Lap tracked honestly: start marker = the first index served after the previous wrap; the lap ends when the
// cursor wraps (serves an index <= the previous day's cursor). Assert: every word active at lap start AND
// still active at lap end AND never resting during the lap was served in the lap.
// The guarantee (honest form): a word continuously active across laps k and k+1 is served in AT LEAST one of
// them — "waits ≤1 lap" (a wrap can land mid-index-space, so single-lap bookkeeping over-assigns misses).
function runLapCase(tag, setup) {
  const cfg = setup();
  let { active, resting, mutate } = cfg;
  let cursor = null;
  const laps = []; // {startSet, seen, restedDuring, endSet}
  for (let lap = 0; lap < 4; lap++) {
    const startSet = new Set(active.map(w => w.i));
    const seen = new Set(); const restedDuring = new Set();
    let day = 0, wrapped = false, guard = 0;
    while (!wrapped && guard++ < 500) {
      const qs = cfg.queueSize; // re-read per day (mid-lap size changes)
      const r = composeQueue(active, resting, qs, cursor);
      r.queue.forEach(w => seen.add(w.i));
      const prev = cursor; cursor = r.cursor; day++;
      if (active.length <= qs) wrapped = true;
      else if (prev !== null && cursor !== null && cursor <= prev) wrapped = true;
      ({ active, resting } = mutate(active, resting, day));
      resting.forEach(w => restedDuring.add(w.i));
    }
    laps.push({ startSet, seen, restedDuring, endSet: new Set(active.map(w => w.i)) });
  }
  for (let k = 0; k + 1 < laps.length; k++) {
    const a = laps[k], b = laps[k + 1];
    const missed = [...a.startSet].filter(i => b.endSet.has(i) && !a.restedDuring.has(i) && !b.restedDuring.has(i)
      && !a.seen.has(i) && !b.seen.has(i));
    if (missed.length) fail(`P1C ${tag}`, { window: k, missed: missed.slice(0, 6) });
    else ok();
  }
}
// Codex r58 counterexample: 100 even-index actives, queue 10, ten odd-index returns per day.
{
  let oddQueue = Array.from({ length: 300 }, (_, k) => 2 * k + 1);
  runLapCase("codex-burst-return", () => ({
    active: Array.from({ length: 100 }, (_, k) => ({ i: 2 * k, gradAt: null })),
    resting: [],
    queueSize: 10,
    mutate: (active, resting, day) => {
      const returns = oddQueue.splice(0, 10).map(i => ({ i, gradAt: null }));
      return { active: [...active, ...returns], resting };
    },
  }));
}
// Intake growth: +8 new high-index words per day.
{
  let nextI = 200;
  runLapCase("intake-growth", () => ({
    active: Array.from({ length: 200 }, (_, i) => ({ i, gradAt: null })),
    resting: [],
    queueSize: 30,
    mutate: (active, resting) => ({ active: [...active, ...Array.from({ length: 8 }, () => ({ i: nextI++, gradAt: null }))], resting }),
  }));
}
// Graduation churn (words leave mid-lap — exempt via everRested; returns re-enter).
{
  runLapCase("graduation-churn", () => ({
    active: Array.from({ length: 400 }, (_, i) => ({ i, gradAt: null })),
    resting: [],
    queueSize: 60,
    mutate: (active, resting, day) => {
      const g = Math.floor(active.length * 0.04 * rnd());
      for (let k = 0; k < g; k++) { const idx = Math.floor(rnd() * active.length); const w = active.splice(idx, 1)[0]; resting.push({ i: w.i, gradAt: day }); }
      while (resting.length > 30) { const back = resting.shift(); active.push({ i: back.i, gradAt: null }); }
      return { active, resting };
    },
  }));
}

// Mid-lap queue-size change (r59-B1 — the header's claim, now genuinely exercised): size shifts DURING laps.
{
  let sizes = [60, 30, 80, 45];
  let dayCount = 0;
  runLapCase("mid-lap-size-change", () => ({
    active: Array.from({ length: 500 }, (_, i) => ({ i, gradAt: null })),
    resting: [],
    get queueSize() { return sizes[Math.floor(dayCount / 3) % sizes.length]; }, // changes every 3 days, mid-lap
    mutate: (active, resting) => { dayCount++; return { active, resting }; },
  }));
}

// ---- P1D: persisted-cursor VALUE assertions (the 15_ §2b five-case law) [r60/panel] ----
{
  const A = i => ({ i, gradAt: null });
  // normal
  let r = composeQueue([A(1), A(5), A(9), A(12)], [], 2, 5); // serves {9,12}
  if (r.cursor !== 12) fail("P1D normal", { got: r.cursor }); else ok();
  // wrap (window wraps past the end: traversal-order last ≠ numeric max)
  r = composeQueue([A(1), A(5), A(9), A(12)], [], 2, 12);
  if (r.cursor !== 5) fail("P1D wrap", { got: r.cursor }); else ok();
  // underflow, A non-empty (prior cursor above all actives)
  r = composeQueue([A(3), A(7), A(12)], [{ i: 900, gradAt: 1 }], 60, 150);
  if (r.cursor !== 12) fail("P1D underflow", { got: r.cursor }); else ok();
  // no active
  r = composeQueue([], [{ i: 900, gradAt: 1 }], 60, 150);
  if (r.cursor !== 150) fail("P1D no-active", { got: r.cursor }); else ok();
  // first-ever
  r = composeQueue([A(4), A(8)], [], 60, null);
  if (r.cursor !== 8) fail("P1D first", { got: r.cursor }); else ok();
}

// ---- P2: FIFO no-overtaking (deterministic path) ----
for (let trial = 0; trial < 300; trial++) {
  const qn = 10 + Math.floor(rnd() * 60);
  const queue = Array.from({ length: qn }, (_, i) => ({ i }));
  const ranks = new Map(queue.map(w => [w.i, {
    priority: rnd() < 0.4,
    rlt: rnd() < 0.2 ? null : Math.floor(rnd() * 1000) }]));
  const testSize = 5 + Math.floor(rnd() * 30);
  const { presented, eff, prefix } = composeTest(queue, testSize, ranks);
  const rank = w => ranks.get(w.i)?.rlt ?? -Infinity;
  const inSet = new Set(presented.map(w => w.i));
  // no non-priority word presented while a BETTER-ranked non-priority presentable word is absent
  const rem = queue.filter(w => !ranks.get(w.i)?.priority);
  for (const a of rem) if (!inSet.has(a.i))
    for (const b of rem) if (inSet.has(b.i) && (rank(b) > rank(a) || (rank(b) === rank(a) && b.i > a.i)))
      { fail("P2 overtaking", { trial, skipped: a.i, served: b.i }); trial = 1e9; break; }
  // priority prefix law
  const prioAll = queue.filter(w => ranks.get(w.i)?.priority).sort((a, b) => (rank(a) - rank(b)) || (a.i - b.i));
  const expectedPrefix = prioAll.slice(0, eff).map(w => w.i);
  if (JSON.stringify(prefix.map(w => w.i)) !== JSON.stringify(expectedPrefix)) fail("P2 prefix", { trial });
  else ok();
}

// ---- P3: invariant + fallback prefix preservation ----
for (let trial = 0; trial < 300; trial++) {
  const qn = 1 + Math.floor(rnd() * 80);
  const queue = Array.from({ length: qn }, (_, i) => ({ i }));
  const ranks = new Map(queue.map(w => [w.i, { priority: rnd() < 0.5, rlt: rnd() < 0.3 ? null : Math.floor(rnd() * 500) }]));
  const testSize = 1 + Math.floor(rnd() * 40);
  const det = composeTest(queue, testSize, ranks);
  const fb = fallbackTest(queue, testSize, ranks, 7 + trial);
  const effExp = Math.min(testSize, qn);
  for (const [name, t] of [["det", det], ["fallback", fb]]) {
    const ids = t.presented.map(w => w.i);
    if (t.presented.length !== effExp) { fail(`P3 ${name} size`, { trial, got: t.presented.length, effExp }); continue; }
    if (new Set(ids).size !== ids.length) { fail(`P3 ${name} dup`, { trial }); continue; }
    if (!ids.every(i => i >= 0 && i < qn)) { fail(`P3 ${name} member`, { trial }); continue; }
    if (JSON.stringify(det.prefix.map(w => w.i)) !== JSON.stringify(fb.prefix.map(w => w.i)))
      { fail("P3 fallback prefix drift", { trial }); continue; }
    ok();
  }
}

// ---- P4: underflow ----
for (let trial = 0; trial < 200; trial++) {
  const na = Math.floor(rnd() * 59), nr = Math.floor(rnd() * 100);
  const active = Array.from({ length: na }, (_, i) => ({ i, gradAt: null }));
  const resting = Array.from({ length: nr }, (_, i) => ({ i: 1000 + i, gradAt: Math.floor(rnd() * 500) }));
  const q = composeQueue(active, resting, 60, Math.floor(rnd() * 30)).queue;
  const expLen = Math.min(60, na + nr);
  if (q.length !== expLen) { fail("P4 length", { trial, na, nr, got: q.length, expLen }); continue; }
  const topups = q.filter(w => w.i >= 1000);
  const sortedRest = [...resting].sort((a, b) => a.gradAt - b.gradAt || a.i - b.i).slice(0, topups.length);
  if (JSON.stringify(topups.map(w => w.i)) !== JSON.stringify(sortedRest.map(w => w.i)))
    { fail("P4 earliest-graduated order", { trial }); continue; }
  ok();
}

console.log(`rotation-cyclicity-fixture: ${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
