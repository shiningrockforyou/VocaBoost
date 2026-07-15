/**
 * DEEPFIX F-1 — attribute impossible_phase_detected + day_guard_rejected_session_cleared. READ-ONLY.
 * Question: real 26SM students (emitter fires in prod) vs 07-12 fleet-audit sandbox (lsr / 25WT)?
 * Emitters: impossible_phase_detected = studyService.js:105-114 (dayNumber===1 && newTest.passed → #12 signature).
 *           day_guard_rejected_session_cleared = studyService.js:638.
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/deepfix-f1-syslog-attribution.mjs
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const OUT = '/app/audit/deepfix/task1/firebase';

// rosters
const cs = await db.collection('classes').get();
const roster26 = new Set(), rosterSandbox = new Set(), classNameByStudent = {};
cs.forEach(d => { const c=d.data(); const is26=/26SM/i.test(c.name||''); const isSb=/25WT/i.test(c.name||'');
  (c.studentIds||[]).forEach(u => { if(is26){roster26.add(u); classNameByStudent[u]=c.name;} if(isSb)rosterSandbox.add(u); }); });
console.log(`rosters: 26SM=${roster26.size} sandbox(25WT)=${rosterSandbox.size}`);

const getUid = (x) => x.userId||x.uid||x.studentId||(x.details&&(x.details.userId||x.details.uid))||null;
const attribute = (u) => !u ? 'no-uid' : roster26.has(u) ? '26SM' : rosterSandbox.has(u) ? 'sandbox' : 'other';

// single timestamp-ordered pull (avoids composite index), bucket both types in code
const PULL = 16000;
console.log(`pulling most-recent ${PULL} system_logs (timestamp-ordered)...`);
const snap = await db.collection('system_logs').orderBy('timestamp','desc').limit(PULL).get();
const acc = {}; // type -> aggregation
// class id list for parsing newTestId → attribution
const class26Ids = new Set(), classSbIds = new Set(), classNameById = {};
cs.forEach(d=>{const c=d.data(); classNameById[d.id]=c.name; if(/26SM/i.test(c.name||''))class26Ids.add(d.id); if(/25WT/i.test(c.name||''))classSbIds.add(d.id);});
function attrTestId(tid){ if(!tid) return {attr:'no-tid',cls:null}; for(const cid of class26Ids) if(tid.includes(cid)) return {attr:'26SM',cls:classNameById[cid]}; for(const cid of classSbIds) if(tid.includes(cid)) return {attr:'sandbox',cls:classNameById[cid]}; return {attr:'other',cls:null}; }
function ensure(t){ return acc[t] || (acc[t]={ type:t, total:0, byAttrUsers:{'26SM':new Set(),sandbox:new Set(),other:new Set(),'no-uid':new Set()}, evByAttr:{'26SM':0,sandbox:0,other:0,'no-uid':0}, byDay:{}, perUser:{}, oldest:null, newest:null, sampleKeys:null, distinctTestIds:new Set(), perTestId:{}, tidAttr:{'26SM':new Set(),sandbox:new Set(),other:new Set(),'no-tid':new Set()} }); }
const WANT = new Set(['impossible_phase_detected','day_guard_rejected_session_cleared']);
let overallOldest=null, overallNewest=null;
snap.forEach(d=>{ const x=d.data(); const t=x.timestamp?._seconds||0;
  if(t){ if(!overallNewest||t>overallNewest)overallNewest=t; if(!overallOldest||t<overallOldest)overallOldest=t; }
  const ty=x.type; if(!WANT.has(ty)) return;
  const r=ensure(ty); r.total++; if(!r.sampleKeys)r.sampleKeys=Object.keys(x);
  const u=getUid(x); const a=attribute(u); r.byAttrUsers[a].add(u||d.id); r.evByAttr[a]++; if(u)r.perUser[u]=(r.perUser[u]||0)+1;
  if(x.newTestId){ r.distinctTestIds.add(x.newTestId); r.perTestId[x.newTestId]=(r.perTestId[x.newTestId]||0)+1; const ta=attrTestId(x.newTestId); r.tidAttr[ta.attr].add(x.newTestId); }
  if(t){const day=new Date(t*1000).toISOString().slice(0,10); r.byDay[`${day}|${a}`]=(r.byDay[`${day}|${a}`]||0)+1; if(!r.newest||t>r.newest)r.newest=t; if(!r.oldest||t<r.oldest)r.oldest=t;} });
console.log(`pulled ${snap.size}; overall window ${overallOldest?new Date(overallOldest*1000).toISOString():'?'} → ${overallNewest?new Date(overallNewest*1000).toISOString():'?'}`);
function finalize(r){ if(!r) return {type:'(none seen)',total:0};
  return { type:r.type, total:r.total, window:{from:r.oldest?new Date(r.oldest*1000).toISOString():null,to:r.newest?new Date(r.newest*1000).toISOString():null},
    sampleKeys:r.sampleKeys, distinctUsersByAttr:Object.fromEntries(Object.entries(r.byAttrUsers).map(([k,v])=>[k,v.size])),
    eventsByAttr:r.evByAttr, byDay:r.byDay,
    distinctTestIds:r.distinctTestIds.size, tidByAttr:Object.fromEntries(Object.entries(r.tidAttr).map(([k,v])=>[k,v.size])),
    sampleTestIds:[...r.distinctTestIds].slice(0,4),
    topTestIds:Object.entries(r.perTestId).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t,n])=>({tid:t.slice(0,42),attr:attrTestId(t).attr,cls:(attrTestId(t).cls||'').replace('26SM ',''),events:n})),
    topUsers:Object.entries(r.perUser).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([u,n])=>({uid:u.slice(0,8),attr:attribute(u),cls:(classNameByStudent[u]||'').replace('26SM ',''),events:n})) }; }
const r1 = finalize(acc['impossible_phase_detected']);
const r2 = finalize(acc['day_guard_rejected_session_cleared']);
writeFileSync(`${OUT}/scan_F1_syslog_attribution.json`, JSON.stringify({r1,r2},null,2));

for (const r of [r1,r2]) {
  console.log(`\n===== ${r.type} (pulled ${r.total}, ${r.window.from?.slice(0,10)}→${r.window.to?.slice(0,10)}) =====`);
  console.log(`  sample fields: ${r.sampleKeys?.join(',')}`);
  console.log(`  DISTINCT USERS by attribution:`, JSON.stringify(r.distinctUsersByAttr));
  console.log(`  EVENTS by attribution:`, JSON.stringify(r.eventsByAttr));
  console.log(`  top offenders (uid/attr/class/events):`);
  r.topUsers.forEach(u=>console.log(`     ${u.uid} ${u.attr.padEnd(7)} ${(u.cls||'').padEnd(16)} ${u.events} events`));
  console.log(`  by day|attr:`, JSON.stringify(Object.fromEntries(Object.entries(r.byDay).sort())));
}
console.log('\nwrote scan_F1_syslog_attribution.json');
process.exit(0);
