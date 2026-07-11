/**
 * LSR — F02/F03 ACCEPTANCE RUN (hardened, forward-only, Admin-free at runtime).
 *
 * Rebuilt after Codex NO-GO (2026-07-05). Fixes the four blockers:
 *   B1  No Admin mutation here. This process NEVER imports firebase-admin. Every actor
 *       state is built FORWARD-ONLY through the real UI (teacher creates a fresh class +
 *       assigns; a fresh never-reused student joins + studies). Read-only CSD/TWI
 *       verification is a SEPARATE process (lsr_snapshot.mjs) run after this closes.
 *   B2  TA1 cannot false-pass: hard PRECONDITIONS abort→INVALID (never PASS) if unmet;
 *       the flip assertion compares the EXACT TOP label and requires CORE to actually
 *       appear as an option (proving the condition was exercised). null/loading/retry = FAIL.
 *   B3  TA2 tests the full F03 contract with SCENARIO-CONTROLLED dialogs (dismiss→verify
 *       preserved; accept→verify unassigned + access lost; exact warning text).
 *   B4  Nonzero exit on ANY fail/invalid/error; a broken precondition SKIPS dependent
 *       checks as INVALID (a recovered defect still stays a finding).
 *
 * Credentials from LSR_AUDIT_PW / gitignored secret (never hard-coded).
 * Sandbox only (25WT lsr_* accounts). Fresh classes are named "25WT ACC …" and are
 * disposable (a separate admin cleanup may remove them later).
 *
 *   LSR_AUDIT_PW=… NODE_PATH=/app/node_modules node audit/playwright/lsr_accept.mjs [SCENARIO...]
 *   (no args = run all)
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import {
  AUD, sleep, makeFindings, launch, newAuditPage, login, goDashboard,
  joinClass, studyOneDay, shot, readFocusList, listSelectorOptions, readVisibleProgress,
} from './lsr_ui.mjs';
import { createClass, assignList, unassignList, readJoinCode } from './lsr_teacher.mjs';

const TOP = 'LSR TOP Vocab (audit clone)';
const CORE = 'LSR CORE Vocab (audit clone)';
const LIST_ID = { [TOP]: 'EQ0Dc9rb7gvoerflHlnz', [CORE]: 'aDVcq3MoCvVYPTpb83IU' }; // clone doc ids (for the read-only post-verifier only)
const TEACHER = 'lsr_teacher_01@vocaboost.test';
const OPTS = { pace: 80, thr: 92, mode: 'typed', testSize: 30 };
const RUN = Date.now().toString(36);

// ---- forward-only fresh-student allocator ----
// Codex blocker: a local "used" list is NOT proof of cleanliness — lsr_prep.mjs already used
// the lsr_s* pool, so saved focus/progress can remain and TA1 could pass via the saved-pref
// path. We allocate ONLY from lsr_clean_accounts.json, which lsr_preflight.mjs (read-only,
// separate process) produced by PROVING each account has no saved focus / progress / attempts.
// Codex #2: clear any stale matrix/manifest BEFORE any prerequisite check — an early exit
// (missing/stale preflight) must NOT leave an old passing artifact the post-verifier reuses.
for (const f of ['lsr_accept_matrix.json', 'lsr_accept_manifest.json']) { try { rmSync(`${AUD}/${f}`); } catch { /* absent */ } }
const CLEAN_PATH = `${AUD}/lsr_clean_accounts.json`;
if (!existsSync(CLEAN_PATH)) { console.error('missing lsr_clean_accounts.json — run lsr_preflight.mjs (read-only) FIRST to prove clean accounts'); process.exit(2); }
const CLEAN = JSON.parse(readFileSync(CLEAN_PATH, 'utf8'));
const CLEAN_EMAILS = CLEAN.clean || [];
const CLEAN_AGE_H = (Date.now() - Date.parse(CLEAN.generatedAt || 0)) / 3.6e6;
// Codex #5: an allowlist goes stale fast (another run/prep can dirty accounts). Enforce it.
const MAX_CLEAN_AGE_H = 6;
if (!(CLEAN_AGE_H >= 0) || CLEAN_AGE_H > MAX_CLEAN_AGE_H) {
  console.error(`lsr_clean_accounts.json is ${Number.isFinite(CLEAN_AGE_H) ? CLEAN_AGE_H.toFixed(1) + 'h' : 'undated'} (> ${MAX_CLEAN_AGE_H}h) — re-run lsr_preflight.mjs immediately before the acceptance run`);
  process.exit(2);
}
const STATE_PATH = `${AUD}/lsr_accept_state.json`;
const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : { used: [] };
function freshStudent() {
  const s = CLEAN_EMAILS.find((e) => !state.used.includes(e));
  if (!s) throw new Error(`out of PREFLIGHT-CLEAN students (${CLEAN_EMAILS.length} clean, ${state.used.length} used) — provision fresh lsr_* accounts + re-run lsr_preflight.mjs`);
  state.used.push(s);
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  return s;
}

const F = makeFindings(`ACCEPT_${new Date().toISOString().slice(0, 10)}`);
const RESULTS = [];       // [{id,name,status,checks:[{name,status,detail}]}]
const MANIFEST = [];      // for the separate read-only CSD/TWI snapshot

class Precond extends Error {}
function scenario(id, name) { const s = { id, name, status: 'PASS', checks: [] }; RESULTS.push(s); return s; }
function check(s, name, cond, detail = '') {
  const status = cond ? 'PASS' : 'FAIL';
  s.checks.push({ name, status, detail });
  if (!cond && s.status !== 'INVALID') s.status = 'FAIL';
  F.add(cond ? 'CHECK-PASS' : 'CHECK-FAIL', `[${s.id}] ${name}${detail ? ` — ${detail}` : ''}`);
  return cond;
}
// A precondition that MUST hold or the scenario is INVALID (dependent checks skipped) —
// never a false PASS. `probe` is a boolean OR an async predicate. When a `page` is given AND
// probe is a predicate, a failed check is RE-EVALUATED after one reload (real recovery, not a
// re-use of a stale boolean — Codex fix). Boolean probes (action results like login/join) get
// no recovery.
async function need(s, name, probe, detail = '', page = null) {
  const isFn = typeof probe === 'function';
  const evalOnce = async () => (isFn ? !!(await probe()) : !!probe);
  let ok = await evalOnce();
  if (!ok && page && isFn) {
    F.add('recovery', `[${s.id}] precondition "${name}" unmet → reload + RE-CHECK`);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(3500);
    ok = await evalOnce(); // actually recomputed
    F.add('recovery', `[${s.id}] "${name}" after reload → ${ok ? 'RECOVERED ✓' : 'still failing'}`);
  }
  s.checks.push({ name, status: ok ? 'PASS' : 'INVALID', detail });
  if (!ok) { s.status = 'INVALID'; F.add('PRECOND-FAIL', `[${s.id}] ${name} — ${detail}`); throw new Precond(name); }
  F.add('PRECOND-OK', `[${s.id}] ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function canReachList(page, title) {
  await goDashboard(page);
  const focus = await readFocusList(page, { timeout: 6000 }).catch(() => null);
  if (focus && focus.includes(title)) return true;
  const { options } = await listSelectorOptions(page).catch(() => ({ options: [] }));
  return options.some((o) => o.includes(title));
}

// Forward-only: teacher creates a fresh class + assigns the given lists (in order), returns
// { className, code }. The class is brand-new so it needs no reset.
async function makeClass(teacherPage, tag, lists) {
  const className = `25WT ACC ${tag} ${RUN}`;
  await createClass(teacherPage, className, F);
  for (const l of lists) await assignList(teacherPage, className, l.title, l.opts || OPTS, F);
  const code = await readJoinCode(teacherPage, className, F);
  return { className, code };
}

// ============================ SCENARIOS ============================

// TA1 — F02: teacher list-ADD must NOT flip a mid-progress student's default list.
async function TA1(browser, teacherPage) {
  const s = scenario('TA1', 'F02: teacher list-add does NOT flip a mid-progress student');
  const stu = freshStudent();
  const { page } = await newAuditPage(browser, F, 'TA1-stu');
  try {
    await need(s, 'student logged in', await login(page, stu, F), stu);
    const { className, code } = await makeClass(teacherPage, 'TA1', [{ title: TOP }]);
    await need(s, 'fresh class created + TOP assigned + join code read', !!(className && code), `class="${className}" code="${code}"`);
    await need(s, 'student joined the class (UI)', await joinClass(page, code, className, F, 'TA1-stu'), className);

    await goDashboard(page);
    await need(s, 'initial focus resolves to exactly TOP (only assigned list)', async () => (await readFocusList(page)) === TOP, 'focus must == TOP', page);
    await need(s, 'TOP is the ONLY assigned list initially (no CORE yet)', async () => { const o = await listSelectorOptions(page); return o.mode === 'label' || (o.options.length <= 1 && !o.options.some((x) => x.includes(CORE))); }, 'exactly one list', page);

    // Study Day 1, then PROVE the completion persisted to the dashboard (not just a results
    // screen) — a non-zero progress ring / "Day N done" / streak badge (Codex #2).
    await need(s, 'studyOneDay reached a passed results screen', await studyOneDay(page, F, 'TA1-d1'), 'studyOneDay advanced');
    await goDashboard(page);
    // The FAITHFUL F02 precondition: the hero "DAY N" badge must read N>=2, i.e. the completed
    // day persisted to currentStudyDay>=1 (what F02's ranking actually keys on). words/% are
    // recorded diagnostically but do NOT satisfy this — TWI can be >0 while CSD is still 0.
    await need(s, 'visible currentStudyDay>=1 on TOP (hero shows DAY>=2)', async () => (await readVisibleProgress(page)).day >= 2, 'DAY badge must be >=2', page);
    { const p = await readVisibleProgress(page); F.add('note', `[TA1] progress diagnostics — DAY=${p.day} words=${p.words} pct=${p.pct}`); }

    await shot(page, `ACC_TA1_before_assign_${RUN}`);
    await need(s, 'focus reads EXACTLY TOP before the teacher move', async () => (await readFocusList(page)) === TOP, 'before == TOP', page);

    // Teacher adds CORE while the student is enrolled + mid-progress.
    const assigned = await assignList(teacherPage, className, CORE, OPTS, F);
    await need(s, 'teacher assign of CORE visibly succeeded', assigned, 'assignList ok (both lists should now show)');

    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(4500);
    await shot(page, `ACC_TA1_after_reload_${RUN}`);
    const after = await readFocusList(page);
    const opts1 = await listSelectorOptions(page);
    const coreAvail = opts1.options.some((o) => o.includes(CORE));

    // Guard against the old false-pass: CORE MUST appear as an option (condition exercised).
    check(s, 'CORE appears as a selectable option after the add (condition actually exercised)', coreAvail, `opts=${JSON.stringify(opts1.options)}`);
    // THE F02 assertion. null/CORE/anything-but-TOP = FAIL (never "unchanged good").
    check(s, 'F02: default focus STAYS exactly TOP after list-add (no flip)', after === TOP, `after="${after}" expected="${TOP}"`);
    if (after === null) check(s, 'focus value present after reload (not null/loading/retry-card)', false, 'after=null');
  } finally { await page.context().close().catch(() => {}); }
}

// TA2 — F03: unassign warns honestly (warn-only); cancel preserves, accept strands; progress preserved.
async function TA2(browser, teacherPage) {
  const s = scenario('TA2', 'F03: honest warn-only unassign; cancel preserves, accept strands, progress kept');
  const stu = freshStudent();
  const { page } = await newAuditPage(browser, F, 'TA2-stu');
  try {
    await need(s, 'student logged in', await login(page, stu, F), stu);
    const { className, code } = await makeClass(teacherPage, 'TA2', [{ title: TOP }]);
    await need(s, 'fresh class + TOP assigned + code', !!(className && code), `class="${className}" code="${code}"`);
    await need(s, 'student joined', await joinClass(page, code, className, F, 'TA2-stu'), className, page);
    await need(s, 'student has visible Day-1 progress on TOP', await studyOneDay(page, F, 'TA2-d1'), 'studyOneDay advanced', page);

    // (1) Open unassign, capture FULL warning text, DISMISS (cancel).
    const r1 = await unassignList(teacherPage, className, TOP, F, { dialog: 'dismiss' });
    const msg = r1.dialogMessage || '';
    await need(s, 'unassign confirm dialog appeared', !!msg, `msg="${msg.slice(0, 120)}"`);
    // Each required consequence asserted SEPARATELY (Codex #6): the warning must state loss of
    // access, that it returns only on re-assignment, AND that progress is BOTH preserved AND
    // hidden — not merely one of them.
    check(s, 'warning states students LOSE ACCESS', /lose access/i.test(msg), `msg="${msg}"`);
    check(s, 'warning states access returns only when RE-ASSIGNED', /re-?assigned/i.test(msg));
    check(s, 'warning states progress is PRESERVED', /(preserv|saved)/i.test(msg));
    check(s, 'warning states progress is HIDDEN/inaccessible', /hidden|inaccessible|no longer (visible|shown)/i.test(msg));
    check(s, 'NOT the old misleading bare "progress is saved" copy', !/^remove this list from the class\?\s*student progress is saved\.?$/i.test(msg.trim()));

    // (2) After cancel: list still assigned (teacher) AND still reachable (student).
    check(s, 'CANCEL preserved the assignment (teacher UI still shows TOP)', !r1.gone, `gone=${r1.gone}`);
    check(s, 'CANCEL: student still has access to TOP', await canReachList(page, TOP));
    await shot(page, `ACC_TA2_after_cancel_${RUN}`);

    // (3) Reopen + ACCEPT (proceed).
    const r2 = await unassignList(teacherPage, className, TOP, F, { dialog: 'accept' });
    check(s, 'PROCEED actually unassigned (teacher UI no longer shows TOP)', r2.gone, `gone=${r2.gone}`);

    // (4) Student loses access (stranding is EXPECTED under warn-only). Poll for the unassign to
    // PROPAGATE to the student's client — the teacher's write needs to reach this browser (the
    // first run false-failed by rechecking 3s after the teacher action). Still fail-closed: if it
    // never becomes unreachable within the budget, the check fails.
    let lost = false, polls = 0;
    const t0 = Date.now();
    for (let i = 0; i < 8 && !lost; i++) { polls++; await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000); lost = !(await canReachList(page, TOP)); }
    const propS = ((Date.now() - t0) / 1000).toFixed(0);
    // Record the OBSERVED propagation latency as data (Codex: it's real behavior, not just a
    // harness quirk — a student can still reach an unassigned list for this long).
    F.add('observation', `[TA2] observed unassign→student-loses-access propagation latency ≈ ${propS}s over ${polls} reload(s)`);
    check(s, 'PROCEED: student loses access to TOP (expected stranding, warn-only)', lost, lost ? `lost after ~${propS}s / ${polls} reloads` : `still reachable after ${polls} reloads`);
    await shot(page, `ACC_TA2_after_proceed_${RUN}`);

    // (5) Progress preserved — verified by the SEPARATE read-only post-verifier, which
    // resolves the exact classId from className and asserts CSD/TWI on the precise doc.
    MANIFEST.push({ scenario: 'TA2', student: stu, className, listId: LIST_ID[TOP], studiedDays: 1, expect: 'CSD>=1 and TWI>0 preserved after unassign' });
    F.add('note', `[TA2] CSD/TWI-preserved for ${stu} on ${className}/${LIST_ID[TOP]} → confirmed by read-only lsr_postverify.mjs`);
  } finally { await page.context().close().catch(() => {}); }
}

// M1 — F02 matrix: a ZERO-progress student still defaults to the newest-assigned list.
async function M1(browser, teacherPage) {
  const s = scenario('M1', 'F02 matrix: zero-progress student defaults to newest-assigned list');
  const stu = freshStudent();
  const { page } = await newAuditPage(browser, F, 'M1-stu');
  try {
    await need(s, 'student logged in', await login(page, stu, F), stu);
    // TOP assigned first, CORE second → CORE is newest-assigned.
    const { className, code } = await makeClass(teacherPage, 'M1', [{ title: TOP }, { title: CORE }]);
    await need(s, 'class + TOP then CORE assigned + code', !!(className && code), `code="${code}"`);
    await need(s, 'student joined', await joinClass(page, code, className, F, 'M1-stu'), className, page);
    await goDashboard(page);
    const focus = await readFocusList(page);
    const { options } = await listSelectorOptions(page);
    await need(s, 'both lists visible as options', options.some((o) => o.includes(TOP)) && options.some((o) => o.includes(CORE)), JSON.stringify(options));
    check(s, 'zero-progress default = newest-assigned (CORE), fallback preserved', focus === CORE, `focus="${focus}" expected="${CORE}"`);
  } finally { await page.context().close().catch(() => {}); }
}

// M3 — F02 matrix: an EXPLICIT saved preference still wins over progress/recency (§1 intact).
async function M3(browser, teacherPage) {
  const s = scenario('M3', 'F02 matrix: explicit saved preference wins over progress-preference');
  const stu = freshStudent();
  const { page } = await newAuditPage(browser, F, 'M3-stu');
  try {
    await need(s, 'student logged in', await login(page, stu, F), stu);
    const { className, code } = await makeClass(teacherPage, 'M3', [{ title: TOP }]);
    await need(s, 'class + TOP + code', !!(className && code), `code="${code}"`);
    await need(s, 'student joined', await joinClass(page, code, className, F, 'M3-stu'), className, page);
    // Give TOP real progress (so progress-preference WOULD pick TOP) — and PROVE it the same
    // way TA1 does: currentStudyDay>=1 (hero DAY>=2), not just that studyOneDay ran. Without
    // this, M3 could pass without actually exercising "saved preference beats currentStudyDay>0".
    await need(s, 'studyOneDay reached a passed results screen', await studyOneDay(page, F, 'M3-d1'), 'studyOneDay advanced');
    await goDashboard(page);
    await need(s, 'visible currentStudyDay>=1 on TOP (hero shows DAY>=2)', async () => (await readVisibleProgress(page)).day >= 2, 'DAY badge must be >=2', page);
    // Teacher adds CORE (no progress on CORE).
    await need(s, 'teacher added CORE', await assignList(teacherPage, className, CORE, OPTS, F), '');
    // Student EXPLICITLY selects CORE → persists saved pref = CORE (which has NO progress).
    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(4000);
    const trigger = page.getByRole('button', { name: /^List:/ }).first();
    await need(s, 'list selector is a dropdown (2 lists)', await trigger.isVisible().catch(() => false), 'need dropdown to select', page);
    await trigger.click().catch(() => {}); await sleep(600);
    const coreOpt = page.getByRole('button', { name: new RegExp(CORE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).last();
    await need(s, 'CORE selectable in dropdown', await coreOpt.isVisible().catch(() => false), '');
    await coreOpt.click().catch(() => {}); await sleep(2500);
    // Reload — saved pref (CORE) must win even though TOP has progress and CORE is newer.
    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(4000);
    const focus = await readFocusList(page);
    check(s, 'saved preference (CORE) wins over progress-preference (TOP)', focus === CORE, `focus="${focus}" expected="${CORE}"`);
  } finally { await page.context().close().catch(() => {}); }
}

// M5 — regression: single-class normal flow renders + Start surfaces enabled (no skeleton/retry).
async function M5(browser, teacherPage) {
  const s = scenario('M5', 'Regression: single-class flow renders, Start enabled, no retry/skeleton lock');
  const stu = freshStudent();
  const { page } = await newAuditPage(browser, F, 'M5-stu');
  try {
    await need(s, 'student logged in', await login(page, stu, F), stu);
    const { className, code } = await makeClass(teacherPage, 'M5', [{ title: TOP }]);
    await need(s, 'class + TOP + code', !!(className && code), `code="${code}"`);
    await need(s, 'student joined', await joinClass(page, code, className, F, 'M5-stu'), className, page);
    await need(s, 'student has Day-1 progress on TOP', await studyOneDay(page, F, 'M5-d1'), '', page);
    await goDashboard(page);
    const focus = await readFocusList(page);
    check(s, 'focus resolves to TOP', focus === TOP, `focus="${focus}"`);
    // No fail-closed retry card on a healthy load.
    const retry = await page.getByText(/couldn.?t load your progress/i).first().isVisible().catch(() => false);
    check(s, 'no error/retry card on a healthy load (fail-closed did not over-trigger)', !retry);
    // Per-list Start enabled once progress is loaded.
    const start = page.getByRole('button', { name: /start session/i }).first();
    const startVisible = await start.isVisible().catch(() => false);
    check(s, 'per-list "Start Session" surface is present', startVisible);
    if (startVisible) check(s, 'per-list "Start Session" is ENABLED when progress loaded OK', await start.isEnabled().catch(() => false));
  } finally { await page.context().close().catch(() => {}); }
}

// ============================ RUNNER ============================
const ALL = { TA1, TA2, M1, M3, M5 };
const pick = process.argv.slice(2).filter((a) => ALL[a]);
const toRun = pick.length ? pick : Object.keys(ALL);

console.log(`\n▶ LSR F02/F03 ACCEPTANCE (run ${RUN}) — scenarios: ${toRun.join(', ')}`);
console.log('  · Admin-free runtime; forward-only fresh classes/students; hard assertions.\n');
const browser = await launch();
const { page: teacherPage } = await newAuditPage(browser, F, 'teacher');
const tok = await login(teacherPage, TEACHER, F);
if (!tok) { F.add('fatal', 'teacher login failed — cannot provision classes'); }

for (const id of toRun) {
  try {
    if (!tok) { const s = scenario(id, ALL[id].name); s.status = 'INVALID'; s.checks.push({ name: 'teacher available', status: 'INVALID', detail: 'teacher login failed' }); continue; }
    console.log(`  ▷ ${id} …`);
    await ALL[id](browser, teacherPage);
    console.log(`    ${id}: ${RESULTS.find((r) => r.id === id)?.status}`);
  } catch (e) {
    const s = RESULTS.find((r) => r.id === id);
    if (e instanceof Precond) { console.log(`    ${id}: INVALID (precondition) — ${e.message}`); }
    else { if (s && s.status !== 'INVALID') s.status = 'FAIL'; F.add('scenario-error', `[${id}] threw: ${String(e).slice(0, 200)}`); console.log(`    ${id}: ERROR — ${String(e).slice(0, 140)}`); }
  }
}
await browser.close();

// ---- acceptance matrix + exit code ----
const pass = RESULTS.filter((r) => r.status === 'PASS').length;
const fail = RESULTS.filter((r) => r.status === 'FAIL').length;
const invalid = RESULTS.filter((r) => r.status === 'INVALID').length;
// Codex #4/#6: fatal browser anomalies (uncaught page errors, UNEXPECTED native dialogs,
// thrown scenarios) fail the run even if scenario checks passed — and so do non-allowlisted
// console errors (Codex #6: don't silently pass with console errors; allowlist known noise,
// fail on the rest so they get triaged).
const FATAL_KINDS = ['page-error', 'unexpected-dialog', 'scenario-error', 'fatal'];
// A Firestore long-poll channel abort is benign ONLY when ALL THREE hold, order-independent
// (Codex #1: host-alone was fail-open; #3: the old ERR_ABORTED-before-URL regex never matched):
//   Firestore host  AND  a Listen/Write channel  AND  an aborted request.
const isFirestoreChannelAbort = (d) => /firestore\.googleapis\.com/i.test(d) && /(Listen|Write)\/channel/i.test(d) && /ERR_ABORTED/i.test(d);
const CONSOLE_ALLOW = [/ResizeObserver/i, /favicon/i, /analytics|gtag|gtm/i, /web-vitals/i];
const anomalyList = [
  ...F.raw.filter((r) => FATAL_KINDS.includes(r.kind)),
  ...F.raw.filter((r) => r.kind === 'console-error' && !isFirestoreChannelAbort(r.detail) && !CONSOLE_ALLOW.some((re) => re.test(r.detail))),
  // A real request failure (failed API/function call) is fatal; only the 3-condition channel abort is benign.
  ...F.raw.filter((r) => r.kind === 'request-failed' && !isFirestoreChannelAbort(r.detail)),
];
const anomalies = anomalyList.length;

let md = `# LSR F02/F03 Acceptance Matrix — run ${RUN}\n\n**When:** ${new Date().toISOString()}  \n`;
md += `**Deploy:** ${'https://vocaboostone.netlify.app'} (flag LIST_SCOPED_RECON OFF; F02/F03 client fixes live)  \n`;
md += `**Result:** ${pass} PASS · ${fail} FAIL · ${invalid} INVALID · ${anomalies} fatal browser anomalies  \n\n`;
md += `> INVALID = a precondition could not be built through the UI (setup problem), NOT a pass. Only PASS counts.\n`;
md += `> This matrix is NOT the final verdict — run \`lsr_postverify.mjs\` (read-only) for the combined verdict incl. TA2 CSD/TWI.\n\n`;
if (anomalies) { md += `**Fatal anomalies:**\n`; for (const a of anomalyList.slice(0, 20)) md += `- ${a.kind}: ${a.detail.slice(0, 160)}\n`; md += '\n'; }
for (const r of RESULTS) {
  md += `## ${r.id} — ${r.name}\n**${r.status}**\n\n| Check | Status | Detail |\n|---|---|---|\n`;
  for (const c of r.checks) md += `| ${c.name} | ${c.status} | ${(c.detail || '').replace(/\|/g, '/').slice(0, 120)} |\n`;
  md += '\n';
}
md += `\n---\n**Next (read-only, separate process):** \`NODE_PATH=/app/node_modules node audit/playwright/lsr_postverify.mjs\` — consumes \`lsr_accept_manifest.json\`, confirms TA2 CSD/TWI on the exact class/list, and prints the FINAL combined verdict.\n`;
writeFileSync(`${AUD}/LSR_ACCEPTANCE_MATRIX.md`, md);
// Codex #3/#5: bind BOTH artifacts with the same run id + the preflight timestamp so the
// post-verifier can confirm they came from THIS completed run over a fresh allowlist, and
// record the expected scenario set so a partial run can't read as complete.
const bind = { run: RUN, generatedAt: new Date().toISOString(), preflightGeneratedAt: CLEAN.generatedAt, expected: toRun };
writeFileSync(`${AUD}/lsr_accept_manifest.json`, JSON.stringify({ ...bind, items: MANIFEST }, null, 2));
writeFileSync(`${AUD}/lsr_accept_matrix.json`, JSON.stringify({ ...bind, pass, anomalies, results: RESULTS.map((r) => ({ id: r.id, status: r.status })) }, null, 2));
console.log(`\n${'='.repeat(60)}\n  ${pass} PASS · ${fail} FAIL · ${invalid} INVALID · ${anomalies} anomalies`);
console.log(`  matrix: ${AUD}/LSR_ACCEPTANCE_MATRIX.md`);
console.log(`  findings: ${F.path}`);
console.log(`  → run lsr_postverify.mjs (read-only) for the FINAL verdict`);
console.log(`${'='.repeat(60)}\n`);
// Nonzero exit on ANY non-pass OR fatal anomaly (Codex blocker 4). Final authority is postverify.
process.exit(fail > 0 || invalid > 0 || anomalies > 0 ? 1 : 0);
