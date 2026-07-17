import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import * as FB from './lsr_deepfix_fb.mjs'; FB.db();
const PASS = JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json','utf8')).password;
const BASE='https://vocaboostone.netlify.app', DIR='/tmp/claude-1000/-app/c538be35-2cb4-4a2d-92df-470756b8f906/scratchpad';
const EMAIL='lsr_s201@vocaboost.test';
const uid=await FB.uidByEmail(EMAIL);
const u=(await FB.db().collection('users').doc(uid).get()).data();
const clsId=Object.keys(u.enrolledClasses||{}).find(k=>/THR-C/i.test(u.enrolledClasses[k]?.name||''))||Object.keys(u.enrolledClasses||{})[0];
const listId=u.settings?.primaryFocusListId; 
console.log('class:',clsId,'list:',listId);
// re-seed a fresh HARD-THROTTLE state (3 zero reviews → interv 1.0, mid-list) using the helper
const twi=640; const wordIds=await FB.getListWordIds(listId,{limit:twi});
await FB.seedThrottlePersona({email:EMAIL,uid,classId:clsId,listId,csd:8,twi,interventionLevel:1.0,recentSessions:[{reviewScore:0},{reviewScore:0},{reviewScore:0}],wordIds,masteredFrac:0.15});
console.log('re-seeded throttled. interv should compute to 1.0 (3 zeros).');
const b=await chromium.launch({headless:true}); const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const T=ms=>p.waitForTimeout(ms);
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'}); await p.fill('input[type="email"]',EMAIL); await p.fill('input[type="password"]',PASS); await p.click('button[type="submit"]'); await T(6000);
await p.reload({waitUntil:'domcontentloaded'}).catch(()=>{}); await T(2500);
await p.screenshot({path:`${DIR}/throttle_dash.png`,fullPage:true}).catch(()=>{});
const body=(await p.locator('body').innerText().catch(()=>'')).replace(/\s+/g,' ');
console.log('DASH TEXT:', body.slice(0,700));
// candidate signals
console.log('newWords regex match:', await p.getByRole('button',{name:/start new words|learn \d+ new/i}).first().isVisible({timeout:1500}).catch(()=>false));
const nwCount=body.match(/(\d+)\s*new words?/i); console.log('"N new words" text:', nwCount?nwCount[0]:'(none)');
console.log('has "Review only"/"review to lock":', /review only|review to lock|0 new/i.test(body));
await b.close(); process.exit(0);
