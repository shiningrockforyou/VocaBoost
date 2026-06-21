import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const cs=await db.collection('classes').get();
const seen=new Set();
cs.forEach(c=>{for(const a of Object.values(c.data().assignments||{})){
  const k=`min=${a.reviewTestSizeMin} max=${a.reviewTestSizeMax} type=${a.reviewTestType}`;
  if(!seen.has(k)){seen.add(k);}
}});
console.log('distinct review-size settings across ALL classes:'); [...seen].forEach(k=>console.log('  '+k));
process.exit(0);
