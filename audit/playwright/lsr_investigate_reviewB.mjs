/**
 * Focused investigation: what does class B offer after a student did day1+day2-new cross-class in A?
 * (S-1 "Review B not reached" — #9 cross-class review crux.) Reuses s59's r4 classes (A/B still exist).
 * READ-ONLY: logs in, switches to B, captures the dashboard screenshot + visible study affordances + the
 * reconciled FB state. Never writes to advance.
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NODE_PATH=/app/node_modules \
 *   node audit/playwright/lsr_investigate_reviewB.mjs
 */
import { readFileSync } from 'fs';
import admin from 'firebase-admin';

const AUD = '/app/audit/playwright';
const { BASE, makeFindings, launch, newAuditPage, login, switchClass, dismissModal, shot, sleep } = await import('./lsr_ui.mjs');
const LIST = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8')).lists[0].newId;
const STUDENT = process.env.INV_STUDENT || 'lsr_s59@vocaboost.test';
const RUNTAG = process.env.INV_RUNTAG || 'S1_a967f54_r4';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const F = makeFindings(`INV_reviewB`);

const uid = (await admin.auth().getUserByEmail(STUDENT)).uid;
// find A + B classes for this run
const cq = await db.collection('classes').where('name', '>=', '25WT RUNS1').where('name', '<', '25WT RUNS1~').get();
const classes = cq.docs.filter((d) => d.data().name.includes(RUNTAG)).map((d) => ({ id: d.id, name: d.data().name }));
const B = classes.find((c) => / B /.test(c.name)) || classes.find((c) => c.name.includes(' B '));
console.log('classes:', classes.map((c) => `${c.name.slice(-18)}=${c.id.slice(0, 6)}`).join(' '));

async function fb(cid) {
  const cp = await db.collection('users').doc(uid).collection('class_progress').doc(`${cid}_${LIST}`).get();
  const ss = await db.collection('users').doc(uid).collection('session_states').doc(`${cid}_${LIST}`).get();
  return { cp: cp.exists ? { csd: cp.data().currentStudyDay, twi: cp.data().totalWordsIntroduced } : null,
           ss: ss.exists ? { phase: ss.data().phase, csd: ss.data().currentStudyDay } : null };
}

const browser = await launch();
const { page } = await newAuditPage(browser, F, 'inv-B');
try {
  await login(page, STUDENT, F);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2500);
  await dismissModal(page).catch(() => {});
  console.log('\nFB before entering B:', JSON.stringify(await fb(B.id)));

  await switchClass(page, B.name, F);
  await sleep(2500);
  await shot(page, `INV_reviewB_dashboard`);

  // What study affordances are visible on B's dashboard?
  const btns = ['start new words', 'start session', 'review', 'continue', 'start studying', 'start review'];
  const visible = [];
  for (const b of btns) {
    const v = await page.getByRole('button', { name: new RegExp(b, 'i') }).first().isVisible().catch(() => false);
    if (v) visible.push(b);
  }
  // Any visible "Day N" / phase text?
  const dayText = await page.getByText(/day \d+|step \d+ of \d+|new words|review/i).first().innerText({ timeout: 3000 }).catch(() => null);
  console.log('B dashboard — visible study buttons:', visible.length ? visible.join(', ') : '(NONE)');
  console.log('B dashboard — day/phase text:', dayText ? JSON.stringify(dayText.slice(0, 120)) : '(none)');
  console.log('screenshot:', `${AUD}/findings/INV_reviewB_dashboard.png`);

  // Click the primary study affordance and see where it lands (read-only observe, don't complete)
  const primary = visible.find((b) => b !== 'continue') || visible[0];
  if (primary) {
    await page.getByRole('button', { name: new RegExp(primary, 'i') }).first().click({ timeout: 5000 }).catch(() => {});
    await sleep(3000);
    await shot(page, `INV_reviewB_afterclick`);
    const url = page.url();
    const heading = await page.getByRole('heading').first().innerText({ timeout: 3000 }).catch(() => null);
    const newWordsCard = await page.getByText(/new word|learn.*new|introduce/i).first().isVisible().catch(() => false);
    const reviewCard = await page.getByText(/review|복습/i).first().isVisible().catch(() => false);
    console.log(`\nafter clicking "${primary}": url=${url.replace(BASE, '')} heading=${JSON.stringify((heading || '').slice(0, 80))} newWordsUI=${newWordsCard} reviewUI=${reviewCard}`);
    console.log('FB after entering B:', JSON.stringify(await fb(B.id)));
    console.log('screenshot:', `${AUD}/findings/INV_reviewB_afterclick.png`);
  }
} catch (e) {
  console.error('ERR', String(e).slice(0, 200));
} finally {
  await browser.close().catch(() => {});
}
process.exit(0);
