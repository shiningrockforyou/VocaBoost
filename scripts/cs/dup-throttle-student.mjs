// Faithfully duplicate ONE real THROTTLE #11 student (progress + study_states + attempts) into a renamed
// sandbox copy so the escape can be driven on authentic throttled data. READ real; WRITE only new docs.
import { readFileSync } from 'fs';
import admin from 'firebase-admin';
const KEY=process.env.LSR_SA_KEY||new URL('../serviceAccountKey.json',import.meta.url);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(JSON.parse(readFileSync(KEY,'utf8')))});
const db=admin.firestore(); const {FieldValue}=admin.firestore;
const PASS=JSON.parse(readFileSync(new URL('../../audit/playwright/.lsr_secret.json',import.meta.url),'utf8')).password;
const COMMIT=process.argv.includes('--commit');
const REAL=JSON.parse(process.env.REALJSON);
const teacherUid=(await admin.auth().getUserByEmail('lsr_teacher_02@vocaboost.test')).uid;
const rC=(await db.collection('classes').doc(REAL.classId).get()).data();
const rU=(await db.collection('users').doc(REAL.uid).get()).data();
const rP=(await db.collection('users').doc(REAL.uid).collection('class_progress').doc(REAL.classId+'_'+REAL.listId).get()).data();
const dupClassId='DUP_hardA_'+REAL.classId, dupName='25WT DUP HARDFROZEN-A '+rC.name, email='dup_hardA@vocaboost.test';
console.log('REAL',rU.profile?.displayName,'csd='+rP.currentStudyDay,'twi='+rP.totalWordsIntroduced,'interv='+rP.interventionLevel,'pace='+(rC.assignments?.[REAL.listId]?.pace));
console.log('recentSessions reviews:',JSON.stringify((rP.recentSessions||[]).map(s=>s.reviewScore)));
if(!COMMIT){console.log('DRY-RUN. re-run --commit');process.exit(0);}
let uid; try{uid=(await admin.auth().getUserByEmail(email)).uid;}catch{uid=(await admin.auth().createUser({email,password:PASS,emailVerified:true})).uid;}
await db.collection('users').doc(uid).set({role:'student',email,profile:{...(rU.profile||{}),displayName:'⧉DUP-THR '+(rU.profile?.displayName||'')},stats:rU.stats||{},challenges:rU.challenges||{},settings:{...(rU.settings||{}),primaryFocusClassId:dupClassId,primaryFocusListId:REAL.listId},enrolledClasses:{[dupClassId]:{name:dupName,joinedAt:FieldValue.serverTimestamp()}},createdAt:FieldValue.serverTimestamp()},{merge:true});
await db.collection('users').doc(uid).collection('class_progress').doc(dupClassId+'_'+REAL.listId).set({...rP,classId:dupClassId,listId:REAL.listId,updatedAt:FieldValue.serverTimestamp()});
// study_states
let ss=await db.collection('users').doc(REAL.uid).collection('study_states').where('listId','==',REAL.listId).get();
for(let i=0;i<ss.docs.length;i+=400){const bt=db.batch();ss.docs.slice(i,i+400).forEach(d=>bt.set(db.collection('users').doc(uid).collection('study_states').doc(d.id),d.data()));await bt.commit();}
// attempts (rewrite ids)
let att=await db.collection('attempts').where('studentId','==',REAL.uid).where('listId','==',REAL.listId).get();
for(let i=0;i<att.docs.length;i+=400){const bt=db.batch();att.docs.slice(i,i+400).forEach(d=>bt.set(db.collection('attempts').doc(),{...d.data(),studentId:uid,classId:dupClassId,teacherId:teacherUid}));await bt.commit();}
// dup class
await db.collection('classes').doc(dupClassId).set({name:dupName,ownerTeacherId:teacherUid,joinCode:'DUPTHR',assignedLists:rC.assignedLists||[REAL.listId],assignments:rC.assignments||{},mandatoryLists:rC.mandatoryLists||[],settings:rC.settings||{},studentIds:[uid],studentCount:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
console.log('✅ dup throttle:',email,'class='+dupClassId,'list='+REAL.listId,'| study_states='+ss.size,'attempts='+att.size);
process.exit(0);
