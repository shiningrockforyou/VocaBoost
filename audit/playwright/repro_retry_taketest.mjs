// repro_retry_taketest.mjs — drive the FULL re-entry path: modal → Retry Review Test → empty queue
// → TAKE TEST, and check whether it writes a 0-response attempt / advances csd (the submissions students blame).
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
const A = { email: 'dup_repro_a@vocaboost.test', classId: 'DUP_repro_Nys1FfB9Pkl1iyO5FYhx', listId: 'dVliNv0p9jqZYp9rfLpN' };
const uid = (await admin.auth().getUserByEmail(A.email)).uid;
const docId = `${A.classId}_${A.listId}`;
async function state() {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(docId).get()).data() || {};
  const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', A.listId).get()).size;
  const revAt = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', A.listId).where('sessionType', '==', 'review').get()).docs.map(d => d.data());
  const latest = revAt.sort((a,b)=>(b.submittedAt?.toDate?.()?.getTime?.()||0)-(a.submittedAt?.toDate?.()?.getTime?.()||0))[0];
  return { csd: cp.currentStudyDay, attempts: at, latestRev: latest ? { day: latest.studyDay, tq: latest.totalQuestions, ans: (latest.answers||[]).length, skip: latest.skipped, score: latest.score, at: latest.submittedAt?.toDate?.().toISOString().slice(11,19) } : null };
}
// re-arm the stale trigger
const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(docId).get()).data();
await db.collection('users').doc(uid).collection('session_states').doc(docId).set({ phase: 'complete', currentStudyDay: cp.currentStudyDay, newWordsTestPassed: false, newWordsTestScore: null, reviewTestScore: 0, reviewTestAttempts: 1, newWordsDismissedIds: [], reviewDismissedIds: [], lastUpdated: admin.firestore.Timestamp.now() });

const before = await state();
console.log('BEFORE:', JSON.stringify(before));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const clog = [], writes = [];
page.on('console', m => clog.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => clog.push('[PAGEERROR] ' + e.message));
page.on('request', r => { if (/submitVocabAttempt|Commit|Write/.test(r.url())) writes.push(`${r.method()} ${r.url().slice(0,70)}`); });
const shot = n => page.screenshot({ path: `${DIR}/rt_${n}.png`, fullPage: true }).catch(() => {});
const txt = async () => (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
// login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
await page.fill('input[type="email"]', A.email).catch(()=>{}); await page.fill('input[type="password"]', PASS).catch(()=>{});
await page.click('button[type="submit"], button:has-text("Log")').catch(()=>{});
await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(()=>{}); await sleep(3500);
// session → modal
await page.goto(`${BASE}/session/${A.classId}/${A.listId}`, { waitUntil: 'domcontentloaded' }); await sleep(5000); await shot('1_modal');
console.log('1) modal:', (await txt()).slice(0,80));
// Retry Review Test
await page.click('button:has-text("Retry Review Test"), button:has-text("Retry")', {timeout:10000}).catch(e=>console.log('  retry click:',e.message.slice(0,50)));
await sleep(3500); await shot('2_after_retry'); console.log('2) after Retry:', (await txt()).slice(0,110));
// TAKE TEST (on the empty 'All cards reviewed' screen)
await page.click('button:has-text("Take Test")', {timeout:10000}).catch(e=>console.log('  take-test click:',e.message.slice(0,50)));
await sleep(5000); await shot('3_after_taketest'); console.log('3) after Take Test:', (await txt()).slice(0,140));
await sleep(4000); await shot('4_settled'); console.log('4) settled:', (await txt()).slice(0,140));
writeFileSync(`${DIR}/rt_console.log`, clog.join('\n'));
await browser.close();
const after = await state();
console.log('\nAFTER :', JSON.stringify(after));
console.log('⇒ DELTA: csd '+before.csd+'→'+after.csd+' | attempts '+before.attempts+'→'+after.attempts+' | NEW SUBMISSION? '+(after.attempts>before.attempts?'YES — '+JSON.stringify(after.latestRev):'no'));
console.log('  submit-network calls:', writes.length);
process.exit(0);
