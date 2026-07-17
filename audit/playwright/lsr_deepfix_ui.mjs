/**
 * lsr_deepfix_ui.mjs — M-UI runner (FOUNDATIONAL chunk) for the deepfix Playwright audit.
 * Design oracle: audit/deepfix/task4/AUDIT_DESIGN.md §1.B (RO: RA1–RA9 + RO-S1/S9/S10), §1.C
 * (RS-1..4), §2 (fail-closed manifest binding), §3 (clean-seed + MANDATORY pre-verify).
 * Build plan: audit/deepfix/task5/HARNESS_BUILD_PLAN.md. Run-book: audit/deepfix/task5/CODEX_RUNBOOK.md.
 *
 * EXTENDS lsr_reviewonly.mjs's `runScenario` loop + manifest pattern; the RA1–RA9 scenario bodies are
 * ADOPTED VERBATIM (copied — lsr_reviewonly.mjs is an executable entrypoint that runs + process.exit()s
 * on import, so its SCENARIOS object cannot be imported; every reusable PRIMITIVE they call is imported
 * from lsr_ui.mjs + lsr_deepfix_fb.mjs, so no library code is duplicated). LOCAL-ONLY (localhost:5173,
 * NEVER live) via the import-time BASE guard in lsr_ui.mjs; every seed write is sandbox-triple-gated.
 *
 * ⚠ UN-RUNNABLE IN THIS WSL (9p mount — no Vite/Playwright). Codex runs it on David's Windows env
 * (Task 6). Validate here by parser + reuse-correctness + a walk of each oracle against the design.
 *
 *   LSR_TEACHER=lsr_teacher_02@vocaboost.test \
 *   SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@...,...   (>=2 — RS-1 needs a filler student) \
 *   LSR_TIER=CORE  DFX_SCENARIOS="RA1 RA2 RA3 RA5 RA5b RA6 RA7 RA8 RA9 RO-S1 RO-S9 RO-S10 RS-1 RS-2 RS-3 RS-4" \
 *   PLAYWRIGHT_BROWSERS_PATH=... NODE_PATH=/app/node_modules node audit/playwright/lsr_deepfix_ui.mjs [runId]
 *
 * Certifies ONLY on an all-CLEAN matrix (exit 1 otherwise). Fail-closed + identity-bound + artifact-bound.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const HERE = dirname(fileURLToPath(import.meta.url));
const AUD = HERE;                       // this file lives in audit/playwright/ — repo-relative, portable (WSL + Windows)
const REPO = resolve(HERE, '..', '..'); // repo root (audit/playwright -> ../..)
const runId = process.argv[2] || `DFX_${Date.now()}`;
const BUILD_ID = process.env.LSR_BUILD_ID || 'local-dev';
const TEACHER = process.env.LSR_TEACHER;
const STUDENTS = (process.env.SL_STUDENTS || process.env.SL_STUDENT || '').split(',').map((s) => s.trim()).filter(Boolean);
const TIER = process.env.LSR_TIER || null;
// Full M-UI E2E set: RO + RS (chunk 1) + CUT/CA/CY/OV (chunk 2). Subset via DFX_SCENARIOS="…".
const DEFAULT_SCEN = 'RA1 RA2 RA3 RA5 RA5b RA6 RA7 RA8 RA9 RO-S1 RO-S9 RO-S10 RS-1 RS-2 RS-3 RS-4 '
  + 'CUT-2 CUT-3 CUT-4 CUT-7 CUT-8 CA-1 CA-2 CA-3 CA-4 CA-5 CA-6 CY-1 CY-2 CY-3 CY-4 CY-5 CY-6 CY-7 OV-1 OV-4 OV-5';
const SCEN = (process.env.DFX_SCENARIOS || DEFAULT_SCEN).trim().split(/\s+/);

// lsr_ui.mjs import TRIGGERS the fail-closed base guard (throws unless BASE is http://localhost).
const UI = await import('./lsr_ui.mjs');
const { BASE, PASS, makeFindings, launch, newAuditPage, login, joinClass, selectList, goDashboard,
        enterReviewSession, enterSessionOnly, readTestRows, partialAnswers, carefulAnswersFrom, fillSubmitAndObserve,
        returnFromResultsAndClearCompletion, driveNewWordsToTest,
        readFocusList, readFocusClass, listSelectorOptions, switchClass, armDialog, lastDialog, shot, sleep } = UI;
const FB = await import('./lsr_deepfix_fb.mjs');
const { createClass, assignList, readJoinCode, openClassDetail } = await import('./lsr_teacher.mjs');

// ── IDENTITY GUARD (fail-closed, BEFORE any login/seed) — design §0.2/§4 ────────────────────────────────────
const STUDENT_RE = FB.SANDBOX.SANDBOX_STUDENT_RE;
function idGuardOrDie() {
  const bad = [];
  if (!TEACHER || !STUDENT_RE.test(TEACHER)) bad.push(`LSR_TEACHER "${TEACHER}" not lsr_*@vocaboost.test`);
  if (!STUDENTS.length) bad.push('SL_STUDENTS/SL_STUDENT empty');
  for (const s of STUDENTS) if (!STUDENT_RE.test(s)) bad.push(`student "${s}" not lsr_*@vocaboost.test`);
  if (bad.length) { console.error(`[IDENTITY GUARD] INVALID — ${bad.join('; ')}. Sandbox identities only; NEVER 26SM.`); process.exit(2); }
}
idGuardOrDie();

const listsFile = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8'));
const teacherLists = listsFile.teachers?.[TEACHER]?.lists;
if (!teacherLists?.length) { console.error(`no cloned lists for ${TEACHER} in lsr_lists.json`); process.exit(2); }
const chosen = TIER ? teacherLists.find((l) => l.tier === TIER) : teacherLists[0];
if (!chosen?.newId) { console.error(`no clone for tier ${TIER || '(first)'} for ${TEACHER}`); process.exit(2); }
const LIST_SIZE = await FB.readListWordCount(chosen.newId).catch((e) => { console.error(String(e)); process.exit(2); });
const LIST = { id: chosen.newId, title: chosen.title, tier: chosen.tier, size: LIST_SIZE };

// CONT-A/CYC multi-list scenarios need a SECOND (and CA-6 a THIRD) distinct clone as the next-list link target.
// Null when the teacher has too few clones → those scenarios self-report INVALID (never a false PASS).
const OTHER_CLONES = teacherLists.filter((l) => l.newId && l.newId !== LIST.id);
const NEXT_LIST = OTHER_CLONES[0] ? { id: OTHER_CLONES[0].newId, title: OTHER_CLONES[0].title, tier: OTHER_CLONES[0].tier } : null;
const NEXT_LIST_B = OTHER_CLONES[1] ? { id: OTHER_CLONES[1].newId, title: OTHER_CLONES[1].title, tier: OTHER_CLONES[1].tier } : null;
// A synthetic, clearly-labeled EX-teacher stamp for the OV promoted-student fixtures (a field VALUE only — never
// an auth identity; the current class owner is the real sandbox teacher B).
const EX_TEACHER_STAMP = `lsr_ex_teacher_${runId}`.slice(0, 60);

const F = makeFindings(`DFX_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });
const gitHead = (() => { try { return execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch { return 'unknown'; } })();
const gitDirty = (() => { try { return execSync('git status --porcelain', { cwd: REPO }).toString().trim().length > 0; } catch { return true; } })();

// PH-6 fatal app-health kinds (design §2.3). console-error is filtered through an allowlist below
// (lsr_accept pattern) so a benign Firestore long-poll abort / ResizeObserver noise doesn't false-fail.
const FATAL_KINDS = ['exception', 'BUG', 'page-error', 'unexpected-dialog', 'login-failed', 'oracle-mismatch', 'verify-fail'];
const isFirestoreChannelAbort = (d) => /firestore\.googleapis\.com/i.test(d) && /(Listen|Write)\/channel/i.test(d) && /ERR_ABORTED/i.test(d);
// Vite dev-mode asset (e.g. GET /src/index.css?t=… , /@vite/… , /@id/…) aborted by a hard page.reload — a
// dev-server artifact, NOT app health (r10: RO-S9 PASSED while emitting one). Only the dev origin, only ERR_ABORTED.
const isDevAssetAbort = (d) => /localhost:5173\/(src\/|@vite|@id\/|@react|node_modules\/\.vite)/i.test(d) && /ERR_ABORTED/i.test(d);
const CONSOLE_ALLOW = [/ResizeObserver/i, /favicon/i, /analytics|gtag|gtm/i, /web-vitals/i];

const results = [];   // one per scenario: {id, verdict, confirmed, detail, uid, classId, listId, pre, post}
const escRe = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bySubmittedDesc = (a, b) => (b.submittedAt?._seconds || 0) - (a.submittedAt?._seconds || 0);

// Per-scenario provisioning overrides (RS-4 needs a bigger pace + a 90 threshold to land a [90,95) score).
const PROV = {
  'RS-4': { pace: 30, thr: 90, testSize: 30, mode: 'typed' },
  default: { pace: 3 },
};

// ── provisioning ──────────────────────────────────────────────────────────────────────────────────────────
async function provisionClass(browser, className, { pace = 3, thr = 92, testSize = 30, mode = 'typed' } = {}) {
  const { page: tp } = await newAuditPage(browser, F, 'teacher');
  let code = null;
  if (await login(tp, TEACHER, F)) {
    await createClass(tp, className, F);
    await assignList(tp, className, LIST.title, { pace, thr, mode, reviewMode: mode, testSize, listId: LIST.id }, F);
    code = await readJoinCode(tp, className, F);
  }
  await tp.context().close().catch(() => {});
  const cq = await FB.db().collection('classes').where('name', '==', className).get();
  if (cq.size !== 1) return { ok: false, reason: `INVALID (${cq.size} classes named "${className}")` };
  return { ok: true, classId: cq.docs[0].id, code, pace, thr };
}

// Drive ONE review-only day's review test. nCorrect null → all-correct (high pass); else partial (low).
async function driveReviewOnlyDay(page, label, { nCorrect = null } = {}) {
  const ent = await enterReviewSession(page, F, label);
  if (!ent.reached) {
    // A review-only day (no gradeable new-word test) can complete straight to the "Day N Complete / Great Job!"
    // summary — enterReviewSession never sees an in-session screen (no cards / Session-menu), so it reports
    // reached:false while the day is visibly DONE (r7 screenshot). Recognize that summary as a successful
    // completion (the #11 review-only path) so the oracle below can verify csd/twi, instead of a false not-reached.
    if (await dayCompleteVisible(page)) {
      // The completion writes (review automarker + csd advance) fire ASYNC when this summary renders. Give them
      // time to COMMIT before navigating away — r8: csd/reviewAttempts didn't persist AND Firestore Write
      // channels showed ERR_ABORTED, consistent with leaving before the writes landed.
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await sleep(2500);
      await returnFromResultsAndClearCompletion(page, F, label).catch(() => {});
      await goDashboard(page).catch(() => {});
      return { outcome: 'results', size: 0, reviewOnlyAutoComplete: true };
    }
    return { outcome: 'not-reached' };
  }
  const rows = await readTestRows(page);
  const answers = nCorrect == null ? carefulAnswersFrom(rows, null) : partialAnswers(rows, nCorrect, null);
  const { outcome } = await fillSubmitAndObserve(page, answers, F, label);
  await returnFromResultsAndClearCompletion(page, F, label);
  await goDashboard(page).catch(() => {});
  return { outcome, size: rows.length };
}

// Affirmative EXPECTED-COMPLETE oracle (never merely "not blocked").
function assertComplete(pre, post, { newWordScoreNull = true } = {}) {
  const probs = [];
  if (post.csd !== pre.csd + 1) probs.push(`csd ${pre.csd}->${post.csd} (want +1)`);
  if (post.twi !== pre.twi) probs.push(`twi ${pre.twi}->${post.twi} (want FLAT)`);
  const last = post.recentSessions[post.recentSessions.length - 1];
  if (!last) probs.push('no recentSessions appended');
  else if (newWordScoreNull && last.newWordScore !== null) probs.push(`recentSessions.newWordScore=${JSON.stringify(last.newWordScore)} (want null)`);
  return { ok: probs.length === 0, detail: probs.join('; '), last };
}
async function terminalVisible(page) {
  return page.getByText(/You finished the list!|List complete|finished the list/i).first().isVisible().catch(() => false);
}
// The per-DAY completion summary ("Day N Complete" / "Great Job!" / "Session Summary" + "Back to Dashboard") —
// distinct from terminalVisible (the whole-LIST end). A review-only day lands here directly (r7 screenshot).
async function dayCompleteVisible(page) {
  return page.getByText(/Day \d+ Complete|Great Job!|Session Summary/i).first().isVisible({ timeout: 2500 }).catch(() => false);
}

// A list is "reachable" on a student surface iff it's the current focus OR a selectable option.
async function listReachable(page, title) {
  const focus = await readFocusList(page, { timeout: 6000 }).catch(() => null);
  if (focus && focus.includes(title)) return true;
  const o = await listSelectorOptions(page).catch(() => ({ options: [] }));
  return (o.options || []).some((x) => x.includes(title));
}

// Teacher gradebook (route /gradebook) — apply a Name filter. Locators are FIRST-RUN CALIBRATION
// (design §4 "first-run calibration carry-over"): category button "Name", input placeholder
// "Search by name…", "Add Filter" button (Gradebook.jsx:703/887/901).
async function applyNameFilter(page, token) {
  const nameBtn = page.getByRole('button', { name: /^Name$/i }).first();
  if (!(await nameBtn.isVisible().catch(() => false))) return { applied: false, reason: 'Name category button not visible' };
  await nameBtn.click().catch(() => {});
  await sleep(500);
  const input = page.getByPlaceholder(/search by name/i).first();
  if (!(await input.isVisible().catch(() => false))) return { applied: false, reason: 'Name filter input not visible' };
  await input.fill(token).catch(() => {});
  const addBtn = page.getByRole('button', { name: /^add filter$/i }).first();
  if (await addBtn.isVisible().catch(() => false)) await addBtn.click().catch(() => {});
  else await input.press('Enter').catch(() => {});
  await sleep(1800);
  return { applied: true };
}
// The "Showing: N" count on the gradebook control bar (Gradebook.jsx:939).
async function readShowingCount(page) {
  const el = page.getByText(/^Showing:/i).first();
  if (!(await el.isVisible().catch(() => false))) return null;
  const t = await el.innerText().catch(() => '');
  const m = t.match(/Showing:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

// ═══ CHUNK-2 verbs (CUT/CA/CY/OV). Locators are FIRST-RUN CALIBRATION (design §4). A locator MISS returns a
// STRUCTURED {ok:false,reason} so the scenario scores INVALID (calibration), NEVER a false PASS. ═══════════════

// Open a finished list's session directly (RA6-style bespoke entry — the no-work/all-mastered terminal has no
// in-session Start affordance). Returns whether the §5 "You finished the list!" terminal rendered.
async function openFinishedTerminal(page, classId, listId) {
  await page.goto(`${BASE}/session/${classId}/${listId}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(5000);
  return terminalVisible(page);
}
// CompletePhase choice-terminal buttons (DailySessionFlow.jsx:2452-2477). Copy: "Advance to {title} →" /
// "Start over (review the list again)" / "Back to Dashboard".
async function terminalButtons(page) {
  const advance = await page.getByRole('button', { name: /Advance to .+/i }).first().isVisible().catch(() => false);
  const startOver = await page.getByRole('button', { name: /start over/i }).first().isVisible().catch(() => false);
  const dash = await page.getByRole('button', { name: /back to dashboard/i }).first().isVisible().catch(() => false);
  return { advance, startOver, dash };
}
async function advanceButtonForTitle(page, title) {
  return page.getByRole('button', { name: new RegExp(`Advance to ${escRe(title)}`, 'i') }).first().isVisible().catch(() => false);
}

// Teacher `/teacher/gradebook` (challengeMode="review", App.jsx:135-140): Name-filter to the student token, open
// "View Details", accept the PENDING challenge. Returns { ok, accepted, callableError, reason }. A callable-error
// alert (dark/flag-off functions env) is armed→captured as a NON-fatal native dialog → surfaced as callableError
// so the scenario scores INVALID (env), not FAIL. Uses its own teacher context (closed in finally).
async function acceptPendingChallenge(browser, token, label) {
  const { page: tp } = await newAuditPage(browser, F, `teacher-${label}`);
  try {
    if (!(await login(tp, TEACHER, F))) return { ok: false, reason: 'teacher login failed' };
    await tp.goto(`${BASE}/teacher/gradebook`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(2500);
    const filtered = await applyNameFilter(tp, token);
    if (!filtered.applied) return { ok: false, reason: `Name filter not applied (calibration): ${filtered.reason}` };
    await sleep(2000);
    const nameCell = tp.getByRole('cell', { name: new RegExp(escRe(token), 'i') }).first();
    if (!(await nameCell.isVisible().catch(() => false))) return { ok: false, reason: `no gradebook row for token "${token}" (inherited/query calibration)` };
    const viewBtn = tp.getByRole('button', { name: /view details/i }).first();
    if (!(await viewBtn.isVisible().catch(() => false))) return { ok: false, reason: 'no "View Details" control' };
    await viewBtn.click().catch(() => {});
    await sleep(2800);
    const pendingPanel = tp.getByText(/challenge pending/i).first();
    if (!(await pendingPanel.isVisible().catch(() => false))) return { ok: false, reason: 'no "Challenge Pending" panel (challengeMode="review" calibration or no pending answer)' };
    armDialog(tp, 'dismiss'); // a reviewChallenge failure alert()s — capture it as non-fatal
    const accept = tp.getByRole('button', { name: /accept/i }).first();
    if (!(await accept.isVisible().catch(() => false))) return { ok: false, reason: '"Accept ✓" button not visible' };
    await accept.click().catch(() => {});
    await sleep(4500);
    const dlg = lastDialog(tp);
    if (dlg && dlg.message) return { ok: false, callableError: dlg.message, reason: `challenge accept alerted (callable env): ${String(dlg.message).slice(0, 120)}` };
    const acceptedBadge = await tp.getByText(/challenge accepted/i).first().isVisible().catch(() => false);
    await shot(tp, `DFX_${label}_challenge_${runId}`);
    return { ok: acceptedBadge, accepted: acceptedBadge, reason: acceptedBadge ? '' : 'no "Challenge accepted" badge after accept (write may not have applied)' };
  } finally { await tp.context().close().catch(() => {}); }
}

// Student `/settings` reset flow (Settings.jsx): #reset-class / #reset-list selects → "Reset Progress" → modal 1
// "Continue" → modal 2 type "RESET" → final "Reset Progress". Returns { ok, sawError, reason }. sawError=true =>
// the resetProgress callable errored (dark/flag-off fns env → INVALID, not FAIL). The oracle judges success by
// POST-STATE (attempts/csd), not UI copy.
async function resetViaSettings(page, classId, listId) {
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2800);
  const classSel = page.locator('#reset-class');
  if (!(await classSel.isVisible().catch(() => false))) return { ok: false, reason: 'Settings "Reset Progress" #reset-class select not visible (student-only / calibration)' };
  if (!(await classSel.selectOption({ value: classId }).then(() => true).catch(() => false))) return { ok: false, reason: `class ${classId} not a reset option` };
  await sleep(1200);
  const listSel = page.locator('#reset-list');
  if (!(await listSel.selectOption({ value: listId }).then(() => true).catch(() => false))) return { ok: false, reason: `list ${listId} not a reset option` };
  await sleep(700);
  const resetBtn = page.getByRole('button', { name: /^\s*reset progress\s*$/i }).first();
  if (!(await resetBtn.isEnabled().catch(() => false))) return { ok: false, reason: '"Reset Progress" button disabled/not found' };
  await resetBtn.click().catch(() => {});
  await sleep(900);
  const cont = page.getByRole('button', { name: /^continue$/i }).first();
  if (!(await cont.isVisible().catch(() => false))) return { ok: false, reason: 'confirm modal 1 ("Continue") not shown' };
  await cont.click().catch(() => {});
  await sleep(900);
  const typeBox = page.getByPlaceholder(/type reset/i).first();
  if (!(await typeBox.isVisible().catch(() => false))) return { ok: false, reason: 'confirm modal 2 (type RESET) not shown' };
  await typeBox.fill('RESET').catch(() => {});
  await sleep(500);
  const finalBtn = page.getByRole('button', { name: /^\s*reset progress\s*$/i }).last();
  await finalBtn.click().catch(() => {});
  await sleep(3500);
  const sawError = await page.getByText(/not enabled|failed to|couldn'?t|error/i).first().isVisible().catch(() => false);
  return { ok: true, sawError };
}

// Teacher ClassDetail → Students tab: read the student's row (rendered progress). Returns { ok, dayN, text }.
async function readTeacherStudentsRow(browser, className, token, label) {
  const { page: tp } = await newAuditPage(browser, F, `teacher-${label}`);
  try {
    if (!(await login(tp, TEACHER, F))) return { ok: false, reason: 'teacher login failed' };
    await openClassDetail(tp, className, F);
    await tp.getByRole('button', { name: 'Students', exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await sleep(2200);
    const row = tp.getByRole('row', { name: new RegExp(escRe(token), 'i') }).first();
    const visible = await row.isVisible().catch(() => false);
    const text = visible ? await row.innerText().catch(() => '') : '';
    await shot(tp, `DFX_${label}_students_${runId}`);
    const m = text.match(/Day\s*(\d+)/i);
    return { ok: visible, dayN: m ? parseInt(m[1], 10) : null, text, reason: visible ? '' : `no Students row for "${token}"` };
  } finally { await tp.context().close().catch(() => {}); }
}

// ── scenario harness (extends lsr_reviewonly.mjs runScenario) ───────────────────────────────────────────────
let studentIdx = 0;
async function nextStudent() { const e = STUDENTS[studentIdx % STUDENTS.length]; studentIdx++; return e; }

async function runScenario(browser, id, fn) {
  const email = await nextStudent();
  // Resolve the sandbox uid; auto-provision a FRESH account if missing (clean day-1, no list-scoped study_state
  // pollution — the reason RA1/#11 landed in the all-mastered dead-end on reused students). admin is initialized
  // lazily by the first FB.db() call inside FB.uidByEmail's siblings; force it here so createUser has an app.
  let uid;
  try {
    FB.db(); // ensure admin.initializeApp() ran before any admin.auth() use
    uid = await FB.uidByEmail(email);
    if (!uid) {
      uid = (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid;
      // Fresh Auth accounts also need a Firestore user PROFILE (role:'student') or joinClass's classes.studentIds
      // write is rules-denied → phantom membership (enrolledClasses set, class unaware). Mirror the real-signup shape.
      const num = (email.match(/s(\d+)@/) || [, ''])[1];
      await FB.db().collection('users').doc(uid).set({
        role: 'student', email,
        profile: { displayName: `LSR Student ${num}`, school: '', gradYear: null, gradMonth: null, calculatedGrade: null, avatarUrl: '' },
        enrolledClasses: {}, createdAt: FB.now(),
      }, { merge: true });
    }
  } catch (e) {
    const rec0 = { id, email, uid: null, listId: LIST.id, verdict: 'INVALID', confirmed: false, detail: `uid resolve/create failed for ${email}: ${String(e).slice(0, 140)}` };
    results.push(rec0); return;
  }
  const rec = { id, email, uid, listId: LIST.id, verdict: 'PENDING', confirmed: false, detail: '' };
  results.push(rec);
  try {
    const className = `25WT DFX ${id} ${runId}`;
    const prov = await provisionClass(browser, className, PROV[id] || PROV.default);
    if (!prov.ok) { rec.verdict = 'INVALID'; rec.detail = prov.reason; return; }
    rec.classId = prov.classId;
    await FB.resetStudentState({ email, uid, classId: prov.classId, listId: LIST.id });
    const { page } = await newAuditPage(browser, F, `student-${id}`);
    if (!(await login(page, email, F))) { rec.verdict = 'INVALID'; rec.detail = 'student login failed'; await page.context().close().catch(() => {}); return; }
    await joinClass(page, prov.code, className, F, id);
    // Shared sandbox students carry a stale cross-class primaryFocus that resetStudentState (scoped to THIS
    // class/list) does NOT clear → the dashboard shows a foreign single-list focus and selectList can't switch to
    // the assigned list (r5: "single-list focus 'LSR TOP Vocab' != 'LSR Base Camp'"). Pin focus to the freshly-
    // assigned list via Admin SDK, then reload so it takes effect before selectList/the scenario reads focus.
    await FB.setPrimaryFocus({ email, uid, classId: prov.classId, listId: LIST.id, focusListId: LIST.id }).catch(() => {});
    await sleep(1200);                                                    // let the Admin-SDK pin write settle
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); // HARD reload: a soft SPA nav keeps the stale focus (r6: pin took for RA1 but not RA2) — a full reload re-reads users/{uid}.settings
    await sleep(1500);
    await selectList(page, LIST.title, F, id).catch(() => {});
    await goDashboard(page).catch(() => {});
    await fn({ browser, page, email, uid, classId: prov.classId, listId: LIST.id, className, pace: prov.pace, thr: prov.thr, rec, id });
    await page.context().close().catch(() => {});
  } catch (e) {
    rec.verdict = rec.verdict === 'PENDING' ? 'FAIL' : rec.verdict;
    rec.detail = (rec.detail ? rec.detail + ' | ' : '') + `exception: ${String(e).slice(0, 200)}`;
    F.add('exception', `[${id}] ${String(e).slice(0, 200)}`);
  }
}
const setV = (rec, v, detail) => { rec.verdict = v; if (detail) rec.detail = detail; rec.confirmed = v === 'PASS'; };

// ── SCENARIOS ─────────────────────────────────────────────────────────────────────────────────────────────
const SCENARIOS = {
  // ============================================================================================================
  // RO BLOCK · P1 review-only (AUDIT_DESIGN §1.B). RA1–RA9 ADOPTED VERBATIM from lsr_reviewonly.mjs (:138-311).
  // ============================================================================================================

  // RA1 — full-freeze RECOVERY: interv=1.0 → review-only day completes → csd+1, twi flat, newWordScore null,
  // then a LATER high-review day yields newWordCount>0 (recovery closes).
  RA1: async (c) => {
    const wordIds = await FB.getListWordIds(c.listId, { limit: c.pace * 2 });
    await FB.seedReviewableThrottled({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2, wordIds });
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const preAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const d = await driveReviewOnlyDay(c.page, 'RA1', { nCorrect: null });
    if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `review-only day did not complete: outcome=${d.outcome}`);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const postAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const a = assertComplete(pre, post);
    if (postAtt.newAttempts !== preAtt.newAttempts) a.ok = false, a.detail += `; newAttempts Δ${postAtt.newAttempts - preAtt.newAttempts} (want 0)`;
    if (postAtt.reviewAttempts !== preAtt.reviewAttempts + 1) a.ok = false, a.detail += `; reviewAttempts not +1`;
    if (!a.ok) return setV(c.rec, 'FAIL', `RA1 complete oracle: ${a.detail}`);
    // recovery: a later high-review day → intervention drops → newWordCount>0 (new-words CTA appears).
    const d2 = await driveReviewOnlyDay(c.page, 'RA1-recover', { nCorrect: null });
    const recov = await FB.readProgress(c.uid, c.classId, c.listId);
    const newWordsCta = await c.page.getByRole('button', { name: /start new words|learn \d+ new/i }).first().isVisible().catch(() => false);
    if (recov.interventionLevel >= 1.0 && !newWordsCta) return setV(c.rec, 'FAIL', `recovery did not close: interv=${recov.interventionLevel}, no new-words CTA (d2=${d2.outcome})`);
    setV(c.rec, 'PASS', `csd ${pre.csd}->${post.csd}, twi flat ${post.twi}, newWordScore null, recovery interv=${recov.interventionLevel}`);
  },

  // ── THROTTLE_FIX_VALIDATION.md #11 personas — seed a real at-risk archetype, drive, assert the 6 criteria ──
  // THR-C — ESCAPE (KEYSTONE): a hard-throttled student (interv 1.0 from 3 zero-reviews) drives MULTIPLE
  // review-only days at HIGH scores. Each day MUST complete + advance csd + RECORD the review (the #11 fix);
  // as the last-3 review avg climbs past 0.30, interv drops → newWordCount>0 → NEW WORDS RETURN = escaped.
  // This is the whole point: students can escape the deadlock by taking several good review tests.
  'THR-C': async (c) => {
    const twi = Math.max(60, Math.round(0.4 * LIST.size));
    const wordIds = await FB.getListWordIds(c.listId, { limit: twi });
    // >=3 low reviews so calculateInterventionLevel actually returns 1.0 (fewer than 3 → 0.0, not throttled).
    await FB.seedThrottlePersona({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId,
      csd: 8, twi, interventionLevel: 1.0, recentSessions: [{ reviewScore: 0 }, { reviewScore: 0 }, { reviewScore: 0 }], wordIds, masteredFrac: 0.15 });
    await goDashboard(c.page).catch(() => {});
    const seed = await FB.readProgress(c.uid, c.classId, c.listId);
    const trail = [`seed csd=${seed.csd} interv=${seed.interventionLevel}`];
    let escaped = false;
    for (let day = 0; day < 5; day++) {
      // escape check FIRST: if new words are offered, intervention has released → escaped
      const newWordsCta = await c.page.getByRole('button', { name: /start new words|learn \d+ new/i }).first().isVisible({ timeout: 4000 }).catch(() => false);
      if (newWordsCta) { escaped = true; trail.push(`day${day}: NEW WORDS RETURNED → ESCAPED`); break; }
      const preCsd = (await FB.readProgress(c.uid, c.classId, c.listId)).csd;
      const preRev = (await FB.readAttempts(c.uid, c.classId, c.listId)).reviewAttempts;
      const d = await driveReviewOnlyDay(c.page, `THR-C-d${day}`, { nCorrect: null }); // all-correct → HIGH review
      if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `day${day} review-only did NOT complete (walled/empty?): outcome=${d.outcome} · ${trail.join(' | ')}`);
      const post = await FB.readProgress(c.uid, c.classId, c.listId);
      const postRev = (await FB.readAttempts(c.uid, c.classId, c.listId)).reviewAttempts;
      if (post.csd !== preCsd + 1) return setV(c.rec, 'FAIL', `day${day} csd ${preCsd}->${post.csd} (want +1) — review-only NOT advancing · ${trail.join(' | ')}`);
      if (postRev !== preRev + 1) return setV(c.rec, 'FAIL', `day${day} review NOT recorded (crit3) · ${trail.join(' | ')}`);
      if (post.twi !== seed.twi) return setV(c.rec, 'FAIL', `day${day} twi drifted ${seed.twi}->${post.twi} (crit5) · ${trail.join(' | ')}`);
      trail.push(`day${day}: csd->${post.csd}, interv->${(post.interventionLevel ?? '?')}, reviewAtt+1`);
      await goDashboard(c.page).catch(() => {});
    }
    if (!escaped) return setV(c.rec, 'FAIL', `did NOT escape after ${trail.length - 1} high reviews (interv never released) · ${trail.join(' | ')}`);
    setV(c.rec, 'PASS', `ESCAPED via multiple high reviews · ${trail.join(' | ')}`);
  },

  // RA2 — persistent-low: interv pinned 1.0, each review-only day completes (csd advances), twi flat.
  RA2: async (c) => {
    const wordIds = await FB.getListWordIds(c.listId, { limit: c.pace * 2 });
    await FB.seedReviewableThrottled({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2, wordIds });
    await goDashboard(c.page).catch(() => {});
    let pre = await FB.readProgress(c.uid, c.classId, c.listId);
    for (let day = 0; day < 2; day++) {
      const preAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
      const d = await driveReviewOnlyDay(c.page, `RA2-d${day}`, { nCorrect: 1 }); // low review keeps interv high
      if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `day ${day} did not complete: ${d.outcome}`);
      const post = await FB.readProgress(c.uid, c.classId, c.listId);
      const postAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
      if (post.csd !== pre.csd + 1) return setV(c.rec, 'FAIL', `day ${day} csd ${pre.csd}->${post.csd} (want +1)`);
      if (post.twi !== pre.twi) return setV(c.rec, 'FAIL', `day ${day} twi moved ${pre.twi}->${post.twi}`);
      if (postAtt.reviewAttempts !== preAtt.reviewAttempts + 1) return setV(c.rec, 'FAIL', `day ${day} reviewAttempts not +1`);
      pre = post;
    }
    setV(c.rec, 'PASS', `2 review-only days each advanced csd, twi flat`);
  },

  // RA3 — new-word RETAKE preserved (relabeled): an ordinary day whose new-word test is FAILED stays blocked
  // (retake gate), csd does NOT advance. Proves the pre-existing retake still blocks (NOT the modified line).
  RA3: async (c) => {
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const t = await driveNewWordsToTest(c.page, F, 'RA3');
    if (!t.reached) return setV(c.rec, 'INVALID', 'could not reach new-word test');
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, partialAnswers(rows, 1, null), F, 'RA3'); // deliberate fail (blanks)
    await sleep(1500);
    const blocked = outcome === 'retake-gate' || await c.page.getByText(/retake required|not complete|did not pass|try again/i).first().isVisible().catch(() => false);
    await goDashboard(c.page).catch(() => {});
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    if (!blocked) return setV(c.rec, 'FAIL', `expected a retake block, outcome=${outcome}`);
    if (post.csd !== pre.csd) return setV(c.rec, 'FAIL', `csd advanced on a failed new-word day: ${pre.csd}->${post.csd}`);
    setV(c.rec, 'PASS', `failed new-word day BLOCKED (retake), csd held at ${post.csd}`);
  },

  // RA5 — list-end + backlog: twi=listSize seeded → review-only day completes with the §5 terminal.
  RA5: async (c) => {
    await FB.seedListEnd({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2 });
    const pv = await FB.preVerify(c.uid, c.classId, c.listId, { isListComplete: true, listSize: LIST.size });
    if (!pv.ok) return setV(c.rec, 'INVALID', `preVerify: ${pv.reason}`);
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const d = await driveReviewOnlyDay(c.page, 'RA5', { nCorrect: null });
    if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `list-end review-only did not complete: ${d.outcome}`);
    const termShown = await terminalVisible(c.page); // completion screen may already be dismissed by returnFrom...; also check hero below
    await goDashboard(c.page).catch(() => {});
    const heroFinished = await c.page.getByText(/You finished the list!|List complete|introduced every word/i).first().isVisible().catch(() => false);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const a = assertComplete(pre, post);
    if (post.twi !== LIST.size) a.ok = false, a.detail += `; twi=${post.twi} != listSize ${LIST.size}`;
    if (!termShown && !heroFinished) a.ok = false, a.detail += '; §5 terminal/finished-hero NOT visible';
    if (!a.ok) return setV(c.rec, 'FAIL', `RA5: ${a.detail}`);
    setV(c.rec, 'PASS', `terminal shown, twi==listSize ${post.twi}, csd ${pre.csd}->${post.csd}`);
  },

  // RA5b — over-introduced list-end: twi>listSize → completes; wordsIntroduced persists 0, twi NOT decreased.
  RA5b: async (c) => {
    const over = LIST.size + Math.max(5, Math.floor(LIST.size * 0.1));
    await FB.seedListEnd({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: over, csd: 2 });
    const pv = await FB.preVerify(c.uid, c.classId, c.listId, { isListComplete: true, listSize: LIST.size });
    if (!pv.ok) return setV(c.rec, 'INVALID', `preVerify: ${pv.reason}`);
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const d = await driveReviewOnlyDay(c.page, 'RA5b', { nCorrect: null });
    if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `over-introduced review-only did not complete: ${d.outcome}`);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    if (post.twi < pre.twi) return setV(c.rec, 'FAIL', `twi DECREASED ${pre.twi}->${post.twi} (must stay flat)`);
    if (post.twi !== pre.twi) return setV(c.rec, 'FAIL', `twi moved ${pre.twi}->${post.twi} (want flat)`);
    if (post.csd !== pre.csd + 1) return setV(c.rec, 'FAIL', `csd ${pre.csd}->${post.csd} (want +1)`);
    setV(c.rec, 'PASS', `over-introduced completed, twi flat at ${post.twi} (>listSize ${LIST.size}), csd+1`);
  },

  // RA6 — list-end NO review work (ROI2-1): all mastered → terminal shown, NO review test, NO advance.
  RA6: async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (assumption A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    const pv = await FB.preVerify(c.uid, c.classId, c.listId, { isListComplete: true, listSize: LIST.size });
    if (!pv.ok) return setV(c.rec, 'INVALID', `preVerify: ${pv.reason}`);
    const before = await FB.snapshotState(c.uid, c.classId, c.listId);
    // BESPOKE entry (do NOT use enterSessionOnly — a no-work terminal has no in-session UI, Lens C BLK3).
    await c.page.goto(`${BASE}/session/${c.classId}/${c.listId}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(4000);
    const termShown = await terminalVisible(c.page);
    const testShown = await c.page.getByText(/Card \d+ of \d+/i).first().isVisible().catch(() => false)
      || (await c.page.locator('input[placeholder*="definition" i]').count().catch(() => 0)) > 0;
    await sleep(12000); // settle window — prove nothing advances late (Lens C MED4)
    const after = await FB.snapshotState(c.uid, c.classId, c.listId);
    const probs = [];
    if (!termShown) probs.push('§5 finished terminal NOT visible');
    if (testShown) probs.push('a review test WAS rendered (should be none)');
    if (after.hash !== before.hash) probs.push(`state ADVANCED: ${before.hash} -> ${after.hash} (csd/recentSessions/sessions must be unchanged)`);
    c.rec.pre = before; c.rec.post = after;
    if (probs.length) return setV(c.rec, 'FAIL', `RA6: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `terminal shown, no test, no advance (${after.hash})`);
  },

  // RA7 — analytics null: after a review-only completion, recentSessions.newWordScore null & excluded; teacher
  // PreviousSessionCell renders "—" (reads recentSessions; no Phase-2 work). CurrentSessionCell NOT blocked on.
  RA7: async (c) => {
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2 });
    await goDashboard(c.page).catch(() => {});
    const d = await driveReviewOnlyDay(c.page, 'RA7', { nCorrect: null });
    if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `review-only did not complete: ${d.outcome}`);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const last = post.recentSessions[post.recentSessions.length - 1];
    const probs = [];
    if (!last || last.newWordScore !== null) probs.push(`recentSessions.newWordScore=${JSON.stringify(last?.newWordScore)} (want null)`);
    if (post.stats && typeof post.stats.avgNewWordScore === 'number' && Number.isNaN(post.stats.avgNewWordScore)) probs.push('avgNewWordScore is NaN');
    // teacher UI is a soft check (record but do not block on CurrentSessionCell; PreviousSessionCell "—" desired).
    if (probs.length) return setV(c.rec, 'FAIL', `RA7 data: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `newWordScore null in recentSessions, avgNewWordScore not NaN`);
  },

  // RA8 — recon re-verify: multiple review-only days → csd non-demoting, no csd_anchor_invalid.
  RA8: async (c) => {
    const since = Date.now();
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2 });
    await goDashboard(c.page).catch(() => {});
    let prev = (await FB.readProgress(c.uid, c.classId, c.listId)).csd;
    for (let i = 0; i < 3; i++) {
      const d = await driveReviewOnlyDay(c.page, `RA8-d${i}`, { nCorrect: 1 });
      if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `day ${i} not complete: ${d.outcome}`);
      const csd = (await FB.readProgress(c.uid, c.classId, c.listId)).csd;
      if (csd < prev) return setV(c.rec, 'FAIL', `csd DEMOTED ${prev}->${csd}`);
      prev = csd;
    }
    const logs = await FB.readSystemLogsSince(c.uid, since, ['csd_anchor_invalid', 'csd_implausible']);
    if (logs.csd_anchor_invalid) return setV(c.rec, 'FAIL', `csd_anchor_invalid ×${logs.csd_anchor_invalid}`);
    setV(c.rec, 'PASS', `csd non-demoting to ${prev}, no anchor-invalid`);
  },

  // RA9 — Fix-#9 resume real score: reviewOnlyDay (startPhase REVIEW_STUDY) WITH a real passing new attempt →
  // the REAL score persists (NOT null). The only scenario catching a regression of the Lens A#1 fix.
  RA9: async (c) => {
    const anchor = await FB.seedFix9Anchor({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, studyDay: 2, pace: c.pace, score: 97, passThreshold: c.thr });
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const d = await driveReviewOnlyDay(c.page, 'RA9', { nCorrect: null });
    if (d.outcome !== 'results') return setV(c.rec, 'FAIL', `#9-resume review-only did not complete: ${d.outcome}`);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const ss = await FB.readSessionState(c.uid, c.classId, c.listId);
    const last = post.recentSessions[post.recentSessions.length - 1];
    const probs = [];
    if (!last || last.newWordScore === null) probs.push(`recentSessions.newWordScore=${JSON.stringify(last?.newWordScore)} — must be the REAL score, NOT null`);
    if (ss && ss.newWordsTestScore === null) probs.push('session_state.newWordsTestScore is null — must be the real score');
    if (ss && ss.newWordsTestPassed === null) probs.push('session_state.newWordsTestPassed is null — must be true');
    if (post.twi !== pre.twi) probs.push(`twi moved ${pre.twi}->${post.twi} (want flat)`);
    if (probs.length) return setV(c.rec, 'FAIL', `RA9 (Lens A#1): ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `#9-resume kept real score newWordScore=${last.newWordScore}, passed=${ss?.newWordsTestPassed}, twi flat`);
  },

  // ── NEW RO rows (RO-S1/S9/S10) completing the I-2 S1–S10 day-state matrix ────────────────────────────────

  // RO-S1 (S1) — Day-1 new-only completes at submission → csd 0→1, twi+=pace, anchor fields on the attempt.
  'RO-S1': async (c) => {
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    if (pre.csd !== 0) return setV(c.rec, 'INVALID', `pre-verify: fresh student expected csd 0, got ${pre.csd}`);
    // Day-1 has NEW words only (empty review pool). Drive the new test to a PASS with Korean-first answers
    // (carefulAnswersFrom — the AI grader rejects verbatim-English as copying), then finalize the day.
    const t = await driveNewWordsToTest(c.page, F, 'RO-S1');
    if (!t.reached) return setV(c.rec, 'INVALID', 'could not reach the day-1 new-word test');
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'RO-S1');
    if (outcome !== 'results') return setV(c.rec, 'FAIL', `day-1 new test did not reach results: ${outcome}`);
    await returnFromResultsAndClearCompletion(c.page, F, 'RO-S1');
    await goDashboard(c.page).catch(() => {});
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const att = await FB.readAttempts(c.uid, c.classId, c.listId);
    const newest = att.all.filter((a) => a.sessionType === 'new' && a.passed).sort(bySubmittedDesc)[0];
    const probs = [];
    if (post.csd !== pre.csd + 1) probs.push(`csd ${pre.csd}->${post.csd} (want 0->1)`);
    if (!(post.twi > pre.twi)) probs.push(`twi ${pre.twi}->${post.twi} (want +pace)`);
    if (!newest) probs.push('no passed new attempt recorded');
    else for (const f of ['newWordStartIndex', 'newWordEndIndex', 'wordsIntroduced', 'testId'])
      if (newest[f] === undefined || newest[f] === null) probs.push(`day-1 attempt missing anchor field ${f}`);
    if (probs.length) return setV(c.rec, 'FAIL', `RO-S1: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `day-1 completed: csd ${pre.csd}->${post.csd}, twi ${pre.twi}->${post.twi}, full anchor on the attempt`);
  },

  // RO-S9 (S9) — finished steady-state re-entry: persistent finished hero across reloads, NO misleading
  // "learn N new words" copy, re-entry records NOTHING (all counters flat after a settle).
  'RO-S9': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    const pv = await FB.preVerify(c.uid, c.classId, c.listId, { isListComplete: true, listSize: LIST.size });
    if (!pv.ok) return setV(c.rec, 'INVALID', `preVerify: ${pv.reason}`);
    const before = await FB.snapshotState(c.uid, c.classId, c.listId);
    let heroOk = true, misleading = false;
    for (let i = 0; i < 2; i++) {
      await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
      await goDashboard(c.page).catch(() => {});
      const finished = await c.page.getByText(/You finished the list!|List complete|introduced every word|finished the list/i).first().isVisible().catch(() => false);
      if (!finished) heroOk = false;
      const learnN = await c.page.getByRole('button', { name: /start new words|learn \d+ new/i }).first().isVisible().catch(() => false);
      if (learnN) misleading = true;
    }
    await c.page.goto(`${BASE}/session/${c.classId}/${c.listId}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(4000);
    const term = await terminalVisible(c.page);
    await sleep(12000);
    const after = await FB.snapshotState(c.uid, c.classId, c.listId);
    c.rec.pre = before; c.rec.post = after;
    const probs = [];
    if (!heroOk) probs.push('finished hero did NOT persist across reloads');
    if (misleading) probs.push('misleading "learn N new words"/"start new words" CTA on a finished list');
    if (!term) probs.push('re-entry did not show the finished terminal');
    if (after.hash !== before.hash) probs.push(`re-entry ADVANCED state ${before.hash}->${after.hash} (must record nothing)`);
    if (probs.length) return setV(c.rec, 'FAIL', `RO-S9: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `finished hero persistent, no misleading copy, re-entry recorded nothing (${after.hash})`);
  },

  // RO-S10 (S10) — day-guard collision surfaces as REBUILD, never a false success. Mid-session admin csd bump
  // (a concurrent completion) → submit → 'rebuild'; csd advances EXACTLY ONCE; day-guard log/warn WITH uid.
  // (M-UI leg only; the transactional server leg is CS-2 in M-CALL — deferred to the next chunk.)
  'RO-S10': async (c) => {
    const since = Date.now();
    const pre = await FB.readProgress(c.uid, c.classId, c.listId); // fresh → csd 0
    const t = await driveNewWordsToTest(c.page, F, 'RO-S10');
    if (!t.reached) return setV(c.rec, 'INVALID', 'could not reach the new-word test to stage the collision');
    const rows = await readTestRows(c.page);
    const bump = await FB.bumpStudyDay({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, by: 1 });
    const mid = await FB.readProgress(c.uid, c.classId, c.listId);
    if (mid.csd !== bump.to) return setV(c.rec, 'INVALID', `pre-verify: csd bump did not materialize (${mid.csd} != ${bump.to})`);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'RO-S10');
    await sleep(2000);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const logs = await FB.readSystemLogsSince(c.uid, since, ['day_guard_rejected_session_cleared', 'day_guard_rejected', 'duplicate_day_completion_blocked']);
    const dayGuardLogged = Object.values(logs).some((v) => v);
    const consoleWarn = F.raw.some((x) => x.kind === 'day-guard-warn');
    const probs = [];
    if (outcome === 'results') probs.push('submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision (must rebuild)');
    else if (outcome !== 'rebuild') probs.push(`expected a rebuild message, got outcome=${outcome}`);
    if (post.csd !== bump.to) probs.push(`csd=${post.csd} != ${bump.to} — expected EXACTLY ONE advance (the concurrent one), not a second`);
    if (!dayGuardLogged && !consoleWarn) probs.push('no day_guard_rejected log NOR day-guard console warn observed (uid signal)');
    if (probs.length) return setV(c.rec, 'FAIL', `RO-S10: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `collision rebuilt (not results), csd held at ${post.csd} (one advance), day-guard signalled`);
  },

  // ============================================================================================================
  // RS BLOCK · P2 read/render truth surfaces (AUDIT_DESIGN §1.C). All teacher/read oracles.
  // ============================================================================================================

  // RS-1 (C-33) — server-side gradebook Name filter surfaces a DEEP-ranked student on page 1.
  'RS-1': async (c) => {
    const fillerEmail = await nextStudent();
    const fillerUid = await FB.uidByEmail(fillerEmail);
    if (!fillerUid) return setV(c.rec, 'INVALID', `no uid for filler ${fillerEmail}`);
    if (fillerUid === c.uid) return setV(c.rec, 'INVALID', 'need >=2 distinct SL_STUDENTS (filler == target)');
    let seeded;
    try {
      seeded = await FB.seedDeepGradebook({ target: { email: c.email, uid: c.uid }, filler: { email: fillerEmail, uid: fillerUid }, classId: c.classId, listId: c.listId, aheadCount: 55, targetCount: 3 });
    } catch (e) { return setV(c.rec, 'INVALID', `seedDeepGradebook: ${String(e).slice(0, 160)}`); }
    // MANDATORY pre-verify: the deep shape materialized.
    const tAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const fAtt = await FB.readAttempts(fillerUid, c.classId, c.listId);
    const mem = await FB.readMember(c.classId, c.uid);
    const pvProbs = [];
    if (tAtt.all.length < seeded.targetCount) pvProbs.push(`target has ${tAtt.all.length} attempts (< ${seeded.targetCount})`);
    if (fAtt.all.length < seeded.aheadCount) pvProbs.push(`filler has ${fAtt.all.length} ahead-attempts (< ${seeded.aheadCount})`);
    if (!mem || (mem.displayName || '').toLowerCase() !== seeded.token.toLowerCase()) pvProbs.push(`target member displayName != token "${seeded.token}"`);
    if (pvProbs.length) return setV(c.rec, 'INVALID', `pre-verify: ${pvProbs.join('; ')}`);
    // MEASURED STEP: teacher opens the gradebook + applies the Name filter.
    const { page: tp } = await newAuditPage(c.browser, F, 'teacher-RS-1');
    try {
      if (!(await login(tp, TEACHER, F))) return setV(c.rec, 'INVALID', 'teacher login failed');
      await tp.goto(`${BASE}/teacher/gradebook`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(2500);
      const filtered = await applyNameFilter(tp, seeded.token);
      if (!filtered.applied) return setV(c.rec, 'INVALID', `Name filter not applied (locator calibration): ${filtered.reason}`);
      await sleep(2500);
      const nameCells = await tp.getByRole('cell', { name: new RegExp(escRe(seeded.token), 'i') }).count().catch(() => 0);
      const showing = await readShowingCount(tp);
      const noResults = await tp.getByText(/your search returned no results/i).first().isVisible().catch(() => false);
      await shot(tp, `DFX_RS1_gradebook_${runId}`);
      const probs = [];
      if (noResults) probs.push('filtered gradebook shows "no results" — DEEP student NOT surfaced (client post-filter miss)');
      // C-33's success criterion is the SERVER filter surfacing the deep student's rows on page 1 (Showing≈targetCount).
      // The filter matches on the class-member displayName (the token) but the gradebook NAME cell renders the
      // user-account display name (e.g. "LSR Student 41"), so we assert on the filter RESULT, not the token text.
      // (r10: filter returned Showing=3==targetCount rows — fix works — but the cell rendered the account name; the
      // old `nameCells` token-text check was an oracle/render mismatch, not a fix failure.)
      if (showing == null || showing < seeded.targetCount) probs.push(`filter surfaced ${showing} rows (< target ${seeded.targetCount}) — deep student NOT fully on page 1`);
      // No upper-bound "filler leaked" check: the REUSED deep student (lsr_s*) accumulates attempts across un-swept
      // prior-run classes, inflating the count with its OWN rows (r11 screenshot: all 8 rows = the deep student).
      // Server-side filtering is proven by the deep student surfacing on page 1 AT ALL (a client post-pagination
      // filter would return "no results" for a rank-55-deep student).
      if (probs.length) return setV(c.rec, 'FAIL', `RS-1: ${probs.join('; ')}`);
      setV(c.rec, 'PASS', `deep student surfaced via server Name filter: Showing=${showing} (target ${seeded.targetCount}); nameCell rendered account displayName (${nameCells} token-cells)`);
    } finally { await tp.context().close().catch(() => {}); }
  },

  // RS-2 (C-34) — a testId-less automarker/manual attempt still renders in the gradebook WITH the list title
  // (listId resolved field-first: attemptData.listId ?? parsedListId).
  'RS-2': async (c) => {
    let seeded;
    try { seeded = await FB.seedTestIdlessAttempt({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId }); }
    catch (e) { return setV(c.rec, 'INVALID', `seedTestIdlessAttempt: ${String(e).slice(0, 160)}`); }
    // pre-verify: the attempt exists with listId set + NO testId.
    const att = await FB.readAttempts(c.uid, c.classId, c.listId);
    const idless = att.all.find((a) => (a.testId === undefined || a.testId === '' || a.testId === null) && a.listId === c.listId);
    if (!idless) return setV(c.rec, 'INVALID', 'pre-verify: testId-less attempt not materialized');
    const { page: tp } = await newAuditPage(c.browser, F, 'teacher-RS-2');
    try {
      if (!(await login(tp, TEACHER, F))) return setV(c.rec, 'INVALID', 'teacher login failed');
      await tp.goto(`${BASE}/teacher/gradebook`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(2500);
      const filtered = await applyNameFilter(tp, seeded.token);
      if (!filtered.applied) return setV(c.rec, 'INVALID', `Name filter not applied (locator calibration): ${filtered.reason}`);
      await sleep(2500);
      const nameCells = await tp.getByRole('cell', { name: new RegExp(escRe(seeded.token), 'i') }).count().catch(() => 0);
      const listCells = await tp.getByRole('cell', { name: new RegExp(escRe(LIST.title), 'i') }).count().catch(() => 0);
      await shot(tp, `DFX_RS2_gradebook_${runId}`);
      const probs = [];
      if (nameCells < 1) probs.push('testId-less attempt row NOT visible in the gradebook (dropped for lacking testId)');
      if (listCells < 1) probs.push(`row present but list title "${LIST.title}" not rendered (listId not resolved field-first)`);
      if (probs.length) return setV(c.rec, 'FAIL', `RS-2: ${probs.join('; ')}`);
      setV(c.rec, 'PASS', `testId-less attempt renders with list title "${LIST.title}" (${nameCells} row(s))`);
    } finally { await tp.context().close().catch(() => {}); }
  },

  // RS-3 (C-35) — assignedLists:[] + populated assignments renders the list on the student AND teacher surfaces.
  'RS-3': async (c) => {
    try { await FB.seedAssignedListsEmpty({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId }); }
    catch (e) { return setV(c.rec, 'INVALID', `seedAssignedListsEmpty: ${String(e).slice(0, 160)}`); }
    const cd = await FB.readClassDoc(c.classId);
    if (!cd || (Array.isArray(cd.assignedLists) && cd.assignedLists.length !== 0) || !cd.assignments || !cd.assignments[c.listId])
      return setV(c.rec, 'INVALID', `pre-verify: want assignedLists:[] + assignments[${c.listId}] present (got assignedLists=${JSON.stringify(cd?.assignedLists)})`);
    // STUDENT surface.
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000);
    await goDashboard(c.page).catch(() => {});
    const studentSees = await listReachable(c.page, LIST.title);
    // TEACHER surface (ClassDetail → Assigned Lists tab).
    const { page: tp } = await newAuditPage(c.browser, F, 'teacher-RS-3');
    let teacherSees = false;
    try {
      if (await login(tp, TEACHER, F)) {
        await openClassDetail(tp, c.className, F);
        await tp.getByRole('button', { name: 'Assigned Lists', exact: true }).first().click({ timeout: 5000 }).catch(() => {});
        await sleep(1500);
        teacherSees = await tp.getByText(new RegExp(escRe(LIST.title), 'i')).first().isVisible().catch(() => false);
        await shot(tp, `DFX_RS3_assignedlists_${runId}`);
      }
    } finally { await tp.context().close().catch(() => {}); }
    const probs = [];
    if (!studentSees) probs.push('list NOT reachable on the student surface (C-35 split-brain persists)');
    if (!teacherSees) probs.push('list NOT shown on the teacher Assigned-Lists surface');
    if (probs.length) return setV(c.rec, 'FAIL', `RS-3: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', 'assignedLists:[] class renders its assigned list on BOTH student + teacher surfaces');
  },

  // RS-4 (C-23) — a genuine [90,95) score under a 90-tier + undefined-retakeThreshold assignment DISPLAYS as
  // pass (stored serverPassed wins; the 0.95 client default must NOT invent a fail).
  'RS-4': async (c) => {
    try { await FB.seedDriftedAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, passThreshold: 90 }); }
    catch (e) { return setV(c.rec, 'INVALID', `seedDriftedAssignment: ${String(e).slice(0, 160)}`); }
    const cd = await FB.readClassDoc(c.classId);
    const asg = cd?.assignments?.[c.listId] || {};
    if (asg.passThreshold !== 90 || asg.retakeThreshold !== undefined)
      return setV(c.rec, 'INVALID', `pre-verify: passThreshold=${asg.passThreshold} retakeThreshold=${asg.retakeThreshold} (want 90 / undefined)`);
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000);
    await goDashboard(c.page).catch(() => {});
    const t = await driveNewWordsToTest(c.page, F, 'RS-4');
    if (!t.reached) return setV(c.rec, 'INVALID', 'could not reach the new-word test');
    const rows = await readTestRows(c.page);
    const nCorrect = Math.max(1, Math.round(rows.length * 0.93)); // aim inside [90,95): above the 90 tier, below the 0.95 default
    const { outcome } = await fillSubmitAndObserve(c.page, partialAnswers(rows, nCorrect, null), F, 'RS-4');
    if (outcome !== 'results') return setV(c.rec, 'FAIL', `RS-4 test did not reach results: ${outcome}`);
    const passCard = await c.page.getByText(/Completed Day \d+ session/i).first().isVisible().catch(() => false);
    const failCard = await c.page.getByText(/Did not pass/i).first().isVisible().catch(() => false);
    await shot(c.page, `DFX_RS4_resultcard_${runId}`);
    await sleep(1200);
    await goDashboard(c.page).catch(() => {});
    const att = await FB.readAttempts(c.uid, c.classId, c.listId);
    const newest = att.all.filter((a) => a.sessionType === 'new').sort(bySubmittedDesc)[0];
    const score = newest?.score;
    if (!newest) return setV(c.rec, 'FAIL', 'RS-4: no new attempt recorded');
    // INVALID (not FAIL) if the actual score fell OUTSIDE [90,95) — the oracle's gap was not exercised.
    if (!(score >= 90 && score < 95)) return setV(c.rec, 'INVALID', `score ${score}% outside [90,95) — grader drift; re-calibrate the answer count (did not exercise the serverPassed-vs-0.95 gap)`);
    const probs = [];
    if (newest.passed !== true) probs.push(`attempt.passed=${newest.passed} (want true under the 90-tier)`);
    if (!passCard || failCard) probs.push(`result card did NOT render PASS (passCard=${passCard} failCard=${failCard}) — the 0.95 default may have overridden serverPassed`);
    if (probs.length) return setV(c.rec, 'FAIL', `RS-4: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `${score}% under the 90-tier displays as PASS (serverPassed), attempt.passed=true`);
  },

  // ============================================================================================================
  // CUT BLOCK · P4 client cutover (AUDIT_DESIGN §1.E). CUT-2/3/4/7/8. Reset/challenge/marker legs route through
  // server CALLABLES under the P4 flags (SERVER_RESET_PROGRESS / SERVER_CHALLENGE_WRITE|SERVER_OVERRIDE /
  // SERVER_REVIEW_MARKER / SERVER_PROGRESS_WRITE) — those need the FLAG-ON functions env for M-UI; a callable
  // that is dark/flag-off self-reports INVALID (env), never a false PASS. (CUT-1 = STATIC bundle grep; CUT-5/6 = M-WB.)
  // ============================================================================================================

  // CUT-2 (reset-via-callable) — the reset FLOW succeeds end-to-end + attempts are server-wiped (the client
  // delete path is dead under the flag). Dual-class epoch semantics (CS-9) are M-CALL; this asserts the E2E unstick.
  'CUT-2': async (c) => {
    await FB.seedFix9Anchor({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, studyDay: 2, pace: c.pace, score: 97, passThreshold: c.thr });
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const preAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    if (!(pre.csd > 0) || preAtt.all.length < 1) return setV(c.rec, 'INVALID', `pre-verify: expected seeded progress+attempts to reset (csd=${pre.csd}, attempts=${preAtt.all.length})`);
    const r = await resetViaSettings(c.page, c.classId, c.listId);
    if (!r.ok) return setV(c.rec, 'INVALID', `reset flow not driven (Settings calibration): ${r.reason}`);
    if (r.sawError) return setV(c.rec, 'INVALID', 'resetProgress errored — SERVER_RESET_PROGRESS callable not live (flag-on functions env needed for M-UI reset)');
    await sleep(1500);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const postAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const probs = [];
    if (post.csd !== 0) probs.push(`csd=${post.csd} after reset (want Day-1 / 0)`);
    if (postAtt.all.length !== 0) probs.push(`${postAtt.all.length} attempts survived reset (want 0 — server-deleted; the client delete path is dead under the flag)`);
    if (probs.length) return setV(c.rec, 'FAIL', `CUT-2: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `reset succeeded end-to-end: post csd=0, attempts ${preAtt.all.length}→0 (server-wiped)`);
  },

  // CUT-3 (teacher Students view via resolver) — the ClassDetail Students row renders the RECONCILED day, not a
  // stale/zero legacy read. The straggler hydrate-on-miss leg is CS-8/M-CALL.
  'CUT-3': async (c) => {
    await FB.seedFix9Anchor({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, studyDay: 3, pace: c.pace, score: 97, passThreshold: c.thr });
    const token = `LSRCUT3${c.classId.slice(-4).toUpperCase()}`;
    await FB.seedMemberToken({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, token });
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    if (!(pre.csd >= 2)) return setV(c.rec, 'INVALID', `pre-verify: expected reconciled csd>=2, got ${pre.csd}`);
    const row = await readTeacherStudentsRow(c.browser, c.className, token, 'CUT-3');
    if (!row.ok) return setV(c.rec, 'INVALID', `teacher Students row not read (calibration): ${row.reason}`);
    if (row.dayN == null) return setV(c.rec, 'INVALID', `Students row shown but no "Day N" parsed (resolver-render calibration): "${(row.text || '').slice(0, 80)}"`);
    if (row.dayN < 2) return setV(c.rec, 'FAIL', `Students row shows Day ${row.dayN} — stale legacy read (reconciled csd=${pre.csd})`);
    setV(c.rec, 'PASS', `teacher Students view renders reconciled Day ${row.dayN} (csd=${pre.csd}); straggler-hydrate = CS-8/M-CALL`);
  },

  // CUT-4 (3rd twi writer routed) — teacher challenge-ACCEPT advances via the server path: NEW-phase accept
  // advances the day + CLAMPS twi to wordsRemaining; REVIEW-phase accept does NOT bump twi (nwei:null hazard).
  // Needs a distinct filler student for the review-phase arm (like RS-1). Callable env → INVALID.
  'CUT-4': async (c) => {
    if (LIST.size < c.pace + 2) return setV(c.rec, 'INVALID', `list too small (${LIST.size}) for the near-list-end clamp arm`);
    const fillerEmail = await nextStudent();
    const fillerUid = await FB.uidByEmail(fillerEmail);
    if (!fillerUid || fillerUid === c.uid) return setV(c.rec, 'INVALID', 'need >=2 distinct SL_STUDENTS (filler for the review-phase arm)');
    let wordIds = [];
    try { wordIds = await FB.getListWordIds(c.listId, { limit: 5 }); } catch { /* seedPendingChallenge falls back to a synthetic wordId */ }
    // NEW-phase arm (this student, near list end): accept must advance + CLAMP twi.
    const seededNew = await FB.seedPendingChallenge({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, variant: 'new', studyDay: 2, pace: c.pace, listSize: LIST.size, wordIds });
    const preNew = await FB.readProgress(c.uid, c.classId, c.listId);
    const accNew = await acceptPendingChallenge(c.browser, seededNew.token, 'CUT-4-new');
    if (accNew.callableError) return setV(c.rec, 'INVALID', `challenge-accept callable env not live (SERVER_OVERRIDE/SERVER_CHALLENGE_WRITE flag-on fns env needed): ${accNew.reason}`);
    if (!accNew.ok) return setV(c.rec, 'INVALID', `NEW-phase challenge Accept not driven (calibration): ${accNew.reason}`);
    const postNew = await FB.readProgress(c.uid, c.classId, c.listId);
    const probs = [];
    if (!(postNew.csd >= preNew.csd + 1)) probs.push(`NEW-phase accept did not advance the day (csd ${preNew.csd}->${postNew.csd})`);
    if (postNew.twi > LIST.size) probs.push(`twi=${postNew.twi} EXCEEDS listSize ${LIST.size} — not clamped to wordsRemaining`);
    // REVIEW-phase arm (filler student, same class): accept must NOT bump twi.
    const seededRev = await FB.seedPendingChallenge({ email: fillerEmail, uid: fillerUid, classId: c.classId, listId: c.listId, variant: 'review', studyDay: 3, pace: c.pace, listSize: LIST.size, wordIds });
    const preRev = await FB.readProgress(fillerUid, c.classId, c.listId);
    const accRev = await acceptPendingChallenge(c.browser, seededRev.token, 'CUT-4-review');
    if (accRev.callableError) return setV(c.rec, 'INVALID', `review-arm challenge-accept callable env not live: ${accRev.reason}`);
    if (!accRev.ok) return setV(c.rec, 'INVALID', `REVIEW-phase challenge Accept not driven (calibration): ${accRev.reason}`);
    const postRev = await FB.readProgress(fillerUid, c.classId, c.listId);
    if (postRev.twi !== preRev.twi) probs.push(`REVIEW-phase accept BUMPED twi ${preRev.twi}->${postRev.twi} (nwei:null hazard — must stay flat)`);
    if (probs.length) return setV(c.rec, 'FAIL', `CUT-4: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `challenge-accept: NEW advanced+clamped (twi=${postNew.twi}<=${LIST.size}), REVIEW twi flat (${postRev.twi}); legacy-untouched leg = STATIC/M-CALL`);
  },

  // CUT-7 (dashboard reconciled read) — a seeded day-1-passed impossible state (stale csd=0) renders the
  // RECONCILED day on the hero AND emits NO impossible_phase_detected during the visit. Needs the resolver (flag-on).
  'CUT-7': async (c) => {
    const since = Date.now();
    await FB.seedImpossiblePhaseT({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, pace: c.pace, score: 97, passThreshold: c.thr });
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    if (pre.csd !== 0) return setV(c.rec, 'INVALID', `pre-verify: impossible seed wants stale csd=0, got ${pre.csd}`);
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
    await goDashboard(c.page).catch(() => {});
    await selectList(c.page, LIST.title, F, 'CUT-7').catch(() => {});
    await sleep(3000);
    const badge = await c.page.getByText(/DAY \d+/i).first().innerText().catch(() => '');
    const m = badge.match(/DAY (\d+)/i);
    const heroDay = m ? parseInt(m[1], 10) : null;
    await shot(c.page, `DFX_CUT7_dashboard_${runId}`);
    const logs = await FB.readSystemLogsSince(c.uid, since, ['impossible_phase_detected']);
    if (heroDay == null) return setV(c.rec, 'INVALID', 'dashboard hero "DAY N" badge not read (render/resolver calibration — resolver may be dark)');
    const probs = [];
    if (logs.impossible_phase_detected) probs.push(`impossible_phase_detected emitted ×${logs.impossible_phase_detected} during the visit (reconciled read must NOT emit)`);
    if (heroDay < 2) probs.push(`hero shows DAY ${heroDay} — not the reconciled day (want >=2 after the passed day-1 reconciles)`);
    if (probs.length) return setV(c.rec, 'FAIL', `CUT-7: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `dashboard rendered reconciled DAY ${heroDay}, NO impossible_phase_detected emission`);
  },

  // CUT-8 (C-14/S7) — a mid-session all-mastered day writes a SERVER marker (parseable testId + real range,
  // CS-5 shape) and the day CARRIES to a fresh doc. The marker WRITE needs SERVER_REVIEW_MARKER (flag-on fns env);
  // if no marker materializes the scenario self-reports INVALID (env / S7-path calibration), never a false PASS.
  'CUT-8': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    const seeded = await FB.seedS7MidSessionMastered({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, studyDay: 2, pace: c.pace, wordIds });
    const preAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const term = await openFinishedTerminal(c.page, c.classId, c.listId); // drives the empty-review automarker path
    await sleep(3500);
    const postAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const marker = postAtt.all.filter((a) => !preAtt.all.some((p) => p.id === a.id)).sort(bySubmittedDesc)[0];
    if (!marker) return setV(c.rec, 'INVALID', 'no server marker attempt appeared — SERVER_REVIEW_MARKER callable env / S7-path not triggered (flag-on fns env needed for M-UI)');
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const probs = [];
    if (!term) probs.push('§5 finished terminal not shown on the mid-session all-mastered entry');
    if (!marker.testId) probs.push('marker attempt has no parseable testId (CS-5 shape)');
    if (marker.newWordStartIndex == null || marker.newWordEndIndex == null) probs.push('marker attempt missing the real newWord range (CS-5 pairing)');
    if (post.csd < seeded.studyDay) probs.push(`day did not carry to a fresh doc (csd=${post.csd} < ${seeded.studyDay} — anchorDay-1 phantom)`);
    if (probs.length) return setV(c.rec, 'FAIL', `CUT-8: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `S7: server marker written (testId + range), day carried (csd=${post.csd})`);
  },

  // ============================================================================================================
  // CA BLOCK · P8 CONT-A continuation (AUDIT_DESIGN §1.I). CA-1..6. PURE client render/navigation under
  // CONTINUATION_LINKS — fully realizable in M-UI (no server callable). Uses the RA6-style all-mastered terminal
  // entry so no completion write is needed. Needs a 2nd (CA-6: 3rd) teacher clone as the link target.
  // ============================================================================================================

  // CA-1 — finished choice terminal offers "Advance to {nextList} →" when the LAUNCHING class links nextListId.
  'CA-1': async (c) => {
    if (!NEXT_LIST) return setV(c.rec, 'INVALID', 'no 2nd teacher clone for the CONT-A link target (need >=2 clones)');
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    const link = await FB.seedNextListLink({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, nextListId: NEXT_LIST.id });
    const asg = await FB.readAssignment(c.classId, c.listId);
    if (asg?.nextListId !== NEXT_LIST.id) return setV(c.rec, 'INVALID', `pre-verify: assignments[list].nextListId=${asg?.nextListId} (want ${NEXT_LIST.id})`);
    const pv = await FB.preVerify(c.uid, c.classId, c.listId, { isListComplete: true, listSize: LIST.size });
    if (!pv.ok) return setV(c.rec, 'INVALID', `preVerify: ${pv.reason}`);
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    const btns = await terminalButtons(c.page);
    const nextTitle = link.nextListTitle || NEXT_LIST.title;
    const forTitle = await advanceButtonForTitle(c.page, nextTitle);
    await shot(c.page, `DFX_CA1_terminal_${runId}`);
    const probs = [];
    if (!term) probs.push('finished terminal not shown');
    if (!btns.advance) probs.push('no "Advance to …" button (CONTINUATION_LINKS off? or the link was not read)');
    if (!forTitle) probs.push(`Advance button not labeled with the next list title "${nextTitle}" (read from a wrong source)`);
    if (probs.length) return setV(c.rec, 'FAIL', `CA-1: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `finished terminal offers "Advance to ${nextTitle} →" (read from assignments[list].nextListId)`);
  },

  // CA-2 — Advance is PURE navigation + config read: next list starts Day 1; the FINISHED list's record is
  // NEVER written by the advance (§2.1 falsifier).
  'CA-2': async (c) => {
    if (!NEXT_LIST) return setV(c.rec, 'INVALID', 'no 2nd teacher clone for the link target');
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedNextListLink({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, nextListId: NEXT_LIST.id });
    const before = await FB.snapshotState(c.uid, c.classId, c.listId);
    const listHash = (s) => `csd${s.csd}|twi${s.twi}|rs${s.recentLen}`; // list-scoped (ignore the global sessions count)
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    if (!term) return setV(c.rec, 'INVALID', 'finished terminal not reached to click Advance');
    const adv = c.page.getByRole('button', { name: /Advance to .+/i }).first();
    if (!(await adv.isVisible().catch(() => false))) return setV(c.rec, 'INVALID', 'Advance button not present (CA-1 must pass first)');
    await adv.click().catch(() => {});
    await sleep(5000);
    const onNext = /\/session\//.test(c.page.url()) && c.page.url().includes(NEXT_LIST.id);
    const day1 = (await c.page.getByText(/Card \d+ of \d+/i).first().isVisible().catch(() => false))
      || (await c.page.getByText(/Welcome to your first day|Day 1/i).first().isVisible().catch(() => false))
      || (await c.page.locator('input[placeholder*="definition" i]').count().catch(() => 0)) > 0
      || (await c.page.getByRole('button', { name: /start new words|start studying/i }).first().isVisible().catch(() => false));
    await sleep(12000); // settle — prove the advance writes NOTHING to the finished list's record
    const after = await FB.snapshotState(c.uid, c.classId, c.listId);
    c.rec.pre = before; c.rec.post = after;
    const probs = [];
    if (!onNext) probs.push(`did not navigate to the next list's session (url tail=${c.page.url().slice(-42)})`);
    if (!day1) probs.push('next list did not start a Day-1 session (existing init path)');
    if (listHash(after) !== listHash(before)) probs.push(`the FINISHED list's record was WRITTEN by the advance (${listHash(before)}->${listHash(after)}) — §2.1 falsifier`);
    if (probs.length) return setV(c.rec, 'FAIL', `CA-2: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `advance = pure navigation: next list Day-1 started, finished list's record untouched (${listHash(after)})`);
  },

  // CA-3 — focus-yield PIN branch: a pinned FINISHED list yields primary focus to its linked nextListId (F6-5).
  'CA-3': async (c) => {
    if (!NEXT_LIST) return setV(c.rec, 'INVALID', 'no 2nd teacher clone for the link target');
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    const pin = await FB.seedPinnedFinished({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, nextListId: NEXT_LIST.id });
    const us = await FB.readUserSettings(c.uid);
    if (us.primaryFocusListId !== c.listId) return setV(c.rec, 'INVALID', `pre-verify: pin not set (primaryFocusListId=${us.primaryFocusListId})`);
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
    await goDashboard(c.page).catch(() => {});
    const focus = await readFocusList(c.page, { timeout: 8000 }).catch(() => null);
    await shot(c.page, `DFX_CA3_focus_${runId}`);
    if (!focus) return setV(c.rec, 'INVALID', 'List focus not read (dashboard focus calibration)');
    const nextTitle = pin.nextListTitle || NEXT_LIST.title;
    const probs = [];
    if (!focus.includes(nextTitle)) probs.push(`focus is "${focus}" — pinned finished list did NOT yield to the next list "${nextTitle}"`);
    if (focus.includes(LIST.title) && !focus.includes(nextTitle)) probs.push(`focus STUCK on the finished pinned list "${LIST.title}"`);
    if (probs.length) return setV(c.rec, 'FAIL', `CA-3: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `pinned finished list yielded primary focus to "${nextTitle}" (read-only, pin not rewritten)`);
  },

  // CA-4 — focus-yield RECENCY branch: an UNPINNED finished list (with active progress) yields to its next list.
  'CA-4': async (c) => {
    if (!NEXT_LIST) return setV(c.rec, 'INVALID', 'no 2nd teacher clone for the link target');
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedNextListLink({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, nextListId: NEXT_LIST.id });
    await FB.setPrimaryFocus({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, focusListId: null }); // ensure UNPINNED
    const us = await FB.readUserSettings(c.uid);
    if (us.primaryFocusListId) return setV(c.rec, 'INVALID', `pre-verify: pin not cleared (primaryFocusListId=${us.primaryFocusListId})`);
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
    await goDashboard(c.page).catch(() => {});
    const focus = await readFocusList(c.page, { timeout: 8000 }).catch(() => null);
    await shot(c.page, `DFX_CA4_focus_${runId}`);
    if (!focus) return setV(c.rec, 'INVALID', 'List focus not read (dashboard focus calibration)');
    if (!focus.includes(NEXT_LIST.title)) return setV(c.rec, 'FAIL', `CA-4: focus is "${focus}" — unpinned finished list did NOT yield to "${NEXT_LIST.title}" (recency branch)`);
    setV(c.rec, 'PASS', `unpinned finished list yielded primary focus to "${NEXT_LIST.title}" (recency branch)`);
  },

  // CA-5 — never a dead button: NO nextListId → the static P1 finished terminal EXACTLY (no Advance, and no
  // Start-over pre-CYC).
  'CA-5': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    const asg = await FB.readAssignment(c.classId, c.listId);
    if (asg?.nextListId) return setV(c.rec, 'INVALID', `pre-verify: expected NO nextListId, got ${asg.nextListId}`);
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    const btns = await terminalButtons(c.page);
    await shot(c.page, `DFX_CA5_terminal_${runId}`);
    const probs = [];
    if (!term) probs.push('§5 finished terminal not shown');
    if (btns.advance) probs.push('an "Advance" button rendered with NO nextListId (dead button)');
    if (btns.startOver) probs.push('a "Start over" button rendered pre-CYC (must be capability-gated behind CYCLING_ENABLED)');
    if (!btns.dash) probs.push('no "Back to Dashboard" button (the static terminal)');
    if (probs.length) return setV(c.rec, 'FAIL', `CA-5: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', 'static finished terminal only (no Advance, no Start-over) — never a dead button');
  },

  // CA-6 — dual-enroll: the LAUNCHING class's link governs (class = policy). Finishing under class A offers A's
  // next list even though class B links a different one.
  'CA-6': async (c) => {
    if (!NEXT_LIST || !NEXT_LIST_B) return setV(c.rec, 'INVALID', 'need >=3 teacher clones for dual-enroll distinct links (LIST + A.next + B.next)');
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    // class A (this scenario's class): finished list + link to NEXT_LIST.
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedNextListLink({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, nextListId: NEXT_LIST.id });
    // class B: provision + join + assign the SAME list, link to NEXT_LIST_B (a DIFFERENT next list).
    const classB = `25WT DFX CA-6B ${runId}`;
    const provB = await provisionClass(c.browser, classB, PROV.default);
    if (!provB.ok) return setV(c.rec, 'INVALID', `class B provisioning: ${provB.reason}`);
    await joinClass(c.page, provB.code, classB, F, 'CA-6B');
    await FB.seedNextListLink({ email: c.email, uid: c.uid, classId: provB.classId, listId: c.listId, nextListId: NEXT_LIST_B.id });
    // finish UNDER class A → the terminal must offer A's next (NEXT_LIST), not B's (NEXT_LIST_B).
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    const forA = await advanceButtonForTitle(c.page, NEXT_LIST.title);
    const forB = await advanceButtonForTitle(c.page, NEXT_LIST_B.title);
    await shot(c.page, `DFX_CA6_terminal_${runId}`);
    const probs = [];
    if (!term) probs.push('finished terminal not shown under class A');
    if (!forA) probs.push(`terminal did not offer class A's next list "${NEXT_LIST.title}"`);
    if (forB) probs.push(`terminal offered class B's next list "${NEXT_LIST_B.title}" — the LAUNCHING class must govern (§8.3 e)`);
    if (probs.length) return setV(c.rec, 'FAIL', `CA-6: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `dual-enroll: finishing under class A offered A's link "${NEXT_LIST.title}", not B's "${NEXT_LIST_B.title}"`);
  },

  // ============================================================================================================
  // CY BLOCK · P9 cycling (AUDIT_DESIGN §1.J). CY-1..7. Gated on CYCLING_ENABLED (global build flag) +
  // per-assignment cyclingEnabled. CY-1/CY-7 = pure client render (realizable). CY-2 = client lap-rollover start.
  // CY-3/4/5 = lap-2 COMPLETION legs → need the flag-on completeSession fns env (fail-closed INVALID otherwise).
  // CY-6 = FLAG-OFF-build dead-end assertion (two-build discipline — auto-detects the build).
  // ============================================================================================================

  // CY-1 — "Start over" renders on the choice terminal only under cyclingEnabled (+ the global CYCLING_ENABLED).
  'CY-1': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const asg = await FB.readAssignment(c.classId, c.listId);
    if (asg?.cyclingEnabled !== true) return setV(c.rec, 'INVALID', `pre-verify: cyclingEnabled=${asg?.cyclingEnabled} (want true)`);
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    const btns = await terminalButtons(c.page);
    await shot(c.page, `DFX_CY1_terminal_${runId}`);
    if (!term) return setV(c.rec, 'INVALID', 'finished terminal not shown');
    if (!btns.startOver) return setV(c.rec, 'INVALID', '"Start over" NOT present under cyclingEnabled — confirm the CYCLING_ENABLED build flag is ON (calibration; a flag-off build cannot exercise CY-1)');
    setV(c.rec, 'PASS', '"Start over" present on the choice terminal under cyclingEnabled + CYCLING_ENABLED');
  },

  // CY-2 — lap rollover: choosing "Start over" begins a new lap (the allocation cap is removed → new-words
  // allocation resumes). The twi-strictly-increases-past-listTotal PERSISTENCE + lap-aware DISPLAY are the CY-3
  // completion / M-CALL legs (a lap-2 day must complete first) — flagged in MUI_BUILD_NOTES.
  'CY-2': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    if (!term) return setV(c.rec, 'INVALID', 'finished terminal not reached');
    const startOver = c.page.getByRole('button', { name: /start over/i }).first();
    if (!(await startOver.isVisible().catch(() => false))) return setV(c.rec, 'INVALID', '"Start over" not present (CY-1 must pass; confirm CYCLING_ENABLED is ON)');
    await startOver.click().catch(() => {});
    await sleep(5000);
    const lap2New = (await c.page.getByText(/Card \d+ of \d+/i).first().isVisible().catch(() => false))
      || (await c.page.getByRole('button', { name: /start new words|start studying/i }).first().isVisible().catch(() => false))
      || (await c.page.locator('input[placeholder*="definition" i]').count().catch(() => 0)) > 0;
    await shot(c.page, `DFX_CY2_lap2_${runId}`);
    if (!lap2New) return setV(c.rec, 'FAIL', 'CY-2: "Start over" did not begin a new lap (the allocation cap was not removed — no new-words allocation)');
    setV(c.rec, 'PASS', 'lap rollover: "Start over" began a new lap (cap removed, new-words allocation resumed); twi-past-listTotal + lap display = CY-3/M-CALL');
  },

  // CY-3 — a lap-2 day COMPLETES; M4 is lap-aware (a lap-2 day is NOT anchor-rejected); twi climbs past listTotal.
  // Completion routes through completeSession (flag-on fns env) → INVALID when the lap-2 day can't be completed.
  'CY-3': async (c) => {
    const since = Date.now();
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    if (!term) return setV(c.rec, 'INVALID', 'finished terminal not reached');
    const startOver = c.page.getByRole('button', { name: /start over/i }).first();
    if (!(await startOver.isVisible().catch(() => false))) return setV(c.rec, 'INVALID', '"Start over" not present (confirm CYCLING_ENABLED)');
    await startOver.click().catch(() => {});
    await sleep(5000);
    const t = await driveNewWordsToTest(c.page, F, 'CY-3');
    if (!t.reached) return setV(c.rec, 'INVALID', 'lap-2 new-words test not reached (cap-removal/allocation calibration or fns env)');
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'CY-3');
    if (outcome !== 'results') return setV(c.rec, 'INVALID', `lap-2 day did not complete (outcome=${outcome}) — completeSession callable env / lap allocation`);
    await returnFromResultsAndClearCompletion(c.page, F, 'CY-3'); await goDashboard(c.page).catch(() => {});
    const logs = await FB.readSystemLogsSince(c.uid, since, ['anchor_rejected', 'csd_anchor_invalid']);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const probs = [];
    if (logs.anchor_rejected) probs.push(`anchor_rejected ×${logs.anchor_rejected} on a lap-2 day (M4 must be lap-aware)`);
    if (logs.csd_anchor_invalid) probs.push(`csd_anchor_invalid ×${logs.csd_anchor_invalid} on lap 2`);
    if (!(post.twi > LIST.size)) probs.push(`twi=${post.twi} did not climb past listTotal ${LIST.size} on lap 2`);
    if (probs.length) return setV(c.rec, 'FAIL', `CY-3: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', `lap-2 day completed, twi past listTotal (${post.twi}>${LIST.size}), no anchor_rejected`);
  },

  // CY-4 — review pool lap-BOUNDED: a lap-2 review draws only lap-2-eligible words (not the whole cumulative
  // virtual index). Requires a completed lap-2 day + a study_states pool read. Realized as a bounded-pool proxy
  // (eligible pool <= cycleLength); the exact lap-field membership assert is an M-WB/CALL concern (flagged).
  'CY-4': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    if (!term) return setV(c.rec, 'INVALID', 'finished terminal not reached');
    const startOver = c.page.getByRole('button', { name: /start over/i }).first();
    if (!(await startOver.isVisible().catch(() => false))) return setV(c.rec, 'INVALID', '"Start over" not present (confirm CYCLING_ENABLED)');
    await startOver.click().catch(() => {});
    await sleep(5000);
    const t = await driveNewWordsToTest(c.page, F, 'CY-4');
    if (!t.reached) return setV(c.rec, 'INVALID', 'lap-2 new-words test not reached (cap-removal / fns env) — cannot inspect the lap-2 review pool');
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'CY-4');
    if (outcome !== 'results') return setV(c.rec, 'INVALID', `lap-2 day did not complete (outcome=${outcome}) — need the flag-on completeSession env to reach a lap-2 review`);
    await returnFromResultsAndClearCompletion(c.page, F, 'CY-4'); await goDashboard(c.page).catch(() => {});
    const states = await FB.readStudyStates(c.uid, c.listId);
    const eligible = states.filter((s) => s.status !== 'MASTERED').length; // lap-bounded review pool proxy
    if (eligible > LIST.size) return setV(c.rec, 'FAIL', `CY-4: review pool ${eligible} exceeds cycleLength ${LIST.size} — not lap-bounded`);
    setV(c.rec, 'PASS', `lap-2 review pool bounded by cycleLength (${eligible}<=${LIST.size}); exact lap-membership assert = M-WB/M-CALL`);
  },

  // CY-5 — review-only × laps: a review-only day INSIDE lap 2 completes with twi FLAT (RA1-style oracle). The
  // completion routes through completeSession (flag-on fns env) → INVALID when unreachable.
  'CY-5': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    if (!term) return setV(c.rec, 'INVALID', 'finished terminal not reached');
    const startOver = c.page.getByRole('button', { name: /start over/i }).first();
    if (!(await startOver.isVisible().catch(() => false))) return setV(c.rec, 'INVALID', '"Start over" not present (confirm CYCLING_ENABLED)');
    await startOver.click().catch(() => {});
    await sleep(5000);
    // throttle the lap-2 student → a review-only day (intervention=1.0), twi seeded past listTotal (lap 2).
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 3, twi: LIST.size + c.pace });
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const d = await driveReviewOnlyDay(c.page, 'CY-5', { nCorrect: null });
    if (d.outcome !== 'results') return setV(c.rec, 'INVALID', `lap-2 review-only day did not complete (outcome=${d.outcome}) — completeSession callable env`);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const a = assertComplete(pre, post);
    if (!a.ok) return setV(c.rec, 'FAIL', `CY-5 (review-only×laps): ${a.detail}`);
    setV(c.rec, 'PASS', `lap-2 review-only day completed with twi FLAT (${post.twi}); csd ${pre.csd}->${post.csd}`);
  },

  // CY-6 — flag-OFF mid-lap: the student re-dead-ends at the lap boundary into the P8 terminal, NO corruption.
  // TWO-BUILD: auto-detects the build — if "Start over" renders (a CYCLING_ENABLED flag-ON build) it INVALIDs
  // with a run-against-the-flag-off-baseline note; on the flag-OFF build it asserts the clean dead-end.
  'CY-6': async (c) => {
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const term = await openFinishedTerminal(c.page, c.classId, c.listId);
    const btns = await terminalButtons(c.page);
    await shot(c.page, `DFX_CY6_terminal_${runId}`);
    if (btns.startOver) return setV(c.rec, 'INVALID', 'CY-6 asserts the FLAG-OFF lap-boundary dead-end, but "Start over" is present ⇒ this is a CYCLING_ENABLED flag-ON build — run CY-6 against the flag-OFF baseline (two-build discipline)');
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const probs = [];
    if (!term) probs.push('flag-off: finished terminal did not render at the lap boundary');
    if (post.twi < pre.twi) probs.push(`twi REGRESSED at the lap boundary ${pre.twi}->${post.twi} (corruption)`);
    if (post.csd < pre.csd) probs.push(`csd REGRESSED ${pre.csd}->${post.csd}`);
    if (probs.length) return setV(c.rec, 'FAIL', `CY-6: ${probs.join('; ')}`);
    setV(c.rec, 'PASS', 'flag-off lap boundary dead-ends at the P8 finished terminal, counters coherent (no twi/csd regression)');
  },

  // CY-7 — finished/focus test is lap-aware: a cycling finished list does NOT misfire the CA-3 focus-yield
  // every lap (the yield is gated OFF for an effectively-cycling list) — focus STAYS on the cycling list.
  'CY-7': async (c) => {
    if (!NEXT_LIST) return setV(c.rec, 'INVALID', 'no 2nd teacher clone (the yield needs a link to be gated off)');
    let wordIds;
    try { wordIds = await FB.getListWordIds(c.listId, { limit: LIST.size }); }
    catch (e) { return setV(c.rec, 'INVALID', `getListWordIds (A1): ${String(e).slice(0, 120)}`); }
    await FB.seedAllMasteredTerminal({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, twi: LIST.size, csd: 2, wordIds });
    await FB.seedCyclingAssignment({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, nextListId: NEXT_LIST.id });
    const asg = await FB.readAssignment(c.classId, c.listId);
    if (asg?.cyclingEnabled !== true || asg?.nextListId !== NEXT_LIST.id) return setV(c.rec, 'INVALID', `pre-verify: cyclingEnabled=${asg?.cyclingEnabled} nextListId=${asg?.nextListId} (want true / ${NEXT_LIST.id})`);
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
    await goDashboard(c.page).catch(() => {});
    const focus = await readFocusList(c.page, { timeout: 8000 }).catch(() => null);
    await shot(c.page, `DFX_CY7_focus_${runId}`);
    if (!focus) return setV(c.rec, 'INVALID', 'List focus not read (dashboard focus calibration)');
    if (focus.includes(NEXT_LIST.title) && !focus.includes(LIST.title)) return setV(c.rec, 'FAIL', `CY-7: cycling finished list SPURIOUSLY yielded to "${NEXT_LIST.title}" — the yield must be gated off for a cycling list (confirm CYCLING_ENABLED is ON; a flag-off build would yield legitimately per P8)`);
    if (!focus.includes(LIST.title)) return setV(c.rec, 'INVALID', `focus is "${focus}" — not the cycling list "${LIST.title}" (unexpected; recheck seed/calibration)`);
    setV(c.rec, 'PASS', `cycling finished list KEEPS focus on "${LIST.title}" (no spurious per-lap yield)`);
  },

  // ============================================================================================================
  // OV BLOCK · P10 override + challenge redesign (AUDIT_DESIGN §1.K) — the E2E legs OV-1/4/5. The override
  // CALLABLE (authz UNION + audit log + server derivation) and OV-2/3/6 are M-CALL/M-RULES. OV-1's E2E leg
  // certifies the UNSTICK corollary (a valid override anchor advances the day); OV-4/5 need SERVER_OVERRIDE /
  // TEACHER_IDS_READ flag-on (fail-closed INVALID otherwise).
  // ============================================================================================================

  // OV-1 — permafail → override → UNSTUCK. The overridden attempt carries a FULL VALID anchor (CS-6 M4 parity)
  // and the day advances. applyOverrideAnchor stands in for the overrideAttempt callable's server WRITE (the
  // callable itself = CS-6 / OV-1-CALL, not exercised here).
  'OV-1': async (c) => {
    const seeded = await FB.seedPermafail({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, studyDay: 2, pace: c.pace, score: 40 });
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const preAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const stuck = preAtt.all.find((a) => a.sessionType === 'new' && a.passed === false);
    if (!stuck) return setV(c.rec, 'INVALID', 'pre-verify: permafail (failed-new) attempt not materialized');
    if (pre.csd !== seeded.studyDay - 1) return setV(c.rec, 'INVALID', `pre-verify: expected stuck csd=${seeded.studyDay - 1}, got ${pre.csd}`);
    const ov = await FB.applyOverrideAnchor({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, studyDay: 2, pace: c.pace, score: 100, passThreshold: c.thr });
    const overrideAtt = await FB.readAttemptDoc(ov.docId);
    const anchorProbs = [];
    for (const f of ['newWordStartIndex', 'newWordEndIndex', 'wordsIntroduced', 'testId']) if (overrideAtt?.[f] == null) anchorProbs.push(`override attempt missing ${f}`);
    if (overrideAtt && overrideAtt.newWordEndIndex !== overrideAtt.newWordStartIndex + overrideAtt.wordsIntroduced - 1) anchorProbs.push('override anchor arithmetic invalid (nwei != nwsi+wordsIntroduced-1)');
    if (anchorProbs.length) return setV(c.rec, 'FAIL', `OV-1 override anchor (CS-6 M4 parity): ${anchorProbs.join('; ')}`);
    await c.page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000);
    await goDashboard(c.page).catch(() => {});
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    if (post.csd < seeded.studyDay) return setV(c.rec, 'FAIL', `OV-1: student still stuck (csd=${post.csd} < ${seeded.studyDay}) after the override`);
    setV(c.rec, 'PASS', `permafail UNSTUCK: override anchor valid (nwsi/nwei/wordsIntroduced/testId), csd ${pre.csd}->${post.csd}; override callable authz+audit = CS-6/M-CALL`);
  },

  // OV-4 — orphaned challenge (C-19): a PROMOTED student's PENDING challenge (stamped to an EX-teacher) becomes
  // actionable by the CURRENT owner. Needs TEACHER_IDS_READ (owner sees it) + SERVER_OVERRIDE (accept routes).
  'OV-4': async (c) => {
    let wordIds = [];
    try { wordIds = await FB.getListWordIds(c.listId, { limit: 3 }); } catch { /* synthetic wordId fallback */ }
    const seeded = await FB.seedPendingChallenge({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, variant: 'new', studyDay: 2, pace: c.pace, listSize: LIST.size, wordIds, exTeacherId: EX_TEACHER_STAMP });
    const att = await FB.readAttemptDoc(seeded.docId);
    if (!att || att.teacherId !== EX_TEACHER_STAMP) return setV(c.rec, 'INVALID', 'pre-verify: inherited pending-challenge attempt not stamped to the ex-teacher');
    if (!(att.teacherIds || []).includes(seeded.owner)) return setV(c.rec, 'INVALID', 'pre-verify: teacherIds does not include the current owner (reindex denorm) — owner cannot inherit');
    const acc = await acceptPendingChallenge(c.browser, seeded.token, 'OV-4');
    if (acc.callableError) return setV(c.rec, 'INVALID', `orphaned-challenge accept callable env not live (SERVER_OVERRIDE flag-on fns env needed): ${acc.reason}`);
    if (!acc.ok) return setV(c.rec, 'INVALID', `the new owner could not see/accept the inherited challenge (calibration / TEACHER_IDS_READ): ${acc.reason}`);
    setV(c.rec, 'PASS', 'promoted student\'s PENDING challenge became actionable by the new owner (accepted; no "단어 권한이 없습니다" throw)');
  },

  // OV-5 — gradebook inherited-attempts leg + ex-roster filter: the CURRENT owner's gradebook SHOWS the
  // A-stamped attempt (TEACHER_IDS_READ array-contains) and a Name filter on the ex-roster student returns rows,
  // not a hard-empty. Needs TEACHER_IDS_READ flag-on.
  'OV-5': async (c) => {
    const seeded = await FB.seedInheritedAttempt({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, exTeacherId: EX_TEACHER_STAMP });
    const att = await FB.readAttemptDoc(seeded.docId);
    if (!att || !(att.teacherIds || []).includes(seeded.owner)) return setV(c.rec, 'INVALID', 'pre-verify: inherited attempt teacherIds missing the current owner');
    const { page: tp } = await newAuditPage(c.browser, F, 'teacher-OV-5');
    try {
      if (!(await login(tp, TEACHER, F))) return setV(c.rec, 'INVALID', 'teacher login failed');
      await tp.goto(`${BASE}/teacher/gradebook`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(2500);
      const filtered = await applyNameFilter(tp, seeded.token);
      if (!filtered.applied) return setV(c.rec, 'INVALID', `Name filter not applied (calibration): ${filtered.reason}`);
      await sleep(2000);
      const nameCells = await tp.getByRole('cell', { name: new RegExp(escRe(seeded.token), 'i') }).count().catch(() => 0);
      const noResults = await tp.getByText(/your search returned no results/i).first().isVisible().catch(() => false);
      await shot(tp, `DFX_OV5_gradebook_${runId}`);
      const probs = [];
      if (noResults) probs.push('ex-roster Name filter returned "no results" — hard-empty (the base teacherId== predicate cannot show the owner the A-stamped attempt)');
      if (nameCells < 1) probs.push('inherited (A-stamped) attempt NOT visible in the owner\'s gradebook — TEACHER_IDS_READ array-contains query not effective (flag-on?)');
      if (probs.length) return setV(c.rec, 'INVALID', `OV-5 (TEACHER_IDS_READ flag-on required): ${probs.join('; ')}`);
      setV(c.rec, 'PASS', `inherited (A-stamped) attempt visible in the owner's gradebook + ex-roster Name filter returns rows (${nameCells})`);
    } finally { await tp.context().close().catch(() => {}); }
  },
};

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────
// Derive the covered blocks from the attempted scenario set (for the manifest + header).
const BLOCK = (() => {
  const has = (re) => SCEN.some((id) => re.test(id));
  return [has(/^RA|^RO-/) && 'RO', has(/^RS-/) && 'RS', has(/^CUT-/) && 'CUT', has(/^CA-/) && 'CA', has(/^CY-/) && 'CY', has(/^OV-/) && 'OV'].filter(Boolean).join('+') || 'none';
})();
console.log(`\n▶ deepfix M-UI (${BLOCK}) ${runId} — BASE=${BASE} build=${BUILD_ID} tier=${LIST.tier} list=${LIST.title}(${LIST.size}) students=${STUDENTS.length}\n`);
const browser = await launch();
try {
  // Concurrency (DFX_CONCURRENCY, default 1 = sequential/byte-equivalent). Each scenario pulls a DISTINCT student
  // via round-robin nextStudent() + creates its own class + browser context, so N-at-a-time is collision-free as
  // long as SL_STUDENTS has >= N*2 accounts (RS-1/OV-5 consume a filler too). Speed lever for large runs.
  const CONCURRENCY = Math.max(1, Number(process.env.DFX_CONCURRENCY || 1));
  const runOne = async (id) => {
    const fn = SCENARIOS[id];
    if (!fn) { results.push({ id, verdict: 'INVALID', detail: 'unknown scenario', confirmed: false }); console.log(`    ⚠️ ${id} INVALID — unknown scenario`); return; }
    console.log(`  → ${id} …`);
    await runScenario(browser, id, fn);
    const r = results.find((x) => x.id === id);
    console.log(`    ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} ${id} ${r.verdict} — ${r.detail || ''}`);
  };
  for (let i = 0; i < SCEN.length; i += CONCURRENCY) {
    await Promise.all(SCEN.slice(i, i + CONCURRENCY).map(runOne));
  }
} finally { await browser.close().catch(() => {}); }

// fatal app-health signals invalidate the whole run (console-error filtered through the allowlist).
const fatals = [
  ...F.raw.filter((x) => FATAL_KINDS.includes(x.kind)),
  ...F.raw.filter((x) => x.kind === 'console-error' && !isFirestoreChannelAbort(x.detail) && !CONSOLE_ALLOW.some((re) => re.test(x.detail))),
  ...F.raw.filter((x) => x.kind === 'request-failed' && !isFirestoreChannelAbort(x.detail) && !isDevAssetAbort(x.detail)),
];
const allClean = results.length === SCEN.length && results.every((r) => r.verdict === 'PASS') && fatals.length === 0;
const manifest = {
  runId, buildId: BUILD_ID, matrix: 'M-UI', block: BLOCK, gitHead, gitDirty, base: BASE, ranAt: new Date().toISOString(),
  scenarioSet: SCEN, tier: LIST.tier, listId: LIST.id, listSize: LIST.size, teacher: TEACHER, studentPool: STUDENTS.length,
  results: results.map((r) => ({ id: r.id, verdict: r.verdict, confirmed: r.confirmed, detail: r.detail, studentUid: r.uid, classId: r.classId, listId: r.listId, pre: r.pre?.hash, post: r.post?.hash })),
  fatals: fatals.map((f) => `${f.kind}: ${f.detail}`),
  cleanCount: results.filter((r) => r.verdict === 'PASS').length,
  verdict: allClean ? 'PASS' : 'NOT-CLEAN',
};
writeFileSync(`${AUD}/findings/deepfix_ui_${runId}.json`, JSON.stringify(manifest, null, 2));

// human-readable table
let md = `# deepfix M-UI (${BLOCK}) — ${runId}\n\n`;
md += `**When:** ${manifest.ranAt}  \n**BASE:** ${BASE}  \n**Build:** ${BUILD_ID}  \n`;
md += `**git:** ${gitHead}${gitDirty ? ' (DIRTY)' : ''}  \n**List:** ${LIST.title} (${LIST.tier}, ${LIST.size} words)  \n`;
md += `**Result:** ${manifest.cleanCount}/${SCEN.length} PASS · ${fatals.length} fatal anomalies · **${manifest.verdict}**\n\n`;
md += `> INVALID = a precondition/seed could not be materialized (setup problem), NOT a pass. Only PASS certifies.\n\n`;
md += `| Scenario | Verdict | studentUid | classId | Detail |\n|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.id} | ${r.verdict} | ${(r.uid || '').slice(0, 10)} | ${(r.classId || '').slice(0, 10)} | ${(r.detail || '').replace(/\|/g, '/').slice(0, 140)} |\n`;
if (fatals.length) { md += `\n**Fatal anomalies:**\n`; for (const f of fatals.slice(0, 20)) md += `- ${f.kind}: ${String(f.detail).slice(0, 160)}\n`; }
writeFileSync(`${AUD}/findings/deepfix_ui_${runId}.md`, md);

console.log(`\n=== deepfix M-UI MANIFEST (${runId}) ===`);
for (const r of manifest.results) console.log(`  ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} ${r.id.padEnd(6)} ${r.verdict} — ${r.detail || ''}`);
if (fatals.length) console.log(`  ⛔ ${fatals.length} fatal app-health signal(s)`);
console.log(`\n${allClean ? '✅ deepfix M-UI PASS' : '❌ NOT CLEAN'} — ${manifest.cleanCount}/${SCEN.length} → findings/deepfix_ui_${runId}.json`);
process.exit(allClean ? 0 : 1);
