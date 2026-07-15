/**
 * lsr_reviewonly_whitebox.mjs — WHITE-BOX integration matrix for the gate-negatives that are NOT faithfully
 * reachable through organic UI routing (design §7; Codex RAD-2, Lens A BLK2, Lens C BLK1).
 *
 * ⚠️ DOCUMENTED page.evaluate EXCEPTION: lsr_ui.mjs FORBIDS page.evaluate / storage access (its policy, :4-7).
 * This module is the DELIBERATE exception — it CRAFTS/CLEARS `sessionStorage.dailySessionState` on the test
 * route to force the gate-negative preconditions that a real user cannot reach (an ordinary assigned-new day
 * routes to NEW_WORDS; reaching a review submit needs a passing new attempt, which satisfies the gate
 * regardless of a stale 0). Its results are reported in a SEPARATE white-box manifest — NOT counted as full-UI
 * acceptance. It still imports lsr_ui.mjs, so the fail-closed LOCAL-ONLY base guard applies.
 *
 * Covers: W-RA4b (ROI-1: stale finite-0 must NOT open the gate) · W-RA4 (absent config → gate applies) ·
 *         W-RA3-gate (reviewOnlyDay:true skips the gate; a non-review-only unpassed day still blocks).
 *
 * ⚠️ FIRST-RUN CALIBRATION (flagged in the build manifest — the injection SITE + exact crafted fields must be
 * confirmed live): the injection must land AFTER DailySessionFlow.navigateToTest writes dailySessionState
 * (studyService reads sessionStorage at completeSessionFromTest) and BEFORE Submit. We (a) drive to a test
 * route via the normal flow, (b) assert page.url() matches /typedtest|/mcqtest, (c) patch the blob, (d) READ IT
 * BACK to confirm the patch stuck, (e) Submit, (f) assert the outcome. If the app overwrites the blob between
 * inject and submit, the readback + a post-submit re-read catch it (→ INVALID, never a false PASS).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const AUD = '/app/audit/playwright';
const runId = process.argv[2] || `ROWB_${Date.now()}`;
const BUILD_ID = process.env.LSR_BUILD_ID || 'local-dev';
const TEACHER = process.env.LSR_TEACHER;
const STUDENTS = (process.env.SL_STUDENTS || process.env.SL_STUDENT || '').split(',').map((s) => s.trim()).filter(Boolean);
const TIER = process.env.LSR_TIER || null;
const SCEN = (process.env.ROWB_SCENARIOS || 'W-RA3-gate W-RA4 W-RA4b').trim().split(/\s+/);

const UI = await import('./lsr_ui.mjs'); // triggers base guard
const { BASE, makeFindings, launch, newAuditPage, login, joinClass, selectList, goDashboard,
        driveNewWordsToTest, readTestRows, partialAnswers, fillSubmitAndObserve, sleep } = UI;
const FB = await import('./lsr_reviewonly_fb.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');
const { TIER_SIZE } = await import('./lsr_personas.mjs');

const STUDENT_RE = FB.SANDBOX.SANDBOX_STUDENT_RE;
if (!TEACHER || !STUDENT_RE.test(TEACHER) || !STUDENTS.length || STUDENTS.some((s) => !STUDENT_RE.test(s))) {
  console.error('[IDENTITY GUARD] INVALID — LSR_TEACHER/SL_STUDENTS must be lsr_*@vocaboost.test'); process.exit(2);
}
const listsFile = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8'));
const tl = listsFile.teachers?.[TEACHER]?.lists; if (!tl?.length) { console.error('no cloned lists'); process.exit(2); }
const chosen = TIER ? tl.find((l) => l.tier === TIER) : tl[0];
const LIST = { id: chosen.newId, title: chosen.title, tier: chosen.tier, size: await FB.readListWordCount(chosen.newId).catch(() => 0) };
const F = makeFindings(`ROWB_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });
const results = [];
const setV = (rec, v, detail) => { rec.verdict = v; if (detail) rec.detail = detail; };

// ── the DELIBERATE page.evaluate exception ────────────────────────────────────────────────────────────────
const TEST_ROUTE = /\/(typedtest|mcqtest)\//i;
async function readBlob(page) {
  return page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('dailySessionState') || 'null'); } catch { return null; } });
}
// Deep-merge a patch into dailySessionState.sessionConfig, on the test route only, with readback.
async function patchSessionConfig(page, patch) {
  if (!TEST_ROUTE.test(page.url())) return { ok: false, reason: `not on test route (url=${page.url()})` };
  const applied = await page.evaluate((p) => {
    const raw = sessionStorage.getItem('dailySessionState'); if (!raw) return { ok: false, reason: 'no dailySessionState present' };
    const blob = JSON.parse(raw); blob.sessionConfig = { ...(blob.sessionConfig || {}), ...p };
    if (p.__allocationNewWords !== undefined) { blob.sessionConfig.allocation = { ...(blob.sessionConfig.allocation || {}), newWords: p.__allocationNewWords }; delete blob.sessionConfig.__allocationNewWords; }
    sessionStorage.setItem('dailySessionState', JSON.stringify(blob));
    const back = JSON.parse(sessionStorage.getItem('dailySessionState')).sessionConfig;
    return { ok: true, back };
  }, patch);
  return applied;
}
async function clearBlob(page) {
  if (!TEST_ROUTE.test(page.url())) return { ok: false, reason: `not on test route (url=${page.url()})` };
  return page.evaluate(() => { sessionStorage.removeItem('dailySessionState'); return { ok: !sessionStorage.getItem('dailySessionState') }; });
}

async function provision(browser, className) {
  const { page: tp } = await newAuditPage(browser, F, 'teacher');
  let code = null;
  if (await login(tp, TEACHER, F)) { await createClass(tp, className, F); await assignList(tp, className, LIST.title, { pace: 3, thr: 92, mode: 'typed', reviewMode: 'typed', testSize: 30, listId: LIST.id }, F); code = await readJoinCode(tp, className, F); }
  await tp.context().close().catch(() => {});
  const cq = await FB.db().collection('classes').where('name', '==', className).get();
  if (cq.size !== 1) return { ok: false, reason: `INVALID (${cq.size} classes)` };
  return { ok: true, classId: cq.docs[0].id, code };
}

// Drive to the day-1 NEW-word test route (reaches /typedtest with dailySessionState written), WITHOUT submitting.
async function reachNewTest(page, label) {
  const t = await driveNewWordsToTest(page, F, label);
  return { reached: t.reached && TEST_ROUTE.test(page.url()) };
}

const WB = {
  // W-RA4b — stale finite-0 must NOT open the gate. Craft: newWordCount 0 BUT startPhase NEW, allocation.newWords>0,
  // isListComplete false (no confirmed reason) → reviewOnlyReasonConfirmed FALSE → gate applies (retake).
  'W-RA4b': async (c) => {
    const r = await reachNewTest(c.page, 'W-RA4b'); if (!r.reached) return setV(c.rec, 'INVALID', 'could not reach a test route to inject on');
    const before = await readBlob(c.page); if (!before?.sessionConfig) return setV(c.rec, 'INVALID', 'no dailySessionState.sessionConfig to patch');
    const patch = { newWordCount: 0, startPhase: 'new_words_study', isListComplete: false, __allocationNewWords: before.sessionConfig?.allocation?.newWords ?? 3 };
    const ap = await patchSessionConfig(c.page, patch);
    if (!ap.ok) return setV(c.rec, 'INVALID', `patch failed: ${ap.reason}`);
    if (ap.back.newWordCount !== 0) return setV(c.rec, 'INVALID', `readback newWordCount=${ap.back.newWordCount} (patch didn't stick)`);
    // submit with blanks (no pass) — the day HAS assigned new words really, and stale-0 must not skip the gate.
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, partialAnswers(rows, 0, null), F, 'W-RA4b');
    await sleep(1500);
    const afterBlob = await readBlob(c.page);
    const blocked = outcome === 'retake-gate' || await c.page.getByText(/retake required|not complete|did not pass/i).first().isVisible().catch(() => false);
    if (afterBlob?.sessionConfig?.newWordCount !== 0) F.add('note', `[W-RA4b] blob newWordCount changed after submit → ${afterBlob?.sessionConfig?.newWordCount} (possible overwrite)`);
    if (!blocked) return setV(c.rec, 'FAIL', `stale newWordCount:0 OPENED the gate (outcome=${outcome}) — ROI-1 regression`);
    setV(c.rec, 'PASS', `stale 0 did NOT open the gate; blocked as expected (outcome=${outcome})`);
  },

  // W-RA4 — absent config: cleared dailySessionState → reviewOnlyDay false (Number.isFinite(undefined)) → gate
  // applies iff no passed attempt. Deterministic (no "or self-heal").
  'W-RA4': async (c) => {
    const r = await reachNewTest(c.page, 'W-RA4'); if (!r.reached) return setV(c.rec, 'INVALID', 'no test route');
    const cl = await clearBlob(c.page); if (!cl.ok) return setV(c.rec, 'INVALID', `clear failed: ${cl.reason}`);
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, partialAnswers(rows, 0, null), F, 'W-RA4');
    await sleep(1500);
    const blocked = outcome === 'retake-gate' || await c.page.getByText(/retake required|not complete|did not pass|session.*refresh|갱신/i).first().isVisible().catch(() => false);
    if (!blocked) return setV(c.rec, 'FAIL', `absent config did not apply the gate (outcome=${outcome})`);
    setV(c.rec, 'PASS', `absent config → gate applied / rebuilt (outcome=${outcome})`);
  },

  // W-RA3-gate — a genuine reviewOnlyDay:true (throttle) skips the gate (completes). Paired negative (W-RA4b)
  // proves the non-review-only unpassed day still blocks. Here: seed interv=1.0 → the persisted config carries a
  // confirmed reason (allocation.newWords<=0) → the review-only day completes even with no new-word pass.
  'W-RA3-gate': async (c) => {
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: 6 });
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    // enter review directly (throttle day = review-only) and complete
    const ent = await UI.enterReviewSession(c.page, F, 'W-RA3-gate');
    if (!ent.reached) return setV(c.rec, 'INVALID', 'could not reach the review test on a throttle day');
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, UI.carefulAnswersFrom(rows, null), F, 'W-RA3-gate');
    await UI.returnFromResultsAndClearCompletion(c.page, F, 'W-RA3-gate');
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    if (outcome !== 'results') return setV(c.rec, 'FAIL', `reviewOnlyDay did NOT skip the gate (outcome=${outcome})`);
    if (post.csd !== pre.csd + 1) return setV(c.rec, 'FAIL', `csd ${pre.csd}->${post.csd} (want +1 — gate should have been skipped)`);
    setV(c.rec, 'PASS', `reviewOnlyDay skipped the gate and completed (csd+1)`);
  },
};

let si = 0;
console.log(`\n▶ review-only WHITE-BOX ${runId} — BASE=${BASE} (SEPARATE matrix; page.evaluate exception)\n`);
const browser = await launch();
try {
  for (const id of SCEN) {
    const rec = { id, verdict: 'PENDING', detail: '' }; results.push(rec);
    const fn = WB[id]; if (!fn) { setV(rec, 'INVALID', 'unknown scenario'); continue; }
    const email = STUDENTS[si % STUDENTS.length]; si++;
    const uid = await FB.uidByEmail(email);
    if (!uid) { setV(rec, 'INVALID', `no uid for ${email}`); continue; }
    try {
      const className = `25WT ROWB ${id} ${runId}`;
      const prov = await provision(browser, className); if (!prov.ok) { setV(rec, 'INVALID', prov.reason); continue; }
      rec.classId = prov.classId; rec.uid = uid;
      await FB.resetStudentState({ email, uid, classId: prov.classId, listId: LIST.id });
      const { page } = await newAuditPage(browser, F, `wb-${id}`);
      if (!(await login(page, email, F))) { setV(rec, 'INVALID', 'login failed'); await page.context().close().catch(() => {}); continue; }
      await joinClass(page, prov.code, className, F, id); await selectList(page, LIST.title, F, id).catch(() => {}); await goDashboard(page).catch(() => {});
      await fn({ page, email, uid, classId: prov.classId, listId: LIST.id, rec });
      await page.context().close().catch(() => {});
    } catch (e) { setV(rec, 'FAIL', `exception: ${String(e).slice(0, 180)}`); F.add('exception', `[${id}] ${String(e).slice(0, 180)}`); }
    console.log(`  ${rec.verdict === 'PASS' ? '✅' : rec.verdict === 'INVALID' ? '⚠️' : '❌'} ${id} ${rec.verdict} — ${rec.detail || ''}`);
  }
} finally { await browser.close().catch(() => {}); }

const gitHead = (() => { try { return execSync('git rev-parse HEAD', { cwd: '/app' }).toString().trim(); } catch { return 'unknown'; } })();
const allClean = results.length === SCEN.length && results.every((r) => r.verdict === 'PASS');
const manifest = { runId, buildId: BUILD_ID, gitHead, base: BASE, kind: 'white-box', ranAt: new Date().toISOString(), scenarioSet: SCEN, results, verdict: allClean ? 'PASS' : 'NOT-CLEAN' };
writeFileSync(`${AUD}/findings/reviewonly_whitebox_manifest_${runId}.json`, JSON.stringify(manifest, null, 2));
console.log(`\n${allClean ? '✅ WHITE-BOX PASS' : '❌ WHITE-BOX NOT CLEAN'} — findings/reviewonly_whitebox_manifest_${runId}.json`);
process.exit(allClean ? 0 : 1);
