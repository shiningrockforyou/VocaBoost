/**
 * M-STATIC — the ONE static/git/grep/probe certifier for the deepfix FIX_PLAN
 * (AUDIT_DESIGN task4 §0.1 "M-STATIC | lsr_deepfix_static.mjs"). This is the only
 * matrix runnable in this WSL: NO browser, NO Playwright, NO Firebase Admin SDK,
 * NO live network, NO secrets. Pure repo/git/filesystem reads (+ an OPTIONAL local
 * `dist/` grep if a build exists).
 *
 * Fail-closed conventions matched from the lsr harness (NOT imported — this module
 * is zero-dep so it runs anywhere with repo read access):
 *   • runId + git-state binding + timestamp (lsr_accept.mjs / lsr_fleet_manifest.mjs)
 *   • findings/ JSON dir + a self-describing manifest object
 *   • nonzero exit on ANY FAIL or INVALID for the selected target (SKIP never fails
 *     the run but IS counted + surfaced) → `process.exit(1)` (lsr_fleet_manifest.mjs:47)
 *
 * Phase-aware: `--target=<baseline|shipped>` (default baseline).
 *   baseline = TODAY, the dormant-draft state (assert the P0 disarm + all NEW flags
 *              dormant; RET/CUT-1 legacy signatures EXPECTED-PRESENT, report-only).
 *   shipped  = end-state after all phases deploy + P7 retire (asserts the OPPOSITE for
 *              RET: legacy signatures MUST be 0, transitional flags on-path/absent).
 *              Expected to FAIL against today's tree — that proves the phase-awareness.
 *
 * Oracle set: AUDIT_DESIGN task4 §1.A (DG-1..4), §1.E (CUT-1), §1.H (RET-1..4), §2
 * (fail-closed manifest binding), §5 (P0/P7 coverage); FIX_PLAN task2 P0 (flag table)
 * + P7 (:662-690 retirement inventory + flag lifecycle). Every EXPECTED-TABLE entry
 * comments its FIX_PLAN / AUDIT_DESIGN source.
 *
 *   node audit/playwright/lsr_deepfix_static.mjs --target=baseline [--run=<id>]
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── Repo root (this file lives at <repo>/audit/playwright/) ──
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const FINDINGS = resolve(HERE, 'findings');

// ── Args ──
const argv = process.argv.slice(2);
const getArg = (k, d) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const TARGET = getArg('target', 'baseline');
if (!['baseline', 'shipped'].includes(TARGET)) {
  console.error(`--target must be baseline|shipped (got ${TARGET})`);
  process.exit(2);
}

// ── Zero-dep shell helpers (git for provenance; grep -F for literal signatures so
//    regex metachars in code signatures — `&&`, `(`, `.` — stay literal & safe) ──
function sh(cmd) {
  try {
    return execSync(cmd, { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  } catch (e) {
    return (e.stdout ? String(e.stdout) : '').trim();
  }
}
function readFile(rel) {
  const p = resolve(REPO, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
/** Literal-substring occurrence count inside ONE repo file (drift-proof; no line #). */
function countInFile(rel, needle) {
  const t = readFile(rel);
  if (t == null) return { found: false, count: 0 };
  let n = 0, i = 0;
  while ((i = t.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return { found: true, count: n };
}
/** Tree-wide literal grep → matching "file:line:text" rows (empty on no match).
 *  Node-native (no shell) → portable across WSL + native Windows (no `grep` dependency).
 *  `includes` accepts glob-lite forms like '*.js' (extension match) or an exact filename. */
function treeGrep(needle, dirs, includes = []) {
  const matchInc = (name) => includes.length === 0
    || includes.some((g) => (g.startsWith('*.') ? name.endsWith(g.slice(1)) : name === g));
  const rows = [];
  const walk = (relDir) => {
    let ents;
    try { ents = readdirSync(resolve(REPO, relDir), { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        walk(rel);
      } else if (e.isFile() && matchInc(e.name)) {
        let text; try { text = readFileSync(resolve(REPO, rel), 'utf8'); } catch { continue; }
        if (!text.includes(needle)) continue;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(needle)) rows.push(`${rel}:${i + 1}:${lines[i]}`);
        }
      }
    }
  };
  for (const d of dirs) walk(d);
  return rows;
}
/** Read a `const NAME = true|false` (optionally `export const`) from source text. */
function readBool(text, name) {
  if (text == null) return { found: false, value: null };
  const m = text.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*(true|false)\\b`));
  return m ? { found: true, value: m[1] === 'true' } : { found: false, value: null };
}

// ── Git-state binding (§2.1 marker) ──
const GIT_HEAD = sh('git rev-parse HEAD') || 'unknown';
const GIT_SHORT = sh('git rev-parse --short HEAD') || 'unknown';
const DIRTY_ROWS = sh('git status --porcelain').split('\n').filter(Boolean);
const DIRTY = DIRTY_ROWS.length > 0;
const RUN_ID = getArg('run', `${GIT_SHORT}-${TARGET}`);
const STARTED = new Date().toISOString();

// dist/ provenance (local build only — NEVER the deployed bundle; §0.2 caveat).
const DIST_DIR = resolve(REPO, 'dist');
const DIST_PRESENT = existsSync(DIST_DIR);
let DIST_NOTE = 'absent';
if (DIST_PRESENT) {
  try {
    const js = (() => { try { return readdirSync(resolve(REPO, 'dist/assets')).filter((f) => f.endsWith('.js')); } catch { return []; } })();
    const asset = js.length ? `dist/assets/${js[0]}` : '';
    const mt = asset ? statSync(resolve(REPO, asset)).mtime.toISOString() : 'unknown';
    DIST_NOTE = `local dist/ built ${mt} (NOT the deployed bundle; freshness unverified)`;
  } catch { DIST_NOTE = 'local dist/ present (mtime unreadable)'; }
}

// ── Read the three ACTUAL flag sources ONCE (task instruction #3: read, don't assume) ──
const IDX = readFile('functions/index.js');
const FF = readFile('src/config/featureFlags.js');
const FND = readFile('functions/foundation.js');

// ════════════════════════════════════════════════════════════════════════════
// EXPECTED-STATE TABLE (hardcoded; each entry cites its FIX_PLAN / AUDIT_DESIGN source)
// ════════════════════════════════════════════════════════════════════════════
// Flag rows: {name, file, read:(text)=>bool, baseline, shipped, src}
// `baseline` = the value to assert TODAY (dormant-draft). `shipped` = the on-path/live
// end-state value (P4 routes on / P0-P4 re-arm) — asserted at ship time; expected to
// FAIL against today's tree (that's correct — flag-lifecycle absence is RET-4's job).
const FLAG_TABLE = [
  // ── functions/index.js (grade consts, ~:66/:79/:101) ──
  { name: 'GRADE_TOKEN_ENFORCED', file: 'functions/index.js', src: 'FIX_PLAN P0 change 2 — G1 disarm → false (matches live prod F-9); shipped re-arms with nonce fix P4 F1-F3+F5', baseline: false, shipped: true },
  { name: 'GRADE_TOKEN_MINT', file: 'functions/index.js', src: 'deepfix 2026-07-15: DISARMED to match live prod (David disabled MINT, index.js:80); shipped re-arms with the token rollout', baseline: false, shipped: true },
  { name: 'GRADE_JOB_ENABLED', file: 'functions/index.js', src: 'FIX_PLAN P0 change 3 / P3 — stays true (validated, not flipped)', baseline: true, shipped: true },
  { name: 'TEACHER_PROVISIONING_ENABLED', file: 'functions/index.js', src: 'FIX_PLAN P6 — teacher provisioning; dormant until R1/P6 (index.js:1962)', baseline: false, shipped: true },
  { name: 'TEACHER_CLAIM_ENABLED', file: 'functions/index.js', src: 'FIX_PLAN P10d — custom-claim role model; dormant until P10d (index.js:1970)', baseline: false, shipped: true },
  // ── src/config/featureFlags.js ──
  { name: 'SERVER_ATTEMPT_WRITE', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P0 change 3 table (:10) — pre-existing live', baseline: true, shipped: true },
  { name: 'SERVER_CHALLENGE_WRITE', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P0 change 3 (:20) — NEW, dormant until P4 cutover', baseline: false, shipped: true },
  { name: 'SERVER_REVIEW_MARKER', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P0 change 3 (:28) — NEW, dormant until P4', baseline: false, shipped: true },
  { name: 'LIST_SCOPED_RECON', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P0 change 3 table (:41) — pre-existing live (F-9)', baseline: true, shipped: true },
  { name: 'CONTINUATION_LINKS', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P8 CONT-A — dormant in baseline; feature-on at ship', baseline: false, shipped: true },
  { name: 'SERVER_PROGRESS_WRITE', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P4 FND-2 — NEW routing flag (folds plan-name LIST_PROGRESS_PERSIST read-routing per the const doc); dormant', baseline: false, shipped: true },
  { name: 'SERVER_RESET_PROGRESS', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P4 FND-2 v2 HIGH-3 — NEW; dormant', baseline: false, shipped: true },
  { name: 'CYCLING_ENABLED', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P9 CYC — NEW two-key cycling (client leg); dormant until P9', baseline: false, shipped: true },
  { name: 'SERVER_OVERRIDE', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P10 OVR — NEW; dormant until P10', baseline: false, shipped: true },
  { name: 'TEACHER_IDS_READ', file: 'src/config/featureFlags.js', src: 'FIX_PLAN P10c — NEW teacherIds read-surface; dormant until P10c', baseline: false, shipped: true },
  { name: 'REVIEW_PAIRING_V2', file: 'src/config/featureFlags.js', src: 'CS PR-1 · WI-2 (CS_2026-07-17_ROOT_CAUSE_EFFORT) — census-LOCKED I4 pairing predicate + 8→12 window; dormant until the PR-1 flip', baseline: false, shipped: true },
  { name: 'REENTRY_GUARD', file: 'src/config/featureFlags.js', src: 'CS PR-1 · WI-3 + F2 (CS_2026-07-17_ROOT_CAUSE_EFFORT) — I3 re-entry day-guard + retake queue + under-answered review confirm; dormant until the PR-1 flip', baseline: false, shipped: true },
  { name: 'RECOVERY_GUARD', file: 'src/config/featureFlags.js', src: 'CS PR-1 · WI-4 client (CS_2026-07-17_ROOT_CAUSE_EFFORT) — I6 recovery answer intersection; dormant until the PR-1 flip', baseline: false, shipped: true },
  // ── functions/foundation.js FOUNDATION_FLAGS (the 11 dormant server flags) ──
  { name: 'SERVER_COMPLETE_SESSION_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P3 — foundation flag, dormant at merge; P4 flips', baseline: false, shipped: true },
  { name: 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P3 — dormant; P4 flips', baseline: false, shipped: true },
  { name: 'SERVER_RESET_PROGRESS_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P3 — dormant; P4 flips (before P6 owner-delete removal)', baseline: false, shipped: true },
  { name: 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P3 change 9 (F5-HIGH-2) — dormant; P4 flips', baseline: false, shipped: true },
  { name: 'LIST_PROGRESS_CANONICAL', file: 'functions/foundation.js', src: 'FIX_PLAN P3 change 2 + P5 — the P5-ONLY mode switch; dormant until migration', baseline: false, shipped: true },
  { name: 'ANCHOR_VALIDATION_SHADOW', file: 'functions/foundation.js', src: 'FIX_PLAN P3 change 6 (M4) — dormant at merge; P3 DEPLOY flips for the ≥14d soak', baseline: false, shipped: true },
  { name: 'ANCHOR_VALIDATION_ENFORCE', file: 'functions/foundation.js', src: 'FIX_PLAN P3/P6(d) — M4 enforce; P6 only', baseline: false, shipped: true },
  { name: 'CYCLING_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P9 CYC — server two-key leg; dormant until P9', baseline: false, shipped: true },
  { name: 'SERVER_REVIEW_CHALLENGE_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P10 OVR — server reviewChallenge; dormant until P10', baseline: false, shipped: true },
  { name: 'SERVER_OVERRIDE_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P10 OVR — overrideAttempt; dormant until P10', baseline: false, shipped: true },
  { name: 'TEACHER_IDS_WRITE_ENABLED', file: 'functions/foundation.js', src: 'FIX_PLAN P10c — teacherIds denorm write; dormant until P10c', baseline: false, shipped: true },
  { name: 'REVIEW_ENGAGEMENT_STAMP_ENABLED', file: 'functions/foundation.js', src: 'CS PR-2 F3 — additive review-engagement stamp; dormant in tree, flips TRUE at the D2 functions deploy', baseline: false, shipped: true },
  { name: 'RECOVERY_SCORE_CLAMP_ENABLED', file: 'functions/foundation.js', src: 'CS PR-2 WI-4/I6 — server >100% score clamp; dormant in tree, flips TRUE at the D2 functions deploy', baseline: false, shipped: true },
];
const flagText = (file) => (file === 'functions/index.js' ? IDX : file === 'src/config/featureFlags.js' ? FF : FND);

// RET-2 retirement-inventory dead-branch signatures (FIX_PLAN P7 :666-674). Line numbers
// DRIFT — these are stable literal signatures + expected baseline counts.
const RET2_SIGS = [
  { key: 'dup_resume_branch', file: 'src/pages/DailySessionFlow.jsx', needle: 'existingState.phase === SESSION_PHASE.COMPLETE', baselineCount: 1,
    note: 'UNREACHABLE duplicate resume branch (I-2 finding 4; FIX_PLAN P7 DailySessionFlow.jsx:800-816). LIVE branch keys on config.startPhase; the dead copy keys on the deliberately-not-consulted session_state.phase.' },
  { key: 'neg_twi_passthrough', file: 'src/services/studyService.js', needle: 'LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)', baselineCount: 1,
    note: 'flag-OFF negative-TWI passthrough (I-2 finding 5; FIX_PLAN P7 studyService.js:1342). The flag-OFF else passes an unclamped newWordCount that can decrement TWI; retired when LIST_SCOPED_RECON is retired.' },
  { key: 'client_automarker', file: 'src/pages/DailySessionFlow.jsx', needle: 'all segment words mastered (21-day rest)', baselineCount: 1,
    note: 'client automarker leg (FIX_PLAN P7 DailySessionFlow.jsx:964-1008). The SERVER_REVIEW_MARKER=false else-branch client setDoc marker.' },
  { key: 'client_challenge_advance', file: 'src/services/db.js', needle: 'end SERVER_CHALLENGE_WRITE else — direct class_progress day-advance', baselineCount: 1,
    note: 'client reviewChallenge day-advance to class_progress (FIX_PLAN P7 db.js:2790-2833; routed server-side at P4 F5-HIGH-2).' },
];

// CUT-1 staged legacy sinks (the P4/bundle greps go ZERO after cutover; in baseline they
// must exist AND be governed by a SERVER_* flag = the dormant-draft signature). Each is a
// {sink literal, governing-flag literal} pair in the SAME file → cleanly determinable.
const CUT1_SINKS = [
  { key: 'challenge_class_progress_write', file: 'src/services/db.js', sink: 'currentStudyDay: currentDay + 1', guard: 'if (SERVER_CHALLENGE_WRITE)',
    note: 'direct class_progress day-advance write, in the SERVER_CHALLENGE_WRITE flag-off fallback (db.js:2923).' },
  { key: 'client_review_marker_create', file: 'src/pages/DailySessionFlow.jsx', sink: "setDoc(doc(db, 'attempts', markerId)", guard: 'if (SERVER_REVIEW_MARKER)',
    note: 'client attempt-create automarker, in the SERVER_REVIEW_MARKER flag-off fallback (DailySessionFlow.jsx:1053).' },
  { key: 'client_reset_attempt_delete', file: 'src/services/db.js', sink: 'const attemptsToDelete', guard: 'if (SERVER_RESET_PROGRESS)',
    note: 'client attempt batch-delete for reset, after the SERVER_RESET_PROGRESS early-return guard (db.js:2989) → flag-off fallback.' },
];

// ════════════════════════════════════════════════════════════════════════════
// Assertions
// ════════════════════════════════════════════════════════════════════════════
const A = [];
const add = (id, scenario, description, expected, actual, verdict, evidence) =>
  A.push({ id, scenario, description, expected, actual, verdict, evidence });

// ── DG-1 · flag-assertion table (one sub-row per flag; AUDIT_DESIGN §1.A DG-1) ──
for (const f of FLAG_TABLE) {
  const read = readBool(flagText(f.file), f.name);
  const exp = f[TARGET];
  let verdict, actual;
  if (!read.found) {
    // A flag the plan names but the code doesn't declare (e.g. LIST_PROGRESS_PERSIST is
    // folded, not declared). Genuinely-missing declaration = INVALID (can't certify a value).
    verdict = 'INVALID';
    actual = 'DECLARATION NOT FOUND';
  } else {
    actual = read.value;
    verdict = read.value === exp ? 'PASS' : 'FAIL';
  }
  add(`DG-1:${f.name}`, 'DG-1', `flag ${f.name} (${f.file}) == ${TARGET} expected`, exp, actual, verdict,
    `${f.file} declares ${f.name}=${read.found ? read.value : 'ABSENT'}. Source: ${f.src}`);
}

// ── DG-2 · deployed exports.version provenance probe (AUDIT_DESIGN §1.A DG-2) ──
add('DG-2', 'DG-2', 'deployed exports.version {sha,dirty,flags} == recorded deploy triple', 'probe==expected',
  'no-live-probe', 'SKIP', 'needs Codex: deployed exports.version HTTPS probe (no live network in M-STATIC).');

// ── DG-3 · hosting build-stamp live (AUDIT_DESIGN §1.A DG-3) ──
add('DG-3', 'DG-3', 'served bundle exposes commit sha == recorded hosting sha', 'stamp==hostingSha',
  'no-live-probe', 'SKIP', 'needs Codex: deployed hosting build-stamp probe.');

// ── DG-4 (git half) · #11 files have commits + fix-unique string + bundle hygiene (AUDIT_DESIGN §1.A DG-4) ──
{
  const files11 = ['src/services/studyService.js', 'src/pages/DailySessionFlow.jsx', 'src/pages/Dashboard.jsx'];
  const commitEvidence = files11.map((fp) => {
    const log = (() => { try { return execFileSync('git', ['log', '--oneline', '-n', '1', '--', fp], { cwd: REPO, encoding: 'utf8' }).trim(); } catch (e) { return (e.stdout ? String(e.stdout) : '').trim(); } })();
    return { fp, hasCommit: !!log, top: log.split('\n')[0] || null };
  });
  const allHaveCommits = commitEvidence.every((c) => c.hasCommit);

  // Fix-unique string: full copy is "Couldn't Grade — Please Reload" (typographic
  // apostrophe + em-dash). Grep the robustly-greppable substring "Please Reload"
  // (unique to TypedTest.jsx across src/) to avoid punctuation-encoding fragility.
  const fixStr = countInFile('src/pages/TypedTest.jsx', 'Please Reload');
  const fixPresent = fixStr.found && fixStr.count > 0;

  // Hygiene: no audit/ or scripts/ path IMPORTED/required from within src/ (comments are
  // benign — Signup.jsx mentions scripts/cs in prose, which must NOT trip this).
  const badImports = treeGrep('scripts/', ['src'], ['*.js', '*.jsx'])
    .concat(treeGrep('audit/', ['src'], ['*.js', '*.jsx']))
    .filter((row) => /^\s*(import|export|const|let|var)\b/.test(row.split(/:\d+:/).slice(1).join('')) ||
                     /\b(import|require)\s*\(/.test(row) ||
                     /\bfrom\s+['"][^'"]*(audit\/|scripts\/)/.test(row));
  const hygieneClean = badImports.length === 0;

  if (TARGET === 'baseline') {
    const pass = allHaveCommits && fixPresent && hygieneClean;
    add('DG-4', 'DG-4', '#11 files have git-log commits + fix-unique string present + no audit/scripts import from src',
      'commits∧fixStr∧hygiene', `commits=${allHaveCommits} fixStr=${fixPresent} hygiene=${hygieneClean}`,
      pass ? 'PASS' : 'FAIL',
      `commits: ${commitEvidence.map((c) => `${c.fp}→${c.top || 'NONE'}`).join(' | ')}. ` +
      `fix-unique "Please Reload" ×${fixStr.count} in TypedTest.jsx (full: "Couldn't Grade — Please Reload"). ` +
      `audit/scripts imports from src: ${badImports.length ? badImports.join(' ; ') : 'none'}.`);
  } else {
    // shipped keeps the git/hygiene invariants (still true post-retire) — same PASS logic.
    const pass = allHaveCommits && fixPresent && hygieneClean;
    add('DG-4', 'DG-4', '#11 commits + fix string + hygiene (invariant across phases)',
      'commits∧fixStr∧hygiene', `commits=${allHaveCommits} fixStr=${fixPresent} hygiene=${hygieneClean}`,
      pass ? 'PASS' : 'FAIL',
      `commits present=${allHaveCommits}; fixStr=${fixPresent}; hygiene badImports=${badImports.length}.`);
  }
}

// ── DG-4b (bundle leg) · built bundle greps positive for fix string, negative for audit/scripts
//    (AUDIT_DESIGN §1.A DG-4 bundle). Runs against local dist/ if present, else SKIP. ──
if (DIST_PRESENT) {
  const fixInDist = treeGrep('Please Reload', ['dist/assets'], ['*.js']).length;
  const auditInDist = treeGrep('audit/deepfix', ['dist/assets'], ['*.js']).length
    + treeGrep('scripts/cs', ['dist/assets'], ['*.js']).length;
  const pass = fixInDist > 0 && auditInDist === 0;
  add('DG-4b', 'DG-4', 'built bundle greps positive for fix string + negative for audit/scripts content',
    'fix>0 ∧ audit==0', `fixInDist=${fixInDist} auditInDist=${auditInDist}`, pass ? 'PASS' : 'FAIL',
    `${DIST_NOTE}. "Please Reload" in ${fixInDist} dist asset(s); audit/scripts refs in ${auditInDist}.`);
} else {
  add('DG-4b', 'DG-4', 'built bundle fix-string + hygiene greps', 'fix>0 ∧ audit==0', 'no-dist', 'SKIP',
    'needs Codex: deployed probe / built bundle (no dist/ present).');
}

// ── CUT-1 (SOURCE-grep proxy) · staged legacy progress-writes/attempt-delete are all
//    flag-guarded (baseline) / gone (shipped) (AUDIT_DESIGN §1.E CUT-1) ──
{
  const sinkRows = CUT1_SINKS.map((s) => {
    const present = countInFile(s.file, s.sink);
    const guard = countInFile(s.file, s.guard);
    return { ...s, present: present.count, guarded: guard.count > 0 };
  });
  // A safety scan: any client attempt-delete on the `attempts` collection that is NOT in a
  // file governed by SERVER_RESET_PROGRESS = an UNGUARDED delete (the thing CUT-1 forbids).
  const attemptDeleteFiles = treeGrep('attemptsToDelete', ['src'], ['*.js', '*.jsx'])
    .map((r) => r.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i);
  const unguardedDeletes = attemptDeleteFiles.filter((fp) => {
    const t = readFile(fp);
    return !(t && t.includes('SERVER_RESET_PROGRESS'));
  });

  if (TARGET === 'baseline') {
    const allPresentGuarded = sinkRows.every((r) => r.present > 0 && r.guarded);
    const noUnguarded = unguardedDeletes.length === 0;
    // Clean determination: every sink literal co-located with its SERVER_* guard literal in
    // the same file. If a sink is present but its guard literal is absent we cannot prove it
    // is dormant-guarded → INVALID (never a false PASS), per the task's precision rule.
    const anyPresentButUnguarded = sinkRows.some((r) => r.present > 0 && !r.guarded);
    let verdict = allPresentGuarded && noUnguarded ? 'PASS' : (anyPresentButUnguarded ? 'INVALID' : 'FAIL');
    add('CUT-1', 'CUT-1', 'baseline: staged client progress-writes/attempt-delete PRESENT and each SERVER_*-flag-guarded (dormant-draft), zero unguarded attempt-delete',
      'all sinks present∧guarded; 0 unguarded', `sinks=${sinkRows.map((r) => `${r.key}:present=${r.present},guarded=${r.guarded}`).join('; ')}; unguardedDeletes=${unguardedDeletes.length}`,
      verdict,
      sinkRows.map((r) => `${r.file} — ${r.note} [present×${r.present}, guard '${r.guard}'=${r.guarded}]`).join(' || ') +
      (unguardedDeletes.length ? ` || UNGUARDED attempt-delete files: ${unguardedDeletes.join(', ')}` : ' || no unguarded attempt-delete'));
  } else {
    // shipped: the cutover removed every direct client sink → all counts 0.
    const totalPresent = sinkRows.reduce((n, r) => n + r.present, 0) + attemptDeleteFiles.length;
    add('CUT-1', 'CUT-1', 'shipped: ZERO direct client progress-writes / ZERO client attempt-delete (bundle greps clean)',
      '0 sinks', `totalPresentSinks=${totalPresent}`, totalPresent === 0 ? 'PASS' : 'FAIL',
      sinkRows.map((r) => `${r.key} present×${r.present}`).join('; ') + `; attemptDeleteFiles=${attemptDeleteFiles.length}`);
  }
}

// ── CUT-1b (bundle leg) · class_progress readers/writers in the built bundle
//    (AUDIT_DESIGN §1.E CUT-1 bundle). dist/ if present, else SKIP. ──
if (DIST_PRESENT) {
  const cpInDist = treeGrep('class_progress', ['dist/assets'], ['*.js']).length;
  if (TARGET === 'baseline') {
    // Dormant-draft: legacy paths are still bundled (flags off) → present is EXPECTED.
    add('CUT-1b', 'CUT-1', 'baseline: class_progress present in built bundle (dormant legacy paths still shipped) — report-only',
      'present (dormant)', `assetsWithClassProgress=${cpInDist}`, cpInDist > 0 ? 'PASS' : 'FAIL',
      `${DIST_NOTE}. class_progress in ${cpInDist} dist asset(s) — expected present in baseline (goes 0 only after P4 cutover + P7 retire).`);
  } else {
    add('CUT-1b', 'CUT-1', 'shipped: ZERO class_progress readers/writers in built bundle',
      '0', `assetsWithClassProgress=${cpInDist}`, cpInDist === 0 ? 'PASS' : 'FAIL',
      `${DIST_NOTE}. class_progress in ${cpInDist} dist asset(s).`);
  }
} else {
  add('CUT-1b', 'CUT-1', 'built bundle class_progress grep', TARGET === 'shipped' ? '0' : 'present', 'no-dist', 'SKIP',
    'needs Codex: deployed probe / built bundle (no dist/ present).');
}

// ── RET-1 · class_progress readers/writers tree-wide (AUDIT_DESIGN §1.H RET-1) ──
{
  const dirs = ['src', 'functions', 'scripts/cs'];
  const rows = treeGrep('class_progress', dirs, ['*.js', '*.jsx', '*.mjs']);
  const count = rows.length;
  const byDir = dirs.map((d) => `${d}=${rows.filter((r) => r.startsWith(d + '/')).length}`).join(' ');
  if (TARGET === 'baseline') {
    add('RET-1', 'RET-1', 'baseline: class_progress readers/writers exist tree-wide (report count; expected > 0, not retired yet)',
      '> 0', count, count > 0 ? 'PASS' : 'FAIL', `class_progress refs: ${count} (${byDir}). Nothing retired in baseline.`);
  } else {
    add('RET-1', 'RET-1', 'shipped: ZERO class_progress readers/writers tree-wide (src + functions + scripts/cs)',
      '0', count, count === 0 ? 'PASS' : 'FAIL', `class_progress refs: ${count} (${byDir}).`);
  }
}

// ── RET-2 · retirement-inventory dead-branch signatures (AUDIT_DESIGN §1.H RET-2) ──
for (const s of RET2_SIGS) {
  const c = countInFile(s.file, s.needle);
  if (TARGET === 'baseline') {
    const pass = c.found && c.count === s.baselineCount;
    add(`RET-2:${s.key}`, 'RET-2', `baseline: dead-branch signature PRESENT (${s.key})`,
      `count==${s.baselineCount}`, c.count, pass ? 'PASS' : (c.found ? 'FAIL' : 'INVALID'),
      `${s.file} :: "${s.needle}" ×${c.count}. ${s.note}`);
  } else {
    const pass = c.count === 0;
    add(`RET-2:${s.key}`, 'RET-2', `shipped: dead-branch signature ABSENT (${s.key})`,
      '0', c.count, pass ? 'PASS' : 'FAIL', `${s.file} :: "${s.needle}" ×${c.count}. ${s.note}`);
  }
}

// ── RET-4 · flag lifecycle (AUDIT_DESIGN §1.H RET-4; FIX_PLAN P7 :675-679) ──
{
  // FIX_PLAN P7 transitional list (exact names). Presence checked against ACTUAL declarations
  // (some plan names are folded — recorded, not asserted as a bug).
  const transitional = [
    { name: 'LIST_SCOPED_RECON', file: 'src/config/featureFlags.js' },
    { name: 'LIST_PROGRESS_PERSIST', file: 'src/config/featureFlags.js', folded: 'SERVER_PROGRESS_WRITE (read-routing leg)' },
    { name: 'SERVER_PROGRESS_WRITE', file: 'src/config/featureFlags.js' },
    { name: 'SERVER_RESET_PROGRESS', file: 'src/config/featureFlags.js' },
    { name: 'SERVER_CHALLENGE_WRITE', file: 'src/config/featureFlags.js' },
    { name: 'SERVER_REVIEW_MARKER', file: 'src/config/featureFlags.js' },
    { name: 'LIST_PROGRESS_CANONICAL', file: 'functions/foundation.js' },
  ];
  const decl = (name, file) => readBool(flagText(file), name).found;
  const present = transitional.filter((t) => decl(t.name, t.file)).map((t) => t.name);
  const folded = transitional.filter((t) => t.folded && !decl(t.name, t.file)).map((t) => `${t.name}→${t.folded}`);
  const contPresent = readBool(FF, 'CONTINUATION_LINKS').found;

  if (TARGET === 'baseline') {
    // baseline: transitional flags PRESENT (declared) + CONTINUATION_LINKS present.
    const declaredCount = transitional.filter((t) => !t.folded).length; // the ones with a real decl
    const pass = present.length === declaredCount && contPresent;
    add('RET-4', 'RET-4', 'baseline: transitional flags PRESENT + CONTINUATION_LINKS present (not orphaned)',
      `${declaredCount} transitional present ∧ CONTINUATION_LINKS present`,
      `present=${present.length} contLinks=${contPresent}`, pass ? 'PASS' : 'FAIL',
      `declared transitional: ${present.join(', ')}. folded (plan-name, no separate decl): ${folded.join(', ') || 'none'}. CONTINUATION_LINKS declared=${contPresent}.`);
  } else {
    // shipped: transitional flags ABSENT (retired with both-sides paths) + CONTINUATION_LINKS present.
    const pass = present.length === 0 && contPresent;
    add('RET-4', 'RET-4', 'shipped: transitional flags ABSENT (retired) + CONTINUATION_LINKS still present',
      '0 transitional ∧ CONTINUATION_LINKS present', `present=${present.length} contLinks=${contPresent}`,
      pass ? 'PASS' : 'FAIL',
      `still-declared transitional (should be 0): ${present.join(', ') || 'none'}. CONTINUATION_LINKS declared=${contPresent}.`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Summary + fail-closed exit + artifacts
// ════════════════════════════════════════════════════════════════════════════
const summary = { pass: 0, fail: 0, invalid: 0, skip: 0 };
for (const a of A) {
  if (a.verdict === 'PASS') summary.pass++;
  else if (a.verdict === 'FAIL') summary.fail++;
  else if (a.verdict === 'INVALID') summary.invalid++;
  else if (a.verdict === 'SKIP') summary.skip++;
}
const clean = summary.fail === 0 && summary.invalid === 0;

const manifest = {
  matrix: 'M-STATIC',
  module: 'lsr_deepfix_static.mjs',
  runId: RUN_ID,
  target: TARGET,
  git: { head: GIT_HEAD, short: GIT_SHORT, dirty: DIRTY, dirtyCount: DIRTY_ROWS.length },
  flagFilesDirty: DIRTY_ROWS.filter((r) => /functions\/index\.js|featureFlags\.js|functions\/foundation\.js/.test(r)),
  dist: { present: DIST_PRESENT, note: DIST_NOTE },
  startedAt: STARTED,
  finishedAt: new Date().toISOString(),
  summary,
  verdict: clean ? 'CLEAN' : 'NOT_CLEAN',
  assertions: A,
};

if (!existsSync(FINDINGS)) mkdirSync(FINDINGS, { recursive: true });
const jsonPath = resolve(FINDINGS, `deepfix_static_${RUN_ID}.json`);
const mdPath = resolve(FINDINGS, `deepfix_static_${RUN_ID}.md`);
writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));

// Human table
const icon = (v) => (v === 'PASS' ? '✅' : v === 'FAIL' ? '❌' : v === 'INVALID' ? '⛔' : '⏭️');
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [
  `# M-STATIC — deepfix static certifier`,
  ``,
  `- **runId:** \`${RUN_ID}\`  **target:** \`${TARGET}\``,
  `- **git:** \`${GIT_SHORT}\` (HEAD \`${GIT_HEAD}\`) dirty=${DIRTY} (${DIRTY_ROWS.length} paths)`,
  `- **dist:** ${DIST_NOTE}`,
  `- **flag files dirty:** ${manifest.flagFilesDirty.map((r) => r.trim()).join(', ') || 'none'}`,
  `- **run:** ${STARTED}`,
  ``,
  `**FINAL: ${clean ? 'CLEAN' : 'NOT_CLEAN'}** target=${TARGET} pass=${summary.pass} fail=${summary.fail} invalid=${summary.invalid} skip=${summary.skip}`,
  ``,
  `| | ID | Scenario | Expected | Actual | Verdict |`,
  `|---|---|---|---|---|---|`,
  ...A.map((a) => `| ${icon(a.verdict)} | ${esc(a.id)} | ${esc(a.scenario)} | ${esc(a.expected)} | ${esc(a.actual)} | **${a.verdict}** |`),
  ``,
  `## Evidence`,
  ...A.map((a) => `- **${a.id}** (${a.verdict}): ${esc(a.evidence)}`),
  ``,
].join('\n');
writeFileSync(mdPath, md);

// Console
console.log(`\n=== M-STATIC (${RUN_ID}, target=${TARGET}) — git ${GIT_SHORT} dirty=${DIRTY} ===`);
for (const a of A) console.log(`  ${icon(a.verdict)} ${a.id.padEnd(34)} ${a.verdict.padEnd(7)} ${esc(a.description)}`);
console.log(`\nartifacts:\n  ${jsonPath}\n  ${mdPath}`);
console.log(`\nFINAL: ${clean ? 'CLEAN' : 'NOT_CLEAN'} target=${TARGET} pass=${summary.pass} fail=${summary.fail} invalid=${summary.invalid} skip=${summary.skip}`);
process.exit(clean ? 0 : 1);
