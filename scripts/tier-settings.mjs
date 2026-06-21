import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const want=['26SM SAT Inter A1','26SM SAT Adv A1','26SM SAT Adv A2','26SM SAT Final A','26SM SAT Final B'];
const cs=await db.collection('classes').get();
for(const c of cs.docs){ const cd=c.data(); if(!want.includes(cd.name))continue;
  for(const [lid,a] of Object.entries(cd.assignments||{})){
    console.log(`${cd.name} | pace=${a.pace} new/day | reviewTest ${a.reviewTestSizeMin}-${a.reviewTestSizeMax} | testMode=${a.testMode} | days/wk=${a.studyDaysPerWeek} | list=${lid.slice(0,6)}`);
  }
}
process.exit(0);
