// Quick diagnostic: is the new-word flow reachable for a fresh student on the P4 build (harness-gap vs real break)?
const UI = await import('../../playwright/lsr_ui.mjs');
const { login, makeFindings } = UI;
const { chromium } = await import('playwright');
const email = process.argv[2] || 'lsr_p4smk_1784364980541@vocaboost.test';
const F = makeFindings ? makeFindings('P4DIAG') : { add: () => {} };
const errs = [];
const b = await chromium.launch({ headless: true });
const out = { email };
try {
  const p = await b.newContext({ viewport: { width: 1440, height: 900 } }).then(c => c.newPage());
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  p.on('pageerror', e => errs.push('pageerr: ' + String(e).slice(0, 140)));
  out.loggedIn = await login(p, email, F);
  await p.waitForTimeout(3500);
  out.url = p.url();
  out.bodyText = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 700);
  // what session-start affordances exist?
  const btns = await p.getByRole('button').allInnerTexts().catch(() => []);
  out.buttons = btns.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 25);
  await p.screenshot({ path: 'C:/Users/dmchw/vocaboost/audit/playwright/findings/p4_diag_dashboard.png', fullPage: true }).catch(() => {});
  await b.close();
} catch (e) { out.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
const ALLOW = [/favicon/i, /analytics|gtag|gtm/i, /ResizeObserver/i, /web-vitals/i, /firestore\.googleapis\.com.*(Listen|Write)\/channel.*(ERR_ABORTED|aborted)/i, /net::ERR_ABORTED/i];
out.realConsoleErrors = errs.filter(e => !ALLOW.some(re => re.test(e)));
const { writeFileSync } = await import('node:fs');
writeFileSync('C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_p4_diag_r37.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
