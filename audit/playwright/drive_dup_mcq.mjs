import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import * as FB from './lsr_deepfix_fb.mjs'; FB.db();
const UI = await import('./lsr_ui.mjs');
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json','utf8')).password;
const BASE='https://vocaboostone.netlify.app', DIR='/tmp/claude-1000/-app/c538be35-2cb4-4a2d-92df-470756b8f906/scratchpad';
const EMAIL=process.argv[2]||'dup_dup1_a@vocaboost.test', CLS='DUP_dup1_6F0PX2E3gXetiI0Yw275', LST='dVliNv0p9jqZYp9rfLpN';
const uid=await FB.uidByEmail(EMAIL);
await FB.db().collection('users').doc(uid).set({settings:{primaryFocusClassId:CLS,primaryFocusListId:LST}},{merge:true});
const pre=await FB.readProgress(uid,CLS,LST); const preAtt=(await FB.readAttempts(uid,CLS,LST)).reviewAttempts;
console.log('PRE csd='+pre.csd+' reviewAtt='+preAtt);
const b=await chromium.launch({headless:true}); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const T=ms=>p.waitForTimeout(ms); const body=()=>p.locator('body').innerText().catch(()=>'');
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'}); await p.fill('input[type="email"]',EMAIL); await p.fill('input[type="password"]',PASS); await p.click('button[type="submit"]'); await T(5000);
const start=p.getByRole('button',{name:/Start Session/i}).first(); if(await start.isVisible().catch(()=>false)){await start.click();await T(4000);}
await UI.skipToTest(p,{add:()=>{}},'mcq').catch(()=>{}); await T(2500);
let submitted=false, lastAns=-1, stall=0;
for(let i=0;i<90;i++){
  const sub=p.getByRole('button',{name:/Submit Test/i}).first();
  const st=await sub.innerText().catch(()=>''); const m=st.match(/(\d+)\s*\/\s*(\d+)/); const ans=m?+m[1]:0, tot=m?+m[2]:30;
  if(ans===lastAns){stall++;}else{stall=0;lastAns=ans;}
  if(ans>=tot||stall>6){ if(await sub.isVisible().catch(()=>false)){await sub.click().catch(()=>{});await T(1500);
      const c=p.getByRole('button',{name:/^(Submit Test|Submit|Yes|Confirm|Submit Anyway)$/i}).last(); if(await c.isVisible().catch(()=>false))await c.click().catch(()=>{});
      submitted=true; console.log('SUBMITTED at '+ans+'/'+tot); await T(7000); break; } }
  const opt=p.locator('button[class*="min-h-"]').first(); // the answer-choice cards
  if(await opt.isVisible().catch(()=>false)){await opt.click().catch(()=>{});await T(500);}
  if(/Day \d+ Complete|Session Summary|Your score|Great Job/i.test(await body())){console.log('RESULTS at i'+i);break;}
}
await T(6000); await p.screenshot({path:`${DIR}/mcq_done.png`,fullPage:true}).catch(()=>{});
console.log('FINAL:',(await body()).replace(/\s+/g,' ').slice(0,180));
await b.close();
const post=await FB.readProgress(uid,CLS,LST); const postAtt=(await FB.readAttempts(uid,CLS,LST)).reviewAttempts;
console.log('POST csd='+post.csd+' reviewAtt='+postAtt+' submitted='+submitted);
console.log(post.csd>pre.csd&&postAtt>preAtt ? ('✅✅ #11 RECORDING CONFIRMED — csd '+pre.csd+'→'+post.csd+', reviewAtt '+preAtt+'→'+postAtt+' on REAL stuck data'):('csd '+pre.csd+'→'+post.csd+' reviewAtt '+preAtt+'→'+postAtt));
process.exit(0);
