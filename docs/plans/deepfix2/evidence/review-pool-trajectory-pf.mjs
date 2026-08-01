// review-pool-trajectory-pf.mjs — the ADDENDUM policy sim (10_REVIEW_GRADUATION_REDESIGN §3 numbers; committed per
// panel P-4). Policy "pf": pace-sized rotation queue (pure day-offset) · test 30 with priority slots (15) for
// unrecovered words · graduation = min(floor(queueSize×obsScore), correct + clean fill) incl-correct/excl-wrong,
// fill from non-unrecovered only · sticky recovery p for unrecovered words (default 0.32 cohort; per-band caveat in
// the addendum §1/§3) · 21-day rest, return forever, Mon-Fri. Fidelity note: matches the 2026-07-26 inline sim that
// produced §3 (position-order first-15 priority ≈ lastFailedAt-ASC under rotation; clamp implicit via slice).
// Usage: node review-pool-trajectory-pf.mjs [rFail=0.32]
import { writeFileSync } from "node:fs";
const REST = 21, DAYS = 300, RUNS = 7, KEEP = 140, TEST = 30, SLOTS = 15;
const R_FAIL = process.argv[2] ? parseFloat(process.argv[2]) : 0.32;
const LISTS = [["basecamp", 1200], ["ascent", 1600], ["summit", 800]], PACES = [80, 100];

function simulate({ size, pace, score }) {
  const state = new Int8Array(size), failed = new Uint8Array(size), returnAt = new Int32Array(size).fill(-1);
  let twi = 0, studyDay = 0; const curve = [];
  for (let day = 0; day < DAYS && curve.length < KEEP; day++) {
    for (let i = 0; i < twi; i++) if (state[i] === 2 && returnAt[i] <= day) state[i] = 1;
    if (day % 7 >= 5) continue;
    studyDay++;
    if (twi < size) { const n = Math.min(pace, size - twi); for (let i = twi; i < twi + n; i++) state[i] = 1; twi += n; }
    const pool = []; for (let i = 0; i < twi; i++) if (state[i] === 1) pool.push(i);
    let seg = null;
    if (studyDay > 1 && pool.length) {
      const start = ((studyDay - 1) * pace) % pool.length; // pure day-offset rotation (addendum §2.1)
      const n = Math.min(pace, pool.length); seg = [];
      for (let k = 0; k < n; k++) seg.push(pool[(start + k) % pool.length]);
    }
    if (seg && seg.length) {
      const fSel = seg.filter(i => failed[i] === 1).slice(0, Math.min(SLOTS, TEST));
      const clean = seg.filter(i => failed[i] === 0).sort(() => Math.random() - 0.5);
      const cSel = clean.slice(0, Math.max(0, Math.min(TEST - fSel.length, clean.length)));
      const correct = [];
      for (const i of fSel) if (Math.random() < R_FAIL) correct.push(i);
      for (const i of cSel) { if (Math.random() < score) correct.push(i); else failed[i] = 1; }
      const tested = fSel.length + cSel.length, obs = tested ? correct.length / tested : 0;
      const testedSet = new Set([...fSel, ...cSel]);
      const fill = seg.filter(i => failed[i] === 0 && !testedSet.has(i)).sort(() => Math.random() - 0.5);
      const grads = correct.concat(fill.slice(0, Math.max(0, Math.floor(seg.length * obs) - correct.length)));
      for (const i of grads) { state[i] = 2; failed[i] = 0; returnAt[i] = day + REST; }
    }
    let f = 0; for (const i of pool) if (state[i] === 1 && failed[i] === 1) f++;
    curve.push([pool.filter(i => state[i] === 1).length, f]);
  }
  return curve;
}

const out = { meta: { rFail: R_FAIL, test: TEST, slots: SLOTS, rest: REST, runs: RUNS }, curves: {} };
for (const [key, size] of LISTS) for (const pace of PACES) for (const s of [0.5, 0.7, 0.9, 1.0]) {
  const runs = Array.from({ length: RUNS }, () => simulate({ size, pace, score: s }));
  const n = Math.min(...runs.map(r => r.length));
  out.curves[`${key}_${pace}_${Math.round(s * 100)}`] = Array.from({ length: n }, (_, d) => [
    Math.round(runs.reduce((a, r) => a + r[d][0], 0) / RUNS), Math.round(runs.reduce((a, r) => a + r[d][1], 0) / RUNS)]);
}
writeFileSync(new URL("./trajectory-pf.json", import.meta.url), JSON.stringify(out));
for (const [key, size] of LISTS) for (const pace of PACES) {
  console.log(`${key}@${pace}: ` + [50, 70, 90, 100].map(s => { const c = out.curves[`${key}_${pace}_${s}`][59]; return `${s}%→${c[0]}(${c[1]})`; }).join(" "));
}
