import { chromium } from '@playwright/test';
const EP='/ms-playwright/chromium-1223/chrome-linux64/chrome';
const SITE='https://vocaboostone.netlify.app';
const EMAIL='ta@vocaboost.com', PASS='VocaTA2026!';
const b=await chromium.launch({headless:true,executablePath:EP});
const out=[];
try{
 const ctx=await b.newContext();const p=await ctx.newPage();
 const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))});
 await p.goto(SITE+'/',{waitUntil:'domcontentloaded',timeout:30000});
 await p.waitForSelector('input[type="email"]',{timeout:15000});
 await p.fill('input[type="email"]',EMAIL);
 await p.fill('input[type="password"]',PASS);
 await p.keyboard.press('Enter');
 // wait for post-login (dashboard) — look for Gradebook nav or logo
 await p.waitForTimeout(6000);
 const url=p.url();
 const bodyText=await p.evaluate(()=>document.body.innerText.slice(0,400));
 out.push('URL after login: '+url);
 out.push('LOGGED IN: '+(!bodyText.toLowerCase().includes('continue')||url!==SITE+'/'?'likely yes':'maybe'));
 // Navigate to teacher gradebook to list classes
 await p.goto(SITE+'/teacher/gradebook',{waitUntil:'domcontentloaded',timeout:30000});
 await p.waitForTimeout(5000);
 const gbText=await p.evaluate(()=>document.body.innerText);
 const has25=(gbText.match(/25WT/g)||[]).length;
 const has26=(gbText.match(/26SM/g)||[]).length;
 out.push('Gradebook: 25WT mentions='+has25+'  26SM mentions='+has26);
 out.push(has26===0?'✓ NO 26SM visible in ta@ gradebook':'⚠️ 26SM VISIBLE — STOP');
 await p.screenshot({path:'/tmp/preflight_gradebook.png',fullPage:true});
 out.push('console errors: '+(errs.length?errs.slice(0,5).join(' | '):'none'));
}catch(e){out.push('ERROR: '+e.message);}
finally{await b.close();}
import fs from 'fs';fs.writeFileSync('/tmp/preflight.txt',out.join('\n')+'\n');
console.log(out.join('\n'));
