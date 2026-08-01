// Review-pool projection sim — EXACT mechanics from the codebase:
// - intake: pace new words per study day (Mon-Fri), until listSize reached (student passes new tests)
// - pool: introduced words not currently MASTERED-resting (21 calendar-day rest, then NEEDS_CHECK -> back in pool)
// - daily segment: computeUnmasteredSegmentIds (divisor=5 wk2+, wk1=4, wk1-day1 none) then REVIEW_STUDY_CAP=60
//   (slice.slice(0,60) -> FIRST 60 of the fifth, position order -> tail starvation when pool>300)
// - test: random 30 (or fewer) from the capped segment
// - graduation rules:
//   a  = tested-correct only (on pass; gate-off => every test "passes")
//   b  = all tested words (on pass)
//   c  = current formula pass-gated: floor(segLen*score) from eligible (=segment minus test-failed), random
//   c0 = today's LIVE behavior: same as c but fires on ANY score (baseline)
const DPW = 5, PACE = 20, CAP = 60, TEST = 30, REST = 21;

function simulate({ listSize, score, rule, days = 400 }) {
  // word i: state 0=unintroduced 1=active 2=resting; returnAt day
  const state = new Int8Array(listSize);
  const returnAt = new Int32Array(listSize).fill(-1);
  let twi = 0, studyDay = 0;
  const samples = {};
  let peak = 0, starveMax = 0;
  const lastSeen = new Int32Array(listSize).fill(-1);

  for (let day = 0; day < days; day++) {
    const weekday = day % 7 < 5; // Mon-Fri study
    // returns happen on calendar days (init check on study days; model daily — same effect on study days)
    for (let i = 0; i < twi; i++) if (state[i] === 2 && returnAt[i] <= day) state[i] = 1;
    if (!weekday) continue;
    studyDay++;
    // intake (assume new-word test passed at 92% => advance)
    if (twi < listSize) { const n = Math.min(PACE, listSize - twi); for (let i = twi; i < twi + n; i++) state[i] = 1; twi += n; }
    // pool: position-ordered active
    const pool = []; for (let i = 0; i < twi; i++) if (state[i] === 1) pool.push(i);
    peak = Math.max(peak, pool.length);
    // segment (exact slicing)
    const week = Math.ceil(studyDay / DPW), dow = ((studyDay - 1) % DPW) + 1;
    let seg = null;
    if (!(week === 1 && dow === 1) && pool.length) {
      const divisor = week === 1 ? DPW - 1 : DPW;
      const segSize = Math.ceil(pool.length / divisor);
      const pos = week === 1 ? dow - 2 : dow - 1;
      seg = pool.slice(pos * segSize, pos * segSize + segSize).slice(0, CAP);
    }
    if (seg && seg.length) {
      seg.forEach(i => (lastSeen[i] = studyDay));
      // test: random TEST from segment
      const shuffled = [...seg].sort(() => Math.random() - 0.5);
      const tested = shuffled.slice(0, Math.min(TEST, shuffled.length));
      const nCorrect = Math.round(tested.length * score);
      const correct = tested.slice(0, nCorrect), failed = tested.slice(nCorrect);
      const passed = true; // gate-off (or threshold <= score); gate-on below-threshold => 0 grad + day held (not modeled here)
      let grads = [];
      if (rule === 'a') grads = passed ? correct : [];
      else if (rule === 'b') grads = passed ? tested : [];
      else { // c / c0
        const fire = rule === 'c0' ? true : passed;
        if (fire) {
          const failedSet = new Set(failed);
          const eligible = seg.filter(i => !failedSet.has(i));
          const count = Math.min(Math.floor(seg.length * score), eligible.length);
          const esh = [...eligible].sort(() => Math.random() - 0.5);
          grads = esh.slice(0, count);
        }
      }
      for (const i of grads) { state[i] = 2; returnAt[i] = day + REST; }
    }
    if ([20, 40, 60, 80, 120, 160, 200].includes(studyDay)) {
      // starvation: oldest gap among active words already seen once
      let worst = 0;
      for (let i = 0; i < twi; i++) if (state[i] === 1 && lastSeen[i] > 0) worst = Math.max(worst, studyDay - lastSeen[i]);
      starveMax = worst;
      const active = pool.length;
      samples[studyDay] = { active, resting: twi - active - (listSize - twi > 0 ? 0 : 0) - (twi - active) + (twi - active), starve: worst };
      samples[studyDay] = { active, starve: worst };
    }
  }
  return samples;
}

const scores = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];
const rules = ['a', 'b', 'c', 'c0'];
const LIST = 600; // 600-word list = 6 weeks of intake at 20/day
console.log(`list=${LIST}, pace=${PACE}/day, dpw=5, test=${TEST}, segCap=${CAP}, rest=${REST}d  (intake ends study-day 30)`);
console.log(`ACTIVE REVIEW POOL by study day (and worst starvation gap in study-days at that point)\n`);
for (const rule of rules) {
  const label = { a: 'RULE a: tested-correct graduate (on pass)', b: 'RULE b: all tested graduate (on pass)', c: 'RULE c: floor(seg×score) pass-gated', c0: 'BASELINE c0: today live (any score)' }[rule];
  console.log(`--- ${label} ---`);
  console.log('score |  d20   d40   d60   d80  d120  d160  d200 | starve@d80');
  for (const s of scores) {
    // average 3 runs (randomness)
    const runs = [1, 2, 3].map(() => simulate({ listSize: LIST, score: s, rule }));
    const avg = (d, k) => Math.round(runs.reduce((a, r) => a + (r[d]?.[k] ?? 0), 0) / runs.length);
    console.log(
      `${String(Math.round(s * 100)).padStart(4)}% | ${[20, 40, 60, 80, 120, 160, 200].map(d => String(avg(d, 'active')).padStart(5)).join(' ')} |   ${avg(80, 'starve')}d`
    );
  }
  console.log('');
}
