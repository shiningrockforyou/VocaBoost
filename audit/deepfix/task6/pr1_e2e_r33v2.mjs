// r33 v2 — PR-1 post-flip prod smoke, FIXED for the "Ready for the Test?" modal.
// Flow (in-session, NO enterReviewSession — that re-enters from dashboard which is wrong here):
//   login -> trigger re-entry -> Retry Review Test -> study loop (press "C" until Take Test)
//   -> Take Test -> "Ready for the Test?" modal -> Start Test -> typed test renders
//   -> readTestRows -> carefulAnswersFrom -> fillSubmitAndObserve -> observe advance. csd before+after via Admin SDK.
//   usage: node pr1_e2e_r33v2.mjs <email>
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const { db, uidByEmail } = FB;
const UI = await import('../../playwright/lsr_ui.mjs');
const { BASE, login, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, makeFindings } = UI;
const { chromium } = await import('playwright');
const FIND = 'C:/Users/dmchw/vocaboost/audit/playwright/findings';
const email = process.argv[2] || 'dup_repro_a@vocaboost.test';
const acct = email.split('@')[0];
const F = makeFindings ? makeFindings() : { add: (...a) => console.log('  F', ...a) };
const rec = { email, BASE, v: 2, steps: [] };

const database = db();
const uid = await uidByEmail(email);
const readCsd = async () => { const s = await database.collection('users').doc(uid).collection('class_progress').get(); return s.docs.map(d => ({ docId: d.id, csd: d.data().currentStudyDay, twi: d.data().totalWordsIntroduced })); };
rec.uid = uid;
rec.csdBefore = await readCsd();
console.log('csdBEFORE ' + JSON.stringify(rec.csdBefore));

const shotp = async (p, n) => { const f = `${FIND}/pr1_r33v2_${acct}_${n}.png`; await p.screenshot({ path: f, fullPage: true }).catch(() => {}); return f; };
const testInputs = (p) => p.locator('input[placeholder*="definition" i]');
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then(c => c.newPage());
  rec.loggedIn = await login(p, email, F); await p.waitForTimeout(1500);
  // 1) trigger re-entry (dashboard CTA); tolerate resume-mid-session
  const sb = p.getByRole('button', { name: /start new words|start session|continue|resume/i }).first();
  if (await sb.isVisible().catch(() => false)) { await sb.click().catch(() => {}); await p.waitForTimeout(2500); }
  const retry = p.getByRole('button', { name: /retry review test/i }).first();
  rec.retryVisible = await retry.isVisible().catch(() => false);
  if (rec.retryVisible) { await retry.click().catch(() => {}); await p.waitForTimeout(4000); }
  rec.steps.push({ step: '1-entry', shot: await shotp(p, '1entry'), url: p.url(), retryVisible: rec.retryVisible });
  // 2) STUDY LOOP: press "I know this word" until Take Test / Start Test / test inputs appear (cap 80)
  const takeOrStart = () => p.getByRole('button', { name: /take test|start test/i }).first();
  let iter = 0;
  while (iter < 80) {
    if ((await testInputs(p).count()) > 0) break;
    if (await takeOrStart().isVisible().catch(() => false)) break;
    const knowBtn = p.getByRole('button', { name: /I know this word/i }).first();
    if (await knowBtn.isVisible().catch(() => false)) await knowBtn.click().catch(() => {});
    else await p.keyboard.press('c').catch(() => {});
    await p.waitForTimeout(300); iter++;
  }
  rec.studyCards = iter;
  rec.steps.push({ step: '2-studydone', shot: await shotp(p, '2studydone'), cardsAdvanced: iter, takeOrStartVisible: await takeOrStart().isVisible().catch(() => false) });
  // 3) REACH THE TEST: click through Take Test -> "Ready for the Test?" modal -> Start Test -> inputs.
  // CRITICAL: check "Start Test" (modal CTA) FIRST — both buttons coexist in the DOM, and a combined
  // regex + .first() always grabs the page's "Take Test" and never advances the modal (r33v2-a bug).
  let clicks = [];
  for (let k = 0; k < 8; k++) {
    if ((await testInputs(p).count()) > 0) break;
    const startBtn = p.getByRole('button', { name: /^\s*start test\s*$/i }).first();
    if (await startBtn.isVisible().catch(() => false)) { clicks.push('Start Test'); await startBtn.click().catch(() => {}); await p.waitForTimeout(3000); continue; }
    const takeBtn = p.getByRole('button', { name: /^\s*take test\s*$/i }).first();
    if (await takeBtn.isVisible().catch(() => false)) { clicks.push('Take Test'); await takeBtn.click().catch(() => {}); await p.waitForTimeout(2800); continue; }
    await p.waitForTimeout(1500);
  }
  rec.reachClicks = clicks;
  rec.steps.push({ step: '3-modal', shot: await shotp(p, '3modal'), clicks });
  // 4) read + complete the test
  let rows = []; try { rows = await readTestRows(p); } catch (e) { rec.readErr = String(e).slice(0, 120); }
  rec.reviewTestRows = rows.length;
  rec.sampleWords = rows.slice(0, 5).map(r => r.word);
  rec.steps.push({ step: '4-test', shot: await shotp(p, '4test'), rows: rows.length });
  if (rows.length > 0) {
    try { const answers = carefulAnswersFrom(rows, null); rec.answered = answers.filter(a => a).length; const obs = await fillSubmitAndObserve(p, answers, F, `${acct}-rev`); rec.submitOutcome = obs?.outcome || 'submitted'; }
    catch (e) { rec.submitErr = String(e).slice(0, 160); }
  }
  await p.waitForTimeout(4000);
  const bodyTxt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  rec.bodyExcerpt = bodyTxt.slice(0, 400);
  rec.postCompleteSignals = { results: /%|score|correct|passed|합격/i.test(bodyTxt), greatJob: /great job|day .* complete|completed day|nice work|well done/i.test(bodyTxt), newWords: /new words|start new words|learn \d+ new/i.test(bodyTxt), backToDash: /back to dashboard/i.test(bodyTxt), reStranded: /resume day|no test content|0 of 0/i.test(bodyTxt) };
  rec.steps.push({ step: '5-advance', shot: await shotp(p, '5advance'), url: p.url(), signals: rec.postCompleteSignals });
  await b.close();
} catch (e) { rec.error = String(e).slice(0, 240); await b.close().catch(() => {}); }
// csd AFTER — wait for async completion write, re-read up to 5x
for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 4000)); rec.csdAfter = await readCsd(); if (rec.csdAfter[0] && rec.csdBefore[0] && rec.csdAfter[0].csd !== rec.csdBefore[0].csd) break; }
console.log('csdAFTER ' + JSON.stringify(rec.csdAfter));
const before = rec.csdBefore[0]?.csd, after = rec.csdAfter?.[0]?.csd;
rec.csdAdvanced = (typeof before === 'number' && typeof after === 'number' && after > before);
rec.testCompleted = !!rec.submitOutcome && rec.submitOutcome !== 'no-submit';
rec.VERDICT = !rec.testCompleted ? ('INCONCLUSIVE (review test not completed; rows=' + rec.reviewTestRows + ' outcome=' + (rec.submitOutcome || 'none') + ')')
  : rec.csdAdvanced ? ('PASS (completed + csd advanced ' + before + '->' + after + ')')
  : ('FAIL (completed but csd stuck ' + before + '->' + after + ')');
console.log(JSON.stringify(rec, null, 2));
console.log('[pr1_e2e_r33v2] ' + rec.VERDICT);
