// repro_completeloop.mjs — reproduce "start → loading → Session Complete → dashboard (no quiz)" and
// the LOOP (back to dashboard → start → complete again). Confirm the mechanism (determineStartingPhase=COMPLETE)
// and whether cycling writes attempts / advances csd. Uses 최희윤's off-by-one dup (csd stuck at 8, day 9 done).
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
const A = { email: 'dup_bt_h@vocaboost.test', classId: 'DUP_bt_JFCtimk25DPR333XzJHU', listId: 'RmNNkuLPectBlBPiLbAJ' };
const uid = (await admin.auth().getUserByEmail(A.email)).uid;
const docId = `${A.classId}_${A.listId}`;
async function st() {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(docId).get()).data() || {};
  const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', A.listId).get()).size;
  return { csd: cp.currentStudyDay, attempts: at };
}
const before = await st(); console.log('BEFORE:', JSON.stringify(before));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const phaseLogs = [], subs = [];
page.on('console', m => { const t = m.text(); if (/DECISION|Day Number|hasNewTest|COMPLETE|startPhase|impossible/i.test(t)) phaseLogs.push(t.slice(0, 120)); });
page.on('request', r => { if (/submitVocabAttempt/.test(r.url())) subs.push('SUBMIT'); });
const shot = n => page.screenshot({ path: `${DIR}/cl_${n}.png`, fullPage: true }).catch(() => {});
const txt = async () => (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
await page.fill('input[type="email"]', A.email).catch(()=>{}); await page.fill('input[type="password"]', PASS).catch(()=>{});
await page.click('button[type="submit"], button:has-text("Log")').catch(()=>{});
await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(()=>{}); await sleep(3500);
// LOOP: start session 3 times, clicking "Back to Dashboard" between
for (let i = 1; i <= 3; i++) {
  await page.goto(`${BASE}/session/${A.classId}/${A.listId}`, { waitUntil: 'domcontentloaded' }); await sleep(5000); await shot(`round${i}`);
  const t = await txt();
  const outcome = /complete|great job|session summary/i.test(t) && !/answered|submit test|card \d+ of/i.test(t) ? 'SESSION COMPLETE (no quiz)' : /answered|submit test/i.test(t) ? 'QUIZ shown' : /card \d+ of/i.test(t) ? 'STUDY cards' : 'OTHER';
  console.log(`round ${i}: ${outcome} | ${t.slice(0, 100)}`);
  // click Back to Dashboard
  await page.click('button:has-text("Back to Dashboard"), button:has-text("Return to Dashboard"), button:has-text("Dashboard")').catch(()=>{});
  await sleep(3000);
}
await browser.close();
const after = await st();
console.log('\nKEY [PHASE] logs:'); [...new Set(phaseLogs)].slice(0, 12).forEach(l => console.log('  ' + l));
console.log('\nAFTER:', JSON.stringify(after));
console.log('⇒ csd '+before.csd+'→'+after.csd+' | attempts '+before.attempts+'→'+after.attempts+' | submitVocabAttempt calls: '+subs.length+' | LOOP WRITES/ADVANCES? '+(after.csd!==before.csd||after.attempts!==before.attempts||subs.length>0?'YES':'NO — pure display loop, no submission'));
process.exit(0);
