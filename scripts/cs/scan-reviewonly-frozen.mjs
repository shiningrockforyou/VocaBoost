/**
 * READ-ONLY 26SM scan (2026-07-13): count students whose NEXT day is a REVIEW-ONLY day
 * (newWordCount<=0) — i.e. they hit / will hit the #11 completion-gate freeze. Breaks down
 * throttle (low-review interv→1.0) vs list-end. NO writes.
 *   node scripts/cs/scan-reviewonly-frozen.mjs [classRegex=26SM]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const round = (x) => Math.round(x);

const cs = await db.collection('classes').get();
const classes = [];
cs.forEach(d => { const c = d.data(); if (filter.test(c.name||'')) {
  for (const [lid, a] of Object.entries(c.assignments||{})) classes.push({ id:d.id, name:c.name, listId:lid, pace:a.pace||80, students:c.studentIds||[] });
}});
const listSizes = {};
for (const l of new Set(classes.map(c=>c.listId))) { const d = await db.collection('lists').doc(l).get(); listSizes[l] = d.exists?(d.data().wordCount||0):0; }

let scanned=0, started=0;
const frozen = { throttle: [], listEnd: [] };
const seen = new Set();
for (const cls of classes) {
  for (const uid of cls.students) {
    const key = `${uid}_${cls.id}_${cls.listId}`; if (seen.has(key)) continue; seen.add(key);
    scanned++;
    const cp = await db.collection('users').doc(uid).collection('class_progress').doc(`${cls.id}_${cls.listId}`).get();
    if (!cp.exists) continue;
    const p = cp.data(); const csd = p.currentStudyDay||0, twi = p.totalWordsIntroduced||0;
    if (csd === 0) continue; started++;
    const size = listSizes[cls.listId] || 0;
    const wordsRemaining = size - twi;
    const revs = (p.recentSessions||[]).map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
    const interv = revs.length < 3 ? (p.interventionLevel||0) : Math.min(1, Math.max(0,(0.75 - revs.reduce((a,b)=>a+b,0)/revs.length)/0.45));
    const allocNew = round(cls.pace * (1 - interv));
    const newWordCount = Math.min(allocNew, wordsRemaining);
    if (newWordCount <= 0) {
      const rec = { uid, cls: cls.name.replace('26SM ',''), csd, twi, size, interv:interv.toFixed(2) };
      if (wordsRemaining <= 0) frozen.listEnd.push(rec); else frozen.throttle.push(rec);
    }
  }
}
const total = frozen.throttle.length + frozen.listEnd.length;
const all = [...frozen.throttle, ...frozen.listEnd];
// classify by recent activity: did they hit the wall in the last ~2 days (actively stuck) vs dormant (done & stopped)?
const NOW = 1752_400_000; // ~2026-07-13 (epoch seconds proxy passed via env if needed)
const nowSec = Number(process.env.NOW_SEC) || null; // pass NOW_SEC=$(date +%s) for accuracy
for (const r of all) {
  const at = (await db.collection('attempts').where('studentId','==',r.uid).get()).docs.map(d=>d.data());
  const last = at.reduce((m,a)=>(a.submittedAt?._seconds||0)>m?(a.submittedAt?._seconds||0):m,0);
  r.lastSec = last;
  r.lastDate = last ? new Date(last*1000).toISOString().slice(0,10) : '?';
  // count review attempts in last 2 days (actively hitting the wall)
  const cut = (nowSec||last) - 2*86400;
  r.recentReviews = at.filter(a=>a.sessionType==='review' && (a.submittedAt?._seconds||0)>=cut).length;
}
const ref = nowSec || Math.max(...all.map(r=>r.lastSec));
const H6 = 6*3600, D7 = 7*86400;
const inLast6h = all.filter(r=> r.lastSec >= ref - H6);              // already studied in last 6h
const target   = all.filter(r=> r.lastSec < ref - H6 && r.lastSec >= ref - D7); // active this week, NOT last 6h → coming later, will be stuck
const stale    = all.filter(r=> r.lastSec < ref - D7);              // >1 week idle
console.log(`\n=== 26SM (/${filter.source}/i) #11 REVIEW-ONLY FREEZE scan (ref=${new Date(ref*1000).toISOString()}) ===`);
console.log(`scanned ${scanned} | ${started} started | ${total} at the #11 wall  [throttle ${frozen.throttle.length} / list-end ${frozen.listEnd.length}]\n`);
console.log(`▶▶ TARGET — active in last 7d but NOT last 6h (session still coming today → unstick BEFORE they start): ${target.length}`);
target.sort((a,b)=>b.lastSec-a.lastSec).forEach(r=>console.log(`   ${r.cls.padEnd(18)} csd=${r.csd} twi=${r.twi}/${r.size} last=${r.lastDate} [${r.uid.slice(0,8)}]`));
console.log(`\n▶ studied in last 6h (already at it today — likely mid-session): ${inLast6h.length}`);
console.log(`▶ idle >7 days (truly dormant): ${stale.length}`);
console.log(`\nTOTAL at #11 wall: ${total}  →  TARGET (proactive unstick): ${target.length}, last-6h: ${inLast6h.length}, >7d idle: ${stale.length}`);
process.exit(0);
