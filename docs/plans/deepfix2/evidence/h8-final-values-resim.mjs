// h8-final-values-resim.mjs — THE H8 BASELINE RE-SIM, v5 [R2-47: the exposure-bound ORACLE IS RETIRED — this
// sim GENERATES MONITORING BASELINES (plateau pools, wall rates, gap percentiles, saturation days, return
// slugs, underflow, graduation throughput) and proves the STRUCTURAL CYCLICITY property (TWO-CONSECUTIVE-LAP
// coverage under the CURSOR-CHAINED law [r58/r62]; the certified fixture is rotation-cyclicity-fixture.mjs). Nothing here passes or fails a fairness bound; gap stats are descriptive.]
// LIMITATIONS: the launch seed samples per-word tuples with replacement cohort-wide (within-student
// correlations lost; one distribution across bands); rru maps only the resting FACT (return day randomized —
// slug timing is scenario, not prediction). Both are acceptable for a baseline generator, stated honestly.
// Measures, at the FINAL launch values (queue 60 · test 30 · gate 92 · uncapped least-recently-tested priority
// slots · three strata · R2-41 unified stamping + rerun graduation + underflow top-up):
//   (1) unproven-word EXPOSURE intervals (active-days between presentations) — CLOSED + CENSORED intervals both
//       counted (never-seen words included); reported separately for ADVANCING vs WALLED runs (a walled student's
//       frozen queue structurally excludes out-of-queue words — that is the wall, not rotation unfairness);
//   (2) wall-rate / days-advanced baselines per band; (3) pool + graduation dynamics incl. R2-41 rerun scenarios
//       and 21-day return slugs; (4) underflow top-up; (5) a mid-run CONFIG-SIZE-CHANGE scenario (60→30→80);
//   (6) a LAUNCH-SEEDED scenario (initial labels drawn from B1's measured sample distributions).
// FIXES vs v1 [r53-B4 + panel]: B1 seeding real (not claimed); queue PINNED per logical day incl. across walled
//   calendar days; censored/never-seen words counted; timestamp slots widened (no rerun/live collision);
//   measured PER-BAND accuracy table (probe-rebuilt) replaces the multiplicative ratio bridge; RETAKE cap renamed
//   DAILY_ATTEMPTS (behavioral parameter, not policy — policy is uncapped); 3 seeds per scenario.
// LIMITATIONS (accuracyModel.caveats in output): probe classes are LAST-ANSWER-based (not pass-gated) — the sim
//   maps last-answer state → accuracy and uses pass-gated lp only for strata/graduation; no cross-day learning
//   beyond the within-day retake bonus (wall results are pessimistic-baseline, not predictions); single-student
//   closed-world (no teacher edits/challenges/force-pass).
// FAIRNESS RULING INPUT: random-remainder selection gives a PROBABILISTIC exposure guarantee only — the
//   deterministic-remainder-vs-SLO decision is the owner's (queued); this sim reports the measured tail either way.
// Deterministic seeded LCG. Run: node docs/plans/deepfix2/evidence/h8-final-values-resim.mjs
import { readFileSync, writeFileSync } from "node:fs";

const QUEUE0 = 60, TEST = 30, GATE = 92, REST = 21, PACE = 80, LIST = 1200, DAYS = 120, DAILY_ATTEMPTS = 6;
const SEEDS = [1, 2, 3];
// measured per-band conditional accuracy (rebuilt from graduation-validity-26SM.json perStudent, all cells n>400)
const ACC = {
  lt50:   { proven: 0.445, afterWrong: 0.213, untestedFresh: 0.307, untestedAged: 0.240 },
  b50_70: { proven: 0.642, afterWrong: 0.503, untestedFresh: 0.613, untestedAged: 0.538 },
  b70_85: { proven: 0.830, afterWrong: 0.689, untestedFresh: 0.785, untestedAged: 0.747 },
  b85p:   { proven: 0.965, afterWrong: 0.882, untestedFresh: 0.961, untestedAged: 0.949 },
};
const RETAKE_BONUS = 0.03, RETAKE_BONUS_CAP = 0.15;
// B1 DISJOINT joint mix (proven×priority cross) — FAIL-CLOSED [r54-4.2]: no fallback; the source digest is
// recorded in the output. Source = the gitignored local baseline summary (B1 v3 emits jointMix).
import { createHash } from "node:crypto";
const b1Dir = new URL("../../../../audit/deepfix/trackB_baselines/", import.meta.url);
const man = JSON.parse(readFileSync(new URL("b1-manifest-sample.json", b1Dir))); // fail-closed: manifest first
const jsonlRaw = readFileSync(new URL("b1-expected-labels-sample.jsonl", b1Dir));
if (createHash("sha256").update(jsonlRaw).digest("hex") !== man.jsonlSha256) throw new Error("B1 JSONL hash mismatch vs manifest");
// PER-WORD launch states [r55 — real clocks/order/correlations, not an aggregate mix]
const B1_WORDS = [];
for (const ln of jsonlRaw.toString().split("\n")) {
  if (!ln) continue;
  const row = JSON.parse(ln);
  for (const w of Object.values(row.words)) B1_WORDS.push(w);
}
if (B1_WORDS.length < 1000) throw new Error(`B1 per-word pool too small: ${B1_WORDS.length}`);
const B1_DIGEST = man.jsonlSha256;

let seed = 1;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function pCorrect(band, w, retake, day) {
  // probe-faithful mapping: the LAST review answer decides the class (probe semantics); intro age splits untested
  const a = ACC[band];
  let base;
  if (w.lastAnswerOk === true) base = a.proven;
  else if (w.lastAnswerOk === false) base = a.afterWrong;
  else base = (day - w.introDay) > 14 ? a.untestedAged : a.untestedFresh;
  return clamp(base + Math.min(retake * RETAKE_BONUS, RETAKE_BONUS_CAP), 0.05, 0.99);
}

function simulate({ band, rerunsPerDay, seedVal, sizeChange = false, launchSeeded = false }) {
  seed = seedVal * 990001 + 7;
  const W = Array.from({ length: LIST }, (_, i) => ({ i, introDay: Math.floor(i / PACE), fc: 0, lf: null, lc: null, lp: null, rlt: null,
    lastAnswerOk: null, restUntil: -1, unseenActive: 0, everQueued: false, seen: 0, maxGapUnproven: 0 }));
  let studyDay = 0;
  if (launchSeeded) { // PER-WORD B1 sampling [r55]: real label tuples incl. relative clock order
    studyDay = Math.ceil(LIST / PACE);
    const sampled = W.map(() => B1_WORDS[Math.floor(rnd() * B1_WORDS.length)]);
    // basic schema validation [r56 — hash is integrity, not schema]
    for (const b of sampled.slice(0, 50)) {
      if (typeof b.fc !== "number" || b.fc < 0) throw new Error("B1 word tuple invalid: fc");
      for (const k of ["lf", "lc", "lp", "rlt"]) if (b[k] !== null && typeof b[k] !== "number") throw new Error(`B1 word tuple invalid: ${k}`);
    }
    // map real ms clocks to sim-scale negative offsets preserving ORDER
    const clocks = [...new Set(sampled.flatMap(b => [b.rlt, b.lf, b.lc, b.lp].filter(v => v !== null)))].sort((a, b) => a - b);
    const rank = new Map(clocks.map((v, i) => [v, -1e6 + i]));
    W.forEach((w, i) => {
      const b = sampled[i];
      w.fc = b.fc; w.lf = b.lf === null ? null : rank.get(b.lf); w.lc = b.lc === null ? null : rank.get(b.lc);
      w.lp = b.lp === null ? null : rank.get(b.lp); w.rlt = b.rlt === null ? null : rank.get(b.rlt);
      w.lastAnswerOk = b.lf !== null && (b.lc === null || b.lf > b.lc) ? false : b.lc !== null ? true : null;
      if (b.rru !== null && b.rru !== undefined) w.restUntil = Math.floor(rnd() * REST); // resting at flip; returns within 21d
    });
  }
  const stats = { wallDays: 0, daysAdvanced: 0, retakesTotal: 0, liveGrad: 0, rerunGrad: 0, poolTraj: [], returnSlugMax: 0, underflowDays: 0, testsTaken: 0, minQueueUsed: QUEUE0 };
  let pinnedQueue = null, pinnedForDay = -1;
  for (let d = 0; d < DAYS; d++) {
    const QUEUE = sizeChange ? (d < 40 ? QUEUE0 : d < 80 ? 30 : 80) : QUEUE0;
    stats.minQueueUsed = Math.min(stats.minQueueUsed, QUEUE);
    const intakeEnd = Math.ceil(LIST / PACE) - 1;
    const introduced = W.filter(w => w.introDay <= Math.min(studyDay, intakeEnd));
    const returnsToday = W.filter(w => w.restUntil === d);
    stats.returnSlugMax = Math.max(stats.returnSlugMax, returnsToday.length);
    W.forEach(w => { if (w.restUntil === d) w.restUntil = -1; });
    const active = introduced.filter(w => w.restUntil < 0);
    stats.poolTraj.push(active.length);
    active.forEach(w => { w.unseenActive++; });
    // ---- PINNED day queue: composed ONCE per logical day; walled calendar days REUSE it [r53-B4 fix]
    if (pinnedForDay !== studyDay || pinnedQueue === null) {
      const sorted = [...active].sort((a, b) => a.i - b.i);
      if (sorted.length >= QUEUE) {
        const start = (studyDay * QUEUE) % sorted.length;
        pinnedQueue = Array.from({ length: QUEUE }, (_, k) => sorted[(start + k) % sorted.length]);
      } else {
        // R2-41(e) underflow top-up: earliest-GRADUATED first (graduation time = restUntil - REST)
        const resting = W.filter(w => w.restUntil > d).sort((a, b) => (a.restUntil - REST) - (b.restUntil - REST) || a.i - b.i);
        pinnedQueue = [...sorted, ...resting.slice(0, QUEUE - sorted.length)];
        if (resting.length && sorted.length < QUEUE) stats.underflowDays++;
      }
      pinnedForDay = studyDay;
    }
    const queue = pinnedQueue;
    if (!queue.length) { studyDay++; pinnedForDay = -1; continue; }
    queue.forEach(w => { w.everQueued = true; });
    // ---- live attempts (DAILY_ATTEMPTS = behavioral day-length cap; POLICY is uncapped retakes)
    let passed = false, attempt = 0;
    while (!passed && attempt < DAILY_ATTEMPTS) {
      const priority = queue.filter(w => w.fc > 0 && (!w.lc || w.lf > w.lc))
        .sort((a, b) => (a.rlt ?? -1e15) - (b.rlt ?? -1e15) || a.i - b.i); // frozen tie-break
      const rest = queue.filter(w => !priority.includes(w));
      // R2-42: remainder is DETERMINISTIC least-recently-tested (same clock/tie-break); display order irrelevant here
      const ordered = [...rest].sort((a, b) => (a.rlt ?? -1e15) - (b.rlt ?? -1e15) || a.i - b.i);
      const presented = [...priority.slice(0, TEST), ...ordered.slice(0, Math.max(0, TEST - Math.min(priority.length, TEST)))];
      if (attempt === 0 && priority.length >= Math.min(TEST, queue.length)) stats.saturationDays = (stats.saturationDays || 0) + 1; // descriptive [R2-47]
      stats.testsTaken++;
      const t = d * 100 + attempt; // widened slots: live 0-9, reruns 50+ [panel fix]
      const oks = presented.map(w => rnd() < pCorrect(band, w, attempt, d));
      const correct = oks.filter(Boolean).length;
      const score = (correct / presented.length) * 100;
      const passing = score >= GATE;
      presented.forEach((w, k) => {
        const ok = oks[k];
        if (w.lp === null) w.maxGapUnproven = Math.max(w.maxGapUnproven, w.unseenActive - 1);
        if (ok) { w.lc = t; if (passing) w.lp = t; } else { w.fc++; w.lf = t; }
        w.lastAnswerOk = ok; w.rlt = t;
        w.unseenActive = 0; w.seen++;
      });
      if (passing) {
        passed = true;
        const qeff = queue.length;
        const target = Math.floor(qeff * (score / 100));
        const testedCorrect = presented.filter((w, k) => oks[k]);
        const unpresented = queue.filter(w => !presented.includes(w));
        const eligibleFill = unpresented.filter(w => w.fc === 0 || (w.lp !== null && w.lp >= w.lf));
        // underflow fix [r56]: already-resting top-up words never enter the graduation slice or the count
        const gradPool = [...testedCorrect, ...eligibleFill].filter(w => w.restUntil < 0);
        const grads = gradPool.slice(0, Math.min(target, gradPool.length));
        grads.forEach(w => {
          if (w.lp === null && w.unseenActive > 0) w.maxGapUnproven = Math.max(w.maxGapUnproven, w.unseenActive); // censor-at-exit
          w.restUntil = d + REST;
        });
        stats.liveGrad += grads.length;
      } else { attempt++; stats.retakesTotal++; }
    }
    if (!passed) stats.wallDays++;
    else { stats.daysAdvanced++; studyDay++; pinnedForDay = -1; }
    // ---- R2-41 rerun scenario: regenerated pure-random over the introduced range; stamps; tested-correct grads
    for (let r = 0; r < rerunsPerDay; r++) {
      // deterministic Fisher-Yates prefix draw [r56 — sort(rnd) is engine-sensitive/non-uniform]
      const rangeSrc = [...introduced];
      for (let k = 0; k < Math.min(TEST, rangeSrc.length); k++) { const j = k + Math.floor(rnd() * (rangeSrc.length - k)); [rangeSrc[k], rangeSrc[j]] = [rangeSrc[j], rangeSrc[k]]; }
      const range = rangeSrc.slice(0, TEST);
      const t = d * 100 + 50 + r;
      const oks = range.map(w => rnd() < pCorrect(band, w, 0, d));
      const correct = oks.filter(Boolean).length;
      const passing = (correct / range.length) * 100 >= GATE;
      range.forEach((w, k) => {
        const ok = oks[k];
        if (w.lp === null) w.maxGapUnproven = Math.max(w.maxGapUnproven, w.unseenActive - 1);
        if (ok) { w.lc = t; if (passing) w.lp = t; } else { w.fc++; w.lf = t; }
        w.lastAnswerOk = ok; w.rlt = t;
        w.unseenActive = 0; w.seen++;
        if (ok && passing && w.restUntil < 0) { w.restUntil = d + REST; stats.rerunGrad++; }
      });
    }
  }
  // ---- exposure accounting: CLOSED + CENSORED (open) intervals, never-seen included [r53-B4 fix]
  const advancing = stats.daysAdvanced >= Math.min(DAYS, Math.ceil(LIST / PACE)) * 0.8;
  const introducedFinal = W.filter(w => w.introDay <= Math.min(studyDay, Math.ceil(LIST / PACE) - 1));
  const unprovenGaps = [], structuralOutOfQueue = [];
  for (const w of introducedFinal) {
    const open = (w.lp === null && w.restUntil < 0) ? w.unseenActive : 0; // censored interval; resting words are not starving
    const g = Math.max(w.maxGapUnproven, open);
    if (w.lp !== null) { if (w.maxGapUnproven) unprovenGaps.push(w.maxGapUnproven); continue; }
    if (!w.everQueued) structuralOutOfQueue.push(g);
    else unprovenGaps.push(g);
  }
  unprovenGaps.sort((a, b) => a - b);

  const q = p => unprovenGaps[Math.floor(unprovenGaps.length * p)] ?? 0;
  return {
    band, rerunsPerDay, seed: seedVal, sizeChange, launchSeeded,
    daysAdvanced: stats.daysAdvanced, wallDays: stats.wallDays, plateauPool: Math.round(stats.poolTraj.slice(-20).reduce((a, b) => a + b, 0) / 20),
    liveGraduations: stats.liveGrad, rerunGraduations: stats.rerunGrad, returnSlugMax: stats.returnSlugMax,
    underflowDays: stats.underflowDays, retakesTotal: stats.retakesTotal,
    structuralOutOfQueue: { n: structuralOutOfQueue.length, note: "unproven words never in any composed queue — excluded by the WALL (frozen-queue law), not by the rotation" },
    saturationDays: stats.saturationDays || 0,
    exposureBaselines: { note: "DESCRIPTIVE [R2-47 — no pass/fail]", advancingRun: advancing,
      unprovenGapP50: q(0.5), unprovenGapP99: q(0.99), unprovenGapMax: unprovenGaps[unprovenGaps.length - 1] ?? 0 },
    structuralCyclicity: advancing
      ? { everQueuedAll: introducedFinal.every(w => w.everQueued || w.restUntil > 0 || w.lp !== null), note: "every introduced word either entered a queue, is resting, or proved — the rotation-coverage fixture [R2-47]" }
      : { everQueuedAll: "N/A", note: "walled run — the rotation is frozen with the day (the wall, not a coverage defect); cyclicity is certified on advancing runs + the arithmetic unit fixture" },
  };
}

const scenarios = [];
for (const band of Object.keys(ACC)) for (const R of [0, 2, 5]) for (const s of SEEDS) scenarios.push({ band, rerunsPerDay: R, seedVal: s });
for (const band of Object.keys(ACC)) for (const s of SEEDS) { scenarios.push({ band, rerunsPerDay: 0, seedVal: s, sizeChange: true }); scenarios.push({ band, rerunsPerDay: 2, seedVal: s, launchSeeded: true }); } // 3 seeds for specials too [r54-4.4]
const results = scenarios.map(simulate);
const out = { sim: "h8-final-values-resim", version: 5,
  values: { QUEUE0, TEST, GATE, REST, PACE, LIST, DAYS, DAILY_ATTEMPTS, note: "DAILY_ATTEMPTS is a behavioral day-length parameter — POLICY is uncapped retakes" },
  accuracyModel: { table: ACC, source: "per-band conditional rates rebuilt from graduation-validity-26SM.json perStudent (all cells n>400)",
    caveats: ["probe classes are LAST-ANSWER-based, not pass-gated: sim maps lastAnswerOk→proven/afterWrong rates and intro-age→untested rates; pass-gated lp drives strata/graduation only",
      "no cross-day learning beyond the within-day retake bonus — walled-band results are a pessimistic BASELINE, not a prediction",
      "single-student closed world: no teacher edits, challenges, force-pass, or pace changes"] },
  b1Seed: { mode: "per-word sampling from the JSONL", words: B1_WORDS.length, sourceDigest: B1_DIGEST, source: "audit/deepfix/trackB_baselines/ manifest-verified (fail-closed)" },
  law: "R2-47: THE EXPOSURE ORACLE IS RETIRED — this artifact is the monitoring-baseline set + the structural cyclicity fixture; the R2-42/46 selector (LRT remainder, effectiveTestSize invariant, prefix-preserving seeded fallback) is mechanism, certified by unit fixtures, not by this sim",

  results };
writeFileSync(new URL("./h8-resim-results.json", import.meta.url), JSON.stringify(out, null, 2));
const agg = {};
for (const r of results) {
  const k = `${r.band}|R${r.rerunsPerDay}${r.sizeChange ? "|sizechg" : ""}${r.launchSeeded ? "|seeded" : ""}`;
  agg[k] = agg[k] || { adv: [], wall: [], gapMax: [], holds: [] };
  agg[k].adv.push(r.daysAdvanced); agg[k].wall.push(r.wallDays); agg[k].gapMax.push(r.exposureBaselines.unprovenGapMax); agg[k].holds.push(String(r.structuralCyclicity.everQueuedAll));
}
for (const [k, v] of Object.entries(agg))
  console.log(`${k}: adv ${Math.min(...v.adv)}-${Math.max(...v.adv)} wall ${Math.min(...v.wall)}-${Math.max(...v.wall)} gapMax(descriptive) ${Math.min(...v.gapMax)}-${Math.max(...v.gapMax)} cyclicity=${[...new Set(v.holds)].join("/")}`);
