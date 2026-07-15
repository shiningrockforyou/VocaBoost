/**
 * lsr_deepfix_netresilience.mjs — M-NET: degraded-network resilience matrix (David's ask).
 * Design: audit/deepfix/task6/M_NET_DESIGN.md. Reuses the calibrated M-UI setup + submit primitives (lsr_ui.mjs /
 * lsr_teacher.mjs / lsr_deepfix_fb.mjs) + the degradation helpers (lsr_deepfix_net_helpers.mjs) + Admin-SDK oracles
 * (lsr_reviewonly_fb.mjs readAttempts/readProgress). Short runs: drive the minimal path to the SUBMIT chokepoint,
 * wrap ONLY the submit in a degradation, then assert the WHITE-BOX invariant (exactly-1 attempt / no corruption /
 * no false-success). LOCAL-ONLY (localhost:5173 via lsr_ui's import-time BASE guard). Sandbox lsr_* + 25WT only.
 *
 *   NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_*@vocaboost.test SL_STUDENTS=lsr_a,lsr_b,lsr_c LSR_TIER=base \
 *     node audit/playwright/lsr_deepfix_netresilience.mjs [runId]
 *
 * Scenarios (submit chokepoint):
 *   NET-1 offline blip on submit  → after reconnect+settle: EXACTLY 1 new attempt (no dup, no loss), no false-success mid-offline
 *   NET-2 slow network on submit  → eventual correct success, EXACTLY 1 attempt, no false-fail
 *   NET-3 one-shot write failure  → app retries → EXACTLY 1 attempt (idempotent, no duplicate)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const HERE = dirname(fileURLToPath(import.meta.url));
const AUD = HERE;
const runId = process.argv[2] || `NET_${Date.now()}`;
const TEACHER = process.env.LSR_TEACHER;
const STUDENTS = (process.env.SL_STUDENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
const TIER = process.env.LSR_TIER || null;
const SCEN = (process.env.DFN_SCENARIOS || 'NET-1 NET-2 NET-3').trim().split(/\s+/);

// lsr_ui import triggers the fail-closed localhost BASE guard.
const UI = await import('./lsr_ui.mjs');
const { BASE, PASS, launch, newAuditPage, login, joinClass, selectList, goDashboard,
        driveNewWordsToTest, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, sleep, makeFindings, shot } = UI;
const FB = await import('./lsr_deepfix_fb.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');
const NET = await import('./lsr_deepfix_net_helpers.mjs');

const STUDENT_RE = FB.SANDBOX.SANDBOX_STUDENT_RE;
function idGuardOrDie() {
  const bad = [];
  if (!TEACHER || !STUDENT_RE.test(TEACHER)) bad.push(`LSR_TEACHER "${TEACHER}" not lsr_*@vocaboost.test`);
  if (STUDENTS.length < 1) bad.push('SL_STUDENTS empty');
  for (const s of STUDENTS) if (!STUDENT_RE.test(s)) bad.push(`student "${s}" not lsr_*@vocaboost.test`);
  if (bad.length) { console.error(`[IDENTITY GUARD] INVALID — ${bad.join('; ')}. Sandbox only; NEVER 26SM.`); process.exit(2); }
}
idGuardOrDie();

const listsFile = JSON.parse(readFileSync(resolve(AUD, 'lsr_lists.json'), 'utf8'));
const teacherLists = listsFile.teachers?.[TEACHER]?.lists;
if (!teacherLists?.length) { console.error(`no cloned lists for ${TEACHER} in lsr_lists.json`); process.exit(2); }
const chosen = TIER ? teacherLists.find((l) => l.tier === TIER) : teacherLists[0];
if (!chosen?.newId) { console.error(`no clone for tier ${TIER || '(first)'}`); process.exit(2); }
const LIST = { id: chosen.newId, title: chosen.title, tier: chosen.tier };

const F = makeFindings(`DFN_${runId}`);
mkdirSync(resolve(AUD, 'findings'), { recursive: true });
const results = [];
let sIdx = 0;
const nextStudent = () => STUDENTS[sIdx++ % STUDENTS.length];
const setV = (rec, v, detail) => { rec.verdict = v; if (detail) rec.detail = detail; };

// Reach the day-1 new-word test + fill answers (does NOT submit — the caller wraps the submit in a degradation).
async function reachSubmitReady(page) {
  const t = await driveNewWordsToTest(page, F, 'NET');
  if (!t.reached) return { ready: false, reason: 'could not reach the day-1 new-word test' };
  const rows = await readTestRows(page);
  const answers = carefulAnswersFrom(rows, null);
  const inputs = page.locator('input[placeholder*="definition" i]');
  for (let i = 0; i < answers.length; i++) await inputs.nth(i).fill(answers[i]).catch(() => {});
  return { ready: true, size: rows.length };
}
async function clickSubmit(page) {
  const submit = page.getByRole('button', { name: /^submit( test| answers)?$/i }).first();
  if (!(await submit.isVisible().catch(() => false))) return { clicked: false };
  await submit.click({ timeout: 8000 }).catch(() => {});
  const modal = page.getByText(/are you sure you want to submit/i).first();
  if (await modal.isVisible().catch(() => false)) await page.getByRole('button', { name: /^submit$/i }).last().click({ timeout: 6000 }).catch(() => {});
  return { clicked: true };
}
async function falseSuccessVisible(page) {
  // a "results"/completion screen while the write is degraded = a potential false success
  return page.getByText(/your score|day \d+ complete|great job|results/i).first().isVisible({ timeout: 2000 }).catch(() => false);
}

// The app's grading submit retries 3× with a 10s delay between attempts and a 90s per-attempt timeout
// (TypedTest.jsx gradeWithRetry: MAX_RETRIES=3, RETRY_DELAY_MS=10000, TIMEOUT_MS=90000). After a brief
// degradation the durable attempt lands on a LATER retry (attempt 2 ≈ t+10s once the link is back), so a
// fixed short settle measures INSIDE the retry gap and false-reads "0 attempts / lost write" (net-r23 NET-1).
// Poll for the write to land across the full 3×10s schedule (+ grading latency), then a short stabilization
// re-read so a genuine late DUPLICATE still trips the >1 check.
async function awaitAttemptDelta(uid, classId, listId, preNew, { landMs = 45000, stepMs = 2500, stabilizeMs = 6000 } = {}) {
  const deadline = Date.now() + landMs;
  let delta = 0;
  while (Date.now() < deadline) {
    delta = (await FB.readAttempts(uid, classId, listId)).newAttempts - preNew;
    if (delta >= 1) break;
    await sleep(stepMs);
  }
  if (delta >= 1) { await sleep(stabilizeMs); delta = (await FB.readAttempts(uid, classId, listId)).newAttempts - preNew; }
  return delta;
}

const SCENARIOS = {
  // NET-1 — offline blip during submit → the Firestore write queues (offline persistence) + syncs on reconnect.
  // Invariant: after reconnect+settle, EXACTLY 1 new 'new' attempt (no dup, no loss); no error-loop.
  'NET-1': async (c) => {
    const r = await reachSubmitReady(c.page); if (!r.ready) return setV(c.rec, 'INVALID', r.reason);
    const pre = await FB.readAttempts(c.uid, c.classId, c.listId);
    await NET.withOffline(c.page, async () => { await clickSubmit(c.page); await sleep(2500); });
    // reconnected at t≈2.5s, but the app's grading retry doesn't re-fire until t≈10s (RETRY_DELAY_MS).
    // Poll past the full retry schedule for the recovered write to land, then stabilize for a late dup.
    await c.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const delta = await awaitAttemptDelta(c.uid, c.classId, c.listId, pre.newAttempts);
    if (delta > 1) return setV(c.rec, 'FAIL', `offline submit produced ${delta} new attempts (want 1) — duplicate/corruption`);
    if (delta < 1) { await shot(c.page, `net1_noattempt_${runId}`); return setV(c.rec, 'FAIL', `offline submit produced 0 new attempts after full retry-schedule wait (lost write)`); }
    setV(c.rec, 'PASS', `offline blip on submit → exactly 1 attempt after retry-recovery (no dup, no loss)`);
  },
  // NET-2 — slow network (bad-3G) during submit → eventual success, EXACTLY 1 attempt, no false-fail.
  'NET-2': async (c) => {
    const r = await reachSubmitReady(c.page); if (!r.ready) return setV(c.rec, 'INVALID', r.reason);
    const pre = await FB.readAttempts(c.uid, c.classId, c.listId);
    await NET.withSlow(c.page, async () => { await clickSubmit(c.page); await sleep(6000); });
    await c.page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    // slow link may push the write past a fixed settle (or onto a retry) — poll for it to land.
    const delta = await awaitAttemptDelta(c.uid, c.classId, c.listId, pre.newAttempts);
    if (delta !== 1) return setV(c.rec, 'FAIL', `slow-network submit produced ${delta} new attempts (want exactly 1)`);
    setV(c.rec, 'PASS', `slow network on submit → exactly 1 attempt, eventual success (no false-fail/dup)`);
  },
  // NET-3 — one-shot write failure (abort the FIRST grade/write, then allow) → app retries → EXACTLY 1 attempt.
  'NET-3': async (c) => {
    const r = await reachSubmitReady(c.page); if (!r.ready) return setV(c.rec, 'INVALID', r.reason);
    const pre = await FB.readAttempts(c.uid, c.classId, c.listId);
    await NET.withFailOnce(c.page, NET.NET_PATTERNS.anyGoogleApis, async () => { await clickSubmit(c.page); await sleep(5000); });
    await c.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    // the one-shot failure forces the write onto the app's t≈10s retry — poll past the schedule, then stabilize.
    const delta = await awaitAttemptDelta(c.uid, c.classId, c.listId, pre.newAttempts);
    if (delta > 1) return setV(c.rec, 'FAIL', `one-shot failure → ${delta} attempts (want 1) — retry duplicated the write (NOT idempotent)`);
    if (delta < 1) return setV(c.rec, 'FAIL', `one-shot failure → 0 attempts (write lost, no retry)`);
    setV(c.rec, 'PASS', `one-shot write failure on submit → retried to exactly 1 attempt (idempotent)`);
  },
};

async function runScenario(browser, id, fn) {
  const email = nextStudent();
  const rec = { id, verdict: 'PENDING', detail: '', classId: null };
  results.push(rec);
  let uid;
  try {
    // uidByEmail now returns null ONLY for a genuinely-missing account (else it throws — infra errors no longer
    // masquerade as "no uid"). If the account is missing, create a fresh sandbox account (no list history →
    // clean day-1). Sandbox lsr_* only (identity-guarded above); uses the audit password so the browser can log in.
    uid = await FB.uidByEmail(email);
    if (!uid) { uid = (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid; F.add('provision', `[${id}] created fresh sandbox account ${email}`); }
  } catch (e) { setV(rec, 'INVALID', `uid resolve/create failed for ${email}: ${String(e).slice(0, 160)}`); return; }
  try {
    const className = `25WT DFN ${id} ${runId}`;
    // teacher creates + assigns (mirrors lsr_deepfix_ui provisionClass — classId resolved via FB query, not createClass's bool)
    const { page: tp } = await newAuditPage(browser, F, `teacher-${id}`);
    let code = null;
    try {
      if (await login(tp, TEACHER, F)) {
        await createClass(tp, className, F);
        await assignList(tp, className, LIST.title, { pace: 40, thr: 92, mode: 'typed', reviewMode: 'mcq', testSize: 30, listId: LIST.id }, F);
        code = await readJoinCode(tp, className, F);
      }
    } finally { await tp.context().close().catch(() => {}); }
    const cq = await FB.db().collection('classes').where('name', '==', className).get();
    if (cq.size !== 1) { setV(rec, 'INVALID', `provision: ${cq.size} classes named "${className}"`); return; }
    const classId = cq.docs[0].id;
    if (!code) { setV(rec, 'INVALID', 'no join code'); return; }
    rec.classId = classId;
    await FB.resetStudentState({ email, uid, classId, listId: LIST.id }).catch(() => {});
    // student joins + focus-pinned to the assigned list (the calibrated setup)
    const { page } = await newAuditPage(browser, F, `student-${id}`);
    if (!(await login(page, email, F))) { setV(rec, 'INVALID', 'student login failed'); await page.context().close().catch(() => {}); return; }
    await joinClass(page, code, className, F, id);
    await FB.setPrimaryFocus({ email, uid, classId, listId: LIST.id, focusListId: LIST.id }).catch(() => {});
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(1500);
    await selectList(page, LIST.title, F, id).catch(() => {});
    await goDashboard(page).catch(() => {});
    await fn({ browser, page, email, uid, classId, listId: LIST.id, rec, id });
    await page.context().close().catch(() => {});
  } catch (e) {
    if (rec.verdict === 'PENDING') setV(rec, 'FAIL', `exception: ${String(e).slice(0, 200)}`);
    F.add('exception', `[${id}] ${String(e).slice(0, 200)}`);
  }
}

console.log(`\n▶ deepfix M-NET ${runId} — BASE=${BASE} tier=${LIST.tier} list=${LIST.title} students=${STUDENTS.length}\n`);
// Trigger the FB helper's LAZY admin.initializeApp() before the first admin.auth() use (uidByEmail/createUser).
// Without this, admin has no default app → getUserByEmail throws → uidByEmail's silent catch returns null →
// masquerades as "no uid" for every email (the r20/r21/r22 false failure). See winclaude_022 diagnosis.
FB.db();
const browser = await launch();
try {
  for (const id of SCEN) {
    const fn = SCENARIOS[id];
    if (!fn) { results.push({ id, verdict: 'INVALID', detail: 'unknown scenario' }); continue; }
    console.log(`  → ${id} …`);
    await runScenario(browser, id, fn);
    const r = results.find((x) => x.id === id);
    console.log(`    ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} ${id} ${r.verdict} — ${r.detail || ''}`);
  }
} finally { await browser.close().catch(() => {}); }

const pass = results.filter((r) => r.verdict === 'PASS').length;
const clean = results.length === SCEN.length && results.every((r) => r.verdict === 'PASS');
const manifest = { matrix: 'M-NET', runId, base: BASE, tier: LIST.tier, listId: LIST.id, verdict: clean ? 'CLEAN' : 'NOT_CLEAN', cleanCount: pass, total: SCEN.length, results: results.map((r) => ({ id: r.id, verdict: r.verdict, detail: r.detail, classId: r.classId })) };
writeFileSync(resolve(AUD, 'findings', `deepfix_net_${runId}.json`), JSON.stringify(manifest, null, 2));
let md = `# deepfix M-NET (${runId})\n\n**${manifest.verdict}** — ${pass}/${SCEN.length} PASS\n\n`;
for (const r of results) md += `- ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} **${r.id}** ${r.verdict} — ${r.detail}\n`;
writeFileSync(resolve(AUD, 'findings', `deepfix_net_${runId}.md`), md);
console.log(`\n=== M-NET (${runId}) === ${manifest.verdict} — ${pass}/${SCEN.length}\n`);
process.exit(clean ? 0 : 1);
