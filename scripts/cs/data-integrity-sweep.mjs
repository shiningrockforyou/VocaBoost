/**
 * CS — Data Integrity Sweep (READ-ONLY)
 *
 * Purpose: scan a cohort of classes for the data-corruption signatures we've learned to
 * watch for. Makes NO writes. Run periodically or after live-support interventions.
 *
 * Usage:
 *   node scripts/cs/data-integrity-sweep.mjs [classNameRegex]   (default: 26SM)
 *
 * Checks (per started student): duplicate/orphan class_progress, docId mismatch,
 * implausible CSD vs TWI, TWI over list size, PHANTOM ANCHOR (passed-new whose
 * newWordEndIndex is at/beyond the list's actual word count — a manual-pass for a day
 * that exceeds the list content, see SUPPORT_RUNBOOK CS-2026-07-19), INVALID ANCHOR
 * (passed-new missing newWordEndIndex — CS-2026-06-21), 'no_class' attempts,
 * review-without-passed-new, ghost progress, missing programStartDate.
 *
 * NOTE (CS-2026-07-19 fix): twiOverList + phantomAnchor now compare each progress/attempt
 * doc to ITS OWN listId's word count — not the class's first-assignment list. The old
 * single-list-per-class comparison silently missed multi-list students (e.g. Base Camp
 * progress compared against an Ascent-sized list), which is how 최도훈's twi=1280>1200 hid.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const filter = new RegExp(process.argv[2] || '26SM', 'i');

const cs = await db.collection('classes').get();
const classes = [];
cs.forEach(d => { const c=d.data(); if (filter.test(c.name||'')) { const L=c.assignments?Object.keys(c.assignments)[0]:null; classes.push({id:d.id,name:c.name,listId:L,students:c.studentIds||[]}); }});
console.log(`classes matching /${filter.source}/i: ${classes.length} | distinct students: ${new Set(classes.flatMap(c=>c.students)).size}\n`);

// lazy, cached actual word count PER LIST (from the words subcollection — authoritative, not the possibly-stale
// wordCount field). Compare every doc to ITS OWN list, so multi-list students are covered.
const _sizeCache = {};
async function sizeOf(L){ if(L==null||L==='')return 0; if(_sizeCache[L]==null){ try{ const c=await db.collection('lists').doc(L).collection('words').count().get(); _sizeCache[L]=c.data().count||0; }catch{ const d=await db.collection('lists').doc(L).get(); _sizeCache[L]=d.exists?(d.data().wordCount||0):0; } } return _sizeCache[L]; }

const F = { dupProgress:[], orphanTwi:[], docIdMismatch:[], csdImplausible:[], twiOverList:[], phantomAnchor:[], invalidAnchor:[], noClassAttempt:[], reviewNoNewPass:[], ghostProgress:[], missingProgramStart:[] };
let scanned=0, started=0;
for (const cls of classes) { if(!cls.listId)continue;
  for (const uid of cls.students) { scanned++;
    const cpDocs = (await db.collection('users').doc(uid).collection('class_progress').get()).docs.filter(d=>d.data().classId===cls.id);
    const byKey={}; cpDocs.forEach(d=>{const p=d.data();const k=`${p.classId}_${p.listId}`;(byKey[k]=byKey[k]||[]).push(d.id);});
    for(const[k,ids]of Object.entries(byKey)) if(ids.length>1) F.dupProgress.push(`${uid.slice(0,8)} ${cls.name.slice(0,18)} x${ids.length}`);
    // per-doc checks across ALL lists (not just the class's first-assignment list)
    for (const d of cpDocs) { const p=d.data();
      if(p.classId&&p.listId&&d.id!==`${p.classId}_${p.listId}`) F.docIdMismatch.push(`${uid.slice(0,8)} ${d.id.slice(0,16)}`);
      if(p.totalWordsIntroduced==null&&(p.currentStudyDay||0)>0) F.orphanTwi.push(`${uid.slice(0,8)} csd=${p.currentStudyDay}`);
      const lsz=await sizeOf(p.listId);
      if(lsz>0&&(p.totalWordsIntroduced||0)>lsz) F.twiOverList.push(`${uid.slice(0,8)} ${(p.listId||'').slice(0,8)} twi=${p.totalWordsIntroduced}>${lsz}`);
    }
    const good = cpDocs.find(d=>d.id===`${cls.id}_${cls.listId}`); if(!good)continue;
    const p=good.data(); const csd=p.currentStudyDay||0, twi=p.totalWordsIntroduced||0; if(csd>0)started++;
    if(!p.programStartDate&&csd>0) F.missingProgramStart.push(`${uid.slice(0,8)} csd=${csd}`);
    if((twi>0&&csd>twi+7)||(twi===0&&csd>7)) F.csdImplausible.push(`${uid.slice(0,8)} csd=${csd} twi=${twi}`);
    const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
    const allPn=at.filter(a=>a.sessionType==='new'&&a.passed===true);
    // PHANTOM ANCHOR: a passed-new anchor whose newWordEndIndex is at/beyond its list's actual content
    // (a manual-pass for a day past the list end fabricates words that don't exist → inflates twi).
    for(const a of allPn){ const asz=await sizeOf(a.listId); if(asz>0&&Number.isInteger(a.newWordEndIndex)&&a.newWordEndIndex>=asz){ F.phantomAnchor.push(`${uid.slice(0,8)} day${a.studyDay} ${(a.listId||'').slice(0,8)} nwei=${a.newWordEndIndex}>=${asz}${a.manualOverride?' MANUAL':''}`); break; } }
    const fc=at.filter(a=>a.classId===cls.id||(a.testId||'').includes(cls.id)||a.listId===cls.listId);
    const pn=fc.filter(a=>a.sessionType==='new'&&a.passed===true);
    if(pn.some(a=>!(Number.isInteger(a.newWordEndIndex)&&a.newWordEndIndex>=0))) F.invalidAnchor.push(`${uid.slice(0,8)} ${cls.name.slice(0,18)}`);
    if(fc.some(a=>a.classId==='no_class')) F.noClassAttempt.push(`${uid.slice(0,8)} ${cls.name.slice(0,18)}`);
    if(csd>0&&fc.length===0) F.ghostProgress.push(`${uid.slice(0,8)} csd=${csd} 0-attempts`);
    const rd=new Set(fc.filter(a=>a.sessionType==='review').map(a=>a.studyDay)), np=new Set(pn.map(a=>a.studyDay));
    for(const d of rd) if(!np.has(d)&&d>1){F.reviewNoNewPass.push(`${uid.slice(0,8)} reviewDay=${d}`);break;}
  }}
console.log(`scanned ${scanned} enrollments | ${started} started\n=== FINDINGS ===`);
let total=0;
for(const[k,arr]of Object.entries(F)){total+=arr.length;console.log(`${k}: ${arr.length}`);[...new Set(arr)].slice(0,8).forEach(s=>console.log('   '+s));}
console.log(`\nTOTAL findings: ${total} ${total===0?'✓ CLEAN':''}`);
process.exit(0);
