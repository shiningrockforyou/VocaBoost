// PR-1 flag-ON dev-E2E driver (round 30). Reads password from .lsr_secret.json, drives each
// dup_repro_* account through login -> dashboard -> start-day, capturing screenshots + visible
// DOM text at each step (ground-truth evidence). NOT a full auto-grader — the screenshots are the
// evidence; my visual inspection is the verdict. Sandbox only.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = 'http://localhost:5173';
const REPO = 'C:/Users/dmchw/vocaboost';
const FIND = `${REPO}/audit/playwright/findings`;
const secret = JSON.parse(readFileSync(`${REPO}/audit/playwright/.lsr_secret.json`, 'utf8'));
const PASS = secret.password || secret.pw || secret.LSR_AUDIT_PW;
if (!PASS) { console.error('NO PASSWORD in .lsr_secret.json (keys: ' + Object.keys(secret).join(',') + ')'); process.exit(2); }

const ACCTS = process.argv.slice(2);
if (!ACCTS.length) { console.error('usage: node pr1_e2e_r30.mjs <email> [email...]'); process.exit(2); }
const TAG = process.env.PR1_TAG || 'ON';   // ON | OFF (for screenshot naming)

const visibleButtons = async (page) => {
  const btns = await page.getByRole('button').all().catch(() => []);
  const out = [];
  for (const b of btns.slice(0, 25)) { const t = (await b.innerText().catch(() => '')).trim(); if (t && await b.isVisible().catch(() => false)) out.push(t.replace(/\s+/g, ' ').slice(0, 40)); }
  return [...new Set(out)];
};
const visibleHeadings = async (page) => {
  const hs = await page.locator('h1,h2,h3').all().catch(() => []);
  const out = [];
  for (const h of hs.slice(0, 15)) { const t = (await h.innerText().catch(() => '')).trim(); if (t && await h.isVisible().catch(() => false)) out.push(t.replace(/\s+/g, ' ').slice(0, 60)); }
  return [...new Set(out)];
};
const bodySignals = async (page) => {
  const txt = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  return {
    noTestContent: /no test content|no content|nothing to (study|review)/i.test(txt),
    loadingTrap: /loading/i.test(txt) && !/question|submit|answer/i.test(txt),
    dayComplete: /day .* complete|great job|completed day|all caught up|come back/i.test(txt),
    playableTest: /question|submit (test|answers)|your answer|type the/i.test(txt),
    reEntryModal: /resume|retake|continue where you left|review test/i.test(txt),
  };
};

for (const email of ACCTS) {
  const acct = email.split('@')[0];
  const rec = { email, steps: [] };
  const b = await chromium.launch({ headless: true });
  try {
    const p = await b.newContext().then(c => c.newPage());
    // --- login ---
    await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    let box = p.locator('input[type="email"]').first();
    if (!(await box.isVisible().catch(() => false))) {
      const link = p.getByRole('link', { name: /log ?in|sign ?in/i }).or(p.getByRole('button', { name: /log ?in|sign ?in/i })).first();
      if (await link.isVisible().catch(() => false)) await link.click(); else await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1200);
    }
    await p.locator('input[type="email"]').first().fill(email);
    await p.locator('input[type="password"]').first().fill(PASS);
    const sub = p.getByRole('button', { name: /log ?in|sign ?in|submit/i }).first();
    if (await sub.isVisible().catch(() => false)) await sub.click(); else await p.locator('input[type="password"]').first().press('Enter');
    const loggedIn = await p.getByText(/Welcome,/i).first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(1500);
    rec.loggedIn = loggedIn;
    // --- dashboard state ---
    const dashShot = `${FIND}/pr1_r30_${acct}_${TAG}_1dashboard.png`;
    await p.screenshot({ path: dashShot, fullPage: true }).catch(() => {});
    rec.steps.push({ step: 'dashboard', shot: dashShot, buttons: await visibleButtons(p), headings: await visibleHeadings(p), signals: await bodySignals(p) });
    // --- attempt to start the day / enter session ---
    const startRe = /start (session|studying|new words|review|day)|continue|resume|begin|study now|start your day|retake|review test/i;
    const startBtn = p.getByRole('button', { name: startRe }).or(p.getByRole('link', { name: startRe })).first();
    let clicked = false;
    if (await startBtn.isVisible().catch(() => false)) { rec.startLabel = (await startBtn.innerText().catch(() => '')).trim(); await startBtn.click().catch(() => {}); clicked = true; await p.waitForTimeout(3500); }
    rec.startClicked = clicked;
    // --- session/review state after start ---
    const sessShot = `${FIND}/pr1_r30_${acct}_${TAG}_2session.png`;
    await p.screenshot({ path: sessShot, fullPage: true }).catch(() => {});
    rec.steps.push({ step: 'after-start', shot: sessShot, buttons: await visibleButtons(p), headings: await visibleHeadings(p), signals: await bodySignals(p), url: p.url() });
    // --- if the re-entry modal offered a Retry, click it → does a PLAYABLE review render (queue populated) or the "No Test Content" trap? ---
    const retry = p.getByRole('button', { name: /retry review test|retake/i }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click().catch(() => {}); await p.waitForTimeout(4000);
      const revShot = `${FIND}/pr1_r30_${acct}_${TAG}_3review.png`;
      await p.screenshot({ path: revShot, fullPage: true }).catch(() => {});
      rec.steps.push({ step: 'after-retry', shot: revShot, buttons: await visibleButtons(p), headings: await visibleHeadings(p), signals: await bodySignals(p), url: p.url() });
    }
    await b.close();
  } catch (e) { rec.error = String(e).slice(0, 200); await b.close().catch(() => {}); }
  console.log('\n===== ' + email + ' (flags ' + TAG + ') =====');
  console.log(JSON.stringify(rec, null, 2));
}
console.log('\n[pr1_e2e] done');
