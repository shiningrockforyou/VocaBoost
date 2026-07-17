// repro_midtest2.mjs — get INTO the review MCQ test (0 answered), then REFRESH mid-test, and check
// whether the recovery writes a 0-response attempt / advances the day (the submissions students blame).
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
async function st() {
  const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(docId).get()).data() || {};
  const revAt = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', A.listId).where('sessionType', '==', 'review').get()).docs.map(d => d.data());
  const latest = revAt.sort((a,b)=>(b.submittedAt?.toDate?.()?.getTime?.()||0)-(a.submittedAt?.toDate?.()?.getTime?.()||0))[0];
  return { csd: cp.currentStudyDay, reviewAttempts: revAt.length, latest: latest ? `d${latest.studyDay} tq${latest.totalQuestions} ans${(latest.answers||[]).length} skip${latest.skipped} score${latest.score} @${latest.submittedAt?.toDate?.().toISOString().slice(11,19)}` : null };
}
// clear session_state so he goes to the REAL review (not the re-entry modal)
await db.collection('users').doc(uid).collection('session_states').doc(docId).delete().catch(()=>{});
const before = await st(); console.log('BEFORE:', JSON.stringify(before));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const clog = [], subs = [];
page.on('console', m => clog.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => clog.push('[PAGEERROR] ' + e.message));
page.on('request', r => { if (/submitVocabAttempt/.test(r.url())) subs.push(`SUBMIT ${new Date().toISOString().slice(11,19)}`); });
const shot = n => page.screenshot({ path: `${DIR}/mt2_${n}.png`, fullPage: true }).catch(() => {});
const txt = async () => (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
await page.fill('input[type="email"]', A.email).catch(()=>{}); await page.fill('input[type="password"]', PASS).catch(()=>{});
await page.click('button[type="submit"], button:has-text("Log")').catch(()=>{});
await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 }).catch(()=>{}); await sleep(3500);
await page.goto(`${BASE}/session/${A.classId}/${A.listId}`, { waitUntil: 'domcontentloaded' }); await sleep(5000);
console.log('1) session:', (await txt()).slice(0,70));
// Session menu → Skip to Test → confirm
await page.click('button[aria-label="Session menu"]').catch(e=>console.log('  menu:',e.message.slice(0,40))); await sleep(700);
await page.click('button:has-text("Skip to Test")').catch(e=>console.log('  skip:',e.message.slice(0,40))); await sleep(700);
await page.click('button:has-text("Skip"), button:has-text("Start Test"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("Confirm")').catch(()=>{});
await sleep(4000); await shot('1_in_test');
const inTest = /submit test|answered|choose|select the|correct definition/i.test(await txt());
console.log('2) in MCQ test?', inTest ? 'YES' : 'NO', '|', (await txt()).slice(0,90));
// THE MID-TEST REFRESH (0 answered)
console.log('  --- REFRESH mid-test (0 answered) ---');
await page.reload({ waitUntil: 'domcontentloaded' }).catch(()=>{}); await sleep(6000); await shot('2_after_refresh');
console.log('3) after refresh:', (await txt()).slice(0,140));
await sleep(4000); await shot('3_settled'); console.log('4) settled:', (await txt()).slice(0,140));
writeFileSync(`${DIR}/mt2_console.log`, clog.join('\n'));
await browser.close();
const after = await st(); console.log('\nAFTER :', JSON.stringify(after));
console.log('⇒ csd '+before.csd+'→'+after.csd+' | reviewAttempts '+before.reviewAttempts+'→'+after.reviewAttempts+' | submitVocabAttempt calls: '+subs.length+' | NEW SUBMISSION FROM REFRESH? '+(after.reviewAttempts>before.reviewAttempts?'YES — '+after.latest:'no'));
process.exit(0);
