// repro_midtest.mjs — refresh WHILE IN the review test (the exact reported trigger). Uses the Session
// menu → "Skip to Test" to reach the MCQ, then reloads mid-test to exercise localStorage test-recovery.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password;
const BASE = 'https://vocaboostone.netlify.app';
const DIR = '/app/audit/playwright/repro_screens';
mkdirSync(DIR, { recursive: true });
const CLASS = 'DUP_bt_JFCtimk25DPR333XzJHU';
const A = { tag: 'j', label: '한예진 throttled', email: 'dup_bt_j@vocaboost.test', listId: 'dVliNv0p9jqZYp9rfLpN' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [], clog = [];
page.on('console', m => { clog.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => { errors.push('PAGEERROR: ' + e.message); clog.push('[PAGEERROR] ' + e.message); });
const shot = n => page.screenshot({ path: `${DIR}/mt_${n}.png`, fullPage: true }).catch(() => {});
const info = async () => (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
console.log(`===== MID-TEST REFRESH: ${A.label} =====`);
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
await page.fill('input[type="email"]', A.email).catch(() => {});
await page.fill('input[type="password"]', PASS).catch(() => {});
await page.click('button[type="submit"], button:has-text("Log")').catch(() => {});
await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
await sleep(3500);
await page.goto(`${BASE}/session/${CLASS}/${A.listId}`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
console.log('  session landed:', (await info()).slice(0, 90));
// open Session menu (⋮) and click "Skip to Test"
await page.click('button[aria-label*="menu" i], button[aria-label*="Session" i], header button:has(svg)').catch(() => {});
await sleep(800);
await page.click('text=/skip to test/i').catch(e => console.log('  skip-to-test not found:', e.message.slice(0, 60)));
await sleep(800);
await page.click('button:has-text("Skip"), button:has-text("Confirm"), button:has-text("Yes")').catch(() => {});
await sleep(4000); await shot('1_in_test');
const t1 = await info(); console.log('  IN TEST?:', /submit test|answered|choose|select the|correct definition/i.test(t1) ? 'YES (MCQ test shown)' : 'NO', '|', t1.slice(0, 90));
// THE MID-TEST REFRESH
console.log('  --- REFRESH (mid-test) ---');
await page.reload({ waitUntil: 'domcontentloaded' }).catch(e => console.log('  reload err', e.message)); await sleep(6000); await shot('2_after_midtest_refresh');
const t2 = await info();
console.log('  AFTER MID-TEST REFRESH: bodyLen=' + t2.length + ' |', t2.slice(0, 160));
const crashed = t2.length < 40 || /something went wrong|error boundary|오류/i.test(t2);
console.log('  ⇒ CRASH?', crashed ? 'YES' : 'no (renders)', '| console errors:', errors.length);
if (errors.length) errors.slice(0, 6).forEach(e => console.log('    ERR: ' + e.slice(0, 180)));
writeFileSync(`${DIR}/mt_console.log`, clog.join('\n'));
await browser.close();
process.exit(0);
