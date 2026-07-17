import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json','utf8')).password;
const BASE='https://vocaboostone.netlify.app', DIR='/tmp/claude-1000/-app/c538be35-2cb4-4a2d-92df-470756b8f906/scratchpad';
const b=await chromium.launch({headless:true}); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const logs=[]; p.on('console',m=>{if(m.type()==='error')logs.push(m.text().slice(0,160));});
const shot=async(n)=>{await p.screenshot({path:`${DIR}/dup_${n}.png`,fullPage:true}).catch(()=>{});};
const vis=async(re)=>await p.getByText(re).first().isVisible({timeout:1500}).catch(()=>false);
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
await p.fill('input[type="email"]','dup_dup1_a@vocaboost.test'); await p.fill('input[type="password"]',PASS);
await p.click('button[type="submit"]'); await p.waitForTimeout(5000);
await shot('1_dashboard'); console.log('URL after login:', p.url());
console.log('DASH:', (await p.locator('body').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,500));
for (const label of [/Start Session/i,/Continue/i,/Start New Words/i,/Review/i,/Study/i]) {
  const btn=p.getByRole('button',{name:label}).first();
  if (await btn.isVisible().catch(()=>false)) { console.log('CLICKED:', String(label)); await btn.click().catch(()=>{}); await p.waitForTimeout(5000); break; }
}
await shot('2_after_start'); console.log('URL after start:', p.url());
console.log('SCREEN:', (await p.locator('body').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,700));
console.log('WALL:', await vis(/pass the new-word test first|먼저 새 단어|new-word test first|단어 시험/i));
console.log('DAY_COMPLETE:', await vis(/Day \d+ Complete|Great Job|Session Summary|Back to Dashboard/i));
console.log('REVIEW_TEST:', await vis(/Review Test|Question \d|Type the definition|definition|뜻/i));
console.log('ERRORS:', JSON.stringify(logs.slice(0,5)));
await b.close();
