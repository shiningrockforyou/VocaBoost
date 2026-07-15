/**
 * CS-2026-07-13e: ensure EVERY 26SM class has all 3 lists (Base Camp, Ascent, Summit) assigned.
 * Missing lists are added with props MIRRORED from an existing assignment in that class, and a
 * BACKDATED assignedAt (older than all existing) so the "newest-assigned" default-focus fallback
 * never picks them → NO student is bumped (per CS-2026-06-28b). Backs up each class first.
 * Config-only: NO student progress touched.
 *   node scripts/cs/ensure-all-lists.mjs            # DRY (plan + backups written)
 *   node scripts/cs/ensure-all-lists.mjs --commit   # WRITE
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const COMMIT = process.argv.includes('--commit');
const BASE='RmNNkuLPectBlBPiLbAJ', ASC='dVliNv0p9jqZYp9rfLpN', SUM='AObYOowhLoOOHx9wW2Sq';
const ALL=[BASE,ASC,SUM]; const LN={[BASE]:'Base',[ASC]:'Asc',[SUM]:'Sum'};
const PROPS=['pace','testOptionsCount','testMode','passThreshold','testSizeNew','reviewTestType','reviewTestSizeMin','reviewTestSizeMax','newWordRetakeThreshold','studyDaysPerWeek','reviewMode'];
const BKDIR='/app/dsg-edits/srv_validate/class_backups'; mkdirSync(BKDIR,{recursive:true});

const cls = (await db.collection('classes').get()).docs.filter(d=>/26SM/i.test(d.data().name||''));
let added=0, classesTouched=0;
for(const d of cls){
  const c=d.data(); const asg=c.assignments||{};
  const missing=ALL.filter(l=>!asg[l]);
  if(!missing.length) continue;
  // source assignment to mirror (prefer the one with the LATEST assignedAt = most current settings)
  const src=Object.values(asg).sort((a,b)=>(b.assignedAt?._seconds||0)-(a.assignedAt?._seconds||0))[0];
  const oldest=Math.min(...Object.values(asg).map(a=>a.assignedAt?._seconds||Math.floor(Date.now?.()/1000||0)));
  const newAt=admin.firestore.Timestamp.fromMillis((oldest-86400)*1000); // 1 day older than the oldest existing
  const newAsg={...asg};
  for(const l of missing){
    const a={ assignedAt:newAt };
    for(const k of PROPS) if(src[k]!==undefined) a[k]=src[k];
    newAsg[l]=a; added++;
  }
  const newAssignedLists=[...new Set([...(c.assignedLists||Object.keys(asg)), ...missing])];
  classesTouched++;
  console.log(`   ${c.name.replace('26SM ','').padEnd(24)} + [${missing.map(l=>LN[l]).join(',')}]  (mirror pace=${src.pace} mode=${src.testMode} thr=${src.passThreshold} tsN=${src.testSizeNew}; backdated ${new Date(newAt.toMillis()).toISOString().slice(0,10)})`);
  if(COMMIT){
    writeFileSync(`${BKDIR}/${d.id}_pre-ensure3lists.json`, JSON.stringify({assignments:asg, assignedLists:c.assignedLists}, null, 2));
    await d.ref.update({ assignments:newAsg, assignedLists:newAssignedLists, updatedAt:admin.firestore.Timestamp.now() });
  }
}
console.log(`\n${COMMIT?'✅ COMMITTED':'DRY RUN'}: ${classesTouched} classes, ${added} list-assignments added (backdated, props mirrored).`);
if(COMMIT){
  // verify
  let ok=0; const cls2=(await db.collection('classes').get()).docs.filter(d=>/26SM/i.test(d.data().name||''));
  for(const d of cls2){ const a=d.data().assignments||{}; if(ALL.every(l=>a[l])) ok++; }
  console.log(`VERIFY: ${ok}/${cls2.length} 26SM classes now have all 3 lists.`);
}
console.log(COMMIT?'[COMMITTED — backups in class_backups/*_pre-ensure3lists.json]':'[DRY RUN — re-run with --commit]');
process.exit(0);
