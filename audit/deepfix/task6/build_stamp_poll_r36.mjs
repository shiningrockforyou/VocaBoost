// Poll prod build-stamp until it == the PR-3 flip commit + dirty:false, and confirm the app loads clean.
const { chromium } = await import('playwright');
const TARGET = process.argv[2] || 'd2bb2bc';
const BASE = 'https://vocaboostone.netlify.app';
let result = null, consoleErrors = [];
for (let i = 0; i < 14; i++) {
  const b = await chromium.launch({ headless: true });
  const errs = [];
  try {
    const p = await b.newContext().then(c => c.newPage());
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 160)));
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(3000);
    const s = await p.evaluate(() => window.__VOCABOOST_BUILD__ || null).catch(() => null);
    await b.close();
    console.log(`iter ${i}: shortSha=${s?.shortSha} dirty=${s?.dirty} consoleErrs=${errs.length}`);
    if (s?.shortSha === TARGET) { result = s; consoleErrors = errs; break; }
    result = s;
  } catch (e) { await b.close().catch(() => {}); console.log(`iter ${i} err ${String(e).slice(0, 90)}`); }
  await new Promise(r => setTimeout(r, 28000));
}
// benign console-noise allowlist (analytics/favicon/firestore long-poll aborts)
const ALLOW = [/favicon/i, /analytics|gtag|gtm/i, /ResizeObserver/i, /web-vitals/i, /firestore\.googleapis\.com.*(Listen|Write)\/channel.*(ERR_ABORTED|aborted)/i, /net::ERR_ABORTED/i];
const realErrors = consoleErrors.filter(e => !ALLOW.some(re => re.test(e)));
const stampOk = result?.shortSha === TARGET && result?.dirty === false;
const out = { target: TARGET, buildStamp: result, stampOk, loadedClean: realErrors.length === 0, consoleErrors, realErrors };
const { writeFileSync } = await import('node:fs');
writeFileSync(`C:/Users/dmchw/vocaboost/audit/playwright/findings/deepfix_buildstamp_${TARGET}.json`, JSON.stringify(out, null, 2));
console.log('\n[pr3-buildstamp] shortSha=' + result?.shortSha + ' dirty=' + result?.dirty + ' STAMP_OK=' + stampOk + ' LOADED_CLEAN=' + (realErrors.length === 0) + (realErrors.length ? ' realErrors=' + JSON.stringify(realErrors.slice(0, 4)) : ''));
process.exit(stampOk ? 0 : 1);
