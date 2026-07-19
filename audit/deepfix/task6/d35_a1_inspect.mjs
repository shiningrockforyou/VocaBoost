// Inspect: login the A1 seed student, reach the Day-6 review MCQ, dump the current question structure
// (the word element + the 4 option cards' text) so the correct-answer matcher can be built.
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep } = UI;
const { chromium } = await import('playwright');
const email = 'lsr_a2_jisua1@vocaboost.test';
const F = makeFindings ? makeFindings('A1INS') : { add: () => {} };
const b = await chromium.launch({ headless: true });
const out = {};
try {
  const p = await b.newContext().then(c => c.newPage());
  out.loggedIn = await login(p, email, F); await sleep(1500);
  await goDashboard(p); await sleep(3000);
  out.dashExcerpt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
  // reach the test: Start/Continue/Retry -> study -> Take Test -> Start Test -> MCQ
  const inTest = async () => p.url().includes('/mcqtest/') || (await p.locator('button[class*="min-h-"]').count()) > 0;
  const clickIf = async (re) => { const btn = p.getByRole('button', { name: re }).first(); if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(2500); return true; } return false; };
  for (let k = 0; k < 12 && !(await inTest()); k++) {
    if (await clickIf(/^\s*start test\s*$/i)) continue;
    if (await clickIf(/take test/i)) continue;
    if (await clickIf(/start new words|start session|continue|retry review|start review|resume/i)) continue;
    // study loop: mark known to advance
    const know = p.getByRole('button', { name: /I know this word/i }).first();
    if (await know.isVisible().catch(() => false)) { await know.click().catch(() => {}); await sleep(300); continue; }
    await sleep(1200);
  }
  out.url = p.url(); out.inTest = await inTest();
  // dump the current question: submit-button counter + option cards + candidate word text
  const sub = await p.getByRole('button', { name: /Submit Test/i }).first().innerText().catch(() => '');
  out.submitBtn = sub.replace(/\s+/g, ' ');
  const cards = p.locator('button[class*="min-h-"]');
  const n = await cards.count(); out.optionCount = n;
  out.options = [];
  for (let i = 0; i < Math.min(n, 6); i++) out.options.push((await cards.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120));
  // the WORD is shown above the options — dump the visible text of likely word containers
  out.fullBodyTop = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 450);
  await p.screenshot({ path: 'C:/Users/dmchw/vocaboost/audit/playwright/findings/a1_mcq_inspect.png', fullPage: true }).catch(() => {});
  await b.close();
} catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
console.log(JSON.stringify(out, null, 2));
