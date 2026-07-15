/**
 * CS — READ-ONLY: "Blocked" 26SM students who logged in on/after a cutoff date.
 *
 * "Logged in"  = Firebase Auth metadata.lastSignInTime >= cutoff (KST). This is the only
 *                canonical last-login record (no separate login event log exists).
 * "Blocked"    = the student CANNOT ADVANCE on their ACTIVE list — either:
 *                (A) #11 review-only wall: their next day allocates newWordCount<=0
 *                    (list-end: twi>=listSize  |  throttle: interv->1.0 from low reviews), OR
 *                (B) impossible/stuck session_state: phase=review-study but newWordsTestPassed
 *                    is false AND there is no passed 'new' attempt for that day (lost-save stuck,
 *                    e.g. CS-2026-07-07 최도훈).
 *
 * Active list per student = (primaryFocusClassId, primaryFocusListId) if both set & that
 * class_progress exists, else the started class_progress with the greatest twi (their furthest).
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/scan-blocked-recent-login.mjs [classRegex=26SM] [cutoff=2026-07-12]
 * NO WRITES.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();

const filter = new RegExp(process.argv[2] || '26SM', 'i');
const cutoffDay = process.argv[3] || '2026-07-12';
// KST cutoff: <day> 00:00 KST == <day>T00:00+09:00
const CUTOFF_MS = new Date(`${cutoffDay}T00:00:00+09:00`).getTime();
const round = (x) => Math.round(x);
const kstDate = (ms) => new Date(ms + 9*3600*1000).toISOString().slice(0,16).replace('T',' ');

// ---- 1. 26SM classes + assignments (listId, pace) ----
const cs = await db.collection('classes').get();
const classes = [];
cs.forEach(d => { const c = d.data(); if (filter.test(c.name||'')) {
  const assigns = Object.entries(c.assignments||{}).map(([lid,a]) => ({ listId:lid, pace:a.pace||80 }));
  classes.push({ id:d.id, name:c.name, assigns, students:c.studentIds||[] });
}});
const listIds = new Set(classes.flatMap(c=>c.assigns.map(a=>a.listId)));
const listSizes = {};
for (const l of listIds) { const d = await db.collection('lists').doc(l).get(); listSizes[l] = d.exists?(d.data().wordCount||0):0; }
const paceOf = {}; // (classId_listId) -> pace
for (const c of classes) for (const a of c.assigns) paceOf[`${c.id}_${a.listId}`] = a.pace;
const classNameOf = Object.fromEntries(classes.map(c=>[c.id,c.name]));

const allUids = [...new Set(classes.flatMap(c=>c.students))];
console.log(`26SM classes: ${classes.length} | distinct students: ${allUids.length} | login cutoff: ${cutoffDay} 00:00 KST\n`);

// ---- 2. Firebase Auth lastSignInTime (batch getUsers, 100/call) ----
const lastSignIn = {}; // uid -> ms
for (let i=0;i<allUids.length;i+=100) {
  const chunk = allUids.slice(i,i+100).map(uid=>({uid}));
  const res = await auth.getUsers(chunk);
  for (const u of res.users) {
    const t = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : 0;
    lastSignIn[u.uid] = t;
  }
}
const recent = allUids.filter(uid => (lastSignIn[uid]||0) >= CUTOFF_MS);
console.log(`Logged in on/after ${cutoffDay}: ${recent.length} / ${allUids.length} students\n`);

// ---- 3. For each recent student: find active list & evaluate blocked ----
const blocked = [];
let evaluated = 0;
for (const uid of recent) {
  evaluated++;
  // gather this student's started 26SM class_progress docs
  const cpSnap = await db.collection('users').doc(uid).collection('class_progress').get();
  const my26 = cpSnap.docs
    .map(d => ({ id:d.id, ...d.data() }))
    .filter(p => classNameOf[p.classId] && (p.currentStudyDay||0) > 0);
  if (my26.length === 0) continue;

  let userDoc; try { userDoc = (await db.collection('users').doc(uid).get()).data(); } catch { userDoc = null; }

  // ACTIVE list = the list of the student's MOST RECENT attempt (what they're actually doing now).
  // NOT greatest-twi / primaryFocus — those falsely flag students who FINISHED an early list
  // (Base Camp = high twi, or a stale primaryFocus) but have since moved on to a newer list.
  const myAttempts = (await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  if (!myAttempts.length) continue;
  const latest = myAttempts.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const activeList = latest.listId;
  // class_progress for that list: prefer the attempt's own class, else the started cp on that list w/ max twi
  let active = my26.find(p=>p.listId===activeList && p.classId===latest.classId)
    || my26.filter(p=>p.listId===activeList).sort((a,b)=>(b.totalWordsIntroduced||0)-(a.totalWordsIntroduced||0))[0];
  if (!active) continue; // most-recent attempt is on a non-26SM / unstarted list — skip

  const csd = active.currentStudyDay||0, twi = active.totalWordsIntroduced||0;
  const size = listSizes[active.listId]||0;
  const pace = paceOf[`${active.classId}_${active.listId}`] || 80;
  const wordsRemaining = size - twi;
  const revs = (active.recentSessions||[]).map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
  const interv = revs.length < 3 ? (active.interventionLevel||0)
    : Math.min(1, Math.max(0,(0.75 - revs.reduce((a,b)=>a+b,0)/revs.length)/0.45));
  const newWordCount = Math.min(round(pace*(1-interv)), wordsRemaining);

  // (A) #11 wall
  let reason = null, kind = null;
  if (newWordCount <= 0) { kind = wordsRemaining <= 0 ? 'listEnd' : 'throttle';
    reason = kind==='listEnd' ? `list-end (twi ${twi}/${size})` : `throttle interv=${interv.toFixed(2)}`; }

  // (B) impossible/stuck session_state (only if not already flagged)
  if (!reason) {
    const ss = (await db.collection('users').doc(uid).collection('session_states')
      .doc(`${active.classId}_${active.listId}`).get());
    if (ss.exists) {
      const s = ss.data();
      if (s.phase==='review-study' && s.newWordsTestPassed===false) {
        // stuck only if no passed 'new' attempt exists for the session's day
        const day = s.sessionConfig?.dayNumber || csd+1;
        const hasNewPass = myAttempts.some(a=>a.listId===active.listId && a.sessionType==='new' && a.studyDay===day && a.passed===true);
        if (!hasNewPass) { kind='stuckSession'; reason=`impossible state: review-study but new-test not passed (day ${day}, no anchor)`; }
      }
    }
  }

  if (reason) blocked.push({ uid, email:userDoc?.email||'?', name:userDoc?.profile?.displayName||'?',
    cls:(classNameOf[active.classId]||'?').replace('26SM ',''), listId:active.listId, csd, twi, size, kind, reason,
    lastLogin:kstDate(lastSignIn[uid]) });
}

// ---- 4. report ----
blocked.sort((a,b)=> a.kind<b.kind?-1:a.kind>b.kind?1:a.cls.localeCompare(b.cls));
const by = k => blocked.filter(b=>b.kind===k);
console.log(`=== BLOCKED (recent-login) : ${blocked.length} of ${recent.length} recent students ===`);
console.log(`   list-end #11: ${by('listEnd').length} | throttle #11: ${by('throttle').length} | stuck session: ${by('stuckSession').length}\n`);
for (const grp of ['listEnd','throttle','stuckSession']) {
  const g = by(grp); if (!g.length) continue;
  console.log(`--- ${grp} (${g.length}) ---`);
  for (const b of g) console.log(`  ${b.cls.padEnd(20)} ${String(b.name).padEnd(14)} ${String(b.email).padEnd(34)} csd=${b.csd} twi=${b.twi}/${b.size} login=${b.lastLogin}  ${b.reason}`);
  console.log('');
}
console.log(`[done — READ-ONLY, no writes]  evaluated ${evaluated} recent-login students`);
process.exit(0);
