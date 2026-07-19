// R50 follow-up: after the throttle cleared (reviewMode=false), confirm the dashboard now offers an ACTIONABLE
// NEW-WORDS Day-6 session (positive escape proof), not a stuck review-only loop. Read-only render check.
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, goDashboard, makeFindings, sleep } = UI;
const { chromium } = await import('playwright');
const EMAIL = 'lsr_a2_jisua1@vocaboost.test';
const F = makeFindings ? makeFindings('A1ESC') : { add: () => {} };
const out = {};
const b = await chromium.launch({ headless: true });
try {
  const p = await b.newContext().then((c) => c.newPage());
  out.loggedIn = await login(p, EMAIL, F); await sleep(1500);
  await goDashboard(p); await sleep(3500);
  const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  out.excerpt = body.slice(0, 320);
  out.offersNewWords = /start new words/i.test(body);
  out.offersReviewOnly = /start review|retry review/i.test(body) && !/start new words/i.test(body);
  out.day6 = /day\s*6\b/i.test(body);
  // check the primary CTA text
  for (const re of [/start new words/i, /start review/i, /continue/i, /start session/i]) {
    const btn = p.getByRole('button', { name: re }).first();
    if (await btn.isVisible().catch(() => false)) { out.primaryCTA = (await btn.innerText().catch(() => '')).trim(); break; }
  }
  out.escape_confirmed = out.offersNewWords === true;
  await b.close();
} catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
console.log(JSON.stringify(out, null, 2));
