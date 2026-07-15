/**
 * lsr_deepfix_flag_on.mjs — DISPOSABLE flag-ON helper for the emulator matrices
 * ============================================================================
 * The deepfix flags are BUILD-TIME code constants (OFF in the working tree). To
 * exercise the flag-ON END-STATE against the Firebase emulator, this helper
 * writes the flag-ON state, lets `emulators:exec` load the flag-ON functions,
 * then GUARANTEES a restore.
 *
 *   • --matrix=call : flips the server FOUNDATION_FLAGS in functions/foundation.js
 *     (SERVER_COMPLETE_SESSION_ENABLED / SERVER_RESOLVE_LIST_PROGRESS_ENABLED /
 *      SERVER_RESET_PROGRESS_ENABLED / SERVER_ADVANCE_FOR_CHALLENGE_ENABLED /
 *      LIST_PROGRESS_CANONICAL / ANCHOR_VALIDATION_SHADOW / ANCHOR_VALIDATION_ENFORCE /
 *      CYCLING_ENABLED / SERVER_REVIEW_CHALLENGE_ENABLED / SERVER_OVERRIDE_ENABLED /
 *      TEACHER_IDS_WRITE_ENABLED)  + the client routing flags in
 *      src/config/featureFlags.js (coherent P10 end-state).  GRADE_TOKEN_ENFORCED
 *      stays OFF unless --grade-enforced (it is secret-backed — see CS-7/CS-10).
 *   • --matrix=rules : the rules artifact IS the working-tree firestore.rules (the
 *      P10d END-STATE). Default: NO edits (rules do not read JS flags). Optional
 *      --rules-stage=p6|p10c copies audit/deepfix/task3/firestore.<stage>.rules over
 *      firestore.rules so the emulator loads that STAGE (backed up + restored).
 *
 * MODES:
 *   --exec "<command>"  (RECOMMENDED): apply → run <command> → ALWAYS restore in a
 *                        finally + SIGINT/SIGTERM/exit handlers. NEVER commits, NEVER
 *                        leaves flags ON. This is the guaranteed-restore path.
 *   --apply             apply flag-ON + record a lock (manual 3-step choreography).
 *   --restore           restore from the lock (verbatim backups) + clear the lock.
 *
 * SAFETY: a saved verbatim backup per touched file; a single active lock (refuses a
 * double-apply that would capture an already-flipped file as the "original"); restore
 * verifies BYTE-EQUALITY against the backup; a LOUD banner + nonzero exit if restore
 * fails (lock kept so `--restore` can retry). It NEVER runs git; it only reads/writes files.
 *
 *   node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --exec "firebase emulators:exec \
 *     --only functions,firestore,auth --project demo-vocaboost \
 *     \"node audit/playwright/lsr_deepfix_callable.mjs <runId>\""
 * ============================================================================
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const FINDINGS = resolve(HERE, 'findings');
const LOCK = resolve(FINDINGS, '.flag_on.lock.json');

// ── Args (support both `--k=v` and `--k v`; bare presence for booleans) ──
const argv = process.argv.slice(2);
const has = (k) => argv.some((a) => a === `--${k}` || a.startsWith(`--${k}=`));
/** Returns the string value of a value-bearing flag, or `true` (presence w/o value), or undefined. */
const getVal = (k) => {
  const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`));
  if (i === -1) return undefined;
  const a = argv[i];
  if (a.includes('=')) return a.slice(a.indexOf('=') + 1);
  const next = argv[i + 1];
  return (next != null && !next.startsWith('--')) ? next : true;
};
const str = (k, d) => { const v = getVal(k); return typeof v === 'string' ? v : d; };
const MATRIX = str('matrix', 'call');
const RUN_ID = str('run', `${Date.now()}`);
const GRADE_ENFORCED = has('grade-enforced');
const RULES_STAGE = str('rules-stage', null);
const EXEC_CMD = str('exec', null);
const DO_APPLY = has('apply');
const DO_RESTORE = has('restore');

if (!['call', 'rules', 'all'].includes(MATRIX)) { console.error(`--matrix must be call|rules|all (got ${MATRIX})`); process.exit(2); }

// ── The per-matrix flag-set map (file → const names flipped to true) ──
const FOUNDATION_FLAGS = [
  'SERVER_COMPLETE_SESSION_ENABLED', 'SERVER_RESOLVE_LIST_PROGRESS_ENABLED',
  'SERVER_RESET_PROGRESS_ENABLED', 'SERVER_ADVANCE_FOR_CHALLENGE_ENABLED',
  'LIST_PROGRESS_CANONICAL', 'ANCHOR_VALIDATION_SHADOW', 'ANCHOR_VALIDATION_ENFORCE',
  'CYCLING_ENABLED', 'SERVER_REVIEW_CHALLENGE_ENABLED', 'SERVER_OVERRIDE_ENABLED',
  'TEACHER_IDS_WRITE_ENABLED',
];
const CLIENT_FLAGS = [
  'SERVER_CHALLENGE_WRITE', 'SERVER_REVIEW_MARKER', 'CONTINUATION_LINKS',
  'SERVER_PROGRESS_WRITE', 'CYCLING_ENABLED', 'SERVER_RESET_PROGRESS',
  'SERVER_OVERRIDE', 'TEACHER_IDS_READ',
];
/** Returns [{file, flags:[names]}] to flip for the selected matrix. */
function planFor(matrix) {
  if (matrix === 'rules') {
    // Rules do not read JS flags — the artifact is firestore.rules (default: working-tree P10d).
    return []; // (--rules-stage handled separately)
  }
  const plan = [
    { file: 'functions/foundation.js', flags: [...FOUNDATION_FLAGS] },
    { file: 'src/config/featureFlags.js', flags: [...CLIENT_FLAGS] },
  ];
  if (GRADE_ENFORCED) plan.push({ file: 'functions/index.js', flags: ['GRADE_TOKEN_ENFORCED'] });
  return plan;
}

function banner(lines) {
  const w = Math.max(...lines.map((l) => l.length), 60);
  const bar = '='.repeat(w + 4);
  console.log(`\n${bar}`);
  for (const l of lines) console.log(`| ${l.padEnd(w)} |`);
  console.log(`${bar}\n`);
}

/** Flip `const NAME = false;` → `const NAME = true;` in text. Returns {text, flipped, already, missing}. */
function flip(text, name) {
  const re = new RegExp(`^(\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*)false(\\s*;)`, 'm');
  if (re.test(text)) return { text: text.replace(re, `$1true$2`), flipped: true };
  const already = new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*true\\s*;`, 'm').test(text);
  return { text, flipped: false, already, missing: !already };
}

// ── Restore (SYNCHRONOUS so it is safe inside process 'exit' / signal handlers) ──
let _restored = false;
function restore({ loud = true } = {}) {
  if (_restored) return true;
  if (!existsSync(LOCK)) { if (loud) console.log('[flag_on] no active lock — nothing to restore.'); _restored = true; return true; }
  let lock;
  try { lock = JSON.parse(readFileSync(LOCK, 'utf8')); } catch (e) { banner(['RESTORE FAILED: lock unreadable', String(e.message), 'Manually revert the flag files from git / the backup dir.']); return false; }
  let allOk = true;
  for (const f of lock.files) {
    try {
      copyFileSync(f.backup, resolve(REPO, f.path)); // verbatim restore
      const restored = readFileSync(resolve(REPO, f.path), 'utf8');
      const backup = readFileSync(f.backup, 'utf8');
      if (restored !== backup) { allOk = false; console.error(`[flag_on] byte-mismatch after restoring ${f.path}`); }
      else console.log(`[flag_on] restored ${f.path}`);
    } catch (e) { allOk = false; console.error(`[flag_on] FAILED to restore ${f.path}: ${e.message}`); }
  }
  if (!allOk) {
    banner([
      '⚠⚠  FLAG-ON RESTORE FAILED  ⚠⚠',
      'One or more flag files were NOT reverted.',
      `Backups: ${lock.backupDir}`,
      'Re-run: node audit/playwright/lsr_deepfix_flag_on.mjs --restore',
      'DO NOT deploy / commit until the flag files match the backups.',
    ]);
    return false; // keep the lock so --restore can retry
  }
  try { rmSync(lock.backupDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  try { rmSync(LOCK, { force: true }); } catch { /* best-effort */ }
  _restored = true;
  if (loud) console.log('[flag_on] restore complete — flags OFF, working tree reverted to pre-apply state.');
  return true;
}

// ── Apply ──
function apply() {
  if (existsSync(LOCK)) {
    banner(['REFUSING TO APPLY: an active flag-on lock already exists.', 'Run `--restore` first (a double-apply would back up an already-flipped file).']);
    process.exit(2);
  }
  const backupDir = resolve(FINDINGS, `flag_on_backup_${RUN_ID}`);
  mkdirSync(backupDir, { recursive: true });
  const plan = planFor(MATRIX);
  const lockFiles = [];
  const touched = [];

  // JS-flag flips
  for (const { file, flags } of plan) {
    const abs = resolve(REPO, file);
    if (!existsSync(abs)) { console.warn(`[flag_on] skip (missing): ${file}`); continue; }
    const original = readFileSync(abs, 'utf8');
    const backup = resolve(backupDir, file.replace(/[\\/]/g, '__'));
    writeFileSync(backup, original); // verbatim backup FIRST
    let text = original;
    const changed = [];
    for (const name of flags) {
      const r = flip(text, name);
      if (r.flipped) { text = r.text; changed.push(name); }
      else if (r.already) console.log(`[flag_on] ${file}: ${name} already true`);
      else console.warn(`[flag_on] ${file}: ${name} NOT FOUND (flag map drift?)`);
    }
    if (text !== original) writeFileSync(abs, text);
    lockFiles.push({ path: file, backup });
    touched.push(`${file}: ${changed.join(', ') || '(none)'}`);
  }

  // Optional rules-stage swap (M-RULES)
  if (MATRIX === 'rules' && RULES_STAGE) {
    const src = resolve(REPO, `audit/deepfix/task3/firestore.${RULES_STAGE}.rules`);
    const dst = resolve(REPO, 'firestore.rules');
    if (!existsSync(src)) { console.error(`[flag_on] --rules-stage=${RULES_STAGE}: ${src} not found`); process.exit(2); }
    const backup = resolve(backupDir, 'firestore.rules');
    writeFileSync(backup, readFileSync(dst, 'utf8'));
    copyFileSync(src, dst);
    lockFiles.push({ path: 'firestore.rules', backup });
    touched.push(`firestore.rules ← firestore.${RULES_STAGE}.rules`);
  }

  writeFileSync(LOCK, JSON.stringify({ matrix: MATRIX, runId: RUN_ID, appliedAt: new Date().toISOString(), backupDir, files: lockFiles }, null, 2));
  banner([
    `FLAG-ON APPLIED (matrix=${MATRIX}, run=${RUN_ID})`,
    ...touched,
    `backups: ${backupDir}`,
    'RESTORE IS MANDATORY: --restore (or use --exec for a guaranteed restore).',
  ]);
  if (MATRIX === 'rules' && !RULES_STAGE) console.log('[flag_on] matrix=rules: no JS edits — the artifact under test is the working-tree firestore.rules (P10d final).');
}

// ── Main ──
if (DO_RESTORE) {
  process.exit(restore() ? 0 : 1);
} else if (EXEC_CMD && typeof EXEC_CMD === 'string') {
  // GUARANTEED-RESTORE MODE: apply → run the command → ALWAYS restore.
  apply();
  const onSignal = (sig) => { console.log(`\n[flag_on] caught ${sig} — restoring flags before exit.`); restore(); process.exit(1); };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('exit', () => { restore({ loud: false }); }); // last-resort sync restore
  let code = 1;
  try {
    console.log(`[flag_on] exec: ${EXEC_CMD}`);
    const env = { ...process.env, CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', NO_UPDATE_NOTIFIER: '1' };
    const r = spawnSync(EXEC_CMD, { cwd: REPO, stdio: 'inherit', shell: true, env });
    code = r.status == null ? 1 : r.status;
  } finally {
    restore(); // primary restore (the 'exit' handler is only a backstop)
  }
  process.exit(code);
} else if (DO_APPLY) {
  apply();
  process.exit(0);
} else {
  console.error('Usage: --matrix=call|rules [--exec "<cmd>" | --apply | --restore] [--grade-enforced] [--rules-stage=p6|p10c] [--run=<id>]');
  process.exit(2);
}
