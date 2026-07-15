/**
 * READ-ONLY report (2026-07-13): every 26SM student who FINISHED a list (list-end) and should move to
 * the NEXT list in their class's sequence (Base->Ascent->Summit). Shows advanced vs needs-advance vs done.
 *   node scripts/cs/report-next-list.mjs > report.md
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const BASE='RmNNkuLPectBlBPiLbAJ', ASC='dVliNv0p9jqZYp9rfLpN', SUM='AObYOowhLoOOHx9wW2Sq';
const SIZE={[BASE]:1200,[ASC]:1600,[SUM]:800}; const ORDER=[BASE,ASC,SUM]; const LN={[BASE]:'Base Camp',[ASC]:'Ascent',[SUM]:'Summit'};
const classes=[]; (await db.collection('classes').get()).forEach(d=>{const c=d.data();if(/26SM/i.test(c.name||''))classes.push({id:d.id,name:c.name.replace('26SM ',''),asg:c.assignments||{},students:c.studentIds||[]});});

const rows=[]; const seen=new Set();
for(const c of classes){
  const assigned=ORDER.filter(l=>c.asg[l]);
  for(const uid of c.students){ if(seen.has(uid+c.id))continue; seen.add(uid+c.id);
    // which lists finished in this class
    const finished=[];
    for(const l of assigned){ const cp=await db.collection('users').doc(uid).collection('class_progress').doc(`${c.id}_${l}`).get(); if(cp.exists&&(cp.data().totalWordsIntroduced||0)>=SIZE[l]) finished.push(l); }
    if(!finished.length) continue;
    const highIdx=Math.max(...finished.map(l=>ORDER.indexOf(l)));
    const next=(highIdx+1<ORDER.length && assigned.includes(ORDER[highIdx+1]))?ORDER[highIdx+1]:null;
    const focus=(await db.collection('users').doc(uid).get()).data()?.settings?.primaryFocusListId;
    let u;try{u=await auth.getUser(uid);}catch{u={};}
    rows.push({name:u.displayName||'?',email:u.email||'?',cls:c.name,finished:finished.map(l=>LN[l]).join('+'),next:next?LN[next]:null,advanced:next?focus===next:null});
  }
}
const needs=rows.filter(r=>r.next&&!r.advanced);
const done=rows.filter(r=>r.next&&r.advanced);
const strand=rows.filter(r=>!r.next);
console.log(`# List-end finishers by class (26SM, ${new Date().toISOString().slice(0,10)})\n`);
console.log(`Finished ≥1 list: **${rows.length}**  ·  ⚠️ needs-advance: **${needs.length}**  ·  ✅ already-advanced: **${done.length}**  ·  🏁 finished-everything: **${strand.length}**`);
console.log(`\nLegend: ⚠️ = finished but not yet moved to next list · ✅ = already moved · 🏁 = finished all lists (no next; needs the fix/§5 terminal)\n`);
// group by class
const byCls={}; rows.forEach(r=>{(byCls[r.cls]=byCls[r.cls]||[]).push(r);});
for(const cls of Object.keys(byCls).sort()){
  const list=byCls[cls];
  const nAdv=list.filter(r=>r.next&&!r.advanced).length;
  console.log(`\n## ${cls}  —  ${list.length} finisher(s), ⚠️ ${nAdv} to move`);
  // order: needs-advance first, then advanced, then finished-everything
  const ordered=[...list.filter(r=>r.next&&!r.advanced), ...list.filter(r=>r.next&&r.advanced), ...list.filter(r=>!r.next)];
  for(const r of ordered){
    const mark=!r.next?'🏁':(r.advanced?'✅':'⚠️');
    const nextTxt=r.next?`${r.finished} → **${r.next}**`:`finished ${r.finished} (no next list)`;
    console.log(`- ${mark} ${r.name} · ${r.email} · ${nextTxt}`);
  }
}
process.exit(0);
