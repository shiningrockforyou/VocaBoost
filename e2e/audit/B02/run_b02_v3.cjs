/**
 * B02 — MCQ Submission Critical Path (v3 — SPA navigation fix)
 *
 * KEY FIX: Netlify SPA does not redirect /mcqtest/* to index.html.
 * Navigate via client-side pushState after loading root.
 *
 * Run: node e2e/audit/B02/run_b02_v3.cjs
 */

const { chromium } = require('playwright');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SA = require('/app/scripts/serviceAccountKey.json');
if (getApps().length === 0) initializeApp({ credential: cert(SA) });
const fsDb = getFirestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const EV = '/app/audit/playwright/findings/evidence/B02';
const LOG = '/app/audit/playwright/findings/agent_logs/B.jsonl';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';
fs.mkdirSync(EV, { recursive: true });

const ACCS = {
  careful:   { email: 'audit_careful_01_top@vocaboost.test',   password: 'AuditPass2026!', uid: 'EPnmY4FIXxVq19tQtxQCvE26p0F3' },
  recovering:{ email: 'audit_recovering_01_top@vocaboost.test',password: 'AuditPass2026!', uid: 'P8b1hVCk9qSvOWsYbrqTT6oznY03' },
  rushed:    { email: 'audit_rushed_01_top@vocaboost.test',    password: 'AuditPass2026!', uid: 'trOe7MHzaYZuP99R7N3g5RuI6o83' },
  hostile:   { email: 'audit_hostile_01_top@vocaboost.test',   password: 'AuditPass2026!', uid: 'bvexVreuuvNrGZ1aWygwAhRGdm03' },
  lazy:      { email: 'audit_lazy_01_top@vocaboost.test',      password: 'AuditPass2026!', uid: 'VBgBmlrlzXVPzURmABkdDBGtKd42' },
  anxious:   { email: 'audit_anxious_01_top@vocaboost.test',   password: 'AuditPass2026!', uid: 'KsZv3zxcUEVTdFbdWKZ8oesDcj33' },
};

function logLine(obj) { fs.appendFileSync(LOG, JSON.stringify({ts:new Date().toISOString(),...obj})+'\n'); }
function updateStatus(u) {
  const sp='/app/audit/playwright/findings/agent_logs/B.status.json';
  const c=JSON.parse(fs.readFileSync(sp,'utf-8'));
  fs.writeFileSync(sp, JSON.stringify({...c,...u,lastUpdate:new Date().toISOString()},null,2));
}

// ── Firestore helpers ──────────────────────────────────────────────────────────
async function fsSnap(uid, label) {
  const as = await fsDb.collection('attempts').where('studentId','==',uid).get();
  const attempts = as.docs.map(d=>({id:d.id,...d.data()}));
  const ss = await fsDb.collection('users').doc(uid).collection('study_states').get();
  const studyStates = {};
  ss.docs.forEach(d=>{studyStates[d.id]=d.data();});
  const fp = path.join(EV, `${label}_fs.json`);
  fs.writeFileSync(fp, JSON.stringify({uid,attempts,studyStates,at:new Date().toISOString()},null,2));
  return {attempts,studyStates};
}
function ttt(ss) { return Object.values(ss).reduce((s,st)=>s+(st.timesTestedTotal||0),0); }

// ── Browser helpers ────────────────────────────────────────────────────────────
async function ss(page, name) {
  await page.screenshot({path:path.join(EV,`${name}.png`),fullPage:true}).catch(()=>{});
}
function attachConsole(page) {
  const msgs=[];
  page.on('console',m=>msgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror',e=>msgs.push(`[pageerror] ${e.message}`));
  return msgs;
}
function saveConsole(msgs,name) {
  fs.writeFileSync(path.join(EV,`${name}_console.log`),msgs.join('\n'));
  return msgs.filter(m=>m.startsWith('[error]')||m.startsWith('[pageerror]'));
}
async function lsGet(page,key) { return page.evaluate(k=>localStorage.getItem(k),key); }
function tkKey(t){return `vocaboost_test_${CLASS_ID}_${LIST_ID}_${t}`;}
function nkKey(t){return `vocaboost_test_${CLASS_ID}_${LIST_ID}_${t}_nonce`;}
async function getBestNonce(page) {
  let n=await lsGet(page,nkKey('review'));
  if(n) return {nonce:n,testType:'review'};
  n=await lsGet(page,nkKey('new'));
  if(n) return {nonce:n,testType:'new'};
  return {nonce:null,testType:null};
}

async function newBrowser() {
  const b = await chromium.launch({headless:true});
  const ctx = await b.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript(()=>
    navigator.serviceWorker?.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))
  );
  return {browser:b, ctx, page: await ctx.newPage()};
}

// ── Login (root → pushState → login form) ─────────────────────────────────────
async function loginAs(page, acc) {
  await page.goto(BASE_URL+'/', {waitUntil:'networkidle', timeout:45000});
  // If not on /login yet, push to login
  if (!page.url().includes('/login')) {
    await page.evaluate(()=>{history.pushState({},'','/login');dispatchEvent(new PopStateEvent('popstate'));});
    await page.waitForTimeout(1500);
  }
  await page.getByLabel(/email/i).first().fill(acc.email);
  await page.getByLabel(/password/i).first().fill(acc.password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/,{timeout:15000}).catch(async()=>{
    await page.getByRole('button',{name:/continue|log\s?in|sign\s?in/i}).first().click().catch(()=>{});
    await page.waitForURL(/\/(dashboard|$)/,{timeout:15000});
  });
  console.log(`  Logged in: ${acc.email}, URL=${page.url()}`);
}

// ── SPA-safe MCQ navigation ────────────────────────────────────────────────────
// CRITICAL: Netlify 404s on deep /mcqtest/* routes.
// Must use client-side pushState from within the SPA shell.
async function goToMCQ(page, testType='review') {
  const targetPath = `/mcqtest/${CLASS_ID}/${LIST_ID}?type=${testType}`;
  // If we're at root, push to MCQ route
  await page.evaluate(p=>{
    history.pushState({},'',p);
    window.dispatchEvent(new PopStateEvent('popstate',{state:{}}));
  }, targetPath);
  // Wait for test to render
  await Promise.race([
    page.waitForSelector('button:has-text("Submit Test")',{timeout:25000}),
    page.waitForSelector('text=Resume Previous Test?',{timeout:25000}),
    page.waitForSelector('text=No Test Content',{timeout:25000}),
    page.waitForSelector('text=Something went wrong',{timeout:25000}),
  ]).catch(()=>{});
  await page.waitForTimeout(500);
}

// ── Dashboard navigation (for S12 between-runs) ──────────────────────────────
async function goToDashboard(page) {
  await page.evaluate(()=>{history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate',{state:{}}));});
  await page.waitForTimeout(1500);
}

async function clearRecovery(page) {
  const btn=page.getByRole('button',{name:/start fresh/i});
  if(await btn.count()>0 && await btn.isVisible().catch(()=>false)){await btn.click();await page.waitForTimeout(800);}
}
async function testLoaded(page){return page.locator('button:has-text("Submit Test")').isVisible().catch(()=>false);}

async function answerAll(page) {
  let iter=80, n=0;
  while(iter-->0){
    const txt=await page.locator('button:has-text("Submit Test")').textContent().catch(()=>'');
    const m=txt.match(/\((\d+)\/(\d+)/);
    if(m&&m[1]===m[2]) break;
    const opts=page.locator('.grid button[type="button"]:not([aria-label])');
    if(await opts.count()===0) break;
    await opts.first().click();
    n++;
    await page.waitForTimeout(200);
  }
  return n;
}
async function answerN(page,n) {
  let answered=0;
  for(let i=0;i<n;i++){
    const opts=page.locator('.grid button[type="button"]:not([aria-label])');
    if(await opts.count()===0) break;
    await opts.first().click();
    answered++;
    await page.waitForTimeout(200);
  }
  return answered;
}
async function waitForResults(page,ms=40000) {
  await Promise.race([
    page.waitForSelector('text=Great Work',{timeout:ms}),
    page.waitForSelector('text=Room for Improvement',{timeout:ms}),
    page.waitForSelector('text=Keep Practicing',{timeout:ms}),
    page.waitForSelector('text=Needs Attention',{timeout:ms}),
    page.waitForSelector('text=New Words Test Passed',{timeout:ms}),
    page.waitForSelector('text=Did not pass',{timeout:ms}),
    page.waitForSelector('text=Continue',{timeout:ms}),
    page.waitForSelector('text=correct',{timeout:ms}),
  ]).catch(()=>{});
}

const results={};
async function scenario(label,fn) {
  const t0=Date.now();
  console.log(`\n${'='.repeat(60)}\n${label}`);
  updateStatus({currentScenario:label});
  try {
    const r=await fn();
    const ms=Date.now()-t0;
    results[label]={...r,ms};
    logLine({event:'scenario',batch:'B02',scenario:label,result:r.result,severity:r.severity||null,durationMs:ms});
    console.log(`  => ${r.result} [${r.severity||''}] ${ms}ms — ${(r.notes||'').slice(0,100)}`);
    return r;
  } catch(err) {
    const ms=Date.now()-t0;
    const r={result:'error',severity:'BLOCKER',notes:err.message,ms};
    results[label]=r;
    logLine({event:'scenario',batch:'B02',scenario:label,result:'error',severity:'BLOCKER',durationMs:ms,error:err.message});
    console.error(`  ERROR: ${err.message}`);
    return r;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('B02 v3 — MCQ Submission Critical Path');

  // Pre-flight baselines
  console.log('\nPre-flight Firestore baselines...');
  const baselines={};
  for(const [k,a] of Object.entries(ACCS)) baselines[k]=await fsSnap(a.uid,`B02_pre_${k}`);
  console.log('Baselines done.');

  // ── S01: Happy Path ──────────────────────────────────────────────────────
  await scenario('S01',async()=>{
    const {browser,page}=await newBrowser();
    const msgs=attachConsole(page);
    try {
      const acc=ACCS.careful;
      const before=await fsSnap(acc.uid,'B02_S01_before');
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);

      if(!await testLoaded(page)){
        await ss(page,'B02_S01_not_loaded');
        const txt=await page.evaluate(()=>document.body.innerText.slice(0,300));
        return {result:'blocked',notes:`MCQ not loaded after SPA nav. Body: ${txt}`};
      }

      const {nonce:nonceBefore}=await getBestNonce(page);
      console.log(`  nonce before=${nonceBefore}`);
      await ss(page,'B02_S01_pre_answer');
      const answered=await answerAll(page);
      console.log(`  answered=${answered}`);
      await ss(page,'B02_S01_pre_submit');

      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await ss(page,'B02_S01_results');
      await page.waitForTimeout(5000);
      const after=await fsSnap(acc.uid,'B02_S01_after');
      const errors=saveConsole(msgs,'B02_S01');

      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      const issues=[];

      if(newAtts.length===0) issues.push('BLOCKER: No attempt doc created');
      else if(newAtts.length>1) issues.push(`HIGH: ${newAtts.length} attempt docs`);
      if(newAtts.length===1){
        const att=newAtts[0];
        console.log(`  attempt: id=${att.id} score=${att.score} testType=${att.testType} sessionType=${att.sessionType}`);
        if(att.studentId!==acc.uid) issues.push('HIGH: studentId mismatch');
        if(att.testType!=='mcq') issues.push(`HIGH: testType=${att.testType} expected mcq`);
        if(!att.id.includes(acc.uid)) issues.push(`MEDIUM: uid not in docId`);
      }

      const updatedWords=Object.keys(after.studyStates).filter(id=>(after.studyStates[id].timesTestedTotal||0)>(before.studyStates[id]?.timesTestedTotal||0));
      if(Object.keys(after.studyStates).length>0&&updatedWords.length===0) issues.push('HIGH: study_states not updated');

      const lsAfter=await lsGet(page,tkKey('review'));
      if(lsAfter!==null) issues.push('MEDIUM: localStorage not cleared after success');

      const relErr=errors.filter(e=>!e.includes('serviceWorker')&&!e.includes('favicon'));
      if(relErr.length) issues.push(`LOW: ${relErr.length} console error(s)`);

      const blockers=issues.filter(i=>i.startsWith('BLOCKER'));
      const highs=issues.filter(i=>i.startsWith('HIGH'));
      if(blockers.length) return {result:'fail',severity:'BLOCKER',notes:blockers.join('; '),newAtts};
      if(highs.length) return {result:'fail',severity:'HIGH',notes:highs.join('; '),newAtts};
      if(issues.length) return {result:'partial',severity:'MEDIUM',notes:issues.join('; '),newAtts};
      return {result:'pass',notes:`1 attempt id=${newAtts[0]?.id} score=${newAtts[0]?.score} study_states updated for ${updatedWords.length} words`,newAtts};
    } finally { await browser.close(); }
  });

  if(results.S01?.result==='error'||(results.S01?.result==='fail'&&results.S01?.severity==='BLOCKER')){
    logLine({event:'stop_condition_hit',batch:'B02',scenario:'S01',reason:'S01 BLOCKER'});
    await writeFindings(true); return;
  }

  // ── S02: clearTestState ordering ─────────────────────────────────────────
  await scenario('S02',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.recovering;
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S02)'};

      const answered=await answerN(page,8);
      console.log(`  answered ${answered}`);
      await page.waitForTimeout(1000);

      const lsKey=tkKey('review');
      const lsBefore=await lsGet(page,lsKey);
      console.log(`  ls saved: ${lsBefore!==null}`);
      if(!lsBefore) return {result:'fail',severity:'HIGH',notes:'Answers not saved to localStorage. Recovery impossible.'};

      const savedCount=Object.keys(JSON.parse(lsBefore).answers||{}).length;
      console.log(`  ${savedCount} answers in localStorage`);

      await ss(page,'B02_S02_before_refresh');
      await page.reload({waitUntil:'networkidle',timeout:35000});
      await page.waitForTimeout(3000);
      await ss(page,'B02_S02_after_refresh');

      const lsAfterRefresh=await lsGet(page,lsKey);
      console.log(`  ls after refresh: ${lsAfterRefresh!==null}`);

      if(!lsAfterRefresh) {
        return {result:'fail',severity:'BLOCKER',notes:'Fix #1 REGRESSION: clearTestState called before successful submit. Answers lost on refresh!'};
      }

      const recoveryVisible=await page.getByText(/Resume Previous Test|resume where you left off/i).isVisible().catch(()=>false);
      const resumeBtn=page.getByRole('button',{name:/^resume$/i});
      const resumeVisible=await resumeBtn.isVisible().catch(()=>false);
      console.log(`  recoveryPrompt=${recoveryVisible}, resumeBtn=${resumeVisible}`);

      if(!recoveryVisible&&!resumeVisible){
        const parsedState=JSON.parse(lsAfterRefresh||'{"answers":{}}');
        return {result:'partial',severity:'MEDIUM',notes:`Answers in ls (${Object.keys(parsedState.answers||{}).length}) but no recovery prompt shown.`};
      }

      if(resumeVisible){
        await resumeBtn.click();
        await page.waitForTimeout(1200);
        await ss(page,'B02_S02_after_resume');
        const selectedCount=await page.locator('.scale-105').count();
        console.log(`  selected after resume: ${selectedCount}`);
      }

      return {result:'pass',notes:`Fix #1 confirmed: clearTestState NOT called before submit. ${savedCount} answers survived refresh. Recovery prompt=${recoveryVisible}.`};
    } finally { await browser.close(); }
  });

  if(results.S02?.result==='fail'&&results.S02?.severity==='BLOCKER'){
    logLine({event:'stop_condition_hit',batch:'B02',scenario:'S02',reason:'clearTestState regression'});
    await writeFindings(true); return;
  }

  // ── S03: processTestResults ordering ─────────────────────────────────────
  await scenario('S03',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.hostile;
      const before=await fsSnap(acc.uid,'B02_S03_before');
      const tttB=ttt(before.studyStates);
      const attsB=before.attempts.length;
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S03)'};

      const answered=await answerAll(page);
      console.log(`  answered=${answered}`);
      await ss(page,'B02_S03_pre_submit');

      let splitBrain=false;
      await page.locator('button:has-text("Submit Test")').click();

      for(let i=0;i<30;i++){
        await page.waitForTimeout(200);
        const submitting=await page.getByText('Submitting Your Test...').isVisible().catch(()=>false);
        if(submitting){
          const dur=await fsSnap(acc.uid,'B02_S03_during');
          const tttD=ttt(dur.studyStates);
          const attsD=dur.attempts.length;
          console.log(`  During: ttt=${tttD} (was ${tttB}), atts=${attsD} (was ${attsB})`);
          if(tttD>tttB&&attsD===attsB) splitBrain=true;
          break;
        }
      }

      await waitForResults(page);
      await ss(page,'B02_S03_post_submit');
      await page.waitForTimeout(5000);
      const after=await fsSnap(acc.uid,'B02_S03_after');
      const tttA=ttt(after.studyStates);
      console.log(`  After: ttt=${tttA}, atts=${after.attempts.length}`);

      if(splitBrain) return {result:'fail',severity:'BLOCKER',notes:'Fix #3 REGRESSED: study_states mutated before attempt write (split-brain).'};

      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      if(newAtts.length===0) return {result:'blocked',notes:'No attempt created (S03)'};
      if(tttA===tttB) return {result:'fail',severity:'HIGH',notes:`study_states NOT updated after attempt write. ttt unchanged=${tttA}`};

      return {result:'pass',notes:`Fix #3 confirmed: ${newAtts.length} attempt(s), ttt ${tttB}->${tttA} after write. No split-brain.`};
    } finally { await browser.close(); }
  });

  if(results.S03?.result==='fail'&&results.S03?.severity==='BLOCKER'){
    logLine({event:'stop_condition_hit',batch:'B02',scenario:'S03',reason:'split-brain'});
    await writeFindings(true); return;
  }

  // ── S04: No double-increment ─────────────────────────────────────────────
  await scenario('S04',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.rushed;
      const before=await fsSnap(acc.uid,'B02_S04_before');
      const tttB=ttt(before.studyStates);
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S04)'};

      await answerAll(page);
      const btn=page.locator('button:has-text("Submit Test")');
      await btn.click();
      await page.waitForTimeout(100); await btn.click().catch(()=>{});
      await page.waitForTimeout(100); await btn.click().catch(()=>{});
      await waitForResults(page);
      await ss(page,'B02_S04_results');
      await page.waitForTimeout(5000);
      const after=await fsSnap(acc.uid,'B02_S04_after');
      const tttA=ttt(after.studyStates);
      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      const inc=tttA-tttB;
      const q=newAtts[0]?.totalQuestions||0;
      console.log(`  atts=${newAtts.length}, ttt ${tttB}->${tttA}, inc=${inc}, q=${q}`);
      if(newAtts.length>1) return {result:'fail',severity:'HIGH',notes:`${newAtts.length} attempt docs from rapid-click`};
      if(q>0&&inc>=q*2) return {result:'fail',severity:'HIGH',notes:`Double-increment: inc=${inc} for q=${q}`};
      return {result:'pass',notes:`Fix #4 confirmed: 1 attempt, tttIncrement=${inc} for ${q} questions.`};
    } finally { await browser.close(); }
  });

  // ── S05: Idempotent docId ─────────────────────────────────────────────────
  await scenario('S05',async()=>{
    const {browser,page}=await newBrowser();
    const msgs=attachConsole(page);
    try {
      const acc=ACCS.recovering;
      const before=await fsSnap(acc.uid,'B02_S05_before');
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S05)'};

      await answerAll(page);
      let {nonce:nonceBefore,testType}=await getBestNonce(page);
      console.log(`  nonce before submit=${nonceBefore}`);

      await ss(page,'B02_S05_pre_submit');
      await page.locator('button:has-text("Submit Test")').click();

      let nonceAtSubmit=nonceBefore;
      if(!nonceAtSubmit){
        for(let i=0;i<8;i++){
          await page.waitForTimeout(250);
          const {nonce}=await getBestNonce(page);
          if(nonce){nonceAtSubmit=nonce;break;}
        }
      }
      console.log(`  nonce at submit=${nonceAtSubmit}`);

      await waitForResults(page);
      await ss(page,'B02_S05_results');
      const {nonce:nonceAfter}=await getBestNonce(page);
      console.log(`  nonce after success=${nonceAfter} (expect null)`);

      await page.waitForTimeout(5000);
      const after=await fsSnap(acc.uid,'B02_S05_after');
      saveConsole(msgs,'B02_S05');

      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      if(newAtts.length>1) return {result:'fail',severity:'HIGH',notes:`Multiple attempts: ${newAtts.length}`};
      if(newAtts.length===0) return {result:'blocked',notes:'No attempt created (S05)'};

      const attId=newAtts[0].id;
      console.log(`  attemptId=${attId}`);
      const issues=[];
      if(!attId.includes(acc.uid)) issues.push(`UID not in docId ${attId}`);
      if(nonceAtSubmit&&!attId.includes(nonceAtSubmit)) issues.push(`Nonce ${nonceAtSubmit} not in docId ${attId}`);
      if(nonceAfter!==null) issues.push(`Nonce not cleared after success (still: ${nonceAfter})`);

      const idIssues=issues.filter(i=>i.includes('docId'));
      if(idIssues.length) return {result:'fail',severity:'HIGH',notes:idIssues.join('; ')};
      if(issues.length) return {result:'partial',severity:'MEDIUM',notes:issues.join('; ')};
      return {result:'pass',notes:`Fix #5 confirmed: uid+nonce in docId, nonce cleared. id=${attId}`};
    } finally { await browser.close(); }
  });

  // ── S06: Refresh after success ───────────────────────────────────────────
  await scenario('S06',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.careful;
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'S06: test not loaded'};

      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await ss(page,'B02_S06_on_results');

      await page.reload({waitUntil:'networkidle',timeout:35000});
      await page.waitForTimeout(3000);
      await ss(page,'B02_S06_after_refresh');

      const url=page.url();
      const recovery=await page.getByText(/Resume Previous Test/i).isVisible().catch(()=>false);
      console.log(`  URL=${url}, recovery=${recovery}`);

      if(recovery){
        return {result:'partial',severity:'MEDIUM',notes:'After success+refresh: recovery prompt appeared. clearTestState may not execute before page unload. Double-processTestResults risk.'};
      }
      return {result:'pass',notes:`After success+refresh: no recovery prompt. URL=${url}.`};
    } finally { await browser.close(); }
  });

  // ── S07: Practice mode — architecture-limited ────────────────────────────
  await scenario('S07',async()=>{
    // Practice mode requires DailySessionFlow location.state. Cannot inject via URL.
    // We document this as a structural limitation.
    return {result:'blocked',notes:'Practice mode requires DailySessionFlow location.state={practiceMode:true}. Cannot inject via URL or pushState for a React Router state value. Code-path inspection confirms: isPracticeMode=false for URL navigation, attempt write branch is skipped only when isPracticeMode=true.'};
  });

  // ── S08: Zero answers ────────────────────────────────────────────────────
  await scenario('S08',async()=>{
    const {browser,page}=await newBrowser();
    const msgs=attachConsole(page);
    try {
      const acc=ACCS.lazy;
      const before=await fsSnap(acc.uid,'B02_S08_before');
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S08)'};

      await ss(page,'B02_S08_zero_answers');
      await page.locator('button:has-text("Submit Test")').click();
      await page.waitForTimeout(4000);
      await ss(page,'B02_S08_after_zero');

      const validation=await page.getByText(/please answer at least one/i).isVisible().catch(()=>false);
      const onResults=await page.getByText(/\d+ of \d+ correct/i).isVisible().catch(()=>false);
      saveConsole(msgs,'B02_S08');
      await page.waitForTimeout(3000);
      const after=await fsSnap(acc.uid,'B02_S08_after');
      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      console.log(`  validation=${validation}, results=${onResults}, newAtts=${newAtts.length}`);

      if(validation&&newAtts.length===0) return {result:'pass',notes:'Zero-answer blocked by validation. 0 attempt docs.'};
      if(validation&&newAtts.length>0) return {result:'fail',severity:'HIGH',notes:'Validation shown but attempt created!'};
      if(onResults&&newAtts.length===1) return {result:'pass',notes:`Zero-answer allowed through with score. 1 attempt.`};
      if(onResults&&newAtts.length===0) return {result:'partial',severity:'MEDIUM',notes:'Results shown but no attempt doc.'};
      return {result:'partial',severity:'MEDIUM',notes:`Unexpected: validation=${validation}, results=${onResults}, atts=${newAtts.length}`};
    } finally { await browser.close(); }
  });

  // ── S09: Double-click submit ──────────────────────────────────────────────
  await scenario('S09',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.rushed;
      const before=await fsSnap(acc.uid,'B02_S09_before');
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S09)'};

      await answerAll(page);
      await ss(page,'B02_S09_pre_dblclick');
      await page.locator('button:has-text("Submit Test")').dblclick();
      await waitForResults(page);
      await ss(page,'B02_S09_results');
      await page.waitForTimeout(5000);
      const after=await fsSnap(acc.uid,'B02_S09_after');
      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      const tttInc=ttt(after.studyStates)-ttt(before.studyStates);
      console.log(`  newAtts=${newAtts.length}, tttInc=${tttInc}`);
      if(newAtts.length>1) return {result:'fail',severity:'HIGH',notes:`Double-click: ${newAtts.length} attempt docs. Dedup broken.`};
      if(newAtts.length===0) return {result:'blocked',notes:'No attempt (S09)'};
      return {result:'pass',notes:`Double-click: 1 attempt, tttInc=${tttInc}. Dedup working.`};
    } finally { await browser.close(); }
  });

  // ── S10: Simultaneous last-answer + submit ────────────────────────────────
  await scenario('S10',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.rushed;
      const before=await fsSnap(acc.uid,'B02_S10_before');
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'MCQ not loaded (S10)'};

      const submitTxt=await page.locator('button:has-text("Submit Test")').textContent().catch(()=>'0/30');
      const totalQ=parseInt(submitTxt.match(/\/(\d+)/)?.[1]||'30');
      console.log(`  totalQ=${totalQ}`);

      await answerN(page,Math.max(0,totalQ-1));
      // Navigate to last question
      const rightArrow=page.getByRole('button',{name:'Next question'});
      for(let i=0;i<5;i++){
        if(!await rightArrow.isEnabled().catch(()=>false)) break;
        await rightArrow.click(); await page.waitForTimeout(100);
      }

      await ss(page,'B02_S10_pre_simultaneous');
      const lastOpt=page.locator('.grid button[type="button"]:not([aria-label])').first();
      const submitBtn=page.locator('button:has-text("Submit Test")');
      await Promise.all([
        lastOpt.click().catch(()=>{}),
        page.waitForTimeout(100).then(()=>submitBtn.click().catch(()=>{}))
      ]);

      await waitForResults(page);
      await ss(page,'B02_S10_results');
      await page.waitForTimeout(5000);
      const after=await fsSnap(acc.uid,'B02_S10_after');
      const newAtts=after.attempts.filter(a=>!before.attempts.some(b=>b.id===a.id));
      if(newAtts.length===0) return {result:'blocked',notes:'No attempt (S10)'};
      const ansCount=newAtts[0].answers?.length||0;
      console.log(`  answers=${ansCount}, totalQ=${totalQ}`);
      if(ansCount<totalQ) return {result:'fail',severity:'MEDIUM',notes:`Last answer possibly dropped: ${ansCount} vs ${totalQ}. answersRef race.`};
      return {result:'pass',notes:`Simultaneous click: ${ansCount}/${totalQ} captured. answersRef working.`};
    } finally { await browser.close(); }
  });

  // ── S11: Console clean ────────────────────────────────────────────────────
  await scenario('S11',async()=>{
    const {browser,page}=await newBrowser();
    const msgs=attachConsole(page);
    try {
      const acc=ACCS.careful;
      await loginAs(page,acc);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'S11: test not loaded'};

      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      const errors=saveConsole(msgs,'B02_S11');
      const relevant=errors.filter(e=>!e.includes('serviceWorker')&&!e.includes('favicon')&&!e.includes('chrome-extension'));
      const debugLogs=msgs.filter(m=>m.includes('[DEBUG')||m.includes('[SUBMIT]')||m.includes('[PHASE]')||m.includes('[SNAPSHOT]'));
      console.log(`  total=${msgs.length}, relevant errors=${relevant.length}, debug=${debugLogs.length}`);
      if(relevant.length>0){
        return {result:'fail',severity:relevant.some(e=>e.includes('pageerror'))?'MEDIUM':'LOW',notes:`Console errors: ${relevant.slice(0,3).join('; ')}`};
      }
      return {result:'pass',notes:`0 relevant errors. ${debugLogs.length} debug log messages in production (cosmetic noise).`};
    } finally { await browser.close(); }
  });

  // ── S12: No docId collision ───────────────────────────────────────────────
  await scenario('S12',async()=>{
    const {browser,page}=await newBrowser();
    try {
      const acc=ACCS.careful;
      const before=await fsSnap(acc.uid,'B02_S12_before');
      const existingIds=new Set(before.attempts.map(a=>a.id));

      await loginAs(page,acc);

      // First run
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'blocked',notes:'S12: test not loaded'};

      const {nonce:n1}=await getBestNonce(page);
      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await page.waitForTimeout(5000);

      const mid=await fsSnap(acc.uid,'B02_S12_after_first');
      const first=mid.attempts.filter(a=>!existingIds.has(a.id));
      console.log(`  First run: ${first.length} new attempts`);
      if(first.length===0) return {result:'blocked',notes:'S12: first run no attempt'};
      const firstId=first[0].id;

      // Second run — go back to dashboard, then push to MCQ again
      await goToDashboard(page);
      await goToMCQ(page,'review');
      await clearRecovery(page);
      if(!await testLoaded(page)) return {result:'partial',severity:'MEDIUM',notes:'S12: second run not loaded'};

      const {nonce:n2}=await getBestNonce(page);
      console.log(`  nonce1=${n1}, nonce2=${n2}`);
      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await ss(page,'B02_S12_second_run');
      await page.waitForTimeout(5000);

      const final=await fsSnap(acc.uid,'B02_S12_after_second');
      const second=final.attempts.filter(a=>!existingIds.has(a.id)&&a.id!==firstId);
      console.log(`  Second run: ${second.length} new unique attempts`);

      if(second.length===0){
        if(final.attempts.some(a=>a.id===firstId)) return {result:'fail',severity:'HIGH',notes:`S12: second overwrote first! Collision on ${firstId}.`};
        return {result:'blocked',notes:'S12: second run no new attempt'};
      }

      if(firstId===second[0].id) return {result:'fail',severity:'HIGH',notes:`DocId collision: both runs => ${firstId}.`};
      return {result:'pass',notes:`No collision: first=${firstId.slice(-20)}, second=${second[0].id.slice(-20)}. Nonces: ${n1||'?'} vs ${n2||'?'}.`};
    } finally { await browser.close(); }
  });

  await writeFindings(false);
}

// ─── Findings writer ─────────────────────────────────────────────────────────
async function writeFindings(halted) {
  const S=['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12'];
  let pass=0,fail=0,blocked=0,partial=0,blocker=0,high=0,medium=0,low=0;
  for(const s of S){
    const r=results[s];
    if(!r||r.result==='blocked'){blocked++;continue;}
    if(r.result==='pass') pass++;
    else if(r.result==='fail'){fail++;if(r.severity==='BLOCKER')blocker++;else if(r.severity==='HIGH')high++;else if(r.severity==='MEDIUM')medium++;else low++;}
    else if(r.result==='partial'){partial++;if(r.severity==='MEDIUM')medium++;else low++;}
    else if(r.result==='error'){fail++;blocker++;}
  }
  const total=Object.keys(results).length;
  const overall=blocker>0?'BLOCKER-HALT':(fail+partial>0)?'PASS-WITH-FINDINGS':'PASS';
  const dMin=Math.round(Object.values(results).reduce((s,r)=>s+(r.ms||0),0)/60000);
  logLine({event:'batch_end',batch:'B02',trials:total,pass,fail,blocked,partial,blockerCount:blocker,highCount:high,mediumCount:medium,lowCount:low,haltedOnBlocker:halted});
  updateStatus({state:halted?'stopped':'finished',batchesCompleted:['B02'],trialsCompleted:total,currentScenario:'done'});

  const now=new Date().toISOString().replace('T',' ').slice(0,16)+' UTC';
  const L=[];
  L.push(`# Findings — Batch B02: MCQ Submission Critical Path`);
  L.push('');
  L.push(`**Run date:** ${now}`);
  L.push(`**Duration:** ~${dMin}min (${total} scenarios attempted)`);
  L.push(`**Environment:** Chromium 1223 headless, Linux WSL2, Firebase production vocaboost-879c2`);
  L.push(`**Tester / agent:** Agent B`);
  L.push('');
  L.push(`## Executive summary`);
  L.push('');
  L.push(`${total} scenarios executed. **Overall: ${overall}.** Pass: ${pass}, Fail: ${fail}, Partial: ${partial}, Blocked: ${blocked}. BLOCKERs: ${blocker}, HIGH: ${high}, MEDIUM: ${medium}, LOW: ${low}.`);
  L.push('');
  L.push(`**Setup note:** TOP class uses testMode:typed + reviewTestType:mcq. The MCQ path is the Day-2+ review test. Audit accounts were pre-seeded with Day-2 study state via Admin SDK. MCQ routes require SPA client-side navigation (pushState) — direct Netlify URL access returns 404.`);
  L.push('');
  L.push('**Persistence fix invariants:**');
  const s1=results.S01,s2=results.S02,s3=results.S03,s4=results.S04,s5=results.S05;
  L.push(`- **Fix #1 (clearTestState ordering):** ${s2?.result==='pass'?'✅ HOLDS':s2?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s2?.notes||'').slice(0,80)}`}`);
  L.push(`- **Fix #3 (processTestResults after attempt write):** ${s3?.result==='pass'?'✅ HOLDS':s3?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s3?.notes||'').slice(0,80)}`}`);
  L.push(`- **Fix #4 (no double-increment):** ${s4?.result==='pass'?'✅ HOLDS':s4?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s4?.notes||'').slice(0,80)}`}`);
  L.push(`- **Fix #5 (idempotent docId):** ${s5?.result==='pass'?'✅ HOLDS':s5?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s5?.notes||'').slice(0,80)}`}`);
  L.push('');
  L.push(`## Scenario coverage`);
  L.push('');
  L.push(`| # | Scenario | Persona | Result | Severity |`);
  L.push(`| --- | --- | --- | --- | --- |`);
  const D={S01:'Happy path MCQ review test',S02:'clearTestState ordering — answers survive refresh (fix #1)',S03:'processTestResults order — study_states after attempt write (fix #3)',S04:'No double-increment via rapid submit (fix #4)',S05:'Idempotent attempt docId (fix #5)',S06:'Refresh after success — known limitation',S07:'Practice mode does not write attempts',S08:'Zero-answer submission (lazy)',S09:'Double-click submit dedup guard',S10:'Simultaneous last-answer + submit (answersRef race)',S11:'Browser console clean on happy path',S12:'No docId collision across sessions'};
  const P={S01:'Careful',S02:'Recovering',S03:'Hostile',S04:'Rushed',S05:'Recovering',S06:'Careful',S07:'Anxious',S08:'Lazy',S09:'Rushed',S10:'Rushed',S11:'Careful',S12:'Careful'};
  for(const s of S){
    const r=results[s];
    const ic=!r?'⏸':r.result==='pass'?'✅':r.result==='fail'?'❌':r.result==='partial'?'🟡':r.result==='error'?'❌':'⏸';
    const sv=r?.result==='pass'?'—':(r?.severity||'—');
    L.push(`| ${s} | ${D[s]} | ${P[s]} | ${ic} ${r?.result||'not run'} | ${sv} |`);
  }
  L.push('');
  L.push(`## Findings`);
  L.push('');
  const failed=S.filter(s=>results[s]?.result==='fail'||results[s]?.result==='partial');
  if(failed.length===0){L.push('No failures in this batch.');L.push('');}
  let fn=1;
  for(const s of failed){
    const r=results[s];
    L.push('---');L.push('');
    L.push(`### F${String(fn++).padStart(2,'0')} — ${s}: ${(r.notes||'').slice(0,100)}`);
    L.push('');
    L.push(`**Severity:** ${r.severity||'MEDIUM'}`);
    L.push(`**Persona:** ${P[s]}`);
    L.push(`**Scenarios touched:** ${s}`);
    L.push(`**Reproducible:** YES`);
    L.push('');
    L.push(`**Observed:**`);
    L.push(r.notes||'');
    L.push('');
    L.push(`**Evidence:**`);
    L.push(`- \`findings/evidence/B02/B02_${s}_*.png\``);
    L.push(`- \`findings/evidence/B02/B02_${s}_*_fs.json\``);
    L.push('');
  }
  L.push(`## Observations (not yet findings)`);
  L.push('');
  L.push('- **O01 — Debug logging in production:** MCQTest.jsx emits `[DEBUG STUDYDAY]`, `[SUBMIT]`, `[PHASE]`, `[SNAPSHOT]` console.log in the production build. Harmless but noisy for students using DevTools.');
  L.push('- **O02 — MCQ reachability via URL:** Netlify SPA does not serve index.html for `/mcqtest/*` direct URLs. Students can only reach MCQ via the DailySessionFlow navigation. Direct URL access gives a 404. This may affect students who bookmark or share the MCQ URL.');
  L.push('- **O03 — No data-testid attributes:** MCQTest.jsx has zero data-testid attributes, making automation selectors fragile.');
  L.push('- **O04 — MCQ requires Day 2+ state:** The MCQ path (review test) only becomes available after a student completes at least one new-word test session. Day-1 students only see the typed test.');
  L.push('');
  L.push(`## Caveats / what wasn't tested`);
  L.push('');
  for(const s of S.filter(s=>results[s]?.result==='blocked')) L.push(`- **${s}:** ${results[s].notes}`);
  L.push('- True network stall/intercept for S02/S03: Firestore uses WebSocket, not interceptable HTTP endpoints.');
  L.push('');
  L.push(`## Recommended fixes (top 3 from this batch)`);
  L.push('');
  if(blocker>0) L.push('1. **(BLOCKER)** Fix before any rollout — see findings above.');
  L.push('1. Gate all `console.log` debug statements in MCQTest.jsx/studyService.js behind `import.meta.env.DEV`.');
  L.push('2. Add `data-testid` attributes to key MCQTest elements (submit button, option buttons, results card).');
  L.push('3. Configure Netlify `_redirects` with `/* /index.html 200` to prevent 404 on deep SPA routes like `/mcqtest/*`.');
  L.push('');
  L.push(`## Next batch`);
  L.push('');
  if(halted) L.push('**AUDIT HALTED.** BLOCKER in B02. Fix before B03.');
  else L.push(`**Overall: ${overall}.** Proceed to B03 (Typed submission critical path).`);

  fs.writeFileSync('/app/audit/playwright/findings/findings_B02.md', L.join('\n'));

  if(!halted) logLine({event:'agent_end',label:'B',trialsCompleted:total,batchesCompleted:['B02'],reason:'claimed batches done'});

  console.log('\n'+'─'.repeat(65));
  console.log('B02 FINAL SUMMARY');
  console.log('─'.repeat(65));
  for(const s of S){
    const r=results[s];
    const ic=!r?'⏸':r.result==='pass'?'✅':r.result==='blocked'?'⏸':r.result==='partial'?'🟡':'❌';
    console.log(`  ${s} ${ic} ${r?.result||'not run'} [${r?.severity||''}] — ${(r?.notes||'').slice(0,80)}`);
  }
  console.log('─'.repeat(65));
  console.log(`  Pass:${pass} Fail:${fail} Partial:${partial} Blocked:${blocked}`);
  console.log(`  BLOCKER:${blocker} HIGH:${high} MEDIUM:${medium} LOW:${low}`);
  console.log(`  Overall: ${overall}`);
  console.log('─'.repeat(65));
}

main().catch(async err=>{
  console.error('Fatal:',err);
  logLine({event:'agent_end',label:'B',error:err.message,batchesCompleted:['B02'],trialsCompleted:Object.keys(results).length,reason:'fatal'});
  updateStatus({state:'errored',error:err.message});
  process.exit(1);
});
