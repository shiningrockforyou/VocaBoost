// r33 v3 — PR-1 post-flip prod smoke, DEFINITIVE. Handles the real review test = MCQ (/mcqtest/), not typed.
// Full in-session flow, robust to fresh-login OR resume-mid-flow:
//   login -> trigger re-entry -> Retry Review Test -> study loop (press "C" until Take/Start Test)
//   -> Take Test -> "Ready for the Test?" modal -> Start Test -> MCQ test renders
//   -> answer all (click first choice card per Q, watch "Submit Test N/30" counter) -> Submit -> confirm
//   -> observe advance. csd/twi before+after via Admin SDK.   usage: node pr1_e2e_r33v3.mjs <email>
const FB = await import('../../playwright/lsr_reviewonly_fb.mjs');
const { db, uidByEmail } = FB;
const UI = await import('../../playwright/lsr_ui.mjs');
const { BASE, login, readTestRows, carefulAnswersFrom, fillSubmitAndObserve, makeFindings } = UI;
const { chromium } = await import('playwright');
const FIND = 'C:/Users/dmchw/vocaboost/audit/playwright/findings';
const email = process.argv[2] || 'dup_repro_a@vocaboost.test';
const acct = email.split('@')[0];
const F = makeFindings ? makeFindings() : { add: (...a) => console.log('  F', ...a) };
const rec = { email, BASE, v: 3, steps: [] };

const database = db();
const uid = await uidByEmail(email);
const readCsd = async () => { const s = await database.collection('users').doc(uid).collection('class_progress').get(); return s.docs.map(d => ({ docId: d.id, csd: d.data().currentStudyDay, twi: d.data().totalWordsIntroduced })); };
rec.uid = uid;
rec.csdBefore = await readCsd();
console.log('csdBEFORE ' + JSON.stringify(rec.csdBefore));

const shotp = async (p, n) => { const f = `${FIND}/pr1_r33v3_${acct}_${n}.png`; await p.screenshot({ path: f, fullPage: true }).catch(() => {}); return f; };
const typedInputs = (p) => p.locator('input[placeholder*="definition" i]');
const mcqCards = (p) => p.locator('button[class*="min-h-"]');
const inTest = async (p) => p.url().includes('/mcqtest/') || p.url().includes('/typedtest/') || (await mcqCards(p).count()) > 0 || (await typedInputs(p).count()) > 0;

const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage());
  rec.loggedIn = await login(p, email, F); await p.waitForTimeout(1500);
  // 1) trigger re-entry (dashboard CTA); tolerate resume-mid-session/mid-test
  const sb = p.getByRole('button', { name: /start new words|start session|continue|resume/i }).first();
  if (!(await inTest(p)) && await sb.isVisible().catch(() => false)) { await sb.click().catch(() => {}); await p.waitForTimeout(2500); }
  const retry = p.getByRole('button', { name: /retry review test/i }).first();
  rec.retryVisible = await retry.isVisible().catch(() => false);
  if (rec.retryVisible) { await retry.click().catch(() => {}); await p.waitForTimeout(4000); }
  rec.steps.push({ step: '1-entry', shot: await shotp(p, '1entry'), url: p.url(), retryVisible: rec.retryVisible, inTest: await inTest(p) });
  // 2) STUDY LOOP: press "I know this word" until Take/Start Test appears OR we're in the test (cap 80)
  const takeOrStart = () => p.getByRole('button', { name: /take test|start test/i }).first();
  let iter = 0;
  while (iter < 80 && !(await inTest(p))) {
    if (await takeOrStart().isVisible().catch(() => false)) break;
    const knowBtn = p.getByRole('button', { name: /I know this word/i }).first();
    if (await knowBtn.isVisible().catch(() => false)) await knowBtn.click().catch(() => {});
    else await p.keyboard.press('c').catch(() => {});
    await p.waitForTimeout(300); iter++;
  }
  rec.studyCards = iter;
  rec.steps.push({ step: '2-studydone', shot: await shotp(p, '2studydone'), cardsAdvanced: iter, inTest: await inTest(p) });
  // 3) REACH TEST: Start Test (modal CTA) FIRST, else Take Test (page) — both coexist in DOM
  let clicks = [];
  for (let k = 0; k < 8 && !(await inTest(p)); k++) {
    const startBtn = p.getByRole('button', { name: /^\s*start test\s*$/i }).first();
    if (await startBtn.isVisible().catch(() => false)) { clicks.push('Start Test'); await startBtn.click().catch(() => {}); await p.waitForTimeout(3000); continue; }
    const takeBtn = p.getByRole('button', { name: /^\s*take test\s*$/i }).first();
    if (await takeBtn.isVisible().catch(() => false)) { clicks.push('Take Test'); await takeBtn.click().catch(() => {}); await p.waitForTimeout(2800); continue; }
    await p.waitForTimeout(1500);
  }
  rec.reachClicks = clicks;
  rec.testKind = p.url().includes('/mcqtest/') ? 'mcq' : p.url().includes('/typedtest/') ? 'typed' : ((await typedInputs(p).count()) > 0 ? 'typed' : (await mcqCards(p).count()) > 0 ? 'mcq' : 'unknown');
  rec.steps.push({ step: '3-test', shot: await shotp(p, '3test'), clicks, url: p.url(), testKind: rec.testKind });
  // 4) COMPLETE THE TEST (point is completion, not score)
  if (rec.testKind === 'typed') {
    let rows = []; try { rows = await readTestRows(p); } catch (e) { rec.readErr = String(e).slice(0, 120); }
    rec.reviewTestRows = rows.length;
    if (rows.length > 0) { const answers = carefulAnswersFrom(rows, null); const obs = await fillSubmitAndObserve(p, answers, F, `${acct}-rev`); rec.submitOutcome = obs?.outcome || 'submitted'; }
  } else {
    // MCQ: click first choice card each Q; watch "Submit Test N/M"; submit when done or stalled
    let lastAns = -1, stall = 0, answeredMax = 0, tot = 30;
    for (let i = 0; i < 100; i++) {
      const sub = p.getByRole('button', { name: /Submit Test/i }).first();
      const st = await sub.innerText().catch(() => '');
      const m = st.match(/(\d+)\s*\/\s*(\d+)/); const ans = m ? +m[1] : 0; if (m) tot = +m[2];
      answeredMax = Math.max(answeredMax, ans);
      if (ans === lastAns) stall++; else { stall = 0; lastAns = ans; }
      if (ans >= tot || stall > 6) {
        if (await sub.isVisible().catch(() => false)) {
          await sub.click().catch(() => {}); await p.waitForTimeout(1500);
          const c = p.getByRole('button', { name: /^(Submit Test|Submit|Yes|Confirm|Submit Anyway)$/i }).last();
          if (await c.isVisible().catch(() => false)) await c.click().catch(() => {});
          rec.submitOutcome = 'mcq-submitted'; await p.waitForTimeout(7000); break;
        }
      }
      const opt = mcqCards(p).first();
      if (await opt.isVisible().catch(() => false)) { await opt.click().catch(() => {}); await p.waitForTimeout(500); }
      else await p.waitForTimeout(500);
      const bt = (await p.locator('body').innerText().catch(() => ''));
      if (/Day \d+ Complete|Session Summary|Your score|Great Job|정답|score/i.test(bt)) { rec.submitOutcome = rec.submitOutcome || 'results-seen'; break; }
    }
    rec.mcqAnswered = answeredMax; rec.mcqTotal = tot;
  }
  rec.steps.push({ step: '4-submitted', shot: await shotp(p, '4submitted'), outcome: rec.submitOutcome, mcqAnswered: rec.mcqAnswered });
  await p.waitForTimeout(4000);
  const bodyTxt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  rec.bodyExcerpt = bodyTxt.slice(0, 500);
  rec.postCompleteSignals = { results: /%|score|correct|passed|합격|complete/i.test(bodyTxt), greatJob: /great job|day .* complete|completed day|nice work|well done|session summary/i.test(bodyTxt), newWords: /new words|start new words|learn \d+ new/i.test(bodyTxt), backToDash: /back to dashboard/i.test(bodyTxt), reStranded: /resume day|no test content|0 of 0/i.test(bodyTxt) };
  rec.steps.push({ step: '5-advance', shot: await shotp(p, '5advance'), url: p.url(), signals: rec.postCompleteSignals });
  await b.close();
} catch (e) { rec.error = String(e).slice(0, 260); await b.close().catch(() => {}); }
// csd AFTER — wait for async completion write, re-read up to 6x
for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 4000)); rec.csdAfter = await readCsd(); if (rec.csdAfter[0] && rec.csdBefore[0] && rec.csdAfter[0].csd !== rec.csdBefore[0].csd) break; }
console.log('csdAFTER ' + JSON.stringify(rec.csdAfter));
const before = rec.csdBefore[0]?.csd, after = rec.csdAfter?.[0]?.csd;
rec.csdAdvanced = (typeof before === 'number' && typeof after === 'number' && after > before);
rec.testCompleted = !!rec.submitOutcome && !['no-submit'].includes(rec.submitOutcome);
rec.VERDICT = !rec.testCompleted ? ('INCONCLUSIVE (review test not completed; kind=' + rec.testKind + ' answered=' + (rec.mcqAnswered ?? rec.reviewTestRows) + ' outcome=' + (rec.submitOutcome || 'none') + ')')
  : rec.csdAdvanced ? ('PASS (completed + csd advanced ' + before + '->' + after + ')')
  : ('FAIL (completed but csd stuck ' + before + '->' + after + ')');
console.log(JSON.stringify(rec, null, 2));
console.log('[pr1_e2e_r33v3] ' + rec.VERDICT);
