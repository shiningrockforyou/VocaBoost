// repro_cantaccess.mjs — reproduce "only review test → refresh → can't access VocaBoost at all"
// on the current-state Bridge TOP dups. Captures white-screen/crash + ALL console errors + pageerrors.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password;
const BASE = 'https://vocaboostone.netlify.app';
const DIR = '/app/audit/playwright/repro_screens';
mkdirSync(DIR, { recursive: true });
const CLASS = 'DUP_bt_JFCtimk25DPR333XzJHU';
const ACCTS = [
  { tag: 'h', label: '최희윤 off-by-one', email: 'dup_bt_h@vocaboost.test', listId: 'RmNNkuLPectBlBPiLbAJ' },
  { tag: 'j', label: '한예진 throttled+finished', email: 'dup_bt_j@vocaboost.test', listId: 'dVliNv0p9jqZYp9rfLpN' },
  { tag: 'z', label: '조준형 relieved', email: 'dup_bt_z@vocaboost.test', listId: 'RmNNkuLPectBlBPiLbAJ' },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const summary = [];
for (const a of ACCTS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], clog = [];
  page.on('console', m => { clog.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => { errors.push('PAGEERROR: ' + e.message); clog.push('[PAGEERROR] ' + e.message + (e.stack ? ' | ' + e.stack.split('\n').slice(1, 3).join(' ') : '')); });
  const shot = n => page.screenshot({ path: `${DIR}/ca_${a.tag}_${n}.png`, fullPage: true }).catch(() => {});
  const info = async () => { const t = await page.evaluate(() => document.body.innerText).catch(() => '(no body)'); return { len: t.length, txt: t.replace(/\s+/g, ' ').slice(0, 180) }; };
  console.log(`\n===== ${a.label} (${a.email}) =====`);
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
    await page.fill('input[type="email"]', a.email).catch(() => {});
    await page.fill('input[type="password"]', PASS).catch(() => {});
    await page.click('button[type="submit"], button:has-text("Log")').catch(() => {});
    await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
    await sleep(4000); await shot('1_dash');
    const d1 = await info(); console.log(`  DASHBOARD: bodyLen=${d1.len} | ${d1.txt}`);
    // go to session (they said 'only review test shows')
    await page.goto(`${BASE}/session/${CLASS}/${a.listId}`, { waitUntil: 'domcontentloaded' }); await sleep(5000); await shot('2_session');
    const s1 = await info(); console.log(`  SESSION: bodyLen=${s1.len} | ${s1.txt}`);
    // THE REFRESH (what they did)
    console.log('  --- REFRESH (F5) ---');
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(e => console.log('  reload err', e.message)); await sleep(6000); await shot('3_after_refresh');
    const s2 = await info(); console.log(`  AFTER REFRESH: bodyLen=${s2.len} | ${s2.txt}`);
    // can they get back to the dashboard?
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(5000); await shot('4_back_to_dash');
    const d2 = await info(); console.log(`  BACK TO DASHBOARD: bodyLen=${d2.len} | ${d2.txt}`);
    const crashed = s2.len < 40 || d2.len < 40 || /something went wrong|error|오류|다시 시도/i.test(s2.txt + d2.txt);
    console.log(`  ⇒ CRASH/CANT-ACCESS? ${crashed ? 'YES — white-screen/error' : 'no (app still renders)'} | console errors: ${errors.length}`);
    if (errors.length) { console.log('  ERRORS:'); errors.slice(0, 8).forEach(e => console.log('    ' + e.slice(0, 200))); }
    writeFileSync(`${DIR}/ca_${a.tag}_console.log`, clog.join('\n'));
    summary.push({ label: a.label, dashLen: d1.len, sessLen: s1.len, afterRefreshLen: s2.len, backDashLen: d2.len, errors: errors.length, crashed, firstError: errors[0]?.slice(0, 150) });
  } catch (e) { console.log('  FATAL:', e.message); summary.push({ label: a.label, crashed: 'ERR', firstError: e.message }); }
  await ctx.close();
}
await browser.close();
console.log('\n\n===== SUMMARY =====');
summary.forEach(s => console.log(`${(s.label||'').padEnd(26)} dash=${s.dashLen} sess=${s.sessLen} afterRefresh=${s.afterRefreshLen} backDash=${s.backDashLen} | errors=${s.errors} | CRASH=${s.crashed}${s.firstError ? ' | ' + s.firstError : ''}`));
process.exit(0);
