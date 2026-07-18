// r33 — PR-1 post-flip prod smoke: ONE single-pass complete->advance on the LIVE build.
// login -> re-entry modal -> Retry Review Test -> study loop (press "C"=I-know-this-word until Take Test)
// -> Take Test -> review test (readTestRows/carefulAnswersFrom/fillSubmitAndObserve) -> observe advance.
// csd read BEFORE + AFTER via Admin SDK. Sandbox only.  usage: node pr1_e2e_r33.mjs <email>
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const { db, uidByEmail } = FB;
const UI = await import('../../playwright/lsr_ui.mjs');   // base guard: LSR_ALLOW_PROD_SMOKE for prod
const { BASE, PASS, login, enterReviewSession, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, makeFindings } = UI;
const { chromium } = await import('playwright');
const FIND = 'C:/Users/dmchw/vocaboost/audit/playwright/findings';
const email = process.argv[2] || 'dup_repro_a@vocaboost.test';
const acct = email.split('@')[0];
const F = makeFindings ? makeFindings() : { add: (...a) => console.log('  F', ...a) };
const rec = { email, BASE, steps: [] };

const database = db();
const uid = await uidByEmail(email);
const readCsd = async () => { const s = await database.collection('users').doc(uid).collection('class_progress').get(); return s.docs.map(d => ({ docId: d.id, csd: d.data().currentStudyDay, twi: d.data().totalWordsIntroduced })); };
rec.uid = uid;
rec.csdBefore = await readCsd();
console.log('csdBEFORE ' + JSON.stringify(rec.csdBefore));

const shotp = async (p, n) => { const f = `${FIND}/pr1_r33_${acct}_${n}.png`; await p.screenshot({ path: f, fullPage: true }).catch(() => {}); return f; };
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  rec.loggedIn = await login(p, email, F); await p.waitForTimeout(1500);
  // 1) trigger re-entry
  const sb = p.getByRole('button', { name: /start new words|start session|continue|resume/i }).first();
  if (await sb.isVisible().catch(() => false)) { await sb.click().catch(() => {}); }
  await p.getByRole('button', { name: /retry review test/i }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  rec.steps.push({ step: '1-reentry', shot: await shotp(p, '1reentry'), url: p.url() });
  // 2) Retry Review Test -> review study
  const retry = p.getByRole('button', { name: /retry review test/i }).first();
  rec.retryVisible = await retry.isVisible().catch(() => false);
  if (rec.retryVisible) { await retry.click().catch(() => {}); await p.waitForTimeout(4000); }
  rec.steps.push({ step: '2-study', shot: await shotp(p, '2study'), url: p.url() });
  // 3) STUDY LOOP: press "C" (I know this word) until Take Test appears (cap 80)
  const takeTest = () => p.getByRole('button', { name: /take test/i }).first();
  let iter = 0;
  while (iter < 80 && !(await takeTest().isVisible().catch(() => false))) {
    const knowBtn = p.getByRole('button', { name: /I know this word/i }).first();
    if (await knowBtn.isVisible().catch(() => false)) { await knowBtn.click().catch(() => {}); }
    else { await p.keyboard.press('c').catch(() => {}); }
    await p.waitForTimeout(350); iter++;
  }
  rec.studyCards = iter;
  rec.takeTestVisible = await takeTest().isVisible().catch(() => false);
  rec.steps.push({ step: '3-studydone', shot: await shotp(p, '3studydone'), takeTestVisible: rec.takeTestVisible, cardsAdvanced: iter });
  // 4) Take Test -> review test
  if (rec.takeTestVisible) { await takeTest().click().catch(() => {}); await p.waitForTimeout(3000); }
  await enterReviewSession(p, F, `${acct}-review`).catch(e => rec.enterErr = String(e).slice(0, 100));
  let rows = []; try { rows = await readTestRows(p); } catch (e) { rec.readErr = String(e).slice(0, 100); }
  rec.reviewTestRows = rows.length;
  rec.steps.push({ step: '4-test', shot: await shotp(p, '4test'), rows: rows.length });
  // 5) complete the review test (point is completion, not score)
  if (rows.length > 0) {
    try { const answers = carefulAnswersFrom(rows, null); const obs = await fillSubmitAndObserve(p, answers, F, `${acct}-rev`); rec.submitOutcome = obs?.outcome || 'submitted'; }
    catch (e) { rec.submitErr = String(e).slice(0, 140); }
  }
  await p.waitForTimeout(4000);
  const bodyTxt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  rec.postCompleteSignals = { greatJob: /great job|day .* complete|completed day/i.test(bodyTxt), newWords: /new words|start new words|learn \d+ new/i.test(bodyTxt), backToDash: /back to dashboard|dashboard/i.test(bodyTxt), reStranded: /resume day|no test content|0 of 0/i.test(bodyTxt) };
  rec.steps.push({ step: '5-advance', shot: await shotp(p, '5advance'), url: p.url(), signals: rec.postCompleteSignals });
  await b.close();
} catch (e) { rec.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
// csd AFTER — wait for async completion write to commit, re-read a few times
for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 4000)); rec.csdAfter = await readCsd(); if (rec.csdAfter[0] && rec.csdBefore[0] && rec.csdAfter[0].csd !== rec.csdBefore[0].csd) break; }
console.log('csdAFTER ' + JSON.stringify(rec.csdAfter));
const before = rec.csdBefore[0]?.csd, after = rec.csdAfter?.[0]?.csd;
rec.csdAdvanced = (typeof before === 'number' && typeof after === 'number' && after > before);
rec.VERDICT = rec.csdAdvanced ? 'PASS (csd advanced ' + before + '->' + after + ')' : ('INCONCLUSIVE/FAIL (csd ' + before + '->' + after + ')');
console.log(JSON.stringify(rec, null, 2));
console.log('[pr1_e2e_r33] ' + rec.VERDICT);
