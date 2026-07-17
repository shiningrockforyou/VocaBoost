import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import * as FB from './lsr_deepfix_fb.mjs'; FB.db();
const UI = await import('./lsr_ui.mjs');
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json','utf8')).password;
const BASE='https://vocaboostone.netlify.app';
const EMAIL='dup_dup1_d@vocaboost.test', CLS='DUP_dup1_6F0PX2E3gXetiI0Yw275', LST='dVliNv0p9jqZYp9rfLpN';
const uid=await FB.uidByEmail(EMAIL);
await FB.db().collection('users').doc(uid).set({settings:{primaryFocusClassId:CLS,primaryFocusListId:LST}},{merge:true});
const b=await chromium.launch({headless:true}); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const T=ms=>p.waitForTimeout(ms);
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'}); await p.fill('input[type="email"]',EMAIL); await p.fill('input[type="password"]',PASS); await p.click('button[type="submit"]'); await T(5000);
const start=p.getByRole('button',{name:/Start Session/i}).first(); if(await start.isVisible().catch(()=>false)){await start.click();await T(4000);}
await UI.skipToTest(p,{add:()=>{}},'diag').catch(()=>{}); await T(2500);
// dump the interactive DOM on the MCQ test
const dump=await p.evaluate(()=>{
  const q=[...document.querySelectorAll('button, [role=button], [role=radio], input')].slice(0,40).map(el=>({
    tag:el.tagName, role:el.getAttribute('role'), type:el.type||'', txt:(el.innerText||el.value||'').replace(/\s+/g,' ').slice(0,45),
    cls:(el.className||'').toString().slice(0,50), vis:!!(el.offsetParent)
  })).filter(x=>x.vis);
  const prog=[...document.querySelectorAll('*')].map(e=>e.innerText||'').find(t=>/of \d+ answered/.test(t||''))||'';
  return {progress:prog.replace(/\s+/g,' ').slice(0,40), buttons:q};
});
console.log('PROGRESS:', dump.progress);
console.log('VISIBLE INTERACTIVE ELEMENTS:');
dump.buttons.forEach((x,i)=>console.log(`  [${i}] ${x.tag}${x.role?'/'+x.role:''} vis=${x.vis} "${x.txt}" cls="${x.cls}"`));
await b.close(); process.exit(0);
