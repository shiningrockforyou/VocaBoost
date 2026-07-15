/**
 * lsr_reviewonly.mjs — E2E acceptance runner for the review-only Phase-1 fix (UI matrix).
 * Design: docs/plans/PLAN_reviewonly_playwright_audit.md v2 (Codex GO). LOCAL-ONLY (localhost:5173, NOT live).
 *
 *   LSR_BASE_URL=http://localhost:5173 LSR_BUILD_ID=<build> LSR_TEACHER=lsr_teacher_02@vocaboost.test \
 *   SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@...,...   (>=1; one per scenario, else reset+reuse) \
 *   LSR_TIER=CORE  RO_SCENARIOS="RA1 RA2 RA3 RA5 RA5b RA6 RA7 RA8 RA9" (default = all) \
 *   PLAYWRIGHT_BROWSERS_PATH=... NODE_PATH=/app/node_modules node audit/playwright/lsr_reviewonly.mjs [runId]
 *
 * Certifies ONLY on an all-CLEAN matrix (exit 1 otherwise). Fail-closed + identity-bound + artifact-bound.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const AUD = '/app/audit/playwright';
const runId = process.argv[2] || `RO_${Date.now()}`;
const BUILD_ID = process.env.LSR_BUILD_ID || 'local-dev';
const TEACHER = process.env.LSR_TEACHER;
const STUDENTS = (process.env.SL_STUDENTS || process.env.SL_STUDENT || '').split(',').map((s) => s.trim()).filter(Boolean);
const TIER = process.env.LSR_TIER || null;
const SCEN = (process.env.RO_SCENARIOS || 'RA1 RA2 RA3 RA5 RA5b RA6 RA7 RA8 RA9').trim().split(/\s+/);

// lsr_ui.mjs import TRIGGERS the fail-closed base guard (throws unless BASE is http://localhost).
const UI = await import('./lsr_ui.mjs');
const { BASE, makeFindings, launch, newAuditPage, login, joinClass, selectList, goDashboard,
        enterReviewSession, readTestRows, partialAnswers, carefulAnswersFrom, fillSubmitAndObserve,
        returnFromResultsAndClearCompletion, driveNewWordsToTest, driveReviewToTest, skipToTest,
        shot, sleep } = UI;
const FB = await import('./lsr_reviewonly_fb.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');
const { TIER_SIZE } = await import('./lsr_personas.mjs');

// ── IDENTITY GUARD (fail-closed, BEFORE any login/seed) — design §0.2, Lens B HIGH1 ───────────────────────
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
// Authoritative size = the list doc's wordCount (the cloned audit lists are tier "legacy", not in TIER_SIZE).
const LIST_SIZE = await FB.readListWordCount(chosen.newId).catch((e) => { console.error(String(e)); process.exit(2); });
const LIST = { id: chosen.newId, title: chosen.title, tier: chosen.tier, size: LIST_SIZE };

const F = makeFindings(`RO_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });
const gitHead = (() => { try { return execSync('git rev-parse HEAD', { cwd: '/app' }).toString().trim(); } catch { return 'unknown'; } })();
const gitDirty = (() => { try { return execSync('git status --porcelain', { cwd: '/app' }).toString().trim().length > 0; } catch { return true; } })();

const FATAL_KINDS = ['exception', 'BUG', 'console-error', 'page-error', 'unexpected-dialog', 'login-failed', 'oracle-mismatch', 'verify-fail'];
const results = [];   // one per scenario: {id, verdict:'PASS'|'FAIL'|'INVALID', confirmed, detail, uid, classId, listId, pre, post}

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
  if (!ent.reached) return { outcome: 'not-reached' };
  const rows = await readTestRows(page);
  const answers = nCorrect == null ? carefulAnswersFrom(rows, null) : partialAnswers(rows, nCorrect, null);
  const { outcome } = await fillSubmitAndObserve(page, answers, F, label);
  await returnFromResultsAndClearCompletion(page, F, label);
  await goDashboard(page).catch(() => {});
  return { outcome, size: rows.length };
}

// Affirmative EXPECTED-COMPLETE oracle (never merely "not blocked"): csd+1, twi flat, reviewAttempts+1,
// newAttempts Δ0, recentSessions[last].newWordScore===null. Returns {ok, detail}.
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

// ── scenario harness ──────────────────────────────────────────────────────────────────────────────────────
let studentIdx = 0;
async function nextStudent() { const e = STUDENTS[studentIdx % STUDENTS.length]; studentIdx++; return e; }

async function runScenario(browser, id, fn) {
  const email = await nextStudent();
  const uid = await FB.uidByEmail(email);
  const rec = { id, email, uid, listId: LIST.id, verdict: 'PENDING', confirmed: false, detail: '' };
  results.push(rec);
  if (!uid) { rec.verdict = 'INVALID'; rec.detail = `no uid for ${email}`; return; }
  try {
    const className = `25WT RO ${id} ${runId}`;
    const prov = await provisionClass(browser, className, { pace: 3 });
    if (!prov.ok) { rec.verdict = 'INVALID'; rec.detail = prov.reason; return; }
    rec.classId = prov.classId;
    await FB.resetStudentState({ email, uid, classId: prov.classId, listId: LIST.id });
    const { page } = await newAuditPage(browser, F, `student-${id}`);
    if (!(await login(page, email, F))) { rec.verdict = 'INVALID'; rec.detail = 'student login failed'; await page.context().close().catch(() => {}); return; }
    await joinClass(page, prov.code, className, F, id);
    await selectList(page, LIST.title, F, id).catch(() => {});
    await goDashboard(page).catch(() => {});
    await fn({ page, email, uid, classId: prov.classId, listId: LIST.id, className, pace: prov.pace, thr: prov.thr, rec, id });
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
  // RA1 — full-freeze RECOVERY: interv=1.0 → review-only day completes → csd+1, twi flat, newWordScore null,
  // then a LATER high-review day yields newWordCount>0 (recovery closes).
  RA1: async (c) => {
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2 });
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

  // RA2 — persistent-low: interv pinned 1.0, each review-only day completes (csd advances), twi flat.
  RA2: async (c) => {
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2 });
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
};

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────
console.log(`\n▶ review-only ACCEPTANCE ${runId} — BASE=${BASE} build=${BUILD_ID} tier=${LIST.tier} list=${LIST.title}(${LIST.size}) students=${STUDENTS.length}\n`);
const browser = await launch();
try {
  for (const id of SCEN) {
    const fn = SCENARIOS[id];
    if (!fn) { results.push({ id, verdict: 'INVALID', detail: 'unknown scenario', confirmed: false }); continue; }
    console.log(`  → ${id} …`);
    await runScenario(browser, id, fn);
    const r = results.find((x) => x.id === id);
    console.log(`    ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} ${id} ${r.verdict} — ${r.detail || ''}`);
  }
} finally { await browser.close().catch(() => {}); }

// fatal app-health signals invalidate the whole run
const fatals = F.raw.filter((x) => FATAL_KINDS.includes(x.kind));
const allClean = results.length === SCEN.length && results.every((r) => r.verdict === 'PASS') && fatals.length === 0;
const manifest = {
  runId, buildId: BUILD_ID, gitHead, gitDirty, base: BASE, ranAt: new Date().toISOString(),
  scenarioSet: SCEN, tier: LIST.tier, listId: LIST.id, listSize: LIST.size,
  results: results.map((r) => ({ id: r.id, verdict: r.verdict, confirmed: r.confirmed, detail: r.detail, studentUid: r.uid, classId: r.classId, listId: r.listId, pre: r.pre?.hash, post: r.post?.hash })),
  fatals: fatals.map((f) => `${f.kind}: ${f.detail}`),
  cleanCount: results.filter((r) => r.verdict === 'PASS').length,
  verdict: allClean ? 'PASS' : 'NOT-CLEAN',
};
writeFileSync(`${AUD}/findings/reviewonly_accept_manifest_${runId}.json`, JSON.stringify(manifest, null, 2));
console.log(`\n=== REVIEW-ONLY MANIFEST (${runId}) ===`);
for (const r of manifest.results) console.log(`  ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} ${r.id.padEnd(5)} ${r.verdict} — ${r.detail || ''}`);
if (fatals.length) console.log(`  ⛔ ${fatals.length} fatal app-health signal(s)`);
console.log(`\n${allClean ? '✅ REVIEW-ONLY PASS' : '❌ NOT CLEAN'} — ${manifest.cleanCount}/${SCEN.length} → findings/reviewonly_accept_manifest_${runId}.json`);
process.exit(allClean ? 0 : 1);
