// prod_dup_11_check.mjs — verify the deployed #11 fix on AUTHENTIC duplicated stuck students (list-end review-only
// wall). Repoints each copy's focus to the dup class + duplicated list, logs into the LIVE app, drives their
// review-only day, and asserts csd ADVANCES (unstuck). Sandbox copies only (dup_*), real students never touched.
//   LSR_BASE_URL=https://vocaboostone.netlify.app LSR_ALLOW_PROD_SMOKE=vocaboostone.netlify.app node audit/playwright/prod_dup_11_check.mjs
const UI = await import('./lsr_ui.mjs'); // triggers the BASE guard (prod opt-in required)
const { makeFindings, launch, newAuditPage, login, goDashboard, selectList,
        enterReviewSession, readTestRows, carefulAnswersFrom, fillSubmitAndObserve,
        returnFromResultsAndClearCompletion, sleep } = UI;
const FB = await import('./lsr_deepfix_fb.mjs');
FB.db(); // trigger lazy admin.initializeApp() before the first admin.auth()/db use
const F = makeFindings('DUP11');

const LIST_TITLE = '26SM VZIP 3K (Ascent, 1600)';
const LIST_ID = 'dVliNv0p9jqZYp9rfLpN';
const DUP_CLASS = 'DUP_dup1_6F0PX2E3gXetiI0Yw275';
const DUPS = ['dup_dup1_a', 'dup_dup1_b', 'dup_dup1_c', 'dup_dup1_d'].map((x) => x + '@vocaboost.test');

const dayCompleteVisible = (page) => page.getByText(/Day \d+ Complete|Great Job!|Session Summary|You finished the list/i).first().isVisible({ timeout: 2500 }).catch(() => false);

console.log(`\n▶ DUP #11 CHECK — ${DUPS.length} authentic list-end copies vs the deployed fix @ ${process.env.LSR_BASE_URL}\n`);
const browser = await launch();
const results = [];
for (const email of DUPS) {
  const rec = { email, verdict: 'PENDING', detail: '' }; results.push(rec);
  try {
    const uid = await FB.uidByEmail(email);
    // Copies inherited the real student's focus (real class + a different list) — repoint to the dup class + the
    // duplicated list so login lands them at the list-end review-only wall (the #11 stuck state we're verifying).
    await FB.db().collection('users').doc(uid).set({ settings: { primaryFocusClassId: DUP_CLASS, primaryFocusListId: LIST_ID } }, { merge: true });
    const pre = await FB.readProgress(uid, DUP_CLASS, LIST_ID);
    const { page } = await newAuditPage(browser, F, email);
    if (!(await login(page, email, F))) { rec.verdict = 'INVALID'; rec.detail = 'login failed'; await page.context().close().catch(() => {}); console.log(`  ⚠️ ${email} — login failed`); continue; }
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(1800);
    await selectList(page, LIST_TITLE, F, email).catch(() => {});
    await goDashboard(page).catch(() => {});
    // drive the review-only day
    const ent = await enterReviewSession(page, F, email);
    let outcome;
    if (!ent.reached) {
      outcome = (await dayCompleteVisible(page)) ? 'results' : 'not-reached';
      if (outcome === 'results') { await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); await sleep(2500); await returnFromResultsAndClearCompletion(page, F, email).catch(() => {}); }
    } else {
      const rows = await readTestRows(page);
      const r = await fillSubmitAndObserve(page, carefulAnswersFrom(rows, null), F, email);
      outcome = r.outcome; await returnFromResultsAndClearCompletion(page, F, email).catch(() => {});
    }
    await sleep(2500);
    const post = await FB.readProgress(uid, DUP_CLASS, LIST_ID);
    if (post.csd > pre.csd) { rec.verdict = 'PASS'; rec.detail = `UNSTUCK — csd ${pre.csd}→${post.csd}, twi ${post.twi} (outcome=${outcome})`; }
    else { rec.verdict = 'FAIL'; rec.detail = `STILL STUCK — csd ${pre.csd}→${post.csd} (outcome=${outcome})`; }
    await page.context().close().catch(() => {});
  } catch (e) { rec.verdict = 'FAIL'; rec.detail = 'exception: ' + String(e).slice(0, 160); }
  console.log(`  ${rec.verdict === 'PASS' ? '✅' : rec.verdict === 'INVALID' ? '⚠️' : '❌'} ${email} — ${rec.detail}`);
}
await browser.close().catch(() => {});
const pass = results.filter((r) => r.verdict === 'PASS').length;
console.log(`\n=== DUP #11 CHECK === ${pass}/${DUPS.length} unstuck by the deployed fix\n`);
process.exit(0);
