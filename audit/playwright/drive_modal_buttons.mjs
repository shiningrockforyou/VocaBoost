// drive_modal_buttons.mjs — click the re-entry modal buttons on the pre-fix dups and capture EVERYTHING:
// screenshots, full console, network writes, and Firestore state before/after each action.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password;
const BASE = 'https://vocaboostone.netlify.app';
const DIR = '/app/audit/playwright/repro_screens';
mkdirSync(DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fbState(uid, classId, listId) {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get()).data() || {};
  const ss = (await db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`).get());
  const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get()).size;
  return { csd: cp.currentStudyDay, twi: cp.totalWordsIntroduced, interv: cp.interventionLevel, sessionExists: ss.exists, sessionPhase: ss.data()?.phase, sessionReviewScore: ss.data()?.reviewTestScore, attempts: at };
}
async function uidByEmail(e) { return (await admin.auth().getUserByEmail(e)).uid; }

async function resetStale(uid, classId, listId) {
  // re-arm the re-entry trigger (the first session-load nulls reviewTestScore, so re-set it before each drive)
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get()).data() || {};
  await db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`).set({
    phase: 'complete', currentStudyDay: cp.currentStudyDay || 1, newWordsTestPassed: false, newWordsTestScore: null,
    reviewTestScore: 0, reviewTestAttempts: 1, newWordsDismissedIds: [], reviewDismissedIds: [], lastUpdated: admin.firestore.Timestamp.now(),
  });
}

async function drive(acct, action) {
  const uid = await uidByEmail(acct.email);
  await resetStale(uid, acct.classId, acct.listId);   // re-arm the stale trigger
  const before = await fbState(uid, acct.classId, acct.listId);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const clog = [], writes = [];
  page.on('console', m => clog.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => clog.push(`[PAGEERROR] ${e.message}`));
  page.on('request', r => { if (/firestore.*\/(Write|Commit)/.test(r.url()) || (r.method() === 'POST' && /firestore/.test(r.url()))) writes.push(`${r.method()} ${r.url().slice(0, 90)}`); });
  const shot = n => page.screenshot({ path: `${DIR}/${acct.tag}_${action}_${n}.png`, fullPage: true }).catch(() => {});
  const txt = () => page.evaluate(() => document.body.innerText).catch(() => '');
  console.log(`\n===== ${acct.label} — ACTION: ${action} =====`);
  console.log('  FB BEFORE:', JSON.stringify(before));
  // login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
  await page.fill('input[type="email"]', acct.email).catch(() => {});
  await page.fill('input[type="password"]', PASS).catch(() => {});
  await page.click('button[type="submit"], button:has-text("Log")').catch(() => {});
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  await sleep(3500);
  // go to session → re-entry modal
  await page.goto(`${BASE}/session/${acct.classId}/${acct.listId}`, { waitUntil: 'domcontentloaded' });
  await sleep(5000); await shot('1_modal');
  const modalText = (await txt()).replace(/\s+/g, ' ');
  console.log('  MODAL:', /Resume Day|retry the review|move on/i.test(modalText) ? '✓ re-entry modal shown' : '✗ (no modal)');

  if (action === 'retry') {
    await page.click('button:has-text("Retry Review Test"), button:has-text("Retry")', {timeout:10000}).catch(e => console.log('  click err', e.message));
    await sleep(4000); await shot('2_after_retry');
    const t = (await txt()).replace(/\s+/g, ' ');
    console.log('  AFTER RETRY →', /no test content|no.*words|nothing to review|go back/i.test(t) ? 'DEAD-END (No Test Content)' : /submit test|answered|choose|select/i.test(t) ? 'REVIEW TEST shown' : 'OTHER');
    console.log('  screen text:', t.slice(0, 260));
  } else if (action === 'moveon') {
    await page.click('button:has-text("Move On to Next Day"), button:has-text("Move On")', {timeout:10000}).catch(e => console.log('  click err', e.message));
    await sleep(4000); await shot('2_after_moveon');
    console.log('  AFTER MOVE-ON → url:', page.url(), '| text:', (await txt()).replace(/\s+/g, ' ').slice(0, 140));
    // LOOP TEST: navigate back to the session — does the modal reappear, or is it cleared?
    await page.goto(`${BASE}/session/${acct.classId}/${acct.listId}`, { waitUntil: 'domcontentloaded' });
    await sleep(5000); await shot('3_reenter_after_moveon');
    const t2 = (await txt()).replace(/\s+/g, ' ');
    console.log('  RE-ENTER after move-on →', /Resume Day|retry the review|move on/i.test(t2) ? 'MODAL AGAIN (loop!)' : /submit test|answered|choose|select|flip|study/i.test(t2) ? 'REAL SESSION shown (cleared → recovered)' : 'OTHER');
    console.log('  screen text:', t2.slice(0, 260));
  }
  writeFileSync(`${DIR}/${acct.tag}_${action}_console.log`, clog.join('\n'));
  writeFileSync(`${DIR}/${acct.tag}_${action}_writes.log`, writes.join('\n'));
  await ctx.close(); await browser.close();
  const after = await fbState(uid, acct.classId, acct.listId);
  console.log('  FB AFTER :', JSON.stringify(after));
  const delta = { csd: `${before.csd}→${after.csd}`, session: `${before.sessionExists}(${before.sessionPhase})→${after.sessionExists}(${after.sessionPhase})`, attempts: `${before.attempts}→${after.attempts}` };
  console.log('  ⇒ DELTA:', JSON.stringify(delta), '| firestore writes observed:', writes.length);
  return { acct: acct.label, action, before, after, delta, writes: writes.length };
}

const A = { tag: 'a', label: '박주하', email: 'dup_repro_a@vocaboost.test', classId: 'DUP_repro_Nys1FfB9Pkl1iyO5FYhx', listId: 'dVliNv0p9jqZYp9rfLpN' };
const B = { tag: 'b', label: 'wisdomram11', email: 'dup_repro_b@vocaboost.test', classId: 'DUP_repro_k0j59bXvvtedgqi98apt', listId: 'RmNNkuLPectBlBPiLbAJ' };
const results = [];
results.push(await drive(A, 'retry'));    // 박주하 → Retry Review Test
results.push(await drive(B, 'moveon'));    // wisdomram11 → Move On to Next Day + loop test
console.log('\n\n===== DELTA SUMMARY (did the buttons advance/write?) =====');
results.forEach(r => console.log(`${r.acct} [${r.action}]: csd ${r.delta.csd} | session ${r.delta.session} | attempts ${r.delta.attempts} | writes=${r.writes}`));
process.exit(0);
