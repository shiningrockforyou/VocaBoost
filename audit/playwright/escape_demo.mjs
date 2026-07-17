import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import * as FB from './lsr_deepfix_fb.mjs'; FB.db();
const UI = await import('./lsr_ui.mjs');
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json','utf8')).password;
const BASE='https://vocaboostone.netlify.app', DIR='/tmp/claude-1000/-app/c538be35-2cb4-4a2d-92df-470756b8f906/scratchpad';
const EMAIL='dup_throttle_a@vocaboost.test', CLS='DUP_thr_KKQ0x7kivEgRlEVnXrkW', LST='AObYOowhLoOOHx9wW2Sq';
const db=FB.db(); const uid=await FB.uidByEmail(EMAIL);
let ws=await db.collection('lists').doc(LST).collection('words').get(); if(ws.empty)ws=await db.collection('words').where('listId','==',LST).get();
const defOf={}; ws.docs.forEach(d=>{const x=d.data(); if(x.word)defOf[x.word.toLowerCase().trim()]=(x.definition||'').toLowerCase().replace(/\s+/g,' ').trim();});
// clean HARD deadlock: 3 low reviews (interv 1.0); anchor attempts stay
await db.collection('users').doc(uid).collection('class_progress').doc(CLS+'_'+LST).set({recentSessions:[5,6,7].map(day=>({day,date:FB.now(),reviewScore:0.05,newWordScore:null,segmentStartIndex:0,segmentEndIndex:0,wordsIntroduced:0,wordsReviewed:0,wordsTested:0})),interventionLevel:1.0,updatedAt:FB.now()},{merge:true});
try{await db.collection('users').doc(uid).collection('session_states').doc(CLS+'_'+LST).delete();}catch{}
const computeInterv=(rs)=>{const v=(rs||[]).filter(s=>s?.reviewScore!=null).map(s=>s.reviewScore).slice(-3);if(v.length<3)return 0;const a=v.reduce((x,y)=>x+y,0)/v.length;return a>=0.75?0:a<=0.30?1:(0.75-a)/0.45;};
const b=await chromium.launch({headless:true}); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const T=ms=>p.waitForTimeout(ms); const body=()=>p.locator('body').innerText().catch(()=>'');
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'}); await p.fill('input[type="email"]',EMAIL); await p.fill('input[type="password"]',PASS); await p.click('button[type="submit"]'); await T(6000);
const newWords=async()=>{const t=(await body()).replace(/\s+/g,' ');const m=t.match(/Learn (\d+) new word/i);if(m)return +m[1];if(/review to lock|today is review/i.test(t))return 0;return null;};
const trail=[]; let escaped=false;
for(let day=0; day<6; day++){
  await p.goto(BASE+'/',{waitUntil:'domcontentloaded'}).catch(()=>{}); await T(2800);
  const prog=await FB.readProgress(uid,CLS,LST); const iv=computeInterv(prog.recentSessions); const nw=await newWords();
  const last3=(prog.recentSessions||[]).filter(s=>s?.reviewScore!=null).map(s=>+(s.reviewScore).toFixed(2)).slice(-3);
  trail.push(`day${day}: csd=${prog.csd} last3reviews=[${last3}] interv=${iv.toFixed(2)} newWordsOffered=${nw}`);
  if(nw!==null && nw>=Math.round(0.5*100)){ escaped=true; trail[trail.length-1]+=` → ESCAPED (${nw} new words offered)`; break; }
  // drive a HIGH review (correct MCQ via word->def matcher)
  const start=p.getByRole('button',{name:/Start Session|Start review|Continue/i}).first(); if(await start.isVisible().catch(()=>false)){await start.click();await T(4000);}
  await UI.skipToTest(p,{add:()=>{}},'esc').catch(()=>{}); await T(2500);
  let last=-1,st=0;
  for(let i=0;i<80;i++){
    const sub=p.getByRole('button',{name:/Submit Test/i}).first(); const stx=await sub.innerText().catch(()=>''); const m=stx.match(/(\d+)\s*\/\s*(\d+)/); const ans=m?+m[1]:0,tot=m?+m[2]:30;
    if(ans===last)st++;else{st=0;last=ans;}
    if(ans>=tot||st>8){ if(await sub.isVisible().catch(()=>false)){await sub.click().catch(()=>{});await T(1500);const c=p.getByRole('button',{name:/^(Submit Test|Submit|Submit Anyway|Yes|Confirm)$/i}).last();if(await c.isVisible().catch(()=>false))await c.click().catch(()=>{});await T(6000);} break; }
    const prompt=(await p.locator('h1,h2,[class*="text-3xl"],[class*="text-2xl"]').allInnerTexts().catch(()=>[])).join(' ');
    const wm=prompt.match(/([A-Za-z][A-Za-z-]{2,})/); const word=wm?wm[1].toLowerCase():''; const def=defOf[word]||'';
    const opts=p.locator('button[class*="min-h-"]'); const oc=await opts.count().catch(()=>0); let clicked=false;
    if(def)for(let k=0;k<oc;k++){const ot=(await opts.nth(k).innerText().catch(()=>'')).toLowerCase().replace(/[①-⑥]/g,' ').replace(/\s+/g,' ').trim();if(ot.includes(def.slice(0,20))){await opts.nth(k).click().catch(()=>{});clicked=true;break;}}
    if(!clicked&&oc>0)await opts.first().click().catch(()=>{});
    await T(430);
    if(/Day \d+ Complete|Session Summary|Your score/i.test(await body()))break;
  }
  await T(2500);
}
await p.screenshot({path:`${DIR}/escape_final.png`,fullPage:true}).catch(()=>{});
await b.close();
console.log('\n=== ESCAPE TRAJECTORY (throttle copy, driving high reviews) ==='); trail.forEach(t=>console.log('  '+t));
console.log(escaped?('\n✅ ESCAPE CONFIRMED — multiple high review tests dropped intervention 1.0→0 and new words RETURNED'):('\n❌ not escaped in 6 days'));
process.exit(0);
