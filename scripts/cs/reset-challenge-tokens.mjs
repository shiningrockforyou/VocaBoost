/**
 * CS-2026-07-15: reset challenge tokens to 5 for 26SM students who have active rejections
 * (tokens < 5). Method: backdate `replenishAt` to the past on each ACTIVE rejected
 * `challenges.history` entry → getAvailableChallengeTokens = max(0, 5 - activeRejections) = 5.
 * History preserved (audit trail kept); no fabricated entries. Client + server both recompute
 * from this array (no HMAC), so the write is honored end-to-end.
 *   node scripts/cs/reset-challenge-tokens.mjs [classRegex=26SM] [--commit]
 * Optional: pass one or more emails instead of scanning the whole cohort.
 */
import admin from 'firebase-admin'; import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db=admin.firestore(); const auth=admin.auth(); const T=admin.firestore.Timestamp;
const COMMIT=process.argv.includes('--commit');
const emails=process.argv.slice(2).filter(a=>a.includes('@'));
const filter=new RegExp(process.argv.slice(2).find(a=>!a.startsWith('--')&&!a.includes('@'))||'26SM','i');
const now=Date.now();

// resolve target uids
let uids=[];
if(emails.length){ for(const e of emails){ try{uids.push((await auth.getUserByEmail(e)).uid);}catch{console.log(`${e}: NOT FOUND`);} } }
else {
  const cs=await db.collection('classes').get();
  const s=new Set(); cs.forEach(d=>{if(filter.test(d.data().name||''))(d.data().studentIds||[]).forEach(u=>s.add(u));});
  uids=[...s];
}
console.log(`scanning ${uids.length} students (${emails.length?'by email':filter.source})\n`);

const toReset=[]; let scanned=0, hadHistory=0;
for(const uid of uids){ scanned++;
  let u; try{u=(await db.collection('users').doc(uid).get()).data();}catch{continue;}
  const hist=u?.challenges?.history||[]; if(hist.length)hadHistory++;
  const activeRej=hist.filter(h=>h.status==='rejected' && (h.replenishAt?.toMillis?.()??0)>now);
  if(activeRej.length===0) continue; // already 5
  const tokensBefore=Math.max(0,5-activeRej.length);
  const newHist=hist.map(h=> (h.status==='rejected' && (h.replenishAt?.toMillis?.()??0)>now)
    ? {...h, replenishAt: T.fromMillis(now-1000), tokenResetAt: T.fromMillis(now), tokenResetNote:'CS-2026-07-15 blanket reset to 5'}
    : h);
  toReset.push({uid, email:u.email, name:u.profile?.displayName, before:tokensBefore, activeRej:activeRej.length, newHist});
}
toReset.sort((a,b)=>a.before-b.before);
console.log(`scanned ${scanned} | had challenge history: ${hadHistory} | BELOW 5 tokens (to reset): ${toReset.length}\n`);
for(const r of toReset) console.log(`  ${String(r.name||'?').padEnd(12)} ${String(r.email).padEnd(30)} tokens ${r.before}→5  (${r.activeRej} active rejections)`);

if(COMMIT){
  let done=0;
  for(const r of toReset){ await db.collection('users').doc(r.uid).update({'challenges.history': r.newHist}); done++; }
  console.log(`\n✅ reset ${done} students to 5 tokens`);
} else console.log(`\n[DRY RUN — add --commit]`);
process.exit(0);
