/**
 * DEEPFIX F-6 — challenge-token + permanent-fail census. READ-ONLY. No writes.
 * tokens = max(0, 5 - activeRejections) where activeRejection = status==='rejected' && replenishAt>now (db.js:179-185).
 * permanent-fail candidate = LOCKED (0 tokens) AND >=3 failed 'new' attempts on the SAME day+list (last 14d).
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/deepfix-f6-tokens.mjs [regex=26SM]
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const OUT='/app/audit/deepfix/task1/firebase';
const short=u=>(u||'').slice(0,8);
const NOW=Math.floor(Date.now()/1000), CUT14=NOW-14*86400;

const cs=await db.collection('classes').get();
const roster=new Set(); const clsName={};
cs.forEach(d=>{const c=d.data(); if(filter.test(c.name||'')) (c.studentIds||[]).forEach(u=>{roster.add(u); if(!clsName[u])clsName[u]=c.name;});});
console.log(`roster=${roster.size}`);

function toSec(v){ if(!v)return 0; if(typeof v==='number')return v>1e12?Math.floor(v/1000):v; if(v._seconds)return v._seconds; if(v.toMillis)return Math.floor(v.toMillis()/1000); return 0; }

const rows=[]; const statusTotals={accepted:0,rejected:0,pending:0,other:0};
let scanned=0, withHistory=0, locked=0, permafail=0, err=0;
for(const uid of roster){ scanned++; if(scanned%150===0)console.error(`  ...${scanned}/${roster.size}`);
 try{
  const u=(await db.collection('users').doc(uid).get()).data()||{};
  const hist=u.challenges?.history || u.challengeHistory || [];
  if(hist.length) withHistory++;
  const byStatus={accepted:0,rejected:0,pending:0,other:0};
  let activeRej=0;
  hist.forEach(h=>{ const s=h.status||'other'; if(byStatus[s]!==undefined)byStatus[s]++; else byStatus.other++;
    statusTotals[s]!==undefined?statusTotals[s]++:statusTotals.other++;
    if(s==='rejected' && toSec(h.replenishAt)>NOW) activeRej++; });
  const tokens=Math.max(0,5-activeRej);
  // failed-new streaks (last 14d)
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  const failedNew=at.filter(a=>a.sessionType==='new' && a.passed!==true && toSec(a.submittedAt)>=CUT14);
  const byDL={}; failedNew.forEach(a=>{const k=`${a.listId}|${a.studyDay}`; byDL[k]=(byDL[k]||0)+1;});
  const maxStreak=Object.values(byDL).length?Math.max(...Object.values(byDL)):0;
  const isLocked=tokens===0; if(isLocked)locked++;
  const isPermafail=isLocked && maxStreak>=3;
  if(isPermafail){ permafail++;
    const worstDL=Object.entries(byDL).sort((a,b)=>b[1]-a[1])[0];
    rows.push({uid:short(uid), cls:(clsName[uid]||'').replace('26SM ',''), tokens, activeRej, byStatus, maxFailedNewStreak:maxStreak, worst:worstDL?.[0], recentFailedNew:failedNew.length}); }
 }catch(e){err++; if(err<=5)console.error(`  ERR ${short(uid)}: ${e.message}`);}
}
writeFileSync(`${OUT}/scan_F6_tokens_permafail.json`, JSON.stringify({permafail:rows, statusTotals, counts:{scanned,withHistory,locked,permafail}},null,2));
console.log(`\nscanned=${scanned} withChallengeHistory=${withHistory} err=${err}`);
console.log(`challenge status totals (all history): ${JSON.stringify(statusTotals)}`);
console.log(`LOCKED (0 tokens): ${locked}`);
console.log(`PERMANENT-FAIL CANDIDATES (locked + >=3 failed-new same day/list, 14d): ${permafail}`);
rows.sort((a,b)=>b.maxFailedNewStreak-a.maxFailedNewStreak).forEach(r=>console.log(`   ${r.uid} ${(r.cls||'').padEnd(16)} tokens=${r.tokens} activeRej=${r.activeRej} maxStreak=${r.maxFailedNewStreak} (${r.worst})`));
console.log('\nwrote scan_F6_tokens_permafail.json');
process.exit(0);
