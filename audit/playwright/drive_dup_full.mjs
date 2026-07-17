import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import * as FB from './lsr_deepfix_fb.mjs'; FB.db();
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json','utf8')).password;
const BASE='https://vocaboostone.netlify.app', DIR='/tmp/claude-1000/-app/c538be35-2cb4-4a2d-92df-470756b8f906/scratchpad';
const EMAIL='dup_dup1_a@vocaboost.test', CLS='DUP_dup1_6F0PX2E3gXetiI0Yw275', LST='dVliNv0p9jqZYp9rfLpN';
const uid=await FB.uidByEmail(EMAIL);
const pre=await FB.readProgress(uid,CLS,LST); console.log('PRE  csd='+pre.csd+' twi='+pre.twi);
const b=await chromium.launch({headless:true}); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const T=async(ms)=>p.waitForTimeout(ms); const txt=async()=>(await p.locator('body').innerText().catch(()=>'')).replace(/\s+/g,' ');
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'}); await p.fill('input[type="email"]',EMAIL); await p.fill('input[type="password"]',PASS); await p.click('button[type="submit"]'); await T(5000);
const start=p.getByRole('button',{name:/Start Session/i}).first(); if(await start.isVisible().catch(()=>false)){await start.click();await T(4000);}
// advance through review-study + review-test, best-effort, up to 140 steps
let phase='study';
for(let i=0;i<140;i++){
  const body=await txt();
  // MCQ review test: click an answer option, then Next/Submit
  const opts=p.locator('button').filter({hasText:/^[A-D][\).]|^[①-④]/}).or(p.locator('[class*="option"] button, button[class*="option"]'));
  const radios=p.getByRole('radio');
  if(/Review Test|Question \d|of \d+ answered|select the correct/i.test(body)){ phase='test';
    if(await radios.count().catch(()=>0)>0){ await radios.first().click().catch(()=>{}); }
    else { const anyOpt=p.locator('button').filter({hasText:/\p{L}{3,}/u}); }
  }
  // click the most-likely advance/answer control
  for(const rx of [/^Submit( Test| Answers)?$/i,/^(Next|Continue|Got it|I knew it|Mark.*mastered|Easy|Good|Show Answer|Check|Done)$/i,/Start (Review|Test)/i]){
    const btn=p.getByRole('button',{name:rx}).first();
    if(await btn.isVisible().catch(()=>false) && await btn.isEnabled().catch(()=>false)){ await btn.click().catch(()=>{}); await T(700); break; }
  }
  if(/Day \d+ Complete|Great Job|Session Summary|Back to Dashboard|자세히/i.test(body)){ console.log('REACHED COMPLETION at step '+i); break; }
  await T(400);
}
await p.screenshot({path:`${DIR}/dup_final.png`,fullPage:true}).catch(()=>{});
console.log('FINAL SCREEN:', (await txt()).slice(0,400));
await T(3500); await b.close();
const post=await FB.readProgress(uid,CLS,LST); console.log('POST csd='+post.csd+' twi='+post.twi);
console.log(post.csd>pre.csd ? ('✅ #11 UNSTUCK — csd '+pre.csd+'→'+post.csd) : ('csd unchanged '+pre.csd+'→'+post.csd));
process.exit(0);
