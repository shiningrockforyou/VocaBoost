// repro_reentry.mjs — Playwright repro of the "click start → loading → auto-completion" bug on the
// pre-fix sandbox dups. Drives prod exactly as a student: login → dashboard → click Start → observe.
// Captures screenshots + FULL console at every step. Sandbox dup accounts only.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password;
const BASE = 'https://vocaboostone.netlify.app';
const DIR = '/app/audit/playwright/repro_screens';
mkdirSync(DIR, { recursive: true });
const ACCTS = [
  { tag: 'a', label: '박주하 runaway', email: 'dup_repro_a@vocaboost.test', classId: 'DUP_repro_Nys1FfB9Pkl1iyO5FYhx', listId: 'dVliNv0p9jqZYp9rfLpN' },
  { tag: 'b', label: 'wisdomram11', email: 'dup_repro_b@vocaboost.test', classId: 'DUP_repro_k0j59bXvvtedgqi98apt', listId: 'RmNNkuLPectBlBPiLbAJ' },
  { tag: 'c', label: '이서현 low', email: 'dup_repro_c@vocaboost.test', classId: 'DUP_repro_sO7jN85mL5ZsaBY1BbGm', listId: 'RmNNkuLPectBlBPiLbAJ' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const summary = [];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
for (const a of ACCTS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const console_log = [];
  page.on('console', m => console_log.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => console_log.push(`[PAGEERROR] ${e.message}`));
  const shot = n => page.screenshot({ path: `${DIR}/${a.tag}_${n}.png`, fullPage: true }).catch(() => {});
  const bodyText = () => page.evaluate(() => document.body.innerText).catch(() => '');
  console.log(`\n========== ${a.label} (${a.email}) ==========`);
  try {
    // 1) LOGIN
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.fill('input[type="email"], input[name="email"]', a.email).catch(() => {});
    await page.fill('input[type="password"], input[name="password"]', PASS).catch(() => {});
    await shot('01_login');
    // submit
    await page.click('button[type="submit"], button:has-text("Log"), button:has-text("Sign")').catch(() => {});
    await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
    await sleep(4000);
    // 2) DASHBOARD — does the re-entry modal surface here?
    await shot('02_dashboard');
    const dashText = await bodyText();
    const dashReentry = /review test|retry|move on|scored|다시|넘어/i.test(dashText);
    console.log(`  dashboard loaded. re-entry-modal-on-dashboard? ${dashReentry}`);
    // 3) CLICK START → navigate to the session (exactly what the Study button does)
    console_log.push('=== NAVIGATING TO SESSION (click start) ===');
    await page.goto(`${BASE}/session/${a.classId}/${a.listId}`, { waitUntil: 'domcontentloaded' });
    await sleep(1500); await shot('03_session_loading');   // capture the 'loading session' moment
    await sleep(5000); await shot('04_session_result');    // capture where it lands
    const sessText = await bodyText();
    // classify the landing screen
    const isComplete = /complete|great job|day \d+ complete|완료|scored .* on the review|retry the review|move on to the next/i.test(sessText);
    const isReentryModal = /retry the review test or move on|scored \d+% on the review/i.test(sessText);
    const isReviewTest = /submit test|\d+\s*\/\s*\d+ answered|select the .* definition|choose the correct/i.test(sessText);
    const isNewWords = /new word|study these|flip|tap to reveal/i.test(sessText);
    const outcome = isReentryModal ? 'RE-ENTRY MODAL (auto-completion)' : isComplete ? 'COMPLETION SCREEN' : isReviewTest ? 'REVIEW TEST (shown)' : isNewWords ? 'NEW WORDS' : 'OTHER/UNKNOWN';
    console.log(`  → LANDED ON: ${outcome}`);
    console.log(`  screen text (first 300): ${sessText.replace(/\s+/g, ' ').slice(0, 300)}`);
    // save console + a snippet of the landing text
    writeFileSync(`${DIR}/${a.tag}_console.log`, console_log.join('\n'));
    summary.push({ tag: a.tag, label: a.label, dashReentry, outcome, textSnippet: sessText.replace(/\s+/g, ' ').slice(0, 200) });
    // key console cues (the app logs [PHASE]/[SESSION]/re-entry)
    const cues = console_log.filter(l => /PHASE|SESSION|re-?entry|COMPLETE|reviewTest|startPhase|determineStarting/i.test(l)).slice(0, 25);
    console.log('  KEY CONSOLE CUES:'); cues.forEach(c => console.log('    ' + c.slice(0, 160)));
  } catch (e) { console.log('  ERROR:', e.message); summary.push({ tag: a.tag, label: a.label, outcome: 'ERROR:' + e.message }); }
  await ctx.close();
}
await browser.close();
console.log('\n\n============ SUMMARY ============');
summary.forEach(s => console.log(`${s.label.padEnd(20)} dash-reentry=${s.dashReentry} | LANDED: ${s.outcome}`));
console.log(`\nscreenshots + console logs in ${DIR}/`);
process.exit(0);
