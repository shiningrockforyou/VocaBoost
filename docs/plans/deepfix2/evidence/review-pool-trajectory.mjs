// Review-pool TRAJECTORY sim v2 — register item 15 evidence, REAL LISTS (David 2026-07-26: Base Camp / Ascent /
// Summit, per list). v1 (generic 600@pace-20) superseded.
// Lists (TA_SUPPORT_GUIDE + ACT-104 seed evidence): Base Camp 1,200w · Ascent 1,600w · Summit 800w.
// Paces (TA_SUPPORT_GUIDE): INT classes 80/day · FINAL classes 100/day.
// Mechanics mirrored from the live code (studyAlgorithm.js): daily segment = pool/5 position slice (wk1 divisor 4,
// wk1-d1 none) CAPPED at REVIEW_STUDY_CAP=60 studied; REVIEW_TEST_SIZE 30 at interventionLevel 0 (60 only while
// throttle-held — dies at D-1, so today-baseline tests 30); MASTERED rests 21 calendar days then returns forever;
// Mon-Fri study. Gate-off assumption (passed=true always) — rule c == today's c0.
// Rules: c0 = today floor(segLen*score) any-score, drawn from the whole capped segment minus test-failed ·
// a = tested-correct only, test 30 · aAd = tested-correct, test 30 normally / 60 while pool>300 (item-15
// RECOMMENDED) · a60 = tested-correct, test 60 always · b = all tested regardless of correctness (REJECTED, ref).
import { writeFileSync } from "node:fs";

const DPW = 5, CAP = 60, REST = 21, DAYS = 300, RUNS = 7, KEEP = 140;
const LISTS = [
  { key: "basecamp", name: "Base Camp", size: 1200 },
  { key: "ascent",   name: "Ascent",   size: 1600 },
  { key: "summit",   name: "Summit",   size: 800 },
];
const PACES = [80, 100];

function simulate({ size, pace, score, rule }) {
  const state = new Int8Array(size); const returnAt = new Int32Array(size).fill(-1);
  let twi = 0, studyDay = 0; const curve = [];
  for (let day = 0; day < DAYS && curve.length < KEEP; day++) {
    for (let i = 0; i < twi; i++) if (state[i] === 2 && returnAt[i] <= day) state[i] = 1;
    if (day % 7 >= 5) continue;
    studyDay++;
    if (twi < size) { const n = Math.min(pace, size - twi); for (let i = twi; i < twi + n; i++) state[i] = 1; twi += n; }
    const pool = []; for (let i = 0; i < twi; i++) if (state[i] === 1) pool.push(i);
    const week = Math.ceil(studyDay / DPW), dow = ((studyDay - 1) % DPW) + 1;
    let seg = null;
    if (!(week === 1 && dow === 1) && pool.length) {
      const divisor = week === 1 ? DPW - 1 : DPW;
      const segSize = Math.ceil(pool.length / divisor);
      const pos = week === 1 ? dow - 2 : dow - 1;
      seg = pool.slice(pos * segSize, pos * segSize + segSize).slice(0, CAP);
    }
    if (seg && seg.length) {
      const TEST = rule === "a60" ? 60 : rule === "aAd" ? (pool.length > 300 ? 60 : 30) : 30;
      const sh = [...seg].sort(() => Math.random() - 0.5);
      const tested = sh.slice(0, Math.min(TEST, seg.length));
      const nC = Math.round(tested.length * score);
      const correct = tested.slice(0, nC), failed = tested.slice(nC);
      let grads = [];
      if (rule === "b") grads = tested;
      else if (rule === "c0") {
        const fs = new Set(failed); const elig = seg.filter(i => !fs.has(i));
        grads = [...elig].sort(() => Math.random() - 0.5).slice(0, Math.min(Math.floor(seg.length * score), elig.length));
      } else grads = correct; // a / aAd / a60
      for (const i of grads) { state[i] = 2; returnAt[i] = day + REST; }
    }
    curve.push(pool.length);
  }
  return curve;
}

const SCORES = [0.5, 0.7, 0.9, 1.0], RULES = ["c0", "a", "aAd", "a60", "b"];
const out = { meta: { lists: LISTS, paces: PACES, cap: CAP, test: "30 (a60:60, aAd:30/60@pool>300)", rest: REST, runs: RUNS, gateOff: true, keepDays: KEEP } , curves: {} };
for (const L of LISTS) for (const pace of PACES) for (const rule of RULES) for (const s of SCORES) {
  const runs = Array.from({ length: RUNS }, () => simulate({ size: L.size, pace, score: s, rule }));
  const n = Math.min(...runs.map(r => r.length));
  out.curves[`${L.key}_${pace}_${rule}_${Math.round(s * 100)}`] =
    Array.from({ length: n }, (_, d) => Math.round(runs.reduce((a, r) => a + r[d], 0) / RUNS));
}
writeFileSync(new URL("./trajectory.json", import.meta.url), JSON.stringify(out));

const DS = [5, 10, 15, 20, 30, 40, 60, 90, 120];
for (const L of LISTS) for (const pace of PACES) {
  const intakeEnd = Math.ceil(L.size / pace);
  console.log(`\n=== ${L.name} (${L.size}w) @ pace ${pace}/day — intake ends study-day ${intakeEnd} ===`);
  for (const rule of RULES) {
    const label = { c0: "c0/c today", a: "a strict-30", aAd: "a+ADAPTIVE", a60: "a60", b: "b all-tested" }[rule];
    console.log(`--- ${label} ---  score | ${DS.map(d => ("d" + d).padStart(5)).join(" ")}`);
    for (const s of SCORES) {
      const c = out.curves[`${L.key}_${pace}_${rule}_${Math.round(s * 100)}`];
      console.log(`${String(Math.round(s * 100)).padStart(18)}% | ${DS.map(d => String(c[d - 1] ?? "-").padStart(5)).join(" ")}`);
    }
  }
}
