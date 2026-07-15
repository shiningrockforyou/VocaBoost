/**
 * CS-2026-07-14 READ-ONLY: find 26SM students stuck in the #11 THROTTLE review-only deadlock
 * (same condition as 정지수/jisusophia): low recent reviews → interventionLevel→1.0 →
 * newWordCount = round(pace*(1-interv)) <= 0 → the NEXT day is review-only → the Day-2+ completion
 * gate ("pass the new-word test first") blocks it → csd frozen, student re-takes the review forever.
 *
 * THROTTLE only (wordsRemaining>0). List-end review-only (twi>=listSize) is a DIFFERENT fix
 * (advance to next list) and is reported separately, NOT auto-fixed here.
 *
 * "Actively stuck" = >=2 review attempts on the frozen day (csd+1) in the last 72h, csd not advancing.
 * Also emits fix params: frozenDay + best real review score on that day (for the Junseo-style completion).
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/scan-throttle-stuck.mjs [classRegex=26SM]
 * NO WRITES.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const NOW = Math.floor(Date.now()/1000);
const round = x => Math.round(x);
const kst = s => s ? new Date(s*1000+9*3600e3).toISOString().slice(5,16).replace('T',' ') : '—';

const cs = await db.collection('classes').get();
const classNameOf = {}, is26 = new Set(), paceOf = {};
cs.forEach(d => { const c=d.data(); if (filter.test(c.name||'')) { classNameOf[d.id]=c.name; is26.add(d.id);
  for (const [lid,a] of Object.entries(c.assignments||{})) paceOf[`${d.id}_${lid}`]=a.pace||80; }});
const allUids = [...new Set(cs.docs.filter(d=>is26.has(d.id)).flatMap(d=>d.data().studentIds||[]))];
const sizeCache = {};
const listSize = async l => { if (sizeCache[l]==null){ const d=await db.collection('lists').doc(l).get(); sizeCache[l]=d.exists?(d.data().wordCount||0):0; } return sizeCache[l]; };

const throttle = [], listEnd = [];
for (const uid of allUids) {
  const at = (await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data()).filter(a=>is26.has(a.classId));
  if (!at.length) continue;
  let u; try { u=(await db.collection('users').doc(uid).get()).data(); } catch { u=null; }
  // active list = most-recent attempt
  const latest = at.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const listId = latest.listId, activeClass = latest.classId;
  const cpRef = db.collection('users').doc(uid).collection('class_progress').doc(`${activeClass}_${listId}`);
  const cpSnap = await cpRef.get(); if (!cpSnap.exists) continue;
  const p = cpSnap.data(); const csd = p.currentStudyDay||0, twi = p.totalWordsIntroduced||0;
  if (csd === 0) continue;
  const pace = paceOf[`${activeClass}_${listId}`]||80;
  const size = await listSize(listId);
  const wordsRemaining = size - twi;
  const revs = (p.recentSessions||[]).map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
  const interv = revs.length < 3 ? (p.interventionLevel||0) : Math.min(1, Math.max(0,(0.75 - revs.reduce((a,b)=>a+b,0)/revs.length)/0.45));
  const newWordCount = Math.min(round(pace*(1-interv)), Math.max(0,wordsRemaining));
  if (newWordCount > 0) continue; // not review-only → not stuck by this issue

  const frozenDay = csd + 1;
  const frozenReviews = at.filter(a=>a.listId===listId && a.sessionType==='review' && a.studyDay===frozenDay);
  const recentFrozen = frozenReviews.filter(a=>(NOW-(a.submittedAt?._seconds||0)) < 72*3600);
  const bestFrozenRev = frozenReviews.length ? Math.max(...frozenReviews.map(a=>(a.score||0)))/100 : null;
  const lastFrozen = frozenReviews.reduce((m,a)=>Math.max(m,a.submittedAt?._seconds||0),0);
  const ss = await db.collection('users').doc(uid).collection('session_states').doc(`${activeClass}_${listId}`).get();
  const phase = ss.exists ? ss.data().phase : '(none)';

  const rec = { uid, name:u?.profile?.displayName||'?', email:u?.email||'?',
    cls:(classNameOf[activeClass]||'?').replace('26SM ',''), activeClass, listId, pace, csd, twi, size,
    interv:+interv.toFixed(2), last3revs:revs.map(r=>+r.toFixed(2)), frozenDay,
    nFrozenReviews:frozenReviews.length, nRecent72h:recentFrozen.length, bestFrozenRev, lastFrozen, phase };

  if (wordsRemaining <= 0) listEnd.push(rec);
  else throttle.push(rec);
}

// --emails: print ALL throttle candidate emails (stuck + at-risk) one per line, then exit
if (process.argv.includes('--emails')) { [...new Set(throttle.map(r=>r.email))].forEach(e=>console.log(e)); process.exit(0); }

// actively stuck = >=2 frozen-day review attempts AND session in review-study
const stuck = throttle.filter(r => r.nFrozenReviews >= 2 && r.phase==='review-study');
const maybe = throttle.filter(r => !(r.nFrozenReviews >= 2 && r.phase==='review-study'));
stuck.sort((a,b)=>b.lastFrozen-a.lastFrozen);

console.log(`\n=== #11 THROTTLE review-only deadlock (26SM) ===`);
console.log(`throttle candidates: ${throttle.length}  (list-end review-only, separate: ${listEnd.length})\n`);
console.log(`── ACTIVELY STUCK (>=2 frozen-day reviews + phase review-study) : ${stuck.length} → Junseo-fix targets ──`);
for (const r of stuck) console.log(`  ${String(r.name).padEnd(10)} ${String(r.email).padEnd(30)} ${r.cls.padEnd(14)} csd=${r.csd} day${r.frozenDay} twi=${r.twi}/${r.size} interv=${r.interv} last3rev=${JSON.stringify(r.last3revs)} frozenRevs=${r.nFrozenReviews}(72h:${r.nRecent72h}) bestRev=${r.bestFrozenRev} last=${kst(r.lastFrozen)}`);
console.log(`\n── other throttle (not clearly stuck / verify) : ${maybe.length} ──`);
for (const r of maybe) console.log(`  ${String(r.name).padEnd(10)} ${String(r.email).padEnd(30)} ${r.cls.padEnd(14)} csd=${r.csd} day${r.frozenDay} interv=${r.interv} last3rev=${JSON.stringify(r.last3revs)} frozenRevs=${r.nFrozenReviews} phase=${r.phase}`);
console.log(`\n(list-end review-only — NOT this fix, need next-list advance: ${listEnd.map(r=>r.email).join(', ')||'none'})`);
console.log('\n[READ-ONLY]'); process.exit(0);
