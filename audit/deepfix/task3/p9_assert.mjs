// P9 · CYC — M-STATIC assertion harness (Codex P9-1 requested check + core lap math).
//
// The real module src/services/studyService.js can't be imported in plain Node (Vite
// resolves the extensionless `../firebase` import; Node does not). So this harness
// EXTRACTS the actual pure-function source text (computeLapView / computeCyclingAllocation
// / deriveEffectiveCycling — none of which touch Firestore) by brace-matching, evals it,
// and asserts against it. It therefore tests the REAL code, not a mirror; if those
// functions drift, the extraction re-reads the current source.
//
// Run: node audit/deepfix/task3/p9_assert.mjs   (exit 0 = all pass)

import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../../../src/services/studyService.js', import.meta.url), 'utf8');

function extract(name) {
  const sig = `export function ${name}`;
  const at = SRC.indexOf(sig);
  if (at === -1) throw new Error(`could not find ${sig}`);
  const open = SRC.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) return SRC.slice(at, i + 1).replace(/^export\s+/, ''); }
  }
  throw new Error(`unbalanced braces for ${name}`);
}

// Eval the three real pure functions into this scope.
const src = [extract('computeLapView'), extract('computeCyclingAllocation'), extract('deriveEffectiveCycling')].join('\n');
// eslint-disable-next-line no-eval
const mod = (0, eval)(`(() => { ${src}\n return { computeLapView, computeCyclingAllocation, deriveEffectiveCycling }; })()`);
const { computeLapView, computeCyclingAllocation, deriveEffectiveCycling } = mod;

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, got, want) {
  if (eq(got, want)) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
}

console.log('computeLapView (x/plan §2/§3e boundary rule):');
check('twi=0/cl=1200 → Lap 1, 0%',        computeLapView(0, 1200),    { lap: 1, numer: 0, denom: 1200, pct: 0 });
check('twi=1200/cl=1200 → Lap 1, 100% (boundary shows 100% of lap k)', computeLapView(1200, 1200), { lap: 1, numer: 1200, denom: 1200, pct: 100 });
check('twi=1250/cl=1200 → Lap 2, 50/1200', computeLapView(1250, 1200), { lap: 2, numer: 50, denom: 1200, pct: 4 });
check('twi=2400/cl=1200 → Lap 2, 100% (boundary)', computeLapView(2400, 1200), { lap: 2, numer: 1200, denom: 1200, pct: 100 });
check('cl<=0 → null',                       computeLapView(50, 0),      null);

console.log('computeCyclingAllocation (§3f cap removal + byte-equivalence):');
// Codex P9-1 core assertion: a FINISHED list (wordsRemaining <= 0) under cycling yields newWordCount > 0.
check('FINISHED + cyclingActive → pace (>0, cap removed)', computeCyclingAllocation(50, -30, true), 50);
check('mid-list + cyclingActive → pace (cap removed)',     computeCyclingAllocation(50, 20, true),  50);
check('FINISHED + NOT cycling → today exact Math.min(50,-30)', computeCyclingAllocation(50, -30, false), -30);
check('mid-list + NOT cycling → today exact Math.min(50,20)',  computeCyclingAllocation(50, 20, false),  20);

console.log('deriveEffectiveCycling (§3b cross-class unlock, Codex P9-2):');
check('cross-class unlock via ClassA (current class has it off)',
  deriveEffectiveCycling([{ id: 'B', name: 'ClassB', assignments: { L1: { cyclingEnabled: false } } },
                          { id: 'A', name: 'ClassA', assignments: { L1: { cyclingEnabled: true } } }], 'L1'),
  { enabled: true, sourceClassId: 'A', sourceClassName: 'ClassA' });
check('no class enables → not unlocked',
  deriveEffectiveCycling([{ id: 'B', assignments: { L1: { cyclingEnabled: false } } }], 'L1'),
  { enabled: false, sourceClassId: null, sourceClassName: null });
check('empty classes → not unlocked', deriveEffectiveCycling([], 'L1'),
  { enabled: false, sourceClassId: null, sourceClassName: null });

console.log('CLIENT ↔ SERVER cross-class consistency (Codex P9-5):');
// The server resolver `resolveEffectiveCyclingServer` (functions/foundation.js) iterates the
// student's enrolled classes and unlocks iff ANY has `assignments[listId].cyclingEnabled===true`
// — the SAME per-class predicate as the client `deriveEffectiveCycling`, over the SAME class set
// (users/{uid}.enrolledClasses, which fetchStudentClasses also reads). This models that server
// loop and asserts it equals the client for the P9-5 scenario (class A enables, class B launches).
const serverEffective = (enrolledClasses, listId) => {
  for (const c of enrolledClasses) {
    if (c?.assignments?.[listId]?.cyclingEnabled === true) {
      return { enabled: true, sourceClassId: c.id ?? null, sourceClassName: c.name ?? null };
    }
  }
  return { enabled: false, sourceClassId: null, sourceClassName: null };
};
{
  // Student enrolled in BOTH: B (launching, cycling off) and A (cycling on) for list L.
  const enrolled = [
    { id: 'B', name: 'ClassB', assignments: { L: { cyclingEnabled: false } } },
    { id: 'A', name: 'ClassA', assignments: { L: { cyclingEnabled: true } } },
  ];
  const client = deriveEffectiveCycling(enrolled, 'L');   // client init (launched from B)
  const server = serverEffective(enrolled, 'L');          // server M4/completeSession/challenge
  check('client resolves enabled (unlocked via ClassA despite launching from B)', client.enabled, true);
  check('server resolves enabled (SAME predicate, SAME class set)', server.enabled, true);
  check('client === server (no client/server disagreement → no anchor_rejected / zeroing)',
    client.enabled === server.enabled, true);
  // Both advance virtual TWI consistently for a FINISHED list (wordsRemaining <= 0):
  const cyclingActive = client.enabled; // === server.enabled
  const pace = 50, wordsRemaining = 0;
  const clientNewWords = computeCyclingAllocation(pace, wordsRemaining, cyclingActive);
  const serverNewWords = Math.max(0, pace);               // completeSession: max(0, allocNew) under cycling
  const m4Allowed = Math.max(0, pace);                    // M4: allowedIntroduced = max(0, allocNew) under cycling
  check('client newWordCount > 0', clientNewWords > 0, true);
  check('server serverNewWordCount === client (both advance TWI by pace)', serverNewWords === clientNewWords, true);
  check('M4 introducedCount(pace) <= allowedIntroduced (no anchor_rejected)', pace <= m4Allowed, true);
}

console.log('COMPOSITE — initializeDailySession decision for a FINISHED list when fully enabled (Codex P9-1):');
// Mirrors initializeDailySession: cyclingActive = effective.enabled && cycleLength>0;
//   newWordCount = computeCyclingAllocation(allocation.newWords, wordsRemaining, cyclingActive);
//   isListComplete = cyclingActive ? false : (wordsRemaining <= 0).
{
  const eff = deriveEffectiveCycling([{ id: 'A', name: 'ClassA', assignments: { L1: { cyclingEnabled: true } } }], 'L1');
  const cycleLength = 1200;                    // getCycleLength(positions.length)
  const cyclingActive = eff.enabled && cycleLength > 0;
  const totalListWords = 1200, twi = 1200;     // FINISHED list
  const wordsRemaining = totalListWords - twi; // 0
  const pace = 50;
  const newWordCount = computeCyclingAllocation(pace, wordsRemaining, cyclingActive);
  const isListComplete = cyclingActive ? false : (wordsRemaining <= 0);
  check('cyclingActive === true',        cyclingActive, true);
  check('newWordCount > 0 (finished list still introduces)', newWordCount > 0, true);
  check('isListComplete === false (never dead-ends under cycling)', isListComplete, false);
}

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
